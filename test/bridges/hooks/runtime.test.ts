import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type {
  ChildLike,
  TimerLadder,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts";
import type { McpServerEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts";
import type {
  CacheEntry,
  PendingFollowUpContext,
  PendingPromptContext,
  PendingSessionStartContext,
  RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type {
  HooksRuntime,
  HooksRuntimeChildEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { McpToolIdentity } from "../../../extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts";
import type {
  AssistantMessage,
  BeforeAgentStartEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
    api: "anthropic-messages",
    provider: "anthropic",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: "stop",
    timestamp: 1,
  };
}

function runtimeChildEntry(
  dispatchId: string,
  pid: number,
  calls: string[],
  loc: ReturnType<typeof locationsFor>,
): HooksRuntimeChildEntry {
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
    fired(): boolean {
      return false;
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
    stdout: { text: () => "" },
    stderr: { text: () => "" },
    capturedGeneration: 1,
    loc,
  };
}

for (const { title, records, expected } of [
  { title: "no answer was recorded", records: [], expected: false },
  { title: "Pi trusts the project", records: [["/work", true]], expected: true },
  { title: "Pi does not trust the project", records: [["/work", false]], expected: false },
  { title: "Pi trusts only another project", records: [["/other", true]], expected: false },
  {
    title: "a later answer for the project says no",
    records: [
      ["/work", true],
      ["/work", false],
    ],
    expected: false,
  },
] as const) {
  test(`D-LOC-01: the project is trusted only by the last recorded answer for it when ${title}`, () => {
    // arrange
    const runtime = createHooksRuntime();

    // act
    for (const [cwd, trusted] of records) {
      runtime.recordProjectTrust(cwd, trusted);
    }

    // assert
    assert.strictEqual(runtime.isProjectTrusted("/work"), expected);
  });
}

test("keeps every state family isolated between runtime instances", () => {
  // arrange
  const firstRuntime = createHooksRuntime();
  const secondRuntime = createHooksRuntime();
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
  firstRuntime.appendPendingPromptContext(firstPendingEntry);
  firstRuntime.recordLastAssistant(assistantMessage("first message"));
  firstRuntime.recordStopReentry();
  firstRuntime.holdStopReason("first reason");
  firstRuntime.registerChild(childEntry);
  const secondState = {
    generation: secondRuntime.currentGeneration(),
    parsed: Array.from(secondRuntime.parsedConfigEntries()),
    routes: Array.from(secondRuntime.routingTableEntries()),
    pending: secondRuntime.pendingSessionStartContextEntries(),
    promptPending: secondRuntime.pendingPromptContextEntries(),
    assistant: secondRuntime.takeLastAssistant(),
    stopHookActive: secondRuntime.isStopHookActive(),
    stopReason: secondRuntime.takeHeldStopReason(),
    pidEntries: secondRuntime.pidTableEntries(loc),
    child: secondRuntime.takeChild("dispatch-first"),
  };

  // assert
  assert.deepStrictEqual(secondState, {
    generation: 0,
    parsed: [],
    routes: [],
    pending: [],
    promptPending: [],
    assistant: undefined,
    stopHookActive: false,
    stopReason: undefined,
    pidEntries: [],
    child: undefined,
  });
  assert.deepStrictEqual(calls, []);
});

test("preserves replacement order and returns collection snapshots", () => {
  // arrange
  const runtime = createHooksRuntime();
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
  assert.deepStrictEqual(runtime.getRoutingBucket("SessionEnd"), []);
});

test("appends and drains pending context once in declaration order", () => {
  // arrange
  const runtime = createHooksRuntime();
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

test("appends and drains pending prompt context once in arrival order, apart from the SessionStart buffer (D-CF5-13)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const firstEntry = {
    context: "first prompt context",
    pluginId: "first-plugin",
    marketplace: "catalog",
    scope: "user",
  } satisfies PendingPromptContext;
  const secondEntry = {
    context: "second prompt context",
    pluginId: "second-plugin",
    marketplace: "catalog",
    scope: "project",
  } satisfies PendingPromptContext;

  // act
  runtime.appendPendingPromptContext({ ...firstEntry, context: "" });
  runtime.appendPendingPromptContext(firstEntry);
  runtime.appendPendingPromptContext(secondEntry);
  const readSnapshot = runtime.pendingPromptContextEntries();
  const sessionStartSnapshot = runtime.pendingSessionStartContextEntries();
  const drainedEntries = runtime.drainPendingPromptContext();
  const secondDrain = runtime.drainPendingPromptContext();

  // assert
  assert.deepStrictEqual(readSnapshot, [firstEntry, secondEntry]);
  assert.deepStrictEqual(sessionStartSnapshot, []);
  assert.deepStrictEqual(drainedEntries, [firstEntry, secondEntry]);
  assert.deepStrictEqual(secondDrain, []);
});

test("empties every pending context buffer at registration (D-CF5-13)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const entry = {
    context: "stale context",
    pluginId: "stale-plugin",
    marketplace: "catalog",
    scope: "project",
  } satisfies PendingPromptContext;
  runtime.appendPendingSessionStartContext(entry);
  runtime.appendPendingPromptContext(entry);
  runtime.queueFollowUpContext({ ...entry, prompt: "stale follow-up" });

  // act
  runtime.preparePendingContextForRegistration();

  // assert
  assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
  assert.deepStrictEqual(runtime.drainPendingPromptContext(), []);
  assert.deepStrictEqual(runtime.drainFollowUpContext(), []);
});

test("hands out the context of the follow-up Pi reads and drops the ones queued before it (D-CF5-13)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const entry = (name: string): PendingFollowUpContext => ({
    context: `${name} context`,
    pluginId: `${name}-plugin`,
    marketplace: "catalog",
    scope: "user",
    prompt: `${name} follow-up`,
  });
  runtime.queueFollowUpContext({ ...entry("empty"), context: "" });
  runtime.queueFollowUpContext(entry("first"));
  runtime.queueFollowUpContext(entry("second"));
  runtime.queueFollowUpContext(entry("third"));

  // act
  const forUnknown = runtime.takeFollowUpContext("unknown follow-up");
  const forSecond = runtime.takeFollowUpContext("second follow-up");
  const forFirst = runtime.takeFollowUpContext("first follow-up");
  const left = runtime.drainFollowUpContext();
  const leftAfterDrain = runtime.drainFollowUpContext();

  // assert
  assert.strictEqual(forUnknown, undefined);
  assert.deepStrictEqual(forSecond, entry("second"));
  assert.strictEqual(forFirst, undefined);
  assert.deepStrictEqual(left, [entry("third")]);
  assert.deepStrictEqual(leftAfterDrain, []);
  assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
});

