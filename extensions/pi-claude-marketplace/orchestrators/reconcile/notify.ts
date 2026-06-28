// orchestrators/reconcile/notify.ts
//
// DIFF-02 pure plan-to-notification projection. Mirrors
// `buildImportNotificationMarketplaces` (in `orchestrators/import/execute.ts`)
// in shape and ordering discipline: groups every Plan action by
// `(scope, marketplace)` into a `MarketplaceBlock`, sorts the resulting
// blocks via `compareByNameThenScope` (name primary case-insensitive, scope
// secondary project-before-user per MSG-GR-3), and constructs the concrete
// per-status `MarketplaceNotificationMessage` arm for each block.
//
// Pure: no I/O. The function NEVER calls `ctx.ui.notify` or any seam in
// `shared/notify.ts` beyond importing the types and the comparator.
//
// Token mapping (pending-tense set):
//
//   marketplacesToAdd     -> dropped; marketplace add is immediate (WILL-01 /
//                            D-65.1-02). Any child installs still build a
//                            bare-header block via pluginsToInstall.
//   marketplacesToRemove  -> per-recorded-plugin child row
//                            { status: "will uninstall" } under a bare list-arm
//                            header (status undefined). De-registration is
//                            immediate; only the plugin-uninstall cascade is
//                            reload-deferred (WILL-03 / D-65.1-03).
//   sourceMismatches      -> block.status = "failed", reasons: ["source mismatch"]
//   pluginsToInstall      -> child row { status: "will install" }
//   pluginsToUninstall    -> child row { status: "will uninstall" }
//   pluginsToDisable      -> child row { status: "will disable" }
//   pluginsToEnable       -> child row { status: "will enable" }
//                            (recorded-but-disabled detection via the
//                            empty-resources marker)
//
// The empty-plan case is handled by the orchestrator (`pending.ts`) which
// switches on `plans.every(isPlanEmpty)` and emits a free-form advisory line
// for the catalog's `empty-steady-state` byte form. The projection itself
// returns a `CascadeNotificationMessage` with the marketplaces array empty
// (which would otherwise render as the `(no marketplaces)` sentinel) -- the
// orchestrator detects emptiness BEFORE calling this projection so the
// advisory takes precedence.

