// orchestrators/plugin/reinstall-flow.ts
//
// PRL-02/03/04/05/06/07/08/09/10/11/12/13/14/15 reinstall core.
// Single-plugin (PRL-02/06/07/08/09/10/11/12) and bulk reinstall
// (PRL-03/04/05/13/14/15) are both implemented here.
//
// Reinstall is deliberately NOT uninstall+install and NOT update:
// it targets an already-installed plugin, reads the cached marketplace
// manifest only, preserves the installed record's version/installedAt, prepares
// every bridge before physical replacement, then rolls physical resources back
// if replacement or explicit state persistence fails.
//
// Each orchestration arm emits exactly one `notify(ctx, pi, ...)` call.
// notify() owns severity, the reload-hint trailer, and the cause-chain.
// Manual-recovery rows are folded into the cascade `plugins[]` array as
// `PluginManualRecoveryMessage` entries rather than emitted separately.
// D-141-03 / D-141-05: the four bridges' staging warnings are split, not
// folded flat. The skills and commands halves are DISCOVERY warnings and
// reach both modes. The agents and mcp halves are hygiene warnings and stay
// orchestrated-only beside the maintenance warnings, because
// MarketplaceNotificationMessage has no field for one and a standalone user
// has nothing to do about it (D-19-01, unchanged). The underlying side
// effects (dropMarketplaceCache + rm) run either way, and the internal
// `notes` field on `ReinstallPluginOutcome` carries every half for
// orchestrated-mode consumers.
//
// The discovery diagnostic is emitted by whichever function renders the row
// it qualifies, always after that row. The USER-INVOKED entrypoint reaches
// `reinstallPlugins`: the edge handler calls it for every target form, and it
// drives `reinstallPlugin` with `render: "none"` and renders the cascade
// itself, so `reinstallPlugins` is the emitter for a user-invoked reinstall;
// it reads the `discoveryWarnings` field the `render: "none"` arm puts on
// each reinstalled outcome. The self-rendering `render !== "none"` arm emits
// no discovery diagnostic at all -- no production caller reaches it, so it
// carries no copy of the call to drift out of step with this one. Its
// outcomes also leave `discoveryWarnings` undefined, which is a separate
// fact: it is what would keep `surfaceReinstallDiscoveryWarnings` from
// double-rendering, not the reason that arm is silent.
//
// `reconcile/backfill.ts` is the other production caller -- `render: "none"`
// too, reached from `resources_discover` -> `applyReconcile`. It consumes the
// outcome without rendering EITHER half: `PluginBackfilledOutcome` carries no
// warnings field, and `reconcile/apply.ts::surfacePostCommitWarnings` renders
// only the `plugin-installed`/`plugin-disabled` arms. So a reconcile-driven
// re-materialize of a colliding plugin reports nothing while a
// reconcile-driven INSTALL of the same plugin reports it. Tracked as part of
// BACKLOG UPCASC-01 (decide the cascade rendering once).

