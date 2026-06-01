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
//     capture rollbackPartials, throw raw error            // D-02 PI-14 bypass
//   })
//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir) -> dropped per D-19-01
//   Success notify via V2 notify() with PluginInstalledMessage carrying
//   dependencies: readonly Dependency[] derived from staged content; the
//  renderer probes companion-loaded state once per notify call
//   and emits per-row soft-dep markers + the reload-hint trailer
//  structurally.
//   Failure routes through one V2 notify() call with PluginFailedMessage
//   carrying optional cause + optional rollbackPartial[]; the renderer
//  composes the depth-5 cause-chain and per-phase rollback child
//   rows automatically.
//
// Standalone-mode emission is a single notify(ctx, pi, { marketplaces:
// [{ ..., plugins: [<row>] }] }) call per orchestration arm. The 5
// post-state-commit soft-warning sites (mkdir / cache-refresh /
// agentForeignFailures / bridgeWarnings / PI-13 deps note) are NOT surfaced:
// MarketplaceNotificationMessage has no field for a "soft warning after
// successful state mutation". The underlying side effects (mkdir /
// dropMarketplaceCache / agents-bridge foreign-row preservation / bridge
// cleanup-leak fold / PI-13 detection) STILL RUN (correctness preserved);
// only the user-facing warning surface disappears in standalone mode. The
// orchestrated-mode `InstallOutcome.postCommitWarnings` branch is preserved:
// the import cascade caller (orchestrators/import/execute.ts, the
// `importPlugins` path) injects each warning into its `pushDiagnostic`
// channel which surfaces per-marketplace in the cascade's rendering. The
// standalone/orchestrated asymmetry is INTENTIONAL.
//
// NFR-5 / PI-2 architectural guard: this file MUST NOT import platform-git
// or the default git ops, and MUST NOT carry a gitOps field; the architectural
// test under tests/architecture/no-orchestrator-network.test.ts strips comments
// and greps this file's source for the forbidden surface tokens.
//
// D-11 import boundaries: orchestrators/plugin/ may import from bridges/,
// domain/, transaction/, persistence/, shared/, AND from
// orchestrators/marketplace/shared.ts (named exports only -- no add.ts /
// remove.ts / update.ts cycle). User-visible output flows through
// shared/notify.ts; this file holds no rendering imports.

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
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  assertNever,
  causeChainTrailer,
  ConcurrentInstallError,
  errorMessage,
  PluginShapeError,
} from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";
import { runPhases, type Phase, type RollbackPartial } from "../../transaction/phase-ledger.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

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
import type {
  Dependency,
  PluginFailedMessage,
  PluginInstalledMessage,
  PluginNotificationMessage,
  PluginUnavailableMessage,
  Reason,
  StatusToken,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Entity-shaped non-cascade error line (MSG-NC-1 / CMC-34) -- internal
 * classified-error return shape for `classifyEntityShapeError` and the
 * install.ts error-routing path. File-local; this module is the sole
 * consumer.
 *
 * Examples: `⊘ unknown@claude-plugins-official (failed) {not found}`;
 * `⊘ hookify [user] (unavailable) {hooks}`.
 */
interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly Reason[];
}

/**
 * Parsed (plugin, marketplace) options bundle. PI-1 / RH-1 / RH-2 parse is
 * the edge layer's responsibility (Phase 6); this orchestrator entrypoint
 * accepts already-parsed strings + the resolved scope.
 *
 * `pi` is REQUIRED -- V2 `notify(ctx, pi, message)` consumes it for the
 * single `softDepStatus(pi)` probe per call. The renderer
 * injects per-row `{requires pi-subagents}` / `{requires pi-mcp}`
 * markers from the per-row `dependencies: readonly Dependency[]`
 * declaration combined with the threaded probe. Making `pi`
 * optional would force a runtime branch the type checker cannot reason
 * about.
 *
 * SNM-04 / D-15-02: the `"installed"` variant carries REQUIRED
 * `dependencies: readonly Dependency[]` (the closed-set
 * `"agents" | "mcp"` per Phase 15 SNM-04). The orchestrator derives the
 * array at the success-return site from
 * `installCtx.stagedAgentNames.length > 0` (-> `"agents"`) and
 * `installCtx.stagedMcpServerNames.length > 0` (-> `"mcp"`); the
 * `declaresAgents`/`declaresMcp` predicates on `InstallPluginOutcome`
 * remain (consumed by `orchestrators/import/execute.ts` for its
 * cascade-row composition) -- NFR-7's discriminated-outcome contract
 * is unchanged.
 */
