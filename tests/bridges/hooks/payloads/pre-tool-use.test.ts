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

  const actual = translate(event, {
    sessionId: "sess-1",
    transcriptPath: "/tmp/t.jsonl",
    cwd: "/proj",
  });

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

    const actual = translate(event, {
      sessionId: "sess-1",
      transcriptPath: "/tmp/t.jsonl",
      cwd: "/proj",
    });
    assert.equal(actual.tool_name, claudeName, `${piName} -> ${claudeName}`);
  }
});
