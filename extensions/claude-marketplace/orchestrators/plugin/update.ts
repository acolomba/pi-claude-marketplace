// orchestrators/plugin/update.ts
//
// PUP-1..9 + AS-3 (3-phase) + AS-7 (orphan agent index entries) + WR-04 +
// NFR-2 + NFR-3.
//
// Two exported entrypoints (D-09 corollary):
//   1. updateSinglePlugin: PluginUpdateFn  -- cascade-safe; NEVER throws
//   2. updatePlugins(opts)                 -- direct entrypoint; PUP-1 three forms
//
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow per Phase 4 D-02 precedent):
//
//   Phase 1 (prepare): sequential bridge prepare* into tmp (skills -> commands
//     -> agents -> mcp). Any throw triggers abort of already-prepared handles
//     + appendLeaks of cleanup-leak descriptors.
//
//   Phase 2 (state-guard swap with old-resource snapshot): inside
//     `withStateGuard` re-read the plugin record, ST-9 stale-version check,
//     overwrite resources + version + updatedAt in-memory. Throw on ST-9
//     mismatch; guard does NOT save (ST-7).
//
//   Phase 3a (physical replace, aggregate failures, continue across bridges):
//     call each bridge's commitPrepared* in skills -> commands -> agents -> mcp
//     order. D-03 specifies CONTINUE across bridge failures (not fail-fast)
//     so the partial-replace state is fully observed. Failures aggregate
//     into Phase3Failure[].
//
//   Phase 3b (compose recovery hint or success): if any failures, wrap in
//     PluginUpdatePhase3Error with RECOVERY_PLUGIN_REINSTALL_PREFIX hint.
//     Else: success outcome carries WR-04 stagedAgents/stagedMcpServers.
//
// PUP-9 routing:
//   updateSinglePlugin -- cascade path -- catches into partition='failed'
//   updatePlugins      -- direct path -- surfaces phase-2-or-earlier throws via notifyError
//
// D-11 import boundaries: orchestrators/plugin/ may import named exports
// from orchestrators/marketplace/shared.ts (GitOps, DEFAULT_GIT_OPS,
// formatErrorWithCauses, resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import path from "node:path";

import {
  abortPreparedAgents,
  commitPreparedAgents,
  discoverPluginAgents,
  prepareStagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
  discoverPluginCommands,
  prepareStageCommands,
} from "../../bridges/commands/index.ts";
import {
  abortPreparedMcp,
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  abortPreparedSkills,
  commitPreparedSkills,
  discoverPluginSkills,
  prepareStageSkills,
} from "../../bridges/skills/index.ts";
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { computeHashVersion } from "../../domain/version.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import {
  appendLeaks,
  errorMessage,
  PluginUpdatePhase3Error,
  type Phase3Failure,
} from "../../shared/errors.ts";
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import {
  DEFAULT_GIT_OPS,
  formatErrorWithCauses,
  resolveScopeFromState,
  type GitOps,
} from "../marketplace/shared.ts";

import { assertNoCrossPluginConflicts } from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateFn, PluginUpdateOutcome } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// updatePlugins -- direct entrypoint (PUP-1 three forms)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Target spec for PUP-1 three forms. Phase 6 edge layer parses argv and
 * constructs this discriminated union:
 *   - `{ kind: "all" }`                                 (bare form)
 *   - `{ kind: "marketplace", marketplace }`            (@mp form)
 *   - `{ kind: "plugin", plugin, marketplace }`         (pl@mp form)
 */
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

export interface UpdatePluginsOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: UpdatePluginsTarget;
  /** D-12 injection seam; defaults to DEFAULT_GIT_OPS. */
  readonly gitOps?: GitOps;
}

/**
 * PUP-1..9 direct entrypoint. Enumerates targets per PUP-1 three forms,
 * runs PUP-2 syncCloneOnce per (scope, marketplace) pair, then drives each
 * plugin through the shared 3-phase swap. Partitions outcomes and renders
 * the MU-7-equivalent partition body + RH-5 soft-dep warnings + RH-1/RH-2
 * reload hint.
 *
 * PUP-9 direct routing: phase-2-or-earlier throws from `runThreePhaseUpdate`
 * surface via `notifyError`. Phase-3a aggregate failures land in
 * `partition='failed'` outcomes; the body's "Failed:" section names them
 * and notifyError fires for the aggregate.
 */