import { resolveStrict } from "../../domain/resolver.ts";
import { assertNever } from "../../shared/errors.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import { sourceMismatchOutcomeSubject } from "./apply-outcomes.ts";
import { plannedSourceMismatchSubject } from "./types.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { PendingMsg, ReconcileAppliedMsg } from "./reconcile.messaging.ts";
import type { PlannedPluginInstall, ReconcilePlan } from "./types.ts";
import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { MarketplaceRows, WithPlugins } from "../../shared/notify-context.ts";
import type {
  ContentReason,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  PluginNotificationMessage,
  Reason,
  ReconcileAppliedCascadeMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * S8 (PR #51): `status` is narrowed to the closed set the pending /
 * applied-cascade projections actually assign. The pending list no longer
 * assigns any marketplace-level status (add is immediate -> dropped; remove is
 * surfaced as per-plugin `will uninstall` child rows under a bare header --
 * WILL-01 / WILL-03 / D-65.1-02 / D-65.1-03), so only the apply-cascade
 * transition tokens (`"added"` / `"removed"` / `"failed"`) remain. The
 * `"updated"` / `"autoupdate enabled"` / `"autoupdate disabled"` / `"skipped"`
 * members of `MarketplaceStatus` belong to other surfaces (autoupdate flip,
 * marketplace update); the reconcile projection never sets them, so the
 * previous defensive runtime throw at `blockToMarketplaceMessage` is replaced
 * by this type narrowing.
 */
type ReconcileBlockStatus = Extract<MarketplaceStatus, "added" | "removed" | "failed">;

interface MarketplaceBlock<Msg extends PluginNotificationMessage = PluginNotificationMessage> {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: ReconcileBlockStatus;
  reasons?: readonly ContentReason[];
  plugins: Msg[];
}

function ensureMarketplaceBlock<Msg extends PluginNotificationMessage>(
  byMp: Map<string, MarketplaceBlock<Msg>>,
  scope: Scope,
  marketplaceName: string,
): MarketplaceBlock<Msg> {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const block: MarketplaceBlock<Msg> = {
    key,
    name: marketplaceName,
    scope,
    plugins: [],
  };
  byMp.set(key, block);
  return block;
}

/**
 * Construct the concrete per-status `MarketplaceNotificationMessage` arm for
 * an accumulated block. Token set:
 *  - `"added"` / `"removed"` are the realized apply-time transition statuses.
 *  - `"failed"` is reused for source-mismatch blocks; its `reasons` is the
 *    existing `"source mismatch"` REASONS member (no new REASONS literal --
 *    the closed set already covers it).
 *  - `undefined` is the list/inventory arm; used when a block carries only
 *    plugin child rows (e.g. a pending-uninstall under an existing
 *    marketplace whose source matches, or a marketplace-remove cascade whose
 *    per-plugin `will uninstall` rows ride a bare header -- WILL-03).
 */
function blockToMarketplaceMessage<Msg extends PluginNotificationMessage>(
  block: MarketplaceBlock<Msg>,
): WithPlugins<MarketplaceNotificationMessage, Msg> {
  const name = block.name;
  const scope = block.scope;
  const plugins = Object.freeze(block.plugins);
  // S8 (PR #51): the defensive runtime throw for `"updated"` /
  // `"autoupdate enabled"` / `"autoupdate disabled"` / `"skipped"` has been
  // deleted; `MarketplaceBlock.status` is now narrowed to
  // `ReconcileBlockStatus` so any attempt to assign one of those tokens here
  // is a compile error caught at edit time instead of a runtime signal.
  switch (block.status) {
    case "added":
      // RECON-04: realized apply-time transition token.
      return { name, scope, status: "added", plugins };
    case "removed":
      // RECON-04: realized apply-time transition token.
      return { name, scope, status: "removed", plugins };
    case "failed":
      return {
        name,
        scope,
        status: "failed",
        // D-03: a failed reconcile block -> error.
        severity: "error",
        plugins,
        ...(block.reasons !== undefined && { reasons: block.reasons }),
      };
    case undefined:
      return { name, scope, plugins };
    default:
      assertNever(block.status);
  }
}

/**
 * Fold one `PlannedSourceMismatch` into its `(scope, name)` block, where
 * `name` is the renderable subject derived from the cause (see
 * `plannedSourceMismatchSubject`: mp name for source-mismatch /
 * unknown-stored / dangling-reference; rawKey for malformed-plugin-key).
 * Source-mismatch supersedes any prior status (the declaration cannot be
 * honoured byte-for-byte). Reuse the existing "source mismatch" REASONS
 * member; do NOT add a new REASONS literal.
 *
 * Plugin-level diagnostics (`dangling-reference` only) surface the
 * offending plugin as a child (failed) row so N dangling plugins under one
 * undeclared marketplace stay individually attributable instead of
 * collapsing into one anonymous marketplace row.
 */
function applySourceMismatch(
  block: MarketplaceBlock<PendingMsg>,
  mismatch: ReconcilePlan["sourceMismatches"][number],
): void {
  block.status = "failed";
  block.reasons = ["source mismatch"];
  if (mismatch.cause === "dangling-reference") {
    block.plugins.push({
      status: "failed",
      name: mismatch.plugin,
      reasons: ["source mismatch"],
      // D-03/D-06: a dangling-reference source mismatch -> error, no reload.
      severity: "error",
      needsReload: false,
    });
  }
}

/**
 * WILL-03 / D-65.1-03: fold one removed marketplace into its block as a
 * reload-deferred plugin-uninstall cascade. De-registration is immediate (no
 * marketplace-level `will` token); synthesize one `will uninstall` child row
 * per recorded plugin under a bare list-arm header (status left undefined).
 * The names come from the plan DTO's `plugins` field -- NOT
 * `plan.pluginsToUninstall`, which the planner deliberately omits removed-
 * marketplace plugins from to avoid double-billing the apply cascade. A remove
 * with no recorded plugins has no reload-deferred cascade, so it shows nothing
 * pending: skip the block entirely rather than emit a bare header.
 */
function pushMarketplaceRemoveCascade(
  byMp: Map<string, MarketplaceBlock<PendingMsg>>,
  o: ReconcilePlan["marketplacesToRemove"][number],
): void {
  if (o.plugins.length === 0) {
    return;
  }

  const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
  for (const pluginName of o.plugins) {
    block.plugins.push({
      status: "will uninstall",
      name: pluginName,
    });
  }
}

/**
 * Pure projection: ReconcilePlan[] -> pending marketplace rows. The rows are
 * typed `MarketplaceRows<PendingMsg>` so the projection's plugin children are
 * statically pinned to the pending render map's status set -- the consumer
 * (`pendingReconcile`) routes them through `notifyWithContext` without a cast.
 *
 * Every plan action is folded into its `(scope, marketplace)` block. The
 * mapping is:
 *
 *   - marketplacesToAdd     -> dropped; marketplace add is immediate (WILL-01 /
 *                              D-65.1-02). Child installs still build a
 *                              bare-header block via pluginsToInstall.
 *   - marketplacesToRemove  -> per-recorded-plugin child row
 *                              { status: "will uninstall" } under a bare
 *                              list-arm header (status undefined). De-
 *                              registration is immediate; only the plugin-
 *                              uninstall cascade is reload-deferred (WILL-03 /
 *                              D-65.1-03). Names come from the plan DTO's
 *                              `plugins` field, NOT pluginsToUninstall (which
 *                              deliberately omits removed-marketplace plugins
 *                              to avoid double-billing the apply cascade).
 *   - sourceMismatches      -> block.status = "failed", reasons:
 *                              ["source mismatch"] (reuses the existing
 *                              REASONS member; no new literal)
 *   - pluginsToInstall      -> child row { status: "will install" }
 *   - pluginsToUninstall    -> child row { status: "will uninstall" }
 *   - pluginsToDisable      -> child row { status: "will disable" }
 *   - pluginsToEnable       -> child row { status: "will enable" }
 *                              (recorded-but-disabled detection via the
 *                              empty-resources marker)
 *
 * Ordering: blocks are sorted by `compareByNameThenScope` (name primary
 * case-insensitive, project-before-user secondary). Plugin rows within a
 * block preserve insertion order per their owning bucket -- the apply path
 * will re-order at execution time if needed.
 */
/**
 * FSTAT-06 / D-66-04: the no-network resolve inputs for a planned install
 * candidate -- the candidate manifest entry plus the marketplace clone root it
 * resolves against. Located by the caller (`pendingReconcile`) from the
 * recorded marketplace's on-disk manifest; `resolveStrict` reads the cache
 * only (NFR-5).
 */
export interface PendingInstallCandidate {
  readonly marketplaceRoot: string;
  readonly manifestEntry: MarketplaceManifest["plugins"][number];
}

/**
 * Locate the no-network resolve inputs for a planned install. Returns
 * `undefined` when the candidate cannot be resolved offline -- e.g. the
 * marketplace is being added in the same run (not yet cloned) or its manifest
 * lacks the plugin entry -- in which case the row stays a plain
 * `(will install)` (the preview cannot truthfully claim a degrade).
 */
export type PendingInstallCandidateLocator = (
  install: PlannedPluginInstall,
) => Promise<PendingInstallCandidate | undefined>;

/**
 * Canonical force-install key over the `(scope, marketplace, plugin)` tuple
 * shared between the async resolver (`resolvePendingForceInstalls`) and the
 * pure projection (`buildReconcilePendingNotification`). NUL-delimited so a
 * name carrying a delimiter character cannot collide two distinct installs.
 */
function forceInstallKey(scope: Scope, marketplace: string, plugin: string): string {
  return `${scope}\u0000${marketplace}\u0000${plugin}`;
}

/**
 * FSTAT-06 / D-66-04 / NFR-5: resolve every planned install candidate
 * no-network via `resolveStrict` and collect the `(scope, marketplace, plugin)`
 * keys whose candidate resolves `state === "unsupported"` -- the planned
 * install would degrade and proceed under the force path, so its pending row
 * renders `(will force install)`. The resolve is the cache/no-network resolver
 * (guarded by the `no-orchestrator-network` architecture test); a probe throw
 * or an unlocatable candidate degrades to NO force (the safe, truthful preview
 * default), never a crash on this read-only surface (IL-2).
 *
 * D-66-05: there is deliberately NO `will force update` analog. The
 * `ReconcilePlan` has no update bucket (install/uninstall/enable/disable +
 * marketplace add/remove + sourceMismatches only), so only `pluginsToInstall`
 * is resolved here -- the will-force-update token is vacuous.
 */
export async function resolvePendingForceInstalls(
  plans: readonly ReconcilePlan[],
  locate: PendingInstallCandidateLocator,
): Promise<ReadonlySet<string>> {
  const keys = new Set<string>();
  for (const plan of plans) {
    for (const install of plan.pluginsToInstall) {
      let candidate: PendingInstallCandidate | undefined;
      try {
        candidate = await locate(install);
        if (candidate === undefined) {
          continue;
        }

        const resolved = await resolveStrict(candidate.manifestEntry, {
          marketplaceRoot: candidate.marketplaceRoot,
        });
        if (resolved.state === "unsupported") {
          keys.add(forceInstallKey(install.scope, install.marketplace, install.plugin));
        }
      } catch {
        // A manifest-load / probe failure leaves the row a plain
        // `(will install)`: the offline preview cannot assert a degrade it
        // could not resolve, and a throw must never escape the read-only
        // pending surface (IL-2 single-notify discipline).
      }
    }
  }

  return keys;
}

export function buildReconcilePendingNotification(
  plans: readonly ReconcilePlan[],
  forceInstallKeys: ReadonlySet<string> = new Set<string>(),
): {
  readonly marketplaces: readonly MarketplaceRows<PendingMsg>[];
} {
  const byMp = new Map<string, MarketplaceBlock<PendingMsg>>();

  for (const plan of plans) {
    // marketplacesToAdd: no projection. Marketplace add is immediate (WILL-01 /
    // D-65.1-02), so it carries no pending row; any child installs are still
    // surfaced through the pluginsToInstall loop below.

    for (const o of plan.marketplacesToRemove) {
      pushMarketplaceRemoveCascade(byMp, o);
    }

    for (const o of plan.sourceMismatches) {
      applySourceMismatch(
        ensureMarketplaceBlock(byMp, o.scope, plannedSourceMismatchSubject(o)),
        o,
      );
    }

    for (const o of plan.pluginsToInstall) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      // FSTAT-06 / D-66-04: stamp the force modifier when the planned install
      // candidate resolved `unsupported` (no-network resolveStrict, computed
      // ahead of time by resolvePendingForceInstalls). The modifier renders
      // `(will force install)` in place of `(will install)`. D-66-05: there is
      // deliberately NO `will force update` analog -- the ReconcilePlan has no
      // update bucket (only install/uninstall/enable/disable + marketplace
      // add/remove + sourceMismatches), so no force-update row is ever
      // constructed here; the will-force-update token is vacuous.
      const force = forceInstallKeys.has(forceInstallKey(o.scope, o.marketplace, o.plugin));
      block.plugins.push({
        status: "will install",
        name: o.plugin,
        ...(force && { force: true }),
      });
    }

    for (const o of plan.pluginsToUninstall) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "will uninstall",
        name: o.plugin,
      });
    }

    for (const o of plan.pluginsToDisable) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "will disable",
        name: o.plugin,
      });
    }

    for (const o of plan.pluginsToEnable) {
      // The bucket is populated only when a recorded plugin carries the
      // empty-resources marker (`isRecordedButDisabled` in plan.ts). The
      // loop runs unconditionally so the enable wiring exercises this
      // projection arm whenever the planner produced any enable rows.
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "will enable",
        name: o.plugin,
      });
    }
  }

  return {
    marketplaces: Object.freeze(
      [...byMp.values()]
        .sort((a, b) => compareByNameThenScope(a, b))
        .map(blockToMarketplaceMessage),
    ),
  };
}

