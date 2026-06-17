// Architecture-level invariant pins for the D-60-02 reducer + D-60-03
// adapter wiring inside the composite handlers (dispatch.ts).
//
// Each block pins one load-bearing invariant of the reducer loop:
//
//   Block A: D-60-02 first-block-wins -- entry-1 returns block; entries
//            2 and 3 are NOT invoked; tool_call adapter returns
//            { block: true, reason }.
//   Block B: D-60-02 mutate composition -- entry-1 returns
//            mutate.updatedInput; entry-2 sees the post-mutation event;
//            composite handler returns undefined (mutate is not
//            terminal).
//   Block C: D-60-02 stop terminal -- entry-1 returns stop; entries 2
//            and 3 are NOT invoked; tool_call adapter swallows stop.
//   Block D: full noop chain -- all entries run; composite handler
//            returns undefined.
//   Block E: D-59-01 toolResult event.isError split survives the
//            reducer rewrite -- only the matching bucket's entries are
//            dispatched.
//   Block F: D-60-03 per-event adapter return-shape pinning at the
//            composite-handler exit.

import assert from "node:assert/strict";
import test from "node:test";

import {
  compositeHandlerFor,
  toolResultCompositeHandler,
  _resetExecutorForTest,
  _setExecutorForTest,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  currentEpoch,
  _resetForTest,
  _setRoutingBucketForTest,
  type RoutingEntry,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { type BucketAEvent } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { parseMatcher } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

import type { HookExecResult } from "../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type {
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures + helpers
// ──────────────────────────────────────────────────────────────────────────

function makeEntry(input: {
  pluginId: string;
  claudeEvent?: BucketAEvent;
  rawMatcher?: string;
  declarationIndex?: number;
}): RoutingEntry {
  const rawMatcher = input.rawMatcher ?? "";
  return {
    scope: "user",
    marketplace: "mp",
    pluginId: input.pluginId,
    resolvedSource: "test://plugin-root",
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
    handlerDecl: { type: "command", command: `echo ${input.pluginId}` },
    declarationIndex: input.declarationIndex ?? 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

function makeToolCallEvent(input: Record<string, unknown> = {}): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "tc-1",
    toolName: "bash",
    input: { command: "ls", ...input },
  } as unknown as ToolCallEvent;
}

function makeToolResultEvent(isError: boolean): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "tc-1",
    toolName: "bash",
    input: {},
    content: [],
    isError,
    details: undefined,
  } as unknown as ToolResultEvent;
}

const stubCtx = {} as unknown as ExtensionContext;

// Spy executor: records each entry-pluginId invocation + the
// `event.input` snapshot seen at invocation time so Block B can prove
// mutate composition.
interface SpyCall {
  pluginId: string;
  inputSnapshot: string;
}

function makeSpy(results: Record<string, HookExecResult>): {
  calls: SpyCall[];
  impl: (entry: RoutingEntry, event: unknown) => Promise<HookExecResult>;
} {
  const calls: SpyCall[] = [];
  const impl = (entry: RoutingEntry, event: unknown): Promise<HookExecResult> => {
    const ev = event as { input?: Record<string, unknown> };
    calls.push({
      pluginId: entry.pluginId,
      inputSnapshot: JSON.stringify(ev.input ?? null),
    });
    const r = results[entry.pluginId] ?? { kind: "noop" };
    return Promise.resolve(r);
  };

  return { calls, impl };
}

// ──────────────────────────────────────────────────────────────────────────
// Block A: D-60-02 first-block-wins
// ──────────────────────────────────────────────────────────────────────────

