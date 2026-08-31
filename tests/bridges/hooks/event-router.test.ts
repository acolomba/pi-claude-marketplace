import assert from "node:assert/strict";
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test, beforeEach, type TestContext } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  pidTablePath,
  readPidTable,
  unlinkPidTable,
  writePidTable,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import { adaptObservationResultForEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts";
import {
  addPluginConfigToCache,
  beforeAgentStartHandlerFor,
  hydrateProjectScopeForCwd,
  readAndCachePluginHooks,
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
import { type BucketAEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
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
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
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
      scope: "user",
      marketplace: "user-catalog",
      pluginId: "user-plugin",
      resolvedSource: asAbsolutePluginRoot(userPluginRoot),
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
    await spawnAndRegister(asyncEntry, toolCall, context, pi, userLocations, {
      spawnImpl,
      dispatchId: () => "router-in-memory-child",
    });
    await unlinkPidTable(userLocations);
    const persistedOrphan = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      env: {
        ...process.env,
        PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: "router-persisted-orphan",
      },
      stdio: "ignore",
    });
    const persistedOrphanPid = persistedOrphan.pid;
    if (persistedOrphanPid === undefined) {
      throw new Error("persisted orphan child has no pid");
    }

    const persistedOrphanExit = new Promise<{
      readonly code: number | null;
      readonly signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      persistedOrphan.once("exit", (code, signal) => {
        resolve({ code, signal });
      });
      persistedOrphan.once("error", reject);
    });
    t.after(() => {
      if (persistedOrphan.exitCode === null && persistedOrphan.signalCode === null) {
        persistedOrphan.kill("SIGKILL");
      }
    });
    await writePidTable(projectLocations, [
      {
        pid: persistedOrphanPid,
        dispatchId: "router-persisted-orphan",
        scope: "project",
        marketplace: "project-catalog",
        plugin: "project-plugin",
        spawnedAt: "2026-08-31T10:00:00.000Z",
      },
    ]);
    if (!fs.existsSync(pidTablePath(projectLocations))) {
      throw new Error("persisted orphan table was not seeded");
    }

    const persistedOrphanBytes = await fs.promises.readFile(pidTablePath(projectLocations), "utf8");
    if (!persistedOrphanBytes.includes("router-persisted-orphan")) {
      throw new Error(`persisted orphan row was not written: ${persistedOrphanBytes}`);
    }

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
        } else if (targetPath === pidTablePath(projectLocations)) {
          if (traceReload) {
            operationLog.push("orphan:table");
          }

          return persistedOrphanBytes;
        } else if (targetPath === `/proc/${persistedOrphanPid.toString()}/environ`) {
          operationLog.push("orphan:marker");
        }

        return originalReadFile(target, options);
      },
    );
    t.after(() => {
      readFile.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const seededOrphans = await readPidTable(projectLocations);
    if (seededOrphans.length !== 1 || seededOrphans[0]?.dispatchId !== "router-persisted-orphan") {
      throw new Error("persisted orphan row could not be read before reload");
    }

    traceReload = true;

    // act
    await registerHooksBridge(pi, { ctx: context, cwd: projectRoot, executor });
    const persistedOrphanOutcome = await persistedOrphanExit;
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
    const routesAfterReload = {
      preToolUse: getRoutingBucket("PreToolUse").map((entry) => ({
        scope: entry.scope,
        pluginId: entry.pluginId,
        command: entry.handlerDecl.command,
      })),
      sessionStart: getRoutingBucket("SessionStart").map((entry) => ({
        scope: entry.scope,
        pluginId: entry.pluginId,
        command: entry.handlerDecl.command,
      })),
    };
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
      "orphan:table",
      "orphan:marker",
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
    assert.deepStrictEqual(persistedOrphanOutcome, { code: null, signal: "SIGKILL" });
    assert.deepStrictEqual(routesAfterReload, {
      preToolUse: [{ scope: "project", pluginId: "project-plugin", command: "PreToolUse-0" }],
      sessionStart: [{ scope: "user", pluginId: "user-plugin", command: "SessionStart-0" }],
    });
    assert.deepStrictEqual(
      getRoutingBucket("SessionStart").map((entry) => ({
        scope: entry.scope,
        pluginId: entry.pluginId,
        command: entry.handlerDecl.command,
      })),
      [],
    );
    assert.deepStrictEqual(settleResetCalls, []);
    assert.deepStrictEqual(dispatched, []);
    assert.deepStrictEqual(sentMessages, []);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(stateAfterCleanup, { epoch: 0, cache: [], routes: [], pending: [] });
  },
);

