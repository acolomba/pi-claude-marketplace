// orchestrators/plugin/install.ts
//
// PI-1..15 + AS-6 + AS-7 + COMP-01 + NFR-5.
//
// FIRST production consumer of the Phase 2 runPhases<C> ledger primitive
// (transaction/phase-ledger.ts). Composition order is locked by D-01,
// D-02, D-05, D-08:
//
//   withStateGuard(locations, async (state) => {           // D-02 outer guard
//     PI-15 early sanity:  throw if state.marketplaces[mp].plugins[plugin] != null
//     PI-3:                throw if marketplace / entry absent
//     PI-2:                cached manifest read ONLY (no network)
//     PI-4:                resolveStrict + requireInstallable
//     PI-6:                assertNoCrossPluginConflicts(scope, names, state)
//     PI-7:                resolveInstallVersion (entry.version > hash fallback)
//     runPhases(phases, ctx)                               // D-01 5-phase ledger
//     formatRollbackError on !ok                           // D-02 PI-14 bypass
//   })
//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir) -> warning on failure
//   Success notify w/ soft-dep warnings (PI-11/PI-12) + PI-13 deps note + reload hint
//
// NFR-5 / PI-2 architectural guard: this file MUST NOT import platform-git
// or the default git ops, and MUST NOT carry a gitOps field; the architectural
// test under tests/architecture/no-orchestrator-network.test.ts strips comments
// and greps this file's source for the forbidden surface tokens.
//
// D-11 import boundaries: orchestrators/plugin/ may import from bridges/,
// domain/, transaction/, persistence/, presentation/, shared/, AND from
// orchestrators/marketplace/shared.ts (named exports only -- no add.ts /
// remove.ts / update.ts cycle).

import { mkdir } from "node:fs/promises";

import {
  commitPreparedAgents,
  discoverPluginAgents,
  prepareStagePluginAgents,
  unstagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  commitPreparedCommands,
  discoverPluginCommands,
  prepareStageCommands,
  unstagePluginCommands,
} from "../../bridges/commands/index.ts";
import {
  commitPreparedMcp,
  prepareStageMcpServers,
  unstageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  commitPreparedSkills,
  discoverPluginSkills,
  prepareStageSkills,
  unstagePluginSkills,
} from "../../bridges/skills/index.ts";
import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { mcpAdapterWarningIfNeeded, subagentWarningIfNeeded } from "../../presentation/soft-dep.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { ConcurrentInstallError, errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
import { runPhases, type Phase } from "../../transaction/phase-ledger.ts";
import { formatRollbackError } from "../../transaction/rollback.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { formatErrorWithCauses } from "../marketplace/shared.ts";

import {
  assertNoCrossPluginConflicts,
  cloneMarketplaceRecordForTargetScope,
  pickAgentsSourceDir,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
} from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Parsed (plugin, marketplace) options bundle. PI-1 / RH-1 / RH-2 parse is
 * the edge layer's responsibility (Phase 6); this orchestrator entrypoint
 * accepts already-parsed strings + the resolved scope.
 *
 * `pi` is REQUIRED (matches the precedent set by uninstall.ts -- the soft-dep
 * helpers `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` take a
 * non-optional `ExtensionAPI`; making it optional here would force a runtime
 * branch the type checker cannot reason about).
 */
export type InstallPluginOutcome =
  | {
      readonly status: "installed";
      readonly resourcesChanged: boolean;
      /** Post-commit warnings collected in orchestrated mode instead of firing individually. */
      readonly postCommitWarnings?: readonly string[];
    }
  | { readonly status: "already-installed"; readonly cause: string }
  | { readonly status: "unavailable"; readonly cause: string }
  | { readonly status: "uninstallable"; readonly cause: string }
  | { readonly status: "unexpected-failure"; readonly cause: string };

/**
 * Controls how `installPlugin` surfaces notifications.
 *
 * - `"standalone"` (default): fires `notifyError`/`notifySuccess`/`notifyWarning`
 *   directly and appends a reload hint. Use for direct `/claude:plugin install`.
 * - `"orchestrated"`: suppresses all notifications, returns the typed outcome,
 *   and collects post-commit warnings in `outcome.postCommitWarnings`. Use when
 *   a parent orchestrator (e.g. import) owns the full notification surface.
 */
