// orchestrators/plugin/marketplace-tag-probe.ts
//
// The LOCAL, network-free counterpart of `dependency-tag-probe.ts`: turns a
// path-source dependency's version constraint into a pin against the
// MARKETPLACE CLONE's own release tags, read from the local checkout on disk
// (TAGS-01, TAGS-03, D-07-05).
//
// A `path` source has no repository of its own to query -- its files already
// live inside the marketplace clone -- so this module lists THAT clone's own
// `refs/tags/` namespace instead of a remote's advertised refs.
//
// Gate placement. This module is deliberately ABSENT from
// `tests/architecture/gate-targets.ts`'s `NETWORK_FREE_TARGETS` for the same
// reason `dependency-tag-probe.ts` is: a path source has no remote repository
// to query at all, so this is the one place resolving a path-source
// constraint reads tags from -- and it reads the local clone the marketplace
// itself already occupies, never a network endpoint.
//
// The only two `platform/git.ts` symbols this module may import are
// `listTags` and `resolveTagOid`.
// `tests/architecture/marketplace-tag-probe-offline.test.ts` pins that import
// set to exactly those two names as TAGS-01's automated, positive proof that
// this module never reaches the network.

import { RELEASE_TAG_SEPARATOR, selectHighestSatisfyingTag } from "../../domain/release-tag.ts";
import { listTags, resolveTagOid } from "../../platform/git.ts";

import type { ReleaseTagCandidate, SelectedReleaseTag } from "../../domain/release-tag.ts";

/** The local tag-reading operation this probe reaches the marketplace clone through. */
export interface MarketplaceTagListingSeam {
  readonly listTags: typeof listTags;
  readonly resolveTagOid: typeof resolveTagOid;
}

const REAL_MARKETPLACE_TAG_LISTING_SEAM: MarketplaceTagListingSeam = Object.freeze({
  listTags,
  resolveTagOid,
});

/**
 * Inputs required to resolve one path-source dependency against its
 * marketplace clone's own tags.
 */
export interface MarketplaceTagProbeOptions {
  /** The dependency's own plugin name, which its release tags are prefixed by. */
  readonly pluginName: string;
  /** The local marketplace clone's working-tree root. */
  readonly marketplaceRoot: string;
  /** The intersected constraint a candidate tag's version must satisfy. */
  readonly range: string;
  readonly seam?: MarketplaceTagListingSeam;
  /**
   * Optional per-marketplace-root listing memo. One cascade can reach the
   * same marketplace clone for several members, and this bounds that to one
   * listing per root.
   */
  readonly tagMemo?: Map<string, readonly ReleaseTagCandidate[]>;
}

/**
 * What a constrained path-source member's local tag query came to.
 *
 * `tag-listing-failed` carries only the cause: unlike the network probe,
 * there is no transport to classify -- a local listing failure is a read
 * error against the marketplace clone's own git state.
 */
export type MarketplaceTagProbeResult =
  SelectedReleaseTag | { readonly kind: "tag-listing-failed"; readonly cause: Error };

/** A listing that succeeded, or the failure arm it produced instead. */
type TagListingOutcome =
  | { readonly kind: "listed"; readonly tags: readonly ReleaseTagCandidate[] }
  | Extract<MarketplaceTagProbeResult, { kind: "tag-listing-failed" }>;

/**
 * Lists a marketplace clone's tags, eagerly resolving each name's oid
 * (D-07-10) so `selectHighestSatisfyingTag` receives a fully-formed candidate
 * list, and memoizes the result per `marketplaceRoot` so several members of
 * one cascade list the same clone once.
 *
 * A throw from either the listing or a peel becomes the `tag-listing-failed`
 * arm; nothing escapes. The memo is only ever written on success (never on a
 * failed attempt), so a later attempt in the same cascade always re-lists
 * after a failure -- there is no successful entry to evict.
 */
async function listMarketplaceCandidateTags(
  seam: MarketplaceTagListingSeam,
  marketplaceRoot: string,
  memo?: Map<string, readonly ReleaseTagCandidate[]>,
): Promise<TagListingOutcome> {
  const memoized = memo?.get(marketplaceRoot);
  if (memoized !== undefined) {
    return { kind: "listed", tags: memoized };
  }

  try {
    const names = await seam.listTags({ dir: marketplaceRoot });
    const candidates: ReleaseTagCandidate[] = [];
    for (const name of names) {
      // Each peel is an independent local read; isomorphic-git has no batched
      // API to resolve every tag oid in one call.
      const oid = await seam.resolveTagOid({ dir: marketplaceRoot, name });
      // WR-06: `undefined` means the tag peeled to a non-commit object (a
      // blob/tree tag) or a peel chain that never terminated -- neither is a
      // candidate `selectHighestSatisfyingTag` can check out, so it is
      // dropped rather than handed a checkout-breaking oid.
      if (oid !== undefined) {
        candidates.push({ name, oid });
      }
    }

    memo?.set(marketplaceRoot, candidates);
    return { kind: "listed", tags: candidates };
  } catch (err) {
    return {
      kind: "tag-listing-failed",
      cause: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Resolves a constrained path-source dependency to the highest release tag on
 * ITS OWN MARKETPLACE CLONE that satisfies the constraint -- entirely local,
 * with no network call in any arm (TAGS-01).
 */
export async function probeMarketplaceTags(
  options: MarketplaceTagProbeOptions,
): Promise<MarketplaceTagProbeResult> {
  const seam = options.seam ?? REAL_MARKETPLACE_TAG_LISTING_SEAM;
  const listing = await listMarketplaceCandidateTags(
    seam,
    options.marketplaceRoot,
    options.tagMemo,
  );
  if (listing.kind === "tag-listing-failed") {
    return listing;
  }

  return selectHighestSatisfyingTag(
    listing.tags,
    `${options.pluginName}${RELEASE_TAG_SEPARATOR}`,
    options.range,
  );
}
