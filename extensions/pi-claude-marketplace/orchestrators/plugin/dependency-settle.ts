// orchestrators/plugin/dependency-settle.ts
//
// UPD-DEP-D1: settles the dependency closure of the version an update moves a
// plugin to, the way an install settles its own. The order is the contract:
//
//   1. The closure cascade runs under the scope's lock. When nothing is out
//      of range it installs and enables what the version needs, and that is
//      the whole settle. When a recorded dependency is out of range it plans
//      the moves and materializes nothing.
//   2. With the lock released, the plan judges the whole operation
//      (`dependency-plan.ts`). A refusal changes nothing; the clones the plan
//      created are removed, and clones that were there before stay.
//   3. The moves run in the plan's order, each its own update landing the
//      version the plan chose. One that fails refuses the settle; the moves
//      already made stay, the rows list them, and the clones the plan created
//      that no record uses are removed.
//   4. The cascade runs again under the lock, with every dependency in range.
//
// The cascade, the plan and the moves are ports install's flow binds, so this
// module holds only the order.

import { renderDeclaredRanges } from "../../domain/dependency-range.ts";
import { DependencyCascadeError } from "../../shared/errors.ts";

import type { DependencyMoveResult } from "./dependency-move.ts";
import type {
  DependencyMoveRequest,
  DependencyPlan,
  PlannedDependencyMove,
} from "./dependency-plan.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type { CascadePlan } from "./install-cascade.ts";
import type { UpdateDependencySettlement } from "./update-swap.ts";
import type { UpdateDependencyRow } from "../types.ts";

/** What one locked run of the closure cascade did. */
export type SettleCascadeRun =
  | { readonly kind: "installed"; readonly rows: readonly UpdateDependencyRow[] }
  | { readonly kind: "refused"; readonly subject: CascadeFailureSubject };

/** The first run's arms: it may also plan moves. */
export type SettleFirstRun = SettleCascadeRun | CascadePlan;

/** The operations a settle composes. */
export interface DependencySettlePorts {
  /** The locked cascade that may plan moves instead of materializing. */
  readonly firstRun: () => Promise<SettleFirstRun>;
  /** The locked cascade once every dependency is in range. */
  readonly secondRun: () => Promise<SettleCascadeRun>;
  readonly plan: (planned: CascadePlan) => Promise<DependencyPlan>;
  readonly runMoves: (moves: readonly PlannedDependencyMove[]) => Promise<DependencyMoveResult>;
  /** The failing dependency's row, and the error that names it. */
  readonly refusal: (subject: CascadeFailureSubject) => {
    readonly rows: readonly UpdateDependencyRow[];
    readonly cause: Error;
  };
  /**
   * Removes the clones the plan created that no record uses; a clone that was
   * there before the plan stays. Never throws: a failure is cleanup the next
   * lifecycle operation retries.
   */
  readonly collectClones: () => Promise<void>;
}

/** The error a dependency move that did not land reports. */
export function failedMoveError(request: DependencyMoveRequest): DependencyCascadeError {
  const ranges = request.requesters.flatMap((requester) => requester.ranges);
  return new DependencyCascadeError(
    `Dependency "${request.key}" did not move into ${renderDeclaredRanges(ranges)}.`,
    request.key,
  );
}

function refused(
  ports: Pick<DependencySettlePorts, "refusal">,
  subject: CascadeFailureSubject,
  moved: readonly UpdateDependencyRow[],
): UpdateDependencySettlement {
  const refusal = ports.refusal(subject);
  return { kind: "refused", rows: [...moved, ...refusal.rows], cause: refusal.cause };
}

/** Runs the settle in its contracted order. */
export async function settleDependencies(
  ports: DependencySettlePorts,
): Promise<UpdateDependencySettlement> {
  const first = await ports.firstRun();
  if (first.kind === "installed") {
    return { kind: "settled", rows: first.rows };
  }

  if (first.kind === "refused") {
    return refused(ports, first.subject, []);
  }

  const plan = await ports.plan(first);
  if (!plan.ok) {
    await ports.collectClones();
    return refused(ports, plan.subject, []);
  }

  const moves = await ports.runMoves(plan.moves);
  const moved = moves.moved.map((entry) => entry.row);
  if (!moves.ok) {
    await ports.collectClones();
    return { kind: "refused", rows: moved, cause: failedMoveError(moves.request) };
  }

  const second = await settleWithoutMoves(ports);
  return { ...second, rows: [...moved, ...second.rows] };
}

/**
 * UPD-DEP-D1: the settle of a planned move, and the last step of every
 * settle: one locked run of the closure cascade, which moves nothing.
 */
export async function settleWithoutMoves(
  ports: Pick<DependencySettlePorts, "refusal" | "secondRun">,
): Promise<UpdateDependencySettlement> {
  const run = await ports.secondRun();
  return run.kind === "installed"
    ? { kind: "settled", rows: run.rows }
    : refused(ports, run.subject, []);
}
