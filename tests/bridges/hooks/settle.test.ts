// Settle dispatcher unit tests (STOP-01 / STOP-03).
//
// Drives a synthetic `agent_end` -> `agent_settled` sequence through the
// settle handler with a stub executor injected via dispatch.ts's
// `_setExecutorForTest` seam and a Stop routing bucket seeded via
// event-router's `_setRoutingBucketForTest`. Pins the `stopReason` gate, the
// Stop block re-entry contract, the last-write-wins cache, and the epoch
// hygiene.

import assert from "node:assert/strict";
import test from "node:test";

import {
  _resetExecutorForTest,
  _setExecutorForTest,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  currentEpoch,
  _bumpEpochForTest,
  _resetForTest,
  _setRoutingBucketForTest,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  agentEndCacheHandler,
  inputResetHandlerFor,
  resetSettleState,
  settleHandlerFor,
  _peekLoopStateForTest,
  _peekSettleCacheForTest,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/settle.ts";
import { parseHookStdout } from "../../../extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { StopReason } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  AgentEndEvent,
  AgentSettledEvent,
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

const stubCtx = {} as unknown as ExtensionContext;
const settledEvent = { type: "agent_settled" } as unknown as AgentSettledEvent;

interface SendCall {
  readonly message: Record<string, unknown>;
  readonly options: Record<string, unknown> | undefined;
}

function makePi(): { pi: ExtensionAPI; sent: SendCall[] } {
  const sent: SendCall[] = [];
  const pi = {
    sendMessage: (message: unknown, options?: unknown): void => {
      sent.push({
        message: message as Record<string, unknown>,
        options: options as Record<string, unknown> | undefined,
      });
    },
    isIdle: (): boolean => true,
  };
  return { pi: pi as unknown as ExtensionAPI, sent };
}

function makeStopEntry(pluginId: string, opts?: { asyncRewake?: boolean }): RoutingEntry {
  return {
    scope: "user",
    marketplace: "mp",
    pluginId,
    resolvedSource: asAbsolutePluginRoot("/test/plugin-root"),
    claudeEvent: "Stop",
    matcher: parseMatcher(""),
    rawMatcher: "",
    handlerDecl:
      opts?.asyncRewake === true
        ? { type: "command", command: `echo ${pluginId}`, asyncRewake: true }
        : { type: "command", command: `echo ${pluginId}` },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

function makeAgentEnd(stopReason: StopReason): AgentEndEvent {
  return {
    type: "agent_end",
    messages: [
      { role: "user", content: "hi", timestamp: 0 },
      { role: "assistant", content: [{ type: "text", text: "done" }], stopReason, timestamp: 1 },
    ],
  } as unknown as AgentEndEvent;
}

// ──────────────────────────────────────────────────────────────────────────
// STOP-01 / STOP-03: stopReason "stop" + a blocking Stop hook re-enters
// ──────────────────────────────────────────────────────────────────────────

test("STOP-03: stopReason stop + block hook -> one followUp+triggerTurn sendMessage", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, ["p1"], "the Stop bucket executor must run exactly once");
  assert.equal(sent.length, 1, "a blocking Stop hook must re-enter via exactly one sendMessage");
  assert.equal(sent[0]?.message["customType"], "claude-hook-stop-block");
  assert.equal(sent[0]?.message["content"], "go on");
  assert.equal(sent[0]?.message["display"], false);
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: aborted / toolUse dispatch nothing
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: stopReason aborted dispatches nothing", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("aborted"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "aborted must not dispatch the Stop bucket");
  assert.equal(sent.length, 0, "aborted must not re-enter");
});

test("STOP-01: stopReason toolUse is a defensive no-op", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("toolUse"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "toolUse must not dispatch the Stop bucket");
  assert.equal(sent.length, 0, "toolUse must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: empty cache (no preceding agent_end) returns early
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: settle with no cached assistant message dispatches nothing", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  // No agentEndCacheHandler call -> cache is undefined.
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an empty cache must not dispatch");
  assert.equal(sent.length, 0, "an empty cache must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: two agent_end events -> last-write-wins cache
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: two agent_end events cache the last run's last-assistant message", () => {
  _resetForTest();
  resetSettleState();

  const epoch = currentEpoch();
  const cache = agentEndCacheHandler(epoch);
  cache(makeAgentEnd("aborted"));
  cache(makeAgentEnd("stop"));

  assert.equal(
    _peekSettleCacheForTest()?.stopReason,
    "stop",
    "the cache must hold the last agent_end's last-assistant message",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: stale epoch no-ops both handlers
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: a stale captured epoch no-ops both settle handlers", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const stale = currentEpoch();
  _bumpEpochForTest();

  agentEndCacheHandler(stale)(makeAgentEnd("stop"));
  assert.equal(_peekSettleCacheForTest(), undefined, "a stale agent_end must not cache");

  await settleHandlerFor(stale, pi)(settledEvent, stubCtx);
  assert.deepEqual(fired, [], "a stale settle must not dispatch");
  assert.equal(sent.length, 0, "a stale settle must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-04: exit-2 rides the parseHookStdout block arm (no Stop-specific path)
// ──────────────────────────────────────────────────────────────────────────

test("STOP-04: exit-2 maps to block via parseHookStdout and re-enters with the stderr reason", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest((): Promise<HookExecResult> =>
    Promise.resolve(parseHookStdout(2, "", "boom")),
  );
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.equal(sent.length, 1, "exit-2 must re-enter exactly once");
  assert.equal(sent[0]?.message["content"], "boom", "the exit-2 stderr becomes the block reason");
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-05: additionalContext-without-block re-enters via the same lane
// ──────────────────────────────────────────────────────────────────────────

test("STOP-05: mutate additionalContext with no block re-enters with that context", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest((): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "keep going" }),
  );
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.equal(sent.length, 1, "additionalContext must re-enter exactly once");
  assert.equal(sent[0]?.message["content"], "keep going");
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-06: continue:false (stop) does not re-enter
// ──────────────────────────────────────────────────────────────────────────

test("STOP-06: a single continue:false hook does not re-enter", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest((): Promise<HookExecResult> => Promise.resolve({ kind: "stop" }));
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "continue:false must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-06 / D-88-05: aggregate precedence -- any stop suppresses a block,
// order-independent
// ──────────────────────────────────────────────────────────────────────────

function stopOrBlockExecutor(): (entry: RoutingEntry) => Promise<HookExecResult> {
  return (entry): Promise<HookExecResult> => {
    if (entry.pluginId === "stopper") {
      return Promise.resolve({ kind: "stop" });
    }

    if (entry.pluginId === "blocker") {
      return Promise.resolve({ kind: "block", reason: "please stay" });
    }

    return Promise.resolve({ kind: "noop" });
  };
}

test("STOP-06: block before stop -> the stop suppresses re-entry", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest(stopOrBlockExecutor());
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("blocker"), makeStopEntry("stopper")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "any stop in the bucket suppresses re-entry regardless of a block");
});

test("STOP-06: stop before block -> the stop still suppresses re-entry", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest(stopOrBlockExecutor());
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("stopper"), makeStopEntry("blocker")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "aggregate precedence is order-independent");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-06 edge: an empty Stop bucket on stopReason "stop" does nothing
// ──────────────────────────────────────────────────────────────────────────

test("STOP-06: an empty Stop bucket on stop dispatches nothing", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", []);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an empty bucket must not run any executor");
  assert.equal(sent.length, 0, "an empty bucket must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// Research A5: a Stop hook declaring asyncRewake:true degrades to noop (no
// silent block loss -- the block desire is dropped deterministically, the
// executor is never invoked)
// ──────────────────────────────────────────────────────────────────────────

test("A5: an asyncRewake Stop hook is degraded to noop and does not re-enter", async (t) => {
  _resetForTest();
  resetSettleState();

  const fired: string[] = [];
  _setExecutorForTest((entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1", { asyncRewake: true })]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an asyncRewake Stop entry must not reach the executor");
  assert.equal(sent.length, 0, "an asyncRewake Stop entry must not re-enter (degraded to noop)");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-07: stop_hook_active flag, 8-consecutive-block cap, one-shot warning,
// input reset, D-88-06 counter semantics.
// ──────────────────────────────────────────────────────────────────────────

interface NotifyCall {
  readonly text: string;
  readonly severity: "info" | "warning" | "error" | undefined;
}

function makeCapCtx(): { ctx: ExtensionContext; notifyCalls: NotifyCall[] } {
  const notifyCalls: NotifyCall[] = [];
  const ctx = {
    ui: {
      notify: (text: string, severity?: "info" | "warning" | "error"): void => {
        notifyCalls.push({ text, severity });
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notifyCalls };
}

// An executor that always blocks and records each invocation's
// `stop_hook_active` (read off the synthetic Stop event) so a test can assert
// the flag threads into the NEXT payload.
function blockingExecutorCapturing(
  seen: boolean[],
): (entry: RoutingEntry, event: unknown) => Promise<HookExecResult> {
  return (_entry, event): Promise<HookExecResult> => {
    seen.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "loop" });
  };
}

// Drive one agent_end(stop) -> agent_settled cycle through the settle handler.
async function runSettleCycle(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi)(settledEvent, ctx);
}

test("STOP-07 boundary/adjacency: 7 blocks re-enter; the 8th suppresses re-entry and trips the cap once; a 9th does not re-notify", async (t) => {
  _resetForTest();
  resetSettleState();

  const seen: boolean[] = [];
  _setExecutorForTest(blockingExecutorCapturing(seen));
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("ralph-wiggum")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx);
  }

  assert.equal(sent.length, 7, "the first 7 consecutive blocks must each re-enter");
  assert.equal(notifyCalls.length, 0, "the cap must not trip before the 8th block");
  assert.equal(_peekLoopStateForTest().consecutiveBlockCount, 7);

  // 8th consecutive block -> cap trips: no re-entry + one-shot warning.
  await runSettleCycle(pi, ctx);
  assert.equal(sent.length, 7, "the 8th consecutive block must NOT re-enter");
  assert.equal(notifyCalls.length, 1, "the 8th consecutive block trips the cap once");
  assert.equal(notifyCalls[0]?.severity, "warning", "the cap warning is warning severity");
  assert.ok(
    notifyCalls[0]?.text.includes("ralph-wiggum"),
    "the cap warning names the blocking plugin",
  );
  assert.equal(_peekLoopStateForTest().capNotifiedThisSession, true, "the one-shot latch is set");

  // 9th consecutive block -> still suppressed, but the one-shot latch prevents
  // a second notify.
  await runSettleCycle(pi, ctx);
  assert.equal(sent.length, 7, "the 9th consecutive block must also be suppressed");
  assert.equal(
    notifyCalls.length,
    1,
    "a 9th consecutive block must NOT re-notify (one-shot latch)",
  );
});

test("STOP-07 ordering/precision: a non-block outcome resets the consecutive counter and re-arms the latch", async (t) => {
  _resetForTest();
  resetSettleState();

  // Block on every entry EXCEPT a one-shot noop injected between runs.
  let mode: "block" | "noop" = "block";
  _setExecutorForTest((): Promise<HookExecResult> =>
    Promise.resolve(mode === "block" ? { kind: "block", reason: "loop" } : { kind: "noop" }),
  );
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  // 7 consecutive blocks -> no cap yet.
  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx);
  }

  assert.equal(_peekLoopStateForTest().consecutiveBlockCount, 7);

  // A single non-block outcome resets the counter (D-88-06 -- only CONSECUTIVE
  // blocks count).
  mode = "noop";
  await runSettleCycle(pi, ctx);
  assert.equal(
    _peekLoopStateForTest().consecutiveBlockCount,
    0,
    "a non-block outcome resets the counter",
  );
  assert.equal(notifyCalls.length, 0, "the reset must re-arm before any cap trip");

  // 7 FRESH consecutive blocks re-enter without tripping (proves the earlier 7
  // did not accumulate across the reset).
  mode = "block";
  const sentBeforeFreshRun = sent.length;
  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx);
  }

  assert.equal(sent.length - sentBeforeFreshRun, 7, "7 fresh consecutive blocks each re-enter");
  assert.equal(notifyCalls.length, 0, "cap must not trip until 8 FRESH consecutive blocks");

  // The 8th fresh block trips the cap (latch re-armed by the earlier reset).
  await runSettleCycle(pi, ctx);
  assert.equal(notifyCalls.length, 1, "the cap re-trips after a reset re-armed the latch");
});

test("STOP-07 empty: zero blocks -> counter stays 0, no cap, no notify, stop_hook_active false", async (t) => {
  _resetForTest();
  resetSettleState();

  _setExecutorForTest((): Promise<HookExecResult> => Promise.resolve({ kind: "noop" }));
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  await runSettleCycle(pi, ctx);

  assert.equal(sent.length, 0, "a noop outcome must not re-enter");
  assert.equal(notifyCalls.length, 0, "zero blocks must not notify");
  const state = _peekLoopStateForTest();
  assert.equal(state.consecutiveBlockCount, 0, "counter stays 0 with no blocks");
  assert.equal(state.stopHookActive, false, "stop_hook_active stays false with no re-entry");
});

test("STOP-07: stop_hook_active threads into the next payload, survives a bridge re-entry, and clears only on a genuine input", async (t) => {
  _resetForTest();
  resetSettleState();

  const seen: boolean[] = [];
  _setExecutorForTest(blockingExecutorCapturing(seen));
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx } = makeCapCtx();

  // First block: the payload was built BEFORE any re-entry, so stop_hook_active
  // is false; the block re-entry then sets the flag.
  await runSettleCycle(pi, ctx);
  assert.equal(
    _peekLoopStateForTest().stopHookActive,
    true,
    "a block re-entry sets stop_hook_active",
  );

  // Second block: the payload now carries stop_hook_active:true (the flag
  // SURVIVED the bridge-injected re-entry -- it is NOT self-cleared).
  await runSettleCycle(pi, ctx);
  assert.deepEqual(
    seen,
    [false, true],
    "stop_hook_active threads true into the payload after a re-entry",
  );

  // A genuine input event clears the flag (and resets the counter).
  const epoch = currentEpoch();
  inputResetHandlerFor(epoch)();
  const afterInput = _peekLoopStateForTest();
  assert.equal(afterInput.stopHookActive, false, "input clears stop_hook_active");
  assert.equal(afterInput.consecutiveBlockCount, 0, "input resets the consecutive-block counter");

  // Third block after the input reset: the payload is false again.
  await runSettleCycle(pi, ctx);
  assert.deepEqual(seen, [false, true, false], "input reset makes the next payload false again");
  assert.equal(sent.length, 3, "each of the three blocks re-entered");
});

test("STOP-07 / STOP-05: additionalContext-without-block re-enters but resets the consecutive counter (non-block outcome)", async (t) => {
  _resetForTest();
  resetSettleState();

  let mode: "block" | "mutate" = "block";
  _setExecutorForTest((): Promise<HookExecResult> =>
    Promise.resolve(
      mode === "block"
        ? { kind: "block", reason: "loop" }
        : { kind: "mutate", additionalContext: "keep going" },
    ),
  );
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx } = makeCapCtx();

  for (let i = 0; i < 3; i += 1) {
    await runSettleCycle(pi, ctx);
  }

  assert.equal(_peekLoopStateForTest().consecutiveBlockCount, 3);

  mode = "mutate";
  await runSettleCycle(pi, ctx);
  assert.equal(sent.length, 4, "additionalContext still re-enters via the STOP-05 lane");
  assert.equal(
    _peekLoopStateForTest().consecutiveBlockCount,
    0,
    "additionalContext-without-block is a non-block outcome and resets the counter (D-88-06)",
  );
});
