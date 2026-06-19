// Unit test for the PostToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("post-tool-use: emits the PostToolUse envelope with tool_response from event.content", () => {
  const event = {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "echo hi" },
    content: [{ type: "text", text: "hi\n" }],
    isError: false,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"},"tool_response":[{"type":"text","text":"hi\\n"}]}',
  );
});

test("post-tool-use: CustomToolCallEvent toolName passes through unchanged", () => {
  const event = {
    type: "tool_result",
    toolCallId: "tc-2",
    toolName: "mcp__server__tool",
    input: {},
    content: [],
    isError: false,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(actual.tool_name, "mcp__server__tool");
  assert.equal(actual.hook_event_name, "PostToolUse");
});

test("post-tool-use: edit -> Edit capitalization via TOOL-01", () => {
  const event = {
    type: "tool_result",
    toolCallId: "tc-3",
    toolName: "edit",
    input: { file_path: "/x.ts" },
    content: [],
    isError: false,
  } as unknown as ToolResultEvent;

  const actual = translate(event, ctx);

  assert.equal(actual.tool_name, "Edit");
});
