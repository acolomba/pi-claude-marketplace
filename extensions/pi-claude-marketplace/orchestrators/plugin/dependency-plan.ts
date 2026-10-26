// orchestrators/plugin/dependency-plan.ts
//
// UPD-DEP-D1: the one write-free plan of an install or update whose
// dependency graph moves recorded dependencies. One resolver covers the whole
// graph: the plugin being installed or updated, every dependency it would
// install fresh, and every recorded dependency that may move.
//
// The plan walks the graph, then chooses a version for each recorded plugin
// in it: the recorded version when every range the graph declares for it
// admits that version, else the version `update` lands for the combined
// range (the highest release tag inside it, else the catalog version). A
// fresh plugin's pin comes from the same walk, over every range the graph
// declares for it. A version chosen for a moved plugin changes what that
// plugin declares, so the plan walks the graph again with every moved plugin
// read from the version it moves to, and chooses again. It stops when no
// choice changes.
//
// A moved plugin's version is a tentative pick. When a conflict involves the
// declarations of a tentative pick (a walk that fails, or a plugin no
// version satisfies), the plan rules that version out for that plugin and
// judges it again, highest first, then walks on. It refuses only when no
// pick the conflict involves has a version left, or when the choices repeat
// a state they were in before. Every pick and every ruled-out version comes
// from a finite catalog, so the search ends. Then each fresh plugin is
// previewed with the install's own preflight.
//
// The answer is the steps that carry the plan out, in dependency order: each
// move at exactly the version the plan chose, the fresh installs and
// re-enables a move needs before it, and the closure the plugin being
// installed lands with. The steps settle and walk nothing.
//
// The plan runs with no state lock held: the move preflight takes the lock
// itself for an unpinned git source, and the lock is not re-entrant. The
// walk, the move verdict and the install preview are ports the caller binds,
// so the plan is pure over them.

import { recordedVersionSatisfies, renderDeclaredRanges } from "../../domain/dependency-range.ts";

import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type {
  CascadeResolutionFailure,
  DependencyGraph,
  DependencyGraphNode,
  GraphRequester,
  GraphWalkFailure,
  PlannedCascadeMember,
  PlannedClosure,
  RecordedGraphNode,
  ResolvedCascadeMember,
} from "./install-cascade.ts";
import type { PreparedPluginUpdate } from "./update-preflight.ts";

/** One recorded dependency the plan moves, and every plugin of the graph that asks for it. */
export interface DependencyMoveRequest {
  readonly key: string;
  readonly name: string;
  readonly marketplace: string;
  readonly recordedVersion: string;
  /** Each plugin that asks for the dependency and its ranges, folded in place of its record. */
  readonly requesters: readonly GraphRequester[];
  /**
   * WR-1: the versions the plan ruled out for this dependency, because a
   * conflict involved what they declare. The move takes the highest version
   * left.
   */
  readonly excludedVersions?: readonly string[];
}

/** One move the plan holds, at the version the plan chose for it. */
export interface PlannedDependencyMove {
  readonly request: DependencyMoveRequest;
  readonly version: string;
}

/**
 * A move's candidate: the plan reads only the version it lands, and the
 * release tag's semver a range reads in its place (GV-01).
 */
export interface PlannedCandidate {
  readonly toVersion: string;
  readonly resolvedVersion?: string;
}

/** GV-01: the version a range reads for a candidate. */
export function plannedRangeVersion(candidate: PlannedCandidate): string {
  return candidate.resolvedVersion ?? candidate.toVersion;
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
   * Walks the whole graph with no write, reading each key of `moving` from
   * the candidate its move lands. A failure names the plugins whose
   * declarations it involves.
   */
  readonly walk: (moving: ReadonlyMap<string, P>) => Promise<DependencyGraph | GraphWalkFailure>;
  /** Throws what installing `member` would throw, with no write. */
  readonly preview: (member: ResolvedCascadeMember) => Promise<void>;
}

/** What the plan carries out: materialize a closure slice, or make one move. */
export type DependencyPlanStep =
  | { readonly kind: "materialize"; readonly members: readonly PlannedCascadeMember[] }
  | { readonly kind: "move"; readonly move: PlannedDependencyMove };

/**
 * The steps in the order they run, then `final`: the closure that lands last,
 * with the plugin being installed (an update's root lands through its own
 * swap). Or the first thing that refuses the plan.
 */
export type DependencyPlan =
  | {
      readonly ok: true;
      readonly steps: readonly DependencyPlanStep[];
      readonly final: PlannedClosure;
    }
  | { readonly ok: false; readonly subject: CascadeFailureSubject };

