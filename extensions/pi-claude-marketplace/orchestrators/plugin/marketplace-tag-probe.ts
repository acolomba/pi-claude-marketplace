// orchestrators/plugin/marketplace-tag-probe.ts
//
// Turns a path-source dependency's version constraint into a pin against its
// MARKETPLACE REPOSITORY's release tags (TAGS-01, TAGS-03, D-07-05).
//
// A `path` source has no repository of its own to query -- its files live
// inside the marketplace checkout -- so this module lists the marketplace
// repository's `refs/tags/` namespace instead.
//
// D-SG-09 amends NFR-5 for this read. A git marketplace (a `github` or `url`
// source) is a depth-1 clone that holds no tags, so its tags are listed from
// its remote with `ls-remote --tags`, as Claude Code lists them, through the
// marketplace host's auth bundle. A directory marketplace is the user's own
// repository, so its tags are read locally with `for-each-ref` and a
// path-source install from it stays off the network. A hosted catalog has no
// repository, so its listing fails and the caller falls back to the current
// copy (TAGS-02).
//
// Gate placement. This module is listed in `eslint.config.js`'s
// `NETWORK_SEAMS`: it names the remote listing itself.
//
// The only two `platform/git.ts` symbols this module may import are
// `listRemoteTags` and `listLocalTags`.
// `test/architecture/marketplace-tag-probe-remote.test.ts` pins that import
// set to exactly those two names, so the probe provably reads a git
// marketplace's remote and nothing else of the git surface.
//
// AUTH-09: the auth bundle is composed here and threaded into the listing;
// no credential value is read, stored, or placed on a returned arm.

import { canonicalCloneUrl, networkCloneUrl } from "../../domain/clone-key.ts";
import { RELEASE_TAG_SEPARATOR, selectHighestSatisfyingTag } from "../../domain/release-tag.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { listLocalTags, listRemoteTags } from "../../platform/git.ts";
import { rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { buildCloneAuth } from "../auth-host.ts";

import type { ReleaseTagCandidate, SelectedReleaseTag } from "../../domain/release-tag.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** The tag listings this probe reaches the marketplace repository through. */
export interface MarketplaceTagListingSeam {
  readonly listRemoteTags: typeof listRemoteTags;
  readonly listLocalTags: typeof listLocalTags;
}

const REAL_MARKETPLACE_TAG_LISTING_SEAM: MarketplaceTagListingSeam = Object.freeze({
  listRemoteTags,
  listLocalTags,
});

/**
 * Inputs required to resolve one path-source dependency against its
 * marketplace repository's tags.
 */
export interface MarketplaceTagProbeOptions {
  /** The dependency's own plugin name, which its release tags are prefixed by. */
  readonly pluginName: string;
  /** The local marketplace checkout's working-tree root. */
  readonly marketplaceRoot: string;
  /** The marketplace record's stored source, which decides where the tags are read. */
  readonly marketplaceSource: unknown;
  /** The intersected constraint a candidate tag's version must satisfy. */
  readonly range: string;
  readonly seam?: MarketplaceTagListingSeam;
  /**
   * Optional listing memo, one command wide (D-10-18), keyed by the remote URL
   * of a git marketplace and by the root of a directory marketplace. One
   * command can reach the same marketplace for several members, and this
   * bounds that to one listing per repository.
   */
  readonly tagMemo?: Map<string, readonly ReleaseTagCandidate[]>;
  /**
   * The command's auth context, which a git marketplace's listing
   * authenticates with; the listing runs without a bundle when it is absent.
   */
  readonly auth?: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

/**
 * What a constrained path-source member's tag query came to.
 *
 * `tag-listing-failed` carries only the cause: every caller folds it into the
 * current-copy fallback (TAGS-02), so there is no transport to classify.
 */
export type MarketplaceTagProbeResult =
  SelectedReleaseTag | { readonly kind: "tag-listing-failed"; readonly cause: Error };

type TagListingFailure = Extract<MarketplaceTagProbeResult, { kind: "tag-listing-failed" }>;

/** A listing that succeeded, or the failure arm it produced instead. */
type TagListingOutcome =
  { readonly kind: "listed"; readonly tags: readonly ReleaseTagCandidate[] } | TagListingFailure;

/** Where one marketplace's tags are read, and the memo key of that listing. */
interface TagListing {
  readonly key: string;
  readonly list: () => Promise<readonly ReleaseTagCandidate[]>;
}

/**
 * The listing a marketplace source reads its tags with: the remote listing of
 * a `github` or `url` marketplace's wire URL, with the auth bundle of its
 * host, or the local listing of a directory marketplace's root. Any other
 * source (a hosted catalog, or a source that no longer parses) has no
 * repository to list.
 */
function tagListingOf(
  options: MarketplaceTagProbeOptions,
  seam: MarketplaceTagListingSeam,
): TagListing | undefined {
  const source = parsePluginSource(options.marketplaceSource);
  if (source.kind === "github" || source.kind === "url") {
    const url = networkCloneUrl(source);
    const { auth } = options;
    return {
      key: url,
      list: () =>
        seam.listRemoteTags({
          url,
          ...(auth !== undefined && {
            auth: buildCloneAuth(canonicalCloneUrl(source), source.kind, auth),
          }),
        }),
    };
  }

  if (source.kind === "path") {
    return {
      key: options.marketplaceRoot,
      list: () => seam.listLocalTags({ dir: options.marketplaceRoot }),
    };
  }

  return undefined;
}

/**
 * Lists a marketplace repository's tags, each with the commit it names, and
 * memoizes the result per listing key so several members of one command list
 * the same repository once.
 *
 * A throw becomes the `tag-listing-failed` arm, except an invalid GitHub base,
 * which rethrows (GHB-03). The memo is only ever written on success (never on
 * a failed attempt), so a later attempt in the same command always re-lists
 * after a failure -- there is no successful entry to evict.
 */
async function listMarketplaceCandidateTags(
  listing: TagListing,
  memo?: Map<string, readonly ReleaseTagCandidate[]>,
): Promise<TagListingOutcome> {
  const memoized = memo?.get(listing.key);
  if (memoized !== undefined) {
    return { kind: "listed", tags: memoized };
  }

  try {
    const candidates = await listing.list();
    memo?.set(listing.key, candidates);
    return { kind: "listed", tags: candidates };
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return {
      kind: "tag-listing-failed",
      cause: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Resolves a constrained path-source dependency to the highest release tag on
 * its marketplace repository that satisfies the constraint (TAGS-01, D-SG-09).
 */
export async function probeMarketplaceTags(
  options: MarketplaceTagProbeOptions,
): Promise<MarketplaceTagProbeResult> {
  const listing = tagListingOf(options, options.seam ?? REAL_MARKETPLACE_TAG_LISTING_SEAM);
  if (listing === undefined) {
    return {
      kind: "tag-listing-failed",
      cause: new Error("the marketplace has no git repository to read release tags from"),
    };
  }

  const listed = await listMarketplaceCandidateTags(listing, options.tagMemo);
  if (listed.kind === "tag-listing-failed") {
    return listed;
  }

  return selectHighestSatisfyingTag(
    listed.tags,
    `${options.pluginName}${RELEASE_TAG_SEPARATOR}`,
    options.range,
  );
}