export async function updatePlugins(opts: UpdatePluginsOptions): Promise<void> {
  const { ctx, pi, cwd } = opts;
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;

  let targets: readonly ResolvedTarget[];
  try {
    targets = await enumerateTargets(opts);
  } catch (err) {
    notifyError(ctx, formatErrorWithCauses(err), err);
    return;
  }

  if (targets.length === 0) {
    // PUP-1 empty-set: silent success per PRD "No plugins installed."
    notifySuccess(ctx, "No plugins installed.");
    return;
  }

  // PUP-2 syncCloneOnce memoization -- per (scope, marketplace) pair.
  // Path-source marketplaces are noops (NFR-5: no network for path sources).
  // GitHub-source marketplaces refresh via gitOps.fetch + forceUpdateRef + checkout
  // (D-14 Phase 4 sequence). syncCloneOnce throws on git-side failures.
  const synced = new Set<string>();
  const syncCloneOnce = async (
    scope: Scope,
    mpName: string,
    locations: ScopedLocations,
  ): Promise<void> => {
    const key = `${scope}/${mpName}`;
    if (synced.has(key)) {
      return;
    }

    synced.add(key);

    const state = await loadState(locations.extensionRoot);
    const mp = state.marketplaces[mpName];
    if (mp === undefined) {
      throw new Error(`Marketplace "${mpName}" not found in ${scope} scope.`);
    }

    const source = mp.source as ParsedSource;
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(mpName);
      await refreshGitHubClone(cloneDir, source.ref, gitOps);
    }
    // path-source: NFR-5 noop. The manifest is re-read per-plugin below.
  };

  const outcomes: PluginUpdateOutcome[] = [];
  for (const t of targets) {
    try {
      await syncCloneOnce(t.scope, t.marketplace, t.locations);
    } catch (err) {
      // Pre-3-phase error (D-14 step failure or marketplace-missing): surface
      // via notifyError per PUP-9 direct path. Abort the whole batch -- a
      // syncClone failure means we cannot read the refreshed manifest for
      // ANY plugin in that marketplace and the rest of the batch is suspect.
      notifyError(ctx, formatErrorWithCauses(err), err);
      return;
    }

    let outcome: PluginUpdateOutcome;
    try {
      outcome = await runThreePhaseUpdate({
        plugin: t.plugin,
        marketplace: t.marketplace,
        scope: t.scope,
        cwd,
        locations: t.locations,
        cascade: false,
        ctx,
      });
    } catch (err) {
      // PUP-9 direct path: phase-2-or-earlier throws (including PI-14
      // PathContainmentError, ST-9 stale-version, prep-phase errors) surface
      // via notifyError. Abort the batch -- the plugin's resources may be
      // in an unknown state and continuing risks compounding the failure.
      notifyError(ctx, formatErrorWithCauses(err), err);
      return;
    }

    outcomes.push(outcome);
  }

  renderPartitionAndNotify(ctx, pi, outcomes);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSinglePlugin -- PluginUpdateFn impl (cascade-safe; NEVER throws)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D-09 corollary: ships the `PluginUpdateFn` impl reserved by Phase 4 D-05.
 * Phase 7 wires this into the marketplace autoupdate cascade.
 *
 * Cascade-safe contract: this function NEVER throws. All errors (including
 * PathContainmentError, ST-9 stale-version, prep failures, phase-3a aggregate
 * failures) are captured into `partition='failed'` outcomes. PUP-9.
 */
