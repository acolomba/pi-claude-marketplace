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
// ladder with no special case for this project's `hash-<12hex>` form, which
// has no upstream equivalent, or the git commit form (GV-01). The consequence is
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
  MAX_DIRECTORY_PIN_FIELD_CHARS,
  recordedVersionSatisfies,
  renderDeclaredRanges,
  truncateForRefusal,
} from "../../domain/dependency-range.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isPluginDirectoryMarketplace } from "../../domain/version.ts";
import {
  isRecordedButDisabled,
  rangeVersionOf,
  toDisabledRecord,
} from "../../persistence/state-io.ts";
import { DependencyCascadeError } from "../../shared/errors.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { runPhases } from "../../transaction/phase-ledger.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../auth-host.ts";
import { cascadeUnstagePlugin, foldUnstageNotices } from "../marketplace/shared.ts";

import { probeDependencyTags } from "./dependency-tag-probe.ts";
import { runInstallLedger } from "./install-outcome.ts";
import { probeMarketplaceTags } from "./marketplace-tag-probe.ts";
import { applyPartialCascadeFold } from "./shared.ts";

import type {
  DependencyTagListingFailureReason,
  DependencyTagProbeOptions,
} from "./dependency-tag-probe.ts";
import type {
  DirectoryPinRange,
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
import type { McpConfigNotice } from "../../shared/notification-types.ts";
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
 * The injection point is named for what it DOES. `install-cascade.ts` is
 * itself in `NETWORK_SEAMS`, but both of its callers are gated and that gate
 * matches bare identifiers, so nothing reachable from them may be spelled with
 * one of the tokens it looks for.
 */
export type CascadeTagProbe = typeof probeDependencyTags;

/**
 * The LOCAL, network-free tag-resolving operation for a path-source member's
 * constraint -- lists the marketplace clone's own tags rather than a remote's
 * advertised refs (TAGS-01, D-07-05).
 */
export type CascadeMarketplaceTagProbe = typeof probeMarketplaceTags;

/** The per-URL tag listing memo one cascade run threads through every query. */
export type CascadeTagMemo = NonNullable<DependencyTagProbeOptions["tagMemo"]>;

/**
 * The per-marketplace-root tag listing memo one cascade run threads through
 * every path-source member's local probe, so several members constrained
 * against the SAME marketplace clone list it once (WR-02).
 */
export type CascadeMarketplaceTagMemo = NonNullable<MarketplaceTagProbeOptions["tagMemo"]>;

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
      /**
       * UPD-DEP-D1: why `update`'s path cannot move the copy into the range,
       * when the caller judged a move. Absent when no move was judged.
       */
      readonly moveRefusal?: string;
      /**
       * D-PL3-11: the keys of the plugins that declare the dependency, set
       * beside `moveRefusal` by the plan that judged the move, so the refusal
       * can tell whether the plugin the user named declares it.
       */
      readonly declaredBy?: readonly string[];
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
     * install. A git-materialized install otherwise records its commit, which
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
  /**
   * GV-01: a member of Claude Code's plugin directory picks no release tag.
   * It installs the copy its catalog entry lists, which must satisfy this
   * range.
   */
  readonly directoryPin?: DirectoryPinRange;
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

/**
 * UPD-DEP-D1: one closure member a dependency plan decided, as the cascade
 * that carries the plan out materializes it.
 */
export type PlannedCascadeMember =
  | { readonly kind: "install"; readonly member: ResolvedCascadeMember }
  | { readonly kind: "re-enable"; readonly member: ClosureMember };

/**
 * UPD-DEP-D1: what a cascade carrying out a dependency plan materializes, in
 * order, and the recorded members its rows report as left alone.
 */
export interface PlannedClosure {
  readonly members: readonly PlannedCascadeMember[];
  readonly alreadyInstalled: readonly ClosureMember[];
}

/** Every member decided, in the walk's post order, or the first failure one produced. */
type MemberConstraintResolution =
  | {
      readonly ok: true;
      readonly members: readonly CascadePhaseMember[];
      readonly outOfRange: boolean;
    }
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
   * GV-01 / MISS-01: the keys of the plugins whose ranges `rootRanges` holds,
   * which a plugin directory root's refusal names.
   */
  readonly rootRequiredBy?: readonly string[];
  /** UPD-DEP-D1: report a recorded member outside its range instead of failing. */
  readonly moveOutOfRange?: true;
  /**
   * Every member the walk returned, in post order. A member the snapshot
   * records DISABLED re-enables through that record; one in `readThrough`
   * is a recorded member a plan moves; the rest install fresh.
   */
  readonly closure: readonly ClosureMember[];
  /** What each plugin the walk found declares, as `recordingLookup` recorded it. */
  readonly declared: ReadonlyMap<
    string,
    readonly { readonly key: string; readonly range?: string }[]
  >;
  /** UPD-DEP-D1: the recorded ENABLED keys a dependency plan moves. */
  readonly readThrough: ReadonlySet<string>;
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
  /** GV-01 / MISS-01: the keys of the plugins whose ranges `rootRanges` holds. */
  readonly rootRequiredBy?: readonly string[];
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
  /**
   * UPD-DEP-D1: recorded ENABLED keys a dependency plan moves. The walk reads
   * through each one, from the declarations of the version its move lands
   * (the caller's `lookup` answers them), and none becomes a phase.
   */
  readonly readThrough?: ReadonlySet<string>;
  /**
   * UPD-DEP-D1: the members a dependency plan decided. The cascade
   * materializes exactly these, in this order, and walks nothing.
   */
  readonly planned?: PlannedClosure;
  /**
   * D-10-18: one operation's tag listing memos, so the plan and the cascade
   * that executes it list a source once. Absent, each run allocates its own.
   */
  readonly tagMemo?: CascadeTagMemo;
  readonly marketplaceTagMemo?: CascadeMarketplaceTagMemo;
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

/**
 * CAS-01 / D-PL3-01: the closure members this run would have materialized and
 * did not, in the order the walk first looked them up. The root, the failing
 * member, and the members a plan moves are never listed: each already has a
 * row of its own.
 *
 * REQUIRED on every failure the cascade produces, on the D-07 rationale of
 * `CascadeMemberOutcome.fellBackToCurrentCopy`: a producer that omits it is a
 * compile error rather than a silently missing row.
 */
export interface Unmaterialized {
  readonly unmaterialized: readonly string[];
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
      /** AFILE-04: every member's MCP config file notices, in member order. */
      readonly mcpConfigNotices: readonly McpConfigNotice[];
    }
  | {
      /** UPD-DEP-D1: `installed` for a recorded root, which does not materialize; no root summary. */
      readonly kind: "dependencies-installed";
      readonly members: readonly CascadeMemberOutcome[];
      readonly alreadyInstalled: readonly CascadeSkippedMember[];
      readonly mcpConfigNotices: readonly McpConfigNotice[];
    }
  | {
      /**
       * UPD-DEP-D1: nothing materialized, because a recorded member falls
       * outside its range. The caller plans the whole operation before it
       * writes anything (`dependency-plan.ts`).
       */
      readonly kind: "planned";
    }
  | { readonly kind: "marketplace-absent" }
  | {
      readonly kind: "closure-failed";
      readonly failure: Extract<DependencyClosureResult, { readonly ok: false }> & Unmaterialized;
    }
  | {
      readonly kind: "constraint-failed";
      readonly failure: CascadeConstraintFailure & Unmaterialized;
    }
  | {
      readonly kind: "member-failed";
      readonly key: string;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
      /**
       * CAS-01 / D-PL3-03: the members this run rolled back or never reached,
       * in phase order, the root and the failing member excluded. REQUIRED on
       * the D-07 rationale `Unmaterialized` states.
       */
      readonly unmaterialized: readonly string[];
      /**
       * AFILE-04: the notices of the members that committed before the
       * failure, then those of their undo. The undo unstages from the
       * rewritten file rather than restoring its bytes, so removed comments
       * stay removed.
       */
      readonly mcpConfigNotices: readonly McpConfigNotice[];
    };

/** UPD-DEP-D1: one plugin that declares a graph node, and the ranges it declares for it. */
export interface GraphRequester {
  readonly key: string;
  readonly ranges: readonly string[];
}

/**
 * UPD-DEP-D1: a plugin of a dependency graph that is not installed yet. It
 * installs with the pin its combined range chose.
 */
export interface FreshGraphNode {
  readonly kind: "fresh";
  readonly member: ResolvedCascadeMember;
  /** Every plugin of the graph that declares this one, in walk order. */
  readonly requesters: readonly GraphRequester[];
  /** The keys this node's declarations name. */
  readonly dependsOn: readonly string[];
}

/**
 * UPD-DEP-D1: a plugin of a dependency graph the scope records. The walk read
 * through it when it is disabled or moving (`walked`), and stopped at it
 * otherwise.
 */
export interface RecordedGraphNode {
  readonly kind: "recorded";
  readonly member: ClosureMember;
  readonly requesters: readonly GraphRequester[];
  /** The keys this node's declarations name; empty when the walk stopped at it. */
  readonly dependsOn: readonly string[];
  readonly version: string | undefined;
  /**
   * GV-01: the version ranges read when it is not the recorded one: the
   * release tag's semver the record keeps, or the declared version of a
   * pinned `anthropic-plugin-directory` plugin.
   */
  readonly resolvedVersion?: string;
  readonly disabled: boolean;
  readonly walked: boolean;
}

/** UPD-DEP-D1: one plugin of a dependency graph below its root. */
export type DependencyGraphNode = FreshGraphNode | RecordedGraphNode;

/**
 * UPD-DEP-D1: one write-free walk of a whole dependency graph. `nodes` lists
 * the recorded plugins the walk stopped at first, then the rest in post
 * order, dependencies first. `root` is the root as it would install; a
 * recorded root (an update) has none.
 */
export interface DependencyGraph {
  readonly kind: "graph";
  readonly root: ResolvedCascadeMember | undefined;
  readonly rootDependsOn: readonly string[];
  readonly nodes: readonly DependencyGraphNode[];
}

/** The arms a cascade reaches when its closure or a constraint fails, before any write. */
export type CascadeResolutionFailure = Extract<
  InstallCascadeResult,
  { readonly kind: "closure-failed" | "constraint-failed" }
>;

/**
 * UPD-DEP-D1 / WR-1: a graph walk that failed, with every plugin whose
 * declarations the failure involves: the members of a cycle, the plugin that
 * named a dependency it could not reach, or the plugins that declare the
 * dependency whose ranges failed. A transport failure involves none.
 */
export type GraphWalkFailure = CascadeResolutionFailure & { readonly declarers: readonly string[] };

/** UPD-DEP-D1: the arm a cascade reaches when recorded dependencies must move first. */
export type CascadePlan = Extract<InstallCascadeResult, { readonly kind: "planned" }>;

/** What a cascade that installs the root answers. */
export type RootCascadeResult = Exclude<
  InstallCascadeResult,
  { readonly kind: "dependencies-installed" | "planned" }
>;

/** UPD-DEP-D1: what a cascade rooted at a recorded plugin answers. */
export type DependencyCascadeResult = Exclude<
  InstallCascadeResult,
  { readonly kind: "installed" | "planned" }
>;

/** Mutable ledger context: what the phases record as they run. */
interface CascadeRun {
  root: InstallLedgerSummary | undefined;
  marketplaceAbsent: boolean;
  attempting: string | undefined;
  readonly members: CascadeMemberOutcome[];
  /** Keys THIS run materialized, and the only keys an `undo` may touch. */
  readonly materialized: Set<string>;
  /** AFILE-04: each materialized member's MCP config file notices. */
  readonly mcpConfigNotices: McpConfigNotice[];
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
  const range = renderDeclaredRanges(ranges);
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
    ((marketplace: string) => Promise.resolve(ownValue(options.state.marketplaces, marketplace)));
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
  declared: string,
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
      failure: {
        kind: "no-matching-tag",
        key: member.key,
        range: declared,
      },
    };
  }

  return {
    kind: "failed",
    failure: {
      kind: "tag-listing-failed",
      key: member.key,
      range: declared,
      classification: probed.classification,
    },
  };
}

