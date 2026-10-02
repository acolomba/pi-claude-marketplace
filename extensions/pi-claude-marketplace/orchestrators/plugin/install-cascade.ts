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
// EDEP-03 changes ONE input of the walk and nothing else: a record the
// snapshot marks disabled is not in `installedKeys`. The walk therefore reads
// through a disabled dependency exactly as it reads through a never-installed
// one -- its declarations are walked, every range declared for it on every
// branch is merged (D-03-10), and it lands in `closure` in post order with the
// `requiredBy` of the declaration that first reached it. One walk owns every
// member's order, ranges and dependent; the phase array only partitions that
// closure by the snapshot's record, so a disabled member re-enables through
// its record and every other member installs fresh. A recorded ENABLED
// dependency stays the wall RESV-05 makes it: the walk stops there before its
// marketplace is checked (RESV-05 precedes D-03-08), so a declaration below a
// live dependency is never explored. D-09-04's `treatDisabledAsWall` reverses
// this for the reload path: a disabled record stays in `installedKeys`, so the
// walk stops there like a live dependency and its own declarations are never
// read.
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
// safer than it already is. A dependency recorded as DISABLED is different
// (EDEP-03): the walk does not skip it -- `liveInstalledKeys` leaves its key
// out of `installedKeys` -- so it is a closure member, re-materialized through
// its own record by `buildReEnableMemberPhase`. It DOES become a `Phase`, and
// a failure anywhere in the cascade puts it back to disabled rather than
// leaving it re-enabled with nothing to unwind it. The REQUESTED plugin is
// different again: it is never skipped, so an install of
// a plugin that is already recorded reaches its phase and throws from inside
// `do`. TR-02 then runs that phase's OWN undo, which would unstage the very
// install the throw was reporting. `Phase.undo`'s contract states the remedy
// -- an undo cannot assume its `do` ran to completion and must gate on a
// context-set sentinel -- so each phase records itself in `materialized` after
// its ledger returns, and `undo` acts only on what it finds there.
//
// MISS-01 / D-09-05: the root may carry caller-supplied ranges, so a missing
// dependency installed through the reload path is pinned by every declarer's
// constraint exactly as a constrained member is. `InstallCascadeOptions.rootRanges`
// folds into the root member's own (empty) range list at `effectiveRanges`,
// the same site every member's ranges are folded before the intersection
// (RESV-03).

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

/**
 * One closure member with its constraint decided and the phase it becomes.
 *
 * `re-enable` carries the disabled record the partition read, so the phase
 * re-materializes under the version and compatibility of the same object the
 * partition decided on. `install` carries the pin the constraint chose.
 */
type CascadePhaseMember =
  | { readonly kind: "install"; readonly member: ResolvedCascadeMember }
  | {
      readonly kind: "re-enable";
      readonly member: ClosureMember;
      readonly record: PluginInstallRecord;
    };

/** Every member decided, in the walk's post order, or the first failure one produced. */
type MemberConstraintResolution =
  | { readonly ok: true; readonly members: readonly CascadePhaseMember[] }
  | { readonly ok: false; readonly failure: CascadeConstraintFailure };

