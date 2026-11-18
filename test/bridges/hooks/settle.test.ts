import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { type RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import {
  agentEndCacheHandler,
  beforeSettleHandlerFor,
  inputResetHandlerFor,
  resetSettleState,
  settleHandlerFor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/settle.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";

import type { HookExecutor } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { StopReason } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  AgentBeforeSettleEvent,
  AgentBeforeSettleEventResult,
  AgentEndEvent,
  AgentSettledEvent,
  AssistantMessage,
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const settledEvent = { type: "agent_settled" } as unknown as AgentSettledEvent;
// An entry another extension proposed at the same boundary, which the Stop
// continuation keeps ahead of its own (D-PG5-05).
const proposedEntry = { type: "custom", customType: "other-extension", data: { kept: true } };
const boundaryEvent = {
  type: "agent_before_settle",
  entries: [proposedEntry],
  continue: false,
  outcome: "completed",
} as unknown as AgentBeforeSettleEvent;
const emptyContext = { mode: "print" } as unknown as ExtensionContext;

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
    getAllTools: () => [],
    getCommands: () => [],
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
    mode: "tui",
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
    options: resolveOptions(undefined),
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

/** The content of a Stop continuation: one `Stop hook feedback:` part per text (D-CF5-25). */
function feedbackContent(...texts: readonly string[]): unknown[] {
  return texts.map((text) => ({ type: "text", text: `Stop hook feedback:\n${text}` }));
}

/**
 * The boundary result of a Stop continuation: the proposed entries, then one
 * hidden feedback entry, with `continue: true` (D-PG5-01).
 */
function continuation(pluginId: string, ...texts: readonly string[]): unknown {
  return {
    entries: [
      proposedEntry,
      {
        type: "custom_message",
        customType: "claude-hook-stop-block",
        content: feedbackContent(...texts),
        display: false,
        details: { pluginId },
      },
    ],
    continue: true,
  };
}

/** Runs the boundary handler after an `agent_end` that ended with `stop`. */
async function runStop(
  runtime: HooksRuntime,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  executor: HookExecutor,
): Promise<AgentBeforeSettleEventResult | undefined> {
  const generation = runtime.currentGeneration();
  agentEndCacheHandler(runtime, generation)(agentEnd("stop"));
  return beforeSettleHandlerFor(runtime, generation, pi, executor)(boundaryEvent, ctx);
}

/** Runs `count` Stop boundaries in a row and returns what each resolved to. */
async function runStops(
  count: number,
  runtime: HooksRuntime,
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  executor: HookExecutor,
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (let index = 0; index < count; index += 1) {
    results.push(await runStop(runtime, pi, ctx, executor));
  }

  return results;
}

for (const scenario of [
  { name: "json", mode: "json", failure: "none", emits: true },
  { name: "rpc", mode: "rpc", failure: "none", emits: true },
  { name: "append refusal", mode: "json", failure: "append", emits: true },
  { name: "stale sink", mode: "rpc", failure: "sink", emits: false },
  { name: "stale emission mode", mode: "json", failure: "mode", emits: false },
]) {
  test(`retains the shared Stop cap after ${scenario.name}`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const capture = createJsonCapture();
    const host = makePi();
    const inventory = t.mock.fn(() => []);
    let sinkReads = 0;
    const pi = {
      ...host.pi,
      getAllTools: inventory,
      get appendEntry(): ExtensionAPI["appendEntry"] {
        sinkReads += 1;
        if (scenario.failure === "sink") {
          throw new Error("stale host");
        }

        return (customType, payload) => {
          capture.entrySink.appendEntry(customType, payload);
          if (scenario.failure === "append") {
            throw new Error("entry unavailable before bind");
          }
        };
      },
    };
    let modeReads = 0;
    const ctx = {
      get mode(): string {
        modeReads += 1;
        if (scenario.failure === "mode" && modeReads === 10) {
          throw new Error("stale emission context");
        }

        return scenario.mode;
      },
      get ui() {
        return capture.ui;
      },
    } as unknown as ExtensionContext;
    const flags: boolean[] = [];
    const executor: HookExecutor = (_entry, event) => {
      flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
      return Promise.resolve(
        flags.length % 2 === 0
          ? { kind: "mutate", additionalContext: "more context" }
          : { kind: "block", reason: "continue" },
      );
    };

    runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);

    // act
    const results = await runStops(9, runtime, pi, ctx, executor);
    await settleHandlerFor(runtime, runtime.currentGeneration(), pi, executor)(settledEvent, ctx);

    // assert
    assert.deepStrictEqual(results, [
      ...[
        "continue",
        "more context",
        "continue",
        "more context",
        "continue",
        "more context",
        "continue",
        "more context",
      ].map((text) => continuation("alpha", text)),
      undefined,
    ]);
    assert.deepStrictEqual(host.sent, []);
    assert.strictEqual(runtime.isStopHookActive(), true);
    assert.deepStrictEqual(runtime.recordStopReentry(), { reenter: false, notifyCap: false });
    assert.deepStrictEqual(
      capture.entries,
      scenario.emits
        ? [
            {
              customType: "claude-plugin",
              payload: {
                schemaVersion: 1,
                origin: { kind: "hook" },
                kind: "stop-override-cap",
                severity: "warning",
                needsReload: false,
                pluginId: "alpha",
                cap: 8,
              },
            },
          ]
        : [],
    );
    assert.deepStrictEqual(flags, [false, true, true, true, true, true, true, true, true]);
    assert.strictEqual(modeReads, 11);
    assert.strictEqual(sinkReads, scenario.failure === "mode" ? 0 : 1);
    assert.strictEqual(inventory.mock.callCount(), 27);
    capture.assertValid();
  });
}

