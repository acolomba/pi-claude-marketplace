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
//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir) -> warning on failure
//   Success notify via PluginInlineRow + renderRow (CMC-23) + reload hint;
//   per-row soft-dep markers via declaresAgents/Mcp (CMC-13 / MSG-SD-1..3).
//   Failure with rollback-partial routes through renderRollbackPartial
//   (CMC-17 / MSG-RP-1) with parent PluginInlineRow + RollbackChild[] +
//   auto-appended cause-chain trailer via notifyError (D-CMC-12).
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
import { softDepStatus } from "../../platform/pi-api.ts";
import { causeChainTrailer } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { renderRollbackPartial } from "../../presentation/rollback-partial.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  assertNever,
  ConcurrentInstallError,
  errorMessage,
  PluginShapeError,
} from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
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
  EntityErrorRow,
  PluginInlineRow,
  RollbackChild,
  SoftDepProbe,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Parsed (plugin, marketplace) options bundle. PI-1 / RH-1 / RH-2 parse is
 * the edge layer's responsibility (Phase 6); this orchestrator entrypoint
 * accepts already-parsed strings + the resolved scope.
 *
 * `pi` is REQUIRED -- `softDepStatus(pi)` constructs the SoftDepProbe that
 * `renderRow` consumes for per-row soft-dep marker injection (CMC-13 /
 * MSG-SD-1..3). Making `pi` optional would force a runtime branch the
 * type checker cannot reason about.
 *
 * CMC-13 / MSG-SD-1..3: the `"installed"` variant carries REQUIRED
 * `declaresAgents` / `declaresMcp` boolean predicates. They are derived
 * once at the success-return site from `installCtx.stagedAgentNames.length
 * > 0` / `installCtx.stagedMcpServerNames.length > 0` (the same expression
 * form used by the standalone cascade-row site) and propagated through
 * orchestrators that compose plugin rows (e.g. `import/execute.ts`).
 * Making them REQUIRED rather than optional honors NFR-7: a discriminated
 * outcome must not have a third undefined state at consumers.
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
       * Task 260525-cjr C3: collapsed failure variant. The pre-C3 shape
       * had four `status` values (`"already-installed"` /
       * `"unavailable"` / `"uninstallable"` / `"unexpected-failure"`)
       * each carrying a re-stringified `cause: string`. Consumers
       * dispatched on the string status and lost access to the typed
       * error. The collapsed shape carries the original `Error`
       * instance directly so consumers can narrow on
       * `instanceof PluginShapeError` (and, after C4, on
       * `error.shape.kind`) to recover the precise failure class
       * without re-parsing the formatted cause text.
       *
       * `cause` is preserved as the formatted user-visible text so
       * callers that previously read it for rendering (orchestrated
       * mode in `import/execute.ts`) keep working without rewiring.
       * The `error` field is the load-bearing dispatch surface.
       */
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
    };

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
  // Captured-on-throw context for the catch block. `failurePhaseResolvedVersion`
  // is the version we know about when the ledger threw -- absent if the throw
  // pre-dated resolvePluginVersion. `failureRollbackPartials` mirrors the
  // ledger's RollbackPartial[] for the renderRollbackPartial child block;
  // when empty, the catch routes through the bare PluginInlineRow form
  // (no rollback children, per the catalog single-line failure shape).
  let failureRollbackPartials: readonly RollbackPartial[] = [];
  let failureVersion: string | undefined;
  let failureDeclaresAgents = false;
  let failureDeclaresMcp = false;

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
        // Capture the rollbackPartials + best-known-version + declares-*
        // predicates BEFORE re-throwing. The post-guard catch block uses
        // these to compose a PluginInlineRow + RollbackChild[] for
        // renderRollbackPartial (CMC-17 / MSG-RP-1). PathContainmentError
        // bypasses the rollback-partial rendering verbatim per PI-14:
        // the catch block detects the error class and surfaces .message
        // unchanged.
        failureRollbackPartials = result.rollbackPartials;
        failureVersion = ctxLocal.version;
        failureDeclaresAgents = ctxLocal.stagedAgentNames.length > 0;
        failureDeclaresMcp = ctxLocal.stagedMcpServerNames.length > 0;
        // result.error is non-undefined on !ok per phase-ledger.ts contract.
        throw result.error ?? new Error("phase ledger failed");
      }

      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = ctxLocal;
    });
  } catch (err) {
    // Pattern S-1 single chokepoint for user-visible errors.
    //
    // D-CMC-12: the orchestrated outcome carries the composed message + the
    // cause-chain trailer; the standalone notify path passes the rendered
    // body and lets `notifyError` auto-append the MSG-CC-1 trailer once.
    //
    // Failure routing priority (highest first):
    //   1. PI-14 PathContainmentError -- VERBATIM .message surface (no
    //      compact-line wrapping; the symlink/escape diagnostic is the
    //      entire user surface).
    //   2. CMC-17 rollback-partial (failureRollbackPartials.length > 0) --
    //      parent PluginInlineRow{status:"failed", reasons:["rollback partial"]}
    //      + indented RollbackChild[] block via renderRollbackPartial.
    //   3. CMC-34 / MSG-NC-1 entity-shape errors (PI-3 not-in-manifest,
    //      PI-4 not-installable, PI-5 already-installed) -- compact
    //      EntityErrorRow via renderRow. The orchestrator throws these
    //      with specific message patterns that classifyEntityShapeError
    //      narrows to closed-set Reasons.
    //   4. Generic runtime errors -- bare errorMessage(err); notifyError
    //      auto-appends the MSG-CC-1 cause-chain trailer per D-CMC-12.
    const isPathContainment = err instanceof PathContainmentError;
    const probe = softDepStatus(pi);
    const rolledBackPartial = !isPathContainment && failureRollbackPartials.length > 0;
    let body: string;
    if (isPathContainment) {
      body = errorMessage(err);
    } else if (rolledBackPartial) {
      body = composeRollbackPartialBody({
        plugin,
        marketplace,
        scope,
        version: failureVersion,
        declaresAgents: failureDeclaresAgents,
        declaresMcp: failureDeclaresMcp,
        partials: failureRollbackPartials,
        probe,
      });
    } else {
      const entityRow = classifyEntityShapeError(err, { plugin, marketplace, scope });
      body = entityRow === undefined ? errorMessage(err) : renderRow(entityRow, probe);
    }

    const trailer = causeChainTrailer(err);
    const cause = trailer === "" ? body : `${body}\n\n${trailer}`;
    if (opts.notifications?.mode === "orchestrated") {
      return classifyInstallFailure(err, cause);
    }

    notifyError(ctx, body, err);
    // Task 260525-cjr C3: collapsed `status: "failed"` carries the
    // typed Error so even the standalone-mode return point preserves
    // the dispatch surface. The legacy `"unexpected-failure"` variant
    // is retired in favor of the unified shape.
    const wrapped = err instanceof Error ? err : new Error(cause);
    return { status: "failed", error: wrapped, cause };
  }

  // Defensive: the success path always populates installCtx; if it did not,
  // surface the inconsistency rather than silently emit a missing message.
  if (installCtx === undefined) {
    const cause = `installPlugin: internal error -- guard returned cleanly without populating install context for plugin "${plugin}".`;
    const internalErr = new Error(cause);
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "failed", error: internalErr, cause };
    }

    notifyError(ctx, cause);
    return { status: "failed", error: internalErr, cause };
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

  // RH-1 reload-hint gate: emit the hint only if at least one resource
  // was actually staged (the install would otherwise be a noop and the
  // user has nothing to /reload).
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;

  if (!orchestrated) {
    // CMC-23 / D-13-05 / D-13-06: emit via PluginInlineRow + renderRow.
    // CMC-13 / MSG-SD-1..3: declaresAgents / declaresMcp predicates drive
    // the per-row soft-dep marker injection inside renderRow's composeReasons
    // (the renderer probes companion-loaded state via the injected
    // SoftDepProbe and appends `{requires pi-subagents}` / `{requires pi-mcp}`
    // iff (declares AND unloaded)). The legacy aggregated PI_*_NOT_LOADED
    // trailer pattern is RETIRED per D-13-07; the per-row marker is the
    // single source.
    const probe: SoftDepProbe = softDepStatus(pi);
    const successRow: PluginInlineRow = {
      kind: "plugin-inline",
      name: plugin,
      marketplace,
      scope,
      ...(installCtx.version !== "" && { version: installCtx.version }),
      status: "installed",
      declaresAgents: installCtx.stagedAgentNames.length > 0,
      declaresMcp: installCtx.stagedMcpServerNames.length > 0,
    };
    const body = renderRow(successRow, probe);
    const hint = reloadHint(stagedAny ? [plugin] : []);
    notifySuccess(ctx, appendReloadHint(body, hint));

    // PI-13 dependencies declaration: the resolver appends the canonical
    // PR-5 phrase to `installable.notes`. This is free-form prose (not a
    // closed-set Reason) and does not fit the compact-line grammar -- emit
    // it as a separate `notifyWarning` after the success row per the §18.2
    // free-form trailer escape (the catalog does not list a per-row PI-13
    // example; the planner's default is a follow-up notifyWarning).
    const depsNote = installCtx.resolved.notes.find((n) =>
      n.includes("dependencies that must be installed manually"),
    );
    if (depsNote !== undefined) {
      notifyWarning(ctx, depsNote);
    }
  }

  return {
    status: "installed",
    resourcesChanged: stagedAny,
    declaresAgents: installCtx.stagedAgentNames.length > 0,
    declaresMcp: installCtx.stagedMcpServerNames.length > 0,
    ...(postCommitWarnings.length > 0 && { postCommitWarnings }),
  };
}

