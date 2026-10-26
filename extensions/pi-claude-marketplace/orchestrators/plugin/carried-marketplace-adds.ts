// orchestrators/plugin/carried-marketplace-adds.ts
//
// UPD-DEP-D1 / WR-E / D-MF-04: an install or update whose closure must move
// recorded dependencies runs its cascade twice, once to plan the moves and
// once after them. When the planning run added a marketplace only the user
// scope records, it saves nothing, so its add is kept here, clone included,
// and the run after the moves records it again from the kept clone. The
// operation then clones that marketplace once.
//
// Also owns WR-07's removal of the clones an unsaved add created, which the
// install's lock owner and the discard of kept adds share.

import { loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { cleanupStaging, createRemovalOps } from "../../shared/fs-utils.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";

import type { InstallLedgerOptions } from "./install-outcome.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";

/** LAYER-07: the `marketplace add` seam every cascade member of one install shares. */
export type MarketplaceAddSeam = NonNullable<InstallLedgerOptions["marketplaceAdd"]>;

/** WR-07: one install transaction's list of the marketplaces its adds recorded. */
export type AddedMarketplaces = NonNullable<InstallLedgerOptions["addedMarketplaces"]>;

/** A marketplace a planning run added and did not save, kept for the run after the moves. */
export interface CarriedAdd {
  readonly marketplace: string;
  readonly rawSource: string;
  readonly cloneDir: string | undefined;
  readonly record: ExtensionState["marketplaces"][string];
}

/**
 * WR-07: remove the clone directory each listed add created; a path source
 * has none. Returns one leak per entry, `undefined` for a clean removal.
 */
export async function removeAddedClones(
  added: readonly { readonly cloneDir: string | undefined }[],
): Promise<(string | undefined)[]> {
  const removalOps = createRemovalOps();
  return Promise.all(
    added.map(async ({ cloneDir }) =>
      cloneDir === undefined
        ? undefined
        : cleanupStaging(removalOps, cloneDir, `marketplace final clone ${cloneDir}`),
    ),
  );
}

/**
 * The `marketplace add` seam of a run that may follow a planning run. A
 * source the planning run added is recorded again from its kept entry, with
 * no network; any other source goes through `seam`.
 */
export function reusingCarriedAdds(
  seam: MarketplaceAddSeam,
  carried: CarriedAdd[],
): MarketplaceAddSeam {
  return {
    settle: seam.settle,
    record: async (args) => {
      const kept = carried.find((entry) => entry.rawSource === args.source.raw);
      if (kept === undefined) {
        return seam.record(args);
      }

      carried.splice(carried.indexOf(kept), 1);
      setOwn(args.state.marketplaces, kept.marketplace, structuredClone(kept.record));
      return {
        name: kept.marketplace,
        ...(kept.cloneDir !== undefined && { cloneDir: kept.cloneDir }),
      };
    },
  };
}

/**
 * Moves a planning run's unsaved adds from `added` to `carried`, so the lock
 * owner does not remove their clones. An add the state does not record stays
 * in `added`, and its clone is removed as usual.
 */
export function carryUnsavedAdds(
  added: AddedMarketplaces,
  state: ExtensionState,
  carried: CarriedAdd[],
): void {
  const kept = Object.entries(state.marketplaces).flatMap(([marketplace, record]) => {
    const entry = added.find((add) => add.marketplace === marketplace);
    return entry === undefined ? [] : [{ ...entry, record }];
  });
  carried.push(...kept);
  const keptNames = new Set(kept.map((entry) => entry.marketplace));
  added.splice(0, added.length, ...added.filter((add) => !keptNames.has(add.marketplace)));
}

/**
 * Removes the kept clones no later run recorded and empties `carried`. A
 * marketplace the scope now records keeps its clone: a move's own cascade
 * recorded it. Cleanup never fails the operation (D-19-01).
 */
export async function discardCarriedAdds(
  carried: CarriedAdd[],
  locations: ScopedLocations,
): Promise<void> {
  try {
    const state = await loadState(locations.extensionRoot);
    const unrecorded = carried
      .splice(0)
      .filter((entry) => ownValue(state.marketplaces, entry.marketplace) === undefined);
    for (const leak of await removeAddedClones(unrecorded)) {
      if (leak !== undefined) {
        hookDebugLog(`install kept a marketplace clone it did not record; ${leak}`, "install");
      }
    }
  } catch (err) {
    hookDebugLog(`install: marketplace clone cleanup failed: ${errorMessage(err)}`, "install");
  }
}