for (const scenario of [
  { name: "unsupported initial mode", stale: false },
  { name: "stale initial mode", stale: true },
]) {
  test(`suppresses fresh Stop work for ${scenario.name}`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
    const capture = createJsonCapture();
    const host = makePi();
    const inventory = t.mock.fn(() => []);
    const pi = { ...host.pi, getAllTools: inventory, appendEntry: capture.entrySink.appendEntry };
    const ctx = {
      get mode(): string {
        if (scenario.stale) {
          throw new Error("stale mode");
        }

        return "unknown";
      },
      get ui() {
        return capture.ui;
      },
    } as unknown as ExtensionContext;
    const executor = t.mock.fn<HookExecutor>(() =>
      Promise.resolve({ kind: "block", reason: "continue" }),
    );

    // act
    const stopResult = await runStop(runtime, pi, ctx, executor);
    agentEndCacheHandler(runtime, runtime.currentGeneration())(failureEnd("error", "failure"));
    await settleHandlerFor(runtime, runtime.currentGeneration(), pi, executor)(settledEvent, ctx);

    // assert
    assert.strictEqual(stopResult, undefined);
    assert.strictEqual(runtime.isStopHookActive(), false);
    assert.deepStrictEqual(host.sent, []);
    assert.deepStrictEqual(capture.entries, []);
    assert.strictEqual(executor.mock.callCount(), 0);
    assert.strictEqual(inventory.mock.callCount(), 0);
    capture.assertValid();
  });
}

for (const stopReason of [
  "stop",
  "error",
  "length",
  "pending",
  "aborted",
  "toolUse",
  "deferred",
] as const) {
  for (const { failure, readMode } of [
    { failure: "unknown mode", readMode: (): string => "unknown" },
    {
      failure: "throwing mode getter",
      readMode: (): string => {
        throw new Error("stale mode");
      },
    },
  ]) {
    test(`preserves the ${stopReason} assistant cache on ${failure}`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      const { pi, sent } = makePi();
      const ending = agentEnd(stopReason);
      const assistant = ending.messages[1];
      assert.ok(assistant?.role === "assistant");
      runtime.recordLastAssistant(assistant);
      const context = new Proxy(emptyContext, {
        get(target, property, receiver): unknown {
          if (property === "mode") {
            return readMode();
          }

          return Reflect.get(target, property, receiver);
        },
      });
      const handler = settleHandlerFor(runtime, runtime.currentGeneration(), pi);

      // act
      await handler(settledEvent, context);

      // assert
      assert.strictEqual(runtime.takeLastAssistant(), assistant);
      assert.deepStrictEqual(sent, []);
    });
  }
}

for (const { failure, readMode } of [
  { failure: "unknown mode", readMode: (): string => "unknown" },
  {
    failure: "throwing mode getter",
    readMode: (): string => {
      throw new Error("stale mode");
    },
  },
]) {
  test(`the boundary keeps a stop ending cached and runs no hook on ${failure}`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
    const { pi, sent } = makePi();
    const ending = agentEnd("stop");
    const assistant = ending.messages[1];
    assert.ok(assistant?.role === "assistant");
    runtime.recordLastAssistant(assistant);
    const context = new Proxy(emptyContext, {
      get(target, property, receiver): unknown {
        if (property === "mode") {
          return readMode();
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const executor = t.mock.fn<HookExecutor>(() =>
      Promise.resolve({ kind: "block", reason: "continue" }),
    );
    const handler = beforeSettleHandlerFor(runtime, runtime.currentGeneration(), pi, executor);

    // act
    const boundaryResult = await handler(boundaryEvent, context);

    // assert
    assert.strictEqual(boundaryResult, undefined);
    assert.strictEqual(runtime.takeLastAssistant(), assistant);
    assert.strictEqual(executor.mock.callCount(), 0);
    assert.deepStrictEqual(sent, []);
  });
}

for (const stopReason of ["length", "error"] as const) {
  test(`the boundary leaves a ${stopReason} ending cached for StopFailure and runs no Stop hook (D-PG5-03)`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
    const { pi, sent } = makePi();
    const ending = failureEnd(stopReason);
    const assistant = ending.messages[1];
    assert.ok(assistant?.role === "assistant");
    const executor = t.mock.fn<HookExecutor>(() =>
      Promise.resolve({ kind: "block", reason: "continue" }),
    );
    const generation = runtime.currentGeneration();
    agentEndCacheHandler(runtime, generation)(ending);

    // act
    const boundaryResult = await beforeSettleHandlerFor(
      runtime,
      generation,
      pi,
      executor,
    )(boundaryEvent, emptyContext);

    // assert
    assert.strictEqual(boundaryResult, undefined);
    assert.strictEqual(executor.mock.callCount(), 0);
    assert.strictEqual(runtime.takeLastAssistant(), assistant);
    assert.deepStrictEqual(sent, []);
  });
}

test("uses only the supplied runtime for Stop continuation", async () => {
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
  const handler = beforeSettleHandlerFor(owningRuntime, generation, pi, executor);
  const boundaryResult = await handler(boundaryEvent, emptyContext);

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("owner", "continue"));
  assert.deepStrictEqual(sent, []);
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
  const boundary = (generation: number): Promise<AgentBeforeSettleEventResult | undefined> =>
    beforeSettleHandlerFor(runtime, generation, pi, executor)(boundaryEvent, emptyContext);
  const results: unknown[] = [];
  results.push(await boundary(epoch));
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  results.push(await boundary(epoch));
  results.push(await boundary(epoch));
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  results.push(await boundary(epoch));
  const staleEpoch = runtime.currentGeneration();
  runtime.advanceGeneration();
  agentEndCacheHandler(runtime, staleEpoch)(agentEnd("stop"));
  results.push(await boundary(staleEpoch));
  results.push(await boundary(runtime.currentGeneration()));

  // assert
  assert.deepStrictEqual(events, [
    { last_assistant_message: "done", stop_hook_active: false },
    { last_assistant_message: "done", stop_hook_active: true },
  ]);
  assert.deepStrictEqual(results, [
    undefined,
    continuation("alpha", "continue"),
    undefined,
    continuation("alpha", "continue"),
    undefined,
    undefined,
  ]);
  assert.deepStrictEqual(sent, []);
});

test("an agent end drops the mark of every tool call (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.recordToolCallPrepared("a", undefined, 100);
  runtime.recordToolCallPrepared("b", undefined, 110);

  // act
  agentEndCacheHandler(runtime, runtime.currentGeneration())(agentEnd("stop"));

  // assert
  assert.deepStrictEqual(
    [runtime.takeToolDuration("a", 200), runtime.takeToolDuration("b", 200)],
    [undefined, undefined],
  );
});

