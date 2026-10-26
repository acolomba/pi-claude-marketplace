import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  failedMoveError,
  settleDependencies,
  settleWithoutMoves,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts";
import { DependencyCascadeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  DependencyMoveRequest,
  PlannedDependencyMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type { DependencySettlePorts } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts";
import type { CascadeFailureSubject } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import type { CascadePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type {
  MovedDependency,
  UpdateDependencyRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";

const LIB: DependencyMoveRequest = {
  key: "lib@mp",
  name: "lib",
  marketplace: "mp",
  recordedVersion: "1.0.0",
  requesters: [{ key: "app@mp", ranges: ["^2.0.0"] }],
};

const LIB_MOVE: PlannedDependencyMove = { request: LIB, version: "2.0.0" };

const PLANNED: CascadePlan = {
  kind: "planned",
  freshMembers: [],
  outOfRange: [
    {
      key: "lib@mp",
      name: "lib",
      marketplace: "mp",
      requiredBy: "app@mp",
      ranges: ["^2.0.0"],
      range: "^2.0.0",
      recordedVersion: "1.0.0",
    },
  ],
  recordedMembers: [{ key: "lib@mp", ranges: ["^2.0.0"] }],
};

function row(name: string, status: "installed" | "updated" = "installed"): UpdateDependencyRow {
  return status === "installed"
    ? { status, name, dependencies: [], version: "1.0.0", severity: "info", needsReload: true }
    : {
        status,
        name,
        from: "1.0.0",
        to: "2.0.0",
        dependencies: [],
        severity: "info",
        needsReload: true,
      };
}

const LIB_MOVED: MovedDependency = {
  key: "lib@mp",
  name: "lib",
  marketplace: "mp",
  row: row("lib@mp", "updated"),
};

const SUBJECT: CascadeFailureSubject = {
  kind: "constraint",
  failure: { kind: "no-matching-tag", key: "base@mp", range: "^3.0.0" },
};

const REFUSAL_ROW: UpdateDependencyRow = {
  status: "failed",
  name: "base@mp",
  reasons: ["no matching version"],
  severity: "error",
};

/** Ports whose every step is a recorded stub; each case overrides the steps it is about. */
function ports(overrides: Partial<DependencySettlePorts>): DependencySettlePorts & {
  readonly calls: string[];
} {
  const calls: string[] = [];
  const record =
    <A extends unknown[], R>(name: string, step: ((...args: A) => R) | undefined) =>
    (...args: A): R => {
      calls.push(name);
      return step === undefined ? assert.fail(`the settle does not ${name}`) : step(...args);
    };

  return {
    calls,
    firstRun: record("run first", overrides.firstRun),
    secondRun: record("run second", overrides.secondRun),
    plan: record("plan", overrides.plan),
    runMoves: record("move", overrides.runMoves),
    refusal: record(
      "refuse",
      overrides.refusal ?? (() => ({ rows: [REFUSAL_ROW], cause: new Error("refused") })),
    ),
    collectClones: record("collect clones", overrides.collectClones),
  };
}

describe("settleDependencies", () => {
  test("settles in one run when nothing must move", async () => {
    // arrange
    const bound = ports({
      firstRun: () => Promise.resolve({ kind: "installed", rows: [row("zcore@mp")] }),
    });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.deepStrictEqual(settlement, { kind: "settled", rows: [row("zcore@mp")] });
    assert.deepStrictEqual(bound.calls, ["run first"]);
  });

  test("refuses a first run that fails with the dependency's row", async () => {
    // arrange
    const bound = ports({ firstRun: () => Promise.resolve({ kind: "refused", subject: SUBJECT }) });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.deepStrictEqual(settlement, {
      kind: "refused",
      rows: [REFUSAL_ROW],
      cause: new Error("refused"),
    });
    assert.deepStrictEqual(bound.calls, ["run first", "refuse"]);
  });

  test("refuses a plan, collects its clones, and moves nothing", async () => {
    // arrange
    const bound = ports({
      firstRun: () => Promise.resolve(PLANNED),
      plan: () => Promise.resolve({ ok: false, subject: SUBJECT }),
      collectClones: () => Promise.resolve(),
    });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.strictEqual(settlement.kind, "refused");
    assert.deepStrictEqual(bound.calls, ["run first", "plan", "collect clones", "refuse"]);
  });

  test("refuses when a move does not land, collects the plan's clones, and reports every move attempted", async () => {
    // arrange
    const bound = ports({
      firstRun: () => Promise.resolve(PLANNED),
      plan: () => Promise.resolve({ ok: true, moves: [LIB_MOVE] }),
      runMoves: () => Promise.resolve({ ok: false, moved: [LIB_MOVED], request: LIB }),
      collectClones: () => Promise.resolve(),
    });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.deepStrictEqual(settlement, {
      kind: "refused",
      rows: [LIB_MOVED.row],
      cause: failedMoveError(LIB),
    });
    assert.deepStrictEqual(bound.calls, ["run first", "plan", "move", "collect clones"]);
  });

  test("moves first, then settles the closure again and reports the moves before its rows", async () => {
    // arrange
    const bound = ports({
      firstRun: () => Promise.resolve(PLANNED),
      plan: () => Promise.resolve({ ok: true, moves: [LIB_MOVE] }),
      runMoves: (moves) => {
        assert.deepStrictEqual(moves, [LIB_MOVE]);
        return Promise.resolve({ ok: true, moved: [LIB_MOVED] });
      },
      secondRun: () => Promise.resolve({ kind: "installed", rows: [row("zcore@mp")] }),
    });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.deepStrictEqual(settlement, {
      kind: "settled",
      rows: [LIB_MOVED.row, row("zcore@mp")],
    });
    assert.deepStrictEqual(bound.calls, ["run first", "plan", "move", "run second"]);
  });

  test("refuses a second run that fails, keeping the moves' rows first", async () => {
    // arrange
    const bound = ports({
      firstRun: () => Promise.resolve(PLANNED),
      plan: () => Promise.resolve({ ok: true, moves: [LIB_MOVE] }),
      runMoves: () => Promise.resolve({ ok: true, moved: [LIB_MOVED] }),
      secondRun: () => Promise.resolve({ kind: "refused", subject: SUBJECT }),
    });

    // act
    const settlement = await settleDependencies(bound);

    // assert
    assert.deepStrictEqual(settlement, {
      kind: "refused",
      rows: [LIB_MOVED.row, REFUSAL_ROW],
      cause: new Error("refused"),
    });
  });
});

describe("settleWithoutMoves", () => {
  test("settles with the one run's rows and moves nothing", async () => {
    // arrange
    const bound = ports({
      secondRun: () => Promise.resolve({ kind: "installed", rows: [row("zcore@mp")] }),
    });

    // act
    const settlement = await settleWithoutMoves(bound);

    // assert
    assert.deepStrictEqual(settlement, { kind: "settled", rows: [row("zcore@mp")] });
    assert.deepStrictEqual(bound.calls, ["run second"]);
  });

  test("refuses with the failing dependency's row when the run fails", async () => {
    // arrange
    const bound = ports({
      secondRun: () => Promise.resolve({ kind: "refused", subject: SUBJECT }),
    });

    // act
    const settlement = await settleWithoutMoves(bound);

    // assert
    assert.deepStrictEqual(settlement, {
      kind: "refused",
      rows: [REFUSAL_ROW],
      cause: new Error("refused"),
    });
    assert.deepStrictEqual(bound.calls, ["run second", "refuse"]);
  });
});

describe("failedMoveError", () => {
  test("names the dependency and every range it did not move into", () => {
    // act
    const error = failedMoveError({
      ...LIB,
      requesters: [...LIB.requesters, { key: "aaa@mp", ranges: [">=2.1.0"] }],
    });

    // assert
    assert.ok(error instanceof DependencyCascadeError);
    assert.deepStrictEqual(
      [error.message, error.key],
      ['Dependency "lib@mp" did not move into ^2.0.0, >=2.1.0.', "lib@mp"],
    );
  });
});
