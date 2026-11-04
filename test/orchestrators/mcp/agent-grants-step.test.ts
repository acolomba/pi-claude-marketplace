import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify } from "strong-mock";

import { agentGrantsStep } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts";

import type {
  ExtensionContext,
  PiInventory,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";

test("D-MB-12: resolves without reading the inventory, the context, or the snapshot", async () => {
  // arrange
  const pi = mock<PiInventory>({ exactParams: true, name: "inventory" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const snapshot = mock<NotificationRun>({ exactParams: true, name: "notification run" });

  // act & assert
  await assert.doesNotReject(agentGrantsStep({ pi, ctx, snapshot }));
  verify(pi);
  verify(ctx);
  verify(snapshot);
});
