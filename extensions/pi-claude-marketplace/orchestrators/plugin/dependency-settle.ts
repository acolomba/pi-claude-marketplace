// orchestrators/plugin/dependency-settle.ts
//
// UPD-DEP-D1: carries a dependency plan out, and settles the dependency
// closure of the version an update moves a plugin to.
//
// `runDependencySteps` makes the plan's steps in order and nothing else:
// each closure slice lands in one locked cascade, each move is one update at
// the version the plan chose. A step that fails stops the rest; the steps
// already made stay, each complete, and the result lists every change that
// landed beside the failure.
//
// `settleDependencies` is an update's order, and the order is the contract:
//
//   1. The closure cascade runs under the scope's lock. When nothing is out
//      of range it installs and enables what the version needs, and that is
//      the whole settle.
//   2. Otherwise, with the lock released, the plan settles every version of
//      the graph (`dependency-plan.ts`). A refusal changes nothing.
//   3. The plan's steps run, then the closure slice the plan left for last.
//   4. The clones the plan created, and the revisions its moves replaced,
//      are removed once nothing references them; clones that were there
//      before stay.
//
// The cascade, the plan and the steps are ports install's flow binds, so
// this module holds only the order.
//
// D-PL1-16: a settle reports the MCP config notices of the dependencies its
// cascades install, in step order, on both of its arms, so an update can show
// them ahead of its own. The MCP notices and staging warnings of a dependency
// move are not reported; that is deferred (D-PL1-16).

