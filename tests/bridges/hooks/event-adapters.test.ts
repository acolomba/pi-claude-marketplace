import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  adaptInputResult,
  adaptObservationResultForEvent,
  adaptToolCallResult,
  adaptToolResultResult,
  applyMutationInPlace,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import {
  pendingSessionStartContextEntries,
  resetRoutingState,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type {
  InputEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("applyMutationInPlace", () => {
  for (const { name, event } of [
    { name: "null", event: null },
    { name: "primitive", event: "tool_call" },
  ] as const) {
    test(`drops a ${name} event without changing the hook outcome`, () => {
      // arrange
      const hookOutcome = {
        kind: "mutate",
        updatedInput: { command: "replacement" },
      } satisfies HookExecResult;
      let thrown: unknown;

      // act
      try {
        applyMutationInPlace(event, hookOutcome);
      } catch (error) {
        thrown = error;
      }

      // assert
      assert.strictEqual(thrown, undefined);
      assert.deepStrictEqual(hookOutcome, {
        kind: "mutate",
        updatedInput: { command: "replacement" },
      });
    });
  }

  test("leaves an event outside the mutable tool families unchanged", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "interactive",
    } satisfies InputEvent;
    const hookOutcome = {
      kind: "mutate",
      updatedInput: { text: "hostile prompt" },
      updatedToolOutput: { isError: true },
    } satisfies HookExecResult;

    // act
    applyMutationInPlace(event, hookOutcome);

    // assert
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "interactive",
    });
    assert.deepStrictEqual(hookOutcome, {
      kind: "mutate",
      updatedInput: { text: "hostile prompt" },
      updatedToolOutput: { isError: true },
    });
  });
});

