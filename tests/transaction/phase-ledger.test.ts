import assert from "node:assert/strict";
import { test } from "node:test";

import { PathContainmentError } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import {
  runPhases,
  type Phase,
  type RollbackPartial,
  type RunPhasesResult,
} from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

const PRODUCTION_PHASE_NAMES = ["skills", "commands", "agents", "hooks", "mcp", "state"] as const;

type PhaseName = (typeof PRODUCTION_PHASE_NAMES)[number];

interface LedgerContext {
  readonly operations: string[];
  readonly active: PhaseName[];
}

interface ScheduleOptions {
  readonly forwardFailure?: {
    readonly phase: PhaseName;
    readonly error: unknown;
  };
  readonly undoFailures?: Readonly<Partial<Record<PhaseName, unknown>>>;
  readonly phasesWithoutUndo?: ReadonlySet<PhaseName>;
}

interface ForwardFailureCase {
  readonly name: string;
  readonly phase: PhaseName;
  readonly expectedOperations: readonly string[];
}

const FORWARD_FAILURE_CASES = [
  {
    name: "compensates a skills failure before later phases run",
    phase: "skills",
    expectedOperations: ["do:skills", "undo:skills"],
  },
  {
    name: "compensates a commands failure own-first and newest-first",
    phase: "commands",
    expectedOperations: ["do:skills", "do:commands", "undo:commands", "undo:skills"],
  },
  {
    name: "compensates an agents failure own-first and newest-first",
    phase: "agents",
    expectedOperations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
  },
  {
    name: "compensates a hooks failure own-first and newest-first",
    phase: "hooks",
    expectedOperations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "do:hooks",
      "undo:hooks",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
  },
  {
    name: "compensates an mcp failure own-first and newest-first",
    phase: "mcp",
    expectedOperations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "do:hooks",
      "do:mcp",
      "undo:mcp",
      "undo:hooks",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
  },
  {
    name: "compensates a state failure own-first and newest-first",
    phase: "state",
    expectedOperations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "do:hooks",
      "do:mcp",
      "do:state",
      "undo:state",
      "undo:mcp",
      "undo:hooks",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
  },
] satisfies readonly ForwardFailureCase[];

const SCHEDULE_TYPE_EVIDENCE = PRODUCTION_PHASE_NAMES.map((name) => ({
  name,
  do: () => Promise.resolve(),
})) satisfies readonly Phase<LedgerContext>[];
void SCHEDULE_TYPE_EVIDENCE;

function rejectUnknown(error: unknown): Promise<never> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the ledger explicitly normalizes non-Error throws.
  return Promise.reject(error);
}

function createSchedule(options: ScheduleOptions = {}): readonly Phase<LedgerContext>[] {
  return PRODUCTION_PHASE_NAMES.map((name) => {
    const phase: Phase<LedgerContext> = {
      name,
      do: (context) => {
        context.operations.push(`do:${name}`);
        context.active.push(name);
        return options.forwardFailure?.phase === name
          ? rejectUnknown(options.forwardFailure.error)
          : Promise.resolve();
      },
      undo: (context) => {
        context.operations.push(`undo:${name}`);
        const undoFailure = options.undoFailures?.[name];
        if (undoFailure !== undefined) {
          return rejectUnknown(undoFailure);
        }

        const activeIndex = context.active.lastIndexOf(name);
        assert.notStrictEqual(activeIndex, -1);
        context.active.splice(activeIndex, 1);
        return Promise.resolve();
      },
    };

    return options.phasesWithoutUndo?.has(name) === true
      ? { name: phase.name, do: phase.do }
      : phase;
  });
}

test("runs the complete install schedule successfully in production order", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const expectedLedgerResult: RunPhasesResult = {
    ok: true,
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(createSchedule(), context);

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "do:commands", "do:agents", "do:hooks", "do:mcp", "do:state"],
    active: ["skills", "commands", "agents", "hooks", "mcp", "state"],
  });
});

for (const { name, phase, expectedOperations } of FORWARD_FAILURE_CASES) {
  test(name, async () => {
    // arrange
    const context: LedgerContext = { operations: [], active: [] };
    const forwardError = new Error(`${phase} forward failed`);
    const expectedLedgerResult: RunPhasesResult = {
      ok: false,
      error: forwardError,
      rollbackPartials: [],
      leaks: [],
    };

    // act
    const ledgerResult = await runPhases(
      createSchedule({ forwardFailure: { phase, error: forwardError } }),
      context,
    );

    // assert
    assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
    assert.strictEqual(ledgerResult.error, forwardError);
    assert.deepStrictEqual(context, { operations: expectedOperations, active: [] });
  });
}

test("returns a complete no-op result for an empty schedule", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const expectedLedgerResult: RunPhasesResult = {
    ok: true,
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases([], context);

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.deepStrictEqual(context, { operations: [], active: [] });
});

test("leaves a completed phase active when it has no undo", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("agents forward failed");
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "agents", error: forwardError },
      phasesWithoutUndo: new Set(["commands"]),
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "do:commands", "do:agents", "undo:agents", "undo:skills"],
    active: ["commands"],
  });
});

