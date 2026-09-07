import assert from "node:assert/strict";
import { test } from "node:test";

import { RingBuffer } from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ChildLike, TimerLadder } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts";
import type {
  CacheEntry,
  PendingSessionStartContext,
  RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { AssistantMessage } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface ExpectedRuntimeChildEntry {
  readonly dispatchId: string;
  readonly pid: number;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: "PreToolUse";
  readonly spawnedAt: string;
  readonly rewakeMessage: string | undefined;
  readonly rewakeSummary: string | undefined;
  readonly child: ChildLike;
  readonly ladder: TimerLadder;
  readonly stdoutBuffer: RingBuffer;
  readonly stderrBuffer: RingBuffer;
  readonly capturedGeneration: number;
  readonly loc: ReturnType<typeof locationsFor>;
}

interface ExpectedHooksRuntime {
  readonly currentGeneration: () => number;
  readonly advanceGeneration: () => number;
  readonly setParsedConfig: (key: string, entry: CacheEntry) => void;
  readonly deleteParsedConfig: (key: string) => void;
  readonly parsedConfigEntries: () => ReadonlyMap<string, CacheEntry>;
  readonly getRoutingBucket: (event: "PreToolUse") => readonly RoutingEntry[];
  readonly setRoutingBucket: (event: "PreToolUse", entries: readonly RoutingEntry[]) => void;
  readonly routingTableEntries: () => ReadonlyMap<string, readonly RoutingEntry[]>;
  readonly appendPendingSessionStartContext: (entry: PendingSessionStartContext) => void;
  readonly pendingSessionStartContextEntries: () => readonly PendingSessionStartContext[];
  readonly drainPendingSessionStartContext: () => readonly PendingSessionStartContext[];
  readonly preparePendingContextForRegistration: () => void;
  readonly prepareSettleForRegistration: () => void;
  readonly recordLastAssistant: (message: AssistantMessage | undefined) => void;
  readonly takeLastAssistant: () => AssistantMessage | undefined;
  readonly isStopHookActive: () => boolean;
  readonly recordStopReentry: () => { readonly reenter: boolean; readonly notifyCap: boolean };
  readonly recordStopNonReentry: () => void;
  readonly recordUserInput: () => void;
  readonly registerChild: (entry: ExpectedRuntimeChildEntry) => void;
  readonly takeChild: (dispatchId: string) => ExpectedRuntimeChildEntry | undefined;
  readonly pidTableEntries: (
    loc: ReturnType<typeof locationsFor>,
  ) => readonly {
    readonly pid: number;
    readonly dispatchId: string;
    readonly scope: "user" | "project";
    readonly marketplace: string;
    readonly plugin: string;
    readonly spawnedAt: string;
  }[];
  readonly shutdownChildren: () => void;
  readonly runPidTableOperation: (
    key: string,
    operation: () => Promise<void>,
  ) => Promise<void>;
}

interface ExpectedRuntimeModule {
  readonly createHooksRuntime?: () => ExpectedHooksRuntime;
}

async function loadRuntime(): Promise<ExpectedHooksRuntime> {
  const runtimeModule: ExpectedRuntimeModule = await import(
    "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts"
  ).catch(() => ({}));
  assert.strictEqual(typeof runtimeModule.createHooksRuntime, "function");
  return runtimeModule.createHooksRuntime();
}

function cacheEntry(pluginId: string): CacheEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId,
    resolvedSource: asAbsolutePluginRoot(`/plugins/${pluginId}`),
    config: {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: `echo ${pluginId}` }],
        },
      ],
    },
    ifPredicates: new Map([["PreToolUse|0|0", { kind: "match-all" }]]),
  };
}

function routingEntry(pluginId: string, declarationIndex: number): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId,
    resolvedSource: asAbsolutePluginRoot(`/plugins/${pluginId}`),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: `echo ${pluginId}` },
    declarationIndex,
    ifPredicate: { kind: "match-all" },
  };
}

function assistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
    timestamp: 1,
  } as AssistantMessage;
}

function runtimeChildEntry(
  dispatchId: string,
  pid: number,
  calls: string[],
  loc: ReturnType<typeof locationsFor>,
): ExpectedRuntimeChildEntry {
  const child = {
    kill(signal?: NodeJS.Signals): boolean {
      calls.push(`kill:${dispatchId}:${signal ?? "none"}`);
      return true;
    },
  } satisfies ChildLike;
  const ladder = {
    cancel(): void {
      calls.push(`cancel:${dispatchId}`);
    },
  } satisfies TimerLadder;

  return {
    dispatchId,
    pid,
    scope: "project",
    marketplace: "catalog",
    pluginId: `plugin-${dispatchId}`,
    claudeEvent: "PreToolUse",
    spawnedAt: `2026-09-07T00:00:0${pid}.000Z`,
    rewakeMessage: undefined,
    rewakeSummary: undefined,
    child,
    ladder,
    stdoutBuffer: new RingBuffer(16),
    stderrBuffer: new RingBuffer(16),
    capturedGeneration: 1,
    loc,
  };
}

test("keeps every state family isolated between runtime instances", async () => {
  // arrange
  const firstRuntime = await loadRuntime();
  const secondRuntime = await loadRuntime();
  const firstCacheEntry = cacheEntry("first-plugin");
  const firstRoutingEntry = routingEntry("first-plugin", 0);
  const firstPendingEntry = {
    context: "first context",
    pluginId: "first-plugin",
    marketplace: "catalog",
    scope: "project",
  } satisfies PendingSessionStartContext;
  const calls: string[] = [];
  const loc = locationsFor("project", "/workspace");
  const childEntry = runtimeChildEntry("dispatch-first", 1, calls, loc);

  // act
  firstRuntime.advanceGeneration();
  firstRuntime.setParsedConfig("first-key", firstCacheEntry);
  firstRuntime.setRoutingBucket("PreToolUse", [firstRoutingEntry]);
  firstRuntime.appendPendingSessionStartContext(firstPendingEntry);
  firstRuntime.recordLastAssistant(assistantMessage("first message"));
  firstRuntime.recordStopReentry();
  firstRuntime.registerChild(childEntry);
  const secondState = {
    generation: secondRuntime.currentGeneration(),
    parsed: Array.from(secondRuntime.parsedConfigEntries()),
    routes: Array.from(secondRuntime.routingTableEntries()),
    pending: secondRuntime.pendingSessionStartContextEntries(),
    assistant: secondRuntime.takeLastAssistant(),
    stopHookActive: secondRuntime.isStopHookActive(),
    pidEntries: secondRuntime.pidTableEntries(loc),
    child: secondRuntime.takeChild("dispatch-first"),
  };

  // assert
  assert.deepStrictEqual(secondState, {
    generation: 0,
    parsed: [],
    routes: [],
    pending: [],
    assistant: undefined,
    stopHookActive: false,
    pidEntries: [],
    child: undefined,
  });
  assert.deepStrictEqual(calls, []);
});

test("preserves replacement order and returns collection snapshots", async () => {
  // arrange
  const runtime = await loadRuntime();
  const firstCacheEntry = cacheEntry("first-plugin");
  const replacementCacheEntry = cacheEntry("replacement-plugin");
  const firstRoute = routingEntry("first-plugin", 0);
  const secondRoute = routingEntry("second-plugin", 1);

  // act
  runtime.setParsedConfig("first-key", firstCacheEntry);
  runtime.setParsedConfig("second-key", cacheEntry("second-plugin"));
  runtime.setParsedConfig("first-key", replacementCacheEntry);
  runtime.deleteParsedConfig("missing-key");
  const parsedSnapshot = runtime.parsedConfigEntries();
  runtime.deleteParsedConfig("second-key");
  runtime.setRoutingBucket("PreToolUse", [firstRoute, secondRoute]);
  const bucketSnapshot = runtime.getRoutingBucket("PreToolUse");
  const tableSnapshot = runtime.routingTableEntries();
  runtime.setRoutingBucket("PreToolUse", [secondRoute]);

  // assert
  assert.deepStrictEqual(Array.from(parsedSnapshot), [
    ["first-key", replacementCacheEntry],
    ["second-key", cacheEntry("second-plugin")],
  ]);
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), [
    ["first-key", replacementCacheEntry],
  ]);
  assert.deepStrictEqual(bucketSnapshot, [firstRoute, secondRoute]);
  assert.deepStrictEqual(Array.from(tableSnapshot), [["PreToolUse", [firstRoute, secondRoute]]]);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), [secondRoute]);
  assert.deepStrictEqual(runtime.getRoutingBucket("SessionEnd" as "PreToolUse"), []);
});

