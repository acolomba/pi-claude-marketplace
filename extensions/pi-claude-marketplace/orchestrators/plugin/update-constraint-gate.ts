// orchestrators/plugin/update-constraint-gate.ts
//
// Answers what the installed records that declare a plugin hold it to: the
// gate `preparePluginUpdate` composes before resolving an update candidate,
// so a plugin's version never moves outside what its own dependents allow
// (UPDT-01, UPDT-02).
//
// Deliberately ABSENT from `tests/architecture/gate-targets.ts`'s
// `NETWORK_FREE_TARGETS`, for the same reason its tag-probe callees are
// (D-10-19): stage one's tag query reaches the network from inside this
// leaf, and `update-preflight.ts` composes and invokes it through the
// `constraintGate` injected field -- a name the network-free gate does not
// match -- so neither owner gains a git surface and no gate edit is needed.
//
// AUTH-09: the credential bundle is threaded in through `options.auth` from
// the caller, which builds it once and shares it with the clone probe; this
// leaf reads no credential value, stores none, and places none on a
// returned verdict.
//
// The range algebra is `intersectDependencyRanges` alone: the two
// project-owned caps on total input size and projected conjuncts live
// there, and calling `semver` directly from this leaf would bypass both.

import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  renderConstraintRange,
} from "../../domain/dependency-range.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";

import { buildScopeDeclarationDetail } from "./dependency-index.ts";
import { probeDependencyTags } from "./dependency-tag-probe.ts";
import { probeMarketplaceTags } from "./marketplace-tag-probe.ts";

import type { AddressedDependency } from "./dependency-index.ts";
import type { DependencyTagListingFailureReason } from "./dependency-tag-probe.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/**
 * One installed record that declares the target, with the range it declared
 * and whether it is currently disabled. `range` is absent when the
 * declaration names the key with no version -- it still HOLDS the key (a
 * declaration holds whatever it names), but contributes nothing to the fold.
 */
export interface ConstraintHolder {
  readonly key: string;
  readonly range?: string;
  readonly disabled: boolean;
}

/**
 * The declaration-walk and tag-probe operations this leaf composes,
 * injectable for tests.
 */
export interface UpdateConstraintSeam {
  readonly buildScopeDeclarationDetail: typeof buildScopeDeclarationDetail;
  readonly probeDependencyTags: typeof probeDependencyTags;
  readonly probeMarketplaceTags: typeof probeMarketplaceTags;
}

/** Inputs required to evaluate one plugin's declared constraints. */
export interface UpdateConstraintOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly entry: PluginEntry;
  readonly marketplaceRoot: string;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly seam?: UpdateConstraintSeam;
  /** Per-URL tag-listing memo, one update run wide (D-10-18). */
  readonly tagMemo?: Map<string, readonly RemoteTag[]>;
  /** The path-source analogue of `tagMemo` (D-10-18), same status. */
  readonly marketplaceTagMemo?: Map<string, readonly ReleaseTagCandidate[]>;
  readonly auth: {
    readonly ctx?: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

/** What the target's installed dependents hold it to. */
export type UpdateConstraintVerdict =
  | { readonly kind: "unconstrained" }
  | {
      readonly kind: "admits";
      readonly range: string;
      readonly holders: readonly ConstraintHolder[];
      readonly pin?: { readonly oid: string; readonly version: string };
      readonly fellBackToCurrentCopy: boolean;
    }
  | { readonly kind: "held"; readonly cause: string };

const REAL_UPDATE_CONSTRAINT_SEAM: UpdateConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,
  probeDependencyTags,
  probeMarketplaceTags,
});

/**
 * The ways stage one can fail to admit a version, plus the two ranges
 * `intersectDependencyRanges` can fail to fold a set into (D-10-10).
 */
type ConstraintArm = "disjoint" | "invalid" | "too-complex" | "no-satisfying-tag" | "transport";

/** Fixed clause per arm (D-10-10): the situation, never an identifier. */
const ARM_CLAUSE: Record<ConstraintArm, string> = {
  disjoint: "the declared ranges admit no version in common",
  invalid: "a declared range could not be read",
  "too-complex": "the declared ranges are too complex to combine",
  // A later stage's post-fetch guard reaches this arm: stage one itself
  // never holds on a no-satisfying-tag answer (it leaves the outcome open,
  // see `decodeTagProbe` below).
  "no-satisfying-tag": "no release tag satisfies the combined range",
  transport: "the release tags could not be listed",
};

function nameHolder(holder: ConstraintHolder): string {
  return holder.disabled ? `"${holder.key}" (currently disabled)` : `"${holder.key}"`;
}

/**
 * Composes the ONE cause line every constraint arm shares (D-10-11): a fixed
 * arm clause, the bounded diagnostic detail behind it, and the declaring
 * plugins in walk order, each marked when currently disabled. Every new arm
 * extends `ARM_CLAUSE` rather than writing a second composer -- the
 * holder-naming half is identical across all of them, so a second composer
 * would be a second place to drift the disabled marking. `detail` carries
 * whatever bounded diagnostic text the calling arm has -- `intersectDependencyRanges`'
 * own measurement/position-only text for the three range-fold arms, or the
 * transport classification for the `transport` arm -- passed through
 * `renderConstraintRange` so a synthesized detail cannot flood the line and
 * never a declared range's raw content.
 */