async function probeMemberPin(
  options: MemberConstraintOptions,
  member: ClosureMember,
  range: string,
  declared: string,
): Promise<MemberConstraintOutcome> {
  const tagSource = await resolveMemberTagSource(options, member);
  if (tagSource.kind === "absent") {
    return {
      kind: "failed",
      failure: { kind: "no-matching-tag", key: member.key, range: declared },
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

    return toMemberConstraintOutcome(member, declared, probed);
  }

  const ledger = options.ledgerOptionsFor(member);
  const probed = await options.tagProbe({
    pluginName: member.name,
    source: tagSource.source,
    range,
    tagMemo: options.tagMemo,
    auth: {
      ctx: ledger.ctx,
      run: ledger.run,
      credentialOps: ledger.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(ledger.deviceFlowHttp !== undefined && { deviceFlowHttp: ledger.deviceFlowHttp }),
      ...(ledger.authMemo !== undefined && { authMemo: ledger.authMemo }),
    },
  });
  return toMemberConstraintOutcome(member, declared, probed);
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
 * GV-01: the plugins a member's ranges came from, as Claude Code names them
 * when a plugin directory copy falls outside them. The root gets the caller's
 * requirers (MISS-01). Any other member gets every cascade member that
 * declared a range on it, in reverse install order: the closure's post order
 * reversed, which is the order Claude Code names them in (D-PL3-08). This is
 * not the order of distance from the requested plugin. An installed plugin
 * outside the closure is not named, because D-03-10 keeps its range out of the
 * walk and out of the check (D-PL3-13).
 */
function rangeRequirers(
  options: MemberConstraintOptions,
  member: ClosureMember,
): readonly string[] {
  if (member.key === options.rootKey) {
    return options.rootRequiredBy ?? [];
  }

  const declarers = new Set(
    requestersOf(options.declared, member.key)
      .filter((requester) => requester.ranges.length > 0)
      .map((requester) => requester.key),
  );
  return [...options.closure]
    .reverse()
    .filter((declarer) => declarers.has(declarer.key))
    .map((declarer) => declarer.key);
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

  if (isUnconstrainedRange(intersected.range)) {
    return { kind: "resolved", member };
  }

  // GV-01: Claude Code never picks a release tag for a plugin of its plugin
  // directory; the copy its catalog lists must satisfy the range instead.
  if (isPluginDirectoryMarketplace(member.marketplace)) {
    return {
      kind: "resolved",
      member: {
        ...member,
        directoryPin: {
          range: intersected.range,
          declared: truncateForRefusal(ranges.join(", "), MAX_DIRECTORY_PIN_FIELD_CHARS),
          requiredBy: rangeRequirers(options, member),
        },
      },
    };
  }

  return probeMemberPin(options, member, intersected.range, renderDeclaredRanges(ranges));
}

/**
 * The version the locked snapshot records for a member, if it records one.
 *
 * Read from the one record the RESV-05 constraint check reads, so the RESV-06
 * skipped-row projection and that check cannot answer about different
 * records. The check reads the record's range version (GV-01); the row shows
 * the version it records.
 */
function recordedVersionOf(state: ExtensionState, member: ClosureMember): string | undefined {
  return recordOf(state, member)?.version;
}

/** The record the locked snapshot holds for a member, if any. */
function recordOf(state: ExtensionState, member: ClosureMember): PluginInstallRecord | undefined {
  return ownValue(ownValue(state.marketplaces, member.marketplace)?.plugins, member.name);
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

  const record = ownValue(ownValue(state.marketplaces, member.marketplace)?.plugins, member.name);
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
 *
 * INR-04: a conflict reports the DECLARED ranges, as the contradictory
 * declarations arm does and as Claude Code does, not their intersection.
 */
function checkInstalledMember(
  state: ExtensionState,
  member: ClosureMember,
): CascadeConstraintFailure | undefined {
  const intersected = intersectDependencyRanges(member.ranges);
  if (!intersected.ok) {
    return toIntersectionFailure(member.key, member.ranges, intersected);
  }

  const recorded = recordOf(state, member);
  if (isUnconstrainedRange(intersected.range) || recorded === undefined) {
    return undefined;
  }

  // GV-01: a record at a release tag is read by the tag's semver.
  return recordedVersionSatisfies(rangeVersionOf(recorded), intersected.range)
    ? undefined
    : {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: member.key,
        range: renderDeclaredRanges(member.ranges),
        recordedVersion: recorded.version,
      };
}

/**
 * RESV-05 over every recorded member -- the enabled ones the walk skipped,
 * the disabled ones it walked, and the ones a plan moves -- none of which
 * needs a query. UPD-DEP-D1: with `moveOutOfRange`, a member whose recorded
 * version the range rejects is noted for a move instead of failing the
 * cascade; every other failure still fails it.
 */
function checkRecordedMembers(options: MemberConstraintOptions): {
  readonly failure?: CascadeConstraintFailure;
  readonly outOfRange: boolean;
} {
  const walked = options.closure.filter(
    (member) =>
      disabledRecordOf(options.state, options.rootKey, member) !== undefined ||
      options.readThrough.has(member.key),
  );
  let outOfRange = false;
  for (const member of [...options.alreadyInstalled, ...walked]) {
    const failure = checkInstalledMember(options.state, member);
    if (failure === undefined) {
      continue;
    }

    if (
      options.moveOutOfRange !== true ||
      failure.kind !== "range-conflict" ||
      failure.why !== "installed-unsatisfied"
    ) {
      return { failure, outOfRange };
    }

    outOfRange = true;
  }

  return { outOfRange };
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
  const recorded = checkRecordedMembers(options);
  if (recorded.failure !== undefined) {
    return { ok: false, failure: recorded.failure };
  }

  const members: CascadePhaseMember[] = [];
  for (const member of options.closure) {
    const record = disabledRecordOf(options.state, options.rootKey, member);
    if (record !== undefined) {
      members.push({ kind: "re-enable", member, record });
      continue;
    }

    // UPD-DEP-D1: a recorded member a plan moves is neither a phase nor a
    // fresh install; the plan decides its version.
    if (options.readThrough.has(member.key)) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- the first unresolvable member ends the cascade plan
    const outcome = await resolveOneMember(options, member);
    if (outcome.kind === "failed") {
      return { ok: false, failure: outcome.failure };
    }

    members.push({ kind: "install", member: outcome.member });
  }

  // UPD-DEP-D1: every other member resolved, so the moves are all that stand
  // between the closure and its install; nothing is materialized yet.
  return { ok: true, members, outOfRange: recorded.outOfRange };
}

/**
 * Records a member whose ledger just materialized it: the key an `undo` may
 * touch, its MCP config notices (AFILE-04), and its outcome as its own ledger
 * summary reports it. `origin` holds the two facts the summary cannot know.
 */
function recordMaterializedMember(
  run: CascadeRun,
  member: ClosureMember,
  summary: InstallLedgerSummary,
  origin: Pick<CascadeMemberOutcome, "fellBackToCurrentCopy" | "reEnabledFromRecord">,
): void {
  run.materialized.add(member.key);
  run.mcpConfigNotices.push(...summary.mcpConfigNotices);
  run.members.push({
    key: member.key,
    name: member.name,
    marketplace: member.marketplace,
    requiredBy: member.requiredBy,
    version: summary.version,
    declaresAgents: summary.stagedAgentNames.length > 0,
    declaresMcp: summary.stagedMcpServerNames.length > 0,
    declaresWorkflows: summary.stagedWorkflowNames.length > 0,
    pluginRoot: summary.resolved.pluginRoot,
    hooksConfigPath: summary.resolved.hooksConfigPath,
    ...origin,
  });
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

      recordMaterializedMember(run, member, result.summary, {
        fellBackToCurrentCopy: member.fellBackToCurrentCopy ?? false,
        reEnabledFromRecord: false,
      });
      if (member.key === options.rootKey) {
        run.root = result.summary;
      }
    },
    undo: async (run) => {
      const unstaged = await unstageMaterializedMember(options, seam, run, member);
      if (unstaged === undefined) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- `plugins` is a Record<string, ...> keyed by the member's own token-checked plugin name.
      delete unstaged.marketplaceRecord.plugins[member.name];
    },
  };
}

/**
 * The unstage both member undos share. Returns the member's marketplace slot
 * and record once its artifacts are off disk, or `undefined` when this run
 * did not materialize the member or the snapshot no longer records it.
 *
 * AFILE-04: the unstage rewrites the MCP config files again, and its notices
 * join the run's even when a later slot then fails. AVAR-04: the variable
 * notices of the servers it removed leave the run's list.
 *
 * The primitive REPORTS rather than throws -- its whole body is a try/catch
 * returning `{ok: false, dropped, cause}` -- and the ledger's only
 * partial-rollback channel is a throw. Discarding a failed outcome reports a
 * cascade that unwound cleanly while the member's artifacts are still on
 * disk, so convert it. Subtracting what DID drop first keeps the record honest
 * about what remains (NFR-3), and the record is deliberately NOT deleted or
 * disabled: it is what still owns those artifacts.
 */
async function unstageMaterializedMember(
  options: InstallCascadeOptions,
  seam: InstallCascadeLedgerSeam,
  run: CascadeRun,
  member: Pick<ClosureMember, "key" | "name" | "marketplace">,
): Promise<
  | {
      readonly marketplaceRecord: ExtensionState["marketplaces"][string];
      readonly installed: PluginInstallRecord;
    }
  | undefined
> {
  if (!run.materialized.has(member.key)) {
    return undefined;
  }

  const marketplaceRecord = ownValue(options.state.marketplaces, member.marketplace);
  const installed = ownValue(marketplaceRecord?.plugins, member.name);
  if (marketplaceRecord === undefined || installed === undefined) {
    return undefined;
  }

  const outcome = await seam.cascadeUnstagePlugin(
    member.name,
    member.marketplace,
    options.locations,
    installed,
  );
  foldUnstageNotices(run.mcpConfigNotices, {
    scope: options.locations.scope,
    plugin: member.name,
    droppedServers: outcome.dropped.mcpServers,
    notices: outcome.mcpConfigNotices ?? [],
  });
  if (!outcome.ok) {
    applyPartialCascadeFold(installed, outcome.dropped);
    throw outcome.cause ?? new Error(`Rollback of "${member.key}" did not complete.`);
  }

  return { marketplaceRecord, installed };
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
          ...(record.resolvedVersion !== undefined && { resolvedVersion: record.resolvedVersion }),
          allowExistingRecord: true,
          partial: !record.compatibility.installable,
        },
        options.capture,
        transaction,
      );
      assertReEnableLedgerInstalled(result);

      recordMaterializedMember(run, member, result.summary, {
        fellBackToCurrentCopy: false,
        reEnabledFromRecord: true,
      });
    },
    undo: async (run) => {
      const unstaged = await unstageMaterializedMember(options, seam, run, member);
      if (unstaged === undefined) {
        return;
      }

      setOwn(
        unstaged.marketplaceRecord.plugins,
        member.name,
        toDisabledRecord(unstaged.installed, new Date().toISOString()),
      );
    },
  };
}

