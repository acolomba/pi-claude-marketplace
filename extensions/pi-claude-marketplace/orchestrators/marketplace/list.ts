// orchestrators/marketplace/list.ts
//
// ML-1..4 + SC-6 + NFR-5.
//
// READ-ONLY: NO withStateGuard (D-04 corollary). NO manifest reads
// (ML-3 -- `loadState` reads only state.json; the V2 `notify()` is a
// pure formatter on the in-memory records). NO gitOps surface
// (NFR-5 by construction -- list.ts does not even import platform/git
// or DEFAULT_GIT_OPS).
//
// Flow:
//   const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["project", "user"];
//   for each scope: loadState(locationsFor(scope, cwd).extensionRoot)
//     -> accumulate one MarketplaceNotificationMessage per state.marketplaces[<name>]
//   notify(opts.ctx, opts.pi, { marketplaces: <built array> });
// : an empty top-level marketplaces array renders the
//   //   `(no marketplaces)` sentinel (planner-chosen) -- replaces the V1
//   //   CMC-10 EmptyToken path through renderMarketplaceList.
// : caller-supplied order honored end-to-end (no internal
//   //   sort); the outer scopes loop is project-then-user (SC-6 / MSG-GR-3),
//   //   so same-name cross-scope rows land in V1's compareByNameThenScope
//   //   project-before-user order when single-name. Cross-name ordering is
//   //   insertion order (Object.values on state.marketplaces); the V1
//   //   alphabetic sort is dropped per Phase 18 PATTERNS list.ts.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { MarketplaceNotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface ListMarketplacesOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for soft-dep probing.
   */
  readonly pi: ExtensionAPI;
  /** When omitted, SC-6 mandates enumeration of BOTH scopes. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

export async function listMarketplaces(opts: ListMarketplacesOptions): Promise<void> {
  // SC-6: bare form enumerates both scopes; explicit --scope narrows.
  // Iteration order is project-first per MSG-GR-3 so same-name cross-scope
  // pairs render project-before-user (matching the V1 compareByNameThenScope
  // tie-breaker).
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  const marketplaces: MarketplaceNotificationMessage[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const record of Object.values(state.marketplaces)) {
      // NotificationMessage construction recipe (Plan 18-01 pilot; mirrored here).
      // - One MarketplaceNotificationMessage per record, emitted via one
      //   notify(opts.ctx, opts.pi, ...) call below; `plugins: []` is required.
      // - Discriminator here: `mp.status === undefined` (list-surface arm of
      //   renderMpHeader). Unique to this orchestrator in the marketplace family.
      // - `details: MarketplaceDetails` is OPTIONAL and INDEPENDENT of status
      //   per D-15-06; SET when the persisted record carries `autoupdate`
      //   and/or `lastUpdatedAt`, OMITTED otherwise so the renderer emits a
      //  bare `● <name> [<scope>]` row (list-surface sub-branch A).
      // - Severity (info; no 2nd arg) and reload-hint are computed by
      //  notify (list surface emits neither).
      // - Reference: catalog UAT `mixed-scopes` fixture at
      //   tests/architecture/catalog-uat.test.ts:1087-1107 (binding
      //   `<autoupdate>` + `<last-updated <iso>>` tokens).
      marketplaces.push({
        name: record.name,
        scope: record.scope,
        ...(record.autoupdate !== undefined || record.lastUpdatedAt !== undefined
          ? {
              details: {
                autoupdate: record.autoupdate ?? false,
                ...(record.lastUpdatedAt !== undefined && {
                  lastUpdatedAt: record.lastUpdatedAt,
                }),
              },
            }
          : {}),
        plugins: [],
      });
    }
  }

  // : empty top-level marketplaces array renders `(no marketplaces)`.
  // : caller-supplied order honored end-to-end; the outer loop above
  // already enforces the SC-6 / MSG-GR-3 project-first ordering.
  notify(opts.ctx, opts.pi, { marketplaces });
}
