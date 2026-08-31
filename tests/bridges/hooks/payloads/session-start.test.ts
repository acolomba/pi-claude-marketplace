// Unit test for the SessionStart payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionStartEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("emits the complete SessionStart envelope with the startup source", () => {
  // arrange
  const context = {
    sessionId: "session-start-startup",
    transcriptPath: "/sessions/session-start-startup.jsonl",
    cwd: "/workspaces/session-start-startup",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "startup",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-start-startup",
    transcript_path: "/sessions/session-start-startup.jsonl",
    cwd: "/workspaces/session-start-startup",
    hook_event_name: "SessionStart",
    source: "startup",
  });
  assert.strictEqual(payload.session_id, context.sessionId);
  assert.strictEqual(payload.transcript_path, context.transcriptPath);
  assert.strictEqual(payload.cwd, context.cwd);
});

test("propagates the resume source in the complete SessionStart envelope", () => {
  // arrange
  const context = {
    sessionId: "session-start-resume",
    transcriptPath: "/sessions/session-start-resume.jsonl",
    cwd: "/workspaces/session-start-resume",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "resume",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-start-resume",
    transcript_path: "/sessions/session-start-resume.jsonl",
    cwd: "/workspaces/session-start-resume",
    hook_event_name: "SessionStart",
    source: "resume",
  });
});

test("propagates the reload source in the complete SessionStart envelope", () => {
  // arrange
  const context = {
    sessionId: "session-start-reload",
    transcriptPath: "/sessions/session-start-reload.jsonl",
    cwd: "/workspaces/session-start-reload",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "reload",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-start-reload",
    transcript_path: "/sessions/session-start-reload.jsonl",
    cwd: "/workspaces/session-start-reload",
    hook_event_name: "SessionStart",
    source: "reload",
  });
});

test("propagates the new source in the complete SessionStart envelope", () => {
  // arrange
  const context = {
    sessionId: "session-start-new",
    transcriptPath: "/sessions/session-start-new.jsonl",
    cwd: "/workspaces/session-start-new",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "new",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-start-new",
    transcript_path: "/sessions/session-start-new.jsonl",
    cwd: "/workspaces/session-start-new",
    hook_event_name: "SessionStart",
    source: "new",
  });
});

test("propagates the fork source in the complete SessionStart envelope", () => {
  // arrange
  const context = {
    sessionId: "session-start-fork",
    transcriptPath: "/sessions/session-start-fork.jsonl",
    cwd: "/workspaces/session-start-fork",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "fork",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-start-fork",
    transcript_path: "/sessions/session-start-fork.jsonl",
    cwd: "/workspaces/session-start-fork",
    hook_event_name: "SessionStart",
    source: "fork",
  });
});

test("accepts empty session, transcript, and working-directory values", () => {
  // arrange
  const context = {
    sessionId: "",
    transcriptPath: "",
    cwd: "",
  } satisfies TranslationContext;
  const event: SessionStartEvent = {
    type: "session_start",
    reason: "startup",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "",
    transcript_path: "",
    cwd: "",
    hook_event_name: "SessionStart",
    source: "startup",
  });
});