test("applies settle registration, input, and bounded reentry transitions", () => {
  // arrange
  const runtime = createHooksRuntime();
  const firstMessage = assistantMessage("first message");
  const replacementMessage = assistantMessage("replacement message");

  // act
  runtime.recordLastAssistant(firstMessage);
  runtime.recordLastAssistant(replacementMessage);
  const consumedMessage = runtime.takeLastAssistant();
  const consumedAgain = runtime.takeLastAssistant();
  const allowedTransitions = Array.from({ length: 8 }, () => runtime.recordStopReentry());
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
  assert.deepStrictEqual(
    allowedTransitions,
    Array.from({ length: 8 }, () => ({
      reenter: true,
      notifyCap: false,
    })),
  );
  assert.deepStrictEqual(cappedTransition, { reenter: false, notifyCap: true });
  assert.deepStrictEqual(repeatedCap, { reenter: false, notifyCap: false });
  assert.strictEqual(activeAtCap, true);
  assert.deepStrictEqual(allowedAfterNonReentry, { reenter: true, notifyCap: false });
  assert.strictEqual(activeAfterInput, false);
  assert.deepStrictEqual(allowedAfterInput, { reenter: true, notifyCap: false });
  assert.strictEqual(runtime.takeLastAssistant(), undefined);
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("gives stop_hook_active only to a run that an async rewake started (D-BG-210)", () => {
  // arrange
  const runtime = createHooksRuntime();

  // act
  runtime.recordRunStart(true);
  const activeInWokenRun = runtime.isStopHookActive();
  runtime.recordUserInput();
  const activeAfterJoiningInput = runtime.isStopHookActive();
  runtime.recordRunStart(false);
  const activeInNextRun = runtime.isStopHookActive();

  // assert
  assert.strictEqual(activeInWokenRun, true);
  assert.strictEqual(activeAfterJoiningInput, true);
  assert.strictEqual(activeInNextRun, false);
});

test("keeps the woken mark outside the STOP-07 re-entry cap (D-BG-210)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordRunStart(true);

  // act
  const allowedTransitions = Array.from({ length: 8 }, () => runtime.recordStopReentry());
  const cappedTransition = runtime.recordStopReentry();
  const repeatedCap = runtime.recordStopReentry();

  // assert
  assert.deepStrictEqual(
    allowedTransitions,
    Array.from({ length: 8 }, () => ({ reenter: true, notifyCap: false })),
  );
  assert.deepStrictEqual(cappedTransition, { reenter: false, notifyCap: true });
  assert.deepStrictEqual(repeatedCap, { reenter: false, notifyCap: false });
});

test("keeps terminal Stop callbacks bounded and notifies only once", () => {
  // arrange
  const runtime = createHooksRuntime();
  const firstEight = Array.from({ length: 8 }, () => runtime.recordStopReentry());

  // act
  const ninth = runtime.recordStopReentry();
  const later = Array.from({ length: 100_000 }, () => runtime.recordStopReentry());

  // assert
  assert.deepStrictEqual(
    firstEight,
    Array.from({ length: 8 }, () => ({ reenter: true, notifyCap: false })),
  );
  assert.deepStrictEqual(ninth, { reenter: false, notifyCap: true });
  assert.deepStrictEqual(
    later,
    Array.from({ length: 100_000 }, () => ({ reenter: false, notifyCap: false })),
  );
});

test("tool calls reset the Stop budget and notice without clearing active or rewake flags", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordRunStart(true);
  for (let index = 0; index < 8; index += 1) {
    runtime.recordStopReentry();
  }

  const firstCap = runtime.recordStopReentry();

  // act
  runtime.recordToolCall();
  runtime.recordToolCall();
  const activeAfterTool = runtime.isStopHookActive();
  const afterTool = runtime.recordStopReentry();
  for (let index = 1; index < 8; index += 1) {
    runtime.recordStopReentry();
  }

  const secondCap = runtime.recordStopReentry();
  runtime.recordUserInput();
  const rewakeAfterInput = runtime.isStopHookActive();

  // assert
  assert.deepStrictEqual(firstCap, { reenter: false, notifyCap: true });
  assert.strictEqual(activeAfterTool, true);
  assert.deepStrictEqual(afterTool, { reenter: true, notifyCap: false });
  assert.deepStrictEqual(secondCap, { reenter: false, notifyCap: true });
  assert.strictEqual(rewakeAfterInput, true);
});

