// orchestrators/reconcile/dependency-verdict.ts
//
// LOAD-01: which recorded plugin in ONE scope has a declaration the scope does
// not satisfy, computed offline as pure data before anything is planned.
//
// D-06-04: it lands outside `plan.ts` because the planner is grep-gated pure
// and this walk does filesystem reads. The planner consumes the verdict as an
// already-computed argument, the same way it consumes the marketplace diff.
//
// It takes NO lock. The reconcile read pass calls it inside its existing
// `withLockedStateTransaction` closure over the same snapshot, and
// `proper-lockfile` is configured with no retries and is not re-entrant, so a
// second guard here would self-deadlock into a lock-held row. `pending` calls
// it on its own unlocked, read-only snapshot (D-21).
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
// `hash-` and git commit fallback version forms applies here unchanged.
//
// WR-07: the coercion costs more here than it does at install time. Install
// time spends it on a candidate the user is watching; this walk spends it on a
// dependent that is installed and working. The load only reports it and
// changes nothing (APL-D1); `apply` disables the dependent, with a remedy
// naming a semver version the dependency does not have. The behaviour is
// kept -- the walk is not the place to special-case one version form the
// single evaluator accepts -- and `docs/dependency-resolution.md` describes
// the case under "The load-time check" so an operator who hits it can
// recognize it.
//
// D-05-07: the walk inherits the declaration read's fail-closed posture. A
// declarer whose manifest cannot be read ends the walk with the typed failure
// arm naming it, and is never read as a record that declares nothing -- which
// would silently leave a dependent enabled on incomplete information.

import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  recordedVersionSatisfies,
  renderDeclaredRanges,
} from "../../domain/dependency-range.ts";
import {
  atCatalogVersion,
  isRecordedButDisabled,
  rangeVersionOf,
} from "../../persistence/state-io.ts";
import { ownValue } from "../../shared/own-key.ts";
import { buildScopeDeclarationDetail, readRecordDeclarations } from "../plugin/dependency-index.ts";

import type { loadMarketplaceManifest } from "../../domain/manifest.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { DependencyDeclarationReader } from "../plugin/dependency-declaration-read.ts";
import type {
  AddressedDependency,
  DeclarerReadFailure,
  RecordDeclarations,
} from "../plugin/dependency-index.ts";

/** Inputs of one scope-wide satisfaction verdict. */
export interface ScopeSatisfactionOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
  /**
   * APPLY1-01: declarations already known to be unsatisfied, whose dependents
   * start the walk held, so their own dependents are held too.
   */
  readonly seeded?: readonly UnsatisfiedDeclaration[];
  /**
   * D-21 / MISS-01 / D-PL2-02: plugins the same `apply` installs, which a
   * declaration naming them counts as met.
   */
  readonly scheduled?: ReadonlySet<string>;
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
  /**
   * The declared ranges, joined with `, ` and bounded once for the cause line
   * (INR-05), present only on the out-of-range kind.
   */
  readonly range?: string;
  /**
   * Raw per-declarer range texts of the missing kind, so the reconcile
   * planner can hand every declarer's constraint to the install cascade
   * unfolded (D-09-05). Absent when the declaration named no constraint.
   */
  readonly ranges?: readonly string[];
}

/**
 * Every unsatisfied declaration in the scope, or the first declarer whose
 * declarations could not be established. The failure arm is the declaration
 * walk's own, forwarded unchanged, so the message it carries reaches the row
 * exactly as the walk built it.
 */
export type ScopeSatisfactionVerdict =
  | { readonly ok: true; readonly unsatisfied: readonly UnsatisfiedDeclaration[] }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly reason: DeclarerReadFailure;
      readonly cause: Error;
    };

/**
 * The recorded facts a declared key is measured against: whether it is disabled
 * for a reason this check must take as given, and the version it records.
 */
