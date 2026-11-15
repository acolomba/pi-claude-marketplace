// Unit test for the UserPromptExpansion payload translator (PG-HOOK-06, D-PG6-19, D-PG6-22).

import assert from "node:assert/strict";
import test from "node:test";

import { translateUserPromptExpansion } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts";

import type {
  UserPromptExpansionEvent,
  UserPromptExpansionStdin,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

const CONTEXT = {
  sessionId: "session-expansion",
  transcriptPath: "/sessions/session-expansion.jsonl",
  cwd: "/workspace/project",
} satisfies TranslationContext;

function expansionEvent(commandArgs: string, commandSource?: string): UserPromptExpansionEvent {
  return {
    command_name: "demo:deploy",
    command_args: commandArgs,
    ...(commandSource === undefined ? {} : { command_source: commandSource }),
    input: {
      type: "input",
      text: commandArgs === "" ? "/demo:deploy" : `/demo:deploy ${commandArgs}`,
      source: "interactive",
    },
  };
}

test("PG-HOOK-06: emits the complete UserPromptExpansion envelope of a typed command", () => {
  // arrange
  const event = expansionEvent("staging", "plugin");
  const expectedPayload = {
    session_id: "session-expansion",
    transcript_path: "/sessions/session-expansion.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "demo:deploy",
    command_args: "staging",
    command_source: "plugin",
    prompt: "/demo:deploy staging",
  } satisfies UserPromptExpansionStdin;

  // act
  const payload = translateUserPromptExpansion(event, CONTEXT);

  // assert
  assert.deepStrictEqual(
    { payload, keys: Object.keys(payload) },
    {
      payload: expectedPayload,
      keys: [
        "session_id",
        "transcript_path",
        "cwd",
        "hook_event_name",
        "expansion_type",
        "command_name",
        "command_args",
        "command_source",
        "prompt",
      ],
    },
  );
});

test("PG-HOOK-06: gives no arguments as an empty string and a prompt with no trailing space", () => {
  // arrange
  const event = expansionEvent("", "plugin");

  // act
  const payload = translateUserPromptExpansion(event, CONTEXT);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-expansion",
    transcript_path: "/sessions/session-expansion.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "demo:deploy",
    command_args: "",
    command_source: "plugin",
    prompt: "/demo:deploy",
  } satisfies UserPromptExpansionStdin);
});

test("D-PG6-19: leaves out command_source when the command has none", () => {
  // arrange
  const event = expansionEvent("staging");

  // act
  const payload = translateUserPromptExpansion(event, CONTEXT);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-expansion",
    transcript_path: "/sessions/session-expansion.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "demo:deploy",
    command_args: "staging",
    prompt: "/demo:deploy staging",
  } satisfies UserPromptExpansionStdin);
});

test("D-PG6-19: sends no session title, model, or permission mode from a full context", () => {
  // arrange
  const event = expansionEvent("staging", "plugin");
  const context = {
    ...CONTEXT,
    model: "claude-sonnet",
    sessionTitle: "Release work",
    childIdentity: { agentType: "worker", sessionId: "session-expansion" },
  } satisfies TranslationContext;

  // act
  const payload = translateUserPromptExpansion(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-expansion",
    transcript_path: "/sessions/session-expansion.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "demo:deploy",
    command_args: "staging",
    command_source: "plugin",
    prompt: "/demo:deploy staging",
  } satisfies UserPromptExpansionStdin);
});