/**
 * DIFF-01 SC #2 empty-plan helper. Returns `true` iff every plan would produce
 * NO pending row. Consumed by `orchestrators/reconcile/pending.ts` so the
 * orchestrator can route the empty case to the catalog's `empty-steady-state`
 * advisory body line BEFORE invoking the projection (which would otherwise emit
 * the `(no marketplaces)` sentinel).
 *
 * WILL-01 / D-65.1-02 / D-65.1-03: marketplace add is immediate and produces no
 * pending row by itself, so `marketplacesToAdd` is NOT counted -- a change
 * consisting only of immediate marketplace adds yields the empty advisory. A
 * `marketplacesToRemove` entry only contributes pending rows when it carries
 * recorded plugins (its reload-deferred uninstall cascade); a removal with no
 * recorded plugins is immediate de-registration and contributes nothing. The
 * surviving plugin-level buckets always map to a pending row.
 */
export function isReconcilePlanListEmpty(plans: readonly ReconcilePlan[]): boolean {
  return plans.every(
    (p) =>
      p.marketplacesToRemove.every((m) => m.plugins.length === 0) &&
      p.pluginsToInstall.length === 0 &&
      p.pluginsToUninstall.length === 0 &&
      p.pluginsToEnable.length === 0 &&
      p.pluginsToDisable.length === 0 &&
      p.sourceMismatches.length === 0,
  );
}

