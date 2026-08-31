// tests/bridges/hooks/routing-state.test.ts
//
// Tests whose SUBJECT is the routing-state module itself, sitting next to the
// module they exercise. Tests that merely USE `currentEpoch` or
// `getRoutingBucket` while asserting event-router behaviour stay in
// event-router.test.ts -- they are testing that module's public interface and
// these are helpers.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appendPendingSessionStartContext,
  bumpEpoch,
  clearPendingSessionStartContext,
  currentEpoch,
  deleteParsedConfig,
  getRoutingBucket,
  parsedConfigEntries,
  pendingSessionStartContextEntries,
  resetEpoch,
  resetRoutingState,
  routingTableEntries,
  setParsedConfig,
  setRoutingBucket,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type {
  CacheEntry,
  PendingSessionStartContext,
  RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

test("reports zero and exact successive epoch values", (t) => {
  // arrange
  resetEpoch();
  t.after(() => {
    resetEpoch();
  });

  // act
  const epochs = [currentEpoch(), bumpEpoch(), currentEpoch(), bumpEpoch(), currentEpoch()];

  // assert
  assert.deepStrictEqual(epochs, [0, 1, 1, 2, 2]);
});

test("resets an advanced epoch to zero", (t) => {
  // arrange
  resetEpoch();
  t.after(() => {
    resetEpoch();
  });
  const firstEpoch = bumpEpoch();
  const secondEpoch = bumpEpoch();

  // act
  resetEpoch();
  const resetValue = currentEpoch();

  // assert
  assert.deepStrictEqual(
    { firstEpoch, secondEpoch, resetValue },
    { firstEpoch: 1, secondEpoch: 2, resetValue: 0 },
  );
});

test("reads an empty pending SessionStart context", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });

  // act
  const entries = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("skips an empty pending SessionStart context", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });
  const emptyEntry = {
    context: "",
    pluginId: "empty-plugin",
    marketplace: "empty-marketplace",
    scope: "project",
  } satisfies PendingSessionStartContext;

  // act
  appendPendingSessionStartContext(emptyEntry);
  const entries = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(entries, []);
});

test("preserves pending SessionStart context order across reads", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
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
  appendPendingSessionStartContext(firstEntry);
  appendPendingSessionStartContext(secondEntry);
  const firstRead = pendingSessionStartContextEntries();
  const secondRead = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstRead, expectedEntries);
  assert.deepStrictEqual(secondRead, expectedEntries);
});

test("clears pending SessionStart context for later reads", (t) => {
  // arrange
  clearPendingSessionStartContext();
  t.after(() => {
    clearPendingSessionStartContext();
  });
  appendPendingSessionStartContext({
    context: "context to clear",
    pluginId: "clear-plugin",
    marketplace: "clear-marketplace",
    scope: "project",
  });

  // act
  clearPendingSessionStartContext();
  const firstReadAfterClear = pendingSessionStartContextEntries();
  const secondReadAfterClear = pendingSessionStartContextEntries();

  // assert
  assert.deepStrictEqual(firstReadAfterClear, []);
  assert.deepStrictEqual(secondReadAfterClear, []);
});

test("reads a missing parsed config without creating a cache entry", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
  const missingKey = "project\u0000catalog\u0000missing-plugin";

  // act
  const missingEntry = parsedConfigEntries().get(missingKey);
  const cacheEntries = Array.from(parsedConfigEntries());

  // assert
  assert.deepStrictEqual(
    { missingEntry, cacheEntries },
    { missingEntry: undefined, cacheEntries: [] },
  );
});

test("sets and stably reads a complete parsed config", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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
  setParsedConfig(cacheKey, cacheEntry);
  const firstRead = parsedConfigEntries().get(cacheKey);
  const secondRead = parsedConfigEntries().get(cacheKey);
  const cacheEntries = Array.from(parsedConfigEntries());

  // assert
  assert.deepStrictEqual(firstRead, expectedEntry);
  assert.deepStrictEqual(secondRead, expectedEntry);
  assert.deepStrictEqual(cacheEntries, [[cacheKey, expectedEntry]]);
});

