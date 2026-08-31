import assert from "node:assert/strict";
import { describe, test } from "node:test";

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
import {
  bumpEpoch,
  currentEpoch,
  pendingSessionStartContextEntries,
  resetRoutingState,
  setRoutingBucket,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type {
  CompositeDispatchEvent,
  CompositeReturnFor,
  HookExecutor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
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
    readonly matcher: { readonly kind: "tool-set"; readonly piTools: readonly string[] };
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
      matcher: { kind: "tool-set", piTools: [...entry.matcher.piTools] },
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

describe("compositeHandlerFor", () => {
  test("requires matcher and if agreement before composing mutations in declaration order", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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

    setRoutingBucket("PreToolUse", routingBucket);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
    const expectedExecutorEntries = [firstMutationEntry, secondMutationEntry];
    const expectedExecutorCalls: ExecutorCall[] = [
      {
        entry: {
          scope: "user",
          marketplace: "dispatch-catalog",
          pluginId: "first-mutation",
          resolvedSource: "/plugins/first-mutation",
          claudeEvent: "PreToolUse",
          matcher: { kind: "tool-set", piTools: ["bash"] },
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
          matcher: { kind: "tool-set", piTools: ["bash"] },
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
          input: {
            command: "git status",
            original: "kept",
            firstMutation: "visible",
            shared: "first",
          },
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
      input: {
        command: "git status",
        original: "kept",
        firstMutation: "visible",
        secondMutation: "composed",
        shared: "second",
      },
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
    test(`reports ${String(expected)} for raw matcher ${JSON.stringify(rawMatcher)}`, (t) => {
      // arrange
      resetRoutingState();
      t.after(() => {
        resetRoutingState();
      });
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
  test("preserves matching observation order while degrading async rewake to noop", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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

  test("returns an empty outcome list for an empty bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/dispatch-empty-collection");
    const expectedOutcomes: readonly [] = [];

    // act
    const outcomes = await collectBucketOutcomes(
      [],
      { phase: "stop" },
      context,
      undefined,
      () => true,
    );

    // assert
    assert.deepStrictEqual(outcomes, expectedOutcomes);
  });
});

describe("composite dispatch reduction", () => {
  test("keeps equal noop outcomes in stable declaration order", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
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

  test("returns the first block and skips every later entry", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
    const expectedOutput = { block: true, reason: "first denial" };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "leading-noop", event: createToolCallEvent() },
      { pluginId: "first-block", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("returns on the first stop and skips every later entry", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/dispatch-stop");
    const entries = [
      createRoutingEntry({
        pluginId: "first-stop",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 0,
      }),
      createRoutingEntry({
        pluginId: "later-noop",
        claudeEvent: "PreToolUse",
        rawMatcher: "Bash",
        declarationIndex: 1,
      }),
    ];
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "first-stop": { kind: "stop", stopReason: "stop now" },
        "later-noop": { kind: "noop" },
      },
      executorCalls,
    );
    setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;
    const expectedCalls: RecordedCall[] = [
      { pluginId: "first-stop", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("composes multiple mutations from left to right", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
    const expectedEvent = createToolCallEvent("bash", {
      command: "git status",
      preserved: true,
      first: 1,
      second: 2,
      shared: "second",
    });
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "mutation-a",
        event: createToolCallEvent("bash", { command: "git status", preserved: true }),
      },
      {
        pluginId: "mutation-b",
        event: createToolCallEvent("bash", {
          command: "git status",
          preserved: true,
          first: 1,
          shared: "first",
        }),
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
  test("rejects an unsupported executor result through the exhaustiveness guard", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/dispatch-exhaustive");
    const entry = createRoutingEntry({
      pluginId: "future-result",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const unsupportedResult: HookExecResult = { kind: "noop" };
    Object.defineProperty(unsupportedResult, "kind", { value: "future" });
    const executor: HookExecutor = () => Promise.resolve(unsupportedResult);
    setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);

    // act & assert
    await assert.rejects(() => handler(createToolCallEvent(), context), {
      name: "Error",
      message: 'unreachable HookExecResult arm: {"kind":"future"}',
    });
  });

  test("returns undefined from a stale composite closure without dispatching", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/dispatch-stale");
    const entry = createRoutingEntry({
      pluginId: "stale-entry",
      claudeEvent: "PreToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch());
    bumpEpoch();
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("returns undefined from a live composite closure with an empty bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/dispatch-empty");
    const handler = compositeHandlerFor("PreToolUse", currentEpoch());
    const expectedOutput: CompositeReturnFor<"PreToolUse"> = undefined;

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("dispatches only match-all and exact MCP tool matchers", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreToolUse", entries);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
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

  test("dispatches SessionStart empty, star, and exact raw matchers in declaration order", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    const event = { type: "session_start", reason: "resume" } satisfies SessionStartEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      {
        "session-empty": { kind: "noop" },
        "session-star": { kind: "noop" },
        "session-exact": { kind: "noop" },
      },
      executorCalls,
    );
    setRoutingBucket("SessionStart", entries);
    const handler = compositeHandlerFor("SessionStart", currentEpoch(), undefined, executor);
    const expectedCalls: RecordedCall[] = [
      { pluginId: "session-empty", event: { type: "session_start", reason: "resume" } },
      { pluginId: "session-star", event: { type: "session_start", reason: "resume" } },
      { pluginId: "session-exact", event: { type: "session_start", reason: "resume" } },
    ];
    const expectedPendingContext: readonly [] = [];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(pendingSessionStartContextEntries(), expectedPendingContext);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });
});

describe("toolResultCompositeHandler", () => {
  test("returns undefined from a stale tool-result closure without dispatching", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/tool-result-stale");
    const entry = createRoutingEntry({
      pluginId: "stale-result",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(currentEpoch());
    bumpEpoch();
    const expectedOutput = undefined;

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("returns undefined from a live tool-result closure with an empty bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/tool-result-empty");
    const handler = toolResultCompositeHandler(currentEpoch());
    const expectedOutput = undefined;

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
  });

  test("routes a successful result only through the PostToolUse bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostToolUse", [successEntry]);
    setRoutingBucket("PostToolUseFailure", [failureEntry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
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

  test("routes a failed result only through the PostToolUseFailure bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostToolUse", [successEntry]);
    setRoutingBucket("PostToolUseFailure", [failureEntry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
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

  test("adapts a block without a reason to an error result", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/tool-result-block-empty");
    const entry = createRoutingEntry({
      pluginId: "block-empty",
      claudeEvent: "PostToolUse",
      rawMatcher: "Bash",
      declarationIndex: 0,
    });
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor({ "block-empty": { kind: "block" } }, executorCalls);
    setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
    const expectedOutput = { isError: true };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "block-empty", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("adapts the first reasoned block and skips the later tool-result entry", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostToolUse", [firstEntry, laterEntry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
    const expectedOutput = {
      isError: true,
      content: [{ type: "text", text: "tool denied" }],
    };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "block-first", event: createToolResultEvent(false) },
    ];

    // act
    const output = await handler(createToolResultEvent(false), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("applies a tool-output mutation through the selected result bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostToolUse", [entry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
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

  test("drops a tool-result stop after terminating the bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostToolUseFailure", [entry]);
    const handler = toolResultCompositeHandler(currentEpoch(), undefined, executor);
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
  test("adapts a PreToolUse block without a reason", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreToolUse", [entry]);
    const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, executor);
    const expectedOutput = { block: true };
    const expectedCalls: RecordedCall[] = [
      { pluginId: "pre-tool-block-empty", event: createToolCallEvent() },
    ];

    // act
    const output = await handler(createToolCallEvent(), context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("adapts a UserPromptSubmit block to handled", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch(), undefined, executor);
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

  test("adapts UserPromptSubmit additional context to transformed text", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/input-transform");
    const entry = createRoutingEntry({
      pluginId: "input-transform",
      claudeEvent: "UserPromptSubmit",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = {
      type: "input",
      text: "review hooks",
      source: "rpc",
    } satisfies InputEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "input-transform": { kind: "mutate", additionalContext: "dispatch context" } },
      executorCalls,
    );
    setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch(), undefined, executor);
    const expectedOutput = { action: "transform", text: "dispatch context" };
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "input-transform",
        event: { type: "input", text: "review hooks", source: "rpc" },
      },
    ];

    // act
    const output = await handler(event, context);

    // assert
    assert.deepStrictEqual(output, expectedOutput);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a UserPromptSubmit mutation without additional context", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch(), undefined, executor);
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

  test("drops a UserPromptSubmit stop after terminating the bucket", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch(), undefined, executor);
    const expectedOutput = undefined;
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

  test("passes a UserPromptSubmit noop through as undefined", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("UserPromptSubmit", [entry]);
    const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch(), undefined, executor);
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

  test("captures SessionStart context with the producing entry provenance", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/session-start-provenance");
    const entry = createRoutingEntry({
      pluginId: "session-context",
      claudeEvent: "SessionStart",
      rawMatcher: "startup",
      declarationIndex: 0,
      scope: "project",
      marketplace: "project-hooks",
    });
    const event = { type: "session_start", reason: "startup" } satisfies SessionStartEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "session-context": { kind: "mutate", additionalContext: "project guidance" } },
      executorCalls,
    );
    setRoutingBucket("SessionStart", [entry]);
    const handler = compositeHandlerFor("SessionStart", currentEpoch(), undefined, executor);
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
        event: { type: "session_start", reason: "startup" },
      },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(pendingSessionStartContextEntries(), expectedPendingContext);
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a SessionEnd block after observing it", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
    const context = createExtensionContext("/workspace/session-end-block");
    const entry = createRoutingEntry({
      pluginId: "session-end-block",
      claudeEvent: "SessionEnd",
      rawMatcher: "",
      declarationIndex: 0,
    });
    const event = { type: "session_shutdown", reason: "reload" } satisfies SessionShutdownEvent;
    const executorCalls: RecordedCall[] = [];
    const executor = createRecordingExecutor(
      { "session-end-block": { kind: "block", reason: "ignored block" } },
      executorCalls,
    );
    setRoutingBucket("SessionEnd", [entry]);
    const handler = compositeHandlerFor("SessionEnd", currentEpoch(), undefined, executor);
    const expectedCalls: RecordedCall[] = [
      {
        pluginId: "session-end-block",
        event: { type: "session_shutdown", reason: "reload" },
      },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("drops a PreCompact stop after observing it", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PreCompact", [entry]);
    const handler = compositeHandlerFor("PreCompact", currentEpoch(), undefined, executor);
    const expectedCalls: RecordedCall[] = [
      { pluginId: "pre-compact-stop", event: structuredClone(event) },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });

  test("passes a PostCompact noop through after observing it", async (t) => {
    // arrange
    resetRoutingState();
    t.after(() => {
      resetRoutingState();
    });
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
    setRoutingBucket("PostCompact", [entry]);
    const handler = compositeHandlerFor("PostCompact", currentEpoch(), undefined, executor);
    const expectedCalls: RecordedCall[] = [
      { pluginId: "post-compact-noop", event: structuredClone(event) },
    ];

    // act
    await handler(event, context);

    // assert
    assert.deepStrictEqual(executorCalls, expectedCalls);
  });
});