export const updateSinglePlugin: PluginUpdateFn = async (plugin, marketplace, scope) => {
  // The cascade signature does not carry `cwd`; we default to process.cwd()
  // because the cascade is invoked from a marketplace orchestrator that
  // already operates in the user's session cwd. Phase 7 wiring may add a
  // dependency-injection seam if needed.
  const cwd = process.cwd();
  const locations = locationsFor(scope, cwd);

  try {
    return await runThreePhaseUpdate({
      plugin,
      marketplace,
      scope,
      cwd,
      locations,
      cascade: true,
    });
  } catch (err) {
    // Cascade-safe: capture throws into a partition='failed' outcome so the
    // marketplace cascade can continue aggregating outcomes across plugins
    // without aborting the whole batch.
    return {
      partition: "failed",
      name: plugin,
      notes: [formatErrorWithCauses(err)],
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared 3-phase swap implementation
// ─────────────────────────────────────────────────────────────────────────────

interface ThreePhaseArgs {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /**
   * PUP-9 routing flag. `true` for the cascade path (caller is
   * `updateSinglePlugin`); `false` for the direct path (caller is
   * `updatePlugins`). Decides whether phase-3a aggregate-error rendering
   * emits a notifyError for the direct path (cascade leaves notification
   * to the marketplace orchestrator).
   */
  readonly cascade: boolean;
  /**
   * Direct-path-only notification surface. Undefined in cascade mode.
   * When defined AND phase-3a aggregates failures, this is used for the
   * notifyError fire. Phase-2-or-earlier throws propagate to the caller
   * who does its own notifyError (so this field is only consulted at the
   * phase-3 aggregate-error step).
   */
  readonly ctx?: ExtensionContext;
}

async function runThreePhaseUpdate(args: ThreePhaseArgs): Promise<PluginUpdateOutcome> {
  const { plugin, marketplace, scope, cwd, locations } = args;

  // ─── Pre-phase: resolve current vs new (PUP-3/4/5 short-circuits) ─────────

  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    return {
      partition: "skipped",
      name: plugin,
      notes: [`marketplace "${marketplace}" not found in ${scope} scope`],
    };
  }

  const record = mp.plugins[plugin];
  if (record === undefined) {
    return {
      partition: "skipped",
      name: plugin,
      notes: ["not installed"],
    };
  }

  const manifest = await loadCachedMarketplaceManifest(mp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    // PUP-5: entry vanished from refreshed manifest.
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["not in manifest"],
    };
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["entry failed schema validation"],
    };
  }

  const entry: PluginEntry = entryRaw;

  // PUP-4 skipped: requireInstallable throws "is no longer installable" per PR-6.
  let installable: ResolvedPluginInstallable;
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
    requireInstallable(resolved, "update");
    installable = resolved;
  } catch (err) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: [errorMessage(err)],
    };
  }

  // PUP-3 unchanged: STRING equality on version (PI-7; NOT semver).
  const fromVersion = record.version;
  const toVersion = await resolveUpdateVersion(entry, installable);
  if (toVersion === fromVersion) {
    return {
      partition: "unchanged",
      name: plugin,
      fromVersion,
      toVersion,
    };
  }

  // ─── Phase 1: prepare into tmp ────────────────────────────────────────────
  //
  // Bridge prepare* writes only under <extensionRoot>/<bridge>-staging/<uuid>/.
  // Sequential ordering -- skills -> commands -> agents -> mcp -- matches
  // Phase 4 D-03 PU-1 order, but mcp's "prepare" is in-memory only (it
  // materializes the merged doc; commit writes mcp.json atomically).
  //
  // PI-6 cross-plugin guard: re-check generated names against the SAME-SCOPE
  // state EXCLUDING this plugin's currently-recorded resources -- updating
  // your own plugin against your own state must not count as cross-plugin
  // conflict (a plugin updating its skill names from {a,b} -> {a,c} would
  // otherwise self-conflict on "a").

  const skillsDiscovery = await discoverPluginSkills({ pluginName: plugin, resolved: installable });
  const commandsDiscovery = await discoverPluginCommands({
    pluginName: plugin,
    resolved: installable,
  });
  const agentsSourceDir = pickAgentsSourceDir(installable);
  const agentsDiscovery =
    agentsSourceDir === ""
      ? { discovered: [] as readonly { readonly generatedName: string }[] }
      : await discoverPluginAgents({ pluginName: plugin, agentsDirs: [agentsSourceDir] });

  const generatedNames = {
    skills: skillsDiscovery.discovered.map((s) => s.generatedName),
    commands: commandsDiscovery.discovered.map((c) => c.generatedName),
    agents: agentsDiscovery.discovered.map((a) => a.generatedName),
  };

  const stateForGuard = removePluginRecord(state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);

  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);

  interface PrepHandles {
    skills?: PreparedSkillsStaging;
    commands?: PreparedCommandsStaging;
    agents?: PreparedAgentsStaging;
    mcp?: PreparedMcpStaging;
  }
  const handles: PrepHandles = {};

  try {
    handles.skills = await prepareStageSkills({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousSkillNames: record.resources.skills,
    });

    handles.commands = await prepareStageCommands({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousCommandNames: record.resources.prompts,
    });

    handles.agents = await prepareStagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      agentsSourceDir,
    });

    handles.mcp = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: marketplace,
      pluginName: plugin,
      servers: installable.mcpServers,
      sourcePath: `${installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    // PUP-7 abort sequencing (reverse order). Pitfall 4: each abort is
    // guarded individually because the abort signatures differ:
    //   - abortPreparedMcp:      sync void
    //   - abortPreparedAgents:   async, returns leak descriptor (string|undefined)
    //   - abortPreparedCommands: async void
    //   - abortPreparedSkills:   async void
    // Collect agents-side leak descriptor via appendLeaks so the ORIGINAL
    // error is never masked by the cleanup leak.
    const leaks: (string | undefined)[] = [];
    if (handles.mcp !== undefined) {
      abortPreparedMcp(handles.mcp);
    }

    if (handles.agents !== undefined) {
      leaks.push(await abortPreparedAgents(handles.agents));
    }

    if (handles.commands !== undefined) {
      await abortPreparedCommands(handles.commands);
    }

    if (handles.skills !== undefined) {
      await abortPreparedSkills(handles.skills);
    }

    throw appendLeaks(err, leaks);
  }

  // After successful phase 1, every handle is defined; capture via locals
  // so phase 2/3 callsites don't repeat the non-null narrow.
  const skillsHandle = handles.skills;
  const commandsHandle = handles.commands;
  const agentsHandle = handles.agents;
  const mcpHandle = handles.mcp;

  // ─── Phase 2: state-guard swap (with old-resource snapshot) ───────────────
  //
  // ST-9 stale-version check INSIDE the closure: if another process updated
  // this plugin between our pre-phase load and the guard's fresh load,
  // record.version !== fromVersion -> throw. The guard does NOT save (ST-7).
  //
  // The closure mutates the plugin record in-place; the guard atomically
  // saves on no-throw. After the guard returns successfully, state.json on
  // disk reflects the NEW version + NEW resources; phase 3a then performs
  // the physical replace -- bridge commits write under <scopeRoot>/agents/,
  // <extensionRoot>/resources/skills/, etc.

  try {
    await withStateGuard(locations, (s) => {
      const sMp = s.marketplaces[marketplace];
      if (sMp === undefined) {
        throw new Error(
          `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
        );
      }

      const sRecord = sMp.plugins[plugin];
      if (sRecord === undefined) {
        // ST-9: plugin concurrently uninstalled between our load and now.
        throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
      }

      if (sRecord.version !== fromVersion) {
        // ST-9: plugin concurrently updated by another process.
        throw new Error(
          `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
        );
      }

      // Swap in new resources + version + updatedAt.
      sRecord.version = toVersion;
      sRecord.resources = {
        skills: skillsHandle.result.recorded.map((r) => r.generatedName),
        prompts: commandsHandle.result.recorded.map((r) => r.generatedName),
        agents: agentsHandle.result.recorded.map((r) => r.generatedName),
        mcpServers: mcpHandle.result.recorded.map((r) => r.generatedName),
      };
      sRecord.compatibility = {
        installable: true,
        notes: [...installable.notes],
        supported: [...installable.supported],
        unsupported: [...installable.unsupported],
      };
      sRecord.resolvedSource = installable.pluginRoot;
      sRecord.updatedAt = new Date().toISOString();
    });
  } catch (err) {
    // Phase 2 failure: abort all prep handles + rethrow.
    const leaks: (string | undefined)[] = [];
    abortPreparedMcp(mcpHandle);
    leaks.push(await abortPreparedAgents(agentsHandle));
    await abortPreparedCommands(commandsHandle);
    await abortPreparedSkills(skillsHandle);
    throw appendLeaks(err, leaks);
  }

  // ─── Phase 3a: physical replace; aggregate failures across bridges ────────
  //
  // D-03 discipline: CONTINUE across bridge-commit failures (not fail-fast)
  // so the partial-replace state is fully observed. Phase3Failure entries
  // carry per-bridge cause references; the aggregate error wraps them.
  //
  // The four commits run in skills -> commands -> agents -> mcp order
  // (matching install's PI-9 order). Each commit is independently atomic
  // at the OS level (rename for skills/commands/agents; atomicWriteJson
  // for mcp).

  const phase3aFailures: Phase3Failure[] = [];

  try {
    const leak = await commitPreparedSkills(skillsHandle);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedCommands(commandsHandle);
  } catch (err) {
    phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
  }

  try {
    const leak = await commitPreparedAgents(agentsHandle);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "agents",
        msg: `agents staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "agents", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedMcp(mcpHandle);
  } catch (err) {
    phase3aFailures.push({ phase: "mcp", msg: errorMessage(err), cause: err });
  }

  // ─── Phase 3b: aggregate error path with recovery hint, OR success ────────

  if (phase3aFailures.length > 0) {
    const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
    const aggregateMsg = `Plugin "${plugin}" update failed during physical replace. ${recoveryHint}`;
    const firstCause = phase3aFailures[0]?.cause;
    const aggregate = new PluginUpdatePhase3Error(
      aggregateMsg,
      phase3aFailures,
      firstCause !== undefined ? { cause: firstCause } : undefined,
    );
    // PUP-9 direct path: surface aggregate error via notifyError. The
    // returned partition='failed' outcome lets the partition renderer
    // include it in the "Failed:" body so the user sees both the
    // notification and the per-bridge breakdown.
    if (!args.cascade && args.ctx !== undefined) {
      notifyError(args.ctx, formatErrorWithCauses(aggregate), aggregate);
    }

    return {
      partition: "failed",
      name: plugin,
      fromVersion,
      toVersion,
      notes: [aggregateMsg, ...phase3aFailures.map((f) => `${f.phase}: ${f.msg}`)],
    };
  }

  // Success: WR-04 fields populated for Phase 4 cascade-side RH-5 composition.
  const stagedAgents = agentsHandle.result.recorded.map((r) => r.generatedName);
  const stagedMcpServers = mcpHandle.result.recorded.map((r) => r.generatedName);
  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgents,
    stagedMcpServers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Partition rendering + reload hint composition (mirror Phase 4 update.ts)
// ─────────────────────────────────────────────────────────────────────────────

function renderPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly PluginUpdateOutcome[],
): void {
  const partitions: Record<PluginUpdateOutcome["partition"], PluginUpdateOutcome[]> = {
    updated: [],
    unchanged: [],
    skipped: [],
    failed: [],
  };
  for (const o of outcomes) {
    partitions[o.partition].push(o);
  }

  const updatedNames = partitions.updated.map((o) => o.name).sort((a, b) => a.localeCompare(b));

  // MU-7-equivalent body. The leading summary line is followed by the
  // per-partition listings.
  const baseLines: string[] = [];
  if (partitions.updated.length > 0) {
    baseLines.push(
      partitions.updated.length === 1
        ? `Updated plugin "${updatedNames[0] ?? ""}".`
        : `Updated ${partitions.updated.length.toString()} plugins.`,
    );
  } else if (
    partitions.failed.length === 0 &&
    partitions.skipped.length === 0 &&
    partitions.unchanged.length > 0
  ) {
    baseLines.push("All targeted plugins are already up to date.");
  } else if (
    partitions.failed.length === 0 &&
    partitions.unchanged.length === 0 &&
    partitions.skipped.length > 0
  ) {
    baseLines.push("No plugins were updated.");
  } else {
    baseLines.push("Plugin update complete.");
  }

  renderPartition(baseLines, "Updated", partitions.updated, /*withVersions*/ true);
  renderPartition(baseLines, "Unchanged", partitions.unchanged, false);
  renderPartition(baseLines, "Skipped", partitions.skipped, false);
  renderPartition(baseLines, "Failed", partitions.failed, false);

  let body = baseLines.join("\n");

  // RH-5 soft-dep composition: aggregate stagedAgents + stagedMcpServers
  // across the `updated` partition (matches Phase 4 update.ts).
  const stagedAgents: string[] = [];
  const stagedMcpServers: string[] = [];
  for (const o of partitions.updated) {
    if (o.stagedAgents !== undefined) {
      stagedAgents.push(...o.stagedAgents);
    }

    if (o.stagedMcpServers !== undefined) {
      stagedMcpServers.push(...o.stagedMcpServers);
    }
  }

  const subagentWarn = subagentWarningIfNeeded(pi, stagedAgents);
  const mcpWarn = mcpAdapterWarningIfNeeded(pi, stagedMcpServers);
  if (subagentWarn !== "") {
    body = `${body}\n${subagentWarn}`;
  }

  if (mcpWarn !== "") {
    body = `${body}\n${mcpWarn}`;
  }

  // PUP-8 / RH-1 / RH-2: reload hint with verb 'refresh' iff updated[].length > 0.
  const hint = reloadHint("refresh", updatedNames);
  notifySuccess(ctx, appendReloadHint(body, hint));
}