export type InstallPluginNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };

export interface InstallPluginOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly scope: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly notifications?: InstallPluginNotifications;
  /**
   * AG-7 opt-in flag. Default false: generated agents omit `model:` and
   * Pi picks its own default. The edge handler sets this to `true` only
   * when the user supplies `--map-model` on `/claude:plugin install`.
   */
  readonly mapModel?: boolean;
}

/**
 * Local context type for the 5-phase ledger. Carries every value the
 * phases read or mutate. Per D-01 corollary "second-consumer rule" this
 * shape is NOT promoted to `orchestrators/types.ts` until/unless another
 * orchestrator needs it.
 */
interface InstallCtx {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly resolved: ResolvedPluginInstallable;
  readonly version: string;
  readonly pluginDataDir: string;
  // Prep handles populated by each phase.do before that phase's commit.
  // Each phase.undo reads the matching handle to call the bridge unstage*
  // primitive. The matching handle is undefined when the phase did not run.
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  mcpPrep?: PreparedMcpStaging;
  // Names captured for PluginInstallRecord.resources and reload-hint composition.
  stagedSkillNames: readonly string[];
  stagedCommandNames: readonly string[];
  stagedAgentNames: readonly string[];
  stagedMcpServerNames: readonly string[];
  // Aggregated soft warnings from the bridges (e.g. agents bridge cleanup leaks).
  bridgeWarnings: string[];
  // Bridge-side per-record AG-5 foreign-content rows -- routed to notifyWarning post-success.
  agentForeignFailures: { generatedName: string; reason: string }[];
  // Mutable handle to the state snapshot loaded by withStateGuard.
  readonly stateSnapshot: ExtensionState;
}

/**
 * Read and validate the cached marketplace.json (PI-2 NO network).
 *
 * `manifestPath` is the value persisted at marketplace-add time (Phase 4) --
 * it points either at the github-cloned marketplace dir's manifest or at
 * the path-source marketplace's manifest. Either way the bytes are on disk
 * before install runs.
 */
async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * PI-1..15 entrypoint. The function never re-throws -- failures surface
 * via `notifyError` (Pattern S-1 single chokepoint, IL-2 lint gate).
 *
 * Failure modes funnel through three paths:
 *   1. Guard-closure throw (PI-3 / PI-4 / PI-5 / PI-6 / PI-7 errors,
 *      ConcurrentInstallError from PI-15 layer (a), and the rolled-up
 *      ledger error via formatRollbackError) -> notifyError.
 *   2. PathContainmentError originating in a bridge prepare or undo path
 *      propagates VERBATIM via formatRollbackError's PI-14 bypass
 *      (Plan 05-02 chokepoint extension).
 *   3. Post-state-commit pluginDataDir mkdir failure -> notifyWarning
 *      (AS-6 warning severity; the install itself succeeded).
 */
