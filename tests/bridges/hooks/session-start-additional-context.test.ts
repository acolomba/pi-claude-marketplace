// tests/bridges/hooks/session-start-additional-context.test.ts
//
// Unit regression test for the SessionStart additionalContext drain.
//
// Claude Code's SessionStart hook protocol assumes a single
// "inject context into the next agent turn" surface. Pi's lifecycle
// splits that intent in two: `session_start` returns void, and
// `before_agent_start` carries the `systemPrompt` chain. The bridge must
// capture additionalContext from the SessionStart mutate arm into a
// module-state buffer and drain it on the next `before_agent_start` event
// so the model's first agent turn sees the injected text.
//
// This file pins:
//   (a) `adaptObservationResult` captures `additionalContext` from a
//       SessionStart-tagged mutate arm into the pending buffer instead of
//       silently dropping it.
//   (b) `beforeAgentStartHandlerFor` joins `event.systemPrompt` with the
//       buffered context (separator `\n\n`) and clears the buffer
//       (drain-on-first-turn semantics).
//   (c) Subsequent `before_agent_start` events return `undefined` because
//       the buffer was drained.
//   (d) Multiple SessionStart-bearing plugins concatenate in declaration
//       order with a blank line between them.
//   (e) `registerHooksBridge` clears the buffer on entry (`/reload` does
//       not leak stale context from the prior session).
//   (f) Non-SessionStart observation events (SessionEnd / PreCompact /
//       PostCompact) keep the silent-drop semantics.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { adaptObservationResultForEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import {
  _peekPendingSessionStartContextForTest,
  _resetForTest,
  beforeAgentStartHandlerFor,
  currentEpoch,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";

import type {
  BeforeAgentStartEvent,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const stubCtx = {} as unknown as ExtensionContext;

const PROV = { scope: "user" as const, marketplace: "mp", pluginId: "p1" };

function makeBeforeAgentStartEvent(systemPrompt: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    prompt: "user prompt",
    systemPrompt,
    systemPromptOptions: {},
  } as unknown as BeforeAgentStartEvent;
}

beforeEach(() => {
  _resetForTest();
});

// ──────────────────────────────────────────────────────────────────────────
// Block A: adaptObservationResultForEvent captures additionalContext for
// SessionStart and keeps the silent-drop for the other three observation
// events.
// ──────────────────────────────────────────────────────────────────────────

test("adaptObservationResultForEvent: SessionStart mutate captures additionalContext into the buffer", () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "MARK" },
    "SessionStart",
    PROV,
  );

  assert.deepEqual(_peekPendingSessionStartContextForTest(), [{ context: "MARK", ...PROV }]);
});

test("adaptObservationResultForEvent: SessionStart mutate WITHOUT additionalContext does not append to the buffer", () => {
  adaptObservationResultForEvent(
    { kind: "mutate", updatedInput: { ignored: true } },
    "SessionStart",
    PROV,
  );

  assert.deepEqual(_peekPendingSessionStartContextForTest(), []);
});

test("adaptObservationResultForEvent: SessionEnd mutate with additionalContext is silently dropped", () => {
  adaptObservationResultForEvent({ kind: "mutate", additionalContext: "MARK" }, "SessionEnd", PROV);

  assert.deepEqual(
    _peekPendingSessionStartContextForTest(),
    [],
    "SessionEnd has no upstream drain point -- additionalContext must NOT be buffered",
  );
});

test("adaptObservationResultForEvent: PreCompact mutate with additionalContext is silently dropped", () => {
  adaptObservationResultForEvent({ kind: "mutate", additionalContext: "MARK" }, "PreCompact", PROV);

  assert.deepEqual(_peekPendingSessionStartContextForTest(), []);
});

test("adaptObservationResultForEvent: PostCompact mutate with additionalContext is silently dropped", () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "MARK" },
    "PostCompact",
    PROV,
  );

  assert.deepEqual(_peekPendingSessionStartContextForTest(), []);
});

