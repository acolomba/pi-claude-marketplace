// orchestrators/plugin/install-flow-results.ts
//
// Typed install outcome, promotion, declaration, and warning projection.
import { writePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  errorMessage,
  rethrowInvalidGitHubBaseUrl,
  type MarketplaceInLocalLayerOnlyError,
  type MarketplaceSourceUndeclarableError,
} from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { skipSeverity } from "../../shared/notify-reasons.ts";
import { ownValue } from "../../shared/own-key.ts";

import { supersedePinRefreshes } from "./dependency-move.ts";
import { movedFromRow } from "./dependency-settle.ts";
import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeFailureMessage,
  composeCascadeMemberRow,
} from "./install-cascade.messaging.ts";
import { runInstallLedger } from "./install-outcome.ts";
import {
  INSTALL_CONTEXT,
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  composePromotedRow,
  formatOrchestratedCause,
} from "./install.messaging.ts";
import {
  localOnlyMarketplaceRefusal,
  overwriteDisabledMemberEntries,
  pluginLayerVerdict,
  undeclarableMarketplaceRefusal,
  sweepWorkflowsStaging,
  writeAdoptingConfigEntries,
  type TargetLayers,
} from "./shared.ts";
import { surfaceStagingDiagnostics } from "./staging-diagnostics.ts";

import type { CascadeFailureSubject, CascadeInstalledRow } from "./install-cascade.messaging.ts";
import type { CascadeMemberOutcome, CascadeSkippedMember } from "./install-cascade.ts";
import type {
  InstallFailureCapture,
  InstallLedgerResult,
  InstallLedgerSummary,
  InstallPluginNotifications,
} from "./install-outcome.ts";
import type { StagingDiagnostic } from "./staging-diagnostics.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { PluginConfigEntry, ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { NotificationContext, SoftDepStatus } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { ContentReason, McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { InstallPluginOutcome, MovedDependency, UpdateDependencyRow } from "../types.ts";
import type { CascadeFailureSink } from "./install-flow-cascade-context.ts";
import type { CascadeInstallOptions, CascadeTransaction } from "./install-flow-cascade-context.ts";

export interface ResultInstallOptions extends CascadeInstallOptions {
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly pinVersionOverride?: string;
  readonly notifications?: InstallPluginNotifications;
}

export type HydratableMember = Pick<
  CascadeMemberOutcome,
  "key" | "name" | "marketplace" | "pluginRoot" | "hooksConfigPath"
>;

/**
 * The one declaration an ORCHESTRATED install owes its own config entry.
 *
 * WR-09 forbids an orchestrated caller the full write-back -- reconcile derives
 * desired state FROM the merged config, so rewriting it would clobber a
 * per-machine override. It does NOT forbid the DFEN-04 / D-102-04 disabled
 * stamp, and that stamp must be declared or the very next `resources_discover`
 * undoes the install: without it the record lands disabled while the entry the
 * reconcile planner reads says nothing about enablement; the next reload reads
 * absent-as-enabled (D-04), finds the record disabled, and plans an enable,
 * re-enabling a plugin whose author declared it off.
 *
 * D-04-02: no dependency plugin gets a key. The desired-state config names
 * only the plugins the user asked for by name; each dependency's record carries
 * `provenance: "dependency"`, and D-04-05's exemption in `buildUninstallBucket`
 * is what keeps that record out of the uninstall sweep on the next reload.
 *
 * The stamp addresses `targetConfigPath` -- which for reconcile is the file the
 * plugin's own declaration lives in (see `ResultInstallOptions.local`) -- and
 * is spread over the existing entry, so no forward-compat key (D-09) and no
 * sibling entry is disturbed.
 *
 * The stamp's condition is the landed-disabled verdict and nothing else. That
 * verdict already required the caller's opt-in (so `import` never reaches
 * here, D-102-03) and an ABSENT `enabled` key (so a value the user wrote is
 * never rewritten, D-102-04); re-testing either would be a second, drift-prone
 * copy of the same gate.
 *
 * Nothing to declare writes nothing at all, which is the shape a plugin
 * installed enabled produces -- RECON-05 byte stability.
 *
 * The stamp goes through `writePluginConfigEntry`, SPLIT-02 / D-102-09's sole
 * sanctioned single-entry writer. The batched writer is not interchangeable
 * here: it always emits a `marketplaces` key, so routing the stamp through it
 * would add `"marketplaces": {}` to a file that declares none.
 */