describe("adaptToolCallResult", () => {
  test("returns undefined for noop without changing the complete event", () => {
    // arrange
    const input = { command: "inspect", keep: "original" };
    const event = {
      type: "tool_call",
      toolCallId: "call-noop",
      toolName: "owner-tool",
      input,
    } satisfies ToolCallEvent;

    // act
    const adaptation = adaptToolCallResult({ kind: "noop" }, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_call",
      toolCallId: "call-noop",
      toolName: "owner-tool",
      input: { command: "inspect", keep: "original" },
    });
    assert.strictEqual(event.input, input);
  });

  test("blocks with the exact supplied reason", () => {
    // arrange
    const event = {
      type: "tool_call",
      toolCallId: "call-block-reason",
      toolName: "owner-tool",
      input: { command: "inspect" },
    } satisfies ToolCallEvent;

    // act
    const adaptation = adaptToolCallResult({ kind: "block", reason: "policy denied" }, event);

    // assert
    assert.deepStrictEqual(adaptation, { block: true, reason: "policy denied" });
    assert.deepStrictEqual(event, {
      type: "tool_call",
      toolCallId: "call-block-reason",
      toolName: "owner-tool",
      input: { command: "inspect" },
    });
  });

  test("omits the optional reason key when a block has no reason", () => {
    // arrange
    const event = {
      type: "tool_call",
      toolCallId: "call-block-absent",
      toolName: "owner-tool",
      input: { command: "inspect" },
    } satisfies ToolCallEvent;

    // act
    const adaptation = adaptToolCallResult({ kind: "block" }, event);

    // assert
    assert.deepStrictEqual(adaptation, { block: true });
    assert.strictEqual(Object.hasOwn(adaptation, "reason"), false);
    assert.deepStrictEqual(event, {
      type: "tool_call",
      toolCallId: "call-block-absent",
      toolName: "owner-tool",
      input: { command: "inspect" },
    });
  });

  test("patches only the existing tool-call input object", () => {
    // arrange
    const input = { command: "inspect", keep: "original" };
    const event = {
      type: "tool_call",
      toolCallId: "call-mutate",
      toolName: "owner-tool",
      input,
    } satisfies ToolCallEvent;
    const eventIdentity = event;
    const updatedInput = { command: "replacement", added: "field" };
    const hookOutcome = { kind: "mutate", updatedInput } satisfies HookExecResult;

    // act
    const adaptation = adaptToolCallResult(hookOutcome, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_call",
      toolCallId: "call-mutate",
      toolName: "owner-tool",
      input: { command: "replacement", keep: "original", added: "field" },
    });
    assert.strictEqual(event, eventIdentity);
    assert.strictEqual(event.input, input);
    assert.deepStrictEqual(updatedInput, { command: "replacement", added: "field" });
    assert.deepStrictEqual(hookOutcome, {
      kind: "mutate",
      updatedInput: { command: "replacement", added: "field" },
    });
  });

  test("leaves input unchanged when updated input is absent", () => {
    // arrange
    const input = { command: "inspect", keep: "original" };
    const event = {
      type: "tool_call",
      toolCallId: "call-mutate-absent",
      toolName: "owner-tool",
      input,
    } satisfies ToolCallEvent;

    // act
    const adaptation = adaptToolCallResult({ kind: "mutate" }, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_call",
      toolCallId: "call-mutate-absent",
      toolName: "owner-tool",
      input: { command: "inspect", keep: "original" },
    });
    assert.strictEqual(event.input, input);
  });

  for (const { name, updatedInput } of [
    { name: "null", updatedInput: null },
    { name: "primitive", updatedInput: "hostile" },
    { name: "array", updatedInput: ["hostile"] },
  ] as const) {
    test(`drops a ${name} updated input`, () => {
      // arrange
      const input = { command: "inspect", keep: "original" };
      const event = {
        type: "tool_call",
        toolCallId: `call-mutate-${name}`,
        toolName: "owner-tool",
        input,
      } satisfies ToolCallEvent;
      const hookOutcome = { kind: "mutate", updatedInput } satisfies HookExecResult;

      // act
      const adaptation = adaptToolCallResult(hookOutcome, event);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(event, {
        type: "tool_call",
        toolCallId: `call-mutate-${name}`,
        toolName: "owner-tool",
        input: { command: "inspect", keep: "original" },
      });
      assert.strictEqual(event.input, input);
      assert.deepStrictEqual(hookOutcome, { kind: "mutate", updatedInput });
    });
  }

  for (const { name, stopOutcome, diagnostic } of [
    {
      name: "its supplied reason",
      stopOutcome: { kind: "stop", stopReason: "halt requested" } as const,
      diagnostic: "[hooks] adaptToolCall: stop ignored (no Pi return slot); reason=halt requested",
    },
    {
      name: "an absent reason",
      stopOutcome: { kind: "stop" } as const,
      diagnostic: "[hooks] adaptToolCall: stop ignored (no Pi return slot); reason=<none>",
    },
  ]) {
    test(`reports a stopped tool call with ${name}`, (t) => {
      // arrange
      const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
      const hadDebug = Object.hasOwn(process.env, debugKey);
      const previousDebug = process.env[debugKey];
      t.after(() => {
        if (hadDebug) {
          process.env[debugKey] = previousDebug;
        } else {
          delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
        }
      });
      process.env[debugKey] = "1";
      const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
      const event = {
        type: "tool_call",
        toolCallId: "call-stop",
        toolName: "owner-tool",
        input: { command: "inspect" },
      } satisfies ToolCallEvent;

      // act
      const adaptation = adaptToolCallResult(stopOutcome, event);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
      assert.deepStrictEqual(event, {
        type: "tool_call",
        toolCallId: "call-stop",
        toolName: "owner-tool",
        input: { command: "inspect" },
      });
    });
  }

  test("rejects a result outside the exhaustive tool-call vocabulary", () => {
    // arrange
    const event = {
      type: "tool_call",
      toolCallId: "call-future",
      toolName: "owner-tool",
      input: { command: "inspect" },
    } satisfies ToolCallEvent;
    const adaptFutureOutcome = (): void => {
      Reflect.apply(adaptToolCallResult, undefined, [{ kind: "future" }, event]);
    };

    // act & assert
    assert.throws(
      adaptFutureOutcome,
      new Error('unreachable HookExecResult arm: {"kind":"future"}'),
    );
  });
});