export type InstallPluginOutcome =
  | {
      readonly status: "installed";
      readonly resourcesChanged: boolean;
      readonly declaresAgents: boolean;
      readonly declaresMcp: boolean;
      /** Post-commit warnings collected in orchestrated mode instead of firing individually. */
      readonly postCommitWarnings?: readonly string[];
    }
  | {
      /**
       * Collapsed failure shape. All failure variants (`already-installed`,
       * `unavailable`, `uninstallable`, `unexpected-failure`) map here.
       * `error` is the typed dispatch surface -- consumers narrow on
       * `instanceof PluginShapeError` and `.shape.kind` to recover the
       * specific failure class. `cause` preserves the formatted user-visible
       * text for callers in orchestrated mode that render it directly.
       */
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
    };

/**
 * Controls how `installPlugin` surfaces notifications.
 *
 * - `"standalone"` (default): fires a SINGLE V2 `notify(ctx, pi, ...)`
 *   call per orchestration arm with the per-variant
 *   `PluginInstalledMessage` / `PluginFailedMessage` payload. Severity +
 *   reload-hint + soft-dep markers are computed by `notify()` per
 * . Use for direct `/claude:plugin install`.
 *   Phase 19 / Plan 19-02 dropped the 5 V1 post-state-commit
 *   `notifyWarning` sites per D-19-01: the user-visible warning surface
 *   for mkdir / cache-refresh / agentForeignFailures / bridgeWarnings /
 *   PI-13 deps note is GONE in standalone mode (the underlying side
 *   effects still fire).
 * - `"orchestrated"`: suppresses all notifications, returns the typed
 *   outcome, and collects post-commit warnings in
 *   `outcome.postCommitWarnings`. The import cascade caller injects each
 *   warning into its `pushDiagnostic` channel which surfaces per-marketplace
 *   in the cascade's rendering -- the standalone/orchestrated asymmetry
 *   is INTENTIONAL and consistent with D-19-01.
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
 * via a single V2 `notify()` call carrying a `PluginFailedMessage`
 * (Pattern S-1 single chokepoint, IL-2 lint gate). Standalone-mode emits
 * exactly one notification per orchestration arm; orchestrated-mode emits
 * none and returns the typed outcome.
 *
 * Failure modes funnel through three paths inside the single V2 catch
 * site:
 *   1. Guard-closure throw (PI-3 / PI-4 / PI-5 / PI-6 / PI-7 errors,
 *      ConcurrentInstallError from PI-15 layer (a), and the rolled-up
 *      ledger error captured as failureRollbackPartials) -> V2 notify()
 *      with `PluginFailedMessage` carrying the typed `cause` and
 *      (when rollback partials are present) the
 *      `rollbackPartial: readonly { phase; cause? }[]` field. The renderer
 *      handles all indentation + cause-chain rendering automatically
 * .
 *   2. PathContainmentError originating in a bridge prepare or undo path
 *      propagates VERBATIM: its message becomes `cause` on the
 *      `PluginFailedMessage` and never surfaces as a rollback-partial
 *      (PI-14 bypass).
 *   3. Post-state-commit pluginDataDir mkdir failure / cache-refresh
 *      failure / agentForeignFailures rows / bridgeWarnings rows /
 *      PI-13 deps note are DROPPED in standalone mode per D-19-01.
 *      Orchestrated-mode collects them in
 *      `InstallOutcome.postCommitWarnings` for the cascade caller.
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
  // Captured-on-throw context for the catch block.
  // `failureRollbackPartials` mirrors the ledger's RollbackPartial[] and
  // populates `PluginFailedMessage.rollbackPartial` when non-empty; when
  // empty, the catch emits the bare failure row form (no rollback
  // children, per `docs/output-catalog.md:308-314`). `failureVersion` is
  // the resolved version at throw time (undefined when the throw
  // pre-dated `resolvePluginVersion`).
  let failureRollbackPartials: readonly RollbackPartial[] = [];
  let failureVersion: string | undefined;

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
        throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
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
        throw new PluginShapeError({ kind: "already-installed", plugin, marketplace });
      }

      // PI-2 cached-manifest read -- NO network, no gitOps. PI-3: entry must
      // exist in the manifest plugins[] array.
      const sourceMp = source.sourceRecord;
      const manifest = await loadCachedMarketplaceManifest(sourceMp.manifestPath);
      const entryRaw = manifest.plugins.find((p) => p.name === plugin);
      if (entryRaw === undefined) {
        throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
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
        // Capture the rollbackPartials + best-known-version BEFORE
        // re-throwing. The post-guard catch block threads
        // `failureRollbackPartials` into `PluginFailedMessage.rollbackPartial`
        // (per-phase typed `cause?: Error` carried verbatim from the
        // ledger -- no synthesis). PathContainmentError bypasses the
        // rollback-partial path verbatim per PI-14: the catch detects the
        // error class, omits the `rollbackPartial` field, and lets the
        // renderer surface the PathContainmentError's text through the
        // cause-chain trailer.
        failureRollbackPartials = result.rollbackPartials;
        failureVersion = ctxLocal.version;
        // result.error is non-undefined on !ok per phase-ledger.ts contract.
        throw result.error ?? new Error("phase ledger failed");
      }

      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = ctxLocal;
    });
  } catch (err) {
    // Pattern S-1 single chokepoint for user-visible errors (V2: one
    // notify(ctx, pi, ...) call carrying a per-variant
    // PluginFailedMessage / PluginUnavailableMessage).
    //
    // Failure routing priority (highest first); the V2 renderer composes
    // the depth-5 cause-chain trailer and per-phase
    // rollback-child rows automatically. Severity is derived to "error"
    // structurally; no reload-hint (failed /
    // unavailable do not trigger the trailer).
    //
    //   1. PI-14 PathContainmentError -- emits a bare PluginFailedMessage
    //      with reasons: [] and cause: err. The renderer surfaces the
    //      PathContainmentError message via the 4-space-indent cause-chain
    //      trailer; NO rollback-partial children even when partials are
    //      present (PI-14 bypass).
    //   2. Rollback-partial (failureRollbackPartials.length > 0 AND not
    //      PathContainmentError) -- PluginFailedMessage with
    //      reasons: ["rollback partial"] plus rollbackPartial: readonly
    //      { phase; cause? }[] with the typed Error threaded directly
    //      from the phase-ledger per Plan 19-02 RESEARCH Finding 1
    //      (RollbackPartial.cause is already typed Error -- NO synthesis
    //      from the free-form .msg string).
    //   3. Entity-shape errors (PI-3 / PI-4 / PI-5 via
    //      `classifyEntityShapeError`) -- the classifier's EntityErrorRow
    //      carries `status: "failed" | "unavailable"` AND `reasons:
    //      readonly Reason[]`; install.ts preserves the discriminator
    //      verbatim (catalog `failure-unsupported-features` uses
    //      `unavailable`; catalog `failure-rollback-partial` /
    //      `failure-runtime-with-cause` use `failed`). PluginUnavailable
    //      has no `cause?` field per D-15-01; the entity-shape reason
    //      carries the explanation. PluginFailed carries `cause: err`
    //      for the renderer's 4-space-indent trailer.
    //   4. Generic runtime error -- PluginFailedMessage with reasons: []
    //      and cause: err. The renderer suppresses the empty `{...}`
    //      brace per D-15-01 and surfaces the cause-chain trailer below
    //      the bare `(failed)` row.
    const isPathContainment = err instanceof PathContainmentError;
    const rolledBackPartial = !isPathContainment && failureRollbackPartials.length > 0;
    const entityErrorRow = isPathContainment
      ? undefined
      : classifyEntityShapeError(err, { plugin, marketplace, scope });
    const failureMessage = composeInstallFailureMessage({
      err,
      plugin,
      scope,
      version: failureVersion,
      rolledBackPartial,
      rollbackPartials: failureRollbackPartials,
      entityErrorRow,
    });

    if (opts.notifications?.mode === "orchestrated") {
      // Orchestrated mode: compose the formatted-cause string so callers
      // reading `outcome.cause` for rendering keep working. The typed
      // Error remains the dispatch surface; narrow on `instanceof
      // PluginShapeError` to recover the specific failure kind.
      return classifyInstallFailure(err, formatOrchestratedCause(err));
    }

    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [failureMessage],
        },
      ],
    });
    // Collapsed failure: `error` is the dispatch surface; `cause` is the
    // formatted text for callers that render it directly.
    const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
    return { status: "failed", error: wrapped, cause: formatOrchestratedCause(err) };
  }

  // Defensive: the success path always populates installCtx; if it did not,
  // surface the inconsistency rather than silently emit a missing message.
  if (installCtx === undefined) {
    const cause = `installPlugin: internal error -- guard returned cleanly without populating install context for plugin "${plugin}".`;
    const internalErr = new Error(cause);
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "failed", error: internalErr, cause };
    }

    // V2 internal-error defensive arm: synthesise a PluginFailedMessage
    // carrying the wrapped internalErr. `reasons: []` -- no closed-set
    // Reason classifies an internal invariant violation; the renderer
    // suppresses the empty brace per D-15-01 and surfaces the cause
    // text via the 4-space-indent trailer.
    //
    // CR-02: row-level `scope` is OMITTED -- the marketplace block carries
    // the same scope, and `renderScopeBracket` (shared/notify.ts:743)
    // suppresses the per-row bracket in that case. Matches the IN-04
    // omit convention pinned at install.ts:936-944 and the primary catch
    // path's `composeInstallFailureMessage` recipe.
    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [
            {
              status: "failed",
              name: plugin,
              reasons: [] as const,
              cause: internalErr,
            },
          ],
        },
      ],
    });
    return { status: "failed", error: internalErr, cause };
  }

  const orchestrated = opts.notifications?.mode === "orchestrated";
  const postCommitWarnings: string[] = [];

  // POST-state-commit (AS-6 / D-08): eager per-plugin data dir mkdir.
  // The state record is already committed; the side effect runs inside
  // a defensive try/catch so a permission error cannot strand the
  // install. The standalone-mode user-visible warning is DROPPED per
  // D-19-01 (D-18-01 lineage): the V2
  // MarketplaceNotificationMessage type has no field to surface
  // "data-dir creation deferred after successful state mutation". The
  // orchestrated-mode collection path is preserved for the cascade
  // caller's pushDiagnostic channel.
  try {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  } catch (mkdirErr) {
    const msg = `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 precedent -- dropped in standalone mode.
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // Plugin moved from "available" -> "installed"; drop the cached plugin
  // index for this marketplace so the next completion read rebuilds with
  // the new status. Defense-in-depth try/catch.
  //
  // D-19-01 precedent (D-18-01 lineage): cache-refresh failure is
  // swallowed silently in V2. The cache-refresh side effect still fires;
  // only the user-visible warning surface is gone. The orchestrated-mode
  // collection path is preserved for the cascade caller.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    const msg = `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 precedent -- dropped in standalone mode.
  }

  // AS-7 / W-08 / B-08: agents-bridge preserved foreign-content rows
  // during prepare. The install of NEW agents succeeded; the
  // foreign-preserved rows are a manual-cleanup hint. The standalone-mode
  // user-visible warning is DROPPED per D-19-01 (D-18-01 lineage):
  // agent foreign-file preservation rows have no clean V2
  // MarketplaceNotificationMessage representation. The
  // orchestrated-mode collection path is preserved for the cascade
  // caller; the underlying agents-bridge state still records the
  // foreign-row preservation in agents-index.json.
  if (installCtx.agentForeignFailures.length > 0) {
    const detail = installCtx.agentForeignFailures
      .map((f) => `${f.generatedName}: ${f.reason}`)
      .join("; ");
    const msg = `Plugin "${plugin}" installed; ${installCtx.agentForeignFailures.length.toString()} pre-existing agent file(s) preserved on disk: ${detail}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 precedent -- dropped in standalone mode.
  }

  // Bridge-side soft warnings (e.g. agents bridge cleanup-leak return
  // values aggregated during the staged phases). The standalone-mode
  // user-visible warning is DROPPED per D-19-01 (D-18-01 lineage):
  // bridge-side soft warnings have no clean V2 representation. The
  // orchestrated-mode collection path is preserved.
  for (const w of installCtx.bridgeWarnings) {
    if (orchestrated) {
      postCommitWarnings.push(w);
    }
    // else: D-19-01 precedent -- dropped in standalone mode.
  }

  // PI-9 corollary: track whether anything was actually staged. Preserved
  // verbatim because `InstallPluginOutcome.resourcesChanged` is consumed
  // by import/execute.ts as a structural predicate.
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;

  if (!orchestrated) {
    // V2 success: one notify(ctx, pi, ...) call with a
    // PluginInstalledMessage. The renderer probes companion-loaded
    // state via softDepStatus(pi) and emits the
    // per-row soft-dep markers (`{requires pi-subagents, requires
    // pi-mcp}`) automatically from `dependencies: readonly
    // Dependency[]`. The "/reload to pick up changes" trailer fires
    // structurally on the `installed` status -- the V1 RH-1
    // noop-gate (suppress when `!stagedAny`) is GONE in V2; the
    // reload-hint trigger ladder is per-variant, not per-resource-count
    // (mirrors Plan 19-01 pilot's PU-8 (b) behavior change).
    //
    // PI-13 dependencies-declaration note (V1 line 808 follow-up
    // notifyWarning) is DROPPED per D-19-01: the PR-5 free-form prose
    // had no clean V2 MarketplaceNotificationMessage representation;
    // the resolver still appends the note to `installable.notes` so
    // downstream surfaces (e.g. `/claude:plugin list` rendering) can
    // continue to consume it.
    const dependencies: Dependency[] = [];
    if (installCtx.stagedAgentNames.length > 0) {
      dependencies.push("agents");
    }

    if (installCtx.stagedMcpServerNames.length > 0) {
      dependencies.push("mcp");
    }

    // IN-02: drop the `version !== ""` defensive spread. `resolvePluginVersion`
    // (orchestrators/plugin/shared.ts) always returns a non-empty string
    // (either `entry.version` with length > 0 or the 12-hex hash via
    // `computeHashVersion`), so the guard was dead. The renderer's
    // version-slot composer treats undefined and empty-string identically
    // (suppresses the `v<version>` token), so behavior is preserved against
    // the theoretical legacy-state-with-empty-version case anyway.
    //
    // IN-04: `scope` is OMITTED from the row (canonical "only emit fields
    // that affect the byte output" form). The single-plugin install
    // surface's row scope is always the same as the marketplace block's
    // scope -- the renderer's `renderScopeBracket` (shared/notify.ts:719)
    // suppresses the bracket when `pluginScope === mpScope`, so emitting
    // `scope` here was a no-op byte-wise but diverged stylistically from
    // uninstall.ts:298-302 (which omits) and reinstall.ts:247-252 (which
    // omits via `rowScope === undefined`). Aligning install.ts on the
    // omit convention reduces future divergence.
    const installedRow: PluginInstalledMessage = {
      status: "installed",
      name: plugin,
      dependencies,
      version: installCtx.version,
    };
    // V2 notify() call mirrors the Plan 19-01 pilot recipe at
    // orchestrators/plugin/uninstall.ts; install.ts substitutes
    // "installed" + dependencies[] + per-D-19-03 failure branches
    // (D-19-02 + D-19-03).
    notify(ctx, pi, {
      marketplaces: [
        {
          name: marketplace,
          scope,
          plugins: [installedRow],
        },
      ],
    });
  }

  return {
    status: "installed",
    resourcesChanged: stagedAny,
    declaresAgents: installCtx.stagedAgentNames.length > 0,
    declaresMcp: installCtx.stagedMcpServerNames.length > 0,
    ...(postCommitWarnings.length > 0 && { postCommitWarnings }),
  };
}

// Plan 19-02 (D-19-03): the V1 CMC-17 / MSG-RP-1 rollback-partial body
// composer is RETIRED entirely. The V2 PluginFailedMessage.rollbackPartial
// field (SNM-09 + SNM-10) is the structural replacement; the renderer at
// shared/notify.ts::composeRollbackPartialLines drives all indentation
// (4-space rollback-child row + 6-space per-phase cause-chain trailer)
// . The transaction/phase-ledger.ts RollbackPartial already
// exposes the typed cause?: Error, threaded directly into the V2 field
// per Plan 19-02 RESEARCH Finding 1.

/**
 * Plan 19-02 helper: compose the per-variant V2 plugin notification for
 * the install failure surface. Routes to one of four shapes per D-19-03
 * (priority highest first):
 *
 *   1. PI-14 PathContainmentError -- PluginFailedMessage with reasons:
 *      [], cause: err. The renderer surfaces the message via the
 *      4-space-indent cause-chain trailer; no rollback-partial children
 *      even when partials are present.
 *   2. Rollback-partial -- PluginFailedMessage with reasons:
 *      ["rollback partial"] plus rollbackPartial: readonly { phase;
 *      cause? }[] (typed Error threaded directly from the ledger per
 *      RESEARCH Finding 1).
 *   3. Entity-shape (classifier returns non-undefined) -- preserves the
 *      classifier's status discriminator (failed vs unavailable) so the
 *      catalog `failure-unsupported-features` byte form (uses
 *      "unavailable") and the catalog `failure-rollback-partial` /
 *      `failure-runtime-with-cause` forms (use "failed") both
 *      round-trip cleanly. PluginUnavailableMessage carries reasons but
 *      no cause (D-15-01 / SNM-10); PluginFailedMessage carries both.
 *   4. Generic runtime error -- PluginFailedMessage with reasons: [],
 *      cause: err.
 *
 * The narrowed `cause?: Error` field on failure variants is populated
 * only when `err instanceof Error` (defensive against non-Error throws).
 */