export async function writeOrchestratedDeclarations(args: {
  readonly current: ScopeConfig;
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly plugin: string;
  readonly marketplace: string;
  readonly landedDisabled: boolean;
}): Promise<void> {
  if (args.landedDisabled) {
    await writePluginConfigEntry(
      args.current,
      args.targetConfigPath,
      args.scopeRoot,
      args.plugin,
      args.marketplace,
      { enabled: false },
    );
  }
}

/**
 * POST-state-commit side effects and their soft warnings (D-08 / AS-6 /
 * AS-7 / WARN-01). The state record is already committed, so every arm is
 * defensive: a failure here must not strand a successful install.
 *
 * D-19-01 gates the HYGIENE warnings on orchestrated mode, where the cascade
 * caller owns a `pushDiagnostic` channel. A deferred data-dir mkdir or a
 * deferred completion-cache refresh describes housekeeping the extension
 * will retry; `MarketplaceNotificationMessage` has no field for one, and a
 * standalone user has nothing to do about it.
 *
 * D-141-03 amends that for the DISCOVERY warnings, which ride
 * `installCtx.discoveryWarnings` and surface in BOTH modes. A discovery
 * warning says the installed artifact set does not match what the plugin
 * author shipped, and the install row's resource count gives the user no
 * baseline to notice the shortfall. The caller renders the standalone half
 * through `./staging-diagnostics.ts::surfaceDiscoveryWarnings`; update,
 * reinstall and enable render theirs through `surfaceStagingDiagnostics`
 * (D-141-05). Every bridge tags its warnings at the producer, and the ledger
 * partitions them by tag (D-PL1-02, D-PL1-03).
 */
export async function collectPostCommitWarnings(
  installCtx: InstallLedgerSummary,
  completionCache: CompletionCache,
  scope: Scope,
  orchestrated: boolean,
  ensurePluginDataDir: () => Promise<void>,
): Promise<string[]> {
  const { locations, marketplace, plugin } = installCtx;
  const warnings: string[] = [];
  // Hygiene warnings ride the returned array only in orchestrated mode
  // (D-19-01); logged unconditionally either way so a standalone install
  // does not drop the failure without a trace.
  const push = (msg: string): void => {
    hookDebugLog(msg);
    if (orchestrated) {
      warnings.push(msg);
    }
  };

  // D-141-03: never gated. The standalone caller does not read the returned
  // array; it renders the typed `installCtx.discoveryWarnings` itself
  // (D-PL1-04).
  warnings.push(...installCtx.discoveryWarnings.map((w) => w.message));

  // AS-6 / D-08: eager per-plugin data dir mkdir.
  try {
    await ensurePluginDataDir();
  } catch (mkdirErr) {
    push(
      `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`,
    );
  }

  // D-03-INV: the plugin moved from "available" to "installed", so drop the
  // cached plugin index for this marketplace and let the next completion
  // read rebuild it with the new status.
  try {
    await completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(marketplace),
      scope,
      marketplace,
    );
  } catch (err) {
    push(`Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`);
  }

  // AS-7 / W-08 / B-08: agents-bridge preserved foreign-content rows during
  // prepare. The NEW agents installed; the preserved rows are a
  // manual-cleanup hint recorded in agents-index.json regardless.
  if (installCtx.agentForeignFailures.length > 0) {
    const detail = installCtx.agentForeignFailures
      .map((f) => `${f.generatedName}: ${f.reason}`)
      .join("; ");
    push(
      `Plugin "${plugin}" installed; ${installCtx.agentForeignFailures.length.toString()} pre-existing agent file(s) preserved on disk: ${detail}`,
    );
  }

  // WARN-01 / D-86-03: skills/commands whose SOURCE frontmatter could not be
  // parsed were degraded (synthesized / neutralized) but still installed.
  // The per-component detail rides here; the closed-set reason token rides
  // the install row.
  for (const d of installCtx.frontmatterDegradations) {
    push(`${plugin}/${d.generatedName}: ${d.parseError}`);
  }

  // Bridge-side soft warnings (e.g. agents-bridge cleanup-leak return values
  // aggregated during the staged phases).
  for (const w of installCtx.bridgeWarnings) {
    push(w.message);
  }

  // WLIF-01: sweep workflow staging trees a previous run abandoned. Installing
  // is what creates them, so the install side has to sweep or a machine that
  // never uninstalls never would. Debug-logged only (D-19-01): no row is
  // pushed, because a cleanup the user did not ask for does not narrate itself.
  await sweepWorkflowsStaging(installCtx.locations, "install", `${plugin}@${marketplace}`);

  return warnings;
}

