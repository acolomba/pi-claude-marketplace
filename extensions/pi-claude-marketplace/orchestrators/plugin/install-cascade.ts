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
// D-03-07 rollback scope has two halves, and only one of them is structural.
// A DEPENDENCY the closure skipped as already-installed never becomes a
// `Phase`, so the reverse walk over `runPhases`'s own `executed` array cannot
// reach its record or its artifacts, and no flag can make that safer than it
// already is. The REQUESTED plugin is different: it is never skipped, so an
// install of a plugin that is already recorded reaches its phase and throws
// from inside `do`. TR-02 then runs that phase's OWN undo, which would unstage
// the very install the throw was reporting. `Phase.undo`'s contract states the
// remedy -- an undo cannot assume its `do` ran to completion and must gate on a
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
import { runPhases } from "../../transaction/phase-ledger.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../auth-host.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { probeDependencyTags } from "./dependency-tag-probe.ts";
import { runInstallLedger } from "./install-outcome.ts";
import { applyPartialCascadeFold } from "./shared.ts";

import type {
  DependencyTagListingFailureReason,
  DependencyTagProbeOptions,
} from "./dependency-tag-probe.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerSummary,
  InstallLedgerTransaction,
} from "./install-outcome.ts";
import type {
  ClosureLookup,
  ClosureMember,
  DependencyClosureResult,
} from "../../domain/dependency-closure.ts";
import type { DependencyRangeIntersection } from "../../domain/dependency-range.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
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

/** The per-URL tag listing memo one cascade run threads through every query. */
export type CascadeTagMemo = NonNullable<DependencyTagProbeOptions["tagMemo"]>;

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
      readonly cause: Error;
      readonly classification: DependencyTagListingFailureReason;
    };

/**
 * A closure member whose accumulated constraint has been resolved.
 *
 * Both pin fields are present together and only for a member whose constraint
 * was a real range that a release tag satisfied. An unconstrained member
 * carries neither and installs from whatever ref its marketplace entry names,
 * which is what every install did before a constraint could re-point one.
 */
export interface ResolvedCascadeMember extends ClosureMember {
  /** The release tag the constraint selected. */
  readonly pinnedRef?: string;
  /** The object id that tag resolves to, which is what the install pins on. */
  readonly pinnedOid?: string;
}

/** Every member's constraint resolved, or the first failure one produced. */
export type MemberConstraintResolution =
  | { readonly ok: true; readonly members: readonly ResolvedCascadeMember[] }
  | { readonly ok: false; readonly failure: CascadeConstraintFailure };

/** Inputs of one cascade run's constraint resolution. */
export interface MemberConstraintOptions {
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
}

/**
 * One dependency RESV-05 found already present and left exactly as it was.
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
 * The git-backed source a member's release tags would live on.
 *
 * The SOURCE comes from the member's own marketplace entry, never from the
 * declaration that named it -- a dependency declaration carries a version, and
 * a version may select among a source's tags but may never change which source
 * is read.
 *
 * A member with no git-backed source has no release tags at all. It reports the
 * same no-match its constrained siblings report rather than a second shape of
 * failure, which is D-03-09's rule applied one step earlier: one no-match
 * answer, no branch on how the source parsed, and no path to a repository head.
 */
async function resolveMemberTagSource(
  state: ExtensionState,
  member: ClosureMember,
): Promise<GitBackedSource | undefined> {
  const record = state.marketplaces[member.marketplace];
  if (record === undefined) {
    return undefined;
  }

  const manifest = await loadMarketplaceManifest(record.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, member.name);
  if (declared.kind === "absent") {
    return undefined;
  }

  const parsed = parsePluginSource(declared.entry.source);
  return parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github"
    ? parsed
    : undefined;
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
async function probeMemberPin(
  options: MemberConstraintOptions,
  member: ClosureMember,
  range: string,
): Promise<MemberConstraintOutcome> {
  const source = await resolveMemberTagSource(options.state, member);
  if (source === undefined) {
    return {
      kind: "failed",
      failure: { kind: "no-matching-tag", key: member.key, range: renderConstraintRange(range) },
    };
  }

  const ledger = options.ledgerOptionsFor(member);
  const probed = await options.tagProbe({
    pluginName: member.name,
    source,
    range,
    tagMemo: options.tagMemo,
    auth: {
      ctx: ledger.ctx,
      credentialOps: ledger.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(ledger.deviceFlowHttp !== undefined && { deviceFlowHttp: ledger.deviceFlowHttp }),
      ...(ledger.authMemo !== undefined && { authMemo: ledger.authMemo }),
    },
  });
  if (probed.kind === "pinned") {
    return {
      kind: "resolved",
      member: { ...member, pinnedRef: probed.tag, pinnedOid: probed.oid },
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
      cause: probed.cause,
      classification: probed.classification,
    },
  };
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
 * RESV-05: an already-installed dependency is CHECKED and never touched.
 *
 * It is not in the closure, so it never becomes a `Phase`, and no code path
 * below can reinstall it, re-pin it or re-declare it -- whether or not it
 * satisfies the constraint. The only question is whether what is already on
 * disk is acceptable, which is why no tag is ever queried for one: what COULD
 * be fetched is not the question being asked.
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
export async function resolveMemberConstraints(
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

  // RESV-03 / RESV-05: decided here, between the walk and the phase array, so
  // every constraint verdict lands while nothing is materialized. ONE memo is
  // allocated per run and threaded through every member, so a graph whose
  // dependencies share a repository lists that repository once.
  const constraints = await resolveMemberConstraints({
    state: options.state,
    closure: closure.closure,
    alreadyInstalled: closure.alreadyInstalled,
    ledgerOptionsFor: options.ledgerOptionsFor,
    tagProbe: options.tagProbe ?? probeDependencyTags,
    tagMemo: new Map(),
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
    materialized: new Set(),
  };
  const phases: readonly Phase<CascadeRun>[] = constraints.members.map((member) =>
    buildMemberPhase(options, seam, transaction, member),
  );
  // RESV-05 / RESV-06: projected from the walk's own skip list, not from the
  // ledger -- these members never reach a phase, so the run has nothing to
  // record about them. They are carried out of the cascade so the block can
  // report them as left alone rather than omitting them entirely.
  const alreadyInstalled: readonly CascadeSkippedMember[] = closure.alreadyInstalled.map(
    (member) => ({ key: member.key, version: recordedVersionOf(options.state, member) }),
  );

  return toCascadeResult(options, await transaction.runPhases(phases, run), run, alreadyInstalled);
}
