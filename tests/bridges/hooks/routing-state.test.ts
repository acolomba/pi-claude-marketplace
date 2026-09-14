// tests/bridges/hooks/routing-state.test.ts
//
// Tests whose SUBJECT is the routing-state module itself, sitting next to the
// module they exercise. Tests that merely USE `currentEpoch` or
// `getRoutingBucket` while asserting event-router behaviour stay in
// event-router.test.ts -- they are testing that module's public interface and
// these are helpers.

import assert from "node:assert/strict";
import { test } from "node:test";

import { createRoutingStateOperations } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type {
  CacheEntry,
  PendingSessionStartContext,
  RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

test("reports zero and exact successive epoch values", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());

  // act
  const epochs = [
    routingState.currentEpoch(),
    routingState.bumpEpoch(),
    routingState.currentEpoch(),
    routingState.bumpEpoch(),
    routingState.currentEpoch(),
  ];

  // assert
  assert.deepStrictEqual(epochs, [0, 1, 1, 2, 2]);
});

test("a fresh runtime begins at zero without changing an advanced peer", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const firstEpoch = routingState.bumpEpoch();
  const secondEpoch = routingState.bumpEpoch();

  // act
  const freshState = createRoutingStateOperations(createHooksRuntime());
  const freshValue = freshState.currentEpoch();
  const retainedValue = routingState.currentEpoch();

  // assert
  assert.deepStrictEqual(
    { firstEpoch, secondEpoch, freshValue, retainedValue },
    { firstEpoch: 1, secondEpoch: 2, freshValue: 0, retainedValue: 2 },
  );
});

test("reads an empty pending SessionStart context", (t) => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  routingState.clearPendingSessionStartContext();
  t.after(() => {
    routingState.clearPendingSessionStartContext();
  });

  // act
  const entries = routingState.pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("skips an empty pending SessionStart context", (t) => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  routingState.clearPendingSessionStartContext();
  t.after(() => {
    routingState.clearPendingSessionStartContext();
  });
  const emptyEntry = {
    context: "",
    pluginId: "empty-plugin",
    marketplace: "empty-marketplace",
    scope: "project",
  } satisfies PendingSessionStartContext;

  // act
  routingState.appendPendingSessionStartContext(emptyEntry);
  const entries = routingState.pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("preserves pending SessionStart context order across reads", (t) => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  routingState.clearPendingSessionStartContext();
  t.after(() => {
    routingState.clearPendingSessionStartContext();
  });
  const firstEntry = {
    context: "first context",
    pluginId: "first-plugin",
    marketplace: "first-marketplace",
    scope: "user",
  } satisfies PendingSessionStartContext;
  const secondEntry = {
    context: "second context",
    pluginId: "second-plugin",
    marketplace: "second-marketplace",
    scope: "project",
  } satisfies PendingSessionStartContext;
  const expectedEntries = [
    {
      context: "first context",
      pluginId: "first-plugin",
      marketplace: "first-marketplace",
      scope: "user",
    },
    {
      context: "second context",
      pluginId: "second-plugin",
      marketplace: "second-marketplace",
      scope: "project",
    },
  ] satisfies ReadonlyArray<PendingSessionStartContext>;

  // act
  routingState.appendPendingSessionStartContext(firstEntry);
  routingState.appendPendingSessionStartContext(secondEntry);
  const firstRead = routingState.pendingSessionStartContextEntries();
  const secondRead = routingState.pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstRead, expectedEntries);
  assert.deepStrictEqual(secondRead, expectedEntries);
});

test("clears pending SessionStart context for later reads", (t) => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  routingState.clearPendingSessionStartContext();
  t.after(() => {
    routingState.clearPendingSessionStartContext();
  });
  routingState.appendPendingSessionStartContext({
    context: "context to clear",
    pluginId: "clear-plugin",
    marketplace: "clear-marketplace",
    scope: "project",
  });

  // act
  routingState.clearPendingSessionStartContext();
  const firstReadAfterClear = routingState.pendingSessionStartContextEntries();
  const secondReadAfterClear = routingState.pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstReadAfterClear, []);
  assert.deepStrictEqual(secondReadAfterClear, []);
});