type StoredPlugin = ExtensionState["marketplaces"][string]["plugins"][string];

interface RecordedRegistration {
  readonly event: string;
  readonly handler: unknown;
}

function makeConfig(
  arms: Array<{ event: string; matcher?: string; handlers: number; prefix?: string }>,
): HooksConfig {
  const config: HooksConfig = {};
  for (const arm of arms) {
    const groups = config[arm.event] ?? [];
    const hooks = Array.from({ length: arm.handlers }, (_unused, index) => ({
      type: "command",
      command: `${arm.prefix ?? arm.event}-${index.toString()}`,
    }));
    groups.push({ ...(arm.matcher === undefined ? {} : { matcher: arm.matcher }), hooks });
    config[arm.event] = groups;
  }

  return config;
}

function makeStoredPlugin(input: {
  readonly root: string;
  readonly hooks: readonly string[];
  readonly enabled?: boolean;
}): StoredPlugin {
  return {
    version: "1.0.0",
    resolvedSource: input.root,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: [],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [...input.hooks],
    },
    enabled: input.enabled ?? true,
    installedAt: "2026-08-31T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
  };
}

function makeScopeState(input: {
  readonly scope: "user" | "project";
  readonly cwd: string;
  readonly marketplace?: string;
  readonly plugins: Record<string, StoredPlugin>;
}): ExtensionState {
  const marketplace = input.marketplace ?? "catalog";
  const marketplaceRoot = path.join(input.cwd, `${marketplace}-source`);
  return {
    schemaVersion: 2,
    marketplaces: {
      [marketplace]: {
        name: marketplace,
        scope: input.scope,
        source: { kind: "path", raw: marketplaceRoot, logical: marketplaceRoot },
        addedFromCwd: input.cwd,
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        plugins: input.plugins,
      },
    },
  };
}

function makeContext(cwd: string, sessionRoot: string): ExtensionContext {
  return {
    ui: {
      notify(message: string, severity?: "info" | "warning" | "error"): void {
        void message;
        void severity;
      },
    } as ExtensionContext["ui"],
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager: SessionManager.inMemory(sessionRoot, { id: `router-${path.basename(cwd)}` }),
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("event router must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort(): never {
      throw new Error("event router must not abort Pi");
    },
    hasPendingMessages: () => false,
    shutdown(): never {
      throw new Error("event router must not shut down Pi");
    },
    getContextUsage: () => undefined,
    compact(): never {
      throw new Error("event router must not compact the session");
    },
    getSystemPrompt(): never {
      throw new Error("event router must not read the system prompt");
    },
  };
}

function makeRecordingPi(): {
  readonly pi: ExtensionAPI;
  readonly registrations: RecordedRegistration[];
  readonly messages: Array<{ readonly message: unknown; readonly options: unknown }>;
} {
  const registrations: RecordedRegistration[] = [];
  const messages: Array<{ readonly message: unknown; readonly options: unknown }> = [];
  const pi = {
    on(event: string, handler: unknown): void {
      registrations.push({ event, handler });
    },
    sendMessage(message: unknown, options: unknown): void {
      messages.push({ message, options });
    },
  } as ExtensionAPI;
  return { pi, registrations, messages };
}

function registeredHandler(
  registrations: readonly RecordedRegistration[],
  event: string,
  occurrence = 0,
): (...args: unknown[]) => unknown {
  const handler = registrations.filter((registration) => registration.event === event)[occurrence]
    ?.handler;
  if (typeof handler !== "function") {
    throw new Error(`missing ${event} registration ${occurrence.toString()}`);
  }

  return handler as (...args: unknown[]) => unknown;
}