test("a stale agent end keeps the tool call marks (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const stale = runtime.currentGeneration();
  runtime.advanceGeneration();
  runtime.recordToolCallPrepared("a", undefined, 100);

  // act
  agentEndCacheHandler(runtime, stale)(agentEnd("stop"));

  // assert
  assert.strictEqual(runtime.takeToolDuration("a", 200), 100);
});

test("the last agent ending wins before the boundary", async () => {
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
  const boundaryResult = await beforeSettleHandlerFor(
    runtime,
    epoch,
    pi,
    executor,
  )(boundaryEvent, emptyContext);

  // assert
  assert.strictEqual(boundaryResult, undefined);
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
  const boundaryResult = await beforeSettleHandlerFor(
    runtime,
    epoch,
    pi,
    executor,
  )(boundaryEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(sent, []);
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
  await beforeSettleHandlerFor(runtime, epoch, pi, executor)(boundaryEvent, emptyContext);

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
  await beforeSettleHandlerFor(runtime, epoch, pi, executor)(boundaryEvent, emptyContext);

  // assert
  assert.deepStrictEqual(events, [
    { last_assistant_message: "first second", stop_hook_active: false },
  ]);
});

for (const stopReason of ["pending", "aborted", "toolUse", "deferred"] as const) {
  test(`${stopReason} endings dispatch no Stop or StopFailure bucket`, async () => {
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
    const boundaryResult = await beforeSettleHandlerFor(
      runtime,
      epoch,
      pi,
      executor,
    )(boundaryEvent, emptyContext);
    await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

    // assert
    assert.strictEqual(boundaryResult, undefined);
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

  // act
  const settling = settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

  // assert
  await assert.doesNotReject(settling);
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
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(sent, []);
});

// Runs `runtime`'s handler for each step of a turn ending in order, and
// returns which hooks fired and what each boundary resolved to.
async function driveEnding(
  steps: readonly ("boundary" | "settle")[],
  ending: AgentEndEvent | undefined,
): Promise<{ readonly fired: string[]; readonly boundaries: unknown[] }> {
  const runtime = createHooksRuntime();
  runtime.setRoutingBucket("Stop", [stopEntry("stop")]);
  runtime.setRoutingBucket("StopFailure", [failureEntry("failure")]);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "block", reason: "continue" });
  };

  const { pi } = makePi();
  const epoch = runtime.currentGeneration();
  if (ending !== undefined) {
    agentEndCacheHandler(runtime, epoch)(ending);
  }

  const boundaries: unknown[] = [];
  for (const step of steps) {
    if (step === "boundary") {
      boundaries.push(
        await beforeSettleHandlerFor(runtime, epoch, pi, executor)(boundaryEvent, emptyContext),
      );
    } else {
      await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);
    }
  }

  return { fired, boundaries };
}

test("settle runs no hook for a stop ending that the boundary took (D-PG5-03)", async () => {
  // act
  const { fired, boundaries } = await driveEnding(["boundary", "settle"], agentEnd("stop"));

  // assert
  assert.deepStrictEqual(fired, ["stop"]);
  assert.deepStrictEqual(boundaries, [continuation("stop", "continue")]);
});

test("settle runs no hook for a stop ending whose boundary Pi skipped, and drops it (D-PG5-03)", async () => {
  // act
  const { fired, boundaries } = await driveEnding(["settle", "boundary"], agentEnd("stop"));

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(boundaries, [undefined]);
});

for (const stopReason of ["length", "error"] as const) {
  test(`a ${stopReason} ending runs StopFailure once at settle after the boundary (D-PG5-03)`, async () => {
    // act
    const { fired, boundaries } = await driveEnding(
      ["boundary", "settle", "settle"],
      failureEnd(stopReason),
    );

    // assert
    assert.deepStrictEqual(fired, ["failure"]);
    assert.deepStrictEqual(boundaries, [undefined]);
  });
}

