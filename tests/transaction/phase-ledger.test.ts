import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runPhases,
  type Phase,
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

        assert.strictEqual(context.active.pop(), name);
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

test("compensates a state failure own-first and newest-first", async () => {
  // arrange
  const context: LedgerContext = { operations: [], active: [] };
  const forwardError = new Error("state forward failed");
  const expectedLedgerResult: RunPhasesResult = {
    ok: false,
    error: forwardError,
    rollbackPartials: [],
    leaks: [],
  };

  // act
  const ledgerResult = await runPhases(
    createSchedule({ forwardFailure: { phase: "state", error: forwardError } }),
    context,
  );

  // assert
  assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
  assert.strictEqual(ledgerResult.error, forwardError);
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
    active: [],
  });
});
