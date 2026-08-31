import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { adaptToolResultResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import { resetRoutingState } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { ToolResultEvent } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("adaptToolResultResult", () => {
  test("applies only whitelisted tool-result fields", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const input = { command: "inspect owner" };
    const originalContent = [{ type: "text" as const, text: "original output" }];
    const details = { exitCode: 0, routeToken: "details-original" };
    const route = {
      scope: "project",
      marketplace: "trusted-marketplace",
      pluginId: "trusted-plugin",
    } as const;
    const event = {
      type: "tool_result",
      toolCallId: "call-original",
      toolName: "trusted-tool",
      input,
      content: originalContent,
      isError: false,
      details,
      route,
    } satisfies ToolResultEvent & { route: typeof route };
    const eventIdentity = event;
    const replacementContent = [{ type: "text" as const, text: "replacement output" }];
    const outcome = {
      kind: "mutate",
      updatedToolOutput: {
        content: replacementContent,
        isError: true,
        type: "hostile-discriminator",
        toolCallId: "call-hostile",
        toolName: "hostile-tool",
        input: { command: "hostile input" },
        details: { exitCode: 99, routeToken: "details-hostile" },
        usage: { input: 999, output: 999 },
        route: {
          scope: "user",
          marketplace: "hostile-marketplace",
          pluginId: "hostile-plugin",
        },
      },
    } satisfies HookExecResult;

    // act
    const adaptation = adaptToolResultResult(outcome, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "call-original",
      toolName: "trusted-tool",
      input: { command: "inspect owner" },
      content: [{ type: "text", text: "replacement output" }],
      isError: true,
      details: { exitCode: 0, routeToken: "details-original" },
      route: {
        scope: "project",
        marketplace: "trusted-marketplace",
        pluginId: "trusted-plugin",
      },
    });
    assert.strictEqual(event, eventIdentity);
    assert.strictEqual(event.input, input);
    assert.strictEqual(event.content, replacementContent);
    assert.strictEqual(event.details, details);
    assert.strictEqual(Object.hasOwn(event, "usage"), false);
    assert.deepStrictEqual(outcome, {
      kind: "mutate",
      updatedToolOutput: {
        content: [{ type: "text", text: "replacement output" }],
        isError: true,
        type: "hostile-discriminator",
        toolCallId: "call-hostile",
        toolName: "hostile-tool",
        input: { command: "hostile input" },
        details: { exitCode: 99, routeToken: "details-hostile" },
        usage: { input: 999, output: 999 },
        route: {
          scope: "user",
          marketplace: "hostile-marketplace",
          pluginId: "hostile-plugin",
        },
      },
    });
  });
});
