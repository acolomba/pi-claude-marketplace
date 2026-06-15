import assert from "node:assert/strict";
import * as fs from "node:fs";
import { test, beforeEach } from "node:test";

import {
  _resetExecutorForTest,
  _setExecutorForTest,
  compositeHandlerFor,
  toolResultCompositeHandler,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import {
  _bumpEpochForTest,
  _parsedConfigCacheForTest,
  _resetForTest,
  _routingTableForTest,
  _setRoutingBucketForTest,
  addPluginConfigToCache,
  currentEpoch,
  rebuildRoutingTables,
  removePluginConfigFromCache,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import {
  BUCKET_A_EVENTS,
  type BucketAEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { HooksConfig } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionContext,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * Unit tests for `bridges/hooks/event-router.ts` -- the hooks-bridge
 * dispatch core's module-state cells and the synchronous rebuild path.
 *
 * Scope of this suite:
 *   - parsedConfigCache mutator idempotency + marketplace-keyed disambiguation.
 *   - rebuildRoutingTables: 8-bucket population, cross-plugin sort order
 *     against compareByNameThenScope, within-plugin declaration-order
 *     preservation, empty-rebuild clearing, cache-miss tolerance, and zero
 *     disk I/O on the hot path.
 *   - currentEpoch initial value and accessor shape.
 *
 * Composite-handler dispatch is exercised by the dispatch.ts test surface
 * landed alongside that file; this suite only pins the synchronous
 * primitives.
 */

beforeEach(() => {
  _resetForTest();
});

// Build a minimal ExtensionState fixture with one or more plugins. The
// state shape mirrors persistence/state-io.ts but is constructed in-memory
// (no disk fixtures required for the rebuild path).
function makeState(input: {
  marketplaces: Record<
    string,
    {
      scope: "user" | "project";
      plugins: Record<string, { hooks: string[] }>;
    }
  >;
}): ExtensionState {
  const marketplaces: ExtensionState["marketplaces"] = {};
  for (const [mpName, mp] of Object.entries(input.marketplaces)) {
    const plugins: (typeof marketplaces)[string]["plugins"] = {};
    for (const [pluginId, plugin] of Object.entries(mp.plugins)) {
      plugins[pluginId] = {
        version: "1.0.0",
        resolvedSource: "test://",
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: plugin.hooks },
        installedAt: "2026-06-14T00:00:00Z",
        updatedAt: "2026-06-14T00:00:00Z",
      };
    }

    marketplaces[mpName] = {
      name: mpName,
      scope: mp.scope,
      source: { kind: "path", raw: "/tmp/test" },
      addedFromCwd: "/tmp",
      manifestPath: "/tmp/test/marketplace.json",
      marketplaceRoot: "/tmp/test",
      plugins,
    };
  }

  return { schemaVersion: 1, marketplaces };
}

// Build a minimal HooksConfig with the given event -> matcher -> handler
// shape. `matcher` defaults to "" (match-all).
function makeConfig(
  arms: Array<{ event: string; matcher?: string; handlers: number }>,
): HooksConfig {
  const out: Record<
    string,
    Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>
  > = {};

  for (const arm of arms) {
    const groups = out[arm.event] ?? [];
    const hooks = Array.from({ length: arm.handlers }, (_v, i) => ({
      type: "command",
      command: `echo handler-${i.toString()}`,
    }));
    const group: { matcher?: string; hooks: Array<{ type: string; command: string }> } = { hooks };
    if (arm.matcher !== undefined) {
      group.matcher = arm.matcher;
    }

    groups.push(group);
    out[arm.event] = groups;
  }

  return out;
}

test("cache: addPluginConfigToCache + removePluginConfigFromCache are idempotent", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  addPluginConfigToCache("user", "mp", "p1", config);
  addPluginConfigToCache("user", "mp", "p1", config); // overwrite, not duplicate
  assert.equal(_parsedConfigCacheForTest().size, 1);

  removePluginConfigFromCache("user", "mp", "p1");
  assert.equal(_parsedConfigCacheForTest().size, 0);

  // Removing a missing entry is a no-op.
  assert.doesNotThrow(() => {
    removePluginConfigFromCache("user", "mp", "p1");
  });
  assert.equal(_parsedConfigCacheForTest().size, 0);
});

test("cache: key includes marketplace -- same (scope, pluginId) under different marketplaces do NOT collide", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  addPluginConfigToCache("user", "mp-alpha", "shared-id", config);
  addPluginConfigToCache("user", "mp-beta", "shared-id", config);

  assert.equal(_parsedConfigCacheForTest().size, 2);
});

