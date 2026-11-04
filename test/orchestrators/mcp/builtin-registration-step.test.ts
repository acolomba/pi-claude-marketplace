import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify } from "strong-mock";

import {
  builtinRegistrationStep,
  resyncBuiltinRegistrations,
} from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts";

import type {
  ExtensionContext,
  PiMcpRegistry,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";

describe("builtinRegistrationStep", () => {
  test("MSEL-03: resolves without registering a server or reading the context or the snapshot", async () => {
    // arrange
    const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const snapshot = mock<NotificationRun>({ exactParams: true, name: "notification run" });

    // act & assert
    await assert.doesNotReject(builtinRegistrationStep({ pi, ctx, snapshot }));
    verify(pi);
    verify(ctx);
    verify(snapshot);
  });
});

describe("resyncBuiltinRegistrations", () => {
  test("MSEL-03: resolves without registering a server or reading the context or the snapshot", async () => {
    // arrange
    const pi = mock<PiMcpRegistry>({ exactParams: true, name: "MCP registry" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const snapshot = mock<NotificationRun>({ exactParams: true, name: "notification run" });

    // act & assert
    await assert.doesNotReject(resyncBuiltinRegistrations({ pi, ctx, snapshot }));
    verify(pi);
    verify(ctx);
    verify(snapshot);
  });
});
