// Unit test for the PostToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translatePostToolUse } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ToolResultEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("maps a successful built-in tool to the complete PostToolUse envelope", () => {
  // arrange
  const toolInput = {
    command: "printf 'completed\\n'",
    timeout: 12,
  };
  const toolResponse = [{ type: "text", text: "completed\n" }] satisfies ToolResultEvent["content"];
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
      timeout: 12000,
    },
    tool_response: [{ type: "text", text: "completed\n" }],
  };

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.notStrictEqual(payload.tool_input, toolInput);
  assert.strictEqual(payload.tool_response, toolResponse);
});

for (const { name, toolName, input, expected, expectedName } of [
  {
    name: "Read path and lines",
    toolName: "read",
    expectedName: "Read",
    input: { path: "notes.txt", offset: 2 },
    expected: { file_path: "/workspace/result/notes.txt", offset: 2 },
  },
  {
    name: "Write path and content",
    toolName: "write",
    expectedName: "Write",
    input: { path: "output.txt", content: "written" },
    expected: { file_path: "/workspace/result/output.txt", content: "written" },
  },
  {
    name: "Glob pattern without native cap",
    toolName: "find",
    expectedName: "Glob",
    input: { pattern: "*.md", limit: 2 },
    expected: { pattern: "*.md" },
  },
  {
    name: "Grep content options",
    toolName: "grep",
    expectedName: "Grep",
    input: { pattern: "needle", ignoreCase: true, limit: 2 },
    expected: { pattern: "needle", output_mode: "content", "-n": true, "-i": true, head_limit: 2 },
  },
  {
    name: "LS native-shaped input",
    toolName: "ls",
    expectedName: "LS",
    input: { path: "notes", limit: 2 },
    expected: { path: "notes", limit: 2 },
  },
]) {
  test(`translates successful ${name} input`, () => {
    const event = {
      type: "tool_result",
      toolCallId: "successful-result",
      toolName,
      input,
      content: [{ type: "text", text: "result" }],
      isError: false,
      details: undefined,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "result-session",
      transcriptPath: "/sessions/result.jsonl",
      cwd: "/workspace/result",
    } satisfies TranslationContext;

    const payload = translatePostToolUse(event, context);

    assert.deepStrictEqual(payload.tool_input, expected);
    assert.strictEqual(payload.tool_name, expectedName);
    if (toolName === "read") {
      assert.deepStrictEqual(payload.tool_response, {
        type: "text",
        file: {
          filePath: "/workspace/result/notes.txt",
          content: "result",
          startLine: 2,
          numLines: 1,
        },
      });
    } else if (toolName === "write") {
      assert.deepStrictEqual(payload.tool_response, {
        filePath: "/workspace/result/output.txt",
        content: "written",
      });
    } else {
      assert.strictEqual(payload.tool_response, event.content);
    }
  });
}

test("preserves a successful custom tool name and nested values without mutation", () => {
  // arrange
  const toolInput = {
    query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
    limit: 3,
  };
  const toolResponse = [
    { type: "text", text: "three matches" },
    { type: "text", text: "catalog complete" },
  ] satisfies ToolResultEvent["content"];
  const event = {
    type: "tool_result",
    toolCallId: "tool-call-custom",
    toolName: "mcp__catalog__lookup",
    input: toolInput,
    content: toolResponse,
    isError: false,
    details: { server: "catalog", elapsedMs: 14 },
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
    hook_event_name: "PostToolUse",
    tool_name: "mcp__catalog__lookup",
    tool_input: {
      query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
      limit: 3,
    },
    tool_response: [
      { type: "text", text: "three matches" },
      { type: "text", text: "catalog complete" },
    ],
  };

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.strictEqual(payload.tool_response, toolResponse);
  assert.deepStrictEqual(toolInput, {
    query: { phrase: "hook payloads", languages: ["typescript", "javascript"] },
    limit: 3,
  });
  assert.deepStrictEqual(toolResponse, [
    { type: "text", text: "three matches" },
    { type: "text", text: "catalog complete" },
  ]);
  assert.deepStrictEqual(context, {
    sessionId: "session-custom",
    transcriptPath: "/sessions/session-custom.jsonl",
    cwd: "/workspace/custom",
  });
});

test("projects a successful write from its executed input", () => {
  const event = {
    type: "tool_result",
    toolCallId: "write-result",
    toolName: "write",
    input: { path: "output.txt", content: "written" },
    content: [{ type: "text" as const, text: "Successfully wrote to output.txt" }],
    isError: false,
    details: undefined,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "write-session",
    transcriptPath: "/sessions/write.jsonl",
    cwd: "/workspace/result",
  } satisfies TranslationContext;

  assert.deepStrictEqual(translatePostToolUse(event, context).tool_response, {
    filePath: "/workspace/result/output.txt",
    content: "written",
  });
});