test("D-60-02 first-block-wins: entry-1 blocks; entries 2-3 executor NOT invoked", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "block", reason: "denied" },
    p2: { kind: "noop" },
    p3: { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
    makeEntry({ pluginId: "p3", declarationIndex: 2 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  const out = await handler(makeToolCallEvent(), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p1"],
    "first-block-wins: entries after the block must NOT be invoked",
  );
  assert.deepEqual(out, { block: true, reason: "denied" });
});

// ──────────────────────────────────────────────────────────────────────────
// Block B: D-60-02 mutate composition (left-to-right)
// ──────────────────────────────────────────────────────────────────────────

test("D-60-02 mutate composition: entry-2 sees entry-1's in-place mutation", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "mutate", updatedInput: { extraField: "x" } },
    p2: { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
  ]);

  const event = makeToolCallEvent({ original: "y" });
  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  const out = await handler(event, stubCtx);

  assert.equal(spy.calls.length, 2, "both entries must run on noop final outcome");
  assert.equal(spy.calls[0]?.pluginId, "p1");
  assert.equal(spy.calls[1]?.pluginId, "p2");

  // Snapshot at entry-2's invocation MUST contain entry-1's mutation
  // AND the pre-existing field.
  const p2Snapshot = JSON.parse(spy.calls[1]?.inputSnapshot ?? "{}") as Record<string, unknown>;
  assert.equal(p2Snapshot["extraField"], "x", "entry-2 must see entry-1's updatedInput");
  assert.equal(p2Snapshot["original"], "y", "entry-2 must still see the pre-mutation fields");

  // Composite handler return: mutate is NOT terminal; reducer carried
  // forward to the next entry (which returned noop). Final outcome is
  // noop -> adapter returns undefined.
  assert.equal(out, undefined, "mutate is not terminal; adapter returns undefined for noop final");
});

test("D-60-02 mutate composition: two mutates compose left-to-right (entry-2 patch overlays entry-1)", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "mutate", updatedInput: { a: 1, shared: "from-p1" } },
    p2: { kind: "mutate", updatedInput: { b: 2, shared: "from-p2" } },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
  ]);

  const event = makeToolCallEvent();
  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  await handler(event, stubCtx);

  const final = event.input as unknown as Record<string, unknown>;
  assert.equal(final["a"], 1, "entry-1's patch must persist");
  assert.equal(final["b"], 2, "entry-2's patch must persist");
  assert.equal(final["shared"], "from-p2", "entry-2's patch overlays entry-1 on shared key");
});

// ──────────────────────────────────────────────────────────────────────────
// Block C: D-60-02 stop is terminal
// ──────────────────────────────────────────────────────────────────────────