import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requirePartialInstallable, resolveStrict } from "../../domain/plugin-resolver.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { clonePluginRecord, isRecordedButDisabled } from "../../persistence/state-io.ts";
import { composeErrorWithCauseChain, errorWithManualRecovery } from "../../shared/errors.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type PluginFailedMessage,
  type PluginManualRecoveryMessage,
  type PluginNotificationMessage,
  type PluginReinstalledMessage,
  type PluginSkippedMessage,
} from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { skipSeverity } from "../../shared/notify-reasons.ts";
import {
  type LockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../auth-host.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import { probeReinstallClone } from "./reinstall-clone-probe.ts";
import { recordReinstallOutcome, reinstallReasonsFromError } from "./reinstall-record.ts";
import { REAL_REINSTALL_TRANSACTION } from "./reinstall-replace.ts";
import { selectReinstallTargets } from "./reinstall-targets.ts";
import {
  REINSTALL_CONTEXT,
  narrowReasons,
  reinstalledRowFromOutcome,
  renderReinstallPartitionAndNotify,
} from "./reinstall.messaging.ts";
import {
  assertNoCrossPluginConflicts,
  emitMarketplaceNotAddedSignal,
  MarketplaceNotAddedSignal,
  maybeWritePluginConfigBack,
  removePluginRecord,
  surfaceDiscoveryWarnings,
} from "./shared.ts";

import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { ReinstallFailedOutcome, ReinstallPluginOutcome } from "../types.ts";
import type { ReinstallCloneCacheSeam } from "./reinstall-clone-probe.ts";
import type {
  ReinstallMaintenanceInput,
  ReinstallTransaction,
  RemoveDataDirFn,
} from "./reinstall-replace.ts";
import type { ReinstallPluginsTarget, SelectedReinstallTarget } from "./reinstall-targets.ts";

/** Hook-routing capabilities consumed by committed reinstall finalization. */
export type ReinstallHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/** Test seams threaded through the public reinstall flow. */
export interface ReinstallPluginDeps {
  readonly stateTransaction?: LockedStateTransactionDeps;
  readonly removeDataDir?: RemoveDataDirFn;
  readonly cloneCacheSeam?: ReinstallCloneCacheSeam;
}

/** Complete inputs for one installed plugin reinstall. */
export interface ReinstallPluginOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly render?: "default" | "none";
  readonly local?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly __deps?: ReinstallPluginDeps;
}

/** Complete inputs for targeted or bulk plugin reinstall. */
export interface ReinstallPluginsOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: ReinstallPluginsTarget;
  readonly local?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly __deps?: ReinstallPluginDeps;
}

/** One plugin reinstall bound to a transaction and lifecycle routing owner. */
export type ReinstallPluginFn = (
  options: ReinstallPluginOptions,
) => Promise<ReinstallPluginOutcome>;

/** Direct/bulk reinstall operation bound to one lifecycle routing owner. */
export type ReinstallPluginsFn = (
  options: ReinstallPluginsOptions,
) => Promise<readonly ReinstallPluginOutcome[]>;

/** Named leaf owners bound by the public reinstall flow composition root. */
interface ReinstallFlowOwners {
  readonly probeReinstallClone: typeof probeReinstallClone;
  readonly recordReinstallOutcome: typeof recordReinstallOutcome;
  readonly reinstallReasonsFromError: typeof reinstallReasonsFromError;
  readonly selectReinstallTargets: typeof selectReinstallTargets;
}

const REINSTALL_FLOW_OWNERS: ReinstallFlowOwners = {
  probeReinstallClone,
  recordReinstallOutcome,
  reinstallReasonsFromError,
  selectReinstallTargets,
};

/** Binds one reinstall operation to a required semantic transaction owner. */
export function createReinstallPlugin(
  transaction: ReinstallTransaction,
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return (options) =>
    reinstallPluginWithTransaction(
      REINSTALL_FLOW_OWNERS,
      transaction,
      hooksRouting,
      completionCache,
      options,
    );
}

/** Binds one production reinstall to the real transaction and supplied routing owner. */
export function createNodeReinstallPlugin(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
}

