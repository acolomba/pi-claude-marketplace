import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

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
import { createJsonCapture } from "../../edge/json-capture.ts";

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

/** The content of a Stop re-entry: one `Stop hook feedback:` part per text (D-CF5-25). */
function feedbackContent(...texts: readonly string[]): unknown[] {
  return texts.map((text) => ({ type: "text", text: `Stop hook feedback:\n${text}` }));
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
        if (scenario.failure === "mode" && modeReads === 9) {
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
    for (let index = 0; index < 9; index += 1) {
      await runStop(runtime, pi, ctx, executor);
    }

    await settleHandlerFor(runtime, runtime.currentGeneration(), pi, executor)(settledEvent, ctx);

    // assert
    assert.deepStrictEqual(
      host.sent,
      [
        "continue",
        "more context",
        "continue",
        "more context",
        "continue",
        "more context",
        "continue",
      ].map((text) => ({
        message: {
          customType: "claude-hook-stop-block",
          content: feedbackContent(text),
          display: false,
          details: { pluginId: "alpha" },
        },
        options: { deliverAs: "followUp", triggerTurn: true },
      })),
    );
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
    await runStop(runtime, pi, ctx, executor);
    agentEndCacheHandler(runtime, runtime.currentGeneration())(failureEnd("error", "failure"));
    await settleHandlerFor(runtime, runtime.currentGeneration(), pi, executor)(settledEvent, ctx);

    // assert
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
        content: feedbackContent("continue"),
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
        content: feedbackContent("continue"),
        display: false,
        details: { pluginId: "alpha" },
      },
      {
        customType: "claude-hook-stop-block",
        content: feedbackContent("continue"),
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

test("a block re-enters with its reason as stop hook feedback (STOP-03 / D-CF5-25)", async () => {
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
        content: feedbackContent("continue"),
        display: false,
        details: { pluginId: "alpha" },
      },
      options: { deliverAs: "followUp", triggerTurn: true },
    },
  ]);
});

test("a reasonless block re-enters with an empty feedback reason", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> => Promise.resolve({ kind: "block" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const { pi, sent } = makePi();

  // act
  await runStop(runtime, pi, emptyContext, executor);

  // assert
  assert.deepStrictEqual(
    sent.map((call) => call.message["content"]),
    [feedbackContent("")],
  );
});

test("sends every reason and context back in one re-entry in routing order whatever order the hooks finish in (D-CF5-25)", async () => {
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
  await settling;

  // assert
  assert.deepStrictEqual(sent, [
    {
      message: {
        customType: "claude-hook-stop-block",
        content: feedbackContent("r1", "c", "r2", "c2"),
        display: false,
        details: { pluginId: "first" },
      },
      options: { deliverAs: "followUp", triggerTurn: true },
    },
  ]);
});

test("counts a re-entry that carries several hooks' feedback once toward the cap (STOP-07)", async () => {
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
  for (let index = 0; index < 8; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  // assert
  assert.strictEqual(sent.length, 7);
  assert.deepStrictEqual(notified, [
    {
      text: "Stop hook override cap reached.\n\n`alpha`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
      severity: "warning",
    },
  ]);
});

test("a stop suppresses the re-entry of every other hook's reason and context (STOP-06)", async () => {
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
  await runStop(runtime, pi, emptyContext, executor);

  // assert
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
  for (let index = 0; index < 7; index += 1) {
    await runStop(runtime, pi, ctx, executor);
  }

  quiet = true;
  await runStop(runtime, pi, ctx, executor);
  const afterQuiet = sent.length;
  quiet = false;
  await runStop(runtime, pi, ctx, executor);

  // assert
  assert.strictEqual(afterQuiet, 7);
  assert.strictEqual(sent.length, 8);
  assert.deepStrictEqual(notified, []);
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
        content: feedbackContent("more context"),
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
    [feedbackContent("fresh")],
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
    ].map((text) => feedbackContent(text)),
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
    [feedbackContent("continue")],
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
    [feedbackContent("fresh")],
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
  await settling;

  // assert
  assert.deepStrictEqual(host.capture.entries, [
    hookNoticeEntry("Stop says: one"),
    hookNoticeEntry("Stop says: two"),
  ]);
  assert.deepStrictEqual(
    host.sent.map((call) => call.message["content"]),
    [feedbackContent("keep going")],
  );
  host.capture.assertValid();
});

test("shows a Stop system message when a stop suppresses the re-entry (STOP-06 / D-CF5-14)", async () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const executor: HookExecutor = (): Promise<HookExecResult> =>
    Promise.resolve({ kind: "stop", systemMessage: "halted" });
  runtime.setRoutingBucket("Stop", [stopEntry("alpha")]);
  const host = makeNoticeHost();

  // act
  await runStop(runtime, host.pi, host.ctx, executor);

  // assert
  assert.deepStrictEqual(host.capture.entries, [hookNoticeEntry("Stop says: halted")]);
  assert.deepStrictEqual(host.sent, []);
});

test("debug-logs a Stop notice that fails to show and still re-enters", async (t) => {
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
  await runStop(runtime, pi, ctx, executor);

  // assert
  assert.deepStrictEqual(debugLines(), ["[hooks] settle: Stop notice failed: no ui"]);
  assert.deepStrictEqual(
    sent.map((call) => call.message["content"]),
    [feedbackContent("continue")],
  );
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