/**
 * Emit a single-plugin `(failed)` row and return the matching outcome.
 * Shared by the CFG-03 invalid-config abort and the defensive
 * internal-error arm, which differ only in their reason token.
 *
 * CR-02: row-level `scope` is OMITTED -- the marketplace block carries the
 * same scope and `renderScopeBracket` suppresses the duplicate.
 */
export function failedRowOutcome(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly error: Error;
  readonly reasons: readonly ContentReason[];
  readonly orchestrated: boolean;
  /** UPD-DEP-D1: the moves that landed before the failure. */
  readonly moved?: readonly MovedDependency[] | undefined;
}): InstallPluginOutcome {
  const { ctx, run, marketplace, scope, plugin, error, reasons, orchestrated } = args;
  const cause = error.message;
  if (orchestrated) {
    return { status: "failed", error, cause, ...movedMember(args.moved) };
  }

  notifyWithContext(
    ctx,
    run,
    CASCADE_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            severity: "error" as const,
            name: plugin,
            reasons,
            cause: error,
          },
          ...movedRows(args.moved),
        ],
      },
    ],
    undefined,
    "single",
  );
  return { status: "failed", error, cause, ...movedMember(args.moved) };
}

/**
 * D-04-07: what the promotion arm hands the post-guard row -- the promoted
 * record's version and what it declares, and the plugin as this command
 * re-materialized it when the record was disabled (empty when its artifacts
 * were already on disk). The row reads these rather than the record itself
 * because the state phase replaces the record object when it re-materializes.
 */
export interface PromotionOutcome {
  readonly version: string;
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly declaresWorkflows: boolean;
  readonly materialized: readonly HydratableMember[];
  /** AFILE-04: the re-materialization's MCP config notices; empty otherwise. */
  readonly mcpConfigNotices: readonly McpConfigNotice[];
}

export interface PromotionArgs {
  readonly opts: ResultInstallOptions;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly orchestrated: boolean;
  readonly config: {
    readonly current: ScopeConfig;
    readonly other: ScopeConfig;
    readonly targetIsLocal: boolean;
  };
  readonly capture: InstallFailureCapture;
  readonly transaction: CascadeTransaction;
  /** AFILE-04: receives the re-materialization's notices before the config write. */
  readonly sink: CascadeFailureSink;
  /** D-08-06: the environment the re-materialization stages MCP servers with. */
  readonly env: ClaudeEnv;
  /** D-08-12: the composition-owned removal port for re-materialization. */
  readonly removalOps: RemovalOps;
}

/**
 * D-04-07: promote a recorded dependency the user has now asked for by name.
 * The whole decision lives here so the lock closure gains one condition: the
 * target plugin is absent from the snapshot, or is recorded as a direct
 * install already, and the answer is `undefined` -- the cascade runs and the
 * existing already-installed refusal stands for the second case. Otherwise the
 * record's provenance flips to the direct-install value.
 *
 * A record with its artifacts on disk changes in nothing else: no ledger
 * runs, so version, resources and timestamps stay what the cascade wrote
 * (re-running the ledger with its existing-record allowance would
 * re-materialize the plugin and rewrite all three).
 *
 * A plugin asked for by name is enabled, so a record that was disabled is
 * re-materialized here the way the enable branch re-materializes it, and its
 * declaration carries the `enabled: true` the enable path writes. A bare key
 * would not do: under a `--local` write it leaves a base `{ enabled: false }`
 * in force (LAYER-09), so the next reload would disable what this arm enables
 * on purpose.
 *
 * The match is the exact `plugin` and `marketplace` names the snapshot is
 * keyed by, the same character-for-character comparison the cascade root and
 * reconcile's declared-key set use: no folding, no normalizing, no trimming.
 */
export async function promoteDependencyRecord(
  args: PromotionArgs,
): Promise<PromotionOutcome | undefined> {
  const { marketplace, plugin } = args.opts;
  const record = ownValue(ownValue(args.state.marketplaces, marketplace)?.plugins, plugin);
  if (record?.provenance !== "dependency" || refusesPromotion(args.opts, record)) {
    return undefined;
  }

  record.provenance = "explicit";
  if (!isRecordedButDisabled(record)) {
    await declarePromotedPlugin(args, {});
    return {
      version: record.version,
      declaresAgents: record.resources.agents.length > 0,
      declaresMcp: record.resources.mcpServers.length > 0,
      declaresWorkflows: record.resources.workflows.length > 0,
      materialized: [],
      mcpConfigNotices: [],
    };
  }

  const summary = await materializePromotedRecord(args, record);
  args.sink.mcpConfigNotices = summary.mcpConfigNotices;
  await declarePromotedPlugin(args, { enabled: true });
  return {
    version: summary.version,
    declaresAgents: summary.stagedAgentNames.length > 0,
    declaresMcp: summary.stagedMcpServerNames.length > 0,
    declaresWorkflows: summary.stagedWorkflowNames.length > 0,
    materialized: [
      {
        key: `${plugin}@${marketplace}`,
        name: plugin,
        marketplace,
        pluginRoot: summary.resolved.pluginRoot,
        hooksConfigPath: summary.resolved.hooksConfigPath,
      },
    ],
    mcpConfigNotices: summary.mcpConfigNotices,
  };
}