test("adaptObservationResultForEvent: SessionStart block / stop arms do NOT touch the buffer", () => {
  adaptObservationResultForEvent({ kind: "block", reason: "denied" }, "SessionStart", PROV);
  adaptObservationResultForEvent({ kind: "stop", stopReason: "halt" }, "SessionStart", PROV);
  adaptObservationResultForEvent({ kind: "noop" }, "SessionStart", PROV);

  assert.deepEqual(_peekPendingSessionStartContextForTest(), []);
});

test("adaptObservationResultForEvent: SessionStart mutate with EMPTY additionalContext is silently skipped", () => {
  // appendPendingSessionStartContext's empty-string early-return prevents a
  // buggy hook returning `additionalContext: ""` from polluting the join
  // output with a leading blank line on drain.
  adaptObservationResultForEvent({ kind: "mutate", additionalContext: "" }, "SessionStart", PROV);

  assert.deepEqual(
    _peekPendingSessionStartContextForTest(),
    [],
    "empty additionalContext must not enter the buffer (would render as a stray '\\n\\n' on drain)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: beforeAgentStartHandlerFor drains the buffer onto event.systemPrompt
// ──────────────────────────────────────────────────────────────────────────

test("beforeAgentStartHandlerFor: drains the buffer and returns { systemPrompt: base + '\\n\\n' + buffered }", async () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "MARK" },
    "SessionStart",
    PROV,
  );

  const handler = beforeAgentStartHandlerFor(currentEpoch());
  const result = await handler(makeBeforeAgentStartEvent("BASE"), stubCtx);

  assert.deepEqual(result, { systemPrompt: "BASE\n\nMARK" });
  assert.deepEqual(
    _peekPendingSessionStartContextForTest(),
    [],
    "buffer must be drained after the first before_agent_start handler call",
  );
});

test("beforeAgentStartHandlerFor: second before_agent_start returns undefined (buffer already drained)", async () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "MARK" },
    "SessionStart",
    PROV,
  );

  const handler = beforeAgentStartHandlerFor(currentEpoch());
  await handler(makeBeforeAgentStartEvent("BASE"), stubCtx);
  const secondCall = await handler(makeBeforeAgentStartEvent("BASE-2"), stubCtx);

  assert.equal(secondCall, undefined);
});

test("beforeAgentStartHandlerFor: empty buffer returns undefined without touching event.systemPrompt", async () => {
  const handler = beforeAgentStartHandlerFor(currentEpoch());
  const result = await handler(makeBeforeAgentStartEvent("BASE"), stubCtx);

  assert.equal(result, undefined);
});

test("beforeAgentStartHandlerFor: multiple SessionStart captures concat in order with a blank-line separator", async () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "ALPHA" },
    "SessionStart",
    PROV,
  );
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "BETA" },
    "SessionStart",
    PROV,
  );

  const handler = beforeAgentStartHandlerFor(currentEpoch());
  const result = await handler(makeBeforeAgentStartEvent("BASE"), stubCtx);

  assert.deepEqual(result, { systemPrompt: "BASE\n\nALPHA\n\nBETA" });
});

test("beforeAgentStartHandlerFor: epoch mismatch returns undefined and does NOT drain the buffer", async () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "MARK" },
    "SessionStart",
    PROV,
  );

  const staleEpoch = currentEpoch() - 1;
  const handler = beforeAgentStartHandlerFor(staleEpoch);
  const result = await handler(makeBeforeAgentStartEvent("BASE"), stubCtx);

  assert.equal(result, undefined);
  assert.deepEqual(
    _peekPendingSessionStartContextForTest(),
    [{ context: "MARK", ...PROV }],
    "stale-epoch closure must not drain the live buffer (zombie defense)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: _resetForTest clears the buffer (proxy for the registerHooksBridge
// reload-clears-buffer contract).
// ──────────────────────────────────────────────────────────────────────────

test("_resetForTest clears the pending SessionStart buffer (proxy for the reload-clears-buffer contract)", () => {
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "STALE" },
    "SessionStart",
    PROV,
  );
  assert.deepEqual(_peekPendingSessionStartContextForTest(), [{ context: "STALE", ...PROV }]);

  _resetForTest();

  assert.deepEqual(
    _peekPendingSessionStartContextForTest(),
    [],
    "_resetForTest must clear the pending SessionStart buffer",
  );
});
