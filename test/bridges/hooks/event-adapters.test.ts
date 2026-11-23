import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  adaptInputResult,
  adaptObservationResultForEvent,
  adaptPreCompactResult,
  adaptToolCallResult,
  adaptToolResultResult,
  hookContextPart,
  sendDueFollowUpContext,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import type {
  FollowUpTurnEnd,
  HookAdapterContext,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { ClaudeSessionStartEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { SessionStartSource } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
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
    options: resolveOptions(undefined),
  };
}

// The adapters read only the context's `mode` and, in a terminal, its
// confirm dialog, so a context with those two members stands in for Pi's.
// Without a terminal, reading `ui` fails the case: no dialog may open there.
function headlessContext(mode: "rpc" | "json" | "print"): ExtensionContext {
  return {
    mode,
    cwd: "/work",
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

/**
 * The hidden message that carries SessionStart hook values to the model,
 * with the values in its details (HKRL-01, HKRL-02), sent with `options`
 * (HKRL-03).
 */
function sessionStartContextMessage(
  values: readonly string[],
  options: unknown = { triggerTurn: false },
): SentMessage {
  return {
    message: {
      customType: "claude-hook-additional-context",
      content: [sessionStartPart(values)],
      display: false,
      details: { event: "SessionStart", values },
    },
    options,
  };
}

// The labeled text part of a SessionStart context message.
function sessionStartPart(values: readonly string[]): {
  readonly type: "text";
  readonly text: string;
} {
  return { type: "text", text: `SessionStart hook additional context: ${values.join("\n")}` };
}

/** What the SessionStart dispatch passes the adapter: its Claude event and every hook's value. */
interface SessionStartDispatch {
  readonly event: ClaudeSessionStartEvent;
  readonly values: readonly string[];
}

// `nextCallInRun` stands for the compaction leg's delivery hint (HKRL-03).
function sessionStartDispatch(
  source: SessionStartSource,
  values: readonly string[],
  nextCallInRun?: boolean,
): SessionStartDispatch {
  return {
    event: nextCallInRun === undefined ? { source } : { source, nextCallInRun },
    values,
  };
}

type SessionAppend = (sessionManager: SessionManager) => void;

// A print context whose session holds what `append` adds, as a resumed or
// forked session holds its earlier conversation. Assigning keeps the
// throwing `ui` getter, which a spread would read.
function heldSession(append: SessionAppend): ExtensionContext {
  const sessionManager = SessionManager.inMemory("/work", { id: "adapter-held-session" });
  append(sessionManager);
  return Object.assign(headlessContext("print"), { sessionManager });
}

// A print context whose session cannot be read, as after Pi replaced it.
function unreadableSession(): ExtensionContext {
  const sessionManager = Object.assign(
    SessionManager.inMemory("/work", { id: "adapter-unreadable-session" }),
    {
      buildSessionProjection(): never {
        throw new Error("session closed");
      },
    },
  );
  return Object.assign(headlessContext("print"), { sessionManager });
}

// A held custom message of `customType` with `content` and `details`; an
// absent `details` stands for a message written before details existed.
function heldMessage(
  content: Parameters<SessionManager["appendCustomMessageEntry"]>[1],
  details?: unknown,
  customType = "claude-hook-additional-context",
): SessionAppend {
  return (sessionManager) => {
    sessionManager.appendCustomMessageEntry(customType, content, false, details);
  };
}

// A held SessionStart context message that carries `values` in its details.
function heldDetails(values: readonly string[]): SessionAppend {
  return heldMessage([sessionStartPart(values)], { event: "SessionStart", values });
}

// The wrapper `context-cap.ts` gives a context saved to the file `path`.
function savedOutput(path: string): string {
  return [
    "<persisted-output>",
    `Output too large (11.7KB). Full output saved to: ${path}`,
    "",
    "Preview (first 2KB):",
    "saved preview",
    "...",
    "</persisted-output>",
  ].join("\n");
}

// Runs the SessionStart adapter for `start` over a session that holds what
// `append` adds, with a fold whose context joins the values as the fold
// builds it, and returns the messages it sends.
function sendOverHeldSession(append: SessionAppend, start: SessionStartDispatch): SentMessage[] {
  const sent: SentMessage[] = [];
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: start.values.join("\n") },
    "SessionStart",
    { ...adapterContext(guardEntry()), ctx: heldSession(append), pi: createMessagePi(sent) },
    start,
  );
  return sent;
}

