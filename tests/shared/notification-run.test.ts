import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  openNotificationRun,
  requireNotificationMode,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type {
  ToolInventory,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationEntrySink } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

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
  const run = openNotificationRun(pi);

  // assert
  assert.deepStrictEqual(run, {
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
  const run = openNotificationRun(pi);

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
