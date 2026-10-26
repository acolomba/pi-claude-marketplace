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
//      materialized for unrecorded revisions are collected.
//   3. The moves run, each its own update. One that fails refuses the
//      settle; the moves already made stay, and the rows list them.
//   4. The cascade runs again under the lock, with every dependency in range.
//
// The cascade, the plan and the moves are ports install's flow binds, so this
// module holds only the order.

import { DependencyCascadeError } from "../../shared/errors.ts";

import type { DependencyMoveResult } from "./dependency-move.ts";
import type { DependencyPlan } from "./dependency-plan.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type { OutOfRangeMember, ResolvedCascadeMember } from "./install-cascade.ts";
import type { UpdateDependencySettlement } from "./update-swap.ts";
import type { UpdateDependencyRow } from "../types.ts";

/** What one locked run of the closure cascade did. */
export type SettleCascadeRun =
  | { readonly kind: "installed"; readonly rows: readonly UpdateDependencyRow[] }
  | { readonly kind: "refused"; readonly subject: CascadeFailureSubject };

/** The first run's arms: it may also plan moves. */
export type SettleFirstRun =
  | SettleCascadeRun
  | {
      readonly kind: "planned";
      readonly freshMembers: readonly ResolvedCascadeMember[];
      readonly outOfRange: readonly OutOfRangeMember[];
    };

/** The operations a settle composes. */
export interface DependencySettlePorts {
  /** The locked cascade that may plan moves instead of materializing. */
  readonly firstRun: () => Promise<SettleFirstRun>;
  /** The locked cascade once every dependency is in range. */
  readonly secondRun: () => Promise<SettleCascadeRun>;
  readonly plan: (
    planned: Extract<SettleFirstRun, { readonly kind: "planned" }>,
  ) => Promise<DependencyPlan>;
  readonly runMoves: (members: readonly OutOfRangeMember[]) => Promise<DependencyMoveResult>;
  /** The failing dependency's row, and the error that names it. */
  readonly refusal: (subject: CascadeFailureSubject) => {
    readonly rows: readonly UpdateDependencyRow[];
    readonly cause: Error;
  };
  /** Collects the clones a refused plan materialized for unrecorded revisions. */
  readonly collectClones: () => Promise<unknown>;
}

/** The error a dependency move that did not land reports. */
export function failedMoveError(member: OutOfRangeMember): DependencyCascadeError {
  return new DependencyCascadeError(
    `Dependency "${member.key}" did not move into ${member.range}.`,
    member.key,
  );
}

function refused(
  ports: DependencySettlePorts,
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

  const moves = await ports.runMoves(first.outOfRange);
  const moved = moves.moved.map((entry) => entry.row);
  if (!moves.ok) {
    return { kind: "refused", rows: moved, cause: failedMoveError(moves.member) };
  }

  const second = await ports.secondRun();
  return second.kind === "installed"
    ? { kind: "settled", rows: [...moved, ...second.rows] }
    : refused(ports, second.subject, moved);
}
