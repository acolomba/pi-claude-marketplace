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
  hydrateProjectScopeForCwd,
  rebuildRoutingTables,
  removePluginConfigFromCache,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
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

  addPluginConfigToCache("user", "mp", "p1", config, new Map());
  addPluginConfigToCache("user", "mp", "p1", config, new Map()); // overwrite, not duplicate
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

  addPluginConfigToCache("user", "mp-alpha", "shared-id", config, new Map());
  addPluginConfigToCache("user", "mp-beta", "shared-id", config, new Map());

  assert.equal(_parsedConfigCacheForTest().size, 2);
});

test("rebuildRoutingTables: produces 8 Claude-event buckets", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "p1", config, new Map());

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

  addPluginConfigToCache("user", "mp", "alpha", config, new Map());
  addPluginConfigToCache("project", "mp", "beta", config, new Map());
  addPluginConfigToCache("project", "mp", "gamma", config, new Map());

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
  addPluginConfigToCache("user", "mp", "p1", config, new Map());

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
  addPluginConfigToCache("user", "mp", "p1", config, new Map());

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

test("rebuildRoutingTables: sequential per-scope rebuild preserves entries across scopes (cross-scope wipe regression)", () => {
  // Pin the cross-scope-wipe regression: `routingTable` is a single
  // module-global Map, but rebuild has historically populated it from a
  // per-scope filtered cache view. Sequential per-scope calls (the
  // registerHooksBridge boot loop in event-router.ts, and the per-scope
  // loop in orchestrators/reconcile/apply.ts) therefore wiped each
  // other's buckets -- the last scope's empty view overwrote the first
  // scope's populated buckets.
  //
  // Setup: ONE user-scope hooks plugin declaring SessionStart. Project
  // scope has nothing installed (empty state). Rebuild for user first,
  // confirm the bucket has 1 entry, THEN rebuild for project (whose
  // state has zero hooks-declaring plugins). The user-scope entry MUST
  // survive the project-scope rebuild because the routing table is a
  // single global cross-scope object.
  const config = makeConfig([{ event: "SessionStart", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "learning-output-style", config, new Map());

  const userState = makeState({
    marketplaces: {
      mp: { scope: "user", plugins: { "learning-output-style": { hooks: ["slug"] } } },
    },
  });
  rebuildRoutingTables(userState, locationsFor("user", "/tmp/cwd"));
  assert.equal(
    (_routingTableForTest().get("SessionStart") ?? []).length,
    1,
    "user-scope rebuild should populate SessionStart with 1 entry",
  );

  const emptyProjectState = makeState({ marketplaces: {} });
  rebuildRoutingTables(emptyProjectState, locationsFor("project", "/tmp/cwd"));
  assert.equal(
    (_routingTableForTest().get("SessionStart") ?? []).length,
    1,
    "project-scope rebuild with empty state MUST NOT wipe the user-scope's SessionStart entry",
  );
});

test("rebuildRoutingTables: cross-scope cache walk includes BOTH scopes' entries simultaneously", () => {
  // Companion to the cross-scope-wipe regression: a single rebuild call
  // (regardless of the `loc.scope` it nominally targets) MUST surface
  // every cached entry across both scopes. Without this, an install in
  // one scope followed by a reconcile rebuild in the OTHER scope would
  // silently drop the install's entries.
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache("user", "mp", "alpha", config, new Map());
  addPluginConfigToCache("project", "mp", "beta", config, new Map());

  // Rebuild nominally for project scope; both entries must surface.
  const projectState = makeState({
    marketplaces: {
      mp: { scope: "project", plugins: { beta: { hooks: ["s-beta"] } } },
    },
  });
  rebuildRoutingTables(projectState, locationsFor("project", "/tmp/cwd"));

  const bucket = _routingTableForTest().get("PreToolUse") ?? [];
  assert.deepEqual(
    bucket.map((e) => `${e.scope}/${e.pluginId}`).sort(),
    ["project/beta", "user/alpha"],
    "rebuild must walk the full cross-scope cache, not filter by loc.scope",
  );
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
  addPluginConfigToCache("user", "mp", "p1", config, new Map());

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
    ifPredicate: MATCH_ALL_IF,
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

// ───────────────────────────────────────────────────────────────────────────
// WR-01: hydrateProjectScopeForCwd clears phantom project-arm cache entries
// before re-hydrating. Phantom entries originate at factory time when the
// extension loads before `resources_discover` has supplied a real project
// cwd: `registerHooksBridge` then hydrates the project scope under
// `homedir()`, populating `parsedConfigCache` with entries read from the
// wrong project root. The fix clears every `project`-scope cache entry on
// every call to `hydrateProjectScopeForCwd` so the re-hydrate against the
// real cwd starts from a clean slate. User-scope entries are untouched.
// ───────────────────────────────────────────────────────────────────────────

test("WR-01: hydrateProjectScopeForCwd clears phantom project-arm cache entries before re-hydrating", async () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  // Pre-seed a phantom project-scope entry as if factory-time hydrate ran
  // under the wrong cwd and slurped a project-scope plugin into the cache.
  addPluginConfigToCache("project", "mp-phantom", "phantom-plugin", config, new Map());
  assert.equal(_parsedConfigCacheForTest().size, 1);

  // Invoke the re-hydrate against a temp cwd whose `.pi/agent/state.json`
  // does not exist. `loadState` returns DEFAULT_STATE on ENOENT, so the
  // hydrate is effectively a no-op past the clear-cache prefix.
  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  // The phantom is gone; no project-scope entries remain.
  assert.equal(_parsedConfigCacheForTest().size, 0);
});

test("WR-01: hydrateProjectScopeForCwd leaves user-scope cache entries untouched", async () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  // Pre-seed BOTH a user-scope entry (legitimate, factory-time hydrate under
  // homedir() was correct for user scope) AND a project-scope entry
  // (phantom from factory-time hydrate under the wrong cwd).
  addPluginConfigToCache("user", "mp-u", "user-plugin", config, new Map());
  addPluginConfigToCache("project", "mp-p", "project-plugin", config, new Map());
  assert.equal(_parsedConfigCacheForTest().size, 2);

  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  // Only the user-scope entry survives.
  const cache = _parsedConfigCacheForTest();
  assert.equal(cache.size, 1);
  // Inspect the surviving entry: the value record carries `scope`, so we
  // can assert that the survivor is the user-scope one without parsing the
  // key format.
  const survivor = [...cache.values()][0];
  assert.equal(survivor?.scope, "user");
  assert.equal(survivor?.pluginId, "user-plugin");
});

test("WR-01: hydrateProjectScopeForCwd clears all project-scope entries regardless of marketplace", async () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  // Multiple phantom project-scope entries across different marketplaces:
  // the prefix-on-`<scope>\x00` clear MUST drop all of them.
  addPluginConfigToCache("project", "mp-alpha", "p1", config, new Map());
  addPluginConfigToCache("project", "mp-beta", "p2", config, new Map());
  addPluginConfigToCache("project", "mp-gamma", "p3", config, new Map());
  addPluginConfigToCache("user", "mp-u", "u1", config, new Map());
  assert.equal(_parsedConfigCacheForTest().size, 4);

  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  const cache = _parsedConfigCacheForTest();
  assert.equal(cache.size, 1);
  const survivor = [...cache.values()][0];
  assert.equal(survivor?.scope, "user");
});
