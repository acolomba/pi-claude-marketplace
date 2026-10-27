// orchestrators/plugin/reinstall-flow.ts
//
// PRL-02..PRL-15 reinstall, single-plugin and bulk. This module owns target
// selection, the `not installed` failure, the `already disabled` skip, the named-layer
// refusal, the post-success maintenance, and messaging. The materialization
// is the shared runner `materialize-latest.ts` that `update` runs too, under
// reinstall's policy (UPR-01, D-18-02..D-18-10). So a reinstall installs the
// version the marketplace offers now and records it (REI-04, D-18-08).
//
// Each orchestration arm emits exactly one `notify(ctx, run, ...)` call.
// notify() owns severity, the reload-hint trailer, and the cause-chain.
// Manual-recovery rows are folded into the cascade `plugins[]` array as
// `PluginManualRecoveryMessage` entries rather than emitted separately.
// D-141-03 / D-PL1-11: the shared swap carries both halves of the staging
// warnings, typed, on its `stagingWarnings` (D-PL1-10), and reinstall takes
// the DISCOVERY half from them; it reaches both modes. The maintenance warnings stay
// orchestrated-only, because MarketplaceNotificationMessage has no field for
// one and a standalone user has nothing to do about it (D-19-01). The side
// effect behind them, the plugin-data rm, runs either way; the completion
// cache drop happens once, in the shared swap (D-PL1-17).
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
// The user-invoked reinstall is the only production path. Its single-plugin
// operation is the one `operations.ts::createReinstallOperation` binds, and
// `edge/register.ts` hands it to `createNodeReinstallPlugins`. No reconcile
// step reinstalls anything: `apply` moves a plugin through the update runner
// instead (D-26).

import { rm } from "node:fs/promises";

import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import {
  composeErrorWithCauseChain,
  errorMessage,
  rethrowInvalidGitHubBaseUrl,
} from "../../shared/errors.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type PluginFailedMessage,
  type PluginReinstalledMessage,
} from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { partitionStagingWarnings } from "../../shared/staging-warnings.ts";
import { type LockedStateTransactionDeps } from "../../transaction/with-state-guard.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import { materializeLatestVersion, recordCandidate } from "./materialize-latest.ts";
import {
  discoveryWarningsMember,
  recordReinstallOutcome,
  reinstallOutcomeFromRun,
  reinstallReasonsFromError,
} from "./reinstall-record.ts";
import { selectReinstallTargets } from "./reinstall-targets.ts";
import {
  REINSTALL_CONTEXT,
  narrowReasons,
  reinstalledRowFromOutcome,
  renderReinstallPartitionAndNotify,
} from "./reinstall.messaging.ts";
import {
  emitMarketplaceNotAddedSignal,
  keepLocalLayerTargets,
  MarketplaceNotAddedSignal,
  namedPluginLayerRefusal,
} from "./shared.ts";
import { surfaceStagingDiagnostics } from "./staging-diagnostics.ts";

import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { DiscoveryWarning } from "../../shared/staging-warnings.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { ReinstallFailedOutcome, ReinstallPluginOutcome } from "../types.ts";
import type { CandidateReport } from "./materialize-latest.ts";
import type { ReinstallPhaseFailure } from "./reinstall-record.ts";
import type { ReinstallPluginsTarget, ReinstallTargetSelection } from "./reinstall-targets.ts";
import type { StagingDiagnostic } from "./staging-diagnostics.ts";
import type { MaterializationPolicy, UpdateCloneCacheSeam } from "./update-preflight.ts";
import type { RmOptions } from "node:fs";

/**
 * Filesystem removal seam used after a committed reinstall. The options
 * narrow Node's own removal options: both slots are optional booleans there,
 * and pinning each to `true` is what stops a non-recursive or non-forced
 * removal from satisfying the seam.
 */
export type RemoveDataDirFn = (
  path: string,
  options: RmOptions & { recursive: true; force: true },
) => Promise<void>;

/** Hook-routing capabilities the shared swap re-routes a reinstalled plugin with. */
export type ReinstallHooksRouting = Pick<
  HooksRouting,
  "readAndCachePluginHooks" | "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/** Complete inputs for one installed plugin reinstall. */