// WR-04: `marketplace` removed from the args type. The pre-fix signature
// accepted `marketplace: string` but never read it -- the destructuring
// at the function body omitted it and no usage referenced
// `args.marketplace`. The caller silently dropped the value, leaving no
// compile-time gate against a future refactor that would expect the
// marketplace name to participate in the cause-chain trailer (e.g. to
// disambiguate a same-named plugin across marketplaces) and would
// silently use stale data. If the marketplace becomes needed for future
// cause-chain composition, add it back here with a comment marking the
// dependency.
function composeInstallFailureMessage(args: {
  err: unknown;
  plugin: string;
  scope: Scope;
  version: string | undefined;
  rolledBackPartial: boolean;
  rollbackPartials: readonly RollbackPartial[];
  entityErrorRow: EntityErrorRow | undefined;
}): PluginNotificationMessage {
  const { err, plugin, scope, version, rolledBackPartial, rollbackPartials, entityErrorRow } = args;
  const cause = err instanceof Error ? err : undefined;
  const isPathContainment = err instanceof PathContainmentError;

  // Branch 1: PI-14 PathContainmentError. Bare failed row with cause
  // trailer; no rollback-partial children, no entity-shape narrowing.
  if (isPathContainment) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: [] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
    };
    return failed;
  }

  // Branch 2: rollback-partial. Thread RollbackPartial.cause directly
  // per RESEARCH Finding 1 -- no synthesis from the free-form .msg.
  if (rolledBackPartial) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: ["rollback partial"] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      rollbackPartial: rollbackPartials.map((p) => ({
        phase: p.phase,
        ...(p.cause !== undefined && { cause: p.cause }),
      })),
    };
    return failed;
  }

  // Branch 3: entity-shape error. Preserve the classifier's status
  // discriminator (`failed` | `unavailable`) so the catalog byte forms
  // round-trip. The classifier's reasons array is closed-set Reason[]
  // already; thread it verbatim. PluginUnavailableMessage has no `cause?`
  // field per D-15-01 -- the reason text carries the explanation.
  if (entityErrorRow !== undefined) {
    if (entityErrorRow.status === "unavailable") {
      const unavailable: PluginUnavailableMessage = {
        status: "unavailable",
        name: plugin,
        reasons: entityErrorRow.reasons,
        ...(version !== undefined && version !== "" && { version }),
      };
      return unavailable;
    }

    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: entityErrorRow.reasons,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
    };
    return failed;
  }

  // Branch 4: generic runtime error. Empty reasons array -- the renderer
  // suppresses the `{}` brace per D-15-01; the cause-chain trailer
  // carries the error text below the bare `(failed)` row.
  const failed: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: [] as const,
    ...(version !== undefined && version !== "" && { version }),
    scope,
    ...(cause !== undefined && { cause }),
  };
  return failed;
}