/** How the caller carries the plan out. */
export interface DependencyPlanOptions {
  /**
   * MISS-01: a later step of the caller installs what a moved dependency's
   * new version needs, so the steps install only what the plugin being
   * installed reaches without passing a move. Only `apply` sets it.
   */
  readonly deferMoveDependencies: boolean;
}

/** A move the plan chose: the request it judged and the candidate it lands. */
interface Choice<P extends PlannedCandidate> {
  readonly request: DependencyMoveRequest;
  readonly prepared: P;
}

type Refusal = Extract<DependencyPlan, { readonly ok: false }>;

/** RESV-05's subject for a recorded dependency that cannot move into its range. */
function unmovable(request: DependencyMoveRequest, cause: string): Refusal {
  return {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: request.key,
        range: renderRequestedRanges(request.requesters),
        recordedVersion: request.recordedVersion,
        moveRefusal: cause,
      },
    },
  };
}

/** IN-N2: every distinct range the requesters declare, as a row renders them. */
export function renderRequestedRanges(requesters: readonly GraphRequester[]): string {
  return renderDeclaredRanges([...new Set(requesters.flatMap((requester) => requester.ranges))]);
}

function walkRefusal(failure: CascadeResolutionFailure): Refusal {
  return failure.kind === "closure-failed"
    ? { ok: false, subject: { kind: "closure", failure: failure.failure } }
    : { ok: false, subject: { kind: "constraint", failure: failure.failure } };
}

function satisfiesAll(version: string, ranges: readonly string[]): boolean {
  return ranges.every((range) => recordedVersionSatisfies(version, range));
}

/** The move request of a recorded node the graph's ranges reject, or `undefined`. */
function outOfRangeRequest(
  node: RecordedGraphNode,
  excluded: readonly string[],
): DependencyMoveRequest | undefined {
  const ranges = node.requesters.flatMap((requester) => requester.ranges);
  if (node.version === undefined || satisfiesAll(node.resolvedVersion ?? node.version, ranges)) {
    return undefined;
  }

  return {
    key: node.member.key,
    name: node.member.name,
    marketplace: node.member.marketplace,
    recordedVersion: node.version,
    requesters: node.requesters,
    ...(excluded.length > 0 && { excludedVersions: excluded }),
  };
}

/**
 * What one plan search remembers across rounds: each verdict by the request
 * it judged, the versions ruled out for each dependency, and the conflict
 * that ruled out the last of them.
 */
interface PlanSearch<P extends PlannedCandidate> {
  readonly ports: DependencyPlanPorts<P>;
  readonly verdicts: Map<string, Promise<PlanJudgement<P>>>;
  readonly excluded: Map<string, readonly string[]>;
  readonly ruledOutBy: Map<string, Refusal>;
}

/** Each request is judged once. */
function judge<P extends PlannedCandidate>(
  search: PlanSearch<P>,
  request: DependencyMoveRequest,
): Promise<PlanJudgement<P>> {
  const signature = JSON.stringify([
    request.key,
    request.requesters,
    request.excludedVersions ?? [],
  ]);
  const verdict = search.verdicts.get(signature) ?? search.ports.judge(request);
  search.verdicts.set(signature, verdict);
  return verdict;
}

/** A conflict, and the plugins whose declarations it involves. */
interface Conflict {
  readonly refusal: Refusal;
  readonly involved: readonly string[];
}

/**
 * Chooses the version of every recorded plugin of one walk: kept when every
 * range admits it, else the move `update` would make for the combined range.
 * A dependency that cannot move is a conflict among the plugins that ask for
 * it; when a conflict already ruled out its versions, that conflict is the
 * refusal.
 */
async function chooseMoves<P extends PlannedCandidate>(
  graph: DependencyGraph,
  search: PlanSearch<P>,
): Promise<Map<string, Choice<P>> | Conflict> {
  const choices = new Map<string, Choice<P>>();
  for (const node of graph.nodes) {
    const request =
      node.kind === "recorded"
        ? outOfRangeRequest(node, search.excluded.get(node.member.key) ?? [])
        : undefined;
    if (request === undefined) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- the first plugin that cannot move ends the round
    const judged = await judge(search, request);
    if (!judged.ok) {
      return {
        refusal: search.ruledOutBy.get(request.key) ?? unmovable(request, judged.cause),
        involved: request.requesters.map((requester) => requester.key),
      };
    }

    choices.set(request.key, { request, prepared: judged.prepared });
  }

  return choices;
}

