// orchestrators/reconcile/notify.ts
//
// DIFF-01 + DIFF-02 pure plan-to-notification projection. Mirrors
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
// DIFF-02 (Phase 53 Plan 02) replaces the Plan 01 placeholder strings
// ("added" / "removed" / "uninstalled" / "skipped+already installed") with
// the real pending-tense token set:
//
//   marketplacesToAdd     -> block.status = "will add"
//   marketplacesToRemove  -> block.status = "will remove"
//   sourceMismatches      -> block.status = "failed", reasons: ["source mismatch"]
//   pluginsToInstall      -> child row { status: "will install" }
//   pluginsToUninstall    -> child row { status: "will uninstall" }
//   pluginsToDisable      -> child row { status: "will disable" }
//   pluginsToEnable       -> child row { status: "will enable" }
//                            (structurally empty in Phase 53 per Pitfall 53-4)
//
// The empty-plan case is handled by the orchestrator (`preview.ts`) which
// switches on `plans.every(isPlanEmpty)` and emits a free-form advisory line
// for the catalog's `empty-steady-state` byte form. The projection itself
// returns a `CascadeNotificationMessage` with the marketplaces array empty
// (which would otherwise render as the `(no marketplaces)` sentinel) -- the
// orchestrator detects emptiness BEFORE calling this projection so the
// advisory takes precedence.

import { compareByNameThenScope } from "../../shared/notify.ts";

import type { ReconcilePlan } from "./types.ts";
import type {
  CascadeNotificationMessage,
  ContentReason,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  PluginNotificationMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: MarketplaceStatus;
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
 *    existing `"source mismatch"` REASONS member (Pitfall 53-7 -- REASONS
 *    stays at 29 entries).
 *  - `undefined` is the list/inventory arm; used when a block carries only
 *    plugin child rows (e.g. a pending-uninstall under an existing
 *    marketplace whose source matches).
 */
function blockToMarketplaceMessage(block: MarketplaceBlock): MarketplaceNotificationMessage {
  const name = block.name;
  const scope = block.scope;
  const plugins = Object.freeze(block.plugins);
  switch (block.status) {
    case "will add":
      return { name, scope, status: "will add", plugins };
    case "will remove":
      return { name, scope, status: "will remove", plugins };
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
      throw new Error(`unexpected reconcile marketplace status: ${block.status}`);
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
 *                              ["source mismatch"] (Pitfall 53-7 -- reuses the
 *                              existing REASONS member; no new literal)
 *   - pluginsToInstall      -> child row { status: "will install" }
 *   - pluginsToUninstall    -> child row { status: "will uninstall" }
 *   - pluginsToDisable      -> child row { status: "will disable" }
 *   - pluginsToEnable       -> child row { status: "will enable" }
 *                              (structurally empty in Phase 53 per
 *                              Pitfall 53-4 -- the loop runs but the bucket is
 *                              always empty)
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
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      // Source-mismatch supersedes any prior status (the declaration cannot
      // be honoured byte-for-byte). Pitfall 53-7: reuse the existing
      // "source mismatch" REASONS member; do NOT add a new REASONS literal.
      block.status = "failed";
      block.reasons = ["source mismatch"];
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
      // Pitfall 53-4: Phase 53 produces zero of these. The loop runs so
      // Phase 54 wiring lands against a path the projection already exercises.
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
