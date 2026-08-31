import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test, beforeEach } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import { pidTablePath } from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import {
  compositeHandlerFor,
  toolResultCompositeHandler,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import { adaptObservationResultForEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import {
  addPluginConfigToCache,
  hydrateProjectScopeForCwd,
  rebuildRoutingTables,
  registerHooksBridge,
  removePluginConfigFromCache,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import {
  bumpEpoch,
  getRoutingBucket,
  parsedConfigEntries,
  pendingSessionStartContextEntries,
  resetRoutingState,
  routingTableEntries,
  setRoutingBucket,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import {
  currentEpoch,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import {
  agentEndCacheHandler,
  resetSettleState,
  settleHandlerFor,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/settle.ts";
import {
  BUCKET_A_EVENTS,
  type BucketAEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { SpawnDeps } from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { HookExecutor } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type { HooksConfig } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

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
  resetRoutingState();
});

test(
  "reload resets lifecycle state before hydrating routes, reaping orphans, and registering handlers",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-reload-"));
    const projectRoot = path.join(root, "project");
    const userAgentRoot = path.join(root, "user-agent");
    const originalHome = process.env.HOME;
    const originalAgentRoot = process.env.PI_CODING_AGENT_DIR;
    process.env.HOME = path.join(root, "home");
    process.env.PI_CODING_AGENT_DIR = userAgentRoot;
    t.after(async () => {
      shutdownInMemoryChildren();
      resetSettleState();
      resetRoutingState();
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      if (originalAgentRoot === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = originalAgentRoot;
      }

      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    });
    resetSettleState();
    shutdownInMemoryChildren();
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    const userHooksPath = path.join(userLocations.hooksDir, "user-hooks", "hooks.json");
    const projectHooksPath = path.join(projectLocations.hooksDir, "project-hooks", "hooks.json");
    const userPluginRoot = path.join(root, "plugins", "user-plugin");
    const projectPluginRoot = path.join(root, "plugins", "project-plugin");
    const userMarketplaceRoot = path.join(root, "marketplaces", "user-catalog");
    const projectMarketplaceRoot = path.join(root, "marketplaces", "project-catalog");
    const userState = {
      schemaVersion: 2,
      marketplaces: {
        "user-catalog": {
          name: "user-catalog",
          scope: "user",
          source: { kind: "path", raw: userMarketplaceRoot, logical: userMarketplaceRoot },
          addedFromCwd: projectRoot,
          manifestPath: path.join(userMarketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: userMarketplaceRoot,
          plugins: {
            "user-plugin": {
              version: "1.0.0",
              resolvedSource: userPluginRoot,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["user-hooks"],
              },
              enabled: true,
              installedAt: "2026-08-31T10:00:00.000Z",
              updatedAt: "2026-08-31T10:00:00.000Z",
            },
          },
        },
      },
    } satisfies ExtensionState;
    const projectState = {
      schemaVersion: 2,
      marketplaces: {
        "project-catalog": {
          name: "project-catalog",
          scope: "project",
          source: {
            kind: "path",
            raw: projectMarketplaceRoot,
            logical: projectMarketplaceRoot,
          },
          addedFromCwd: projectRoot,
          manifestPath: path.join(projectMarketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: projectMarketplaceRoot,
          plugins: {
            "project-plugin": {
              version: "1.0.0",
              resolvedSource: projectPluginRoot,
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["project-hooks"],
              },
              enabled: true,
              installedAt: "2026-08-31T10:00:00.000Z",
              updatedAt: "2026-08-31T10:00:00.000Z",
            },
          },
        },
      },
    } satisfies ExtensionState;
    await mkdir(path.dirname(userHooksPath), { recursive: true });
    await mkdir(path.dirname(projectHooksPath), { recursive: true });
    await writeFile(
      userHooksPath,
      JSON.stringify(
        makeConfig([
          { event: "SessionStart", handlers: 1 },
          { event: "Stop", handlers: 1 },
        ]),
      ),
      "utf8",
    );
    await writeFile(
      projectHooksPath,
      JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1 }])),
      "utf8",
    );
    await saveState(userLocations.extensionRoot, userState);
    await saveState(projectLocations.extensionRoot, projectState);
    const notifications: Array<{
      readonly text: string;
      readonly severity: "info" | "warning" | "error" | undefined;
    }> = [];
    const context = {
      ui: {
        notify(text: string, severity?: "info" | "warning" | "error"): void {
          notifications.push({ text, severity });
        },
      } as ExtensionContext["ui"],
      mode: "print",
      hasUI: false,
      cwd: projectRoot,
      sessionManager: SessionManager.inMemory(root, { id: "router-reload-session" }),
      get modelRegistry(): ExtensionContext["modelRegistry"] {
        throw new Error("router reload must not read modelRegistry");
      },
      model: undefined,
      scopedModels: [],
      isIdle: () => true,
      isProjectTrusted: () => true,
      signal: undefined,
      abort(): never {
        throw new Error("router reload must not abort Pi");
      },
      hasPendingMessages: () => false,
      shutdown(): never {
        throw new Error("router reload must not shut down Pi");
      },
      getContextUsage: () => undefined,
      compact(): never {
        throw new Error("router reload must not compact the session");
      },
      getSystemPrompt(): never {
        throw new Error("router reload must not read the system prompt");
      },
    } satisfies ExtensionContext;
    const registrations: Array<{ readonly event: string; readonly handler: unknown }> = [];
    const sentMessages: Array<{ readonly message: unknown; readonly options: unknown }> = [];
    const operationLog: string[] = [];
    let traceReload = false;
    const pi = {
      on(event: string, handler: unknown): void {
        registrations.push({ event, handler });
        if (traceReload) {
          operationLog.push(`register:${event}`);
        }
      },
      sendMessage(message: unknown, options: unknown): void {
        sentMessages.push({ message, options });
      },
    } as ExtensionAPI;
    const dispatched: string[] = [];
    const executor: HookExecutor = (entry) => {
      dispatched.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    };

    await registerHooksBridge(pi, { ctx: context, cwd: projectRoot, executor });
    const previousEpoch = currentEpoch();
    const staleToolCallHandler = registrations.find(({ event }) => event === "tool_call")?.handler;
    registrations.length = 0;
    adaptObservationResultForEvent(
      { kind: "mutate", additionalContext: "stale context" },
      "SessionStart",
      { scope: "user", marketplace: "user-catalog", pluginId: "user-plugin" },
    );
    const previousEnding = {
      type: "agent_end",
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: "stale assistant" }],
          stopReason: "stop",
          timestamp: 1,
        },
      ],
    } as AgentEndEvent;
    agentEndCacheHandler(previousEpoch)(previousEnding);
    const settleResetCalls: string[] = [];
    const settleResetPromises: Promise<void>[] = [];
    const settleResetExecutor: HookExecutor = (entry) => {
      settleResetCalls.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    };

    const childEvents = new EventEmitter();
    const childStdin = new PassThrough();
    const childStdout = new PassThrough();
    const childStderr = new PassThrough();
    let childKilled = false;
    const child: ChildProcess = Object.assign(childEvents, {
      stdin: childStdin,
      stdout: childStdout,
      stderr: childStderr,
      stdio: [childStdin, childStdout, childStderr, undefined, undefined] as ChildProcess["stdio"],
      connected: false,
      pid: 43_107,
      exitCode: null,
      signalCode: null,
      get killed(): boolean {
        return childKilled;
      },
      spawnargs: [],
      spawnfile: "",
      kill(signal?: NodeJS.Signals | number): boolean {
        assert.strictEqual(currentEpoch(), previousEpoch + 1);
        operationLog.push("epoch:bumped");
        assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
        operationLog.push("pending:reset");
        const settleReset = settleHandlerFor(
          currentEpoch(),
          pi,
          settleResetExecutor,
        )({ type: "agent_settled" }, context);
        settleResetPromises.push(settleReset);
        assert.deepStrictEqual(settleResetCalls, []);
        operationLog.push("settle:reset");
        assert.strictEqual(signal, "SIGKILL");
        operationLog.push("child:shutdown");
        childKilled = true;
        return true;
      },
      disconnect(): void {
        return;
      },
      send(): boolean {
        return false;
      },
      ref(): void {
        return;
      },
      unref(): void {
        return;
      },
      [Symbol.dispose](): void {
        return;
      },
    });
    const spawnImpl = ((_command: string, _args: readonly string[], _options: SpawnOptions) =>
      child) as NonNullable<SpawnDeps["spawnImpl"]>;
    const asyncEntry = {
      scope: "project",
      marketplace: "project-catalog",
      pluginId: "project-plugin",
      resolvedSource: asAbsolutePluginRoot(projectPluginRoot),
      claudeEvent: "PreToolUse",
      matcher: parseMatcher("Bash"),
      rawMatcher: "Bash",
      handlerDecl: { type: "command", command: "router-child", asyncRewake: true },
      declarationIndex: 0,
      ifPredicate: MATCH_ALL_IF,
    } satisfies RoutingEntry;
    const toolCall = {
      type: "tool_call",
      toolCallId: "router-reload-call",
      toolName: "bash",
      input: { command: "printf reload" },
    } satisfies ToolCallEvent;
    await spawnAndRegister(asyncEntry, toolCall, context, pi, projectLocations, {
      spawnImpl,
      dispatchId: () => "router-reload-child",
    });
    const processPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    if (processPlatform === undefined) {
      throw new Error("process.platform descriptor is unavailable");
    }

    t.after(() => {
      Object.defineProperty(process, "platform", processPlatform);
    });
    Object.defineProperty(process, "platform", { ...processPlatform, value: "linux" });
    const originalReadFile = fs.promises.readFile.bind(fs.promises);
    const readFile = t.mock.method(
      fs.promises,
      "readFile",
      async (
        target: Parameters<typeof originalReadFile>[0],
        options?: Parameters<typeof originalReadFile>[1],
      ) => {
        const targetPath = typeof target === "string" ? target : "";
        if (targetPath === path.join(userLocations.extensionRoot, "state.json")) {
          operationLog.push("hydrate:user-state");
        } else if (targetPath === userHooksPath) {
          operationLog.push("hydrate:user-hooks");
        } else if (targetPath === path.join(projectLocations.extensionRoot, "state.json")) {
          operationLog.push("hydrate:project-state");
        } else if (targetPath === projectHooksPath) {
          operationLog.push("hydrate:project-hooks");
        } else if (targetPath === "/proc/43107/environ") {
          operationLog.push("orphan:marker");
          return "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=router-reload-child\0";
        }

        return originalReadFile(target, options);
      },
    );
    t.after(() => {
      readFile.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    t.mock.method(process, "kill", (pid: number, signal?: number | NodeJS.Signals): true => {
      assert.strictEqual(pid, 43_107);
      if (signal === 0) {
        assert.deepStrictEqual(
          getRoutingBucket("SessionStart").map((entry) => ({
            scope: entry.scope,
            pluginId: entry.pluginId,
            command: entry.handlerDecl.command,
          })),
          [{ scope: "user", pluginId: "user-plugin", command: "echo handler-0" }],
        );
        assert.deepStrictEqual(
          getRoutingBucket("PreToolUse").map((entry) => ({
            scope: entry.scope,
            pluginId: entry.pluginId,
            command: entry.handlerDecl.command,
          })),
          [{ scope: "project", pluginId: "project-plugin", command: "echo handler-0" }],
        );
        operationLog.push("routes:rebuilt");
        operationLog.push("orphan:probe");
        return true;
      }

      assert.strictEqual(signal, "SIGKILL");
      operationLog.push("orphan:kill");
      return true;
    });
    traceReload = true;

    // act
    await registerHooksBridge(pi, { ctx: context, cwd: projectRoot, executor });
    await Promise.all(settleResetPromises);
    if (typeof staleToolCallHandler === "function") {
      await Reflect.apply(staleToolCallHandler, undefined, [toolCall, context]);
    }

    const cacheAfterReload = Array.from(parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
    }));
    const epochAfterReload = currentEpoch();
    const pendingAfterReload = [...pendingSessionStartContextEntries()];
    const orphanTableExistsAfterReload = fs.existsSync(pidTablePath(projectLocations));
    shutdownInMemoryChildren();
    resetSettleState();
    resetRoutingState();
    const stateAfterCleanup = {
      epoch: currentEpoch(),
      cache: Array.from(parsedConfigEntries()),
      routes: Array.from(routingTableEntries()),
      pending: [...pendingSessionStartContextEntries()],
    };

    // assert
    assert.deepStrictEqual(operationLog, [
      "epoch:bumped",
      "pending:reset",
      "settle:reset",
      "child:shutdown",
      "hydrate:user-state",
      "hydrate:user-hooks",
      "hydrate:project-state",
      "hydrate:project-hooks",
      "routes:rebuilt",
      "orphan:probe",
      "orphan:marker",
      "orphan:kill",
      "register:session_start",
      "register:session_shutdown",
      "register:session_before_compact",
      "register:session_compact",
      "register:input",
      "register:tool_call",
      "register:tool_result",
      "register:before_agent_start",
      "register:agent_end",
      "register:agent_settled",
      "register:input",
    ]);
    assert.deepStrictEqual(
      registrations.map(({ event, handler }) => ({ event, handlerType: typeof handler })),
      [
        { event: "session_start", handlerType: "function" },
        { event: "session_shutdown", handlerType: "function" },
        { event: "session_before_compact", handlerType: "function" },
        { event: "session_compact", handlerType: "function" },
        { event: "input", handlerType: "function" },
        { event: "tool_call", handlerType: "function" },
        { event: "tool_result", handlerType: "function" },
        { event: "before_agent_start", handlerType: "function" },
        { event: "agent_end", handlerType: "function" },
        { event: "agent_settled", handlerType: "function" },
        { event: "input", handlerType: "function" },
      ],
    );
    assert.deepStrictEqual(cacheAfterReload, [
      {
        scope: "user",
        marketplace: "user-catalog",
        pluginId: "user-plugin",
        resolvedSource: userPluginRoot,
      },
      {
        scope: "project",
        marketplace: "project-catalog",
        pluginId: "project-plugin",
        resolvedSource: projectPluginRoot,
      },
    ]);
    assert.strictEqual(epochAfterReload, previousEpoch + 1);
    assert.deepStrictEqual(pendingAfterReload, []);
    assert.strictEqual(childKilled, true);
    assert.strictEqual(orphanTableExistsAfterReload, false);
    assert.deepStrictEqual(settleResetCalls, []);
    assert.deepStrictEqual(dispatched, []);
    assert.deepStrictEqual(sentMessages, []);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(stateAfterCleanup, { epoch: 0, cache: [], routes: [], pending: [] });
  },
);

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

  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  ); // overwrite, not duplicate
  assert.equal(parsedConfigEntries().size, 1);

  removePluginConfigFromCache("user", "mp", "p1");
  assert.equal(parsedConfigEntries().size, 0);

  // Removing a missing entry is a no-op.
  assert.doesNotThrow(() => {
    removePluginConfigFromCache("user", "mp", "p1");
  });
  assert.equal(parsedConfigEntries().size, 0);
});