function ownRoutingState(t: TestContext): void {
  resetRoutingState();
  t.after(() => {
    shutdownInMemoryChildren();
    resetSettleState();
    resetRoutingState();
  });
}

function ownAgentRoot(t: TestContext, agentRoot: string): void {
  const previousAgentRoot = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentRoot;
  t.after(() => {
    if (previousAgentRoot === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentRoot;
    }
  });
}

test("cache keys separate scope, marketplace, and plugin while mutations stay idempotent", (t) => {
  // arrange
  ownRoutingState(t);
  const firstConfig = makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "first" }]);
  const replacementConfig = makeConfig([
    { event: "PreToolUse", handlers: 1, prefix: "replacement" },
  ]);

  // act
  addPluginConfigToCache(
    "user",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/user/alpha/shared"),
    firstConfig,
    new Map(),
  );
  addPluginConfigToCache(
    "user",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/user/alpha/shared"),
    replacementConfig,
    new Map(),
  );
  addPluginConfigToCache(
    "user",
    "beta",
    "shared",
    asAbsolutePluginRoot("/router/user/beta/shared"),
    firstConfig,
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/project/alpha/shared"),
    firstConfig,
    new Map(),
  );
  removePluginConfigFromCache("user", "beta", "shared");
  removePluginConfigFromCache("user", "beta", "shared");
  const cache = Array.from(parsedConfigEntries().values()).map((entry) => ({
    scope: entry.scope,
    marketplace: entry.marketplace,
    pluginId: entry.pluginId,
    config: entry.config,
  }));

  // assert
  assert.deepStrictEqual(cache, [
    { scope: "user", marketplace: "alpha", pluginId: "shared", config: replacementConfig },
    { scope: "project", marketplace: "alpha", pluginId: "shared", config: firstConfig },
  ]);
});

test("readAndCachePluginHooks reads and parses one case-owned config", async (t) => {
  // arrange
  ownRoutingState(t);
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-read-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ type: "command", command: "echo read", if: "true" }] }],
    }),
    "utf8",
  );

  // act
  await readAndCachePluginHooks({
    scope: "project",
    marketplace: "catalog",
    plugin: "reader",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath,
    cwd: root,
    logPrefix: "install",
  });
  const cache = Array.from(parsedConfigEntries().values()).map((entry) => ({
    scope: entry.scope,
    marketplace: entry.marketplace,
    pluginId: entry.pluginId,
    resolvedSource: entry.resolvedSource,
    commands: entry.config.PreToolUse?.[0]?.hooks.map((handler) => handler.command),
    predicateKeys: [...entry.ifPredicates.keys()],
  }));

  // assert
  assert.deepStrictEqual(cache, [
    {
      scope: "project",
      marketplace: "catalog",
      pluginId: "reader",
      resolvedSource: path.join(root, "plugin"),
      commands: ["echo read"],
      predicateKeys: ["PreToolUse|0|0"],
    },
  ]);
});

test("readAndCachePluginHooks leaves the cache unchanged after a read failure", async (t) => {
  // arrange
  ownRoutingState(t);
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-read-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  // act
  await readAndCachePluginHooks({
    scope: "project",
    marketplace: "catalog",
    plugin: "missing",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath: path.join(root, "missing-hooks.json"),
    cwd: root,
    logPrefix: "reinstall",
  });

  // assert
  assert.deepStrictEqual(Array.from(parsedConfigEntries()), []);
});

test("readAndCachePluginHooks leaves the cache unchanged after a parse failure", async (t) => {
  // arrange
  ownRoutingState(t);
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-read-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(hooksJsonPath, "{", "utf8");

  // act
  await readAndCachePluginHooks({
    scope: "project",
    marketplace: "catalog",
    plugin: "invalid",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath,
    cwd: root,
    logPrefix: "update",
  });

  // assert
  assert.deepStrictEqual(Array.from(parsedConfigEntries()), []);
});