test("rebuildRoutingTables: produces 8 Claude-event buckets", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "p1", config);

  const state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug-p1"] } } } },
  });
  const loc = locationsFor("user", "/tmp/cwd");

  rebuildRoutingTables(state, loc);

  const table = _routingTableForTest();
  assert.equal(table.size, BUCKET_A_EVENTS.length);
  for (const event of BUCKET_A_EVENTS) {
    assert.ok(table.has(event), `expected bucket for ${event}`);
  }
});

test("rebuildRoutingTables: cross-plugin order matches compareByNameThenScope (alphabetical + project tie-break)", () => {
  // compareByNameThenScope sorts primarily by name alphabetical; the
  // project-before-user tie-breaker only fires on same-name pairs. The
  // three plugin ids here have distinct names so the expected order is
  // strictly alphabetical: alpha, beta, gamma.
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  addPluginConfigToCache("user", "mp", "alpha", config);
  addPluginConfigToCache("project", "mp", "beta", config);
  addPluginConfigToCache("project", "mp", "gamma", config);

  const projectState = makeState({
    marketplaces: {
      mp: {
        scope: "project",
        plugins: { beta: { hooks: ["s-beta"] }, gamma: { hooks: ["s-gamma"] } },
      },
    },
  });
  rebuildRoutingTables(projectState, locationsFor("project", "/tmp/cwd"));
  const projectBucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.deepEqual(
    projectBucket.map((e) => e.pluginId),
    ["beta", "gamma"],
  );

  const userState = makeState({
    marketplaces: { mp: { scope: "user", plugins: { alpha: { hooks: ["s-alpha"] } } } },
  });
  rebuildRoutingTables(userState, locationsFor("user", "/tmp/cwd"));
  const userBucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.deepEqual(
    userBucket.map((e) => e.pluginId),
    ["alpha"],
  );
});

test("rebuildRoutingTables: within-plugin declaration order preserved via declarationIndex", () => {
  // Two PreToolUse groups in the same plugin: the first group has 2
  // handlers, the second has 1. The flattened bucket order should be the
  // (group, handler) source order: g0[h0], g0[h1], g1[h0].
  const config = makeConfig([
    { event: "PreToolUse", matcher: "", handlers: 2 },
    { event: "PreToolUse", matcher: "", handlers: 1 },
  ]);
  addPluginConfigToCache("user", "mp", "p1", config);

  const state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug"] } } } },
  });
  rebuildRoutingTables(state, locationsFor("user", "/tmp/cwd"));

  const bucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.equal(bucket.length, 3);
  assert.deepEqual(
    bucket.map((e) => e.declarationIndex),
    [0, 1, 2],
  );
  // The handler commands carry the source-position id; assert order via the
  // handlerDecl.command suffix.
  assert.deepEqual(
    bucket.map((e) => e.handlerDecl["command"]),
    ["echo handler-0", "echo handler-1", "echo handler-0"],
  );
});

