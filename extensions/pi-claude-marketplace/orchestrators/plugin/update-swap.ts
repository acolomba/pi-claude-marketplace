// orchestrators/plugin/update.ts
//
// PUP-1..9 + AS-3 (3-phase) + AS-7 (orphan agent index entries) + WR-04 +
// NFR-2 + NFR-3.
//
// Two exported entrypoints (D-09 corollary):
//  1. updateSinglePlugin: PluginUpdateFn -- cascade-safe; NEVER throws
//  2. updatePlugins(opts) -- direct entrypoint; PUP-1 three forms
//
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow D-02 precedent):
//
//  (prepare): sequential bridge prepare* into tmp (skills -> commands
//  -> agents -> mcp). Any throw triggers abort of already-prepared handles
//  + structured cleanup-failure descriptors.
//
//  (state-guard swap with old-resource snapshot): inside
//  `withStateGuard` re-read the plugin record, ST-9 stale-version check,
//  overwrite resources + version + updatedAt in-memory. Throw on ST-9
//  mismatch; guard does NOT save (ST-7).
//
//  Phase 3a (physical replace, aggregate failures, continue across bridges):
//  call each bridge's commitPrepared* in skills -> commands -> agents -> mcp
//  order. D-03 specifies CONTINUE across bridge failures (not fail-fast)
//  so the partial-replace state is fully observed. Failures aggregate
//  into Phase3Failure[].
//
//  Phase 3b (compose recovery hint or success): if any failures, wrap in
//  PluginUpdatePhase3Error with RECOVERY_PLUGIN_REINSTALL_PREFIX hint.
//  Else: success outcome carries WR-04 stagedAgentNames/stagedMcpServerNames.
//
// D-141-03 / D-141-05: the four bridges' staging warnings are READ (they were
// not, so every one of them was dark on this path) and split by install's
// rule through `./shared.ts::splitStagingWarnings`. The skills and commands
// DISCOVERY half always rides the `updated` outcome's `notes`; the agents and
// mcp HYGIENE half joins it in cascade mode only. The direct path renders the
// discovery half through `surfaceDiscoveryWarnings` AFTER the cascade, since
// the runner that produces a warning finishes long before the row it
// qualifies exists.
//
// PUP-9 routing:
//  updateSinglePlugin -- cascade path -- catches into partition='failed'
//  updatePlugins -- direct path -- surfaces phase-2-or-earlier throws via
//  a single notify(ctx, pi, NotificationMessage) per
//  orchestration arm (cause threaded structurally on a
//  PluginFailedMessage; renderer composes the 4-space
//  cause-chain trailer).
//
// Success and failure notifications are a single
//  notify(opts.ctx, opts.pi, { marketplaces: [{..., plugins: [...] }] })
// call per orchestration arm. notify() owns severity, the reload-hint
// trailer, and the cause-chain. The post-success completion-cache-refresh
// warning inside dropPluginCompletionCache is NOT surfaced: the underlying
// dropMarketplaceCache call still runs (correctness preserved), only the
// standalone-mode user-visible warning surface is absent.
//
// D-11 import boundaries: orchestrators/plugin/ may import named exports
// from orchestrators/marketplace/shared.ts (GitOps, DEFAULT_GIT_OPS,
// resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

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
import { compileIfPredicate } from "../../bridges/hooks/if-field/index.ts";
import { removeHookConfig, writeHookConfig } from "../../bridges/hooks/index.ts";
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
import { parseHooksConfig, projectHookSummaryEntries } from "../../domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import {
  CleanupContextError,
  errorMessage,
  errorWithCleanupFailures,
  PluginUpdateConcurrencyError,
  PluginUpdatePhase3Error,
  type CleanupArtifact,
  type CleanupFailure,
  type CleanupLifecycle,
  type Phase3Failure,
} from "../../shared/errors.ts";
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import {
  assertNoCrossPluginConflicts,
  maybeWritePluginConfigBack,
  removePluginRecord,
  splitStagingWarnings,
} from "./shared.ts";
import { UPDATE_CONTEXT } from "./update.messaging.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { DegradeKind } from "../../shared/notify-reasons.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { PreparedPluginUpdate, UpdateCloneCacheSeam } from "./update-preflight.ts";
import type { PluginUpdateFailedOutcome, PluginUpdateOutcome } from "../types.ts";

/** Hook-routing capabilities consumed by successful update finalization. */
export type UpdateHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/** Common collaborators and identity for one prepared plugin replacement. */
export interface ThreePhaseArgsBase {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly hooksRouting: UpdateHooksRouting;
  readonly completionCache: CompletionCache;
  readonly mapModel?: boolean;
  readonly local?: boolean;
  readonly partial?: boolean;
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly cleanupClones: (locations: ScopedLocations) => Promise<unknown>;
}

/** Direct update replacement owns user notification context. */
export interface DirectThreePhaseArgs extends ThreePhaseArgsBase {
  readonly cascade: false;
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly cardinality: "single" | "plural";
  readonly notifyPhaseFailure: (error: Error, failures: readonly UpdatePhase3Failure[]) => void;
}

/** Cascade replacement returns its outcome to the marketplace flow. */
export interface CascadeThreePhaseArgs extends ThreePhaseArgsBase {
  readonly cascade: true;
  readonly ctx?: never;
  readonly pi?: never;
}