test("beforeAgentStartHandlerFor drains ordered context once and leaves an empty turn unchanged", async (t) => {
  // arrange
  ownRoutingState(t);
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "alpha context" },
    "SessionStart",
    { scope: "project", marketplace: "catalog", pluginId: "alpha" },
  );
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "beta context" },
    "SessionStart",
    { scope: "user", marketplace: "catalog", pluginId: "beta" },
  );
  const handler = beforeAgentStartHandlerFor(currentEpoch());
  const event = {
    type: "before_agent_start",
    prompt: "prompt",
    systemPrompt: "base prompt",
    systemPromptOptions: {},
  } as BeforeAgentStartEvent;

  // act
  const firstTurn = await handler(event, makeContext("/router/context", "/router/session"));
  const secondTurn = await handler(event, makeContext("/router/context", "/router/session"));

  // assert
  assert.deepStrictEqual(firstTurn, {
    systemPrompt: "base prompt\n\nalpha context\n\nbeta context",
  });
  assert.strictEqual(secondTurn, undefined);
  assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
});

test("beforeAgentStartHandlerFor rejects a stale epoch without draining live context", async (t) => {
  // arrange
  ownRoutingState(t);
  const staleEpoch = currentEpoch();
  bumpEpoch();
  adaptObservationResultForEvent(
    { kind: "mutate", additionalContext: "live context" },
    "SessionStart",
    { scope: "project", marketplace: "catalog", pluginId: "live" },
  );
  const handler = beforeAgentStartHandlerFor(staleEpoch);
  const event = {
    type: "before_agent_start",
    prompt: "prompt",
    systemPrompt: "base prompt",
    systemPromptOptions: {},
  } as BeforeAgentStartEvent;

  // act
  const promptUpdate = await handler(event, makeContext("/router/context", "/router/session"));

  // assert
  assert.strictEqual(promptUpdate, undefined);
  assert.deepStrictEqual(pendingSessionStartContextEntries(), [
    {
      context: "live context",
      scope: "project",
      marketplace: "catalog",
      pluginId: "live",
    },
  ]);
});

test("rebuildRoutingTables preserves stable plugin and declaration order in all ten buckets", (t) => {
  // arrange
  ownRoutingState(t);
  const eventInventory = [
    "PostCompact",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "PreToolUse",
    "SessionEnd",
    "SessionStart",
    "Stop",
    "StopFailure",
    "UserPromptSubmit",
  ] satisfies readonly BucketAEvent[];
  const configFor = (label: string): HooksConfig =>
    Object.fromEntries(
      eventInventory.map((event) => [
        event,
        [
          {
            matcher: "",
            hooks: [
              { type: "command", command: `${label}-${event}-first` },
              { type: "command", command: `${label}-${event}-second` },
            ],
          },
        ],
      ]),
    );
  addPluginConfigToCache(
    "user",
    "catalog",
    "shared",
    asAbsolutePluginRoot("/router/user/shared"),
    configFor("user-shared"),
    new Map([["PreToolUse|0|0", MATCH_ALL_IF]]),
  );
  addPluginConfigToCache(
    "user",
    "catalog",
    "zulu",
    asAbsolutePluginRoot("/router/user/zulu"),
    configFor("user-zulu"),
    new Map(),
  );
  addPluginConfigToCache(
    "project",
    "catalog",
    "shared",
    asAbsolutePluginRoot("/router/project/shared"),
    configFor("project-shared"),
    new Map(),
  );

  // act
  rebuildRoutingTables();
  const table = Array.from(routingTableEntries(), ([event, entries]) => ({
    event,
    entries: entries.map((entry) => ({
      scope: entry.scope,
      pluginId: entry.pluginId,
      command: entry.handlerDecl.command,
      declarationIndex: entry.declarationIndex,
      ifPredicate: entry.ifPredicate,
    })),
  })).sort((left, right) => left.event.localeCompare(right.event));

  // assert
  assert.deepStrictEqual(
    table.map(({ event }) => event),
    eventInventory,
  );
  for (const { event, entries } of table) {
    const eventOffset = eventInventory.indexOf(event) * 2;
    assert.deepStrictEqual(entries, [
      {
        scope: "project",
        pluginId: "shared",
        command: `project-shared-${event}-first`,
        declarationIndex: eventOffset,
        ifPredicate: MATCH_ALL_IF,
      },
      {
        scope: "project",
        pluginId: "shared",
        command: `project-shared-${event}-second`,
        declarationIndex: eventOffset + 1,
        ifPredicate: MATCH_ALL_IF,
      },
      {
        scope: "user",
        pluginId: "shared",
        command: `user-shared-${event}-first`,
        declarationIndex: eventOffset,
        ifPredicate: MATCH_ALL_IF,
      },
      {
        scope: "user",
        pluginId: "shared",
        command: `user-shared-${event}-second`,
        declarationIndex: eventOffset + 1,
        ifPredicate: MATCH_ALL_IF,
      },
      {
        scope: "user",
        pluginId: "zulu",
        command: `user-zulu-${event}-first`,
        declarationIndex: eventOffset,
        ifPredicate: MATCH_ALL_IF,
      },
      {
        scope: "user",
        pluginId: "zulu",
        command: `user-zulu-${event}-second`,
        declarationIndex: eventOffset + 1,
        ifPredicate: MATCH_ALL_IF,
      },
    ]);
  }
});