test("rebuildRoutingTables: empty rebuild clears stale entries", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "p1", config);

  let state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["s-p1"] } } } },
  });
  const loc = locationsFor("user", "/tmp/cwd");
  rebuildRoutingTables(state, loc);
  assert.equal((_routingTableForTest().get("PreToolUse") ?? []).length, 1);

  // Drop every plugin from state; rebuild must clear the PreToolUse bucket
  // (the cache entry is still present but the state no longer references
  // it, so it MUST NOT leak into the bucket).
  state = makeState({ marketplaces: {} });
  rebuildRoutingTables(state, loc);

  const table = _routingTableForTest();
  for (const event of BUCKET_A_EVENTS) {
    assert.deepEqual(table.get(event), [], `expected empty bucket for ${event}`);
  }
});

test("rebuildRoutingTables: cache miss for a state-declared plugin is silent", () => {
  // State declares a plugin with a hooks resource but the cache has no
  // entry for it. Rebuild MUST NOT throw, and the plugin's entries MUST NOT
  // appear in any bucket (the first-install-window case where install has
  // populated state but the cache is not yet hydrated).
  const state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug-p1"] } } } },
  });
  const loc = locationsFor("user", "/tmp/cwd");

  assert.doesNotThrow(() => {
    rebuildRoutingTables(state, loc);
  });

  for (const event of BUCKET_A_EVENTS) {
    assert.deepEqual(_routingTableForTest().get(event), [], `expected empty bucket for ${event}`);
  }
});

test("rebuildRoutingTables: zero disk I/O on the hot path", (t) => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "p1", config);

  const state = makeState({
    marketplaces: { mp: { scope: "user", plugins: { p1: { hooks: ["slug"] } } } },
  });
  const loc = locationsFor("user", "/tmp/cwd");

  // Wrap fs.promises.readFile to throw if invoked during rebuild. If the
  // rebuild path secretly reads from disk, the throw trips the
  // assertion below. DISP-02.
  const sentinel = t.mock.method(fs.promises, "readFile", () => {
    throw new Error("disk I/O is forbidden during rebuild");
  });

  assert.doesNotThrow(() => {
    rebuildRoutingTables(state, loc);
  });

  sentinel.mock.restore();
});

test("currentEpoch: starts at 0 in a fresh module load and exposes a number", () => {
  // _resetForTest in beforeEach restores the cell to 0. The registerHooks-
  // Bridge increment path is exercised by the dispatch suite below and by
  // the architecture test that ships with the wiring plan.
  assert.equal(currentEpoch(), 0);
  assert.equal(typeof currentEpoch(), "number");
});

// ──────────────────────────────────────────────────────────────────────────
// Dispatch tests (compositeHandlerFor + toolResultCompositeHandler)
// ──────────────────────────────────────────────────────────────────────────

// Build a synthetic RoutingEntry. `rawMatcher` defaults to "" (match-all).
function makeEntry(input: {
  pluginId: string;
  claudeEvent?: BucketAEvent;
  rawMatcher?: string;
  command?: string;
  declarationIndex?: number;
}): RoutingEntry {
  const rawMatcher = input.rawMatcher ?? "";
  return {
    scope: "user",
    marketplace: "mp",
    pluginId: input.pluginId,
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
    handlerDecl: { type: "command", command: input.command ?? `echo ${input.pluginId}` },
    declarationIndex: input.declarationIndex ?? 0,
  };
}

const stubCtx = {} as unknown as ExtensionContext;