// fallow-ignore-next-line unused-export -- production reaches this through the "held" arm below in the same module; exported so the paired test drives it directly, and later arms extend it rather than writing a second composer.
export function describeConstraint(
  detail: string,
  holders: readonly ConstraintHolder[],
  // fallow-ignore-next-line private-type-leak -- ConstraintArm enumerates the closed set of situations this composer renders a clause for; callers pass the string literals the fold and the tag probes already emit.
  arm: ConstraintArm,
): string {
  const bounded = renderConstraintRange(detail);
  const required = holders.map(nameHolder).join(", ");
  return `${ARM_CLAUSE[arm]} (${bounded}) -- required by ${required}`;
}

/** The `name@marketplace` key naming one record, on the D-05-06 convention. */
function recordKey(name: string, marketplace: string): string {
  return `${name}@${marketplace}`;
}

/**
 * Every OTHER installed record that declares the target, sorted by key.
 *
 * Walks the scope's own records (never a second scope, D-10-07) rather than
 * the `declarations` map's keys, so each declarer's `enabled` bit is read off
 * the SAME record the walk already holds -- no second state lookup, and no
 * key-string parsing to recover a declarer's name and marketplace. A
 * declarer whose key equals the target's own is skipped before its
 * declarations are even read: a plugin that declares itself constrains
 * nothing. `provenance` is never read -- the question is who declares this
 * key, not how the record got here (D-10-08).
 */
function collectHolders(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  state: ExtensionState,
  target: string,
): readonly ConstraintHolder[] {
  const holders: ConstraintHolder[] = [];
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      const declarerKey = recordKey(name, marketplace.name);
      if (declarerKey === target) {
        continue;
      }

      const declared = declarations.get(declarerKey) ?? [];
      for (const dependency of declared) {
        if (recordKey(dependency.name, dependency.marketplace) !== target) {
          continue;
        }

        holders.push({
          key: declarerKey,
          ...(dependency.version !== undefined && { range: dependency.version }),
          disabled: isRecordedButDisabled(record),
        });
      }
    }
  }

  return holders.sort((left, right) => left.key.localeCompare(right.key));
}

/** Whether the target's own entry source has a tag listing either probe can read. */
type ConstraintTagSource =
  | { readonly kind: "git"; readonly source: GitBackedSource }
  | { readonly kind: "path" }
  | { readonly kind: "absent" };

/**
 * Decides which tag listing, if any, the target's own entry source has --
 * mirroring `install-cascade.ts`'s `resolveMemberTagSource` branch exactly: a
 * git-clonable source (`url` / `git-subdir` / `github`) probes its own
 * repository, a `path` source probes its marketplace clone, and every other
 * kind (`npm`, `unknown`) has no tags either probe can read.
 */
function constraintTagSource(entry: PluginEntry): ConstraintTagSource {
  const parsed = parsePluginSource(entry.source);
  if (parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github") {
    return { kind: "git", source: parsed };
  }

  if (parsed.kind === "path") {
    return { kind: "path" };
  }

  return { kind: "absent" };
}

/** The `admits` arm, with or without a pin (the shape every stage-one branch below returns). */
function admitsRange(
  range: string,
  holders: readonly ConstraintHolder[],
  pin?: { readonly oid: string; readonly version: string },
): UpdateConstraintVerdict {
  return {
    kind: "admits",
    range,
    holders,
    ...(pin !== undefined && { pin }),
    fellBackToCurrentCopy: false,
  };
}

/**
 * Decodes a tag probe's three-way answer into a stage-one verdict -- the SAME
 * shape both `probeDependencyTags` and `probeMarketplaceTags` converge on.
 * `pinned` admits the fold at the tag's own oid and version, read verbatim
 * and neither sorted, filtered nor re-derived; `no-matching-tag` admits the
 * fold with no pin, leaving the outcome to a later stage; `tag-listing-failed`
 * holds the update and names the transport classification, because a
 * repository that could not be reached has not told us anything -- the path
 * arm below folds ITS OWN unreadable listing into `no-matching-tag` before
 * ever reaching this branch (D-10-16), so only the git arm's failure lands
 * here.
 */
function decodeTagProbe(
  range: string,
  holders: readonly ConstraintHolder[],
  probed:
    | { readonly kind: "pinned"; readonly oid: string; readonly version: string }
    | { readonly kind: "no-matching-tag" }
    | {
        readonly kind: "tag-listing-failed";
        readonly classification: DependencyTagListingFailureReason;
      },
): UpdateConstraintVerdict {
  if (probed.kind === "pinned") {
    return admitsRange(range, holders, { oid: probed.oid, version: probed.version });
  }

  if (probed.kind === "no-matching-tag") {
    return admitsRange(range, holders);
  }

  return {
    kind: "held",
    cause: describeConstraint(
      probed.classification ?? "an unclassified transport failure",
      holders,
      "transport",
    ),
  };
}

