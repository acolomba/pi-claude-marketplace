// orchestrators/plugin/install-cascade.ts
//
// The OUTER, multi-plugin ledger (RESV-01, RESV-06, D-03-07). It resolves the
// dependency closure of one requested plugin and materializes every member of
// it under a second `runPhases` instantiation, so a failure anywhere unwinds
// the whole cascade instead of leaving a half-satisfied graph behind.
//
// Locking contract: the CALLER owns the per-scope state lock and the
// load/save lifecycle. This module performs NO `withStateGuard` /
// `withLockedStateTransaction` / `saveState` of its own -- `proper-lockfile`
// (`retries: 0`) is NOT re-entrant, so nesting a second guard on the same
// `stateLockFile` self-deadlocks (ELOCKED -> StateLockHeldError). Every member
// is materialized through `runInstallLedger`, which carries the same guard-free
// contract; the lock-acquiring `installPlugin` entry point is never called for
// a member.
//
// Derived phase array: `transaction/phase-ledger.ts` states a literal-array
// discipline at its call sites, and this module hands `runPhases` an array
// built by mapping over the closure. The discipline guards against IMPLICIT
// phase ordering that can drift across refactors. This order is not implicit:
// it is the closure walk's post-order accumulator, which is a separately
// stated and separately tested contract of `domain/dependency-closure.ts` --
// dependencies before dependents, the requested plugin last. Reordering the
// array would mean changing that walk, and the walk's own cases would fail.
//
// Constraint resolution runs BETWEEN the closure walk and the phase array, and
// that position is the contract (RESV-03, RESV-05). Every way a version
// constraint can fail -- contradictory declarations, a combination too large to
// compute, an unparseable range, no satisfying release tag, a tag listing that
// could not be read, and an already-installed copy at a version the constraint
// rejects -- is decided before a single `Phase` exists. A constraint failure
// therefore never reaches rollback, because there is nothing materialized for
// rollback to unwind.
//
// The wildcard short-circuit is load-bearing for NFR-5, not an optimization. A
// dependency whose accumulated ranges come to no constraint makes NO tag query
// at all, so the overwhelmingly common declaration -- a name with no version --
// keeps a warm install entirely offline. Only a member carrying a REAL range
// reaches the network, which is the exact read D-03-03 amended NFR-5 for.
//
// D-03-04 is accepted here rather than guarded. An already-installed member's
// RECORDED version goes through `recordedVersionSatisfies`' normalization
// ladder with no special case for this project's `hash-<12hex>` and
// `sha-<12hex>` forms, which have no upstream equivalent. The consequence is
// plain: coercion can extract a misleading digit run from one of those strings
// and produce a version that unpredictably satisfies or fails a range, and a
// form that normalizes to nothing satisfies no range at all. The risk is taken
// knowingly rather than papered over, because a guard the upstream mechanism
// does not have would be a divergence of its own.
//
// D-03-07 rollback scope has three parts, and only one of them is structural.
// A DEPENDENCY the closure skipped as already-installed and LEFT ALONE never
// becomes a `Phase`, so the reverse walk over `runPhases`'s own `executed`
// array cannot reach its record or its artifacts, and no flag can make that
// safer than it already is. A dependency the closure skipped as
// already-installed but DISABLED is different (EDEP-03): it is
// re-materialized through its own record by `buildReEnableMemberPhase`, so it
// DOES become a `Phase`, and a failure anywhere in the cascade puts it back to
// disabled rather than leaving it re-enabled with nothing to unwind it. The
// REQUESTED plugin is different again: it is never skipped, so an install of
// a plugin that is already recorded reaches its phase and throws from inside
// `do`. TR-02 then runs that phase's OWN undo, which would unstage the very
// install the throw was reporting. `Phase.undo`'s contract states the remedy
// -- an undo cannot assume its `do` ran to completion and must gate on a
// context-set sentinel -- so each phase records itself in `materialized` after
// its ledger returns, and `undo` acts only on what it finds there.

import { resolveDependencyClosure } from "../../domain/dependency-closure.ts";
import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  recordedVersionSatisfies,
  renderConstraintRange,
} from "../../domain/dependency-range.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isRecordedButDisabled, toDisabledRecord } from "../../persistence/state-io.ts";
import { runPhases } from "../../transaction/phase-ledger.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../auth-host.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { probeDependencyTags } from "./dependency-tag-probe.ts";
import { runInstallLedger } from "./install-outcome.ts";
import { probeMarketplaceTags } from "./marketplace-tag-probe.ts";
import { applyPartialCascadeFold } from "./shared.ts";

import type {
  DependencyTagListingFailureReason,
  DependencyTagProbeOptions,
} from "./dependency-tag-probe.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerResult,
  InstallLedgerSummary,
  InstallLedgerTransaction,
} from "./install-outcome.ts";
import type { MarketplaceTagProbeOptions } from "./marketplace-tag-probe.ts";
import type {
  ClosureLookup,
  ClosureMember,
  DependencyClosureResult,
} from "../../domain/dependency-closure.ts";
import type { DependencyRangeIntersection } from "../../domain/dependency-range.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { Phase, RollbackPartial, RunPhasesResult } from "../../transaction/phase-ledger.ts";

/** Materialization operations the cascade drives, injectable for fault tests. */
export interface InstallCascadeLedgerSeam {
  readonly runInstallLedger: typeof runInstallLedger;
  readonly cascadeUnstagePlugin: typeof cascadeUnstagePlugin;
}

/**
 * Named at module scope rather than written as an inline parameter default, so
 * every call that omits `seam` reads this one frozen object instead of
 * allocating a fresh literal per invocation (typescript:S7737).
 */
const REAL_INSTALL_CASCADE_SEAM: InstallCascadeLedgerSeam = Object.freeze({
  runInstallLedger,
  cascadeUnstagePlugin,
});

/** Same rationale as the seam above, for the ledger scheduler. */
const DEFAULT_INSTALL_CASCADE_TRANSACTION: InstallLedgerTransaction = Object.freeze({ runPhases });

/**
 * The tag-resolving operation, injected so a cascade test never lists a real
 * remote.
 *
 * The injection point is named for what it DOES. `install-cascade.ts` is not
 * itself a `NETWORK_FREE_TARGETS` member, but both of its callers are and that
 * gate matches bare identifiers, so nothing reachable from them may be spelled
 * with one of the tokens it looks for.
 */
export type CascadeTagProbe = typeof probeDependencyTags;

/**
 * The LOCAL, network-free tag-resolving operation for a path-source member's
 * constraint -- lists the marketplace clone's own tags rather than a remote's
 * advertised refs (TAGS-01, D-07-05).
 */
export type CascadeMarketplaceTagProbe = typeof probeMarketplaceTags;

