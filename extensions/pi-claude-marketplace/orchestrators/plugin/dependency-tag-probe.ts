// orchestrators/plugin/dependency-tag-probe.ts
//
// The network-touching leaf that turns a dependency's version constraint into
// a pinned release tag, or into a named failure (RESV-03, D-03-02.2).
//
// D-03-03 amends NFR-5 for exactly this read: resolving a CONSTRAINED
// dependency may query its source repository's tags even when a cached or
// otherwise resolvable copy of that dependency already exists, because the
// constraint can demand a different tag than the cached one.
//
// Gate placement. This module is listed in `eslint.config.js`'s
// `NETWORK_SEAMS`, while both install owners stay gated. That is the
// arrangement `install-clone-probe.ts` already uses to let those gated owners
// reach git legally: the owner composes the leaf and invokes it through an
// injected field whose name is not one the gate matches, so neither owner
// gains a git surface or needs a seam entry of its own.
//
// D-03-09 is a recorded divergence, not an omission below. A no-match is the
// SAME failure whichever repository the query ran against -- the dependency's
// own source repository or its marketplace repository. Upstream soft-degrades
// the marketplace-repository arm into a copy of the repository head; this
// project does not port that asymmetry. So there is no branch here on how the
// source parsed, and there is no fallback to the repository head anywhere: a
// constrained dependency with no satisfying tag fails, and under D-03-07 that
// fails the whole cascade.
//
// D-SG-20: a GitHub `owner/repo` source lists its tags over SSH unless HTTPS
// is forced, as Claude Code's `zmt` does. As amended on 2026-11-25, a failed
// SSH listing of a `github` source lists once more over HTTPS before it counts
// as failed, a small divergence from `zmt`. The retry runs only here, inside
// an install or update that already lists this dependency's tags (the D-03-03
// read above), so it adds no network use to any other command.
//
// AUTH-09: a credential bundle is composed here and threaded into the listing
// call, and no credential value is read, stored, or placed on a returned arm.
// The failure arm carries the classified transport cause only.

