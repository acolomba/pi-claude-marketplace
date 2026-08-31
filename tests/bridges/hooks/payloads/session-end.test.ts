// Unit test for the SessionEnd payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionShutdownEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("emits the complete SessionEnd envelope with the quit reason", () => {
  // arrange
  const context = {
    sessionId: "session-end-quit",
    transcriptPath: "/sessions/session-end-quit.jsonl",
    cwd: "/workspaces/session-end-quit",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "quit",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-end-quit",
    transcript_path: "/sessions/session-end-quit.jsonl",
    cwd: "/workspaces/session-end-quit",
    hook_event_name: "SessionEnd",
    reason: "quit",
  });
  assert.strictEqual(payload.session_id, context.sessionId);
  assert.strictEqual(payload.transcript_path, context.transcriptPath);
  assert.strictEqual(payload.cwd, context.cwd);
});

test("propagates the reload reason in a complete SessionEnd envelope", () => {
  // arrange
  const context = {
    sessionId: "session-end-reload",
    transcriptPath: "/sessions/session-end-reload.jsonl",
    cwd: "/workspaces/session-end-reload",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "reload",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-end-reload",
    transcript_path: "/sessions/session-end-reload.jsonl",
    cwd: "/workspaces/session-end-reload",
    hook_event_name: "SessionEnd",
    reason: "reload",
  });
});

test("propagates the new reason without emitting the target session file", () => {
  // arrange
  const context = {
    sessionId: "session-end-new",
    transcriptPath: "/sessions/session-end-new.jsonl",
    cwd: "/workspaces/session-end-new",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "new",
    targetSessionFile: "/sessions/session-end-new-target.jsonl",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-end-new",
    transcript_path: "/sessions/session-end-new.jsonl",
    cwd: "/workspaces/session-end-new",
    hook_event_name: "SessionEnd",
    reason: "new",
  });
});

test("propagates the resume reason without emitting the target session file", () => {
  // arrange
  const context = {
    sessionId: "session-end-resume",
    transcriptPath: "/sessions/session-end-resume.jsonl",
    cwd: "/workspaces/session-end-resume",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "resume",
    targetSessionFile: "/sessions/session-end-resume-target.jsonl",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-end-resume",
    transcript_path: "/sessions/session-end-resume.jsonl",
    cwd: "/workspaces/session-end-resume",
    hook_event_name: "SessionEnd",
    reason: "resume",
  });
});

test("propagates the fork reason without emitting the target session file", () => {
  // arrange
  const context = {
    sessionId: "session-end-fork",
    transcriptPath: "/sessions/session-end-fork.jsonl",
    cwd: "/workspaces/session-end-fork",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "fork",
    targetSessionFile: "/sessions/session-end-fork-target.jsonl",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-end-fork",
    transcript_path: "/sessions/session-end-fork.jsonl",
    cwd: "/workspaces/session-end-fork",
    hook_event_name: "SessionEnd",
    reason: "fork",
  });
});

test("preserves accepted empty context values in the complete envelope", () => {
  // arrange
  const context = {
    sessionId: "",
    transcriptPath: "",
    cwd: "",
  } satisfies TranslationContext;
  const event: SessionShutdownEvent = {
    type: "session_shutdown",
    reason: "quit",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "",
    transcript_path: "",
    cwd: "",
    hook_event_name: "SessionEnd",
    reason: "quit",
  });
});
