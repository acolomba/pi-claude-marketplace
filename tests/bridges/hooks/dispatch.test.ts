import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import { compositeHandlerFor } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import { compileIfPredicate } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  currentEpoch,
  resetRoutingState,
  setRoutingBucket,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type {
  HookExecutor,
  CompositeReturnFor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