/** Binds direct and bulk production reinstall to one lifecycle routing owner. */
export function createNodeReinstallPlugins(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginsFn {
  const reinstallPlugin = createNodeReinstallPlugin(hooksRouting, completionCache);
  return (options) => reinstallPluginsWith(REINSTALL_FLOW_OWNERS, options, reinstallPlugin);
}

interface LockedSuccess {
  readonly outcome: ReinstallPluginOutcome;
  /**
   * D-141-03: the skills and commands halves of the staging warnings. These
   * reach BOTH modes -- mirrors install's two-array `InstallCtx` shape.
   */
  readonly discoveryWarnings: readonly string[];
  /**
   * The agents and mcp halves, plus the `finalizeReplacements` leak strings.
   * Orchestrated-only per D-19-01.
   */
  readonly bridgeWarnings: readonly string[];
  /**
   * S5: when the config-back loadConfig returned `invalid`, the write-back
   * was skipped while the success notify proceeded. The single-plugin caller
   * surfaces this as a separate warning row AFTER the reinstall success row
   * so the user knows the on-disk artifacts were reinstalled but the config
   * entry was not written.
   */
  readonly invalidConfigWriteBack?: boolean;
}

// ATTR-03 / D-47-A: the structural marketplace-not-added signal thrown by the
// reinstall target enumerator is the shared `MarketplaceNotAddedSignal` from
// `./shared.ts` (one source of truth so `instanceof` agrees with update.ts).
// The `reinstallPlugins` enumeration catch detects it via `instanceof` and
// emits ONE standalone `MarketplaceNotAddedMessage` before any cascade row.

/** Runs one reinstall through the retained transaction and notification sequence. */
async function reinstallPluginWithTransaction(
  owners: ReinstallFlowOwners,
  transaction: ReinstallTransaction,
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
  opts: ReinstallPluginOptions,
): Promise<ReinstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const render = opts.render ?? "default";
  const locations = locationsFor(scope, cwd);

  let locked: LockedSuccess;
  try {
    locked = await transaction.withLockedStateTransaction(
      locations,
      (tx) => runLockedReinstall(owners, transaction, hooksRouting, tx, locations, opts),
      opts.__deps?.stateTransaction,
    );
  } catch (err) {
    return handleSinglePluginFailure(owners, opts, err as Error, render);
  }

  if (locked.outcome.partition !== "reinstalled") {
    // CR-02 / D-01: the standalone single-plugin path must emit the absent-target
    // row, not return silently. A `skipped` partition is the "not installed" case
    // D-01 targets -> error; other skip reasons fall back to `skipSeverity`.
    // Mirrors the bulk `outcomeToPluginMessage` skipped arm.
    if (render !== "none") {
      const reasons = narrowReasons(locked.outcome.notes);
      const skippedRow: PluginSkippedMessage = {
        status: "skipped",
        name: plugin,
        reasons,
        severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
        needsReload: false,
      };
      notifyWithContext(
        ctx,
        pi,
        REINSTALL_CONTEXT,
        [{ name: marketplace, scope, plugins: [skippedRow] }],
        undefined,
        "single",
      );
    }

    return locked.outcome;
  }

  const maintenanceWarnings = await transaction.runPostSuccessMaintenance(
    maintenanceInput(opts),
    locations,
    completionCache,
  );
  if (render === "none") {
    const notes = [
      ...locked.discoveryWarnings,
      ...locked.bridgeWarnings,
      ...maintenanceWarnings,
    ].map((w) => `warning: ${w}`);
    if (notes.length === 0) {
      return locked.outcome;
    }

    // A non-empty `discoveryWarnings` always makes `notes` non-empty, so the
    // early return above cannot drop the carrier. NREG-01: both keys stay
    // absent on a clean reinstall.
    return {
      ...locked.outcome,
      notes,
      ...(locked.discoveryWarnings.length > 0 && {
        discoveryWarnings: locked.discoveryWarnings,
      }),
    };
  }

  // IN-01 / D-19-01: the HYGIENE warnings (bridge + maintenance) are NOT
  // surfaced -- there is no clean MarketplaceNotificationMessage
  // representation for a post-success soft warning. The underlying side
  // effects (cache drop + data-dir rm + bridge finalize) still fire above;
  // the orchestrated-mode `notes` field at the `render === "none"` arm still
  // carries the warning strings for consumers outside the notify path.
  // `maintenanceWarnings` is awaited strictly for its side effects. The
  // DISCOVERY warnings are the D-141-03 exception, but this arm does not
  // render them either: no production caller reaches it, and
  // `reinstallPlugins` already renders them after the cascade row for the
  // `render: "none"` arm every caller does reach.

  // Single-plugin reinstall success is a 1-row cascade carrying a
  // PluginReinstalledMessage variant; this branch and the bulk-cascade branch
  // both emit one notify() call with structured payloads. The `/reload to pick
  // up changes` trailer is computed by notify() -- the `reinstalled` status is
  // in the state-changing variant set, so the reload-hint always fires here.
  //
  // WR-09: the ONE row composer, shared with the bulk cascade mapper. Two
  // reinstall surfaces disagreeing about a degrade the same ledger produced is
  // the drift the shared signal exists to close, so neither surface composes the
  // row itself -- including its severity, which the composer raises to `warning`
  // for a degraded component. `undefined` is the orphan-fold scope decision this
  // branch always makes: the row's scope matches its marketplace block.
  const reinstalledRow: PluginReinstalledMessage = reinstalledRowFromOutcome(
    locked.outcome,
    undefined,
  );
  notifyWithContext(
    ctx,
    pi,
    REINSTALL_CONTEXT,
    [{ name: marketplace, scope, plugins: [reinstalledRow] }],
    undefined,
    "single",
  );

  // S5: when the config write-back loadConfig returned `invalid`, emit a
  // separate warning row so the user sees that the on-disk artifacts were
  // reinstalled but the config entry was not written. Pre-S5 this arm
  // silently dropped the warning while the success notify proceeded.
  if (locked.invalidConfigWriteBack === true) {
    const targetBasename = path.basename(
      opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath,
    );
    notifyWithContext(
      ctx,
      pi,
      REINSTALL_CONTEXT,
      [
        {
          name: marketplace,
          scope,
          plugins: [
            {
              status: "failed",
              name: plugin,
              reasons: ["invalid manifest"] as const,
              cause: new Error(`Config file "${targetBasename}" failed schema validation.`),
              // D-03/D-06: invalid config write-back -> error, no reload.
              severity: "error" as const,
              needsReload: false,
            },
          ],
        },
      ],
      undefined,
      "single",
    );
  }

  return locked.outcome;
}