/**
 * CMC-17 / MSG-RP-1 rollback-partial composer for the single-plugin install
 * failure surface. Builds a PluginInlineRow parent + RollbackChild[] block
 * via `renderRollbackPartial`.
 *
 * - Parent: `⊘ <plugin>@<marketplace> [<scope>] v<ver?> (failed) {rollback partial}`
 *   (the renderer prepends the icon and the closed-set Reason `rollback partial`
 *   is the canonical parent-row reason per Wave 1's narrowing -- bridge
 *   phase names like `skills` / `agents` are not closed Reasons; the
 *   per-phase failure name surfaces via the indented child's `phaseLabel`).
 * - Children: one `[<phase>] (rollback failed) {rollback partial}` per
 *   ledger RollbackPartial entry. The free-text `msg` is NOT a closed-set
 *   Reason and would not survive narrowing; the phaseLabel + status pair
 *   surfaces the failing bridge by name (matching the catalog form at
 *   `docs/output-catalog.md` lines 304-310). The cause-chain trailer is
 *   appended by `notifyError` (D-CMC-12) after this composer returns.
 *
 * The `declaresAgents` / `declaresMcp` predicates are still surfaced on
 * the parent row so the renderer's per-row soft-dep injection (CMC-13 /
 * MSG-SD-1..3) fires on failed installs that staged agents/mcp content
 * before the rollback; structurally, the renderer treats them identically
 * to a successful row's marker probe.
 */
