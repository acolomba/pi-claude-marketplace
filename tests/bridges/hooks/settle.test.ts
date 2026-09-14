import assert from "node:assert/strict";
import test from "node:test";

import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { type RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
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
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { StopReason } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  AgentEndEvent,
  AgentSettledEvent,
  AssistantMessage,
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  runtime: HooksRuntime,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  executor: HookExecutor,
): Promise<void> {
  const generation = runtime.currentGeneration();
  agentEndCacheHandler(runtime, generation)(agentEnd("stop"));
  await settleHandlerFor(runtime, generation, pi, executor)(settledEvent, ctx);
}

test("uses only the supplied runtime for Stop re-entry", async () => {
  // arrange
  const owningRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const generation = owningRuntime.advanceGeneration();
  peerRuntime.advanceGeneration();
  owningRuntime.setRoutingBucket("Stop", [stopEntry("owner")]);
  peerRuntime.setRoutingBucket("Stop", [stopEntry("peer")]);
  const ownerMessage = agentEnd("stop").messages[1] as AssistantMessage;
  const peerMessage = agentEnd("stop").messages[1] as AssistantMessage;
  owningRuntime.recordLastAssistant(ownerMessage);
  peerRuntime.recordLastAssistant(peerMessage);
  const events: unknown[] = [];
  const executor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    events.push({ pluginId: entry.pluginId, event });
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  const { pi, sent } = makePi();

  // act
  const handler = settleHandlerFor(owningRuntime, generation, pi, executor);
  await handler(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(
    sent.map((call) => call.message),
    [
      {
        customType: "claude-hook-stop-block",
        content: "continue",
        display: false,
        details: { pluginId: "owner" },
      },
    ],
  );
  assert.strictEqual(peerRuntime.takeLastAssistant(), peerMessage);
  assert.deepStrictEqual(events, [
    {
      pluginId: "owner",
      event: { last_assistant_message: "done", stop_hook_active: false },
    },
  ]);
});

test("cache miss, one-shot hit, and stale epoch are visible at public boundaries", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  const staleEpoch = runtime.currentGeneration();
  runtime.advanceGeneration();
  agentEndCacheHandler(runtime, staleEpoch)(agentEnd("stop"));
  await settleHandlerFor(runtime, staleEpoch, pi, executor)(settledEvent, emptyContext);
  await settleHandlerFor(
    runtime,
    runtime.currentGeneration(),
    pi,
    executor,
  )(settledEvent, emptyContext);

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

test("the last agent ending wins before settle", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi } = makePi();
  const epoch = runtime.currentGeneration();
  const cache = agentEndCacheHandler(runtime, epoch);

  // act
  cache(agentEnd("aborted"));
  cache(agentEnd("stop"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ last_assistant_message: "done", stop_hook_active: false }]);
});

test("an ending without an assistant has no public effect", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const ending = {
    type: "agent_end",
    messages: [
      { role: "user", content: "hello", timestamp: 0 },
      { role: "toolResult", content: [{ type: "text", text: "output" }], timestamp: 1 },
    ],
  } as unknown as AgentEndEvent;
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(ending);
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.strictEqual(sent.length, 0);
});

test("trailing non-assistant messages do not replace the assistant", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
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
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(ending);
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ last_assistant_message: "answer", stop_hook_active: false }]);
});

test("assistant text joins in order and excludes non-text content", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
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
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(ending);
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { last_assistant_message: "first second", stop_hook_active: false },
  ]);
});

for (const stopReason of ["pending", "aborted", "toolUse", "deferred"] as const) {
  test(`${stopReason} endings do not dispatch a settle bucket`, async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const fired: string[] = [];
    const executor: HookExecutor = (entry): Promise<HookExecResult> => {
      fired.push(entry.pluginId);
      return Promise.resolve({ kind: "block", reason: "continue" });
    };

    runtime.setRoutingBucket("Stop", [stopEntry("stop")]);
    runtime.setRoutingBucket("StopFailure", [failureEntry("failure")]);
    const { pi, sent } = makePi();
    const epoch = runtime.currentGeneration();

    // act
    agentEndCacheHandler(runtime, epoch)(agentEnd(stopReason));
    await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

    // assert
    assert.deepStrictEqual(fired, []);
    assert.deepStrictEqual(sent, []);
  });
}