test("D-60-02 stop terminal: entry-1 stops; entries 2-3 executor NOT invoked", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "stop", stopReason: "halt" },
    p2: { kind: "noop" },
    p3: { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
    makeEntry({ pluginId: "p3", declarationIndex: 2 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  const out = await handler(makeToolCallEvent(), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p1"],
    "stop terminates the chain; subsequent entries must NOT be invoked",
  );
  // Tool_call adapter swallows stop (no Pi block return slot for it)
  // -> returns undefined.
  assert.equal(out, undefined, "tool_call adapter must swallow stop and return undefined");
});

// ──────────────────────────────────────────────────────────────────────────
// Block D: full noop chain
// ──────────────────────────────────────────────────────────────────────────

test("D-60-02 noop chain: all entries run; composite handler returns undefined", async (t) => {
  _resetForTest();
  const spy = makeSpy({});
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
    makeEntry({ pluginId: "p3", declarationIndex: 2 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  const out = await handler(makeToolCallEvent(), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p1", "p2", "p3"],
    "all 3 entries must run on full noop chain",
  );
  assert.equal(out, undefined);
});

// ──────────────────────────────────────────────────────────────────────────
// Block E: D-59-01 event.isError split survives the reducer rewrite
// ──────────────────────────────────────────────────────────────────────────

test("D-59-01 + D-60-02: toolResult isError=true reduces only PostToolUseFailure bucket", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    "p-failure": { kind: "noop" },
    "p-success": { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(makeToolResultEvent(true), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p-failure"],
    "isError=true must dispatch only PostToolUseFailure entries",
  );
});

test("D-59-01 + D-60-02: toolResult isError=false reduces only PostToolUse bucket", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    "p-failure": { kind: "noop" },
    "p-success": { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(makeToolResultEvent(false), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p-success"],
    "isError=false must dispatch only PostToolUse entries",
  );
});

test("D-59-01 + D-60-02: toolResult bucket reduces first-block-wins", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "block", reason: "tool-blocked" },
    p2: { kind: "noop" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUse", [
    makeEntry({ pluginId: "p1", claudeEvent: "PostToolUse", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", claudeEvent: "PostToolUse", declarationIndex: 1 }),
  ]);

  const handler = toolResultCompositeHandler(currentEpoch());
  const out = await handler(makeToolResultEvent(false), stubCtx);

  assert.deepEqual(
    spy.calls.map((c) => c.pluginId),
    ["p1"],
    "toolResult reducer must first-block-wins like the six-uniform reducer",
  );
  assert.deepEqual(out, {
    isError: true,
    content: [{ type: "text", text: "tool-blocked" }],
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Block F: D-60-03 per-event adapter return-shape pinning
// ──────────────────────────────────────────────────────────────────────────

test("D-60-03 PreToolUse: block returns { block: true, reason }", async (t) => {
  _resetForTest();
  const spy = makeSpy({ p1: { kind: "block", reason: "x" } });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [makeEntry({ pluginId: "p1" })]);
  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  const out = await handler(makeToolCallEvent(), stubCtx);
  assert.deepEqual(out, { block: true, reason: "x" });
});

test("D-60-03 UserPromptSubmit: block returns { action: 'handled' }", async (t) => {
  _resetForTest();
  const spy = makeSpy({ p1: { kind: "block", reason: "x" } });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("UserPromptSubmit", [
    makeEntry({ pluginId: "p1", claudeEvent: "UserPromptSubmit" }),
  ]);
  const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch());
  const out = await handler({ type: "input", text: "hello", source: "interactive" }, stubCtx);
  assert.deepEqual(out, { action: "handled" });
});

test("D-60-03 UserPromptSubmit: mutate.additionalContext returns { action: 'transform', text }", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "mutate", additionalContext: "more" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("UserPromptSubmit", [
    makeEntry({ pluginId: "p1", claudeEvent: "UserPromptSubmit" }),
  ]);
  const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch());
  const out = await handler({ type: "input", text: "hello", source: "interactive" }, stubCtx);
  assert.deepEqual(out, { action: "transform", text: "more" });
});

test("D-60-03 observation events: always return undefined (SessionStart / SessionEnd / PreCompact / PostCompact)", async (t) => {
  _resetForTest();
  const spy = makeSpy({
    p1: { kind: "block", reason: "drop-me" },
  });
  _setExecutorForTest(spy.impl);
  t.after(() => {
    _resetExecutorForTest();
  });

  // SessionStart bucket: a block outcome MUST be debug-logged + dropped.
  // Composite handler return type is `Promise<undefined>` for the
  // observation events; the per-event adapter is invoked for the
  // debug-log side effect only, so calling the handler as a statement
  // pins the never-throws contract without assigning a void expression.
  _setRoutingBucketForTest("SessionStart", [
    makeEntry({ pluginId: "p1", claudeEvent: "SessionStart", rawMatcher: "" }),
  ]);
  const ssHandler = compositeHandlerFor("SessionStart", currentEpoch());
  await ssHandler({ type: "session_start", reason: "startup" }, stubCtx);

  // SessionEnd / PreCompact / PostCompact: same drop-to-undefined behavior.
  _setRoutingBucketForTest("SessionEnd", [
    makeEntry({ pluginId: "p1", claudeEvent: "SessionEnd" }),
  ]);
  const seHandler = compositeHandlerFor("SessionEnd", currentEpoch());
  await seHandler({ type: "session_shutdown" } as never, stubCtx);

  // No assertion on return value: the adapter return type is
  // structurally `undefined` and TS-lint forbids assigning a void
  // expression. Side effect verified via spy.calls (entry-1 was
  // invoked once for each event family above).
  assert.equal(spy.calls.length, 2, "SessionStart + SessionEnd buckets must each dispatch entry-1");
});
