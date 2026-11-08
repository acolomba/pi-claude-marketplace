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
import type { HookToolView } from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-tool-view.ts";
import type { ClaudeSessionEndEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts";
import type { ClaudeSessionStartEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { McpToolIdentity } from "../../../extensions/pi-claude-marketplace/domain/components/hooks/builtin-mcp-tool-names.ts";
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
    test(`${fires ? "dispatches" : "does not dispatch"} toolName "${toolName}" for the pipe-OR matcher "Write|Edit|apply_patch"`, async () => {
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

  test("does not dispatch any tool_call when every pipe-OR alternative is discarded", async () => {
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
    const expectedOutput = {
      content: [{ type: "text", text: "patched output" }],
      isError: true,
    };
    const expectedEvent: ToolResultEvent = createToolResultEvent(false);
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

  test("starts no hook for a failed result under an aborted turn signal (D-BG-402)", async (t) => {
    // arrange
    const readDiagnostics = observeHookDebug(t);
    const expectedCalls: RecordedCall[] = [];

    // act
    const { output, calls } = await runBashToolResult(true, AbortSignal.abort());

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(calls, expectedCalls);
    assert.deepStrictEqual(readDiagnostics(), [
      "[hooks] dispatch: no PostToolUseFailure hook on a cancelled tool call",
    ]);
  });

  test("runs the PostToolUseFailure hook for a failed result under a live turn signal", async () => {
    // arrange
    const expectedCalls: RecordedCall[] = [
      { pluginId: "failure", event: createToolResultEvent(true) },
    ];

    // act
    const { calls } = await runBashToolResult(true, new AbortController().signal);

    // assert
    assert.deepStrictEqual(calls, expectedCalls);
  });

  test("runs the PostToolUse hook for a successful result under an aborted turn signal (D-BG-402)", async () => {
    // arrange
    const expectedCalls: RecordedCall[] = [
      { pluginId: "after", event: createToolResultEvent(false) },
    ];

    // act
    const { calls } = await runBashToolResult(false, AbortSignal.abort());

    // assert
    assert.deepStrictEqual(calls, expectedCalls);
  });
});

// Runs one bash tool result under `signal`, with a PostToolUse hook `after`
// and a PostToolUseFailure hook `failure`, both matching Bash.
async function runBashToolResult(
  isError: boolean,
  signal: AbortSignal,
): Promise<{
  readonly output: Awaited<ReturnType<ReturnType<typeof toolResultCompositeHandler>>>;
  readonly calls: RecordedCall[];
}> {
  const runtime = createHooksRuntime();
  runtime.advanceGeneration();
  const context = createExtensionContext("/workspace/tool-result-signal");
  context.signal = signal;
  runtime.setRoutingBucket("PostToolUse", [
    createRoutingEntry({
      pluginId: "after",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    }),
  ]);
  runtime.setRoutingBucket("PostToolUseFailure", [
    createRoutingEntry({
      pluginId: "failure",
      claudeEvent: "PostToolUseFailure",
      rawMatcher: "Bash",
      declarationIndex: 0,
    }),
  ]);
  const calls: RecordedCall[] = [];
  const executor = createRecordingExecutor(
    { after: { kind: "noop" }, failure: { kind: "noop" } },
    calls,
  );
  const handler = toolResultCompositeHandler(
    runtime,
    runtime.currentGeneration(),
    undefined,
    executor,
  );
  const output = await handler(createToolResultEvent(isError), context);
  return { output, calls };
}

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

  test("drops prompt context an earlier input left before the prompt's hooks buffer theirs (D-CF5-13)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.appendPendingPromptContext({
      context: "stale context",
      scope: "user",
      marketplace: "stale-marketplace",
      pluginId: "stale-plugin",
    });
    const entry = createRoutingEntry({
      pluginId: "input-context",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    runtime.setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor(
        { "input-context": { kind: "mutate", additionalContext: "fresh context" } },
        [],
      ),
    );

    // act
    await handler(
      { type: "input", text: "review hooks", source: "interactive" },
      createExtensionContext("/workspace/input-context"),
    );

    // assert
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [
      {
        context: "fresh context",
        scope: entry.scope,
        marketplace: entry.marketplace,
        pluginId: "input-context",
      },
    ]);
  });

  test("drops prompt context an earlier input left when no UserPromptSubmit hook is routed", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.appendPendingPromptContext({
      context: "stale context",
      scope: "project",
      marketplace: "stale-marketplace",
      pluginId: "stale-plugin",
    });
    const handler = compositeHandlerFor(
      runtime,
      "UserPromptSubmit",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor({}, []),
    );

    // act
    const output = await handler(
      { type: "input", text: "review hooks", source: "interactive" },
      createExtensionContext("/workspace/input-stale"),
    );

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
  });

  for (const { name, streamingBehavior, left } of [
    { name: "drops", streamingBehavior: undefined, left: [] },
    {
      name: "keeps",
      streamingBehavior: "followUp",
      left: [
        {
          context: "unread context",
          scope: "project",
          marketplace: "stale-marketplace",
          pluginId: "stale-plugin",
          prompt: "an earlier follow-up",
        },
      ],
    },
  ] as const) {
    test(`${name} the follow-up context Pi has not read when a prompt arrives with streaming behavior ${String(streamingBehavior)} (D-CF5-13)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.queueFollowUpContext({
        context: "unread context",
        scope: "project",
        marketplace: "stale-marketplace",
        pluginId: "stale-plugin",
        prompt: "an earlier follow-up",
      });
      const handler = compositeHandlerFor(
        runtime,
        "UserPromptSubmit",
        runtime.currentGeneration(),
        undefined,
        createRecordingExecutor({}, []),
      );

      // act
      await handler(
        {
          type: "input",
          text: "review hooks",
          source: "rpc",
          ...(streamingBehavior === undefined ? {} : { streamingBehavior }),
        },
        createExtensionContext("/workspace/follow-up-stale"),
      );

      // assert
      assert.deepStrictEqual(runtime.drainFollowUpContext(), left);
    });
  }

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
    const output = await handler(event, context);

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("cancels the compaction on a PreCompact block, as Claude Code does", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreCompact", routedEntries("PreCompact", ["quiet", "keeper"]));
    const handler = compositeHandlerFor(
      runtime,
      "PreCompact",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor(
        { quiet: { kind: "noop" }, keeper: { kind: "block", reason: "keep", fromStderr: true } },
        [],
      ),
    );

    // act
    const output = await handler(
      { reason: "threshold" } as SessionBeforeCompactEvent,
      createExtensionContext("/workspace/pre-compact-block"),
    );

    // assert
    assert.deepStrictEqual(output, { cancel: true });
  });

  test("cancels the compaction on a PreCompact block that follows another hook's stop", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreCompact", routedEntries("PreCompact", ["stopper", "keeper"]));
    const handler = compositeHandlerFor(
      runtime,
      "PreCompact",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor(
        { stopper: { kind: "stop" }, keeper: { kind: "block", reason: "keep", fromStderr: true } },
        [],
      ),
    );

    // act
    const output = await handler(
      { reason: "manual" } as SessionBeforeCompactEvent,
      createExtensionContext("/workspace/pre-compact-stop-and-block"),
    );

    // assert
    assert.deepStrictEqual(output, { cancel: true });
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

/**
 * A view whose proxy rule gives `applies`, recording each read in `log`, so a
 * case can pin which reads a call makes and in what order (D-P5-07).
 */
function createProxyRuleView(applies: boolean, log: string[]): HookToolView {
  return {
    identify: (piName) => {
      log.push(`identify ${piName}`);
      return { piName, builtinServer: undefined };
    },
    proxyRuleApplies: () => {
      log.push("proxyRuleApplies");
      return applies;
    },
  };
}

interface ProxyRuleRow {
  readonly name: string;
  readonly toolName: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** Whether the view's proxy rule applies (pi-mcp-adapter is the active implementation). */
  readonly applies: boolean;
  readonly runs: boolean;
  /** The view reads the call makes, in order. */
  readonly reads: readonly string[];
}

function proxyRuleTitle(
  claudeEvent: "PreToolUse" | "PostToolUse",
  { name, applies, runs }: ProxyRuleRow,
): string {
  const rule = applies
    ? "the proxy rule applies (pi-mcp-adapter)"
    : "the proxy rule does not apply (built-in MCP or none)";
  return `${runs ? "runs" : "runs no"} ${claudeEvent} hook for ${name} when ${rule}`;
}

describe("mcp proxy calls (D-CF5-12, MHK-02)", () => {
  // MHK-02, D-P5-06: each call under a view whose proxy rule applies and under
  // one whose rule does not. Only a proxy-shaped call reads the rule, and only
  // a call that runs its hooks reads its tool (D-P5-07).
  const PROXY_ROWS: readonly ProxyRuleRow[] = [
    {
      name: "a call through the mcp proxy",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", args: { text: "ping" } },
      applies: true,
      runs: false,
      reads: ["proxyRuleApplies"],
    },
    {
      name: "a call through the mcp proxy",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", args: { text: "ping" } },
      applies: false,
      runs: true,
      reads: ["proxyRuleApplies", "identify mcp"],
    },
    {
      name: "a call through a namespace proxy",
      toolName: "mcp__stub",
      input: { tool: "echo", args: { text: "ping" } },
      applies: true,
      runs: false,
      reads: ["proxyRuleApplies"],
    },
    {
      name: "a call through a namespace proxy",
      toolName: "mcp__stub",
      input: { tool: "echo", args: { text: "ping" } },
      applies: false,
      runs: true,
      reads: ["proxyRuleApplies", "identify mcp__stub"],
    },
    {
      name: "an mcp proxy search",
      toolName: "mcp",
      input: { search: "x" },
      applies: true,
      runs: true,
      reads: ["identify mcp"],
    },
    {
      name: "an mcp proxy search",
      toolName: "mcp",
      input: { search: "x" },
      applies: false,
      runs: true,
      reads: ["identify mcp"],
    },
    {
      name: "an mcp proxy describe action",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", action: "describe" },
      applies: true,
      runs: true,
      reads: ["identify mcp"],
    },
    {
      name: "an mcp proxy describe action",
      toolName: "mcp",
      input: { tool: "mcp__plugin_demo_stub__echo", action: "describe" },
      applies: false,
      runs: true,
      reads: ["identify mcp"],
    },
    {
      name: "a real mcp tool whose input names a tool",
      toolName: "mcp__plugin_demo_stub__echo",
      input: { tool: "echo" },
      applies: true,
      runs: true,
      reads: ["identify mcp__plugin_demo_stub__echo"],
    },
    {
      name: "a real mcp tool whose input names a tool",
      toolName: "mcp__plugin_demo_stub__echo",
      input: { tool: "echo" },
      applies: false,
      runs: true,
      reads: ["identify mcp__plugin_demo_stub__echo"],
    },
  ];

  for (const row of PROXY_ROWS) {
    const { toolName, input, applies, runs, reads: expectedReads } = row;
    test(proxyRuleTitle("PreToolUse", row), async () => {
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
      const reads: string[] = [];
      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        createRecordingExecutor({ any: { kind: "noop" } }, calls),
        createProxyRuleView(applies, reads),
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
      assert.deepStrictEqual(reads, expectedReads);
    });

    test(proxyRuleTitle("PostToolUse", row), async () => {
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
      const reads: string[] = [];
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        undefined,
        createRecordingExecutor({ after: { kind: "noop" } }, calls),
        createProxyRuleView(applies, reads),
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
      assert.deepStrictEqual(reads, expectedReads);
    });
  }

  test("reads neither the proxy rule nor the tool for a proxy-shaped call when the PreToolUse bucket is empty", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const reads: string[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor({}, []),
      createProxyRuleView(true, reads),
    );

    // act
    const output = await handler(
      createToolCallEvent("mcp", { tool: "mcp__plugin_demo_stub__echo" }),
      createExtensionContext("/workspace/proxy-empty"),
    );

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(reads, []);
  });

  test("reads neither the proxy rule nor the tool for a proxy-shaped result when the bucket is empty", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const reads: string[] = [];
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor({}, []),
      createProxyRuleView(true, reads),
    );

    // act
    const output = await handler(
      { ...createToolResultEvent(true, "mcp"), input: { tool: "mcp__plugin_demo_stub__echo" } },
      createExtensionContext("/workspace/proxy-result-empty"),
    );

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(reads, []);
  });
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
    assert.deepStrictEqual(output, { content: [{ type: "text", text: "two" }] });
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
    // The print-mode context's `ui` throws, so the notice cannot be shown. The
    // Pi double answers both probe reads, so only the notice failure is traced.
    const pi = { getAllTools: () => [], getCommands: () => [] } as unknown as ExtensionAPI;
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

  const SESSION_START = { source: "startup" } satisfies ClaudeSessionStartEvent;
  const SESSION_END = { reason: "clear" } satisfies ClaudeSessionEndEvent;
  const PRE_COMPACT = { reason: "manual" } as SessionBeforeCompactEvent;
  const POST_COMPACT = { reason: "threshold" } as SessionCompactEvent;

  for (const { name, claudeEvent, event, results, notices } of [
    {
      name: "a PreToolUse system message after the event and Claude's tool name",
      claudeEvent: "PreToolUse",
      event: createToolCallEvent(),
      results: { checker: { kind: "noop", systemMessage: "checked" } },
      notices: ["PreToolUse:Bash says: checked"],
    },
    {
      name: "no notice for a PreToolUse block, which goes to the model",
      claudeEvent: "PreToolUse",
      event: createToolCallEvent(),
      results: { guard: { kind: "block", reason: "no" } },
      notices: [],
    },
    {
      name: "a SessionStart system message after the event and its source",
      claudeEvent: "SessionStart",
      event: SESSION_START,
      results: { greeter: { kind: "mutate", additionalContext: "ctx", systemMessage: "hello" } },
      notices: ["SessionStart:startup says: hello"],
    },
    {
      name: "the system messages, then the first block of a blocked prompt in routing order",
      claudeEvent: "UserPromptSubmit",
      event: PROMPT_EVENT,
      results: {
        speaker: { kind: "noop", systemMessage: "said" },
        first: { kind: "block", reason: "r1", fromStderr: true },
        second: { kind: "block", reason: "r2" },
      },
      notices: [
        "UserPromptSubmit says: said",
        "UserPromptSubmit operation blocked by hook:\n[printf first]: r1",
      ],
    },
    {
      name: "no blocked-prompt notice for a prompt a hook stops",
      claudeEvent: "UserPromptSubmit",
      event: PROMPT_EVENT,
      results: {
        stopper: { kind: "stop", stopReason: "enough" },
        guard: { kind: "block", reason: "no" },
      },
      notices: [],
    },
    {
      name: "a hook error for each SessionStart block in routing order",
      claudeEvent: "SessionStart",
      event: SESSION_START,
      results: {
        check: { kind: "block", reason: "startup check failed", fromStderr: true },
        quiet: { kind: "noop" },
        strict: {
          kind: "block",
          reason: '[printf strict]: failed; blocking because onFailure is "block"\nboom',
        },
      },
      notices: [
        "SessionStart:startup hook error: [printf check]: startup check failed",
        'SessionStart:startup hook error: [printf strict]: failed; blocking because onFailure is "block"\nboom',
      ],
    },
    {
      name: "a hook error for a SessionEnd block after the event and its reason",
      claudeEvent: "SessionEnd",
      event: SESSION_END,
      results: { ender: { kind: "block", reason: "bye", fromStderr: true } },
      notices: ["SessionEnd:clear hook error: [printf ender]: bye"],
    },
    {
      name: "one compaction-blocked notice for the PreCompact blocks in routing order",
      claudeEvent: "PreCompact",
      event: PRE_COMPACT,
      results: {
        compactor: { kind: "block", reason: "not now", fromStderr: true },
        quiet: { kind: "noop" },
        keeper: { kind: "block", reason: "keep the history" },
      },
      notices: [
        "Compaction blocked by PreCompact hook: [printf compactor]: not now\nkeep the history",
      ],
    },
    {
      name: "the compaction-blocked notice of a PreCompact block that another hook's stop does not hide",
      claudeEvent: "PreCompact",
      event: PRE_COMPACT,
      results: { stopper: { kind: "stop" }, keeper: { kind: "block", reason: "keep" } },
      notices: ["Compaction blocked by PreCompact hook: keep"],
    },
    {
      name: "no notice for a PreCompact hook that stops",
      claudeEvent: "PreCompact",
      event: PRE_COMPACT,
      results: { stopper: { kind: "stop" }, quiet: { kind: "noop" } },
      notices: [],
    },
  ] satisfies ReadonlyArray<{
    readonly name: string;
    readonly claudeEvent: CompositeDispatchEvent;
    readonly event: unknown;
    readonly results: Readonly<Record<string, HookExecResult>>;
    readonly notices: readonly string[];
  }>) {
    test(`shows ${name} (D-CF5-14 / D-CF5-24)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket(claudeEvent, routedEntries(claudeEvent, Object.keys(results)));
      const host = createNoticeHost("/workspace/event-notices");
      const handler = compositeHandlerFor(
        runtime,
        claudeEvent,
        runtime.currentGeneration(),
        host.pi,
        createRecordingExecutor(results, []),
      );

      // act
      await handler(event, host.context);

      // assert
      assert.deepStrictEqual(
        host.capture.entries,
        notices.map((text) => hookNoticeEntry(text)),
      );
      host.capture.assertValid();
    });
  }

  for (const { claudeEvent, event } of [
    { claudeEvent: "SessionEnd", event: SESSION_END },
    { claudeEvent: "PreCompact", event: PRE_COMPACT },
    { claudeEvent: "PostCompact", event: POST_COMPACT },
  ] satisfies ReadonlyArray<{
    readonly claudeEvent: CompositeDispatchEvent;
    readonly event: unknown;
  }>) {
    test(`drops a ${claudeEvent} system message with a debug line (D-CF5-14)`, async (t) => {
      // arrange
      const debugLines = observeHookDebug(t);
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket(claudeEvent, routedEntries(claudeEvent, ["first", "second"]));
      const host = createNoticeHost("/workspace/dropped-notices");
      const handler = compositeHandlerFor(
        runtime,
        claudeEvent,
        runtime.currentGeneration(),
        host.pi,
        createRecordingExecutor(
          {
            first: { kind: "noop", systemMessage: "one" },
            second: { kind: "noop", systemMessage: "two" },
          },
          [],
        ),
      );

      // act
      await handler(event, host.context);

      // assert
      assert.deepStrictEqual(host.capture.entries, []);
      assert.deepStrictEqual(debugLines(), [
        `[hooks] dispatch: 2 systemMessage(s) dropped on ${claudeEvent}`,
      ]);
      host.capture.assertValid();
    });
  }

  test("names an empty command in the hook error of a hook that declares none (D-CF5-18)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const [entry] = routedEntries("SessionStart", ["bare"]);
    assert.ok(entry !== undefined);
    runtime.setRoutingBucket("SessionStart", [
      { ...entry, handlerDecl: { type: "command", timeout: 1 } },
    ]);
    const host = createNoticeHost("/workspace/bare-notice");
    const handler = compositeHandlerFor(
      runtime,
      "SessionStart",
      runtime.currentGeneration(),
      host.pi,
      createRecordingExecutor({ bare: { kind: "block", reason: "boom", fromStderr: true } }, []),
    );

    // act
    await handler(SESSION_START, host.context);

    // assert
    assert.deepStrictEqual(host.capture.entries, [
      hookNoticeEntry("SessionStart:startup hook error: []: boom"),
    ]);
    host.capture.assertValid();
  });

  for (const { isError, notice } of [
    { isError: false, notice: "PostToolUse:Bash says: looked" },
    { isError: true, notice: "PostToolUseFailure:Bash says: looked" },
  ]) {
    test(`shows ${notice} from the tool-result composite (D-CF5-14)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const claudeEvent = isError ? "PostToolUseFailure" : "PostToolUse";
      runtime.setRoutingBucket(claudeEvent, routedEntries(claudeEvent, ["looker", "guard"]));
      const host = createNoticeHost("/workspace/tool-result-notices");
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        host.pi,
        createRecordingExecutor(
          {
            looker: { kind: "noop", systemMessage: "looked" },
            guard: { kind: "block", reason: "check the output" },
          },
          [],
        ),
      );

      // act
      await handler(createToolResultEvent(isError), host.context);

      // assert
      assert.deepStrictEqual(host.capture.entries, [hookNoticeEntry(notice)]);
      host.capture.assertValid();
    });
  }
});

describe("PostCompact notices (D-BG-501 / D-BG-502 / D-BG-504)", () => {
  const MANUAL = { reason: "manual" } as SessionCompactEvent;

  function postCompactHandler(
    entries: readonly RoutingEntry[],
    pi: ExtensionAPI,
    executor: HookExecutor,
  ): ReturnType<typeof compositeHandlerFor<"PostCompact">> {
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PostCompact", entries);
    return compositeHandlerFor(runtime, "PostCompact", runtime.currentGeneration(), pi, executor);
  }

  test("lists each hook's end after a manual compaction in routing order whatever order the hooks finish in", async () => {
    // arrange
    const host = createNoticeHost("/workspace/post-compact");
    const held = createHeldExecutor([]);
    const handler = postCompactHandler(
      routedEntries("PostCompact", ["first", "second", "third"]),
      host.pi,
      held.executor,
    );

    // act
    const pending = handler(MANUAL, host.context);
    await settleStartedHooks();
    held.finish("third", { kind: "noop", postCompactRun: { succeeded: true, output: "" } });
    held.finish("first", { kind: "noop", postCompactRun: { succeeded: true, output: "saved" } });
    held.finish("second", {
      kind: "block",
      reason: "not now",
      fromStderr: true,
      postCompactRun: { succeeded: false, output: "not now" },
    });
    await pending;

    // assert
    assert.deepStrictEqual(host.capture.entries, [
      hookNoticeEntry(
        "PostCompact [printf first] completed successfully: saved\n" +
          "PostCompact [printf second] failed: not now\n" +
          "PostCompact [printf third] completed successfully",
      ),
    ]);
    host.capture.assertValid();
  });

  for (const reason of ["threshold", "overflow"] as const) {
    test(`shows nothing and writes one debug line after a ${reason} compaction`, async (t) => {
      // arrange
      const debugLines = observeHookDebug(t);
      const host = createNoticeHost("/workspace/post-compact-auto");
      const handler = postCompactHandler(
        routedEntries("PostCompact", ["first", "second"]),
        host.pi,
        createRecordingExecutor(
          {
            first: { kind: "noop", postCompactRun: { succeeded: true, output: "" } },
            second: { kind: "noop", postCompactRun: { succeeded: false, output: "boom" } },
          },
          [],
        ),
      );

      // act
      await handler({ reason } as SessionCompactEvent, host.context);

      // assert
      assert.deepStrictEqual(host.capture.entries, []);
      assert.deepStrictEqual(debugLines(), [
        "[hooks] dispatch: 2 PostCompact line(s) not shown after an automatic compaction",
      ]);
    });
  }

  test("shows nothing and writes no debug line for results that carry no run", async (t) => {
    // arrange
    const debugLines = observeHookDebug(t);
    const host = createNoticeHost("/workspace/post-compact-none");
    const handler = postCompactHandler(
      routedEntries("PostCompact", ["quiet"]),
      host.pi,
      createRecordingExecutor({ quiet: { kind: "noop" } }, []),
    );

    // act
    await handler(MANUAL, host.context);

    // assert
    assert.deepStrictEqual(host.capture.entries, []);
    assert.deepStrictEqual(debugLines(), []);
  });

  test("names each hook by its command and exec-form arguments", async () => {
    // arrange
    const [tagged, plain, bare] = routedEntries("PostCompact", ["tagged", "plain", "bare"]);
    assert.ok(tagged !== undefined && plain !== undefined && bare !== undefined);
    const host = createNoticeHost("/workspace/post-compact-commands");
    const ran = { kind: "noop", postCompactRun: { succeeded: true, output: "" } } as const;
    const handler = postCompactHandler(
      [
        { ...tagged, handlerDecl: { ...tagged.handlerDecl, args: ["note", 7] } },
        { ...plain, handlerDecl: { ...plain.handlerDecl, args: "ignored" } },
        { ...bare, handlerDecl: { type: "command", timeout: 1 } },
      ] as RoutingEntry[],
      host.pi,
      createRecordingExecutor({ tagged: ran, plain: ran, bare: ran }, []),
    );

    // act
    await handler(MANUAL, host.context);

    // assert
    assert.deepStrictEqual(host.capture.entries, [
      hookNoticeEntry(
        "PostCompact [printf tagged note 7] completed successfully\n" +
          "PostCompact [printf plain] completed successfully\n" +
          "PostCompact [] completed successfully",
      ),
    ]);
  });
});

// Entries of `claudeEvent` with a match-all matcher, in routing order.
function routedEntries(claudeEvent: BucketAEvent, pluginIds: readonly string[]): RoutingEntry[] {
  return pluginIds.map((pluginId, declarationIndex) =>
    createRoutingEntry({ pluginId, claudeEvent, rawMatcher: "", declarationIndex }),
  );
}

interface SentMessage {
  readonly message: unknown;
  readonly options: unknown;
}

/** A Pi API that records every message a dispatch sends, or throws `failure` on a send. */
function createMessagePi(sent: SentMessage[], failure?: Error): ExtensionAPI {
  return {
    getAllTools: () => [],
    sendMessage: (message: unknown, options: unknown): void => {
      if (failure !== undefined) {
        throw failure;
      }

      sent.push({ message, options });
    },
  } as unknown as ExtensionAPI;
}

/** The message that carries a tool hook's context to the model, as Pi receives it. */
function toolContextMessage(content: string): SentMessage {
  return {
    message: { customType: "claude-hook-tool-context", content, display: false },
    options: { triggerTurn: false },
  };
}

describe("tool hook context (HOOK-04 / D-CF5-13)", () => {
  test("sends a PreToolUse fold's joined context to the model after the tool result", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["first", "quiet", "second"]));
    const sent: SentMessage[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      createMessagePi(sent),
      createRecordingExecutor(
        {
          first: { kind: "mutate", additionalContext: "a" },
          quiet: { kind: "noop" },
          second: { kind: "mutate", additionalContext: "b" },
        },
        [],
      ),
    );

    // act
    const output = await handler(createToolCallEvent(), createExtensionContext("/workspace/ctx"));

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(sent, [
      toolContextMessage("PreToolUse:Bash hook additional context: a\nb"),
    ]);
  });

  test("sends a denied call's context and still blocks the call", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["guard"]));
    const sent: SentMessage[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      createMessagePi(sent),
      createRecordingExecutor(
        { guard: { kind: "block", reason: "no echo", additionalContext: "denied" } },
        [],
      ),
    );

    // act
    const output = await handler(createToolCallEvent(), createExtensionContext("/workspace/deny"));

    // assert
    assert.deepStrictEqual(output, { block: true, reason: "PreToolUse:Bash hook error: no echo" });
    assert.deepStrictEqual(sent, [
      toolContextMessage("PreToolUse:Bash hook additional context: denied"),
    ]);
  });

  for (const { isError, label } of [
    { isError: false, label: "PostToolUse:Bash" },
    { isError: true, label: "PostToolUseFailure:Bash" },
  ]) {
    test(`sends a ${label} fold's context to the model with its own label`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const claudeEvent = isError ? "PostToolUseFailure" : "PostToolUse";
      runtime.setRoutingBucket(claudeEvent, routedEntries(claudeEvent, ["looker"]));
      const sent: SentMessage[] = [];
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        createMessagePi(sent),
        createRecordingExecutor({ looker: { kind: "mutate", additionalContext: "seen" } }, []),
      );

      // act
      const output = await handler(
        createToolResultEvent(isError),
        createExtensionContext("/workspace/post"),
      );

      // assert
      assert.strictEqual(output, undefined);
      assert.deepStrictEqual(sent, [toolContextMessage(`${label} hook additional context: seen`)]);
    });
  }

  for (const { name, result } of [
    { name: "no context", result: { kind: "mutate" } },
    { name: "an empty context", result: { kind: "block", reason: "r", additionalContext: "" } },
  ] satisfies ReadonlyArray<{ readonly name: string; readonly result: HookExecResult }>) {
    test(`sends nothing for a tool fold with ${name}`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket("PostToolUse", routedEntries("PostToolUse", ["looker"]));
      const sent: SentMessage[] = [];
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        createMessagePi(sent),
        createRecordingExecutor({ looker: result }, []),
      );

      // act
      await handler(createToolResultEvent(false), createExtensionContext("/workspace/empty"));

      // assert
      assert.deepStrictEqual(sent, []);
    });
  }

  test("sends nothing and still adapts the call when no Pi API is given", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PreToolUse", preToolUseEntries(["guard"]));
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createRecordingExecutor(
        { guard: { kind: "block", reason: "no", additionalContext: "lost" } },
        [],
      ),
    );

    // act
    const output = await handler(createToolCallEvent(), createExtensionContext("/workspace/no-pi"));

    // assert
    assert.deepStrictEqual(output, { block: true, reason: "PreToolUse:Bash hook error: no" });
  });

  test("debug-logs a context send that throws and still returns the tool result", async (t) => {
    // arrange
    const debugLines = observeHookDebug(t);
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket("PostToolUse", routedEntries("PostToolUse", ["looker"]));
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      createMessagePi([], new Error("session closed")),
      createRecordingExecutor(
        {
          looker: {
            kind: "mutate",
            additionalContext: "seen",
            updatedToolOutput: { content: [{ type: "text", text: "kept" }] },
          },
        },
        [],
      ),
    );

    // act
    const output = await handler(
      createToolResultEvent(false),
      createExtensionContext("/workspace/throws"),
    );

    // assert
    assert.deepStrictEqual(output, { content: [{ type: "text", text: "kept" }] });
    assert.deepStrictEqual(debugLines(), [
      "[hooks] dispatch: tool hook context failed: session closed",
    ]);
  });
});