function composeRollbackPartialBody(args: {
  plugin: string;
  marketplace: string;
  scope: Scope;
  version: string | undefined;
  declaresAgents: boolean;
  declaresMcp: boolean;
  partials: readonly RollbackPartial[];
  probe: SoftDepProbe;
}): string {
  const parent: PluginInlineRow = {
    kind: "plugin-inline",
    name: args.plugin,
    marketplace: args.marketplace,
    scope: args.scope,
    ...(args.version !== undefined && args.version !== "" && { version: args.version }),
    status: "failed",
    reasons: ["rollback partial"] as const,
    declaresAgents: args.declaresAgents,
    declaresMcp: args.declaresMcp,
  };
  const children: readonly RollbackChild[] = args.partials.map((p) => ({
    kind: "rollback-child",
    // MSG-RP-1 catalog form: bracketed phase token; renders verbatim as the
    // bare compact line's leading slot in `renderRollbackChild`.
    phaseLabel: `[${p.phase}]`,
    // The undo step threw; the swap was attempted and the post-commit
    // recovery is the per-plugin reinstall hint. `rollback failed`
    // captures that effective state. Mirrors the precedent established
    // by orchestrators/plugin/update.ts (sub-wave 2a, Plan 13-02a-01).
    status: "rollback failed",
    // The free-text `p.msg` is not in the closed REASONS set; narrow to
    // the canonical parent reason so the child stays inside CMC-11.
    // The phaseLabel + status pair carries the user-visible failure shape.
    reasons: ["rollback partial"] as const,
  }));
  return renderRollbackPartial(parent, children, args.probe);
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
 * is `unsupported source` (closed REASONS member). When no segment narrows
 * cleanly the row carries a single `not installable` ... but that's not in
 * the closed set; falls back to `unsupported source` which is the closest
 * in-set Reason. Wave 3 catalog UAT verifies the user-visible shape.
 */
function classifyEntityShapeError(
  err: unknown,
  ctx: { plugin: string; marketplace: string; scope: Scope },
): EntityErrorRow | undefined {
  // Quick task 260525-aub: dispatch on `instanceof PluginShapeError` +
  // `.kind` instead of `.message.includes(...)` and the deleted
  // SonarCloud S5852 ReDoS regex (`/is not installable:\s*(.+)$/`).
  // The resolver/install throw sites carry their structural classification
  // verbatim, so the catch site no longer reparses the message string.
  //
  // Task 260525-cjr C4: switch on `err.shape.kind` and read the
  // shape-specific `reasons` field directly through `err.shape`. The
  // pre-C4 `err.reasons?` optional mirror field is gone -- the
  // discriminator + the typed shape narrow it without a non-null
  // assertion.
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

// Manifest field names allowed through the MSG-GR-4 carve-out. The closed
// set holds the BARE token (`hooks`, `lspServers`) -- the value emitted to
// the renderer. The resolver, however, prefixes the kind with `"contains "`
// when populating `r.notes` (see `domain/resolver.ts:685` -- the
// `addUnsupportedKindNotes` helper writes `partial.notes.push(\`contains
// ${kind}\`)` for every UNSUPPORTED_COMPONENT_KINDS member it detects).
// The previous predicate `MANIFEST_FIELD_REASONS.has(reason)` compared the
// WHOLE note string against the bare set -- so the resolver's
// `"contains hooks"` never matched, the row degraded to
// `{unsupported source}`, and the carve-out was effectively dead. Task
// 260525-cjr C5 restores the carve-out: `startsWith("contains ")` strips
// the resolver's prefix, then checks the remaining token against the set.
// New tokens added here MUST also be added to `shared/grammar/reasons.ts`
// so the renderer's type-narrowing accepts them.
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["hooks", "lspServers"]);
const MANIFEST_FIELD_NOTE_PREFIX = "contains ";

/**
 * Task 260525-cjr C5: extract the bare manifest-field token from a
 * resolver `"contains <kind>"` note. Returns `undefined` for any note
 * that does not start with the prefix OR whose extracted token is not
 * a member of `MANIFEST_FIELD_REASONS`. The caller then knows it can
 * emit the bare token as a Reason directly.
 */
function manifestFieldTokenFromNote(note: string): Reason | undefined {
  if (!note.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
    return undefined;
  }

  const token = note.slice(MANIFEST_FIELD_NOTE_PREFIX.length);
  if (MANIFEST_FIELD_REASONS.has(token)) {
    // Safe cast: the set members ("hooks", "lspServers") are documented
    // members of the closed `Reason` set in `shared/grammar/reasons.ts`.
    return token as Reason;
  }

  return undefined;
}

/**
 * Quick task 260525-aub: narrow resolver `r.notes` (free-form strings)
 * to the closed `Reason` set for renderer consumption. Mirrors the legacy
 * `narrowNotInstallableReasons` behavior but operates on the structural
 * `PluginShapeError.reasons` field; no message-text re-parse.
 *
 * Task 260525-cjr B2: extended typed-dispatch path. Previously the
 * function silently dropped any note that wasn't a manifest-field
 * carve-out token (`hooks` / `lspServers`) or a "source"-substring
 * unsupported-source marker, then fell through to `unsupported source`
 * for the empty-out fallback. That hid permission-denied / EACCES /
 * EIO / JSON-parse-failure causes behind the misleading
 * `{unsupported source}` reason on `(failed)` rows. The new ordering:
 * (1) manifest-field carve-out, (2) "source" substring,
 * (3) errno-like substrings (EACCES / EPERM / ENOENT / SyntaxError),
 * (4) the final permissive `unsupported source` fallback only when no
 * other classifier matched. The errno-substring path is a DEFENSIVE
 * fallback -- the preferred path is for upstream code to throw a
 * typed errno-bearing Error which a separate orchestrator-level
 * catch can dispatch on `.code` directly. The substring fallback
 * here catches notes that were already serialised into the
 * `r.notes` array by a deeper helper.
 */
function narrowResolverReasons(reasons: readonly string[]): readonly Reason[] {
  const out: Reason[] = [];
  for (const reason of reasons) {
    if (reason === "") {
      continue;
    }

    // Task 260525-cjr C5: the resolver emits `"contains hooks"` /
    // `"contains lspServers"` (NOT bare `"hooks"` / `"lspServers"`)
    // for the manifest-field carve-out. Extract the bare token via the
    // typed helper so the MSG-GR-4 carve-out path actually runs.
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
      continue;
    }
  }

  if (out.length === 0) {
    // Conservative fallback: at least one Reason is required for the
    // EntityErrorRow `reasons` field. `unsupported source` is the
    // documented permissive default for an unclassifiable PI-4 cause.
    out.push("unsupported source");
  }

  return out;
}