test("cache: key includes marketplace -- same (scope, pluginId) under different marketplaces do NOT collide", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  addPluginConfigToCache(
    "user",
    "mp-alpha",
    "shared-id",
    asAbsolutePluginRoot("/test/user/mp-alpha/shared-id"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "user",
    "mp-beta",
    "shared-id",
    asAbsolutePluginRoot("/test/user/mp-beta/shared-id"),
    config,
    new Map(),
  );

  assert.equal(parsedConfigEntries().size, 2);
});

test("rebuildRoutingTables: produces 8 Claude-event buckets", () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  );

  rebuildRoutingTables();

  const table = routingTableEntries();
  assert.equal(table.size, BUCKET_A_EVENTS.length);
  for (const event of BUCKET_A_EVENTS) {
    assert.ok(table.has(event), `expected bucket for ${event}`);
  }
});

test("rebuildRoutingTables: cross-plugin order matches compareByNameThenScope (alphabetical + project tie-break)", () => {
  // compareByNameThenScope sorts primarily by name alphabetical; the
  // project-before-user tie-breaker only fires on same-name pairs. The
  // three plugin ids here have distinct names so the expected order is
  // strictly alphabetical: alpha, beta, gamma -- regardless of insertion
  // scope, because rebuild walks the full cross-scope cache.
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  addPluginConfigToCache(
    "user",
    "mp",
    "alpha",
    asAbsolutePluginRoot("/test/user/mp/alpha"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp",
    "beta",
    asAbsolutePluginRoot("/test/project/mp/beta"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp",
    "gamma",
    asAbsolutePluginRoot("/test/project/mp/gamma"),
    config,
    new Map(),
  );

  rebuildRoutingTables();

  const bucket = routingTableEntries().get("PreToolUse") ?? [];
  assert.deepEqual(
    bucket.map((e) => e.pluginId),
    ["alpha", "beta", "gamma"],
    "rebuild walks the full cross-scope cache and sorts alphabetically",
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
  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  );

  rebuildRoutingTables();

  const bucket = routingTableEntries().get("PreToolUse") ?? [];
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

test("rebuildRoutingTables: empty-cache rebuild clears stale entries", () => {
  // After uninstall / disable, the orchestrator calls
  // removePluginConfigFromCache + rebuildRoutingTables in lockstep so the
  // routing table sheds the now-unstaged entries. This test pins that
  // contract: a rebuild against an empty cache MUST produce empty
  // buckets across all eight Claude events.
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  );

  rebuildRoutingTables();
  assert.equal((routingTableEntries().get("PreToolUse") ?? []).length, 1);

  // Drop the cache entry (mirroring removePluginConfigFromCache in the
  // uninstall / disable per-plugin lock body); rebuild must clear the
  // PreToolUse bucket because the cache is now the source of truth.
  removePluginConfigFromCache("user", "mp", "p1");
  rebuildRoutingTables();

  const table = routingTableEntries();
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
  addPluginConfigToCache(
    "user",
    "mp",
    "learning-output-style",
    asAbsolutePluginRoot("/test/user/mp/learning-output-style"),
    config,
    new Map(),
  );

  rebuildRoutingTables();
  assert.equal(
    (routingTableEntries().get("SessionStart") ?? []).length,
    1,
    "user-scope rebuild should populate SessionStart with 1 entry",
  );

  rebuildRoutingTables();
  assert.equal(
    (routingTableEntries().get("SessionStart") ?? []).length,
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
  addPluginConfigToCache(
    "user",
    "mp",
    "alpha",
    asAbsolutePluginRoot("/test/user/mp/alpha"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp",
    "beta",
    asAbsolutePluginRoot("/test/project/mp/beta"),
    config,
    new Map(),
  );

  // Rebuild walks the full cross-scope cache; both entries must surface.
  rebuildRoutingTables();

  const bucket = routingTableEntries().get("PreToolUse") ?? [];
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
  assert.doesNotThrow(() => {
    rebuildRoutingTables();
  });

  for (const event of BUCKET_A_EVENTS) {
    assert.deepEqual(routingTableEntries().get(event), [], `expected empty bucket for ${event}`);
  }
});

test("rebuildRoutingTables: zero disk I/O on the hot path", (t) => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);
  addPluginConfigToCache(
    "user",
    "mp",
    "p1",
    asAbsolutePluginRoot("/test/user/mp/p1"),
    config,
    new Map(),
  );

  // Wrap fs.promises.readFile to throw if invoked during rebuild. If the
  // rebuild path secretly reads from disk, the throw trips the
  // assertion below. DISP-02.
  const sentinel = t.mock.method(fs.promises, "readFile", () => {
    throw new Error("disk I/O is forbidden during rebuild");
  });

  assert.doesNotThrow(() => {
    rebuildRoutingTables();
  });

  sentinel.mock.restore();
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
    resolvedSource: asAbsolutePluginRoot("/test/plugin-root"),
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: parseMatcher(rawMatcher),
    rawMatcher,
    handlerDecl: { type: "command", command: input.command ?? `echo ${input.pluginId}` },
    declarationIndex: input.declarationIndex ?? 0,
    ifPredicate: MATCH_ALL_IF,
  };
}

const stubCtx = {} as unknown as ExtensionContext;

test("compositeHandlerFor: fires dispatchHookExec for each bucket entry sequentially", async () => {
  const calls: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    calls.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
    makeEntry({ pluginId: "p3", declarationIndex: 2 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, injectedExecutor);
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(calls, ["p1", "p2", "p3"]);
});

test("compositeHandlerFor: skips entries whose matcher does not fire", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PreToolUse", [
    makeEntry({ pluginId: "p-edit-a", rawMatcher: "Edit" }),
    makeEntry({ pluginId: "p-edit-b", rawMatcher: "Edit" }),
    makeEntry({ pluginId: "p-bash", rawMatcher: "Bash" }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, injectedExecutor);
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "edit", input: {} as never },
    stubCtx,
  );

  assert.deepEqual(fired, ["p-edit-a", "p-edit-b"]);
});

test("compositeHandlerFor: SessionStart filter against event.reason", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("SessionStart", [
    makeEntry({ pluginId: "p-any", rawMatcher: "" }),
    makeEntry({ pluginId: "p-startup", rawMatcher: "startup" }),
    makeEntry({ pluginId: "p-resume", rawMatcher: "resume" }),
  ]);

  const handler = compositeHandlerFor("SessionStart", currentEpoch(), undefined, injectedExecutor);
  await handler({ type: "session_start", reason: "startup" }, stubCtx);

  assert.deepEqual(fired, ["p-any", "p-startup"]);
});

