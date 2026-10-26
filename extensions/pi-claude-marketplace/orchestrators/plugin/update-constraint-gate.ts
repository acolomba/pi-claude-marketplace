// orchestrators/plugin/update-constraint-gate.ts
//
// Answers what the installed records that declare a plugin hold it to: the
// gate `preparePluginUpdate` composes before resolving an update candidate,
// so a plugin's version never moves outside what its own dependents allow
// (UPDT-01, UPDT-02).
//
// Listed in `eslint.config.js`'s `NETWORK_SEAMS` for the same reason its
// tag-probe callees are (D-10-19): stage one's tag query reaches the network
// from inside this leaf. `update-preflight.ts` composes and invokes it
// through the `constraintGate` injected field, a name the network-free gate
// does not match.
//
// AUTH-09: the credential bundle is threaded in through `options.auth` from
// the caller, which builds it once and shares it with the clone probe; this
// leaf reads no credential value, stores none, and places none on a
// returned verdict.
//
// The declaration walk, the holders, the range fold and the cause lines live
// in the network-free `constraint-fold.ts`, which the convergence planner and
// `apply`'s runner share (D-23); this leaf adds the tag search on top.

import { parsePluginSource } from "../../domain/source.ts";

import { admitsRange, evaluateCatalogConstraint, transportHeld } from "./constraint-fold.ts";
import { buildScopeDeclarationDetail } from "./dependency-index.ts";
import { probeDependencyTags } from "./dependency-tag-probe.ts";
import { probeMarketplaceTags } from "./marketplace-tag-probe.ts";

import type {
  ConstraintHolder,
  ConstraintRequester,
  UpdateConstraintVerdict,
} from "./constraint-fold.ts";
import type { DependencyTagListingFailureReason } from "./dependency-tag-probe.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

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
  /** UPD-DEP-D1: the plugin whose ranges the move must also satisfy. */
  readonly requester?: ConstraintRequester;
  readonly auth: {
    readonly notification?: { readonly ctx: NotificationContext; readonly run: NotificationRun };
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_UPDATE_CONSTRAINT_SEAM: UpdateConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,
  probeDependencyTags,
  probeMarketplaceTags,
});

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
    return admitsRange(range, holders, { pin: { oid: probed.oid, version: probed.version } });
  }

  if (probed.kind === "no-matching-tag") {
    return admitsRange(range, holders);
  }

  return transportHeld(holders, probed.classification ?? "an unclassified transport failure");
}

/**
 * Stage one on a git-backed entry source: probes the source repository's own
 * release tags through the SAME host auth bundle `preparePluginUpdate`
 * already built for the clone probe, passed through untouched -- no second
 * credential acquisition path (AUTH-09).
 *
 * Every REAL caller threads a `ctx` (`UpdatePluginsOptions.ctx` is required
 * the entire way down this call chain); `UpdateConstraintOptions.auth.notification`
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
  if (options.auth.notification === undefined) {
    return admitsRange(range, holders);
  }

  const probed = await seam.probeDependencyTags({
    pluginName: options.plugin,
    source,
    range,
    auth: {
      ...options.auth.notification,
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

  // D-10-14 / D-10-16: an unreadable local listing and an empty one are the
  // same user-visible fact, so both fall back to the marketplace's CURRENT
  // copy and leave the outcome to a later stage instead of holding the
  // update the way an unreachable remote does above. The git arm's own
  // no-satisfying-tag branch (`decodeTagProbe` above) leaves
  // `fellBackToCurrentCopy` at its `false` default -- a git source with no
  // satisfying tag refreshes its own branch head, not a marketplace's
  // current copy, so it must not claim that token.
  if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {
    return admitsRange(range, holders, { fellBackToCurrentCopy: true });
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
 *
 * Rejects with `DependencyDeclarationsUnreadableError` when the walk cannot
 * read a recorded plugin's declarations (D-18-17).
 */
export async function evaluateUpdateConstraint(
  options: UpdateConstraintOptions,
): Promise<UpdateConstraintVerdict> {
  const seam = options.seam ?? REAL_UPDATE_CONSTRAINT_SEAM;

  // D-10-05 / D-18-17: the walk and the fold are the tag-free gate's, so a
  // walk that cannot read a record fails the operation closed here too.
  const verdict = await evaluateCatalogConstraint({ ...options, seam });
  if (verdict.kind !== "admits") {
    return verdict;
  }

  const tagSource = constraintTagSource(options.entry);
  if (tagSource.kind === "git") {
    return probeGitStageOne(options, seam, tagSource.source, verdict.range, verdict.holders);
  }

  if (tagSource.kind === "path") {
    return probePathStageOne(options, seam, verdict.range, verdict.holders);
  }

  // `npm` / `unknown`: no tag listing either probe can read, so the fold
  // admits the range with no pin and makes no probe call.
  return verdict;
}
