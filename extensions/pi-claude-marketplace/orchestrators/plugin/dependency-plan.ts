// orchestrators/plugin/dependency-plan.ts
//
// UPD-DEP-D1: the write-free plan of an install or update whose closure moves
// recorded dependencies into range. Before anything is written, it judges the
// whole operation:
//
//   - each plugin the operation installs fresh, with the install's own
//     preflight (the installability gate, `--partial` consent, the PI-6 name
//     check);
//   - each move, with `update`'s preflight (the version it lands, which is
//     the preflight's chosen tag or the catalog version);
//   - each moved dependency's new closure, read from the version the move
//     lands, transitively: its new dependencies, the moves they need, and
//     their installability. A dependency is planned once, at the version its
//     first move lands; a later declaration judges that planned version.
//
// The first thing that cannot be done refuses the operation, and nothing has
// changed. The plan runs with no state lock held: the move preflight takes
// the lock itself for an unpinned git source, and the lock is not re-entrant.
//
// The walk, the install preview and the move verdict are ports the caller
// binds, so the plan is a pure worklist over them.

import { recordedVersionSatisfies } from "../../domain/dependency-range.ts";

import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type {
  InstallCascadeResult,
  OutOfRangeMember,
  ResolvedCascadeMember,
} from "./install-cascade.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";

/** What a write-free walk of a moved dependency's new closure can answer. */
export type DependencyPlanWalk = Extract<
  InstallCascadeResult,
  { readonly kind: "closure-failed" | "constraint-failed" | "planned" }
>;

/** A move's candidate: the plan reads only the version it lands. */
export interface PlannedCandidate {
  readonly toVersion: string;
}

/** One move's verdict, over the candidate type the ports carry. */
export type PlanJudgement<P extends PlannedCandidate> =
  { readonly ok: true; readonly prepared: P } | { readonly ok: false; readonly cause: string };

/**
 * The operations the plan composes. `P` is the move candidate the judge
 * answers and the walk reads (`update`'s prepared candidate in production).
 */
export interface DependencyPlanPorts<P extends PlannedCandidate = PreparedPluginUpdate> {
  /** `update`'s verdict on one move: the candidate it lands, or why it cannot move. */
  readonly judge: (member: OutOfRangeMember) => Promise<PlanJudgement<P>>;
  /**
   * Walks the closure of `prepared`, the version `member` moves to, with no
   * write, over the scope as the plan leaves it (`planned` maps each moved
   * dependency's key to the version it lands).
   */
  readonly walk: (
    member: OutOfRangeMember,
    prepared: P,
    planned: ReadonlyMap<string, string>,
  ) => Promise<DependencyPlanWalk>;
  /** Throws what installing `member` would throw, with no write. */
  readonly preview: (member: ResolvedCascadeMember) => Promise<void>;
}

/** Where the plan starts: the cascade's first, write-free resolution. */
export interface DependencyPlanStart {
  /** The plugin the operation installs or updates. */
  readonly rootKey: string;
  /** The plugins whose moves are in progress up the call chain; moving one again is refused. */
  readonly active: ReadonlySet<string>;
  readonly freshMembers: readonly ResolvedCascadeMember[];
  readonly outOfRange: readonly OutOfRangeMember[];
}

/** The plan holds, or the first thing that refuses it and the row subject naming it. */
export type DependencyPlan =
  { readonly ok: true } | { readonly ok: false; readonly subject: CascadeFailureSubject };

/** RESV-05's subject for a recorded dependency that cannot move into its range. */
function unmovable(member: OutOfRangeMember, cause: string): DependencyPlan {
  return {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: member.key,
        range: member.range,
        recordedVersion: member.recordedVersion,
        moveRefusal: cause,
      },
    },
  };
}

/** The first fresh member the install's own preflight refuses, if any. */
async function previewAll<P extends PlannedCandidate>(
  members: readonly ResolvedCascadeMember[],
  ports: DependencyPlanPorts<P>,
): Promise<DependencyPlan> {
  for (const member of members) {
    try {
      // eslint-disable-next-line no-await-in-loop -- the first refusal ends the plan
      await ports.preview(member);
    } catch (err) {
      return {
        ok: false,
        subject: { kind: "member", key: member.key, error: err as Error, rollbackPartials: [] },
      };
    }
  }

  return { ok: true };
}

/** A walk's refusal as the plan's, or its findings for the worklist. */
function walkFindings(
  walk: DependencyPlanWalk,
): DependencyPlan | Extract<DependencyPlanWalk, { readonly kind: "planned" }> {
  if (walk.kind === "closure-failed") {
    return { ok: false, subject: { kind: "closure", failure: walk.failure } };
  }

  if (walk.kind === "constraint-failed") {
    return { ok: false, subject: { kind: "constraint", failure: walk.failure } };
  }

  return walk;
}

/**
 * Plans one move: its verdict, then its new closure. Returns the refusal, or
 * the moves its closure adds.
 */
async function planMove<P extends PlannedCandidate>(
  member: OutOfRangeMember,
  start: DependencyPlanStart,
  ports: DependencyPlanPorts<P>,
  planned: Map<string, string>,
): Promise<DependencyPlan | readonly OutOfRangeMember[]> {
  if (start.active.has(member.key)) {
    return unmovable(member, "a move of it is already in progress");
  }

  const judged = await ports.judge(member);
  if (!judged.ok) {
    return unmovable(member, judged.cause);
  }

  planned.set(member.key, judged.prepared.toVersion);
  const found = walkFindings(await ports.walk(member, judged.prepared, planned));
  if ("ok" in found) {
    return found;
  }

  const previewed = await previewAll(found.freshMembers, ports);
  return previewed.ok ? found.outOfRange : previewed;
}

/**
 * A dependency already planned is judged by the version its first move lands:
 * in range it needs nothing more, out of range it refuses the plan.
 */
async function planOnce<P extends PlannedCandidate>(
  member: OutOfRangeMember,
  start: DependencyPlanStart,
  ports: DependencyPlanPorts<P>,
  planned: Map<string, string>,
): Promise<DependencyPlan | readonly OutOfRangeMember[]> {
  const version = planned.get(member.key);
  if (version === undefined) {
    return planMove(member, start, ports, planned);
  }

  return member.ranges.every((range) => recordedVersionSatisfies(version, range))
    ? []
    : unmovable(member, `version ${version}, which another move lands, does not satisfy it`);
}

/**
 * Judges the whole operation before any write. Each move is planned once, in
 * the order the walks reach it.
 */
export async function planDependencyMoves<P extends PlannedCandidate>(
  start: DependencyPlanStart,
  ports: DependencyPlanPorts<P>,
): Promise<DependencyPlan> {
  const previewed = await previewAll(start.freshMembers, ports);
  if (!previewed.ok) {
    return previewed;
  }

  const planned = new Map<string, string>();
  const queue = [...start.outOfRange];
  for (let member = queue.shift(); member !== undefined; member = queue.shift()) {
    // eslint-disable-next-line no-await-in-loop -- each move's closure names the moves the next ones cover
    const step = await planOnce(member, start, ports, planned);
    if ("ok" in step) {
      return step;
    }

    queue.push(...step);
  }

  return { ok: true };
}