interface RecordedPlugin {
  readonly disabled: boolean;
  /** The version a declared range reads: the release tag's semver, if any (GV-01). */
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
        version: rangeVersionOf(record),
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
 * The declared ranges a recorded version fails, rendered for the cause line,
 * or `undefined` when it holds.
 *
 * The fold decides: a recorded version that satisfies the intersection holds.
 * A fold that produces no range -- declarations that contradict each other, or
 * a set that trips one of the two project-owned input caps -- is reported as
 * out-of-range. It is never read as "no constraint" (T-06-10): the caps exist
 * to refuse work, and failing open on one would silently satisfy every
 * dependency an attacker can make expensive to fold. Either way the reported
 * text is the declared ranges, joined with `, ` as Claude Code joins them and
 * bounded once (INR-05), never the fold.
 *
 * The unconstrained short-circuit tests canonicalization rather than string
 * identity, so two authors independently spelling "any version" differently
 * still fold to no constraint instead of to a range to be evaluated.
 */
function unsatisfiedRange(ranges: readonly string[], version: string): string | undefined {
  const folded = intersectDependencyRanges(ranges);
  if (!folded.ok) {
    return renderDeclaredRanges(ranges);
  }

  if (isUnconstrainedRange(folded.range)) {
    return undefined;
  }

  return recordedVersionSatisfies(version, folded.range) ? undefined : renderDeclaredRanges(ranges);
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
  scheduled: ReadonlySet<string> = new Set(),
): readonly UnsatisfiedDeclaration[] {
  const entries: UnsatisfiedDeclaration[] = [];
  for (const [key, ranges] of constraintsByKey(declared)) {
    const record = recorded.get(key);
    if (record === undefined && scheduled.has(key)) {
      continue;
    }

    if (record === undefined) {
      entries.push({
        dependent,
        dependency: key,
        kind: "missing",
        ...(ranges.length > 0 && { ranges }),
      });
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
  seeded: readonly UnsatisfiedDeclaration[],
  scheduled?: ReadonlySet<string>,
): readonly UnsatisfiedDeclaration[] {
  const declarers = [...declarations];
  const held = new Set(seeded.map((entry) => entry.dependent));
  const unsatisfied: UnsatisfiedDeclaration[] = [...seeded];
  while (held.size < declarers.length) {
    const batch = declarers
      .filter(([declarer]) => !held.has(declarer))
      .map(([declarer, declared]) => ({
        declarer,
        entries: unsatisfiedEntries(declarer, declared, recorded, held, scheduled),
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
    unsatisfied: propagateUnsatisfied(
      detail.declarations,
      recordedPlugins(options.state),
      options.seeded ?? [],
      options.scheduled,
    ),
  };
}

/** A record a plan enables or disables. */
export interface ToggledRecord {
  readonly marketplace: string;
  readonly plugin: string;
}

/** The records a plan enables and disables. */
export interface PlannedToggles {
  readonly enable: readonly ToggledRecord[];
  readonly disable: readonly ToggledRecord[];
}

/** One record of a scope's state document. */
export type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/** `state` with each record replaced by what `map` answers for its `plugin@marketplace` key. */
export function mapRecords(
  state: ExtensionState,
  map: (key: string, record: PluginRecord) => PluginRecord,
): ExtensionState {
  const marketplaces = Object.fromEntries(
    Object.entries(state.marketplaces).map(([name, mp]) => [
      name,
      {
        ...mp,
        plugins: Object.fromEntries(
          Object.entries(mp.plugins).map(([plugin, record]) => [
            plugin,
            map(`${plugin}@${name}`, record),
          ]),
        ),
      },
    ]),
  );
  return { ...state, marketplaces };
}

/** The scope with every planned toggle applied to its record. */
function stateAfterToggles(state: ExtensionState, toggles: PlannedToggles): ExtensionState {
  const keyOf = (op: ToggledRecord): string => `${op.plugin}@${op.marketplace}`;
  const enabled = new Set(toggles.enable.map(keyOf));
  const disabled = new Set(toggles.disable.map(keyOf));
  return mapRecords(state, (key, record) => {
    if (disabled.has(key)) {
      return { ...record, enabled: false, dependencyDisabled: false };
    }

    return enabled.has(key) ? { ...record, enabled: true } : record;
  });
}

/**
 * D-08 / D-21: the verdict once the plan's own enables and disables have run.
 * A record the config disables is a disabled dependency of every record that
 * declares it, and a record the config enables satisfies them again. So
 * `apply` holds those dependents down, or lifts them, in the same pass, and
 * `pending` lists that change. The disable is the user's own choice, so it
 * carries no marker (LOAD-02). Answers `verdict` itself when the plan toggles
 * nothing or the first walk failed (D-05-07).
 */
export async function verdictAfterToggles(
  options: ScopeSatisfactionOptions,
  verdict: ScopeSatisfactionVerdict,
  toggles: PlannedToggles,
): Promise<ScopeSatisfactionVerdict> {
  if (!verdict.ok || toggles.enable.length + toggles.disable.length === 0) {
    return verdict;
  }

  return buildScopeSatisfactionVerdict({
    ...options,
    state: stateAfterToggles(options.state, toggles),
  });
}

/** The dependents a verdict holds down; every one when the walk failed is the caller's call. */
function heldDependents(verdict: ScopeSatisfactionVerdict & { readonly ok: true }): Set<string> {
  return new Set(verdict.unsatisfied.map((entry) => entry.dependent));
}

/**
 * APPLY1-01: the held dependents a catalog move could satisfy. Each of their
 * unsatisfied declarations names a recorded dependency that is out of range,
 * or one this same verdict holds down. A dependency that is missing, or that
 * the user or a config disabled, no move can bring back, so its dependents
 * stay held. An empty set when the walk failed.
 *
 * D-PL2-02: a missing dependency in `scheduled` is one the same `apply`
 * installs, so it does not keep its dependent held.
 */
export function releasableDependents(
  verdict: ScopeSatisfactionVerdict,
  state: ExtensionState,
  scheduled: ReadonlySet<string> = new Set(),
): ReadonlySet<string> {
  if (!verdict.ok) {
    return new Set();
  }

  const held = heldDependents(verdict);
  const recorded = recordedPlugins(state);
  const blocking = new Set(
    verdict.unsatisfied
      .filter(
        (entry) =>
          (entry.kind === "missing" && !scheduled.has(entry.dependency)) ||
          (entry.kind === "disabled" &&
            (!held.has(entry.dependency) || recorded.get(entry.dependency)?.disabled === true)),
      )
      .map((entry) => entry.dependent),
  );
  return new Set([...held].filter((dependent) => !blocking.has(dependent)));
}

/**
 * APPLY1-01: `verdict` with the dependents in `released` no longer held, so a
 * declaration naming one of them as a held dependency is satisfied too.
 *
 * D-PL2-02: a released dependent keeps each `missing` entry whose dependency
 * is in `scheduled`, because the planner derives the missing-dependency
 * install from that entry. The planned install then releases the dependent
 * again when the plan counts it as landed.
 */
export function verdictWithout(
  verdict: ScopeSatisfactionVerdict,
  released: ReadonlySet<string>,
  scheduled: ReadonlySet<string> = new Set(),
): ScopeSatisfactionVerdict {
  if (!verdict.ok) {
    return verdict;
  }

  return {
    ok: true,
    unsatisfied: verdict.unsatisfied.filter((entry) =>
      released.has(entry.dependent)
        ? entry.kind === "missing" && scheduled.has(entry.dependency)
        : !(entry.kind === "disabled" && released.has(entry.dependency)),
    ),
  };
}

/** A catalog move as the verdict needs it: the record and the version it lands on. */
export interface LandedMove {
  readonly marketplace: string;
  readonly plugin: string;
  readonly toVersion: string;
}

/**
 * APPLY1-01: the verdict once the plan's toggles have run and `moves` have
 * landed, the way an install cascade judges a dependent against the closure
 * it installs. Each moved record carries its new version; the walk already
 * reads every record's catalog declarations (D-05-06).
 */
export async function verdictAfterMoves(
  options: ScopeSatisfactionOptions,
  toggles: PlannedToggles,
  moves: readonly LandedMove[],
): Promise<ScopeSatisfactionVerdict> {
  const toggled = stateAfterToggles(options.state, toggles);
  const marketplaces = { ...toggled.marketplaces };
  for (const move of moves) {
    const mp = ownValue(marketplaces, move.marketplace);
    const record = ownValue(mp?.plugins, move.plugin);
    if (mp !== undefined && record !== undefined) {
      marketplaces[move.marketplace] = {
        ...mp,
        plugins: { ...mp.plugins, [move.plugin]: atCatalogVersion(record, move.toVersion) },
      };
    }
  }

  return buildScopeSatisfactionVerdict({ ...options, state: { ...toggled, marketplaces } });
}

/**
 * The held dependents of `verdict` that `released` names, or all of
 * `released` when the walk failed.
 */
export function stillHeld(
  verdict: ScopeSatisfactionVerdict,
  released: ReadonlySet<string>,
): ReadonlySet<string> {
  if (!verdict.ok) {
    return released;
  }

  const held = heldDependents(verdict);
  return new Set([...released].filter((dependent) => held.has(dependent)));
}

/**
 * What the record `plugin`'s installed copy adds to its declarations: none when
 * its copy is the catalog's or holds no manifest, or the failure arm that
 * names it when the copy cannot be used (D-PL2-25).
 */
export type InstalledDeclarationsReader = (
  marketplace: ExtensionState["marketplaces"][string],
  plugin: string,
  record: ExtensionState["marketplaces"][string]["plugins"][string],
) => Promise<RecordDeclarations>;

/** Inputs of the judgement `apply` makes once its cascade has run. */
export interface FinalScopeOptions extends ScopeSatisfactionOptions {
  readonly installedDeclarations: InstalledDeclarationsReader;
}

/**
 * APPLY1-01: the scope as `apply` leaves it, judged strictly, to a fixed
 * point. Every enabled record is measured by its catalog declarations and its
 * installed copy's together (D-12a), against each dependency's recorded
 * version and enabled state. Unlike the load-time verdict, a record held down
 * by the marker is disabled here (no LOAD-02 optimism): the pass runs after
 * every lift `apply` makes. A record that cannot be read ends the judgement
 * with the walk's failure arm, as the load-time check does (D-05-07), and so
 * does a record whose installed copy cannot be used (D-PL2-25).
 */
export async function judgeFinalScope(
  options: FinalScopeOptions,
): Promise<ScopeSatisfactionVerdict> {
  const declarations = new Map<string, readonly AddressedDependency[]>();
  const recorded = new Map<string, RecordedPlugin>();
  for (const marketplace of Object.values(options.state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      const key = `${name}@${marketplace.name}`;
      recorded.set(key, {
        disabled: isRecordedButDisabled(record),
        version: rangeVersionOf(record),
      });
      if (isRecordedButDisabled(record)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- the first unreadable record ends the judgement
      const read = await readRecordDeclarations(options, marketplace, name);
      // D-PL2-05: the whole scope fails closed on the first unreadable record
      // (D-05-07), as Claude Code's removal guards abort for the whole scope.
      if (!read.ok) {
        return read;
      }

      // eslint-disable-next-line no-await-in-loop -- one installed-copy read per enabled record
      const installed = await options.installedDeclarations(marketplace, name, record);
      if (!installed.ok) {
        return installed;
      }

      declarations.set(key, [...read.declared, ...installed.declared]);
    }
  }

  return {
    ok: true,
    unsatisfied: propagateUnsatisfied(
      declarations,
      recorded,
      options.seeded ?? [],
      options.scheduled,
    ),
  };
}
