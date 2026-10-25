// orchestrators/reconcile/pending.ts
//
// DIFF-01 SC #2 / DIFF-02 read-only diff surface for `/claude:plugin
// pending` (D-53-01).
//
// MUST NOT touch the network (NFR-5) -- no `platform/git`, no
// `DEFAULT_GIT_OPS`, no `refreshGitHubClone`. The network-free ESLint
// block (BLOCK F in `eslint.config.js`) enforces this
// structurally.
//
// NEVER writes any file (NFR-5 read-surface discipline). Idempotency
// (DIFF-01 SC #2): two consecutive invocations against unchanged state +
// config produce byte-identical output.
//
// CFG-03: when EITHER `base` or `local` config arm is `invalid`, surface a
// `(failed) {invalid manifest}` row for that scope and DO NOT call
// `planReconcile` for it. Invalid input is NEVER silently coerced to empty
// desired state (which would render as a mass-uninstall pending list).
//
// IL-2: exactly ONE `notify()` call per invocation -- the composer
// accumulates per-scope plans + invalid-config rows into a single report, and
// `pendingReconcile` dispatches it once.
//
// Empty-plan case (DIFF-01 SC #2): when every plan is empty AND no scope
// surfaced an invalid-config failure, the orchestrator dispatches the
// dedicated `ReconcilePendingEmptyMessage` standalone-arm variant whose
// renderer arm hard-codes the catalog-locked advisory body line
// `Pending: /claude:plugin apply has nothing to change.` (D-14). Routing the empty case
// through `notify()` preserves IL-2 and lets the catalog-uat byte-equality
// runner exercise the empty path through the same public surface as every
// other variant.
//
// APL-04 / D-14: `pending` lists what the next `/claude:plugin apply` would
// change, since a load changes no installation state. A list that holds such a
// change ends with the `/claude:plugin apply to make these changes` trailer.
//
// D-05 / D-06: a load prints this same block. `composePendingReport` builds it
// and `notifyPendingReport` sends it, for `pending` and the load alike, so the
// two cannot drift.
//
// D-21 (superseding PENDING-VERDICT-01 / D-06-25): `apply` makes the LOAD-01
// dependency disable and the MISS-01 missing-dependency install, so `pending`
// computes the same satisfaction verdict `apply`'s read pass computes, offline
// and without the lock, and hands it to the planner. A walk the verdict cannot
// complete plans no dependency disable, install or lift (D-05-07), as in
// `apply`.
//
// APL-02 / D-10 / D-14: after planning, each scope's catalog moves come from
// the offline convergence planner and render as `(will update)` rows.

import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import {
  findLayerMarketplaceGaps,
  loadMergedScopeConfig,
  mergeScopeConfigs,
} from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { buildConfigFromState } from "../../persistence/migrate-config.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { scanRetainedWorkflowsStaging } from "../plugin/workflows-staging-gc.ts";

import { planConvergence } from "./convergence.ts";
import { buildScopeSatisfactionVerdict, verdictAfterToggles } from "./dependency-verdict.ts";
import {
  buildReconcilePendingNotification,
  isReconcilePlanListEmpty,
  planListNeedsApply,
  recordedVersionEntries,
  resolvePendingForceInstalls,
  type PendingInstallCandidate,
} from "./notify.ts";
import { planReconcile } from "./plan.ts";
import {
  composeLayerMarketplaceCause,
  PENDING_CONTEXT,
  type PendingMsg,
} from "./reconcile.messaging.ts";

import type { PlannedDecline, PlannedHold, PlannedMove } from "./convergence.ts";
import type { ScopeSatisfactionVerdict, UnsatisfiedDeclaration } from "./dependency-verdict.ts";
import type { PlannedPluginInstall, ReconcilePlan } from "./types.ts";
import type { MergedConfig, ScopeLoadOutcome } from "../../persistence/config-merge.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { ReconcilePendingEmptyMessage } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";

export interface PendingReconcileOptions {
  readonly ctx: NotificationContext;
  /** D-05: the command's run; both pending notifications render from its snapshot. */
  readonly run: NotificationRun;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /** When omitted, fan-out across BOTH scopes (project-first per MSG-GR-3). */
  readonly scope?: Scope;
}

