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
// resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import {
  abortPreparedAgents,
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
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
  prepareStageSkills,
} from "../../bridges/skills/index.ts";
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { renderRollbackPartial } from "../../presentation/rollback-partial.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  appendLeaks,
  errorMessage,
  PluginShapeError,
  PluginUpdatePhase3Error,
  type Phase3Failure,
} from "../../shared/errors.ts";
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { DEFAULT_GIT_OPS, refreshGitHubClone, type GitOps } from "../marketplace/shared.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import {
  assertNoCrossPluginConflicts,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  resolvePluginVersion,
} from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  MarketplaceRow,
  PluginCascadeRow,
  RollbackChild,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
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
  /**
   * AG-7 opt-in flag. Default false: re-staged agents omit `model:` and
   * Pi picks its own default. The edge handler sets this to `true` only
   * when the user supplies `--map-model` on `/claude:plugin update`.
   * The marketplace autoupdate cascade (`updateSinglePlugin`) does NOT
   * accept this flag; cascade-driven re-installs always omit `model:`.
   */
  readonly mapModel?: boolean;
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
    // D-CMC-12: notifyError auto-appends the MSG-CC-1 cause-chain trailer.
    notifyError(ctx, errorMessage(err), err);
    return;
  }

  if (targets.length === 0) {
    // CMC-10 / MSG-ER-1: bare empty token rendered via the Wave 1 renderer
    // (no icon, no scope brackets); supersedes the legacy PRD "No plugins
    // installed." sentence form retired by Plan 13-02a-01.
    notifySuccess(ctx, renderRow({ kind: "empty", token: "no plugins" }, softDepStatus(pi)));
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

  // Pair each outcome with its target so the cascade renderer can group
  // by (scope, marketplace) per CMC-21 (per-scope rendering, no collapse).
  // The bare update across multiple scopes / marketplaces becomes one
  // cascade block per (scope, marketplace) pair.
  const outcomes: { readonly target: ResolvedTarget; readonly outcome: PluginUpdateOutcome }[] = [];
  for (const t of targets) {
    try {
      await syncCloneOnce(t.scope, t.marketplace, t.locations);
    } catch (err) {
      // Pre-3-phase error (D-14 step failure or marketplace-missing): surface
      // via notifyError per PUP-9 direct path. Abort the whole batch -- a
      // syncClone failure means we cannot read the refreshed manifest for
      // ANY plugin in that marketplace and the rest of the batch is suspect.
      // D-CMC-12: notifyError auto-appends the MSG-CC-1 cause-chain trailer.
      notifyError(ctx, errorMessage(err), err);
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
        // AG-7 opt-in: thread `--map-model` from the user-facing options
        // bag into the per-plugin 3-phase swap. The cascade entrypoint
        // (`updateSinglePlugin`) intentionally never sets this -- it
        // resolves to false at the bridge call site so cascade re-installs
        // always omit `model:`.
        mapModel: opts.mapModel ?? false,
      });
    } catch (err) {
      // PUP-9 direct path: phase-2-or-earlier throws (including PI-14
      // PathContainmentError, ST-9 stale-version, prep-phase errors) surface
      // via notifyError. Abort the batch -- the plugin's resources may be
      // in an unknown state and continuing risks compounding the failure.
      // D-CMC-12: notifyError auto-appends the MSG-CC-1 cause-chain trailer.
      notifyError(ctx, errorMessage(err), err);
      return;
    }

    outcomes.push({ target: t, outcome });
  }

  renderUpdateCascadeAndNotify(ctx, pi, outcomes);
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
    // without aborting the whole batch. `notes` is consumed outside the
    // notify path so the MSG-CC-1 trailer is composed inline here.
    //
    // Quick task 260525-aub: pre-narrow the closed-set `Reason` here so the
    // cascade consumer (`marketplace/update.ts::outcomeToCascadeRow`) reads
    // `outcome.reasons[0]` directly instead of re-deriving from the
    // free-text `notes` blob. Today the only typed throw we recognize on
    // the cascade path is `PluginShapeError` (from `requireInstallable`
    // during preflight). All other typed errors leave `reasons` undefined
    // so the consumer falls back to the legacy substring-narrow path.
    const typedReasons = reasonsFromTypedError(err);
    const base: PluginUpdateOutcome = {
      partition: "failed",
      name: plugin,
      notes: [composeErrorWithCauseChain(err)],
    };
    return typedReasons === undefined ? base : { ...base, reasons: typedReasons };
  }
};