export interface ReinstallPluginOptions {
  readonly ctx: NotificationContext;
  /** The command run. D-05: every emission renders from its one soft-dep snapshot. */
  readonly run: NotificationRun;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly render?: "default" | "none";
  readonly local?: boolean;
  /**
   * LAYER-04 / D-MF-03: the command named this plugin
   * (`<plugin>@<marketplace>`), so it acts on its target layer and is refused
   * when only the other layer declares the plugin. A nameless form, and any
   * other caller that omits it, is never refused.
   */
  readonly named?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /**
   * State I/O for this reinstall's state read and the shared swap's
   * intent-mark and finalize guards. Production callers leave this undefined
   * and get the real state I/O.
   */
  readonly stateTransaction?: LockedStateTransactionDeps;
  /**
   * Post-success plugin-data-directory removal seam. Production callers leave
   * this undefined and get a recursive, forced `rm`.
   */
  readonly removeDataDir?: RemoveDataDirFn;
  /**
   * Test-only clone-cache seam override; production uses the real imports.
   */
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
}

/** Complete inputs for targeted or bulk plugin reinstall. */
export interface ReinstallPluginsOptions {
  readonly ctx: NotificationContext;
  /**
   * The command run. D-05: every emission, including each per-plugin
   * reinstall's, renders from its one soft-dep snapshot.
   */
  readonly run: NotificationRun;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: ReinstallPluginsTarget;
  readonly local?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * State I/O seam, forwarded unchanged to every per-plugin reinstall in the
   * cascade. Production callers leave this undefined.
   */
  readonly stateTransaction?: LockedStateTransactionDeps;
  /**
   * Plugin-data-directory removal seam, forwarded unchanged to every
   * per-plugin reinstall in the cascade. Production callers leave it undefined.
   */
  readonly removeDataDir?: RemoveDataDirFn;
  /**
   * Test-only clone-cache seam override, forwarded unchanged to every
   * per-plugin reinstall in the cascade; production uses the real imports.
   */
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
}

/** One plugin reinstall bound to a lifecycle routing owner. */
export type ReinstallPluginFn = (
  options: ReinstallPluginOptions,
) => Promise<ReinstallPluginOutcome>;

/** Direct/bulk reinstall operation bound to one lifecycle routing owner. */
export type ReinstallPluginsFn = (
  options: ReinstallPluginsOptions,
) => Promise<readonly ReinstallPluginOutcome[]>;

/** Named leaf owners bound by the public reinstall flow composition root. */
interface ReinstallFlowOwners {
  readonly recordReinstallOutcome: typeof recordReinstallOutcome;
  readonly reinstallReasonsFromError: typeof reinstallReasonsFromError;
  readonly selectReinstallTargets: typeof selectReinstallTargets;
}

const REINSTALL_FLOW_OWNERS: ReinstallFlowOwners = {
  recordReinstallOutcome,
  reinstallReasonsFromError,
  selectReinstallTargets,
};

/** Reinstall's knobs on the shared runner (D-18-04, D-18-15, D-23). */
const REINSTALL_MATERIALIZATION: MaterializationPolicy = {
  /** D-18-04: read a present git mirror's HEAD offline; only a missing mirror clones. */
  refreshSource: false,
  /** D-18-04: re-materialize the recorded revision too, which restores deleted artifacts. */
  skipSameRevision: false,
  /**
   * D-18-15: RINST-01's repair overwrite of the plugin's own previous agent
   * files a user edited.
   */
  overwrite: true,
  /** D-23: a dependent's range still picks a release tag, as `update`'s does. */
  searchReleaseTags: true,
};

/** The collaborators one reinstall binds. */
interface ReinstallBindings {
  readonly hooksRouting: ReinstallHooksRouting;
  readonly completionCache: CompletionCache;
  readonly env: ClaudeEnv;
}

/**
 * Binds one reinstall operation to its hook-routing owner and completion
 * cache. D-18-05: the materialization is the shared runner's, and the
 * post-success maintenance is this module's own step, so there is no
 * transaction to inject.
 *
 * D-08-06: `env` is the environment the reinstall stages MCP servers with. It
 * defaults to Pi's process environment here, at the entry point, the way
 * `createGetPluginInfo` binds it.
 */