test("an unknown ending is dropped without throwing", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();
  agentEndCacheHandler(runtime, epoch)(agentEnd("future" as never));
  let settleError: unknown;

  // act
  try {
    await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  } catch (error) {
    settleError = error;
  }

  // assert
  assert.strictEqual(settleError, undefined);
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("an empty Stop bucket has no public effect", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", []);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("a block re-enters with the complete follow-up message", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

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

test("a reasonless block re-enters with empty content", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "block" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.strictEqual(sent[0]?.message["content"], "");
  assert.strictEqual(sent.length, 1);
});

test("additional context re-enters through the block lane", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "more context" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

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

test("a noop Stop outcome emits no message or notification", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "noop" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  await runStop(runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, []);
});

test("a stop outcome suppresses a preceding block", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve(
      entry.pluginId === "blocker"
        ? { kind: "block", reason: "continue" }
        : { kind: "stop", stopReason: "operator stopped" },
    );
  };

  runtime.setRoutingBucket("Stop", [stopEntry("blocker"), stopEntry("stopper")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["blocker", "stopper"]);
  assert.deepStrictEqual(sent, []);
});

test("a stop outcome suppresses a following block", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve(
      entry.pluginId === "stopper" ? { kind: "stop" } : { kind: "block", reason: "continue" },
    );
  };

  runtime.setRoutingBucket("Stop", [stopEntry("stopper"), stopEntry("blocker")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["stopper", "blocker"]);
  assert.deepStrictEqual(sent, []);
});

