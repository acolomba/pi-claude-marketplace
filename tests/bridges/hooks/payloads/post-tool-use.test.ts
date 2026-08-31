// Unit test for the PostToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("maps a successful built-in tool to the complete PostToolUse envelope", () => {
  // arrange
  const toolInput = {
    command: "printf 'completed\\n'",
    timeout: 12,
  };
  const toolResponse = [
    { type: "text", text: "completed\n" },
  ] satisfies ToolResultEvent["content"];
  const event = {
    type: "tool_result",
    toolCallId: "tool-call-built-in",
    toolName: "bash",
    input: toolInput,
    content: toolResponse,
    isError: false,
    details: { durationMs: 8 },
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
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_input: {
      command: "printf 'completed\\n'",
      timeout: 12,
    },
    tool_response: [{ type: "text", text: "completed\n" }],
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.strictEqual(payload.tool_response, toolResponse);
});