/** The per-URL tag listing memo one cascade run threads through every query. */
type CascadeTagMemo = NonNullable<DependencyTagProbeOptions["tagMemo"]>;

/**
 * The per-marketplace-root tag listing memo one cascade run threads through
 * every path-source member's local probe, so several members constrained
 * against the SAME marketplace clone list it once (WR-02).
 */
type CascadeMarketplaceTagMemo = NonNullable<MarketplaceTagProbeOptions["tagMemo"]>;

/**
 * Resolves the marketplace record a member's source is read from.
 *
 * Injected because the caller, not this module, knows how a marketplace name
 * resolves for the install in progress: a project-scope install reaches a
 * user-scope marketplace through the CMP-3 fallback, and that fallback is
 * exactly the set D-03-08's guard now admits. Reading the snapshot here instead
 * would answer "no source" for those marketplaces and move the refusal from the
 * guard to a `no-matching-tag` the member never earned.
 */
export type CascadeMarketplaceLookup = (
  marketplace: string,
) => Promise<ExtensionState["marketplaces"][string] | undefined>;

/**
 * Why a member's accumulated version constraint produced no install.
 *
 * `range` is the constraint as rendered for a user-visible row, already bounded
 * by `renderConstraintRange`. Every arm carries the member key and that range
 * and nothing else identifying: no arm carries a filesystem path, and the
 * intersection's own `detail` is assembled from measurements and field
 * positions rather than from any declared range's text.
 *
 * The two `range-conflict` arms are distinguished by `why`, because a
 * contradiction BETWEEN declarations and a contradiction with what is already
 * on disk are different facts about different subjects.
 */
export type CascadeConstraintFailure =
  | {
      readonly kind: "range-conflict";
      readonly why: "contradictory-declarations";
      readonly key: string;
      readonly range: string;
      readonly detail: string;
    }
  | {
      readonly kind: "range-conflict";
      readonly why: "installed-unsatisfied";
      readonly key: string;
      readonly range: string;
      readonly recordedVersion: string;
    }
  | {
      readonly kind: "range-too-complex";
      readonly key: string;
      readonly range: string;
      readonly detail: string;
    }
  | {
      readonly kind: "range-invalid";
      readonly key: string;
      readonly range: string;
      readonly detail: string;
    }
  | { readonly kind: "no-matching-tag"; readonly key: string; readonly range: string }
  | {
      readonly kind: "tag-listing-failed";
      readonly key: string;
      readonly range: string;
      readonly classification: DependencyTagListingFailureReason;
    };

/**
 * A closure member whose accumulated constraint has been resolved.
 *
 * `pin` is present only for a member whose constraint was a real range that a
 * release tag satisfied. An unconstrained member carries no `pin` and installs
 * from whatever ref its marketplace entry names. Folding the oid and version
 * into one field keeps them from drifting apart: a producer cannot set one
 * without the other, and a consumer's single presence check answers "pinned"
 * for both at once.
 */
export interface ResolvedCascadeMember extends ClosureMember {
  readonly pin?: {
    /** The object id the selected tag resolves to, which the install pins on. */
    readonly oid: string;
    /**
     * The semver the selected tag carries, recorded as the member's version.
     *
     * RESV-05 reads a recorded version back against the constraint on the next
     * install. A git-materialized install otherwise records `sha-<12hex>`, which
     * `recordedVersionSatisfies`' normalization ladder either rejects outright or
     * coerces into an arbitrary digit run (D-03-04) -- so the run that pinned the
     * tag would fail its own constraint the second time it ran. The tag's own
     * version is the value that makes the pin readable back.
     */
    readonly version: string;
  };
  /**
   * TAGS-02: a path-source member whose marketplace clone carried no tag
   * satisfying its constraint (or whose local listing could not be read at
   * all, D-07-07) resolved anyway, installing the marketplace's current copy
   * in place of a pin.
   *
   * This is an optional marker rather than a member of `CascadeConstraintFailure`
   * on purpose: `MemberConstraintResolution` is a strict two-arm union and
   * D-03-07 makes any failure arm fail the whole cascade all-or-nothing, which
   * is the exact opposite of what TAGS-02 requires. Reusing the failure shape
   * here would fail the requesting plugin's install for a dependency that
   * installed fine.
   */
  readonly fellBackToCurrentCopy?: true;
}

/** Every member's constraint resolved, or the first failure one produced. */
type MemberConstraintResolution =
  | { readonly ok: true; readonly members: readonly ResolvedCascadeMember[] }
  | { readonly ok: false; readonly failure: CascadeConstraintFailure };

/** Inputs of one cascade run's constraint resolution. */
interface MemberConstraintOptions {
  /** The caller's locked snapshot: the recorded versions and the catalog roots. */
  readonly state: ExtensionState;
  /** The members this run would install, in closure order. */
  readonly closure: readonly ClosureMember[];
  /** The members RESV-05 skipped, which are CHECKED and never installed. */
  readonly alreadyInstalled: readonly ClosureMember[];
  /**
   * The caller's per-member ledger options.
   *
   * The probe's credential bundle is read from the SAME builder that threads
   * those collaborators into every member's install, so a cascade cannot
   * authenticate a tag query differently from the clone that follows it.
   */
  readonly ledgerOptionsFor: (member: ResolvedCascadeMember) => InstallLedgerOptions;
  readonly tagProbe: CascadeTagProbe;
  readonly tagMemo: CascadeTagMemo;
  /**
   * The local, network-free tag probe a path-source member's constraint
   * routes through. Defaults to `probeMarketplaceTags`.
   */
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
  /**
   * The per-marketplace-root listing memo threaded into every path-source
   * member's local probe (WR-02), so a cascade constraining several members
   * against the SAME marketplace clone lists it once.
   */
  readonly marketplaceTagMemo: CascadeMarketplaceTagMemo;
  /**
   * How a member's marketplace name resolves to the record its source is read
   * from. Defaults to the snapshot's own map, which is the whole answer only
   * when every reachable marketplace is already recorded in the target scope.
   */
  readonly marketplaceRecordFor?: CascadeMarketplaceLookup;
}