/**
 * Plan 19-02 helper: format the orchestrated-mode `cause` string for the
 * `InstallPluginOutcome.cause` field. The import cascade caller at
 * `orchestrators/import/execute.ts` reads this string for its
 * `dispatchFailedOutcome` rendering. Mirrors the V1 D-CMC-12 join
 * discipline: `<errorMessage>` plus the depth-5 cause-chain trailer
 * (shared/errors.ts::causeChainTrailer) joined with a blank line when
 * present. Standalone-mode trailers are emitted by V2 `notify()` from
 * the structural `PluginFailedMessage.cause` field; this helper exists
 * solely to preserve the orchestrated-mode string contract.
 */
function formatOrchestratedCause(err: unknown): string {
  const head = errorMessage(err);
  const trailer = causeChainTrailer(err);
  return trailer === "" ? head : `${head}\n\n${trailer}`;
}

/**
 * CMC-34 / MSG-NC-1 entity-shape error classifier for the single-plugin
 * install failure surface. Returns an `EntityErrorRow` when the orchestrator's
 * thrown error matches a recognised entity-shape pattern (PI-3 / PI-4 / PI-5);
 * returns `undefined` for generic runtime errors which surface via
 * bare `errorMessage(err)` + the cause-chain trailer.
 *
 * Pattern map (PRD §5.2.1 + catalog §"/claude:plugin install"):
 *   - "not found in marketplace"       -> (failed)      {not in manifest}
 *   - "is already installed"           -> (failed)      {already installed}
 *   - "is not installable: <notes>"    -> (unavailable) {<narrowed reasons from notes>}
 *
 * The `is not installable` notes are split on `; ` and each segment narrowed
 * to a closed `Reason`: manifest field names (`hooks` / `lspServers` etc.)
 * pass verbatim per the MSG-GR-4 manifest-field carve-out; the catch-all
 * is `unsupported source` (closed REASONS member).
 */