test("a stale settle handler runs no StopFailure hook and leaves the cached ending", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.setRoutingBucket("StopFailure", [failureEntry("failure")]);
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  const { pi } = makePi();
  const staleEpoch = runtime.currentGeneration();
  const ending = failureEnd("error");
  agentEndCacheHandler(runtime, staleEpoch)(ending);
  runtime.advanceGeneration();

  // act
  await settleHandlerFor(runtime, staleEpoch, pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.strictEqual(runtime.takeLastAssistant(), ending.messages[1]);
});

test("a second settle with no agent end runs nothing", async () => {
  // act
  const { fired, boundaries } = await driveEnding(["settle", "boundary", "settle"], undefined);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.deepStrictEqual(boundaries, [undefined]);
});

test("a wake sent while the Stop hooks run makes the next Stop run active (D-BG-210 / D-PG5-06)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    runtime.recordRewakeSent();
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  const results = await runStops(2, runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, true]);
  assert.deepStrictEqual(results, [undefined, undefined]);
  assert.deepStrictEqual(sent, []);
});

test("a wake sent after the Stop hooks finished leaves the next Stop run inactive (D-PG5-06)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const flags: boolean[] = [];
  const executor: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    flags.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);
  runtime.recordRewakeSent();
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, false]);
});

test("a block continues the run with its reason as stop hook feedback (STOP-03 / D-CF5-25)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("alpha", "continue"));
  assert.deepStrictEqual(sent, []);
});

test("a reasonless block continues the run with an empty feedback reason", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "block" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("alpha", ""));
  assert.deepStrictEqual(sent, []);
});

test("sends every reason and context back in one continuation in routing order whatever order the hooks finish in (D-CF5-25)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const pending = new Map<string, (result: HookExecResult) => void>();
  const executor: HookExecutor = (entry) =>
    new Promise((resolve) => {
      pending.set(entry.pluginId, resolve);
    });
  runtime.setRoutingBucket("Stop", [
    stopEntry("first"),
    stopEntry("quiet"),
    stopEntry("advisor"),
    stopEntry("last"),
  ]);
  const { pi, sent } = makePi();

  // act
  const settling = runStop(runtime, pi, emptyContext, executor);
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  pending.get("last")?.({ kind: "block", reason: "r2", additionalContext: "c2" });
  pending.get("advisor")?.({ kind: "mutate", additionalContext: "c" });
  pending.get("quiet")?.({ kind: "mutate", additionalContext: "" });
  pending.get("first")?.({ kind: "block", reason: "r1" });
  const boundaryResult = await settling;

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("first", "r1", "c", "r2", "c2"));
  assert.deepStrictEqual(sent, []);
});

test("counts a continuation that carries several hooks' feedback once toward the cap (STOP-07)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (entry): Promise<HookExecResult> =>
    Promise.resolve(
      entry.pluginId === "advisor"
        ? { kind: "mutate", additionalContext: "c" }
        : { kind: "block", reason: entry.pluginId },
    );
  runtime.setRoutingBucket("Stop", [stopEntry("alpha"), stopEntry("advisor"), stopEntry("beta")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  const results = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(results, [
    ...Array.from({ length: 8 }, () => continuation("alpha", "alpha", "c", "beta")),
    undefined,
  ]);
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, [
    {
      text: "Stop hook override cap reached.\n\n`alpha`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      severity: "warning",
    },
  ]);
});

test("a stop suppresses the continuation of every other hook's reason and context (STOP-06 / D-PG5-05)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (entry): Promise<HookExecResult> =>
    Promise.resolve(
      entry.pluginId === "stopper"
        ? { kind: "stop" }
        : { kind: "block", reason: "continue", additionalContext: "c" },
    );
  runtime.setRoutingBucket("Stop", [stopEntry("blocker"), stopEntry("stopper")]);
  const { pi, sent } = makePi();

  // act
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(sent, []);
});

test("hooks that neither block nor add context send nothing and reset the cap (HOOK-05 / D-88-08)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  let quiet = false;
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    if (!quiet) {
      return Promise.resolve({ kind: "block", reason: "continue" });
    }

    return Promise.resolve(
      entry.pluginId === "alpha" ? { kind: "noop" } : { kind: "mutate", additionalContext: "" },
    );
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha"), stopEntry("beta")]);
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();

  // act
  const blocked = await runStops(7, runtime, pi, ctx, executor);
  quiet = true;
  const quietResult = await runStop(runtime, pi, ctx, executor);
  quiet = false;
  const afterQuiet = await runStops(2, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(
    [...blocked, quietResult, ...afterQuiet],
    [
      ...Array.from({ length: 7 }, () => continuation("alpha", "continue", "continue")),
      undefined,
      continuation("alpha", "continue", "continue"),
      continuation("alpha", "continue", "continue"),
    ],
  );
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, []);
});

test("additional context continues the run through the block lane", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "mutate", additionalContext: "more context" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("alpha", "more context"));
  assert.deepStrictEqual(sent, []);
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
  const boundaryResult = await runStop(runtime, pi, ctx, executor);

  // assert
  assert.strictEqual(boundaryResult, undefined);
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
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["blocker", "stopper"]);
  assert.strictEqual(boundaryResult, undefined);
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
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["stopper", "blocker"]);
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(sent, []);
});