test("rebuildRoutingTables tolerates valid record keys and sparse arrays defensively", (t) => {
  // arrange
  ownRoutingState(t);
  const sparseHooks: Array<{ type: string; command: string }> = [];
  sparseHooks.length = 2;
  sparseHooks[1] = { type: "command", command: "kept-handler" };
  const sparseGroups: Array<{ hooks: Array<{ type: string; command: string }> }> = [];
  sparseGroups.length = 2;
  sparseGroups[1] = { hooks: sparseHooks };
  const config: HooksConfig = {
    FutureEvent: [{ hooks: [{ type: "command", command: "future-handler" }] }],
    PreToolUse: sparseGroups,
  };
  addPluginConfigToCache(
    "project",
    "catalog",
    "defensive",
    asAbsolutePluginRoot("/router/project/defensive"),
    config,
    new Map(),
  );

  // act
  rebuildRoutingTables();
  const table = Array.from(routingTableEntries(), ([event, entries]) => ({
    event,
    commands: entries.map((entry) => entry.handlerDecl.command),
  })).sort((left, right) => left.event.localeCompare(right.event));

  // assert
  assert.deepStrictEqual(table, [
    { event: "PostCompact", commands: [] },
    { event: "PostToolUse", commands: [] },
    { event: "PostToolUseFailure", commands: [] },
    { event: "PreCompact", commands: [] },
    { event: "PreToolUse", commands: ["kept-handler"] },
    { event: "SessionEnd", commands: [] },
    { event: "SessionStart", commands: [] },
    { event: "Stop", commands: [] },
    { event: "StopFailure", commands: [] },
    { event: "UserPromptSubmit", commands: [] },
  ]);
});