function classifyEntityShapeError(
  err: unknown,
  ctx: { plugin: string; marketplace: string; scope: Scope },
): EntityErrorRow | undefined {
  // Dispatch on `instanceof PluginShapeError` + `.shape.kind` rather than
  // substring-matching `.message`. The throw sites carry their structural
  // classification verbatim, so the catch site does not need to reparse text.
  if (!(err instanceof PluginShapeError)) {
    return undefined;
  }

  switch (err.shape.kind) {
    case "already-installed":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["already installed"] as const,
      };
    case "not-in-manifest":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["not in manifest"] as const,
      };
    case "not-installable":
    case "no-longer-installable":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "unavailable",
        // Resolver `r.notes` are free-form strings; narrow to closed
        // `Reason` members for the renderer. Reading from `err.shape`
        // (the typed discriminated union) means the narrow on
        // `.kind === "not-installable" | "no-longer-installable"`
        // guarantees `.reasons` is present -- no `?? []` fallback
        // needed.
        reasons: narrowResolverReasons(err.shape.reasons),
      };
    default:
      return assertNever(err.shape);
  }
}

// Manifest field names detected through the MSG-GR-4 carve-out. The closed
// set holds the BARE camelCase token (`hooks`, `lspServers`) -- the DETECTION
// key sliced from the resolver note, derived from the real `.claude-plugin/
// plugin.json` JSON key. The resolver prefixes the kind with `"contains "`
// when populating `r.notes` (see `domain/resolver.ts:685` -- the
// `addUnsupportedKindNotes` helper writes `partial.notes.push(\`contains
// ${kind}\`)` for every UNSUPPORTED_COMPONENT_KINDS member it detects).
// The previous predicate `MANIFEST_FIELD_REASONS.has(reason)` compared the
// WHOLE note string against the bare set -- so the resolver's
// `"contains hooks"` never matched, the row degraded to
// `{unsupported source}`, and the carve-out was effectively dead. Task
// 260525-cjr C5 restores the carve-out: `startsWith("contains ")` strips
// the resolver's prefix, then checks the remaining token against the set.
// New detection tokens added here MUST also have an entry in
// `MANIFEST_FIELD_TO_REASON` below mapping them to a member of the closed
// `Reason` set in `shared/notify.ts::REASONS` so the renderer accepts them.
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
const MANIFEST_FIELD_NOTE_PREFIX = "contains ";

