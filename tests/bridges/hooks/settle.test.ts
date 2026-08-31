import assert from "node:assert/strict";
import test from "node:test";

import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  bumpEpoch,
  currentEpoch,
  resetRoutingState,
  setRoutingBucket,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import {
  agentEndCacheHandler,
  inputResetHandlerFor,
  resetSettleState,
  settleHandlerFor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/settle.ts";
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
import type { TestContext } from "node:test";

const settledEvent = { type: "agent_settled" } as unknown as AgentSettledEvent;
const emptyContext = {} as unknown as ExtensionContext;

interface SendCall {
  readonly message: Record<string, unknown>;
  readonly options: Record<string, unknown> | undefined;
}

interface NotifyCall {
  readonly text: string;
  readonly severity: "info" | "warning" | "error" | undefined;
}

function isolateCase(t: TestContext): void {
  resetRoutingState();
  resetSettleState();
  t.after(() => {
    resetSettleState();
    resetRoutingState();
  });
}

function makePi(sendError?: Error): { pi: ExtensionAPI; sent: SendCall[] } {
  const sent: SendCall[] = [];
  const pi = {
    sendMessage: (message: unknown, options?: unknown): void => {
      if (sendError !== undefined) {
        throw sendError;
      }

      sent.push({
        message: message as Record<string, unknown>,
        options: options as Record<string, unknown> | undefined,
      });
    },
    isIdle: (): boolean => true,
  };
  return { pi: pi as unknown as ExtensionAPI, sent };
}

function makeContext(): { ctx: ExtensionContext; notified: NotifyCall[] } {
  const notified: NotifyCall[] = [];
  const ctx = {
    ui: {
      notify: (text: string, severity?: "info" | "warning" | "error"): void => {
        notified.push({ text, severity });
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notified };
}

function stopEntry(pluginId: string, asyncRewake = false): RoutingEntry {
  return {
    scope: "user",
    marketplace: "catalog",
    pluginId,
    resolvedSource: asAbsolutePluginRoot("/test/plugin-root"),
    claudeEvent: "Stop",
    matcher: parseMatcher(""),
    rawMatcher: "",
    handlerDecl: {
      type: "command",
      command: `echo ${pluginId}`,
      ...(asyncRewake ? { asyncRewake: true } : {}),
    },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

function failureEntry(pluginId: string, rawMatcher = ""): RoutingEntry {
  return {
    ...stopEntry(pluginId),
    claudeEvent: "StopFailure",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
  };
}

function agentEnd(stopReason: StopReason): AgentEndEvent {
  return {
    type: "agent_end",
    messages: [
      { role: "user", content: "hello", timestamp: 0 },
      {
        role: "assistant",
        content: [{ type: "text", text: "done" }],
        stopReason,
        timestamp: 1,
      },
    ],
  } as unknown as AgentEndEvent;
}

function failureEnd(
  stopReason: Extract<StopReason, "error" | "length">,
  errorMessage?: string,
): AgentEndEvent {
  return {
    type: "agent_end",
    messages: [
      { role: "user", content: "hello", timestamp: 0 },
      {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        stopReason,
        ...(errorMessage === undefined ? {} : { errorMessage }),
        timestamp: 1,
      },
    ],
  } as unknown as AgentEndEvent;
}

async function runStop(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  executor: HookExecutor,
): Promise<void> {
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, ctx);
}

test("cache miss, one-shot hit, and stale epoch are visible at public boundaries", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  const staleEpoch = currentEpoch();
  bumpEpoch();
  agentEndCacheHandler(staleEpoch)(agentEnd("stop"));
  await settleHandlerFor(staleEpoch, pi, executor)(settledEvent, emptyContext);
  await settleHandlerFor(currentEpoch(), pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { last_assistant_message: "done", stop_hook_active: false },
    { last_assistant_message: "done", stop_hook_active: true },
  ]);
  assert.deepStrictEqual(
    sent.map((call) => call.message),
    [
      {
        customType: "claude-hook-stop-block",
        content: "continue",
        display: false,
        details: { pluginId: "alpha" },
      },
      {
        customType: "claude-hook-stop-block",
        content: "continue",
        display: false,
        details: { pluginId: "alpha" },
      },
    ],
  );
});

test("the last agent ending wins before settle", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi } = makePi();
  const epoch = currentEpoch();
  const cache = agentEndCacheHandler(epoch);

  // act
  cache(agentEnd("aborted"));
  cache(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ last_assistant_message: "done", stop_hook_active: false }]);
});