/** Complete mode-specific replacement contract. */
export type ThreePhaseArgs = DirectThreePhaseArgs | CascadeThreePhaseArgs;

interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}

export interface UpdatePhase3Failure extends Omit<Phase3Failure, "cause"> {
  readonly cause: Error;
}

export type NonFailedUpdateOutcome = Exclude<PluginUpdateOutcome, PluginUpdateFailedOutcome>;

export interface DirectRenderableFailedOutcome extends Omit<
  PluginUpdateFailedOutcome,
  "cause" | "fromVersion" | "phaseFailures" | "reasons" | "toVersion"
> {
  readonly reasons: readonly ContentReason[];
  readonly cause?: never;
  readonly fromVersion?: never;
  readonly phaseFailures?: never;
  readonly toVersion?: never;
}

export interface UpdatePhase3FailedOutcome extends Omit<
  PluginUpdateFailedOutcome,
  "cause" | "fromVersion" | "phaseFailures" | "reasons"
> {
  readonly fromVersion: string;
  readonly reasons: readonly ContentReason[];
  readonly phaseFailures: NonNullable<PluginUpdateFailedOutcome["phaseFailures"]>;
  readonly cause?: never;
}

export type DirectRenderableOutcome = NonFailedUpdateOutcome | DirectRenderableFailedOutcome;
export type UpdateRunOutcome = DirectRenderableOutcome | UpdatePhase3FailedOutcome;
type NonEmptyUpdatePhase3Failures = readonly [UpdatePhase3Failure, ...UpdatePhase3Failure[]];

type PluginPreflight = PreparedPluginUpdate;

/**
 * Prepare all four bridges into tmp, in skills -> commands -> agents -> mcp
 * order; any throw aborts the handles already prepared and appends their
 * cleanup-leak descriptors.
 *
 * D-141-03 / D-141-05: each returned handle carries a `result.warnings`
 * array. Those are read once the swap succeeds, by `collectUpdateWarnings`
 * below -- not here, because a prepare that later fails has no row to hang a
 * warning off.
 */