/**
 * D-04-07: the install flags a promotion answers. A version pin asks for a
 * version the promotion cannot deliver -- no ledger resolves one, and `update`
 * and `reinstall` are the verbs that act on versions -- so it refuses, and the
 * already-installed refusal the cascade then raises stands. `--partial` is the
 * consent gate for a record that is only partially installed: promoting it by
 * name means accepting its degraded shape, as any other partial install does,
 * so without the flag the same refusal stands; on a fully-supported record the
 * flag changes nothing. `--map-model` states how generated agents are written
 * and a promotion generates none, so it has no bearing either way.
 */
function refusesPromotion(opts: ResultInstallOptions, record: PluginInstallRecord): boolean {
  return (
    opts.pinVersionOverride !== undefined ||
    (!record.compatibility.installable && opts.partial !== true)
  );
}

/**
 * D-04-02: the user has asked for the plugin by name, so its key now belongs
 * in the desired-state config. The write is the same adopting write the
 * standalone install arm makes for a fresh install -- the promoted key plus
 * the marketplace entry when the merged view does not declare it yet -- and
 * it is SKIPPED in orchestrated mode, as every write arm in this file is
 * (reconcile derives desired state FROM the merged config; writing back would
 * clobber a per-machine override).
 */
async function declarePromotedPlugin(
  args: PromotionArgs,
  pluginPatch: Partial<PluginConfigEntry>,
): Promise<void> {
  if (args.orchestrated) {
    return;
  }

  await writeAdoptingConfigEntries({
    current: args.config.current,
    other: args.config.other,
    state: args.state,
    marketplace: args.opts.marketplace,
    plugin: args.opts.plugin,
    locations: args.locations,
    targetIsLocal: args.config.targetIsLocal,
    pluginPatch,
  });
}

/**
 * CR-01 / CR-06: mirrors `enable-disable.ts::writeReEnabledMemberConfigEntries`
 * for the install cascade's own re-enable arm (EDEP-03). A re-enabled member
 * whose key the target-scope config ALREADY declares with `enabled: false`
 * -- exactly what `disable <dep>` writes -- is patched to `true`.
 * `overwriteDisabledMemberEntries` overwrites the entry in every layer that
 * holds it, whatever flag the caller typed for the root, so a base-layer
 * entry is found even under `--local`. A member the config does not mention at
 * all stays untouched (D-04-02: the config names only what the user asked for
 * by name). Called only when the install's own root write-back also runs
 * (never orchestrated), and at the SAME point in the lock -- a config write
 * is not undone by `runPhases`.
 */
export async function writeReEnabledCascadeMemberConfigEntries(
  locations: ScopedLocations,
  members: readonly CascadeMemberOutcome[],
): Promise<void> {
  await overwriteDisabledMemberEntries({
    locations,
    keys: members.filter((member) => member.reEnabledFromRecord).map((member) => member.key),
  });
}

type InstalledLedgerResult = Extract<InstallLedgerResult, { readonly kind: "installed" }>;

/**
 * The promotion found the marketplace and its record in the snapshot it hands
 * the ledger synchronously, and the ledger's sole marketplace-absent producer
 * rereads that same slot, so this path cannot produce the absent arm. Type
 * narrowing only; the invariant is established by the caller.
 */
