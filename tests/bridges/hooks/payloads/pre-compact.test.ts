// Unit test for the PreCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionBeforeCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("emits the complete PreCompact envelope with an automatic trigger", () => {
  // arrange
  const event = {
    type: "session_before_compact",
    preparation: {
      firstKeptEntryId: "message-2",
      messagesToSummarize: [],
      turnPrefixMessages: [],
      isSplitTurn: false,
      tokensBefore: 4_096,
      previousSummary: "Earlier summary",
      fileOps: {
        read: new Set(["/workspace/read.ts"]),
        written: new Set(["/workspace/written.ts"]),
        edited: new Set(["/workspace/edited.ts"]),
      },
      settings: {
        enabled: true,
        reserveTokens: 16_384,
        keepRecentTokens: 4_096,
      },
    },
    branchEntries: [
      {
        type: "thinking_level_change",
        id: "entry-1",
        parentId: null,
        timestamp: "2026-08-31T05:08:00.000Z",
        thinkingLevel: "medium",
      },
    ],
    customInstructions: "Preserve decisions.",
    reason: "threshold",
    willRetry: false,
    signal: new AbortController().signal,
  } satisfies SessionBeforeCompactEvent;
  const context = {
    sessionId: "session-1",
    transcriptPath: "/sessions/session-1.jsonl",
    cwd: "/workspace/project",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-1",
    transcript_path: "/sessions/session-1.jsonl",
    cwd: "/workspace/project",
    hook_event_name: "PreCompact",
    trigger: "auto",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});
