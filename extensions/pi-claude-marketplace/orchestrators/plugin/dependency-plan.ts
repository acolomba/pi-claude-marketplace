// orchestrators/plugin/dependency-plan.ts
//
// UPD-DEP-D1: the write-free plan of an install or update whose closure moves
// recorded dependencies into range. Before anything is written, it judges the
// whole operation:
//
//   - each plugin the operation installs fresh, with the install's own
//     preflight (the installability gate, `--partial` consent, the PI-6 name
//     check);
//   - each move, with `update`'s preflight, folding the ranges of every plugin
//     known to ask for the dependency (the version it lands is the
//     preflight's chosen tag or the catalog version);
//   - each moved dependency's new closure, read from the version the move
//     lands, transitively: its new dependencies, the moves they need, and
//     their installability.
//
// Each dependency is planned once. A range found after a dependency was
// judged must admit the version the plan chose, or the plan refuses. The
// chosen version is the highest the ranges known at judgement admit, so when
// it also satisfies the later ones it is the highest the whole graph admits.
//
// The plan answers the moves in the order they must run: a move whose new
// closure needs another dependency moved first comes after it, so each move
// settles its own new closure without moving anything (`dependency-move.ts`).
//
// The first thing that cannot be done refuses the operation, and nothing has
// changed. The plan runs with no state lock held: the move preflight takes
// the lock itself for an unpinned git source, and the lock is not re-entrant.
//
// The walk, the install preview and the move verdict are ports the caller
// binds, so the plan is a pure worklist over them.

import { recordedVersionSatisfies, renderDeclaredRanges } from "../../domain/dependency-range.ts";

import type { ConstraintRequester } from "./constraint-fold.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type {
  CascadePlan,
  CascadeResolutionFailure,
  OutOfRangeMember,
  RecordedCascadeMember,
  ResolvedCascadeMember,
} from "./install-cascade.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";

/** What a write-free walk of a moved dependency's new closure can answer. */
export type DependencyPlanWalk = CascadePlan | CascadeResolutionFailure;

/** One recorded dependency the plan moves, and every plugin known to ask for it. */
export interface DependencyMoveRequest {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly recordedVersion: string;
  /** Each plugin that asks for the dependency and its ranges, folded in place of its record. */
  readonly requesters: readonly ConstraintRequester[];
}

/** One move the plan holds, at the version the plan chose for it. */
export interface PlannedDependencyMove {
  readonly request: DependencyMoveRequest;
  readonly version: string;
}

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
  readonly judge: (request: DependencyMoveRequest) => Promise<PlanJudgement<P>>;
  /**
   * Walks the closure of `prepared`, the version `request` moves to, with no
   * write, over the scope as the plan leaves it (`planned` maps each moved
   * dependency's key to the version it lands).
   */
  readonly walk: (
    request: DependencyMoveRequest,
    prepared: P,
    planned: ReadonlyMap<string, string>,
  ) => Promise<DependencyPlanWalk>;
  /** Throws what installing `member` would throw, with no write. */
  readonly preview: (member: ResolvedCascadeMember) => Promise<void>;
}

/** Where the plan starts: the cascade's first, write-free resolution of the root. */
export interface DependencyPlanStart extends Pick<
  CascadePlan,
  "freshMembers" | "outOfRange" | "recordedMembers"
> {
  /** The plugin the operation installs or updates; it moves last, so a move of it is refused. */
  readonly rootKey: string;
}

/** The moves in the order they run, or the first thing that refuses the plan. */
export type DependencyPlan =
  | { readonly ok: true; readonly moves: readonly PlannedDependencyMove[] }
  | { readonly ok: false; readonly subject: CascadeFailureSubject };

/** A request as the plan builds it: one entry per requester. */
interface RequestDraft {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly recordedVersion: string;
  readonly requesters: Map<string, readonly string[]>;
}

/** A judged move, and the recorded members its new closure reached. */
interface PlanEntry {
  readonly draft: RequestDraft;
  readonly version: string;
  recorded: readonly RecordedCascadeMember[];
}

/** The plan's working state. */
interface PlanState {
  readonly drafts: Map<string, RequestDraft>;
  readonly queue: RequestDraft[];
  readonly entries: Map<string, PlanEntry>;
  readonly versions: Map<string, string>;
}

function requestOf(draft: RequestDraft): DependencyMoveRequest {
  return {
    key: draft.key,
    name: draft.name,
    marketplace: draft.marketplace,
    recordedVersion: draft.recordedVersion,
    requesters: [...draft.requesters].map(([key, ranges]) => ({ key, ranges })),
  };
}

/** RESV-05's subject for a recorded dependency that cannot move into its range. */
function unmovable(draft: RequestDraft, cause: string): DependencyPlan {
  return {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: draft.key,
        range: renderDeclaredRanges([...draft.requesters.values()].flat()),
        recordedVersion: draft.recordedVersion,
        moveRefusal: cause,
      },
    },
  };
}

/** Records that `member.requiredBy` asks for `member`, queueing a dependency seen first. */
function noteRequest(plan: PlanState, member: OutOfRangeMember): void {
  let draft = plan.drafts.get(member.key);
  if (draft === undefined) {
    draft = {
      key: member.key,
      name: member.name,
      marketplace: member.marketplace,
      recordedVersion: member.recordedVersion,
      requesters: new Map(),
    };
    plan.drafts.set(member.key, draft);
    plan.queue.push(draft);
  }

  draft.requesters.set(member.requiredBy, member.ranges);
}