/** A ledger run's result and the run's records, before the caller's arm is chosen. */
interface MaterializedCascade {
  readonly result: RunPhasesResult;
  readonly run: CascadeRun;
  readonly alreadyInstalled: readonly CascadeSkippedMember[];
  /** The key of every member the run built a phase for, in phase order. */
  readonly phaseKeys: readonly string[];
}

/** The failure arms a ledger run can reach. */
function failedCascade(
  options: InstallCascadeOptions,
  { result, run, phaseKeys }: MaterializedCascade,
): Extract<InstallCascadeResult, { readonly kind: "marketplace-absent" | "member-failed" }> {
  if (run.marketplaceAbsent) {
    return { kind: "marketplace-absent" };
  }

  const key = run.attempting ?? options.rootKey;
  return {
    kind: "member-failed",
    key,
    error: result.error ?? new Error("Install cascade failed."),
    rollbackPartials: result.rollbackPartials,
    mcpConfigNotices: run.mcpConfigNotices,
    unmaterialized: phaseKeys.filter(
      (phaseKey) => phaseKey !== options.rootKey && phaseKey !== key,
    ),
  };
}

/** Projects a ledger run that installed the root onto the caller-facing arm. */
function rootCascadeResult(
  options: InstallCascadeOptions,
  materialized: MaterializedCascade,
): RootCascadeResult {
  const { result, run, alreadyInstalled } = materialized;
  if (!result.ok) {
    return failedCascade(options, materialized);
  }

  const root = run.root;
  if (root === undefined) {
    // The closure always ends at the root, so a clean ledger run always
    // recorded it. Reaching here means the injected scheduler reported
    // success without running the phases.
    throw new Error("Install cascade reported success without materializing the root plugin.");
  }

  return {
    kind: "installed",
    root,
    members: run.members,
    alreadyInstalled,
    mcpConfigNotices: run.mcpConfigNotices,
  };
}