async function prepareUpdateHandles(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  agentsDirs: readonly string[],
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
      // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
      cwd,
    });
    handles.commands = await prepareStageCommands({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousCommandNames: record.resources.prompts,
      // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
      cwd,
    });
    handles.agents = await prepareStagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      agentsDirs,
      knownSkills: handles.skills.result.recorded.map((record) => record.generatedName),
      // AG-7 opt-in: forward the direct-path `--map-model` setting. The
      // cascade entrypoint never sets `args.mapModel`, so cascade re-
      // installs always resolve to false (omit `model:`).
      mapModel: args.mapModel ?? false,
      // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
      cwd,
    });
    handles.mcp = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: marketplace,
      pluginName: plugin,
      servers: installable.mcpServers,
      pluginRoot: installable.pluginRoot,
      pluginData: pluginDataDir,
      sourcePath: `${installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    throw errorWithCleanupFailures(err, await abortPartialHandles(handles, "prepare"));
  }

  return handles as PrepHandles;
}

/**
 * D-141-03 / D-141-05: fold the four bridges' staging warnings onto the
 * `updated` outcome, split by install's rule -- the skills and commands
 * DISCOVERY half reaches both modes, the agents and mcp HYGIENE half is
 * orchestrated-only. `args.cascade` is the mode seam; no plumbing flag was
 * added for this.
 *
 * Its own function rather than a few lines inside the finalize window:
 * `prepareUpdateHandles` and that window already sit near the fallow
 * `maxCognitive: 15` and `maxUnitSize: 60` ceilings.
 */
function collectUpdateWarnings(handles: PrepHandles, cascade: boolean): readonly string[] {
  const { discovery, bridge } = splitStagingWarnings({
    skills: handles.skills.result.warnings,
    commands: handles.commands.result.warnings,
    agents: handles.agents.result.warnings,
    mcp: handles.mcp.result.warnings,
  });
  return Object.freeze([...discovery, ...(cascade ? bridge : [])]);
}

async function abortPartialHandles(
  handles: Partial<PrepHandles>,
  phase: Extract<CleanupLifecycle, "prepare">,
): Promise<readonly CleanupFailure[]> {
  const failures: CleanupFailure[] = [];
  if (handles.agents !== undefined) {
    appendCleanupFailure(
      failures,
      phase,
      "agents",
      agentsCleanupPath(handles.agents),
      await abortPreparedAgents(handles.agents),
    );
  }

  if (handles.commands !== undefined) {
    appendCleanupFailure(
      failures,
      phase,
      "commands",
      commandsCleanupPath(handles.commands),
      await abortPreparedCommands(handles.commands),
    );
  }

  if (handles.skills !== undefined) {
    appendCleanupFailure(
      failures,
      phase,
      "skills",
      skillsCleanupPath(handles.skills),
      await abortPreparedSkills(handles.skills),
    );
  }

  return Object.freeze(failures);
}

async function abortHandles(handles: PrepHandles): Promise<readonly CleanupFailure[]> {
  abortPreparedMcp(handles.mcp);
  const failures: CleanupFailure[] = [];
  appendCleanupFailure(
    failures,
    "abort",
    "agents",
    agentsCleanupPath(handles.agents),
    await abortPreparedAgents(handles.agents),
  );
  appendCleanupFailure(
    failures,
    "abort",
    "commands",
    commandsCleanupPath(handles.commands),
    await abortPreparedCommands(handles.commands),
  );
  appendCleanupFailure(
    failures,
    "abort",
    "skills",
    skillsCleanupPath(handles.skills),
    await abortPreparedSkills(handles.skills),
  );
  return Object.freeze(failures);
}

function skillsCleanupPath(handle: PreparedSkillsStaging): string {
  return handle.kind === "staged" ? handle.stagingRoot : "skills staging";
}

function commandsCleanupPath(handle: PreparedCommandsStaging): string {
  return handle.kind === "staged" ? handle.stagingRoot : "commands staging";
}

function agentsCleanupPath(handle: PreparedAgentsStaging): string {
  return handle.kind === "staged" ? handle.stagingDir : "agents staging";
}

function appendCleanupFailure(
  failures: CleanupFailure[],
  phase: CleanupLifecycle,
  artifact: CleanupArtifact,
  cleanupPath: string,
  diagnostic: string | undefined,
): void {
  if (diagnostic === undefined) {
    return;
  }

  failures.push(
    Object.freeze({
      phase,
      artifact,
      path: cleanupPath,
      cause: new Error(diagnostic),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TR-04: intent-mark + finalize helpers.
//
// Module-level constants:
//  - UPDATE_IN_PROGRESS_NOTE: the load-bearing marker text written into
//    `compatibility.notes` during the intent-mark window. A static string
//    keeps the cross-process contract simple to grep + assert; a future GC
//    sweeper can use `sRecord.updatedAt` (already in the schema) for
//    staleness.
//  - PHASE3_FAILURE_PHASES + Phase3Phase: closed-set tuple for the per-bridge
//    finalize gating. `Phase3Failure.phase` is already declared as the closed
//    union `"skills" | "commands" | "agents" | "mcp"` in shared/errors.ts, so
//    the tuple here is a runtime mirror of the type for explicit Set<Phase3Phase>
//    construction inside `finalizeUpdateRecord`. A future fifth bridge surfaces
//    here as a TS error.
//
// The intent-mark marker is internal-only: shared/notification-grammar.ts and
// shared/notification-summary.ts do not read `compatibility.notes`; the only
// extension consumer is reinstall.ts
// (record copy, not rendering), so no notify-rendering test is at risk.
// ─────────────────────────────────────────────────────────────────────────────

const UPDATE_IN_PROGRESS_NOTE = "update-in-progress";

// D-63-01: hooks slot lands between agents and mcp -- mirrors install-outcome.ts
// runPhases literal-array order.
const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "hooks", "mcp"] as const;
type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];

/**
 * TR-04: pre-commit intent-mark.
 *
 * Runs INSIDE a `withStateGuard` BEFORE phase-3a commits begin. Re-reads
 * the per-marketplace per-plugin state record, performs the ST-9
 * stale-version check, and writes the intent-mark
 * `compatibility = { installable: false,
 * notes: [UPDATE_IN_PROGRESS_NOTE], supported: <carry-forward>,
 * unsupported: <carry-forward> }`.
 *
 * Cross-process contract: a SECOND process observing
 * `installable: false` + `notes: [UPDATE_IN_PROGRESS_NOTE]` MUST treat
 * this plugin as in-flight; the next `update` call from any process is
 * the recovery path. ST-9 lives here; `finalizeUpdateRecord` does NOT
 * re-check ST-9: a finalize-time ST-9 check would over-fire on the
 * legitimate same-process intent-mark -> commits -> finalize sequence
 * because intent-mark does not bump the version.
 *
 * `compatibility.supported` and `compatibility.unsupported` carry forward
 * UNCHANGED from the pre-update sRecord. They are the
 * truthful current view during the intent-mark window; `finalizeUpdateRecord`
 * rewrites them on the all-success branch.
 *
 * No mutation to `sRecord.version`, `sRecord.resources`, `sRecord.resolvedSource`,
 * or `sRecord.updatedAt` -- those are the finalize step's responsibility.
 */
async function markUpdateInProgress(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { fromVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new PluginUpdateConcurrencyError("marketplace-removed", plugin, marketplace);
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new PluginUpdateConcurrencyError("plugin-uninstalled", plugin, marketplace);
    }

    // ST-9: stale-version check.
    if (sRecord.version !== fromVersion) {
      throw new PluginUpdateConcurrencyError("plugin-updated", plugin, marketplace, {
        expectedVersion: fromVersion,
        actualVersion: sRecord.version,
      });
    }

    sRecord.compatibility = {
      installable: false,
      notes: [UPDATE_IN_PROGRESS_NOTE],
      // Carry forward from EXISTING sRecord, NOT from
      // preflight.installable -- the pre-update arrays are the truthful
      // view during the intent-mark window.
      supported: [...sRecord.compatibility.supported],
      unsupported: [...sRecord.compatibility.unsupported],
    };
  });
}

/** The persisted per-plugin install record the finalize window mutates. */
type PluginStateRecord = PluginPreflight["record"];

/**
 * SC#2 per-bridge orthogonality: each successful bridge writes its new
 * generated names INDEPENDENTLY of every other bridge's outcome, so one
 * failed slot never rolls back a sibling's inventory. The commands ->
 * prompts asymmetry is per TR-03.
 *
 * LIFE-01 / WR-03: the hooks slug is gated the same way. On hooks success
 * the slug follows version B's declaration (present when
 * `hooksConfigPath !== undefined`, empty when version B dropped hooks); on
 * hooks failure neither the slug nor the description moves, because the
 * truthful view is "we did not complete the swap".
 *
 * D-100-01 / ENBL-10: the record's hook description moves with the slug,
 * under the same guard and in the same direction, so the record never names
 * hooks the current version no longer declares.
 */
function applyPerBridgeResources(
  sRecord: PluginStateRecord,
  args: {
    readonly plugin: string;
    readonly handles: PrepHandles;
    readonly failedPhases: ReadonlySet<Phase3Phase>;
    readonly installable: MaterializablePlugin;
    readonly hookEntries: readonly HookSummaryEntry[] | undefined;
  },
): void {
  const { plugin, handles, failedPhases, installable, hookEntries } = args;

  if (!failedPhases.has("skills")) {
    sRecord.resources.skills = handles.skills.result.recorded.map((r) => r.generatedName);
  }

  if (!failedPhases.has("commands")) {
    sRecord.resources.prompts = handles.commands.result.recorded.map((r) => r.generatedName);
  }

  if (!failedPhases.has("agents")) {
    sRecord.resources.agents = handles.agents.result.recorded.map((r) => r.generatedName);
  }

  if (!failedPhases.has("mcp")) {
    sRecord.resources.mcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
  }

  if (!failedPhases.has("hooks")) {
    sRecord.resources.hooks = installable.hooksConfigPath === undefined ? [] : [plugin];
    if (hookEntries === undefined) {
      delete sRecord.hookEntries;
    } else {
      sRecord.hookEntries = [...hookEntries];
    }
  }
}

/**
 * SC#2 all-or-nothing: the version bump, `installable: true` and
 * `resolvedSource` happen ONLY when every bridge succeeded. On failure the
 * intent-mark `compatibility` set by `markUpdateInProgress` carries forward,
 * which is the truthful "we did not complete the swap" view.
 */
function applyAllSuccessRecordFields(sRecord: PluginStateRecord, preflight: PluginPreflight): void {
  const { installable, toVersion, resolvedSha } = preflight;
  sRecord.version = toVersion;
  sRecord.compatibility = {
    installable: true,
    notes: [...installable.notes],
    supported: [...installable.supported],
    unsupported: [...installable.unsupported],
  };
  sRecord.resolvedSource = installable.pluginRoot;
  // PURL-06 / D-78-01: write the git-source commit identity so the
  // post-commit GC and the next update read the swapped sha. Undefined for
  // path / github-name sources (they have no clone and protect none).
  if (resolvedSha !== undefined) {
    sRecord.resolvedSha = resolvedSha;
  }
}

/**
 * WR-06 + WR-03 + D-60-05: update does NOT delegate to install/uninstall, so
 * without an explicit cache+rebuild step the parsed-config cache would still
 * hold the PRE-update hooks config and dispatch would fire the old command
 * paths until `/reload`. Mirrors the install / uninstall pattern inside the
 * existing per-plugin lock: drop the old cache entry, repopulate from the
 * just-staged `hooks.json` when present, then rebuild the routing table once.
 *
 * Runs on the all-success arm only; an aggregated phase-3 failure leaves the
 * OLD config in place, mirroring the SC#2 compatibility/resolvedSource
 * decision.
 */
async function refreshHooksCacheAfterUpdate(
  args: ThreePhaseArgs,
  installable: MaterializablePlugin,
): Promise<void> {
  const { plugin, marketplace } = args;
  args.hooksRouting.removePluginConfigFromCache(args.scope, marketplace, plugin);
  if (installable.hooksConfigPath !== undefined) {
    await args.hooksRouting.readAndCachePluginHooks({
      scope: args.scope,
      marketplace,
      plugin,
      resolvedSource: asAbsolutePluginRoot(installable.pluginRoot),
      hooksJsonPath: path.join(installable.pluginRoot, installable.hooksConfigPath),
      cwd: args.cwd,
      logPrefix: "update",
    });
  }

  args.hooksRouting.rebuildRoutingTables();
}

/**
 * TR-04: post-commit finalize.
 *
 * Runs INSIDE a SECOND `withStateGuard` AFTER phase-3a. Mutation policy
 * has TWO distinct failure semantics:
 *
 * 1. PER-BRIDGE (independent across bridges): for each of skills /
 *    commands / agents / mcp, if `!failedPhases.has(bridge)` then write
 *    `sRecord.resources.<schemaField> = handles.<bridge>.result.recorded
 *    .map(r => r.generatedName)`. SC#2: do NOT
 *    gate per-bridge writes on `phase3aFailures.length === 0`; the
 *    independent per-bridge gate is the load-bearing structural contract.
 *
 *    Bridge -> schema-field mapping (locked, per TR-03):
 *      skills    -> resources.skills
 *      commands  -> resources.prompts   (asymmetric, schema-locked)
 *      agents    -> resources.agents
 *      mcp       -> resources.mcpServers
 *
 * 2. ALL-OR-NOTHING (version bump + installable flip + resolvedSource):
 *    only when `phase3aFailures.length === 0`. On any failure the
 *    `compatibility` block stays at the intent-mark values
 *    (`installable: false`, `notes: [UPDATE_IN_PROGRESS_NOTE]`),
 *    `version` stays at `fromVersion`, and `resolvedSource` stays at
 *    the pre-update install path.
 *
 * `sRecord.updatedAt` is set on BOTH branches: even a failed finalize
 * is a truthful "we touched this record" stamp.
 */
async function finalizeUpdateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
  phase3aFailures: readonly Phase3Failure[],
  hookEntries: readonly HookSummaryEntry[] | undefined,
): Promise<{ readonly invalidConfigWriteBack: boolean }> {
  const { plugin, marketplace, locations } = args;
  const { installable } = preflight;
  const allSucceeded = phase3aFailures.length === 0;
  let invalidConfigWriteBack = false;

  await withStateGuard(locations, async (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new PluginUpdateConcurrencyError("marketplace-removed", plugin, marketplace, {
        lifecycle: "finalize",
      });
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new PluginUpdateConcurrencyError("plugin-uninstalled", plugin, marketplace, {
        lifecycle: "finalize",
      });
    }

    // Anchor the per-bridge gating against the runtime tuple of known
    // phases, so a future fifth bridge forces an explicit tuple update
    // before landing here.
    const failedPhases = new Set<Phase3Phase>(
      phase3aFailures.map((f) => f.phase).filter((p) => PHASE3_FAILURE_PHASES.includes(p)),
    );

    applyPerBridgeResources(sRecord, {
      plugin,
      handles,
      failedPhases,
      installable,
      hookEntries,
    });

    if (allSucceeded) {
      applyAllSuccessRecordFields(sRecord, preflight);
    }

    sRecord.updatedAt = new Date().toISOString();

    // WB-01 / A7: deep-equal short-circuited config write-back on the
    // all-success arm. SKIPPED in cascade mode (the marketplace autoupdate
    // cascade owns its own writes; mirrors WR-09 orchestrated-mode
    // semantics). The deep-equal gate compares the prospective
    // `{...existing, ...patch}` shape against the existing entry; the
    // current plugin entry shape carries no version field, so the patch is
    // `{}` and a CHANGED update with a byte-stable existing entry produces a
    // no-op, preserving RECON-05 mtime stability.
    if (!args.cascade && allSucceeded) {
      const writeResult = await maybeWritePluginConfigBack({
        locations,
        marketplace,
        plugin,
        local: args.local === true,
      });
      if (writeResult.invalidConfig) {
        invalidConfigWriteBack = true;
      }
    }
  });

  // Route visibility follows the state guard's durable auto-save. A failed
  // state/config write therefore leaves the lifecycle runtime untouched.
  if (allSucceeded) {
    await refreshHooksCacheAfterUpdate(args, installable);
  }

  return { invalidConfigWriteBack };
}

/**
 * LIFE-01 / D-63-01 hooks slot of phase 3a. The hooks bridge has NO staging
 * dir (D-63-02) so the prepare/commit split does not apply --
 * `writeHookConfig` IS the atomic write.
 *
 * WR-01: `removeHookConfig()` (version B drops hooks) is non-atomic --
 * `rm({recursive, force})` can throw partway and leave the hooks subtree
 * partially deleted. The `failedPhases.has("hooks")` guard at finalize
 * preserves the OLD `resources.hooks` inventory in state.json, keeping the
 * truthful "swap incomplete" view. The /reload routing table points at the
 * partially-deleted file until the user runs reinstall
 * (RECOVERY_PLUGIN_REINSTALL_PREFIX hint). Same recovery contract as
 * `reinstall.ts::commitHooks` (WR-05).
 *
 * Returns the supported hook entries version B materialized (D-100-01 /
 * ENBL-10), or undefined when version B declares no hooks -- which is the
 * signal to clear the record's description.
 */
async function commitUpdateHooks(
  args: ThreePhaseArgs,
  installable: PluginPreflight["installable"],
): Promise<readonly HookSummaryEntry[] | undefined> {
  if (installable.hooksConfigPath === undefined) {
    // Version B has no hooks: remove any stale file from version A.
    await removeHookConfig({ locations: args.locations, pluginName: args.plugin });
    return undefined;
  }

  const raw = await readFile(
    path.join(installable.pluginRoot, installable.hooksConfigPath),
    "utf8",
  );
  const ifCtx = { homedir: homedir(), cwd: args.cwd, projectRoot: args.cwd };
  const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
  if (!parsed.ok) {
    throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
  }

  await writeHookConfig({
    locations: args.locations,
    pluginName: args.plugin,
    pluginRoot: installable.pluginRoot,
    hooksValue: parsed.value,
  });
  // D-100-02 / ENBL-11: `parsed.value` is the supported subset already.
  return projectHookSummaryEntries(parsed.value);
}

/**
 * Phase 3a: physical replace, aggregating failures across bridges.
 *
 * D-03 discipline: CONTINUE across bridge-commit failures (not fail-fast) so
 * the partial-replace state is fully observed. `Phase3Failure` entries carry
 * per-bridge cause references; the caller wraps them in the aggregate error.
 *
 * The five commits run in skills -> commands -> agents -> hooks -> mcp order,
 * matching install's PI-9 ledger order. Each commit is independently atomic
 * at the OS level (rename for skills/commands/agents, atomicWriteJson for
 * mcp, write-or-remove for hooks).
 */
async function commitUpdatePhase3a(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
): Promise<{
  readonly failures: UpdatePhase3Failure[];
  readonly hookEntries: readonly HookSummaryEntry[] | undefined;
}> {
  const failures: UpdatePhase3Failure[] = [];

  try {
    const leak = await commitPreparedSkills(handles.skills);
    if (leak !== undefined) {
      const cleanupFailure = commitCleanupFailure(
        "skills",
        skillsCleanupPath(handles.skills),
        leak,
      );
      failures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: cleanupFailureCause(cleanupFailure),
        cleanupFailures: Object.freeze([cleanupFailure]),
      });
    }
  } catch (err) {
    failures.push({ phase: "skills", msg: errorMessage(err), cause: err as Error });
  }

  try {
    const leak = await commitPreparedCommands(handles.commands);
    if (leak !== undefined) {
      const cleanupFailure = commitCleanupFailure(
        "commands",
        commandsCleanupPath(handles.commands),
        leak,
      );
      failures.push({
        phase: "commands",
        msg: `commands staging cleanup leak: ${leak}`,
        cause: cleanupFailureCause(cleanupFailure),
        cleanupFailures: Object.freeze([cleanupFailure]),
      });
    }
  } catch (err) {
    failures.push({ phase: "commands", msg: errorMessage(err), cause: err as Error });
  }

  try {
    const leak = await commitPreparedAgents(handles.agents);
    if (leak !== undefined) {
      const cleanupFailure = commitCleanupFailure(
        "agents",
        agentsCleanupPath(handles.agents),
        leak,
      );
      failures.push({
        phase: "agents",
        msg: `agents staging cleanup leak: ${leak}`,
        cause: cleanupFailureCause(cleanupFailure),
        cleanupFailures: Object.freeze([cleanupFailure]),
      });
    }
  } catch (err) {
    failures.push({ phase: "agents", msg: errorMessage(err), cause: err as Error });
  }

  let hookEntries: readonly HookSummaryEntry[] | undefined;
  try {
    hookEntries = await commitUpdateHooks(args, preflight.installable);
  } catch (err) {
    failures.push({ phase: "hooks", msg: errorMessage(err), cause: err as Error });
  }

  try {
    await commitPreparedMcp(handles.mcp);
  } catch (err) {
    failures.push({ phase: "mcp", msg: errorMessage(err), cause: err as Error });
  }

  return { failures, hookEntries };
}

function commitCleanupFailure(
  artifact: Extract<CleanupArtifact, "skills" | "commands" | "agents">,
  cleanupPath: string,
  diagnostic: string,
): CleanupFailure {
  return Object.freeze({
    phase: "commit",
    artifact,
    path: cleanupPath,
    cause: new Error(diagnostic),
  });
}

function cleanupFailureCause(failure: CleanupFailure): CleanupContextError {
  return new CleanupContextError(new Error(`${failure.artifact} commit cleanup failed`), [failure]);
}

function hasUpdatePhase3Failures(
  failures: readonly UpdatePhase3Failure[],
): failures is NonEmptyUpdatePhase3Failures {
  return failures.length > 0;
}

/**
 * Phase 3b aggregate error path. Composes the typed aggregate, emits the
 * direct-path failure row, and returns the cascade-shaped failed outcome.
 *
 * PUP-9: the direct path surfaces one notify with a synthetic
 * PluginFailedMessage carrying the typed cause; the renderer composes the
 * 4-space cause-chain trailer beneath the failed plugin row. The cascade is
 * NOT re-rendered here -- aborting before the cascade walk means there is
 * exactly one row to surface.
 */
function composePhase3FailureOutcome(
  args: ThreePhaseArgs,
  failures: NonEmptyUpdatePhase3Failures,
  versions: { readonly fromVersion: string; readonly toVersion: string },
): UpdatePhase3FailedOutcome {
  const { plugin } = args;
  const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
  const aggregateMsg = `Plugin "${plugin}" update failed during physical replace. ${recoveryHint}`;
  const aggregate = new PluginUpdatePhase3Error(aggregateMsg, failures, {
    cause: failures[0].cause,
  });

  if (isDirectUpdate(args)) {
    args.notifyPhaseFailure(aggregate, failures);
  }

  // CMC-17 / MSG-RP-1: surface phaseFailures structurally so the cascade
  // renderer can build the rollback-partial parent plus indented children
  // block. notes[] is retained for outcome-level text aggregation.
  return {
    partition: "failed",
    name: plugin,
    fromVersion: versions.fromVersion,
    toVersion: versions.toVersion,
    notes: [aggregateMsg, ...failures.map((f) => `${f.phase}: ${f.msg}`)],
    // Pre-narrowed: phase-3 aggregate failures always render as `(failed)
    // {rollback partial}` per docs/output-catalog.md. The direct entrypoint
    // emits these inline and filters them before its local mapper; the
    // marketplace cascade consumer reads `reasons[0]` directly.
    reasons: ["rollback partial"] as const,
    phaseFailures: failures.map((f) => ({
      phase: f.phase,
      msg: f.msg,
      ...(f.cleanupFailures !== undefined && { cleanupFailures: f.cleanupFailures }),
    })),
    // declaresAgents / declaresMcp are required `boolean`. `(failed)` rows
    // do not render the soft-dep marker.
    declaresAgents: false,
    declaresMcp: false,
  };
}