// ---------------------------------------------------------------------------
// RECON-04: apply-cascade projection.
//
// `buildReconcileAppliedCascade(outcomes)` folds the per-entry orchestrator
// outcomes (success + failure) plus the planner-only source-mismatches and
// the read-pass invalid-config rows into a single
// `ReconcileAppliedCascadeMessage`. Token mapping reuses the existing
// closed-set transition tokens (`added` / `removed` / `installed` /
// `uninstalled` / `disabled` / `failed`) -- no new STATUS_TOKENS /
// PLUGIN_STATUSES / MARKETPLACE_STATUSES / REASONS / MARKERS literals.
//
// T-55-02-02 mitigation: this projection consumes `outcome.reason` only.
// Raw `error.message` is NEVER read into a row's reasons field or anywhere
// else in the rendered output. The catch ladders in `apply.ts` translate
// orchestrator throws into typed outcomes BEFORE they reach this projection.
// ---------------------------------------------------------------------------

/**
 * `enabled` is NOT a member of PLUGIN_STATUSES (only `disabled` is). A
 * successful enable re-materializes the plugin via installPlugin, so the
 * projection emits the `installed` row (with empty dependencies -- the
 * orchestrated EnableDisablePluginOutcome does not carry declaresAgents /
 * declaresMcp). The reverse asymmetry (a successful disable maps to
 * `disabled`) is structural: `disabled` IS a member of PLUGIN_STATUSES.
 */