function maintenanceInput(opts: ReinstallPluginOptions): ReinstallMaintenanceInput {
  return {
    scope: opts.scope,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
    ...(opts.__deps?.removeDataDir !== undefined && {
      removeDataDir: opts.__deps.removeDataDir,
    }),
  };
}

/**
 * handle the single-plugin reinstall failure path. Extracted
 * from `reinstallPlugin` to keep that function's cognitive complexity
 * inside the sonarjs/cognitive-complexity ceiling (15). Produces both
 * the standalone-mode notify emission (when render !== "none") and
 * the orchestrated-mode `ReinstallFailedOutcome` (always returned).
 *
 * Manual-recovery class is a STRUCTURAL plugin variant
 * (`PluginManualRecoveryMessage`); other failures are
 * `PluginFailedMessage`. Severity + reload-hint computed by notify
 * .
 */
function handleSinglePluginFailure(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginOptions,
  err: Error,
  render: "default" | "none",
): ReinstallFailedOutcome {
  const { ctx, pi, scope, marketplace, plugin } = opts;
  const outcome = owners.recordReinstallOutcome({
    partition: "failed",
    name: plugin,
    marketplace,
    scope,
    error: err,
  });

  const causeErr = err;
  const typedReasons = outcome.reasons;
  const isManualRecovery = outcome.failureClass === "manual-recovery";
  const reasons: readonly ContentReason[] = isManualRecovery
    ? (["rollback partial"] as const)
    : (typedReasons ?? narrowReasons(outcome.notes));

  if (render !== "none") {
    // Per-row scope is OMITTED (orphan-fold) since it matches the
    // marketplace block's scope at this single-plugin surface.
    const failureRow: PluginNotificationMessage = isManualRecovery
      ? ({
          status: "manual recovery",
          name: plugin,
          reasons,
          cause: causeErr,
          // D-03/D-06: manual-recovery anchor is always actionable -> warning,
          // no reload.
          severity: "warning",
          needsReload: false,
        } satisfies PluginManualRecoveryMessage)
      : ({
          status: "failed",
          name: plugin,
          reasons,
          cause: causeErr,
          // D-03/D-06: a failed reinstall -> error, no reload.
          severity: "error",
          needsReload: false,
        } satisfies PluginFailedMessage);
    notifyWithContext(
      ctx,
      pi,
      REINSTALL_CONTEXT,
      [{ name: marketplace, scope, plugins: [failureRow] }],
      undefined,
      "single",
    );
  }

  return outcome;
}

