// Unit test for the PreCompact payload translator (PAYL-01 / D-60-04, D-PG6-08).

import assert from "node:assert/strict";
import test from "node:test";

import { translatePreCompact } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts";

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
  { reason: "manual", trigger: "manual", customInstructions: "Preserve decisions." },
  { reason: "threshold", trigger: "auto", customInstructions: null },
  { reason: "overflow", trigger: "auto", customInstructions: null },
] as const satisfies readonly {
  reason: SessionBeforeCompactEvent["reason"];
  trigger: "manual" | "auto";
  customInstructions: string | null;
}[];

for (const { reason, trigger, customInstructions } of compactTriggerCases) {
  const sent = customInstructions === null ? "null instructions" : "its instructions";
  test(`maps a ${reason} compaction with instructions to the ${trigger} trigger and ${sent}`, () => {
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
      custom_instructions: customInstructions,
    };

    // act
    const firstPayload = translatePreCompact(event, context);
    const repeatedPayload = translatePreCompact(event, context);

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
    custom_instructions: "Preserve decisions.",
  };

  // act
  const payload = translatePreCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});

test("sends the user's compaction instructions after the trigger (D-PG6-08)", () => {
  // arrange
  const event = { ...preCompactEvent("manual"), customInstructions: "keep the API notes" };
  const context = {
    sessionId: "session-instructions",
    transcriptPath: "/sessions/session-instructions.jsonl",
    cwd: "/workspace/instructions",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-instructions",
    transcript_path: "/sessions/session-instructions.jsonl",
    cwd: "/workspace/instructions",
    hook_event_name: "PreCompact",
    trigger: "manual",
    custom_instructions: "keep the API notes",
  };

  // act
  const payload = translatePreCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.deepStrictEqual(Object.keys(payload), Object.keys(expectedPayload));
});

test("sends null instructions for a manual compaction with none (D-PG6-08)", () => {
  // arrange
  const { customInstructions: _omitted, ...event } = preCompactEvent("manual");
  const context = {
    sessionId: "session-no-instructions",
    transcriptPath: "/sessions/session-no-instructions.jsonl",
    cwd: "/workspace/no-instructions",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-no-instructions",
    transcript_path: "/sessions/session-no-instructions.jsonl",
    cwd: "/workspace/no-instructions",
    hook_event_name: "PreCompact",
    trigger: "manual",
    custom_instructions: null,
  };

  // act
  const payload = translatePreCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
  assert.strictEqual(Object.hasOwn(payload, "custom_instructions"), true);
});

test("sends null instructions for a manual compaction with empty instructions (D-PG6-08)", () => {
  // arrange
  const event = { ...preCompactEvent("manual"), customInstructions: "" };
  const context = {
    sessionId: "session-empty-instructions",
    transcriptPath: "/sessions/session-empty-instructions.jsonl",
    cwd: "/workspace/empty-instructions",
  } satisfies TranslationContext;
  const expectedPayload = {
    session_id: "session-empty-instructions",
    transcript_path: "/sessions/session-empty-instructions.jsonl",
    cwd: "/workspace/empty-instructions",
    hook_event_name: "PreCompact",
    trigger: "manual",
    custom_instructions: null,
  };

  // act
  const payload = translatePreCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});

test("D-PG6-10: sends no effort from a context that holds one, as PreCompact carries none upstream", () => {
  // arrange
  const context = {
    sessionId: "session-effort",
    transcriptPath: "/sessions/session-effort.jsonl",
    cwd: "/workspace/effort",
    effort: { level: "max" },
  } satisfies TranslationContext;

  // act
  const payload = translatePreCompact(preCompactEvent("manual"), context);

  // assert
  assert.strictEqual(Object.hasOwn(payload, "effort"), false);
});