test("an ending without an assistant has no public effect", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const ending = {
    type: "agent_end",
    messages: [
      { role: "user", content: "hello", timestamp: 0 },
      { role: "toolResult", content: [{ type: "text", text: "output" }], timestamp: 1 },
    ],
  } as unknown as AgentEndEvent;
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(ending);
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("trailing non-assistant messages do not replace the assistant", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const ending = {
    type: "agent_end",
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "answer" }],
        stopReason: "stop",
        timestamp: 1,
      },
      { role: "toolResult", content: [{ type: "text", text: "output" }], timestamp: 2 },
    ],
  } as unknown as AgentEndEvent;
  const { pi } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(ending);
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ last_assistant_message: "answer", stop_hook_active: false }]);
});

test("assistant text joins in order and excludes non-text content", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const ending = {
    type: "agent_end",
    messages: [
      {
        role: "assistant",
        content: [
          { type: "text", text: "first" },
          { type: "thinking", thinking: "private" },
          { type: "text", text: " second" },
        ],
        stopReason: "stop",
        timestamp: 1,
      },
    ],
  } as unknown as AgentEndEvent;
  const { pi } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(ending);
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { last_assistant_message: "first second", stop_hook_active: false },
  ]);
});

for (const stopReason of ["pending", "aborted", "toolUse", "deferred"] as const) {
  test(`${stopReason} endings do not dispatch a settle bucket`, async (t) => {
    // arrange
    isolateCase(t);
    const fired: string[] = [];
    const executor: HookExecutor = (entry): Promise<HookExecResult> => {
      fired.push(entry.pluginId);
      return Promise.resolve({ kind: "block", reason: "continue" });
    };

    setRoutingBucket("Stop", [stopEntry("stop")]);
    setRoutingBucket("StopFailure", [failureEntry("failure")]);
    const { pi, sent } = makePi();
    const epoch = currentEpoch();

    // act
    agentEndCacheHandler(epoch)(agentEnd(stopReason));
    await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

    // assert
    assert.deepStrictEqual(fired, []);
    assert.deepStrictEqual(sent, []);
  });
}

test("an unknown ending is dropped without throwing", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(agentEnd("future" as never));
  let settleError: unknown;

  // act
  try {
    await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  } catch (error) {
    settleError = error;
  }

  // assert
  assert.strictEqual(settleError, undefined);
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("an empty Stop bucket has no public effect", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", []);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("a block re-enters with the complete follow-up message", async (t) => {
  // arrange
  isolateCase(t);
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(sent, [
    {
      message: {
        customType: "claude-hook-stop-block",
        content: "continue",
        display: false,
        details: { pluginId: "alpha" },
      },
      options: { deliverAs: "followUp", triggerTurn: true },
    },
  ]);
});

test("a reasonless block re-enters with empty content", async (t) => {
  // arrange
  isolateCase(t);
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "block" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.strictEqual(sent[0]?.message["content"], "");
  assert.strictEqual(sent.length, 1);
});

test("additional context re-enters through the block lane", async (t) => {
  // arrange
  isolateCase(t);
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "more context" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(sent, [
    {
      message: {
        customType: "claude-hook-stop-block",
        content: "more context",
        display: false,
        details: { pluginId: "alpha" },
      },
      options: { deliverAs: "followUp", triggerTurn: true },
    },
  ]);
});

test("a noop Stop outcome emits no message or notification", async (t) => {
  // arrange
  isolateCase(t);
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "noop" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  await runStop(pi, ctx, executor);

  // assert
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, []);
});

test("a stop outcome suppresses a preceding block", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve(
      entry.pluginId === "blocker"
        ? { kind: "block", reason: "continue" }
        : { kind: "stop", stopReason: "operator stopped" },
    );
  };

  setRoutingBucket("Stop", [stopEntry("blocker"), stopEntry("stopper")]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["blocker", "stopper"]);
  assert.deepStrictEqual(sent, []);
});

test("a stop outcome suppresses a following block", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve(
      entry.pluginId === "stopper" ? { kind: "stop" } : { kind: "block", reason: "continue" },
    );
  };

  setRoutingBucket("Stop", [stopEntry("stopper"), stopEntry("blocker")]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["stopper", "blocker"]);
  assert.deepStrictEqual(sent, []);
});