/** UPD-DEP-D1: projects a ledger run rooted at a recorded plugin onto its arm. */
function dependencyCascadeResult(
  options: InstallCascadeOptions,
  materialized: MaterializedCascade,
): DependencyCascadeResult {
  const { result, run, alreadyInstalled } = materialized;
  return result.ok
    ? {
        kind: "dependencies-installed",
        members: run.members,
        alreadyInstalled,
        mcpConfigNotices: run.mcpConfigNotices,
      }
    : failedCascade(options, materialized);
}

/** The closure walked and every member's constraint decided, nothing materialized. */
interface ResolvedCascade {
  readonly kind: "resolved";
  /** The walk's post order, the members a plan moves included. */
  readonly closure: readonly ClosureMember[];
  readonly alreadyInstalled: readonly ClosureMember[];
  readonly members: readonly CascadePhaseMember[];
  /** UPD-DEP-D1: whether a recorded member falls outside its range. */
  readonly outOfRange: boolean;
}

/**
 * UPD-DEP-D1: the closure a dependency plan decided, taken as it stands. A
 * member the plan re-enables must still be recorded disabled; a scope another
 * process changed since the plan refuses the run.
 */
function plannedCascade(options: InstallCascadeOptions, planned: PlannedClosure): ResolvedCascade {
  const members = planned.members.map((entry): CascadePhaseMember => {
    if (entry.kind === "install") {
      return entry;
    }

    const record = disabledRecordOf(options.state, options.rootKey, entry.member);
    if (record === undefined) {
      throw new DependencyCascadeError(
        `Dependency "${entry.member.key}" changed since the dependency plan read it; run the command again.`,
        entry.member.key,
      );
    }

    return { kind: "re-enable", member: entry.member, record };
  });
  return {
    kind: "resolved",
    closure: planned.members.map((entry) => entry.member),
    alreadyInstalled: planned.alreadyInstalled,
    members,
    outOfRange: false,
  };
}

