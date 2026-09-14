// Unit test for the PostCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function postCompactEvent(reason: SessionCompactEvent["reason"]): SessionCompactEvent {
  return {
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
    reason,
    willRetry: false,
  };
}

const compactTriggerCases = [
  { reason: "manual", trigger: "manual" },
  { reason: "threshold", trigger: "auto" },
  { reason: "overflow", trigger: "auto" },
] as const satisfies readonly {
  reason: SessionCompactEvent["reason"];
  trigger: "manual" | "auto";
}[];

for (const { reason, trigger } of compactTriggerCases) {
  test(`maps the ${reason} reason to the ${trigger} PostCompact trigger`, () => {
    // arrange
    const event = postCompactEvent(reason);
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
      trigger,
    };

    // act
    const firstPayload = translate(event, context);
    const repeatedPayload = translate(event, context);

    // assert
    assert.deepStrictEqual(firstPayload, expectedPayload);
    assert.deepStrictEqual(repeatedPayload, expectedPayload);
  });
}

test("preserves empty context strings in the complete PostCompact envelope", () => {
  // arrange
  const event = {
    ...postCompactEvent("manual"),
    compactionEntry: {
      type: "compaction",
      id: "compact-empty-context",
      parentId: null,
      timestamp: "2026-08-31T04:37:05.000Z",
      summary: "",
      firstKeptEntryId: "message-first",
      tokensBefore: 0,
    },
    fromExtension: true,
    willRetry: true,
  } satisfies SessionCompactEvent;
  const context = {
    sessionId: "",
    transcriptPath: "",
    cwd: "",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "",
    transcript_path: "",
    cwd: "",
    hook_event_name: "PostCompact",
    trigger: "manual",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});
