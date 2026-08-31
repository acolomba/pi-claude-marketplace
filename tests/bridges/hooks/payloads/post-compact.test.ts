// Unit test for the PostCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("emits the complete PostCompact envelope with an automatic trigger", () => {
  // arrange
  const event = {
    type: "session_compact",
    compactionEntry: {
      type: "compaction",
      id: "compact-1",
      parentId: "message-1",
      timestamp: "2026-08-31T04:36:05.000Z",
      summary: "Earlier context",
      firstKeptEntryId: "message-2",
      tokensBefore: 4_096,
    },
    fromExtension: false,
    reason: "threshold",
    willRetry: false,
  } satisfies SessionCompactEvent;
  const context = {
    sessionId: "session-1",
    transcriptPath: "/sessions/session-1.jsonl",
    cwd: "/workspace/project",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-1",
    transcript_path: "/sessions/session-1.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "PostCompact",
    trigger: "auto",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});