test("an asynchronous Stop declaration degrades to noop", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha", true)]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("a false if predicate skips a Stop declaration", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  const entry: RoutingEntry = {
    ...stopEntry("alpha"),
    ifPredicate: { kind: "mcp-literal", toolName: "mcp__server__tool" },
  };
  runtime.setRoutingBucket("Stop", [entry]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

test("a reload during awaited Stop work discards every stale effect", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let resolveStaleOutcome: ((result: HookExecResult) => void) | undefined;
  const staleExecutor: HookExecutor = () => {
    return new Promise((resolve) => {
      resolveStaleOutcome = resolve;
    });
  };

  const liveEvents: unknown[] = [];
  const liveExecutor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    liveEvents.push(event);
    return Promise.resolve({ kind: "block", reason: "fresh" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();
  const generation = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, generation)(agentEnd("stop"));
  const staleSettle = settleHandlerFor(runtime, generation, pi, staleExecutor)(settledEvent, ctx);
  runtime.advanceGeneration();
  resetSettleState(runtime);
  resolveStaleOutcome?.({ kind: "block", reason: "stale" });
  await staleSettle;

  // assert
  assert.strictEqual(sent.length, 0);
  assert.deepStrictEqual(notified, []);
  assert.strictEqual(runtime.isStopHookActive(), false);

  // act
  await runStop(runtime, pi, ctx, liveExecutor);

  // assert
  assert.deepStrictEqual(liveEvents, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(
    sent.map((call) => call.message.content),
    ["fresh"],
  );
});

test("the eighth consecutive block is suppressed and warns only once", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 9; index += 1) {
    await runStop(runtime, pi, ctx, executor);
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

test("block and additional-context re-entries share one cap", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let invocation = 0;
  const executor: HookExecutor = (): Promise<HookExecResult> => {
    const outcome: HookExecResult =
      invocation % 2 === 0
        ? { kind: "block", reason: "continue" }
        : { kind: "mutate", additionalContext: "more context" };
    invocation += 1;
    return Promise.resolve(outcome);
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 8; index += 1) {
    await runStop(runtime, pi, ctx, executor);
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

test("a noop resets the cap and rearms its notification", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let mode: "block" | "noop" = "block";
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve(mode === "block" ? { kind: "block", reason: "continue" } : { kind: "noop" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  for (let index = 0; index < 7; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  mode = "noop";
  await runStop(runtime, pi, ctx, executor);
  mode = "block";
  for (let index = 0; index < 8; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  // assert
  assert.strictEqual(sent.length, 14);
  assert.strictEqual(notified.length, 1);
});

test("a stop resets the cap but leaves the next payload active", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let mode: "block" | "stop" = "block";
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve(
      mode === "block" ? { kind: "block", reason: "continue" } : { kind: "stop" },
    );
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  await runStop(runtime, pi, ctx, executor);
  mode = "stop";
  await runStop(runtime, pi, ctx, executor);
  mode = "block";
  for (let index = 0; index < 8; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  // assert
  assert.strictEqual(flags[2], true);
  assert.strictEqual(sent.length, 8);
  assert.strictEqual(notified.length, 1);
});

test("a live input clears active state and resets the cap", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();
  const epoch = runtime.currentGeneration();

  // act
  await runStop(runtime, pi, ctx, executor);
  await runStop(runtime, pi, ctx, executor);
  inputResetHandlerFor(runtime, epoch)();
  for (let index = 0; index < 8; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  // assert
  assert.deepStrictEqual(flags.slice(0, 3), [false, true, false]);
  assert.strictEqual(sent.length, 9);
  assert.strictEqual(notified.length, 1);
});

test("a stale input handler cannot clear live active state", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const staleHandler = inputResetHandlerFor(runtime, runtime.currentGeneration());

  // act
  await runStop(runtime, pi, emptyContext, executor);
  runtime.advanceGeneration();
  staleHandler();
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, true]);
  assert.strictEqual(sent.length, 2);
});

test("resetting settle state clears cached and active session data", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  await runStop(runtime, pi, emptyContext, executor);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  resetSettleState(runtime);
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, false]);
  assert.strictEqual(sent.length, 2);
});

test("a send failure is contained and a later input starts a clean run", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const failingPi = makePi(new Error("host refused")).pi;
  const healthy = makePi();
  const epoch = runtime.currentGeneration();
  let settleError: unknown;

  // act
  try {
    await runStop(runtime, failingPi, emptyContext, executor);
  } catch (error) {
    settleError = error;
  }

  await settleHandlerFor(runtime, epoch, healthy.pi, executor)(settledEvent, emptyContext);
  inputResetHandlerFor(runtime, epoch)();
  await runStop(runtime, healthy.pi, emptyContext, executor);

  // assert
  assert.strictEqual(settleError, undefined);
  assert.deepStrictEqual(
    healthy.sent.map((call) => call.message["content"]),
    ["continue"],
  );
});

test("an executor rejection consumes its ending and permits a fresh ending", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executorError = new Error("executor failed");
  const rejecting: HookExecutor = (): Promise<HookExecResult> => Promise.reject(executorError);
  const events: unknown[] = [];
  const healthy: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  let rejectedWith: unknown;

  // act
  try {
    await settleHandlerFor(runtime, epoch, pi, rejecting)(settledEvent, emptyContext);
  } catch (error) {
    rejectedWith = error;
  }

  await settleHandlerFor(runtime, epoch, pi, healthy)(settledEvent, emptyContext);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  await settleHandlerFor(runtime, epoch, pi, healthy)(settledEvent, emptyContext);

  // assert
  assert.strictEqual(rejectedWith, executorError);
  assert.deepStrictEqual(events, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(sent, []);
});

test("an error ending reaches matching failure observers with its payload", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const observed: Array<{ pluginId: string; event: unknown }> = [];
  const executor: HookExecutor = (entry, event): Promise<HookExecResult> => {
    observed.push({ pluginId: entry.pluginId, event });
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("StopFailure", [
    failureEntry("all"),
    failureEntry("star", "*"),
    failureEntry("exact", "rate_limit"),
    failureEntry("other", "billing_error"),
  ]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "Rate limit exceeded (429)"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

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

test("a reload during awaited StopFailure work discards the stale continuation", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let release: (result: HookExecResult) => void = () => {
    assert.fail("StopFailure executor was not started");
  };

  const outcome = new Promise<HookExecResult>((resolve) => {
    release = resolve;
  });
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event) => {
    events.push(event);
    return outcome;
  };

  runtime.setRoutingBucket("StopFailure", [failureEntry("observer")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();
  const generation = runtime.currentGeneration();
  agentEndCacheHandler(runtime, generation)(failureEnd("error", "provider failed"));

  // act
  const staleSettle = settleHandlerFor(runtime, generation, pi, executor)(settledEvent, ctx);
  runtime.advanceGeneration();
  resetSettleState(runtime);
  release({ kind: "noop" });
  await staleSettle;

  // assert
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, []);
  assert.strictEqual(runtime.isStopHookActive(), false);
  assert.deepStrictEqual(events, [{ error: "unknown", last_assistant_message: "provider failed" }]);
});

test("a length ending reports max-output classification without re-entry", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "block", reason: "ignored" });
  };

  runtime.setRoutingBucket("StopFailure", [failureEntry("observer")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("length", "provider text"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { error: "max_output_tokens", last_assistant_message: "provider text" },
  ]);
  assert.deepStrictEqual(sent, []);
});

test("a failure without text reports unknown with an empty message", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const events: unknown[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("StopFailure", [failureEntry("observer")]);
  const { pi } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [{ error: "unknown", last_assistant_message: "" }]);
});

test("all failure outcomes run in order and are then discarded", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
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

  runtime.setRoutingBucket("StopFailure", [
    failureEntry("noop"),
    failureEntry("block"),
    failureEntry("mutate"),
    failureEntry("stop"),
  ]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "provider failed"));
  await settleHandlerFor(runtime, epoch, pi, failureExecutor)(settledEvent, emptyContext);
  runtime.setRoutingBucket("Stop", [stopEntry("fresh")]);
  await runStop(runtime, pi, emptyContext, stopExecutor);

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

test("an empty failure bucket has no public effect", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "ignored" });
  };

  runtime.setRoutingBucket("StopFailure", []);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "provider failed"));
  await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});