/** One member the cascade itself materialized, in install order. */
export interface CascadeMemberOutcome {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly requiredBy: string | undefined;
  readonly version: string;
  /**
   * What the member staged, as the two soft-dependency kinds the renderer
   * probes for. Carried as booleans rather than as the staged name lists so a
   * member row can fire the same `{requires pi-...}` marker and the same SEV-01
   * severity an ordinary install row does, without this module reaching for the
   * presentation vocabulary that decides how.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  /**
   * Where the member materialized, and the hooks config it declared relative to
   * that root -- `undefined` when it declared none.
   *
   * Carried so the caller can hydrate a member's hooks into the routing table
   * the way it already hydrates the requesting plugin's: a dependency whose
   * ledger staged a `hooks.json` otherwise has the file on disk and no routing
   * entry, leaving its hooks inert until the next `/reload`.
   *
   * Never rendered. The row composer reads a structural subset of this type
   * that declares neither field, so no cascade row can interpolate the path.
   */
  readonly pluginRoot: string;
  readonly hooksConfigPath: string | undefined;
  /**
   * TAGS-02: whether this member installed the marketplace's current copy
   * because no tag satisfied its constraint, rather than a pin.
   *
   * REQUIRED, not optional: an optional member of a closed row shape compiles
   * clean at every construction site that omits it, which is precisely how a
   * new fact goes silently unreported. Making it required turns every
   * construction site into a compile error the author must answer.
   */
  readonly fellBackToCurrentCopy: boolean;
  /**
   * EDEP-03: whether this member was already installed and DISABLED, and this
   * run turned it back on through its own record rather than materializing a
   * fresh one.
   *
   * REQUIRED on the same D-07 rationale as `fellBackToCurrentCopy`: an
   * optional member of a closed row shape compiles clean at every
   * construction site that omits it, which is exactly how a new fact goes
   * silently unreported.
   */
  readonly reEnabledFromRecord: boolean;
}

/**
 * One dependency RESV-05 found already present, ENABLED, and left exactly as
 * it was. A disabled already-installed dependency is EDEP-03's own subcase --
 * `partitionAlreadyInstalled` routes it to `buildReEnableMemberPhase` instead,
 * so it never reaches this shape.
 *
 * It never becomes a `Phase`, so it has no ledger summary to project. The two
 * fields here are what a row needs to say so: the key naming it, and the
 * version the snapshot records for it -- `undefined` when the snapshot records
 * none, which is the same state the constraint check reads as nothing to
 * conflict with.
 */
export interface CascadeSkippedMember {
  readonly key: string;
  readonly version: string | undefined;
}

/** Inputs of one cascade run. */
export interface InstallCascadeOptions {
  /** The caller's locked snapshot. Every member mutates THIS object. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** `<plugin>@<marketplace>` of the plugin the user asked for. */
  readonly rootKey: string;
  readonly lookup: ClosureLookup;
  /**
   * Per-member ledger options; the caller owns scope, cwd and the auth bundle.
   *
   * The member handed over carries the pin its constraint selected, so the
   * caller's builder is where a re-pinned tag enters that member's install.
   */
  readonly ledgerOptionsFor: (member: ResolvedCascadeMember) => InstallLedgerOptions;
  readonly installedKeys: ReadonlySet<string>;
  readonly knownMarketplaces: ReadonlySet<string>;
  /**
   * The caller's failure capture, threaded to every member's ledger so a
   * member's own bridge-level rollback partials reach the caller's failure row
   * exactly as they do for a single install.
   */
  readonly capture?: InstallFailureCapture;
  readonly seam?: InstallCascadeLedgerSeam;
  readonly transaction?: InstallLedgerTransaction;
  /** Tag resolution for a constrained member; defaults to the real probe. */
  readonly tagProbe?: CascadeTagProbe;
  /**
   * Local tag resolution for a constrained path-source member; defaults to
   * `probeMarketplaceTags`.
   */
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
  /**
   * How a member's marketplace name resolves to the record its source is read
   * from. The caller passes the SAME resolution its `lookup` uses, so the walk
   * and the pin probe cannot disagree about which source backs a member.
   */
  readonly marketplaceRecordFor?: CascadeMarketplaceLookup;
}

/** The cascade's outcome. */
export type InstallCascadeResult =
  | {
      readonly kind: "installed";
      readonly root: InstallLedgerSummary;
      readonly members: readonly CascadeMemberOutcome[];
      /**
       * RESV-05's own outcome list. The closure skipped these, so they appear
       * in neither `members` nor the phase array -- and without them the caller
       * could not tell a dependency this run installed from one that was
       * already here, which is exactly the distinction RESV-06 asks the output
       * to make.
       */
      readonly alreadyInstalled: readonly CascadeSkippedMember[];
    }
  | { readonly kind: "marketplace-absent" }
  | {
      readonly kind: "closure-failed";
      readonly failure: Extract<DependencyClosureResult, { readonly ok: false }>;
    }
  | { readonly kind: "constraint-failed"; readonly failure: CascadeConstraintFailure }
  | {
      readonly kind: "member-failed";
      readonly key: string;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
    };

/** Mutable ledger context: what the phases record as they run. */
interface CascadeRun {
  root: InstallLedgerSummary | undefined;
  marketplaceAbsent: boolean;
  attempting: string | undefined;
  readonly members: CascadeMemberOutcome[];
  /** Keys THIS run materialized, and the only keys an `undo` may touch. */
  readonly materialized: Set<string>;
}

/**
 * Map an intersection failure onto the cascade's own discriminant.
 *
 * The DECLARED ranges are what the row reports here, because an intersection
 * that failed produced no combined range to report instead. Each of them
 * already passed the declared-version allowlist, and the join is bounded
 * exactly like any other rendered range.
 */
function toIntersectionFailure(
  member: ClosureMember,
  failed: Extract<DependencyRangeIntersection, { readonly ok: false }>,
): CascadeConstraintFailure {
  const key = member.key;
  const range = renderConstraintRange(member.ranges.join(" "));
  if (failed.reason === "disjoint") {
    return {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key,
      range,
      detail: failed.detail,
    };
  }

  return failed.reason === "too-complex"
    ? { kind: "range-too-complex", key, range, detail: failed.detail }
    : { kind: "range-invalid", key, range, detail: failed.detail };
}

/**
 * Where a member's release tags would live: the git-backed source's own
 * repository, or -- for a `path` source -- its marketplace clone's local
 * tags (TAGS-01). The SOURCE comes from the member's own marketplace entry,
 * never from the declaration that named it -- a dependency declaration
 * carries a version, and a version may select among a source's tags but may
 * never change which source is read.
 *
 * A member whose source carries no tags at all (`npm` / `unknown`, or an
 * absent marketplace record / manifest entry) is the `absent` arm. It reports
 * the same no-match its constrained siblings report rather than a second
 * shape of failure, which is D-03-09's rule applied one step earlier: one
 * no-match answer, no branch on how the source parsed, and no path to a
 * repository head.
 */
type MemberTagSource =
  | { readonly kind: "git"; readonly source: GitBackedSource }
  | { readonly kind: "path"; readonly marketplaceRoot: string }
  | { readonly kind: "absent" };