function applyOutcomeToBlock(
  block: MarketplaceBlock<ReconcileAppliedMsg>,
  outcome: PerEntryOutcome,
): void {
  switch (outcome.kind) {
    case "mp-added":
      block.status = "added";
      return;
    case "mp-removed":
      block.status = "removed";
      return;
    case "mp-add-failed":
    case "mp-remove-failed":
      block.status = "failed";
      block.reasons = reasonAsContent(outcome.reason);
      return;
    case "mp-remove-partial":
      // I1 / PR #51: bare `(failed)` mp header -- the per-plugin children
      // carry the granular reasons (mirrors the standalone CMC-31 PARTIAL
      // byte form). Do NOT set block.reasons; the renderer's MpFailed arm
      // collapses to `⊘ <name> [<scope>] (failed)` when reasons is absent.
      block.status = "failed";
      return;
    case "plugin-installed":
      block.plugins.push({
        status: "installed",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        dependencies: outcome.dependencies,
        // D-03/D-06: realized install transition -> info, reloads. (The
        // reconcile-applied cascade still suppresses the /reload trailer at the
        // kind level -- RECON-04 -- so this needsReload never surfaces a hint.)
        severity: "info",
        needsReload: true,
      });
      return;
    case "plugin-backfilled":
      // BFILL-01 / D-68-04: a load-time backfill re-materialized the plugin in
      // place. The re-resolved `installable` selects the row: a fully promoted
      // plugin (unsupported set now empty) reuses the `installed` row including
      // `dependencies` for the soft-dep markers; a partial re-materialize (still
      // degraded) renders a `force-installed` row. Both fold into THIS single
      // applied cascade -- no second notify() (RECON-04).
      if (outcome.installable) {
        block.plugins.push({
          status: "installed",
          name: outcome.plugin,
          ...(outcome.version !== undefined && { version: outcome.version }),
          dependencies: outcome.dependencies,
          severity: "info",
          needsReload: true,
        });
      } else {
        block.plugins.push({
          status: "force-installed",
          name: outcome.plugin,
          ...(outcome.version !== undefined && { version: outcome.version }),
          dependencies: outcome.dependencies,
          // SEV-05 / D-69-04: populate the factual `{reasons}` brace from the
          // re-resolved dropped-component kinds through the SAME shared
          // `narrowUnsupportedKinds` seam the install/list/info surfaces use --
          // no per-state reasons mechanism. An empty set renders brace-less
          // (byte-identical to a no-dropped-kinds backfill).
          reasons: narrowUnsupportedKinds(outcome.unsupported),
          // SEV-03 / A3: a backfill is a benign promotion (re-materializing
          // now-supported components), NOT a new degradation, so it stays info.
          // The SEV-03 newly-degrades warning fires only on the autoupdate
          // cascade, not on this load-time backfill row.
          severity: "info",
          needsReload: true,
        });
      }

      return;
    case "plugin-uninstalled":
      block.plugins.push({
        status: "uninstalled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        // D-03/D-06: realized uninstall transition -> info, reloads.
        severity: "info",
        needsReload: true,
      });
      return;
    case "plugin-enabled":
      // Reuse existing transition tokens (no new closed-set literal). The
      // enable branch re-materializes via runInstallLedger so the realized
      // outcome IS an install -- `(installed)` is the truthful surface row.
      // No dependencies plumbed from EnableDisablePluginOutcome (the orchestrator
      // doesn't expose declaresAgents / declaresMcp on the enabled arm); the
      // empty dependencies array suppresses soft-dep markers, which is the
      // safe default for a re-materialization that wouldn't change the
      // companion-extension surface.
      block.plugins.push({
        status: "installed",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        dependencies: [],
        // D-03/D-06: a realized re-enable re-materializes artefacts -> info,
        // reloads.
        severity: "info",
        needsReload: true,
      });
      return;
    case "plugin-disabled":
      block.plugins.push({
        status: "disabled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        // D-03/D-06: a realized disable transition -> info, reloads.
        severity: "info",
        needsReload: true,
      });
      return;
    case "plugin-install-failed":
    case "plugin-uninstall-failed":
    case "plugin-enable-failed":
    case "plugin-disable-failed":
      block.plugins.push({
        status: "failed",
        name: outcome.plugin,
        reasons: reasonAsContent(outcome.reason),
        // D-03/D-06: a failed reconcile apply row -> error, no reload.
        severity: "error",
        needsReload: false,
      });
      return;
    case "source-mismatch":
      block.status = "failed";
      block.reasons = ["source mismatch"];
      if (outcome.cause === "dangling-reference") {
        block.plugins.push({
          status: "failed",
          name: outcome.plugin,
          reasons: ["source mismatch"],
          // D-03/D-06: a dangling-reference source mismatch -> error, no reload.
          severity: "error",
          needsReload: false,
        });
      }

      return;
    case "invalid-block":
      // CFG-03 row: the row subject IS the file basename (T-55-02-01).
      // The block is keyed by (scope, basename) so multiple invalid files in
      // the same scope render as distinct rows.
      block.status = "failed";
      block.reasons = [outcome.reason];
      // I5 / PR #51: when loadConfig's diagnostic detail was threaded in
      // (EACCES vs JSON parse vs schema key), surface it via a synthetic
      // PluginFailedMessage child carrying the cause -- mirrors the SNM-10
      // pattern used by autoupdateFailedRow. The MarketplaceNotificationMessage
      // header itself cannot carry a cause (SNM-10 confines causes to
      // plugin-row + manual-recovery surfaces), so the synthetic child is the
      // only IL-2-compatible channel that drives the depth-5 cause-chain
      // trailer below the row. Path tokens were already stripped at the apply
      // boundary via redactAbsolutePaths (T-53-02-02 / T-55-02-01).
      if (outcome.cause !== undefined) {
        block.plugins.push({
          status: "failed",
          name: outcome.basename,
          reasons: [outcome.reason],
          cause: outcome.cause,
          // D-03/D-06: a synthetic invalid-config child -> error, no reload.
          severity: "error",
          needsReload: false,
        });
      }

      return;
    default:
      assertNever(outcome);
  }
}