function classifyInstallFailure(err: unknown, formattedCause: string): InstallPluginOutcome {
  // Task 260525-cjr C3: collapse the four pre-C3 error variants into a
  // single `{ status: "failed"; error; cause }` shape. The typed `error`
  // is the dispatch surface (consumers narrow on `instanceof
  // PluginShapeError` to recover `kind`); `cause` preserves the
  // formatted user-visible text for callers that previously read the
  // `cause` field. `ConcurrentInstallError` is preserved as a distinct
  // typed branch (PI-15 race); non-Error inputs are wrapped so the
  // contract guarantees `error instanceof Error`.
  const wrapped = err instanceof Error ? err : new Error(formattedCause);
  return { status: "failed", error: wrapped, cause: formattedCause };
}

/**
 * Quick task 260525-aub: test seam for the catch-site dispatch helpers.
 * Mirrors the `__test_outcomeToCascadeRow` re-export precedent in
 * `orchestrators/plugin/reinstall.ts`: the helpers stay private to the
 * orchestrator while the tests still get a direct exercise surface for
 * the discriminated `instanceof PluginShapeError` + `.kind` dispatch
 * branches.
 */
export { classifyEntityShapeError as __test_classifyEntityShapeError };
export { classifyInstallFailure as __test_classifyInstallFailure };
export { narrowResolverReasons as __test_narrowResolverReasons };