test("keeps a Stop re-entry's flag across the start of a later run", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordRunStart(true);
  runtime.recordStopReentry();

  // act
  runtime.recordRunStart(false);
  const activeInReentryRun = runtime.isStopHookActive();
  runtime.recordUserInput();

  // assert
  assert.strictEqual(activeInReentryRun, true);
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("clears the woken mark at a bridge load", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordRunStart(true);

  // act
  runtime.prepareSettleForRegistration();

  // assert
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("takes a cached stop ending once and returns nothing without one (D-PG5-03)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const ending: AssistantMessage = { ...assistantMessage("done"), stopReason: "stop" };
  runtime.recordLastAssistant(ending);

  // act
  const taken = runtime.takeStopEnding();
  const takenAgain = runtime.takeStopEnding();

  // assert
  assert.strictEqual(taken, ending);
  assert.strictEqual(takenAgain, undefined);
  assert.strictEqual(runtime.takeLastAssistant(), undefined);
});

for (const stopReason of ["length", "error"] as const) {
  test(`leaves a cached ${stopReason} ending for the settle (D-PG5-03)`, () => {
    // arrange
    const runtime = createHooksRuntime();
    const ending: AssistantMessage = { ...assistantMessage("cut"), stopReason };
    runtime.recordLastAssistant(ending);

    // act
    const taken = runtime.takeStopEnding();

    // assert
    assert.strictEqual(taken, undefined);
    assert.strictEqual(runtime.takeLastAssistant(), ending);
  });
}

test("hands out a held stop reason once, and the last one held (D-PG5-13)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const before = runtime.takeHeldStopReason();
  runtime.holdStopReason("first");
  runtime.holdStopReason("done for today");

  // act
  const taken = runtime.takeHeldStopReason();
  const takenAgain = runtime.takeHeldStopReason();

  // assert
  assert.deepStrictEqual(
    { before, taken, takenAgain },
    { before: undefined, taken: "done for today", takenAgain: undefined },
  );
});

