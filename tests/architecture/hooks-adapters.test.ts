// Architecture-level invariant pins for the per-Pi-event adapter table
// (D-60-03 / D-60-01 / NFR-7).
//
// Each block pins one load-bearing invariant for an adapter; the layout
// mirrors the existing hooks-dispatch / hooks-exec / hooks-translators
// architecture tests' per-block heading convention. Test blocks A-D cover
// the 4 adapters × 4 result arms = 16 cells; Block E is the
// exhaustiveness gate verifying every adapter has an `assertNever`
// default arm.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  adaptInputResult,
  adaptObservationResult,
  adaptToolCallResult,
  adaptToolResultResult,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";

import type { HookExecResult } from "../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type {
  InputEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────

function makeToolCallEvent(input: Record<string, unknown> = {}): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "ls", ...input },
  } as unknown as ToolCallEvent;
}

function makeToolResultEvent(): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: {},
    content: [{ type: "text", text: "ok" }],
    isError: false,
    details: undefined,
  } as unknown as ToolResultEvent;
}

function makeInputEvent(): InputEvent {
  return {
    type: "input",
    text: "hello",
    source: "interactive",
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Block A: D-60-03 adaptToolCallResult -- 4 result arms + variants
// ──────────────────────────────────────────────────────────────────────────

test("D-60-03 adaptToolCall: noop returns undefined", () => {
  const event = makeToolCallEvent();
  const out = adaptToolCallResult({ kind: "noop" }, event);
  assert.equal(out, undefined);
});

test("D-60-03 adaptToolCall: block with reason returns { block: true, reason }", () => {
  const event = makeToolCallEvent();
  const out = adaptToolCallResult({ kind: "block", reason: "denied" }, event);
  assert.deepEqual(out, { block: true, reason: "denied" });
});

test("D-60-03 adaptToolCall: block without reason returns { block: true } (exactOptional safe)", () => {
  const event = makeToolCallEvent();
  const out = adaptToolCallResult({ kind: "block" }, event);
  assert.deepEqual(out, { block: true });
});

test("D-60-03 adaptToolCall: mutate.updatedInput patches event.input in place", () => {
  const event = makeToolCallEvent({ original: "y" });
  const out = adaptToolCallResult({ kind: "mutate", updatedInput: { extraField: "x" } }, event);
  assert.equal(out, undefined);
  const input = event.input as Record<string, unknown>;
  assert.equal(input["extraField"], "x");
  assert.equal(input["original"], "y");
});

test("D-60-03 adaptToolCall: mutate without updatedInput leaves event.input untouched", () => {
  const event = makeToolCallEvent({ keep: "me" });
  const before = JSON.stringify(event.input);
  const out = adaptToolCallResult({ kind: "mutate" }, event);
  assert.equal(out, undefined);
  assert.equal(
    JSON.stringify(event.input),
    before,
    "mutation surface must be a no-op when undefined",
  );
});

test("D-60-03 adaptToolCall: stop debug-logs and returns undefined", () => {
  const event = makeToolCallEvent();
  const out = adaptToolCallResult({ kind: "stop", stopReason: "halt" }, event);
  assert.equal(out, undefined);
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: D-60-03 adaptToolResultResult -- 4 result arms
// ──────────────────────────────────────────────────────────────────────────

test("D-60-03 adaptToolResult: noop returns undefined", () => {
  const event = makeToolResultEvent();
  const out = adaptToolResultResult({ kind: "noop" }, event);
  assert.equal(out, undefined);
});

test("D-60-03 adaptToolResult: block with reason returns isError + content carrying reason", () => {
  const event = makeToolResultEvent();
  const out = adaptToolResultResult({ kind: "block", reason: "policy" }, event);
  assert.deepEqual(out, {
    isError: true,
    content: [{ type: "text", text: "policy" }],
  });
});

test("D-60-03 adaptToolResult: block without reason returns { isError: true }", () => {
  const event = makeToolResultEvent();
  const out = adaptToolResultResult({ kind: "block" }, event);
  assert.deepEqual(out, { isError: true });
});

test("D-60-03 adaptToolResult: mutate.updatedToolOutput patches event in place", () => {
  const event = makeToolResultEvent();
  const out = adaptToolResultResult(
    { kind: "mutate", updatedToolOutput: { isError: true } },
    event,
  );
  assert.equal(out, undefined);
  // CR-01: `isError` is a whitelisted field; the slot flips per the patch.
  assert.equal((event as unknown as { isError: boolean }).isError, true);
});

test("CR-01 adaptToolResult: mutate.updatedToolOutput cannot overwrite event.type / toolName / unrelated fields", () => {
  const event = makeToolResultEvent();
  const originalType = (event as unknown as { type: string }).type;
  const originalToolName = (event as unknown as { toolName: string }).toolName;
  // Hook returns a patch with malicious fields alongside a legitimate one.
  adaptToolResultResult(
    {
      kind: "mutate",
      updatedToolOutput: {
        type: "hacker",
        toolName: "rm",
        isError: false,
        bogusField: "should-not-appear",
      },
    },
    event,
  );
  // CR-01: only the whitelisted `isError` field may mutate.
  assert.equal((event as unknown as { isError: boolean }).isError, false);
  assert.equal(
    (event as unknown as { type: string }).type,
    originalType,
    "CR-01: hook must not be able to rewrite event.type",
  );
  assert.equal(
    (event as unknown as { toolName: string }).toolName,
    originalToolName,
    "CR-01: hook must not be able to rewrite event.toolName",
  );
  assert.equal(
    (event as unknown as { bogusField?: unknown }).bogusField,
    undefined,
    "CR-01: hook must not be able to add arbitrary fields to the event",
  );
});

test("CR-01 adaptToolResult: mutate.updatedToolOutput.content (array) is whitelisted and patches event.content", () => {
  const event = makeToolResultEvent();
  const newContent = [{ type: "text", text: "patched" }];
  adaptToolResultResult({ kind: "mutate", updatedToolOutput: { content: newContent } }, event);
  assert.deepEqual((event as unknown as { content: unknown }).content, newContent);
});

test("CR-01 adaptToolResult: mutate.updatedToolOutput with non-array content is silently dropped", () => {
  const event = makeToolResultEvent();
  const originalContent = JSON.stringify((event as unknown as { content: unknown }).content);
  adaptToolResultResult({ kind: "mutate", updatedToolOutput: { content: "not-an-array" } }, event);
  assert.equal(
    JSON.stringify((event as unknown as { content: unknown }).content),
    originalContent,
    "CR-01: non-array content patches must not mutate the content slot",
  );
});

test("CR-01 adaptToolResult: null / primitive updatedToolOutput is silently dropped", () => {
  const event = makeToolResultEvent();
  const originalIsError = (event as unknown as { isError: boolean }).isError;
  adaptToolResultResult({ kind: "mutate", updatedToolOutput: null }, event);
  adaptToolResultResult({ kind: "mutate", updatedToolOutput: "string-patch" }, event);
  adaptToolResultResult({ kind: "mutate", updatedToolOutput: 42 }, event);
  assert.equal((event as unknown as { isError: boolean }).isError, originalIsError);
});

test("CR-01 adaptToolCall: null / non-object updatedInput is silently dropped", () => {
  const event = makeToolCallEvent({ keep: "me" });
  const before = JSON.stringify(event.input);
  adaptToolCallResult({ kind: "mutate", updatedInput: null }, event);
  adaptToolCallResult({ kind: "mutate", updatedInput: "string-patch" }, event);
  adaptToolCallResult({ kind: "mutate", updatedInput: [1, 2, 3] }, event);
  assert.equal(
    JSON.stringify(event.input),
    before,
    "CR-01: non-object updatedInput must be dropped",
  );
});

test("D-60-03 adaptToolResult: stop debug-logs and returns undefined", () => {
  const event = makeToolResultEvent();
  const out = adaptToolResultResult({ kind: "stop", stopReason: "halt" }, event);
  assert.equal(out, undefined);
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: D-60-03 adaptInputResult -- 4 result arms
// ──────────────────────────────────────────────────────────────────────────

test("D-60-03 adaptInput: noop returns undefined", () => {
  const event = makeInputEvent();
  const out = adaptInputResult({ kind: "noop" }, event);
  assert.equal(out, undefined);
});

test("D-60-03 adaptInput: block returns { action: 'handled' }", () => {
  const event = makeInputEvent();
  const out = adaptInputResult({ kind: "block", reason: "denied" }, event);
  assert.deepEqual(out, { action: "handled" });
});

test("D-60-03 adaptInput: mutate.additionalContext returns { action: 'transform', text }", () => {
  const event = makeInputEvent();
  const out = adaptInputResult({ kind: "mutate", additionalContext: "more context" }, event);
  assert.deepEqual(out, { action: "transform", text: "more context" });
});

test("D-60-03 adaptInput: mutate without additionalContext returns undefined", () => {
  const event = makeInputEvent();
  const out = adaptInputResult({ kind: "mutate" }, event);
  assert.equal(out, undefined);
});

test("D-60-03 adaptInput: stop debug-logs and returns undefined", () => {
  const event = makeInputEvent();
  const out = adaptInputResult({ kind: "stop", stopReason: "halt" }, event);
  assert.equal(out, undefined);
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: D-60-03 adaptObservationResult -- 4 result arms, NEVER notify/throw
// ──────────────────────────────────────────────────────────────────────────

test("D-60-03 adaptObservation: noop returns undefined", () => {
  // adaptObservationResult is typed `: undefined` (always returns undefined)
  // -- call as a statement to satisfy no-confusing-void-expression while
  // pinning the never-throws contract.
  adaptObservationResult({ kind: "noop" });
});

test("D-60-03 adaptObservation: block returns undefined (dropped + debug-logged)", () => {
  adaptObservationResult({ kind: "block", reason: "denied" });
});

test("D-60-03 adaptObservation: mutate returns undefined (no mutation surface)", () => {
  adaptObservationResult({
    kind: "mutate",
    updatedInput: { x: 1 },
    additionalContext: "ignored",
  });
});

test("D-60-03 adaptObservation: stop returns undefined (dropped + debug-logged)", () => {
  adaptObservationResult({ kind: "stop", stopReason: "halt" });
});

test("D-60-03 adaptObservation: never throws across all four arms", () => {
  const arms: HookExecResult[] = [
    { kind: "noop" },
    { kind: "block", reason: "x" },
    { kind: "mutate", additionalContext: "y" },
    { kind: "stop", stopReason: "z" },
  ];
  for (const arm of arms) {
    assert.doesNotThrow(() => {
      adaptObservationResult(arm);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block E: NFR-7 exhaustiveness gate -- every adapter has assertNever
// ──────────────────────────────────────────────────────────────────────────

test("NFR-7: each adapter contains an assertNever default arm", async () => {
  const adapterPath = path.join(
    process.cwd(),
    "extensions",
    "pi-claude-marketplace",
    "bridges",
    "hooks",
    "event-adapters.ts",
  );
  const text = await readFile(adapterPath, "utf8");

  // 4 adapters × 1 assertNever default arm each → at least 4 matches.
  const assertNeverMatches = text.match(/assertNever\s*\(/g) ?? [];
  assert.ok(
    assertNeverMatches.length >= 4,
    `expected >= 4 assertNever calls in event-adapters.ts (one default arm per adapter), found ${assertNeverMatches.length.toString()}`,
  );

  // Each named export is present.
  const exportNames = [
    "adaptToolCallResult",
    "adaptToolResultResult",
    "adaptInputResult",
    "adaptObservationResult",
  ];
  for (const name of exportNames) {
    const re = new RegExp(`export\\s+function\\s+${name}\\b`);
    assert.ok(re.test(text), `event-adapters.ts must export ${name}`);
  }
});

test("D-60-03 / D-60-01 / IL-2: event-adapters.ts has no ctx.ui.notify or direct stdout/stderr writes", async () => {
  const adapterPath = path.join(
    process.cwd(),
    "extensions",
    "pi-claude-marketplace",
    "bridges",
    "hooks",
    "event-adapters.ts",
  );
  const text = await readFile(adapterPath, "utf8");

  assert.ok(!text.includes("ctx.ui.notify"), "IL-2: event-adapters.ts must not call ctx.ui.notify");
  assert.ok(
    !text.includes("process.stdout.write"),
    "IL-2: event-adapters.ts must not write directly to process.stdout",
  );
  assert.ok(
    !text.includes("process.stderr.write"),
    "IL-2: event-adapters.ts must not write directly to process.stderr",
  );
});
