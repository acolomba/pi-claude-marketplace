// Settle dispatcher unit tests (STOP-01 / STOP-03).
//
// Drives a synthetic `agent_end` -> `agent_settled` sequence through the
// settle handler with a stub executor passed to `settleHandlerFor`'s
// `executor` parameter and a Stop routing bucket seeded via event-router's
// `setRoutingBucket`. Pins the `stopReason` gate, the
// Stop block re-entry contract, the last-write-wins cache, and the epoch
// hygiene.

import assert from "node:assert/strict";
import test from "node:test";

import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  bumpEpoch,
  resetRoutingState,
  setRoutingBucket,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import {
  currentEpoch,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import {
  agentEndCacheHandler,
  inputResetHandlerFor,
  resetSettleState,
  settleHandlerFor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/settle.ts";
import { parseHookStdout } from "../../../extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { HookExecutor } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
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

function makeStopFailureEntry(pluginId: string, rawMatcher = ""): RoutingEntry {
  return {
    ...makeStopEntry(pluginId),
    claudeEvent: "StopFailure",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
  };
}

// A failure ending caches an assistant message whose `errorMessage` carries
// Pi's rendered error text (the StopFailure `last_assistant_message` source).
function makeAgentEndWithError(stopReason: StopReason, errorMsg?: string): AgentEndEvent {
  return {
    type: "agent_end",
    messages: [
      { role: "user", content: "hi", timestamp: 0 },
      {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        stopReason,
        ...(errorMsg !== undefined ? { errorMessage: errorMsg } : {}),
        timestamp: 1,
      },
    ],
  } as unknown as AgentEndEvent;
}

// ──────────────────────────────────────────────────────────────────────────
// STOP-01 / STOP-03: stopReason "stop" + a blocking Stop hook re-enters
// ──────────────────────────────────────────────────────────────────────────

test("STOP-03: stopReason stop + block hook -> one followUp+triggerTurn sendMessage", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const events: unknown[] = [];
  const injectedExecutor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, ["p1"], "the Stop bucket executor must run exactly once");
  assert.equal(
    (events[0] as { last_assistant_message: string }).last_assistant_message,
    "done",
    "the Stop payload must carry the run's rendered assistant text (STOP-02)",
  );
  assert.equal(sent.length, 1, "a blocking Stop hook must re-enter via exactly one sendMessage");
  assert.equal(sent[0]?.message["customType"], "claude-hook-stop-block");
  assert.equal(sent[0]?.message["content"], "go on");
  assert.equal(sent[0]?.message["display"], false);
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-02: last_assistant_message rendering -- text blocks join in order,
// non-text blocks (thinking / toolCall) are skipped
// ──────────────────────────────────────────────────────────────────────────

test("STOP-02: last_assistant_message joins text blocks and skips non-text blocks", async () => {
  resetRoutingState();
  resetSettleState();

  const events: unknown[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const multiBlockEnd = {
    type: "agent_end",
    messages: [
      { role: "user", content: "hi", timestamp: 0 },
      {
        role: "assistant",
        content: [
          { type: "text", text: "part one" },
          { type: "thinking", thinking: "internal reasoning" },
          { type: "text", text: " part two" },
        ],
        stopReason: "stop",
        timestamp: 1,
      },
    ],
  } as unknown as AgentEndEvent;

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(multiBlockEnd);
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(
    (events[0] as { last_assistant_message: string }).last_assistant_message,
    "part one part two",
    "text blocks must join in order; the thinking block must not leak into the payload",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: aborted / toolUse / deferred dispatch nothing
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: stopReason aborted dispatches nothing", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("aborted"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "aborted must not dispatch the Stop bucket");
  assert.equal(sent.length, 0, "aborted must not re-enter");
});

test("STOP-01: stopReason toolUse is a defensive no-op", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("toolUse"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "toolUse must not dispatch the Stop bucket");
  assert.equal(sent.length, 0, "toolUse must not re-enter");
});

test("STOP-01: stopReason deferred is a defensive no-op", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("deferred"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(
    fired,
    [],
    "a request deferred to a batch lane is still in flight and must run no Stop hook",
  );
  assert.equal(sent.length, 0, "a deferred request must not trigger a bridge re-entry");
});

test("STOP-01: an unknown stopReason is debug-logged and dropped without dispatch or throw", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  // A peer-dep bump could widen `StopReason` beyond the pinned union; the
  // runtime contract is a silent drop (debug log only), never a throw.
  agentEndCacheHandler(epoch)(makeAgentEnd("someFutureReason" as never));

  await assert.doesNotReject(
    () => settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx),
    "an unknown stopReason must not escape the settle handler",
  );
  assert.deepEqual(fired, [], "an unknown stopReason must not dispatch any bucket");
  assert.equal(sent.length, 0, "an unknown stopReason must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: empty cache (no preceding agent_end) returns early
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: cache miss, one-shot hit, and stale epoch are visible at public boundaries", async (t) => {
  // arrange
  resetRoutingState();
  resetSettleState();
  t.after(() => {
    resetSettleState();
    resetRoutingState();
  });

  const executorEvents: unknown[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    executorEvents.push(event);

    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  const staleEpoch = currentEpoch();
  bumpEpoch();
  agentEndCacheHandler(staleEpoch)(makeAgentEnd("stop"));
  await settleHandlerFor(staleEpoch, pi, injectedExecutor)(settledEvent, stubCtx);
  await settleHandlerFor(currentEpoch(), pi, injectedExecutor)(settledEvent, stubCtx);

  // assert
  assert.deepEqual(
    executorEvents,
    [
      { last_assistant_message: "done", stop_hook_active: false },
      { last_assistant_message: "done", stop_hook_active: true },
    ],
    "only fresh cache hits emit observer events, and each hit is consumed once",
  );
  assert.deepEqual(
    sent,
    [
      {
        message: {
          customType: "claude-hook-stop-block",
          content: "go on",
          display: false,
          details: { pluginId: "p1" },
        },
        options: { deliverAs: "followUp", triggerTurn: true },
      },
      {
        message: {
          customType: "claude-hook-stop-block",
          content: "go on",
          display: false,
          details: { pluginId: "p1" },
        },
        options: { deliverAs: "followUp", triggerTurn: true },
      },
    ],
    "cache misses, duplicate settles, and stale epochs cannot emit a re-entry",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: two agent_end events -> last-write-wins cache
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: two agent_end events expose only the last run to the observer", async (t) => {
  // arrange
  resetRoutingState();
  resetSettleState();
  t.after(() => {
    resetSettleState();
    resetRoutingState();
  });

  const executorEvents: unknown[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    executorEvents.push(event);

    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);
  const { pi } = makePi();
  const epoch = currentEpoch();
  const cache = agentEndCacheHandler(epoch);

  // act
  cache(makeAgentEnd("aborted"));
  cache(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  // assert
  assert.deepEqual(
    executorEvents,
    [{ last_assistant_message: "done", stop_hook_active: false }],
    "the observer sees the final agent_end rather than the overwritten aborted run",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: last-assistant selection -- a message list with no assistant
// caches nothing; trailing non-assistant messages are walked past
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: an agent_end with no assistant message produces no public effect", async (t) => {
  // arrange
  resetRoutingState();
  resetSettleState();
  t.after(() => {
    resetSettleState();
    resetRoutingState();
  });

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const noAssistantEnd = {
    type: "agent_end",
    messages: [
      { role: "user", content: "hi", timestamp: 0 },
      { role: "toolResult", content: [{ type: "text", text: "ok" }], timestamp: 1 },
    ],
  } as unknown as AgentEndEvent;

  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(noAssistantEnd);
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  // assert
  assert.deepEqual(fired, [], "an assistant-less run must not dispatch the Stop bucket");
  assert.equal(sent.length, 0, "an assistant-less run must not re-enter");
});

test("STOP-01: trailing non-assistant messages are walked past to the last assistant", async () => {
  resetRoutingState();
  resetSettleState();

  const events: unknown[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const trailingEnd = {
    type: "agent_end",
    messages: [
      { role: "user", content: "hi", timestamp: 0 },
      {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
        stopReason: "stop",
        timestamp: 1,
      },
      { role: "toolResult", content: [{ type: "text", text: "tool output" }], timestamp: 2 },
    ],
  } as unknown as AgentEndEvent;

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(trailingEnd);
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(events.length, 1, "the Stop bucket must dispatch off the cached assistant");
  assert.equal(
    (events[0] as { last_assistant_message: string }).last_assistant_message,
    "answer",
    "the walk from the end must land on the assistant message, not a trailing toolResult",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: the cache is one-shot -- a duplicate settle without a fresh
// agent_end does not reprocess the stale message
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// STOP-01: an epoch bump DURING Stop-hook execution (a /reload while the hook
// subprocess runs) stops the continuation after the bucket returns -- no loop
// state mutation, no re-entry into the new session
// ──────────────────────────────────────────────────────────────────────────

test("STOP-01: an epoch bump during Stop-hook execution suppresses stale re-entry and state mutation", async (t) => {
  // arrange
  resetRoutingState();
  resetSettleState();
  t.after(() => {
    resetSettleState();
    resetRoutingState();
  });

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> => {
    // Simulate a /reload landing while the hook runs: registerHooksBridge
    // bumps the epoch and resets the settle state mid-execution.
    bumpEpoch();
    resetSettleState();
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  const nextPayloads: unknown[] = [];
  const nextExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    nextPayloads.push(event);
    return Promise.resolve({ kind: "block", reason: "fresh" });
  };

  // act
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);
  const liveEpoch = currentEpoch();
  agentEndCacheHandler(liveEpoch)(makeAgentEnd("stop"));
  await settleHandlerFor(liveEpoch, pi, nextExecutor)(settledEvent, stubCtx);

  // assert
  assert.deepEqual(
    nextPayloads,
    [{ last_assistant_message: "done", stop_hook_active: false }],
    "the next session payload proves the stale continuation did not set stop_hook_active",
  );
  assert.equal(sent.length, 1, "only the fresh session may re-enter");
  assert.equal(sent[0]?.message["content"], "fresh");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-04: exit-2 rides the parseHookStdout block arm (no Stop-specific path)
// ──────────────────────────────────────────────────────────────────────────

test("STOP-04: exit-2 maps to block via parseHookStdout and re-enters with the stderr reason", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(parseHookStdout(2, "", "boom"));
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 1, "exit-2 must re-enter exactly once");
  assert.equal(sent[0]?.message["content"], "boom", "the exit-2 stderr becomes the block reason");
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

test("STOP-03: a block without a reason re-enters with empty-string content", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 1, "a reasonless block must still re-enter exactly once");
  assert.equal(
    sent[0]?.message["content"],
    "",
    "an absent block reason falls back to the empty string",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-05: additionalContext-without-block re-enters via the same lane
// ──────────────────────────────────────────────────────────────────────────

test("STOP-05: mutate additionalContext with no block re-enters with that context", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "keep going" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 1, "additionalContext must re-enter exactly once");
  assert.equal(sent[0]?.message["content"], "keep going");
  assert.equal(sent[0]?.options?.["deliverAs"], "followUp");
  assert.equal(sent[0]?.options?.["triggerTurn"], true);
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-06: continue:false (stop) does not re-enter
// ──────────────────────────────────────────────────────────────────────────

test("STOP-06: a single continue:false hook does not re-enter", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "stop" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

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

test("STOP-06: block before stop -> the stop suppresses re-entry", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = stopOrBlockExecutor();
  setRoutingBucket("Stop", [makeStopEntry("blocker"), makeStopEntry("stopper")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "any stop in the bucket suppresses re-entry regardless of a block");
});

test("STOP-06: stop before block -> the stop still suppresses re-entry", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = stopOrBlockExecutor();
  setRoutingBucket("Stop", [makeStopEntry("stopper"), makeStopEntry("blocker")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "aggregate precedence is order-independent");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-06 edge: an empty Stop bucket on stopReason "stop" does nothing
// ──────────────────────────────────────────────────────────────────────────

test("STOP-06: an empty Stop bucket on stop dispatches nothing", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", []);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an empty bucket must not run any executor");
  assert.equal(sent.length, 0, "an empty bucket must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// A Stop hook declaring asyncRewake:true degrades to noop (no silent block
// loss -- the block desire is dropped deterministically, the executor is never
// invoked)
// ──────────────────────────────────────────────────────────────────────────

test("an asyncRewake Stop hook is degraded to noop and does not re-enter", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1", { asyncRewake: true })]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an asyncRewake Stop entry must not reach the executor");
  assert.equal(sent.length, 0, "an asyncRewake Stop entry must not re-enter (degraded to noop)");
});

// ──────────────────────────────────────────────────────────────────────────
// MATCH-03: a Stop entry whose if predicate does not fire is skipped
// (if-no-match -> skip the entry, not block; the executor never runs)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: a non-firing if predicate skips the Stop entry without invoking the executor", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "go on" });
  };

  // The settle synthetic Stop event carries no `toolName`, so an
  // mcp-literal predicate can never fire against it.
  const gated: RoutingEntry = {
    ...makeStopEntry("gated"),
    ifPredicate: { kind: "mcp-literal", toolName: "mcp__srv__tool" },
  };
  setRoutingBucket("Stop", [gated]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "a non-firing if predicate must not reach the executor");
  assert.equal(sent.length, 0, "a skipped entry must not re-enter");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-07: stop_hook_active flag, 8-consecutive-re-entry cap, one-shot warning,
// input reset, D-88-08 shared-counter semantics.
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
async function runSettleCycle(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  executor?: HookExecutor,
): Promise<void> {
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, ctx);
}

test("STOP-07 boundary/adjacency: 7 blocks re-enter; the 8th suppresses re-entry and trips the cap once; a 9th does not re-notify", async () => {
  resetRoutingState();
  resetSettleState();

  const seen: boolean[] = [];
  const injectedExecutor: HookExecutor = blockingExecutorCapturing(seen);
  setRoutingBucket("Stop", [makeStopEntry("ralph-wiggum")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  assert.equal(sent.length, 7, "the first 7 consecutive blocks must each re-enter");
  assert.equal(notifyCalls.length, 0, "the cap must not trip before the 8th block");

  // 8th consecutive block -> cap trips: no re-entry + one-shot warning.
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.equal(sent.length, 7, "the 8th consecutive block must NOT re-enter");
  assert.equal(notifyCalls.length, 1, "the 8th consecutive block trips the cap once");
  assert.equal(notifyCalls[0]?.severity, "warning", "the cap warning is warning severity");
  assert.ok(
    notifyCalls[0]?.text.includes("ralph-wiggum"),
    "the cap warning names the blocking plugin",
  );

  // 9th consecutive block -> still suppressed, but the one-shot latch prevents
  // a second notify.
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.equal(sent.length, 7, "the 9th consecutive block must also be suppressed");
  assert.equal(
    notifyCalls.length,
    1,
    "a 9th consecutive block must NOT re-notify (one-shot latch)",
  );
});

test("STOP-07 ordering/precision: a non-block outcome resets the consecutive counter and re-arms the latch", async () => {
  resetRoutingState();
  resetSettleState();

  // Block on every entry EXCEPT a one-shot noop injected between runs.
  let mode: "block" | "noop" = "block";
  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(mode === "block" ? { kind: "block", reason: "loop" } : { kind: "noop" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  // 7 consecutive blocks -> no cap yet.
  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  // A single non-re-entry outcome (a plain allow) resets the counter (D-88-08 --
  // only consecutive re-entries count).
  mode = "noop";
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.equal(notifyCalls.length, 0, "the reset must re-arm before any cap trip");

  // 7 FRESH consecutive blocks re-enter without tripping (proves the earlier 7
  // did not accumulate across the reset).
  mode = "block";
  const sentBeforeFreshRun = sent.length;
  for (let i = 0; i < 7; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  assert.equal(sent.length - sentBeforeFreshRun, 7, "7 fresh consecutive blocks each re-enter");
  assert.equal(notifyCalls.length, 0, "cap must not trip until 8 FRESH consecutive blocks");

  // The 8th fresh block trips the cap (latch re-armed by the earlier reset).
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.equal(notifyCalls.length, 1, "the cap re-trips after a reset re-armed the latch");
});

test("STOP-07 empty: zero blocks -> counter stays 0, no cap, no notify, stop_hook_active false", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "noop" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  await runSettleCycle(pi, ctx, injectedExecutor);

  assert.equal(sent.length, 0, "a noop outcome must not re-enter");
  assert.equal(notifyCalls.length, 0, "zero blocks must not notify");
});

test("STOP-07: stop_hook_active threads into the next payload, survives a bridge re-entry, and clears only on a genuine input", async () => {
  resetRoutingState();
  resetSettleState();

  const seen: boolean[] = [];
  const injectedExecutor: HookExecutor = blockingExecutorCapturing(seen);
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx } = makeCapCtx();

  // First block: the payload was built BEFORE any re-entry, so stop_hook_active
  // is false; the block re-entry then sets the flag.
  await runSettleCycle(pi, ctx, injectedExecutor);

  // Second block: the payload now carries stop_hook_active:true (the flag
  // SURVIVED the bridge-injected re-entry -- it is NOT self-cleared).
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.deepEqual(
    seen,
    [false, true],
    "stop_hook_active threads true into the payload after a re-entry",
  );

  // A genuine input event clears the flag (and resets the counter).
  const epoch = currentEpoch();
  inputResetHandlerFor(epoch)();

  // Third block after the input reset: the payload is false again.
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.deepEqual(seen, [false, true, false], "input reset makes the next payload false again");
  assert.equal(sent.length, 3, "each of the three blocks re-entered");
});

test("STOP-07: a stale input reset leaves the active flag visible in the next payload", async () => {
  resetRoutingState();
  resetSettleState();

  const seen: boolean[] = [];
  const injectedExecutor: HookExecutor = blockingExecutorCapturing(seen);
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const stale = currentEpoch();
  const staleHandler = inputResetHandlerFor(stale);

  // One block re-entry seeds the loop state the stale closure must not touch.
  await runSettleCycle(pi, stubCtx, injectedExecutor);

  bumpEpoch();
  staleHandler();
  await runSettleCycle(pi, stubCtx, injectedExecutor);

  assert.deepEqual(
    seen,
    [false, true],
    "the next live Stop payload stays active after the stale reset closure no-ops",
  );
  assert.equal(sent.length, 2, "both live Stop cycles re-enter");
});

test("STOP-07 / STOP-05: additionalContext re-enters and increments the shared consecutive counter (D-88-08)", async () => {
  resetRoutingState();
  resetSettleState();

  let mode: "block" | "mutate" = "block";
  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(
      mode === "block"
        ? { kind: "block", reason: "loop" }
        : { kind: "mutate", additionalContext: "keep going" },
    );
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx } = makeCapCtx();

  for (let i = 0; i < 3; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  mode = "mutate";
  await runSettleCycle(pi, ctx, injectedExecutor);
  assert.equal(sent.length, 4, "additionalContext still re-enters via the STOP-05 lane");
  assert.equal(sent[3]?.message["content"], "keep going");
});

test("STOP-07 / D-88-08: a pure-additionalContext loop is bounded by the shared cap", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "keep going" });
  setRoutingBucket("Stop", [makeStopEntry("ctx-looper")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  // 8 consecutive additionalContext re-entries: the first 7 re-enter, the 8th
  // trips the cap without re-entering.
  for (let i = 0; i < 8; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  assert.equal(sent.length, 7, "a pure-additionalContext loop is bounded to 7 re-entries");
  assert.equal(notifyCalls.length, 1, "the 8th additionalContext re-entry trips the cap once");
  assert.equal(notifyCalls[0]?.severity, "warning", "the cap warning is warning severity");
  assert.ok(
    notifyCalls[0]?.text.includes("ctx-looper"),
    "the cap warning names the looping plugin",
  );
});

test("STOP-07 / D-88-08: alternating block and additionalContext share one cap", async () => {
  resetRoutingState();
  resetSettleState();

  // Alternate block -> additionalContext -> block -> ... across settle cycles.
  let n = 0;
  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> => {
    const result: HookExecResult =
      n % 2 === 0
        ? { kind: "block", reason: "loop" }
        : { kind: "mutate", additionalContext: "keep going" };
    n += 1;
    return Promise.resolve(result);
  };

  setRoutingBucket("Stop", [makeStopEntry("alt")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  // 8 alternating re-entries share ONE counter: the first 7 re-enter, the 8th
  // trips the shared cap (neither lane resets it).
  for (let i = 0; i < 8; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  assert.equal(sent.length, 7, "alternating block/context re-entries are bounded to 7 together");
  assert.equal(
    notifyCalls.length,
    1,
    "the 8th alternating re-entry trips the shared cap once (D-88-08)",
  );
});

test("STOP-07 / D-88-08: continue:false resets the cap run but keeps the next payload active", async () => {
  resetRoutingState();
  resetSettleState();

  let mode: "block" | "stop" = "block";
  const seen: boolean[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    seen.push((event as { stop_hook_active: boolean }).stop_hook_active);

    return Promise.resolve(mode === "block" ? { kind: "block", reason: "loop" } : { kind: "stop" });
  };

  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const { pi, sent } = makePi();
  const { ctx, notifyCalls } = makeCapCtx();

  for (let i = 0; i < 2; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  mode = "stop";
  await runSettleCycle(pi, ctx, injectedExecutor);
  mode = "block";
  for (let i = 0; i < 8; i += 1) {
    await runSettleCycle(pi, ctx, injectedExecutor);
  }

  assert.equal(seen[3], true, "continue:false does not clear the active flag in the next payload");
  assert.equal(sent.length, 9, "the reset starts a fresh run with seven accepted re-entries");
  assert.equal(notifyCalls.length, 1, "the eighth fresh re-entry trips the cap");
});

// ──────────────────────────────────────────────────────────────────────────
// STOP-03: the settle handler never throws -- a host sendMessage throw is
// contained (degrades to a debug log)
// ──────────────────────────────────────────────────────────────────────────

test("STOP-03: a sendMessage throw during block re-entry does not escape the settle handler", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "go on" });
  setRoutingBucket("Stop", [makeStopEntry("p1")]);

  const pi = {
    sendMessage: (): void => {
      throw new Error("host refused");
    },
  } as unknown as ExtensionAPI;
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEnd("stop"));

  await assert.doesNotReject(
    () => settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx),
    "a sendMessage throw must degrade to a debug log, not escape the settle handler",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SFAIL-01: StopFailure is observation-only. `error` / `length` run the
// StopFailure bucket and DISCARD the result -- never a sendMessage, never a
// stop_hook_active or consecutive-block-counter mutation, even when the hook
// blocks or exits 2.
// ──────────────────────────────────────────────────────────────────────────

test("SFAIL-01: stopReason error runs the StopFailure bucket observation-only even when the hook blocks", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const events: unknown[] = [];
  const injectedExecutor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "stay" });
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "Rate limit exceeded (429)"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, ["sf1"], "the StopFailure bucket must run at settle on error");
  const payload = events[0] as { error: string; last_assistant_message: string };
  assert.equal(payload.error, "rate_limit", "the payload carries the classified error (SFAIL-03)");
  assert.equal(
    payload.last_assistant_message,
    "Rate limit exceeded (429)",
    "the payload carries Pi's rendered errorMessage (SFAIL-02)",
  );
  assert.equal(
    sent.length,
    0,
    "StopFailure is observation-only: a blocking hook must NOT re-enter",
  );
});

test("SFAIL-02: a failure without errorMessage classifies unknown and carries an empty message", async () => {
  resetRoutingState();
  resetSettleState();

  const events: unknown[] = [];
  const injectedExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1")]);

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  const payload = events[0] as { error: string; last_assistant_message: string };
  assert.equal(payload.error, "unknown", "a matchless errorMessage classifies to unknown");
  assert.equal(
    payload.last_assistant_message,
    "",
    "an absent errorMessage falls back to the empty string",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SFAIL-03: error-type matcher filtering at dispatch -- an admitted
// closed-set matcher fires only on its exact classified error; match-all
// ("" / "*") fires on every failure type.
// ──────────────────────────────────────────────────────────────────────────

test("SFAIL-03: a rate_limit-matched hook fires on a rate_limit classification", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1", "rate_limit")]);

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "Rate limit exceeded (429)"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, ["sf1"], "the matcher must admit its exact classified error type");
});

test("SFAIL-03: a rate_limit-matched hook does NOT fire on a billing_error classification", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1", "rate_limit")]);

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "quota exceeded"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "a non-matching error-type matcher must not fire the hook");
});

test('SFAIL-03: "" and "*" matchers fire on every failure classification', async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [
    makeStopFailureEntry("sf-empty", ""),
    makeStopFailureEntry("sf-star", "*"),
    makeStopFailureEntry("sf-rate", "rate_limit"),
  ]);

  const { pi } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "server error"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(
    fired,
    ["sf-empty", "sf-star"],
    "match-all matchers fire on any classification; the exact matcher stays filtered",
  );
});

test("SFAIL-01: every StopFailure observer runs even after a leading block", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    // The first observer blocks; a reducing walk would short-circuit here and
    // starve the second observer.
    return Promise.resolve(
      entry.pluginId === "sf1" ? { kind: "block", reason: "stay" } : { kind: "noop" },
    );
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1"), makeStopFailureEntry("sf2")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "boom"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(
    fired,
    ["sf1", "sf2"],
    "a leading block must not starve later StopFailure observers",
  );
  assert.equal(sent.length, 0, "StopFailure is observation-only: no re-entry");
});

test("SFAIL-01: stopReason length runs the StopFailure bucket observation-only", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "stay" });
  };

  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("length"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, ["sf1"], "the StopFailure bucket must run at settle on length");
  assert.equal(sent.length, 0, "length is observation-only: no re-entry");
});

test("SFAIL-01: a StopFailure hook exiting 2 produces no re-entry (result discarded)", async () => {
  resetRoutingState();
  resetSettleState();

  const injectedExecutor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(parseHookStdout(2, "", "boom"));
  setRoutingBucket("StopFailure", [makeStopFailureEntry("sf1")]);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "boom"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.equal(sent.length, 0, "an exit-2 StopFailure hook must NOT re-enter (observation-only)");
});

test("SFAIL-01: an empty StopFailure bucket dispatches nothing", async () => {
  resetRoutingState();
  resetSettleState();

  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "stay" });
  };

  setRoutingBucket("StopFailure", []);

  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(makeAgentEndWithError("error", "boom"));
  await settleHandlerFor(epoch, pi, injectedExecutor)(settledEvent, stubCtx);

  assert.deepEqual(fired, [], "an empty StopFailure bucket must not run any executor");
  assert.equal(sent.length, 0, "an empty StopFailure bucket must not re-enter");
});
