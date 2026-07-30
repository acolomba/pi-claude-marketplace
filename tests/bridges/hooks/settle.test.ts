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
  resetSettleState,
  settleHandlerFor,
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