const BUILTIN_PI_NAME = "mcp__plugin_hook_demo_stub_server__echo";
const BUILTIN_CLAUDE_NAME = "mcp__plugin_hook-demo_stub-server__echo";

const BUILTIN_TOOLS: Readonly<Partial<Record<string, McpToolIdentity>>> = {
  [BUILTIN_PI_NAME]: {
    piName: BUILTIN_PI_NAME,
    builtinServer: "plugin_hook-demo_stub-server",
  },
  mcp__echo_server__echo_text: {
    piName: "mcp__echo_server__echo_text",
    builtinServer: "echo-server",
  },
};

/**
 * A tool view that names the tools of `BUILTIN_TOOLS` as tools of Pi's
 * built-in MCP and keeps every other name, recording each name it is asked
 * for.
 */
function createBuiltinToolView(identified: string[]): HookToolView {
  return {
    identify: (piName) => {
      identified.push(piName);
      return BUILTIN_TOOLS[piName] ?? { piName, builtinServer: undefined };
    },
    proxyRuleApplies: () => false,
  };
}

interface ReceivedEvent {
  readonly pluginId: string;
  readonly event: unknown;
}

/** A recording executor that keeps the very event object each hook received. */
function createEventKeepingExecutor(
  results: Readonly<Record<string, HookExecResult>>,
  received: ReceivedEvent[],
): HookExecutor {
  return (entry, event) => {
    received.push({ pluginId: entry.pluginId, event });
    return Promise.resolve(results[entry.pluginId] ?? { kind: "noop" });
  };
}

