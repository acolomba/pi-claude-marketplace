// orchestrators/marketplace/list.ts
//
// ML-1..4 + SC-6 + NFR-5.
//
// READ-ONLY: NO withStateGuard (D-04 corollary). NO manifest reads
// (ML-3 -- `loadState` reads only state.json; `notifyWithContext()` is a
// pure formatter on the in-memory records). NO gitOps surface
// (NFR-5 by construction -- list.ts does not even import platform/git
// or DEFAULT_GIT_OPS).
//
// Flow:
//   const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["project", "user"];
//   for each scope: loadState(locationsFor(scope, cwd).extensionRoot)
//     -> accumulate one MarketplaceNotificationMessage per state.marketplaces[<name>]
//   notifyWithContext(opts.ctx, opts.run, MARKETPLACE_LIST_CONTEXT, <built array>, ...);
// An empty top-level marketplaces array renders the `(no marketplaces)`
//   sentinel through the cascade emitter. CMC-10.
// Caller-supplied order is honored end-to-end (no internal sort); the outer
//   scopes loop is project-then-user (SC-6 / MSG-GR-3), so same-name
//   cross-scope rows land in project-before-user order when single-name.
//   Cross-name ordering is insertion order (Object.values on
//   state.marketplaces); there is no alphabetic sort.

import { effectiveMarketplaceAutoupdate } from "../../domain/official-marketplaces.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notifyWithContext, type MarketplaceRows } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";

import { MARKETPLACE_LIST_CONTEXT } from "./list.messaging.ts";

import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";

export interface ListMarketplacesOptions {
  readonly ctx: ExtensionContext;
  /**
   * D-05: the command's notification run, threaded for the shared emitter
   * signature. `MARKETPLACE_LIST_CONTEXT` declares no marker policy, so its snapshot
   * composes no markers here.
   */
  readonly run: NotificationRun;
  /** When omitted, SC-6 mandates enumeration of BOTH scopes. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

/**
 * One state record, the scope that holds it, and the marketplace-list block
 * built from it. LLMT-01: the marketplace LLM tool derives its content lines
 * and its details from the same entries, so the two always name the same
 * marketplaces.
 */
export interface MarketplaceListEntry {
  readonly scope: Scope;
  readonly record: ExtensionState["marketplaces"][string];
  readonly block: MarketplaceRows<never>;
}

/**
 * ML-1..4: the marketplace-list entries, one per state record, for each scope
 * in project-then-user order (or the one requested scope). NFR-5: reads state
 * and the merged config only, never the network. LLMT-01: the marketplace LLM
 * tool converts these same blocks, so its details match what the command
 * emits.
 */
export async function loadMarketplaceListEntries(
  opts: Pick<ListMarketplacesOptions, "cwd" | "scope">,
): Promise<readonly MarketplaceListEntry[]> {
  // SC-6: bare form enumerates both scopes; explicit --scope narrows.
  // Iteration order is project-first per MSG-GR-3 so same-name cross-scope
  // pairs render project-before-user.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // WR-01: list rows carry no plugin child rows, so each block is typed at the
  // narrow `MarketplaceRows<never>` (plugins: readonly never[]). Every block is
  // then checked against the empty-plugins invariant MARKETPLACE_LIST_CONTEXT requires, and
  // the blocks widen to `notifyWithContext` with no cast.
  const entries: MarketplaceListEntry[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
    const state = await loadState(locations.extensionRoot);
    // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config).
    // Pre-compute the merged view ONCE per scope; the inner loop reads
    // `ownValue(merged.marketplaces, name)?.entry.autoupdate` for each record,
    // and a record without a value gets the default for its name (D-PL8-07,
    // reversed).
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one config read each
    const { merged } = await loadMergedScopeConfig(locations);
    for (const record of Object.values(state.marketplaces)) {
      // NotificationMessage construction recipe.
      // - One MarketplaceNotificationMessage per record, emitted via one
      //   notifyWithContext(..., MARKETPLACE_LIST_CONTEXT, ...) call; `plugins: []` is required.
      // - Discriminator here: `mp.status === undefined` (list-surface arm of
      //   renderMpHeader). Unique to this orchestrator in the marketplace family.
      // - `details: MarketplaceDetails` is OPTIONAL and INDEPENDENT of status
      //   per D-15-06; SET when the merged config carries `autoupdate` and/or
      //   when the state record carries `lastUpdatedAt`, OMITTED otherwise so
      //   the renderer emits a bare `● <name> [<scope>]` row (list-surface
      //   sub-branch A).
      // - Explicit info severity marks this statusless inventory row as an
      //   operation for the plural tally. The UI still receives no 2nd arg.
      //   Resolve computes the reload hint (list surface emits none).
      // - Reference: catalog UAT `mixed-scopes` fixture (binding
      //   `<autoupdate>` + `<last-updated <iso>>` tokens).
      const autoupdate = effectiveMarketplaceAutoupdate(
        record.name,
        ownValue(merged.marketplaces, record.name)?.entry.autoupdate,
      );
      entries.push({
        scope,
        record,
        block: {
          name: record.name,
          scope: record.scope,
          severity: "info",
          ...(autoupdate || record.lastUpdatedAt !== undefined
            ? {
                details: {
                  autoupdate,
                  ...(record.lastUpdatedAt !== undefined && {
                    lastUpdatedAt: record.lastUpdatedAt,
                  }),
                },
              }
            : {}),
          plugins: [],
        },
      });
    }
  }

  return entries;
}

export async function listMarketplaces(opts: ListMarketplacesOptions): Promise<void> {
  const marketplaces = (await loadMarketplaceListEntries(opts)).map((entry) => entry.block);

  // An empty top-level marketplaces array renders `(no marketplaces)`.
  // Caller-supplied order is honored end-to-end; the outer loop above already
  // enforces the SC-6 / MSG-GR-3 project-first ordering.
  // OUT-07 / D-12: the inventory is a bulk surface -> Plural cardinality. The
  // list-arm headers render via the central renderMpHeader seam the spine
  // reuses; MARKETPLACE_LIST_CONTEXT carries the localized list vocabulary.
  notifyWithContext(
    opts.ctx,
    opts.run,
    MARKETPLACE_LIST_CONTEXT,
    marketplaces,
    undefined,
    "plural",
  );
}
