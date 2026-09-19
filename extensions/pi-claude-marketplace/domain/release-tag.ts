// domain/release-tag.ts
//
// D-07-05 (07-marketplace-repo-tag-resolution): the release-tag selection
// logic, extracted so ONE evaluator serves both the network-touching probe
// (`orchestrators/plugin/dependency-tag-probe.ts`) and the local, network-free
// probe (`orchestrators/plugin/marketplace-tag-probe.ts`). Moved out of the
// former so the local probe never imports a network leaf to reach it.
//
// `ReleaseTagCandidate` is a structural `{ name, oid }` shape rather than
// `platform/git.ts`'s `RemoteTag` type, so this module -- and the local probe
// that builds candidates from `listTags` + `resolveTagOid` -- stays free of
// any transport concern. `RemoteTag` already satisfies this shape, so the
// network probe passes its listing through unchanged.

import { gt, valid } from "semver";

import { recordedVersionSatisfies, renderConstraintRange } from "./dependency-range.ts";

/**
 * The separator the plugin-release tooling places between a plugin's name and
 * its version in a release tag: `formatter--v1.2.0` is release `1.2.0` of
 * `formatter`.
 *
 * A convention of that tooling, NOT a git standard. A repository (or a
 * marketplace clone) that does not follow it advertises no tag either probe
 * considers, and reports no matching tag -- the expected answer for most
 * repositories rather than a defect.
 */
export const RELEASE_TAG_SEPARATOR = "--v";

/**
 * One tag candidate, resolved to the object it names. Structurally satisfied
 * by `platform/git.ts`'s `RemoteTag`.
 */
export interface ReleaseTagCandidate {
  /** The tag name, with no `refs/tags/` prefix. */
  readonly name: string;
  /** The commit oid the tag resolves to. */
  readonly oid: string;
}

/**
 * What selecting among a plugin's release-tag candidates came to.
 *
 * `no-matching-tag` carries the range as rendered for a user-visible reason.
 */
export type SelectedReleaseTag =
  | {
      readonly kind: "pinned";
      readonly tag: string;
      readonly oid: string;
      readonly version: string;
    }
  | { readonly kind: "no-matching-tag"; readonly range: string };

/** The pinned arm alone, so candidate selection can carry one around. */
export type PinnedReleaseTag = Extract<SelectedReleaseTag, { kind: "pinned" }>;

/**
 * Reads one candidate as a pin for this plugin, or as nothing.
 *
 * The prefix test is what keeps a candidate list from resolving an arbitrary
 * unpinned ref: a tag that does not carry THIS plugin's own release prefix is
 * never a candidate, however satisfying a version its name may otherwise
 * contain. A remainder that is not a version is skipped rather than failing
 * the selection, because an unrelated naming scheme in the same repository is
 * not an error.
 *
 * Prefix matching is plain `String.prototype.startsWith`: no case folding, no
 * Unicode normalization -- the identical comparison the network probe already
 * performs, so a name differing only by normalization form is not a
 * candidate.
 */
export function readPinCandidate(
  candidate: ReleaseTagCandidate,
  prefix: string,
  range: string,
): PinnedReleaseTag | undefined {
  if (!candidate.name.startsWith(prefix)) {
    return undefined;
  }

  const version = valid(candidate.name.slice(prefix.length));
  if (version === null || !recordedVersionSatisfies(version, range)) {
    return undefined;
  }

  return { kind: "pinned", tag: candidate.name, oid: candidate.oid, version };
}

/**
 * Picks the highest-versioned satisfying candidate, or reports that none
 * satisfies.
 *
 * The satisfaction test is `domain/dependency-range.ts`'s, not a second
 * evaluator: one module owns what it means for a version to satisfy a range,
 * whether that version was recorded for an installed plugin or read off a
 * tag.
 */
export function selectHighestSatisfyingTag(
  candidates: readonly ReleaseTagCandidate[],
  prefix: string,
  range: string,
): SelectedReleaseTag {
  let highest: PinnedReleaseTag | undefined;
  for (const candidate of candidates) {
    const pin = readPinCandidate(candidate, prefix, range);
    if (pin !== undefined && (highest === undefined || gt(pin.version, highest.version))) {
      highest = pin;
    }
  }

  return highest ?? { kind: "no-matching-tag", range: renderConstraintRange(range) };
}