test("an asynchronous Stop declaration degrades to noop", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha", true)]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("a false if predicate skips a Stop declaration", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  const entry: RoutingEntry = {
    ...stopEntry("alpha"),
    ifPredicate: { kind: "mcp-literal", toolName: "mcp__server__tool" },
  };
  setRoutingBucket("Stop", [entry]);
  const { pi, sent } = makePi();

  // act
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("an epoch change during Stop execution discards the stale result", async (t) => {
  // arrange
  isolateCase(t);
  const staleExecutor: HookExecutor = (): Promise<HookExecResult> => {
    bumpEpoch();
    resetSettleState();
    return Promise.resolve({ kind: "block", reason: "stale" });
  };

  const liveEvents: unknown[] = [];
  const liveExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    liveEvents.push(event);
    return Promise.resolve({ kind: "block", reason: "fresh" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, staleExecutor)(settledEvent, emptyContext);
  await runStop(pi, emptyContext, liveExecutor);

  // assert
  assert.deepStrictEqual(liveEvents, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(
    sent.map((call) => call.message["content"]),
    ["fresh"],
  );
});

test("the eighth consecutive block is suppressed and warns only once", async (t) => {
  // arrange
  isolateCase(t);
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 9; index += 1) {
    await runStop(pi, ctx, executor);
  }

  // assert
  assert.deepStrictEqual(flags, [false, true, true, true, true, true, true, true, true]);
  assert.strictEqual(sent.length, 7);
  assert.deepStrictEqual(notified, [
    {
      text: "Stop hook override cap reached.\n\n`alpha`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      severity: "warning",
    },
  ]);
});

test("block and additional-context re-entries share one cap", async (t) => {
  // arrange
  isolateCase(t);
  let invocation = 0;
  const executor: HookExecutor = (): Promise<HookExecResult> => {
    const outcome: HookExecResult =
      invocation % 2 === 0
        ? { kind: "block", reason: "continue" }
        : { kind: "mutate", additionalContext: "more context" };
    invocation += 1;
    return Promise.resolve(outcome);
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 8; index += 1) {
    await runStop(pi, ctx, executor);
  }

  // assert
  assert.deepStrictEqual(
    sent.map((call) => call.message["content"]),
    [
      "continue",
      "more context",
      "continue",
      "more context",
      "continue",
      "more context",
      "continue",
    ],
  );
  assert.strictEqual(notified.length, 1);
});

test("a noop resets the cap and rearms its notification", async (t) => {
  // arrange
  isolateCase(t);
  let mode: "block" | "noop" = "block";
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(mode === "block" ? { kind: "block", reason: "continue" } : { kind: "noop" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 7; index += 1) {
    await runStop(pi, ctx, executor);
  }

  mode = "noop";
  await runStop(pi, ctx, executor);
  mode = "block";
  for (let index = 0; index < 8; index += 1) {
    await runStop(pi, ctx, executor);
  }

  // assert
  assert.strictEqual(sent.length, 14);
  assert.strictEqual(notified.length, 1);
});

test("a stop resets the cap but leaves the next payload active", async (t) => {
  // arrange
  isolateCase(t);
  let mode: "block" | "stop" = "block";
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve(
      mode === "block" ? { kind: "block", reason: "continue" } : { kind: "stop" },
    );
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  await runStop(pi, ctx, executor);
  mode = "stop";
  await runStop(pi, ctx, executor);
  mode = "block";
  for (let index = 0; index < 8; index += 1) {
    await runStop(pi, ctx, executor);
  }

  // assert
  assert.strictEqual(flags[2], true);
  assert.strictEqual(sent.length, 8);
  assert.strictEqual(notified.length, 1);
});

test("a live input clears active state and resets the cap", async (t) => {
  // arrange
  isolateCase(t);
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();
  const epoch = currentEpoch();

  // act
  await runStop(pi, ctx, executor);
  await runStop(pi, ctx, executor);
  inputResetHandlerFor(epoch)();
  for (let index = 0; index < 8; index += 1) {
    await runStop(pi, ctx, executor);
  }

  // assert
  assert.deepStrictEqual(flags.slice(0, 3), [false, true, false]);
  assert.strictEqual(sent.length, 9);
  assert.strictEqual(notified.length, 1);
});

test("a stale input handler cannot clear live active state", async (t) => {
  // arrange
  isolateCase(t);
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const staleHandler = inputResetHandlerFor(currentEpoch());

  // act
  await runStop(pi, emptyContext, executor);
  bumpEpoch();
  staleHandler();
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, true]);
  assert.strictEqual(sent.length, 2);
});

test("resetting settle state clears cached and active session data", async (t) => {
  // arrange
  isolateCase(t);
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  await runStop(pi, emptyContext, executor);
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  resetSettleState();
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);
  await runStop(pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, false]);
  assert.strictEqual(sent.length, 2);
});

test("a send failure is contained and a later input starts a clean run", async (t) => {
  // arrange
  isolateCase(t);
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const failingPi = makePi(new Error("host refused")).pi;
  const healthy = makePi();
  const epoch = currentEpoch();
  let settleError: unknown;

  // act
  try {
    await runStop(failingPi, emptyContext, executor);
  } catch (error) {
    settleError = error;
  }

  await settleHandlerFor(epoch, healthy.pi, executor)(settledEvent, emptyContext);
  inputResetHandlerFor(epoch)();
  await runStop(healthy.pi, emptyContext, executor);

  // assert
  assert.strictEqual(settleError, undefined);
  assert.deepStrictEqual(
    healthy.sent.map((call) => call.message["content"]),
    ["continue"],
  );
});