// SNM-36 / D-24-04 detection-vs-emission seam: the DETECTION token stays
// camelCase (matches the resolver note derived from the JSON manifest key);
// the EMITTED closed-set Reason is the user-rendered value. `lspServers`
// detects but renders as `lsp` (parallel to the single-word `hooks`
// carve-out); `hooks` detects and renders unchanged.
const MANIFEST_FIELD_TO_REASON: Readonly<Record<string, Reason>> = {
  hooks: "hooks",
  lspServers: "lsp",
};

/**
 * Extract the bare manifest-field token from a resolver `"contains <kind>"`
 * note and map it to the emitted closed-set `Reason`. Returns `undefined`
 * when the note does not start with the prefix or the token has no mapping.
 * Detection token (camelCase) and emitted Reason can differ -- see the
 * SNM-36 / D-24-04 seam note above.
 */
function manifestFieldTokenFromNote(note: string): Reason | undefined {
  if (!note.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
    return undefined;
  }

  const token = note.slice(MANIFEST_FIELD_NOTE_PREFIX.length);
  // DETECT: gate on the camelCase manifest-field token (STAYS camelCase --
  // it matches the resolver note derived from the JSON manifest key).
  if (!MANIFEST_FIELD_REASONS.has(token)) {
    return undefined;
  }

  // EMIT: map the detected camelCase token to its closed-set Reason.
  // Typed lookup -- no cast needed (D-24-04 / D-24-05 seam).
  return MANIFEST_FIELD_TO_REASON[token];
}

