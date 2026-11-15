// Unit test for the Stop payload translator (STOP-02).

import assert from "node:assert/strict";
import test from "node:test";

import { translateStop } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";

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
  const stopPayload = translateStop(event, context);

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
  const stopPayload = translateStop(event, context);

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
  const stopPayload = translateStop(event, context);

  // assert
  assert.deepStrictEqual(stopPayload, expectedPayload);
  assert.strictEqual(Object.hasOwn(stopPayload, "background_tasks"), false);
  assert.strictEqual(Object.hasOwn(stopPayload, "session_crons"), false);
  assert.deepStrictEqual(event, expectedEvent);
  assert.deepStrictEqual(context, expectedContext);
});

test("D-PG6-10: sends the context's effort as the last member", () => {
  // arrange
  const event = {
    last_assistant_message: "Done.",
    stop_hook_active: false,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-effort",
    transcriptPath: "/sessions/session-effort.jsonl",
    cwd: "/workspace/effort",
    effort: { level: "max" },
  } satisfies TranslationContext;

  // act
  const payload = translateStop(event, context);

  // assert
  assert.deepStrictEqual(Object.entries(payload), [
    ["session_id", "session-effort"],
    ["transcript_path", "/sessions/session-effort.jsonl"],
    ["cwd", "/workspace/effort"],
    ["hook_event_name", "Stop"],
    ["last_assistant_message", "Done."],
    ["stop_hook_active", false],
    ["effort", { level: "max" }],
  ]);
});

test("D-PG6-10: leaves out effort for a context with none", () => {
  // arrange
  const event = {
    last_assistant_message: "Done.",
    stop_hook_active: false,
  } satisfies StopEvent;
  const context = {
    sessionId: "session-effort",
    transcriptPath: "/sessions/session-effort.jsonl",
    cwd: "/workspace/effort",
  } satisfies TranslationContext;

  // act
  const payload = translateStop(event, context);

  // assert
  assert.strictEqual(Object.hasOwn(payload, "effort"), false);
});