test("drops a held stop reason at a bridge load (D-PG5-13)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.holdStopReason("done for today");

  // act
  runtime.prepareSettleForRegistration();

  // assert
  assert.strictEqual(runtime.takeHeldStopReason(), undefined);
});

test("marks a wake sent while the stop boundary is open, and no other wake (D-BG-210 / D-PG5-06)", () => {
  // arrange
  const runtime = createHooksRuntime();

  // act
  runtime.recordRewakeSent();
  const activeBeforeBoundary = runtime.isStopHookActive();
  runtime.openStopBoundary();
  const activeAtOpen = runtime.isStopHookActive();
  runtime.recordRewakeSent();
  const activeAfterWake = runtime.isStopHookActive();
  runtime.closeStopBoundary();
  const activeAfterClose = runtime.isStopHookActive();
  runtime.recordRunStart(false);
  const activeAfterRunStart = runtime.isStopHookActive();
  runtime.recordRewakeSent();

  // assert
  assert.deepStrictEqual(
    [activeBeforeBoundary, activeAtOpen, activeAfterWake, activeAfterClose, activeAfterRunStart],
    [false, false, true, true, false],
  );
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("closes the stop boundary at a bridge load (D-PG5-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.openStopBoundary();

  // act
  runtime.prepareSettleForRegistration();
  runtime.recordRewakeSent();

  // assert
  assert.strictEqual(runtime.isStopHookActive(), false);
});

test("reports a start failure notice as shown only for the key it recorded (D-PG5-12)", () => {
  // arrange
  const runtime = createHooksRuntime();
  const before = runtime.startFailureNoticeShown("UserPromptSubmit:guard.sh");

  // act
  runtime.recordStartFailureNotice("UserPromptSubmit:guard.sh");

  // assert
  assert.deepStrictEqual(
    {
      before,
      recorded: runtime.startFailureNoticeShown("UserPromptSubmit:guard.sh"),
      otherEvent: runtime.startFailureNoticeShown("SessionStart:guard.sh"),
    },
    { before: false, recorded: true, otherEvent: false },
  );
});

test("empties the shown start failure notices at a bridge load (D-PG5-12)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordStartFailureNotice("UserPromptSubmit:guard.sh");

  // act
  runtime.prepareSettleForRegistration();

  // assert
  assert.strictEqual(runtime.startFailureNoticeShown("UserPromptSubmit:guard.sh"), false);
});

test("keeps the shown start failure notices of one runtime from another (D-PG5-12)", () => {
  // arrange
  const firstRuntime = createHooksRuntime();
  const secondRuntime = createHooksRuntime();
  firstRuntime.recordStartFailureNotice("UserPromptSubmit:guard.sh");

  // act
  const shown = secondRuntime.startFailureNoticeShown("UserPromptSubmit:guard.sh");

  // assert
  assert.strictEqual(shown, false);
});

test("takes a call's duration once, from its mark (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordToolCallPrepared("a", undefined, 100);

  // act
  const first = runtime.takeToolDuration("a", 250);
  const second = runtime.takeToolDuration("a", 260);
  const unmarked = runtime.takeToolDuration("b", 260);

  // assert
  assert.deepStrictEqual([first, second, unmarked], [150, undefined, undefined]);
});

