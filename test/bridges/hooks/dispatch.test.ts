import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  collectBucketOutcomes,
  compositeHandlerFor,
  matcherFiresOnClosedSetValue,
  toolResultCompositeHandler,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  compileIfPredicate,
  MATCH_ALL_IF,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";

import type {
  CompositeDispatchEvent,
  CompositeReturnFor,
  HookExecutor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { ClaudeSessionEndEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts";
import type { ClaudeSessionStartEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ([
  "PreToolUse",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "PreCompact",
  "PostCompact",
] satisfies readonly CompositeDispatchEvent[]);
// @ts-expect-error PostToolUse belongs to toolResultCompositeHandler
void ("PostToolUse" satisfies CompositeDispatchEvent);
// @ts-expect-error PostToolUseFailure belongs to toolResultCompositeHandler
void ("PostToolUseFailure" satisfies CompositeDispatchEvent);
// @ts-expect-error Stop belongs to settle dispatch
void ("Stop" satisfies CompositeDispatchEvent);
// @ts-expect-error StopFailure belongs to settle dispatch
void ("StopFailure" satisfies CompositeDispatchEvent);

interface ExecutorCall {
  readonly entry: {
    readonly scope: RoutingEntry["scope"];
    readonly marketplace: string;
    readonly pluginId: string;
    readonly resolvedSource: string;
    readonly claudeEvent: RoutingEntry["claudeEvent"];
    readonly matcher: { readonly kind: "tool-set"; readonly toolNames: readonly string[] };
    readonly rawMatcher: string;
    readonly handlerDecl: RoutingEntry["handlerDecl"];
    readonly declarationIndex: number;
    readonly ifPredicateKind: RoutingEntry["ifPredicate"]["kind"];
  };
  readonly event: unknown;
  readonly context: ExtensionContext;
  readonly pi: ExtensionAPI | undefined;
  readonly returned: HookExecResult;
}

interface RecordedCall {
  readonly pluginId: string;
  readonly event: unknown;
}

function createExtensionContext(cwd: string): ExtensionContext {
  return {
    get ui(): ExtensionContext["ui"] {
      throw new Error("composite dispatch must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager: SessionManager.inMemory(cwd, { id: "dispatch-owner-session" }),
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("composite dispatch must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle(): never {
      throw new Error("composite dispatch must not call isIdle");
    },
    isProjectTrusted(): never {
      throw new Error("composite dispatch must not call isProjectTrusted");
    },
    signal: undefined,
    abort(): never {
      throw new Error("composite dispatch must not abort");
    },
    hasPendingMessages(): never {
      throw new Error("composite dispatch must not inspect pending messages");
    },
    shutdown(): never {
      throw new Error("composite dispatch must not shut down Pi");
    },
    getContextUsage(): never {
      throw new Error("composite dispatch must not inspect context usage");
    },
    compact(): never {
      throw new Error("composite dispatch must not compact the session");
    },
    getSystemPrompt(): never {
      throw new Error("composite dispatch must not read the system prompt");
    },
  };
}

function recordExecutorCall(
  entry: RoutingEntry,
  event: unknown,
  context: ExtensionContext,
  pi: ExtensionAPI | undefined,
  returned: HookExecResult,
): ExecutorCall {
  if (entry.matcher.kind !== "tool-set") {
    throw new Error(`expected a tool-set matcher for ${entry.pluginId}`);
  }

  return {
    entry: {
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
      claudeEvent: entry.claudeEvent,
      matcher: { kind: "tool-set", toolNames: [...entry.matcher.toolNames] },
      rawMatcher: entry.rawMatcher,
      handlerDecl: structuredClone(entry.handlerDecl),
      declarationIndex: entry.declarationIndex,
      ifPredicateKind: entry.ifPredicate.kind,
    },
    event: structuredClone(event),
    context,
    pi,
    returned,
  };
}

function createRoutingEntry(input: {
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly rawMatcher: string;
  readonly declarationIndex: number;
  readonly asyncRewake?: boolean;
  readonly ifPredicate?: RoutingEntry["ifPredicate"];
  readonly scope?: RoutingEntry["scope"];
  readonly marketplace?: string;
}): RoutingEntry {
  return {
    scope: input.scope ?? "user",
    marketplace: input.marketplace ?? "dispatch-catalog",
    pluginId: input.pluginId,
    resolvedSource: asAbsolutePluginRoot(`/plugins/${input.pluginId}`),
    claudeEvent: input.claudeEvent,
    matcher: parseMatcher(input.rawMatcher),
    rawMatcher: input.rawMatcher,
    handlerDecl: {
      type: "command",
      command: `printf ${input.pluginId}`,
      timeout: 23,
      asyncRewake: input.asyncRewake ?? false,
    },
    declarationIndex: input.declarationIndex,
    ifPredicate: input.ifPredicate ?? MATCH_ALL_IF,
  };
}

function createToolCallEvent(
  toolName = "bash",
  input: Record<string, unknown> = { command: "git status" },
): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "dispatch-call",
    toolName,
    input,
  };
}

function createToolResultEvent(isError: boolean, toolName = "bash"): ToolResultEvent {
  return {
    type: "tool_result",
    toolCallId: "dispatch-call",
    toolName,
    input: { command: "git status" },
    content: [{ type: "text", text: "original output" }],
    isError,
    details: undefined,
  };
}

function createRecordingExecutor(
  results: Readonly<Record<string, HookExecResult>>,
  calls: RecordedCall[],
): HookExecutor {
  return (entry, event) => {
    calls.push({ pluginId: entry.pluginId, event: structuredClone(event) });
    const result = results[entry.pluginId];
    if (result === undefined) {
      return Promise.reject(new Error(`unexpected executor entry: ${entry.pluginId}`));
    }

    return Promise.resolve(result);
  };
}

/** Resolve a deferred hook execution and fail clearly if it never started. */
function finishDeferredExecution(
  finish: ((result: HookExecResult) => void) | undefined,
  result: HookExecResult,
): void {
  if (finish === undefined) {
    throw new Error("the deferred hook executor did not start");
  }

  finish(result);
}

describe("compositeHandlerFor", () => {
  test("routes SessionStart context through only the supplied runtime", async () => {
    // arrange
    const owningRuntime = createHooksRuntime();
    const peerRuntime = createHooksRuntime();
    const capturedGeneration = owningRuntime.advanceGeneration();
    const entry = createRoutingEntry({
      pluginId: "session-owner",
      claudeEvent: "SessionStart",
      rawMatcher: "startup",
      declarationIndex: 0,
      scope: "project",
      marketplace: "owner-marketplace",
    });
    owningRuntime.setRoutingBucket("SessionStart", [entry]);
    peerRuntime.setRoutingBucket("SessionStart", [
      createRoutingEntry({
        pluginId: "peer-session",
        claudeEvent: "SessionStart",
        rawMatcher: "startup",
        declarationIndex: 0,
      }),
    ]);
    const context = createExtensionContext("/workspace/session-owner");
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "session-owner": { kind: "mutate", additionalContext: "owned context" } },
      executorCalls,
    );
    const handler = compositeHandlerFor(
      owningRuntime,
      "SessionStart",
      capturedGeneration,
      undefined,
      executor,
    );

    // act
    await handler({ source: "startup" }, context);

    // assert
    assert.deepStrictEqual(owningRuntime.pendingSessionStartContextEntries(), [
      {
        context: "owned context",
        scope: "project",
        marketplace: "owner-marketplace",
        pluginId: "session-owner",
      },
    ]);
    assert.deepStrictEqual(peerRuntime.pendingSessionStartContextEntries(), []);
    assert.deepStrictEqual(executorCalls, [
      {
        pluginId: "session-owner",
        event: { source: "startup" },
      },
    ]);
  });

  test("requires matcher and if agreement, then runs both mutations on one snapshot (D-CF5-09)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const cwd = "/workspace/dispatch-owner";
    const compileContext = { homedir: "/home/tester", cwd, projectRoot: cwd };
    const context = createExtensionContext(cwd);
    const matcherSkippedEntry = {
      scope: "user",
      marketplace: "dispatch-catalog",
      pluginId: "matcher-skipped",
      resolvedSource: asAbsolutePluginRoot("/plugins/matcher-skipped"),
      claudeEvent: "PreToolUse",
      matcher: parseMatcher("Read"),
      rawMatcher: "Read",
      handlerDecl: {
        type: "command",
        command: "printf matcher-skipped",
        timeout: 11,
        asyncRewake: false,
        if: "Bash(git status)",
      },
      declarationIndex: 0,
      ifPredicate: compileIfPredicate("Bash(git status)", "PreToolUse", compileContext),
    } satisfies RoutingEntry;
    const ifSkippedEntry = {
      scope: "user",
      marketplace: "dispatch-catalog",
      pluginId: "if-skipped",
      resolvedSource: asAbsolutePluginRoot("/plugins/if-skipped"),
      claudeEvent: "PreToolUse",
      matcher: parseMatcher("Bash"),
      rawMatcher: "Bash",
      handlerDecl: {
        type: "command",
        command: "printf if-skipped",
        timeout: 13,
        asyncRewake: false,
        if: "Bash(npm test)",
      },
      declarationIndex: 1,
      ifPredicate: compileIfPredicate("Bash(npm test)", "PreToolUse", compileContext),
    } satisfies RoutingEntry;
    const firstMutationEntry = {
      scope: "user",
      marketplace: "dispatch-catalog",
      pluginId: "first-mutation",
      resolvedSource: asAbsolutePluginRoot("/plugins/first-mutation"),
      claudeEvent: "PreToolUse",
      matcher: parseMatcher("Bash"),
      rawMatcher: "Bash",
      handlerDecl: {
        type: "command",
        command: "printf first-mutation",
        timeout: 17,
        asyncRewake: false,
        if: "Bash(git status)",
      },
      declarationIndex: 2,
      ifPredicate: compileIfPredicate("Bash(git status)", "PreToolUse", compileContext),
    } satisfies RoutingEntry;
    const secondMutationEntry = {
      scope: "user",
      marketplace: "dispatch-catalog",
      pluginId: "second-mutation",
      resolvedSource: asAbsolutePluginRoot("/plugins/second-mutation"),
      claudeEvent: "PreToolUse",
      matcher: parseMatcher("Bash"),
      rawMatcher: "Bash",
      handlerDecl: {
        type: "command",
        command: "printf second-mutation",
        timeout: 19,
        asyncRewake: false,
        if: "Bash(git status)",
      },
      declarationIndex: 3,
      ifPredicate: compileIfPredicate("Bash(git status)", "PreToolUse", compileContext),
    } satisfies RoutingEntry;
    const routingBucket = [
      matcherSkippedEntry,
      ifSkippedEntry,
      firstMutationEntry,
      secondMutationEntry,
    ] satisfies ReadonlyArray<RoutingEntry>;
    const event = {
      type: "tool_call",
      toolCallId: "dispatch-call",
      toolName: "bash",
      input: { command: "git status", original: "kept" },
    } satisfies ToolCallEvent;
    const firstMutation = {
      kind: "mutate",
      updatedInput: { firstMutation: "visible", shared: "first" },
    } satisfies HookExecResult;
    const secondMutation = {
      kind: "mutate",
      updatedInput: { secondMutation: "composed", shared: "second" },
    } satisfies HookExecResult;
    const executorCalls: ExecutorCall[] = [];
    const executorEntries: RoutingEntry[] = [];
    const executor: HookExecutor = (entry, observedEvent, observedContext, pi) => {
      executorEntries.push(entry);
      let returned: HookExecResult;
      if (entry.pluginId === "first-mutation") {
        returned = firstMutation;
      } else if (entry.pluginId === "second-mutation") {
        returned = secondMutation;
      } else {
        return Promise.reject(new Error(`unexpected executor entry: ${entry.pluginId}`));
      }

      executorCalls.push(recordExecutorCall(entry, observedEvent, observedContext, pi, returned));
      return Promise.resolve(returned);
    };

    runtime.setRoutingBucket("PreToolUse", routingBucket);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedExecutorEntries = [firstMutationEntry, secondMutationEntry];
    const expectedExecutorCalls: ExecutorCall[] = [
      {
        entry: {
          scope: "user",
          marketplace: "dispatch-catalog",
          pluginId: "first-mutation",
          resolvedSource: "/plugins/first-mutation",
          claudeEvent: "PreToolUse",
          matcher: { kind: "tool-set", toolNames: ["bash"] },
          rawMatcher: "Bash",
          handlerDecl: {
            type: "command",
            command: "printf first-mutation",
            timeout: 17,
            asyncRewake: false,
            if: "Bash(git status)",
          },
          declarationIndex: 2,
          ifPredicateKind: "bash",
        },
        event: {
          type: "tool_call",
          toolCallId: "dispatch-call",
          toolName: "bash",
          input: { command: "git status", original: "kept" },
        },
        context,
        pi: undefined,
        returned: {
          kind: "mutate",
          updatedInput: { firstMutation: "visible", shared: "first" },
        },
      },
      {
        entry: {
          scope: "user",
          marketplace: "dispatch-catalog",
          pluginId: "second-mutation",
          resolvedSource: "/plugins/second-mutation",
          claudeEvent: "PreToolUse",
          matcher: { kind: "tool-set", toolNames: ["bash"] },
          rawMatcher: "Bash",
          handlerDecl: {
            type: "command",
            command: "printf second-mutation",
            timeout: 19,
            asyncRewake: false,
            if: "Bash(git status)",
          },
          declarationIndex: 3,
          ifPredicateKind: "bash",
        },
        event: {
          type: "tool_call",
          toolCallId: "dispatch-call",
          toolName: "bash",
          input: { command: "git status", original: "kept" },
        },
        context,
        pi: undefined,
        returned: {
          kind: "mutate",
          updatedInput: { secondMutation: "composed", shared: "second" },
        },
      },
    ];
    const expectedEvent = {
      type: "tool_call",
      toolCallId: "dispatch-call",
      toolName: "bash",
      input: { secondMutation: "composed", shared: "second" },
    } satisfies ToolCallEvent;
    const expectedAdaptedOutput: CompositeReturnFor<"PreToolUse"> = undefined;

    // act
    const adaptedOutput = await handler(event, context);

    // assert
    assert.deepStrictEqual(adaptedOutput, expectedAdaptedOutput);
    assert.deepStrictEqual(event, expectedEvent);
    assert.deepStrictEqual(executorEntries, expectedExecutorEntries);
    assert.deepStrictEqual(executorCalls, expectedExecutorCalls);
  });
});