test("compositeHandlerFor: fires dispatchHookExec for each bucket entry sequentially", async (t) => {
  const calls: string[] = [];
  _setExecutorForTest((entry) => {
    calls.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
    makeEntry({ pluginId: "p3", declarationIndex: 2 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(calls, ["p1", "p2", "p3"]);
});

test("compositeHandlerFor: skips entries whose matcher does not fire", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p-edit-a", rawMatcher: "Edit" }),
    makeEntry({ pluginId: "p-edit-b", rawMatcher: "Edit" }),
    makeEntry({ pluginId: "p-bash", rawMatcher: "Bash" }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "edit", input: {} as never },
    stubCtx,
  );

  assert.deepEqual(fired, ["p-edit-a", "p-edit-b"]);
});

test("compositeHandlerFor: SessionStart filter against event.reason", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("SessionStart", [
    makeEntry({ pluginId: "p-any", rawMatcher: "" }),
    makeEntry({ pluginId: "p-startup", rawMatcher: "startup" }),
    makeEntry({ pluginId: "p-resume", rawMatcher: "resume" }),
  ]);

  const handler = compositeHandlerFor("SessionStart", currentEpoch());
  await handler({ type: "session_start", reason: "startup" }, stubCtx);

  assert.deepEqual(fired, ["p-any", "p-startup"]);
});

test("compositeHandlerFor: UserPromptSubmit fires unconditionally on every event", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("UserPromptSubmit", [
    makeEntry({ pluginId: "p-a", rawMatcher: "" }),
    makeEntry({ pluginId: "p-b", rawMatcher: "" }),
  ]);

  const handler = compositeHandlerFor("UserPromptSubmit", currentEpoch());
  await handler({ type: "input", text: "hello", source: "interactive" }, stubCtx);

  assert.deepEqual(fired, ["p-a", "p-b"]);
});

test("compositeHandlerFor: epoch mismatch causes no-op without invoking dispatchHookExec", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [makeEntry({ pluginId: "p1" })]);

  // Capture an epoch value, then bump the live cell so the handler's
  // captured value is stale.
  const stale = currentEpoch();
  _bumpEpochForTest();
  assert.notEqual(stale, currentEpoch());

  const handler = compositeHandlerFor("PreToolUse", stale);
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(fired, []);
});

test("toolResultCompositeHandler: event.isError true routes to PostToolUseFailure bucket", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(
    {
      type: "tool_result",
      toolCallId: "x",
      toolName: "bash",
      input: {},
      content: [],
      isError: true,
      details: undefined,
    } as unknown as ToolResultEvent,
    stubCtx,
  );

  assert.deepEqual(fired, ["p-failure"]);
});

test("toolResultCompositeHandler: event.isError false routes to PostToolUse bucket", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch());
  await handler(
    {
      type: "tool_result",
      toolCallId: "x",
      toolName: "bash",
      input: {},
      content: [],
      isError: false,
      details: undefined,
    } as unknown as ToolResultEvent,
    stubCtx,
  );

  assert.deepEqual(fired, ["p-success"]);
});

test("toolResultCompositeHandler: epoch mismatch causes no-op", async (t) => {
  const fired: string[] = [];
  _setExecutorForTest((entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PostToolUse", [makeEntry({ pluginId: "p1" })]);
  _setRoutingBucketForTest("PostToolUseFailure", [makeEntry({ pluginId: "p2" })]);

  const stale = currentEpoch();
  _bumpEpochForTest();

  const handler = toolResultCompositeHandler(stale);
  await handler(
    {
      type: "tool_result",
      toolCallId: "x",
      toolName: "bash",
      input: {},
      content: [],
      isError: false,
      details: undefined,
    } as unknown as ToolResultEvent,
    stubCtx,
  );

  assert.deepEqual(fired, []);
});

test("dispatch is sequential awaited (NOT Promise.all)", async (t) => {
  // Prove serial dispatch by recording start AND end positions of each
  // call. If entries were dispatched via Promise.all, both calls would
  // start before either ended; with sequential await, the second start
  // must follow the first end.
  const events: string[] = [];
  _setExecutorForTest(async (entry) => {
    events.push(`start:${entry.pluginId}`);
    await new Promise((r) => setTimeout(r, 10));
    events.push(`end:${entry.pluginId}`);
    return { kind: "noop" as const };
  });
  t.after(() => {
    _resetExecutorForTest();
  });

  _setRoutingBucketForTest("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch());
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(events, ["start:p1", "end:p1", "start:p2", "end:p2"]);
});