/** A round that changed a choice, so the plan walks again. */
interface Again<P extends PlannedCandidate> {
  readonly ok: "again";
  readonly moving: Map<string, Choice<P>>;
  readonly changed: Choice<P>;
}

/**
 * WR-1: rules out the version of the first tentative pick the conflict
 * involves that still has a version left, and takes that version instead.
 * The conflict refuses the plan only when no involved pick has one.
 */
async function ruleOut<P extends PlannedCandidate>(
  search: PlanSearch<P>,
  moving: ReadonlyMap<string, Choice<P>>,
  conflict: Conflict,
): Promise<Again<P> | Refusal> {
  for (const [key, choice] of moving) {
    if (!conflict.involved.includes(key)) {
      continue;
    }

    const excludedVersions = [
      ...(search.excluded.get(key) ?? []),
      plannedRangeVersion(choice.prepared),
    ];
    const request = { ...choice.request, excludedVersions };
    // eslint-disable-next-line no-await-in-loop -- picks are tried one at a time, in walk order
    const judged = await judge(search, request);
    if (judged.ok) {
      search.excluded.set(key, excludedVersions);
      search.ruledOutBy.set(key, conflict.refusal);
      const changed = { request, prepared: judged.prepared };
      return { ok: "again", moving: new Map(moving).set(key, changed), changed };
    }
  }

  return conflict.refusal;
}

/**
 * The first choice that differs between two rounds: one `after` made anew,
 * or one `before` made that `after` dropped. `undefined` when they agree.
 */
function changedChoice<P extends PlannedCandidate>(
  before: ReadonlyMap<string, Choice<P>>,
  after: ReadonlyMap<string, Choice<P>>,
): Choice<P> | undefined {
  for (const [key, choice] of after) {
    if (before.get(key)?.prepared.toVersion !== choice.prepared.toVersion) {
      return choice;
    }
  }

  return [...before].find(([key]) => !after.has(key))?.[1];
}

function byKey(left: readonly [string, unknown], right: readonly [string, unknown]): number {
  return left[0].localeCompare(right[0]);
}

/** One round's choices with every ruled-out version, so a repeated state shows. */
function stateOf<P extends PlannedCandidate>(
  search: PlanSearch<P>,
  moving: ReadonlyMap<string, Choice<P>>,
): string {
  return JSON.stringify([
    [...moving].map(([key, choice]) => [key, choice.prepared.toVersion] as const).sort(byKey),
    [...search.excluded].sort(byKey),
  ]);
}

interface Settled<P extends PlannedCandidate> {
  readonly ok: true;
  readonly graph: DependencyGraph;
  readonly moves: Map<string, Choice<P>>;
}

/** One round: the settled graph, the next round's choices, or the refusal. */
async function round<P extends PlannedCandidate>(
  search: PlanSearch<P>,
  moving: ReadonlyMap<string, Choice<P>>,
): Promise<Settled<P> | Again<P> | Refusal> {
  const graph = await search.ports.walk(
    new Map([...moving].map(([key, choice]) => [key, choice.prepared])),
  );
  if (graph.kind !== "graph") {
    return ruleOut(search, moving, { refusal: walkRefusal(graph), involved: graph.declarers });
  }

  const chosen = await chooseMoves(graph, search);
  if (!(chosen instanceof Map)) {
    return ruleOut(search, moving, chosen);
  }

  const changed = changedChoice(moving, chosen);
  return changed === undefined
    ? { ok: true, graph, moves: chosen }
    : { ok: "again", moving: chosen, changed };
}

/**
 * The graph the choices settle on, with the choices, or the refusal. WR-4:
 * a chain of any depth settles; only choices that come back to a state
 * they were in before refuse, since they would repeat forever.
 */
async function settleChoices<P extends PlannedCandidate>(
  ports: DependencyPlanPorts<P>,
): Promise<Settled<P> | Refusal> {
  const search: PlanSearch<P> = {
    ports,
    verdicts: new Map(),
    excluded: new Map(),
    ruledOutBy: new Map(),
  };
  let moving = new Map<string, Choice<P>>();
  const seen = new Set([stateOf(search, moving)]);
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- each walk reads the choices the last one settled
    const next = await round(search, moving);
    if (next.ok !== "again") {
      return next;
    }

    const state = stateOf(search, next.moving);
    if (seen.has(state)) {
      return unmovable(
        next.changed.request,
        "its version does not settle: each version chosen for it changes what the other dependencies need",
      );
    }

    seen.add(state);
    moving = next.moving;
  }
}