/**
 * CFG-03: surface an invalid config arm as a structured `(failed)
 * {invalid manifest}` marketplace row. The marketplace `name` carries the
 * file's BASENAME (never the absolute path -- information-disclosure
 * mitigation T-53-02-02).
 *
 * I5: only a plugin row can carry a cause, so one failed child named by the
 * basename carries the config's parse detail, with every absolute path
 * redacted (T-53-02-02). The load prints this block, so this is where its
 * invalid-config cause now appears (D-06).
 */
function buildInvalidConfigBlock(
  scope: Scope,
  filePath: string,
  detail: string,
): MarketplaceRows<PendingMsg> {
  const name = path.basename(filePath);
  return {
    name,
    scope,
    status: "failed",
    reasons: ["invalid manifest"],
    // D-03: an invalid-config pending block -> error.
    severity: "error",
    plugins: [
      {
        status: "failed",
        name,
        reasons: ["invalid manifest"],
        cause: new Error(redactAbsolutePaths(detail)),
        severity: "error",
        needsReload: false,
      },
    ],
  };
}

/**
 * LAYER-06: a layer config's block with one failed row that carries the cause,
 * because only a plugin row can carry one. The block itself has no status, so
 * it groups the row and the tally counts the one error once. The row is named
 * by the file's BASENAME (T-53-02-02).
 */
function buildLayerGapBlock(
  scope: Scope,
  filePath: string,
  cause: string,
): MarketplaceRows<PendingMsg> {
  const name = path.basename(filePath);
  return {
    name,
    scope,
    plugins: [
      {
        status: "failed",
        name,
        reasons: ["invalid manifest"],
        cause: new Error(cause),
        // D-03: the layer error -> error.
        severity: "error",
        needsReload: false,
      },
    ],
  };
}

/** CFG-03: one failed block per invalid layer config of a scope. */
function invalidConfigBlocks(
  scope: Scope,
  outcome: ScopeLoadOutcome,
): MarketplaceRows<PendingMsg>[] {
  return [outcome.base, outcome.local].flatMap((result) =>
    result.status === "invalid"
      ? [buildInvalidConfigBlock(scope, result.filePath, result.error)]
      : [],
  );
}

/**
 * LAYER-06 / D-MF-03: one failed block per layer that declares a plugin whose
 * marketplace only the other layer declares. It runs on the readable layers
 * only, after `invalidConfigBlocks` found none.
 *
 * MIG-01 (DIFF-01): when the base config is absent, the load's first-run
 * migration writes it from state before its own check, so this check reads
 * the same `buildConfigFromState` projection the planner reads
 * (`mergedViewForPlanning`). Pending then reports the error the next load
 * stops on.
 */
function layerMarketplaceGapBlocks(
  scope: Scope,
  loc: ScopedLocations,
  outcome: ScopeLoadOutcome,
  state: ExtensionState,
): MarketplaceRows<PendingMsg>[] {
  const local = outcome.local.status === "valid" ? outcome.local.config : {};
  const base =
    outcome.base.status === "valid" ? outcome.base.config : buildConfigFromState(state, local);
  return findLayerMarketplaceGaps(base, local).map((gap) =>
    buildLayerGapBlock(
      scope,
      gap.layer === "base" ? loc.baseConfigJsonPath : loc.localConfigJsonPath,
      composeLayerMarketplaceCause(gap, scope),
    ),
  );
}

/**
 * Classify a `loadState` throw (unparseable JSON, schema-invalid record,
 * unreadable file) into a closed-set reason. `loadState` wraps the raw
 * `JSON.parse` `SyntaxError` in an `Error` whose `cause` is the
 * `SyntaxError`, so unwrap the cause before delegating to the shared
 * `narrowProbeError` ladder (which the sibling read-only `listPlugins`
 * catch path also routes through).
 */
function narrowStateLoadFailReason(err: unknown): ContentReason {
  if (err instanceof Error && err.cause instanceof SyntaxError) {
    return "unparseable";
  }

  return narrowProbeError(err);
}

