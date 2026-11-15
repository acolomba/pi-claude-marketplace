// Unit test for the PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translatePostToolUseFailure } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts";

import type { HookToolFacts } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("maps a failed built-in tool to the complete PostToolUseFailure envelope", () => {
  // arrange
  const toolInput = { command: "false" };
  const toolResponse = [
    { type: "text", text: "exit code 1: command failed" },
  ] satisfies ToolResultEvent["content"];
  const event = {
    type: "tool_result",
    toolCallId: "tool-call-built-in",
    toolName: "bash",
    input: toolInput,
    content: toolResponse,
    isError: true,
    details: undefined,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session-built-in",
    transcriptPath: "/sessions/session-built-in.jsonl",
    cwd: "/workspace/built-in",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-built-in",
    transcript_path: "/sessions/session-built-in.jsonl",
    cwd: "/workspace/built-in",
    hook_event_name: "PostToolUseFailure",
    tool_name: "Bash",
    tool_input: { command: "false" },
    tool_use_id: "tool-call-built-in",
    error: "exit code 1: command failed",
    is_interrupt: false,
  };

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.notStrictEqual(payload.tool_input, toolInput);
});

for (const identity of [
  { agentType: "reviewer", sessionId: "child-session" },
  undefined,
  { agentType: "reviewer", sessionId: "other-session" },
]) {
  test(`includes only matching child identity in a failed result: ${identity?.sessionId ?? "absent"}`, () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "child-failure",
      toolName: "catalog",
      input: { query: "entry" },
      content: [{ type: "text", text: "lookup failed" }],
      details: undefined,
      isError: true,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "child-session",
      transcriptPath: "/sessions/child.jsonl",
      cwd: "/workspace",
      ...(identity === undefined ? {} : { childIdentity: identity }),
    } satisfies TranslationContext;

    // act
    const payload = translatePostToolUseFailure(event, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "child-session",
      transcript_path: "/sessions/child.jsonl",
      cwd: "/workspace",
      hook_event_name: "PostToolUseFailure",
      tool_name: "catalog",
      tool_input: { query: "entry" },
      tool_use_id: "child-failure",
      error: "lookup failed",
      is_interrupt: false,
      ...(identity?.sessionId === context.sessionId
        ? { agent_type: "reviewer", agent_id: "child-session" }
        : {}),
    });
  });
}

test("preserves a failed custom tool name and nested values without mutation", () => {
  // arrange
  const toolInput = {
    query: { phrase: "hook contracts", languages: ["typescript"] },
    limit: 2,
  };
  const toolResponse = [
    { type: "text", text: "catalog lookup failed" },
    { type: "text", text: "retryable: false" },
  ] satisfies ToolResultEvent["content"];
  const event = {
    type: "tool_result",
    toolCallId: "tool-call-custom",
    toolName: "mcp__catalog__lookup",
    input: toolInput,
    content: toolResponse,
    isError: true,
    details: { server: "catalog", errorCode: "LOOKUP_FAILED" },
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session-custom",
    transcriptPath: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-custom",
    transcript_path: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
    hook_event_name: "PostToolUseFailure",
    tool_name: "mcp__catalog__lookup",
    tool_input: {
      query: { phrase: "hook contracts", languages: ["typescript"] },
      limit: 2,
    },
    tool_use_id: "tool-call-custom",
    error: "catalog lookup failed\nretryable: false",
    is_interrupt: false,
  };

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.deepStrictEqual(toolInput, {
    query: { phrase: "hook contracts", languages: ["typescript"] },
    limit: 2,
  });
  assert.deepStrictEqual(toolResponse, [
    { type: "text", text: "catalog lookup failed" },
    { type: "text", text: "retryable: false" },
  ]);
  assert.deepStrictEqual(context, {
    sessionId: "session-custom",
    transcriptPath: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
  });
});

test("sends only the text parts of a failure that also carries an image", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "tool-call-image",
    toolName: "read",
    input: { path: "/workspace/broken.png" },
    content: [
      { type: "text", text: "image decode failed" },
      { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      { type: "text", text: "truncated at byte 8" },
    ],
    isError: true,
    details: undefined,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session-image",
    transcriptPath: "/sessions/session-image.jsonl",
    cwd: "/workspace/image",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.strictEqual(payload.error, "image decode failed\ntruncated at byte 8");
  assert.deepStrictEqual(payload.tool_input, { file_path: "/workspace/broken.png" });
  assert.strictEqual("tool_response" in payload, false);
});

test("an image-only failed edit has an empty error and no response", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "failed-edit-image",
    toolName: "edit",
    input: { file_path: "/workspace/document.txt", old_string: "a", new_string: "b" },
    content: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
    isError: true,
    details: undefined,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "failed-edit",
    transcriptPath: "",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.strictEqual(payload.error, "");
  assert.strictEqual(payload.is_interrupt, false);
  assert.strictEqual("tool_response" in payload, false);
});