/** The first fresh plugin the install's own preflight refuses, if any. */
async function previewFresh<P extends PlannedCandidate>(
  graph: DependencyGraph,
  ports: DependencyPlanPorts<P>,
): Promise<Refusal | undefined> {
  for (const node of graph.nodes) {
    if (node.kind !== "fresh") {
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop -- the first refusal ends the plan
      await ports.preview(node.member);
    } catch (err) {
      return {
        ok: false,
        subject: {
          kind: "member",
          key: node.member.key,
          error: err as Error,
          rollbackPartials: [],
        },
      };
    }
  }

  return undefined;
}

/** What a node materializes in a cascade, when it materializes anything. */
function materialized(node: DependencyGraphNode): PlannedCascadeMember | undefined {
  if (node.kind === "fresh") {
    return { kind: "install", member: node.member };
  }

  return node.walked && node.disabled ? { kind: "re-enable", member: node.member } : undefined;
}

/**
 * Every key `from` reaches through the graph's `dependsOn` edges. A key in
 * `stops` is reached but not walked past.
 */
function reachable(
  graph: DependencyGraph,
  from: readonly string[],
  stops: ReadonlySet<string>,
): ReadonlySet<string> {
  const seen = new Set(from);
  for (let grew = true; grew;) {
    grew = false;
    for (const node of graph.nodes) {
      const key = node.member.key;
      if (!seen.has(key) || stops.has(key)) {
        continue;
      }

      for (const next of node.dependsOn.filter((dependency) => !seen.has(dependency))) {
        seen.add(next);
        grew = true;
      }
    }
  }

  return seen;
}

/**
 * Orders the plan into steps. Each move runs after the fresh installs and
 * re-enables its new version needs, which land in one cascade just before it.
 * A disabled plugin that moves refreshes its pin in its move and re-enables
 * after it, at the new version. Everything else lands in `final`, with the
 * plugin being installed. Under `deferMoveDependencies`, a move's needs are
 * left to the caller's later step, and `final` holds only what the root
 * reaches without passing a move.
 */
function schedule<P extends PlannedCandidate>(
  graph: DependencyGraph,
  moves: ReadonlyMap<string, Choice<P>>,
  options: DependencyPlanOptions,
): Extract<DependencyPlan, { readonly ok: true }> {
  const moved = new Set(moves.keys());
  const pending = graph.nodes.flatMap((node) => {
    const member = materialized(node);
    return member === undefined ? [] : [member];
  });
  const done = new Set<string>();
  const take = (keys: ReadonlySet<string>): PlannedCascadeMember[] => {
    const taken = pending.filter(
      (entry) => keys.has(entry.member.key) && !done.has(entry.member.key),
    );
    for (const entry of taken) {
      done.add(entry.member.key);
    }

    return taken;
  };

  const steps: DependencyPlanStep[] = [];
  for (const node of graph.nodes) {
    const choice = moves.get(node.member.key);
    if (choice === undefined) {
      continue;
    }

    const needs = options.deferMoveDependencies
      ? []
      : take(reachable(graph, node.dependsOn, new Set()));
    steps.push(...(needs.length > 0 ? [{ kind: "materialize" as const, members: needs }] : []), {
      kind: "move",
      move: { request: choice.request, version: choice.prepared.toVersion },
    });
  }

  const fromRoot = reachable(graph, graph.rootDependsOn, moved);
  const rest = options.deferMoveDependencies
    ? take(fromRoot)
    : take(new Set(graph.nodes.map((node) => node.member.key)));
  return {
    ok: true,
    steps,
    final: {
      members: [
        ...rest,
        ...(graph.root === undefined ? [] : [{ kind: "install" as const, member: graph.root }]),
      ],
      alreadyInstalled: graph.nodes.flatMap((node) =>
        node.kind === "recorded" &&
        !node.walked &&
        (!options.deferMoveDependencies || fromRoot.has(node.member.key))
          ? [node.member]
          : [],
      ),
    },
  };
}

/**
 * Plans the whole operation before any write: the version of every plugin
 * of its dependency graph, settled over every range the final graph
 * declares, then the steps that carry it out.
 */
export async function planDependencyGraph<P extends PlannedCandidate>(
  ports: DependencyPlanPorts<P>,
  options: DependencyPlanOptions,
): Promise<DependencyPlan> {
  const settled = await settleChoices(ports);
  if (!settled.ok) {
    return settled;
  }

  return (
    (await previewFresh(settled.graph, ports)) ?? schedule(settled.graph, settled.moves, options)
  );
}