/**
 * MIG-01 pre-migration window (DIFF-01): pick the merged desired-state view
 * the planner runs against. When the BASE config file is ABSENT, the apply
 * path migrates FIRST inside its lock (apply.ts::readPassForScope step 1
 * writes the `buildConfigFromState` projection to `claude-plugins.json`, then
 * plans against the merged view). A pending-list that planned against the raw
 * merged view (absent base == empty desired state) would render a misleading
 * mass-uninstall plan for a populated state. Mirror the post-migration
 * merged view READ-ONLY instead: plan against the PURE
 * `buildConfigFromState` projection merged with the local arm -- no write,
 * no migration side effect (NFR-5 read-surface discipline). The projection
 * leaves out what the local config declares, as the migration does (FIX-02),
 * so pending and the load plan the same view. A pristine
 * scope (empty state) projects an empty config, so the empty-advisory
 * behavior is unchanged; an invalid base/local arm never reaches this
 * helper (CFG-03 abort happens first).
 */
function mergedViewForPlanning(outcome: ScopeLoadOutcome, state: ExtensionState): MergedConfig {
  if (outcome.base.status !== "absent") {
    return outcome.merged;
  }

  const local = outcome.local.status === "valid" ? outcome.local.config : {};
  return mergeScopeConfigs(buildConfigFromState(state, local), local);
}

/** Every recorded `name@marketplace` key disabled by something other than the check. */
function independentlyDisabledKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      if (isRecordedButDisabled(record) && record.dependencyDisabled !== true) {
        keys.add(`${name}@${marketplace.name}`);
      }
    }
  }

  return keys;
}

/**
 * The dependents whose every unsatisfied declaration the planned installs
 * satisfy, run to a fixpoint: a `missing` dependency is satisfied once a
 * planned install names it, and a `disabled` one once the check releases it
 * and nothing else disabled it.
 */
function releasedDependents(
  unsatisfied: readonly UnsatisfiedDeclaration[],
  installed: ReadonlySet<string>,
  state: ExtensionState,
): ReadonlySet<string> {
  const disabled = independentlyDisabledKeys(state);
  const released = new Set<string>();
  const isSatisfied = (entry: UnsatisfiedDeclaration): boolean =>
    entry.kind === "missing"
      ? installed.has(entry.dependency)
      : entry.kind === "disabled" &&
        released.has(entry.dependency) &&
        !disabled.has(entry.dependency);
  const dependents = [...new Set(unsatisfied.map((entry) => entry.dependent))];
  let batch: readonly string[];
  do {
    batch = dependents.filter(
      (dependent) =>
        !released.has(dependent) &&
        unsatisfied.every((entry) => entry.dependent !== dependent || isSatisfied(entry)),
    );
    for (const dependent of batch) {
      released.add(dependent);
    }
  } while (batch.length > 0);

  return released;
}

/**
 * D-21 / D-09-07: the toggle buckets `apply` drives after its dependency
 * installs land. `apply` reads the scope again after such an install and takes
 * the fresh plan's enable, disable and dependency-disable buckets, so a
 * dependent whose missing dependency it just installed stays up, or comes back
 * up. `pending` installs nothing, so it removes from the verdict each dependent
 * the planned installs satisfy and plans again. The other buckets stay the
 * first plan's, as in `apply`, which also reads again only when it installs a
 * dependency.
 */
function withPlannedInstallsLanded(
  plan: ReconcilePlan,
  verdict: ScopeSatisfactionVerdict,
  state: ExtensionState,
  replan: (verdict: ScopeSatisfactionVerdict) => ReconcilePlan,
): ReconcilePlan {
  // The planner fills no dependency install from a failed walk, so the second
  // test only narrows the verdict.
  if (plan.pluginsToDependencyInstall.length === 0 || !verdict.ok) {
    return plan;
  }

  const installed = new Set(
    [...plan.pluginsToInstall, ...plan.pluginsToDependencyInstall].map(
      (install) => `${install.plugin}@${install.marketplace}`,
    ),
  );
  const released = releasedDependents(verdict.unsatisfied, installed, state);
  const fresh = replan({
    ok: true,
    unsatisfied: verdict.unsatisfied.filter((entry) => !released.has(entry.dependent)),
  });
  return {
    ...plan,
    pluginsToEnable: fresh.pluginsToEnable,
    pluginsToDisable: fresh.pluginsToDisable,
    pluginsToDependencyDisable: fresh.pluginsToDependencyDisable,
  };
}

/**
 * D-21: drops each planned dependency disable of a record that is already
 * disabled. The planner keeps such a record so `apply` reaches its
 * already-disabled no-op, and that no-op changes nothing and reports no row,
 * so a `(will disable)` row for it would name a change `apply` never makes.
 */
