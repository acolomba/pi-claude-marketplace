// orchestrators/reconcile/dependency-verdict.ts
//
// LOAD-01: which recorded plugin in ONE scope has a declaration the scope does
// not satisfy, computed offline as pure data before anything is planned.
//
// D-06-04: it lands outside `plan.ts` because the planner is grep-gated pure
// and this walk does filesystem reads. The planner consumes the verdict as an
// already-computed argument, the same way it consumes the marketplace diff.
//
// It takes NO lock. Its only caller runs inside the reconcile read pass's
// existing `withLockedStateTransaction` closure over the same snapshot, and
// `proper-lockfile` is configured with no retries and is not re-entrant, so a
// second guard here would self-deadlock into a lock-held row.
//
// D-06-05: the walk runs to a fixpoint. A record this pass decides to hold
// down is itself an unsatisfied dependency for whoever declares it, so the
// whole propagation chain is known before the apply pass starts and the plan
// carries the complete closure. Nothing is written to iterate -- the fixpoint
// runs over the read-pass snapshot as data, which is what lets the planner's
// own convergence proof stand without an apply round-trip.
//
// LOAD-02: the verdict is re-derived LIVE on every pass. The persisted
// `dependencyDisabled` marker records that a record is currently held down; it
// is never an input here, so a dependency that has since been satisfied lifts
// the hold by simply not appearing in the next verdict.
//
// D-05-07: the walk inherits the declaration read's fail-closed posture. A
// declarer whose manifest cannot be read ends the walk with the typed failure
// arm naming it, and is never read as a record that declares nothing -- which
// would silently leave a dependent enabled on incomplete information.

import { buildScopeDeclarationDetail } from "../plugin/dependency-index.ts";

import type { loadMarketplaceManifest } from "../../domain/manifest.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { DependencyDeclarationReader } from "../plugin/dependency-declaration-read.ts";
import type { AddressedDependency } from "../plugin/dependency-index.ts";

/** Inputs of one scope-wide satisfaction verdict. */
export interface ScopeSatisfactionOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
}

/**
 * Why one declaration is unsatisfied, in the three shapes LOAD-01 names. The
 * member decides which remedy the row offers, so the row composer switches
 * over a closed union rather than sniffing a string.
 */
export type UnsatisfiedKind = "missing" | "disabled" | "out-of-range";

/** One unsatisfied declaration, as the row that reports it needs it. */
export interface UnsatisfiedDeclaration {
  /** `name@marketplace` of the record that declared it. */
  readonly dependent: string;
  /** `name@marketplace` of the declared dependency. */
  readonly dependency: string;
  readonly kind: UnsatisfiedKind;
  /** The declared range, present only on the out-of-range kind. */
  readonly range?: string;
}

/**
 * Every unsatisfied declaration in the scope, or the first declarer whose
 * declarations could not be established. The failure arm is the declaration
 * walk's own, forwarded unchanged, so the redacted message it carries reaches
 * the row exactly as the walk built it.
 */
export type ScopeSatisfactionVerdict =
  | { readonly ok: true; readonly unsatisfied: readonly UnsatisfiedDeclaration[] }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly cause: Error;
    };

/** Every `name@marketplace` key the scope records. */
function recordedKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const name of Object.keys(marketplace.plugins)) {
      keys.add(`${name}@${marketplace.name}`);
    }
  }

  return keys;
}

/**
 * The declarations of one record that the scope does not satisfy, in
 * declaration order.
 *
 * A declared key with no record in the scope is `missing`. A declared key this
 * pass has already decided to hold down is `disabled`: the record is installed,
 * so naming it missing would offer an install remedy for a plugin that is
 * already there.
 */
function unsatisfiedEntries(
  dependent: string,
  declared: readonly AddressedDependency[],
  recorded: ReadonlySet<string>,
  held: ReadonlySet<string>,
): readonly UnsatisfiedDeclaration[] {
  const entries: UnsatisfiedDeclaration[] = [];
  for (const dependency of declared) {
    const key = `${dependency.name}@${dependency.marketplace}`;
    if (!recorded.has(key)) {
      entries.push({ dependent, dependency: key, kind: "missing" });
    } else if (held.has(key)) {
      entries.push({ dependent, dependency: key, kind: "disabled" });
    }
  }

  return entries;
}

/**
 * Runs the propagation to a fixpoint, mirroring the orphan sweep's shape: each
 * pass collects the declarers not yet held that carry at least one unsatisfied
 * declaration, sorts that batch by `localeCompare`, and holds every member
 * down; the next pass sees them as unsatisfied dependencies of their own
 * dependents.
 *
 * Two exits, and both are load-bearing. An empty batch means the fixpoint is
 * reached -- that condition is "nothing was added this pass", NOT "nothing is
 * unsatisfied", which never becomes true and would not terminate on a
 * declaration cycle. The loop head is the bound: a pass that does not break
 * adds at least one key to `held`, so the walk runs at most once per declarer
 * and a regression in the batch filter fails the walk instead of hanging it.
 */
function propagateUnsatisfied(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  recorded: ReadonlySet<string>,
): readonly UnsatisfiedDeclaration[] {
  const declarers = [...declarations];
  const held = new Set<string>();
  const unsatisfied: UnsatisfiedDeclaration[] = [];
  while (held.size < declarers.length) {
    const batch = declarers
      .filter(([declarer]) => !held.has(declarer))
      .map(([declarer, declared]) => ({
        declarer,
        entries: unsatisfiedEntries(declarer, declared, recorded, held),
      }))
      .filter((candidate) => candidate.entries.length > 0)
      .sort((left, right) => left.declarer.localeCompare(right.declarer));
    if (batch.length === 0) {
      break;
    }

    for (const candidate of batch) {
      held.add(candidate.declarer);
      unsatisfied.push(...candidate.entries);
    }
  }

  return unsatisfied;
}

/**
 * Decides which of the scope's recorded plugins the load-time check holds down,
 * and why.
 */
export async function buildScopeSatisfactionVerdict(
  options: ScopeSatisfactionOptions,
): Promise<ScopeSatisfactionVerdict> {
  const detail = await buildScopeDeclarationDetail(options);
  if (!detail.ok) {
    return detail;
  }

  return {
    ok: true,
    unsatisfied: propagateUnsatisfied(detail.declarations, recordedKeys(options.state)),
  };
}