describe("adaptToolResultResult", () => {
  test("returns undefined for noop without changing the complete event", () => {
    // arrange
    const input = { command: "inspect" };
    const content = [{ type: "text" as const, text: "original output" }];
    const details = { exitCode: 0 };
    const event = {
      type: "tool_result",
      toolCallId: "result-noop",
      toolName: "owner-tool",
      input,
      content,
      isError: false,
      details,
    } satisfies ToolResultEvent;

    // act
    const adaptation = adaptToolResultResult({ kind: "noop" }, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-noop",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.input, input);
    assert.strictEqual(event.content, content);
    assert.strictEqual(event.details, details);
  });

  test("blocks with an error envelope carrying the supplied reason", () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "result-block-reason",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text" as const, text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;

    // act
    const adaptation = adaptToolResultResult({ kind: "block", reason: "policy denied" }, event);

    // assert
    assert.deepStrictEqual(adaptation, {
      isError: true,
      content: [{ type: "text", text: "policy denied" }],
    });
    assert.strictEqual(event.isError, false);
  });

  test("omits optional content when a block has no reason", () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "result-block-absent",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text" as const, text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;

    // act
    const adaptation = adaptToolResultResult({ kind: "block" }, event);

    // assert
    assert.deepStrictEqual(adaptation, { isError: true });
    assert.strictEqual(Object.hasOwn(adaptation, "content"), false);
    assert.strictEqual(event.isError, false);
  });

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
    const hookOutcome = {
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
    const adaptation = adaptToolResultResult(hookOutcome, event);

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
    assert.deepStrictEqual(hookOutcome, {
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

  test("leaves the event unchanged when updated output is absent", () => {
    // arrange
    const content = [{ type: "text" as const, text: "original output" }];
    const event = {
      type: "tool_result",
      toolCallId: "result-mutate-absent",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content,
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;

    // act
    const adaptation = adaptToolResultResult({ kind: "mutate" }, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-mutate-absent",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.content, content);
  });

  for (const { name, updatedToolOutput } of [
    { name: "null", updatedToolOutput: null },
    { name: "primitive", updatedToolOutput: "hostile" },
    { name: "array", updatedToolOutput: ["hostile"] },
  ] as const) {
    test(`drops a ${name} updated output`, () => {
      // arrange
      const content = [{ type: "text" as const, text: "original output" }];
      const event = {
        type: "tool_result",
        toolCallId: `result-mutate-${name}`,
        toolName: "owner-tool",
        input: { command: "inspect" },
        content,
        isError: false,
        details: { exitCode: 0 },
      } satisfies ToolResultEvent;
      const hookOutcome = { kind: "mutate", updatedToolOutput } satisfies HookExecResult;

      // act
      const adaptation = adaptToolResultResult(hookOutcome, event);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(event, {
        type: "tool_result",
        toolCallId: `result-mutate-${name}`,
        toolName: "owner-tool",
        input: { command: "inspect" },
        content: [{ type: "text", text: "original output" }],
        isError: false,
        details: { exitCode: 0 },
      });
      assert.strictEqual(event.content, content);
      assert.strictEqual(Object.hasOwn(event, "0"), false);
      assert.deepStrictEqual(hookOutcome, { kind: "mutate", updatedToolOutput });
    });
  }

  test("drops wrong types for both whitelisted output fields", () => {
    // arrange
    const content = [{ type: "text" as const, text: "original output" }];
    const event = {
      type: "tool_result",
      toolCallId: "result-mutate-wrong-types",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content,
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;
    const hookOutcome = {
      kind: "mutate",
      updatedToolOutput: { content: "hostile", isError: "true" },
    } satisfies HookExecResult;

    // act
    const adaptation = adaptToolResultResult(hookOutcome, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-mutate-wrong-types",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.content, content);
    assert.deepStrictEqual(hookOutcome, {
      kind: "mutate",
      updatedToolOutput: { content: "hostile", isError: "true" },
    });
  });

  test("applies array content while omitting an absent error patch", () => {
    // arrange
    const replacementContent = [{ type: "text" as const, text: "replacement output" }];
    const event = {
      type: "tool_result",
      toolCallId: "result-content-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text" as const, text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;
    const hookOutcome = {
      kind: "mutate",
      updatedToolOutput: { content: replacementContent },
    } satisfies HookExecResult;

    // act
    const adaptation = adaptToolResultResult(hookOutcome, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-content-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "replacement output" }],
      isError: false,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.content, replacementContent);
  });

  test("applies a boolean error patch while omitting absent content", () => {
    // arrange
    const content = [{ type: "text" as const, text: "original output" }];
    const event = {
      type: "tool_result",
      toolCallId: "result-error-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content,
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;

    // act
    const adaptation = adaptToolResultResult(
      { kind: "mutate", updatedToolOutput: { isError: true } },
      event,
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-error-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: true,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.content, content);
  });

  for (const { name, stopOutcome, diagnostic } of [
    {
      name: "its supplied reason",
      stopOutcome: { kind: "stop", stopReason: "halt requested" } as const,
      diagnostic:
        "[hooks] adaptToolResult: stop ignored (no Pi return slot); reason=halt requested",
    },
    {
      name: "an absent reason",
      stopOutcome: { kind: "stop" } as const,
      diagnostic: "[hooks] adaptToolResult: stop ignored (no Pi return slot); reason=<none>",
    },
  ]) {
    test(`reports a stopped tool result with ${name}`, (t) => {
      // arrange
      const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
      const hadDebug = Object.hasOwn(process.env, debugKey);
      const previousDebug = process.env[debugKey];
      t.after(() => {
        if (hadDebug) {
          process.env[debugKey] = previousDebug;
        } else {
          delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
        }
      });
      process.env[debugKey] = "1";
      const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
      const event = {
        type: "tool_result",
        toolCallId: "result-stop",
        toolName: "owner-tool",
        input: { command: "inspect" },
        content: [{ type: "text" as const, text: "original output" }],
        isError: false,
        details: { exitCode: 0 },
      } satisfies ToolResultEvent;

      // act
      const adaptation = adaptToolResultResult(stopOutcome, event);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
      assert.strictEqual(event.isError, false);
    });
  }

  test("rejects a result outside the exhaustive tool-result vocabulary", () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "result-future",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text" as const, text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;
    const adaptFutureOutcome = (): void => {
      Reflect.apply(adaptToolResultResult, undefined, [{ kind: "future" }, event]);
    };

    // act & assert
    assert.throws(
      adaptFutureOutcome,
      new Error('unreachable HookExecResult arm: {"kind":"future"}'),
    );
  });
});

describe("adaptInputResult", () => {
  test("returns undefined for noop without changing the complete input event", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      images: [],
      source: "interactive",
      streamingBehavior: "steer",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult({ kind: "noop" }, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      images: [],
      source: "interactive",
      streamingBehavior: "steer",
    });
  });

  test("handles a blocked input without changing the complete event", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "rpc",
      streamingBehavior: "followUp",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult({ kind: "block", reason: "policy denied" }, event);

    // assert
    assert.deepStrictEqual(adaptation, { action: "handled" });
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "rpc",
      streamingBehavior: "followUp",
    });
  });

  test("transforms input with the exact additional context", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "extension",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "added context" },
      event,
    );

    // assert
    assert.deepStrictEqual(adaptation, { action: "transform", text: "added context" });
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "extension",
    });
  });

  test("preserves an explicitly empty additional context", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "interactive",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult({ kind: "mutate", additionalContext: "" }, event);

    // assert
    assert.deepStrictEqual(adaptation, { action: "transform", text: "" });
  });

  test("returns undefined when additional context is truly absent", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "interactive",
    } satisfies InputEvent;
    const hookOutcome = {
      kind: "mutate",
      updatedInput: { ignored: true },
    } satisfies HookExecResult;

    // act
    const adaptation = adaptInputResult(hookOutcome, event);

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.strictEqual(Object.hasOwn(hookOutcome, "additionalContext"), false);
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "interactive",
    });
  });

  for (const { name, stopOutcome, diagnostic } of [
    {
      name: "its supplied reason",
      stopOutcome: { kind: "stop", stopReason: "halt requested" } as const,
      diagnostic: "[hooks] adaptInput: stop ignored (no Pi return slot); reason=halt requested",
    },
    {
      name: "an absent reason",
      stopOutcome: { kind: "stop" } as const,
      diagnostic: "[hooks] adaptInput: stop ignored (no Pi return slot); reason=<none>",
    },
  ]) {
    test(`reports a stopped input with ${name}`, (t) => {
      // arrange
      const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
      const hadDebug = Object.hasOwn(process.env, debugKey);
      const previousDebug = process.env[debugKey];
      t.after(() => {
        if (hadDebug) {
          process.env[debugKey] = previousDebug;
        } else {
          delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
        }
      });
      process.env[debugKey] = "1";
      const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
      const event = {
        type: "input",
        text: "original prompt",
        source: "interactive",
      } satisfies InputEvent;

      // act
      const adaptation = adaptInputResult(stopOutcome, event);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
      assert.deepStrictEqual(event, {
        type: "input",
        text: "original prompt",
        source: "interactive",
      });
    });
  }

  test("rejects a result outside the exhaustive input vocabulary", () => {
    // arrange
    const event = {
      type: "input",
      text: "original prompt",
      source: "interactive",
    } satisfies InputEvent;
    const adaptFutureOutcome = (): void => {
      Reflect.apply(adaptInputResult, undefined, [{ kind: "future" }, event]);
    };

    // act & assert
    assert.throws(
      adaptFutureOutcome,
      new Error('unreachable HookExecResult arm: {"kind":"future"}'),
    );
  });
});