/**
 * Quick task 260525-aub: typed-error -> closed-set `Reason[]` narrowing for
 * cascade-failure outcomes. Returns `undefined` when no recognized typed
 * error is present so the consumer falls back to the legacy substring-
 * narrow path on `notes`. Today only `PluginShapeError` carries enough
 * structure to map directly; other typed errors leave the narrow to the
 * consumer.
 */
function reasonsFromTypedError(err: unknown): readonly Reason[] | undefined {
  if (err instanceof PluginShapeError) {
    switch (err.kind) {
      case "no-longer-installable":
        return ["no longer installable"] as const;
      case "not-installable":
        // Cascade-path version: a not-installable throw from a CASCADE
        // update means the source classification changed since install;
        // we still surface as `"no longer installable"` because the
        // cascade-row catalog form is `(failed) {no longer installable}`.
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" should not happen at runtime
        // (the cascade walks installed plugins only); map to `"not in
        // manifest"` as the documented permissive fallback.
        return ["not in manifest"] as const;
    }
  }

  return undefined;
}

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
  /**
   * AG-7 opt-in. Set by `updatePlugins` from `UpdatePluginsOptions.mapModel`
   * (which the edge handler populates from `--map-model`). The cascade
   * entrypoint `updateSinglePlugin` intentionally NEVER sets this -- the
   * `PluginUpdateFn` cascade signature has no flag, and cascade-driven
   * re-installs must always use the omit-by-default behavior so they
   * don't override the user's Pi default model with whatever the
   * upstream agent declares. Resolves to false at the bridge call site
   * via `args.mapModel ?? false` in `prepareUpdateHandles`.
   */
  readonly mapModel?: boolean;
}

interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}

interface PluginPreflight {
  readonly state: ExtensionState;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
  readonly entry: PluginEntry;
  readonly installable: ResolvedPluginInstallable;
  readonly fromVersion: string;
  readonly toVersion: string;
}

async function preflightUpdate(
  args: ThreePhaseArgs,
): Promise<PluginPreflight | PluginUpdateOutcome> {
  const { plugin, marketplace, scope, locations } = args;
  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    // Quick task 260525-aub: pre-narrow `reasons` to the closed-set Reason
    // so the cascade consumer reads it directly instead of regex-parsing
    // `notes`. Producer-side narrowing replaces the catch-site substring
    // dispatch in `marketplace/update.ts::narrowSkipReason`.
    return {
      partition: "skipped",
      name: plugin,
      notes: [`marketplace "${marketplace}" not found in ${scope} scope`],
      reasons: ["not in manifest"] as const,
    };
  }

  const record = mp.plugins[plugin];
  if (record === undefined) {
    return {
      partition: "skipped",
      name: plugin,
      notes: ["not installed"],
      reasons: ["not installed"] as const,
    };
  }

  const manifest = await loadCachedMarketplaceManifest(mp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["not in manifest"],
      reasons: ["not in manifest"] as const,
    };
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["entry failed schema validation"],
      reasons: ["invalid manifest"] as const,
    };
  }

  const entry: PluginEntry = entryRaw;
  let installable: ResolvedPluginInstallable;
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot });
    requireInstallable(resolved, "update");
    installable = resolved;
  } catch (err) {
    // Quick task 260525-aub: `requireInstallable` now throws
    // `PluginShapeError` with `kind === "no-longer-installable"` for the
    // update verb. Pre-narrow to the closed Reason so the cascade row
    // catalog form `(skipped) {no longer installable}` is produced
    // without substring-matching the message text. Preserve `notes`
    // verbatim for the cause-chain trailer. `resolveStrict` itself
    // never throws (returns a not-installable variant), so the only
    // typed-throw producer in this block is `requireInstallable`.
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: [errorMessage(err)],
      reasons: ["no longer installable"] as const,
    };
  }

  const fromVersion = record.version;
  const toVersion = await resolvePluginVersion(entry, installable);
  if (toVersion === fromVersion) {
    return { partition: "unchanged", name: plugin, fromVersion, toVersion };
  }

  return { state, record, entry, installable, fromVersion, toVersion };
}