export function createReinstallPlugin(
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv = process.env,
): ReinstallPluginFn {
  const bindings: ReinstallBindings = { hooksRouting, completionCache, env };
  return (options) => reinstallPluginWith(REINSTALL_FLOW_OWNERS, bindings, options);
}

/** Binds the bulk reinstall around the single-plugin operation it drives per target. */
export function createNodeReinstallPlugins(reinstallPlugin: ReinstallPluginFn): ReinstallPluginsFn {
  return (options) => reinstallPluginsWith(REINSTALL_FLOW_OWNERS, options, reinstallPlugin);
}

/** What one reinstall reached, before maintenance and rendering. */
interface ReinstallReached {
  readonly outcome: ReinstallPluginOutcome;
  /** D-141-03 / D-PL1-11: the discovery half of the staging warnings; reaches both modes. */
  readonly discoveryWarnings: readonly DiscoveryWarning[];
  /**
   * AFILE-04: the MCP commit's file notices. Empty unless the MCP commit ran:
   * on a reinstalled plugin, or on a failure after the commit rewrote the file.
   */
  readonly mcpConfigNotices: readonly McpConfigNotice[];
}

// ATTR-03 / D-47-A: the structural marketplace-not-added signal thrown by the
// reinstall target enumerator is the shared `MarketplaceNotAddedSignal` from
// `./shared.ts` (one source of truth so `instanceof` agrees with update.ts).
// The `reinstallPlugins` enumeration catch detects it via `instanceof` and
// emits ONE standalone `MarketplaceNotAddedMessage` before any cascade row.

/** Runs one reinstall, its maintenance, and its notification. */
async function reinstallPluginWith(
  owners: ReinstallFlowOwners,
  bindings: ReinstallBindings,
  opts: ReinstallPluginOptions,
): Promise<ReinstallPluginOutcome> {
  const { ctx, run, scope, cwd, marketplace } = opts;
  const render = opts.render ?? "default";
  const locations = locationsFor(scope, cwd);

  // UPR-03: one holder per call, so a failure names this target's move only.
  const candidate: CandidateReport = {};
  let reached: ReinstallReached;
  try {
    reached = await runReinstall(owners, bindings, opts, locations, candidate);
  } catch (err) {
    // GHB-03 / D-18-16: an invalid GitHub base override fails the command,
    // warm cache or not.
    rethrowInvalidGitHubBaseUrl(err);
    return failReinstall(owners, opts, err, render, candidate);
  }

  const { outcome } = reached;
  if (outcome.partition !== "reinstalled") {
    // CR-02 / D-01: the standalone single-plugin path must emit the row, not
    // return silently. The bulk mapper composes it, so the two agree.
    if (render !== "none") {
      renderReinstallPartitionAndNotify(ctx, run, [outcome], "single");
      // AFILE-04: a failure after the MCP commit leaves the rewritten file.
      notifyMcpConfigNotices(ctx, run, reached.mcpConfigNotices);
    }

    return outcome;
  }

  const maintenanceWarnings = await runPostSuccessMaintenance(opts, locations);
  if (render === "none") {
    // D-PL1-11: `notes` keeps its orchestrated string fold of the discovery
    // messages and the maintenance warnings.
    const notes = [...reached.discoveryWarnings.map((w) => w.message), ...maintenanceWarnings].map(
      (w) => `warning: ${w}`,
    );
    // NREG-01: each carrier key stays absent when it is empty, so a clean
    // reinstall's outcome shape is unchanged. AFILE-04: an MCP notice needs no
    // note to travel with it.
    return {
      ...outcome,
      ...(notes.length > 0 && { notes }),
      ...(reached.discoveryWarnings.length > 0 && {
        discoveryWarnings: reached.discoveryWarnings,
      }),
      ...(reached.mcpConfigNotices.length > 0 && { mcpConfigNotices: reached.mcpConfigNotices }),
    };
  }

  // IN-01 / D-19-01: the maintenance warnings are NOT surfaced -- there is no
  // clean MarketplaceNotificationMessage representation for a post-success
  // soft warning. The underlying side effects (cache drop + data-dir rm) still
  // fire above; the orchestrated-mode `notes` field at the `render === "none"`
  // arm still carries the warning strings for consumers outside the notify
  // path. The DISCOVERY warnings are the D-141-03 exception, but this arm does
  // not render them either: no production caller reaches it, and
  // `reinstallPlugins` already renders them after the cascade row for the
  // `render: "none"` arm every caller does reach.
  //
  // WR-09: the ONE row composer, shared with the bulk cascade mapper, so the
  // two surfaces cannot report the same reinstall differently. `undefined` is
  // the orphan-fold scope decision this branch always makes: the row's scope
  // matches its marketplace block.
  const reinstalledRow: PluginReinstalledMessage = reinstalledRowFromOutcome(outcome, undefined);
  notifyWithContext(
    ctx,
    run,
    REINSTALL_CONTEXT,
    [{ name: marketplace, scope, plugins: [reinstalledRow] }],
    undefined,
    "single",
  );
  // AFILE-04: this arm renders its own row, so it shows the MCP config file
  // notices after it.
  notifyMcpConfigNotices(ctx, run, reached.mcpConfigNotices);
  return outcome;
}