test("an asynchronous Stop declaration runs through the background noop of the executor", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const fired: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha", true)]);
  const { pi, sent } = makePi();

  // act
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, ["alpha"]);
  assert.strictEqual(boundaryResult, undefined);
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
  const boundaryResult = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(fired, []);
  assert.strictEqual(boundaryResult, undefined);
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
  const staleBoundary = beforeSettleHandlerFor(
    runtime,
    generation,
    pi,
    staleExecutor,
  )(boundaryEvent, ctx);
  runtime.advanceGeneration();
  resetSettleState(runtime);
  resolveStaleOutcome?.({ kind: "block", reason: "stale" });
  const staleResult = await staleBoundary;

  // assert
  assert.strictEqual(staleResult, undefined);
  assert.deepStrictEqual(notified, []);
  assert.strictEqual(runtime.isStopHookActive(), false);

  // act
  const liveResult = await runStop(runtime, pi, ctx, liveExecutor);

  // assert
  assert.deepStrictEqual(liveEvents, [{ last_assistant_message: "done", stop_hook_active: false }]);
  assert.deepStrictEqual(liveResult, continuation("alpha", "fresh"));
  assert.deepStrictEqual(sent, []);
});

test("a pending old-generation Stop completion cannot consume a reloaded budget", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  let resolveOldHook: ((result: HookExecResult) => void) | undefined;
  const executor: HookExecutor = () =>
    new Promise((resolve) => {
      resolveOldHook = resolve;
    });
  const { pi, sent } = makePi();
  const { ctx, notified } = makeContext();
  const oldGeneration = runtime.currentGeneration();
  agentEndCacheHandler(runtime, oldGeneration)(agentEnd("stop"));
  const pending = beforeSettleHandlerFor(runtime, oldGeneration, pi, executor)(boundaryEvent, ctx);

  // act
  runtime.advanceGeneration();
  resetSettleState(runtime);
  const freshEight = Array.from({ length: 8 }, () => runtime.recordStopReentry());
  resolveOldHook?.({ kind: "block", reason: "stale" });
  const staleResult = await pending;
  const ninth = runtime.recordStopReentry();

  // assert
  assert.deepStrictEqual(
    freshEight,
    Array.from({ length: 8 }, () => ({ reenter: true, notifyCap: false })),
  );
  assert.deepStrictEqual(ninth, { reenter: false, notifyCap: true });
  assert.strictEqual(staleResult, undefined);
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, []);
});

test("the ninth consecutive block is suppressed and warns only once", async () => {
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
  const results = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(flags, [false, true, true, true, true, true, true, true, true]);
  assert.deepStrictEqual(results, [
    ...Array.from({ length: 8 }, () => continuation("alpha", "continue")),
    undefined,
  ]);
  assert.deepStrictEqual(sent, []);
  assert.deepStrictEqual(notified, [
    {
      text: "Stop hook override cap reached.\n\n`alpha`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      severity: "warning",
    },
  ]);
});

test("block and additional-context continuations share one cap", async () => {
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
  const results = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(results, [
    ...[
      "continue",
      "more context",
      "continue",
      "more context",
      "continue",
      "more context",
      "continue",
      "more context",
    ].map((text) => continuation("alpha", text)),
    undefined,
  ]);
  assert.deepStrictEqual(sent, []);
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
  const before = await runStops(7, runtime, pi, ctx, executor);
  mode = "noop";
  const quietResult = await runStop(runtime, pi, ctx, executor);
  mode = "block";
  const after = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(
    [...before, quietResult, ...after],
    [
      ...Array.from({ length: 7 }, () => continuation("alpha", "continue")),
      undefined,
      ...Array.from({ length: 8 }, () => continuation("alpha", "continue")),
      undefined,
    ],
  );
  assert.deepStrictEqual(sent, []);
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
  const first = await runStop(runtime, pi, ctx, executor);
  mode = "stop";
  const stopped = await runStop(runtime, pi, ctx, executor);
  mode = "block";
  const after = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.strictEqual(flags[2], true);
  assert.deepStrictEqual(
    [first, stopped, ...after],
    [
      continuation("alpha", "continue"),
      undefined,
      ...Array.from({ length: 8 }, () => continuation("alpha", "continue")),
      undefined,
    ],
  );
  assert.deepStrictEqual(sent, []);
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
  const before = await runStops(2, runtime, pi, ctx, executor);
  inputResetHandlerFor(runtime, epoch)();
  const after = await runStops(9, runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(flags.slice(0, 3), [false, true, false]);
  assert.deepStrictEqual(
    [...before, ...after],
    [...Array.from({ length: 10 }, () => continuation("alpha", "continue")), undefined],
  );
  assert.deepStrictEqual(sent, []);
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
  const first = await runStop(runtime, pi, emptyContext, executor);
  runtime.advanceGeneration();
  staleHandler();
  const second = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, true]);
  assert.deepStrictEqual(
    [first, second],
    [continuation("alpha", "continue"), continuation("alpha", "continue")],
  );
  assert.deepStrictEqual(sent, []);
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
  const first = await runStop(runtime, pi, emptyContext, executor);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  resetSettleState(runtime);
  const afterReset = await beforeSettleHandlerFor(
    runtime,
    epoch,
    pi,
    executor,
  )(boundaryEvent, emptyContext);
  const fresh = await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(flags, [false, false]);
  assert.deepStrictEqual(
    [first, afterReset, fresh],
    [continuation("alpha", "continue"), undefined, continuation("alpha", "continue")],
  );
  assert.deepStrictEqual(sent, []);
});

test("a Stop continuation sends no message through Pi (D-PG5-01)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const refusing = makePi(new Error("host refused"));

  // act
  const boundaryResult = await runStop(runtime, refusing.pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(boundaryResult, continuation("alpha", "continue"));
  assert.deepStrictEqual(refusing.sent, []);
});