function builtinToolEntries(
  claudeEvent: BucketAEvent,
  rows: readonly { readonly pluginId: string; readonly rawMatcher: string }[],
): RoutingEntry[] {
  return rows.map(({ pluginId, rawMatcher }, declarationIndex) =>
    createRoutingEntry({ pluginId, claudeEvent, rawMatcher, declarationIndex }),
  );
}

describe("built-in MCP tool names (MHK-01)", () => {
  test("runs the Claude-form literal, server prefix, and match-all hooks and not the folded-server ones (D-P5-04)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [
        { pluginId: "literal", rawMatcher: BUILTIN_CLAUDE_NAME },
        { pluginId: "prefix", rawMatcher: "mcp__plugin_hook-demo_stub-server__.*" },
        { pluginId: "any", rawMatcher: "*" },
        { pluginId: "folded", rawMatcher: BUILTIN_PI_NAME },
        { pluginId: "folded-prefix", rawMatcher: "mcp__plugin_hook_demo_stub_server__.*" },
      ]),
    );
    const received: ReceivedEvent[] = [];
    const identified: string[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor({}, received),
      createBuiltinToolView(identified),
    );
    const event = createToolCallEvent(BUILTIN_PI_NAME, { text: "ping" });
    const hookEvent = createToolCallEvent(BUILTIN_CLAUDE_NAME, { text: "ping" });

    // act
    const output = await handler(event, createExtensionContext("/workspace/builtin"));

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(received, [
      { pluginId: "literal", event: hookEvent },
      { pluginId: "prefix", event: hookEvent },
      { pluginId: "any", event: hookEvent },
    ]);
    assert.deepStrictEqual(
      received.map((run) => run.event.input === event.input),
      [true, true, true],
    );
    assert.deepStrictEqual(event, createToolCallEvent(BUILTIN_PI_NAME, { text: "ping" }));
    assert.deepStrictEqual(identified, [BUILTIN_PI_NAME]);
  });

  test("gives the hooks Pi's event itself for a tool the view keeps under Pi's name (D-P5-05)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [
        { pluginId: "literal", rawMatcher: "mcp__plugin_demo_stub__echo" },
      ]),
    );
    const received: ReceivedEvent[] = [];
    const identified: string[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor({}, received),
      createBuiltinToolView(identified),
    );
    const event = createToolCallEvent("mcp__plugin_demo_stub__echo", { text: "ping" });

    // act
    await handler(event, createExtensionContext("/workspace/adapter"));

    // assert
    assert.deepStrictEqual(received, [{ pluginId: "literal", event }]);
    assert.strictEqual(received[0]?.event, event);
    assert.deepStrictEqual(identified, ["mcp__plugin_demo_stub__echo"]);
  });

  test("lands a hook's input rewrite on Pi's own input (D-P5-03)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [{ pluginId: "rewriter", rawMatcher: BUILTIN_CLAUDE_NAME }]),
    );
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor(
        { rewriter: { kind: "mutate", updatedInput: { text: "pong" } } },
        [],
      ),
      createBuiltinToolView([]),
    );
    const event = createToolCallEvent(BUILTIN_PI_NAME, { text: "ping" });

    // act
    const output = await handler(event, createExtensionContext("/workspace/rewrite"));

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(event, createToolCallEvent(BUILTIN_PI_NAME, { text: "pong" }));
  });

  test("names the tool in Claude's form in a block reason, a notice, and the model's context (D-P5-03)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [{ pluginId: "guard", rawMatcher: BUILTIN_CLAUDE_NAME }]),
    );
    const host = createNoticeHost("/workspace/labels");
    const sent: SentMessage[] = [];
    const pi = Object.assign(host.pi, {
      sendMessage: (message: unknown, options: unknown): void => {
        sent.push({ message, options });
      },
    });
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      pi,
      createEventKeepingExecutor(
        {
          guard: {
            kind: "block",
            reason: "no",
            systemMessage: "checked",
            additionalContext: "why",
          },
        },
        [],
      ),
      createBuiltinToolView([]),
    );

    // act
    const output = await handler(
      createToolCallEvent(BUILTIN_PI_NAME, { text: "ping" }),
      host.context,
    );

    // assert
    assert.deepStrictEqual(output, {
      block: true,
      reason: `PreToolUse:${BUILTIN_CLAUDE_NAME} hook error: no`,
    });
    assert.deepStrictEqual(host.capture.entries, [
      hookNoticeEntry(`PreToolUse:${BUILTIN_CLAUDE_NAME} says: checked`),
    ]);
    assert.deepStrictEqual(sent, [
      toolContextMessage(`PreToolUse:${BUILTIN_CLAUDE_NAME} hook additional context: why`),
    ]);
    host.capture.assertValid();
  });

  test("names the tool in Claude's form in the ask dialog (D-P5-03)", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [{ pluginId: "asker", rawMatcher: BUILTIN_CLAUDE_NAME }]),
    );
    const titles: string[] = [];
    const context = Object.defineProperties(createExtensionContext("/workspace/ask"), {
      mode: { value: "tui" },
      ui: {
        get: () => ({
          confirm: (title: string): Promise<boolean> => {
            titles.push(title);
            return Promise.resolve(false);
          },
        }),
      },
    });
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor(
        { asker: { kind: "mutate", permissionDecision: "ask", permissionDecisionReason: "sure?" } },
        [],
      ),
      createBuiltinToolView([]),
    );

    // act
    const output = await handler(createToolCallEvent(BUILTIN_PI_NAME, { text: "ping" }), context);

    // assert
    assert.deepStrictEqual(output, { block: true, reason: "sure?" });
    assert.deepStrictEqual(titles, [
      `PreToolUse:${BUILTIN_CLAUDE_NAME} hook asks to allow this call`,
    ]);
  });

  test("asks the view once per tool event however many hooks match", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    runtime.setRoutingBucket(
      "PreToolUse",
      builtinToolEntries("PreToolUse", [
        { pluginId: "first", rawMatcher: "*" },
        { pluginId: "second", rawMatcher: BUILTIN_CLAUDE_NAME },
      ]),
    );
    const identified: string[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor({}, []),
      createBuiltinToolView(identified),
    );
    const context = createExtensionContext("/workspace/once");

    // act
    await handler(createToolCallEvent(BUILTIN_PI_NAME), context);
    await handler(createToolCallEvent("bash"), context);

    // assert
    assert.deepStrictEqual(identified, [BUILTIN_PI_NAME, "bash"]);
  });

  test("never asks the view when the PreToolUse bucket is empty", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const identified: string[] = [];
    const handler = compositeHandlerFor(
      runtime,
      "PreToolUse",
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor({}, []),
      createBuiltinToolView(identified),
    );

    // act
    const output = await handler(
      createToolCallEvent(BUILTIN_PI_NAME),
      createExtensionContext("/workspace/empty"),
    );

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(identified, []);
  });
});

