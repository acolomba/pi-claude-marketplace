// Unit test for the PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translatePostToolUseFailure } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts";

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
    error: "exit code 1: command failed",
  };

  // act
  const payload = translatePostToolUseFailure(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
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
    error: "catalog lookup failed\nretryable: false",
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
});