test("an executor rejection resolves to nothing, closes the stop boundary, and permits a fresh ending", async (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const rejecting: HookExecutor = (): Promise<HookExecResult> =>
    Promise.reject(new Error("executor failed"));
  const events: unknown[] = [];
  const healthy: HookExecutor = (_entry, event): Promise<HookExecResult> => {
    events.push(event);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  const epoch = runtime.currentGeneration();
  const boundary = (executor: HookExecutor): Promise<AgentBeforeSettleEventResult | undefined> =>
    beforeSettleHandlerFor(runtime, epoch, pi, executor)(boundaryEvent, emptyContext);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));

  // act
  const rejected = await boundary(rejecting);
  runtime.recordRewakeSent();
  const consumed = await boundary(healthy);
  agentEndCacheHandler(runtime, epoch)(agentEnd("stop"));
  const fresh = await boundary(healthy);

  // assert
  assert.deepStrictEqual([rejected, consumed, fresh], [undefined, undefined, undefined]);
  assert.deepStrictEqual(debugLines(), ["[hooks] settle: Stop boundary failed: executor failed"]);
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

test("an error ending reaches the failure observers whose matcher lists its type (D-BG-302)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const observed: string[] = [];
  const executor: HookExecutor = (entry): Promise<HookExecResult> => {
    observed.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  runtime.setRoutingBucket("StopFailure", [
    failureEntry("listed", "overloaded|rate_limit"),
    failureEntry("unlisted", "overloaded|billing_error"),
  ]);
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "Rate limit exceeded (429)"));
  await settleHandlerFor(runtime, epoch, makePi().pi, executor)(settledEvent, emptyContext);

  // assert
  assert.deepStrictEqual(observed, ["listed"]);
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

test("a length ending reports max-output classification without a continuation", async () => {
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

for (const { title, ending, expectedEvent } of [
  {
    title: "a failure without text reports unknown and leaves the assistant message out",
    ending: failureEnd("error"),
    expectedEvent: { error: "unknown" },
  },
  {
    title: "a length ending without text reports max-output and leaves the assistant message out",
    ending: failureEnd("length"),
    expectedEvent: { error: "max_output_tokens" },
  },
  {
    title: "error text of only whitespace leaves the assistant message out",
    ending: failureEnd("error", " \n\t "),
    expectedEvent: { error: "unknown" },
  },
  {
    title: "error text reaches the failure observers trimmed",
    ending: failureEnd("error", "  Rate limit exceeded (429)\n"),
    expectedEvent: { error: "rate_limit", last_assistant_message: "Rate limit exceeded (429)" },
  },
]) {
  test(`${title} (D-BG-303)`, async () => {
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
    agentEndCacheHandler(runtime, epoch)(ending);
    await settleHandlerFor(runtime, epoch, pi, executor)(settledEvent, emptyContext);

    // assert
    assert.deepStrictEqual(events, [expectedEvent]);
  });
}

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
  const boundaryResult = await runStop(runtime, pi, emptyContext, stopExecutor);

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
  assert.deepStrictEqual(boundaryResult, continuation("fresh", "fresh"));
  assert.deepStrictEqual(sent, []);
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

/** Collects the OBS-01 debug lines a case emits, restoring the flag after. */
function observeHookDebug(t: TestContext): () => string[] {
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (diagnostic: unknown) => {
    diagnostics.push(String(diagnostic));
  });
  return () => [...diagnostics];
}

/** A JSON-mode context and Pi API that capture the notices and messages a settle sends. */
function makeNoticeHost(): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly sent: SendCall[];
  readonly capture: ReturnType<typeof createJsonCapture>;
} {
  const capture = createJsonCapture();
  const host = makePi();
  const pi = { ...host.pi, appendEntry: capture.entrySink.appendEntry };
  const ctx = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  } as unknown as ExtensionContext;
  return { ctx, pi, sent: host.sent, capture };
}

/** The `claude-plugin` entry of one hook notice. */
function hookNoticeEntry(text: string): Record<string, unknown> {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      origin: { kind: "hook" },
      kind: "hook-notice",
      severity: "info",
      needsReload: false,
      text,
    },
  };
}

test("shows each Stop hook's system message in routing order and never sends it to the model (D-CF5-14)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const pending = new Map<string, (result: HookExecResult) => void>();
  const executor: HookExecutor = (entry) =>
    new Promise((resolve) => {
      pending.set(entry.pluginId, resolve);
    });
  runtime.setRoutingBucket("Stop", [stopEntry("first"), stopEntry("quiet"), stopEntry("last")]);
  const host = makeNoticeHost();

  // act
  const settling = runStop(runtime, host.pi, host.ctx, executor);
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  pending.get("last")?.({ kind: "noop", systemMessage: "two" });
  pending.get("quiet")?.({ kind: "block", reason: "keep going", systemMessage: "" });
  pending.get("first")?.({ kind: "noop", systemMessage: "one" });
  const boundaryResult = await settling;

  // assert
  assert.deepStrictEqual(host.capture.entries, [
    hookNoticeEntry("Stop says: one"),
    hookNoticeEntry("Stop says: two"),
  ]);
  assert.deepStrictEqual(boundaryResult, continuation("quiet", "keep going"));
  assert.deepStrictEqual(host.sent, []);
  host.capture.assertValid();
});

test("shows a Stop system message when a stop suppresses the continuation (STOP-06 / D-CF5-14)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "stop", systemMessage: "halted" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const host = makeNoticeHost();

  // act
  const boundaryResult = await runStop(runtime, host.pi, host.ctx, executor);

  // assert
  assert.deepStrictEqual(host.capture.entries, [hookNoticeEntry("Stop says: halted")]);
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(host.sent, []);
});