/** Runs target selection, per-plugin reinstalls, and exact cascade rendering. */
async function reinstallPluginsWith(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginsOptions,
  reinstallPlugin: ReinstallPluginFn,
): Promise<readonly ReinstallPluginOutcome[]> {
  const { ctx, pi, cwd } = opts;
  let selection: {
    readonly cardinality: "single" | "plural";
    readonly targets: readonly SelectedReinstallTarget[];
  };
  try {
    selection = await owners.selectReinstallTargets({
      cwd,
      target: opts.target,
      ...(opts.scope !== undefined && { scope: opts.scope }),
    });
  } catch (err) {
    // Enumeration failures occur before the selector can return, so preserve
    // invocation-form cardinality at this error-projection boundary.
    const cardinality = opts.target.kind === "plugin" ? "single" : "plural";
    await handleEnumerationFailure(owners, opts, err as Error, cardinality);
    return [];
  }

  const { cardinality, targets } = selection;

  if (targets.length === 0) {
    // Empty-targets renders as the `(no marketplaces)` sentinel via
    // `{ marketplaces: [] }`. The structural shape carries no "(no plugins)"
    // sentinel at the top-level / standalone-cascade boundary; the closest
    // analog is the list-surface `(no marketplaces)` rendering. Severity:
    // undefined (info).
    notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [], undefined, cardinality);
    return [];
  }

  const outcomes: ReinstallPluginOutcome[] = [];
  // OUT-04 / D-04: the structural single-vs-plural cardinality is the invocation
  // FORM -- a `<plugin>@<mp>` target is single-target (omits the tally), while
  // the `@<marketplace>` and bare forms are bulk (emit the tally).
  // D-79-02: ONE once-per-host memo spans the whole bulk loop so a cold-cache
  // sweep over several private plugins on the same host runs the device flow
  // at most once (the same bulk-storm guard install/update use).
  const authMemo = new Map<string, AuthAttemptResult>();
  for (const target of targets) {
    outcomes.push(
      await reinstallPlugin({
        ctx,
        pi,
        scope: target.scope,
        cwd,
        marketplace: target.marketplace,
        plugin: target.plugin,
        render: "none",
        ...(opts.local === true && { local: true }),
        ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        authMemo,
        ...(opts.__deps !== undefined && { __deps: opts.__deps }),
      }),
    );
  }

  renderReinstallPartitionAndNotify(ctx, pi, outcomes, cardinality);
  surfaceReinstallDiscoveryWarnings(ctx, outcomes);
  return Object.freeze(outcomes);
}

/**
 * D-141-03 / D-141-05: render each reinstalled plugin's discovery warnings
 * after the cascade its row lives in -- the user reads the row, then the
 * detail that qualifies it. Mirrors `update.ts::surfaceUpdateDiscoveryWarnings`.
 *
 * This loop, not the `render !== "none"` arm of `reinstallPlugin`, is what a
 * user-invoked reinstall reaches: the edge handler calls `reinstallPlugins`
 * for every target form, and this function drives `reinstallPlugin` with
 * `render: "none"`.
 *
 * The hygiene half never arrives here: only the DISCOVERY half rides
 * `discoveryWarnings`, while `notes` keeps the flat fold for orchestrated
 * consumers.
 */
function surfaceReinstallDiscoveryWarnings(
  ctx: NotificationContext,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  for (const outcome of outcomes) {
    if (outcome.partition !== "reinstalled" || outcome.discoveryWarnings === undefined) {
      continue;
    }

    surfaceDiscoveryWarnings(ctx, {
      plugin: outcome.name,
      verb: "reinstalled",
      warnings: outcome.discoveryWarnings,
    });
  }
}