async function resolveMemberTagSource(
  options: MemberConstraintOptions,
  member: ClosureMember,
): Promise<MemberTagSource> {
  const lookup =
    options.marketplaceRecordFor ??
    ((marketplace: string) => Promise.resolve(options.state.marketplaces[marketplace]));
  const record = await lookup(member.marketplace);
  if (record === undefined) {
    return { kind: "absent" };
  }

  const manifest = await loadMarketplaceManifest(record.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, member.name);
  if (declared.kind === "absent") {
    return { kind: "absent" };
  }

  const parsed = parsePluginSource(declared.entry.source);
  if (parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github") {
    return { kind: "git", source: parsed };
  }

  if (parsed.kind === "path") {
    return { kind: "path", marketplaceRoot: record.marketplaceRoot };
  }

  return { kind: "absent" };
}

/** One member resolved to a pin, or the failure its constraint produced. */
type MemberConstraintOutcome =
  | { readonly kind: "resolved"; readonly member: ResolvedCascadeMember }
  | { readonly kind: "failed"; readonly failure: CascadeConstraintFailure };

/**
 * Query a constrained member's release tags and turn the answer into a pin.
 *
 * The auth bundle is lifted from the member's own ledger options rather than
 * composed here, so the tag query and the clone that follows it authenticate
 * against one host bundle and one per-host memo. No credential value is read
 * or placed on any returned arm (AUTH-09).
 */
/**
 * Map a tag probe's answer -- local or network, they converge on this ONE
 * shape -- onto the member's constraint outcome. Shared by both branches of
 * `probeMemberPin` below so the three-way decode (pinned / no-matching-tag /
 * tag-listing-failed) is not written twice; the pin itself is written through
 * the SAME literal shape the git-backed arm always has, which is what makes
 * D-07-02 require no downstream change.
 */
function toMemberConstraintOutcome(
  member: ClosureMember,
  range: string,
  probed:
    | { readonly kind: "pinned"; readonly oid: string; readonly version: string }
    | { readonly kind: "no-matching-tag"; readonly range: string }
    | {
        readonly kind: "tag-listing-failed";
        readonly classification: DependencyTagListingFailureReason;
      },
): MemberConstraintOutcome {
  if (probed.kind === "pinned") {
    return {
      kind: "resolved",
      member: { ...member, pin: { oid: probed.oid, version: probed.version } },
    };
  }

  if (probed.kind === "no-matching-tag") {
    return {
      kind: "failed",
      failure: { kind: "no-matching-tag", key: member.key, range: probed.range },
    };
  }

  return {
    kind: "failed",
    failure: {
      kind: "tag-listing-failed",
      key: member.key,
      range: renderConstraintRange(range),
      classification: probed.classification,
    },
  };
}

async function probeMemberPin(
  options: MemberConstraintOptions,
  member: ClosureMember,
  range: string,
): Promise<MemberConstraintOutcome> {
  const tagSource = await resolveMemberTagSource(options, member);
  if (tagSource.kind === "absent") {
    return {
      kind: "failed",
      failure: { kind: "no-matching-tag", key: member.key, range: renderConstraintRange(range) },
    };
  }

  if (tagSource.kind === "path") {
    // TAGS-01/03: a satisfying tag pins the member exactly like a git-backed
    // source does.
    const marketplaceTagProbe = options.marketplaceTagProbe ?? probeMarketplaceTags;
    const probed = await marketplaceTagProbe({
      pluginName: member.name,
      marketplaceRoot: tagSource.marketplaceRoot,
      range,
      tagMemo: options.marketplaceTagMemo,
    });

    // TAGS-02 / D-07-07: no tag satisfies the constraint, or the local
    // listing could not even be read (an unreadable listing and an empty one
    // are the same user-visible fact -- there is no tag here that satisfies
    // you) -- either way the member resolves anyway, installing the
    // marketplace's current copy in place of a pin. One fallback arm covers
    // both, and the install succeeds either way, so no transport
    // classification is owed on a success row.
    if (probed.kind === "no-matching-tag" || probed.kind === "tag-listing-failed") {
      return { kind: "resolved", member: { ...member, fellBackToCurrentCopy: true } };
    }

    return toMemberConstraintOutcome(member, range, probed);
  }

  const ledger = options.ledgerOptionsFor(member);
  const probed = await options.tagProbe({
    pluginName: member.name,
    source: tagSource.source,
    range,
    tagMemo: options.tagMemo,
    auth: {
      ctx: ledger.ctx,
      credentialOps: ledger.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(ledger.deviceFlowHttp !== undefined && { deviceFlowHttp: ledger.deviceFlowHttp }),
      ...(ledger.authMemo !== undefined && { authMemo: ledger.authMemo }),
    },
  });
  return toMemberConstraintOutcome(member, range, probed);
}

/**
 * Resolve one member this run would install.
 *
 * The wildcard arm returns the member untouched and makes NO query: an empty
 * accumulator intersects to the wildcard, so a dependency declared with no
 * version never reaches a remote.
 */
async function resolveOneMember(
  options: MemberConstraintOptions,
  member: ClosureMember,
): Promise<MemberConstraintOutcome> {
  const intersected = intersectDependencyRanges(member.ranges);
  if (!intersected.ok) {
    return { kind: "failed", failure: toIntersectionFailure(member, intersected) };
  }

  return isUnconstrainedRange(intersected.range)
    ? { kind: "resolved", member }
    : probeMemberPin(options, member, intersected.range);
}

/**
 * The version the locked snapshot records for a member, if it records one.
 *
 * Read in one place so the RESV-05 constraint check and the RESV-06 skipped-row
 * projection cannot answer the same question differently -- a row reporting a
 * version the check never saw would be the worst of both.
 */
function recordedVersionOf(state: ExtensionState, member: ClosureMember): string | undefined {
  return state.marketplaces[member.marketplace]?.plugins[member.name]?.version;
}

/**
 * Whether the snapshot's record for a skipped member says it is disabled.
 *
 * A member the snapshot records nothing for reads as not-disabled: there is no
 * record to be disabled, and the version projection beside this one already
 * reports that state as an absent version.
 */
function recordedDisabled(state: ExtensionState, member: ClosureMember): boolean {
  const record = state.marketplaces[member.marketplace]?.plugins[member.name];
  return record !== undefined && isRecordedButDisabled(record);
}

/**
 * WR-11: every `<plugin>@<marketplace>` key the target scope records as
 * installed AND ENABLED -- the live-dependency set `resolveTransitiveReEnableSet`
 * seeds its own per-member walk with, so that walk stops at a live dependency
 * exactly as the OUTER walk does (RESV-05), instead of recursing past it into
 * declarations RESV-05 was deliberately built to leave unexplored. A DISABLED
 * record is excluded on purpose: the whole point of the walk this seeds is to
 * keep recursing through a disabled dependency to find what IT needs.
 */
function enabledInstalledKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const [marketplaceName, record] of Object.entries(state.marketplaces)) {
    for (const [pluginName, pluginRecord] of Object.entries(record.plugins)) {
      if (!isRecordedButDisabled(pluginRecord)) {
        keys.add(`${pluginName}@${marketplaceName}`);
      }
    }
  }

  return keys;
}

/**
 * RESV-05: an already-installed dependency is CHECKED against the effective
 * constraint before anything else touches it.
 *
 * It is not in the closure, so this function itself never re-pins or
 * re-declares it -- whether or not it satisfies the constraint. The only
 * question here is whether what is already on disk is acceptable, which is
 * why no tag is ever queried for one: what COULD be fetched is not the
 * question being asked. `partitionAlreadyInstalled` decides separately, AFTER
 * this check passes, whether a disabled member becomes a `Phase` that
 * re-materializes it (EDEP-03) or stays untouched (RESV-05's general case).
 *
 * A member the snapshot records no version for is left alone. It is not
 * installed in this state after all, so there is nothing for a constraint to
 * conflict with.
 */
function checkInstalledMember(
  state: ExtensionState,
  member: ClosureMember,
): CascadeConstraintFailure | undefined {
  const intersected = intersectDependencyRanges(member.ranges);
  if (!intersected.ok) {
    return toIntersectionFailure(member, intersected);
  }

  const recorded = recordedVersionOf(state, member);
  if (isUnconstrainedRange(intersected.range) || recorded === undefined) {
    return undefined;
  }

  return recordedVersionSatisfies(recorded, intersected.range)
    ? undefined
    : {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: member.key,
        range: renderConstraintRange(intersected.range),
        recordedVersion: recorded,
      };
}

/**
 * Turn every member's accumulated ranges into a pin, or report the first
 * constraint that cannot be satisfied.
 *
 * The already-installed members are checked FIRST because that check makes no
 * query at all: a cascade that is going to fail on what is already on disk
 * never reaches a remote for the members it would otherwise have installed.
 */
async function resolveMemberConstraints(
  options: MemberConstraintOptions,
): Promise<MemberConstraintResolution> {
  for (const member of options.alreadyInstalled) {
    const failure = checkInstalledMember(options.state, member);
    if (failure !== undefined) {
      return { ok: false, failure };
    }
  }

  const members: ResolvedCascadeMember[] = [];
  for (const member of options.closure) {
    const outcome = await resolveOneMember(options, member);
    if (outcome.kind === "failed") {
      return { ok: false, failure: outcome.failure };
    }

    members.push(outcome.member);
  }

  return { ok: true, members };
}

/**
 * One member's phase.
 *
 * `undo` is gated on `run.materialized` so it can only reach an install THIS
 * run performed, and it reads the record back out of the snapshot rather than
 * closing over the one `do` wrote: a member whose OWN bridge ledger already
 * rolled itself back has no record left, and unstaging against a stale handle
 * would remove artifacts nothing owns any more.
 *
 * An unstage that did not finish is RE-THROWN, because a throw is the ledger's
 * only partial-rollback channel and `{rollback partial}` is what the user is
 * owed when artifacts survive the unwind. `docs/output-catalog.md`'s
 * `dependency-install-failed` state promises everything this command
 * materialized is unwound; a swallowed failure would report that promise kept
 * while the member's skills, commands, agents, hooks and MCP servers are still
 * on disk owned by a record the undo had just deleted.
 */
