// Unit test for the UserPromptSubmit payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts";

import type { UserPromptSubmitStdin } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { InputEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("emits the complete UserPromptSubmit envelope with the prompt text", () => {
  // arrange
  const event = {
    type: "input",
    text: "hello world",
    source: "interactive",
  } satisfies InputEvent;
  const context = {
    sessionId: "session-prompt",
    transcriptPath: "/sessions/session-prompt.jsonl",
    cwd: "/workspace/project",
  } satisfies TranslationContext;
  const expectedEvent = {
    type: "input",
    text: "hello world",
    source: "interactive",
  } satisfies InputEvent;
  const expectedContext = {
    sessionId: "session-prompt",
    transcriptPath: "/sessions/session-prompt.jsonl",
    cwd: "/workspace/project",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-prompt",
    transcript_path: "/sessions/session-prompt.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "UserPromptSubmit",
    prompt: "hello world",
  } satisfies UserPromptSubmitStdin;
  const expectedKeys = [
    "session_id",
    "transcript_path",
    "cwd",
    "hook_event_name",
    "prompt",
  ];

  // act
  const promptPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(promptPayload, expectedPayload);
  assert.deepStrictEqual(Object.keys(promptPayload), expectedKeys);
  assert.deepStrictEqual(event, expectedEvent);
  assert.deepStrictEqual(context, expectedContext);
});

test("preserves a multi-line prompt in the complete UserPromptSubmit envelope", () => {
  // arrange
  const event = {
    type: "input",
    text: "line 1\nline 2\nline 3",
    source: "interactive",
  } satisfies InputEvent;
  const context = {
    sessionId: "session-multi-line",
    transcriptPath: "/sessions/session-multi-line.jsonl",
    cwd: "/workspace/multi-line",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-multi-line",
    transcript_path: "/sessions/session-multi-line.jsonl",
    cwd: "/workspace/multi-line",
    hook_event_name: "UserPromptSubmit",
    prompt: "line 1\nline 2\nline 3",
  } satisfies UserPromptSubmitStdin;

  // act
  const promptPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(promptPayload, expectedPayload);
});
