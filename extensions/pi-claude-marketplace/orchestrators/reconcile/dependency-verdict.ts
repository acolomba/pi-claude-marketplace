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
// LOAD-01's condition is three-way and every arm is decided here: the declared
// key has no record in the scope, its record is disabled, or its recorded
// version falls outside the declared range. The range arm composes
// `domain/dependency-range.ts` and adds no comparator of its own -- that module
// is the single evaluator in this tree, so the D-03-04 coercion of the PI-7
// `hash-` / `sha-` fallback version forms applies here unchanged.
//
// WR-07: the coercion costs more here than it does at install time. Install
// time spends it on a candidate the user is watching; this walk spends it on a
// dependent that is installed and working, and disables it on the next reload
// with a remedy naming a semver version the dependency does not have. The
// behaviour is kept -- the walk is not the place to special-case one version
// form the single evaluator accepts -- and `docs/dependency-resolution.md`
// describes the case under "The load-time check" so an operator who hits it
// can recognize it.
//
// D-05-07: the walk inherits the declaration read's fail-closed posture. A
// declarer whose manifest cannot be read ends the walk with the typed failure
// arm naming it, and is never read as a record that declares nothing -- which
// would silently leave a dependent enabled on incomplete information.

import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  recordedVersionSatisfies,
} from "../../domain/dependency-range.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
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

/**
 * The recorded facts a declared key is measured against: whether it is disabled
 * for a reason this check must take as given, and the version it records.
 */
interface RecordedPlugin {
  readonly disabled: boolean;
  readonly version: string;
}

/**
 * LOAD-02: whether a record is disabled by something OTHER than this check.
 *
 * A record carrying the check's own marker reads as enabled here, because this
 * same pass will lift it if its own declarations are satisfied. Without that
 * optimism a broken chain would go down in one pass and come back up one level
 * per reload, which is the asymmetry a user experiences as the plugin taking
 * three restarts to return. The optimism is never wrong for longer than the
 * walk: the fixpoint's held set re-holds the record on this same pass when its
 * own dependency is still unsatisfied, and its dependents then see it held.
 *
 * A record disabled WITHOUT the marker is the user's own decision, or a config
 * that declares it off. The check never second-guesses either, so its
 * dependents stay held.
 */
function isDisabledIndependently(record: {
  readonly enabled: boolean;
  readonly dependencyDisabled?: boolean;
}): boolean {
  return isRecordedButDisabled(record) && record.dependencyDisabled !== true;
}

/** Every `name@marketplace` key the scope records, with its recorded facts. */
function recordedPlugins(state: ExtensionState): ReadonlyMap<string, RecordedPlugin> {
  const recorded = new Map<string, RecordedPlugin>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      recorded.set(`${name}@${marketplace.name}`, {
        disabled: isDisabledIndependently(record),
        version: record.version,
      });
    }
  }

  return recorded;
}

/**
 * The version constraints one declarer names for each key it declares, in
 * first-declaration order.
 *
 * D-03-02.1: several elements may name the same dependency with different
 * constraints, and the satisfaction question is about their INTERSECTION -- so
 * the constraints are accumulated per key before anything is evaluated, exactly
 * as `resolveMemberConstraints` accumulates them for the install cascade. A
 * `sha` pin is not collected: it is an install-time selector, not a range the
 * recorded version can be measured against.
 */
function constraintsByKey(
  declared: readonly AddressedDependency[],
): ReadonlyMap<string, readonly string[]> {
  const byKey = new Map<string, string[]>();
  for (const dependency of declared) {
    const key = `${dependency.name}@${dependency.marketplace}`;
    const ranges = byKey.get(key) ?? [];
    if (dependency.version !== undefined) {
      ranges.push(dependency.version);
    }

    byKey.set(key, ranges);
  }

  return byKey;
}

/**
 * The effective range a recorded version fails, or `undefined` when it holds.
 *
 * A fold that produces no range -- declarations that contradict each other, or
 * a set that trips one of the two project-owned input caps -- is reported as
 * out-of-range against the conjunction of what was declared. It is never read
 * as "no constraint" (T-06-10): the caps exist to refuse work, and failing open
 * on one would silently satisfy every dependency an attacker can make expensive
 * to fold. The declared texts are joined rather than sliced, and the row bounds
 * the result through `renderConstraintRange`.
 *
 * The unconstrained short-circuit tests canonicalization rather than string
 * identity, so two authors independently spelling "any version" differently
 * still fold to no constraint instead of to a range to be evaluated.
 */
function unsatisfiedRange(ranges: readonly string[], version: string): string | undefined {
  const folded = intersectDependencyRanges(ranges);
  if (!folded.ok) {
    return ranges.join(" ");
  }

  if (isUnconstrainedRange(folded.range)) {
    return undefined;
  }

  return recordedVersionSatisfies(version, folded.range) ? undefined : folded.range;
}

/**
 * The declarations of one record that the scope does not satisfy, in
 * first-declaration order, one entry per declared key.
 *
 * A declared key with no record in the scope is `missing`. A declared key whose
 * record is disabled is `disabled` -- either because the record is stored that
 * way for a reason this check must take as given, or because this same pass has
 * already decided to hold it down (`isDisabledIndependently`). Both
 * facts are the same fact about the dependency and carry the same remedy, so
 * they share one arm; reporting them separately would emit two entries for one
 * dependency. `disabled` rather than `missing` because the record IS installed,
 * and an install remedy for a plugin that is already there would be false.
 *
 * A key that is recorded and enabled is measured against its declared range.
 */
function unsatisfiedEntries(
  dependent: string,
  declared: readonly AddressedDependency[],
  recorded: ReadonlyMap<string, RecordedPlugin>,
  held: ReadonlySet<string>,
): readonly UnsatisfiedDeclaration[] {
  const entries: UnsatisfiedDeclaration[] = [];
  for (const [key, ranges] of constraintsByKey(declared)) {
    const record = recorded.get(key);
    if (record === undefined) {
      entries.push({ dependent, dependency: key, kind: "missing" });
      continue;
    }

    if (held.has(key) || record.disabled) {
      entries.push({ dependent, dependency: key, kind: "disabled" });
      continue;
    }

    const range = unsatisfiedRange(ranges, record.version);
    if (range !== undefined) {
      entries.push({ dependent, dependency: key, kind: "out-of-range", range });
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
  recorded: ReadonlyMap<string, RecordedPlugin>,
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
    unsatisfied: propagateUnsatisfied(detail.declarations, recordedPlugins(options.state)),
  };
}