/**
 * Emit the single `notify()` call for a target-enumeration failure. Extracted
 * from `reinstallPlugins` to keep that function's cognitive complexity inside
 * the sonarjs ceiling.
 *
 * Two arms:
 *   - ATTR-03 / D-47-A marketplace-not-added: the enumerator raised the
 *     structural `MarketplaceNotAddedSignal` (instead of synthesizing a phantom
 *     target or throwing a raw `MarketplaceNotFoundError`/`Error`). Delegated to
 *     the shared `emitMarketplaceNotAddedSignal`, which update drives with ITS
 *     context off the same signal -- one emitter, so the SCOPE-01 plugin row
 *     and the `{marketplace not added}` marketplace row cannot drift between
 *     the two verbs.
 *   - Any other enumeration failure: the legacy synthetic `(reinstall)` failed
 *     row. The failed entity is the targeting layer (no specific plugin), so
 *     the row carries a placeholder name `"(reinstall)"` under a synthetic
 *     marketplace name derived from the target (or `"(reinstall)"` for the
 *     bare-all form). A synthetic `PluginFailedMessage` carries the cause-chain
 *     trailer (marketplace-level rows carry no cause per SNM-10). Severity
 *     (`error`) + no reload-hint are computed by notify().
 */
async function handleEnumerationFailure(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginsOptions,
  err: Error,
  cardinality: "single" | "plural",
): Promise<void> {
  const { ctx, pi, cwd } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    await emitMarketplaceNotAddedSignal({
      ctx,
      pi,
      cwd,
      context: REINSTALL_CONTEXT,
      cardinality,
      err,
    });
    return;
  }

  const typedReasons = owners.reinstallReasonsFromError(err);
  const reasons: readonly ContentReason[] =
    typedReasons ?? narrowReasons([composeErrorWithCauseChain(err)]);
  const causeErr = err;
  const targetingScope = opts.scope ?? "user";
  const targetingMp = opts.target.kind === "all" ? "(reinstall)" : opts.target.marketplace;
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: "(reinstall)",
    reasons,
    cause: causeErr,
    // D-03/D-06: bare-form reinstall enumerate failure -> error, no reload.
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(
    ctx,
    pi,
    REINSTALL_CONTEXT,
    [{ name: targetingMp, scope: targetingScope, plugins: [failedRow] }],
    undefined,
    cardinality,
  );
}

/**
 * Typed-dispatch narrow for thrown errors captured by the reinstall catch
 * sites. Mirrors the
 * `orchestrators/marketplace/remove.ts::narrowCascadeFailure` pattern:
 * check the typed `PluginShapeError` / `ManualRecoveryError` shape first, then errno codes
 * (`EACCES`/`EPERM` -> permission denied; `ENOENT`/`ENOTDIR` ->
 * source missing), and only at the bottom fall through to `undefined`
 * (NOT a misleading closed-set member). When `undefined` is returned,
 * the consumer (`outcomeToPluginMessage`) falls back to the
 * `narrowReasons(notes)` substring parse.
 *
 * Returning `undefined` for unknown shapes is deliberate: the consumer
 * has more context (the full `notes` array) and may extract a better
 * Reason via substring matching. Forcing a default Reason here would
 * shadow that fallback.
 */