/**
 * Walks the requested plugin's dependency closure and decides every member's
 * constraint, with no write. With `moveOutOfRange` (UPD-DEP-D1 / RESV-05), a
 * recorded member whose version the range rejects is noted for a move
 * instead of failing the cascade. A cascade carrying out a plan walks nothing.
 */
async function resolveCascade(
  options: InstallCascadeOptions,
  moveOutOfRange: boolean,
  declared: DeclaredEdges,
): Promise<ResolvedCascade | CascadeResolutionFailure> {
  if (options.planned !== undefined) {
    return plannedCascade(options, options.planned);
  }

  const readThrough = options.readThrough ?? new Set<string>();
  // EDEP-03: a disabled record is not a wall by default. The walk reads
  // through it, so its own dependencies -- disabled or never installed -- are
  // members of this closure with their ranges merged across every declaring
  // branch, and a declaration it cannot resolve fails this install naming it
  // as the dependent. D-09-04's `treatDisabledAsWall` is the one input that
  // reverses this: the walk stops at a disabled key exactly as it stops at a
  // live one. UPD-DEP-D1: a recorded key a plan moves is read through too.
  const live = liveInstalledKeys(options.state, options.installedKeys);
  const walls = options.treatDisabledAsWall === true ? options.installedKeys : live;
  const closure = await resolveDependencyClosure({
    rootKey: options.rootKey,
    lookup: recordingLookup(options.lookup, declared),
    installedKeys: new Set([...walls].filter((key) => !readThrough.has(key))),
    knownMarketplaces: options.knownMarketplaces,
    // XMKT-02: only an enabled record is exempt from the root's allowlist, as
    // in Claude Code, so a disabled foreign dependency this install would
    // enable again needs the root marketplace's permission.
    installPolicy: {
      allowedMarketplaces: options.rootAllowedMarketplaces,
      recordedKeys: live,
    },
  });
  if (!closure.ok) {
    const failing = closure.reason === "cycle" ? closure.chain.slice(-1) : [closure.key];
    return {
      kind: "closure-failed",
      failure: { ...closure, ...unmaterialized(options.rootKey, failing, declared, readThrough) },
    };
  }

  // RESV-03 / RESV-05: decided here, between the walk and the phase array, so
  // every constraint verdict lands while nothing is materialized. ONE memo is
  // allocated per run and threaded through every member, so a graph whose
  // dependencies share a repository lists that repository once.
  const constraints = await resolveMemberConstraints({
    state: options.state,
    rootKey: options.rootKey,
    closure: closure.closure,
    declared,
    readThrough,
    alreadyInstalled: closure.alreadyInstalled,
    ledgerOptionsFor: options.ledgerOptionsFor,
    tagProbe: options.tagProbe ?? probeDependencyTags,
    tagMemo: options.tagMemo ?? new Map<string, readonly RemoteTag[]>(),
    marketplaceTagMemo:
      options.marketplaceTagMemo ?? new Map<string, readonly ReleaseTagCandidate[]>(),
    ...(options.rootRanges !== undefined && { rootRanges: options.rootRanges }),
    ...(options.rootRequiredBy !== undefined && { rootRequiredBy: options.rootRequiredBy }),
    ...(moveOutOfRange && { moveOutOfRange: true }),
    ...(options.marketplaceTagProbe !== undefined && {
      marketplaceTagProbe: options.marketplaceTagProbe,
    }),
    ...(options.marketplaceRecordFor !== undefined && {
      marketplaceRecordFor: options.marketplaceRecordFor,
    }),
  });
  if (!constraints.ok) {
    const failing = [constraints.failure.key];
    return {
      kind: "constraint-failed",
      failure: {
        ...constraints.failure,
        ...unmaterialized(options.rootKey, failing, declared, readThrough),
      },
    };
  }

  return {
    kind: "resolved",
    closure: closure.closure,
    alreadyInstalled: closure.alreadyInstalled,
    members: constraints.members,
    outOfRange: constraints.outOfRange,
  };
}