test("gives a duration in whole milliseconds and never below zero (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordToolCallPrepared("a", undefined, 100.4);
  runtime.recordToolCallPrepared("b", undefined, 100);

  // act
  const rounded = runtime.takeToolDuration("a", 250.9);
  const early = runtime.takeToolDuration("b", 90);

  // assert
  assert.deepStrictEqual([rounded, early], [151, 0]);
});

for (const { name, clear } of [
  {
    name: "a clear",
    clear: (runtime: HooksRuntime): void => {
      runtime.clearToolCallMarks();
    },
  },
  {
    name: "a bridge load",
    clear: (runtime: HooksRuntime): void => {
      runtime.prepareSettleForRegistration();
    },
  },
]) {
  test(`drops every call's mark at ${name} (D-PG6-06)`, () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.recordToolCallPrepared("a", undefined, 100);
    runtime.recordToolCallPrepared("b", undefined, 110);

    // act
    clear(runtime);

    // assert
    assert.deepStrictEqual(
      [runtime.takeToolDuration("a", 200), runtime.takeToolDuration("b", 200)],
      [undefined, undefined],
    );
  });

  test(`drops the last top-level mark at ${name} (D-PG6-06)`, () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.recordToolCallPrepared("a", undefined, 100);

    // act
    clear(runtime);
    runtime.recordToolCallPrepared("a/1", "a", 50);

    // assert
    assert.strictEqual(runtime.takeToolDuration("a/1", 80), 30);
  });
}

test("counts each call of a parallel batch from the batch's last top-level mark (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordToolCallPrepared("a", undefined, 100);
  runtime.recordToolCallPrepared("b", undefined, 160);

  // act
  const first = runtime.takeToolDuration("a", 300);
  const second = runtime.takeToolDuration("b", 310);

  // assert
  assert.deepStrictEqual([first, second], [140, 150]);
});

test("counts a call another tool issued from its own mark (D-PG6-06)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.recordToolCallPrepared("a", undefined, 100);
  runtime.recordToolCallPrepared("a/1", "a", 200);

  // act
  const nested = runtime.takeToolDuration("a/1", 230);
  const parent = runtime.takeToolDuration("a", 400);
  runtime.recordToolCallPrepared("c", undefined, 500);
  const next = runtime.takeToolDuration("c", 520);

  // assert
  assert.deepStrictEqual([nested, parent, next], [30, 300, 20]);
});

function mcpServerEntry(plugin: string): McpServerEntry {
  return {
    builtinServer: `plugin_${plugin}_stub`,
    adapterKey: `plugin_${plugin}_stub_`,
    server: { name: `plugin:${plugin}:stub`, source: "plugin" },
  };
}

function adapterTool(plugin: string): McpToolIdentity {
  return { piName: `mcp__plugin_${plugin}_stub__echo`, builtinServer: undefined };
}

test("finds a tool's server among the servers of both scopes (D-PG6-07)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [mcpServerEntry("alpha")]);
  runtime.setMcpServers("project", [mcpServerEntry("beta")]);

  // act
  const servers = [
    runtime.mcpServerFor(adapterTool("alpha")),
    runtime.mcpServerFor(adapterTool("beta")),
  ];

  // assert
  assert.deepStrictEqual(servers, [
    { name: "plugin:alpha:stub", source: "plugin" },
    { name: "plugin:beta:stub", source: "plugin" },
  ]);
});

test("empties the project scope's servers and keeps the user scope's (D-PG6-07)", () => {
  // arrange
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [mcpServerEntry("alpha")]);
  runtime.setMcpServers("project", [mcpServerEntry("beta")]);

  // act
  runtime.setMcpServers("project", []);

  // assert
  assert.deepStrictEqual(
    [runtime.mcpServerFor(adapterTool("alpha")), runtime.mcpServerFor(adapterTool("beta"))],
    [{ name: "plugin:alpha:stub", source: "plugin" }, undefined],
  );
});

test("knows no server in a new runtime (D-PG6-07)", () => {
  // arrange
  const firstRuntime = createHooksRuntime();
  firstRuntime.setMcpServers("user", [mcpServerEntry("alpha")]);

  // act
  const server = createHooksRuntime().mcpServerFor(adapterTool("alpha"));

  // assert
  assert.strictEqual(server, undefined);
});