async function runLockedReinstall(
  owners: ReinstallFlowOwners,
  transaction: ReinstallTransaction,
  hooksRouting: ReinstallHooksRouting,
  tx: LockedStateTransaction,
  locations: ScopedLocations,
  opts: ReinstallPluginOptions,
): Promise<LockedSuccess> {
  const { scope, cwd, marketplace, plugin } = opts;
  const mp = tx.state.marketplaces[marketplace];
  const oldRecord = mp?.plugins[plugin];
  if (mp === undefined || oldRecord === undefined) {
    return {
      outcome: owners.recordReinstallOutcome({
        partition: "skipped",
        name: plugin,
        marketplace,
        scope,
        reason: "not installed",
      }),
      discoveryWarnings: [],
      bridgeWarnings: [],
    };
  }

  // ENBL-05: a record carrying an explicit `enabled: false` marker is the
  // user's standing instruction, read through the single predicate
  // `persistence/state-io.ts` owns so this site cannot drift from `update`'s.
  // Re-materializing under it would restore the plugin's hooks, MCP servers and
  // PATH entries with no command and no prompt, and the record write below
  // would turn the plugin back on while the configuration still says otherwise.
  //
  // The counterpart branch in `update` refreshes the record's pin before it
  // returns; this one refreshes NOTHING and returns before the resolve, because
  // reinstall preserves the recorded version (D-68-02) and carries the recorded
  // git identity forward (PURL-07) -- there is no pin for it to move, so there
  // is nothing a re-resolve could truthfully write. ENBL-18: the record keeps
  // its `resources.*` inventory while disabled, so a populated inventory is not
  // evidence that anything is on disk and must not be read as one.
  if (isRecordedButDisabled(oldRecord)) {
    return {
      outcome: owners.recordReinstallOutcome({
        partition: "skipped",
        name: plugin,
        marketplace,
        scope,
        reason: "already disabled",
      }),
      discoveryWarnings: [],
      bridgeWarnings: [],
    };
  }

  const oldSnapshot = clonePluginRecord(oldRecord);
  const entry = await loadCachedEntry(mp.manifestPath, marketplace, plugin);
  const installable = await resolveInstallable(owners, {
    entry,
    marketplaceRoot: mp.marketplaceRoot,
    locations,
    recordedSha: oldSnapshot.resolvedSha,
    ...(opts.__deps?.cloneCacheSeam !== undefined && {
      seam: opts.__deps.cloneCacheSeam,
    }),
    ctx: opts.ctx,
    credentialOps: opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
  });
  const generated = await discoverGeneratedNames(plugin, installable);
  assertNoCrossPluginConflicts(
    scope,
    { skills: generated.skills, commands: generated.commands, agents: generated.agents },
    removePluginRecord(tx.state, marketplace, plugin),
  );

  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const replacement = await transaction.replaceReinstalledPlugin(
    {
      locations,
      cwd,
      marketplace,
      plugin,
      installable,
      pluginDataDir,
      oldRecord: oldSnapshot,
      agentsDirs: generated.agentsDirs,
    },
    transaction.replaceOperations,
  );

  let invalidConfigWriteBack: boolean;
  let outcome: ReinstallPluginOutcome;
  try {
    outcome = owners.recordReinstallOutcome({
      partition: "reinstalled",
      name: plugin,
      marketplace,
      scope,
      state: tx.state,
      oldRecord: oldSnapshot,
      installable,
      handles: replacement.handles,
      hookEntries: replacement.hookEntries,
    });

    // WB-01 / A7: deep-equal short-circuit preserves RECON-05
    // mtime invariant. Reinstall is invoked by the user (both standalone and
    // bulk-cascade paths are user-initiated); there is no orchestrated /
    // reconcile-driven caller today. The deep-equal gate compares the
    // prospective `{...existing, ...patch}` shape against the existing
    // entry; a byte-stable patch (the common reinstall case -- entry shape
    // unchanged) leaves the config file untouched.
    const writeResult = await maybeWritePluginConfigBack({
      locations,
      marketplace,
      plugin,
      local: opts.local === true,
    });
    invalidConfigWriteBack = writeResult.invalidConfig;

    await tx.save();

    // WR-06 + WR-03 + D-60-05: reinstall does NOT delegate to install/
    // uninstall, so the parsed-config cache + routing table would
    // otherwise stay pinned to the OLD plugin's hooks config (or be
    // entirely absent if the previous install pre-dated the bridge).
    // Mirror the install / uninstall pattern explicitly inside the
    // per-plugin lock: drop the old cache entry, re-populate from the
    // just-installed `hooks.json` (when present), then rebuild the
    // routing table once.
    //
    // Moved AFTER `tx.save()` so a write-back throw or a tx.save throw
    // aborts BEFORE the cache mutates -- otherwise a phantom routing
    // entry survives a closure throw and the next dispatch fires against
    // a record state.json never wrote.  Post-save semantics are safe:
    // state.json now matches in-memory state, and the next `/reload`'s
    // factory-time hydrate (D-59-03) rebuilds the cache from disk.
    // Synchronous + zero disk I/O per DISP-02; the readFile/parse path
    // is the same defensive shape `install-outcome.ts` uses (failures route
    // through the hooks helper's debug log and the next `/reload` rehydrates).
    //
    // WR-03: post-`tx.save()` cache+routing mutations are non-fatal --
    // mirrors install-flow.ts's WR-02. A throw here would surface as
    // `(manual recovery)` while state.json already persisted the new
    // record (state divergence). `/reload`'s factory-time hydrate
    // (D-59-03) rebuilds the cache from state.json. Failures route
    // through the hooks helper's debug log.
    hooksRouting.removePluginConfigFromCache(scope, marketplace, plugin);
    if (installable.hooksConfigPath !== undefined) {
      await hooksRouting.readAndCachePluginHooks({
        scope,
        marketplace,
        plugin,
        resolvedSource: asAbsolutePluginRoot(installable.pluginRoot),
        hooksJsonPath: path.join(installable.pluginRoot, installable.hooksConfigPath),
        cwd,
        logPrefix: "reinstall",
      });
    }

    hooksRouting.rebuildRoutingTables();
  } catch (err) {
    throw errorWithManualRecovery(err, await transaction.rollbackReinstalledPlugin(replacement));
  }

  const bridgeWarnings = [
    ...replacement.bridgeWarnings,
    ...(await transaction.finalizeReinstalledPlugin(replacement)),
  ];
  return {
    outcome,
    discoveryWarnings: replacement.discoveryWarnings,
    bridgeWarnings,
    ...(invalidConfigWriteBack && { invalidConfigWriteBack: true }),
  };
}

