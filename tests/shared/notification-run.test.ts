import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  openNotificationRun,
  openNotificationSnapshot,
  requireNotificationMode,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type {
  ToolInventory,
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
  const inventory = mock<ToolInventory>({ exactParams: true, name: "tool inventory" });
  when(() => inventory.getAllTools())
    .thenReturn([])
    .times(3);

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
  const pi = { getAllTools: () => [], appendEntry: () => {} };
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

test("D-05: opening a run reads the tool inventory exactly three times", () => {
  // arrange
  const pi = mock<ToolInventory & NotificationEntrySink>({
    exactParams: true,
    name: "tool inventory",
  });
  when(() => pi.getAllTools())
    .thenReturn([{ name: "subagent" }, { name: "mcp" }])
    .times(3);

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
  });
  verify(pi);
});

test("D-05: a run keeps its snapshot when the inventory later answers differently", () => {
  // arrange
  let tools: readonly ToolInventoryItem[] = [];
  const pi = {
    getAllTools: () => tools,
    appendEntry: (customType, payload) => {
      runWithNothingLoaded().entrySink.appendEntry(customType, payload);
    },
  } satisfies ToolInventory & NotificationEntrySink;
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