function isOutcome(value: PluginPreflight | PluginUpdateOutcome): value is PluginUpdateOutcome {
  return "partition" in value;
}

async function prepareUpdateHandles(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  agentsSourceDir: string | null,
): Promise<PrepHandles> {
  const { plugin, marketplace, cwd, locations } = args;
  const { installable, record } = preflight;
  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const handles: Partial<PrepHandles> = {};

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
      // AG-7 opt-in: forward the direct-path `--map-model` setting. The
      // cascade entrypoint never sets `args.mapModel`, so cascade re-
      // installs always resolve to false (omit `model:`).
      mapModel: args.mapModel ?? false,
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
    throw appendLeaks(err, await abortPartialHandles(handles));
  }

  return handles as PrepHandles;
}

async function abortPartialHandles(handles: Partial<PrepHandles>): Promise<(string | undefined)[]> {
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

  return leaks;
}

async function abortHandles(handles: PrepHandles): Promise<(string | undefined)[]> {
  abortPreparedMcp(handles.mcp);
  const leaks = [await abortPreparedAgents(handles.agents)];
  await abortPreparedCommands(handles.commands);
  await abortPreparedSkills(handles.skills);
  return leaks;
}

async function swapStateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { installable, fromVersion, toVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
    }

    if (sRecord.version !== fromVersion) {
      throw new Error(
        `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
      );
    }

    sRecord.version = toVersion;
    sRecord.resources = {
      skills: handles.skills.result.recorded.map((r) => r.generatedName),
      prompts: handles.commands.result.recorded.map((r) => r.generatedName),
      agents: handles.agents.result.recorded.map((r) => r.generatedName),
      mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
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
}

async function runThreePhaseUpdate(args: ThreePhaseArgs): Promise<PluginUpdateOutcome> {
  const { plugin, marketplace, scope } = args;

  // ─── Pre-phase: resolve current vs new (PUP-3/4/5 short-circuits) ─────────

  const preflight = await preflightUpdate(args);
  if (isOutcome(preflight)) {
    return preflight;
  }

  const { installable, fromVersion, toVersion } = preflight;

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

  const generatedNames = await discoverGeneratedNames(plugin, installable);
  const stateForGuard = removePluginRecord(preflight.state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);
  const handles = await prepareUpdateHandles(args, preflight, generatedNames.agentsSourceDir);

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
    await swapStateRecord(args, preflight, handles);
  } catch (err) {
    // Phase 2 failure: abort all prep handles + rethrow.
    throw appendLeaks(err, await abortHandles(handles));
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
    const leak = await commitPreparedSkills(handles.skills);
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
    await commitPreparedCommands(handles.commands);
  } catch (err) {
    phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
  }

  try {
    const leak = await commitPreparedAgents(handles.agents);
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
    await commitPreparedMcp(handles.mcp);
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
      aggregateCause(firstCause),
    );
    // PUP-9 direct path: surface aggregate error via notifyError. The
    // returned partition='failed' outcome lets the partition renderer
    // include it in the "Failed:" body so the user sees both the
    // notification and the per-bridge breakdown. D-CMC-12: notifyError
    // auto-appends the MSG-CC-1 cause-chain trailer.
    if (isDirectUpdate(args) && args.ctx !== undefined) {
      notifyError(args.ctx, errorMessage(aggregate), aggregate);
    }

    // Plan 13-02a-01 / CMC-17 / MSG-RP-1: surface phaseFailures structurally
    // so the cascade renderer can build the rollback-partial parent +
    // indented children block. notes[] is retained for outcome-level text
    // aggregation (consumed by outcomeOnly callers and the cascade
    // post-render trailer).
    return {
      partition: "failed",
      name: plugin,
      fromVersion,
      toVersion,
      notes: [aggregateMsg, ...phase3aFailures.map((f) => `${f.phase}: ${f.msg}`)],
      // Quick task 260525-aub: pre-narrow the closed Reason for the
      // cascade consumer (`marketplace/update.ts::outcomeToCascadeRow`)
      // -- phase-3 aggregate failures always render as `(failed)
      // {rollback partial}` per the catalog at
      // docs/output-catalog.md L330. The plugin/update.ts-local
      // `outcomeToCascadeRow` short-circuits on `phaseFailures.length
      // > 0` and ignores `reasons`; the marketplace cascade consumer
      // reads `reasons[0]` directly.
      reasons: ["rollback partial"] as const,
      phaseFailures: phase3aFailures.map((f) => ({ phase: f.phase, msg: f.msg })),
    };
  }

  // Success: WR-04 fields populated for Phase 4 cascade-side RH-5 composition.
  // Plan 13-02a-01 / CMC-13: declaresAgents / declaresMcp predicate inputs
  // mirror reinstall's effective-state contract (declares iff actually
  // staged this update). The renderer probes companion-loaded state via
  // SoftDepProbe and emits `{requires pi-subagents}` / `{requires pi-mcp}`
  // iff (declares AND unloaded).
  const stagedAgents = handles.agents.result.recorded.map((r) => r.generatedName);
  const stagedMcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
  await dropPluginCompletionCache(args);
  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgents,
    stagedMcpServers,
    declaresAgents: stagedAgents.length > 0,
    declaresMcp: stagedMcpServers.length > 0,
  };
}