test("appends and drains pending context once in declaration order", async () => {
  // arrange
  const runtime = await loadRuntime();
  const firstEntry = {
    context: "first context",
    pluginId: "first-plugin",
    marketplace: "catalog",
    scope: "user",
  } satisfies PendingSessionStartContext;
  const secondEntry = {
    context: "second context",
    pluginId: "second-plugin",
    marketplace: "catalog",
    scope: "project",
  } satisfies PendingSessionStartContext;

  // act
  runtime.appendPendingSessionStartContext({ ...firstEntry, context: "" });
  runtime.appendPendingSessionStartContext(firstEntry);
  runtime.appendPendingSessionStartContext(secondEntry);
  const readSnapshot = runtime.pendingSessionStartContextEntries();
  const drainedEntries = runtime.drainPendingSessionStartContext();
  const secondDrain = runtime.drainPendingSessionStartContext();
  runtime.appendPendingSessionStartContext(firstEntry);
  runtime.preparePendingContextForRegistration();

  // assert
  assert.deepStrictEqual(readSnapshot, [firstEntry, secondEntry]);
  assert.deepStrictEqual(drainedEntries, [firstEntry, secondEntry]);
  assert.deepStrictEqual(secondDrain, []);
  assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
});

test("applies settle registration, input, and bounded reentry transitions", async () => {
  // arrange
  const runtime = await loadRuntime();
  const firstMessage = assistantMessage("first message");
  const replacementMessage = assistantMessage("replacement message");

  // act
  runtime.recordLastAssistant(firstMessage);
  runtime.recordLastAssistant(replacementMessage);
  const consumedMessage = runtime.takeLastAssistant();
  const consumedAgain = runtime.takeLastAssistant();
  const allowedTransitions = Array.from({ length: 7 }, () => runtime.recordStopReentry());
  const cappedTransition = runtime.recordStopReentry();
  const repeatedCap = runtime.recordStopReentry();
  const activeAtCap = runtime.isStopHookActive();
  runtime.recordStopNonReentry();
  const allowedAfterNonReentry = runtime.recordStopReentry();
  runtime.recordUserInput();
  const activeAfterInput = runtime.isStopHookActive();
  const allowedAfterInput = runtime.recordStopReentry();
  runtime.recordLastAssistant(firstMessage);
  runtime.prepareSettleForRegistration();

  // assert
  assert.strictEqual(consumedMessage, replacementMessage);
  assert.strictEqual(consumedAgain, undefined);
  assert.deepStrictEqual(allowedTransitions, Array.from({ length: 7 }, () => ({
    reenter: true,
    notifyCap: false,
  })));
  assert.deepStrictEqual(cappedTransition, { reenter: false, notifyCap: true });
  assert.deepStrictEqual(repeatedCap, { reenter: false, notifyCap: false });
  assert.strictEqual(activeAtCap, true);
  assert.deepStrictEqual(allowedAfterNonReentry, { reenter: true, notifyCap: false });
  assert.strictEqual(activeAfterInput, false);
  assert.deepStrictEqual(allowedAfterInput, { reenter: true, notifyCap: false });
  assert.strictEqual(runtime.takeLastAssistant(), undefined);
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("owns child removal, PID snapshots, and shutdown per runtime", async () => {
  // arrange
  const firstRuntime = await loadRuntime();
  const secondRuntime = await loadRuntime();
  const calls: string[] = [];
  const loc = locationsFor("project", "/workspace");
  const equivalentLoc = locationsFor("project", "/workspace");
  const otherLoc = locationsFor("project", "/other-workspace");
  const removedEntry = runtimeChildEntry("dispatch-removed", 1, calls, loc);
  const stoppedEntry = runtimeChildEntry("dispatch-stopped", 2, calls, loc);
  const peerEntry = runtimeChildEntry("dispatch-peer", 3, calls, loc);

  // act
  firstRuntime.registerChild(removedEntry);
  firstRuntime.registerChild(stoppedEntry);
  secondRuntime.registerChild(peerEntry);
  const firstPidSnapshot = firstRuntime.pidTableEntries(equivalentLoc);
  const unrelatedPidSnapshot = firstRuntime.pidTableEntries(otherLoc);
  const takenEntry = firstRuntime.takeChild("dispatch-removed");
  const missingEntry = firstRuntime.takeChild("dispatch-missing");
  firstRuntime.shutdownChildren();
  const firstAfterShutdown = firstRuntime.pidTableEntries(loc);
  const secondAfterShutdown = secondRuntime.pidTableEntries(loc);

  // assert
  assert.strictEqual(takenEntry, removedEntry);
  assert.strictEqual(missingEntry, undefined);
  assert.deepStrictEqual(firstPidSnapshot, [
    {
      pid: 1,
      dispatchId: "dispatch-removed",
      scope: "project",
      marketplace: "catalog",
      plugin: "plugin-dispatch-removed",
      spawnedAt: "2026-09-07T00:00:01.000Z",
    },
    {
      pid: 2,
      dispatchId: "dispatch-stopped",
      scope: "project",
      marketplace: "catalog",
      plugin: "plugin-dispatch-stopped",
      spawnedAt: "2026-09-07T00:00:02.000Z",
    },
  ]);
  assert.deepStrictEqual(unrelatedPidSnapshot, []);
  assert.deepStrictEqual(firstAfterShutdown, []);
  assert.deepStrictEqual(secondAfterShutdown, [
    {
      pid: 3,
      dispatchId: "dispatch-peer",
      scope: "project",
      marketplace: "catalog",
      plugin: "plugin-dispatch-peer",
      spawnedAt: "2026-09-07T00:00:03.000Z",
    },
  ]);
  assert.deepStrictEqual(calls, ["cancel:dispatch-stopped", "kill:dispatch-stopped:SIGKILL"]);
});

test("serializes each PID path and continues after an operation rejects", async () => {
  // arrange
  const runtime = await loadRuntime();
  const calls: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  // act
  const firstOperation = runtime.runPidTableOperation("first-path", async () => {
    calls.push("first:start");
    await firstGate;
    calls.push("first:end");
  });
  const secondOperation = runtime.runPidTableOperation("first-path", async () => {
    calls.push("second");
  });
  const otherPathOperation = runtime.runPidTableOperation("other-path", async () => {
    calls.push("other");
  });
  await otherPathOperation;
  const callsBeforeRelease = [...calls];
  releaseFirst?.();
  await Promise.all([firstOperation, secondOperation]);
  const rejectedOperation = runtime.runPidTableOperation("first-path", () => {
    calls.push("reject");
    return Promise.reject(new Error("pid write failed"));
  });
  await assert.rejects(rejectedOperation, { message: "pid write failed" });
  await runtime.runPidTableOperation("first-path", async () => {
    calls.push("after-reject");
  });

  // assert
  assert.deepStrictEqual(callsBeforeRelease, ["first:start", "other"]);
  assert.deepStrictEqual(calls, [
    "first:start",
    "other",
    "first:end",
    "second",
    "reject",
    "after-reject",
  ]);
});