test("owns child removal, PID snapshots, and shutdown per runtime", () => {
  // arrange
  const firstRuntime = createHooksRuntime();
  const secondRuntime = createHooksRuntime();
  const calls: string[] = [];
  const loc = locationsFor("project", "/workspace");
  const equivalentLoc = locationsFor("project", "/workspace");
  const otherLoc = locationsFor("project", "/other-workspace");
  const removedEntry = runtimeChildEntry("dispatch-removed", 1, calls, loc);
  const stoppedEntry = runtimeChildEntry("dispatch-stopped", 2, calls, loc);
  const throwingEntry = {
    ...runtimeChildEntry("dispatch-throwing", 4, calls, loc),
    child: {
      kill(signal?: NodeJS.Signals): boolean {
        calls.push(`kill:dispatch-throwing:${signal ?? "none"}`);
        throw new Error("child already exited");
      },
    } satisfies ChildLike,
  } satisfies HooksRuntimeChildEntry;
  const peerEntry = runtimeChildEntry("dispatch-peer", 3, calls, loc);

  // act
  firstRuntime.registerChild(removedEntry);
  firstRuntime.registerChild(stoppedEntry);
  firstRuntime.registerChild(throwingEntry);
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
    {
      pid: 4,
      dispatchId: "dispatch-throwing",
      scope: "project",
      marketplace: "catalog",
      plugin: "plugin-dispatch-throwing",
      spawnedAt: "2026-09-07T00:00:04.000Z",
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
  assert.deepStrictEqual(calls, [
    "cancel:dispatch-stopped",
    "kill:dispatch-stopped:SIGKILL",
    "cancel:dispatch-throwing",
    "kill:dispatch-throwing:SIGKILL",
  ]);
});

test("keeps journal owners and PID rows separate by session and runtime", () => {
  // arrange
  const runtime = createHooksRuntime();
  const siblingRuntime = createHooksRuntime();
  const loc = locationsFor("project", "/workspace");
  const calls: string[] = [];
  const firstOwner = runtime.persistenceOwner(loc, "session-a", "token-a");
  const sameOwner = runtime.persistenceOwner(loc, "session-a", "different-token");
  const laterOwner = runtime.persistenceOwner(loc, "session-b", "token-b");
  const siblingOwner = siblingRuntime.persistenceOwner(loc, "session-a", "sibling-token");
  runtime.registerChild({
    ...runtimeChildEntry("first", 11, calls, loc),
    persistenceOwner: firstOwner,
  });
  runtime.registerChild({
    ...runtimeChildEntry("later", 12, calls, loc),
    persistenceOwner: laterOwner,
  });
  siblingRuntime.registerChild({
    ...runtimeChildEntry("sibling", 13, calls, loc),
    persistenceOwner: siblingOwner,
  });

  // act
  const firstRows = runtime.pidTableEntries(loc, firstOwner);
  const laterRows = runtime.pidTableEntries(loc, laterOwner);
  const parentRows = runtime.pidTableEntries(loc);
  const owners = runtime.persistenceOwners();
  runtime.shutdownChildren();
  runtime.forgetPersistenceOwners();

  // assert
  assert.strictEqual(sameOwner, firstOwner);
  assert.notStrictEqual(siblingOwner, firstOwner);
  assert.deepStrictEqual(owners, [firstOwner, laterOwner]);
  assert.deepStrictEqual(
    firstRows.map((row) => row.dispatchId),
    ["first"],
  );
  assert.deepStrictEqual(
    laterRows.map((row) => row.dispatchId),
    ["later"],
  );
  assert.deepStrictEqual(parentRows, []);
  assert.deepStrictEqual(runtime.persistenceOwners(), []);
  assert.deepStrictEqual(
    siblingRuntime.pidTableEntries(loc, siblingOwner).map((row) => row.dispatchId),
    ["sibling"],
  );
});

test("serializes each PID path and continues after an operation rejects", async () => {
  // arrange
  const runtime = createHooksRuntime();
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
  const secondOperation = runtime.runPidTableOperation("first-path", () => {
    calls.push("second");
    return Promise.resolve();
  });
  const otherPathOperation = runtime.runPidTableOperation("other-path", () => {
    calls.push("other");
    return Promise.resolve();
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
  await runtime.runPidTableOperation("first-path", () => {
    calls.push("after-reject");
    return Promise.resolve();
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

function setChildMarker(t: TestContext, value: string): void {
  const previous = process.env.PI_SUBAGENT_CHILD;
  process.env.PI_SUBAGENT_CHILD = value;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.PI_SUBAGENT_CHILD;
    } else {
      process.env.PI_SUBAGENT_CHILD = previous;
    }
  });
}

function identityEvent(customPrompt?: string, appendSystemPrompt?: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    messageType: "user",
    prompt: "task text may claim another agent",
    systemPrompt: '<active_agent name="rendered-spoof"/>\n\n',
    systemPromptOptions: { customPrompt, appendSystemPrompt },
  } as BeforeAgentStartEvent;
}

for (const { title, custom, appended, name } of [
  {
    title: "custom prompt",
    custom: '<active_agent name="demo:runner"/>\n\n',
    appended: undefined,
    name: "demo:runner",
  },
  {
    title: "appended prompt",
    custom: undefined,
    appended: '<active_agent name="demo:runner"/>\n\n',
    name: "demo:runner",
  },
  {
    title: "matching prompt sections",
    custom: '<active_agent name="demo:runner"/>\n\n',
    appended: '<active_agent name="demo:runner"/>\n\n',
    name: "demo:runner",
  },
  {
    title: "escaped producer name",
    custom: '<active_agent name="a&amp;b&quot;c&lt;d&gt;e"/>\n\n',
    appended: undefined,
    name: 'a&b"c<d>e',
  },
  {
    title: "one-pass entity decode",
    custom: '<active_agent name="a&amp;quot;b"/>\n\n',
    appended: undefined,
    name: "a&quot;b",
  },
  {
    title: "spoof tag in body",
    custom: '<active_agent name="demo:runner"/>\n\n<active_agent name="spoof"/>',
    appended: undefined,
    name: "demo:runner",
  },
] as const) {
  test(`child identity accepts ${title}`, { concurrency: false }, (t) => {
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();

    runtime.captureChildIdentity(identityEvent(custom, appended), "child-session");

    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
      kind: "known",
      agentType: name,
      childId: "child-session",
    });
  });
}

for (const { title, custom, appended } of [
  { title: "missing sections", custom: undefined, appended: undefined },
  { title: "unrelated prompt text", custom: "ordinary prompt", appended: undefined },
  { title: "empty name", custom: '<active_agent name=""/>\n\n', appended: undefined },
  {
    title: "unsupported entity",
    custom: '<active_agent name="a&apos;b"/>\n\n',
    appended: undefined,
  },
  {
    title: "missing delimiter",
    custom: '<active_agent name="demo:runner"/>\nbody',
    appended: undefined,
  },
  {
    title: "single quote attribute",
    custom: "<active_agent name='demo:runner'/>\n\n",
    appended: undefined,
  },
  { title: "malformed appended tag", custom: undefined, appended: '<active_agent name="demo"/>\n' },
  {
    title: "conflicting prompt sections",
    custom: '<active_agent name="first"/>\n\n',
    appended: '<active_agent name="second"/>\n\n',
  },
] as const) {
  test(`child identity clears on ${title}`, { concurrency: false }, (t) => {
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent('<active_agent name="old"/>\n\n'), "child-session");

    runtime.captureChildIdentity(identityEvent(custom, appended), "child-session");

    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), { kind: "unavailable" });
  });
}