test("debug-logs a Stop notice that fails to show and still continues the run", async (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "block", reason: "continue", systemMessage: "hi" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();
  // The print-mode context has no `ui`, so the notice cannot be shown.
  const ctx = {
    mode: "print",
    get ui(): never {
      throw new Error("no ui");
    },
  } as unknown as ExtensionContext;

  // act
  const boundaryResult = await runStop(runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(debugLines(), ["[hooks] settle: Stop notice failed: no ui"]);
  assert.deepStrictEqual(boundaryResult, continuation("alpha", "continue"));
  assert.deepStrictEqual(sent, []);
});

test("drops a StopFailure system message with a debug line (D-CF5-14)", async (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (entry): Promise<HookExecResult> =>
    Promise.resolve(
      entry.pluginId === "quiet"
        ? { kind: "noop", systemMessage: "" }
        : { kind: "noop", systemMessage: "failed loudly" },
    );
  runtime.setRoutingBucket("StopFailure", [
    failureEntry("loud"),
    failureEntry("quiet"),
    failureEntry("louder"),
  ]);
  const host = makeNoticeHost();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "provider failed"));
  await settleHandlerFor(runtime, epoch, host.pi, executor)(settledEvent, host.ctx);

  // assert
  assert.deepStrictEqual(host.capture.entries, []);
  assert.deepStrictEqual(host.sent, []);
  assert.deepStrictEqual(debugLines(), [
    '[hooks] settle: unrecognized StopFailure errorMessage: "provider failed"',
    "[hooks] settle: 2 systemMessage(s) dropped on StopFailure",
  ]);
});

const BOOM_FAILURE = { kind: "noop", failure: { kind: "exit", stderr: "boom" } } as const;
const MISSING_SCRIPT_STDERR =
  "python3: can't open file '/x/gone.py': [Errno 2] No such file or directory";
// The em dash (U+2014) of the missing-script notice, escaped because the
// fix-unicode-dashes hook rewrites a literal one.
const MISSING_SCRIPT_NOTICE = `Stop hook error: Hook script appears to be missing \u2014 "echo gone" exited 2 with: ${MISSING_SCRIPT_STDERR}. Treating as non-blocking. Run /claude:plugin reinstall gone@catalog --scope user to reinstall it.`;

// An executor that answers each Stop hook with its plugin's result.
function resultsExecutor(results: Readonly<Record<string, HookExecResult>>): HookExecutor {
  return (entry) => Promise.resolve(results[entry.pluginId] ?? { kind: "noop" });
}

for (const { name, results, notices, continued } of [
  {
    name: "shows a Stop hook's failed exit as a Stop hook error (D-PG5-10)",
    results: { failer: BOOM_FAILURE },
    notices: ["Stop hook error: Failed with non-blocking status code: boom"],
    continued: undefined,
  },
  {
    name: "shows a missing Stop script and asks for no continuation (D-PG5-08)",
    results: {
      gone: { kind: "noop", failure: { kind: "missing-script", stderr: MISSING_SCRIPT_STDERR } },
    },
    notices: [MISSING_SCRIPT_NOTICE],
    continued: undefined,
  },
  {
    name: "continues the run beside a missing Stop script that shows its notice (D-PG5-09)",
    results: {
      gone: { kind: "noop", failure: { kind: "missing-script", stderr: MISSING_SCRIPT_STDERR } },
      guard: { kind: "block", reason: "keep going" },
    },
    notices: [MISSING_SCRIPT_NOTICE],
    continued: continuation("guard", "keep going"),
  },
  {
    name: "shows the system messages, then the failure notices, then the stop line",
    results: {
      halt: { kind: "stop", stopReason: "done for today" },
      failer: BOOM_FAILURE,
      speaker: { kind: "noop", systemMessage: "said" },
    },
    notices: [
      "Stop says: said",
      "Stop hook error: Failed with non-blocking status code: boom",
      "Stop hook stopped continuation: done for today",
    ],
    continued: undefined,
  },
  {
    name: "shows the stop reason of the first stopping hook in routing order (D-PG5-13)",
    results: {
      first: { kind: "stop", stopReason: "done for today" },
      second: { kind: "stop", stopReason: "later" },
    },
    notices: ["Stop hook stopped continuation: done for today"],
    continued: undefined,
  },
  {
    name: "shows no stop line for a stop with no reason",
    results: { halt: { kind: "stop" } },
    notices: [],
    continued: undefined,
  },
  {
    name: "shows no stop line for a stop with an empty reason",
    results: { halt: { kind: "stop", stopReason: "" } },
    notices: [],
    continued: undefined,
  },
] satisfies ReadonlyArray<{
  readonly name: string;
  readonly results: Readonly<Record<string, HookExecResult>>;
  readonly notices: readonly string[];
  readonly continued: unknown;
}>) {
  test(name, async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "Stop",
      Object.keys(results).map((pluginId) => stopEntry(pluginId)),
    );
    const host = makeNoticeHost();
    const executor = resultsExecutor(results);

    // act
    const boundaryResult = await runStop(runtime, host.pi, host.ctx, executor);
    await settleHandlerFor(
      runtime,
      runtime.currentGeneration(),
      host.pi,
      executor,
    )(settledEvent, host.ctx);

    // assert
    assert.deepStrictEqual(
      host.capture.entries,
      notices.map((text) => hookNoticeEntry(text)),
    );
    assert.deepStrictEqual(boundaryResult, continued);
    assert.deepStrictEqual(host.sent, []);
    host.capture.assertValid();
  });
}