function withoutDisabledDependents(plan: ReconcilePlan, state: ExtensionState): ReconcilePlan {
  return {
    ...plan,
    pluginsToDependencyDisable: plan.pluginsToDependencyDisable.filter((op) => {
      const record = ownValue(ownValue(state.marketplaces, op.marketplace)?.plugins, op.plugin);
      return record === undefined || !isRecordedButDisabled(record);
    }),
  };
}

/**
 * WR-06: observations of the workflow staging trees the sweeper
 * keeps forever. The optional field is absent when there are none.
 *
 * `workflowsStagingDir` and `workflowsHomeDir` are scope-INDEPENDENT, so the
 * scope handed to `locationsFor` is immaterial and one call answers for the
 * whole invocation. That is also why the caller must not put this inside its
 * per-scope loop: a two-scope invocation would render the identical advisory
 * twice.
 *
 * D-19-01 shape, owned by the scan rather than repeated here: a scan that
 * cannot answer costs the advisory, never the command. The scan is TOTAL -- an
 * absent or unreadable staging directory, an entry it cannot inspect and a
 * containment refusal all resolve to the empty result rather than rejecting --
 * so a try/catch around it would be a branch nothing can reach.
 */
async function retainedWorkflowsFacts(
  cwd: string,
): Promise<Pick<ReconcilePendingEmptyMessage, "retainedWorkflows">> {
  const retainedWorkflows = await scanRetainedWorkflowsStaging(locationsFor("user", cwd));
  return retainedWorkflows.length === 0 ? {} : { retainedWorkflows };
}

/**
 * D-05 / D-06: what `pending` prints, before it is sent. `pending` and the load
 * both build it here and send it through `notifyPendingReport`, so their blocks
 * cannot drift.
 */
export interface PendingReport {
  /** The sorted, merged blocks; empty when nothing is pending. */
  readonly marketplaces: Plural<MarketplaceRows<PendingMsg>>;
  /** WR-06: the retained workflow staging trees, when there are any. */
  readonly retained: Pick<ReconcilePendingEmptyMessage, "retainedWorkflows">;
  /** APL-04 / D-14: whether some block names a change `apply` would make. */
  readonly needsApply: boolean;
}

/**
 * D-05 / D-06: reads each scope's config and state, plans it the way `apply`
 * would, and folds the plans and the failed blocks into one report. Offline
 * (NFR-5) and write-free. `scopes` is read in the order given (MSG-GR-3).
 */