/**
 * Materializes every member of a resolved closure, all-or-nothing. A recorded
 * root (UPD-DEP-D1) is the plugin an update moves; its own swap replaces it,
 * so only its closure becomes phases.
 *
 * `runPhases` never throws on its own -- its `{ok: false}` result is
 * translated by the caller's projection, so the caller sees one
 * discriminated value for every outcome.
 */
async function materializeCascade(
  options: InstallCascadeOptions,
  resolved: ResolvedCascade,
  rootRecorded: boolean,
): Promise<MaterializedCascade> {
  const seam = options.seam ?? REAL_INSTALL_CASCADE_SEAM;
  const transaction = options.transaction ?? DEFAULT_INSTALL_CASCADE_TRANSACTION;
  const run: CascadeRun = {
    root: undefined,
    marketplaceAbsent: false,
    attempting: undefined,
    members: [],
    materialized: new Set<string>(),
    mcpConfigNotices: [],
  };
  // One phase per closure member, in the walk's post order: a dependency is
  // live -- installed or re-enabled -- before the member that needs it runs.
  const members = rootRecorded
    ? resolved.members.filter((entry) => entry.member.key !== options.rootKey)
    : resolved.members;
  const phases: readonly Phase<CascadeRun>[] = members.map((entry) =>
    entry.kind === "re-enable"
      ? buildReEnableMemberPhase(options, seam, transaction, entry.member, entry.record)
      : buildMemberPhase(options, seam, transaction, entry.member),
  );
  // RESV-05 / RESV-06: projected from the walk's own skipped list, not from
  // the ledger -- these members never reach a phase, so the run has nothing to
  // record about them. They are carried out of the cascade so the block can
  // report them as left alone rather than omitting them entirely.
  const alreadyInstalled: readonly CascadeSkippedMember[] = resolved.alreadyInstalled.map(
    (member) => ({
      key: member.key,
      version: recordedVersionOf(options.state, member),
    }),
  );

  return {
    result: await transaction.runPhases(phases, run),
    run,
    alreadyInstalled,
    phaseKeys: members.map((entry) => entry.member.key),
  };
}

