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
// Gate placement. This module is deliberately ABSENT from
// `tests/architecture/gate-targets.ts`'s `NETWORK_FREE_TARGETS` while both
// install owners stay in it. That is the arrangement `install-clone-probe.ts`
// already uses to let those gated owners reach git legally: the owner composes
// the leaf and invokes it through an injected field whose name is not one the
// gate matches, so neither owner gains a git surface and no gate edit or
// exemption is needed.
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
// AUTH-09: a credential bundle is composed here and threaded into the listing
// call, and no credential value is read, stored, or placed on a returned arm.
// The failure arm carries the classified transport cause and the rendered
// range only.

import { gt, valid } from "semver";

import { canonicalCloneUrl } from "../../domain/clone-key.ts";
import { recordedVersionSatisfies, renderConstraintRange } from "../../domain/dependency-range.ts";
import { ensureGitSuffix } from "../../domain/source.ts";
import { listRemoteTags } from "../../platform/git.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { buildCloneAuth } from "../auth-host.ts";

import type { GitBackedSource } from "../../domain/source.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/**
 * The separator the plugin-release tooling places between a plugin's name and
 * its version in a release tag: `formatter--v1.2.0` is release `1.2.0` of
 * `formatter`.
 *
 * A convention of that tooling, NOT a git standard. A source repository that
 * does not follow it advertises no tag this probe considers and reports no
 * matching tag, which is the expected answer for most third-party sources
 * today rather than a defect in the repository or here.
 */
const RELEASE_TAG_SEPARATOR = "--v";

/** The tag-listing operation this probe reaches the network through. */
export interface DependencyTagListingSeam {
  readonly listRemoteTags: typeof listRemoteTags;
}

/** The transport reason a failed listing classified to, where it classified. */
export type DependencyTagListingFailureReason = ReturnType<typeof classifyGitTransportFailure>;

/**
 * What a constrained dependency's tag query came to.
 *
 * `no-matching-tag` carries the range as rendered for a user-visible reason,
 * and is the ONLY no-match answer -- see D-03-09 in the module header.
 */
export type DependencyTagProbeResult =
  | {
      readonly kind: "pinned";
      readonly tag: string;
      readonly oid: string;
      readonly version: string;
    }
  | { readonly kind: "no-matching-tag"; readonly range: string }
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
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_DEPENDENCY_TAG_LISTING_SEAM: DependencyTagListingSeam = Object.freeze({
  listRemoteTags,
});

/** The pinned arm alone, so candidate selection can carry one around. */
type PinnedTag = Extract<DependencyTagProbeResult, { kind: "pinned" }>;

/** A listing that succeeded, or the failure arm it produced instead. */
type TagListingOutcome =
  | { readonly kind: "listed"; readonly tags: readonly RemoteTag[] }
  | Extract<DependencyTagProbeResult, { kind: "tag-listing-failed" }>;

interface TagListingRequest {
  readonly seam: DependencyTagListingSeam;
  readonly url: string;
  readonly auth?: ReturnType<typeof buildCloneAuth>;
  readonly memo?: Map<string, readonly RemoteTag[]>;
}

/**
 * Reads the repository's tags, serving a memoized listing where one is held.
 *
 * A throw becomes the failure arm rather than escaping, and the memo entry is
 * dropped on failure so a later attempt in the same cascade re-queries instead
 * of replaying a transient error.
 */
async function listCandidateTags(request: TagListingRequest): Promise<TagListingOutcome> {
  const memoized = request.memo?.get(request.url);
  if (memoized !== undefined) {
    return { kind: "listed", tags: memoized };
  }

  try {
    const tags = await request.seam.listRemoteTags({
      url: request.url,
      ...(request.auth !== undefined && { auth: request.auth }),
    });
    request.memo?.set(request.url, tags);
    return { kind: "listed", tags };
  } catch (err) {
    request.memo?.delete(request.url);
    return {
      kind: "tag-listing-failed",
      cause: err instanceof Error ? err : new Error(String(err)),
      classification: classifyGitTransportFailure(err),
    };
  }
}

/**
 * Reads one advertised tag as a pin for this dependency, or as nothing.
 *
 * The prefix test is what keeps the probe from resolving an arbitrary unpinned
 * ref: a tag that does not carry THIS dependency's own release prefix is never
 * a candidate, however satisfying a version its name may otherwise contain. A
 * remainder that is not a version is skipped rather than failing the probe,
 * because an unrelated naming scheme in the same repository is not an error.
 */
function readPinCandidate(tag: RemoteTag, prefix: string, range: string): PinnedTag | undefined {
  if (!tag.name.startsWith(prefix)) {
    return undefined;
  }

  const version = valid(tag.name.slice(prefix.length));
  if (version === null || !recordedVersionSatisfies(version, range)) {
    return undefined;
  }

  return { kind: "pinned", tag: tag.name, oid: tag.oid, version };
}

/**
 * Picks the highest-versioned satisfying tag, or reports that none satisfies.
 *
 * The satisfaction test is `domain/dependency-range.ts`'s, not a second
 * evaluator: one module owns what it means for a version to satisfy a range,
 * whether that version was recorded for an installed plugin or read off a tag.
 */
function selectHighestSatisfyingTag(
  tags: readonly RemoteTag[],
  prefix: string,
  range: string,
): DependencyTagProbeResult {
  let highest: PinnedTag | undefined;
  for (const tag of tags) {
    const candidate = readPinCandidate(tag, prefix, range);
    if (
      candidate !== undefined &&
      (highest === undefined || gt(candidate.version, highest.version))
    ) {
      highest = candidate;
    }
  }

  return highest ?? { kind: "no-matching-tag", range: renderConstraintRange(range) };
}

/**
 * Resolves a constrained dependency to the highest release tag on its source
 * repository that satisfies the constraint.
 *
 * The query URL is the source's canonical clone URL carried to its wire form
 * (MURL-01), and the credential bundle is the host bundle every other clone
 * path already builds -- this adds no second credential acquisition path.
 */
export async function probeDependencyTags(
  options: DependencyTagProbeOptions,
): Promise<DependencyTagProbeResult> {
  const seam = options.seam ?? REAL_DEPENDENCY_TAG_LISTING_SEAM;
  const { source, pluginName, range } = options;
  const cloneUrl = canonicalCloneUrl(source);
  const auth = buildCloneAuth(cloneUrl, source.kind, options.auth);

  const listing = await listCandidateTags({
    seam,
    url: ensureGitSuffix(cloneUrl),
    ...(auth !== undefined && { auth }),
    ...(options.tagMemo !== undefined && { memo: options.tagMemo }),
  });
  if (listing.kind === "tag-listing-failed") {
    return listing;
  }

  return selectHighestSatisfyingTag(listing.tags, `${pluginName}${RELEASE_TAG_SEPARATOR}`, range);
}