describe("matcherFiresOnClosedSetValue", () => {
  for (const { rawMatcher, value, expected } of [
    { rawMatcher: "", value: "startup", expected: true },
    { rawMatcher: "*", value: "reload", expected: true },
    { rawMatcher: "resume", value: "resume", expected: true },
    { rawMatcher: "fork", value: "startup", expected: false },
  ] as const) {
    test(`reports ${String(expected)} for raw matcher ${JSON.stringify(rawMatcher)}`, () => {
      // arrange
      const entry = createRoutingEntry({
        pluginId: `closed-${rawMatcher || "empty"}`,
        claudeEvent: "SessionStart",
        rawMatcher,
        declarationIndex: 0,
      });
      const expectedMatch = expected;

      // act
      const matches = matcherFiresOnClosedSetValue(entry, value);

      // assert
      assert.strictEqual(matches, expectedMatch);
    });
  }
});

describe("collectBucketOutcomes", () => {
  test("preserves matching observation order while degrading async rewake to noop", async () => {
    // arrange
    const runtime = createHooksRuntime();
    const cwd = "/workspace/dispatch-collection";
    const context = createExtensionContext(cwd);
    const compileContext = { homedir: "/home/tester", cwd, projectRoot: cwd };
    const matcherSkippedEntry = createRoutingEntry({
      pluginId: "matcher-skipped",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const ifSkippedEntry = createRoutingEntry({
      pluginId: "if-skipped",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 1,
      ifPredicate: compileIfPredicate("Bash(npm test)", "PreToolUse", compileContext),
    });
    const asyncEntry = createRoutingEntry({
      pluginId: "async-degraded",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 2,
      asyncRewake: true,
    });
    const firstNoopEntry = createRoutingEntry({
      pluginId: "first-noop",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 3,
    });
    const secondNoopEntry = createRoutingEntry({
      pluginId: "second-noop",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 4,
    });
    const blockEntry = createRoutingEntry({
      pluginId: "observed-block",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 5,
    });
    const stopEntry = createRoutingEntry({
      pluginId: "observed-stop",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 6,
    });
    const bucket = [
      matcherSkippedEntry,
      ifSkippedEntry,
      asyncEntry,
      firstNoopEntry,
      secondNoopEntry,
      blockEntry,
      stopEntry,
    ];
    const event = createToolCallEvent();
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "first-noop": { kind: "noop" },
        "second-noop": { kind: "noop" },
        "observed-block": { kind: "block", reason: "observe denial" },
        "observed-stop": { kind: "stop", stopReason: "observe stop" },
      },
      executorCalls,
    );
    const expectedOutcomes = [
      {
        entry: createRoutingEntry({
          pluginId: "async-degraded",
          claudeEvent: "PreToolUse",
          rawMatcher: "Bash",
          declarationIndex: 2,
          asyncRewake: true,
        }),
        result: { kind: "noop" },
      },
      {
        entry: createRoutingEntry({
          pluginId: "first-noop",
          claudeEvent: "PreToolUse",
          rawMatcher: "Bash",
          declarationIndex: 3,
        }),
        result: { kind: "noop" },
      },
      {
        entry: createRoutingEntry({
          pluginId: "second-noop",
          claudeEvent: "PreToolUse",
          rawMatcher: "Bash",
          declarationIndex: 4,
        }),
        result: { kind: "noop" },
      },
      {
        entry: createRoutingEntry({
          pluginId: "observed-block",
          claudeEvent: "PreToolUse",
          rawMatcher: "Bash",
          declarationIndex: 5,
        }),
        result: { kind: "block", reason: "observe denial" },
      },
      {
        entry: createRoutingEntry({
          pluginId: "observed-stop",
          claudeEvent: "PreToolUse",
          rawMatcher: "Bash",
          declarationIndex: 6,
        }),
        result: { kind: "stop", stopReason: "observe stop" },
      },
    ];
    const expectedExecutorCalls: RecordedCall[] = [
      { pluginId: "first-noop", event: createToolCallEvent() },
      { pluginId: "second-noop", event: createToolCallEvent() },
      { pluginId: "observed-block", event: createToolCallEvent() },
      { pluginId: "observed-stop", event: createToolCallEvent() },
    ];

    // act
    const outcomes = await collectBucketOutcomes(
      runtime,
      bucket,
      event,
      context,
      undefined,
      (entry) => entry.pluginId !== "matcher-skipped",
      executor,
    );

    // assert
    assert.deepStrictEqual(outcomes, expectedOutcomes);
    assert.deepStrictEqual(executorCalls, expectedExecutorCalls);
  });

  test("returns an empty outcome list for an empty bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    const context = createExtensionContext("/workspace/dispatch-empty-collection");
    const expectedOutcomes: readonly [] = [];

    // act
    const outcomes = await collectBucketOutcomes(
      runtime,
      [],
      { phase: "stop" },
      context,
      undefined,
      () => true,
    );

    // assert
    assert.deepStrictEqual(outcomes, expectedOutcomes);
  });

  test("returns no outcome when the generation changes while its hooks run", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/stale-outcome-collection");
    const bucket = [
      createRoutingEntry({
        pluginId: "awaited",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "parallel-peer",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
    ];
    const calls: string[] = [];
    let finishExecution: ((result: HookExecResult) => void) | undefined;
    const executor: HookExecutor = (entry) => {
      calls.push(entry.pluginId);
      if (entry.pluginId === "parallel-peer") {
        return Promise.resolve({ kind: "noop" });
      }

      return new Promise((resolve) => {
        finishExecution = resolve;
      });
    };

    const pending = collectBucketOutcomes(
      runtime,
      bucket,
      createToolCallEvent(),
      context,
      undefined,
      () => true,
      executor,
    );
    runtime.advanceGeneration();

    // act
    finishDeferredExecution(finishExecution, { kind: "noop" });
    const outcomes = await pending;

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(calls, ["awaited", "parallel-peer"]);
  });
});

