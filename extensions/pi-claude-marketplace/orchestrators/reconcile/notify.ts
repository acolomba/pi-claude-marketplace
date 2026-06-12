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
// Token mapping (DIFF-02 pending-tense set):
//
//   marketplacesToAdd     -> block.status = "will add"
//   marketplacesToRemove  -> block.status = "will remove"
//   sourceMismatches      -> block.status = "failed", reasons: ["source mismatch"]
//   pluginsToInstall      -> child row { status: "will install" }
//   pluginsToUninstall    -> child row { status: "will uninstall" }
//   pluginsToDisable      -> child row { status: "will disable" }
//   pluginsToEnable       -> child row { status: "will enable" }
//                            (recorded-but-disabled detection via the
//                            empty-resources marker)
//
// The empty-plan case is handled by the orchestrator (`preview.ts`) which
// switches on `plans.every(isPlanEmpty)` and emits a free-form advisory line
// for the catalog's `empty-steady-state` byte form. The projection itself
// returns a `CascadeNotificationMessage` with the marketplaces array empty
// (which would otherwise render as the `(no marketplaces)` sentinel) -- the
// orchestrator detects emptiness BEFORE calling this projection so the
// advisory takes precedence.

import { assertNever } from "../../shared/errors.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";

import { sourceMismatchOutcomeSubject } from "./apply-outcomes.ts";
import { plannedSourceMismatchSubject } from "./types.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ReconcilePlan } from "./types.ts";
import type {
  CascadeNotificationMessage,
  ContentReason,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  PluginNotificationMessage,
  Reason,
  ReconcileAppliedCascadeMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * S8 (PR #51): `status` is narrowed to the closed set the preview /
 * applied-cascade projections actually assign (`"will add"` / `"will remove"`
 * from the preview; `"added"` / `"removed"` / `"failed"` from the apply
 * cascade). The `"updated"` / `"autoupdate enabled"` / `"autoupdate disabled"`
 * / `"skipped"` members of `MarketplaceStatus` belong to other surfaces
 * (autoupdate flip, marketplace update); the reconcile projection never sets
 * them, so the previous defensive runtime throw at `blockToMarketplaceMessage`
 * is replaced by this type narrowing.
 */
type ReconcileBlockStatus = Extract<
  MarketplaceStatus,
  "will add" | "will remove" | "added" | "removed" | "failed"
>;

interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: ReconcileBlockStatus;
  reasons?: readonly ContentReason[];
  plugins: PluginNotificationMessage[];
}

function ensureMarketplaceBlock(
  byMp: Map<string, MarketplaceBlock>,
  scope: Scope,
  marketplaceName: string,
): MarketplaceBlock {
  const key = `${scope}:${marketplaceName}`;
  const existing = byMp.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const block: MarketplaceBlock = {
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
 * an accumulated block. DIFF-02 token set:
 *  - `"will add"` / `"will remove"` are the new pending-tense marketplace
 *    statuses.
 *  - `"failed"` is reused for source-mismatch blocks; its `reasons` is the
 *    existing `"source mismatch"` REASONS member (no new REASONS literal --
 *    the closed set already covers it).
 *  - `undefined` is the list/inventory arm; used when a block carries only
 *    plugin child rows (e.g. a pending-uninstall under an existing
 *    marketplace whose source matches).
 */
function blockToMarketplaceMessage(block: MarketplaceBlock): MarketplaceNotificationMessage {
  const name = block.name;
  const scope = block.scope;
  const plugins = Object.freeze(block.plugins);
  // S8 (PR #51): the defensive runtime throw for `"updated"` /
  // `"autoupdate enabled"` / `"autoupdate disabled"` / `"skipped"` has been
  // deleted; `MarketplaceBlock.status` is now narrowed to
  // `ReconcileBlockStatus` so any attempt to assign one of those tokens here
  // is a compile error caught at edit time instead of a runtime signal.
  switch (block.status) {
    case "will add":
      return { name, scope, status: "will add", plugins };
    case "will remove":
      return { name, scope, status: "will remove", plugins };
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
  block: MarketplaceBlock,
  mismatch: ReconcilePlan["sourceMismatches"][number],
): void {
  block.status = "failed";
  block.reasons = ["source mismatch"];
  if (mismatch.cause === "dangling-reference") {
    block.plugins.push({
      status: "failed",
      name: mismatch.plugin,
      reasons: ["source mismatch"],
    });
  }
}

/**
 * Pure projection: ReconcilePlan[] -> CascadeNotificationMessage.
 *
 * Every plan action is folded into its `(scope, marketplace)` block. The
 * mapping is:
 *
 *   - marketplacesToAdd     -> block.status = "will add"
 *   - marketplacesToRemove  -> block.status = "will remove"
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
export function buildReconcilePreviewNotification(
  plans: readonly ReconcilePlan[],
): CascadeNotificationMessage {
  const byMp = new Map<string, MarketplaceBlock>();

  for (const plan of plans) {
    for (const o of plan.marketplacesToAdd) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.status = "will add";
    }

    for (const o of plan.marketplacesToRemove) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.status = "will remove";
    }

    for (const o of plan.sourceMismatches) {
      applySourceMismatch(
        ensureMarketplaceBlock(byMp, o.scope, plannedSourceMismatchSubject(o)),
        o,
      );
    }

    for (const o of plan.pluginsToInstall) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "will install",
        name: o.plugin,
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
 * DIFF-01 SC #2 empty-plan helper. Returns `true` iff every action bucket on
 * every plan is empty. Consumed by `orchestrators/reconcile/preview.ts` so
 * the orchestrator can route the empty case to the catalog's
 * `empty-steady-state` advisory body line BEFORE invoking the projection
 * (which would otherwise emit the `(no marketplaces)` sentinel).
 */
export function isReconcilePlanListEmpty(plans: readonly ReconcilePlan[]): boolean {
  return plans.every(
    (p) =>
      p.marketplacesToAdd.length === 0 &&
      p.marketplacesToRemove.length === 0 &&
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
function applyOutcomeToBlock(block: MarketplaceBlock, outcome: PerEntryOutcome): void {
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
      });
      return;
    case "plugin-uninstalled":
      block.plugins.push({
        status: "uninstalled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
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
      });
      return;
    case "plugin-disabled":
      block.plugins.push({
        status: "disabled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
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
  const byMp = new Map<string, MarketplaceBlock>();

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
