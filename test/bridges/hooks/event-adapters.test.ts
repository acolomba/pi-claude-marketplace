import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  adaptInputResult,
  adaptObservationResultForEvent,
  adaptPreCompactResult,
  adaptToolCallResult,
  adaptToolResultResult,
  sendDueFollowUpContext,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type {
  FollowUpTurnEnd,
  HookAdapterContext,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type {
  AgentMessage,
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// The declared command of the hook every block below is attributed to.
const GUARD_COMMAND = "$" + "{CLAUDE_PLUGIN_ROOT}/hooks/guard.sh";

function guardEntry(): RoutingEntry {
  return {
    scope: "project",
    marketplace: "fixtures",
    pluginId: "demo",
    resolvedSource: asAbsolutePluginRoot("/plugins/demo"),
    claudeEvent: "PreToolUse",
    matcher: parseMatcher("Bash"),
    rawMatcher: "Bash",
    handlerDecl: { type: "command", command: GUARD_COMMAND },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

// The adapters read only the context's `mode` and, in a terminal, its
// confirm dialog, so a context with those two members stands in for Pi's.
// Without a terminal, reading `ui` fails the case: no dialog may open there.
function headlessContext(mode: "rpc" | "json" | "print"): ExtensionContext {
  return {
    mode,
    get ui(): ExtensionContext["ui"] {
      throw new Error("no dialog opens without a terminal");
    },
  } as ExtensionContext;
}

// A terminal context whose confirm dialog answers through `confirm`.
function terminalContext(confirm: ExtensionContext["ui"]["confirm"]): ExtensionContext {
  return { mode: "tui", ui: { confirm } } as ExtensionContext;
}

function adapterContext(attributedTo: RoutingEntry | undefined): HookAdapterContext {
  return {
    runtime: createHooksRuntime(),
    ctx: headlessContext("print"),
    pi: undefined,
    attributedTo,
  };
}

// A context attributed to an entry of the given plugin, over `runtime`.
function provenanceContext(
  runtime: HookAdapterContext["runtime"],
  provenance: Pick<RoutingEntry, "scope" | "marketplace" | "pluginId">,
): HookAdapterContext {
  return { ...adapterContext({ ...guardEntry(), ...provenance }), runtime };
}

interface SentMessage {
  readonly message: unknown;
  readonly options: unknown;
}

/** A Pi API that records every message an adapter sends, or throws `failure` on a send. */
function createMessagePi(sent: SentMessage[], failure?: Error): ExtensionAPI {
  return {
    sendMessage(message: unknown, options: unknown): void {
      if (failure !== undefined) {
        throw failure;
      }

      sent.push({ message, options });
    },
  } as ExtensionAPI;
}

describe("adaptToolCallResult", () => {
  function bashCall(input: Record<string, unknown>): ToolCallEvent {
    return { type: "tool_call", toolCallId: "call-bash", toolName: "bash", input };
  }

  test("returns undefined for noop without changing the complete event", async () => {
    // arrange
    const input = { command: "inspect", keep: "original" };
    const event = bashCall(input);

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "noop" },
      event,
      adapterContext(guardEntry()),
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, bashCall({ command: "inspect", keep: "original" }));
    assert.strictEqual(event.input, input);
  });

  for (const { name, hookOutcome, reason } of [
    {
      name: "a JSON reason as the hook error",
      hookOutcome: { kind: "block", reason: "no echo" } as const,
      reason: "PreToolUse:Bash hook error: no echo",
    },
    {
      name: "an exit-2 stderr reason after the hook's bracketed command",
      hookOutcome: { kind: "block", reason: "blocked by policy", fromStderr: true } as const,
      reason: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: blocked by policy`,
    },
    {
      name: "an onFailure reason without bracketing its command again",
      hookOutcome: {
        kind: "block",
        reason: `[${GUARD_COMMAND}]: failed; blocking because onFailure is "block"\nboom`,
      } as const,
      reason: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: failed; blocking because onFailure is "block"\nboom`,
    },
    {
      name: "Claude Code's default for a decision without a reason",
      hookOutcome: { kind: "block" } as const,
      reason: "PreToolUse:Bash hook error: Blocked by hook",
    },
    {
      name: "Claude Code's default for an exit 2 without stderr",
      hookOutcome: { kind: "block", fromStderr: true } as const,
      reason: `PreToolUse:Bash hook error: [${GUARD_COMMAND}]: No stderr output`,
    },
  ]) {
    test(`blocks a bash call with ${name} (D-CF5-11)`, async () => {
      // arrange
      const event = bashCall({ command: "echo from-model" });

      // act
      const adaptation = await adaptToolCallResult(
        hookOutcome,
        event,
        adapterContext(guardEntry()),
      );

      // assert
      assert.deepStrictEqual(adaptation, { block: true, reason });
      assert.deepStrictEqual(event, bashCall({ command: "echo from-model" }));
    });
  }

  test("names an empty command for a block attributed to no hook", async () => {
    // arrange
    const event = {
      type: "tool_call",
      toolCallId: "call-block-unattributed",
      toolName: "read",
      input: { path: "notes.md" },
    } satisfies ToolCallEvent;

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "block", reason: "denied", fromStderr: true },
      event,
      adapterContext(undefined),
    );

    // assert
    assert.deepStrictEqual(adaptation, {
      block: true,
      reason: "PreToolUse:Read hook error: []: denied",
    });
  });

  test("replaces the whole input with an allowed rewrite (D-CF5-11)", async () => {
    // arrange
    const input = { command: "echo from-model", timeout: 30 };
    const event = bashCall(input);
    const hookOutcome = {
      kind: "mutate",
      permissionDecision: "allow",
      updatedInput: { command: "echo rewritten" },
    } satisfies HookExecResult;

    // act
    const adaptation = await adaptToolCallResult(hookOutcome, event, adapterContext(guardEntry()));

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, bashCall({ command: "echo rewritten" }));
    assert.strictEqual(event.input, input);
    assert.deepStrictEqual(hookOutcome.updatedInput, { command: "echo rewritten" });
  });

  test("drops a __proto__ key from the rewrite without polluting the input's prototype", async () => {
    // arrange
    const input = { command: "inspect", keep: "original" };
    const event = bashCall(input);
    const updatedInput = JSON.parse(
      '{"__proto__":{"polluted":true},"command":"replacement"}',
    ) as Record<string, unknown>;

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "mutate", updatedInput },
      event,
      adapterContext(guardEntry()),
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, bashCall({ command: "replacement" }));
    assert.strictEqual(event.input, input);
    assert.strictEqual(Object.getPrototypeOf(event.input), Object.prototype);
    assert.strictEqual(Object.hasOwn(event.input, "__proto__"), false);
    assert.strictEqual((Object.prototype as Record<string, unknown>).polluted, undefined);
  });

  for (const { name, updatedInput } of [
    { name: "an absent", updatedInput: undefined },
    { name: "a null", updatedInput: null },
    { name: "a primitive", updatedInput: "hostile" },
    { name: "an array", updatedInput: ["hostile"] },
  ] as const) {
    test(`leaves the input unchanged for ${name} rewrite`, async () => {
      // arrange
      const input = { command: "inspect", keep: "original" };
      const event = bashCall(input);
      const hookOutcome: HookExecResult =
        updatedInput === undefined ? { kind: "mutate" } : { kind: "mutate", updatedInput };

      // act
      const adaptation = await adaptToolCallResult(
        hookOutcome,
        event,
        adapterContext(guardEntry()),
      );

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(event, bashCall({ command: "inspect", keep: "original" }));
      assert.strictEqual(event.input, input);
    });
  }

  for (const mode of ["rpc", "json", "print"] as const) {
    test(`blocks an ask with its reason without a dialog in ${mode} mode (D-CF5-11)`, async () => {
      // arrange
      const event = bashCall({ command: "echo from-model" });
      const hookOutcome = {
        kind: "mutate",
        permissionDecision: "ask",
        permissionDecisionReason: "please confirm",
        updatedInput: { command: "echo rewritten" },
      } satisfies HookExecResult;

      // act
      const adaptation = await adaptToolCallResult(hookOutcome, event, {
        ...adapterContext(guardEntry()),
        ctx: headlessContext(mode),
      });

      // assert
      assert.deepStrictEqual(adaptation, { block: true, reason: "please confirm" });
      assert.deepStrictEqual(event, bashCall({ command: "echo from-model" }));
    });
  }

  test("blocks an ask without a reason as Pi's default block", async () => {
    // act
    const adaptation = await adaptToolCallResult(
      { kind: "mutate", permissionDecision: "ask" },
      bashCall({ command: "echo from-model" }),
      adapterContext(guardEntry()),
    );

    // assert
    assert.deepStrictEqual(adaptation, { block: true });
  });

  for (const { answer, adaptation, input } of [
    {
      answer: false,
      adaptation: { block: true, reason: "please confirm" },
      input: { command: "echo from-model" },
    },
    { answer: true, adaptation: undefined, input: { command: "echo rewritten" } },
  ]) {
    test(`asks in the terminal and ${answer ? "allows the rewrite" : "blocks"} when the user answers ${String(answer)}`, async (t) => {
      // arrange
      const confirm = t.mock.fn((_title: string, _message: string) => Promise.resolve(answer));
      const event = bashCall({ command: "echo from-model" });
      const hookOutcome = {
        kind: "mutate",
        permissionDecision: "ask",
        permissionDecisionReason: "please confirm",
        updatedInput: { command: "echo rewritten" },
      } satisfies HookExecResult;

      // act
      const adapted = await adaptToolCallResult(hookOutcome, event, {
        ...adapterContext(guardEntry()),
        ctx: terminalContext(confirm),
      });

      // assert
      assert.deepStrictEqual(adapted, adaptation);
      assert.deepStrictEqual(event, bashCall(input));
      assert.deepStrictEqual(
        confirm.mock.calls.map((call) => call.arguments),
        [["PreToolUse:Bash hook asks to allow this call", "please confirm"]],
      );
    });
  }

  test("asks in the terminal with a default question for an ask without a reason", async (t) => {
    // arrange
    const confirm = t.mock.fn((_title: string, _message: string) => Promise.resolve(true));

    // act
    const adapted = await adaptToolCallResult(
      { kind: "mutate", permissionDecision: "ask" },
      bashCall({ command: "echo from-model" }),
      { ...adapterContext(guardEntry()), ctx: terminalContext(confirm) },
    );

    // assert
    assert.strictEqual(adapted, undefined);
    assert.deepStrictEqual(
      confirm.mock.calls.map((call) => call.arguments),
      [["PreToolUse:Bash hook asks to allow this call", "Allow this tool call?"]],
    );
  });

  for (const { name, stopOutcome, reason } of [
    {
      name: "its reason",
      stopOutcome: { kind: "stop", stopReason: "halt" } as const,
      reason: "halt",
    },
    {
      name: "the default reason",
      stopOutcome: { kind: "stop" } as const,
      reason: "Operation stopped by hook",
    },
  ]) {
    test(`blocks a stopped tool call with ${name} and ends the turn (D-CF5-11)`, async () => {
      // arrange
      const event = bashCall({ command: "echo from-model" });

      // act
      const adaptation = await adaptToolCallResult(
        stopOutcome,
        event,
        adapterContext(guardEntry()),
      );

      // assert
      assert.deepStrictEqual(adaptation, { block: true, reason, terminate: true });
      assert.deepStrictEqual(event, bashCall({ command: "echo from-model" }));
    });
  }
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
    const adaptation = adaptToolResultResult({ kind: "noop" }, event, adapterContext(guardEntry()));

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

  for (const { name, isError, hookOutcome, feedback } of [
    {
      name: "a PostToolUse block reason",
      isError: false,
      hookOutcome: { kind: "block", reason: "check the output" } as const,
      feedback: `PostToolUse:Bash hook blocking error from command: "${GUARD_COMMAND}": check the output`,
    },
    {
      name: "a PostToolUseFailure exit-2 stderr reason",
      isError: true,
      hookOutcome: { kind: "block", reason: "look again", fromStderr: true } as const,
      feedback: `PostToolUseFailure:Bash hook blocking error from command: "${GUARD_COMMAND}": [${GUARD_COMMAND}]: look again`,
    },
    {
      name: "Claude Code's default for a block without a reason",
      isError: false,
      hookOutcome: { kind: "block" } as const,
      feedback: `PostToolUse:Bash hook blocking error from command: "${GUARD_COMMAND}": Blocked by hook`,
    },
  ]) {
    test(`keeps the tool output and adds the feedback of ${name} (D-CF5-11)`, () => {
      // arrange
      const event = {
        type: "tool_result",
        toolCallId: "result-block",
        toolName: "bash",
        input: { command: "echo from-model" },
        content: [{ type: "text" as const, text: "from-model\n" }],
        isError,
        details: { exitCode: 0 },
      } satisfies ToolResultEvent;

      // act
      const adaptation = adaptToolResultResult(hookOutcome, event, adapterContext(guardEntry()));

      // assert
      assert.deepStrictEqual(adaptation, {
        content: [
          { type: "text", text: "from-model\n" },
          { type: "text", text: feedback },
        ],
      });
      assert.deepStrictEqual(event.content, [{ type: "text", text: "from-model\n" }]);
      assert.strictEqual(event.isError, isError);
    });
  }

  test("returns only whitelisted tool-result fields as the Pi tool_result value", () => {
    // arrange
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
    const adaptation = adaptToolResultResult(hookOutcome, event, adapterContext(guardEntry()));

    // assert
    assert.deepStrictEqual(adaptation, {
      content: [{ type: "text", text: "replacement output" }],
      isError: true,
    });
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "call-original",
      toolName: "trusted-tool",
      input: { command: "inspect owner" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
      details: { exitCode: 0, routeToken: "details-original" },
      route: {
        scope: "project",
        marketplace: "trusted-marketplace",
        pluginId: "trusted-plugin",
      },
    });
    assert.strictEqual(event, eventIdentity);
    assert.strictEqual(event.input, input);
    assert.strictEqual(event.content, originalContent);
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
    const adaptation = adaptToolResultResult(
      { kind: "mutate" },
      event,
      adapterContext(guardEntry()),
    );

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
      const adaptation = adaptToolResultResult(hookOutcome, event, adapterContext(guardEntry()));

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
    const adaptation = adaptToolResultResult(hookOutcome, event, adapterContext(guardEntry()));

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

  test("returns array content without an error field when the patch has none", () => {
    // arrange
    const replacementContent = [{ type: "text" as const, text: "replacement output" }];
    const content = [{ type: "text" as const, text: "original output" }];
    const event = {
      type: "tool_result",
      toolCallId: "result-content-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content,
      isError: false,
      details: { exitCode: 0 },
    } satisfies ToolResultEvent;
    const hookOutcome = {
      kind: "mutate",
      updatedToolOutput: { content: replacementContent },
    } satisfies HookExecResult;

    // act
    const adaptation = adaptToolResultResult(hookOutcome, event, adapterContext(guardEntry()));

    // assert
    assert.deepStrictEqual(adaptation, {
      content: [{ type: "text", text: "replacement output" }],
    });
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-content-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
      details: { exitCode: 0 },
    });
    assert.strictEqual(event.content, content);
  });

  test("returns a boolean error patch without content when the patch has none", () => {
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
      adapterContext(guardEntry()),
    );

    // assert
    assert.deepStrictEqual(adaptation, { isError: true });
    assert.deepStrictEqual(event, {
      type: "tool_result",
      toolCallId: "result-error-only",
      toolName: "owner-tool",
      input: { command: "inspect" },
      content: [{ type: "text", text: "original output" }],
      isError: false,
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
      const adaptation = adaptToolResultResult(stopOutcome, event, adapterContext(guardEntry()));

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
      assert.strictEqual(event.isError, false);
    });
  }
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
    const adaptation = adaptInputResult({ kind: "noop" }, event, adapterContext(guardEntry()));

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
    const adaptation = adaptInputResult(
      { kind: "block", reason: "policy denied" },
      event,
      adapterContext(guardEntry()),
    );

    // assert
    assert.deepStrictEqual(adaptation, { action: "handled" });
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "rpc",
      streamingBehavior: "followUp",
    });
  });

  test("buffers the additional context with its plugin and lets the prompt continue (D-CF5-13)", () => {
    // arrange
    const runtime = createHooksRuntime();
    const event = {
      type: "input",
      text: "original prompt",
      source: "extension",
    } satisfies InputEvent;
    const context = provenanceContext(runtime, {
      scope: "user",
      marketplace: "owner-marketplace",
      pluginId: "owner-plugin",
    });

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "ctx-a\nctx-b" },
      event,
      context,
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "extension",
    });
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [
      {
        context: "ctx-a\nctx-b",
        scope: "user",
        marketplace: "owner-marketplace",
        pluginId: "owner-plugin",
      },
    ]);
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  test("sends the context of a queued steer to the model instead of buffering it (D-CF5-13)", () => {
    // arrange
    const runtime = createHooksRuntime();
    const sent: SentMessage[] = [];
    const event = {
      type: "input",
      text: "queued prompt",
      source: "rpc",
      streamingBehavior: "steer",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "ctx-a\nctx-b" },
      event,
      { ...adapterContext(guardEntry()), runtime, pi: createMessagePi(sent) },
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(sent, [
      {
        message: {
          customType: "claude-hook-additional-context",
          content: [
            { type: "text", text: "UserPromptSubmit hook additional context: ctx-a\nctx-b" },
          ],
          display: false,
        },
        options: { triggerTurn: false },
      },
    ]);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
    assert.deepStrictEqual(runtime.drainFollowUpContext(), []);
  });

  test("queues the context of a queued follow-up for the turn that reads it (D-CF5-13)", () => {
    // arrange
    const runtime = createHooksRuntime();
    const sent: SentMessage[] = [];
    const event = {
      type: "input",
      text: "queued prompt",
      source: "rpc",
      streamingBehavior: "followUp",
    } satisfies InputEvent;
    const context = {
      ...provenanceContext(runtime, {
        scope: "user",
        marketplace: "owner-marketplace",
        pluginId: "owner-plugin",
      }),
      pi: createMessagePi(sent),
    };

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "ctx-a\nctx-b" },
      event,
      context,
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(sent, []);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
    assert.deepStrictEqual(runtime.drainFollowUpContext(), [
      {
        context: "ctx-a\nctx-b",
        scope: "user",
        marketplace: "owner-marketplace",
        pluginId: "owner-plugin",
        prompt: "queued prompt",
      },
    ]);
  });

  test("sends no blank context of a queued steer", () => {
    // arrange
    const runtime = createHooksRuntime();
    const sent: SentMessage[] = [];

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: " \n " },
      { type: "input", text: "queued prompt", source: "rpc", streamingBehavior: "steer" },
      { ...adapterContext(guardEntry()), runtime, pi: createMessagePi(sent) },
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(sent, []);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
  });

  test("buffers no context of a queued steer when no Pi API can send it", () => {
    // arrange
    const runtime = createHooksRuntime();

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "ctx" },
      { type: "input", text: "queued prompt", source: "rpc", streamingBehavior: "steer" },
      { ...adapterContext(guardEntry()), runtime },
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
  });

  test("lets a queued steer continue when sending its context throws", (t) => {
    // arrange
    const runtime = createHooksRuntime();
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

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "ctx" },
      { type: "input", text: "queued prompt", source: "rpc", streamingBehavior: "steer" },
      { ...adapterContext(guardEntry()), runtime, pi: createMessagePi([], new Error("closed")) },
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
    assert.deepStrictEqual(
      consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
      [["[hooks] adaptInput: queued prompt context failed: closed"]],
    );
  });

  test("buffers no empty additional context and lets the prompt continue", () => {
    // arrange
    const runtime = createHooksRuntime();
    const event = {
      type: "input",
      text: "original prompt",
      source: "interactive",
    } satisfies InputEvent;

    // act
    const adaptation = adaptInputResult({ kind: "mutate", additionalContext: "" }, event, {
      ...adapterContext(guardEntry()),
      runtime,
    });

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
  });

  for (const { name, hookOutcome } of [
    {
      name: "block",
      hookOutcome: { kind: "block", reason: "policy denied", additionalContext: "ctx" } as const,
    },
    {
      name: "continue false",
      hookOutcome: { kind: "stop", stopReason: "halt", additionalContext: "ctx" } as const,
    },
  ]) {
    test(`buffers no additional context of a ${name} that stops the prompt (HOOK-05)`, () => {
      // arrange
      const runtime = createHooksRuntime();
      const event = {
        type: "input",
        text: "original prompt",
        source: "interactive",
      } satisfies InputEvent;

      // act
      const adaptation = adaptInputResult(hookOutcome, event, {
        ...adapterContext(guardEntry()),
        runtime,
      });

      // assert
      assert.deepStrictEqual(adaptation, { action: "handled" });
      assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
    });
  }

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
    const adaptation = adaptInputResult(hookOutcome, event, adapterContext(guardEntry()));

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.strictEqual(Object.hasOwn(hookOutcome, "additionalContext"), false);
    assert.deepStrictEqual(event, {
      type: "input",
      text: "original prompt",
      source: "interactive",
    });
  });

  for (const { name, stopOutcome } of [
    { name: "its reason", stopOutcome: { kind: "stop", stopReason: "halt requested" } as const },
    { name: "no reason", stopOutcome: { kind: "stop" } as const },
  ]) {
    test(`stops the prompt for a continue false with ${name} (D-CF5-11)`, () => {
      // arrange
      const event = {
        type: "input",
        text: "original prompt",
        source: "interactive",
      } satisfies InputEvent;

      // act
      const adaptation = adaptInputResult(stopOutcome, event, adapterContext(guardEntry()));

      // assert
      assert.deepStrictEqual(adaptation, { action: "handled" });
      assert.deepStrictEqual(event, {
        type: "input",
        text: "original prompt",
        source: "interactive",
      });
    });
  }
});

