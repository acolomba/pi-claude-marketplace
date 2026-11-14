// Unit test for the PostToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).

import assert from "node:assert/strict";
import { homedir } from "node:os";
import path from "node:path";
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
    tool_use_id: "tool-call-built-in",
    tool_response: {
      interrupted: false,
      structuredContent: [{ type: "text", text: "completed\n" }],
    },
  };

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.notStrictEqual(payload.tool_input, toolInput);
  assert.deepStrictEqual(payload.tool_response, expectedPayload.tool_response);
});

for (const identity of [
  { agentType: "reviewer", sessionId: "child-session" },
  undefined,
  { agentType: "reviewer", sessionId: "other-session" },
]) {
  test(`includes only matching child identity in a successful result: ${identity?.sessionId ?? "absent"}`, () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId: "child-result",
      toolName: "catalog",
      input: { query: "entry" },
      content: [{ type: "text", text: "found" }],
      details: undefined,
      isError: false,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "child-session",
      transcriptPath: "/sessions/child.jsonl",
      cwd: "/workspace",
      ...(identity === undefined ? {} : { childIdentity: identity }),
    } satisfies TranslationContext;

    // act
    const payload = translatePostToolUse(event, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "child-session",
      transcript_path: "/sessions/child.jsonl",
      cwd: "/workspace",
      hook_event_name: "PostToolUse",
      tool_name: "catalog",
      tool_input: { query: "entry" },
      tool_use_id: "child-result",
      tool_response: [{ type: "text", text: "found" }],
      ...(identity?.sessionId === context.sessionId
        ? { agent_type: "reviewer", agent_id: "child-session" }
        : {}),
    });
  });
}

test("projects a native find result under its expanded search root", () => {
  const event = {
    type: "tool_result",
    toolCallId: "find-home",
    toolName: "find",
    input: { path: "@~/docs", pattern: "*.txt" },
    content: [{ type: "text", text: "a.txt" }],
    details: undefined,
    isError: false,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "find-session",
    transcriptPath: "/sessions/find.jsonl",
    cwd: "/workspace",
  } satisfies TranslationContext;

  assert.deepStrictEqual(translatePostToolUse(event, context).tool_response, {
    filenames: [path.join(homedir(), "docs", "a.txt")],
    numFiles: 1,
  });
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
    } else if (toolName === "find") {
      assert.deepStrictEqual(payload.tool_response, {
        filenames: ["/workspace/result/result"],
        numFiles: 1,
      });
    } else if (toolName === "grep") {
      assert.deepStrictEqual(payload.tool_response, { mode: "content", content: "result" });
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
    tool_use_id: "tool-call-custom",
    tool_response: {
      content: [
        { type: "text", text: "three matches" },
        { type: "text", text: "catalog complete" },
      ],
    },
  };

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(payload.tool_input, toolInput);
  assert.deepStrictEqual(payload.tool_response, { content: toolResponse });
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

test("projects only actual MCP content and structured content", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "mcp-structured",
    toolName: "mcp__catalog__lookup",
    input: { text: "ping" },
    content: [{ type: "text", text: "visible" }],
    structuredContent: { secret: "structured" },
    details: { server: "catalog", tool: "lookup", stale: "old" },
    isError: false,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "/sessions/session.jsonl",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload.tool_response, {
    content: [{ type: "text", text: "visible" }],
    structuredContent: { secret: "structured" },
  });
});

test("passes custom structured output without a built-in codec", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "custom-structured",
    toolName: "catalog",
    input: { file_path: "looks-like-read" },
    content: [{ type: "text", text: "visible" }],
    structuredContent: { rows: [{ value: 7 }] },
    details: undefined,
    isError: false,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "/sessions/session.jsonl",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(payload.tool_response, { rows: [{ value: 7 }] });
});