describe("adaptObservationResultForEvent", () => {
  test("captures ordered SessionStart context with exact plugin provenance", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const firstProvenance = {
      scope: "user",
      marketplace: "user-marketplace",
      pluginId: "first-plugin",
    } as const;
    const secondProvenance = {
      scope: "project",
      marketplace: "project-marketplace",
      pluginId: "second-plugin",
    } as const;

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "first context" },
      "SessionStart",
      firstProvenance,
    );
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "second context" },
      "SessionStart",
      secondProvenance,
    );

    // assert
    assert.deepStrictEqual(pendingSessionStartContextEntries(), [
      {
        context: "first context",
        scope: "user",
        marketplace: "user-marketplace",
        pluginId: "first-plugin",
      },
      {
        context: "second context",
        scope: "project",
        marketplace: "project-marketplace",
        pluginId: "second-plugin",
      },
    ]);
  });

  test("does not capture SessionStart context when it is truly absent", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const provenance = {
      scope: "user",
      marketplace: "owner-marketplace",
      pluginId: "owner-plugin",
    } as const;
    const hookOutcome = {
      kind: "mutate",
      updatedInput: { ignored: true },
    } satisfies HookExecResult;

    // act
    adaptObservationResultForEvent(hookOutcome, "SessionStart", provenance);

    // assert
    assert.strictEqual(Object.hasOwn(hookOutcome, "additionalContext"), false);
    assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
  });

  test("does not capture an empty SessionStart context", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const provenance = {
      scope: "project",
      marketplace: "owner-marketplace",
      pluginId: "owner-plugin",
    } as const;

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "" },
      "SessionStart",
      provenance,
    );

    // assert
    assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
  });

  for (const { eventName, context, scope } of [
    { eventName: "SessionEnd", context: "discarded SessionEnd context", scope: "user" },
    { eventName: "PreCompact", context: "discarded PreCompact context", scope: "project" },
    { eventName: "PostCompact", context: "discarded PostCompact context", scope: "user" },
  ] as const) {
    test(`drops ${eventName} additional context`, (t) => {
      // arrange
      resetRoutingState();
      t.after(() => {
        resetRoutingState();
      });
      const provenance = {
        scope,
        marketplace: `${eventName}-marketplace`,
        pluginId: `${eventName}-plugin`,
      } as const;

      // act
      adaptObservationResultForEvent(
        { kind: "mutate", additionalContext: context },
        eventName,
        provenance,
      );

      // assert
      assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
    });
  }

  test("returns from noop without changing pending state", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const provenance = {
      scope: "user",
      marketplace: "noop-marketplace",
      pluginId: "noop-plugin",
    } as const;

    // act
    adaptObservationResultForEvent({ kind: "noop" }, "SessionStart", provenance);

    // assert
    assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
  });

  for (const { name, eventName, hookOutcome, diagnostic } of [
    {
      name: "blocked observation with its reason",
      eventName: "PreCompact" as const,
      hookOutcome: { kind: "block", reason: "policy denied" } as const,
      diagnostic:
        "[hooks] adaptObservation: block ignored (no Pi return slot); event=PreCompact reason=policy denied",
    },
    {
      name: "blocked observation with an absent reason",
      eventName: "SessionStart" as const,
      hookOutcome: { kind: "block" } as const,
      diagnostic:
        "[hooks] adaptObservation: block ignored (no Pi return slot); event=SessionStart reason=<none>",
    },
    {
      name: "stopped observation with its reason",
      eventName: "PostCompact" as const,
      hookOutcome: { kind: "stop", stopReason: "halt requested" } as const,
      diagnostic:
        "[hooks] adaptObservation: stop ignored (no Pi return slot); event=PostCompact reason=halt requested",
    },
    {
      name: "stopped observation with an absent reason",
      eventName: "SessionEnd" as const,
      hookOutcome: { kind: "stop" } as const,
      diagnostic:
        "[hooks] adaptObservation: stop ignored (no Pi return slot); event=SessionEnd reason=<none>",
    },
  ]) {
    test(`reports a ${name}`, (t) => {
      // arrange
      resetRoutingState();
      t.after(() => {
        resetRoutingState();
      });
      const debugKey = "PI_CLAUDE_MARKETPLACE_DEBUG";
      const hadDebug = Object.hasOwn(process.env, debugKey);
      const previousDebug = process.env[debugKey];
      t.after(() => {
        if (hadDebug) {
          process.env[debugKey] = previousDebug;
        } else {
          delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
        }
      });
      process.env[debugKey] = "1";
      const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
      const provenance = {
        scope: "project",
        marketplace: "diagnostic-marketplace",
        pluginId: "diagnostic-plugin",
      } as const;

      // act
      adaptObservationResultForEvent(hookOutcome, eventName, provenance);

      // assert
      assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
    });
  }

  test("rejects a result outside the exhaustive observation vocabulary", (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const provenance = {
      scope: "user",
      marketplace: "future-marketplace",
      pluginId: "future-plugin",
    } as const;
    const adaptFutureOutcome = (): void => {
      Reflect.apply(adaptObservationResultForEvent, undefined, [
        { kind: "future" },
        "SessionStart",
        provenance,
      ]);
    };

    // act & assert
    assert.throws(
      adaptFutureOutcome,
      new Error('unreachable HookExecResult arm: {"kind":"future"}'),
    );
  });
});