test(
  "hydrateProjectScopeForCwd separates scope and skips disabled, empty, unsafe, unreadable, and invalid plugins",
  { concurrency: false },
  async (t) => {
    // arrange
    ownRoutingState(t);
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-hydrate-matrix-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const locations = locationsFor("project", root);
    const projectState = makeScopeState({
      scope: "project",
      cwd: root,
      plugins: {
        disabled: makeStoredPlugin({
          root: path.join(root, "plugins", "disabled"),
          hooks: ["disabled-hooks"],
          enabled: false,
        }),
        empty: makeStoredPlugin({
          root: path.join(root, "plugins", "empty"),
          hooks: [],
        }),
        traversal: makeStoredPlugin({
          root: path.join(root, "plugins", "traversal"),
          hooks: ["../../../outside"],
        }),
        "invalid-root": makeStoredPlugin({ root: "relative/plugin", hooks: ["invalid-root"] }),
        unreadable: makeStoredPlugin({
          root: path.join(root, "plugins", "unreadable"),
          hooks: ["missing-hooks"],
        }),
        invalid: makeStoredPlugin({
          root: path.join(root, "plugins", "invalid"),
          hooks: ["invalid-hooks"],
        }),
        valid: makeStoredPlugin({
          root: path.join(root, "plugins", "valid"),
          hooks: ["valid-hooks-a", "valid-hooks-b"],
        }),
      },
    });
    const foreignState = makeScopeState({
      scope: "user",
      cwd: root,
      marketplace: "foreign",
      plugins: {
        foreign: makeStoredPlugin({
          root: path.join(root, "plugins", "foreign"),
          hooks: ["foreign-hooks"],
        }),
      },
    });
    const state = {
      schemaVersion: 2,
      marketplaces: { ...projectState.marketplaces, ...foreignState.marketplaces },
    } satisfies ExtensionState;
    for (const slug of [
      "disabled-hooks",
      "foreign-hooks",
      "invalid-hooks",
      "valid-hooks-a",
      "valid-hooks-b",
    ]) {
      await mkdir(path.join(locations.hooksDir, slug), { recursive: true });
    }

    await writeFile(
      path.join(locations.hooksDir, "disabled-hooks", "hooks.json"),
      JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "disabled" }])),
      "utf8",
    );
    await writeFile(
      path.join(locations.hooksDir, "foreign-hooks", "hooks.json"),
      JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "foreign" }])),
      "utf8",
    );
    await writeFile(path.join(locations.hooksDir, "invalid-hooks", "hooks.json"), "{", "utf8");
    await writeFile(
      path.join(locations.hooksDir, "valid-hooks-a", "hooks.json"),
      JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "first" }])),
      "utf8",
    );
    await writeFile(
      path.join(locations.hooksDir, "valid-hooks-b", "hooks.json"),
      JSON.stringify(
        makeConfig([
          { event: "PreToolUse", handlers: 1, prefix: "second" },
          { event: "SessionStart", handlers: 1, prefix: "session" },
        ]),
      ),
      "utf8",
    );
    await saveState(locations.extensionRoot, state);

    // act
    await hydrateProjectScopeForCwd(root);
    rebuildRoutingTables();
    const cache = Array.from(parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
      config: entry.config,
    }));
    const routes = Array.from(routingTableEntries(), ([event, entries]) => ({
      event,
      plugins: entries.map((entry) => entry.pluginId),
      commands: entries.map((entry) => entry.handlerDecl.command),
    })).sort((left, right) => left.event.localeCompare(right.event));

    // assert
    assert.deepStrictEqual(cache, [
      {
        scope: "project",
        marketplace: "catalog",
        pluginId: "valid",
        resolvedSource: path.join(root, "plugins", "valid"),
        config: makeConfig([
          { event: "PreToolUse", handlers: 1, prefix: "second" },
          { event: "SessionStart", handlers: 1, prefix: "session" },
        ]),
      },
    ]);
    assert.deepStrictEqual(
      routes.filter(({ plugins }) => plugins.length > 0),
      [
        { event: "PreToolUse", plugins: ["valid"], commands: ["second-0"] },
        { event: "SessionStart", plugins: ["valid"], commands: ["session-0"] },
      ],
    );
  },
);

test(
  "hydrateProjectScopeForCwd replaces every project prefix and preserves user cache on load failure",
  { concurrency: false },
  async (t) => {
    // arrange
    ownRoutingState(t);
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-project-replace-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const locations = locationsFor("project", root);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(path.join(locations.extensionRoot, "state.json"), "{", "utf8");
    const config = makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "cached" }]);
    addPluginConfigToCache(
      "project",
      "alpha",
      "first",
      asAbsolutePluginRoot(path.join(root, "old", "first")),
      config,
      new Map(),
    );
    addPluginConfigToCache(
      "project",
      "beta",
      "second",
      asAbsolutePluginRoot(path.join(root, "old", "second")),
      config,
      new Map(),
    );
    addPluginConfigToCache(
      "user",
      "alpha",
      "first",
      asAbsolutePluginRoot(path.join(root, "user", "first")),
      config,
      new Map(),
    );

    // act
    await hydrateProjectScopeForCwd(root);
    const cache = Array.from(parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
    }));

    // assert
    assert.deepStrictEqual(cache, [
      {
        scope: "user",
        marketplace: "alpha",
        pluginId: "first",
        resolvedSource: path.join(root, "user", "first"),
      },
    ]);
  },
);