async function loadCachedEntry(
  manifestPath: string,
  marketplace: string,
  plugin: string,
): Promise<PluginEntry> {
  const manifest = await loadMarketplaceManifest(manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    throw new Error(
      `Plugin "${plugin}" not found in cached manifest for marketplace "${marketplace}".`,
    );
  }

  return entryRaw;
}

// BFILL-01 / D-68-02: reinstall is partial-capable. It resolves through the
// `requirePartialInstallable` gate (admitting both `installable` and the
// partially-available arm) so backfill can re-materialize a
// still-partial plugin in place without throwing `{not-installable}`. The
// `unavailable` arm is still rejected (NFR-7). Resolution stays cache-only via
// `resolveStrict` -- no network (NFR-5).
//
// PURL-07 / D-78-02: for a git source (url / git-subdir / github) with a
// recorded sha, inject the recorded-sha probe so the git plugin re-materializes
// offline from the warm cache. A path source (or a git record predating the
// resolvedSha field) keeps the existing no-callback resolveStrict path.
async function resolveInstallable(
  owners: ReinstallFlowOwners,
  input: {
    readonly entry: PluginEntry;
    readonly marketplaceRoot: string;
    readonly locations: ScopedLocations;
    readonly recordedSha: string | undefined;
    readonly seam?: ReinstallCloneCacheSeam;
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): Promise<MaterializablePlugin> {
  const parsedSource = parsePluginSource(input.entry.source);
  const isGitSource =
    parsedSource.kind === "url" ||
    parsedSource.kind === "git-subdir" ||
    parsedSource.kind === "github";
  const recordedSha = input.recordedSha;

  const resolveGitPluginRoot =
    isGitSource && recordedSha !== undefined
      ? (source: GitBackedSource) =>
          owners.probeReinstallClone({
            source,
            locations: input.locations,
            recordedSha,
            ...(input.seam !== undefined && { seam: input.seam }),
            auth: {
              ctx: input.ctx,
              credentialOps: input.credentialOps,
              ...(input.deviceFlowHttp !== undefined && { deviceFlowHttp: input.deviceFlowHttp }),
              ...(input.authMemo !== undefined && { authMemo: input.authMemo }),
            },
          })
      : undefined;

  const resolved = await resolveStrict(input.entry, {
    marketplaceRoot: input.marketplaceRoot,
    ...(resolveGitPluginRoot !== undefined && { resolveGitPluginRoot }),
  });
  requirePartialInstallable(resolved, "install");
  return resolved;
}