async function dropPluginCompletionCache(args: ThreePhaseArgs): Promise<void> {
  try {
    await dropMarketplaceCache(
      await args.locations.pluginCacheFile(args.marketplace),
      args.scope,
      args.marketplace,
    );
  } catch (err) {
    if (isDirectUpdate(args) && args.ctx !== undefined) {
      notifyWarning(
        args.ctx,
        `Plugin "${args.plugin}" updated; completion cache refresh deferred: ${errorMessage(err)}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan 13-02a-01 / CMC-26: cascade rendering + MSG-RH-1 reload-hint dispatch.
// ─────────────────────────────────────────────────────────────────────────────

interface TargetedOutcome {
  readonly target: ResolvedTarget;
  readonly outcome: PluginUpdateOutcome;
}

/**
 * Render the update cascade per MSG-GR-1 + MSG-IC-1..3 + MSG-PL-3 + MSG-SR-4..6.
 *
 *   ● <mp> [<scope>]
 *     ● <plugin> [<scope>] v<from> → v<to> (updated) [{requires ...}]
 *     ● <plugin> [<scope>] (skipped) {<reason>}
 *     ⊘ <plugin> [<scope>] v<from> → v<to> (failed) {rollback partial}
 *       [skills] (rollback failed) {rollback partial}
 *       [agents] (rollback failed) {rollback partial}
 *
 *   /reload to pick up changes
 *
 * - Marketplace headers carry `status: undefined` (the marketplace itself
 *   was NOT updated by plugin update; the header is a pure label).
 * - Severity dispatch: all-trivial -> notifySuccess; any non-trivial (any
 *   failed / non-trivial skipped) -> notifyWarning. MSG-SR-6 forbids
 *   notifyError on cascade summaries.
 * - Reload-hint trailer emitted iff at least one outcome is `(updated)`.
 *   All-up-to-date / all-skipped cascades omit the trailer (MSG-RH-1).
 * - Rollback-partial parents (phaseFailures non-empty) substitute their
 *   row in the cascade body with `renderRollbackPartial(parentRow,
 *   children, probe)` so the indented children block sits beneath the
 *   parent line at the cascade-row indentation level.
 */
function renderUpdateCascadeAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
): void {
  const probe = softDepStatus(pi);
  // Group by (scope, marketplace) per CMC-21.
  interface Block {
    marketplace: MarketplaceRow;
    rows: { row: PluginCascadeRow; rollbackChildren?: readonly RollbackChild[] }[];
  }
  const byMp = new Map<string, Block>();
  for (const { target, outcome } of outcomes) {
    const key = `${target.scope}:${target.marketplace}`;
    const existing = byMp.get(key);
    const rowEntry = outcomeToCascadeRow(target, outcome);
    if (rowEntry === undefined) {
      continue;
    }

    if (existing === undefined) {
      byMp.set(key, {
        marketplace: {
          kind: "marketplace",
          name: target.marketplace,
          scope: target.scope,
          outcomeClass: "ok",
        },
        rows: [rowEntry],
      });
    } else {
      existing.rows.push(rowEntry);
    }
  }

  // Sort marketplace blocks via compareByNameThenScope (name primary
  // case-insensitive, scope secondary project-before-user per MSG-GR-3).
  const sortedBlocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope(a.marketplace, b.marketplace),
  );

  const bodySegments: string[] = [];
  let aggregatedSeverity: "success" | "warning" = "success";
  for (const block of sortedBlocks) {
    const { message, severity } = cascadeSummary({
      marketplace: block.marketplace,
      rows: block.rows.map((r) => r.row),
      probe,
    });
    // MSG-RP-1: post-render splice the rollback-partial children block
    // beneath each parent row that carries phase failures. cascadeSummary
    // already rendered the parent row; we replace that line with the
    // parent + indented children form from renderRollbackPartial.
    const withRollback = spliceRollbackPartials(message, block.rows, probe);
    bodySegments.push(withRollback);
    if (severity === "warning") {
      aggregatedSeverity = "warning";
    }
  }

  const body = bodySegments.join("\n\n");
  // PUP-8 / MSG-RH-1: reload hint emitted iff at least one outcome is
  // (updated). All-trivial cascades suppress the trailer.
  const updatedNames = outcomes
    .filter((o) => o.outcome.partition === "updated")
    .map((o) => o.outcome.name);
  const hint = reloadHint(updatedNames);
  const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess;
  dispatch(ctx, appendReloadHint(body, hint));
}

/**
 * Map an outcome to its cascade-row representation. Returns `undefined`
 * for `unchanged` outcomes -- they map to `(skipped) {up-to-date}` per
 * the catalog (CMC-26: unchanged is an internal partition; the user
 * sees `(skipped) {up-to-date}` in the cascade).
 */
function outcomeToCascadeRow(
  target: ResolvedTarget,
  outcome: PluginUpdateOutcome,
): { row: PluginCascadeRow; rollbackChildren?: readonly RollbackChild[] } | undefined {
  switch (outcome.partition) {
    case "updated": {
      // MSG-PL-3 version-transition arrow `v<from> → v<to>` (U+2192,
      // space-padded). The renderer's renderVersion slot just emits
      // whatever the orchestrator supplies in `version`, so we compose
      // the arrow string here and pass it through verbatim.
      const versionSlot = composeVersionArrow(outcome.fromVersion, outcome.toVersion);
      return {
        row: {
          kind: "plugin-cascade",
          name: outcome.name,
          scope: target.scope,
          ...(versionSlot !== undefined && { version: versionSlot }),
          status: "updated",
          declaresAgents: outcome.declaresAgents ?? false,
          declaresMcp: outcome.declaresMcp ?? false,
        },
      };
    }

    case "unchanged": {
      // Catalog: `(skipped) {up-to-date}` -- the unchanged partition is
      // an internal optimization; the user-visible token is `(skipped)`
      // with `{up-to-date}` reason. The renderer treats `up-to-date` as
      // a trivial skip (● icon, success severity).
      return {
        row: {
          kind: "plugin-cascade",
          name: outcome.name,
          scope: target.scope,
          status: "skipped",
          reasons: ["up-to-date"],
        },
      };
    }

    case "skipped":
      return {
        row: {
          kind: "plugin-cascade",
          name: outcome.name,
          scope: target.scope,
          ...(outcome.fromVersion !== undefined && { version: outcome.fromVersion }),
          status: "skipped",
          reasons: narrowSkipReasons(outcome.notes),
        },
      };
    case "failed": {
      const hasPhaseFailures = (outcome.phaseFailures ?? []).length > 0;
      const versionSlot = composeVersionArrow(outcome.fromVersion, outcome.toVersion);
      const failedRow: PluginCascadeRow = {
        kind: "plugin-cascade",
        name: outcome.name,
        scope: target.scope,
        ...(versionSlot !== undefined && { version: versionSlot }),
        status: "failed",
        reasons: hasPhaseFailures
          ? (["rollback partial"] as const)
          : narrowFailReasons(outcome.notes),
        declaresAgents: false,
        declaresMcp: false,
      };

      if (!hasPhaseFailures) {
        return { row: failedRow };
      }

      const children: readonly RollbackChild[] = (outcome.phaseFailures ?? []).map((f) => ({
        kind: "rollback-child",
        // MSG-RP-1: phaseLabel renders verbatim in the bare compact line.
        // Bracketed form mirrors the catalog example.
        phaseLabel: `[${f.phase}]`,
        // Inner bridge commit failures are rollback-failed semantically:
        // the swap was attempted, the bridge threw, and the post-commit
        // recovery is the per-plugin reinstall hint. `rollback failed`
        // captures that effective state.
        status: "rollback failed",
        // The free-text error message does NOT fit the closed Reason set;
        // narrow to `"rollback partial"` (the parent's reason) and the
        // phaseLabel + status carry the user-visible failure shape.
        reasons: ["rollback partial"] as const,
      }));
      return { row: failedRow, rollbackChildren: children };
    }

    default:
      return undefined;
  }
}

/**
 * Splice rollback-partial children into the cascade message. cascadeSummary
 * already emits the parent row at indentation 2; for each row with
 * rollbackChildren, append the children block at indentation 4
 * (rollback-child indented 2 spaces beneath the cascade-child row).
 */
function spliceRollbackPartials(
  cascadeMessage: string,
  rows: readonly { row: PluginCascadeRow; rollbackChildren?: readonly RollbackChild[] }[],
  probe: ReturnType<typeof softDepStatus>,
): string {
  const haveChildren = rows.filter((r) => r.rollbackChildren !== undefined);
  if (haveChildren.length === 0) {
    return cascadeMessage;
  }

  const lines = cascadeMessage.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    out.push(line);
    // Look for an exact match against any rollback-parent row's rendered
    // form (the line is `  ${renderRow(row, probe)}` per cascadeSummary).
    for (const r of haveChildren) {
      const renderedRow = `  ${renderRow(r.row, probe)}`;
      if (line === renderedRow) {
        // Children render at indent 4 (the inner block of renderRollbackPartial
        // sits at +2 relative to the parent, which is already at +2 here).
        const block = renderRollbackPartial(r.row, r.rollbackChildren ?? [], probe);
        const blockLines = block.split("\n");
        // blockLines[0] is the parent (already in `line`); skip it and
        // append the indented children with an extra 2-space prefix.
        for (let i = 1; i < blockLines.length; i++) {
          out.push(`  ${blockLines[i]}`);
        }

        break;
      }
    }
  }

  return out.join("\n");
}

/**
 * MSG-PL-3 version transition slot. Returns undefined when both sides
 * absent. The renderer's `renderVersion(version)` always prepends a `v`
 * to the supplied string, so the arrow form here is
 * `<from> → v<to>` -- the renderer turns that into `v<from> → v<to>`
 * matching catalog `/claude:plugin update` examples (output-catalog.md
 * lines 419-470). Single-version (unchanged from→to OR only one side
 * supplied) returns the bare version string for the renderer to prefix.
 */
function composeVersionArrow(from: string | undefined, to: string | undefined): string | undefined {
  if (from === undefined && to === undefined) {
    return undefined;
  }

  if (from !== undefined && to !== undefined && from !== to) {
    return `${from} → v${to}`;
  }

  if (to !== undefined) {
    return to;
  }

  return from;
}

function narrowSkipReasons(notes: readonly string[] | undefined): readonly Reason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowSkipReason(notes[0] ?? "")];
}

function narrowSkipReason(note: string): Reason {
  if (note === "not installed") {
    return "not installed";
  }

  if (note === "not in manifest") {
    return "not in manifest";
  }

  if (note === "up-to-date") {
    return "up-to-date";
  }

  // PUP-4 path: "Plugin "...." is no longer installable: <cause>" -> closed
  // Reason "no longer installable".
  if (note.includes("no longer installable") || note.includes("not installable")) {
    return "no longer installable";
  }

  if (note.includes("entry failed schema validation")) {
    return "invalid manifest";
  }

  return "not in manifest";
}

function narrowFailReasons(notes: readonly string[] | undefined): readonly Reason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowFailReason(notes[0] ?? "")];
}

function narrowFailReason(note: string): Reason {
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  if (note.includes("concurrently uninstalled") || note.includes("concurrently removed")) {
    return "concurrently uninstalled";
  }

  if (note.includes("concurrently updated")) {
    return "concurrently updated";
  }

  return "not in manifest";
}

function aggregateCause(firstCause: unknown): { cause: unknown } | undefined {
  return firstCause === undefined ? undefined : { cause: firstCause };
}

function isDirectUpdate(args: ThreePhaseArgs): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare -- keeps Sonar S7735 from flagging an inverted boolean condition at the callsite.
  return args.cascade === false;
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
    return enumerateMarketplaceTarget(cwd, explicitScope, target);
  }

  // bare form: every installed plugin across selected scope(s).
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
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

async function enumerateMarketplaceTarget(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<UpdatePluginsTarget, { kind: "plugin" | "marketplace" }>,
): Promise<readonly ResolvedTarget[]> {
  const mpName = target.marketplace;
  const resolved =
    target.kind === "plugin"
      ? ((await resolveInstalledPluginTarget({
          cwd,
          marketplace: mpName,
          plugin: target.plugin,
          ...(explicitScope !== undefined && { explicitScope }),
        })) ??
        (await resolveInstalledMarketplaceTarget({
          cwd,
          marketplace: mpName,
        })))
      : await resolveInstalledMarketplaceTarget({
          cwd,
          marketplace: mpName,
          ...(explicitScope !== undefined && { explicitScope }),
        });
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[mpName];
  if (mp === undefined) {
    throw new Error(`Marketplace "${mpName}" not found in ${resolved.scope} scope.`);
  }

  if (target.kind === "plugin") {
    return [
      {
        plugin: target.plugin,
        marketplace: mpName,
        scope: resolved.scope,
        locations: resolved.locations,
      },
    ];
  }

  return Object.keys(mp.plugins).map((p) => ({
    plugin: p,
    marketplace: mpName,
    scope: resolved.scope,
    locations: resolved.locations,
  }));
}

async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
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