function assertPromotedLedgerInstalled(
  _result: InstallLedgerResult,
): asserts _result is InstalledLedgerResult {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * D-04-07 / ENBL-02: re-materialize a promoted record that was disabled, the
 * way the enable branch does -- the guard-free ledger over THIS closure's
 * snapshot, pinned to the recorded version and allowed to keep the existing
 * record, with the gate picked by the record's own availability (ENBL-07): a
 * record disabled while partially installed re-materializes its degraded
 * shape. `--map-model` is not threaded, as the enable branch does not thread
 * it. The state phase replaces the record with `enabled: true` and carries
 * the flipped provenance across.
 *
 * A ledger throw propagates out of the lock closure before its save, so the
 * provenance flip is discarded with the rest of the snapshot and the install
 * failure row reports the cause with the rollback rows `capture` collected.
 */
async function materializePromotedRecord(
  args: PromotionArgs,
  record: PluginInstallRecord,
): Promise<InstallLedgerSummary> {
  const { opts } = args;
  const result = await runInstallLedger(
    args.state,
    args.locations,
    {
      ctx: opts.ctx,
      run: opts.run,
      scope: opts.scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      pinVersionOverride: record.version,
      ...(record.resolvedVersion !== undefined && { resolvedVersion: record.resolvedVersion }),
      allowExistingRecord: true,
      partial: !record.compatibility.installable,
      removalOps: args.removalOps,
      env: args.env,
    },
    args.capture,
    args.transaction,
  );
  assertPromotedLedgerInstalled(result);
  return result.summary;
}

/**
 * D-04-07: emit the promotion row and return the matching outcome. Mirrors
 * `failedRowOutcome`: orchestrated mode returns the outcome and emits nothing.
 * The outcome is an `installed` one stamped `promoted`, whose resources changed
 * only when the promotion re-materialized a disabled record -- otherwise the
 * record was here before and only its provenance moved -- and whose
 * declares-flags read the record's own inventory, so an orchestrated caller
 * describes the promoted plugin as it is rather than as empty. The row stamps
 * the reload hint on the same condition, as the enable verb's fresh row does.
 */
export function promotedRowOutcome(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly promotion: PromotionOutcome;
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { ctx, run, marketplace, scope, plugin, promotion, orchestrated } = args;
  const enabled = promotion.materialized.length > 0;
  const outcome: InstallPluginOutcome = {
    status: "installed",
    version: promotion.version,
    resourcesChanged: enabled,
    declaresAgents: promotion.declaresAgents,
    declaresMcp: promotion.declaresMcp,
    declaresWorkflows: promotion.declaresWorkflows,
    promoted: true,
  };
  if (!orchestrated) {
    notifyWithContext(
      ctx,
      run,
      INSTALL_CONTEXT,
      [
        {
          name: marketplace,
          scope,
          plugins: [
            composePromotedRow({ plugin, version: promotion.version, scope, needsReload: enabled }),
          ],
        },
      ],
      undefined,
      "single",
    );
  }

  return outcome;
}

/**
 * D-19-03 failure routing for a throw out of the state guard. Priority,
 * highest first:
 *
 *   1. Formatted ledger errors -- `formatRollbackError` has already preserved
 *      containment errors or wrapped partial failures and supplied the raw
 *      rollback rows. This function only projects those values.
 *   2. Entity-shape errors (PI-3 / PI-4 / PI-5) -- the classifier's
 *      `status: "failed" | "unavailable"` discriminator is preserved
 *      verbatim.
 *   3. Runtime error -- a git host refusal carries its reason (INS-06), and
 *      any other throw keeps reasons: [] and cause: err; the renderer
 *      suppresses the empty brace per D-15-01.
 */
function handleInstallThrow(args: {
  readonly err: unknown;
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly capture: InstallFailureCapture;
  readonly orchestrated: boolean;
  readonly moved?: readonly MovedDependency[];
}): InstallPluginOutcome {
  const { err, ctx, run, marketplace, scope, plugin, capture, orchestrated } = args;
  const rolledBackPartial = capture.rollbackPartials.length > 0;
  const entityErrorRow = classifyEntityShapeError(err, { plugin, marketplace, scope });
  const failureMessage = composeInstallFailureMessage({
    err,
    plugin,
    scope,
    version: capture.version,
    rolledBackPartial,
    rollbackPartials: capture.rollbackPartials,
    entityErrorRow,
  });

  if (orchestrated) {
    // The typed Error remains the dispatch surface; `cause` is the formatted
    // text for callers that render it directly.
    return {
      ...classifyInstallFailure(err, formatOrchestratedCause(err), capture.rollbackPartials),
      ...movedMember(args.moved),
    };
  }

  // UPD-DEP-D1 / WR-01: the moves that landed before this failure stay, so
  // their rows report them beside it.
  notifyWithContext(
    ctx,
    run,
    CASCADE_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [failureMessage, ...movedRows(args.moved)],
      },
    ],
    undefined,
    "single",
  );
  // D-PL1-13 / D-PL1-24: only a standalone root failure reaches here; a
  // dependency's failure routes to `handleCascadeThrow`, so the shared
  // capture's warnings never render under the root's name.
  surfaceStagingDiagnostics(ctx, run, [
    { plugin, scope, verb: "install failed", warnings: capture.stagingWarnings ?? [] },
  ]);
  const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
  return {
    status: "failed",
    error: wrapped,
    cause: formatOrchestratedCause(err),
    ...movedMember(args.moved),
  };
}