export async function composePendingReport(opts: {
  readonly cwd: string;
  readonly scopes: readonly Scope[];
}): Promise<PendingReport> {
  const plans: ReconcilePlan[] = [];
  const invalidBlocks: MarketplaceRows<PendingMsg>[] = [];
  // FSTAT-06: the recorded marketplace clone roots + manifest paths, keyed by
  // `(scope, marketplace)`, so the will-partially-install preview can locate a
  // planned install candidate's on-disk manifest entry and resolve it
  // no-network. Only RECORDED marketplaces are reachable -- a same-run
  // marketplace add is not yet cloned, so its installs stay `(will install)`.
  const recordedMarketplaces = new Map<
    string,
    { readonly marketplaceRoot: string; readonly manifestPath: string }
  >();
  const recordedVersions: (readonly [string, string])[] = [];
  const convergence: {
    readonly moves: PlannedMove[];
    readonly holds: PlannedHold[];
    readonly declines: PlannedDecline[];
  } = { moves: [], holds: [], declines: [] };

  for (const scope of opts.scopes) {
    const loc = locationsFor(scope, opts.cwd);
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one config read each
    const outcome = await loadMergedScopeConfig(loc);

    // CFG-03 abort: if EITHER base or local config is invalid, emit a (failed)
    // {invalid manifest} row for that layer. Do NOT call planReconcile --
    // invalid input must never be coerced into an empty desired-state diff that
    // would render as a mass-uninstall list.
    const configBlocks = invalidConfigBlocks(scope, outcome);
    if (configBlocks.length > 0) {
      invalidBlocks.push(...configBlocks);
      continue;
    }

    // Failure containment (IL-2): a hand-edited / corrupt `state.json`
    // throws from `loadState` (unparseable JSON or schema-invalid record).
    // Mirror the CFG-03 arm above -- surface a structured `(failed)` row
    // carrying the BASENAME (T-53-02-02: never the absolute path) instead
    // of letting the throw escape the command handler with no
    // `ctx.ui.notify` output at all (the sibling read-only `listPlugins`
    // catches exactly this class).
    let state;
    try {
      // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
      state = await loadState(loc.extensionRoot);
    } catch (err) {
      invalidBlocks.push({
        name: "state.json",
        scope,
        status: "failed",
        reasons: [narrowStateLoadFailReason(err)],
        // D-03: an invalid state.json pending block -> error.
        severity: "error",
        plugins: [],
      });
      continue;
    }

    // LAYER-06: a layer that declares a plugin without its marketplace stops
    // the scope as an invalid layer config does, so nothing is planned for it.
    const gapBlocks = layerMarketplaceGapBlocks(scope, loc, outcome, state);
    if (gapBlocks.length > 0) {
      invalidBlocks.push(...gapBlocks);
      continue;
    }

    // FSTAT-06: record this scope's marketplace clone roots + manifest paths so
    // the will-partially-install preview can resolve a planned install candidate
    // no-network (NFR-5). Keyed by `(scope, marketplace)` to disambiguate the
    // same marketplace name across scopes.
    for (const [mpName, record] of Object.entries(state.marketplaces)) {
      recordedMarketplaces.set(`${scope} ${mpName}`, {
        marketplaceRoot: record.marketplaceRoot,
        manifestPath: record.manifestPath,
      });
    }

    // PRN-02: each `will uninstall` row names the recorded version.
    recordedVersions.push(...recordedVersionEntries(scope, state));

    // D-21 / LOAD-01: the verdict `apply`'s read pass computes, so the
    // dependency buckets fill and the LOAD-02 lift proposes no enable the check
    // would undo. The walk reads cached manifests and installed copies only
    // (NFR-5) and takes no lock, so a concurrent apply is never blocked.
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one declaration walk each
    const firstVerdict = await buildScopeSatisfactionVerdict({ state, locations: loc });

    // MIG-01 pre-migration window (DIFF-01): plan against what the next
    // load's reconcile would actually see (the apply path migrates first),
    // not against an absent-as-empty merged view -- see mergedViewForPlanning.
    const view = mergedViewForPlanning(outcome, state);
    // D-08 / D-21: the verdict over the scope as the plan's toggles leave it,
    // as `apply`'s read pass takes it.
    const firstPlan = planReconcile(view, state, scope, firstVerdict);
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one second walk each
    const verdict = await verdictAfterToggles({ state, locations: loc }, firstVerdict, {
      enable: firstPlan.pluginsToEnable,
      disable: firstPlan.pluginsToDisable,
    });
    const plan = withPlannedInstallsLanded(
      verdict === firstVerdict ? firstPlan : planReconcile(view, state, scope, verdict),
      verdict,
      state,
      (released) => planReconcile(view, state, scope, released),
    );
    const scopePlan = withoutDisabledDependents(plan, state);
    plans.push(scopePlan);

    // APL-02 / D-10 / D-14: the catalog moves `apply` would make once the plan
    // has run, offline (NFR-5).
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one convergence plan each
    const scoped = await planConvergence({ scope, state, locations: loc, plan: scopePlan });
    convergence.moves.push(...scoped.moves);
    convergence.holds.push(...scoped.holds);
    convergence.declines.push(...scoped.declines);
  }

  // WR-06: name the workflow staging trees the sweeper keeps forever, because
  // their `.previous/` holds the only surviving copy of the user's previous
  // workflow scripts and no other surface reaches them.
  //
  // Called ONCE per report, deliberately OUTSIDE the per-scope loop above:
  // `workflowsStagingDir` and `workflowsHomeDir` are scope-INDEPENDENT, so the
  // scope handed to `locationsFor` is immaterial and a call inside the loop
  // would render the identical advisory twice whenever no scope was given.
  const retained = await retainedWorkflowsFacts(opts.cwd);

  // DIFF-01 SC #2 empty-steady-state: no invalid-config rows AND every plan
  // is empty -> no block. Every non-empty bucket yields a block, so an empty
  // list is exactly the empty case.
  const { moves, holds, declines } = convergence;
  if (
    invalidBlocks.length === 0 &&
    isReconcilePlanListEmpty(plans) &&
    moves.length + holds.length + declines.length === 0
  ) {
    return { marketplaces: [], retained, needsApply: false };
  }

  // Compose the cascade message: the projection emits the per-scope plan
  // blocks; the invalid-config / invalid-state blocks are merged in and the
  // whole list re-sorted via compareByNameThenScope so mixed output honours
  // the single per-scope row-order policy (MSG-GR-3: name primary
  // case-insensitive, project-before-user secondary) every other
  // list-rendering surface routes through. The two block sources never
  // collide on a key because the invalid path skips planReconcile for that
  // scope -- a scope can be EITHER in `plans` OR in `invalidBlocks`, never
  // both.
  // FSTAT-06 / D-66-04 / NFR-5: resolve each planned install candidate
  // no-network so the pending row renders `(will partially install)` when the
  // install would degrade (candidate resolves `partially-available`). The locator reads
  // only the recorded marketplace's on-disk manifest (cache; no network sync) +
  // delegates the resolve to resolvePendingForceInstalls (which owns the
  // resolveStrict call). An unrecorded marketplace or a missing manifest entry
  // yields no candidate, leaving the row a plain `(will install)`.
  const locateCandidate = async (
    install: PlannedPluginInstall,
  ): Promise<PendingInstallCandidate | undefined> => {
    const record = recordedMarketplaces.get(`${install.scope} ${install.marketplace}`);
    if (record === undefined) {
      return undefined;
    }

    const manifest = await loadMarketplaceManifest(record.manifestPath);
    const manifestEntry = manifest.plugins.find((p) => p.name === install.plugin);
    if (manifestEntry === undefined) {
      return undefined;
    }

    return { marketplaceRoot: record.marketplaceRoot, manifestEntry };
  };

  const forceInstallKeys = await resolvePendingForceInstalls(plans, locateCandidate);
  const projection = buildReconcilePendingNotification(
    plans,
    forceInstallKeys,
    new Map(recordedVersions),
    convergence,
  );
  // D-12 / OUT-07: the pending diff is bulk (it spans both scopes and many
  // marketplaces) -> Plural row cardinality. D-02: thread PENDING_CONTEXT so the
  // pending-tense rows resolve through reconcile's own row policies (MOD-03).
  // WR-01: the pending rows are assembled from the projection and invalid-block
  // builders, both typed to `MarketplaceRows<PendingMsg>`, so the annotation
  // holds without a cast -- every emitted plugin row is a PendingMsg member by
  // construction.
  const marketplaces: Plural<MarketplaceRows<PendingMsg>> = [
    ...projection.marketplaces,
    ...invalidBlocks,
  ].sort((a, b) => compareByNameThenScope(a, b));

  // APL-04 / D-14: a list with a change `apply` would make, a catalog move
  // included, ends with the apply trailer; a list of failures or of held moves
  // alone does not, since `apply` changes nothing for them (D-12).
  return {
    marketplaces,
    retained,
    needsApply: planListNeedsApply(plans) || moves.length > 0,
  };
}

