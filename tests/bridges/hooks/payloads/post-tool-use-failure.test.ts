// Unit test for the PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("post-tool-use-failure: emits the PostToolUseFailure envelope propagating error content into tool_response", () => {
  const event = {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "false" },
    content: [{ type: "text", text: "exit code 1: command failed" }],
    isError: true,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"false"},"tool_response":[{"type":"text","text":"exit code 1: command failed"}]}',
  );
});

test("post-tool-use-failure: CustomToolCallEvent toolName passes through unchanged", () => {
  const event = {
    type: "tool_result",
    toolCallId: "tc-2",
    toolName: "mcp__server__tool",
    input: {},
    content: [{ type: "text", text: "mcp error" }],
    isError: true,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(actual.tool_name, "mcp__server__tool");
  assert.equal(actual.hook_event_name, "PostToolUseFailure");
});

test("post-tool-use-failure: errored content propagates through tool_response (error payload preservation)", () => {
  const errorContent = [
    { type: "text", text: "ENOENT: no such file" },
    { type: "text", text: "stack trace at ..." },
  ];
  const event = {
    type: "tool_result",
    toolCallId: "tc-3",
    toolName: "read",
    input: { file_path: "/missing.txt" },
    content: errorContent,
    isError: true,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(actual.tool_name, "Read");
  assert.deepEqual(actual.tool_response, errorContent);
});