test(
  "registerHooksBridge degrades corrupt scope state and leaves unused shared directories absent",
  { concurrency: false },
  async (t) => {
    // arrange
    ownRoutingState(t);
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-corrupt-state-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const projectRoot = path.join(root, "project");
    const agentRoot = path.join(root, "agent");
    ownAgentRoot(t, agentRoot);
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await writeFile(path.join(userLocations.extensionRoot, "state.json"), "{", "utf8");
    await writeFile(path.join(projectLocations.extensionRoot, "state.json"), "{", "utf8");
    const { pi, registrations, messages } = makeRecordingPi();
    const context = makeContext(projectRoot, root);

    // act
    await registerHooksBridge(pi, { ctx: context, cwd: projectRoot });
    const sharedState = {
      user: fs.existsSync(path.join(userLocations.dataRoot, "_shared")),
      project: fs.existsSync(path.join(projectLocations.dataRoot, "_shared")),
    };

    // assert
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
    assert.deepStrictEqual(Array.from(parsedConfigEntries()), []);
    assert.deepStrictEqual(sharedState, { user: false, project: false });
    assert.deepStrictEqual(messages, []);
  },
);

test(
  "registerHooksBridge creates a missing shared directory and contains a sibling scope failure",
  { concurrency: false },
  async (t) => {
    // arrange
    ownRoutingState(t);
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-shared-dir-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const projectRoot = path.join(root, "project");
    const agentRoot = path.join(root, "agent");
    ownAgentRoot(t, agentRoot);
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    await mkdir(userLocations.dataRoot, { recursive: true });
    const userSharedPath = path.join(userLocations.dataRoot, "_shared");
    const projectSharedPath = path.join(projectLocations.dataRoot, "_shared");
    await writeFile(userSharedPath, "regular-file-boundary", "utf8");
    addPluginConfigToCache(
      "user",
      "catalog",
      "session",
      asAbsolutePluginRoot(path.join(root, "plugins", "session")),
      makeConfig([{ event: "SessionStart", handlers: 1, prefix: "session" }]),
      new Map(),
    );
    const { pi, registrations } = makeRecordingPi();
    const context = makeContext(projectRoot, root);

    // act
    await registerHooksBridge(pi, { ctx: context, cwd: projectRoot });
    const userSharedBytes = await fs.promises.readFile(userSharedPath, "utf8");
    const projectSharedStat = await fs.promises.stat(projectSharedPath);

    // assert
    assert.strictEqual(userSharedBytes, "regular-file-boundary");
    assert.strictEqual(projectSharedStat.isDirectory(), true);
    assert.strictEqual(registrations.length, 11);
  },
);

