// orchestrators/marketplace/list.ts
//
// ML-1..4 + SC-6 + NFR-5; Phase 13 CMC-03 / CMC-07 / CMC-10 / CMC-29.
//
// READ-ONLY: NO withStateGuard (D-04 corollary). NO manifest reads
// (ML-3 -- `loadState` reads only state.json; `renderMarketplaceList`
// is a pure formatter on the in-memory records). NO gitOps surface
// (NFR-5 by construction -- list.ts does not even import platform/git
// or DEFAULT_GIT_OPS).
//
// Flow:
//   const scopes: Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];
//   for each scope: loadState(locationsFor(scope, cwd).extensionRoot)
//     -> collect every state.marketplaces[<name>]
//   notifySuccess(ctx, renderMarketplaceList(allRecords));
//   // CMC-10: when allRecords is empty, renderMarketplaceList returns the
//   // bare `(no marketplaces)` EmptyToken form (formerly "No marketplaces
//   // configured." sentence, retired by Phase 13 sub-wave 2c).
//   // CMC-29 / MSG-GR-3: non-empty case renders flat, sorted by
//   // compareByNameThenScope; no per-scope group headers.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { renderMarketplaceList } from "../../presentation/marketplace-list.ts";
import { notifySuccess } from "../../shared/notify.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { MarketplaceListEntry } from "../../presentation/marketplace-list.ts";
import type { Scope } from "../../shared/types.ts";

export interface ListMarketplacesOptions {
  readonly ctx: ExtensionContext;
  /** When omitted, SC-6 mandates enumeration of BOTH scopes. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

export async function listMarketplaces(opts: ListMarketplacesOptions): Promise<void> {
  // SC-6: bare form enumerates both scopes; explicit --scope narrows.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["user", "project"] : [opts.scope];

  const allRecords: MarketplaceListEntry[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    for (const record of Object.values(state.marketplaces)) {
      // state-io stores `source` as `Type.Unknown()`; the renderer expects
      // `ParsedSource`. The state-io load path validates structure; the
      // discriminant `kind` is preserved end-to-end.
      const entry: MarketplaceListEntry = {
        name: record.name,
        scope: record.scope,
        source: record.source as ParsedSource,
        ...(record.autoupdate !== undefined && { autoupdate: record.autoupdate }),
      };
      allRecords.push(entry);
    }
  }

  // renderMarketplaceList handles both populated and empty cases:
  //   - allRecords.length > 0  -> grouped-by-scope rendering (ML-1, ML-2)
  //   - allRecords.length === 0 -> "No marketplaces configured." (ML-4)
  notifySuccess(opts.ctx, renderMarketplaceList(allRecords));
}