function buildMemberPhase(
  options: InstallCascadeOptions,
  seam: InstallCascadeLedgerSeam,
  transaction: InstallLedgerTransaction,
  member: ResolvedCascadeMember,
): Phase<CascadeRun> {
  return {
    name: member.key,
    do: async (run) => {
      run.attempting = member.key;
      const result = await seam.runInstallLedger(
        options.state,
        options.locations,
        options.ledgerOptionsFor(member),
        options.capture,
        transaction,
      );
      if (result.kind === "marketplace-absent") {
        run.marketplaceAbsent = true;
        throw new Error(`Marketplace "${member.marketplace}" is not added.`);
      }

      run.materialized.add(member.key);
      run.members.push({
        key: member.key,
        name: member.name,
        marketplace: member.marketplace,
        requiredBy: member.requiredBy,
        version: result.summary.version,
        declaresAgents: result.summary.stagedAgentNames.length > 0,
        declaresMcp: result.summary.stagedMcpServerNames.length > 0,
        pluginRoot: result.summary.resolved.pluginRoot,
        hooksConfigPath: result.summary.resolved.hooksConfigPath,
        fellBackToCurrentCopy: member.fellBackToCurrentCopy ?? false,
        reEnabledFromRecord: false,
      });
      if (member.key === options.rootKey) {
        run.root = result.summary;
      }
    },
    undo: async (run) => {
      if (!run.materialized.has(member.key)) {
        return;
      }

      const marketplaceRecord = options.state.marketplaces[member.marketplace];
      const installed = marketplaceRecord?.plugins[member.name];
      if (marketplaceRecord === undefined || installed === undefined) {
        return;
      }

      const outcome = await seam.cascadeUnstagePlugin(
        member.name,
        member.marketplace,
        options.locations,
        installed,
      );
      if (!outcome.ok) {
        // The primitive REPORTS rather than throws -- its whole body is a
        // try/catch returning `{ok: false, dropped, cause}` -- and the ledger's
        // only partial-rollback channel is a throw. Discarding this outcome
        // reports a cascade that unwound cleanly while the member's artifacts
        // are still on disk, so convert it. Subtracting what DID drop first
        // keeps the record honest about what remains (NFR-3), and the record is
        // deliberately NOT deleted: it is what still owns those artifacts.
        applyPartialCascadeFold(installed, outcome.dropped);
        throw outcome.cause ?? new Error(`Rollback of "${member.key}" did not complete.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- `plugins` is a Record<string, ...> keyed by the member's own token-checked plugin name.
      delete marketplaceRecord.plugins[member.name];
    },
  };
}

/**
 * Split RESV-05's already-installed set into the disabled subset EDEP-03
 * re-enables and the rest RESV-05 still leaves alone.
 *
 * Reuses `recordedDisabled` -- the exact-key lookup the constraint check
 * already uses -- rather than re-deriving the predicate.
 */
function partitionAlreadyInstalled(
  state: ExtensionState,
  alreadyInstalled: readonly ClosureMember[],
): {
  readonly toReEnable: readonly ClosureMember[];
  readonly leftAlone: readonly ClosureMember[];
} {
  const toReEnable: ClosureMember[] = [];
  const leftAlone: ClosureMember[] = [];
  for (const member of alreadyInstalled) {
    if (recordedDisabled(state, member)) {
      toReEnable.push(member);
    } else {
      leftAlone.push(member);
    }
  }

  return { toReEnable, leftAlone };
}

/**
 * A key no real declaration is expected to collide with: a distinctive
 * plugin/marketplace name pair, both halves passing the ordinary
 * `TOKEN_PATTERN` allowlist (`domain/dependencies.ts`) so `splitKey`
 * resolves it like any other key. Not a reserved namespace -- a scope whose
 * marketplace is literally named `cr04-synthetic-marketplace` would collide
 * with it, which this module accepts as a documented, vanishingly unlikely
 * risk rather than adding a reservation mechanism for one internal walk.
 */
const TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY =
  "cr04-synthetic-reenable-root@cr04-synthetic-marketplace";

/** `resolveTransitiveReEnableSet`'s outcome: the WR-11(b) never-installed subset travels alongside the re-enable set's own post-order, since both come from the same per-member walk. */
type TransitiveReEnableResult =
  | {
      readonly ok: true;
      readonly closure: readonly ClosureMember[];
      readonly neverInstalled: readonly ClosureMember[];
    }
  | Extract<DependencyClosureResult, { readonly ok: false }>;

/**
 * CR-04: `toReEnable`'s re-enable arm is not transitive on its own. The
 * closure walk stops at ANY already-installed hit (`collectInstalledKeys`
 * includes disabled records, and `walkDependencyEdge` returns WITHOUT
 * recursing on a hit), so a `toReEnable` member's OWN disabled dependencies
 * are never visited by the closure that found it -- LOAD-01 then holds it
 * back down again on the very next pass.
 *
 * For each `toReEnable` member this resolves its OWN closure, mirroring
 * `enable-disable.ts::resolveEnableCascade`'s identical technique, to
 * discover every transitively reachable member and keep the ones that are
 * themselves installed-and-disabled. WR-11(a): the walk is seeded with
 * `enabledInstalledKeys`, not an empty set -- it stops at a LIVE dependency
 * exactly as the OUTER walk does (RESV-05 precedes D-03-08 deliberately), so
 * a declaration reachable only through an already-enabled, already-installed
 * member is left unexplored here too, instead of failing this install over a
 * plugin nothing asked about. The whole disabled subset discovered this way
 * is then folded into ONE globally post-ordered list through a single further
 * walk from a synthetic root that "declares" every discovered member --
 * reusing the walk's own tested post-order and diamond dedup rather than a
 * hand-rolled merge of several independently-ordered sub-closures. The
 * synthetic root is exempt from the marketplace-known and already-installed
 * guards exactly as every real root is (`domain/dependency-closure.ts`'s
 * `isRoot` exemption), so it needs no entry in `knownMarketplaces` and no
 * state record.
 *
 * WR-11(b): a candidate `sub.closure` hands back that is NOT disabled has no
 * state record at all -- `enabledInstalledKeys` stops the walk at every
 * enabled candidate before it can reach `sub.closure` -- so it is a
 * never-installed member of the requested root's own transitive closure,
 * reached only through a disabled dependency this install is about to turn
 * back on. `outerClosureKeys` excludes one the OUTER walk already found
 * another way (a diamond also reachable through a live path), so the caller
 * can install it exactly once.
 *
 * A failure resolving any member's own closure propagates as the cascade's
 * own closure failure (fail-closed, D-05-07 precedent): a disabled
 * dependency reachable from the plugin being installed is not a fact this
 * install may silently leave unexplored.
 *
 * CR-07: the synthetic root's exemption does not extend to its CHILDREN --
 * a discovered member absent from its own marketplace manifest is tolerated
 * during discovery (walked there as its OWN root) but is a real `not-found`
 * as a child of the synthetic root. The fold below remaps that one case back
 * onto the real dependent that discovered the member.
 */
/**
 * Classifies one candidate a member's own sub-closure surfaced, mutating
 * whichever accumulator it belongs to. Extracted from
 * `resolveTransitiveReEnableSet`'s discovery loop to keep that function
 * within the project's cognitive-complexity ceiling.
 */
function classifyReEnableCandidate(args: {
  readonly state: ExtensionState;
  readonly member: ClosureMember;
  readonly candidate: ClosureMember;
  readonly discovered: Map<string, ClosureMember>;
  readonly neverInstalled: Map<string, ClosureMember>;
  readonly outerClosureKeys: ReadonlySet<string>;
  readonly queue: ClosureMember[];
}): void {
  const { state, member, candidate, discovered, neverInstalled, outerClosureKeys, queue } = args;
  if (candidate.key === member.key || discovered.has(candidate.key)) {
    return;
  }

  if (recordedDisabled(state, candidate)) {
    discovered.set(candidate.key, candidate);
    queue.push(candidate);
    return;
  }

  if (!outerClosureKeys.has(candidate.key) && !neverInstalled.has(candidate.key)) {
    neverInstalled.set(candidate.key, candidate);
  }
}

async function resolveTransitiveReEnableSet(
  state: ExtensionState,
  lookup: ClosureLookup,
  knownMarketplaces: ReadonlySet<string>,
  toReEnable: readonly ClosureMember[],
  outerClosureKeys: ReadonlySet<string>,
): Promise<TransitiveReEnableResult> {
  if (toReEnable.length === 0) {
    return { ok: true, closure: [], neverInstalled: [] };
  }

  const discovered = new Map<string, ClosureMember>(
    toReEnable.map((member) => [member.key, member]),
  );
  const neverInstalled = new Map<string, ClosureMember>();
  const installedKeys = enabledInstalledKeys(state);
  const queue: ClosureMember[] = [...toReEnable];
  for (let member = queue.shift(); member !== undefined; member = queue.shift()) {
    const sub = await resolveDependencyClosure({
      rootKey: member.key,
      lookup,
      installedKeys,
      knownMarketplaces,
    });
    if (!sub.ok) {
      return sub;
    }

    for (const candidate of sub.closure) {
      classifyReEnableCandidate({
        state,
        member,
        candidate,
        discovered,
        neverInstalled,
        outerClosureKeys,
        queue,
      });
    }
  }

  if (discovered.size === toReEnable.length) {
    // No member's own closure surfaced a transitively disabled dependency
    // beyond the direct set the caller already found in the walk's own
    // post order -- nothing to re-fold.
    return { ok: true, closure: toReEnable, neverInstalled: [...neverInstalled.values()] };
  }

  const folded = await resolveDependencyClosure({
    rootKey: TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY,
    lookup: (subject) =>
      subject.key === TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY
        ? Promise.resolve({
            kind: "found" as const,
            dependencies: [...discovered.values()].map((member) => ({
              name: member.name,
              marketplace: member.marketplace,
            })),
          })
        : lookup(subject),
    // Matches the discovery loop's own `installedKeys` above: the fold
    // re-walks each discovered member's declared children through the SAME
    // `lookup`, so an empty set here would let it recurse PAST a live
    // dependency the discovery loop deliberately stopped at (WR-11(a)).
    installedKeys,
    knownMarketplaces,
  });
  if (!folded.ok) {
    // CR-07: a discovered member is `not-found` here only as a CHILD of the
    // synthetic root, where the catalog-absent guard is not exempt; the
    // discovery loop above already walked the same member as its OWN root,
    // where the guard IS exempt, and returned `ok: true` for it. Every OTHER
    // failure a fold could produce -- `cycle`, `marketplace-not-added`, or a
    // `not-found` belonging to a deeper descendant -- is already caught
    // during that same discovery call, which validates each discovered
    // member's FULL closure with the IDENTICAL lookup and `installedKeys`
    // before the fold ever runs. Report the failure against the real
    // dependent that discovered the member instead of leaking the synthetic
    // key into a user-visible row.
    assertFoldedNotFoundFromSyntheticChild(folded);
    const declarer = discovered.get(folded.key);
    assertDeclaredBySyntheticRoot(declarer);
    return { ...folded, requiredBy: declarer.requiredBy };
  }

  return {
    ok: true,
    closure: folded.closure.filter(
      (member) => member.key !== TRANSITIVE_REENABLE_SYNTHETIC_ROOT_KEY,
    ),
    neverInstalled: [...neverInstalled.values()],
  };
}

/**
 * `folded` fails only when a DIRECT child of the synthetic root -- one of
 * `discovered.values()` -- is itself absent from its own marketplace
 * manifest: every other failure reason is already excluded by the discovery
 * loop's own validation (see the call site's comment). Evidence-backed type
 * narrowing only; the invariant is established by the caller, not by a
 * runtime check here.
 */
function assertFoldedNotFoundFromSyntheticChild(
  _folded: Extract<DependencyClosureResult, { readonly ok: false }>,
): asserts _folded is Extract<
  DependencyClosureResult,
  { readonly ok: false; readonly reason: "not-found" }
> {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * `folded.key` is a direct child the synthetic root itself declared, and its
 * only declared children are `discovered.values()`, so the key is always a
 * member of `discovered` -- and every member `discovered` holds is a
 * non-root edge somewhere in a real walk, so it always carries a real
 * `requiredBy`. Evidence-backed type narrowing only; the invariant is
 * established by the discovery loop above, not by a runtime check here.
 */
function assertDeclaredBySyntheticRoot(
  _declarer: ClosureMember | undefined,
): asserts _declarer is ClosureMember & { readonly requiredBy: string } {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * `partitionAlreadyInstalled` places a member in `toReEnable` only when
 * `recordedDisabled` has already proved its record exists and is disabled.
 * Evidence-backed type narrowing only; the invariant is established by the
 * caller.
 */
function assertDisabledRecordExists(
  _record: PluginInstallRecord | undefined,
): asserts _record is PluginInstallRecord {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

type InstalledLedgerResult = Extract<InstallLedgerResult, { readonly kind: "installed" }>;

/**
 * `assertDisabledRecordExists` already proved this member's marketplace slot
 * is present in `options.state` -- the record was read out of it -- and the
 * ledger's sole `marketplace-absent` producer rereads that identical slot
 * synchronously, so this re-enable call path cannot produce the absent arm.
 * Evidence-backed type narrowing only, mirroring `enable-disable.ts`'s
 * `assertRecordedStateLedgerInstalled`; the invariant is established by the
 * caller, not by a runtime check here.
 */
function assertReEnableLedgerInstalled(
  _result: InstallLedgerResult,
): asserts _result is InstalledLedgerResult {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * EDEP-03: one already-installed, DISABLED member's re-enable phase.
 *
 * Narrows RESV-05's "an already-installed dependency is CHECKED and never
 * touched" invariant for this ONE subcase; the general already-installed case
 * stays untouched (`buildMemberPhase` is never built for it, and it never
 * becomes a `Phase` at all).
 *
 * `do` calls `seam.runInstallLedger` with the caller's own per-member options
 * builder, overridden with `pinVersionOverride` set to the record's own
 * recorded version and `allowExistingRecord: true` -- the same argument set
 * `runEnableBranch` and `materializePromotedRecord` already pass, now at
 * another call site. `provenance` is never touched here: the builder's own
 * `"dependency"` value for a non-root member is what the ledger's state phase
 * would write for a FRESH record, but this record already exists, and
 * `runInstallLedger` keeps an existing record's own `provenance` regardless
 * (D-04-02) -- only `promoteDependencyRecord`'s by-name arm flips it.
 *
 * `undo` puts the member BACK to disabled via `cascadeUnstagePlugin` +
 * `toDisabledRecord`, mirroring `buildMemberPhase`'s undo rather than
 * deleting the record: this phase re-materialized artifacts for a record that
 * already existed, so unwinding it means restoring what it was, not removing
 * it. An unstage that did not finish is RE-THROWN after folding what did
 * drop, on the same D-03-07 reasoning `buildMemberPhase`'s undo states: a
 * throw is the ledger's only partial-rollback channel, and a swallowed
 * failure would report a clean unwind while artifacts survive on disk.
 */
function buildReEnableMemberPhase(
  options: InstallCascadeOptions,
  seam: InstallCascadeLedgerSeam,
  transaction: InstallLedgerTransaction,
  member: ClosureMember,
): Phase<CascadeRun> {
  return {
    name: member.key,
    do: async (run) => {
      run.attempting = member.key;
      const record = options.state.marketplaces[member.marketplace]?.plugins[member.name];
      assertDisabledRecordExists(record);
      const result = await seam.runInstallLedger(
        options.state,
        options.locations,
        {
          ...options.ledgerOptionsFor(member),
          pinVersionOverride: record.version,
          allowExistingRecord: true,
          partial: !record.compatibility.installable,
        },
        options.capture,
        transaction,
      );
      assertReEnableLedgerInstalled(result);

      run.materialized.add(member.key);
      run.members.push({
        key: member.key,
        name: member.name,
        marketplace: member.marketplace,
        requiredBy: member.requiredBy,
        version: result.summary.version,
        declaresAgents: result.summary.stagedAgentNames.length > 0,
        declaresMcp: result.summary.stagedMcpServerNames.length > 0,
        pluginRoot: result.summary.resolved.pluginRoot,
        hooksConfigPath: result.summary.resolved.hooksConfigPath,
        fellBackToCurrentCopy: false,
        reEnabledFromRecord: true,
      });
    },
    undo: async (run) => {
      if (!run.materialized.has(member.key)) {
        return;
      }

      const marketplaceRecord = options.state.marketplaces[member.marketplace];
      const installed = marketplaceRecord?.plugins[member.name];
      if (marketplaceRecord === undefined || installed === undefined) {
        return;
      }

      const outcome = await seam.cascadeUnstagePlugin(
        member.name,
        member.marketplace,
        options.locations,
        installed,
      );
      if (!outcome.ok) {
        applyPartialCascadeFold(installed, outcome.dropped);
        throw outcome.cause ?? new Error(`Rollback of "${member.key}" did not complete.`);
      }

      marketplaceRecord.plugins[member.name] = toDisabledRecord(
        installed,
        new Date().toISOString(),
      );
    },
  };
}

/** Project the ledger result and the run's records onto the caller-facing arm. */
function toCascadeResult(
  options: InstallCascadeOptions,
  result: RunPhasesResult,
  run: CascadeRun,
  alreadyInstalled: readonly CascadeSkippedMember[],
): InstallCascadeResult {
  if (result.ok) {
    const root = run.root;
    if (root === undefined) {
      // The closure always ends at the root, so a clean ledger run always
      // recorded it. Reaching here means the injected scheduler reported
      // success without running the phases.
      throw new Error("Install cascade reported success without materializing the root plugin.");
    }

    return { kind: "installed", root, members: run.members, alreadyInstalled };
  }

  if (run.marketplaceAbsent) {
    return { kind: "marketplace-absent" };
  }

  return {
    kind: "member-failed",
    key: run.attempting ?? options.rootKey,
    error: result.error ?? new Error("Install cascade failed."),
    rollbackPartials: result.rollbackPartials,
  };
}

/**
 * Resolve the requested plugin's dependency closure and materialize every
 * member of it, all-or-nothing.
 *
 * Nothing is materialized when the closure itself fails, and `runPhases` never
 * throws on its own -- its `{ok: false}` result is translated here, so the
 * caller sees one discriminated value for every outcome.
 */
export async function runInstallCascade(
  options: InstallCascadeOptions,
): Promise<InstallCascadeResult> {
  const closure = await resolveDependencyClosure({
    rootKey: options.rootKey,
    lookup: options.lookup,
    installedKeys: options.installedKeys,
    knownMarketplaces: options.knownMarketplaces,
  });
  if (!closure.ok) {
    return { kind: "closure-failed", failure: closure };
  }

  // EDEP-03: the disabled subset of `alreadyInstalled` re-enables through its
  // own record; the rest stays RESV-05's untouched skip.
  const { toReEnable, leftAlone } = partitionAlreadyInstalled(
    options.state,
    closure.alreadyInstalled,
  );
  // CR-04: `toReEnable` alone is not transitive -- fold in every disabled
  // member reachable FROM those members that the outer walk's
  // already-installed wall hid. WR-11(b): the same walk also surfaces every
  // NEVER-installed member reachable only through one of those disabled
  // dependencies, excluding one the outer walk already found another way
  // (`outerClosureKeys`).
  const outerClosureKeys = new Set(
    [...closure.closure, ...closure.alreadyInstalled].map((member) => member.key),
  );
  const transitiveReEnable = await resolveTransitiveReEnableSet(
    options.state,
    options.lookup,
    options.knownMarketplaces,
    toReEnable,
    outerClosureKeys,
  );
  if (!transitiveReEnable.ok) {
    return { kind: "closure-failed", failure: transitiveReEnable };
  }

  // RESV-03 / RESV-05: decided here, between the walk and the phase array, so
  // every constraint verdict lands while nothing is materialized. ONE memo is
  // allocated per run and threaded through every member, so a graph whose
  // dependencies share a repository lists that repository once. WR-11(b): the
  // never-installed members `resolveTransitiveReEnableSet` discovered join the
  // outer closure here, so they resolve a pin and install exactly like any
  // other cascade member.
  const constraints = await resolveMemberConstraints({
    state: options.state,
    closure: [...closure.closure, ...transitiveReEnable.neverInstalled],
    alreadyInstalled: closure.alreadyInstalled,
    ledgerOptionsFor: options.ledgerOptionsFor,
    tagProbe: options.tagProbe ?? probeDependencyTags,
    tagMemo: new Map<string, readonly RemoteTag[]>(),
    marketplaceTagMemo: new Map<string, readonly ReleaseTagCandidate[]>(),
    ...(options.marketplaceTagProbe !== undefined && {
      marketplaceTagProbe: options.marketplaceTagProbe,
    }),
    ...(options.marketplaceRecordFor !== undefined && {
      marketplaceRecordFor: options.marketplaceRecordFor,
    }),
  });
  if (!constraints.ok) {
    return { kind: "constraint-failed", failure: constraints.failure };
  }

  const seam = options.seam ?? REAL_INSTALL_CASCADE_SEAM;
  const transaction = options.transaction ?? DEFAULT_INSTALL_CASCADE_TRANSACTION;
  const run: CascadeRun = {
    root: undefined,
    marketplaceAbsent: false,
    attempting: undefined,
    members: [],
    materialized: new Set<string>(),
  };
  // WR-11(b): a never-installed member discovered THROUGH a disabled
  // dependency must be live before that dependency's own re-enable phase
  // runs, so its member phase goes FIRST. The re-enable phases follow, ahead
  // of the primary closure's own members, so a dependency is live before the
  // plugin that needs it materializes.
  const neverInstalledKeys = new Set(transitiveReEnable.neverInstalled.map((member) => member.key));
  const discoveredMemberPhases = constraints.members
    .filter((member) => neverInstalledKeys.has(member.key))
    .map((member) => buildMemberPhase(options, seam, transaction, member));
  const primaryMemberPhases = constraints.members
    .filter((member) => !neverInstalledKeys.has(member.key))
    .map((member) => buildMemberPhase(options, seam, transaction, member));
  const phases: readonly Phase<CascadeRun>[] = [
    ...discoveredMemberPhases,
    ...transitiveReEnable.closure.map((member) =>
      buildReEnableMemberPhase(options, seam, transaction, member),
    ),
    ...primaryMemberPhases,
  ];
  // RESV-05 / RESV-06: projected from the walk's own left-alone list, not from
  // the ledger -- these members never reach a phase, so the run has nothing to
  // record about them. They are carried out of the cascade so the block can
  // report them as left alone rather than omitting them entirely.
  const alreadyInstalled: readonly CascadeSkippedMember[] = leftAlone.map((member) => ({
    key: member.key,
    version: recordedVersionOf(options.state, member),
  }));

  return toCascadeResult(options, await transaction.runPhases(phases, run), run, alreadyInstalled);
}