test("compositeHandlerFor: UserPromptSubmit fires unconditionally on every event", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("UserPromptSubmit", [
    makeEntry({ pluginId: "p-a", rawMatcher: "" }),
    makeEntry({ pluginId: "p-b", rawMatcher: "" }),
  ]);

  const handler = compositeHandlerFor(
    "UserPromptSubmit",
    currentEpoch(),
    undefined,
    injectedExecutor,
  );
  await handler({ type: "input", text: "hello", source: "interactive" }, stubCtx);

  assert.deepEqual(fired, ["p-a", "p-b"]);
});

test("compositeHandlerFor: epoch mismatch causes no-op without invoking dispatchHookExec", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PreToolUse", [makeEntry({ pluginId: "p1" })]);

  // Capture an epoch value, then bump the live cell so the handler's
  // captured value is stale.
  const stale = currentEpoch();
  bumpEpoch();
  assert.notEqual(stale, currentEpoch());

  const handler = compositeHandlerFor("PreToolUse", stale, undefined, injectedExecutor);
  await handler(
    { type: "tool_call", toolCallId: "x", toolName: "bash", input: { command: "ls" } },
    stubCtx,
  );

  assert.deepEqual(fired, []);
});

test("toolResultCompositeHandler: event.isError true routes to PostToolUseFailure bucket", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  setRoutingBucket("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch(), undefined, injectedExecutor);
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

test("toolResultCompositeHandler: event.isError false routes to PostToolUse bucket", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PostToolUseFailure", [makeEntry({ pluginId: "p-failure" })]);
  setRoutingBucket("PostToolUse", [makeEntry({ pluginId: "p-success" })]);

  const handler = toolResultCompositeHandler(currentEpoch(), undefined, injectedExecutor);
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

test("toolResultCompositeHandler: epoch mismatch causes no-op", async () => {
  const fired: string[] = [];
  const injectedExecutor: HookExecutor = (entry) => {
    fired.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" as const });
  };

  setRoutingBucket("PostToolUse", [makeEntry({ pluginId: "p1" })]);
  setRoutingBucket("PostToolUseFailure", [makeEntry({ pluginId: "p2" })]);

  const stale = currentEpoch();
  bumpEpoch();

  const handler = toolResultCompositeHandler(stale, undefined, injectedExecutor);
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

test("dispatch is sequential awaited (NOT Promise.all)", async () => {
  // Prove serial dispatch by recording start AND end positions of each
  // call. If entries were dispatched via Promise.all, both calls would
  // start before either ended; with sequential await, the second start
  // must follow the first end.
  const events: string[] = [];
  const injectedExecutor: HookExecutor = async (entry) => {
    events.push(`start:${entry.pluginId}`);
    await new Promise((r) => setTimeout(r, 10));
    events.push(`end:${entry.pluginId}`);
    return { kind: "noop" as const };
  };

  setRoutingBucket("PreToolUse", [
    makeEntry({ pluginId: "p1", declarationIndex: 0 }),
    makeEntry({ pluginId: "p2", declarationIndex: 1 }),
  ]);

  const handler = compositeHandlerFor("PreToolUse", currentEpoch(), undefined, injectedExecutor);
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
  addPluginConfigToCache(
    "project",
    "mp-phantom",
    "phantom-plugin",
    asAbsolutePluginRoot("/test/project/mp-phantom/phantom-plugin"),
    config,
    new Map(),
  );
  assert.equal(parsedConfigEntries().size, 1);

  // Invoke the re-hydrate against a temp cwd whose `.pi/agent/state.json`
  // does not exist. `loadState` returns DEFAULT_STATE on ENOENT, so the
  // hydrate is effectively a no-op past the clear-cache prefix.
  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  // The phantom is gone; no project-scope entries remain.
  assert.equal(parsedConfigEntries().size, 0);
});

test("WR-01: hydrateProjectScopeForCwd leaves user-scope cache entries untouched", async () => {
  const config = makeConfig([{ event: "PreToolUse", handlers: 1 }]);

  // Pre-seed BOTH a user-scope entry (legitimate, factory-time hydrate under
  // homedir() was correct for user scope) AND a project-scope entry
  // (phantom from factory-time hydrate under the wrong cwd).
  addPluginConfigToCache(
    "user",
    "mp-u",
    "user-plugin",
    asAbsolutePluginRoot("/test/user/mp-u/user-plugin"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp-p",
    "project-plugin",
    asAbsolutePluginRoot("/test/project/mp-p/project-plugin"),
    config,
    new Map(),
  );
  assert.equal(parsedConfigEntries().size, 2);

  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  // Only the user-scope entry survives.
  const cache = parsedConfigEntries();
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
  addPluginConfigToCache(
    "project",
    "mp-alpha",
    "p1",
    asAbsolutePluginRoot("/test/project/mp-alpha/p1"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp-beta",
    "p2",
    asAbsolutePluginRoot("/test/project/mp-beta/p2"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "mp-gamma",
    "p3",
    asAbsolutePluginRoot("/test/project/mp-gamma/p3"),
    config,
    new Map(),
  );
  addPluginConfigToCache(
    "user",
    "mp-u",
    "u1",
    asAbsolutePluginRoot("/test/user/mp-u/u1"),
    config,
    new Map(),
  );
  assert.equal(parsedConfigEntries().size, 4);

  await hydrateProjectScopeForCwd("/nonexistent/cwd-for-wr-01-test");

  const cache = parsedConfigEntries();
  assert.equal(cache.size, 1);
  const survivor = [...cache.values()][0];
  assert.equal(survivor?.scope, "user");
});

// ───────────────────────────────────────────────────────────────────────────
// ENBL-14 / D-100-05: a disabled plugin's hooks must not re-register on the
// next hydrate. The protection used to be incidental -- disable deleted
// hooks.json, so the read failed and only logged. ENBL-18 keeps
// `resources.hooks` populated on a disabled record, so these two tests write a
// REAL hooks.json under the scope's hooks dir: file-presence cannot mask the
// guard, and the enabled control proves the fixture is not simply broken.
// ───────────────────────────────────────────────────────────────────────────

/** Run `fn` against a hermetic project-scope cwd, then remove it. */
async function withProjectCwd(fn: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(path.join(tmpdir(), "hooks-hydrate-enbl14-"));
  try {
    await fn(cwd);
  } finally {
    // Retry rmdir: a recursive rm can race a lingering async write and hit
    // ENOTEMPTY; retry until it settles.
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/**
 * Seed a project-scope `state.json` naming one hooks-bearing plugin, plus the
 * materialized `<hooksDir>/<slug>/hooks.json` the record points at. `enabled`
 * is the ONLY axis that differs between the two cases below.
 */
async function seedProjectHooksPlugin(cwd: string, enabled: boolean): Promise<void> {
  const loc = locationsFor("project", cwd);
  const pluginRoot = path.join(cwd, "mp", "plugins", "hooky");

  await mkdir(path.join(loc.hooksDir, "hooky"), { recursive: true });
  await writeFile(
    path.join(loc.hooksDir, "hooky", "hooks.json"),
    JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1 }])),
    "utf8",
  );

  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: { kind: "path", raw: "./mp", logical: path.join(cwd, "mp") },
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "mp", ".claude-plugin", "marketplace.json"),
        marketplaceRoot: path.join(cwd, "mp"),
        plugins: {
          hooky: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["hooky"] },
            enabled,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await mkdir(loc.extensionRoot, { recursive: true });
  await saveState(loc.extensionRoot, state);
}

test("ENBL-14 / D-100-05: a disabled record's hooks are NOT hydrated, even though its hooks.json is on disk", async () => {
  await withProjectCwd(async (cwd) => {
    await seedProjectHooksPlugin(cwd, false);

    await hydrateProjectScopeForCwd(cwd);

    assert.equal(
      parsedConfigEntries().size,
      0,
      "ENBL-14: hydrate must skip a record isRecordedButDisabled reports disabled",
    );
  });
});

test("ENBL-14 control: the SAME fixture with enabled: true hydrates exactly one cache entry", async () => {
  await withProjectCwd(async (cwd) => {
    await seedProjectHooksPlugin(cwd, true);

    await hydrateProjectScopeForCwd(cwd);

    const cache = parsedConfigEntries();
    assert.equal(cache.size, 1, "the fixture DOES hydrate when the record is enabled");
    const entry = [...cache.values()][0];
    assert.equal(entry?.scope, "project");
    assert.equal(entry?.pluginId, "hooky");
  });
});