import { DependencyCascadeError, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { mcpConfigNoticesMember } from "../marketplace/shared.ts";

import { failedMoveRow, supersedePinRefreshes } from "./dependency-move.ts";
import { renderRequestedRanges } from "./dependency-plan.ts";

import type { DependencyMoveRun } from "./dependency-move.ts";
import type {
  DependencyMoveRequest,
  DependencyPlan,
  DependencyPlanStep,
  PlannedDependencyMove,
} from "./dependency-plan.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type { CascadePlan, PlannedCascadeMember } from "./install-cascade.ts";
import type { UpdateDependencySettlement } from "./update-swap.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { StagingWarning } from "../../shared/staging-warnings.ts";
import type { MovedDependency, UpdateDependencyRow } from "../types.ts";

/**
 * What one locked run of the closure cascade did. D-PL1-16: `installed`
 * carries its members' MCP config notices, omitted when there are none
 * (NREG-01).
 */
export type SettleCascadeRun =
  | {
      readonly kind: "installed";
      readonly rows: readonly UpdateDependencyRow[];
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
      readonly stagingWarnings?: readonly StagingWarning[];
    }
  | { readonly kind: "refused"; readonly subject: CascadeFailureSubject };

/** The first run's arms: it may answer that a plan must come first. */
export type SettleFirstRun = SettleCascadeRun | CascadePlan;

/** The failing dependency's row, and the error that names it. */
export type DependencyRefusal = (subject: CascadeFailureSubject) => {
  readonly rows: readonly UpdateDependencyRow[];
  readonly cause: Error;
};

/** The operations the plan's steps run through. */
export interface DependencyStepPorts {
  /** Installs and re-enables `members` under one lock, all or nothing. */
  readonly materialize: (members: readonly PlannedCascadeMember[]) => Promise<SettleCascadeRun>;
  /** Makes one planned move. */
  readonly move: (move: PlannedDependencyMove) => Promise<DependencyMoveRun>;
  readonly refusal: DependencyRefusal;
}

/**
 * Every step landed, or the one that did not; `landed` lists every row
 * reported. D-PL1-16: `mcpConfigNotices` holds the notices of every closure
 * slice that landed, omitted when there are none (NREG-01).
 */
export type DependencyStepsResult =
  | {
      readonly ok: true;
      readonly landed: readonly MovedDependency[];
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
      readonly stagingWarnings?: readonly StagingWarning[];
    }
  | {
      readonly ok: false;
      readonly landed: readonly MovedDependency[];
      readonly cause: Error;
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
      readonly stagingWarnings?: readonly StagingWarning[];
    };

/** The operations an update's settle composes. */
export interface DependencySettlePorts {
  /** The locked cascade that answers `planned` instead of materializing. */
  readonly firstRun: () => Promise<SettleFirstRun>;
  /** The write-free plan of the whole graph. */
  readonly plan: () => Promise<DependencyPlan>;
  readonly steps: DependencyStepPorts;
  /** Sweeps the exact clone keys collected during this planning attempt. */
  readonly sweepPlanClones: () => Promise<void>;
}

/** The error a dependency move that did not land reports. */
function failedMoveError(request: DependencyMoveRequest): DependencyCascadeError {
  return new DependencyCascadeError(
    `Dependency "${request.key}" did not move into ${renderRequestedRanges(request.requesters)}.`,
    request.key,
  );
}

/** A row a step reports, which names its dependency by `<plugin>@<marketplace>`. */
export function movedFromRow(row: UpdateDependencyRow): MovedDependency {
  const at = row.name.lastIndexOf("@");
  return {
    key: row.name,
    name: row.name.slice(0, at),
    marketplace: row.name.slice(at + 1),
    row,
  };
}

/** What one step reported, the notices it raised, and why it failed when it did. */
interface StepRun {
  readonly rows: readonly UpdateDependencyRow[];
  readonly notices: readonly McpConfigNotice[];
  readonly warnings: readonly StagingWarning[];
  readonly failure?: Error;
}

async function runStep(step: DependencyPlanStep, ports: DependencyStepPorts): Promise<StepRun> {
  if (step.kind === "move") {
    const moved = await ports.move(step.move);
    return moved.landed
      ? {
          rows: moved.rows,
          notices: moved.mcpConfigNotices ?? [],
          warnings: moved.stagingWarnings ?? [],
        }
      : {
          rows: moved.rows,
          notices: moved.mcpConfigNotices ?? [],
          warnings: moved.stagingWarnings ?? [],
          failure: failedMoveError(step.move.request),
        };
  }

  const run = await ports.materialize(step.members);
  if (run.kind === "installed") {
    return { rows: run.rows, notices: run.mcpConfigNotices ?? [], warnings: [] };
  }

  const refusal = ports.refusal(run.subject);
  return { rows: refusal.rows, notices: [], warnings: [], failure: refusal.cause };
}

function warningsMember(warnings: readonly StagingWarning[]): {
  readonly stagingWarnings?: readonly StagingWarning[];
} {
  return warnings.length > 0 ? { stagingWarnings: warnings } : {};
}

/**
 * Makes the plan's steps in order. A step that fails stops the rest. A move
 * that throws fails as one that did not land, its row carrying what it threw.
 * WR-2: a disabled dependency's pin refresh is a landed change until its
 * re-enable reports the dependency again.
 * GHB-03: an invalid GitHub base override before anything landed fails the
 * command; after a change landed, the failure row reports it with the
 * changes.
 * D-PL1-16: every arm carries the notices of the slices that landed before it.
 */
export async function runDependencySteps(
  steps: readonly DependencyPlanStep[],
  ports: DependencyStepPorts,
): Promise<DependencyStepsResult> {
  let landed: MovedDependency[] = [];
  let notices: McpConfigNotice[] = [];
  let warnings: StagingWarning[] = [];
  for (const step of steps) {
    let run: StepRun;
    try {
      // eslint-disable-next-line no-await-in-loop -- each step locks the scope (retries: 0), dependencies first
      run = await runStep(step, ports);
    } catch (err) {
      if (landed.length === 0) {
        rethrowInvalidGitHubBaseUrl(err);
      }

      if (step.kind === "materialize") {
        return {
          ok: false,
          landed,
          cause: err as Error,
          ...mcpConfigNoticesMember(notices),
          ...warningsMember(warnings),
        };
      }

      return {
        ok: false,
        landed: [...landed, movedFromRow(failedMoveRow(step.move.request, err))],
        cause: failedMoveError(step.move.request),
        ...mcpConfigNoticesMember(notices),
        ...warningsMember(warnings),
      };
    }

    landed = [
      ...supersedePinRefreshes(landed, new Set(run.rows.map((row) => row.name))),
      ...run.rows.map(movedFromRow),
    ];
    notices = [...notices, ...run.notices];
    warnings = [...warnings, ...run.warnings];
    if (run.failure !== undefined) {
      return {
        ok: false,
        landed,
        cause: run.failure,
        ...mcpConfigNoticesMember(notices),
        ...warningsMember(warnings),
      };
    }
  }

  return {
    ok: true,
    landed,
    ...mcpConfigNoticesMember(notices),
    ...warningsMember(warnings),
  };
}

function refused(
  refusal: DependencyRefusal,
  subject: CascadeFailureSubject,
): UpdateDependencySettlement {
  const { rows, cause } = refusal(subject);
  return { kind: "refused", rows, cause };
}

/**
 * Steps 2 and 3: the plan, then its steps. CR-N2: a plan that throws is the
 * update's refusal; GHB-03's invalid base override still fails the command.
 */
async function settlePlanned(ports: DependencySettlePorts): Promise<UpdateDependencySettlement> {
  try {
    let plan: DependencyPlan;
    try {
      plan = await ports.plan();
    } catch (err) {
      rethrowInvalidGitHubBaseUrl(err);
      return { kind: "refused", rows: [], cause: err as Error };
    }

    if (!plan.ok) {
      return refused(ports.steps.refusal, plan.subject);
    }

    const final: DependencyPlanStep[] =
      plan.final.members.length > 0 ? [{ kind: "materialize", members: plan.final.members }] : [];
    const ran = await runDependencySteps([...plan.steps, ...final], ports.steps);
    const rows = ran.landed.map((entry) => entry.row);
    const notices = mcpConfigNoticesMember(ran.mcpConfigNotices ?? []);
    const warnings = warningsMember(ran.stagingWarnings ?? []);
    return ran.ok
      ? { kind: "settled", rows, ...notices, ...warnings }
      : { kind: "refused", rows, cause: ran.cause, ...notices, ...warnings };
  } finally {
    await ports.sweepPlanClones();
  }
}

/** Runs an update's settle in its contracted order. */
export async function settleDependencies(
  ports: DependencySettlePorts,
): Promise<UpdateDependencySettlement> {
  const first = await ports.firstRun();
  if (first.kind === "installed") {
    return {
      kind: "settled",
      rows: first.rows,
      ...mcpConfigNoticesMember(first.mcpConfigNotices ?? []),
    };
  }

  if (first.kind === "refused") {
    return refused(ports.steps.refusal, first.subject);
  }

  return settlePlanned(ports);
}
