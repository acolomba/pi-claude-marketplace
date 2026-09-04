// Unit test for the Stop payload translator (STOP-02).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";

import type {
  StopEvent,
  StopStdin,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";
import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

void ({
  last_assistant_message: "Type-only assistant message",
  stop_hook_active: true,
} satisfies StopEvent);
void ({
  session_id: "session-type",
  transcript_path: "/tmp/session-type.jsonl",
  cwd: "/project-type",
  hook_event_name: "Stop",
  last_assistant_message: "Type-only assistant message",
  stop_hook_active: true,
} satisfies StopStdin);
void ({
  last_assistant_message: "Invalid active state",
  // @ts-expect-error a Stop event active state is boolean
  stop_hook_active: "true",
} satisfies StopEvent);

test("emits the complete active Stop envelope", () => {
  // arrange
  const event = {
    last_assistant_message: "Assistant response complete",
    stop_hook_active: true,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-active",
    transcriptPath: "/tmp/session-active.jsonl",
    cwd: "/project-active",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-active",
    transcript_path: "/tmp/session-active.jsonl",
    cwd: "/project-active",
    hook_event_name: "Stop",
    last_assistant_message: "Assistant response complete",
    stop_hook_active: true,
  } satisfies StopStdin;

  // act
  const stopPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopPayload, expectedPayload);
});

test("emits the complete inactive Stop envelope", () => {
  // arrange
  const event = {
    last_assistant_message: "Assistant response paused",
    stop_hook_active: false,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-inactive",
    transcriptPath: "/tmp/session-inactive.jsonl",
    cwd: "/project-inactive",
  } satisfies TranslationContext;
  const expectedEvent = {
    last_assistant_message: "Assistant response paused",
    stop_hook_active: false,
  } satisfies StopEvent;
  const expectedContext = {
    sessionId: "session-inactive",
    transcriptPath: "/tmp/session-inactive.jsonl",
    cwd: "/project-inactive",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-inactive",
    transcript_path: "/tmp/session-inactive.jsonl",
    cwd: "/project-inactive",
    hook_event_name: "Stop",
    last_assistant_message: "Assistant response paused",
    stop_hook_active: false,
  } satisfies StopStdin;

  // act
  const stopPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopPayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopPayload, "background_tasks"), false);
  assert.strictEqual(Object.hasOwn(stopPayload, "session_crons"), false);
  assert.deepStrictEqual(event, expectedEvent);
  assert.deepStrictEqual(context, expectedContext);
});

test("preserves accepted empty Stop text and transcript path", () => {
  // arrange
  const event = {
    last_assistant_message: "",
    stop_hook_active: true,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-empty-text",
    transcriptPath: "",
    cwd: "/project-empty-text",
  } satisfies TranslationContext;
  const expectedEvent = {
    last_assistant_message: "",
    stop_hook_active: true,
  } satisfies StopEvent;
  const expectedContext = {
    sessionId: "session-empty-text",
    transcriptPath: "",
    cwd: "/project-empty-text",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-empty-text",
    transcript_path: "",
    cwd: "/project-empty-text",
    hook_event_name: "Stop",
    last_assistant_message: "",
    stop_hook_active: true,
  } satisfies StopStdin;

  // act
  const stopPayload = translate(event, context);

  // assert
  assert.deepStrictEqual(stopPayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopPayload, "background_tasks"), false);
  assert.strictEqual(Object.hasOwn(stopPayload, "session_crons"), false);
  assert.deepStrictEqual(event, expectedEvent);
  assert.deepStrictEqual(context, expectedContext);
});