/** The first fresh member the install's own preflight refuses, if any. */
async function previewAll<P extends PlannedCandidate>(
  members: readonly ResolvedCascadeMember[],
  ports: DependencyPlanPorts<P>,
): Promise<DependencyPlan | undefined> {
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

  return undefined;
}

/** A walk's refusal as the plan's, or its findings for the worklist. */
function walkFindings(walk: DependencyPlanWalk): DependencyPlan | CascadePlan {
  if (walk.kind === "closure-failed") {
    return { ok: false, subject: { kind: "closure", failure: walk.failure } };
  }

  if (walk.kind === "constraint-failed") {
    return { ok: false, subject: { kind: "constraint", failure: walk.failure } };
  }

  return walk;
}

/**
 * Plans one move: its verdict over every range known so far, then its new
 * closure. Returns the refusal, or `undefined` once the closure's moves are
 * queued.
 */
async function planMove<P extends PlannedCandidate>(
  plan: PlanState,
  draft: RequestDraft,
  start: DependencyPlanStart,
  ports: DependencyPlanPorts<P>,
): Promise<DependencyPlan | undefined> {
  if (draft.key === start.rootKey) {
    return unmovable(draft, "a move of it is already in progress");
  }

  const request = requestOf(draft);
  const judged = await ports.judge(request);
  if (!judged.ok) {
    return unmovable(draft, judged.cause);
  }

  const entry: PlanEntry = { draft, version: judged.prepared.toVersion, recorded: [] };
  plan.entries.set(draft.key, entry);
  plan.versions.set(draft.key, entry.version);
  const found = walkFindings(await ports.walk(request, judged.prepared, plan.versions));
  if ("ok" in found) {
    return found;
  }

  entry.recorded = found.recordedMembers;
  for (const member of found.outOfRange) {
    noteRequest(plan, member);
  }

  return previewAll(found.freshMembers, ports);
}

function satisfiesAll(version: string, ranges: readonly string[]): boolean {
  return ranges.every((range) => recordedVersionSatisfies(version, range));
}

/**
 * The first range of the final graph that rejects the version the plan chose
 * for a move, or `undefined`. The rejecting plugin joins the request, so the
 * row names its range.
 */
function rejectedVersion(
  plan: PlanState,
  walks: readonly (readonly [string, readonly RecordedCascadeMember[]])[],
): DependencyPlan | undefined {
  for (const [owner, recorded] of walks) {
    for (const member of recorded) {
      const entry = plan.entries.get(member.key);
      if (entry !== undefined && !satisfiesAll(entry.version, member.ranges)) {
        entry.draft.requesters.set(owner, member.ranges);
        return unmovable(
          entry.draft,
          `version ${entry.version}, which another move lands, does not satisfy it`,
        );
      }
    }
  }

  return undefined;
}

/**
 * Orders the moves dependencies first: a move whose new closure asks for a
 * dependency the plan moves, at a range its recorded version fails, runs
 * after that dependency's move. Two moves that each need the other first
 * refuse the plan.
 */
function orderMoves(plan: PlanState): DependencyPlan {
  const order: PlannedDependencyMove[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (entry: PlanEntry): DependencyPlan | undefined => {
    if (done.has(entry.draft.key)) {
      return undefined;
    }

    visiting.add(entry.draft.key);
    for (const member of entry.recorded) {
      const first = plan.entries.get(member.key);
      if (first === undefined || satisfiesAll(first.draft.recordedVersion, member.ranges)) {
        continue;
      }

      if (visiting.has(member.key)) {
        return unmovable(
          first.draft,
          `it and "${entry.draft.key}" each need the other moved first`,
        );
      }

      const refused = visit(first);
      if (refused !== undefined) {
        return refused;
      }
    }

    visiting.delete(entry.draft.key);
    done.add(entry.draft.key);
    order.push({ request: requestOf(entry.draft), version: entry.version });
    return undefined;
  };

  for (const entry of plan.entries.values()) {
    const refused = visit(entry);
    if (refused !== undefined) {
      return refused;
    }
  }

  return { ok: true, moves: order };
}

/**
 * Judges the whole operation before any write. Each move is planned once, in
 * the order the walks reach it; the answer lists the moves in the order they
 * run.
 */
export async function planDependencyMoves<P extends PlannedCandidate>(
  start: DependencyPlanStart,
  ports: DependencyPlanPorts<P>,
): Promise<DependencyPlan> {
  const previewed = await previewAll(start.freshMembers, ports);
  if (previewed !== undefined) {
    return previewed;
  }

  const plan: PlanState = { drafts: new Map(), queue: [], entries: new Map(), versions: new Map() };
  for (const member of start.outOfRange) {
    noteRequest(plan, member);
  }

  for (let draft = plan.queue.shift(); draft !== undefined; draft = plan.queue.shift()) {
    // eslint-disable-next-line no-await-in-loop -- each move's closure names the moves the next ones cover
    const refused = await planMove(plan, draft, start, ports);
    if (refused !== undefined) {
      return refused;
    }
  }

  const walks = [
    [start.rootKey, start.recordedMembers] as const,
    ...[...plan.entries.values()].map((entry) => [entry.draft.key, entry.recorded] as const),
  ];
  return rejectedVersion(plan, walks) ?? orderMoves(plan);
}