/**
 * Resolve the requested plugin's dependency closure and materialize every
 * member of it, all-or-nothing. Nothing is materialized when the closure
 * itself fails. A recorded member outside its range fails the cascade.
 */
export async function runInstallCascade(
  options: InstallCascadeOptions,
): Promise<RootCascadeResult> {
  const resolved = await resolveCascade(options, false, new Map());
  return resolved.kind === "resolved"
    ? rootCascadeResult(options, await materializeCascade(options, resolved, false))
    : resolved;
}

/**
 * UPD-DEP-D1 / RESV-05: `runInstallCascade`, except that a recorded member
 * outside its range answers `planned` and nothing materializes.
 */
export async function runInstallCascadeOrPlanMoves(
  options: InstallCascadeOptions,
): Promise<RootCascadeResult | CascadePlan> {
  const resolved = await resolveCascade(options, true, new Map());
  if (resolved.kind !== "resolved") {
    return resolved;
  }

  return resolved.outOfRange
    ? { kind: "planned" }
    : rootCascadeResult(options, await materializeCascade(options, resolved, false));
}

/**
 * UPD-DEP-D1: the cascade of a recorded root, the plugin an update moves:
 * its closure materializes and the root itself does not. A recorded member
 * outside its range fails the cascade.
 */
export async function runDependencyCascade(
  options: InstallCascadeOptions,
): Promise<DependencyCascadeResult> {
  const resolved = await resolveCascade(options, false, new Map());
  return resolved.kind === "resolved"
    ? dependencyCascadeResult(options, await materializeCascade(options, resolved, true))
    : resolved;
}

/**
 * UPD-DEP-D1: `runDependencyCascade`, except that a recorded member outside
 * its range answers `planned` and nothing materializes.
 */
export async function runDependencyCascadeOrPlanMoves(
  options: InstallCascadeOptions,
): Promise<DependencyCascadeResult | CascadePlan> {
  const resolved = await resolveCascade(options, true, new Map());
  if (resolved.kind !== "resolved") {
    return resolved;
  }

  return resolved.outOfRange
    ? { kind: "planned" }
    : dependencyCascadeResult(options, await materializeCascade(options, resolved, true));
}

/** UPD-DEP-D1: what each plugin the walk read declares, by key. */
type DeclaredEdges = Map<string, readonly { readonly key: string; readonly range?: string }[]>;

/** Wraps `lookup` so every plugin it finds lands in `declared` with its declarations. */
function recordingLookup(lookup: ClosureLookup, declared: DeclaredEdges): ClosureLookup {
  return async (subject) => {
    const looked = await lookup(subject);
    if (looked.kind === "found") {
      declared.set(
        subject.key,
        looked.dependencies.map((dependency) => ({
          key: `${dependency.name}@${dependency.marketplace ?? subject.marketplace}`,
          ...(dependency.version !== undefined && { range: dependency.version }),
        })),
      );
    }

    return looked;
  };
}

