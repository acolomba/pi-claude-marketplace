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
import { runPhases } from "../../transaction/phase-ledger.ts";
import { cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { runInstallLedger } from "./install-outcome.ts";

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

/** One member the cascade itself materialized, in install order. */
export interface CascadeMemberOutcome {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly requiredBy: string | undefined;
  readonly version: string;
}

/** Inputs of one cascade run. */
export interface InstallCascadeOptions {
  /** The caller's locked snapshot. Every member mutates THIS object. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** `<plugin>@<marketplace>` of the plugin the user asked for. */
  readonly rootKey: string;
  readonly lookup: ClosureLookup;
  /** Per-member ledger options; the caller owns scope, cwd and the auth bundle. */
  readonly ledgerOptionsFor: (member: ClosureMember) => InstallLedgerOptions;
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
}

/** The cascade's outcome. */
export type InstallCascadeResult =
  | {
      readonly kind: "installed";
      readonly root: InstallLedgerSummary;
      readonly members: readonly CascadeMemberOutcome[];
    }
  | { readonly kind: "marketplace-absent" }
  | {
      readonly kind: "closure-failed";
      readonly failure: Extract<DependencyClosureResult, { readonly ok: false }>;
    }
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
 * Human-readable cause text for a closure failure.
 *
 * Every interpolated value is either a token-allowlisted key or a field path,
 * so no manifest text and no filesystem path reaches the string.
 */
export function formatClosureFailure(
  failure: Extract<DependencyClosureResult, { readonly ok: false }>,
): string {
  if (failure.reason === "cycle") {
    return `Dependency cycle: ${failure.chain.join(" -> ")}.`;
  }

  if (failure.reason === "marketplace-not-added") {
    return `Dependency "${failure.key}" requires marketplace "${failure.marketplace}", which is not added.`;
  }

  if (failure.reason === "not-found") {
    return `Dependency "${failure.key}" is not declared by its marketplace.`;
  }

  return `Plugin "${failure.key}" declares an unusable dependency (${failure.detail}).`;
}

/**
 * One member's phase.
 *
 * `undo` is gated on `run.materialized` so it can only reach an install THIS
 * run performed, and it reads the record back out of the snapshot rather than
 * closing over the one `do` wrote: a member whose OWN bridge ledger already
 * rolled itself back has no record left, and unstaging against a stale handle
 * would remove artifacts nothing owns any more.
 */
function buildMemberPhase(
  options: InstallCascadeOptions,
  seam: InstallCascadeLedgerSeam,
  transaction: InstallLedgerTransaction,
  member: ClosureMember,
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

      await seam.cascadeUnstagePlugin(
        member.name,
        member.marketplace,
        options.locations,
        installed,
      );
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
): InstallCascadeResult {
  if (result.ok) {
    const root = run.root;
    if (root === undefined) {
      // The closure always ends at the root, so a clean ledger run always
      // recorded it. Reaching here means the injected scheduler reported
      // success without running the phases.
      throw new Error("Install cascade reported success without materializing the root plugin.");
    }

    return { kind: "installed", root, members: run.members };
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

  const seam = options.seam ?? REAL_INSTALL_CASCADE_SEAM;
  const transaction = options.transaction ?? DEFAULT_INSTALL_CASCADE_TRANSACTION;
  const run: CascadeRun = {
    root: undefined,
    marketplaceAbsent: false,
    attempting: undefined,
    members: [],
    materialized: new Set(),
  };
  const phases: readonly Phase<CascadeRun>[] = closure.closure.map((member) =>
    buildMemberPhase(options, seam, transaction, member),
  );

  return toCascadeResult(options, await transaction.runPhases(phases, run), run);
}
