import assert from "node:assert/strict";
import test from "node:test";

import { BUCKET_A_EVENTS } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type { TranslationContext } from "../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type {
  DispatchableEvent,
  ToolEvent,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

const LOCAL_DISPATCHABLE: readonly DispatchableEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
];

const EVENT_TO_KEBAB: Readonly<Record<DispatchableEvent, string>> = {
  SessionStart: "session-start",
  UserPromptSubmit: "user-prompt-submit",
  PreToolUse: "pre-tool-use",
  PostToolUse: "post-tool-use",
  PostToolUseFailure: "post-tool-use-failure",
  PreCompact: "pre-compact",
  PostCompact: "post-compact",
  SessionEnd: "session-end",
  Stop: "stop",
  StopFailure: "stop-failure",
};

const TOOL_EVENTS: readonly ToolEvent[] = ["PreToolUse", "PostToolUse", "PostToolUseFailure"];

interface TranslatorModule {
  translate: (event: unknown, context: TranslationContext) => unknown;
}

async function loadTranslator(name: DispatchableEvent): Promise<TranslatorModule> {
  const kebab = EVENT_TO_KEBAB[name];
  return (await import(
    "../../extensions/pi-claude-marketplace/bridges/hooks/payloads/" + kebab + ".ts"
  )) as TranslatorModule;
}

function toolEventFor(event: ToolEvent, toolName: string): unknown {
  if (event === "PreToolUse") {
    return {
      type: "tool_call",
      toolCallId: "translator-call",
      toolName,
      input: { command: "printf translator" },
    };
  }

  return {
    type: "tool_result",
    toolCallId: "translator-call",
    toolName,
    input: { command: "printf translator" },
    content: [{ type: "text", text: "translator\n" }],
    isError: event === "PostToolUseFailure",
  };
}

test("keeps one translator module for every dispatchable event", async () => {
  // arrange
  const expectedExports = [
    { event: "SessionStart", exportType: "function" },
    { event: "UserPromptSubmit", exportType: "function" },
    { event: "PreToolUse", exportType: "function" },
    { event: "PostToolUse", exportType: "function" },
    { event: "PostToolUseFailure", exportType: "function" },
    { event: "PreCompact", exportType: "function" },
    { event: "PostCompact", exportType: "function" },
    { event: "SessionEnd", exportType: "function" },
    { event: "Stop", exportType: "function" },
    { event: "StopFailure", exportType: "function" },
  ];
  const expectedAdmission = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "PostCompact",
    "SessionEnd",
    "Stop",
    "StopFailure",
  ];

  // act
  const translatorExports: Array<{ event: DispatchableEvent; exportType: string }> = [];
  for (const event of LOCAL_DISPATCHABLE) {
    const translator = await loadTranslator(event);
    translatorExports.push({ event, exportType: typeof translator.translate });
  }

  // assert
  assert.deepStrictEqual(translatorExports, expectedExports);
  assert.deepStrictEqual(BUCKET_A_EVENTS, expectedAdmission);
});

test("keeps shared built-in and custom tool-name mapping across all tool translators", async () => {
  // arrange
  const context = {
    sessionId: "translator-session",
    transcriptPath: "/sessions/translator-session.jsonl",
    cwd: "/workspace/translator",
  } satisfies TranslationContext;
  const expectedMappings = [
    { event: "PreToolUse", input: "bash", mapped: "Bash" },
    { event: "PreToolUse", input: "mcp__server__tool", mapped: "mcp__server__tool" },
    { event: "PostToolUse", input: "bash", mapped: "Bash" },
    { event: "PostToolUse", input: "mcp__server__tool", mapped: "mcp__server__tool" },
    { event: "PostToolUseFailure", input: "bash", mapped: "Bash" },
    {
      event: "PostToolUseFailure",
      input: "mcp__server__tool",
      mapped: "mcp__server__tool",
    },
  ];

  // act
  const mappings: Array<{ event: ToolEvent; input: string; mapped: unknown }> = [];
  for (const event of TOOL_EVENTS) {
    const translator = await loadTranslator(event);
    for (const input of ["bash", "mcp__server__tool"]) {
      const payload = translator.translate(toolEventFor(event, input), context) as Record<
        string,
        unknown
      >;
      mappings.push({ event, input, mapped: payload.tool_name });
    }
  }

  // assert
  assert.deepStrictEqual(mappings, expectedMappings);
});