/**
 * The failure an install's lock closure threw, composed into its failed
 * outcome. RESV-06: a dependency is what failed when the cascade recorded a
 * subject, so the block names it. Otherwise the single-row path reports the
 * requested plugin.
 *
 * GHB-03: an invalid GitHub base override fails the whole command,
 * unless the failed install left something behind that only its failed row
 * reports: a rollback partial, an MCP config rewrite (AFILE-04), or a
 * dependency move that landed (UPD-DEP-D1). Then the row is the report, and
 * its cause line still names the variable.
 */
export function handleCaughtInstallFailure(args: {
  readonly err: unknown;
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly rootKey: string;
  readonly capture: InstallFailureCapture;
  readonly cascadeFailure: CascadeFailureSink;
  readonly orchestrated: boolean;
  /** UPD-DEP-D1: the moves that landed before the failure. */
  readonly moved?: readonly MovedDependency[];
}): InstallPluginOutcome {
  const { err, capture, cascadeFailure, ...target } = args;
  if (
    capture.rollbackPartials.length === 0 &&
    cascadeFailure.mcpConfigNotices.length === 0 &&
    movedMember(args.moved).movedDependencies === undefined
  ) {
    rethrowInvalidGitHubBaseUrl(err);
  }

  const subject = cascadeFailure.subject;
  return subject !== undefined
    ? handleCascadeThrow({ ...target, subject })
    : handleInstallThrow({ ...target, err, capture });
}

/**
 * RESV-06 failure routing for a throw a DEPENDENCY caused.
 *
 * Distinct from `handleInstallThrow` in exactly one respect: the block it emits
 * names the failing dependency as its subject and carries the requesting
 * plugin's own row beside it, instead of reporting the requested plugin alone
 * for something it did not do. The outcome contract is unchanged -- the typed
 * Error stays the dispatch surface and `cause` stays the formatted text -- and
 * an orchestrated caller also gets the failed dependency's rollback partials,
 * as the single-plugin outcome carries its own (REC-06, D-PL6-04).
 */
function handleCascadeThrow(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly rootKey: string;
  readonly subject: CascadeFailureSubject;
  readonly orchestrated: boolean;
  readonly moved?: readonly MovedDependency[];
}): InstallPluginOutcome {
  const { ctx, run, marketplace, scope, plugin, rootKey, subject, orchestrated } = args;
  // Derived from the SUBJECT rather than from the caught value. The subject is
  // recorded only at a throw site that throws exactly this Error, so the two
  // agree by construction -- and reading it here means the outcome's typed
  // `error` needs no `unknown` widening a cascade arm can never produce.
  const error = cascadeFailureCause(subject, rootKey);
  const cause = formatOrchestratedCause(error);
  if (orchestrated) {
    return {
      status: "failed",
      error,
      cause,
      ...memberPartials(subject),
      ...movedMember(args.moved),
    };
  }

  const moved = movedRows(args.moved);
  notifyWithContext(
    ctx,
    run,
    CASCADE_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [
          ...composeCascadeFailureMessage({ scope, rootKey, rootName: plugin, subject, moved }),
          ...moved,
        ],
      },
    ],
    undefined,
    "single",
  );
  return { status: "failed", error, cause, ...movedMember(args.moved) };
}

/**
 * MIM-03 / D-PL6-04: the rollback partials a failed dependency left, present
 * only when its undo could not finish. The causes are raw; each consumer
 * redacts them before a row (D-PL6-12).
 */
function memberPartials(
  subject: CascadeFailureSubject,
): Pick<Extract<InstallPluginOutcome, { readonly status: "failed" }>, "rollbackPartials"> {
  return subject.kind === "member" && subject.rollbackPartials.length > 0
    ? { rollbackPartials: subject.rollbackPartials }
    : {};
}

/** UPD-DEP-D1: the rows of the dependencies an install moved into range. */
export function movedRows(
  moved: readonly MovedDependency[] | undefined,
): readonly UpdateDependencyRow[] {
  return (moved ?? []).map((entry) => entry.row);
}

/**
 * WR-2: the changes a dependency plan's steps landed, without the pin
 * refresh of a dependency the run after them re-enabled, which reports it.
 */
export function landedMoves(
  moved: readonly MovedDependency[] | undefined,
  members: readonly CascadeInstalledRow[],
): readonly MovedDependency[] | undefined {
  return moved === undefined
    ? undefined
    : supersedePinRefreshes(moved, new Set(members.map((member) => member.key)));
}

/**
 * WR-3: every dependency the run after a dependency plan installed or
 * re-enabled with the plugin, so an orchestrated caller lists each change
 * the install made. Present only after a plan, and only when one landed.
 */
