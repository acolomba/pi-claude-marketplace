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