describe("sendDueFollowUpContext", () => {
  const FOLLOW_UP_CONTEXT = {
    context: "follow-up context",
    scope: "project",
    marketplace: "fixtures",
    pluginId: "demo",
    prompt: "also say hi",
  } as const;

  function assistantTurn(
    content: readonly object[],
    stopReason: "stop" | "toolUse" | "error" | "aborted" = "stop",
  ): AgentMessage {
    return { role: "assistant", content, stopReason, timestamp: 1 } as unknown as AgentMessage;
  }

  function userMessage(content: string | readonly object[]): AgentMessage {
    return { role: "user", content, timestamp: 2 } as unknown as AgentMessage;
  }

  function turnEnd(
    message: AgentMessage,
    pendingMessages: readonly AgentMessage[],
  ): FollowUpTurnEnd {
    return { message, context: { pendingMessages } };
  }

  const DONE = assistantTurn([{ type: "text", text: "Done." }]);
  const FOLLOW_UP = userMessage([{ type: "text", text: "also say hi" }]);

  for (const { name, follows } of [
    { name: "a text part", follows: FOLLOW_UP },
    { name: "a string", follows: userMessage("also say hi") },
    {
      name: "a text part beside an image",
      follows: userMessage([
        { type: "text", text: "also say hi" },
        { type: "image", data: "", mimeType: "image/png" },
      ]),
    },
  ]) {
    test(`sends the follow-up's context when the agent reads that follow-up next, given as ${name}`, () => {
      // arrange
      const runtime = createHooksRuntime();
      const sent: SentMessage[] = [];
      runtime.queueFollowUpContext(FOLLOW_UP_CONTEXT);

      // act
      sendDueFollowUpContext(turnEnd(DONE, [follows]), runtime, createMessagePi(sent));

      // assert
      assert.deepStrictEqual(sent, [
        {
          message: {
            customType: "claude-hook-additional-context",
            content: [
              { type: "text", text: "UserPromptSubmit hook additional context: follow-up context" },
            ],
            display: false,
          },
          options: { triggerTurn: false },
        },
      ]);
      assert.deepStrictEqual(runtime.drainFollowUpContext(), []);
    });
  }

  for (const { name, turn } of [
    {
      name: "the turn ends with a tool call",
      turn: turnEnd(
        assistantTurn([{ type: "toolCall", id: "c1", name: "bash", arguments: {} }], "toolUse"),
        [FOLLOW_UP],
      ),
    },
    { name: "the turn ends in an error", turn: turnEnd(assistantTurn([], "error"), [FOLLOW_UP]) },
    { name: "the turn is aborted", turn: turnEnd(assistantTurn([], "aborted"), [FOLLOW_UP]) },
    {
      name: "another prompt comes next",
      turn: turnEnd(DONE, [userMessage([{ type: "text", text: "a steer" }])]),
    },
    {
      name: "a custom message comes next",
      turn: turnEnd(DONE, [
        {
          role: "custom",
          customType: "x",
          content: "also say hi",
          display: false,
          timestamp: 3,
        } as unknown as AgentMessage,
      ]),
    },
    { name: "nothing is queued", turn: turnEnd(DONE, []) },
    {
      name: "the turn ends on a message that is not the model's",
      turn: turnEnd(FOLLOW_UP, [FOLLOW_UP]),
    },
  ]) {
    test(`keeps the follow-up's context while ${name}`, () => {
      // arrange
      const runtime = createHooksRuntime();
      const sent: SentMessage[] = [];
      runtime.queueFollowUpContext(FOLLOW_UP_CONTEXT);

      // act
      sendDueFollowUpContext(turn, runtime, createMessagePi(sent));

      // assert
      assert.deepStrictEqual(sent, []);
      assert.deepStrictEqual(runtime.drainFollowUpContext(), [FOLLOW_UP_CONTEXT]);
    });
  }
});