function builtinToolResultEvent(isError: boolean, toolName = BUILTIN_PI_NAME): ToolResultEvent {
  return {
    ...createToolResultEvent(isError, toolName),
    input: { text: "ping" },
    content: [{ type: "text", text: "echo:ping" }],
  };
}

describe("built-in MCP tool names in tool results and if fields (MHK-01)", () => {
  for (const claudeEvent of ["PostToolUse", "PostToolUseFailure"] as const) {
    test(`runs the Claude-form ${claudeEvent} literal and server prefix and not the folded-server literal (D-P5-04)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket(
        claudeEvent,
        builtinToolEntries(claudeEvent, [
          { pluginId: "literal", rawMatcher: BUILTIN_CLAUDE_NAME },
          { pluginId: "prefix", rawMatcher: "mcp__plugin_hook-demo_stub-server__.*" },
          { pluginId: "folded", rawMatcher: BUILTIN_PI_NAME },
        ]),
      );
      const received: ReceivedEvent[] = [];
      const identified: string[] = [];
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        undefined,
        createEventKeepingExecutor({}, received),
        createBuiltinToolView(identified),
      );
      const event = builtinToolResultEvent(claudeEvent === "PostToolUseFailure");
      const hookEvent = builtinToolResultEvent(
        claudeEvent === "PostToolUseFailure",
        BUILTIN_CLAUDE_NAME,
      );

      // act
      const output = await handler(event, createExtensionContext("/workspace/result"));

      // assert
      assert.strictEqual(output, undefined);
      assert.deepStrictEqual(received, [
        { pluginId: "literal", event: hookEvent },
        { pluginId: "prefix", event: hookEvent },
      ]);
      assert.deepStrictEqual(
        received.map((run) => [
          run.event.input === event.input,
          run.event.content === event.content,
        ]),
        [
          [true, true],
          [true, true],
        ],
      );
      assert.deepStrictEqual(event, builtinToolResultEvent(claudeEvent === "PostToolUseFailure"));
      assert.deepStrictEqual(identified, [BUILTIN_PI_NAME]);
    });

    test(`names the tool in Claude's form in a ${claudeEvent} notice, block feedback, and context (D-P5-03)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      runtime.setRoutingBucket(
        claudeEvent,
        builtinToolEntries(claudeEvent, [{ pluginId: "guard", rawMatcher: BUILTIN_CLAUDE_NAME }]),
      );
      const host = createNoticeHost("/workspace/result-labels");
      const sent: SentMessage[] = [];
      const pi = Object.assign(host.pi, {
        sendMessage: (message: unknown, options: unknown): void => {
          sent.push({ message, options });
        },
      });
      const handler = toolResultCompositeHandler(
        runtime,
        runtime.currentGeneration(),
        pi,
        createEventKeepingExecutor(
          {
            guard: {
              kind: "block",
              reason: "no",
              systemMessage: "checked",
              additionalContext: "why",
            },
          },
          [],
        ),
        createBuiltinToolView([]),
      );
      const label = `${claudeEvent}:${BUILTIN_CLAUDE_NAME}`;

      // act
      const output = await handler(
        builtinToolResultEvent(claudeEvent === "PostToolUseFailure"),
        host.context,
      );

      // assert
      assert.deepStrictEqual(output, {
        content: [
          { type: "text", text: "echo:ping" },
          {
            type: "text",
            text: `${label} hook blocking error from command: "printf guard": no`,
          },
        ],
      });
      assert.deepStrictEqual(host.capture.entries, [hookNoticeEntry(`${label} says: checked`)]);
      assert.deepStrictEqual(sent, [toolContextMessage(`${label} hook additional context: why`)]);
      host.capture.assertValid();
    });
  }

  test("never asks the view when the tool result's bucket is empty", async () => {
    // arrange
    const runtime = createHooksRuntime();
    runtime.advanceGeneration();
    const identified: string[] = [];
    const handler = toolResultCompositeHandler(
      runtime,
      runtime.currentGeneration(),
      undefined,
      createEventKeepingExecutor({}, []),
      createBuiltinToolView(identified),
    );

    // act
    const output = await handler(
      builtinToolResultEvent(false),
      createExtensionContext("/workspace/result-empty"),
    );

    // assert
    assert.strictEqual(output, undefined);
    assert.deepStrictEqual(identified, []);
  });

  for (const { toolName, ran } of [
    { toolName: BUILTIN_PI_NAME, ran: ["iffed"] },
    { toolName: "mcp__echo_server__echo_text", ran: ["dashed"] },
    { toolName: "tool_search", ran: [] },
  ]) {
    test(`runs the PreToolUse hooks whose if names ${toolName} as Claude Code does: ${ran.join(", ") || "none"} (D-P5-04)`, async () => {
      // arrange
      const runtime = createHooksRuntime();
      runtime.advanceGeneration();
      const compileContext = {
        homedir: "/home/plugin-user",
        cwd: "/workspace/if",
        projectRoot: "/workspace/if",
      };
      runtime.setRoutingBucket("PreToolUse", [
        createRoutingEntry({
          pluginId: "iffed",
          claudeEvent: "PreToolUse",
          rawMatcher: "*",
          declarationIndex: 0,
          ifPredicate: compileIfPredicate(BUILTIN_CLAUDE_NAME, "PreToolUse", compileContext),
        }),
        createRoutingEntry({
          pluginId: "dashed",
          claudeEvent: "PreToolUse",
          rawMatcher: "*",
          declarationIndex: 1,
          ifPredicate: compileIfPredicate(
            "mcp__echo-server__echo-text",
            "PreToolUse",
            compileContext,
          ),
        }),
      ]);
      const received: ReceivedEvent[] = [];
      const handler = compositeHandlerFor(
        runtime,
        "PreToolUse",
        runtime.currentGeneration(),
        undefined,
        createEventKeepingExecutor({}, received),
        createBuiltinToolView([]),
      );

      // act
      await handler(
        createToolCallEvent(toolName, { text: "ping" }),
        createExtensionContext("/workspace/if"),
      );

      // assert
      assert.deepStrictEqual(
        received.map(({ pluginId }) => pluginId),
        ran,
      );
    });
  }
});