/**
 * Narrow resolver `r.notes` (free-form strings) to the closed `Reason` set
 * for renderer consumption. Classification order:
 *   1. manifest-field carve-out (`contains hooks` / `contains lspServers`)
 *   2. "source" substring -> `unsupported source`
 *   3. errno-like substrings (EACCES / EPERM / ENOENT / SyntaxError)
 *   4. permissive fallback: `unsupported source`
 * Steps 3-4 are defensive for notes already serialised by deeper helpers;
 * the preferred path is typed errno-bearing Errors dispatched at the
 * orchestrator catch site via `.code`.
 */
function narrowResolverReasons(reasons: readonly string[]): readonly Reason[] {
  const out: Reason[] = [];
  for (const reason of reasons) {
    if (reason === "") {
      continue;
    }

    // The resolver emits `"contains hooks"` / `"contains lspServers"` --
    // extract the bare token via the typed helper for the MSG-GR-4 carve-out.
    const manifestFieldToken = manifestFieldTokenFromNote(reason);
    if (manifestFieldToken !== undefined) {
      out.push(manifestFieldToken);
      continue;
    }

    if (reason.includes("source")) {
      out.push("unsupported source");
      continue;
    }

    // Defensive errno-substring fallback (see JSDoc above).
    if (reason.includes("EACCES") || reason.includes("EPERM")) {
      out.push("permission denied");
      continue;
    }

    if (reason.includes("ENOENT") || reason.includes("ENOTDIR")) {
      out.push("source missing");
      continue;
    }

    if (reason.includes("SyntaxError") || reason.includes("Unexpected token")) {
      out.push("unparseable");
    }
  }

  if (out.length === 0) {
    // Conservative fallback: at least one Reason is required for the
    // EntityErrorRow `reasons` field. `unsupported source` is the
    // documented permissive default for an unclassifiable PI-4 cause.
    out.push("unsupported source");
  }

  // Dedup, preserving first-seen order: a multi-note resolver failure can
  // map several notes to the same closed Reason, and the row must not
  // render a duplicate token.
  return [...new Set(out)];
}

function classifyInstallFailure(err: unknown, formattedCause: string): InstallPluginOutcome {
  // All failure variants collapse to `{ status: "failed"; error; cause }`.
  // `error` is the dispatch surface (narrow on `instanceof PluginShapeError`
  // to recover `.shape.kind`); `cause` is the formatted user-visible text.
  // `ConcurrentInstallError` is preserved as a distinct typed branch (PI-15);
  // non-Error inputs are wrapped so the contract guarantees `error instanceof Error`.
  const wrapped = err instanceof Error ? err : new Error(formattedCause);
  return { status: "failed", error: wrapped, cause: formattedCause };
}

/**
 * Test seam for the catch-site dispatch helpers. Helpers stay private to
 * the orchestrator; tests exercise the `instanceof PluginShapeError` +
 * `.kind` dispatch branches directly via this re-export.
 */
export { classifyEntityShapeError as __test_classifyEntityShapeError };
export { classifyInstallFailure as __test_classifyInstallFailure };
export { narrowResolverReasons as __test_narrowResolverReasons };