/**
 * Derive the renderable block-key subject from a per-entry outcome. Most
 * variants carry `marketplace`; the Y2 / Y4 cuts moved two subjects off
 * that field:
 *   - `invalid-block` carries `basename` (the file basename, T-55-02-01).
 *   - `source-mismatch` of cause `"malformed-plugin-key"` carries `rawKey`
 *     (the raw user-typed config key, NOT a marketplace name).
 *
 * Centralising the derivation here keeps the byte form of the cascade
 * identical across the four source-mismatch causes and across the
 * invalid-block rename.
 */
function outcomeSubject(outcome: PerEntryOutcome): string {
  if (outcome.kind === "invalid-block") {
    return outcome.basename;
  }

  if (outcome.kind === "source-mismatch") {
    return sourceMismatchOutcomeSubject(outcome);
  }

  return outcome.marketplace;
}

/**
 * Narrow a broader `Reason` to `ContentReason` for `block.reasons` /
 * plugin-row `reasons`. The structural `"not added"` sentinel is unreachable
 * here: it would only arise from a missing-marketplace outcome, but the
 * planner-driven apply pass only drives an orchestrator when the
 * marketplace IS recorded (or being added). A defensive fallback maps the
 * sentinel to `"not found"` so the projection never crashes; this branch is
 * unreachable in normal operation.
 */