test(
  "child identity is bound to the current session and isolated by runtime",
  { concurrency: false },
  (t) => {
    setChildMarker(t, "1");
    const first = createHooksRuntime();
    const second = createHooksRuntime();
    first.captureChildIdentity(identityEvent('<active_agent name="first"/>\n\n'), "session-one");
    second.captureChildIdentity(
      identityEvent(undefined, '<active_agent name="second"/>\n\n'),
      "session-two",
    );
    assert.deepStrictEqual(first.childIdentityFor("session-two"), { kind: "unavailable" });
    assert.deepStrictEqual(second.childIdentityFor("session-one"), { kind: "unavailable" });

    first.captureChildIdentity(identityEvent('<active_agent name="third"/>\n\n'), "session-three");
    second.resetChildIdentity();

    assert.deepStrictEqual(first.childIdentityFor("session-one"), { kind: "unavailable" });
    assert.deepStrictEqual(first.childIdentityFor("session-three"), {
      kind: "known",
      agentType: "third",
      childId: "session-three",
    });
    assert.deepStrictEqual(second.childIdentityFor("session-two"), { kind: "unavailable" });
  },
);

const RUNNER_TAG = '<active_agent name="demo:runner"/>\n\n';
const LAUNCHER_ROOT = { sessionId: "main-session", transcriptPath: "/sessions/main.jsonl" };

