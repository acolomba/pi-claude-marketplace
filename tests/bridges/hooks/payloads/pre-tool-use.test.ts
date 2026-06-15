// Unit test for the PreToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolCallEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const ctx: TranslationContext = {
  sessionId: "sess-1",
  transcriptPath: "/tmp/t.jsonl",
  cwd: "/proj",
};

test("pre-tool-use: emits the PreToolUse envelope with bash -> Bash capitalization via TOOL-01", () => {
  const event = {
    type: "tool_call",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "echo hi" },
  } as unknown as ToolCallEvent;

  const actual = translate(event, ctx);

  assert.equal(
    JSON.stringify(actual),
    '{"session_id":"sess-1","transcript_path":"/tmp/t.jsonl","cwd":"/proj","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo hi"}}',
  );
});

test("pre-tool-use: CustomToolCallEvent toolName passes through unchanged (TOOL-01 fallback)", () => {
  // The CustomToolCallEvent arm has an open `toolName: string` -- e.g.
  // `mcp__server__tool` from pi-mcp-adapter. The helper's `??` fallback
  // emits the supplied name verbatim into Claude's tool_name field.
  const event = {
    type: "tool_call",
    toolCallId: "tc-2",
    toolName: "mcp__server__tool",
    input: { foo: 1 },
  } as unknown as ToolCallEvent;

  const actual = translate(event, ctx);

  assert.equal(actual.tool_name, "mcp__server__tool");
  assert.equal(actual.hook_event_name, "PreToolUse");
});

test("pre-tool-use: every Pi tool literal capitalizes correctly", () => {
  const cases: Array<[string, string]> = [
    ["bash", "Bash"],
    ["read", "Read"],
    ["edit", "Edit"],
    ["write", "Write"],
    ["grep", "Grep"],
    ["find", "Glob"],
    ["ls", "LS"],
  ];

  for (const [piName, claudeName] of cases) {
    const event = {
      type: "tool_call",
      toolCallId: "tc-x",
      toolName: piName,
      input: {},
    } as unknown as ToolCallEvent;

    const actual = translate(event, ctx);
    assert.equal(actual.tool_name, claudeName, `${piName} -> ${claudeName}`);
  }
});
