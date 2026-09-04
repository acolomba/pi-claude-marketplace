// Unit test for the PreToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts";

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
      timeout: 15,
    },
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
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
  };

  // act
  const payload = translate(event, context);

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
