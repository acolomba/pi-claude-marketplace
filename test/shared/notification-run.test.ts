import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  openNotificationRun,
  openNotificationSnapshot,
  requireNotificationMode,
  createCommandRunState,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { adapterCommand } from "../platform/pi-inventory-seed.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type {
  PiInventory,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  NotificationEntrySink,
  NotificationOrigin,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

void ({
  kind: "command",
  commandId: "plugin list",
  invocationId: "run-a",
} satisfies NotificationOrigin);
void ({ kind: "load" } satisfies NotificationOrigin);
void ({ kind: "hook" } satisfies NotificationOrigin);
// @ts-expect-error command origins require invocation correlation
void ({ kind: "command", commandId: "plugin list" } satisfies NotificationOrigin);
// @ts-expect-error command origins require a canonical command ID
void ({ kind: "command", invocationId: "run-a" } satisfies NotificationOrigin);
// @ts-expect-error load origins carry no command fields
void ({ kind: "load", commandId: "plugin list" } satisfies NotificationOrigin);
// @ts-expect-error hook origins carry no invocation fields
void ({ kind: "hook", invocationId: "run-a" } satisfies NotificationOrigin);
// @ts-expect-error null is not an origin
void (null satisfies NotificationOrigin);

test("takes a snapshot without an entry sink or command identity", () => {
  // arrange
  const inventory = mock<PiInventory>({ exactParams: true, name: "Pi inventory" });
  when(() => inventory.getAllTools())
    .thenReturn([])
    .times(3);
  when(() => inventory.getCommands())
    .thenReturn([])
    .times(1);

  // act
  const snapshot = openNotificationSnapshot(inventory);

  // assert
  assert.deepStrictEqual(snapshot, {
    softDeps: { piSubagentsLoaded: false, piMcpAdapterLoaded: false, workflowEngineLoaded: false },
  });
  verify(inventory);
});

test("keeps the root identity when the supplied origin later changes", () => {
  // arrange
  const origin = { kind: "command", commandId: "plugin list", invocationId: "run-a" } as const;
  const supplied = { ...origin };
  const pi = { getAllTools: () => [], getCommands: () => [], appendEntry: () => {} };
  const run = openNotificationRun(pi, supplied);

  // act
  Object.assign(supplied, { invocationId: "run-b" });

  // assert
  assert.deepStrictEqual(run.origin, {
    kind: "command",
    commandId: "plugin list",
    invocationId: "run-a",
  });
  assert.strictEqual(run.entrySink, pi);
});

test("D-05: opening a run reads the tools three times and the commands once", () => {
  // arrange
  const pi = mock<PiInventory & NotificationEntrySink>({
    exactParams: true,
    name: "Pi inventory",
  });
  when(() => pi.getAllTools())
    .thenReturn([{ name: "subagent" }])
    .times(3);
  when(() => pi.getCommands())
    .thenReturn([adapterCommand()])
    .times(1);

  // act
  const run = openNotificationRun(pi, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(run, {
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    softDeps: { piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: false },
    entrySink: pi,
    commandState: { hasOutcome: false, needsReload: false, settled: false, delivery: "open" },
  });
  verify(pi);
});

test("allocates independent command state and preserves supplied state before inventory reads", () => {
  // arrange
  const state = createCommandRunState();
  const origin = { kind: "command", commandId: "plugin list", invocationId: "run-a" } as const;
  const pi = {
    getAllTools: () => {
      state.needsReload = true;
      return [];
    },
    getCommands: () => [],
    appendEntry: () => {},
  };

  // act
  const run = openNotificationRun(pi, origin, state);
  const fresh = createCommandRunState();

  // assert
  assert.strictEqual(run.commandState, state);
  assert.deepStrictEqual(state, {
    hasOutcome: false,
    needsReload: true,
    settled: false,
    delivery: "open",
  });
  assert.deepStrictEqual(fresh, {
    hasOutcome: false,
    needsReload: false,
    settled: false,
    delivery: "open",
  });
});

for (const kind of ["load", "hook"] as const) {
  test(`opens ${kind} without command completion state`, () => {
    // arrange
    const pi = { getAllTools: () => [], getCommands: () => [], appendEntry: () => {} };

    // act
    const run = openNotificationRun(pi, { kind });

    // assert
    assert.deepStrictEqual(run, {
      origin: { kind },
      entrySink: pi,
      softDeps: {
        piSubagentsLoaded: false,
        piMcpAdapterLoaded: false,
        workflowEngineLoaded: false,
      },
    });
  });
}

test("D-05: a run keeps its snapshot when the inventory later answers differently", () => {
  // arrange
  let tools: readonly ToolInventoryItem[] = [];
  const pi = {
    getAllTools: () => tools,
    getCommands: () => [],
    appendEntry: (customType, payload) => {
      runWithNothingLoaded().entrySink.appendEntry(customType, payload);
    },
  } satisfies PiInventory & NotificationEntrySink;
  const run = openNotificationRun(pi, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // act
  tools = [{ name: "subagent" }, { name: "mcp" }, { name: "workflow_control" }];

  // assert
  assert.deepStrictEqual(run.softDeps, {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  });
});

for (const mode of ["tui", "print", "json", "rpc"]) {
  test(`accepts the exact ${mode} runtime mode`, () => {
    // act & assert
    assert.strictEqual(requireNotificationMode(mode), mode);
  });
}

for (const mode of ["", "JSON", " json", "rpc ", "ｊｓｏｎ", "jsоn", "unknown"]) {
  test(`rejects unsupported runtime mode ${JSON.stringify(mode)} without normalization`, () => {
    // act & assert
    assert.throws(
      () => requireNotificationMode(mode),
      (error: unknown) => {
        assert.ok(error instanceof UnsupportedModeError);
        assert.strictEqual(error.mode, mode);
        return true;
      },
    );
  });
}
