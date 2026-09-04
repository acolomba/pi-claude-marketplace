// Unit test for the PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts";

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
    tool_response: [{ type: "text", text: "exit code 1: command failed" }],
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.strictEqual(payload.tool_response, toolResponse);
});

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
    tool_response: [
      { type: "text", text: "catalog lookup failed" },
      { type: "text", text: "retryable: false" },
    ],
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.strictEqual(payload.tool_response, toolResponse);
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