/**
 * S5: an invalid config file silently skipped the write-back while the
 * success notify proceeded. Direct-path callers surface the abort as a
 * separate warning AFTER the success row, so the user knows the on-disk
 * artifacts were updated but the config entry was not written. The cascade
 * path never calls the write-back (gated by `!args.cascade`), so it is
 * structurally unaffected.
 */
function notifyInvalidConfigWriteBack(args: DirectThreePhaseArgs): void {
  const targetBasename = path.basename(
    args.local === true ? args.locations.configLocalJsonPath : args.locations.configJsonPath,
  );
  notifyWithContext(
    args.ctx,
    args.pi,
    UPDATE_CONTEXT,
    [
      {
        name: args.marketplace,
        scope: args.scope,
        plugins: [
          {
            status: "failed",
            name: args.plugin,
            reasons: ["invalid manifest"] as const,
            cause: new Error(`Config file "${targetBasename}" failed schema validation.`),
            // D-03/D-06: invalid-config abort -> error, no reload.
            severity: "error" as const,
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    args.cardinality,
  );
}

// The three-phase update body sequences preflight, the D-UPD disabled-record
// fast path, prepare-handles, the intent-mark window, phase-3a per-bridge
// commits, finalize, the phase-3b aggregate error path, and the S5
// invalid-config write-back warning. The per-phase save-vs-throw discipline
// stays visible here; the phase bodies themselves are extracted above.
export async function swapPluginUpdate(
  args: ThreePhaseArgs,
  preflight: PreparedPluginUpdate,
): Promise<UpdateRunOutcome> {
  const { plugin, marketplace, scope } = args;
  const { installable, fromVersion, toVersion } = preflight;

  // ─── : prepare into tmp ────────────────────────────────────────────
  //
  // Bridge prepare* writes only under <extensionRoot>/<bridge>-staging/<uuid>/.
  // Sequential ordering -- skills -> commands -> agents -> mcp -- matches
  //  D-03 PU-1 order, but mcp's "prepare" is in-memory only (it
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
  const handles = await prepareUpdateHandles(args, preflight, generatedNames.agentsDirs);

  // ─── Phase 2a: pre-commit intent-mark (TR-04) ─────────────────────────────
  //
  // The intent-mark window writes `compatibility.installable = false` +
  // `notes: [UPDATE_IN_PROGRESS_NOTE]` BEFORE phase-3a commits. ST-9
  // stale-version detection lives here. The intent-mark survives a process
  // crash mid-commit
  // so the next `/reload` + retry sees the truthful prior version and the
  // `RECOVERY_PLUGIN_REINSTALL_PREFIX` recovery hint is structurally mirrored
  // on disk.
  //
  // No version/resources/resolvedSource mutation in this window -- those
  // are the post-phase-3a `finalizeUpdateRecord` step's responsibility.

  try {
    await markUpdateInProgress(args, preflight);
  } catch (err) {
    // Intent-mark failure (typically ST-9 stale-version): abort all prep
    // handles + rethrow.
    throw errorWithCleanupFailures(err, await abortHandles(handles));
  }

  // ─── Phase 3a: physical replace; aggregate failures across bridges ────────

  const { failures: phase3aFailures, hookEntries } = await commitUpdatePhase3a(
    args,
    preflight,
    handles,
  );

  // ─── Phase 2b: finalize state (TR-04) ─────────────────────────────────────
  //
  // The finalize window writes per-bridge resource updates for every
  // bridge whose commit succeeded (independent of other bridges' outcomes),
  // and bumps `version` + `installable=true` + `resolvedSource` ONLY when
  // all four bridges succeeded.
  //
  // Order discipline: finalize MUST run BEFORE the phase-3b recovery-hint
  // emission. If finalize ran AFTER the recovery-hint emission on a success
  // path that flips to finalize-failure, the user would see a success
  // notification then a stale state -- worst of both worlds. The synthetic
  // 'mcp' push inside the finalize catch (below) trips the phase-3b branch
  // so the recovery hint fires.
  //
  // A finalize throw routes through `phase3aFailures` as a synthetic
  // `phase: "mcp"` entry so the existing
  // `notifyDirectFailure` recovery-hint pipeline fires unchanged. The
  // `msg` field carries the explicit `state finalize failed:` text so
  // operator diagnostics see the truthful cause. A dedicated
  // `phase: "finalize"` Phase3Failure member is deferred.
  let invalidConfigWriteBack = false;
  try {
    const finalizeResult = await finalizeUpdateRecord(
      args,
      preflight,
      handles,
      phase3aFailures,
      hookEntries,
    );
    invalidConfigWriteBack = finalizeResult.invalidConfigWriteBack;
  } catch (finalizeErr) {
    phase3aFailures.push({
      phase: "mcp",
      msg: `state finalize failed: ${errorMessage(finalizeErr)}`,
      cause: finalizeErr as Error,
    });
  }

  // ─── Phase 3b: aggregate error path with recovery hint, OR success ────────

  if (hasUpdatePhase3Failures(phase3aFailures)) {
    return composePhase3FailureOutcome(args, phase3aFailures, { fromVersion, toVersion });
  }

  // PURL-06 / D-78-01: GC-after-swap. The finalize withStateGuard has committed
  // the new resolvedSha, so the OLD clone is now unreferenced iff no surviving
  // record maps to it; `garbageCollectPluginClones` derives live clone keys from
  // the persisted records and deletes the rest. Runs POST-commit (NFR-3
  // fail-clean: a crash between commit and delete just leaves an orphan the next
  // idempotent pass removes). Gated on a git-source swap (`preflight.resolvedSha`
  // set) so path / github-name updates add no cache sweep. Leaks are swallowed
  // (D-19-01): hygienic cleanup never becomes the primary path.
  if (preflight.resolvedSha !== undefined) {
    try {
      await args.cleanupClones(args.locations);
    } catch {
      // D-19-01: a GC failure never fails the update; the next pass retries.
    }
  }

  // Success: WR-04 fields populated for cascade-side RH-5 composition.
  // CMC-13: declaresAgents / declaresMcp predicate inputs
  // mirror reinstall's effective-state contract (declares iff actually
  // staged this update). The renderer probes companion-loaded state via
  // SoftDepProbe and emits `{requires pi-subagents}` / `{requires pi-mcp}`
  // iff (declares AND unloaded).
  const stagedAgentNames = handles.agents.result.recorded.map((r) => r.generatedName);
  const stagedMcpServerNames = handles.mcp.result.recorded.map((r) => r.generatedName);
  // WARN-01 / WR-12 / D-99-03: the same per-kind degrade collection install and
  // reinstall make off their ledger handles, read here off the handles the
  // bridges returned. A component whose SOURCE frontmatter would not parse is
  // written in synthesized form rather than failing the ledger, so the row
  // reporting the transition has to be able to name it -- otherwise `list`
  // renders the record's degraded state one command later over a row that
  // claimed a clean update.
  const degradedKinds = collectDegradedKinds(handles);
  const updateWarnings = collectUpdateWarnings(handles, args.cascade);
  await dropPluginCompletionCache(args);
  if (isDirectUpdate(args) && invalidConfigWriteBack) {
    notifyInvalidConfigWriteBack(args);
  }

  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgentNames,
    stagedMcpServerNames,
    declaresAgents: stagedAgentNames.length > 0,
    declaresMcp: stagedMcpServerNames.length > 0,
    // Spread only when non-empty: a clean update's outcome keeps the key ABSENT
    // rather than present-and-empty, so its shape is unchanged (NREG-01).
    ...(degradedKinds.length > 0 && { degradedKinds }),
    // SURF-05 / D-63-08 / WR-01: the update re-materializes `hooks/hooks.json`,
    // so it can introduce a handler declaring `rewakeMessage` / `rewakeSummary`
    // without `asyncRewake: true` exactly as install, enable and backfill can.
    // Read off the re-resolved candidate, the same source `enable-disable.ts`
    // reads. Without this the one verb that INHERITS the signal was the one
    // verb whose row could never carry it.
    ...(installable.orphanRewake === true && { orphanRewake: true }),
    // FSTAT-07 / D-66-04: a `--partial` update whose candidate re-resolved
    // `partially-available` degraded it -- carry the dropped kinds so the cascade
    // renders `(partially-installed)` instead of `(updated)`. Empty for a clean
    // candidate (FSTAT-03 -- no lingering partial state).
    //
    // SEV-03 / D-69-01: `newlyDegraded` records whether this degrade NEWLY
    // introduced partial state -- the PERSISTED `compatibility.unsupported` read
    // from the prior install record (`preflight.record`, loaded BEFORE the
    // update applied) was empty. The autoupdate cascade renderer reads it to
    // raise the row to `warning` (newly degraded) vs `info` (already degraded);
    // the manual `update --partial` renderer ignores it (explicit opt-in stays
    // info). No schema change -- the field already exists on the record.
    ...(installable.state === "partially-available" && {
      partialDegrade: {
        kinds: [...installable.unsupported],
        newlyDegraded: preflight.record.compatibility.unsupported.length === 0,
      },
    }),
    // D-141-03 / D-141-05: same NREG-01 spread rule as `degradedKinds` -- a
    // clean update's outcome keeps the key absent.
    ...(updateWarnings.length > 0 && { notes: updateWarnings }),
  };
}

/**
 * WARN-01 / WR-12 / D-99-03: the component kinds this update staged in degraded
 * form. Extracted from the success-outcome body so that body stays under the
 * cognitive-complexity ceiling. Collection order is skill before command, the
 * same order `malformedReasonsForKinds` enforces on emit.
 */
function collectDegradedKinds(handles: PrepHandles): readonly DegradeKind[] {
  return Array.from(
    new Set<DegradeKind>([
      ...(handles.skills.result.degraded.length > 0 ? ["skill" as const] : []),
      ...(handles.commands.result.degraded.length > 0 ? ["command" as const] : []),
    ]),
  );
}

async function dropPluginCompletionCache(args: ThreePhaseArgs): Promise<void> {
  try {
    await args.completionCache.dropMarketplaceCache(
      await args.locations.pluginCacheFile(args.marketplace),
      args.scope,
      args.marketplace,
    );
  } catch {
    // Per D-19-01 direct-path completion-cache-refresh warnings are
    // swallowed silently. The cache-refresh side effect still fires
    // above; only the user-visible standalone-mode warning surface is
    // gone. The cascade path is unaffected (no separate warning emission
    // in cascade mode).
  }
}

function isDirectUpdate(args: ThreePhaseArgs): args is DirectThreePhaseArgs {
  return !args.cascade;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade construction (CMC-26). shared/notification-summary.ts derives
// content severity and the reload hint before shared/notification-dispatch.ts
// dispatches; shared/notification-grammar.ts owns every row-rendering concern
// (icon, version arrow, reasons brace, rollback-partial children).
// ─────────────────────────────────────────────────────────────────────────────