test(
  "session_start lazily hydrates project routes and drains their context on the next agent turn",
  { concurrency: false },
  async (t) => {
    // arrange
    ownRoutingState(t);
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-lazy-project-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const factoryRoot = path.join(root, "factory-cwd");
    const projectRoot = path.join(root, "actual-project");
    const agentRoot = path.join(root, "agent");
    ownAgentRoot(t, agentRoot);
    const projectLocations = locationsFor("project", projectRoot);
    const projectState = makeScopeState({
      scope: "project",
      cwd: projectRoot,
      plugins: {
        beta: makeStoredPlugin({
          root: path.join(root, "plugins", "beta"),
          hooks: ["beta-hooks"],
        }),
        alpha: makeStoredPlugin({
          root: path.join(root, "plugins", "alpha"),
          hooks: ["alpha-hooks"],
        }),
      },
    });
    for (const pluginId of ["alpha", "beta"]) {
      const hooksDirectory = path.join(projectLocations.hooksDir, `${pluginId}-hooks`);
      await mkdir(hooksDirectory, { recursive: true });
      await writeFile(
        path.join(hooksDirectory, "hooks.json"),
        JSON.stringify(makeConfig([{ event: "SessionStart", handlers: 1, prefix: pluginId }])),
        "utf8",
      );
    }

    await saveState(projectLocations.extensionRoot, projectState);
    const context = makeContext(projectRoot, root);
    const { pi, registrations, messages } = makeRecordingPi();
    const dispatches: Array<{ readonly pluginId: string; readonly event: string }> = [];
    const executor: HookExecutor = (entry) => {
      dispatches.push({ pluginId: entry.pluginId, event: entry.claudeEvent });
      return Promise.resolve({
        kind: "mutate",
        additionalContext: `${entry.pluginId} context`,
      });
    };

    await registerHooksBridge(pi, { ctx: context, cwd: factoryRoot, executor });
    const sessionStart = registeredHandler(registrations, "session_start");
    const beforeAgentStart = registeredHandler(registrations, "before_agent_start");
    const beforeAgentEvent = {
      type: "before_agent_start",
      prompt: "prompt",
      systemPrompt: "base prompt",
      systemPromptOptions: {},
    } as BeforeAgentStartEvent;

    // act
    const sessionStartUpdate = await sessionStart(
      { type: "session_start", reason: "startup" },
      context,
    );
    const firstTurn = await beforeAgentStart(beforeAgentEvent, context);
    const secondTurn = await beforeAgentStart(beforeAgentEvent, context);
    const routes = getRoutingBucket("SessionStart").map((entry) => ({
      scope: entry.scope,
      pluginId: entry.pluginId,
      command: entry.handlerDecl.command,
    }));
    const cache = Array.from(parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
    }));
    const projectSharedStat = await fs.promises.stat(
      path.join(projectLocations.dataRoot, "_shared"),
    );

    // assert
    assert.strictEqual(sessionStartUpdate, undefined);
    assert.deepStrictEqual(dispatches, [
      { pluginId: "alpha", event: "SessionStart" },
      { pluginId: "beta", event: "SessionStart" },
    ]);
    assert.deepStrictEqual(firstTurn, {
      systemPrompt: "base prompt\n\nbeta context",
    });
    assert.strictEqual(secondTurn, undefined);
    assert.deepStrictEqual(routes, [
      { scope: "project", pluginId: "alpha", command: "alpha-0" },
      { scope: "project", pluginId: "beta", command: "beta-0" },
    ]);
    assert.deepStrictEqual(cache, [
      { scope: "project", marketplace: "catalog", pluginId: "beta" },
      { scope: "project", marketplace: "catalog", pluginId: "alpha" },
    ]);
    assert.strictEqual(projectSharedStat.isDirectory(), true);
    assert.deepStrictEqual(pendingSessionStartContextEntries(), []);
    assert.deepStrictEqual(messages, []);
  },
);

test("session_start contains a lazy project cwd failure and still delegates safely", async (t) => {
  // arrange
  ownRoutingState(t);
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-lazy-failure-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const projectRoot = path.join(root, "project");
  ownAgentRoot(t, path.join(root, "agent"));
  const context = makeContext(projectRoot, root);
  const { pi, registrations, messages } = makeRecordingPi();
  const dispatches: string[] = [];
  const executor: HookExecutor = (entry) => {
    dispatches.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  await registerHooksBridge(pi, { ctx: context, cwd: projectRoot, executor });
  const sessionStart = registeredHandler(registrations, "session_start");
  Object.defineProperty(context, "cwd", {
    configurable: true,
    get(): string {
      throw new Error("project cwd unavailable");
    },
  });

  // act
  const sessionStartUpdate = await sessionStart(
    { type: "session_start", reason: "resume" },
    context,
  );

  // assert
  assert.strictEqual(sessionStartUpdate, undefined);
  assert.deepStrictEqual(dispatches, []);
  assert.deepStrictEqual(messages, []);
  assert.strictEqual(registrations.length, 11);
});
