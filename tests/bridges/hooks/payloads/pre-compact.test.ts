// Unit test for the PreCompact payload translator (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts";

import type { TranslationContext } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { SessionBeforeCompactEvent } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function preCompactEvent(reason: SessionBeforeCompactEvent["reason"]): SessionBeforeCompactEvent {
  return {
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
    reason,
    willRetry: false,
    signal: new AbortController().signal,
  };
}

const compactTriggerCases = [
  { reason: "manual", trigger: "manual" },
  { reason: "threshold", trigger: "auto" },
  { reason: "overflow", trigger: "auto" },
] as const satisfies readonly {
  reason: SessionBeforeCompactEvent["reason"];
  trigger: "manual" | "auto";
}[];

for (const { reason, trigger } of compactTriggerCases) {
  test(`maps the ${reason} reason to the ${trigger} PreCompact trigger`, () => {
    // arrange
    const event = preCompactEvent(reason);
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

test("preserves empty context strings in the complete PreCompact envelope", () => {
  // arrange
  const event = {
    ...preCompactEvent("manual"),
    preparation: {
      firstKeptEntryId: "message-empty-context",
      messagesToSummarize: [],
      turnPrefixMessages: [],
      isSplitTurn: false,
      tokensBefore: 0,
      fileOps: {
        read: new Set<string>(),
        written: new Set<string>(),
        edited: new Set<string>(),
      },
      settings: {
        enabled: true,
        reserveTokens: 8_192,
        keepRecentTokens: 2_048,
      },
    },
    branchEntries: [],
    willRetry: true,
  } satisfies SessionBeforeCompactEvent;
  const context = {
    sessionId: "",
    transcriptPath: "",
    cwd: "",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "",
    transcript_path: "",
    cwd: "",
    hook_event_name: "PreCompact",
    trigger: "manual",
  };

  // act
  const payload = translate(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});