/**
 * Reads the record, applies reinstall's own skips and the layer refusal, then
 * materializes through the shared runner. D-18-10: no lock is held across the
 * operation; the shared swap takes update's intent-mark and finalize guards.
 */
async function runReinstall(
  owners: ReinstallFlowOwners,
  bindings: ReinstallBindings,
  opts: ReinstallPluginOptions,
  locations: ScopedLocations,
  candidate: CandidateReport,
): Promise<ReinstallReached> {
  const target = { name: opts.plugin, marketplace: opts.marketplace, scope: opts.scope };
  const state = await (opts.stateTransaction?.loadState ?? loadState)(locations.extensionRoot);
  const record = ownValue(ownValue(state.marketplaces, opts.marketplace)?.plugins, opts.plugin);
  if (record === undefined) {
    // UPR-04: a target the scope does not record fails as not installed, as
    // uninstall's does; nothing is changed.
    return reachedBeforeRunner(
      owners.recordReinstallOutcome({ partition: "failed", ...target, reason: "not installed" }),
    );
  }

  // ENBL-05: a record carrying an explicit `enabled: false` marker is the
  // user's standing instruction, read through the single predicate
  // `persistence/state-io.ts` owns so this site cannot drift from `update`'s.
  // Re-materializing under it would restore the plugin's hooks, MCP servers and
  // PATH entries with no command and no prompt. The skip comes before the
  // shared runner, so the preflight's disabled-record pin refresh stays
  // update's alone (D-18-05). ENBL-18: the record keeps its `resources.*`
  // inventory while disabled, so a populated inventory is not evidence that
  // anything is on disk and must not be read as one.
  if (isRecordedButDisabled(record)) {
    return reachedBeforeRunner(
      owners.recordReinstallOutcome({
        partition: "skipped",
        ...target,
        reason: "already disabled",
      }),
    );
  }

  await refuseOtherLayerReinstall(locations, opts);
  let phaseFailure: ReinstallPhaseFailure | undefined;
  const run = await materializeLatestVersion(
    {
      // The runner's optional seams are reinstall's own options, carried over
      // unchanged; the members only reinstall reads ride along unread.
      ...opts,
      locations,
      hooksRouting: bindings.hooksRouting,
      completionCache: bindings.completionCache,
      env: bindings.env,
      cascade: false,
      cardinality: "single",
      // D-18-06 / BFILL-01: reinstall is partial-capable, so a still-partial
      // plugin re-materializes in place.
      partial: true,
      cleanupClones: garbageCollectPluginClones,
      // D-18-10: the commit or finalize failure is reinstall's own outcome to
      // render, so the callback only captures it.
      notifyPhaseFailure: (error, failures) => {
        phaseFailure = { error, failures };
      },
      ...recordCandidate(candidate),
    },
    REINSTALL_MATERIALIZATION,
  );
  return {
    outcome: reinstallOutcomeFromRun(target, run, phaseFailure),
    discoveryWarnings:
      run.partition === "updated"
        ? partitionStagingWarnings(run.stagingWarnings ?? []).discovery
        : [],
    mcpConfigNotices:
      run.partition === "updated" || run.partition === "failed" ? (run.mcpConfigNotices ?? []) : [],
  };
}