export function dependencyInstallsMember(
  moved: readonly MovedDependency[] | undefined,
  members: readonly CascadeInstalledRow[],
  rootKey: string,
  softDeps: SoftDepStatus,
): { readonly dependencyInstalls?: readonly MovedDependency[] } {
  if (moved === undefined) {
    return {};
  }

  const installs = members
    .filter((member) => member.key !== rootKey)
    .map((member) => movedFromRow(composeCascadeMemberRow(member, softDeps)));
  return installs.length === 0 ? {} : { dependencyInstalls: installs };
}

/** D-PL10-16: one per-plugin diagnostic for every member that raised a note. */
export function cascadeStagingDiagnostics(
  members: readonly CascadeMemberOutcome[],
  scope: Scope,
): readonly StagingDiagnostic[] {
  return members.flatMap((member) =>
    member.discoveryWarnings === undefined
      ? []
      : [
          {
            plugin: member.name,
            scope,
            verb: "installed" as const,
            warnings: member.discoveryWarnings,
          },
        ],
  );
}

/** UPD-DEP-D1: the outcome member naming the moves, present only when one landed (NREG-01). */
export function movedMember(moved: readonly MovedDependency[] | undefined): {
  readonly movedDependencies?: readonly MovedDependency[];
} {
  return moved === undefined || moved.length === 0 ? {} : { movedDependencies: moved };
}

/**
 * FIX-03 / D-MF-02 and LAYER-06 / D-MF-03: only a standalone install is
 * refused, because only it writes a declaration. A reload or an import reads
 * its declarations from the configuration and is never refused.
 */
export function standaloneMarketplaceRefusal(
  opts: Pick<ResultInstallOptions, "notifications" | "marketplace">,
  selection: Parameters<typeof localOnlyMarketplaceRefusal>[0],
  state: ExtensionState,
): Extract<InstallTransactionOutcome, { kind: "refused" }> | undefined {
  if (opts.notifications?.mode === "orchestrated") {
    return undefined;
  }

  const localOnly = localOnlyMarketplaceRefusal(selection, opts.marketplace);
  if (localOnly !== undefined) {
    return { kind: "refused", refusal: localOnly, reason: "marketplace in local layer only" };
  }

  const undeclarable = undeclarableMarketplaceRefusal(selection, state, opts.marketplace);
  return undeclarable === undefined
    ? undefined
    : { kind: "refused", refusal: undeclarable, reason: "unsupported source" };
}

/**
 * LAYER-05 / D-MF-03: the plugin is installed once per scope, and each layer
 * may declare it. A standalone install into one layer of a plugin the user
 * installed by name, while only the other layer declares it, adds the
 * declaration to the target layer and installs nothing. The write also
 * declares the plugin's marketplace in the target layer when that layer lacks
 * it (LAYER-06). A version pin asks for more than a declaration, so it keeps
 * the already-installed failure, as it does for the promotion; a dependency
 * record goes to the promotion instead. No state is saved.
 */
export async function declareInstalledPlugin(args: {
  readonly opts: ResultInstallOptions;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly orchestrated: boolean;
  readonly selection: Extract<TargetLayers, { kind: "loaded" }>;
}): Promise<InstallTransactionOutcome | undefined> {
  const { opts, state, selection } = args;
  const { marketplace, plugin } = opts;
  const record = ownValue(ownValue(state.marketplaces, marketplace)?.plugins, plugin);
  if (
    args.orchestrated ||
    record?.provenance !== "explicit" ||
    opts.pinVersionOverride !== undefined ||
    pluginLayerVerdict({
      target: selection.current,
      other: selection.other,
      targetIsLocal: selection.targetIsLocal,
      marketplace,
      plugin,
    }).kind !== "other-only"
  ) {
    return undefined;
  }

  await writeAdoptingConfigEntries({
    current: selection.current,
    other: selection.other,
    state,
    marketplace,
    plugin,
    locations: args.locations,
    targetIsLocal: selection.targetIsLocal,
    pluginPatch: {},
  });
  return {
    kind: "declared",
    record,
    reason: selection.targetIsLocal
      ? "already installed in base layer"
      : "already installed in local layer",
  };
}

/**
 * LAYER-05: the one `(skipped)` row of an install that only added a
 * declaration, at the severity `skipSeverity` gives an idempotent reason. The
 * outcome is the `installed` shape a promotion of a record on disk returns:
 * nothing changed on disk but the target layer.
 */