describe("adaptObservationResultForEvent", () => {
  test("captures ordered SessionStart context with exact plugin provenance", () => {
    // arrange
    const runtime = createHooksRuntime();
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
      provenanceContext(runtime, firstProvenance),
    );
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "second context" },
      "SessionStart",
      provenanceContext(runtime, secondProvenance),
    );

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), [
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

  test("does not capture SessionStart context when it is truly absent", () => {
    // arrange
    const runtime = createHooksRuntime();
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
    adaptObservationResultForEvent(
      hookOutcome,
      "SessionStart",
      provenanceContext(runtime, provenance),
    );

    // assert
    assert.strictEqual(Object.hasOwn(hookOutcome, "additionalContext"), false);
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  test("does not capture an empty SessionStart context", () => {
    // arrange
    const runtime = createHooksRuntime();
    const provenance = {
      scope: "project",
      marketplace: "owner-marketplace",
      pluginId: "owner-plugin",
    } as const;

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "" },
      "SessionStart",
      provenanceContext(runtime, provenance),
    );

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  for (const { eventName, context, scope } of [
    { eventName: "SessionEnd", context: "discarded SessionEnd context", scope: "user" },
    { eventName: "PostCompact", context: "discarded PostCompact context", scope: "user" },
  ] as const) {
    test(`drops ${eventName} additional context`, () => {
      // arrange
      const runtime = createHooksRuntime();
      const provenance = {
        scope,
        marketplace: `${eventName}-marketplace`,
        pluginId: `${eventName}-plugin`,
      } as const;

      // act
      adaptObservationResultForEvent(
        { kind: "mutate", additionalContext: context },
        eventName,
        provenanceContext(runtime, provenance),
      );

      // assert
      assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
    });
  }

  test("captures SessionStart context that no entry is attributed to under an empty provenance", () => {
    // arrange
    const runtime = createHooksRuntime();

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "orphan context" },
      "SessionStart",
      { ...adapterContext(undefined), runtime },
    );

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), [
      { context: "orphan context", scope: "user", marketplace: "", pluginId: "" },
    ]);
  });

  for (const { arm, hookOutcome } of [
    {
      arm: "blocks",
      hookOutcome: { kind: "block", reason: "denied", additionalContext: "kept context" } as const,
    },
    {
      arm: "stops",
      hookOutcome: { kind: "stop", stopReason: "halt", additionalContext: "kept context" } as const,
    },
    { arm: "is a noop", hookOutcome: { kind: "noop", additionalContext: "kept context" } as const },
  ]) {
    test(`captures the SessionStart context of a fold that ${arm} (D-CF5-09)`, () => {
      // arrange
      const runtime = createHooksRuntime();
      const provenance = {
        scope: "project",
        marketplace: "owner-marketplace",
        pluginId: "owner-plugin",
      } as const;

      // act
      adaptObservationResultForEvent(
        hookOutcome,
        "SessionStart",
        provenanceContext(runtime, provenance),
      );

      // assert
      assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), [
        {
          context: "kept context",
          scope: "project",
          marketplace: "owner-marketplace",
          pluginId: "owner-plugin",
        },
      ]);
    });
  }

  test("drops the PostCompact context of a fold that blocks", () => {
    // arrange
    const runtime = createHooksRuntime();
    const provenance = {
      scope: "project",
      marketplace: "owner-marketplace",
      pluginId: "owner-plugin",
    } as const;

    // act
    adaptObservationResultForEvent(
      { kind: "block", reason: "denied", additionalContext: "dropped context" },
      "PostCompact",
      provenanceContext(runtime, provenance),
    );

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  test("returns from noop without changing pending state", () => {
    // arrange
    const runtime = createHooksRuntime();
    const provenance = {
      scope: "user",
      marketplace: "noop-marketplace",
      pluginId: "noop-plugin",
    } as const;

    // act
    adaptObservationResultForEvent(
      { kind: "noop" },
      "SessionStart",
      provenanceContext(runtime, provenance),
    );

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  for (const { name, eventName, hookOutcome, diagnostic } of [
    {
      name: "blocked observation with its reason",
      eventName: "PostCompact" as const,
      hookOutcome: { kind: "block", reason: "policy denied" } as const,
      diagnostic:
        "[hooks] adaptObservation: block ignored (no Pi return slot); event=PostCompact reason=policy denied",
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
      const runtime = createHooksRuntime();
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
      adaptObservationResultForEvent(
        hookOutcome,
        eventName,
        provenanceContext(runtime, provenance),
      );

      // assert
      assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
    });
  }
});

describe("adaptPreCompactResult", () => {
  test("cancels the compaction for a block, as Claude Code does", () => {
    // act
    const adaptation = adaptPreCompactResult([{ kind: "block", reason: "keep the history" }]);

    // assert
    assert.deepStrictEqual(adaptation, { cancel: true });
  });

  test("cancels the compaction for a block that another hook's stop precedes", () => {
    // act
    const adaptation = adaptPreCompactResult([
      { kind: "stop", stopReason: "halt requested" },
      { kind: "noop" },
      { kind: "block", reason: "keep the history" },
    ]);

    // assert
    assert.deepStrictEqual(adaptation, { cancel: true });
  });

  for (const hookOutcomes of [
    [],
    [{ kind: "noop" }],
    [{ kind: "noop" }, { kind: "mutate", additionalContext: "dropped" }],
  ] satisfies HookExecResult[][]) {
    test(`lets the compaction run for ${JSON.stringify(hookOutcomes.map(({ kind }) => kind))}`, () => {
      // act
      const adaptation = adaptPreCompactResult(hookOutcomes);

      // assert
      assert.strictEqual(adaptation, undefined);
    });
  }

  for (const { name, hookOutcome, diagnostic } of [
    {
      name: "its reason",
      hookOutcome: { kind: "stop", stopReason: "halt requested" } as const,
      diagnostic: "[hooks] adaptPreCompact: stop ignored; reason=halt requested",
    },
    {
      name: "no reason",
      hookOutcome: { kind: "stop" } as const,
      diagnostic: "[hooks] adaptPreCompact: stop ignored; reason=<none>",
    },
  ]) {
    test(`lets the compaction run for a stop with ${name} and reports it`, (t) => {
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

      // act
      const adaptation = adaptPreCompactResult([{ kind: "noop" }, hookOutcome]);

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        [[diagnostic]],
      );
    });
  }
});