function renderPartition(
  lines: string[],
  label: string,
  outcomes: readonly PluginUpdateOutcome[],
  withVersions: boolean,
): void {
  if (outcomes.length === 0) {
    return;
  }

  lines.push(`${label}:`);
  for (const o of [...outcomes].sort((a, b) => a.name.localeCompare(b.name))) {
    if (withVersions && o.fromVersion !== undefined && o.toVersion !== undefined) {
      lines.push(`  - ${o.name} (${o.fromVersion} → ${o.toVersion})`);
    } else if (o.notes !== undefined && o.notes.length > 0) {
      lines.push(`  - ${o.name}: ${o.notes.join("; ")}`);
    } else {
      lines.push(`  - ${o.name}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
}

async function enumerateTargets(opts: UpdatePluginsOptions): Promise<readonly ResolvedTarget[]> {
  const { cwd, target } = opts;
  const explicitScope = opts.scope;

  if (target.kind === "plugin" || target.kind === "marketplace") {
    const mpName = target.marketplace;
    let scope: Scope;
    let locations: ScopedLocations;
    if (explicitScope !== undefined) {
      scope = explicitScope;
      locations = locationsFor(scope, cwd);
      const state = await loadState(locations.extensionRoot);
      if (state.marketplaces[mpName] === undefined) {
        throw new Error(`Marketplace "${mpName}" not found in ${scope} scope.`);
      }
    } else {
      const userLocations = locationsFor("user", cwd);
      const projectLocations = locationsFor("project", cwd);
      const resolved = await resolveScopeFromState(mpName, userLocations, projectLocations);
      scope = resolved.scope;
      locations = resolved.locations;
    }

    const state = await loadState(locations.extensionRoot);
    const mp = state.marketplaces[mpName];
    if (mp === undefined) {
      throw new Error(`Marketplace "${mpName}" not found in ${scope} scope.`);
    }

    if (target.kind === "plugin") {
      return [{ plugin: target.plugin, marketplace: mpName, scope, locations }];
    }

    return Object.keys(mp.plugins).map((p) => ({
      plugin: p,
      marketplace: mpName,
      scope,
      locations,
    }));
  }

  // bare form: every installed plugin across selected scope(s).
  const scopes: readonly Scope[] =
    explicitScope !== undefined ? [explicitScope] : ["user", "project"];
  const out: ResolvedTarget[] = [];
  for (const sc of scopes) {
    const locations = locationsFor(sc, cwd);
    const state = await loadState(locations.extensionRoot);
    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      for (const p of Object.keys(mp.plugins)) {
        out.push({ plugin: p, marketplace: mpName, scope: sc, locations });
      }
    }
  }

  return out;
}

/**
 * D-14 follow-upstream-blindly sequence for GitHub-source clones. Mirrors
 * Phase 4 marketplace/update.ts::refreshGitHubClone but inlined here since
 * Phase 4 did not export it (D-11 import boundary).
 */
async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
): Promise<void> {
  await gitOps.fetch({
    dir: cloneDir,
    remote: "origin",
    ...(storedRef !== undefined && { ref: storedRef }),
  });

  if (storedRef === undefined) {
    // Default-branch tracking.
    const remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: "refs/remotes/origin/HEAD",
    });
    const localBranch = await gitOps.currentBranch({ dir: cloneDir });
    if (localBranch === undefined) {
      // Detached HEAD: check out the remote SHA directly.
      await gitOps.checkout({ dir: cloneDir, ref: remoteSha });
      return;
    }

    await gitOps.forceUpdateRef({
      dir: cloneDir,
      ref: `refs/heads/${localBranch}`,
      value: remoteSha,
    });
    await gitOps.checkout({ dir: cloneDir, ref: localBranch });
    return;
  }

  // Probe whether storedRef is a branch on origin.
  let remoteSha: string | undefined;
  try {
    remoteSha = await gitOps.resolveRef({
      dir: cloneDir,
      ref: `refs/remotes/origin/${storedRef}`,
    });
  } catch {
    remoteSha = undefined;
  }

  if (remoteSha !== undefined) {
    await gitOps.forceUpdateRef({
      dir: cloneDir,
      ref: `refs/heads/${storedRef}`,
      value: remoteSha,
    });
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  } else {
    // Detached HEAD path: storedRef is a tag/SHA.
    await gitOps.checkout({ dir: cloneDir, ref: storedRef });
  }
}

async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * PI-7-symmetric version precedence for the update path. The PRD §11 PI-7
 * contract is "entry.version > hash"; on update, an entry that previously
 * carried `entry.version: "1.0.0"` may have been bumped to `"1.1.0"`, OR
 * may have lost its version field entirely (manifest author error). In the
 * latter case we fall back to the hash; the comparison with `record.version`
 * is STRING equality (PUP-3).
 */
async function resolveUpdateVersion(
  entry: PluginEntry,
  installable: ResolvedPluginInstallable,
): Promise<string> {
  if (typeof entry.version === "string" && entry.version.length > 0) {
    return entry.version;
  }

  return computeHashVersion(installable.pluginRoot);
}

/**
 * Translate the resolver's `componentPaths.agents: readonly string[]` into
 * the bridge's `agentsSourceDir: string` API. Empty array -> "" sentinel
 * (no agents component). First-element wins (mirrors install.ts).
 */
function pickAgentsSourceDir(installable: ResolvedPluginInstallable): string {
  const first = installable.componentPaths.agents[0];
  if (first === undefined) {
    return "";
  }

  return path.isAbsolute(first) ? first : path.join(installable.pluginRoot, first);
}

/**
 * PI-6 cross-plugin guard helper. Returns a shallow-cloned state with the
 * (marketplace, plugin) record removed -- so the guard counts this plugin's
 * OWN current resources as "not yet owned" and only catches conflicts
 * against OTHER plugins.
 *
 * Shallow-clone discipline: deep-clone only the bytes the guard reads
 * (marketplaces -> per-mp -> plugins map). Every other branch reference is
 * shared. This keeps the helper cheap on hot paths.
 */
function removePluginRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) {
    return cloned;
  }

  const newPlugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string, ...>.
  delete newPlugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins: newPlugins };
  return cloned;
}