test(
  "D-PG6-02: a recorded root travels with the child identity of its session",
  { concurrency: false },
  (t) => {
    // arrange
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

    // act
    runtime.recordChildRoot("child-session", LAUNCHER_ROOT);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "child-session",
      root: LAUNCHER_ROOT,
    });
    assert.strictEqual(runtime.childRootResolved("child-session"), true);
  },
);

test(
  "D-PG6-02: a recorded absence of a root leaves the identity without one",
  { concurrency: false },
  (t) => {
    // arrange
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

    // act
    runtime.recordChildRoot("child-session", undefined);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "child-session",
    });
    assert.strictEqual(runtime.childRootResolved("child-session"), true);
  },
);

test(
  "D-PG6-02: a root recorded for another session changes nothing",
  { concurrency: false },
  (t) => {
    // arrange
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

    // act
    runtime.recordChildRoot("other-session", LAUNCHER_ROOT);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "child-session",
    });
    assert.strictEqual(runtime.childRootResolved("child-session"), false);
    assert.strictEqual(runtime.childRootResolved("other-session"), false);
  },
);

test(
  "D-PG6-02: a later capture for the same session keeps its root",
  { concurrency: false },
  (t) => {
    // arrange
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");
    runtime.recordChildRoot("child-session", LAUNCHER_ROOT);

    // act
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "child-session",
      root: LAUNCHER_ROOT,
    });
    assert.strictEqual(runtime.childRootResolved("child-session"), true);
  },
);

test(
  "D-PG6-02: a root is not returned with an identity that became unavailable",
  { concurrency: false },
  (t) => {
    // arrange
    setChildMarker(t, "1");
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");
    runtime.recordChildRoot("child-session", LAUNCHER_ROOT);

    // act
    runtime.captureChildIdentity(identityEvent(), "child-session");

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("child-session"), { kind: "unavailable" });
  },
);

test("D-PG6-02: a capture for a new session drops the root", { concurrency: false }, (t) => {
  // arrange
  setChildMarker(t, "1");
  const runtime = createHooksRuntime();
  runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");
  runtime.recordChildRoot("child-session", LAUNCHER_ROOT);

  // act
  runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "next-session");
  runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

  // assert
  assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
    kind: "known",
    agentType: "demo:runner",
    childId: "child-session",
  });
  assert.strictEqual(runtime.childRootResolved("child-session"), false);
});

test("D-PG6-02: a reset drops the root", { concurrency: false }, (t) => {
  // arrange
  setChildMarker(t, "1");
  const runtime = createHooksRuntime();
  runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");
  runtime.recordChildRoot("child-session", LAUNCHER_ROOT);

  // act
  runtime.resetChildIdentity();
  runtime.captureChildIdentity(identityEvent(RUNNER_TAG), "child-session");

  // assert
  assert.deepStrictEqual(runtime.childIdentityFor("child-session"), {
    kind: "known",
    agentType: "demo:runner",
    childId: "child-session",
  });
  assert.strictEqual(runtime.childRootResolved("child-session"), false);
});

test("main session ignores structured active agent tags", { concurrency: false }, (t) => {
  setChildMarker(t, "0");
  const runtime = createHooksRuntime();

  runtime.captureChildIdentity(identityEvent('<active_agent name="spoof"/>\n\n'), "main-session");

  assert.deepStrictEqual(runtime.childIdentityFor("main-session"), { kind: "main" });
});