/** An outcome reinstall reached before the shared runner, which stages nothing. */
function reachedBeforeRunner(outcome: ReinstallPluginOutcome): ReinstallReached {
  return { outcome, discoveryWarnings: [], mcpConfigNotices: [] };
}

const defaultRemoveDataDir: RemoveDataDirFn = async (dataDir) => {
  await rm(dataDir, { recursive: true, force: true });
};

/**
 * D-18-05: the non-fatal cleanup after a reinstalled outcome. It removes the
 * plugin-data directory and returns one deferral warning when that fails. The
 * shared swap already dropped the marketplace's completion cache (D-PL1-17).
 */
async function runPostSuccessMaintenance(
  opts: ReinstallPluginOptions,
  locations: ScopedLocations,
): Promise<readonly string[]> {
  const { marketplace, plugin } = opts;
  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  const removeDataDir = opts.removeDataDir ?? defaultRemoveDataDir;
  try {
    await removeDataDir(dataDir, { recursive: true, force: true });
  } catch (error) {
    return [
      `Plugin "${plugin}" reinstalled; data cleanup deferred at ${dataDir}: ${errorMessage(error)}`,
    ];
  }

  return [];
}

/**
 * Composes a thrown reinstall's failed outcome and, unless the caller renders,
 * its row. The row comes from the same mapper the bulk cascade uses, so the
 * standalone and bulk failure rows cannot differ.
 *
 * D-PL1-14: the outcome carries the discovery half of the warnings `candidate`
 * holds, the handles the swap prepared before it threw.
 */
function failReinstall(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginOptions,
  err: unknown,
  render: "default" | "none",
  candidate: CandidateReport,
): ReinstallFailedOutcome {
  const { move } = candidate;
  const outcome: ReinstallFailedOutcome = {
    ...owners.recordReinstallOutcome({
      partition: "failed",
      name: opts.plugin,
      marketplace: opts.marketplace,
      scope: opts.scope,
      error: err,
      ...(move !== undefined && { move }),
    }),
    ...discoveryWarningsMember(candidate.stagingWarnings),
  };
  if (render !== "none") {
    renderReinstallPartitionAndNotify(opts.ctx, opts.run, [outcome], "single");
  }

  return outcome;
}

/** Runs target selection, per-plugin reinstalls, and exact cascade rendering. */
async function reinstallPluginsWith(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginsOptions,
  reinstallPlugin: ReinstallPluginFn,
): Promise<readonly ReinstallPluginOutcome[]> {
  const { ctx, run, cwd } = opts;
  let selection: ReinstallTargetSelection;
  try {
    selection = await selectTargets(owners, opts);
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
    notifyWithContext(ctx, run, REINSTALL_CONTEXT, [], undefined, cardinality);
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
      // eslint-disable-next-line no-await-in-loop -- each reinstall locks the scope (retries: 0)
      await reinstallPlugin({
        ctx,
        run,
        scope: target.scope,
        cwd,
        marketplace: target.marketplace,
        plugin: target.plugin,
        render: "none",
        ...(opts.local === true && { local: true }),
        ...(opts.target.kind === "plugin" && { named: true }),
        ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        authMemo,
        ...(opts.stateTransaction !== undefined && { stateTransaction: opts.stateTransaction }),
        ...(opts.removeDataDir !== undefined && { removeDataDir: opts.removeDataDir }),
        ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
      }),
    );
  }

  renderReinstallPartitionAndNotify(ctx, run, outcomes, cardinality);
  surfaceReinstallDiscoveryWarnings(ctx, run, outcomes);
  surfaceReinstallMcpConfigNotices(ctx, run, outcomes);
  return Object.freeze(outcomes);
}

/**
 * LAYER-04 / D-MF-03: a nameless reinstall with `--local` covers the plugins the
 * local layer declares and the dependencies those plugins need; without the
 * flag it covers every installed plugin of the scope.
 */