describe("composite dispatch reduction", () => {
  test("keeps equal noop outcomes in stable declaration order", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-noops");
    const entries = [
      createRoutingEntry({
        pluginId: "noop-a",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 8,
      }),
      createRoutingEntry({
        pluginId: "noop-b",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 8,
      }),
      createRoutingEntry({
        pluginId: "noop-c",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 8,
      }),
    ];
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "noop-a": { kind: "noop" },
        "noop-b": { kind: "noop" },
        "noop-c": { kind: "noop" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;
    const expectedCalls: RecordedCall[] = [
      { pluginId: "noop-a", event: createToolCallEvent() },
      { pluginId: "noop-b", event: createToolCallEvent() },
      { pluginId: "noop-c", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("blocks with the first block in routing order after running every hook", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-block");
    const entries = [
      createRoutingEntry({
        pluginId: "leading-noop",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "first-block",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
      createRoutingEntry({
        pluginId: "later-block",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 2,
      }),
    ];
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "leading-noop": { kind: "noop" },
        "first-block": { kind: "block", reason: "first denial" },
        "later-block": { kind: "block", reason: "later denial" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = { block: true, reason: "PreToolUse:Bash hook error: first denial" };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "leading-noop", event: createToolCallEvent() },
      { pluginId: "first-block", event: createToolCallEvent() },
      { pluginId: "later-block", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("folds a stop over a later block after running every hook", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-stop");
    const entries = [
      createRoutingEntry({
        pluginId: "first-stop",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "later-block",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
    ];
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "first-stop": { kind: "stop", stopReason: "stop now" },
        "later-block": { kind: "block", reason: "later denial" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = {
      block: true,
      reason: "stop now",
      terminate: true,
    };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "first-stop", event: createToolCallEvent() },
      { pluginId: "later-block", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("applies the last input rewrite in routing order to the snapshot both hooks read", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-mutations");
    const entries = [
      createRoutingEntry({
        pluginId: "mutation-a",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "mutation-b",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
    ];
    const event = createToolCallEvent("bash", { command: "git status", preserved: true });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "mutation-a": { kind: "mutate", updatedInput: { first: 1, shared: "first" } },
        "mutation-b": { kind: "mutate", updatedInput: { second: 2, shared: "second" } },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedEvent = createToolCallEvent("bash", { second: 2, shared: "second" });
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "mutation-a",
        event: createToolCallEvent("bash", { command: "git status", preserved: true }),
      },
      {
        pluginId: "mutation-b",
        event: createToolCallEvent("bash", { command: "git status", preserved: true }),
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(event, expectedEvent);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });
});

describe("composite dispatch closure partitions", () => {
  test("returns undefined from a stale composite closure without dispatching", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-stale");
    const entry = createRoutingEntry({
      pluginId: "stale-entry",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor(runtime, "PreToolUse", runtime.currentGeneration());
    runtime.advanceGeneration();
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("drops a tool-input mutation when its executor becomes stale while awaited", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-stale-await");
    const entry = createRoutingEntry({
      pluginId: "stale-await-entry",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("PreToolUse", [entry]);
    let finishExecution: ((result: HookExecResult) => void) | undefined;
    const executor: HookExecutor = () =>
      new Promise((resolve) => {
        finishExecution = resolve;
      });
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const event = createToolCallEvent();
    const pending = handler(event, context);
    runtime.advanceGeneration();

    // act
    finishDeferredExecution(finishExecution, {
      kind: "mutate",
      updatedInput: { command: "stale command" },
    });
    const output = await pending;

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(event, createToolCallEvent());
  });

  test("drops SessionStart context when its executor becomes stale while awaited", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/session-stale-await");
    const entry = createRoutingEntry({
      pluginId: "stale-session-entry",
      claudeEvent: "SessionStart",
      rawMatcher: "startup",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("SessionStart", [entry]);
    let finishExecution: ((result: HookExecResult) => void) | undefined;
    const executor: HookExecutor = () =>
      new Promise((resolve) => {
        finishExecution = resolve;
      });
    const handler = compositeHandlerFor(
      runtime,
      "SessionStart",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const pending = handler({ source: "startup" }, context);
    runtime.advanceGeneration();

    // act
    finishDeferredExecution(finishExecution, {
      kind: "mutate",
      additionalContext: "stale context",
    });
    await pending;

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), []);
  });

  test("returns undefined from a live composite closure with an empty bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-empty");
    const handler = compositeHandlerFor(runtime, "PreToolUse", runtime.currentGeneration());
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("dispatches only match-all and exact MCP tool matchers", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-tool-matchers");
    const entries = [
      createRoutingEntry({
        pluginId: "match-all",
        claudeEvent: "PreToolUse",
        rawMatcher: "*",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "tool-set-miss",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
      createRoutingEntry({
        pluginId: "mcp-exact",
        claudeEvent: "PreToolUse",
        rawMatcher: "mcp__catalog__fetch",
        declarationIndex: 2,
      }),
      createRoutingEntry({
        pluginId: "mcp-miss",
        claudeEvent: "PreToolUse",
        rawMatcher: "mcp__catalog__publish",
        declarationIndex: 3,
      }),
      createRoutingEntry({
        pluginId: "regex-miss",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash.*",
        declarationIndex: 4,
      }),
      createRoutingEntry({
        pluginId: "unmapped-miss",
        claudeEvent: "PreToolUse",
        rawMatcher: "UnknownTool",
        declarationIndex: 5,
      }),
    ];
    const event = createToolCallEvent("mcp__catalog__fetch", { query: "hooks" });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "match-all": { kind: "noop" },
        "mcp-exact": { kind: "noop" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "match-all",
        event: createToolCallEvent("mcp__catalog__fetch", { query: "hooks" }),
      },
      {
        pluginId: "mcp-exact",
        event: createToolCallEvent("mcp__catalog__fetch", { query: "hooks" }),
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  for (const { toolName, fires } of [
    { toolName: "write", fires: true },
    { toolName: "edit", fires: true },
    { toolName: "bash", fires: false },
    { toolName: "apply_patch", fires: false },
  ]) {
    test(`${fires ? "dispatches" : "does not dispatch"} toolName "${toolName}" for the pipe-OR matcher "Write|Edit|apply_patch" (#217)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/dispatch-pipe-or");
      const entry = createRoutingEntry({
        pluginId: "pipe-or-write-edit",
        claudeEvent: "PreToolUse",
        rawMatcher: "Write|Edit|apply_patch",
        declarationIndex: 0,
      });
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        { "pipe-or-write-edit": { kind: "noop" } },
        executorCalls,
      );
      runtime.setRoutingBucket("PreToolUse", [entry]);
      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        executor,
      );
      const expectedCalls: RecordedCall[] = fires
        ? [{ pluginId: "pipe-or-write-edit", event: createToolCallEvent(toolName) }]
        : [];

      // act
      await handler(createToolCallEvent(toolName), context);

      // assert
      assert.deepStrictEqual(executorCalls, expectedCalls);
    });
  }

  for (const { toolName, firingPluginIds } of [
    {
      toolName: "mcp__plugin_acme_db__query",
      firingPluginIds: ["server-prefix", "prefix-or-write"],
    },
    { toolName: "mcp__plugin_acme_db2__query", firingPluginIds: [] },
    { toolName: "mcp", firingPluginIds: [] },
    { toolName: "write", firingPluginIds: ["prefix-or-write"] },
  ]) {
    test(`ANAME-02: a server-prefix matcher fires on the delivered plugin tool and on nothing else (toolName "${toolName}")`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/dispatch-server-prefix");
      const entries = [
        createRoutingEntry({
          pluginId: "server-prefix",
          claudeEvent: "PreToolUse",
          rawMatcher: "mcp__plugin_acme_db__.*",
          declarationIndex: 0,
        }),
        createRoutingEntry({
          pluginId: "prefix-or-write",
          claudeEvent: "PreToolUse",
          rawMatcher: "mcp__plugin_acme_db__.*|Write",
          declarationIndex: 1,
        }),
        createRoutingEntry({
          pluginId: "case-mismatch",
          claudeEvent: "PreToolUse",
          rawMatcher: "mcp__Plugin_acme_db__.*",
          declarationIndex: 2,
        }),
      ];
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        {
          "server-prefix": { kind: "noop" },
          "prefix-or-write": { kind: "noop" },
          "case-mismatch": { kind: "noop" },
        },
        executorCalls,
      );
      runtime.setRoutingBucket("PreToolUse", entries);
      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        executor,
      );
      const expectedCalls: RecordedCall[] = firingPluginIds.map((pluginId) => ({
        pluginId,
        event: createToolCallEvent(toolName, { query: "hooks" }),
      }));

      // act
      await handler(createToolCallEvent(toolName, { query: "hooks" }), context);

      // assert
      assert.deepStrictEqual(executorCalls, expectedCalls);
    });
  }

  test("does not dispatch any tool_call when every pipe-OR alternative is discarded (#217)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pipe-or-unmapped");
    const entry = createRoutingEntry({
      pluginId: "pipe-or-fully-discarded",
      claudeEvent: "PreToolUse",
      rawMatcher: "apply_patch|MultiEdit",
      declarationIndex: 0,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "pipe-or-fully-discarded": { kind: "noop" } },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedCalls: RecordedCall[] = [];

    // act
    await handler(createToolCallEvent("bash"), context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("dispatches SessionStart empty, star, and exact raw matchers in declaration order", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-session-matchers");
    const entries = [
      createRoutingEntry({
        pluginId: "session-empty",
        claudeEvent: "SessionStart",
        rawMatcher: "",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "session-star",
        claudeEvent: "SessionStart",
        rawMatcher: "*",
        declarationIndex: 1,
      }),
      createRoutingEntry({
        pluginId: "session-exact",
        claudeEvent: "SessionStart",
        rawMatcher: "resume",
        declarationIndex: 2,
      }),
      createRoutingEntry({
        pluginId: "session-miss",
        claudeEvent: "SessionStart",
        rawMatcher: "fork",
        declarationIndex: 3,
      }),
    ];
    const event = { source: "resume" } satisfies ClaudeSessionStartEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "session-empty": { kind: "noop" },
        "session-star": { kind: "noop" },
        "session-exact": { kind: "noop" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("SessionStart", entries);
    const handler = compositeHandlerFor(
      runtime,
      "SessionStart",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedCalls: RecordedCall[] = [
      { pluginId: "session-empty", event: { source: "resume" } },
      { pluginId: "session-star", event: { source: "resume" } },
      { pluginId: "session-exact", event: { source: "resume" } },
    ];
    const expectedPendingContext: readonly [] = [];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), expectedPendingContext);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  for (const { source, expectedPluginIds } of [
    { source: "clear", expectedPluginIds: ["session-any", "session-clear"] },
    { source: "startup", expectedPluginIds: ["session-any", "session-startup"] },
  ] as const) {
    test(`filters SessionStart matchers on the Claude-side source ${source} (D-CF5-01)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/dispatch-session-source");
      runtime.setRoutingBucket("SessionStart", [
        createRoutingEntry({
          pluginId: "session-any",
          claudeEvent: "SessionStart",
          rawMatcher: "*",
          declarationIndex: 0,
        }),
        createRoutingEntry({
          pluginId: "session-clear",
          claudeEvent: "SessionStart",
          rawMatcher: "clear",
          declarationIndex: 1,
        }),
        createRoutingEntry({
          pluginId: "session-startup",
          claudeEvent: "SessionStart",
          rawMatcher: "startup",
          declarationIndex: 2,
        }),
      ]);
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        {
          "session-any": { kind: "noop" },
          "session-clear": { kind: "noop" },
          "session-startup": { kind: "noop" },
        },
        executorCalls,
      );
      const handler = compositeHandlerFor(
        runtime,
        "SessionStart",
        runtime.currentGeneration(),
        undefined,
        executor,
      );

      // act
      await handler({ source }, context);

      // assert
      assert.deepStrictEqual(
        executorCalls,
        expectedPluginIds.map((pluginId) => ({ pluginId, event: { source } })),
      );
    });
  }

  for (const { reason, expectedPluginIds } of [
    { reason: "other", expectedPluginIds: ["session-end-empty", "session-end-other"] },
    { reason: "clear", expectedPluginIds: ["session-end-empty", "session-end-clear"] },
  ] as const) {
    test(`filters SessionEnd matchers on the Claude-side reason ${reason} (D-CF5-02)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/dispatch-session-reason");
      runtime.setRoutingBucket("SessionEnd", [
        createRoutingEntry({
          pluginId: "session-end-empty",
          claudeEvent: "SessionEnd",
          rawMatcher: "",
          declarationIndex: 0,
        }),
        createRoutingEntry({
          pluginId: "session-end-other",
          claudeEvent: "SessionEnd",
          rawMatcher: "other",
          declarationIndex: 1,
        }),
        createRoutingEntry({
          pluginId: "session-end-clear",
          claudeEvent: "SessionEnd",
          rawMatcher: "clear",
          declarationIndex: 2,
        }),
      ]);
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        {
          "session-end-empty": { kind: "noop" },
          "session-end-other": { kind: "noop" },
          "session-end-clear": { kind: "noop" },
        },
        executorCalls,
      );
      const handler = compositeHandlerFor(
        runtime,
        "SessionEnd",
        runtime.currentGeneration(),
        undefined,
        executor,
      );

      // act
      await handler({ reason }, context);

      // assert
      assert.deepStrictEqual(
        executorCalls,
        expectedPluginIds.map((pluginId) => ({ pluginId, event: { reason } })),
      );
    });
  }
});

describe("toolResultCompositeHandler", () => {
  test("returns undefined from a stale tool-result closure without dispatching", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-stale");
    const entry = createRoutingEntry({
      pluginId: "stale-result",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(runtime, runtime.currentGeneration());
    runtime.advanceGeneration();
    const expectedOutput = undefined;

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("drops a tool-result decision when its executor becomes stale while awaited", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-stale-await");
    const entry = createRoutingEntry({
      pluginId: "stale-result-await",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("PostToolUse", [entry]);
    let finishExecution: ((result: HookExecResult) => void) | undefined;
    const executor: HookExecutor = () =>
      new Promise((resolve) => {
        finishExecution = resolve;
      });
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const event = createToolResultEvent(false);
    const pending = handler(event, context);
    runtime.advanceGeneration();

    // act
    finishDeferredExecution(finishExecution, { kind: "block", reason: "stale block" });
    const output = await pending;

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(event, createToolResultEvent(false));
  });

  test("returns undefined from a live tool-result closure with an empty bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-empty");
    const handler = toolResultCompositeHandler(runtime, runtime.currentGeneration());
    const expectedOutput = undefined;

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("routes a successful result only through the PostToolUse bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-success");
    const successEntry = createRoutingEntry({
      pluginId: "success-observer",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const failureEntry = createRoutingEntry({
      pluginId: "failure-observer",
      claudeEvent: "PostToolUseFailure",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const event = createToolResultEvent(false);
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "success-observer": { kind: "noop" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PostToolUse", [successEntry]);
    runtime.setRoutingBucket("PostToolUseFailure", [failureEntry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedCalls: RecordedCall[] = [
      { pluginId: "success-observer", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("routes a failed result only through the PostToolUseFailure bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-failure");
    const successEntry = createRoutingEntry({
      pluginId: "success-observer",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const failureEntry = createRoutingEntry({
      pluginId: "failure-observer",
      claudeEvent: "PostToolUseFailure",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const event = createToolResultEvent(true);
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "failure-observer": { kind: "noop" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PostToolUse", [successEntry]);
    runtime.setRoutingBucket("PostToolUseFailure", [failureEntry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedCalls: RecordedCall[] = [
      { pluginId: "failure-observer", event: createToolResultEvent(true) },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("adapts a block without a reason to the tool output and the default feedback", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-block-empty");
    const entry = createRoutingEntry({
      pluginId: "block-empty",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor({ "block-empty": { kind: "block" } }, executorCalls);
    runtime.setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = {
      content: [
        { type: "text", text: "original output" },
        {
          type: "text",
          text: 'PostToolUse:Bash hook blocking error from command: "printf block-empty": Blocked by hook',
        },
      ],
    };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "block-empty", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("adapts the first reasoned block after running every tool-result entry", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-block");
    const firstEntry = createRoutingEntry({
      pluginId: "block-first",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const laterEntry = createRoutingEntry({
      pluginId: "block-later",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 1,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "block-first": { kind: "block", reason: "tool denied" },
        "block-later": { kind: "block", reason: "later denial" },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PostToolUse", [firstEntry, laterEntry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = {
      content: [
        { type: "text", text: "original output" },
        {
          type: "text",
          text: 'PostToolUse:Bash hook blocking error from command: "printf block-first": tool denied',
        },
      ],
    };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "block-first", event: createToolResultEvent(false) },
      { pluginId: "block-later", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("applies a tool-output mutation through the selected result bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-mutate");
    const entry = createRoutingEntry({
      pluginId: "result-mutation",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const event = createToolResultEvent(false);
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "result-mutation": {
          kind: "mutate",
          updatedToolOutput: {
            content: [{ type: "text", text: "patched output" }],
            isError: true,
            toolName: "must-not-change",
          },
        },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedEvent: ToolResultEvent = {
      type: "tool_result",
      toolCallId: "dispatch-call",
      toolName: "bash",
      input: { command: "git status" },
      content: [{ type: "text", text: "patched output" }],
      isError: true,
      details: undefined,
    };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "result-mutation", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(event, expectedEvent);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a tool-result stop after terminating the bucket", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/tool-result-stop");
    const entry = createRoutingEntry({
      pluginId: "result-stop",
      claudeEvent: "PostToolUseFailure",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "result-stop": { kind: "stop", stopReason: "result stop" } },
      executorCalls,
    );
    runtime.setRoutingBucket("PostToolUseFailure", [entry]);
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedCalls: RecordedCall[] = [
      { pluginId: "result-stop", event: createToolResultEvent(true) },
    ];

    // act
    const output = await handler(createToolResultEvent(true), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });
});

describe("composite per-event adapters", () => {
  test("adapts a PreToolUse block without a reason to Claude Code's default hook error", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/pre-tool-block-empty");
    const entry = createRoutingEntry({
      pluginId: "pre-tool-block-empty",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "pre-tool-block-empty": { kind: "block" } },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = { block: true, reason: "PreToolUse:Bash hook error: Blocked by hook" };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "pre-tool-block-empty", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("names the blocking hook's command before an exit-2 stderr reason (D-CF5-11)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/pre-tool-block-stderr");
    const entries = [
      createRoutingEntry({
        pluginId: "quiet-observer",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "stderr-guard",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
    ];
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "quiet-observer": { kind: "noop" },
        "stderr-guard": { kind: "block", reason: "blocked by policy", fromStderr: true },
      },
      executorCalls,
    );
    runtime.setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, {
      block: true,
      reason: "PreToolUse:Bash hook error: [printf stderr-guard]: blocked by policy",
    });
  });

  test("adapts a UserPromptSubmit block to handled", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/input-block");
    const entry = createRoutingEntry({
      pluginId: "input-block",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "input",
      text: "review hooks",
      source: "interactive",
    } satisfies InputEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "input-block": { kind: "block", reason: "handled upstream" } },
      executorCalls,
    );
    runtime.setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = { action: "handled" };
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "input-block",
        event: { type: "input", text: "review hooks", source: "interactive" },
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a UserPromptSubmit mutation without additional context", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/input-mutation-empty");
    const entry = createRoutingEntry({
      pluginId: "input-mutation-empty",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "input",
      text: "review hooks",
      source: "extension",
    } satisfies InputEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "input-mutation-empty": { kind: "mutate", updatedInput: { ignored: true } } },
      executorCalls,
    );
    runtime.setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "input-mutation-empty",
        event: { type: "input", text: "review hooks", source: "extension" },
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("stops the prompt on a UserPromptSubmit continue false (D-CF5-11)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/input-stop");
    const entry = createRoutingEntry({
      pluginId: "input-stop",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "input",
      text: "review hooks",
      source: "interactive",
    } satisfies InputEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "input-stop": { kind: "stop", stopReason: "input stop" } },
      executorCalls,
    );
    runtime.setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = { action: "handled" };
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "input-stop",
        event: { type: "input", text: "review hooks", source: "interactive" },
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("passes a UserPromptSubmit noop through as undefined", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/input-noop");
    const entry = createRoutingEntry({
      pluginId: "input-noop",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "input",
      text: "review hooks",
      source: "interactive",
    } satisfies InputEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor({ "input-noop": { kind: "noop" } }, executorCalls);
    runtime.setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedOutput = undefined;
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "input-noop",
        event: { type: "input", text: "review hooks", source: "interactive" },
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("captures SessionStart context with the producing entry provenance", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/session-start-provenance");
    const entry = createRoutingEntry({
      pluginId: "session-context",
      claudeEvent: "SessionStart",
      rawMatcher: "startup",
      declarationIndex: 0,
      scope: "project",
      marketplace: "project-hooks",
    });
    const event = { source: "startup" } satisfies ClaudeSessionStartEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "session-context": { kind: "mutate", additionalContext: "project guidance" } },
      executorCalls,
    );
    runtime.setRoutingBucket("SessionStart", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "SessionStart",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedPendingContext = [
      {
        context: "project guidance",
        scope: "project",
        marketplace: "project-hooks",
        pluginId: "session-context",
      },
    ];
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "session-context",
        event: { source: "startup" },
      },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), expectedPendingContext);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a SessionEnd block after observing it", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/session-end-block");
    const entry = createRoutingEntry({
      pluginId: "session-end-block",
      claudeEvent: "SessionEnd",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = { reason: "other" } satisfies ClaudeSessionEndEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "session-end-block": { kind: "block", reason: "ignored block" } },
      executorCalls,
    );
    runtime.setRoutingBucket("SessionEnd", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "SessionEnd",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "session-end-block",
        event: { reason: "other" },
      },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  for (const { reason, expectedPluginIds } of [
    { reason: "manual", expectedPluginIds: ["pre-any", "pre-manual"] },
    { reason: "threshold", expectedPluginIds: ["pre-any", "pre-auto"] },
    { reason: "overflow", expectedPluginIds: ["pre-any", "pre-auto"] },
  ] as const) {
    test(`filters PreCompact matchers on the trigger of a ${reason} compaction (D-CF5-04)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/pre-compact-trigger");
      runtime.setRoutingBucket(
        "PreCompact",
        ["pre-any", "pre-manual", "pre-auto"].map((pluginId, declarationIndex) =>
          createRoutingEntry({
            pluginId,
            claudeEvent: "PreCompact",
            rawMatcher: ["*", "manual", "auto"][declarationIndex] ?? "",
            declarationIndex,
          }),
        ),
      );
      const event = {
        type: "session_before_compact",
        preparation: {
          firstKeptEntryId: "kept-entry",
          messagesToSummarize: [],
          turnPrefixMessages: [],
          isSplitTurn: false,
          tokensBefore: 256,
          fileOps: {
            read: new Set<string>(),
            written: new Set<string>(),
            edited: new Set<string>(),
          },
          settings: { enabled: true, reserveTokens: 100, keepRecentTokens: 50 },
        },
        branchEntries: [],
        reason,
        willRetry: false,
        signal: new AbortController().signal,
      } satisfies SessionBeforeCompactEvent;
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        {
          "pre-any": { kind: "noop" },
          "pre-manual": { kind: "noop" },
          "pre-auto": { kind: "noop" },
        },
        executorCalls,
      );
      const handler = compositeHandlerFor(
        runtime,
        "PreCompact",
        runtime.currentGeneration(),
        undefined,
        executor,
      );

      // act
      await handler(event, context);

      // assert
      assert.deepStrictEqual(
        executorCalls,
        expectedPluginIds.map((pluginId) => ({ pluginId, event: structuredClone(event) })),
      );
    });
  }

  for (const { reason, expectedPluginIds } of [
    { reason: "manual", expectedPluginIds: ["post-any", "post-manual"] },
    { reason: "threshold", expectedPluginIds: ["post-any", "post-auto"] },
    { reason: "overflow", expectedPluginIds: ["post-any", "post-auto"] },
  ] as const) {
    test(`filters PostCompact matchers on the trigger of a ${reason} compaction (D-CF5-04)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const context = createExtensionContext("/workspace/post-compact-trigger");
      runtime.setRoutingBucket(
        "PostCompact",
        ["post-any", "post-manual", "post-auto"].map((pluginId, declarationIndex) =>
          createRoutingEntry({
            pluginId,
            claudeEvent: "PostCompact",
            rawMatcher: ["", "manual", "auto"][declarationIndex] ?? "",
            declarationIndex,
          }),
        ),
      );
      const event = {
        type: "session_compact",
        compactionEntry: {
          type: "compaction",
          id: "compaction-trigger",
          parentId: "parent-entry",
          timestamp: "2026-08-31T12:00:00.000Z",
          summary: "trigger summary",
          firstKeptEntryId: "kept-entry",
          tokensBefore: 256,
        },
        fromExtension: false,
        reason,
        willRetry: false,
      } satisfies SessionCompactEvent;
      const executorCalls: RecordedCall[] = [];
      const executor = createRecordingExecutor(
        {
          "post-any": { kind: "noop" },
          "post-manual": { kind: "noop" },
          "post-auto": { kind: "noop" },
        },
        executorCalls,
      );
      const handler = compositeHandlerFor(
        runtime,
        "PostCompact",
        runtime.currentGeneration(),
        undefined,
        executor,
      );

      // act
      await handler(event, context);

      // assert
      assert.deepStrictEqual(
        executorCalls,
        expectedPluginIds.map((pluginId) => ({ pluginId, event: structuredClone(event) })),
      );
    });
  }

  test("drops a PreCompact stop after observing it", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/pre-compact-stop");
    const entry = createRoutingEntry({
      pluginId: "pre-compact-stop",
      claudeEvent: "PreCompact",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const abortController = new AbortController();
    const event = {
      type: "session_before_compact",
      preparation: {
        firstKeptEntryId: "kept-entry",
        messagesToSummarize: [],
        turnPrefixMessages: [],
        isSplitTurn: false,
        tokensBefore: 256,
        fileOps: { read: new Set<string>(), written: new Set<string>(), edited: new Set<string>() },
        settings: { enabled: true, reserveTokens: 100, keepRecentTokens: 50 },
      },
      branchEntries: [],
      customInstructions: "focus on hooks",
      reason: "manual",
      willRetry: false,
      signal: abortController.signal,
    } satisfies SessionBeforeCompactEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "pre-compact-stop": { kind: "stop", stopReason: "ignored stop" } },
      executorCalls,
    );
    runtime.setRoutingBucket("PreCompact", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "PreCompact",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedCalls: RecordedCall[] = [
      { pluginId: "pre-compact-stop", event: structuredClone(event) },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("passes a PostCompact noop through after observing it", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/post-compact-noop");
    const entry = createRoutingEntry({
      pluginId: "post-compact-noop",
      claudeEvent: "PostCompact",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "session_compact",
      compactionEntry: {
        type: "compaction",
        id: "compaction-entry",
        parentId: "parent-entry",
        timestamp: "2026-08-31T12:00:00.000Z",
        summary: "hook summary",
        firstKeptEntryId: "kept-entry",
        tokensBefore: 256,
      },
      fromExtension: false,
      reason: "threshold",
      willRetry: false,
    } satisfies SessionCompactEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "post-compact-noop": { kind: "noop" } },
      executorCalls,
    );
    runtime.setRoutingBucket("PostCompact", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "PostCompact",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const expectedCalls: RecordedCall[] = [
      { pluginId: "post-compact-noop", event: structuredClone(event) },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });
});

/**
 * A real `ExtensionAPI` value for the optional `pi` collaborator. Every member
 * throws on call: `dispatch.ts` forwards the inventory to the executor and
 * never reads it, so a read from inside dispatch is itself the defect this
 * value detects.
 */
function createPiInventory(): ExtensionAPI {
  return {
    on(_event: string, _handler: unknown): void {
      throw new Error("composite dispatch must not register Pi listeners");
    },
    sendMessage(_message: unknown, _options: unknown): void {
      throw new Error("composite dispatch must not send Pi messages");
    },
  } as ExtensionAPI;
}

/** Records the inventory each dispatch hands its executor, in call order. */
function createPiObservingExecutor(observed: Array<ExtensionAPI | undefined>): HookExecutor {
  return (_entry, _event, _context, pi) => {
    observed.push(pi);
    return Promise.resolve({ kind: "noop" });
  };
}

/** Collects the OBS-01 debug lines a case's dispatch emits, restoring the flag after. */
function observeHookDebug(t: TestContext): () => string[] {
  const previous = {
    existed: Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG"),
    value: process.env.PI_CLAUDE_MARKETPLACE_DEBUG,
  };
  t.after(() => {
    if (previous.existed && previous.value !== undefined) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous.value;
    } else {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (diagnostic: unknown) => {
    diagnostics.push(String(diagnostic));
  });
  return () => [...diagnostics];
}

describe("optional Pi inventory collaborator", () => {
  test("compositeHandlerFor hands a supplied inventory to the executor and undefined without one", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pi-composite");
    runtime.setRoutingBucket("PreToolUse", [
      createRoutingEntry({
        pluginId: "pi-observer",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
    ]);
    const inventory = createPiInventory();
    const observed: Array<ExtensionAPI | undefined> = [];
    const executor = createPiObservingExecutor(observed);
    const withInventory = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      inventory,
      executor,
    );
    const withoutInventory = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    const suppliedOutput = await withInventory(createToolCallEvent(), context);
    const omittedOutput = await withoutInventory(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual([suppliedOutput, omittedOutput], [undefined, undefined]);
    assert.strictEqual(observed.length, 2);
    assert.strictEqual(observed[0], inventory);
    assert.strictEqual(observed[1], undefined);
  });

  test("toolResultCompositeHandler hands a supplied inventory to the executor and undefined without one", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pi-tool-result");
    runtime.setRoutingBucket("PostToolUse", [
      createRoutingEntry({
        pluginId: "pi-result-observer",
        claudeEvent: "PostToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
    ]);
    const inventory = createPiInventory();
    const observed: Array<ExtensionAPI | undefined> = [];
    const executor = createPiObservingExecutor(observed);
    const withInventory = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      inventory,
      executor,
    );
    const withoutInventory = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    const suppliedOutput = await withInventory(createToolResultEvent(false), context);
    const omittedOutput = await withoutInventory(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual([suppliedOutput, omittedOutput], [undefined, undefined]);
    assert.strictEqual(observed.length, 2);
    assert.strictEqual(observed[0], inventory);
    assert.strictEqual(observed[1], undefined);
  });

  test("collectBucketOutcomes hands a supplied inventory to the executor and undefined without one", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pi-outcomes");
    const bucket = [
      createRoutingEntry({
        pluginId: "pi-outcome-observer",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
    ];
    const inventory = createPiInventory();
    const observed: Array<ExtensionAPI | undefined> = [];
    const executor = createPiObservingExecutor(observed);
    const event = createToolCallEvent();

    // act
    const suppliedOutcomes = await collectBucketOutcomes(
      runtime,
      bucket,
      event,
      context,
      inventory,
      () => true,
      executor,
    );
    const omittedOutcomes = await collectBucketOutcomes(
      runtime,
      bucket,
      event,
      context,
      undefined,
      () => true,
      executor,
    );

    // assert
    assert.deepStrictEqual(suppliedOutcomes, omittedOutcomes);
    assert.strictEqual(observed.length, 2);
    assert.strictEqual(observed[0], inventory);
    assert.strictEqual(observed[1], undefined);
  });

  test("refuses an asyncRewake spawn through its own executor default when no inventory is supplied", async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pi-async-rewake");
    runtime.setRoutingBucket("PreToolUse", [
      createRoutingEntry({
        pluginId: "async-rewake-plugin",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
        asyncRewake: true,
      }),
    ]);
    const readDiagnostics = observeHookDebug(t);
    // No executor: the module's own `dispatchHookExec` default runs, which is
    // where an absent inventory stops being a forwarded value and starts
    // deciding whether the async lane may spawn at all.
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
    );

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(readDiagnostics(), [
      "[hooks] async-rewake: pi missing on async dispatch (async-rewake-plugin/PreToolUse); skipping spawn",
    ]);
  });

  test("propagates a rejecting executor rather than absorbing it into the reducer", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const context = createExtensionContext("/workspace/dispatch-pi-throwing-executor");
    runtime.setRoutingBucket("PreToolUse", [
      createRoutingEntry({
        pluginId: "throwing-executor-plugin",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
    ]);
    // The never-throws contract belongs to `dispatchHookExec`, the default this
    // seam is defaulted to. A caller that substitutes a rejecting executor is
    // outside that contract, and the reducer says so instead of hiding it.
    const executor: HookExecutor = () => Promise.reject(new Error("injected executor refused"));
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      createPiInventory(),
      executor,
    );

    // act & assert
    await assert.rejects(handler(createToolCallEvent(), context), {
      message: "injected executor refused",
    });
  });
});

// Starts every hook and holds its result until the case finishes it, so a
// case decides the order the hooks finish in.
function createHeldExecutor(started: string[]): {
  readonly executor: HookExecutor;
  readonly finish: (pluginId: string, result: HookExecResult) => void;
} {
  const pending = new Map<string, (result: HookExecResult) => void>();
  return {
    executor: (entry) => {
      started.push(entry.pluginId);
      return new Promise((resolve) => {
        pending.set(entry.pluginId, resolve);
      });
    },
    finish: (pluginId, result) => {
      finishDeferredExecution(pending.get(pluginId), result);
    },
  };
}

// Lets the started executors reach their held promises.
async function settleStartedHooks(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function preToolUseEntries(pluginIds: readonly string[]): RoutingEntry[] {
  return pluginIds.map((pluginId, declarationIndex) =>
    createRoutingEntry({
      pluginId,
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex,
    }),
  );
}

describe("parallel run and routing-order fold", () => {
  test(
    "starts every matching hook before any finishes (D-CF5-09)",
    { timeout: 5_000 },
    async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["left", "right"]));
      const gates = new Map<string, () => void>();
      const met = (pluginId: string): Promise<void> =>
        new Promise((resolve) => {
          gates.set(pluginId, resolve);
        });
      const leftMet = met("left");
      const rightMet = met("right");
      const executor: HookExecutor = async (entry) => {
        const [own, other] = entry.pluginId === "left" ? ["left", rightMet] : ["right", leftMet];
        gates.get(own)?.();
        await other;
        return { kind: "noop" };
      };

      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        executor,
      );

      // act
      const output = await handler(
        createToolCallEvent(),
        createExtensionContext("/workspace/meet"),
      );

      // assert
      assert.strictEqual(output, undefined);
    },
  );

  test("blocks with the first block in routing order whatever order the hooks finish in", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["quiet", "first", "second"]));
    const started: string[] = [];
    const held = createHeldExecutor(started);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      held.executor,
    );

    // act
    const pending = handler(createToolCallEvent(), createExtensionContext("/workspace/reverse"));
    await settleStartedHooks();
    held.finish("second", { kind: "block", reason: "r2", fromStderr: true });
    held.finish("first", { kind: "block", reason: "r1", fromStderr: true });
    held.finish("quiet", { kind: "noop" });
    const output = await pending;

    // assert
    assert.deepStrictEqual(started, ["quiet", "first", "second"]);
    assert.deepStrictEqual(output, {
      block: true,
      reason: "PreToolUse:Bash hook error: [printf first]: r1",
    });
  });

  test("lets a block win over an earlier ask (D-CF5-09)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["asker", "denier"]));
    const executor = createRecordingExecutor(
      {
        asker: { kind: "mutate", permissionDecision: "ask", permissionDecisionReason: "sure?" },
        denier: { kind: "block", reason: "no" },
      },
      [],
    );
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    const output = await handler(createToolCallEvent(), createExtensionContext("/workspace/ask"));

    // assert
    assert.deepStrictEqual(output, { block: true, reason: "PreToolUse:Bash hook error: no" });
  });

  test("lets a block win over a mutation that adds context", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const entries = ["context", "blocker"].map((pluginId, declarationIndex) =>
      createRoutingEntry({
        pluginId,
        claudeEvent: "UserPromptSubmit",
        rawMatcher: "",
        declarationIndex,
      }),
    );
    runtime.setRoutingBucket("UserPromptSubmit", entries);
    const executor = createRecordingExecutor(
      {
        context: { kind: "mutate", additionalContext: "a" },
        blocker: { kind: "block", reason: "no", additionalContext: "b" },
      },
      [],
    );
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    const output = await handler(
      { type: "input", text: "hello", source: "interactive" },
      createExtensionContext("/workspace/context-block"),
    );

    // assert
    assert.deepStrictEqual(output, { action: "handled" });
  });

  test("joins every hook's context in routing order whatever order they finish in", async () => {
    // arrange
    const runtime = createHooksRuntime();
    const generation = runtime.advanceGeneration();
    const entries = ["early", "silent", "late"].map((pluginId, declarationIndex) =>
      createRoutingEntry({
        pluginId,
        claudeEvent: "SessionStart",
        rawMatcher: "",
        declarationIndex,
        scope: "project",
      }),
    );
    runtime.setRoutingBucket("SessionStart", entries);
    const held = createHeldExecutor([]);
    const handler = compositeHandlerFor(
      runtime,
      "SessionStart",
      generation,
      undefined,
      held.executor,
    );

    // act
    const pending = handler({ source: "startup" }, createExtensionContext("/workspace/contexts"));
    await settleStartedHooks();
    held.finish("late", { kind: "mutate", additionalContext: "b" });
    held.finish("silent", { kind: "mutate", additionalContext: "" });
    held.finish("early", { kind: "mutate", additionalContext: "a" });
    await pending;

    // assert
    assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), [
      { context: "a\nb", scope: "project", marketplace: "dispatch-catalog", pluginId: "late" },
    ]);
  });

  test("keeps every outcome with its system message in routing order", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const entries = preToolUseEntries(["first", "second"]);
    const held = createHeldExecutor([]);

    // act
    const pending = collectBucketOutcomes(
      runtime,
      entries,
      createToolCallEvent(),
      createExtensionContext("/workspace/outcomes"),
      undefined,
      () => true,
      held.executor,
    );
    await settleStartedHooks();
    held.finish("second", { kind: "noop", systemMessage: "two" });
    held.finish("first", { kind: "block", reason: "r", systemMessage: "one" });
    const outcomes = await pending;

    // assert
    assert.deepStrictEqual(
      outcomes.map(({ entry, result }) => [entry.pluginId, result]),
      [
        ["first", { kind: "block", reason: "r", systemMessage: "one" }],
        ["second", { kind: "noop", systemMessage: "two" }],
      ],
    );
  });
});

describe("hook dedupe (D-CF5-10)", () => {
  function hookEntry(input: {
    readonly pluginId: string;
    readonly rawMatcher: string;
    readonly declarationIndex: number;
    readonly timeout: number;
  }): RoutingEntry {
    return {
      ...createRoutingEntry({ ...input, claudeEvent: "PreToolUse" }),
      handlerDecl: { type: "command", command: "guard", timeout: input.timeout },
    };
  }

  test("runs a hook one plugin declares twice once, at the first position with the last copy's fields", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", [
      hookEntry({ pluginId: "demo", rawMatcher: "Bash", declarationIndex: 0, timeout: 5 }),
      hookEntry({ pluginId: "other", rawMatcher: "Bash", declarationIndex: 1, timeout: 6 }),
      hookEntry({ pluginId: "demo", rawMatcher: "*", declarationIndex: 2, timeout: 7 }),
    ]);
    const ran: Array<{ pluginId: string; rawMatcher: string; timeout: unknown }> = [];
    const executor: HookExecutor = (entry) => {
      ran.push({
        pluginId: entry.pluginId,
        rawMatcher: entry.rawMatcher,
        timeout: entry.handlerDecl.timeout,
      });
      return Promise.resolve({ kind: "noop" });
    };

    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    await handler(createToolCallEvent(), createExtensionContext("/workspace/dedupe"));

    // assert
    assert.deepStrictEqual(ran, [
      { pluginId: "demo", rawMatcher: "Bash", timeout: 7 },
      { pluginId: "other", rawMatcher: "Bash", timeout: 6 },
    ]);
  });

  test("keeps hooks that differ in shell, arguments, or if as separate hooks", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const base = hookEntry({
      pluginId: "demo",
      rawMatcher: "Bash",
      declarationIndex: 0,
      timeout: 1,
    });
    const bucket: RoutingEntry[] = [
      base,
      { ...base, handlerDecl: { ...base.handlerDecl, shell: "powershell" } },
      { ...base, handlerDecl: { ...base.handlerDecl, args: ["x"] } },
      { ...base, handlerDecl: { type: "command", command: "guard", if: "Bash(git *)" } },
    ];
    const ran: unknown[] = [];

    // act
    const outcomes = await collectBucketOutcomes(
      runtime,
      bucket,
      createToolCallEvent(),
      createExtensionContext("/workspace/distinct"),
      undefined,
      () => true,
      (entry) => {
        ran.push(entry.handlerDecl);
        return Promise.resolve({ kind: "noop" });
      },
    );

    // assert
    assert.strictEqual(outcomes.length, 4);
    assert.deepStrictEqual(
      ran,
      bucket.map((entry) => entry.handlerDecl),
    );
  });
});

describe("mcp proxy calls (D-CF5-12)", () => {
  const PROXY_CASES = [
    {
      name: "a call through the mcp proxy",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", args: { text: "ping" } },
      runs: false,
    },
    {
      name: "a call through a namespace proxy",
      toolName: "mcp__stub",
      input: { tool: "echo", args: { text: "ping" } },
      runs: false,
    },
    { name: "an mcp proxy search", toolName: "mcp", input: { search: "x" }, runs: true },
    {
      name: "an mcp proxy describe action",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", action: "describe" },
      runs: true,
    },
    {
      name: "a real mcp tool whose input names a tool",
      toolName: "mcp__plugin_demo_stub__echo",
      input: { tool: "echo" },
      runs: true,
    },
  ] as const;

  for (const { name, toolName, input, runs } of PROXY_CASES) {
    test(`${runs ? "runs" : "runs no"} PreToolUse hook for ${name}`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket("PreToolUse", [
        createRoutingEntry({
          pluginId: "any",
          claudeEvent: "PreToolUse",
          rawMatcher: "*",
          declarationIndex: 0,
        }),
      ]);
      const calls: RecordedCall[] = [];
      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        createRecordingExecutor({ any: { kind: "noop" } }, calls),
      );

      // act
      const output = await handler(
        createToolCallEvent(toolName, { ...input }),
        createExtensionContext("/workspace/proxy"),
      );

      // assert
      assert.strictEqual(output, undefined);
      assert.deepStrictEqual(
        calls.map(({ pluginId }) => pluginId),
        runs ? ["any"] : [],
      );
    });

    test(`${runs ? "runs" : "runs no"} PostToolUse hook for ${name}`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket("PostToolUse", [
        createRoutingEntry({
          pluginId: "after",
          claudeEvent: "PostToolUse",
          rawMatcher: "*",
          declarationIndex: 0,
        }),
      ]);
      const calls: RecordedCall[] = [];
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        undefined,
        createRecordingExecutor({ after: { kind: "noop" } }, calls),
      );

      // act
      const output = await handler(
        { ...createToolResultEvent(false, toolName), input: { ...input } },
        createExtensionContext("/workspace/proxy-result"),
      );

      // assert
      assert.strictEqual(output, undefined);
      assert.deepStrictEqual(
        calls.map(({ pluginId }) => pluginId),
        runs ? ["after"] : [],
      );
    });
  }
});

describe("routing-order fold of mutations", () => {
  test("allows with the last input rewrite in routing order", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["approver", "rewriter", "quiet"]));
    const held = createHeldExecutor([]);
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      held.executor,
    );
    const event = createToolCallEvent("bash", { command: "echo from-model" });

    // act
    const pending = handler(event, createExtensionContext("/workspace/allow"));
    await settleStartedHooks();
    held.finish("quiet", { kind: "noop" });
    held.finish("rewriter", { kind: "mutate", updatedInput: { command: "echo rewritten" } });
    held.finish("approver", {
      kind: "mutate",
      permissionDecision: "allow",
      updatedInput: { command: "echo approved" },
    });
    const output = await pending;

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(event, createToolCallEvent("bash", { command: "echo rewritten" }));
  });

  for (const { name, ask } of [
    {
      name: "with its reason",
      ask: { kind: "mutate", permissionDecision: "ask", permissionDecisionReason: "sure?" },
    },
    { name: "without a reason", ask: { kind: "mutate", permissionDecision: "ask" } },
  ] as const) {
    test(`attributes a fold to its first ask ${name}, not to the last mutation`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      const generation = runtime.advanceGeneration();
      const entries = ["asker", "second-asker", "later"].map((pluginId, declarationIndex) =>
        createRoutingEntry({
          pluginId,
          claudeEvent: "SessionStart",
          rawMatcher: "",
          declarationIndex,
          scope: "project",
        }),
      );
      runtime.setRoutingBucket("SessionStart", entries);
      const executor = createRecordingExecutor(
        {
          asker: { ...ask, additionalContext: "a" },
          "second-asker": {
            kind: "mutate",
            permissionDecision: "ask",
            permissionDecisionReason: "b?",
          },
          later: { kind: "mutate", additionalContext: "b" },
        },
        [],
      );
      const handler = compositeHandlerFor(runtime, "SessionStart", generation, undefined, executor);

      // act
      await handler({ source: "startup" }, createExtensionContext("/workspace/ask-attribution"));

      // assert
      assert.deepStrictEqual(runtime.pendingSessionStartContextEntries(), [
        { context: "a\nb", scope: "project", marketplace: "dispatch-catalog", pluginId: "asker" },
      ]);
    });
  }

  test("applies the last tool-output rewrite in routing order", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PostToolUse",
      ["first", "second"].map((pluginId, declarationIndex) =>
        createRoutingEntry({
          pluginId,
          claudeEvent: "PostToolUse",
          rawMatcher: "Bash",
          declarationIndex,
        }),
      ),
    );
    const executor = createRecordingExecutor(
      {
        first: { kind: "mutate", updatedToolOutput: { content: [{ type: "text", text: "one" }] } },
        second: { kind: "mutate", updatedToolOutput: { content: [{ type: "text", text: "two" }] } },
      },
      [],
    );
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const event = createToolResultEvent(false);

    // act
    const output = await handler(event, createExtensionContext("/workspace/outputs"));

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(event.content, [{ type: "text", text: "two" }]);
  });
});

describe("PreToolUse decisions (D-CF5-11)", () => {
  test("blocks a folded ask with its reason in print mode without opening a dialog", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["rewriter", "asker"]));
    const executor = createRecordingExecutor(
      {
        rewriter: { kind: "mutate", permissionDecision: "allow", updatedInput: { command: "x" } },
        asker: {
          kind: "mutate",
          permissionDecision: "ask",
          permissionDecisionReason: "please confirm",
        },
      },
      [],
    );
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      executor,
    );
    const event = createToolCallEvent();

    // act
    const output = await handler(event, createExtensionContext("/workspace/ask-print"));

    // assert
    assert.deepStrictEqual(output, { block: true, reason: "please confirm" });
    assert.deepStrictEqual(event, createToolCallEvent());
  });
});

/** A JSON-mode context and Pi API that capture the hook notices a dispatch appends. */
function createNoticeHost(cwd: string): {
  readonly context: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly capture: ReturnType<typeof createJsonCapture>;
} {
  const capture = createJsonCapture();
  const context = Object.defineProperties(createExtensionContext(cwd), {
    mode: { value: "json" },
    ui: { get: () => capture.ui },
  });
  const pi = {
    getAllTools: () => [],
    appendEntry: capture.entrySink.appendEntry,
  } as unknown as ExtensionAPI;
  return { context, pi, capture };
}

/** The `claude-plugin` entry of one hook notice. */
function hookNoticeEntry(text: string): {
  readonly customType: string;
  readonly payload: Record<string, unknown>;
} {
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

function promptEntries(pluginIds: readonly string[]): RoutingEntry[] {
  return pluginIds.map((pluginId, declarationIndex) =>
    createRoutingEntry({
      pluginId,
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex,
    }),
  );
}

const PROMPT_EVENT = { type: "input", text: "hello", source: "interactive" } as InputEvent;

describe("hook notices (HOOK-05 / D-CF5-14)", () => {
  test("shows each prompt hook's non-empty system message in routing order whatever order the hooks finish in", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("UserPromptSubmit", promptEntries(["first", "quiet", "third"]));
    const host = createNoticeHost("/workspace/notices");
    const held = createHeldExecutor([]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      host.pi,
      held.executor,
    );

    // act
    const pending = handler(PROMPT_EVENT, host.context);
    await settleStartedHooks();
    held.finish("third", { kind: "noop", systemMessage: "three" });
    held.finish("quiet", { kind: "noop", systemMessage: "" });
    held.finish("first", { kind: "noop", systemMessage: "one" });
    await pending;

    // assert
    assert.deepStrictEqual(host.capture.entries, [
      hookNoticeEntry("UserPromptSubmit says: one"),
      hookNoticeEntry("UserPromptSubmit says: three"),
    ]);
    host.capture.assertValid();
  });

  test("drops a prompt hook's system message with a debug line when no Pi API is given", async (t) => {
    // arrange
    const debugLines = observeHookDebug(t);
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("UserPromptSubmit", promptEntries(["speaker"]));
    const executor = createRecordingExecutor(
      { speaker: { kind: "noop", systemMessage: "hi" } },
      [],
    );
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      executor,
    );

    // act
    await handler(PROMPT_EVENT, createExtensionContext("/workspace/no-pi"));

    // assert
    assert.deepStrictEqual(debugLines(), ["[hooks] dispatch: no Pi API to show 1 hook notice(s)"]);
  });

  test("debug-logs a hook notice that fails to show and still stops a blocked prompt", async (t) => {
    // arrange
    const debugLines = observeHookDebug(t);
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("UserPromptSubmit", promptEntries(["speaker"]));
    const executor = createRecordingExecutor(
      { speaker: { kind: "block", reason: "no", systemMessage: "hi" } },
      [],
    );
    // The print-mode context's `ui` throws, so the notice cannot be shown.
    const pi = { getAllTools: () => [] } as unknown as ExtensionAPI;
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      pi,
      executor,
    );

    // act
    const output = await handler(PROMPT_EVENT, createExtensionContext("/workspace/stale"));

    // assert
    assert.deepStrictEqual(output, { action: "handled" });
    assert.deepStrictEqual(debugLines(), [
      "[hooks] dispatch: hook notice failed: composite dispatch must not read ui",
    ]);
  });
});