// Install sequencing intentionally keeps the state guard, bridge staging, rollback,
// and notification logic in one audited flow matching PI-1..15.
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function installPlugin(opts: InstallPluginOptions): Promise<InstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const locations = locationsFor(scope, cwd);

  // Post-guard composition data. The guard closure populates this on
  // success; the catch block leaves it undefined and returns early.
  let installCtx: InstallCtx | undefined;

  try {
    await withStateGuard(locations, async (state) => {
      // CMP-2..4 / PI-16: resolve the source marketplace separately from
      // the target scope being mutated. Project-target installs can fall
      // back to a user-scope marketplace; user-target installs cannot read
      // project-only marketplaces.
      const source = await resolveInstallMarketplaceSource({
        targetScope: scope,
        cwd,
        marketplace,
        targetState: state,
      });
      if (source === undefined) {
        throw new Error(`Plugin "${plugin}" not found in marketplace "${marketplace}".`);
      }

      // Target container: same scope record when present, or a cloned
      // project-scope container when CMP-3 fell back to user marketplace.
      let targetMp = state.marketplaces[marketplace];
      if (targetMp === undefined) {
        targetMp = cloneMarketplaceRecordForTargetScope(source.sourceRecord, scope);
        state.marketplaces[marketplace] = targetMp;
      }

      // PI-15 early-sanity check (Pitfall 3 layer (a)): if the record already
      // exists in the target scope we throw ConcurrentInstallError BEFORE
      // running the ledger, avoiding any disk write. Layer (b) re-checks
      // inside the state-commit phase defensively in case of intra-process
      // re-entry. PI-17: other-scope installs do not block this target.
      if (targetMp.plugins[plugin] !== undefined) {
        // PI-5: already-installed AND PI-15 early-sanity collapse onto the same
        // path here. Per CONTEXT.md "Open questions" researcher recommendation,
        // surface PI-5 wording at the early-sanity check (the user-visible
        // message is "already installed"); PI-15 (race-at-commit) surfaces
        // via the state-commit phase's defensive throw.
        throw new Error(`Plugin "${plugin}" is already installed in marketplace "${marketplace}".`);
      }

      // PI-2 cached-manifest read -- NO network, no gitOps. PI-3: entry must
      // exist in the manifest plugins[] array.
      const sourceMp = source.sourceRecord;
      const manifest = await loadCachedMarketplaceManifest(sourceMp.manifestPath);
      const entryRaw = manifest.plugins.find((p) => p.name === plugin);
      if (entryRaw === undefined) {
        throw new Error(`Plugin "${plugin}" not found in marketplace "${marketplace}".`);
      }

      // Defense-in-depth: re-run the per-entry validator on the chosen entry
      // so a corrupted manifest cannot smuggle a malformed entry past the
      // top-level marketplace check (the array-element validator is the same
      // schema, but this site enforces it locally).
      if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
        throw new Error(
          `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
        );
      }

      const entry: PluginEntry = entryRaw;

      // PI-4: resolveStrict + requireInstallable. Per Phase 2 D-04, the
      // strict resolver consumes the array-shape componentPaths (D-07 /
      // COMP-01) and either returns an installable variant or surfaces
      // disqualification notes. requireInstallable narrows the discriminated
      // union and throws on the not-installable variant.
      const resolved = await resolveStrict(entry, { marketplaceRoot: sourceMp.marketplaceRoot });
      requireInstallable(resolved, "install");
      // After requireInstallable, `resolved` is narrowed to the installable
      // variant; pluginRoot etc. are reachable.
      const installable: ResolvedPluginInstallable = resolved;

      // Generated-name discovery (PI-6 input). Walks the bridges' discover.ts
      // to enumerate source artefacts under componentPaths, then applies the
      // domain/name.ts generators to produce the names whose collisions the
      // cross-bridge guard checks. No bridge writes happen here.
      const { discovered: discoveredSkills } = await discoverPluginSkills({
        pluginName: plugin,
        resolved: installable,
      });
      const { discovered: discoveredCommands } = await discoverPluginCommands({
        pluginName: plugin,
        resolved: installable,
      });
      const agentsSourceDir = pickAgentsSourceDir(installable);
      const { discovered: discoveredAgents } =
        agentsSourceDir === null
          ? { discovered: [] as readonly { readonly generatedName: string }[] }
          : await discoverPluginAgents({
              pluginName: plugin,
              agentsDirs: [agentsSourceDir],
            });

      const generatedNames = {
        skills: discoveredSkills.map((s) => s.generatedName),
        commands: discoveredCommands.map((c) => c.generatedName),
        agents: discoveredAgents.map((a) => a.generatedName),
      };

      // PI-6 / RN-3: pre-flight cross-bridge conflict guard. Throws
      // CrossPluginConflictError BEFORE any disk write if a generated name
      // is already owned by a different plugin IN THE SAME SCOPE.
      assertNoCrossPluginConflicts(scope, generatedNames, state);

      // PI-7 version precedence (entry > hash).
      const version = await resolvePluginVersion(entry, installable);

      // Resolve the per-plugin data dir up front; the bridges receive it
      // for ${CLAUDE_PLUGIN_DATA} substitution. The directory itself is
      // NOT created here -- the eager mkdir runs POST-state-commit per
      // D-08 / AS-6.
      const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);

      // Build the per-call install context. Per D-01 corollary, this lives
      // local to install.ts (single consumer); promoting to orchestrators/
      // types.ts would be premature.
      const ctxLocal: InstallCtx = {
        locations,
        cwd,
        marketplace,
        plugin,
        resolved: installable,
        version,
        pluginDataDir,
        stagedSkillNames: [],
        stagedCommandNames: [],
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        bridgeWarnings: [],
        agentForeignFailures: [],
        stateSnapshot: state,
      };

      // D-01 literal-array discipline: each phase is a single Phase<InstallCtx>
      // value; the ledger sees a 5-element constant array.
      const skillsPhase: Phase<InstallCtx> = {
        name: "skills",
        do: async (c) => {
          const prep = await prepareStageSkills({
            locations: c.locations,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
            pluginRoot: c.resolved.pluginRoot,
            pluginDataDir: c.pluginDataDir,
            resolved: c.resolved,
          });
          c.skillsPrep = prep;
          const leak = await commitPreparedSkills(prep);
          if (leak !== undefined) {
            c.bridgeWarnings.push(leak);
          }

          c.stagedSkillNames = prep.result.recorded.map((r) => r.generatedName);
        },
        undo: async (c) => {
          if (c.skillsPrep === undefined) {
            return;
          }

          // Commit already succeeded -- the dirs are at the target path.
          // unstage* by name removes them.
          await unstagePluginSkills({
            locations: c.locations,
            previousSkillNames: c.stagedSkillNames,
          });
        },
      };

      const commandsPhase: Phase<InstallCtx> = {
        name: "commands",
        do: async (c) => {
          const prep = await prepareStageCommands({
            locations: c.locations,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
            pluginRoot: c.resolved.pluginRoot,
            pluginDataDir: c.pluginDataDir,
            resolved: c.resolved,
          });
          c.commandsPrep = prep;
          const leak = await commitPreparedCommands(prep);
          if (leak !== undefined) {
            c.bridgeWarnings.push(leak);
          }

          c.stagedCommandNames = prep.result.recorded.map((r) => r.generatedName);
        },
        undo: async (c) => {
          if (c.commandsPrep === undefined) {
            return;
          }

          await unstagePluginCommands({
            locations: c.locations,
            previousCommandNames: c.stagedCommandNames,
          });
        },
      };

      const agentsPhase: Phase<InstallCtx> = {
        name: "agents",
        do: async (c) => {
          const prep = await prepareStagePluginAgents({
            locations: c.locations,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
            pluginRoot: c.resolved.pluginRoot,
            pluginDataDir: c.pluginDataDir,
            resolved: c.resolved,
            agentsSourceDir: pickAgentsSourceDir(c.resolved),
            knownSkills: c.stagedSkillNames,
            // AG-7 opt-in: `--map-model` on /claude:plugin install threads
            // the flag down to here. When the user did not pass the flag
            // we explicitly default to false so generated agents omit
            // `model:` (the new default per 260516-08j).
            mapModel: opts.mapModel ?? false,
          });
          c.agentsPrep = prep;
          const leak = await commitPreparedAgents(prep);
          if (leak !== undefined) {
            c.bridgeWarnings.push(leak);
          }

          c.stagedAgentNames = prep.result.recorded.map((r) => r.generatedName);
          // AG-5 / W-08 / B-08: foreign-content rows are NOT thrown by the
          // bridge -- they surface via `failed[]`. AS-7: keep them out of
          // the rollback path (the install of new agents succeeded; the
          // foreign rows are a separate problem the user can address by
          // hand). Routed to notifyWarning post-state-commit below.
          for (const f of prep.result.failed) {
            c.agentForeignFailures.push({ generatedName: f.generatedName, reason: f.reason });
          }
        },
        undo: async (c) => {
          if (c.agentsPrep === undefined) {
            return;
          }

          // unstagePluginAgents removes only OUR own (mp, plugin) rows --
          // foreign-preserved rows from prepare stay in the index.
          await unstagePluginAgents({
            locations: c.locations,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
          });
        },
      };

      const mcpPhase: Phase<InstallCtx> = {
        name: "mcp",
        do: async (c) => {
          const prep = await prepareStageMcpServers({
            locations: c.locations,
            cwd: c.cwd,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
            servers: c.resolved.mcpServers,
            sourcePath: `${c.resolved.pluginRoot}#mcpServers`,
          });
          c.mcpPrep = prep;
          const result = await commitPreparedMcp(prep);
          c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
        },
        undo: async (c) => {
          if (c.mcpPrep === undefined) {
            return;
          }

          await unstageMcpServers({
            locations: c.locations,
            marketplaceName: c.marketplace,
            pluginName: c.plugin,
          });
        },
      };

      const statePhase: Phase<InstallCtx> = {
        name: "state",
        // The state-commit phase is pure in-memory mutation -- no IO. The
        // Phase<C> contract still requires `do` to return Promise<void>, so
        // we mark it async to satisfy the signature; the lint rule is
        // disabled because there is nothing to await here.
        // eslint-disable-next-line @typescript-eslint/require-await
        do: async (c) => {
          // PI-15 layer (b) defensive re-assert: the early-sanity check at
          // top-of-closure caught the common path. This second check guards
          // against intra-process re-entry edge cases (e.g. an in-flight
          // mutation of `state` outside this orchestrator). If the record
          // appeared between guard load and now, raise ConcurrentInstallError
          // so the ledger unwinds the staged bridges.
          const mpInner = c.stateSnapshot.marketplaces[c.marketplace];
          if (mpInner?.plugins[c.plugin] !== undefined) {
            throw new ConcurrentInstallError(c.plugin, c.marketplace);
          }

          if (mpInner === undefined) {
            // Defensive: the early-sanity check guaranteed mp existed; if
            // someone deleted it from the state snapshot mid-flight, fail
            // cleanly so the ledger rolls back the staged bridges.
            throw new Error(
              `Marketplace "${c.marketplace}" disappeared from state during install of "${c.plugin}".`,
            );
          }

          const nowIso = new Date().toISOString();
          mpInner.plugins[c.plugin] = {
            version: c.version,
            resolvedSource: c.resolved.pluginRoot,
            compatibility: {
              installable: true,
              notes: [...c.resolved.notes],
              supported: [...c.resolved.supported],
              unsupported: [...c.resolved.unsupported],
            },
            resources: {
              skills: [...c.stagedSkillNames],
              prompts: [...c.stagedCommandNames],
              agents: [...c.stagedAgentNames],
              mcpServers: [...c.stagedMcpServerNames],
            },
            installedAt: nowIso,
            updatedAt: nowIso,
          };
        },
        // undo intentionally absent: at state-commit phase time the guard
        // has not flushed yet, and on throw the guard does NOT save the
        // mutated snapshot (Phase 2 ST-7 contract). The mutation is discarded
        // by the unwinding closure.
      };

      // D-01 literal-array; order is part of the contract -- never refactor
      // to a dynamic builder. The PRD-fixed sequence is
      // [skills, commands, agents, mcp, state].
      const phases: readonly Phase<InstallCtx>[] = [
        skillsPhase,
        commandsPhase,
        agentsPhase,
        mcpPhase,
        statePhase,
      ];

      const result = await runPhases(phases, ctxLocal);
      if (!result.ok) {
        // PI-14 bypass is inherited via Plan 05-02's formatRollbackError
        // chokepoint: if the original error IS a PathContainmentError, the
        // formatter returns it verbatim. Otherwise, the rollback-partial
        // marker is appended.
        // result.error is non-undefined on !ok per phase-ledger.ts contract.
        throw formatRollbackError(result, result.error ?? new Error("phase ledger failed"));
      }

      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = ctxLocal;
    });
  } catch (err) {
    // Pattern S-1 single chokepoint for user-visible errors. The PI-14
    // PathContainmentError reaches here VERBATIM via formatRollbackError
    // -- notifyError surfaces its `.message` (Pattern S-6 depth-5 cause walk
    // for non-PathContainment errors gives the chained Phase 2 / Phase 3
    // bridge cause text).
    const cause = formatErrorWithCauses(err);
    if (opts.notifications?.mode === "orchestrated") {
      return classifyInstallFailure(err, cause);
    }

    notifyError(ctx, cause, err);
    return { status: "unexpected-failure", cause };
  }

  // Defensive: the success path always populates installCtx; if it did not,
  // surface the inconsistency rather than silently emit a missing message.
  if (installCtx === undefined) {
    const cause = `installPlugin: internal error -- guard returned cleanly without populating install context for plugin "${plugin}".`;
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "unexpected-failure", cause };
    }

    notifyError(ctx, cause);
    return { status: "unexpected-failure", cause };
  }

  const orchestrated = opts.notifications?.mode === "orchestrated";
  const postCommitWarnings: string[] = [];

  // POST-state-commit (AS-6 / D-08): eager per-plugin data dir mkdir.
  // Failure HERE is warning-severity -- the state record is already
  // committed; the user knows the install succeeded but a path needs
  // manual creation on first plugin-data write.
  try {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  } catch (mkdirErr) {
    const msg = `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    } else {
      notifyWarning(ctx, msg);
    }
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // Plugin moved from "available" -> "installed"; drop the cached plugin
  // index for this marketplace so the next completion read rebuilds with
  // the new status. Defense-in-depth try/catch.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    const msg = `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    } else {
      notifyWarning(ctx, msg);
    }
  }

  // AS-7 / W-08 / B-08: route any AG-5 foreign-content rows the agents
  // bridge preserved during prepare. The install of NEW agents succeeded;
  // the foreign-preserved rows are a manual-cleanup hint surfaced at
  // warning severity so the user is informed without the install itself
  // appearing failed.
  if (installCtx.agentForeignFailures.length > 0) {
    const detail = installCtx.agentForeignFailures
      .map((f) => `${f.generatedName}: ${f.reason}`)
      .join("; ");
    const msg = `Plugin "${plugin}" installed; ${installCtx.agentForeignFailures.length.toString()} pre-existing agent file(s) preserved on disk: ${detail}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    } else {
      notifyWarning(ctx, msg);
    }
  }

  // Bridge-side soft warnings (e.g. agents bridge cleanup-leak return values).
  // Each is surfaced via notifyWarning so the success notification stays
  // focused on the canonical "Installed" line + soft-dep + reload-hint.
  for (const w of installCtx.bridgeWarnings) {
    if (orchestrated) {
      postCommitWarnings.push(w);
    } else {
      notifyWarning(ctx, w);
    }
  }

  // RH-5 soft-dep probes -- the staged agents/mcp will not actually load
  // until /reload, AND not at all if the companion extension is unloaded.
  const subagentWarn = subagentWarningIfNeeded(pi, installCtx.stagedAgentNames);
  const mcpWarn = mcpAdapterWarningIfNeeded(pi, installCtx.stagedMcpServerNames);

  // RH-1 reload-hint gate: emit the hint only if at least one resource
  // was actually staged (the install would otherwise be a noop and the
  // user has nothing to /reload).
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;

  if (!orchestrated) {
    let body = `Installed plugin "${plugin}" from marketplace "${marketplace}".`;
    if (subagentWarn !== "") {
      body = `${body}\n${subagentWarn}`;
    }

    if (mcpWarn !== "") {
      body = `${body}\n${mcpWarn}`;
    }

    // PI-13 dependencies declaration -- the resolver appends the canonical
    // PR-5 phrase to `installable.notes`. Find and surface verbatim.
    const depsNote = installCtx.resolved.notes.find((n) =>
      n.includes("dependencies that must be installed manually"),
    );
    if (depsNote !== undefined) {
      body = `${body}\n${depsNote}`;
    }

    const hint = reloadHint("load", stagedAny ? [plugin] : []);
    notifySuccess(ctx, appendReloadHint(body, hint));
  }

  return {
    status: "installed",
    resourcesChanged: stagedAny,
    ...(postCommitWarnings.length > 0 && { postCommitWarnings }),
  };
}

function classifyInstallFailure(err: unknown, formattedCause: string): InstallPluginOutcome {
  // Check the direct error message only (not the full cause chain) to avoid
  // accidental misclassification from chained errors that mention similar text.
  const msg = err instanceof Error ? err.message : "";

  if (err instanceof ConcurrentInstallError || msg.includes("already installed")) {
    return { status: "already-installed", cause: formattedCause };
  }

  if (msg.includes("not found in marketplace") || msg.includes("not found in manifest")) {
    return { status: "unavailable", cause: formattedCause };
  }

  if (msg.includes("not installable") || msg.includes("is not installable")) {
    return { status: "uninstallable", cause: formattedCause };
  }

  return { status: "unexpected-failure", cause: formattedCause };
}