async function selectTargets(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginsOptions,
): Promise<ReinstallTargetSelection> {
  const selection = await owners.selectReinstallTargets({
    cwd: opts.cwd,
    target: opts.target,
    ...(opts.scope !== undefined && { scope: opts.scope }),
  });
  if (opts.local !== true || opts.target.kind === "plugin") {
    return selection;
  }

  return {
    cardinality: selection.cardinality,
    targets: await keepLocalLayerTargets(selection.targets, opts.cwd),
  };
}

/**
 * AFILE-04: show the MCP config file notices of every reinstalled or failed
 * plugin, in outcome order, after the cascade and the discovery diagnostics.
 * The shared swap does not restore the MCP config file, so a failure after the
 * MCP commit carries the notices of the write it left in place.
 */
function surfaceReinstallMcpConfigNotices(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  notifyMcpConfigNotices(
    ctx,
    run,
    outcomes.flatMap((outcome) =>
      outcome.partition === "skipped" ? [] : (outcome.mcpConfigNotices ?? []),
    ),
  );
}

/**
 * D-141-03 / D-141-05: render each reinstalled plugin's discovery warnings
 * after the cascade its row lives in -- the user reads the row, then the
 * detail that qualifies it. Mirrors `update.ts::surfaceUpdateDiscoveryWarnings`.
 *
 * It renders through the list renderer `surfaceStagingDiagnostics`
 * (D-PL1-07). This function, not the `render !== "none"` arm of
 * `reinstallPlugin`, is what a user-invoked reinstall reaches: the edge
 * handler calls `reinstallPlugins` for every target form, and this function
 * drives `reinstallPlugin` with `render: "none"`.
 *
 * The hygiene half never arrives here: only the DISCOVERY half rides
 * `discoveryWarnings`, typed (D-PL1-11), while `notes` keeps the flat fold
 * for orchestrated consumers.
 */
function surfaceReinstallDiscoveryWarnings(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  surfaceStagingDiagnostics(ctx, run, outcomes.flatMap(reinstallStagingDiagnostic));
}

/**
 * D-PL1-07 / D-PL1-14: the staging diagnostic of a reinstalled or failed
 * outcome; none for a skipped one.
 */
function reinstallStagingDiagnostic(outcome: ReinstallPluginOutcome): StagingDiagnostic[] {
  switch (outcome.partition) {
    case "reinstalled":
      return [
        {
          plugin: outcome.name,
          scope: outcome.scope,
          verb: "reinstalled",
          warnings: outcome.discoveryWarnings ?? [],
        },
      ];
    case "failed":
      return [
        {
          plugin: outcome.name,
          scope: outcome.scope,
          verb: "reinstall failed",
          warnings: outcome.discoveryWarnings ?? [],
        },
      ];
    case "skipped":
      return [];
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
 *     (`error`) + no reload-hint are set explicitly on the row (D-03/D-06);
 *     notify() aggregates them into the cascade's overall trailer.
 */
async function handleEnumerationFailure(
  owners: ReinstallFlowOwners,
  opts: ReinstallPluginsOptions,
  err: Error,
  cardinality: "single" | "plural",
): Promise<void> {
  const { ctx, run, cwd } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    await emitMarketplaceNotAddedSignal({
      ctx,
      run,
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
    run,
    REINSTALL_CONTEXT,
    [{ name: targetingMp, scope: targetingScope, plugins: [failedRow] }],
    undefined,
    cardinality,
  );
}

/**
 * LAYER-04 / D-MF-03: refuse a named reinstall of a plugin only the other
 * layer declares, or one whose layer config cannot be read (CFG-03). It runs
 * before anything is resolved or staged, so a refusal changes nothing (NFR-3).
 */
async function refuseOtherLayerReinstall(
  locations: ScopedLocations,
  opts: ReinstallPluginOptions,
): Promise<void> {
  if (opts.named !== true) {
    return;
  }

  const refusal = await namedPluginLayerRefusal({
    locations,
    local: opts.local === true,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
  });
  if (refusal !== undefined) {
    throw refusal;
  }
}