describe("adaptToolCallResult", () => {
  for (const mode of ["tui", "print", "json", "rpc"] as const) {
    test(`sends one private ignored-rewrite notice through ${mode}`, async () => {
      // arrange
      const capture = createJsonCapture();
      const notifications: Array<[string, string | undefined]> = [];
      const input = { path: "original.txt", offset: 1 };
      const event = {
        type: "tool_call",
        toolCallId: "call-read",
        toolName: "read",
        input,
      } satisfies ToolCallEvent;
      const ctx = {
        mode,
        cwd: "/workspace",
        ui: {
          notify(message: string, severity?: string): void {
            notifications.push([message, severity]);
          },
        },
      } as ExtensionContext;
      const context: HookAdapterContext = {
        ...adapterContext(guardEntry()),
        ctx,
        pi: { appendEntry: capture.entrySink.appendEntry } as ExtensionAPI,
      };

      // act
      const adaptation = await adaptToolCallResult(
        { kind: "mutate", updatedInput: { file_path: "replacement.txt", pages: "secret-value" } },
        event,
        context,
      );

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.strictEqual(event.input, input);
      assert.deepStrictEqual(input, { path: "original.txt", offset: 1 });
      if (mode === "tui" || mode === "print") {
        assert.deepStrictEqual(notifications, [
          ["PreToolUse:Read ignored input rewrite (field)", "info"],
        ]);
        assert.deepStrictEqual(capture.entries, []);
      } else {
        assert.deepStrictEqual(notifications, []);
        assert.deepStrictEqual(capture.entries, [
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "hook" },
              kind: "hook-notice",
              severity: "info",
              needsReload: false,
              text: "PreToolUse:Read ignored input rewrite (field)",
            },
          },
        ]);
      }

      capture.assertValid();
    });
  }

  test("keeps an ignored rewrite from failing the tool call when its notice transport throws", async () => {
    // arrange
    const input = { path: "original.txt" };
    const event = {
      type: "tool_call",
      toolCallId: "call-read",
      toolName: "read",
      input,
    } satisfies ToolCallEvent;
    const context: HookAdapterContext = {
      ...adapterContext(guardEntry()),
      ctx: { mode: "json", cwd: "/workspace" } as ExtensionContext,
      pi: {
        appendEntry(): never {
          throw new Error("notice transport failed");
        },
      } as unknown as ExtensionAPI,
    };

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "mutate", updatedInput: { file_path: "replacement.txt", pages: "secret-value" } },
      event,
      context,
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.strictEqual(event.input, input);
    assert.deepStrictEqual(input, { path: "original.txt" });
  });

  test("shows one sanitized notice when a Read rewrite asks for an unavailable field", async () => {
    // arrange
    const capture = createJsonCapture();
    const input = { path: "original.txt", offset: 1 };
    const event = {
      type: "tool_call",
      toolCallId: "call-read",
      toolName: "read",
      input,
    } satisfies ToolCallEvent;
    const context: HookAdapterContext = {
      ...adapterContext(guardEntry()),
      ctx: { mode: "json", cwd: "/workspace" } as ExtensionContext,
      pi: { appendEntry: capture.entrySink.appendEntry } as ExtensionAPI,
    };

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "mutate", updatedInput: { file_path: "replacement.txt", pages: "secret" } },
      event,
      context,
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.strictEqual(event.input, input);
    assert.deepStrictEqual(input, { path: "original.txt", offset: 1 });
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "hook" },
          kind: "hook-notice",
          severity: "info",
          needsReload: false,
          text: "PreToolUse:Read ignored input rewrite (field)",
        },
      },
    ]);
    capture.assertValid();
  });

  for (const { toolName, original, candidate } of [
    {
      toolName: "read",
      original: { path: "original.txt" },
      candidate: { file_path: "file:///tmp/%ZZ" },
    },
    {
      toolName: "write",
      original: { path: "original.txt", content: "original" },
      candidate: { file_path: "file://remotehost/tmp/secret", content: "replacement" },
    },
  ]) {
    test(`keeps the original ${toolName} call and hides a malformed file URL`, async () => {
      const capture = createJsonCapture();
      const input = structuredClone(original);
      const event = {
        type: "tool_call",
        toolCallId: `call-${toolName}`,
        toolName,
        input,
      } satisfies ToolCallEvent;
      const context: HookAdapterContext = {
        ...adapterContext(guardEntry()),
        ctx: { mode: "json", cwd: "/workspace" } as ExtensionContext,
        pi: { appendEntry: capture.entrySink.appendEntry } as ExtensionAPI,
      };

      assert.strictEqual(
        await adaptToolCallResult({ kind: "mutate", updatedInput: candidate }, event, context),
        undefined,
      );
      assert.strictEqual(event.input, input);
      assert.deepStrictEqual(input, original);
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "hook" },
            kind: "hook-notice",
            severity: "info",
            needsReload: false,
            text: `PreToolUse:${toolName === "read" ? "Read" : "Write"} ignored input rewrite (value)`,
          },
        },
      ]);
      capture.assertValid();
    });
  }

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

  test("rejects a __proto__ rewrite without polluting the input's prototype", async () => {
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
    assert.deepStrictEqual(event, bashCall({ command: "inspect", keep: "original" }));
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
  for (const toolName of ["Bash", "Read"]) {
    test(`replaces a custom ${toolName} result through the generic schema`, () => {
      const event = {
        type: "tool_result",
        toolCallId: `custom-${toolName}`,
        toolName,
        input: { query: "hello" },
        content: [{ type: "text" as const, text: "original" }],
        structuredContent: { secret: "original" },
        details: { secret: "original" },
        isError: false,
      } satisfies ToolResultEvent;

      assert.deepStrictEqual(
        adaptToolResultResult(
          { kind: "mutate", updatedToolOutput: { content: [{ type: "text", text: "redacted" }] } },
          event,
          adapterContext(guardEntry()),
        ),
        { content: [{ type: "text", text: "redacted" }], details: null },
      );
      assert.deepStrictEqual(event.structuredContent, { secret: "original" });
    });
  }

  test("a search replacement clears every stale output carrier", () => {
    const event = {
      type: "tool_result",
      toolCallId: "find-redaction",
      toolName: "find",
      input: { pattern: "*" },
      content: [{ type: "text" as const, text: "OLD_SECRET" }],
      details: { fullOutputPath: "OLD_SECRET" },
      structuredContent: "OLD_SECRET",
      isError: false,
    } satisfies ToolResultEvent;
    assert.deepStrictEqual(
      adaptToolResultResult(
        { kind: "mutate", updatedToolOutput: { filenames: [] } },
        event,
        adapterContext(guardEntry()),
      ),
      { content: [{ type: "text", text: "" }], details: null },
    );
    assert.deepStrictEqual(event.content, [{ type: "text", text: "OLD_SECRET" }]);
  });

  test("a malformed shell replacement leaves the complete event untouched", () => {
    const event = {
      type: "tool_result",
      toolCallId: "shell-invalid",
      toolName: "bash",
      input: { command: "printf secret" },
      content: [{ type: "text" as const, text: "OLD_SECRET" }],
      details: { fullOutputPath: "OLD_SECRET" },
      structuredContent: "OLD_SECRET",
      isError: false,
    } satisfies ToolResultEvent;
    const original = structuredClone(event);
    assert.strictEqual(
      adaptToolResultResult(
        { kind: "mutate", updatedToolOutput: { structuredContent: "bad" } },
        event,
        adapterContext(guardEntry()),
      ),
      undefined,
    );
    assert.deepStrictEqual(event, original);
  });

  test("a result missing its tool name cannot select a built-in decoder", () => {
    const event = {
      type: "tool_result",
      toolCallId: "missing-name",
      toolName: undefined as unknown as string,
      input: {},
      content: [{ type: "text" as const, text: "original" }],
      isError: false,
      details: undefined,
    } satisfies ToolResultEvent;
    assert.strictEqual(
      adaptToolResultResult(
        { kind: "mutate", updatedToolOutput: { filenames: ["forged"] } },
        event,
        adapterContext(guardEntry()),
      ),
      undefined,
    );
  });

  test("a file replacement clears stale Pi details", () => {
    const event = {
      type: "tool_result",
      toolCallId: "read-redaction",
      toolName: "read",
      input: { path: "secret.txt" },
      content: [{ type: "text" as const, text: "OLD_SECRET" }],
      structuredContent: "OLD_SECRET",
      details: { fullOutputPath: "OLD_SECRET" },
      isError: false,
    } satisfies ToolResultEvent;

    assert.deepStrictEqual(
      adaptToolResultResult(
        {
          kind: "mutate",
          updatedToolOutput: { type: "text", file: { content: "safe" } },
        },
        event,
        adapterContext(guardEntry()),
      ),
      {
        content: [{ type: "text", text: "safe" }],
        details: null,
      },
    );
  });
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
        isError,
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
      details: null,
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

  for (const { name, updatedToolOutput, text, structuredContent } of [
    { name: "null", updatedToolOutput: null, text: "null", structuredContent: undefined },
    {
      name: "primitive",
      updatedToolOutput: "hostile",
      text: "hostile",
      structuredContent: undefined,
    },
    {
      name: "array",
      updatedToolOutput: ["hostile"],
      text: '["hostile"]',
      structuredContent: ["hostile"],
    },
  ] as const) {
    test(`renders a ${name} updated output as data`, () => {
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
      assert.deepStrictEqual(adaptation, {
        content: [{ type: "text", text }],
        details: null,
        ...(structuredContent === undefined ? {} : { structuredContent }),
      });
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
      details: null,
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

  test("a generic image replacement drops stale output details", () => {
    const event = {
      type: "tool_result",
      toolCallId: "image",
      toolName: "owner-tool",
      input: {},
      content: [{ type: "text" as const, text: "old" }],
      details: { secret: "old" },
      isError: false,
    } satisfies ToolResultEvent;
    assert.deepStrictEqual(
      adaptToolResultResult(
        {
          kind: "mutate",
          updatedToolOutput: { content: [{ type: "image", data: "bmV3", mimeType: "image/png" }] },
        },
        event,
        adapterContext(guardEntry()),
      ),
      {
        content: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
        details: null,
      },
    );
  });

  test("an MCP envelope replaces every old output carrier and keeps only routing details", () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "mcp-redaction",
      toolName: "mcp__catalog__lookup",
      input: { text: "ping" },
      content: [{ type: "text" as const, text: "secret-content" }],
      structuredContent: { secret: "old-structured" },
      details: {
        server: "catalog",
        tool: "lookup",
        output: "secret-details",
        fullOutputPath: "/secret",
      },
      isError: false,
    } satisfies ToolResultEvent;

    // act
    const patch = adaptToolResultResult(
      {
        kind: "mutate",
        updatedToolOutput: {
          content: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
          structuredContent: { public: true },
          toolName: "forged",
          isError: true,
        },
      },
      event,
      adapterContext(guardEntry()),
    );

    // assert
    assert.deepStrictEqual(patch, {
      content: [{ type: "image", data: "bmV3", mimeType: "image/png" }],
      details: { server: "catalog", tool: "lookup" },
      structuredContent: { public: true },
    });
    assert.deepStrictEqual(event.structuredContent, { secret: "old-structured" });
  });

  for (const { name, value, text } of [
    { name: "false", value: false, text: "false" },
    { name: "zero", value: 0, text: "0" },
    { name: "empty string", value: "", text: "" },
    { name: "empty array", value: [], text: undefined },
  ] as const) {
    test(`accepts ${name} as a supplied output`, () => {
      // arrange
      const event = {
        type: "tool_result",
        toolCallId: name,
        toolName: "mcp__catalog__lookup",
        input: {},
        content: [{ type: "text" as const, text: "original" }],
        details: undefined,
        isError: false,
      } satisfies ToolResultEvent;

      // act
      const patch = adaptToolResultResult(
        { kind: "mutate", updatedToolOutput: value },
        event,
        adapterContext(guardEntry()),
      );

      // assert
      assert.deepStrictEqual(patch, {
        content: text === undefined ? [] : [{ type: "text", text }],
        details: null,
      });
    });
  }

  test("feedback retains the original structured value and error status", () => {
    const event = {
      type: "tool_result",
      toolCallId: "feedback",
      toolName: "owner-tool",
      input: {},
      content: [{ type: "text" as const, text: "original" }],
      structuredContent: { secret: "structured" },
      details: { route: "safe" },
      isError: true,
    } satisfies ToolResultEvent;
    const patch = adaptToolResultResult(
      { kind: "block", reason: "check" },
      event,
      adapterContext(guardEntry()),
    );
    assert.deepStrictEqual(patch?.structuredContent, event.structuredContent);
    assert.strictEqual(patch?.isError, true);
    assert.deepStrictEqual(patch?.content?.[0], event.content[0]);
  });

  test("a byte-identical generic replacement leaves every carrier untouched", () => {
    const event = {
      type: "tool_result",
      toolCallId: "same",
      toolName: "owner-tool",
      input: {},
      content: [{ type: "text" as const, text: "original" }],
      structuredContent: "original",
      details: { secret: "original" },
      isError: false,
    } satisfies ToolResultEvent;
    assert.strictEqual(
      adaptToolResultResult(
        {
          kind: "mutate",
          updatedToolOutput: {
            content: [{ type: "text", text: "original" }],
            structuredContent: "original",
            isError: false,
          },
        },
        event,
        adapterContext(guardEntry()),
      ),
      undefined,
    );
    assert.deepStrictEqual(event.structuredContent, "original");
    assert.deepStrictEqual(event.details, { secret: "original" });
  });

  test("does not let output data change the tool failure flag", () => {
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
    assert.deepStrictEqual(adaptation, {
      content: [{ type: "text", text: '{"isError":true}' }],
      details: null,
      structuredContent: { isError: true },
    });
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

  for (const { name, mutation, diagnostics } of [
    {
      name: "ignores a replacement output on a failed result and reports it (D-BG-405)",
      mutation: {
        kind: "mutate",
        updatedToolOutput: { content: [{ type: "text", text: "replaced" }], isError: false },
      } as const,
      diagnostics: [["[hooks] adaptToolResult: updatedToolOutput ignored on a failed tool result"]],
    },
    {
      name: "leaves a failed result with only additional context unreported (D-BG-405)",
      mutation: { kind: "mutate", additionalContext: "checked the error" } as const,
      diagnostics: [],
    },
  ]) {
    test(name, (t) => {
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
        toolCallId: "result-failed-mutate",
        toolName: "read",
        input: { path: "notes.txt", offset: 9 },
        content: [{ type: "text" as const, text: "Offset 9 is beyond end of file" }],
        isError: true,
        details: undefined,
      } satisfies ToolResultEvent;

      // act
      const adaptation = adaptToolResultResult(mutation, event, adapterContext(guardEntry()));

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(
        consoleErrorSpy.mock.calls.map(({ arguments: consoleArguments }) => consoleArguments),
        diagnostics,
      );
      assert.deepStrictEqual(event, {
        type: "tool_result",
        toolCallId: "result-failed-mutate",
        toolName: "read",
        input: { path: "notes.txt", offset: 9 },
        content: [{ type: "text", text: "Offset 9 is beyond end of file" }],
        isError: true,
        details: undefined,
      });
    });
  }

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

describe("hookContextPart", () => {
  test("labels the values with the event of their hooks, joined in order (D-PG6-20)", () => {
    // act
    const parts = [
      hookContextPart("SessionStart", ["first", "second"]),
      hookContextPart("UserPromptSubmit", ["prompt context"]),
    ];

    // assert
    assert.deepStrictEqual(parts, [
      { type: "text", text: "SessionStart hook additional context: first\nsecond" },
      { type: "text", text: "UserPromptSubmit hook additional context: prompt context" },
    ]);
  });

  test("leaves out a value that is empty or only whitespace (HOOK-05)", () => {
    // act
    const part = hookContextPart("UserPromptSubmit", ["", "kept", " \n\t"]);

    // assert
    assert.deepStrictEqual(part, {
      type: "text",
      text: "UserPromptSubmit hook additional context: kept",
    });
  });

  test("gives no part when no value has text (HOOK-05)", () => {
    // act
    const parts = [hookContextPart("SessionStart", []), hookContextPart("UserPromptSubmit", [" "])];

    // assert
    assert.deepStrictEqual(parts, [undefined, undefined]);
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
    const adaptation = adaptInputResult(
      { kind: "noop" },
      event,
      adapterContext(guardEntry()),
      "UserPromptSubmit",
    );

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
      "UserPromptSubmit",
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
      "UserPromptSubmit",
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
        event: "UserPromptSubmit",
      },
    ]);
  });

  test("buffers a prompt context that no entry is attributed to under an empty provenance (D-CF5-13)", () => {
    // arrange
    const runtime = createHooksRuntime();

    // act
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "orphan context" },
      { type: "input", text: "original prompt", source: "interactive" },
      { ...adapterContext(undefined), runtime },
      "UserPromptSubmit",
    );

    // assert
    assert.strictEqual(adaptation, undefined);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [
      {
        context: "orphan context",
        scope: "user",
        marketplace: "",
        pluginId: "",
        event: "UserPromptSubmit",
      },
    ]);
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
      "UserPromptSubmit",
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
      "UserPromptSubmit",
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
        event: "UserPromptSubmit",
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
      "UserPromptSubmit",
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
      "UserPromptSubmit",
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
      "UserPromptSubmit",
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
    const adaptation = adaptInputResult(
      { kind: "mutate", additionalContext: "" },
      event,
      {
        ...adapterContext(guardEntry()),
        runtime,
      },
      "UserPromptSubmit",
    );

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
      const adaptation = adaptInputResult(
        hookOutcome,
        event,
        {
          ...adapterContext(guardEntry()),
          runtime,
        },
        "UserPromptSubmit",
      );

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
    const adaptation = adaptInputResult(
      hookOutcome,
      event,
      adapterContext(guardEntry()),
      "UserPromptSubmit",
    );

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
      const adaptation = adaptInputResult(
        stopOutcome,
        event,
        adapterContext(guardEntry()),
        "UserPromptSubmit",
      );

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
    event: "UserPromptSubmit",
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
  test("sends each SessionStart context to the model at once in a hidden message (HKRL-01)", () => {
    // arrange
    const sent: SentMessage[] = [];
    const pi = createMessagePi(sent);

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "first context" },
      "SessionStart",
      { ...adapterContext(guardEntry()), pi },
      sessionStartDispatch("startup", ["first context"]),
    );
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "second context" },
      "SessionStart",
      { ...adapterContext(guardEntry()), pi },
      sessionStartDispatch("startup", ["second context"]),
    );

    // assert
    assert.deepStrictEqual(sent, [
      sessionStartContextMessage(["first context"]),
      sessionStartContextMessage(["second context"]),
    ]);
  });

  test("steers a compaction's SessionStart context into a run whose next model call follows (HKRL-03)", () => {
    // arrange
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "compact context" },
      "SessionStart",
      { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
      sessionStartDispatch("compact", ["compact context"], true),
    );

    // assert
    assert.deepStrictEqual(sent, [
      sessionStartContextMessage(["compact context"], { deliverAs: "steer" }),
    ]);
  });

  test("holds a compaction's SessionStart context when no model call of the run follows (HKRL-03)", () => {
    // arrange
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "compact context" },
      "SessionStart",
      { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
      sessionStartDispatch("compact", ["compact context"], false),
    );

    // assert
    assert.deepStrictEqual(sent, [
      sessionStartContextMessage(["compact context"], { triggerTurn: false }),
    ]);
  });

  test("sends no SessionStart context when it is truly absent", () => {
    // arrange
    const sent: SentMessage[] = [];
    const hookOutcome = {
      kind: "mutate",
      updatedInput: { ignored: true },
    } satisfies HookExecResult;

    // act
    adaptObservationResultForEvent(
      hookOutcome,
      "SessionStart",
      { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
      sessionStartDispatch("startup", []),
    );

    // assert
    assert.strictEqual(Object.hasOwn(hookOutcome, "additionalContext"), false);
    assert.deepStrictEqual(sent, []);
  });

  for (const { name, additionalContext } of [
    { name: "empty", additionalContext: "" },
    { name: "white-space-only", additionalContext: " \n\t" },
  ]) {
    test(`sends no ${name} SessionStart context (HKRL-01)`, () => {
      // arrange
      const sent: SentMessage[] = [];

      // act
      adaptObservationResultForEvent(
        { kind: "mutate", additionalContext },
        "SessionStart",
        { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
        sessionStartDispatch("startup", [additionalContext]),
      );

      // assert
      assert.deepStrictEqual(sent, []);
    });
  }

  for (const { eventName, context } of [
    { eventName: "SessionEnd", context: "discarded SessionEnd context" },
    { eventName: "PostCompact", context: "discarded PostCompact context" },
  ] as const) {
    test(`drops ${eventName} additional context`, () => {
      // arrange
      const sent: SentMessage[] = [];

      // act
      adaptObservationResultForEvent({ kind: "mutate", additionalContext: context }, eventName, {
        ...adapterContext(guardEntry()),
        pi: createMessagePi(sent),
      });

      // assert
      assert.deepStrictEqual(sent, []);
    });
  }

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
    test(`sends the SessionStart context of a fold that ${arm} (D-CF5-09, HKRL-01)`, () => {
      // arrange
      const sent: SentMessage[] = [];

      // act
      adaptObservationResultForEvent(
        hookOutcome,
        "SessionStart",
        { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
        sessionStartDispatch("startup", ["kept context"]),
      );

      // assert
      assert.deepStrictEqual(sent, [sessionStartContextMessage(["kept context"])]);
    });
  }

  test("drops the PostCompact context of a fold that blocks", () => {
    // arrange
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "block", reason: "denied", additionalContext: "dropped context" },
      "PostCompact",
      { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
    );

    // assert
    assert.deepStrictEqual(sent, []);
  });

  test("sends nothing for a SessionStart noop", () => {
    // arrange
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "noop" },
      "SessionStart",
      { ...adapterContext(guardEntry()), pi: createMessagePi(sent) },
      sessionStartDispatch("startup", []),
    );

    // assert
    assert.deepStrictEqual(sent, []);
  });

  test("sends nothing and logs nothing for SessionStart context without a Pi API (HKRL-01)", (t) => {
    // arrange
    const lines = captureDebugLog(t);

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "ctx" },
      "SessionStart",
      adapterContext(guardEntry()),
      sessionStartDispatch("startup", ["ctx"]),
    );

    // assert
    assert.deepStrictEqual(lines, []);
  });

  for (const { title, attributedTo, line } of [
    {
      title:
        "debug-logs a SessionStart context that fails to send with the plugin it is attributed to (NFR-2, OBS-01)",
      attributedTo: guardEntry(),
      line: "[hooks] adaptObservation: session start context failed for demo@fixtures: closed",
    },
    {
      title:
        "debug-logs a SessionStart context that no entry is attributed to and fails to send (NFR-2, OBS-01)",
      attributedTo: undefined,
      line: "[hooks] adaptObservation: session start context failed for <unattributed>: closed",
    },
  ]) {
    test(title, (t) => {
      // arrange
      const lines = captureDebugLog(t);

      // act
      adaptObservationResultForEvent(
        { kind: "mutate", additionalContext: "ctx" },
        "SessionStart",
        { ...adapterContext(attributedTo), pi: createMessagePi([], new Error("closed")) },
        sessionStartDispatch("startup", ["ctx"]),
      );

      // assert
      assert.deepStrictEqual(lines, [line]);
    });
  }

  for (const { title, source, held, values, sends } of [
    {
      title: "sends every value of a startup SessionStart that the session already holds (HKRL-02)",
      source: "startup",
      held: heldDetails(["held context"]),
      values: ["held context", "new context"],
      sends: [["held context", "new context"]],
    },
    {
      title: "sends every value of a clear SessionStart that the session already holds (HKRL-02)",
      source: "clear",
      held: heldDetails(["held context"]),
      values: ["held context", "new context"],
      sends: [["held context", "new context"]],
    },
    {
      title: "sends every value of a compact SessionStart that the session already holds (HKRL-02)",
      source: "compact",
      held: heldDetails(["held context"]),
      values: ["held context", "new context"],
      sends: [["held context", "new context"]],
    },
    {
      title: "sends only the values a resumed session does not hold yet (HKRL-02)",
      source: "resume",
      held: heldDetails(["held context"]),
      values: ["held context", "fresh context"],
      sends: [["fresh context"]],
    },
    {
      title: "sends only the values a forked session does not hold yet (HKRL-02)",
      source: "fork",
      held: heldDetails(["held context"]),
      values: ["held context", "fresh context"],
      sends: [["fresh context"]],
    },
    {
      title: "sends nothing when the resumed session holds every value (HKRL-02)",
      source: "resume",
      held: heldDetails(["first context", "second context"]),
      values: ["first context", "second context"],
      sends: [],
    },
    {
      title: "drops a value that a message without details holds in a SessionStart part (HKRL-02)",
      source: "resume",
      held: heldMessage([
        { type: "text", text: "SessionStart hook additional context: held context" },
        { type: "text", text: "UserPromptSubmit hook additional context: prompt context" },
      ]),
      values: ["held context", "fresh context"],
      sends: [["fresh context"]],
    },
    {
      title:
        "sends nothing when a message without details holds the whole joined context (HKRL-02)",
      source: "resume",
      held: heldMessage([sessionStartPart(["first context", "second context"])]),
      values: ["first context", "second context"],
      sends: [],
    },
    {
      title: "drops a saved context whose file path differs (HKRL-02)",
      source: "resume",
      held: heldDetails([savedOutput("/saved/one.txt")]),
      values: [savedOutput("/saved/two.txt")],
      sends: [],
    },
  ] satisfies ReadonlyArray<{
    readonly title: string;
    readonly source: SessionStartSource;
    readonly held: SessionAppend;
    readonly values: readonly string[];
    readonly sends: ReadonlyArray<readonly string[]>;
  }>) {
    test(title, () => {
      // arrange
      const start = sessionStartDispatch(source, values);

      // act
      const sent = sendOverHeldSession(held, start);

      // assert
      assert.deepStrictEqual(
        sent,
        sends.map((message) => sessionStartContextMessage(message)),
      );
    });
  }

  for (const { kind, held } of [
    {
      kind: "a message of another custom type",
      held: heldMessage(
        [sessionStartPart(["held context"])],
        { event: "SessionStart", values: ["held context"] },
        "other-extension-context",
      ),
    },
    {
      kind: "a user message",
      held: (sessionManager: SessionManager) => {
        sessionManager.appendMessage({
          role: "user",
          content: "SessionStart hook additional context: held context",
          timestamp: 0,
        });
      },
    },
    {
      kind: "details of another event",
      held: heldMessage([sessionStartPart(["held context"])], {
        event: "UserPromptSubmit",
        values: ["held context"],
      }),
    },
    {
      kind: "details whose values are not a list",
      held: heldMessage([sessionStartPart(["held context"])], {
        event: "SessionStart",
        values: "held context",
      }),
    },
    {
      kind: "details with a value that is not text",
      held: heldMessage([sessionStartPart(["held context"])], {
        event: "SessionStart",
        values: ["held context", 1],
      }),
    },
    {
      kind: "details that are text",
      held: heldMessage([sessionStartPart(["held context"])], "held context"),
    },
    { kind: "null details", held: heldMessage([sessionStartPart(["held context"])], null) },
    {
      kind: "text content without details",
      held: heldMessage("SessionStart hook additional context: held context"),
    },
    {
      kind: "a part with another event's label",
      held: heldMessage([
        { type: "text", text: "UserPromptSubmit hook additional context: held context" },
      ]),
    },
    {
      kind: "an image part",
      held: heldMessage([{ type: "image", data: "aGk=", mimeType: "image/png" }]),
    },
  ] satisfies ReadonlyArray<{ readonly kind: string; readonly held: SessionAppend }>) {
    test(`ignores ${kind} when it looks for the values a resumed session holds (HKRL-02)`, () => {
      // arrange
      const start = sessionStartDispatch("resume", ["held context"]);

      // act
      const sent = sendOverHeldSession(held, start);

      // assert
      assert.deepStrictEqual(sent, [sessionStartContextMessage(["held context"])]);
    });
  }

  test("sends every value and debug-logs a session it cannot read (NFR-2, HKRL-02)", (t) => {
    // arrange
    const lines = captureDebugLog(t);
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "held context" },
      "SessionStart",
      { ...adapterContext(guardEntry()), ctx: unreadableSession(), pi: createMessagePi(sent) },
      sessionStartDispatch("resume", ["held context"]),
    );

    // assert
    assert.deepStrictEqual(
      { lines, sent },
      {
        lines: ["[hooks] adaptObservation: session start context read failed: session closed"],
        sent: [sessionStartContextMessage(["held context"])],
      },
    );
  });

  test("reads no session for a resumed SessionStart with no context (HKRL-02)", (t) => {
    // arrange
    const lines = captureDebugLog(t);
    const sent: SentMessage[] = [];

    // act
    adaptObservationResultForEvent(
      { kind: "noop" },
      "SessionStart",
      { ...adapterContext(guardEntry()), ctx: unreadableSession(), pi: createMessagePi(sent) },
      sessionStartDispatch("resume", []),
    );

    // assert
    assert.deepStrictEqual({ lines, sent }, { lines: [], sent: [] });
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

describe("stop notices (D-PG5-13)", () => {
  const PROMPT = { type: "input", text: "hello", source: "interactive" } satisfies InputEvent;
  const BASH_CALL = {
    type: "tool_call",
    toolCallId: "call-bash",
    toolName: "bash",
    input: { command: "echo from-model" },
  } satisfies ToolCallEvent;

  // A JSON-mode adapter context whose notices land in `capture`.
  function noticeContext(capture: ReturnType<typeof createJsonCapture>): HookAdapterContext {
    return {
      ...adapterContext(guardEntry()),
      ctx: Object.defineProperties({ mode: "json", cwd: "/workspace" } as ExtensionContext, {
        ui: { get: () => capture.ui },
      }),
      pi: { appendEntry: capture.entrySink.appendEntry } as ExtensionAPI,
    };
  }

  // The `claude-plugin` entry of one hook notice.
  function noticeEntry(text: string): unknown {
    return {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "hook" },
        kind: "hook-notice",
        severity: "info",
        needsReload: false,
        text,
      },
    };
  }

  // A JSON-mode adapter context whose notice transport throws.
  function failingNoticeContext(): HookAdapterContext {
    return {
      ...adapterContext(guardEntry()),
      ctx: { mode: "json", cwd: "/workspace" } as ExtensionContext,
      pi: {
        getAllTools: () => [],
        getCommands: () => [],
        appendEntry(): never {
          throw new Error("notice transport failed");
        },
      } as unknown as ExtensionAPI,
    };
  }

  for (const { name, stopReason, notice } of [
    { name: "its reason", stopReason: "not now", notice: "Operation stopped by hook: not now" },
    { name: "no reason", stopReason: undefined, notice: "Operation stopped by hook" },
    { name: "an empty reason", stopReason: "", notice: "Operation stopped by hook" },
  ]) {
    test(`shows a stopped prompt with ${name} and stops it`, () => {
      // arrange
      const capture = createJsonCapture();
      const stopOutcome: HookExecResult =
        stopReason === undefined ? { kind: "stop" } : { kind: "stop", stopReason };

      // act
      const adaptation = adaptInputResult(
        stopOutcome,
        { ...PROMPT },
        noticeContext(capture),
        "UserPromptSubmit",
      );

      // assert
      assert.deepStrictEqual(adaptation, { action: "handled" });
      assert.deepStrictEqual(capture.entries, [noticeEntry(notice)]);
      capture.assertValid();
    });
  }

  for (const { name, stopOutcome, notice, reason } of [
    {
      name: "its reason",
      stopOutcome: { kind: "stop", stopReason: "halt" } as const,
      notice: "PreToolUse:Bash hook stopped continuation: halt",
      reason: "halt",
    },
    {
      name: "no reason",
      stopOutcome: { kind: "stop" } as const,
      notice: "PreToolUse:Bash hook stopped continuation: Execution stopped by hook",
      reason: "Operation stopped by hook",
    },
  ]) {
    test(`shows a stopped tool call with ${name} and keeps the block the model receives`, async () => {
      // arrange
      const capture = createJsonCapture();

      // act
      const adaptation = await adaptToolCallResult(
        stopOutcome,
        { ...BASH_CALL },
        noticeContext(capture),
      );

      // assert
      assert.deepStrictEqual(adaptation, { block: true, reason, terminate: true });
      assert.deepStrictEqual(capture.entries, [noticeEntry(notice)]);
      capture.assertValid();
    });
  }

  test("debug-logs a prompt stop notice that fails to show and still stops the prompt", (t) => {
    // arrange
    const lines = captureDebugLog(t);

    // act
    const adaptation = adaptInputResult(
      { kind: "stop", stopReason: "not now" },
      { ...PROMPT },
      failingNoticeContext(),
      "UserPromptSubmit",
    );

    // assert
    assert.deepStrictEqual(adaptation, { action: "handled" });
    assert.deepStrictEqual(lines, [
      "[hooks] adaptInput: stop notice failed: notice transport failed",
    ]);
  });

  test("debug-logs a tool stop notice that fails to show and still ends the turn", async (t) => {
    // arrange
    const lines = captureDebugLog(t);

    // act
    const adaptation = await adaptToolCallResult(
      { kind: "stop", stopReason: "halt" },
      { ...BASH_CALL },
      failingNoticeContext(),
    );

    // assert
    assert.deepStrictEqual(adaptation, { block: true, reason: "halt", terminate: true });
    assert.deepStrictEqual(lines, [
      "[hooks] adaptToolCall: stop notice failed: notice transport failed",
    ]);
  });

  for (const isError of [false, true]) {
    test(`shows no stop notice for a stopped ${isError ? "PostToolUseFailure" : "PostToolUse"} result`, () => {
      // arrange
      const capture = createJsonCapture();
      const event = {
        type: "tool_result",
        toolCallId: "result-stop",
        toolName: "bash",
        input: { command: "inspect" },
        content: [{ type: "text" as const, text: "original output" }],
        isError,
        details: undefined,
      } satisfies ToolResultEvent;

      // act
      const adaptation = adaptToolResultResult(
        { kind: "stop", stopReason: "halt" },
        event,
        noticeContext(capture),
      );

      // assert
      assert.strictEqual(adaptation, undefined);
      assert.deepStrictEqual(capture.entries, []);
    });
  }

  test("shows no stop notice for a stopped PreCompact bucket, which has no notice context", () => {
    // act
    const adaptation = adaptPreCompactResult([{ kind: "stop", stopReason: "halt" }]);

    // assert
    assert.strictEqual(adaptation, undefined);
  });
});
