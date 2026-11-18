// Unit test for the PreToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translatePreToolUse } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts";

import type { HookToolFacts } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolCallEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("maps a built-in tool to the complete PreToolUse envelope", () => {
  // arrange
  const toolInput = {
    command: "printf 'ready\\n'",
    timeout: 15,
  };
  const event = {
    type: "tool_call",
    toolCallId: "tool-call-built-in",
    toolName: "bash",
    input: toolInput,
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "session-built-in",
    transcriptPath: "/sessions/session-built-in.jsonl",
    cwd: "/workspace/built-in",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-built-in",
    transcript_path: "/sessions/session-built-in.jsonl",
    cwd: "/workspace/built-in",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: {
      command: "printf 'ready\\n'",
      timeout: 15000,
    },
    tool_use_id: "tool-call-built-in",
  };

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(Object.hasOwn(payload, "agent_type"), false);
  assert.strictEqual(Object.hasOwn(payload, "agent_id"), false);
  assert.deepStrictEqual(toolInput, { command: "printf 'ready\\n'", timeout: 15 });
});

test("preserves a custom tool name and input without mutation", () => {
  // arrange
  const toolInput = {
    query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
    limit: 4,
    options: { includeDeprecated: false },
  };
  const event = {
    type: "tool_call",
    toolCallId: "tool-call-custom",
    toolName: "mcp__catalog__lookup",
    input: toolInput,
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "session-custom",
    transcriptPath: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-custom",
    transcript_path: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
    hook_event_name: "PreToolUse",
    tool_name: "mcp__catalog__lookup",
    tool_input: {
      query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
      limit: 4,
      options: { includeDeprecated: false },
    },
    tool_use_id: "tool-call-custom",
  };

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.deepStrictEqual(toolInput, {
    query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
    limit: 4,
    options: { includeDeprecated: false },
  });
  assert.deepStrictEqual(context, {
    sessionId: "session-custom",
    transcriptPath: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
  });
});

test("includes current child identity in the complete PreToolUse envelope", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "child-call",
    toolName: "mcp__catalog__lookup",
    input: { query: "ready" },
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace/child",
    childIdentity: { agentType: 'review&"<agent>', sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "child-session",
    transcript_path: "",
    cwd: "/workspace/child",
    hook_event_name: "PreToolUse",
    tool_name: "mcp__catalog__lookup",
    tool_input: { query: "ready" },
    tool_use_id: "child-call",
    agent_type: 'review&"<agent>',
    agent_id: "child-session",
  });
});

for (const toolCallId of ["call-1", "call-1/2"]) {
  test(`sends the call id ${toolCallId} unchanged as tool_use_id after tool_input (D-PG6-05)`, () => {
    // arrange
    const event = {
      type: "tool_call",
      toolCallId,
      toolName: "bash",
      input: { command: "echo one" },
    } satisfies ToolCallEvent;
    const context = {
      sessionId: "session-id",
      transcriptPath: "",
      cwd: "/workspace",
    } satisfies TranslationContext;

    // act
    const payload = translatePreToolUse(event, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "session-id",
      transcript_path: "",
      cwd: "/workspace",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "echo one" },
      tool_use_id: toolCallId,
    });
    assert.deepStrictEqual(Object.keys(payload), [
      "session_id",
      "transcript_path",
      "cwd",
      "hook_event_name",
      "tool_name",
      "tool_input",
      "tool_use_id",
    ]);
    assert.strictEqual(Object.hasOwn(payload, "permission_mode"), false);
    assert.strictEqual(Object.hasOwn(payload, "duration_ms"), false);
    assert.strictEqual(Object.hasOwn(payload, "mcp_server"), false);
  });
}

test("keeps a child's identity after tool_use_id", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "bash",
    input: { command: "echo one" },
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PreToolUse"],
    ["tool_name", "Bash"],
    ["tool_input", { command: "echo one" }],
    ["tool_use_id", "call-1"],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
  ]);
});

test("sends the plugin MCP server as mcp_server after tool_use_id (D-PG6-07)", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "mcp__plugin_demo_stub__echo",
    input: { text: "ping" },
    hookMcpServer: { name: "plugin:demo:stub", source: "plugin" },
  } satisfies ToolCallEvent & HookToolFacts;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PreToolUse"],
    ["tool_name", "mcp__plugin_demo_stub__echo"],
    ["tool_input", { text: "ping" }],
    ["tool_use_id", "call-1"],
    ["mcp_server", { name: "plugin:demo:stub", source: "plugin" }],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
  ]);
});

test("leaves out mcp_server for an event with no server (D-PG6-07)", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "mcp__other__echo",
    input: { text: "ping" },
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.strictEqual(Object.hasOwn(payload, "mcp_server"), false);
});

test("sends the context's effort as the last member, after agent_id (D-PG6-10)", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "bash",
    input: { command: "echo one" },
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
    effort: { level: "high" },
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PreToolUse"],
    ["tool_name", "Bash"],
    ["tool_input", { command: "echo one" }],
    ["tool_use_id", "call-1"],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
    ["effort", { level: "high" }],
  ]);
});

test("leaves out effort for a context with none (D-PG6-10)", () => {
  // arrange
  const event = {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "bash",
    input: { command: "echo one" },
  } satisfies ToolCallEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePreToolUse(event, context);

  // assert
  assert.strictEqual(Object.hasOwn(payload, "effort"), false);
});