function reasonAsContent(reason: Reason): readonly ContentReason[] {
  if (reason === "not added") {
    return ["not found"];
  }

  return [reason];
}

/**
 * RECON-04: pure projection. Folds the per-entry orchestrator outcomes into
 * a single `ReconcileAppliedCascadeMessage`. Block ordering:
 * `compareByNameThenScope` (project-before-user per MSG-GR-3); plugin rows
 * within a block preserve insertion order from the apply loop. Empty-and-
 * clean inputs return a message whose `marketplaces` array is empty -- the
 * caller (apply.ts) MUST short-circuit and skip the notify() call on that
 * shape per the load-time silence contract (NFR-2 / A4).
 */
export function buildReconcileAppliedCascade(
  outcomes: readonly PerEntryOutcome[],
): ReconcileAppliedCascadeMessage {
  // RECON-04 / WR-02: pin the block's plugin children to the applied context's
  // `ReconcileAppliedMsg` union so each `applyOutcomeToBlock` push is checked
  // against the render map's status set (installed/uninstalled/disabled/failed).
  // A status drift between this producer and `RECONCILE_APPLIED_CONTEXT.render`
  // is then a compile error here, not a reachable `dispatchRow` fallback at load
  // time. The resulting rows widen to the broad `ReconcileAppliedCascadeMessage`
  // shape (a safe upcast, mirroring the pending-cascade pattern).
  const byMp = new Map<string, MarketplaceBlock<ReconcileAppliedMsg>>();

  for (const outcome of outcomes) {
    // Block keying derives the renderable subject per outcome variant: most
    // outcomes carry `marketplace`; `invalid-block` carries `basename` (the
    // file basename so distinct invalid files render as distinct rows); a
    // `source-mismatch` of cause `"malformed-plugin-key"` carries `rawKey`.
    // Every variant routes through ensureMarketplaceBlock so the
    // (scope, name) key is the single accumulation seam.
    const block = ensureMarketplaceBlock(byMp, outcome.scope, outcomeSubject(outcome));
    applyOutcomeToBlock(block, outcome);
  }

  return {
    kind: "reconcile-applied-cascade",
    marketplaces: Object.freeze(
      [...byMp.values()]
        .sort((a, b) => compareByNameThenScope(a, b))
        .map(blockToMarketplaceMessage),
    ),
  };
}