test("shows the stop line once the run settles, though an earlier boundary handler asked to continue (D-PG5-13)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("halt")]);
  const host = makeNoticeHost();
  const generation = runtime.currentGeneration();
  const executor = resultsExecutor({ halt: { kind: "stop", stopReason: "done for today" } });
  agentEndCacheHandler(runtime, generation)(agentEnd("stop"));
  const continuedEvent = { ...boundaryEvent, continue: true } as AgentBeforeSettleEvent;

  // act
  const boundaryResult = await beforeSettleHandlerFor(
    runtime,
    generation,
    host.pi,
    executor,
  )(continuedEvent, host.ctx);
  const noticesAtBoundary = [...host.capture.entries];
  const settle = settleHandlerFor(runtime, generation, host.pi, executor);
  await settle(settledEvent, host.ctx);
  await settle(settledEvent, host.ctx);

  // assert
  assert.deepStrictEqual(
    { boundaryResult, noticesAtBoundary, notices: host.capture.entries },
    {
      boundaryResult: undefined,
      noticesAtBoundary: [],
      notices: [hookNoticeEntry("Stop hook stopped continuation: done for today")],
    },
  );
});

test("drops the stop line when the run goes on past the boundary (D-PG5-13)", async (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("halt")]);
  const host = makeNoticeHost();
  const generation = runtime.currentGeneration();
  const executor = resultsExecutor({ halt: { kind: "stop", stopReason: "done for today" } });
  await runStop(runtime, host.pi, host.ctx, executor);

  // act
  agentEndCacheHandler(runtime, generation)(agentEnd("aborted"));
  await settleHandlerFor(runtime, generation, host.pi, executor)(settledEvent, host.ctx);

  // assert
  assert.deepStrictEqual(
    { notices: host.capture.entries, debug: debugLines() },
    {
      notices: [],
      debug: [
        "[hooks] settle: continue:false from halt suppresses Stop continuation; stopReason=done for today",
        "[hooks] settle: the run went on after a Stop hook stopped it; stopReason not shown",
      ],
    },
  );
});

test("shows a Stop hook that cannot start on the first Stop run and not on the second (D-PG5-12)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("starter")]);
  const host = makeNoticeHost();
  const executor = resultsExecutor({
    starter: { kind: "noop", failure: { kind: "spawn", error: "spawn starter.sh ENOENT" } },
  });

  // act
  await runStops(2, runtime, host.pi, host.ctx, executor);

  // assert
  assert.deepStrictEqual(host.capture.entries, [
    hookNoticeEntry(
      "Stop hook error: Failed with non-blocking status code: Error occurred while executing hook command: spawn starter.sh ENOENT",
    ),
  ]);
});

test("shows a Stop hook that cannot start on the next Stop run when its notice failed to show (D-PG5-12)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("starter")]);
  const host = makeNoticeHost();
  let appends = 0;
  const pi = {
    ...host.pi,
    appendEntry: (...entry: Parameters<ExtensionAPI["appendEntry"]>): void => {
      appends += 1;
      if (appends === 1) {
        throw new Error("append failed");
      }

      host.pi.appendEntry(...entry);
    },
  };
  const executor = resultsExecutor({
    starter: { kind: "noop", failure: { kind: "spawn", error: "spawn starter.sh ENOENT" } },
  });

  // act
  await runStops(3, runtime, pi, host.ctx, executor);

  // assert
  assert.deepStrictEqual(host.capture.entries, [
    hookNoticeEntry(
      "Stop hook error: Failed with non-blocking status code: Error occurred while executing hook command: spawn starter.sh ENOENT",
    ),
  ]);
});

test("debug-logs a Stop failure notice and a stop line that fail to show", async (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("Stop", [stopEntry("failer"), stopEntry("halt")]);
  const { pi, sent } = makePi();
  const ctx = {
    mode: "print",
    get ui(): never {
      throw new Error("no ui");
    },
  } as unknown as ExtensionContext;
  const executor = resultsExecutor({
    failer: BOOM_FAILURE,
    halt: { kind: "stop", stopReason: "done" },
  });

  // act
  const boundaryResult = await runStop(runtime, pi, ctx, executor);
  await settleHandlerFor(runtime, runtime.currentGeneration(), pi, executor)(settledEvent, ctx);

  // assert
  assert.deepStrictEqual(debugLines(), [
    "[hooks] settle: Stop notice failed: no ui",
    "[hooks] settle: continue:false from halt suppresses Stop continuation; stopReason=done",
    "[hooks] settle: Stop notice failed: no ui",
  ]);
  assert.strictEqual(boundaryResult, undefined);
  assert.deepStrictEqual(sent, []);
});

test("shows no notice for a StopFailure hook that failed (D-PG5-10)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  runtime.setRoutingBucket("StopFailure", [failureEntry("failer")]);
  const host = makeNoticeHost();
  const epoch = runtime.currentGeneration();

  // act
  agentEndCacheHandler(runtime, epoch)(failureEnd("error", "rate limit exceeded"));
  await settleHandlerFor(
    runtime,
    epoch,
    host.pi,
    resultsExecutor({ failer: BOOM_FAILURE }),
  )(settledEvent, host.ctx);

  // assert
  assert.deepStrictEqual(host.capture.entries, []);
  assert.deepStrictEqual(host.sent, []);
});