/**
 * Stage one on a git-backed entry source: probes the source repository's own
 * release tags through the SAME host auth bundle `preparePluginUpdate`
 * already built for the clone probe, passed through untouched -- no second
 * credential acquisition path (AUTH-09).
 *
 * Every REAL caller threads a `ctx` (`UpdatePluginsOptions.ctx` is required
 * the entire way down this call chain); `UpdateConstraintOptions.auth.ctx`
 * stays optional only so a caller that never reaches this arm -- unconstrained,
 * or held before stage one -- needs none. Reaching here with no `ctx` at all
 * cannot safely authenticate a git host, so the query is skipped and the fold
 * admits the range unpinned, leaving the outcome to a later stage -- the same
 * "cannot decide, defer" shape D-10-16 gives an unreadable local listing.
 */
async function probeGitStageOne(
  options: UpdateConstraintOptions,
  seam: UpdateConstraintSeam,
  source: GitBackedSource,
  range: string,
  holders: readonly ConstraintHolder[],
): Promise<UpdateConstraintVerdict> {
  if (options.auth.ctx === undefined) {
    return admitsRange(range, holders);
  }

  const probed = await seam.probeDependencyTags({
    pluginName: options.plugin,
    source,
    range,
    auth: {
      ctx: options.auth.ctx,
      credentialOps: options.auth.credentialOps,
      ...(options.auth.deviceFlowHttp !== undefined && {
        deviceFlowHttp: options.auth.deviceFlowHttp,
      }),
      ...(options.auth.authMemo !== undefined && { authMemo: options.auth.authMemo }),
    },
    ...(options.tagMemo !== undefined && { tagMemo: options.tagMemo }),
  });
  return decodeTagProbe(range, holders, probed);
}

/**
 * Stage one on a `path` entry source: probes the marketplace clone's own
 * local release tags -- no auth, no network (TAGS-01).
 */
async function probePathStageOne(
  options: UpdateConstraintOptions,
  seam: UpdateConstraintSeam,
  range: string,
  holders: readonly ConstraintHolder[],
): Promise<UpdateConstraintVerdict> {
  const probed = await seam.probeMarketplaceTags({
    pluginName: options.plugin,
    marketplaceRoot: options.marketplaceRoot,
    range,
    ...(options.marketplaceTagMemo !== undefined && { tagMemo: options.marketplaceTagMemo }),
  });

  // D-10-16: an unreadable local listing and an empty one are the same
  // user-visible fact, so both leave the outcome to a later stage instead of
  // holding the update the way an unreachable remote does above.
  if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {
    return admitsRange(range, holders);
  }

  return decodeTagProbe(range, holders, probed);
}

/**
 * Evaluates what the target plugin's installed dependents hold it to.
 *
 * The `state` walked is the ONE document the caller already loaded for the
 * target scope: this leaf never loads a second scope's state, so constraints
 * are scope-local by construction (D-10-07). A constrained range reaches
 * stage one: the entry source decides which tag listing to probe, and the
 * highest satisfying tag -- if any -- pins the admitted range.
 */
export async function evaluateUpdateConstraint(
  options: UpdateConstraintOptions,
): Promise<UpdateConstraintVerdict> {
  const seam = options.seam ?? REAL_UPDATE_CONSTRAINT_SEAM;
  const target = recordKey(options.plugin, options.marketplace);

  const walked = await seam.buildScopeDeclarationDetail({
    state: options.state,
    locations: options.locations,
  });
  if (!walked.ok) {
    // D-10-05: the walk's own message IS the rendered cause line -- it is
    // already path-redacted and built without `{ cause }` chaining, so the
    // renderer's cause-chain walk cannot print a raw path behind it.
    // Re-wrapping it here would reintroduce exactly that. This is the same
    // fail-closed model the uninstall refusal uses on an unreadable
    // declarer, and differs from it only in outcome: an update is SKIPPED
    // here, never refused.
    return { kind: "held", cause: walked.cause.message };
  }

  const holders = collectHolders(walked.declarations, options.state, target);
  // A declaration HOLDS the key whatever it names, but only a declared RANGE
  // constrains a version: a holder with no `range` stays in `holders` for
  // the cause line and is left out of the fold below.
  const ranges = holders.flatMap((holder) => (holder.range === undefined ? [] : [holder.range]));
  const fold = intersectDependencyRanges(ranges);
  if (!fold.ok) {
    return { kind: "held", cause: describeConstraint(fold.detail, holders, fold.reason) };
  }

  if (isUnconstrainedRange(fold.range)) {
    return { kind: "unconstrained" };
  }

  const tagSource = constraintTagSource(options.entry);
  if (tagSource.kind === "git") {
    return probeGitStageOne(options, seam, tagSource.source, fold.range, holders);
  }

  if (tagSource.kind === "path") {
    return probePathStageOne(options, seam, fold.range, holders);
  }

  // `npm` / `unknown`: no tag listing either probe can read, so the fold
  // admits the range with no pin and makes no probe call.
  return admitsRange(fold.range, holders);
}