/**
 * CAS-01 / D-PL3-01: every plugin the walk found before it failed, minus the
 * root, the failing member, and the members a plan moves (`Unmaterialized`).
 */
function unmaterialized(
  rootKey: string,
  failing: readonly string[],
  declared: DeclaredEdges,
  readThrough: ReadonlySet<string>,
): Unmaterialized {
  return {
    unmaterialized: [...declared.keys()].filter(
      (key) => key !== rootKey && !failing.includes(key) && !readThrough.has(key),
    ),
  };
}

/** Every plugin the walk read that declares `key`, with the ranges it declares, in walk order. */
function requestersOf(
  declared: ReadonlyMap<string, readonly { readonly key: string; readonly range?: string }[]>,
  key: string,
): GraphRequester[] {
  const requesters: GraphRequester[] = [];
  for (const [declarer, edges] of declared) {
    const toKey = edges.filter((edge) => edge.key === key);
    if (toKey.length > 0) {
      requesters.push({
        key: declarer,
        ranges: toKey.flatMap((edge) => (edge.range === undefined ? [] : [edge.range])),
      });
    }
  }

  return requesters;
}

/** WR-1: the plugins whose declarations a failed walk involves (`GraphWalkFailure`). */
function failureDeclarers(failure: CascadeResolutionFailure, declared: DeclaredEdges): string[] {
  const declarersOf = (key: string): string[] =>
    requestersOf(declared, key).map((requester) => requester.key);
  if (failure.kind === "constraint-failed") {
    return failure.failure.kind === "tag-listing-failed" ? [] : declarersOf(failure.failure.key);
  }

  const closure = failure.failure;
  if (closure.reason === "cycle") {
    return [...closure.chain];
  }

  if (closure.reason === "invalid-root-id") {
    return [];
  }

  return closure.reason === "unusable-declaration"
    ? [closure.key, ...declarersOf(closure.key)]
    : [closure.requiredBy];
}

/** One graph node: fresh, or what the snapshot records. */
function graphNode(
  options: InstallCascadeOptions,
  member: ClosureMember,
  walked: boolean,
  fresh: ReadonlyMap<string, ResolvedCascadeMember>,
  facts: Pick<DependencyGraphNode, "dependsOn" | "requesters">,
): DependencyGraphNode {
  const resolved = fresh.get(member.key);
  if (resolved !== undefined) {
    return { kind: "fresh", member: resolved, ...facts };
  }

  const record = recordOf(options.state, member);
  const rangeVersion = nodeRangeVersion(record);
  return {
    kind: "recorded",
    member,
    ...facts,
    version: record?.version,
    ...(rangeVersion !== undefined && { resolvedVersion: rangeVersion }),
    disabled: disabledRecordOf(options.state, options.rootKey, member) !== undefined,
    walked,
  };
}

/** GV-01: the version a recorded node's ranges read, when the record keeps one apart. */
function nodeRangeVersion(record: PluginInstallRecord | undefined): string | undefined {
  if (record === undefined || record.resolvedVersion !== undefined) {
    return record?.resolvedVersion;
  }

  const rangeVersion = rangeVersionOf(record);
  return rangeVersion === record.version ? undefined : rangeVersion;
}

/**
 * UPD-DEP-D1: walks the whole dependency graph of `options.rootKey` with no
 * write, reading through every key in `options.readThrough`, and answers each
 * plugin it reached with the plugins that declare it and the ranges they
 * declare. A fresh member's pin is chosen over every range the graph declares
 * for it. A recorded member's version is not checked: the plan decides
 * whether it moves.
 */
export async function walkDependencyGraph(
  options: InstallCascadeOptions,
): Promise<DependencyGraph | GraphWalkFailure> {
  const declared: DeclaredEdges = new Map();
  const resolved = await resolveCascade(options, true, declared);
  if (resolved.kind !== "resolved") {
    return { ...resolved, declarers: failureDeclarers(resolved, declared) };
  }

  const dependsOn = (key: string): readonly string[] => [
    ...new Set((declared.get(key) ?? []).map((edge) => edge.key)),
  ];
  const fresh = new Map(
    resolved.members.flatMap((entry) =>
      entry.kind === "install" ? [[entry.member.key, entry.member] as const] : [],
    ),
  );
  const node = (member: ClosureMember, walked: boolean): DependencyGraphNode =>
    graphNode(options, member, walked, fresh, {
      requesters: requestersOf(declared, member.key),
      dependsOn: dependsOn(member.key),
    });
  const nodes = [
    ...resolved.alreadyInstalled.map((member) => node(member, false)),
    ...resolved.closure
      .filter((member) => member.key !== options.rootKey)
      .map((member) => node(member, true)),
  ];
  return {
    kind: "graph",
    root: options.installedKeys.has(options.rootKey) ? undefined : fresh.get(options.rootKey),
    rootDependsOn: dependsOn(options.rootKey),
    nodes,
  };
}