/** Inputs of one cascade run's constraint resolution. */
interface MemberConstraintOptions {
  /** The caller's locked snapshot: the recorded versions and the catalog roots. */
  readonly state: ExtensionState;
  /** `<plugin>@<marketplace>` of the plugin the user asked for. */
  readonly rootKey: string;
  /**
   * The raw range texts the caller accumulated for the ROOT key, folded once
   * with the root member's own (empty) range list at `effectiveRanges` --
   * the same site every member's ranges are folded (D-09-05, MISS-01).
   */
  readonly rootRanges?: readonly string[];
  /**
   * Every member the walk returned, in post order. A member the snapshot
   * records DISABLED re-enables through that record; the rest install fresh.
   */
  readonly closure: readonly ClosureMember[];
  /**
   * The members RESV-05 skipped -- recorded and ENABLED -- which are CHECKED
   * and never installed.
   */
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
   * What the member staged, as the three soft-dependency kinds the renderer
   * probes for. Carried as booleans rather than as the staged name lists so a
   * member row can fire the same `{requires pi-...}` marker and the same SEV-01
   * severity an ordinary install row does, without this module reaching for the
   * presentation vocabulary that decides how.
   */
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly declaresWorkflows: boolean;
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
 * it was. A disabled record is never in the walk's `installedKeys`, so the
 * walk never skips it: it is a closure member `buildReEnableMemberPhase`
 * re-materializes (EDEP-03), and it never reaches this shape.
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
  /**
   * The raw range texts the caller accumulated for the ROOT key, folded once
   * with the root member's own (empty) range list at the same site every
   * member's ranges are folded (D-09-05). The reload path passes every
   * eligible declarer's texts; the standalone `install` passes nothing
   * because the user typed the root.
   */
  readonly rootRanges?: readonly string[];
  readonly lookup: ClosureLookup;
  /**
   * Per-member ledger options; the caller owns scope, cwd and the auth bundle.
   *
   * The member handed over carries the pin its constraint selected, so the
   * caller's builder is where a re-pinned tag enters that member's install.
   */
  readonly ledgerOptionsFor: (member: ResolvedCascadeMember) => InstallLedgerOptions;
  readonly installedKeys: ReadonlySet<string>;
  /** Permission to install new foreign dependencies, from the root manifest. */
  readonly rootAllowedMarketplaces: ReadonlySet<string>;
  /**
   * Keep a recorded DISABLED key in `installedKeys` instead of reading through
   * it (D-09-04): the walk stops there like a live dependency, produces no
   * `re-enable` phase, and its own declarations are never walked. The reload
   * path sets this; the standalone install and enable cascades omit it and
   * keep EDEP-03's read-through.
   */
  readonly treatDisabledAsWall?: true;
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
 * exactly like any other rendered range. `ranges` is the member's effective
 * list, so a fold that failed on the root's caller-supplied texts (D-09-05)
 * names those texts too.
 */
function toIntersectionFailure(
  key: string,
  ranges: readonly string[],
  failed: Extract<DependencyRangeIntersection, { readonly ok: false }>,
): CascadeConstraintFailure {
  const range = renderConstraintRange(ranges.join(" "));
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
 * A member's effective range list: its own declared ranges, plus the caller's
 * root ranges when the member IS the root (D-09-05).
 *
 * The closure walk seeds the root with an empty range list and only a
 * declaring edge ever appends to a member's list (`recordEdge`,
 * `domain/dependency-closure.ts`), so nothing inside the walk ever points a
 * range AT the root. `options.rootRanges` is the only way one reaches it.
 */
function effectiveRanges(
  options: MemberConstraintOptions,
  member: ClosureMember,
): readonly string[] {
  return member.key === options.rootKey && options.rootRanges !== undefined
    ? [...options.rootRanges, ...member.ranges]
    : member.ranges;
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
  const ranges = effectiveRanges(options, member);
  const intersected = intersectDependencyRanges(ranges);
  if (!intersected.ok) {
    return { kind: "failed", failure: toIntersectionFailure(member.key, ranges, intersected) };
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
 * The record a closure member re-enables through: the snapshot's record for
 * it when that record is DISABLED (EDEP-03), else `undefined`.
 *
 * The root is exempt exactly as it is from the walk's guards: its
 * preconditions belong to the caller's materialization path, so a recorded
 * root reaches `buildMemberPhase` and its own ledger reports it as already
 * installed. Every other closure member is either recorded and disabled or
 * not recorded at all -- a recorded ENABLED key is in `installedKeys`, and the
 * walk never places one of those in `closure`.
 */
function disabledRecordOf(
  state: ExtensionState,
  rootKey: string,
  member: ClosureMember,
): PluginInstallRecord | undefined {
  if (member.key === rootKey) {
    return undefined;
  }

  const record = state.marketplaces[member.marketplace]?.plugins[member.name];
  return record !== undefined && isRecordedButDisabled(record) ? record : undefined;
}

/**
 * The keys the walk stops at: the caller's recorded set minus every record
 * the snapshot marks DISABLED.
 *
 * `walkDependencyEdge` returns without recursing on an `installedKeys` hit
 * (RESV-05). A disabled record is a dependency this install turns back on
 * (EDEP-03), and what IT declares has to be live for that to hold, so the
 * walk reads through it like a never-installed member. A recorded ENABLED
 * dependency keeps its key here and stays the wall RESV-05 makes it.
 */
function liveInstalledKeys(
  state: ExtensionState,
  installedKeys: ReadonlySet<string>,
): ReadonlySet<string> {
  const live = new Set(installedKeys);
  for (const [marketplaceName, record] of Object.entries(state.marketplaces)) {
    for (const [pluginName, pluginRecord] of Object.entries(record.plugins)) {
      if (isRecordedButDisabled(pluginRecord)) {
        live.delete(`${pluginName}@${marketplaceName}`);
      }
    }
  }

  return live;
}

/**
 * RESV-05: an already-installed dependency is CHECKED against the effective
 * constraint before anything else touches it.
 *
 * This function never re-pins or re-declares the member -- whether or not
 * it satisfies the constraint. The only question here is whether what is
 * already on disk is acceptable, which is why no tag is ever queried for one:
 * what COULD be fetched is not the question being asked. It runs over the
 * enabled members the walk skipped and over the disabled members the walk
 * placed in the closure alike, so a disabled member's recorded version
 * answers to the same constraint a live one does, however deep in the graph
 * the declaration that constrains it sits (EDEP-03). Whether a disabled
 * member then becomes a `Phase` that re-materializes it is
 * `resolveMemberConstraints`'s partition, AFTER this check passes.
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
    return toIntersectionFailure(member.key, member.ranges, intersected);
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
 * RESV-05 over every recorded member -- the enabled ones the walk skipped and
 * the disabled ones it walked -- none of which needs a query.
 */
function checkRecordedMembers(
  options: MemberConstraintOptions,
): CascadeConstraintFailure | undefined {
  const disabled = options.closure.filter(
    (member) => disabledRecordOf(options.state, options.rootKey, member) !== undefined,
  );
  for (const member of [...options.alreadyInstalled, ...disabled]) {
    const failure = checkInstalledMember(options.state, member);
    if (failure !== undefined) {
      return failure;
    }
  }

  return undefined;
}

/**
 * Decide every member's constraint, or report the first one that cannot be
 * satisfied.
 *
 * The recorded members are checked FIRST because that check makes no query at
 * all: a cascade that is going to fail on what is already on disk never
 * reaches a remote for the members it would otherwise have installed. The
 * never-installed members then resolve a pin, and the result keeps the walk's
 * post order so a member's phase follows the phases of everything it needs.
 */
async function resolveMemberConstraints(
  options: MemberConstraintOptions,
): Promise<MemberConstraintResolution> {
  const recordedFailure = checkRecordedMembers(options);
  if (recordedFailure !== undefined) {
    return { ok: false, failure: recordedFailure };
  }

  const members: CascadePhaseMember[] = [];
  for (const member of options.closure) {
    const record = disabledRecordOf(options.state, options.rootKey, member);
    if (record !== undefined) {
      members.push({ kind: "re-enable", member, record });
      continue;
    }

    const outcome = await resolveOneMember(options, member);
    if (outcome.kind === "failed") {
      return { ok: false, failure: outcome.failure };
    }

    members.push({ kind: "install", member: outcome.member });
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
        declaresWorkflows: result.summary.stagedWorkflowNames.length > 0,
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

type InstalledLedgerResult = Extract<InstallLedgerResult, { readonly kind: "installed" }>;

/**
 * The partition read this member's record out of `options.state.marketplaces`,
 * so its marketplace slot is present in the snapshot; a member's ledger adds a
 * slot when it is missing and never removes one, and the ledger's sole
 * `marketplace-absent` producer reads that same slot first. This re-enable
 * call path therefore cannot produce the absent arm. Evidence-backed type
 * narrowing only, mirroring `enable-disable.ts`'s
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
 * `record` is the disabled record the partition read for this member, so
 * `do` re-materializes under the version and compatibility that decided the
 * partition. It calls `seam.runInstallLedger` with the caller's own per-member
 * options builder, overridden with `pinVersionOverride` set to the record's
 * own recorded version and `allowExistingRecord: true` -- the same argument set
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
  record: PluginInstallRecord,
): Phase<CascadeRun> {
  return {
    name: member.key,
    do: async (run) => {
      run.attempting = member.key;
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
        declaresWorkflows: result.summary.stagedWorkflowNames.length > 0,
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
  // EDEP-03: a disabled record is not a wall by default. The walk reads
  // through it, so its own dependencies -- disabled or never installed -- are
  // members of this closure with their ranges merged across every declaring
  // branch, and a declaration it cannot resolve fails this install naming it
  // as the dependent. D-09-04's `treatDisabledAsWall` is the one input that
  // reverses this: the walk stops at a disabled key exactly as it stops at a
  // live one.
  const closure = await resolveDependencyClosure({
    rootKey: options.rootKey,
    lookup: options.lookup,
    installedKeys:
      options.treatDisabledAsWall === true
        ? options.installedKeys
        : liveInstalledKeys(options.state, options.installedKeys),
    knownMarketplaces: options.knownMarketplaces,
    installPolicy: {
      allowedMarketplaces: options.rootAllowedMarketplaces,
      recordedKeys: options.installedKeys,
    },
  });
  if (!closure.ok) {
    return { kind: "closure-failed", failure: closure };
  }

  // RESV-03 / RESV-05: decided here, between the walk and the phase array, so
  // every constraint verdict lands while nothing is materialized. ONE memo is
  // allocated per run and threaded through every member, so a graph whose
  // dependencies share a repository lists that repository once.
  const constraints = await resolveMemberConstraints({
    state: options.state,
    rootKey: options.rootKey,
    closure: closure.closure,
    alreadyInstalled: closure.alreadyInstalled,
    ledgerOptionsFor: options.ledgerOptionsFor,
    tagProbe: options.tagProbe ?? probeDependencyTags,
    tagMemo: new Map<string, readonly RemoteTag[]>(),
    marketplaceTagMemo: new Map<string, readonly ReleaseTagCandidate[]>(),
    ...(options.rootRanges !== undefined && { rootRanges: options.rootRanges }),
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
  // One phase per closure member, in the walk's post order: a dependency is
  // live -- installed or re-enabled -- before the member that needs it runs.
  const phases: readonly Phase<CascadeRun>[] = constraints.members.map((entry) =>
    entry.kind === "re-enable"
      ? buildReEnableMemberPhase(options, seam, transaction, entry.member, entry.record)
      : buildMemberPhase(options, seam, transaction, entry.member),
  );
  // RESV-05 / RESV-06: projected from the walk's own skipped list, not from
  // the ledger -- these members never reach a phase, so the run has nothing to
  // record about them. They are carried out of the cascade so the block can
  // report them as left alone rather than omitting them entirely.
  const alreadyInstalled: readonly CascadeSkippedMember[] = closure.alreadyInstalled.map(
    (member) => ({
      key: member.key,
      version: recordedVersionOf(options.state, member),
    }),
  );

  return toCascadeResult(options, await transaction.runPhases(phases, run), run, alreadyInstalled);
}