test("translates a failed Read path without inventing a successful response", () => {
  const event = {
    type: "tool_result",
    toolCallId: "missing-read",
    toolName: "read",
    input: { path: "missing.txt" },
    content: [{ type: "text", text: "Path not found: missing.txt" }],
    isError: true,
    details: undefined,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "failed-read",
    transcriptPath: "/sessions/failed-read.jsonl",
    cwd: "/workspace/failed-read",
  } satisfies TranslationContext;

  const payload = translatePostToolUseFailure(event, context);

  assert.deepStrictEqual(payload, {
    session_id: "failed-read",
    transcript_path: "/sessions/failed-read.jsonl",
    cwd: "/workspace/failed-read",
    hook_event_name: "PostToolUseFailure",
    tool_name: "Read",
    tool_input: { file_path: "/workspace/failed-read/missing.txt" },
    tool_use_id: "missing-read",
    error: "Path not found: missing.txt",
    is_interrupt: false,
  });
  assert.strictEqual("tool_response" in payload, false);
});

for (const toolCallId of ["call-1", "call-1/2"]) {
  test(`sends the call id ${toolCallId} unchanged as tool_use_id after tool_input (D-PG6-05)`, () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId,
      toolName: "custom",
      input: { query: "one" },
      content: [{ type: "text", text: "lookup failed" }],
      details: undefined,
      isError: true,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "session-id",
      transcriptPath: "",
      cwd: "/workspace",
    } satisfies TranslationContext;

    // act
    const payload = translatePostToolUseFailure(event, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "session-id",
      transcript_path: "",
      cwd: "/workspace",
      hook_event_name: "PostToolUseFailure",
      tool_name: "custom",
      tool_input: { query: "one" },
      tool_use_id: toolCallId,
      error: "lookup failed",
      is_interrupt: false,
    });
    assert.deepStrictEqual(Object.keys(payload), [
      "session_id",
      "transcript_path",
      "cwd",
      "hook_event_name",
      "tool_name",
      "tool_input",
      "tool_use_id",
      "error",
      "is_interrupt",
    ]);
    assert.strictEqual(Object.hasOwn(payload, "permission_mode"), false);
    assert.strictEqual(Object.hasOwn(payload, "duration_ms"), false);
    assert.strictEqual(Object.hasOwn(payload, "mcp_server"), false);
  });
}

test("keeps a child's identity after tool_use_id", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "custom",
    input: { query: "one" },
    content: [{ type: "text", text: "lookup failed" }],
    details: undefined,
    isError: true,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PostToolUseFailure"],
    ["tool_name", "custom"],
    ["tool_input", { query: "one" }],
    ["tool_use_id", "call-1"],
    ["error", "lookup failed"],
    ["is_interrupt", false],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
  ]);
});

test("sends the measured duration as duration_ms after is_interrupt (D-PG6-06)", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "custom",
    input: { query: "one" },
    content: [{ type: "text", text: "lookup failed" }],
    details: undefined,
    isError: true,
    hookDurationMs: 75,
  } satisfies ToolResultEvent & HookToolFacts;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PostToolUseFailure"],
    ["tool_name", "custom"],
    ["tool_input", { query: "one" }],
    ["tool_use_id", "call-1"],
    ["error", "lookup failed"],
    ["is_interrupt", false],
    ["duration_ms", 75],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
  ]);
});

test("sends the plugin MCP server as mcp_server after duration_ms (D-PG6-07)", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "mcp__plugin_demo_stub__echo",
    input: { text: "ping" },
    content: [{ type: "text", text: "lookup failed" }],
    details: undefined,
    isError: true,
    hookDurationMs: 75,
    hookMcpServer: { name: "plugin:demo:stub", source: "plugin" },
  } satisfies ToolResultEvent & HookToolFacts;
  const context = {
    sessionId: "session",
    transcriptPath: "",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PostToolUseFailure"],
    ["tool_name", "mcp__plugin_demo_stub__echo"],
    ["tool_input", { text: "ping" }],
    ["tool_use_id", "call-1"],
    ["error", "lookup failed"],
    ["is_interrupt", false],
    ["duration_ms", 75],
    ["mcp_server", { name: "plugin:demo:stub", source: "plugin" }],
  ]);
});

test("leaves out mcp_server for a result with no server (D-PG6-07)", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "mcp__other__echo",
    input: { text: "ping" },
    content: [{ type: "text", text: "lookup failed" }],
    details: undefined,
    isError: true,
    hookDurationMs: 75,
  } satisfies ToolResultEvent & HookToolFacts;
  const context = {
    sessionId: "session",
    transcriptPath: "",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.strictEqual(Object.hasOwn(payload, "mcp_server"), false);
});