test("an executor rejection consumes its ending and permits a fresh ending", async (t) => {
  // arrange
  isolateCase(t);
  const executorError = new Error("executor failed");
  const rejecting: HookExecutor = (): Promise<HookExecResult> => Promise.reject(executorError);
  const events: unknown[] = [];
  const healthy: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  let rejectedWith: unknown;

  // act
  try {
    await settleHandlerFor(epoch, pi, rejecting)(settledEvent, emptyContext);
  } catch (error) {
    rejectedWith = error;
  }

  await settleHandlerFor(epoch, pi, healthy)(settledEvent, emptyContext);
  agentEndCacheHandler(epoch)(agentEnd("stop"));
  await settleHandlerFor(epoch, pi, healthy)(settledEvent, emptyContext);

  // assert
  assert.strictEqual(rejectedWith, executorError);
  assert.deepStrictEqual(events, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(sent, []);
});

test("an error ending reaches matching failure observers with its payload", async (t) => {
  // arrange
  isolateCase(t);
  const observed: Array<{ pluginId: string; event: unknown }> = [];
  const executor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    observed.push({ pluginId: entry.pluginId, event });
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [
    failureEntry("all"),
    failureEntry("star", "*"),
    failureEntry("exact", "rate_limit"),
    failureEntry("other", "billing_error"),
  ]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(failureEnd("error", "Rate limit exceeded (429)"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(observed, [
    {
      pluginId: "all",
      event: { error: "rate_limit", last_assistant_message: "Rate limit exceeded (429)" },
    },
    {
      pluginId: "star",
      event: { error: "rate_limit", last_assistant_message: "Rate limit exceeded (429)" },
    },
    {
      pluginId: "exact",
      event: { error: "rate_limit", last_assistant_message: "Rate limit exceeded (429)" },
    },
  ]);
  assert.deepStrictEqual(sent, []);
});

test("a length ending reports max-output classification without re-entry", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "ignored" });
  };

  setRoutingBucket("StopFailure", [failureEntry("observer")]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(failureEnd("length", "provider text"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { error: "max_output_tokens", last_assistant_message: "provider text" },
  ]);
  assert.deepStrictEqual(sent, []);
});

test("a failure without text reports unknown with an empty message", async (t) => {
  // arrange
  isolateCase(t);
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  setRoutingBucket("StopFailure", [failureEntry("observer")]);
  const { pi } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(failureEnd("error"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ error: "unknown", last_assistant_message: "" }]);
});

test("all failure outcomes run in order and are then discarded", async (t) => {
  // arrange
  isolateCase(t);
  const observed: Array<{ pluginId: string; event: unknown }> = [];
  const outcomes: Record<string, HookExecResult> = {
    noop: { kind: "noop" },
    block: { kind: "block", reason: "ignored block" },
    mutate: { kind: "mutate", additionalContext: "ignored context" },
    stop: { kind: "stop", stopReason: "ignored stop" },
  };
  const failureExecutor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    observed.push({ pluginId: entry.pluginId, event });
    return Promise.resolve(outcomes[entry.pluginId] ?? { kind: "noop" });
  };

  const stopEvents: unknown[] = [];
  const stopExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    stopEvents.push(event);
    return Promise.resolve({ kind: "block", reason: "fresh" });
  };

  setRoutingBucket("StopFailure", [
    failureEntry("noop"),
    failureEntry("block"),
    failureEntry("mutate"),
    failureEntry("stop"),
  ]);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(failureEnd("error", "provider failed"));
  await settleHandlerFor(epoch, pi, failureExecutor)(settledEvent, emptyContext);
  setRoutingBucket("Stop", [stopEntry("fresh")]);
  await runStop(pi, emptyContext, stopExecutor);

  // assert
  assert.deepStrictEqual(
    observed.map(({ pluginId }) => pluginId),
    ["noop", "block", "mutate", "stop"],
  );
  assert.deepStrictEqual(
    observed.map(({ event }) => event),
    Array.from({ length: 4 }, () => ({
      error: "unknown",
      last_assistant_message: "provider failed",
    })),
  );
  assert.deepStrictEqual(stopEvents, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(
    sent.map((call) => call.message["content"]),
    ["fresh"],
  );
});

test("an empty failure bucket has no public effect", async (t) => {
  // arrange
  isolateCase(t);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "ignored" });
  };

  setRoutingBucket("StopFailure", []);
  const { pi, sent } = makePi();
  const epoch = currentEpoch();

  // act
  agentEndCacheHandler(epoch)(failureEnd("error", "provider failed"));
  await settleHandlerFor(epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});
