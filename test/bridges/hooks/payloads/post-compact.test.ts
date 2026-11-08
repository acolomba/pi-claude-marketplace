// Unit test for the PostCompact payload translator (PAYL-01 / D-60-04 /
// D-CF5-04).

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  postCompactRunOf,
  translatePostCompact,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts";

import type { HookExecResult } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { HookExitFacts } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts";
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
      compact_summary: "Earlier context",
    };

    // act
    const firstPayload = translatePostCompact(event, context);
    const repeatedPayload = translatePostCompact(event, context);

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
    compact_summary: "",
  };

  // act
  const payload = translatePostCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, expectedPayload);
});

test("carries the compaction entry's whole summary as compact_summary (D-CF5-04)", () => {
  // arrange
  const event = {
    ...postCompactEvent("threshold"),
    compactionEntry: {
      ...postCompactEvent("threshold").compactionEntry,
      summary: "Goal\n\n---\n\nTurn context",
    },
  } satisfies SessionCompactEvent;
  const context = {
    sessionId: "session-summary",
    transcriptPath: "/sessions/session-summary.jsonl",
    cwd: "/workspace/summary",
  } satisfies TranslationContext;

  // act
  const payload = translatePostCompact(event, context);

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "session-summary",
    transcript_path: "/sessions/session-summary.jsonl",
    cwd: "/workspace/summary",
    hook_event_name: "PostCompact",
    trigger: "auto",
    compact_summary: "Goal\n\n---\n\nTurn context",
  });
});

const EXITED = { startFailed: false, timedOut: false, stdout: "", stderr: "" } as const;
const BLOCKED = 'failed; blocking because onFailure is "block"';

describe("postCompactRunOf", () => {
  const cases: readonly {
    name: string;
    facts: HookExitFacts;
    answer: HookExecResult;
    blockedOnFailure: boolean;
    run: { succeeded: boolean; output: string };
  }[] = [
    {
      name: "the stdout of a hook that exits 0",
      facts: { ...EXITED, exitCode: 0, stdout: "notes saved\n", stderr: "ignored" },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: true, output: "notes saved\n" },
    },
    {
      name: "no output for a quiet hook that exits 0",
      facts: { ...EXITED, exitCode: 0 },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: true, output: "" },
    },
    {
      name: "the stderr of a hook that exits 1",
      facts: { ...EXITED, exitCode: 1, stdout: "ignored", stderr: "disk full" },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: false, output: "disk full" },
    },
    {
      name: "the stderr of a hook that exits 2",
      facts: { ...EXITED, exitCode: 2, stderr: "not now" },
      answer: { kind: "block", reason: "not now", fromStderr: true },
      blockedOnFailure: false,
      run: { succeeded: false, output: "not now" },
    },
    {
      name: "the reason of a JSON block on exit 0",
      facts: { ...EXITED, exitCode: 0, stdout: '{"decision":"block","reason":"kept"}' },
      answer: { kind: "block", reason: "kept" },
      blockedOnFailure: false,
      run: { succeeded: true, output: "kept" },
    },
    {
      name: "the stderr of a JSON block with no reason",
      facts: { ...EXITED, exitCode: 1, stdout: '{"decision":"block"}', stderr: "why" },
      answer: { kind: "block" },
      blockedOnFailure: false,
      run: { succeeded: false, output: "why" },
    },
    {
      name: "the stderr of a hook a signal ended",
      facts: { ...EXITED, exitCode: null, stderr: "killed" },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: false, output: "killed" },
    },
    {
      name: "Claude Code's text for a hook its timeout stopped",
      facts: { ...EXITED, timedOut: true, exitCode: null, stderr: "late" },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: false, output: "Hook cancelled" },
    },
    {
      name: "the start error of a hook that cannot start",
      facts: { ...EXITED, startFailed: true, exitCode: null, stderr: "spawn ENOENT" },
      answer: { kind: "noop" },
      blockedOnFailure: false,
      run: { succeeded: false, output: "spawn ENOENT" },
    },
    {
      name: "the onFailure text and the stderr of a failed hook",
      facts: { ...EXITED, exitCode: 1, stderr: " boom\n" },
      answer: { kind: "noop" },
      blockedOnFailure: true,
      run: { succeeded: false, output: `${BLOCKED}\nboom` },
    },
    {
      name: "the onFailure text alone for a failed hook with no stderr",
      facts: { ...EXITED, exitCode: 1 },
      answer: { kind: "noop" },
      blockedOnFailure: true,
      run: { succeeded: false, output: BLOCKED },
    },
    {
      name: "the onFailure text and the start error of a hook that cannot start",
      facts: { ...EXITED, startFailed: true, exitCode: null, stderr: "spawn ENOENT" },
      answer: { kind: "noop" },
      blockedOnFailure: true,
      run: { succeeded: false, output: `${BLOCKED}\nspawn ENOENT` },
    },
    {
      name: "the timed-out onFailure text without the stderr",
      facts: { ...EXITED, timedOut: true, exitCode: null, stderr: "late" },
      answer: { kind: "noop" },
      blockedOnFailure: true,
      run: { succeeded: false, output: 'timed out; blocking because onFailure is "block"' },
    },
  ];

  for (const { name, facts, answer, blockedOnFailure, run } of cases) {
    test(`gives ${name} (D-BG-501)`, () => {
      // act
      const actual = postCompactRunOf(facts, answer, blockedOnFailure);

      // assert
      assert.deepStrictEqual(actual, run);
    });
  }
});