export function declaredRowOutcome(args: {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly record: PluginInstallRecord;
  readonly reason: "already installed in base layer" | "already installed in local layer";
}): InstallPluginOutcome {
  const { record } = args;
  const reasons: ContentReason[] = [args.reason];
  notifyWithContext(
    args.ctx,
    args.run,
    CASCADE_CONTEXT,
    [
      {
        name: args.marketplace,
        scope: args.scope,
        plugins: [
          {
            status: "skipped",
            name: args.plugin,
            version: record.version,
            reasons,
            severity: skipSeverity(reasons),
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  return {
    status: "installed",
    version: record.version,
    resourcesChanged: false,
    declaresAgents: record.resources.agents.length > 0,
    declaresMcp: record.resources.mcpServers.length > 0,
    declaresWorkflows: record.resources.workflows.length > 0,
  };
}

/**
 * Outcome of the `withLockedStateTransaction` closure in
 * `installPluginWithTransaction`, mirroring the `SetEnabledOutcome` pattern
 * `enable-disable.ts` uses for its own locked-transaction closure: one typed
 * return instead of several `let`/`const` captures the closure writes to and
 * the post-guard code reads back out, so a forgotten arm is a compile error
 * rather than a runtime `undefined`.
 *
 * - `"invalid-config"` -- WB-01 / CFG-03 / T-56-03-04: the targeted config
 *   (or, on the flagless path, the local config) could not be read.
 *   `configBasename`, set by the closure as a side effect for the same
 *   reason `enable-disable.ts` keeps its own copy of that `let` (T-53-02-02),
 *   carries the file name for the failed row composed after the lock closes.
 * - `"marketplace-absent"` -- ATTR-01 / ATTR-08 / M1: marketplace-existence
 *   is a PRECONDITION, not a plugin-row property. The CMP-2..4 source
 *   resolution missed (the marketplace is absent in the target scope AND the
 *   CMP-3 user fallback also missed), so the failure subject is the
 *   MARKETPLACE, not the plugin -- distinct from M2 (plugin absent from a
 *   PRESENT manifest), which stays `{not in manifest}` on the plugin row.
 * - `"refused"` -- the standalone write could not declare the plugin's
 *   marketplace correctly: FIX-03 / D-MF-02, the plugin would land in
 *   `claude-plugins.json` under a marketplace only `claude-plugins.local.json`
 *   declares; or LAYER-06 / D-MF-03, the target layer lacks the marketplace
 *   and no source is known to declare it there with. Nothing ran and nothing
 *   is saved.
 * - `"declared"` -- LAYER-05: the plugin was already installed by name and
 *   only the other layer declared it, so the target layer gained the
 *   declaration and nothing else ran or was saved.
 * - `"promoted"` -- D-04-07: a recorded dependency the user has now named was
 *   promoted instead of cascaded. State was saved and any hooks hydrated
 *   inside the lock; the row, then any MCP config notice, is the whole report.
 * - `"disable-cascade-failed"` -- D-102-02: the ledger succeeded and landed
 *   disabled (DFEN-04), then the disable cascade itself failed. The shrunken
 *   record is already saved inside the lock; `cause` is the cascade's own
 *   error, surfaced as the existing install failure row.
 * - `"installed"` -- the realized install. `landedDisabled` is the DFEN-04 /
 *   D-102-01 verdict: true when the plugin installed with `enabled: false`
 *   because the caller opted in, both physical config files were silent on
 *   `enabled`, and the plugin's own resolved declaration says false.
 *   `members` and `alreadyInstalled` are the cascade's closure (RESV-06), one
 *   row each in the post-guard block; both are empty for a plugin that
 *   declares nothing, so its block stays the single row it always was.
 */
export type InstallTransactionOutcome =
  | { kind: "invalid-config" }
  | { kind: "dependency-moves" }
  | { kind: "marketplace-absent" }
  | {
      kind: "refused";
      refusal: MarketplaceInLocalLayerOnlyError | MarketplaceSourceUndeclarableError;
      reason: "marketplace in local layer only" | "unsupported source";
    }
  | {
      kind: "declared";
      record: PluginInstallRecord;
      reason: "already installed in base layer" | "already installed in local layer";
    }
  | { kind: "promoted"; promotion: PromotionOutcome }
  | {
      kind: "disable-cascade-failed";
      cause: Error;
      mcpConfigNotices: readonly McpConfigNotice[];
    }
  | {
      kind: "installed";
      installCtx: InstallLedgerSummary;
      landedDisabled: boolean;
      members: readonly CascadeMemberOutcome[];
      alreadyInstalled: readonly CascadeSkippedMember[];
      mcpConfigNotices: readonly McpConfigNotice[];
    };