test("reads a missing parsed config without creating a cache entry", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const missingKey = "project\u0000catalog\u0000missing-plugin";

  // act
  const missingEntry = routingState.parsedConfigEntries().get(missingKey);
  const cacheEntries = Array.from(routingState.parsedConfigEntries());

  // assert
  assert.deepStrictEqual(
    { missingEntry, cacheEntries },
    { missingEntry: undefined, cacheEntries: [] },
  );
});

test("sets and stably reads a complete parsed config", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const cacheKey = "user\u0000catalog-alpha\u0000plugin-alpha";
  const cacheEntry = {
    scope: "user",
    marketplace: "catalog-alpha",
    pluginId: "plugin-alpha",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-alpha/plugin-alpha"),
    config: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo alpha" }],
        },
      ],
    },
    ifPredicates: new Map([["PreToolUse|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;
  const expectedEntry = {
    scope: "user",
    marketplace: "catalog-alpha",
    pluginId: "plugin-alpha",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-alpha/plugin-alpha"),
    config: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo alpha" }],
        },
      ],
    },
    ifPredicates: new Map([["PreToolUse|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;

  // act
  routingState.setParsedConfig(cacheKey, cacheEntry);
  const firstRead = routingState.parsedConfigEntries().get(cacheKey);
  const secondRead = routingState.parsedConfigEntries().get(cacheKey);
  const cacheEntries = Array.from(routingState.parsedConfigEntries());

  // assert
  assert.deepStrictEqual(firstRead, expectedEntry);
  assert.deepStrictEqual(secondRead, expectedEntry);
  assert.deepStrictEqual(cacheEntries, [[cacheKey, expectedEntry]]);
});

test("overwrites a parsed config under the same cache key", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const cacheKey = "project\u0000catalog-beta\u0000plugin-beta";
  const initialEntry = {
    scope: "project",
    marketplace: "catalog-beta",
    pluginId: "plugin-beta",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-beta/plugin-beta-v1"),
    config: {
      SessionStart: [
        {
          matcher: "startup",
          hooks: [{ type: "command", command: "echo version-one" }],
        },
      ],
    },
    ifPredicates: new Map([["SessionStart|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;
  const replacementEntry = {
    scope: "project",
    marketplace: "catalog-beta",
    pluginId: "plugin-beta",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-beta/plugin-beta-v2"),
    config: {
      SessionEnd: [
        {
          hooks: [{ type: "command", command: "echo version-two" }],
        },
      ],
    },
    ifPredicates: new Map([["SessionEnd|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;
  const expectedEntry = {
    scope: "project",
    marketplace: "catalog-beta",
    pluginId: "plugin-beta",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-beta/plugin-beta-v2"),
    config: {
      SessionEnd: [
        {
          hooks: [{ type: "command", command: "echo version-two" }],
        },
      ],
    },
    ifPredicates: new Map([["SessionEnd|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;

  // act
  routingState.setParsedConfig(cacheKey, initialEntry);
  routingState.setParsedConfig(cacheKey, replacementEntry);
  const cacheEntries = Array.from(routingState.parsedConfigEntries());

  // assert
  assert.deepStrictEqual(cacheEntries, [[cacheKey, expectedEntry]]);
});

test("deletes a parsed config and keeps it absent after a repeated delete", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const cacheKey = "user\u0000catalog-gamma\u0000plugin-gamma";
  const cacheEntry = {
    scope: "user",
    marketplace: "catalog-gamma",
    pluginId: "plugin-gamma",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-gamma/plugin-gamma"),
    config: {
      PostCompact: [
        {
          hooks: [{ type: "command", command: "echo compacted" }],
        },
      ],
    },
    ifPredicates: new Map([["PostCompact|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;

  routingState.setParsedConfig(cacheKey, cacheEntry);

  // act
  routingState.deleteParsedConfig(cacheKey);
  const firstReadAfterDelete = routingState.parsedConfigEntries().get(cacheKey);
  routingState.deleteParsedConfig(cacheKey);
  const secondReadAfterDelete = routingState.parsedConfigEntries().get(cacheKey);
  const cacheEntries = Array.from(routingState.parsedConfigEntries());

  // assert
  assert.deepStrictEqual(
    { firstReadAfterDelete, secondReadAfterDelete, cacheEntries },
    { firstReadAfterDelete: undefined, secondReadAfterDelete: undefined, cacheEntries: [] },
  );
});

test("returns an empty bucket and an empty routing table by default", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());

  // act
  const preToolUseBucket = routingState.getRoutingBucket("PreToolUse");
  const routingEntries = Array.from(routingState.routingTableEntries());

  // assert
  assert.deepStrictEqual(
    { preToolUseBucket, routingEntries },
    { preToolUseBucket: [], routingEntries: [] },
  );
});

test("sets and stably reads routing entries in per-bucket order", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const firstEntry = {
    scope: "user",
    marketplace: "catalog-alpha",
    pluginId: "plugin-alpha",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-alpha/plugin-alpha"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo alpha" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const secondEntry = {
    scope: "project",
    marketplace: "catalog-beta",
    pluginId: "plugin-beta",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-beta/plugin-beta"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo beta" },
    declarationIndex: 1,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const expectedEntries = [
    {
      scope: "user",
      marketplace: "catalog-alpha",
      pluginId: "plugin-alpha",
      resolvedSource: asAbsolutePluginRoot("/plugins/catalog-alpha/plugin-alpha"),
      claudeEvent: "PreToolUse",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: { type: "command", command: "echo alpha" },
      declarationIndex: 0,
      ifPredicate: { kind: "match-all" },
    },
    {
      scope: "project",
      marketplace: "catalog-beta",
      pluginId: "plugin-beta",
      resolvedSource: asAbsolutePluginRoot("/plugins/catalog-beta/plugin-beta"),
      claudeEvent: "PreToolUse",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: { type: "command", command: "echo beta" },
      declarationIndex: 1,
      ifPredicate: { kind: "match-all" },
    },
  ] satisfies ReadonlyArray<RoutingEntry>;

  // act
  routingState.setRoutingBucket("PreToolUse", [firstEntry, secondEntry]);
  const firstRead = routingState.getRoutingBucket("PreToolUse");
  const secondRead = routingState.getRoutingBucket("PreToolUse");

  // assert
  assert.deepStrictEqual(firstRead, expectedEntries);
  assert.deepStrictEqual(secondRead, expectedEntries);
});

test("replaces a routing bucket without retaining earlier entries", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const initialEntry = {
    scope: "user",
    marketplace: "catalog-initial",
    pluginId: "plugin-initial",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-initial/plugin-initial"),
    claudeEvent: "SessionEnd",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo initial" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const replacementEntry = {
    scope: "project",
    marketplace: "catalog-replacement",
    pluginId: "plugin-replacement",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-replacement/plugin-replacement"),
    claudeEvent: "SessionEnd",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo replacement" },
    declarationIndex: 4,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const expectedEntries = [
    {
      scope: "project",
      marketplace: "catalog-replacement",
      pluginId: "plugin-replacement",
      resolvedSource: asAbsolutePluginRoot("/plugins/catalog-replacement/plugin-replacement"),
      claudeEvent: "SessionEnd",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: { type: "command", command: "echo replacement" },
      declarationIndex: 4,
      ifPredicate: { kind: "match-all" },
    },
  ] satisfies ReadonlyArray<RoutingEntry>;

  // act
  routingState.setRoutingBucket("SessionEnd", [initialEntry]);
  routingState.setRoutingBucket("SessionEnd", [replacementEntry]);
  const sessionEndBucket = routingState.getRoutingBucket("SessionEnd");
  const routingEntries = Array.from(routingState.routingTableEntries());

  // assert
  assert.deepStrictEqual(sessionEndBucket, expectedEntries);
  assert.deepStrictEqual(routingEntries, [["SessionEnd", expectedEntries]]);
});

test("reads all routing buckets while preserving each bucket's order", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const sessionEndEntry = {
    scope: "project",
    marketplace: "catalog-session",
    pluginId: "plugin-session",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-session/plugin-session"),
    claudeEvent: "SessionEnd",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo session" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const firstPreToolEntry = {
    scope: "user",
    marketplace: "catalog-tools",
    pluginId: "plugin-tool-one",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-tools/plugin-tool-one"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo tool-one" },
    declarationIndex: 2,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const secondPreToolEntry = {
    scope: "project",
    marketplace: "catalog-tools",
    pluginId: "plugin-tool-two",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-tools/plugin-tool-two"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo tool-two" },
    declarationIndex: 3,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const expectedRoutingEntries = new Map<"SessionEnd" | "PreToolUse", ReadonlyArray<RoutingEntry>>([
    [
      "SessionEnd",
      [
        {
          scope: "project",
          marketplace: "catalog-session",
          pluginId: "plugin-session",
          resolvedSource: asAbsolutePluginRoot("/plugins/catalog-session/plugin-session"),
          claudeEvent: "SessionEnd",
          matcher: { kind: "match-all" },
          rawMatcher: "",
          handlerDecl: { type: "command", command: "echo session" },
          declarationIndex: 0,
          ifPredicate: { kind: "match-all" },
        },
      ],
    ],
    [
      "PreToolUse",
      [
        {
          scope: "user",
          marketplace: "catalog-tools",
          pluginId: "plugin-tool-one",
          resolvedSource: asAbsolutePluginRoot("/plugins/catalog-tools/plugin-tool-one"),
          claudeEvent: "PreToolUse",
          matcher: { kind: "match-all" },
          rawMatcher: "",
          handlerDecl: { type: "command", command: "echo tool-one" },
          declarationIndex: 2,
          ifPredicate: { kind: "match-all" },
        },
        {
          scope: "project",
          marketplace: "catalog-tools",
          pluginId: "plugin-tool-two",
          resolvedSource: asAbsolutePluginRoot("/plugins/catalog-tools/plugin-tool-two"),
          claudeEvent: "PreToolUse",
          matcher: { kind: "match-all" },
          rawMatcher: "",
          handlerDecl: { type: "command", command: "echo tool-two" },
          declarationIndex: 3,
          ifPredicate: { kind: "match-all" },
        },
      ],
    ],
  ]);

  // act
  routingState.setRoutingBucket("SessionEnd", [sessionEndEntry]);
  routingState.setRoutingBucket("PreToolUse", [firstPreToolEntry, secondPreToolEntry]);
  const firstRead = routingState.routingTableEntries();
  const secondRead = routingState.routingTableEntries();

  // assert
  assert.deepStrictEqual(firstRead, expectedRoutingEntries);
  assert.deepStrictEqual(secondRead, expectedRoutingEntries);
});

test("a fresh runtime starts empty without clearing a populated peer", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const cacheKey = "project\u0000catalog-reset\u0000plugin-reset";
  const cacheEntry = {
    scope: "project",
    marketplace: "catalog-reset",
    pluginId: "plugin-reset",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-reset/plugin-reset"),
    config: {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "echo reset" }],
        },
      ],
    },
    ifPredicates: new Map([["PreToolUse|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;
  const routingEntry = {
    scope: "project",
    marketplace: "catalog-reset",
    pluginId: "plugin-reset",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-reset/plugin-reset"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo reset" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const pendingEntry = {
    context: "reset context",
    pluginId: "plugin-reset",
    marketplace: "catalog-reset",
    scope: "project",
  } satisfies PendingSessionStartContext;

  routingState.setParsedConfig(cacheKey, cacheEntry);
  routingState.setRoutingBucket("PreToolUse", [routingEntry]);
  routingState.bumpEpoch();
  routingState.appendPendingSessionStartContext(pendingEntry);

  // act
  const stateBeforeReset = {
    epoch: routingState.currentEpoch(),
    parsedKeys: Array.from(routingState.parsedConfigEntries().keys()),
    routingEvents: Array.from(routingState.routingTableEntries().keys()),
    routedPluginIds: routingState.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    pendingContexts: routingState.pendingSessionStartContextEntries().map((entry) => entry.context),
  };
  const freshState = createRoutingStateOperations(createHooksRuntime());
  const stateFromFreshRuntime = {
    epoch: freshState.currentEpoch(),
    parsedKeys: Array.from(freshState.parsedConfigEntries().keys()),
    routingEvents: Array.from(freshState.routingTableEntries().keys()),
    routedPluginIds: freshState.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    pendingContexts: freshState.pendingSessionStartContextEntries().map((entry) => entry.context),
  };

  // assert
  assert.deepStrictEqual(stateBeforeReset, {
    epoch: 1,
    parsedKeys: [cacheKey],
    routingEvents: ["PreToolUse"],
    routedPluginIds: ["plugin-reset"],
    pendingContexts: ["reset context"],
  });
  assert.deepStrictEqual(stateFromFreshRuntime, {
    epoch: 0,
    parsedKeys: [],
    routingEvents: [],
    routedPluginIds: [],
    pendingContexts: [],
  });
});

test("binds routing operations to one required runtime instance", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const runtime = createHooksRuntime();
  const operations = createRoutingStateOperations(runtime);
  const cacheKey = "project\u0000catalog-bound\u0000plugin-bound";
  const cacheEntry = {
    scope: "project",
    marketplace: "catalog-bound",
    pluginId: "plugin-bound",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-bound/plugin-bound"),
    config: {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "echo bound" }],
        },
      ],
    },
    ifPredicates: new Map([["PreToolUse|0|0", { kind: "match-all" }]]),
  } satisfies CacheEntry;
  const route = {
    scope: "project",
    marketplace: "catalog-bound",
    pluginId: "plugin-bound",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-bound/plugin-bound"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "echo bound" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const pendingEntry = {
    context: "bound context",
    pluginId: "plugin-bound",
    marketplace: "catalog-bound",
    scope: "project",
  } satisfies PendingSessionStartContext;

  // act
  operations.setParsedConfig(cacheKey, cacheEntry);
  operations.setRoutingBucket("PreToolUse", [route]);
  operations.appendPendingSessionStartContext(pendingEntry);
  const explicitEpoch = operations.bumpEpoch();
  routingState.setParsedConfig(cacheKey, cacheEntry);
  routingState.setRoutingBucket("PreToolUse", [route]);
  routingState.appendPendingSessionStartContext(pendingEntry);
  const transitionEpoch = routingState.bumpEpoch();
  const explicitState = {
    epoch: operations.currentEpoch(),
    parsed: Array.from(operations.parsedConfigEntries()),
    routes: Array.from(operations.routingTableEntries()),
    pending: operations.pendingSessionStartContextEntries(),
  };
  const transitionState = {
    epoch: routingState.currentEpoch(),
    parsed: Array.from(routingState.parsedConfigEntries()),
    routes: Array.from(routingState.routingTableEntries()),
    pending: routingState.pendingSessionStartContextEntries(),
  };
  operations.deleteParsedConfig(cacheKey);
  operations.setRoutingBucket("PreToolUse", []);
  operations.clearPendingSessionStartContext();
  operations.bumpEpoch();

  // assert
  assert.strictEqual(explicitEpoch, 1);
  assert.strictEqual(transitionEpoch, 1);
  assert.deepStrictEqual(explicitState, transitionState);
  assert.deepStrictEqual(
    {
      epoch: routingState.currentEpoch(),
      parsed: Array.from(routingState.parsedConfigEntries()),
      routes: Array.from(routingState.routingTableEntries()),
      pending: routingState.pendingSessionStartContextEntries(),
    },
    transitionState,
  );
});

test("advancing generation preserves the runtime's other routing state", () => {
  // arrange
  const routingState = createRoutingStateOperations(createHooksRuntime());
  const cacheKey = "user\u0000catalog-preserved\u0000plugin-preserved";
  const cacheEntry = {
    scope: "user",
    marketplace: "catalog-preserved",
    pluginId: "plugin-preserved",
    resolvedSource: asAbsolutePluginRoot("/plugins/catalog-preserved/plugin-preserved"),
    config: {},
    ifPredicates: new Map(),
  } satisfies CacheEntry;
  const pendingEntry = {
    context: "preserved context",
    pluginId: "plugin-preserved",
    marketplace: "catalog-preserved",
    scope: "user",
  } satisfies PendingSessionStartContext;
  routingState.setParsedConfig(cacheKey, cacheEntry);
  routingState.setRoutingBucket("SessionEnd", []);
  routingState.appendPendingSessionStartContext(pendingEntry);
  routingState.bumpEpoch();

  // act
  const advancedEpoch = routingState.bumpEpoch();

  // assert
  assert.strictEqual(advancedEpoch, 2);
  assert.strictEqual(routingState.currentEpoch(), 2);
  assert.deepStrictEqual(Array.from(routingState.parsedConfigEntries()), [[cacheKey, cacheEntry]]);
  assert.deepStrictEqual(Array.from(routingState.routingTableEntries()), [["SessionEnd", []]]);
  assert.deepStrictEqual(routingState.pendingSessionStartContextEntries(), [pendingEntry]);
});