test("skips own undo when the failing phase has no undo", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("agents forward failed");
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "agents", error: forwardError },
      phasesWithoutUndo: new Set(["agents"]),
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "do:commands", "do:agents", "undo:commands", "undo:skills"],
    active: ["agents"],
  });
});

test("reports an ordinary failing-phase undo error before reverse failures", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("agents forward failed");
  const ownUndoError = new Error("agents undo failed", { cause: new Error("agent cleanup") });
  const expectedRollbackPartials = [
    { phase: "agents", msg: "agents undo failed", cause: ownUndoError },
  ] satisfies readonly RollbackPartial[];
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: expectedRollbackPartials,
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "agents", error: forwardError },
      undoFailures: { agents: ownUndoError },
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.strictEqual(ledgerResult.rollbackPartials[0]?.cause, ownUndoError);
  assert.deepStrictEqual(context, {
    operations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
    active: ["agents"],
  });
});

test("omits the cause when a failing-phase undo rejects a non-Error", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("skills forward failed");
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [{ phase: "skills", msg: "plain own undo failure" }],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "skills", error: forwardError },
      undoFailures: { skills: "plain own undo failure" },
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "undo:skills"],
    active: ["skills"],
  });
});

test("reports one completed-phase undo failure with its cause", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("hooks forward failed");
  const commandsUndoError = new Error("commands undo failed");
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [
      { phase: "commands", msg: "commands undo failed", cause: commandsUndoError },
    ],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "hooks", error: forwardError },
      undoFailures: { commands: commandsUndoError },
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.strictEqual(ledgerResult.rollbackPartials[0]?.cause, commandsUndoError);
  assert.deepStrictEqual(context, {
    operations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "do:hooks",
      "undo:hooks",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
    active: ["commands"],
  });
});

test("reports several completed-phase undo failures newest-first", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("state forward failed");
  const mcpUndoError = new Error("mcp undo failed");
  const agentsUndoError = new Error("agents undo failed", { cause: new Error("agent cleanup") });
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [
      { phase: "mcp", msg: "mcp undo failed", cause: mcpUndoError },
      { phase: "agents", msg: "agents undo failed", cause: agentsUndoError },
      { phase: "skills", msg: "plain reverse undo failure" },
    ],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({
      forwardFailure: { phase: "state", error: forwardError },
      undoFailures: {
        skills: "plain reverse undo failure",
        agents: agentsUndoError,
        mcp: mcpUndoError,
      },
    }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
  assert.strictEqual(ledgerResult.rollbackPartials[0]?.cause, mcpUndoError);
  assert.strictEqual(ledgerResult.rollbackPartials[1]?.cause, agentsUndoError);
  assert.deepStrictEqual(context, {
    operations: [
      "do:skills",
      "do:commands",
      "do:agents",
      "do:hooks",
      "do:mcp",
      "do:state",
      "undo:state",
      "undo:mcp",
      "undo:hooks",
      "undo:agents",
      "undo:commands",
      "undo:skills",
    ],
    active: ["skills", "agents", "mcp"],
  });
});

test("rethrows a failing phase own-undo containment error by identity", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("agents forward failed");
  const containmentError = new PathContainmentError("/scope", "/scope/../escape", "agents undo");
  let thrown: unknown;

  // act
  try {
    await runPhases(
      createSchedule({
        forwardFailure: { phase: "agents", error: forwardError },
        undoFailures: { agents: containmentError },
      }),
      context,
    );
  } catch (error) {
    thrown = error;
  }

  // assert
  assert.strictEqual(thrown, containmentError);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "do:commands", "do:agents", "undo:agents"],
    active: ["skills", "commands", "agents"],
  });
});

test("rethrows a completed phase undo containment error before older compensation", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("agents forward failed");
  const containmentError = new PathContainmentError("/scope", "/scope/../escape", "commands undo");
  let thrown: unknown;

  // act
  try {
    await runPhases(
      createSchedule({
        forwardFailure: { phase: "agents", error: forwardError },
        undoFailures: { commands: containmentError },
      }),
      context,
    );
  } catch (error) {
    thrown = error;
  }

  // assert
  assert.strictEqual(thrown, containmentError);
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "do:commands", "do:agents", "undo:agents", "undo:commands"],
    active: ["skills", "commands"],
  });
});

test("normalizes a non-Error forward throw into the complete public result", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: new Error("plain forward failure"),
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({ forwardFailure: { phase: "skills", error: "plain forward failure" } }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.deepStrictEqual(
    {
      errorType: ledgerResult.error?.constructor,
      errorName: ledgerResult.error?.name,
      errorMessage: ledgerResult.error?.message,
      errorCause: ledgerResult.error?.cause,
    },
    {
      errorType: Error,
      errorName: "Error",
      errorMessage: "plain forward failure",
      errorCause: undefined,
    },
  );
  assert.deepStrictEqual(context, {
    operations: ["do:skills", "undo:skills"],
    active: [],
  });
});