test("overwrites a parsed config under the same cache key", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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
  setParsedConfig(cacheKey, initialEntry);
  setParsedConfig(cacheKey, replacementEntry);
  const cacheEntries = Array.from(parsedConfigEntries());

  // assert
  assert.deepStrictEqual(cacheEntries, [[cacheKey, expectedEntry]]);
});

test("deletes a parsed config and keeps it absent after a repeated delete", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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

  setParsedConfig(cacheKey, cacheEntry);

  // act
  deleteParsedConfig(cacheKey);
  const firstReadAfterDelete = parsedConfigEntries().get(cacheKey);
  deleteParsedConfig(cacheKey);
  const secondReadAfterDelete = parsedConfigEntries().get(cacheKey);
  const cacheEntries = Array.from(parsedConfigEntries());

  // assert
  assert.deepStrictEqual(
    { firstReadAfterDelete, secondReadAfterDelete, cacheEntries },
    { firstReadAfterDelete: undefined, secondReadAfterDelete: undefined, cacheEntries: [] },
  );
});

test("returns an empty bucket and an empty routing table by default", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });

  // act
  const preToolUseBucket = getRoutingBucket("PreToolUse");
  const routingEntries = Array.from(routingTableEntries());

  // assert
  assert.deepStrictEqual(
    { preToolUseBucket, routingEntries },
    { preToolUseBucket: [], routingEntries: [] },
  );
});

test("sets and stably reads routing entries in per-bucket order", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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
  setRoutingBucket("PreToolUse", [firstEntry, secondEntry]);
  const firstRead = getRoutingBucket("PreToolUse");
  const secondRead = getRoutingBucket("PreToolUse");

  // assert
  assert.deepStrictEqual(firstRead, expectedEntries);
  assert.deepStrictEqual(secondRead, expectedEntries);
});

test("replaces a routing bucket without retaining earlier entries", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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
  setRoutingBucket("SessionEnd", [initialEntry]);
  setRoutingBucket("SessionEnd", [replacementEntry]);
  const sessionEndBucket = getRoutingBucket("SessionEnd");
  const routingEntries = Array.from(routingTableEntries());

  // assert
  assert.deepStrictEqual(sessionEndBucket, expectedEntries);
  assert.deepStrictEqual(routingEntries, [["SessionEnd", expectedEntries]]);
});

test("reads all routing buckets while preserving each bucket's order", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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
  setRoutingBucket("SessionEnd", [sessionEndEntry]);
  setRoutingBucket("PreToolUse", [firstPreToolEntry, secondPreToolEntry]);
  const firstRead = routingTableEntries();
  const secondRead = routingTableEntries();

  // assert
  assert.deepStrictEqual(firstRead, expectedRoutingEntries);
  assert.deepStrictEqual(secondRead, expectedRoutingEntries);
});

test("resets every routing state cell through the composite lifecycle", (t) => {
  // arrange
  resetRoutingState();
  t.after(() => {
    resetRoutingState();
  });
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

  setParsedConfig(cacheKey, cacheEntry);
  setRoutingBucket("PreToolUse", [routingEntry]);
  bumpEpoch();
  appendPendingSessionStartContext(pendingEntry);

  // act
  const stateBeforeReset = {
    epoch: currentEpoch(),
    parsedKeys: Array.from(parsedConfigEntries().keys()),
    routingEvents: Array.from(routingTableEntries().keys()),
    routedPluginIds: getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    pendingContexts: pendingSessionStartContextEntries().map((entry) => entry.context),
  };
  resetRoutingState();
  const stateAfterReset = {
    epoch: currentEpoch(),
    parsedKeys: Array.from(parsedConfigEntries().keys()),
    routingEvents: Array.from(routingTableEntries().keys()),
    routedPluginIds: getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    pendingContexts: pendingSessionStartContextEntries().map((entry) => entry.context),
  };

  // assert
  assert.deepStrictEqual(stateBeforeReset, {
    epoch: 1,
    parsedKeys: [cacheKey],
    routingEvents: ["PreToolUse"],
    routedPluginIds: ["plugin-reset"],
    pendingContexts: ["reset context"],
  });
  assert.deepStrictEqual(stateAfterReset, {
    epoch: 0,
    parsedKeys: [],
    routingEvents: [],
    routedPluginIds: [],
    pendingContexts: [],
  });
});