for (const toolName of ["Bash", "Read"]) {
  test(`keeps the structured result of a custom ${toolName} tool`, () => {
    const event = {
      type: "tool_result",
      toolCallId: `custom-${toolName}`,
      toolName,
      input: { query: "hello" },
      content: [{ type: "text", text: "public" }],
      structuredContent: { rows: [{ value: "custom" }] },
      details: { secret: "old" },
      isError: false,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "session",
      transcriptPath: "/sessions/session.jsonl",
      cwd: "/workspace",
    } satisfies TranslationContext;

    assert.deepStrictEqual(translatePostToolUse(event, context).tool_response, {
      rows: [{ value: "custom" }],
    });
  });
}

test("preserves an explicit null custom structured result", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "custom-null",
    toolName: "catalog",
    input: {},
    content: [{ type: "text", text: "fallback" }],
    structuredContent: null,
    details: undefined,
    isError: false,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "/sessions/session.jsonl",
    cwd: "/workspace",
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.strictEqual(payload.tool_response, null);
});

test("keeps the native result when a malformed envelope omits the tool name", () => {
  const event = {
    type: "tool_result",
    toolCallId: "missing-name",
    input: {},
    content: [{ type: "text" as const, text: "native result" }],
    details: undefined,
    isError: false,
  } as ToolResultEvent;
  const context = {
    sessionId: "session",
    transcriptPath: "/sessions/session.jsonl",
    cwd: "/workspace",
  } satisfies TranslationContext;

  assert.deepStrictEqual(translatePostToolUse(event, context).tool_response, event.content);
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

for (const toolCallId of ["call-1", "call-1/2"]) {
  test(`sends the call id ${toolCallId} unchanged as tool_use_id after tool_input (D-PG6-05)`, () => {
    // arrange
    const event = {
      type: "tool_result",
      toolCallId,
      toolName: "custom",
      input: { query: "one" },
      content: [{ type: "text", text: "found" }],
      details: undefined,
      isError: false,
    } satisfies ToolResultEvent;
    const context = {
      sessionId: "session-id",
      transcriptPath: "",
      cwd: "/workspace",
    } satisfies TranslationContext;

    // act
    const payload = translatePostToolUse(event, context);

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "session-id",
      transcript_path: "",
      cwd: "/workspace",
      hook_event_name: "PostToolUse",
      tool_name: "custom",
      tool_input: { query: "one" },
      tool_use_id: toolCallId,
      tool_response: [{ type: "text", text: "found" }],
    });
    assert.deepStrictEqual(Object.keys(payload), [
      "session_id",
      "transcript_path",
      "cwd",
      "hook_event_name",
      "tool_name",
      "tool_input",
      "tool_use_id",
      "tool_response",
    ]);
    assert.strictEqual(Object.hasOwn(payload, "permission_mode"), false);
    assert.strictEqual(Object.hasOwn(payload, "duration_ms"), false);
    assert.strictEqual(Object.hasOwn(payload, "mcp_server"), false);
  });
}

test("keeps a child's identity after tool_use_id", () => {
  // arrange
  const event = {
    type: "tool_result",
    toolCallId: "call-1",
    toolName: "custom",
    input: { query: "one" },
    content: [{ type: "text", text: "found" }],
    details: undefined,
    isError: false,
  } satisfies ToolResultEvent;
  const context = {
    sessionId: "child-session",
    transcriptPath: "",
    cwd: "/workspace",
    childIdentity: { agentType: "reviewer", sessionId: "child-session" },
  } satisfies TranslationContext;

  // act
  const payload = translatePostToolUse(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "child-session"],
    ["transcript_path", ""],
    ["cwd", "/workspace"],
    ["hook_event_name", "PostToolUse"],
    ["tool_name", "custom"],
    ["tool_input", { query: "one" }],
    ["tool_use_id", "call-1"],
    ["tool_response", [{ type: "text", text: "found" }]],
    ["agent_type", "reviewer"],
    ["agent_id", "child-session"],
  ]);
});
