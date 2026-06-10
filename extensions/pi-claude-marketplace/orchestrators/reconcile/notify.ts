// orchestrators/reconcile/notify.ts
//
// DIFF-01 pure plan-to-notification projection. Mirrors
// `buildImportNotificationMarketplaces` (in `orchestrators/import/execute.ts`)
// in shape and ordering discipline: groups every Plan action by
// `(scope, marketplace)` into a `MarketplaceBlock`, sorts the resulting
// blocks via `compareByNameThenScope` (name primary case-insensitive, scope
// secondary project-before-user per MSG-GR-3), and constructs the concrete
// per-status `MarketplaceNotificationMessage` arm for each block.
//
// Pure: no I/O. The function NEVER calls `ctx.ui.notify` or any seam in
// `shared/notify.ts` beyond importing the types and the comparator. Phase
// 53 Plan 02 owns the user-visible token bytes (`will add` / `will remove`
// / `will install` / `will uninstall` / `will enable` / `will disable`)
// and the catalog/UAT fixture changes that go with them; Plan 01's
// projection uses placeholder status strings ("added" for to-add,
// "removed" for to-remove, "failed" for sourceMismatches) so the
// structural shape is exercised under unit tests without depending on a
// token set that does not yet exist.
//
// Why placeholders are safe in Plan 01: Plan 01 does NOT add catalog
// states, does NOT add catalog-uat FIXTURES entries, and does NOT touch
// `shared/notify.ts`. Plan 02 takes the projection's `block.status`
// assignment as the seam where the new pending-tense tokens land, and
// updates the catalog + catalog-uat fixtures + the renderer arms in one
// atomic commit (Pitfall 53-3 atomic-supersession discipline).

import { compareByNameThenScope } from "../../shared/notify.ts";

import type { ReconcilePlan } from "./types.ts";
import type {
  CascadeNotificationMessage,
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
 * an accumulated block. Plan 01 only assigns `"added"` / `"removed"` /
 * `"failed"` (or leaves status absent), so those are the only handled cases.
 * Plan 02 replaces these with the pending-tense token set in lockstep with
 * the catalog + UAT fixture changes.
 */
function blockToMarketplaceMessage(block: MarketplaceBlock): MarketplaceNotificationMessage {
  const name = block.name;
  const scope = block.scope;
  const plugins = Object.freeze(block.plugins);
  switch (block.status) {
    case "added":
      return { name, scope, status: "added", plugins };
    case "removed":
      return { name, scope, status: "removed", plugins };
    case "failed":
      return { name, scope, status: "failed", plugins };
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
 *   - marketplacesToAdd     -> block.status = "added"
 *   - marketplacesToRemove  -> block.status = "removed"
 *   - sourceMismatches      -> block.status = "failed" (the marketplace's
 *                              declaration cannot be honoured byte-for-byte)
 *   - pluginsToInstall      -> child plugin row with placeholder status
 *                              "skipped" + reason "already installed"
 *                              (structural; Plan 02 swaps the bytes)
 *   - pluginsToUninstall    -> child plugin row "uninstalled"
 *   - pluginsToDisable      -> child plugin row placeholder "skipped"
 *                              + reason "already installed"
 *                              (structural; Plan 02 swaps the bytes)
 *
 * The empty `pluginsToEnable` bucket emits no child rows by definition
 * (Phase 54 hand-off).
 *
 * Ordering: blocks are sorted by `compareByNameThenScope` (name primary
 * case-insensitive, project-before-user secondary). Plugin rows within a
 * block preserve insertion order per their owning bucket -- the apply
 * path will re-order at execution time if needed.
 */
export function buildReconcilePreviewNotification(
  plans: readonly ReconcilePlan[],
): CascadeNotificationMessage {
  const byMp = new Map<string, MarketplaceBlock>();

  for (const plan of plans) {
    for (const o of plan.marketplacesToAdd) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.status = "added";
    }

    for (const o of plan.marketplacesToRemove) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.status = "removed";
    }

    for (const o of plan.sourceMismatches) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      // Source-mismatch supersedes any prior status (the declaration
      // cannot be honoured byte-for-byte). Plan 02 may re-route this to a
      // dedicated `(failed) {source mismatch}` row.
      block.status = "failed";
    }

    for (const o of plan.pluginsToInstall) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      // Plan 01 placeholder: the structural shape is a per-plugin row
      // under the marketplace block. Plan 02 replaces the `status` and
      // `reasons` here with the new pending-tense token set.
      block.plugins.push({
        status: "skipped",
        name: o.plugin,
        reasons: ["already installed"] as const,
      });
    }

    for (const o of plan.pluginsToUninstall) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "uninstalled",
        name: o.plugin,
      });
    }

    for (const o of plan.pluginsToDisable) {
      const block = ensureMarketplaceBlock(byMp, o.scope, o.marketplace);
      block.plugins.push({
        status: "skipped",
        name: o.plugin,
        reasons: ["already installed"] as const,
      });
    }

    // pluginsToEnable is structurally empty in Phase 53 (Pitfall 53-4);
    // no rows are emitted from it.
  }

  return {
    marketplaces: Object.freeze(
      [...byMp.values()]
        .sort((a, b) => compareByNameThenScope(a, b))
        .map(blockToMarketplaceMessage),
    ),
  };
}