import { canonicalCloneUrl } from "../../domain/clone-key.ts";
import { stopsTheClone, tagReadUrl } from "../../domain/github-transport.ts";
import { RELEASE_TAG_SEPARATOR, selectHighestSatisfyingTag } from "../../domain/release-tag.ts";
import { listRemoteTags } from "../../platform/git.ts";
import { rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { classifyGitFailure } from "../../shared/git-failure-classifiers.ts";
import { buildCloneAuth } from "../auth-host.ts";
import { transportForce } from "../github-transport.ts";

import type { GitBackedSource } from "../../domain/source.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** The tag-listing operation this probe reaches the network through. */
export interface DependencyTagListingSeam {
  readonly listRemoteTags: typeof listRemoteTags;
}

/** The host reason a failed listing classified to, where it classified. */
export type DependencyTagListingFailureReason =
  NonNullable<ReturnType<typeof classifyGitFailure>>["reason"] | undefined;

/**
 * What a constrained dependency's tag query came to.
 *
 * `no-matching-tag` is the ONLY no-match answer -- see D-03-09 in the module
 * header. The caller renders the member's declared ranges (D-PL4-05).
 */
export type DependencyTagProbeResult =
  | {
      readonly kind: "pinned";
      readonly tag: string;
      readonly oid: string;
      readonly version: string;
    }
  | { readonly kind: "no-matching-tag" }
  | {
      readonly kind: "tag-listing-failed";
      readonly cause: Error;
      readonly classification: DependencyTagListingFailureReason;
    };

/** Inputs required to resolve one constrained dependency against its tags. */
export interface DependencyTagProbeOptions {
  /** The dependency's own plugin name, which its release tags are prefixed by. */
  readonly pluginName: string;
  readonly source: GitBackedSource;
  /** The intersected constraint a candidate tag's version must satisfy. */
  readonly range: string;
  readonly seam?: DependencyTagListingSeam;
  /**
   * Optional per-URL listing memo. One cascade can reach the same repository
   * for several dependencies, and this bounds that to one listing per URL.
   */
  readonly tagMemo?: Map<string, readonly RemoteTag[]>;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_DEPENDENCY_TAG_LISTING_SEAM: DependencyTagListingSeam = Object.freeze({
  listRemoteTags,
});

/** A listing that succeeded, or the failure arm it produced instead. */
type TagListingOutcome =
  | { readonly kind: "listed"; readonly tags: readonly RemoteTag[] }
  | Extract<DependencyTagProbeResult, { kind: "tag-listing-failed" }>;

interface TagListingRequest {
  readonly seam: DependencyTagListingSeam;
  readonly url: string;
  readonly auth: ReturnType<typeof buildCloneAuth>;
  readonly memo?: Map<string, readonly RemoteTag[]>;
}

/**
 * Reads the repository's tags, serving a memoized listing where one is held.
 *
 * A throw becomes the failure arm rather than escaping. The memo is only ever
 * written on success (never on a failed attempt), so a later attempt in the
 * same cascade always re-queries after a failure -- there is no successful
 * entry to evict.
 */
async function listCandidateTags(request: TagListingRequest): Promise<TagListingOutcome> {
  const memoized = request.memo?.get(request.url);
  if (memoized !== undefined) {
    return { kind: "listed", tags: memoized };
  }

  try {
    const tags = await request.seam.listRemoteTags({
      url: request.url,
      auth: request.auth,
    });
    request.memo?.set(request.url, tags);
    return { kind: "listed", tags };
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return {
      kind: "tag-listing-failed",
      cause: err instanceof Error ? err : new Error(String(err)),
      // D-PL7-02: the listing reads the dependency's own source repository,
      // so the plugin-clone rule applies and a 404 or 410 is `source missing`.
      classification: classifyGitFailure(err, { notFound: "source missing" })?.reason,
    };
  }
}

/**
 * D-SG-20 as amended on 2026-11-25: the address a `github`-source
 * dependency's failed listing at `listedAt` is listed again at, or undefined
 * when the listing stops at its failure. Only an SSH listing retries, once,
 * at the HTTPS address a forced listing sends, so a user with no SSH key still
 * pins the release tag; a listing that was HTTPS already, any other source
 * kind, and a failure after which no transport can list (git missing, or the
 * command aborted) do not.
 */
function httpsRetryOf(
  source: GitBackedSource,
  listedAt: string,
  failure: Error,
): string | undefined {
  const https = tagReadUrl(source, "prefer-https");
  return source.kind === "github" && listedAt !== https && !stopsTheClone(failure)
    ? https
    : undefined;
}

/**
 * Resolves a constrained dependency to the highest release tag on its source
 * repository that satisfies the constraint.
 *
 * D-SG-20: the query URL, and the memo key of its listing, is `tagReadUrl`'s
 * answer for the command's transport force: a GitHub `owner/repo` source
 * lists over SSH unless HTTPS is forced, and every other source lists at the
 * wire form a clone of it sends (D-2-03). A failed SSH listing of a `github`
 * source lists once more over HTTPS (`httpsRetryOf`), and when that fails too
 * the failure arm carries the HTTPS attempt's cause and classification. Each
 * attempt reads and writes the memo under the URL it sends. The credential
 * bundle is the host bundle every other clone path already builds, which an
 * SSH listing never sends -- this adds no second credential acquisition path.
 */
export async function probeDependencyTags(
  options: DependencyTagProbeOptions,
): Promise<DependencyTagProbeResult> {
  const seam = options.seam ?? REAL_DEPENDENCY_TAG_LISTING_SEAM;
  const { source, pluginName, range } = options;
  const cloneUrl = canonicalCloneUrl(source);
  const auth = buildCloneAuth(cloneUrl, source.kind, options.auth);
  const listAt = (url: string): Promise<TagListingOutcome> =>
    listCandidateTags({
      seam,
      url,
      auth,
      ...(options.tagMemo !== undefined && { memo: options.tagMemo }),
    });

  const listedAt = tagReadUrl(source, transportForce(process.env));
  let listing = await listAt(listedAt);
  const retryAt =
    listing.kind === "tag-listing-failed"
      ? httpsRetryOf(source, listedAt, listing.cause)
      : undefined;
  if (retryAt !== undefined) {
    listing = await listAt(retryAt);
  }

  if (listing.kind === "tag-listing-failed") {
    return listing;
  }

  return selectHighestSatisfyingTag(listing.tags, `${pluginName}${RELEASE_TAG_SEPARATOR}`, range);
}