/**
 * D-05 / D-06: sends a non-empty report as the pending cascade. `pending` and
 * the load both send it here, so the two print the same bytes.
 */
export function notifyPendingReport(
  ctx: NotificationContext,
  run: NotificationRun,
  report: PendingReport,
): void {
  // WR-06: both message arms carry the same observations from the single scan.
  notifyWithContext(ctx, run, PENDING_CONTEXT, report.marketplaces, undefined, "plural", {
    ...report.retained,
    ...(report.needsApply && { needsApply: true }),
  });
}

export async function pendingReconcile(opts: PendingReconcileOptions): Promise<void> {
  // Project-first per MSG-GR-3 when both scopes are searched; otherwise the
  // explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  const report = await composePendingReport({ cwd: opts.cwd, scopes });

  // DIFF-01 SC #2: the empty case is the dedicated ReconcilePendingEmptyMessage
  // variant (the renderer hard-codes the catalog-locked advisory body line, so
  // the byte form cannot drift from docs/output-catalog.md). IL-2 preserved by
  // routing through notify() exactly once. WR-06: the retained-tree lines ride
  // the same variant, so the steady-state reader meets the identical trailer.
  if (report.marketplaces.length === 0) {
    notify(opts.ctx, opts.run, {
      kind: "reconcile-pending-empty",
      command: "pending",
      ...report.retained,
    });
    return;
  }

  notifyPendingReport(opts.ctx, opts.run, report);
}
