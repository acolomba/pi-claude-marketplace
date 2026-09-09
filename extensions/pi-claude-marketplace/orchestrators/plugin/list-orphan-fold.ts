import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { isScopeBearingListRow } from "../../shared/notification-types.ts";

import type { ListMsg } from "./list.messaging.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { PluginNotificationMessage } from "../../shared/notification-types.ts";
import type { MarketplaceRows } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";

/** Project-scope inventory rows adopted by a cloned user marketplace. */
export interface OrphanFold {
  readonly folded: readonly ListMsg[];
  readonly foldedNames: ReadonlySet<string>;
}

/** Reports whether a project record is the project-scope clone of a user marketplace. */
export function isOrphanMarketplaceClone(
  projectMarketplace: ExtensionState["marketplaces"][string] | undefined,
  userMarketplace: ExtensionState["marketplaces"][string] | undefined,
): projectMarketplace is ExtensionState["marketplaces"][string] {
  if (projectMarketplace === undefined || userMarketplace === undefined) {
    return false;
  }

  return projectMarketplace.marketplaceRoot === userMarketplace.marketplaceRoot;
}

/** Selects recorded project inventory for adoption without changing its stable input order. */
export function foldOrphanListRows(rows: readonly ListMsg[]): OrphanFold {
  const folded = rows.filter(
    (row) =>
      row.status === "installed" ||
      row.status === "upgradable" ||
      row.status === "disabled" ||
      row.status === "partially-installed" ||
      row.status === "partially-upgradable",
  );

  return {
    folded,
    foldedNames: new Set(folded.map((row) => row.name)),
  };
}

function rowScope(row: PluginNotificationMessage, marketplaceScope: Scope): Scope {
  return isScopeBearingListRow(row) ? (row.scope ?? marketplaceScope) : marketplaceScope;
}

function orderRows(marketplaceScope: Scope, rows: readonly ListMsg[]): readonly ListMsg[] {
  if (rows.length === 0) {
    return rows;
  }

  return [...rows].sort((left, right) =>
    compareByNameThenScope(
      { name: left.name, scope: rowScope(left, marketplaceScope) },
      { name: right.name, scope: rowScope(right, marketplaceScope) },
    ),
  );
}

/** Orders list blocks and their rows by canonical name/scope rules without mutating inputs. */
export function orderPluginListBlocks(
  blocks: readonly MarketplaceRows<ListMsg>[],
): readonly MarketplaceRows<ListMsg>[] {
  return [...blocks]
    .sort((left, right) => compareByNameThenScope(left, right))
    .map((block) => ({
      ...block,
      plugins: orderRows(block.scope, block.plugins),
    }));
}
