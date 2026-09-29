import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

import type {
  ToolInventory,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("D-05: opening a run reads the tool inventory exactly three times", () => {
  // arrange
  const pi = mock<ToolInventory>({ exactParams: true, name: "tool inventory" });
  when(() => pi.getAllTools())
    .thenReturn([{ name: "subagent" }, { name: "mcp" }])
    .times(3);

  // act
  const run = openNotificationRun(pi);

  // assert
  assert.deepStrictEqual(run, {
    softDeps: { piSubagentsLoaded: true, piMcpAdapterLoaded: true, workflowEngineLoaded: false },
  });
  verify(pi);
});

test("D-05: a run keeps its snapshot when the inventory later answers differently", () => {
  // arrange
  let tools: readonly ToolInventoryItem[] = [];
  const pi = { getAllTools: () => tools } satisfies ToolInventory;
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
