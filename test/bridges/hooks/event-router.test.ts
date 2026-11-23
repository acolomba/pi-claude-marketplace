import assert from "node:assert/strict";
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test, type TestContext } from "node:test";

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
import {
  createHooksHydration,
  createHooksRouting,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import { saveHookOutput } from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-output-files.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { readHooksJson } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createRoutingStateOperations,
  type RoutingEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import {
  BUCKET_A_EVENTS,
  type BucketAEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { parseMatcher } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { adapterCommand } from "../../platform/pi-inventory-seed.ts";

import type { SpawnDeps } from "../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { HookExecutor } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts";
import type {
  HooksHydrationDeps,
  TypedExpansionResolver,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { McpServerNamesReader } from "../../../extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts";
import type {
  HooksRuntime,
  HooksRuntimeChildEntry,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { HooksConfig } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  AgentEndEvent,
  AssistantMessage,
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionCompactEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { SessionHeader, SlashCommandInfo, ToolInfo } from "@earendil-works/pi-coding-agent";

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

interface RuntimeChildHarness {
  readonly child: ChildProcess;
  readonly signals: Array<number | NodeJS.Signals>;
  destroy(): void;
}

function createRuntimeChild(pid: number): RuntimeChildHarness {
  const events = new EventEmitter();
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const signals: Array<number | NodeJS.Signals> = [];
  const child = Object.assign(events, {
    stdin,
    stdout,
    stderr,
    stdio: [stdin, stdout, stderr, undefined, undefined] as ChildProcess["stdio"],
    connected: false,
    pid,
    exitCode: null,
    signalCode: null,
    killed: false,
    spawnargs: [],
    spawnfile: "",
    kill(signal?: NodeJS.Signals | number): boolean {
      signals.push(signal ?? "SIGTERM");
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

  return {
    child,
    signals,
    destroy(): void {
      child.removeAllListeners();
      stdin.destroy();
      stdout.destroy();
      stderr.destroy();
    },
  };
}

test(
  "reload resets lifecycle state before hydrating routes, reaping orphans, and registering handlers",
  {
    concurrency: false,
    skip: process.platform === "linux" ? false : "orphan ownership markers use Linux /proc",
  },
  async (t) => {
    // arrange
    const operationLog: string[] = [];
    let traceReload = false;
    let routingWrites = 0;
    const runtimeState = createHooksRuntime();
    const runtime = new Proxy(runtimeState, {
      get(target, property, receiver): unknown {
        if (property === "setRoutingBucket") {
          return (...args: Parameters<typeof target.setRoutingBucket>): void => {
            if (traceReload) {
              if (routingWrites % BUCKET_A_EVENTS.length === 0) {
                operationLog.push("routing:rebuild");
              }

              routingWrites += 1;
            }

            target.setRoutingBucket(...args);
          };
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const peerRuntime = createHooksRuntime();
    const peerChild = createRuntimeChild(43_108);
    // Registered before the environment so the children are gone before its
    // removal runs: after-hooks run in registration order.
    t.after(() => {
      shutdownInMemoryChildren(runtime);
      shutdownInMemoryChildren(peerRuntime);
      peerChild.destroy();
    });
    const { root } = await createHermeticEnvironment(t, "hooks-router-reload-");
    const projectRoot = path.join(root, "project");
    await shutdownInMemoryChildren(runtime);
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    const hydration = createHooksHydration(runtime, {
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        if (traceReload) {
          const scope = extensionRoot === userLocations.extensionRoot ? "user" : "project";
          operationLog.push(`hydrate:${scope}-state`);
        }

        return loadState(extensionRoot);
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    });
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
                workflows: [],
              },
              enabled: true,
              provenance: "explicit",
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
                workflows: [],
              },
              enabled: true,
              provenance: "explicit",
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

    await hydration.registerHooksBridge(pi, { cwd: projectRoot, executor });
    const previousEpoch = runtime.currentGeneration();
    const staleBeforeAgentStartHandler = registeredHandler(registrations, "before_agent_start");
    const staleToolCallHandler = registrations.find(({ event }) => event === "tool_call")?.handler;
    const staleAgentEndHandler = registrations.find(({ event }) => event === "agent_end")?.handler;
    const staleAgentSettledHandler = registrations.find(
      ({ event }) => event === "agent_settled",
    )?.handler;
    registrations.length = 0;
    runtime.appendPendingPromptContext({
      context: "stale context",
      scope: "user",
      marketplace: "user-catalog",
      pluginId: "user-plugin",
      event: "UserPromptSubmit",
    });
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
    if (typeof staleAgentEndHandler === "function") {
      await Reflect.apply(staleAgentEndHandler, undefined, [previousEnding, context]);
    }

    const settleResetCalls: string[] = [];
    const settleResetPromises: Promise<void>[] = [];

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
        assert.strictEqual(runtime.currentGeneration(), previousEpoch + 1);
        operationLog.push("epoch:bumped");
        assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
        operationLog.push("pending:reset");
        const settleResult =
          typeof staleAgentSettledHandler === "function"
            ? (Reflect.apply(staleAgentSettledHandler, undefined, [
                { type: "agent_settled" },
                context,
              ]) as Promise<void> | undefined)
            : undefined;
        const settleReset = Promise.resolve(settleResult);
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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;
    const toolCall = {
      type: "tool_call",
      toolCallId: "router-reload-call",
      toolName: "bash",
      input: { command: "printf reload" },
    } satisfies ToolCallEvent;
    await spawnAndRegister(
      peerRuntime,
      { ...asyncEntry, pluginId: "peer-plugin" },
      toolCall,
      context,
      pi,
      userLocations,
      {
        spawnImpl: (() => peerChild.child) as NonNullable<SpawnDeps["spawnImpl"]>,
        dispatchId: () => "router-peer-child",
        pidTableWriter: () => Promise.resolve(),
      },
    );
    await spawnAndRegister(runtime, asyncEntry, toolCall, context, pi, userLocations, {
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

    const seededOrphans = await readPidTable(projectLocations);
    if (seededOrphans.length !== 1 || seededOrphans[0]?.dispatchId !== "router-persisted-orphan") {
      throw new Error("persisted orphan row could not be read before reload");
    }

    for (let index = 0; index < 4; index += 1) {
      runtime.recordStopReentry();
    }

    traceReload = true;

    // act
    await hydration.registerHooksBridge(pi, { cwd: projectRoot, executor });
    const persistedOrphanOutcome = await persistedOrphanExit;
    await Promise.all(settleResetPromises);
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "reload" },
      { mode: "unknown" },
    );
    const allowedAfterReload = Array.from({ length: 8 }, () => runtime.recordStopReentry());
    if (typeof staleToolCallHandler === "function") {
      await Reflect.apply(staleToolCallHandler, undefined, [toolCall, context]);
    }

    const capAfterStaleTool = runtime.recordStopReentry();

    const staleBeforeAgentResult = await staleBeforeAgentStartHandler(
      {
        type: "before_agent_start",
        prompt: "",
        systemPrompt: "stale",
        systemPromptOptions: {},
      },
      context,
    );
    assert.strictEqual(staleBeforeAgentResult, undefined);
    const cacheAfterReload = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
    }));
    const epochAfterReload = runtime.currentGeneration();
    const pendingAfterReload = [...runtime.pendingPromptContextEntries()];
    const orphanTableExistsAfterReload = fs.existsSync(pidTablePath(projectLocations));
    const sharedDirectoriesAfterReload = {
      user: fs.existsSync(path.join(userLocations.dataRoot, "_shared")),
      project: fs.existsSync(path.join(projectLocations.dataRoot, "_shared")),
    };
    const routesAfterReload = {
      preToolUse: runtime.getRoutingBucket("PreToolUse").map((entry) => ({
        scope: entry.scope,
        pluginId: entry.pluginId,
        command: entry.handlerDecl.command,
      })),
      sessionStart: runtime.getRoutingBucket("SessionStart").map((entry) => ({
        scope: entry.scope,
        pluginId: entry.pluginId,
        command: entry.handlerDecl.command,
      })),
    };
    const peerEntriesAfterReload = peerRuntime.pidTableEntries(userLocations);
    const peerSignalsAfterReload = [...peerChild.signals];
    shutdownInMemoryChildren(runtime);

    // assert
    assert.deepStrictEqual(peerEntriesAfterReload, [
      {
        pid: 43_108,
        dispatchId: "router-peer-child",
        scope: "user",
        marketplace: "user-catalog",
        plugin: "peer-plugin",
        spawnedAt: peerEntriesAfterReload[0]?.spawnedAt,
      },
    ]);
    assert.deepStrictEqual(peerSignalsAfterReload, []);
    assert.deepStrictEqual(sentMessages, []);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(operationLog, [
      "epoch:bumped",
      "pending:reset",
      "settle:reset",
      "child:shutdown",
      "hydrate:user-state",
      "hydrate:project-state",
      "routing:rebuild",
      "routing:rebuild",
      "register:session_start",
      "register:session_shutdown",
      "register:session_before_compact",
      "register:session_compact",
      "register:input",
      "register:input",
      "register:tool_call",
      "register:tool_result",
      "register:before_agent_start",
      "register:turn_start",
      "register:turn_end",
      "register:agent_end",
      "register:agent_before_settle",
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
        { event: "input", handlerType: "function" },
        { event: "tool_call", handlerType: "function" },
        { event: "tool_result", handlerType: "function" },
        { event: "before_agent_start", handlerType: "function" },
        { event: "turn_start", handlerType: "function" },
        { event: "turn_end", handlerType: "function" },
        { event: "agent_end", handlerType: "function" },
        { event: "agent_before_settle", handlerType: "function" },
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
    assert.deepStrictEqual(
      allowedAfterReload,
      Array.from({ length: 8 }, () => ({ reenter: true, notifyCap: false })),
    );
    assert.deepStrictEqual(capAfterStaleTool, { reenter: false, notifyCap: true });
    assert.deepStrictEqual(pendingAfterReload, []);
    assert.strictEqual(childKilled, true);
    assert.strictEqual(orphanTableExistsAfterReload, false);
    assert.deepStrictEqual(sharedDirectoriesAfterReload, { user: true, project: true });
    assert.deepStrictEqual(persistedOrphanOutcome, { code: null, signal: "SIGKILL" });
    assert.deepStrictEqual(routesAfterReload, {
      preToolUse: [{ scope: "project", pluginId: "project-plugin", command: "PreToolUse-0" }],
      sessionStart: [{ scope: "user", pluginId: "user-plugin", command: "SessionStart-0" }],
    });
    assert.deepStrictEqual(settleResetCalls, []);
    assert.deepStrictEqual(dispatched, []);
    assert.deepStrictEqual(sentMessages, []);
    assert.deepStrictEqual(notifications, []);
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
      workflows: [],
    },
    enabled: input.enabled ?? true,
    provenance: "explicit",
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

interface ProjectHookFixture {
  readonly root: string;
  readonly factoryRoot: string;
  readonly projectRoot: string;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly hookPath: string;
  readonly hookBytes: string;
  readonly state: ExtensionState;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (resolvePromise === undefined) {
        throw new Error("the deferred operation was not initialized");
      }

      resolvePromise(value);
    },
  };
}

async function makeProjectHookFixture(
  t: TestContext,
  label: string,
  event: "PreToolUse" | "SessionStart",
): Promise<ProjectHookFixture> {
  const { root } = await createHermeticEnvironment(t, `hooks-router-${label}-`);
  const factoryRoot = path.join(root, "factory");
  const projectRoot = path.join(root, "project");
  const locations = locationsFor("project", projectRoot);
  const hookPath = path.join(locations.hooksDir, "owner-hooks", "hooks.json");
  const hookBytes = JSON.stringify(makeConfig([{ event, handlers: 1 }]));
  await mkdir(path.dirname(hookPath), { recursive: true });
  await writeFile(hookPath, hookBytes, "utf8");
  return {
    root,
    factoryRoot,
    projectRoot,
    locations,
    hookPath,
    hookBytes,
    state: makeScopeState({
      scope: "project",
      cwd: projectRoot,
      plugins: {
        owner: makeStoredPlugin({
          root: path.join(root, "plugins", "owner"),
          hooks: ["owner-hooks"],
        }),
      },
    }),
  };
}

function makeContext(
  cwd: string,
  sessionRoot: string,
  projectTrusted = true,
  notices: string[] = [],
  pendingMessages = false,
): ExtensionContext {
  return {
    ui: {
      notify(message: string, severity?: "info" | "warning" | "error"): void {
        notices.push(message);
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
    isProjectTrusted: () => projectTrusted,
    signal: undefined,
    abort(): never {
      throw new Error("event router must not abort Pi");
    },
    hasPendingMessages: () => pendingMessages,
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

async function makeSessionStartFixture(t: TestContext): Promise<{
  readonly root: string;
  readonly projectRoot: string;
  readonly sharedPaths: readonly string[];
}> {
  const { root } = await createHermeticEnvironment(t, "hooks-router-session-mode-");
  const projectRoot = path.join(root, "project");
  const sharedPaths: string[] = [];
  for (const scope of ["user", "project"] as const) {
    const loc = locationsFor(scope, projectRoot);
    const hooksDirectory = path.join(loc.hooksDir, "session-hooks");
    await mkdir(hooksDirectory, { recursive: true });
    await writeFile(
      path.join(hooksDirectory, "hooks.json"),
      JSON.stringify(makeConfig([{ event: "SessionStart", handlers: 1 }])),
    );
    await saveState(
      loc.extensionRoot,
      makeScopeState({
        scope,
        cwd: projectRoot,
        plugins: {
          session: makeStoredPlugin({ root: path.join(root, scope), hooks: ["session-hooks"] }),
        },
      }),
    );
    sharedPaths.push(path.join(loc.dataRoot, "_shared"));
  }

  return { root, projectRoot, sharedPaths };
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

function assistantForBookkeeping(): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: "answer" }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "pending",
    timestamp: 1,
  };
}

/**
 * D-PG6-07: names a record's stored MCP servers, as the production reader
 * does for a record whose plugin root is contained.
 */
function readStoredServerNames(
  ...[, marketplace, plugin]: Parameters<McpServerNamesReader>
): Promise<readonly string[]> {
  const stored = marketplace.plugins[plugin]?.mcpServerConfigs ?? [];
  return Promise.resolve(stored.map(({ name }) => name));
}

/** An empty-state reader, so registration hydrates without touching disk state. */
const EMPTY_STATE_READER: HooksHydrationDeps = {
  loadState(): Promise<ExtensionState> {
    return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
  },
  readHooksJson,
  readMcpServerNames: readStoredServerNames,
};

for (const mode of ["tui", "print", "json", "rpc"]) {
  for (const { failure, rejectMode } of [
    { failure: "unknown mode", rejectMode: (): string => "unknown" },
    {
      failure: "throwing mode getter",
      rejectMode: (): string => {
        throw new Error("stale mode");
      },
    },
  ]) {
    test(`preserves pending context when before_agent_start changes from ${mode} to ${failure}`, async (t) => {
      // arrange
      const { root } = await createHermeticEnvironment(t, "hooks-pending-mode-");
      const runtime = createHooksRuntime();
      const { pi, registrations } = makeRecordingPi();
      let readMode = (): string => mode;
      const context = new Proxy(makeContext(root, root), {
        get(target, property, receiver): unknown {
          if (property === "mode") {
            return readMode();
          }

          return Reflect.get(target, property, receiver);
        },
      });
      await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
        cwd: root,
      });
      const pending = {
        context: "pending",
        scope: "user",
        marketplace: "catalog",
        pluginId: "alpha",
        event: "UserPromptSubmit",
      } as const;
      const handler = registeredHandler(registrations, "before_agent_start");
      const event = {
        type: "before_agent_start",
        systemPrompt: "base",
        prompt: "hello",
        systemPromptOptions: {},
      };
      runtime.appendPendingPromptContext(pending);

      // act
      const supportedOutput = await handler(event, context);
      const supportedPending = runtime.pendingPromptContextEntries();
      runtime.appendPendingPromptContext(pending);
      readMode = rejectMode;
      const rejectedOutput = await handler(event, context);

      // assert
      assert.deepStrictEqual(supportedOutput, {
        message: {
          customType: "claude-hook-additional-context",
          content: [{ type: "text", text: "UserPromptSubmit hook additional context: pending" }],
          display: false,
        },
      });
      assert.deepStrictEqual(supportedPending, []);
      assert.strictEqual(rejectedOutput, undefined);
      assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [pending]);
    });

    test(`preserves assistant cache when agent_end changes from ${mode} to ${failure}`, async (t) => {
      // arrange
      const { root } = await createHermeticEnvironment(t, "hooks-assistant-mode-");
      const runtime = createHooksRuntime();
      const { pi, registrations } = makeRecordingPi();
      let readMode = (): string => mode;
      const context = new Proxy(makeContext(root, root), {
        get(target, property, receiver): unknown {
          if (property === "mode") {
            return readMode();
          }

          return Reflect.get(target, property, receiver);
        },
      });
      await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
        cwd: root,
      });
      const handler = registeredHandler(registrations, "agent_end");
      const assistant = assistantForBookkeeping();

      // act
      const supportedOutput = await handler({ type: "agent_end", messages: [assistant] }, context);
      readMode = rejectMode;
      const rejectedOutput = await handler({ type: "agent_end", messages: [] }, context);

      // assert
      assert.deepStrictEqual([supportedOutput, rejectedOutput], [undefined, undefined]);
      assert.strictEqual(runtime.takeLastAssistant(), assistant);
    });

    test(`preserves assistant cache when agent_settled changes from ${mode} to ${failure}`, async (t) => {
      // arrange
      const { root } = await createHermeticEnvironment(t, "hooks-settled-mode-");
      const runtime = createHooksRuntime();
      const { pi, registrations } = makeRecordingPi();
      let readMode = (): string => mode;
      const context = new Proxy(makeContext(root, root), {
        get(target, property, receiver): unknown {
          if (property === "mode") {
            return readMode();
          }

          return Reflect.get(target, property, receiver);
        },
      });
      await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
        cwd: root,
      });
      const handler = registeredHandler(registrations, "agent_settled");
      const assistant = assistantForBookkeeping();
      runtime.recordLastAssistant(assistant);

      // act
      const supportedOutput = await handler({ type: "agent_settled" }, context);
      const supportedCache = runtime.takeLastAssistant();
      runtime.recordLastAssistant(assistant);
      readMode = rejectMode;
      const rejectedOutput = await handler({ type: "agent_settled" }, context);

      // assert
      assert.deepStrictEqual([supportedOutput, rejectedOutput], [undefined, undefined]);
      assert.strictEqual(supportedCache, undefined);
      assert.strictEqual(runtime.takeLastAssistant(), assistant);
    });

    for (const reentries of [7, 8]) {
      test(`preserves ${reentries}-entry Stop cap when input changes from ${mode} to ${failure}`, async (t) => {
        // arrange
        const { root } = await createHermeticEnvironment(t, "hooks-input-mode-");
        const runtime = createHooksRuntime();
        const { pi, registrations } = makeRecordingPi();
        let readMode = (): string => mode;
        const context = new Proxy(makeContext(root, root), {
          get(target, property, receiver): unknown {
            if (property === "mode") {
              return readMode();
            }

            return Reflect.get(target, property, receiver);
          },
        });
        await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
          cwd: root,
        });
        const handler = registeredHandler(registrations, "input", 2);
        const event = { type: "input", text: "hello", source: "interactive" };
        runtime.recordStopReentry();

        // act
        const supportedOutput = await handler(event, context);
        const supportedActive = runtime.isStopHookActive();
        for (let index = 0; index < reentries; index += 1) {
          runtime.recordStopReentry();
        }

        readMode = rejectMode;
        const rejectedOutput = await handler(event, context);

        // assert
        assert.deepStrictEqual([supportedOutput, rejectedOutput], [undefined, undefined]);
        assert.strictEqual(supportedActive, false);
        assert.strictEqual(runtime.isStopHookActive(), true);
        assert.deepStrictEqual(runtime.recordStopReentry(), {
          reenter: reentries === 7,
          notifyCap: reentries === 8,
        });
      });
    }
  }
}

function seedPluginConfig(
  runtime: HooksRuntime,
  scope: "project" | "user",
  marketplace: string,
  pluginId: string,
  resolvedSource: ReturnType<typeof asAbsolutePluginRoot>,
  config: HooksConfig,
  ifPredicates: ReadonlyMap<string, RoutingEntry["ifPredicate"]>,
  options: RoutingEntry["options"] = resolveOptions(undefined),
): void {
  const routingState = createRoutingStateOperations(runtime);
  routingState.setParsedConfig(`${scope}\u0000${marketplace}\u0000${pluginId}`, {
    scope,
    marketplace,
    pluginId,
    resolvedSource,
    config,
    ifPredicates,
    options,
  });
}

test("cache keys separate scope, marketplace, and plugin while mutations stay idempotent", () => {
  // arrange
  const runtime = createHooksRuntime();
  const firstConfig = makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "first" }]);
  const replacementConfig = makeConfig([
    { event: "PreToolUse", handlers: 1, prefix: "replacement" },
  ]);

  // act
  seedPluginConfig(
    runtime,
    "user",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/user/alpha/shared"),
    firstConfig,
    new Map(),
  );
  seedPluginConfig(
    runtime,
    "user",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/user/alpha/shared"),
    replacementConfig,
    new Map(),
  );
  seedPluginConfig(
    runtime,
    "user",
    "beta",
    "shared",
    asAbsolutePluginRoot("/router/user/beta/shared"),
    firstConfig,
    new Map(),
  );
  seedPluginConfig(
    runtime,
    "project",
    "alpha",
    "shared",
    asAbsolutePluginRoot("/router/project/alpha/shared"),
    firstConfig,
    new Map(),
  );
  runtime.deleteParsedConfig("user\u0000beta\u0000shared");
  runtime.deleteParsedConfig("user\u0000beta\u0000shared");
  const cache = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
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
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-read-");
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ type: "command", command: "echo read", if: "true" }] }],
    }),
    "utf8",
  );

  // act
  await createHooksRouting(runtime, { readHooksJson }).readAndCachePluginHooks({
    scope: "user",
    marketplace: "catalog",
    plugin: "reader",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath,
    cwd: root,
    logPrefix: "install",
    options: resolveOptions(undefined),
  });
  const cache = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
    scope: entry.scope,
    marketplace: entry.marketplace,
    pluginId: entry.pluginId,
    resolvedSource: entry.resolvedSource,
    commands: entry.config.PreToolUse?.[0]?.hooks.map((handler) => handler.command),
    predicateKeys: [...entry.ifPredicates.keys()],
    options: entry.options,
  }));

  // assert
  assert.deepStrictEqual(cache, [
    {
      scope: "user",
      marketplace: "catalog",
      pluginId: "reader",
      resolvedSource: path.join(root, "plugin"),
      commands: ["echo read"],
      predicateKeys: ["PreToolUse|0|0"],
      options: resolveOptions(undefined),
    },
  ]);
});

test("D-PG10-10 readAndCachePluginHooks gives the entry and each routing entry the options of its input", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-options-");
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ type: "command", command: "echo first" }] }],
      Stop: [{ hooks: [{ type: "command", command: "echo second" }] }],
    }),
    "utf8",
  );
  const options = resolveOptions({
    mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
    note: { type: "string", title: "Note", description: "A note.", required: false },
  });
  const routing = createHooksRouting(runtime, { readHooksJson });

  // act
  await routing.readAndCachePluginHooks({
    scope: "user",
    marketplace: "catalog",
    plugin: "optioned",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath,
    cwd: root,
    logPrefix: "install",
    options,
  });
  routing.rebuildRoutingTables();

  // assert
  assert.deepStrictEqual(
    {
      cached: Array.from(runtime.parsedConfigEntries().values(), (entry) => entry.options),
      routed: Array.from(runtime.routingTableEntries()).flatMap(([, entries]) =>
        entries.map((entry) => entry.options),
      ),
    },
    { cached: [options], routed: [options, options] },
  );
});

test("runtime-bound routing mutations update only their supplied lifecycle owner", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-owner-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo owner" }] }],
    }),
    "utf8",
  );
  const ownerRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const routing = createHooksRouting(ownerRuntime, { readHooksJson });

  // act
  await routing.readAndCachePluginHooks({
    scope: "user",
    marketplace: "catalog",
    plugin: "owned",
    resolvedSource: asAbsolutePluginRoot(root),
    hooksJsonPath,
    cwd: root,
    logPrefix: "owner-test",
    options: resolveOptions(undefined),
  });
  routing.rebuildRoutingTables();

  // assert
  assert.deepStrictEqual(
    ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
    ["owned"],
  );
  assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);

  // act
  routing.removePluginConfigFromCache("user", "catalog", "owned");
  routing.rebuildRoutingTables();

  // assert
  assert.deepStrictEqual(ownerRuntime.getRoutingBucket("PreToolUse"), []);
  assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
});

test("readAndCachePluginHooks leaves the cache unchanged after a read failure", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-read-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  // act
  await createHooksRouting(runtime, { readHooksJson }).readAndCachePluginHooks({
    scope: "user",
    marketplace: "catalog",
    plugin: "missing",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath: path.join(root, "missing-hooks.json"),
    cwd: root,
    logPrefix: "reinstall",
    options: resolveOptions(undefined),
  });

  // assert
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
});

test("readAndCachePluginHooks leaves the cache unchanged after a parse failure", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "hooks-router-read-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hooksJsonPath = path.join(root, "hooks.json");
  await writeFile(hooksJsonPath, "{", "utf8");

  // act
  await createHooksRouting(runtime, { readHooksJson }).readAndCachePluginHooks({
    scope: "user",
    marketplace: "catalog",
    plugin: "invalid",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin")),
    hooksJsonPath,
    cwd: root,
    logPrefix: "update",
    options: resolveOptions(undefined),
  });

  // assert
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
});

// The registered `before_agent_start` handler of a fresh bridge, its runtime,
// and a Pi context to call it with.
async function beforeAgentStartFixture(t: TestContext): Promise<{
  readonly runtime: HooksRuntime;
  readonly handler: (...args: unknown[]) => unknown;
  readonly context: ExtensionContext;
}> {
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-context-");
  const { pi, registrations } = makeRecordingPi();
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, { cwd: root });
  return {
    runtime,
    handler: registeredHandler(registrations, "before_agent_start"),
    context: makeContext(root, root),
  };
}

const PROMPT_TURN = {
  type: "before_agent_start",
  messageType: "user",
  prompt: "hello there",
  systemPrompt: "base prompt",
  systemPromptOptions: {},
} as BeforeAgentStartEvent;

// The bridge's debug line for a child session whose launching session no source names (D-PG6-02).
const CHILD_ROOT_LINE =
  "[hooks] Child hook root session unavailable: neither the companion's launch variable nor the child's session header names its launching session";

const RUNNER_TURN = {
  ...PROMPT_TURN,
  systemPromptOptions: { customPrompt: '<active_agent name="demo:runner"/>\n\nagent body' },
} as BeforeAgentStartEvent;

// Sets the process variable `name` to `value` for the case, or unsets it.
function setVariable(t: TestContext, name: string, value: string | undefined): void {
  const previous = process.env[name];
  t.after(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = previous;
    }
  });
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

function setParentSessionVariable(t: TestContext, value: string | undefined): void {
  setVariable(t, "PI_SUBAGENT_PARENT_SESSION", value);
}

// Marks this process as a pi-subagents child for the case, with `parentSession`
// as its launch variable.
function enterChild(t: TestContext, parentSession: string | undefined): void {
  setVariable(t, "PI_SUBAGENT_CHILD", "1");
  setParentSessionVariable(t, parentSession);
}

// A Pi context of the session `router-child`, whose header names
// `parentSession`, and its session manager.
function childSessionContext(
  root: string,
  parentSession: string | undefined,
): {
  readonly context: ExtensionContext;
  readonly sessionManager: SessionManager;
} {
  const sessionManager = SessionManager.inMemory(root, {
    id: "router-child",
    ...(parentSession === undefined ? {} : { parentSession }),
  });
  return { context: Object.assign(makeContext(root, root), { sessionManager }), sessionManager };
}

// A launching session's file in `root` whose header holds `id`.
async function launchingSessionFile(root: string, id: string): Promise<string> {
  const file = path.join(root, "main.jsonl");
  await writeFile(file, `${JSON.stringify({ type: "session", id, cwd: root })}\n`);
  return file;
}

test(
  "D-PG6-02: a child's first run keeps the launching session the variable and the header name",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const file = await launchingSessionFile(fixtureContext.cwd, "main-session");
    const { context } = childSessionContext(fixtureContext.cwd, file);
    enterChild(t, "main-session");

    // act
    await handler(RUNNER_TURN, context);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("router-child"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "router-child",
      root: { sessionId: "main-session", transcriptPath: file },
    });
  },
);

test(
  "D-PG6-02: a second run of a child session reads no header and no file",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const file = await launchingSessionFile(fixtureContext.cwd, "main-session");
    const { context, sessionManager } = childSessionContext(fixtureContext.cwd, file);
    const getHeaderSpy = t.mock.method(sessionManager, "getHeader");
    enterChild(t, undefined);
    const readDiagnostics = observeRouterDebug(t);
    await handler(RUNNER_TURN, context);
    await rm(file);

    // act
    await handler(RUNNER_TURN, context);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("router-child"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "router-child",
      root: { sessionId: "main-session", transcriptPath: file },
    });
    assert.deepStrictEqual(readDiagnostics(), []);
    assert.strictEqual(getHeaderSpy.mock.callCount(), 1);
  },
);

test(
  "D-PG6-02: a child with no root source writes the root diagnostic once for its session",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const { context } = childSessionContext(fixtureContext.cwd, undefined);
    enterChild(t, undefined);
    const readDiagnostics = observeRouterDebug(t);

    // act
    await handler(RUNNER_TURN, context);
    await handler(RUNNER_TURN, context);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("router-child"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "router-child",
    });
    assert.deepStrictEqual(readDiagnostics(), [CHILD_ROOT_LINE]);
  },
);

test(
  "D-PG6-02: an unavailable child identity resolves no root",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const { context, sessionManager } = childSessionContext(fixtureContext.cwd, undefined);
    const getHeaderSpy = t.mock.method(sessionManager, "getHeader");
    enterChild(t, "main-session");

    // act
    await handler(PROMPT_TURN, context);

    // assert
    assert.deepStrictEqual(runtime.childIdentityFor("router-child"), { kind: "unavailable" });
    assert.strictEqual(runtime.childRootResolved("router-child"), false);
    assert.strictEqual(getHeaderSpy.mock.callCount(), 0);
  },
);

test(
  "D-PG6-02: a failed header read leaves no root and the run still drains its context",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const { context, sessionManager } = childSessionContext(fixtureContext.cwd, undefined);
    t.mock.method(sessionManager, "getHeader", () => {
      throw new Error("header unreadable");
    });
    runtime.appendPendingPromptContext({
      context: "start context",
      scope: "user",
      marketplace: "catalog",
      pluginId: "demo",
      event: "UserPromptSubmit",
    });
    enterChild(t, "main-session");
    const readDiagnostics = observeRouterDebug(t);

    // act
    const message = await handler(RUNNER_TURN, context);

    // assert
    assert.deepStrictEqual(message, {
      message: {
        customType: "claude-hook-additional-context",
        content: [
          { type: "text", text: "UserPromptSubmit hook additional context: start context" },
        ],
        display: false,
      },
    });
    assert.deepStrictEqual(runtime.childIdentityFor("router-child"), {
      kind: "known",
      agentType: "demo:runner",
      childId: "router-child",
    });
    assert.strictEqual(runtime.childRootResolved("router-child"), true);
    assert.deepStrictEqual(readDiagnostics(), [
      "[hooks] before_agent_start root session read failed: header unreadable",
      CHILD_ROOT_LINE,
    ]);
  },
);

test("D-PG6-02: a main session reads no root", { concurrency: false }, async (t) => {
  // arrange
  const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
  const { context, sessionManager } = childSessionContext(fixtureContext.cwd, undefined);
  const getHeaderSpy = t.mock.method(sessionManager, "getHeader");
  setVariable(t, "PI_SUBAGENT_CHILD", undefined);
  setParentSessionVariable(t, "main-session");

  // act
  await handler(RUNNER_TURN, context);

  // assert
  assert.deepStrictEqual(runtime.childIdentityFor("router-child"), { kind: "main" });
  assert.strictEqual(runtime.childRootResolved("router-child"), false);
  assert.strictEqual(getHeaderSpy.mock.callCount(), 0);
});

test(
  "D-PG6-02: a registration that went stale during the root read changes nothing more",
  { concurrency: false },
  async (t) => {
    // arrange
    const { runtime, handler, context: fixtureContext } = await beforeAgentStartFixture(t);
    const { context } = childSessionContext(fixtureContext.cwd, undefined);
    const pending = {
      context: "start context",
      scope: "user",
      marketplace: "catalog",
      pluginId: "demo",
      event: "UserPromptSubmit",
    } as const;
    runtime.appendPendingPromptContext(pending);
    enterChild(t, "main-session");

    // act
    const started = handler(RUNNER_TURN, context);
    runtime.advanceGeneration();
    const message = await started;

    // assert
    assert.strictEqual(message, undefined);
    assert.strictEqual(runtime.childRootResolved("router-child"), false);
    assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [pending]);
  },
);

test(
  "before_agent_start captures the companion prefix while draining pending context",
  { concurrency: false },
  async (t) => {
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const { runtime, handler, context } = await beforeAgentStartFixture(t);
    runtime.appendPendingPromptContext({
      context: "start context",
      scope: "user",
      marketplace: "catalog",
      pluginId: "demo",
      event: "UserPromptSubmit",
    });
    process.env.PI_SUBAGENT_CHILD = "1";
    const event = {
      ...PROMPT_TURN,
      systemPromptOptions: { customPrompt: '<active_agent name="demo:runner"/>\n\nagent body' },
    } as BeforeAgentStartEvent;

    const result = await handler(event, context);

    assert.deepStrictEqual(result, {
      message: {
        customType: "claude-hook-additional-context",
        content: [
          { type: "text", text: "UserPromptSubmit hook additional context: start context" },
        ],
        display: false,
      },
    });
    assert.deepStrictEqual(runtime.childIdentityFor(context.sessionManager.getSessionId()), {
      kind: "known",
      agentType: "demo:runner",
      childId: context.sessionManager.getSessionId(),
    });
  },
);

test(
  "before_agent_start clears invalid child metadata and emits one fixed diagnostic per capture",
  { concurrency: false },
  async (t) => {
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const { runtime, handler, context } = await beforeAgentStartFixture(t);
    const readDiagnostics = observeRouterDebug(t);
    process.env.PI_SUBAGENT_CHILD = "1";
    setParentSessionVariable(t, undefined);
    const valid = {
      ...PROMPT_TURN,
      systemPromptOptions: { appendSystemPrompt: '<active_agent name="demo:runner"/>\n\n' },
    } as BeforeAgentStartEvent;
    const malformed = {
      ...PROMPT_TURN,
      systemPromptOptions: { customPrompt: '<active_agent name="bad"/>\n' },
    } as BeforeAgentStartEvent;

    await handler(valid, context);
    await handler(malformed, context);
    await handler(PROMPT_TURN, context);

    assert.deepStrictEqual(runtime.childIdentityFor(context.sessionManager.getSessionId()), {
      kind: "unavailable",
    });
    assert.deepStrictEqual(readDiagnostics(), [
      CHILD_ROOT_LINE,
      "[hooks] Child hook identity unavailable: companion launch metadata is missing or malformed",
      "[hooks] Child hook identity unavailable: companion launch metadata is missing or malformed",
    ]);
  },
);

test(
  "before_agent_start leaves a new session unavailable until its own callback",
  { concurrency: false },
  async (t) => {
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const { runtime, handler, context } = await beforeAgentStartFixture(t);
    process.env.PI_SUBAGENT_CHILD = "1";
    const secondContext = makeContext(path.join(context.cwd, "next-session"), context.cwd);
    const event = {
      ...PROMPT_TURN,
      systemPromptOptions: { customPrompt: '<active_agent name="demo:first"/>\n\n' },
    } as BeforeAgentStartEvent;

    await handler(event, context);
    const beforeSecondRun = runtime.childIdentityFor(secondContext.sessionManager.getSessionId());
    await handler(
      {
        ...event,
        systemPromptOptions: {
          appendSystemPrompt: '<active_agent name="demo:second"/>\n\n',
        },
      },
      secondContext,
    );

    assert.deepStrictEqual(beforeSecondRun, { kind: "unavailable" });
    assert.deepStrictEqual(runtime.childIdentityFor(context.sessionManager.getSessionId()), {
      kind: "unavailable",
    });
    assert.deepStrictEqual(runtime.childIdentityFor(secondContext.sessionManager.getSessionId()), {
      kind: "known",
      agentType: "demo:second",
      childId: secondContext.sessionManager.getSessionId(),
    });
  },
);

test(
  "reload resets child identity and stale before-run callbacks cannot restore it",
  { concurrency: false },
  async (t) => {
    const { root } = await createHermeticEnvironment(t, "hooks-router-child-identity-reload-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const runtime = createHooksRuntime();
    const { pi, registrations } = makeRecordingPi();
    const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
    const context = makeContext(root, root);
    await hydration.registerHooksBridge(pi, { cwd: root });
    process.env.PI_SUBAGENT_CHILD = "1";
    setParentSessionVariable(t, undefined);
    const staleHandler = registeredHandler(registrations, "before_agent_start");
    const event = {
      ...PROMPT_TURN,
      systemPromptOptions: { customPrompt: '<active_agent name="demo:old"/>\n\n' },
    } as BeforeAgentStartEvent;
    await staleHandler(event, context);
    assert.deepStrictEqual(runtime.childIdentityFor(context.sessionManager.getSessionId()), {
      kind: "known",
      agentType: "demo:old",
      childId: context.sessionManager.getSessionId(),
    });
    await hydration.registerHooksBridge(pi, { cwd: root });
    const readDiagnostics = observeRouterDebug(t);

    await staleHandler(event, context);
    const afterStale = runtime.childIdentityFor(context.sessionManager.getSessionId());
    await registeredHandler(
      registrations,
      "before_agent_start",
      1,
    )(
      {
        ...event,
        systemPromptOptions: { appendSystemPrompt: '<active_agent name="demo:new"/>\n\n' },
      },
      context,
    );

    assert.deepStrictEqual(afterStale, { kind: "unavailable" });
    assert.deepStrictEqual(runtime.childIdentityFor(context.sessionManager.getSessionId()), {
      kind: "known",
      agentType: "demo:new",
      childId: context.sessionManager.getSessionId(),
    });
    assert.deepStrictEqual(readDiagnostics(), [CHILD_ROOT_LINE]);
  },
);

test(
  "two before-run bridges in one child process keep distinct agent types",
  { concurrency: false },
  async (t) => {
    const { root } = await createHermeticEnvironment(t, "hooks-router-child-two-runtimes-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const first = createHooksRuntime();
    const second = createHooksRuntime();
    const firstPi = makeRecordingPi();
    const secondPi = makeRecordingPi();
    await createHooksHydration(first, EMPTY_STATE_READER).registerHooksBridge(firstPi.pi, {
      cwd: root,
    });
    await createHooksHydration(second, EMPTY_STATE_READER).registerHooksBridge(secondPi.pi, {
      cwd: root,
    });
    process.env.PI_SUBAGENT_CHILD = "1";
    const context = makeContext(root, root);
    const firstHandler = registeredHandler(firstPi.registrations, "before_agent_start");
    const secondHandler = registeredHandler(secondPi.registrations, "before_agent_start");

    await firstHandler(
      {
        ...PROMPT_TURN,
        systemPromptOptions: {
          customPrompt: '<active_agent name="demo:first"/>\n\n',
        },
      },
      context,
    );
    await secondHandler(
      {
        ...PROMPT_TURN,
        systemPromptOptions: {
          appendSystemPrompt: '<active_agent name="demo:second"/>\n\n',
        },
      },
      context,
    );
    await firstHandler(
      {
        ...PROMPT_TURN,
        systemPromptOptions: {
          customPrompt: '<active_agent name="demo:first-new"/>\n\n',
        },
      },
      context,
    );

    const sessionId = context.sessionManager.getSessionId();
    assert.deepStrictEqual(first.childIdentityFor(sessionId), {
      kind: "known",
      agentType: "demo:first-new",
      childId: sessionId,
    });
    assert.deepStrictEqual(second.childIdentityFor(sessionId), {
      kind: "known",
      agentType: "demo:second",
      childId: sessionId,
    });
  },
);

test("before_agent_start sends buffered prompt context as one message after the prompt (D-CF5-13)", async (t) => {
  // arrange
  const { runtime, handler, context } = await beforeAgentStartFixture(t);
  runtime.appendPendingPromptContext({
    context: "ctx-a",
    scope: "project",
    marketplace: "catalog",
    pluginId: "alpha",
    event: "UserPromptSubmit",
  });
  runtime.appendPendingPromptContext({
    context: "ctx-b",
    scope: "user",
    marketplace: "catalog",
    pluginId: "beta",
    event: "UserPromptSubmit",
  });

  // act
  const firstTurn = await handler(PROMPT_TURN, context);
  const secondTurn = await handler(PROMPT_TURN, context);

  // assert
  assert.deepStrictEqual(firstTurn, {
    message: {
      customType: "claude-hook-additional-context",
      content: [{ type: "text", text: "UserPromptSubmit hook additional context: ctx-a\nctx-b" }],
      display: false,
    },
  });
  assert.strictEqual(secondTurn, undefined);
  assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
});

test("before_agent_start adds no message for prompt context that is only whitespace (HOOK-05)", async (t) => {
  // arrange
  const { runtime, handler, context } = await beforeAgentStartFixture(t);
  runtime.appendPendingPromptContext({
    context: " \n\t",
    scope: "project",
    marketplace: "catalog",
    pluginId: "alpha",
    event: "UserPromptSubmit",
  });

  // act
  const turn = await handler(PROMPT_TURN, context);

  // assert
  assert.strictEqual(turn, undefined);
  assert.deepStrictEqual(runtime.pendingPromptContextEntries(), []);
});

test("before_agent_start of a reloaded bridge sends no context buffered before the reload (D-CF5-13)", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-context-reload-");
  const { pi, registrations } = makeRecordingPi();
  const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
  await hydration.registerHooksBridge(pi, { cwd: root });
  const entry = {
    context: "stale",
    scope: "project",
    marketplace: "catalog",
    pluginId: "alpha",
    event: "UserPromptSubmit",
  } as const;
  runtime.appendPendingPromptContext(entry);
  await hydration.registerHooksBridge(pi, { cwd: root });
  const liveHandler = registeredHandler(registrations, "before_agent_start", 1);

  // act
  const turn = await liveHandler(PROMPT_TURN, makeContext(root, root));

  // assert
  assert.strictEqual(turn, undefined);
});

test("registered before_agent_start rejects a stale epoch without draining live context", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-before-agent-");
  const { pi, registrations } = makeRecordingPi();
  const context = makeContext(root, root);
  const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
  await hydration.registerHooksBridge(pi, { cwd: root });
  const handler = registeredHandler(registrations, "before_agent_start");
  await hydration.registerHooksBridge(pi, { cwd: root });
  runtime.appendPendingPromptContext({
    context: "live context",
    scope: "project",
    marketplace: "catalog",
    pluginId: "live",
    event: "UserPromptSubmit",
  });
  const event = {
    type: "before_agent_start",
    prompt: "prompt",
    systemPrompt: "base prompt",
    systemPromptOptions: {},
  } as BeforeAgentStartEvent;

  // act
  const promptUpdate = await handler(event, context);

  // assert
  assert.strictEqual(promptUpdate, undefined);
  assert.deepStrictEqual(runtime.pendingPromptContextEntries(), [
    {
      context: "live context",
      scope: "project",
      marketplace: "catalog",
      pluginId: "live",
      event: "UserPromptSubmit",
    },
  ]);
});

// A run that Pi starts with the custom message `customType`.
function customTurn(customType: string): BeforeAgentStartEvent {
  return {
    type: "before_agent_start",
    messageType: "custom",
    message: { role: "custom", customType, content: "wake up", display: false, timestamp: 1 },
    systemPrompt: "base prompt",
    systemPromptOptions: {},
  } as BeforeAgentStartEvent;
}

for (const { title, event, woken } of [
  {
    title: "marks the run that an async rewake starts as woken",
    event: customTurn("claude-hook-rewake"),
    woken: true,
  },
  {
    title: "clears the woken mark for a run that a prompt starts",
    event: PROMPT_TURN,
    woken: false,
  },
  {
    title: "clears the woken mark for a run that another custom message starts",
    event: customTurn("claude-hook-stop-block"),
    woken: false,
  },
]) {
  test(`registered before_agent_start ${title} (D-BG-210)`, async (t) => {
    // arrange
    const { runtime, handler, context } = await beforeAgentStartFixture(t);
    runtime.recordRunStart(!woken);

    // act
    const promptUpdate = await handler(event, context);

    // assert
    assert.strictEqual(promptUpdate, undefined);
    assert.strictEqual(runtime.isStopHookActive(), woken);
  });
}

test("registered handlers give stop_hook_active to the Stop hooks of the woken run only (D-BG-210)", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-woken-run-");
  const { pi, registrations } = makeRecordingPi();
  const context = makeContext(root, root);
  const stopHookActive: boolean[] = [];
  const executor: HookExecutor = (_entry, event) => {
    stopHookActive.push((event as { stop_hook_active: boolean }).stop_hook_active);
    return Promise.resolve({ kind: "noop" });
  };

  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor,
  });
  runtime.setRoutingBucket("Stop", [
    {
      scope: "user",
      marketplace: "catalog",
      pluginId: "alpha",
      resolvedSource: asAbsolutePluginRoot("/router/user/alpha"),
      claudeEvent: "Stop",
      matcher: parseMatcher(""),
      rawMatcher: "",
      handlerDecl: { type: "command", command: "stop-hook" },
      declarationIndex: 0,
      ifPredicate: MATCH_ALL_IF,
      options: resolveOptions(undefined),
    },
  ]);
  const startRun = registeredHandler(registrations, "before_agent_start");
  const endRun = registeredHandler(registrations, "agent_end");
  const boundaryRun = registeredHandler(registrations, "agent_before_settle");
  const settleRun = registeredHandler(registrations, "agent_settled");
  const runEnding = {
    type: "agent_end",
    messages: [{ ...assistantForBookkeeping(), stopReason: "stop" }],
  } as AgentEndEvent;
  const boundary = { type: "agent_before_settle", entries: [], continue: false };

  // act
  await startRun(customTurn("claude-hook-rewake"), context);
  await endRun(runEnding, context);
  await boundaryRun(boundary, context);
  await settleRun({ type: "agent_settled" }, context);
  await startRun(customTurn("another-extension-message"), context);
  await endRun(runEnding, context);
  await boundaryRun(boundary, context);
  await settleRun({ type: "agent_settled" }, context);

  // assert
  assert.deepStrictEqual(stopHookActive, [true, false]);
});

test("registered turn_end sends a follow-up's context before the agent reads it (D-CF5-13)", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-turn-end-");
  const { pi, registrations, messages } = makeRecordingPi();
  const context = makeContext(root, root);
  const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
  await hydration.registerHooksBridge(pi, { cwd: root });
  const staleHandler = registeredHandler(registrations, "turn_end");
  await hydration.registerHooksBridge(pi, { cwd: root });
  const handler = registeredHandler(registrations, "turn_end", 1);
  runtime.queueFollowUpContext({
    context: "follow-up context",
    scope: "project",
    marketplace: "catalog",
    pluginId: "live",
    event: "UserPromptSubmit",
    prompt: "also say hi",
  });
  const event = {
    type: "turn_end",
    message: { role: "assistant", content: [{ type: "text", text: "Done." }], stopReason: "stop" },
    context: {
      pendingMessages: [{ role: "user", content: [{ type: "text", text: "also say hi" }] }],
    },
  };

  // act
  const staleOutput = await staleHandler(event, context);
  const sentByStale = [...messages];
  const output = await handler(event, context);

  // assert
  assert.strictEqual(staleOutput, undefined);
  assert.deepStrictEqual(sentByStale, []);
  assert.strictEqual(output, undefined);
  assert.deepStrictEqual(messages, [
    {
      message: {
        customType: "claude-hook-additional-context",
        content: [
          { type: "text", text: "UserPromptSubmit hook additional context: follow-up context" },
        ],
        display: false,
      },
      options: { triggerTurn: false },
    },
  ]);
  assert.deepStrictEqual(runtime.drainFollowUpContext(), []);
});

test("rebuildRoutingTables preserves stable plugin and declaration order in all eleven buckets", () => {
  // arrange
  const runtime = createHooksRuntime();
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
    "UserPromptExpansion",
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
  seedPluginConfig(
    runtime,
    "user",
    "catalog",
    "shared",
    asAbsolutePluginRoot("/router/user/shared"),
    configFor("user-shared"),
    new Map([["PreToolUse|0|0", MATCH_ALL_IF]]),
  );
  seedPluginConfig(
    runtime,
    "user",
    "catalog",
    "zulu",
    asAbsolutePluginRoot("/router/user/zulu"),
    configFor("user-zulu"),
    new Map(),
  );
  seedPluginConfig(
    runtime,
    "project",
    "catalog",
    "shared",
    asAbsolutePluginRoot("/router/project/shared"),
    configFor("project-shared"),
    new Map(),
  );

  // act
  createHooksRouting(runtime, { readHooksJson }).rebuildRoutingTables();
  const table = Array.from(runtime.routingTableEntries(), ([event, entries]) => ({
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

test("rebuildRoutingTables ignores prompt and Stop matcher text on every rebuild", () => {
  // arrange
  const runtime = createHooksRuntime();
  const config: HooksConfig = {
    UserPromptSubmit: [
      { matcher: "[", hooks: [{ type: "command", command: "prompt-invalid" }] },
      { hooks: [{ type: "command", command: "prompt-absent" }] },
    ],
    Stop: [
      { matcher: "[", hooks: [{ type: "command", command: "stop-invalid" }] },
      { matcher: "", hooks: [{ type: "command", command: "stop-empty" }] },
    ],
  };
  seedPluginConfig(
    runtime,
    "project",
    "catalog",
    "ignored",
    asAbsolutePluginRoot("/router/project/ignored"),
    config,
    new Map(),
  );
  const routing = createHooksRouting(runtime, { readHooksJson });
  const events = ["UserPromptSubmit", "Stop"] as const satisfies readonly BucketAEvent[];

  // act
  routing.rebuildRoutingTables();
  const first = events.map((event) =>
    runtime.getRoutingBucket(event).map((entry) => ({
      command: entry.handlerDecl.command,
      rawMatcher: entry.rawMatcher,
      matcher: entry.matcher,
    })),
  );
  routing.rebuildRoutingTables();
  const second = events.map((event) =>
    runtime.getRoutingBucket(event).map((entry) => ({
      command: entry.handlerDecl.command,
      rawMatcher: entry.rawMatcher,
      matcher: entry.matcher,
    })),
  );

  // assert
  assert.deepStrictEqual(first, [
    [
      { command: "prompt-invalid", rawMatcher: "[", matcher: { kind: "match-all" } },
      { command: "prompt-absent", rawMatcher: "", matcher: { kind: "match-all" } },
    ],
    [
      { command: "stop-invalid", rawMatcher: "[", matcher: { kind: "match-all" } },
      { command: "stop-empty", rawMatcher: "", matcher: { kind: "match-all" } },
    ],
  ]);
  assert.deepStrictEqual(second, first);
});

test("D-PG6-19: rebuildRoutingTables parses a UserPromptExpansion matcher as a command name", () => {
  // arrange
  const runtime = createHooksRuntime();
  const config: HooksConfig = {
    UserPromptExpansion: [
      { matcher: "", hooks: [{ type: "command", command: "expansion-empty" }] },
      { matcher: "*", hooks: [{ type: "command", command: "expansion-star" }] },
      { matcher: "deploy, ship | test", hooks: [{ type: "command", command: "expansion-list" }] },
      { matcher: "demo:deploy", hooks: [{ type: "command", command: "expansion-regex" }] },
    ],
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "tool-list" }] }],
  };
  seedPluginConfig(
    runtime,
    "project",
    "catalog",
    "expansion",
    asAbsolutePluginRoot("/router/project/expansion"),
    config,
    new Map(),
  );

  // act
  createHooksRouting(runtime, { readHooksJson }).rebuildRoutingTables();
  const routed = (["UserPromptExpansion", "PreToolUse"] as const).map((event) =>
    runtime.getRoutingBucket(event).map((entry) => ({
      command: entry.handlerDecl.command,
      matcher: entry.matcher,
    })),
  );

  // assert
  assert.deepStrictEqual(routed, [
    [
      { command: "expansion-empty", matcher: { kind: "match-all" } },
      { command: "expansion-star", matcher: { kind: "match-all" } },
      {
        command: "expansion-list",
        matcher: { kind: "name-set", names: new Set(["deploy", "ship", "test"]) },
      },
      { command: "expansion-regex", matcher: { kind: "regex", pattern: /demo:deploy/ } },
    ],
    [{ command: "tool-list", matcher: { kind: "tool-set", toolNames: new Set(["bash"]) } }],
  ]);
});

test("D-PG10-10 rebuildRoutingTables gives every routing entry of a plugin its options", () => {
  // arrange
  const runtime = createHooksRuntime();
  const options = resolveOptions({
    mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
  });
  seedPluginConfig(
    runtime,
    "user",
    "catalog",
    "optioned",
    asAbsolutePluginRoot("/router/user/optioned"),
    makeConfig([
      { event: "PreToolUse", handlers: 2 },
      { event: "SessionStart", handlers: 1 },
    ]),
    new Map(),
    options,
  );

  // act
  createHooksRouting(runtime, { readHooksJson }).rebuildRoutingTables();
  const routed = Array.from(runtime.routingTableEntries()).flatMap(([, entries]) =>
    entries.map((entry) => entry.options),
  );

  // assert
  assert.deepStrictEqual(routed, [options, options, options]);
});

test("rebuildRoutingTables tolerates valid record keys and sparse arrays defensively", () => {
  // arrange
  const runtime = createHooksRuntime();
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
  seedPluginConfig(
    runtime,
    "project",
    "catalog",
    "defensive",
    asAbsolutePluginRoot("/router/project/defensive"),
    config,
    new Map(),
  );

  // act
  createHooksRouting(runtime, { readHooksJson }).rebuildRoutingTables();
  const table = Array.from(runtime.routingTableEntries(), ([event, entries]) => ({
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
    { event: "UserPromptExpansion", commands: [] },
    { event: "UserPromptSubmit", commands: [] },
  ]);
});

test(
  "hydrateProjectScopeForCwd separates scope and skips disabled, empty, unsafe, unreadable, and invalid plugins",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const { cwd: root } = await createHermeticEnvironment(t, "hooks-router-hydrate-matrix-");
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
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).hydrateProjectScopeForCwd(root, true);
    createHooksRouting(runtime, { readHooksJson }).rebuildRoutingTables();
    const cache = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
      resolvedSource: entry.resolvedSource,
      config: entry.config,
    }));
    const routes = Array.from(runtime.routingTableEntries(), ([event, entries]) => ({
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
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-project-replace-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const locations = locationsFor("project", root);
    const readRoots: string[] = [];
    const loadError = new Error("project state refused");
    const hydrationReader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        readRoots.push(extensionRoot);
        return Promise.reject(loadError);
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const config = makeConfig([{ event: "PreToolUse", handlers: 1, prefix: "cached" }]);
    const runtime = createHooksRuntime();
    runtime.setParsedConfig("project\x00alpha\x00first", {
      scope: "project",
      marketplace: "alpha",
      pluginId: "first",
      resolvedSource: asAbsolutePluginRoot(path.join(root, "old", "first")),
      config,
      ifPredicates: new Map(),
      options: resolveOptions(undefined),
    });
    runtime.setParsedConfig("project\x00beta\x00second", {
      scope: "project",
      marketplace: "beta",
      pluginId: "second",
      resolvedSource: asAbsolutePluginRoot(path.join(root, "old", "second")),
      config,
      ifPredicates: new Map(),
      options: resolveOptions(undefined),
    });
    runtime.setParsedConfig("user\x00alpha\x00first", {
      scope: "user",
      marketplace: "alpha",
      pluginId: "first",
      resolvedSource: asAbsolutePluginRoot(path.join(root, "user", "first")),
      config,
      ifPredicates: new Map(),
      options: resolveOptions(undefined),
    });
    seedPluginConfig(
      runtime,
      "project",
      "transition",
      "stale",
      asAbsolutePluginRoot(path.join(root, "transition", "stale")),
      config,
      new Map(),
    );

    // act
    const hooksHydration = createHooksHydration(runtime, hydrationReader);

    await hooksHydration.hydrateProjectScopeForCwd(root, true);
    const cache = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
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
    assert.deepStrictEqual(readRoots, [locations.extensionRoot]);
  },
);

test(
  "registerHooksBridge shares one reader across ordered factory and lazy hydration",
  { concurrency: false },
  async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-reader-order-");
    const factoryRoot = path.join(root, "factory");
    const projectRoot = path.join(root, "project");
    const userLocations = locationsFor("user", factoryRoot);
    const factoryProjectLocations = locationsFor("project", factoryRoot);
    const projectLocations = locationsFor("project", projectRoot);
    const readRoots: string[] = [];
    const hydrationReader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        readRoots.push(extensionRoot);
        if (extensionRoot === factoryProjectLocations.extensionRoot) {
          return Promise.reject(new Error("factory project state refused"));
        }

        return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
    t.after(() => {
      if (previousDebug === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
      }
    });
    const diagnostics: string[] = [];
    t.mock.method(console, "error", (diagnostic: unknown) => {
      diagnostics.push(String(diagnostic));
    });
    const { pi, registrations, messages } = makeRecordingPi();
    const context = makeContext(projectRoot, root);
    const runtime = createHooksRuntime();

    const hooksHydration = createHooksHydration(runtime, hydrationReader);
    await hooksHydration.registerHooksBridge(pi, {
      cwd: factoryRoot,
    });
    const sessionStart = registeredHandler(registrations, "session_start");

    // act
    const sessionStartUpdate = await sessionStart(
      { type: "session_start", reason: "startup" },
      context,
    );

    // assert
    assert.strictEqual(sessionStartUpdate, undefined);
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
    assert.deepStrictEqual(messages, []);
    assert.strictEqual(registrations.length, 15);
    assert.deepStrictEqual(diagnostics, [
      `[hooks] hydrate: loadState failed for scope=project extensionRoot=${factoryProjectLocations.extensionRoot}: factory project state refused`,
    ]);
    assert.deepStrictEqual(readRoots, [
      userLocations.extensionRoot,
      factoryProjectLocations.extensionRoot,
      projectLocations.extensionRoot,
    ]);
  },
);

test("same-runtime registration invalidates an earlier callback before lazy hydration", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-runtime-generation-");
  const factoryRoot = path.join(root, "factory");
  const projectRoot = path.join(root, "project");
  const readRoots: string[] = [];
  const hydrationReader: HooksHydrationDeps = {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      readRoots.push(extensionRoot);
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
  const runtime = createHooksRuntime();
  const hooksHydration = createHooksHydration(runtime, hydrationReader);
  const { pi, registrations, messages } = makeRecordingPi();
  const context = makeContext(projectRoot, root);
  await hooksHydration.registerHooksBridge(pi, { cwd: factoryRoot });
  const staleSessionStart = registeredHandler(registrations, "session_start");
  await hooksHydration.registerHooksBridge(pi, { cwd: factoryRoot });
  const liveSessionStart = registeredHandler(registrations, "session_start", 1);
  const readsAfterRegistration = [...readRoots];

  // act
  const staleUpdate = await staleSessionStart(
    { type: "session_start", reason: "startup" },
    context,
  );
  const readsAfterStaleCallback = [...readRoots];
  const liveUpdate = await liveSessionStart({ type: "session_start", reason: "startup" }, context);

  // assert
  assert.strictEqual(staleUpdate, undefined);
  assert.strictEqual(liveUpdate, undefined);
  assert.strictEqual(runtime.currentGeneration(), 2);
  assert.deepStrictEqual(readsAfterStaleCallback, readsAfterRegistration);
  assert.deepStrictEqual(readRoots, [
    ...readsAfterRegistration,
    locationsFor("project", projectRoot).extensionRoot,
  ]);
  assert.deepStrictEqual(messages, []);
  assert.strictEqual(registrations.length, 30);
});

test(
  "same-runtime registration stops stale lazy hydration before post-await route and file effects",
  { concurrency: false },
  async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-stale-hydration-");
    const factoryRoot = path.join(root, "factory");
    const projectRoot = path.join(root, "project");
    const projectLocations = locationsFor("project", projectRoot);
    const hookPath = path.join(projectLocations.hooksDir, "stale-owner", "hooks.json");
    await mkdir(path.dirname(hookPath), { recursive: true });
    await writeFile(
      hookPath,
      JSON.stringify(makeConfig([{ event: "PreToolUse", handlers: 1 }])),
      "utf8",
    );
    const staleState = {
      schemaVersion: 2,
      marketplaces: {
        stale: {
          name: "stale",
          scope: "project",
          source: { kind: "path", raw: path.join(root, "marketplace") },
          addedFromCwd: projectRoot,
          manifestPath: path.join(root, "marketplace", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(root, "marketplace"),
          plugins: {
            "stale-owner": {
              version: "1.0.0",
              resolvedSource: path.join(root, "marketplace", "plugins", "stale-owner"),
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: ["stale-owner"],
                workflows: [],
              },
              enabled: true,
              provenance: "explicit",
              installedAt: "2026-09-08T00:00:00.000Z",
              updatedAt: "2026-09-08T00:00:00.000Z",
            },
          },
        },
      },
    } satisfies ExtensionState;
    let releaseStaleState: ((state: ExtensionState) => void) | undefined;
    let deferProjectRead = false;
    const reader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        if (deferProjectRead && extensionRoot === projectLocations.extensionRoot) {
          deferProjectRead = false;
          return new Promise((resolve) => {
            releaseStaleState = resolve;
          });
        }

        return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const runtime = createHooksRuntime();
    const hydration = createHooksHydration(runtime, reader);
    const { pi, registrations, messages } = makeRecordingPi();
    const context = makeContext(projectRoot, root);
    await hydration.registerHooksBridge(pi, { cwd: factoryRoot });
    const staleSessionStart = registeredHandler(registrations, "session_start");
    deferProjectRead = true;
    const staleCompletion = staleSessionStart(
      { type: "session_start", reason: "startup" },
      context,
    );
    await hydration.registerHooksBridge(pi, { cwd: factoryRoot });

    // act
    releaseStaleState?.(staleState);
    const staleUpdate = await staleCompletion;

    // assert
    assert.strictEqual(staleUpdate, undefined);
    assert.strictEqual(runtime.currentGeneration(), 2);
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
    assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
    assert.deepStrictEqual(messages, []);
    assert.strictEqual(registrations.length, 30);
  },
);

test(
  "stale SessionStart stops after an injected dispatch await",
  { concurrency: false },
  async (t) => {
    // arrange
    const fixture = await makeProjectHookFixture(t, "stale-session-effects", "SessionStart");
    const reader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        return Promise.resolve(
          extensionRoot === fixture.locations.extensionRoot
            ? fixture.state
            : { schemaVersion: 2, marketplaces: {} },
        );
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const runtime = createHooksRuntime();
    const hydration = createHooksHydration(runtime, reader);
    const { pi, registrations, messages } = makeRecordingPi();
    const context = makeContext(fixture.projectRoot, fixture.root);
    const dispatchStarted = createDeferred<undefined>();
    const releaseDispatch = createDeferred<undefined>();
    let deferDispatch = false;
    const executor: HookExecutor = () => {
      if (!deferDispatch) {
        return Promise.resolve({ kind: "mutate", additionalContext: "stale context" });
      }

      deferDispatch = false;
      dispatchStarted.resolve(undefined);
      return releaseDispatch.promise.then(() => ({
        kind: "mutate",
        additionalContext: "stale context",
      }));
    };

    await hydration.registerHooksBridge(pi, { cwd: fixture.factoryRoot, executor });
    const currentSessionStart = registeredHandler(registrations, "session_start");
    deferDispatch = true;
    const staleAtDispatch = currentSessionStart(
      { type: "session_start", reason: "startup" },
      context,
    );
    await dispatchStarted.promise;
    await hydration.registerHooksBridge(pi, { cwd: fixture.factoryRoot, executor });

    // act
    releaseDispatch.resolve(undefined);
    await staleAtDispatch;

    // assert
    assert.deepStrictEqual(messages, []);
  },
);

test("runtime hydration stops before mirroring when registration advances its generation", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "stale-public-hydration", "PreToolUse");
  const readStarted = createDeferred<undefined>();
  const releaseRead = createDeferred<undefined>();
  let deferProjectRead = true;
  const reader: HooksHydrationDeps = {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      if (deferProjectRead && extensionRoot === fixture.locations.extensionRoot) {
        deferProjectRead = false;
        readStarted.resolve(undefined);
        return releaseRead.promise.then(() => fixture.state);
      }

      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
  const runtime = createHooksRuntime();
  const hydration = createHooksHydration(runtime, reader);
  const pendingHydration = hydration.hydrateProjectScopeForCwd(fixture.projectRoot, true);
  await readStarted.promise;
  const { pi } = makeRecordingPi();
  await hydration.registerHooksBridge(pi, {
    cwd: fixture.factoryRoot,
  });

  // act
  releaseRead.resolve(undefined);
  await pendingHydration;

  // assert
  assert.strictEqual(runtime.currentGeneration(), 1);
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
});

test(
  "factory hydration stops at the containment guard when a concurrent registration advances the generation",
  { concurrency: false },
  async (t) => {
    // arrange
    const fixture = await makeProjectHookFixture(t, "stale-factory-hydration", "PreToolUse");
    const readStarted = createDeferred<undefined>();
    const releaseRead = createDeferred<undefined>();
    let deferProjectRead = true;
    const reader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        if (deferProjectRead && extensionRoot === fixture.locations.extensionRoot) {
          deferProjectRead = false;
          readStarted.resolve(undefined);
          return releaseRead.promise.then(() => fixture.state);
        }

        return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const runtime = createHooksRuntime();
    const hydration = createHooksHydration(runtime, reader);
    const { pi, messages } = makeRecordingPi();
    const staleRegistration = hydration.registerHooksBridge(pi, {
      cwd: fixture.projectRoot,
    });
    await readStarted.promise;
    // The second registration reads from `factoryRoot`, where no state
    // declares a hooks plugin, so the only thing it contributes to the
    // assertions below is the generation advance.
    await hydration.registerHooksBridge(pi, { cwd: fixture.factoryRoot });

    // act
    releaseRead.resolve(undefined);
    await staleRegistration;

    // assert
    assert.strictEqual(runtime.currentGeneration(), 2);
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
    assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
    assert.deepStrictEqual(messages, []);
  },
);

test("project hydration parses a plugin's hooks.json into the parsed-config cache", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "live-project-hydration", "PreToolUse");
  const reader: HooksHydrationDeps = {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      return Promise.resolve(
        extensionRoot === fixture.locations.extensionRoot
          ? fixture.state
          : { schemaVersion: 2, marketplaces: {} },
      );
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
  const runtime = createHooksRuntime();

  // act
  await createHooksHydration(runtime, reader).hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // assert
  assert.deepStrictEqual(
    Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      marketplace: entry.marketplace,
      pluginId: entry.pluginId,
    })),
    [{ scope: "project", marketplace: "catalog", pluginId: "owner" }],
  );
  // The routing bucket stays empty on purpose: `hydrateProjectScopeForCwd` fills
  // the parsed-config cache, and registration is what builds the routing table
  // from it. The bucket is therefore NOT a discriminator for this entrypoint --
  // it reads empty on a hydration that completed and on one that stopped at the
  // first guard alike.
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
});

test("D-PG10-23 project hydration caches the options its record holds", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "options-project-hydration", "PreToolUse");
  const userConfig = {
    mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
  } as const;
  const state = makeScopeState({
    scope: "project",
    cwd: fixture.projectRoot,
    plugins: {
      owner: {
        ...makeStoredPlugin({
          root: path.join(fixture.root, "plugins", "owner"),
          hooks: ["owner-hooks"],
        }),
        userConfig,
      },
    },
  });
  const runtime = createHooksRuntime();

  // act
  await createHooksHydration(runtime, {
    loadState: (extensionRoot) =>
      Promise.resolve(
        extensionRoot === fixture.locations.extensionRoot
          ? state
          : { schemaVersion: 2, marketplaces: {} },
      ),
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // assert
  assert.deepStrictEqual(
    Array.from(runtime.parsedConfigEntries().values(), (entry) => entry.options),
    [resolveOptions(userConfig)],
  );
});

/** A hydration reader that serves `fixture.state` for its project and no plugins elsewhere. */
function fixtureStateReader(fixture: ProjectHookFixture): HooksHydrationDeps {
  return {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      return Promise.resolve(
        extensionRoot === fixture.locations.extensionRoot
          ? fixture.state
          : { schemaVersion: 2, marketplaces: {} },
      );
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
}

test("D-LOC-01 project hydration caches nothing in a project Pi does not trust", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "untrusted-project-hydration", "PreToolUse");
  const runtime = createHooksRuntime();

  // act
  await createHooksHydration(runtime, fixtureStateReader(fixture)).hydrateProjectScopeForCwd(
    fixture.projectRoot,
    false,
  );

  // assert
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
  assert.strictEqual(runtime.isProjectTrusted(fixture.projectRoot), false);
});

test("D-LOC-01 project hydration in an untrusted project drops the project configs it held", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "untrusted-project-rehydration", "PreToolUse");
  const runtime = createHooksRuntime();
  const hydration = createHooksHydration(runtime, fixtureStateReader(fixture));
  await hydration.hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // act
  await hydration.hydrateProjectScopeForCwd(fixture.projectRoot, false);

  // assert
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
});

for (const { title, hydratedCwd, trusted } of [
  { title: "no project hydrate ran", hydratedCwd: undefined, trusted: false },
  { title: "Pi does not trust the project", hydratedCwd: "project", trusted: false },
  { title: "the trusted project is another one", hydratedCwd: "other", trusted: true },
] as const) {
  test(`D-LOC-01 readAndCachePluginHooks caches no project config when ${title}`, async (t) => {
    // arrange
    const fixture = await makeProjectHookFixture(t, "untrusted-project-read", "PreToolUse");
    const runtime = createHooksRuntime();
    if (hydratedCwd !== undefined) {
      runtime.recordProjectTrust(
        hydratedCwd === "project" ? fixture.projectRoot : path.join(fixture.root, "other"),
        trusted,
      );
    }

    // act
    await createHooksRouting(runtime, { readHooksJson }).readAndCachePluginHooks({
      scope: "project",
      marketplace: "catalog",
      plugin: "owner-hooks",
      resolvedSource: asAbsolutePluginRoot(path.join(fixture.root, "plugins", "owner")),
      hooksJsonPath: fixture.hookPath,
      cwd: fixture.projectRoot,
      logPrefix: "install",
      options: resolveOptions(undefined),
    });

    // assert
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
  });
}

test("D-LOC-01 readAndCachePluginHooks caches a project config once the hydrate found the project trusted", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "trusted-project-read", "PreToolUse");
  const runtime = createHooksRuntime();
  await createHooksHydration(runtime, {
    loadState: () => Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // act
  await createHooksRouting(runtime, { readHooksJson }).readAndCachePluginHooks({
    scope: "project",
    marketplace: "catalog",
    plugin: "owner-hooks",
    resolvedSource: asAbsolutePluginRoot(path.join(fixture.root, "plugins", "owner")),
    hooksJsonPath: fixture.hookPath,
    cwd: fixture.projectRoot,
    logPrefix: "install",
    options: resolveOptions(undefined),
  });

  // assert
  assert.deepStrictEqual(
    Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
      scope: entry.scope,
      pluginId: entry.pluginId,
      config: entry.config,
    })),
    [
      {
        scope: "project",
        pluginId: "owner-hooks",
        config: makeConfig([{ event: "PreToolUse", handlers: 1 }]),
      },
    ],
  );
});

test("project hydration stops before parsing a plugin's hooks.json read under a stale generation", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "stale-after-hooks-read", "PreToolUse");
  const runtime = createHooksRuntime();
  // The trigger is named, not counted: the generation advances from inside the
  // injected hooks read, which runs at exactly the point this case is about, so
  // nothing here depends on a `currentGeneration()` call index (D-09-05 /
  // D-09-07).
  //
  // The sibling above hydrates this same fixture with an undecorated reader and
  // reads back one parsed-config entry, so the empty `parsedConfigEntries()`
  // below is a hydration that was stopped, not a fixture that never hydrates.
  // That sibling also records why `getRoutingBucket` is not a discriminator for
  // this entrypoint.
  const reader: HooksHydrationDeps = {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      return Promise.resolve(
        extensionRoot === fixture.locations.extensionRoot
          ? fixture.state
          : { schemaVersion: 2, marketplaces: {} },
      );
    },
    readMcpServerNames: readStoredServerNames,
    readHooksJson(hooksJsonPath: string): Promise<string> {
      if (hooksJsonPath === fixture.hookPath) {
        runtime.advanceGeneration();
      }

      // The call below is the imported production reader, not this member --
      // an object-literal method name binds no identifier in its own body.
      return readHooksJson(hooksJsonPath);
    },
  };
  const hydration = createHooksHydration(runtime, reader);

  // act
  await hydration.hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // assert
  assert.strictEqual(runtime.currentGeneration(), 1);
  assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
});

test("D-PG6-07: project hydration names no server when the server read advances the generation", async (t) => {
  // arrange
  const fixture = await makeProjectHookFixture(t, "stale-after-server-read", "PreToolUse");
  const runtime = createHooksRuntime();
  const reader: HooksHydrationDeps = {
    ...fixtureStateReader(fixture),
    readMcpServerNames(): Promise<readonly string[]> {
      runtime.advanceGeneration();
      return Promise.resolve(["stub"]);
    },
  };

  // act
  await createHooksHydration(runtime, reader).hydrateProjectScopeForCwd(fixture.projectRoot, true);

  // assert
  assert.strictEqual(
    runtime.mcpServerFor({ piName: "mcp__plugin_owner_stub__echo", builtinServer: undefined }),
    undefined,
  );
});

test(
  "SessionStart stops after preparing the shared data dir when the routing read advances the generation",
  { concurrency: false },
  async (t) => {
    // arrange
    const fixture = await makeProjectHookFixture(t, "stale-session-shared-dir", "SessionStart");
    const reader: HooksHydrationDeps = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        return Promise.resolve(
          extensionRoot === fixture.locations.extensionRoot
            ? fixture.state
            : { schemaVersion: 2, marketplaces: {} },
        );
      },
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    };
    const runtime = createHooksRuntime();
    let advanceOnTheSessionStartRead = false;
    // The SessionStart routing bucket is read immediately before the shared
    // data dir is awaited, so delegating that read and then advancing the
    // generation leaves only the guard after the await for this case to
    // measure. The advance is armed only for the dispatch.
    const runtimeGoingStaleOnTheSessionStartRead: HooksRuntime = {
      ...runtime,
      getRoutingBucket(event: BucketAEvent): readonly RoutingEntry[] {
        const entries = runtime.getRoutingBucket(event);
        if (advanceOnTheSessionStartRead && event === "SessionStart") {
          runtime.advanceGeneration();
        }

        return entries;
      },
    };
    const hydration = createHooksHydration(runtimeGoingStaleOnTheSessionStartRead, reader);
    const { pi, registrations, messages } = makeRecordingPi();
    const context = makeContext(fixture.projectRoot, fixture.root);
    const dispatched: string[] = [];
    const executor: HookExecutor = (entry) => {
      dispatched.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    };

    await hydration.registerHooksBridge(pi, { cwd: fixture.projectRoot, executor });
    const sessionStart = registeredHandler(registrations, "session_start");
    advanceOnTheSessionStartRead = true;

    // act
    const update = await sessionStart({ type: "session_start", reason: "startup" }, context);

    // assert
    assert.strictEqual(update, undefined);
    assert.strictEqual(runtime.currentGeneration(), 2);
    assert.deepStrictEqual(dispatched, []);
    assert.deepStrictEqual(messages, []);
  },
);

test("separate runtimes keep their current callbacks live and route through their own buckets", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-runtime-isolation-");
  const reader: HooksHydrationDeps = {
    loadState(): Promise<ExtensionState> {
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
  const firstRuntime = createHooksRuntime();
  const secondRuntime = createHooksRuntime();
  const firstHydration = createHooksHydration(firstRuntime, reader);
  const secondHydration = createHooksHydration(secondRuntime, reader);
  const firstPi = makeRecordingPi();
  const secondPi = makeRecordingPi();
  const firstDispatched: string[] = [];
  const secondDispatched: string[] = [];
  const firstExecutor: HookExecutor = (entry) => {
    firstDispatched.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  const secondExecutor: HookExecutor = (entry) => {
    secondDispatched.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  const firstCwd = path.join(root, "first");
  const secondCwd = path.join(root, "second");
  await firstHydration.registerHooksBridge(firstPi.pi, {
    cwd: firstCwd,
    executor: firstExecutor,
  });
  await secondHydration.registerHooksBridge(secondPi.pi, {
    cwd: secondCwd,
    executor: secondExecutor,
  });
  const entryFor = (pluginId: string, cwd: string): RoutingEntry => ({
    scope: "project",
    marketplace: "catalog",
    pluginId,
    resolvedSource: asAbsolutePluginRoot(path.join(cwd, pluginId)),
    claudeEvent: "PreToolUse",
    matcher: parseMatcher("Bash"),
    rawMatcher: "Bash",
    handlerDecl: { type: "command", command: `run-${pluginId}` },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
    options: resolveOptions(undefined),
  });
  firstRuntime.setRoutingBucket("PreToolUse", [entryFor("first-plugin", firstCwd)]);
  secondRuntime.setRoutingBucket("PreToolUse", [entryFor("second-plugin", secondCwd)]);
  const toolCall = {
    type: "tool_call",
    toolCallId: "runtime-isolation-call",
    toolName: "bash",
    input: { command: "printf isolated" },
  } satisfies ToolCallEvent;
  for (let index = 0; index < 8; index += 1) {
    firstRuntime.recordStopReentry();
    secondRuntime.recordStopReentry();
  }

  // act
  await registeredHandler(firstPi.registrations, "tool_call")(
    toolCall,
    makeContext(firstCwd, root),
  );
  const firstAfterTool = firstRuntime.recordStopReentry();
  const secondWithoutTool = secondRuntime.recordStopReentry();
  await registeredHandler(secondPi.registrations, "tool_call")(
    toolCall,
    makeContext(secondCwd, root),
  );
  const secondAfterTool = secondRuntime.recordStopReentry();

  // assert
  assert.deepStrictEqual(firstAfterTool, { reenter: true, notifyCap: false });
  assert.deepStrictEqual(secondWithoutTool, { reenter: false, notifyCap: true });
  assert.deepStrictEqual(secondAfterTool, { reenter: true, notifyCap: false });
  assert.deepStrictEqual(firstDispatched, ["first-plugin"]);
  assert.deepStrictEqual(secondDispatched, ["second-plugin"]);
  assert.deepStrictEqual(firstPi.messages, []);
  assert.deepStrictEqual(secondPi.messages, []);
});

/**
 * A recording Pi that also lists `commands` and counts its inventory reads,
 * the reads the run snapshot behind the proxy rule makes (D-P5-07).
 */
function makeInventoryPi(commands: readonly SlashCommandInfo[]): {
  readonly pi: ExtensionAPI;
  readonly registrations: RecordedRegistration[];
  readonly reads: { getAllTools: number; getCommands: number };
} {
  const recording = makeRecordingPi();
  const reads = { getAllTools: 0, getCommands: 0 };
  const pi = Object.assign(recording.pi, {
    getAllTools(): ToolInfo[] {
      reads.getAllTools += 1;
      return [];
    },
    getCommands(): SlashCommandInfo[] {
      reads.getCommands += 1;
      return [...commands];
    },
  });
  return { pi, registrations: recording.registrations, reads };
}

/** A `*` PreToolUse hook and a `*` PostToolUse hook of one plugin. */
function setMatchAllToolBuckets(runtime: HooksRuntime, cwd: string): void {
  for (const claudeEvent of ["PreToolUse", "PostToolUse"] as const) {
    runtime.setRoutingBucket(claudeEvent, [
      {
        scope: "project",
        marketplace: "catalog",
        pluginId: claudeEvent,
        resolvedSource: asAbsolutePluginRoot(path.join(cwd, "plugin")),
        claudeEvent,
        matcher: parseMatcher("*"),
        rawMatcher: "*",
        handlerDecl: { type: "command", command: "guard" },
        declarationIndex: 0,
        ifPredicate: MATCH_ALL_IF,
        options: resolveOptions(undefined),
      },
    ]);
  }
}

const PROXY_TOOL_CALL = {
  type: "tool_call",
  toolCallId: "proxy-call",
  toolName: "mcp",
  input: { tool: "mcp__plugin_demo_stub__echo", args: { text: "ping" } },
} satisfies ToolCallEvent;

const PROXY_TOOL_RESULT = {
  ...PROXY_TOOL_CALL,
  type: "tool_result",
  content: [{ type: "text", text: "echo:ping" }],
  isError: false,
  details: undefined,
} satisfies ToolResultEvent;

async function callToolHandlers(
  registrations: readonly RecordedRegistration[],
  occurrence: number,
  context: ExtensionContext,
): Promise<unknown[]> {
  return [
    await registeredHandler(registrations, "tool_call", occurrence)(PROXY_TOOL_CALL, context),
    await registeredHandler(registrations, "tool_result", occurrence)(PROXY_TOOL_RESULT, context),
  ];
}

test("the tool handlers of one bridge load share one read of the proxy rule (D-P5-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-proxy-rule-");
  const cwd = path.join(root, "project");
  const runtime = createHooksRuntime();
  const { pi, registrations, reads } = makeInventoryPi([adapterCommand()]);
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd,
    executor: (entry) => {
      dispatched.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    },
  });
  setMatchAllToolBuckets(runtime, cwd);

  // act
  const outputs = await callToolHandlers(registrations, 0, makeContext(cwd, root));

  // assert
  assert.deepStrictEqual(outputs, [undefined, undefined]);
  assert.deepStrictEqual(dispatched, []);
  assert.deepStrictEqual(reads, { getAllTools: 3, getCommands: 1 });
});

test("a new bridge load reads the proxy rule again and its stale handlers read nothing (D-P5-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-proxy-rule-reload-");
  const cwd = path.join(root, "project");
  const runtime = createHooksRuntime();
  const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
  const { pi, registrations, reads } = makeInventoryPi([adapterCommand()]);
  const context = makeContext(cwd, root);
  await hydration.registerHooksBridge(pi, {
    cwd,
    executor: () => Promise.resolve({ kind: "noop" }),
  });
  setMatchAllToolBuckets(runtime, cwd);
  await callToolHandlers(registrations, 0, context);
  await hydration.registerHooksBridge(pi, {
    cwd,
    executor: () => Promise.resolve({ kind: "noop" }),
  });
  setMatchAllToolBuckets(runtime, cwd);

  // act
  const staleOutputs = await callToolHandlers(registrations, 0, context);
  const readsAfterStale = { ...reads };
  await callToolHandlers(registrations, 1, context);

  // assert
  assert.deepStrictEqual(staleOutputs, [undefined, undefined]);
  assert.deepStrictEqual(readsAfterStale, { getAllTools: 3, getCommands: 1 });
  assert.deepStrictEqual(reads, { getAllTools: 6, getCommands: 2 });
});

test("registering the bridge reads neither Pi's tools nor its commands (MSEL-01)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-proxy-rule-register-");
  const cwd = path.join(root, "project");
  const { pi, registrations, reads } = makeInventoryPi([adapterCommand()]);

  // act
  await createHooksHydration(createHooksRuntime(), EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd,
  });

  // assert
  assert.strictEqual(
    registrations.filter(({ event }) => event === "tool_call" || event === "tool_result").length,
    2,
  );
  assert.deepStrictEqual(reads, { getAllTools: 0, getCommands: 0 });
});

test(
  "registerHooksBridge degrades corrupt scope state and leaves unused shared directories absent",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const { root } = await createHermeticEnvironment(t, "hooks-router-corrupt-state-");
    const projectRoot = path.join(root, "project");
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await writeFile(path.join(userLocations.extensionRoot, "state.json"), "{", "utf8");
    await writeFile(path.join(projectLocations.extensionRoot, "state.json"), "{", "utf8");
    const { pi, registrations, messages } = makeRecordingPi();

    // act
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
    });
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
        { event: "input", handlerType: "function" },
        { event: "tool_call", handlerType: "function" },
        { event: "tool_result", handlerType: "function" },
        { event: "before_agent_start", handlerType: "function" },
        { event: "turn_start", handlerType: "function" },
        { event: "turn_end", handlerType: "function" },
        { event: "agent_end", handlerType: "function" },
        { event: "agent_before_settle", handlerType: "function" },
        { event: "agent_settled", handlerType: "function" },
        { event: "input", handlerType: "function" },
      ],
    );
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), []);
    assert.deepStrictEqual(sharedState, { user: false, project: false });
    assert.deepStrictEqual(messages, []);
  },
);

test(
  "registerHooksBridge creates a missing shared directory and contains a sibling scope failure",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const { root, projectRoot } = await makeSessionStartFixture(t);
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    await mkdir(userLocations.dataRoot, { recursive: true });
    const userSharedPath = path.join(userLocations.dataRoot, "_shared");
    const projectSharedPath = path.join(projectLocations.dataRoot, "_shared");
    await writeFile(userSharedPath, "regular-file-boundary", "utf8");
    const dispatched: string[] = [];
    const { pi, registrations } = makeRecordingPi();

    // act
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
      executor: (entry) => {
        dispatched.push(entry.scope);
        return Promise.resolve({ kind: "noop" });
      },
    });
    const projectSharedBeforeSession = fs.existsSync(projectSharedPath);
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "startup" },
      makeContext(projectRoot, root),
    );
    const userSharedBytes = await fs.promises.readFile(userSharedPath, "utf8");
    const projectSharedStat = await fs.promises.stat(projectSharedPath);

    // assert
    assert.strictEqual(projectSharedBeforeSession, false);
    assert.deepStrictEqual(dispatched, ["project", "user"]);
    assert.strictEqual(userSharedBytes, "regular-file-boundary");
    assert.strictEqual(projectSharedStat.isDirectory(), true);
    assert.strictEqual(registrations.length, 15);
  },
);

for (const mode of ["tui", "print", "json", "rpc"] as const) {
  test(`SessionStart prepares both scopes before ${mode} hooks run`, async (t) => {
    // arrange
    const { root, projectRoot, sharedPaths } = await makeSessionStartFixture(t);
    const runtime = createHooksRuntime();
    const { pi, registrations, messages } = makeRecordingPi();
    const capture = createJsonCapture();
    const observations: Array<{ scope: string; directories: boolean[] }> = [];
    const context = new Proxy(makeContext(projectRoot, root), {
      get(target, property, receiver): unknown {
        if (property === "mode") {
          return mode;
        }

        if (property === "ui") {
          return capture.ui;
        }

        return Reflect.get(target, property, receiver);
      },
    });
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
      executor: (entry) => {
        observations.push({ scope: entry.scope, directories: sharedPaths.map(fs.existsSync) });
        return Promise.resolve({ kind: "noop" });
      },
    });
    const beforeSession = sharedPaths.map(fs.existsSync);

    // act
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "startup" },
      context,
    );

    // assert
    assert.deepStrictEqual(beforeSession, [false, false]);
    assert.deepStrictEqual(observations, [
      { scope: "project", directories: [true, true] },
      { scope: "user", directories: [true, true] },
    ]);
    assert.deepStrictEqual(messages, []);
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
    assert.strictEqual(registrations.length, 15);
  });
}

for (const failure of ["unknown-mode", "stale-mode"] as const) {
  test(`SessionStart with ${failure} neither hydrates nor creates directories or runs hooks`, async (t) => {
    // arrange
    const { root, projectRoot, sharedPaths } = await makeSessionStartFixture(t);
    const runtime = createHooksRuntime();
    const { pi, registrations, messages } = makeRecordingPi();
    const capture = createJsonCapture();
    const dispatches: string[] = [];
    const contextReads: string[] = [];
    const context = {
      get mode(): string {
        contextReads.push("mode");
        if (failure === "stale-mode") {
          throw new Error("stale mode");
        }

        return "unknown";
      },
      get cwd(): never {
        contextReads.push("cwd");
        throw new Error("rejected session must not hydrate");
      },
      get ui() {
        return capture.ui;
      },
    };
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
      executor: (entry) => {
        dispatches.push(entry.scope);
        return Promise.resolve({ kind: "noop" });
      },
    });
    const cacheBeforeSession = Array.from(runtime.parsedConfigEntries());
    const treeBeforeSession = await fs.promises.readdir(root, { recursive: true });

    // act
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "startup" },
      context,
    );

    // assert
    assert.deepStrictEqual(sharedPaths.map(fs.existsSync), [false, false]);
    assert.deepStrictEqual(Array.from(runtime.parsedConfigEntries()), cacheBeforeSession);
    assert.deepStrictEqual(await fs.promises.readdir(root, { recursive: true }), treeBeforeSession);
    assert.deepStrictEqual(dispatches, []);
    assert.deepStrictEqual(contextReads, ["mode"]);
    assert.deepStrictEqual(messages, []);
    assert.deepStrictEqual(capture.entries, []);
    capture.assertValid();
  });
}

for (const { rejectedRead, directories } of [
  { rejectedRead: 2, directories: [false, false] },
  { rejectedRead: 3, directories: [true, false] },
  { rejectedRead: 4, directories: [true, true] },
]) {
  test(`SessionStart stops new work when mode changes at stage ${rejectedRead}`, async (t) => {
    // arrange
    const { root, projectRoot, sharedPaths } = await makeSessionStartFixture(t);
    const { pi, registrations, messages } = makeRecordingPi();
    const runtime = createHooksRuntime();
    const dispatches: string[] = [];
    let modeReads = 0;
    const context = new Proxy(makeContext(projectRoot, root), {
      get(target, property, receiver): unknown {
        if (property === "mode") {
          modeReads += 1;
          return modeReads === rejectedRead ? "unknown" : "json";
        }

        return Reflect.get(target, property, receiver);
      },
    });
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
      executor: (entry) => {
        dispatches.push(entry.scope);
        return Promise.resolve({ kind: "noop" });
      },
    });

    // act
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "startup" },
      context,
    );

    // assert
    assert.deepStrictEqual(sharedPaths.map(fs.existsSync), directories);
    assert.deepStrictEqual(dispatches, []);
    assert.deepStrictEqual(messages, []);
    assert.strictEqual(modeReads, rejectedRead);
  });
}

test("SessionStart contains a dispatch failure after preparing both directories", async (t) => {
  // arrange
  const { root, projectRoot, sharedPaths } = await makeSessionStartFixture(t);
  const { pi, registrations, messages } = makeRecordingPi();
  const runtime = createHooksRuntime();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    executor: (entry) => {
      dispatched.push(entry.scope);
      return Promise.reject(new Error("stale dispatch capability"));
    },
  });

  // act
  const update = await registeredHandler(registrations, "session_start")(
    { type: "session_start", reason: "startup" },
    makeContext(projectRoot, root),
  );

  // assert
  assert.strictEqual(update, undefined);
  assert.deepStrictEqual(sharedPaths.map(fs.existsSync), [true, true]);
  assert.deepStrictEqual(dispatched, ["project", "user"]);
  assert.deepStrictEqual(messages, []);
});

test("SessionStart runs once when Pi repeats the same session start (SSDEDUP-01)", async (t) => {
  // arrange
  const { root, projectRoot } = await makeSessionStartFixture(t);
  const { pi, registrations } = makeRecordingPi();
  const runtime = createHooksRuntime();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    executor: (entry, event, ctx) => {
      dispatched.push(
        `${ctx.sessionManager.getSessionId()} ${JSON.stringify(event)} ${entry.scope}`,
      );
      return Promise.resolve({ kind: "noop" });
    },
  });
  const sessionStart = registeredHandler(registrations, "session_start");
  const context = makeContext(projectRoot, root);
  const otherSession = new Proxy(context, {
    get(target, property, receiver): unknown {
      return property === "sessionManager"
        ? SessionManager.inMemory(root, { id: "router-other-session" })
        : Reflect.get(target, property, receiver);
    },
  });
  const sessionId = context.sessionManager.getSessionId();

  // act
  await sessionStart({ type: "session_start", reason: "new" }, context);
  await sessionStart({ type: "session_start", reason: "new" }, context);
  await sessionStart({ type: "session_start", reason: "fork" }, context);
  await sessionStart({ type: "session_start", reason: "fork" }, otherSession);

  // assert
  assert.deepStrictEqual(dispatched, [
    `${sessionId} {"source":"clear"} project`,
    `${sessionId} {"source":"clear"} user`,
    `${sessionId} {"source":"fork"} project`,
    `${sessionId} {"source":"fork"} user`,
    'router-other-session {"source":"fork"} project',
    'router-other-session {"source":"fork"} user',
  ]);
});

for (const { reason, source } of [
  { reason: "startup", source: "startup" },
  { reason: "new", source: "clear" },
  { reason: "resume", source: "resume" },
  { reason: "fork", source: "fork" },
] as const) {
  test(`session_start dispatches SessionStart with source ${source} for Pi ${reason} (D-CF5-01)`, async (t) => {
    // arrange
    const { root, projectRoot } = await makeSessionStartFixture(t);
    const { pi, registrations } = makeRecordingPi();
    const runtime = createHooksRuntime();
    const dispatched: unknown[] = [];
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: projectRoot,
      executor: (entry, event) => {
        dispatched.push({ scope: entry.scope, event });
        return Promise.resolve({ kind: "noop" });
      },
    });

    // act
    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason },
      makeContext(projectRoot, root),
    );

    // assert
    assert.deepStrictEqual(dispatched, [
      { scope: "project", event: { source } },
      { scope: "user", event: { source } },
    ]);
  });
}

const LAUNCH_HEADER_TIME = "2026-11-14T10:00:00.000Z";

// A session Pi opened at `startup`: its header, the setting entries every
// launch writes, and a user message when the session continued one.
function launchSession(
  cwd: string,
  header: Pick<SessionHeader, "timestamp" | "parentSession">,
  holdsMessage: boolean,
): SessionManager {
  const sessionManager = SessionManager.inMemory(cwd, undefined, [
    { type: "session", version: 3, id: "router-launch-session", cwd, ...header },
  ]);
  sessionManager.appendModelChange("faux", "faux-1");
  sessionManager.appendThinkingLevelChange("off");
  if (holdsMessage) {
    sessionManager.appendMessage({ role: "user", content: "hello", timestamp: 0 });
  }

  return sessionManager;
}

// The router context with `sessionManager` in place of its in-memory one.
function withSessionManager(
  context: ExtensionContext,
  sessionManager: ExtensionContext["sessionManager"],
): ExtensionContext {
  return new Proxy(context, {
    get(target, property, receiver): unknown {
      return property === "sessionManager"
        ? sessionManager
        : Reflect.get(target, property, receiver);
    },
  });
}

// Registers the bridge with `processStartedAt` and returns its session_start
// handler and the scope and event of each SessionStart dispatch.
async function launchRouter(
  t: TestContext,
  processStartedAt: number,
): Promise<{
  readonly root: string;
  readonly projectRoot: string;
  readonly sessionStart: (...args: unknown[]) => unknown;
  readonly dispatched: readonly unknown[];
}> {
  const { root, projectRoot } = await makeSessionStartFixture(t);
  const { pi, registrations } = makeRecordingPi();
  const dispatched: unknown[] = [];
  await createHooksHydration(createHooksRuntime(), {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    processStartedAt,
    executor: (entry, event) => {
      dispatched.push({ scope: entry.scope, event });
      return Promise.resolve({ kind: "noop" });
    },
  });
  return {
    root,
    projectRoot,
    sessionStart: registeredHandler(registrations, "session_start"),
    dispatched,
  };
}

for (const { launch, header, holdsMessage, processStartedAt, source } of [
  {
    launch: "a new session that holds only its model and thinking level entries",
    header: { timestamp: LAUNCH_HEADER_TIME },
    holdsMessage: false,
    processStartedAt: 0,
    source: "startup",
  },
  {
    launch: "a session that holds a message",
    header: { timestamp: LAUNCH_HEADER_TIME },
    holdsMessage: true,
    processStartedAt: 0,
    source: "resume",
  },
  {
    launch: "a parent session and a header written at the process start",
    header: { timestamp: LAUNCH_HEADER_TIME, parentSession: "/sessions/parent.jsonl" },
    holdsMessage: true,
    processStartedAt: Date.parse(LAUNCH_HEADER_TIME),
    source: "fork",
  },
  {
    launch: "a parent session, a header older than the process, and a message",
    header: { timestamp: LAUNCH_HEADER_TIME, parentSession: "/sessions/parent.jsonl" },
    holdsMessage: true,
    processStartedAt: Date.parse(LAUNCH_HEADER_TIME) + 1,
    source: "resume",
  },
  {
    launch: "a parent session and a header timestamp that does not parse",
    header: { timestamp: "not a time", parentSession: "/sessions/parent.jsonl" },
    holdsMessage: false,
    processStartedAt: 0,
    source: "startup",
  },
] as const) {
  test(`session_start at Pi startup dispatches SessionStart with source ${source} for ${launch} (D-PG6-14, D-PG6-15)`, async (t) => {
    // arrange
    const { root, projectRoot, sessionStart, dispatched } = await launchRouter(t, processStartedAt);
    const context = withSessionManager(
      makeContext(projectRoot, root),
      launchSession(root, header, holdsMessage),
    );

    // act
    await sessionStart({ type: "session_start", reason: "startup" }, context);

    // assert
    assert.deepStrictEqual(dispatched, [
      { scope: "project", event: { source } },
      { scope: "user", event: { source } },
    ]);
  });
}

for (const read of ["getHeader", "getEntries"] as const) {
  test(`session_start at Pi startup debug-logs a ${read} that throws and dispatches SessionStart with source startup (NFR-2)`, async (t) => {
    // arrange
    const debugLines = observeRouterDebug(t);
    const { root, projectRoot, sessionStart, dispatched } = await launchRouter(t, 0);
    const sessionManager = new Proxy(launchSession(root, { timestamp: LAUNCH_HEADER_TIME }, true), {
      get(target, property, receiver): unknown {
        if (property === read) {
          return (): never => {
            throw new Error("session unreadable");
          };
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const context = withSessionManager(makeContext(projectRoot, root), sessionManager);

    // act
    const update = await sessionStart({ type: "session_start", reason: "startup" }, context);

    // assert
    assert.deepStrictEqual(
      { update, dispatched, debugLines: debugLines() },
      {
        update: undefined,
        dispatched: [
          { scope: "project", event: { source: "startup" } },
          { scope: "user", event: { source: "startup" } },
        ],
        debugLines: [
          "[hooks] session_start launch read failed, source stays startup: session unreadable",
        ],
      },
    );
  });
}

test("session_start at Pi startup dispatches a continued session once when Pi repeats its start (SSDEDUP-01)", async (t) => {
  // arrange
  const { root, projectRoot, sessionStart, dispatched } = await launchRouter(t, 0);
  const context = withSessionManager(
    makeContext(projectRoot, root),
    launchSession(root, { timestamp: LAUNCH_HEADER_TIME }, true),
  );

  // act
  await sessionStart({ type: "session_start", reason: "startup" }, context);
  await sessionStart({ type: "session_start", reason: "startup" }, context);

  // assert
  assert.deepStrictEqual(dispatched, [
    { scope: "project", event: { source: "resume" } },
    { scope: "user", event: { source: "resume" } },
  ]);
});

test(
  "session_start at Pi startup in a pi-subagents child reads no launch fact and runs no SessionStart (D-PG6-14)",
  { concurrency: false },
  async (t) => {
    // arrange
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const { root, projectRoot, sessionStart, dispatched } = await launchRouter(t, 0);
    const reads: string[] = [];
    const sessionManager = new Proxy(launchSession(root, { timestamp: LAUNCH_HEADER_TIME }, true), {
      get(target, property, receiver): unknown {
        if (property === "getEntries" || property === "getHeader") {
          reads.push(property);
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const context = withSessionManager(makeContext(projectRoot, root), sessionManager);
    process.env.PI_SUBAGENT_CHILD = "1";

    // act
    await sessionStart({ type: "session_start", reason: "startup" }, context);

    // assert
    assert.deepStrictEqual({ reads, dispatched }, { reads: [], dispatched: [] });
  },
);

test("session_start on Pi reload prepares the shared directories and runs no SessionStart (D-CF5-03)", async (t) => {
  // arrange
  const { root, projectRoot, sharedPaths } = await makeSessionStartFixture(t);
  const { pi, registrations, messages } = makeRecordingPi();
  const runtime = createHooksRuntime();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    executor: (entry) => {
      dispatched.push(entry.scope);
      return Promise.resolve({ kind: "noop" });
    },
  });

  // act
  const update = await registeredHandler(registrations, "session_start")(
    { type: "session_start", reason: "reload" },
    makeContext(projectRoot, root),
  );

  // assert
  assert.strictEqual(update, undefined);
  assert.deepStrictEqual(sharedPaths.map(fs.existsSync), [true, true]);
  assert.deepStrictEqual(
    runtime.getRoutingBucket("SessionStart").map((entry) => entry.scope),
    ["project", "user"],
  );
  assert.deepStrictEqual(dispatched, []);
  assert.deepStrictEqual(messages, []);
});

for (const { reason, mode, expectedReason } of [
  { reason: "new", mode: "print", expectedReason: "clear" },
  { reason: "resume", mode: "rpc", expectedReason: "resume" },
  { reason: "fork", mode: "json", expectedReason: "resume" },
  { reason: "quit", mode: "tui", expectedReason: "prompt_input_exit" },
  { reason: "quit", mode: "rpc", expectedReason: "other" },
] as const) {
  test(`session_shutdown dispatches SessionEnd with reason ${expectedReason} for Pi ${reason} in ${mode} mode (D-CF5-02)`, async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-session-end-");
    const runtime = createHooksRuntime();
    const { pi, registrations, messages } = makeRecordingPi();
    const dispatched: unknown[] = [];
    await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry, event) => {
        dispatched.push({ pluginId: entry.pluginId, event });
        return Promise.resolve({ kind: "noop" });
      },
    });
    runtime.setRoutingBucket("SessionEnd", [
      {
        ...preToolUseEntry("session-end-plugin", root),
        claudeEvent: "SessionEnd",
        matcher: parseMatcher(""),
        rawMatcher: "",
      },
    ]);
    const context = new Proxy(makeContext(root, root), {
      get(target, property, receiver): unknown {
        return property === "mode" ? mode : Reflect.get(target, property, receiver);
      },
    });

    // act
    const update = await registeredHandler(registrations, "session_shutdown")(
      { type: "session_shutdown", reason },
      context,
    );

    // assert
    assert.strictEqual(update, undefined);
    assert.deepStrictEqual(dispatched, [
      { pluginId: "session-end-plugin", event: { reason: expectedReason } },
    ]);
    assert.deepStrictEqual(messages, []);
  });
}

test("session_shutdown on Pi reload runs no SessionEnd (D-CF5-03)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-session-end-reload-");
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    },
  });
  runtime.setRoutingBucket("SessionEnd", [
    {
      ...preToolUseEntry("session-end-plugin", root),
      claudeEvent: "SessionEnd",
      matcher: parseMatcher(""),
      rawMatcher: "",
    },
  ]);

  // act
  const update = await registeredHandler(registrations, "session_shutdown")(
    { type: "session_shutdown", reason: "reload" },
    makeContext(root, root),
  );

  // assert
  assert.strictEqual(update, undefined);
  assert.deepStrictEqual(dispatched, []);
  assert.deepStrictEqual(messages, []);
});

test("SessionStart runs a repeat whose first event was skipped for its mode", async (t) => {
  // arrange
  const { root, projectRoot } = await makeSessionStartFixture(t);
  const { pi, registrations } = makeRecordingPi();
  const runtime = createHooksRuntime();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    executor: (entry) => {
      dispatched.push(entry.scope);
      return Promise.resolve({ kind: "noop" });
    },
  });
  const sessionStart = registeredHandler(registrations, "session_start");
  const context = makeContext(projectRoot, root);
  const unknownMode = new Proxy(context, {
    get(target, property, receiver): unknown {
      return property === "mode" ? "unknown" : Reflect.get(target, property, receiver);
    },
  });

  // act
  await sessionStart({ type: "session_start", reason: "new" }, unknownMode);
  await sessionStart({ type: "session_start", reason: "new" }, context);

  // assert
  assert.deepStrictEqual(dispatched, ["project", "user"]);
});

test(
  "session_start lazily hydrates project routes and sends their context when the hooks finish",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const { root } = await createHermeticEnvironment(t, "hooks-router-lazy-project-");
    const factoryRoot = path.join(root, "factory-cwd");
    const projectRoot = path.join(root, "actual-project");
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

    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: factoryRoot,
      executor,
    });
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
    const routes = runtime.getRoutingBucket("SessionStart").map((entry) => ({
      scope: entry.scope,
      pluginId: entry.pluginId,
      command: entry.handlerDecl.command,
    }));
    const cache = Array.from(runtime.parsedConfigEntries().values()).map((entry) => ({
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
    assert.deepStrictEqual(messages, [
      {
        message: {
          customType: "claude-hook-additional-context",
          content: [
            {
              type: "text",
              text: "SessionStart hook additional context: alpha context\nbeta context",
            },
          ],
          display: false,
          details: { event: "SessionStart", values: ["alpha context", "beta context"] },
        },
        options: { triggerTurn: false },
      },
    ]);
    assert.strictEqual(firstTurn, undefined);
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
  },
);

test("D-LOC-01 session_start in a project Pi does not trust runs no project SessionStart hook", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-untrusted-project-");
  const projectRoot = path.join(root, "project");
  const projectLocations = locationsFor("project", projectRoot);
  const hooksDirectory = path.join(projectLocations.hooksDir, "alpha-hooks");
  await mkdir(hooksDirectory, { recursive: true });
  await writeFile(
    path.join(hooksDirectory, "hooks.json"),
    JSON.stringify(makeConfig([{ event: "SessionStart", handlers: 1, prefix: "alpha" }])),
    "utf8",
  );
  await saveState(
    projectLocations.extensionRoot,
    makeScopeState({
      scope: "project",
      cwd: projectRoot,
      plugins: {
        alpha: makeStoredPlugin({
          root: path.join(root, "plugins", "alpha"),
          hooks: ["alpha-hooks"],
        }),
      },
    }),
  );
  const context = makeContext(projectRoot, root, false);
  const { pi, registrations } = makeRecordingPi();
  const dispatches: string[] = [];
  const executor: HookExecutor = (entry) => {
    dispatches.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: path.join(root, "factory-cwd"),
    executor,
  });
  const sessionStart = registeredHandler(registrations, "session_start");

  // act
  await sessionStart({ type: "session_start", reason: "startup" }, context);

  // assert
  assert.deepStrictEqual(dispatches, []);
  assert.deepStrictEqual(
    Array.from(runtime.parsedConfigEntries().values()).filter((entry) => entry.scope === "project"),
    [],
  );
});

test("session_start contains a lazy project cwd failure and still delegates safely", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root } = await createHermeticEnvironment(t, "hooks-router-lazy-failure-");
  const projectRoot = path.join(root, "project");
  let lazyCwdFails = false;
  const baseContext = makeContext(projectRoot, root);
  const context = new Proxy(baseContext, {
    get(target, property, receiver): unknown {
      if (property === "cwd" && lazyCwdFails) {
        throw new Error("project cwd unavailable");
      }

      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const { pi, registrations, messages } = makeRecordingPi();
  const dispatches: string[] = [];
  const executor: HookExecutor = (entry) => {
    dispatches.push(entry.pluginId);
    return Promise.resolve({ kind: "noop" });
  };

  await createHooksHydration(runtime, {
    loadState,
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  }).registerHooksBridge(pi, {
    cwd: projectRoot,
    executor,
  });
  const sessionStart = registeredHandler(registrations, "session_start");
  // The proxy makes every later read of `ctx.cwd` fail.
  lazyCwdFails = true;

  // act
  const sessionStartUpdate = await sessionStart(
    { type: "session_start", reason: "resume" },
    context,
  );

  // assert
  assert.strictEqual(sessionStartUpdate, undefined);
  assert.deepStrictEqual(dispatches, []);
  assert.deepStrictEqual(messages, []);
  assert.strictEqual(registrations.length, 15);
});

/** A manual compaction event whose entry carries `summary`. */
function compactionEvent(summary: string): SessionCompactEvent {
  return {
    type: "session_compact",
    compactionEntry: {
      type: "compaction",
      id: "router-compaction",
      parentId: "router-parent",
      timestamp: "2026-11-01T10:00:00.000Z",
      summary,
      firstKeptEntryId: "router-kept",
      tokensBefore: 128,
    },
    fromExtension: false,
    reason: "manual",
    willRetry: false,
  };
}

/** Routes one SessionStart and one PostCompact entry of the project scope. */
function routeCompactionHooks(runtime: HooksRuntime, cwd: string): void {
  for (const claudeEvent of ["SessionStart", "PostCompact"] as const) {
    runtime.setRoutingBucket(claudeEvent, [
      {
        ...preToolUseEntry(`${claudeEvent.toLowerCase()}-plugin`, cwd),
        claudeEvent,
        matcher: parseMatcher(""),
        rawMatcher: "",
      },
    ]);
  }
}

// Whether `value` is the compaction leg's delivery hint (HKRL-03).
function isDeliveryHint(value: unknown): value is () => boolean {
  return typeof value === "function";
}

// The event a hook reads, with the compaction leg's delivery hint answered
// (HKRL-03), so a log of it compares as data.
function withDeliveryHintRead(event: unknown): unknown {
  return typeof event === "object" &&
    event !== null &&
    "nextCallReadsSteer" in event &&
    isDeliveryHint(event.nextCallReadsSteer)
    ? { ...event, nextCallReadsSteer: event.nextCallReadsSteer() }
    : event;
}

test("session_compact runs SessionStart with source compact to completion, then PostCompact (D-CF5-04)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-");
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const log: unknown[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: async (entry, event) => {
      log.push({ start: entry.claudeEvent, event: withDeliveryHintRead(event) });
      await new Promise((resolve) => setImmediate(resolve));
      log.push({ end: entry.claudeEvent });
      return { kind: "noop" };
    },
  });
  routeCompactionHooks(runtime, root);
  const event = compactionEvent("router summary");

  // act
  const update = await registeredHandler(registrations, "session_compact")(
    event,
    makeContext(root, root),
  );

  // assert
  assert.strictEqual(update, undefined);
  assert.deepStrictEqual(log, [
    { start: "SessionStart", event: { source: "compact", nextCallReadsSteer: false } },
    { end: "SessionStart" },
    { start: "PostCompact", event },
    { end: "PostCompact" },
  ]);
  assert.strictEqual(
    fs.existsSync(path.join(locationsFor("project", root).dataRoot, "_shared")),
    true,
  );
  assert.deepStrictEqual(messages, []);
});

test("a second session_compact in one session runs SessionStart compact again (D-CF5-05)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-repeat-");
  const runtime = createHooksRuntime();
  const { pi, registrations } = makeRecordingPi();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.claudeEvent);
      return Promise.resolve({ kind: "noop" });
    },
  });
  routeCompactionHooks(runtime, root);
  const sessionCompact = registeredHandler(registrations, "session_compact");
  const context = makeContext(root, root);

  // act
  await sessionCompact(compactionEvent("first summary"), context);
  await sessionCompact(compactionEvent("second summary"), context);

  // assert
  assert.deepStrictEqual(dispatched, [
    "SessionStart",
    "PostCompact",
    "SessionStart",
    "PostCompact",
  ]);
});

test("session_compact debug-logs a failed SessionStart and still runs PostCompact (NFR-2)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-failure-");
  const readDiagnostics = observeRouterDebug(t);
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.claudeEvent);
      return entry.claudeEvent === "SessionStart"
        ? Promise.reject(new Error("session start capability lost"))
        : Promise.resolve({ kind: "noop" });
    },
  });
  routeCompactionHooks(runtime, root);

  // act
  const update = await registeredHandler(registrations, "session_compact")(
    compactionEvent("failure summary"),
    makeContext(root, root),
  );

  // assert
  assert.strictEqual(update, undefined);
  assert.deepStrictEqual(dispatched, ["SessionStart", "PostCompact"]);
  assert.deepStrictEqual(
    readDiagnostics().filter((line) => line.includes("session_compact")),
    ["[hooks] session_compact SessionStart skipped: session start capability lost"],
  );
  assert.deepStrictEqual(messages, []);
});

test("session_compact runs no PostCompact once the compaction SessionStart went stale", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-stale-");
  const runtime = createHooksRuntime();
  const { pi, registrations } = makeRecordingPi();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.claudeEvent);
      runtime.advanceGeneration();
      return Promise.resolve({ kind: "noop" });
    },
  });
  routeCompactionHooks(runtime, root);

  // act
  await registeredHandler(registrations, "session_compact")(
    compactionEvent("stale summary"),
    makeContext(root, root),
  );

  // assert
  assert.deepStrictEqual(dispatched, ["SessionStart"]);
});

test("session_compact dispatches nothing when the generation goes stale while it prepares the shared directory", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-prepare-");
  const runtime = createHooksRuntime();
  const { pi, registrations } = makeRecordingPi();
  const dispatched: string[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.claudeEvent);
      return Promise.resolve({ kind: "noop" });
    },
  });
  routeCompactionHooks(runtime, root);
  let modeReads = 0;
  const context = new Proxy(makeContext(root, root), {
    get(target, property, receiver): unknown {
      if (property === "mode") {
        modeReads += 1;
        if (modeReads === 2) {
          runtime.advanceGeneration();
        }
      }

      return Reflect.get(target, property, receiver);
    },
  });

  // act
  await registeredHandler(registrations, "session_compact")(
    compactionEvent("prepare summary"),
    context,
  );

  // assert
  assert.deepStrictEqual(dispatched, []);
  assert.strictEqual(
    fs.existsSync(path.join(locationsFor("project", root).dataRoot, "_shared")),
    true,
  );
});

// A reply that ends its turn with a tool call, so Pi calls the model again
// for the tool results.
const TOOL_CALL_REPLY = {
  role: "assistant",
  content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: {} }],
  stopReason: "toolUse",
} as const;

// A reply that ends its turn with text, so the run reads a queued follow-up.
const TEXT_REPLY = {
  role: "assistant",
  content: [{ type: "text", text: "Done." }],
  stopReason: "stop",
} as const;

// A reply that a context overflow ended, so Pi ends the run and may retry it.
const OVERFLOW_REPLY = {
  role: "assistant",
  content: [],
  stopReason: "error",
} as const;

// A queued user message with `text`, as Pi queues a steer or a follow-up.
function queuedUserMessage(text: string): unknown {
  return { role: "user", content: [{ type: "text", text }] };
}

/** The Pi events of an agent run that come before a compaction in a delivery row. */
const RUN_EVENTS = {
  turn_start: { type: "turn_start" },
  turn_end: { type: "turn_end", message: TEXT_REPLY, context: { pendingMessages: [] } },
  turn_end_with_queued_message: {
    type: "turn_end",
    message: TEXT_REPLY,
    context: { pendingMessages: [queuedUserMessage("queued prompt")] },
  },
  turn_end_with_queued_follow_up: {
    type: "turn_end",
    message: TEXT_REPLY,
    context: { pendingMessages: [queuedUserMessage("also say hi")] },
  },
  turn_end_with_hook_context: {
    type: "turn_end",
    message: TEXT_REPLY,
    context: {
      pendingMessages: [
        {
          role: "custom",
          customType: "claude-hook-additional-context",
          content: [{ type: "text", text: "UserPromptSubmit hook additional context: held" }],
          display: false,
        },
      ],
    },
  },
  tool_turn_end_with_tool_context: {
    type: "turn_end",
    message: TOOL_CALL_REPLY,
    context: {
      pendingMessages: [
        {
          role: "custom",
          customType: "claude-hook-tool-context",
          content: "PostToolUse:Bash hook additional context: checked",
          display: false,
        },
      ],
    },
  },
  tool_turn_end_with_other_message: {
    type: "turn_end",
    message: TOOL_CALL_REPLY,
    context: {
      pendingMessages: [
        { role: "custom", customType: "other-extension-context", content: "x", display: false },
      ],
    },
  },
  tool_turn_end_with_queued_follow_up: {
    type: "turn_end",
    message: TOOL_CALL_REPLY,
    context: { pendingMessages: [queuedUserMessage("also say hi")] },
  },
  tool_turn_end_with_two_queued_follow_ups: {
    type: "turn_end",
    message: TOOL_CALL_REPLY,
    context: {
      pendingMessages: [queuedUserMessage("also say hi"), queuedUserMessage("also say hi")],
    },
  },
  overflow_turn_end: {
    type: "turn_end",
    message: OVERFLOW_REPLY,
    context: { pendingMessages: [] },
  },
  overflow_turn_end_with_queued_message: {
    type: "turn_end",
    message: OVERFLOW_REPLY,
    context: { pendingMessages: [queuedUserMessage("queued prompt")] },
  },
  overflow_turn_end_with_queued_follow_up: {
    type: "turn_end",
    message: OVERFLOW_REPLY,
    context: { pendingMessages: [queuedUserMessage("also say hi")] },
  },
  follow_up_input: {
    type: "input",
    text: "also say hi",
    source: "interactive",
    streamingBehavior: "followUp",
  },
  steer_input: {
    type: "input",
    text: "also say hi",
    source: "interactive",
    streamingBehavior: "steer",
  },
  agent_end: { type: "agent_end", messages: [] },
} as const;

// The handler of a run event of a delivery row: an input goes to the bridge's
// last `input` subscription, which tells the run phase what Pi queues.
function runEventHandler(
  registrations: readonly RecordedRegistration[],
  runEvent: keyof typeof RUN_EVENTS,
): (...args: unknown[]) => unknown {
  const { type } = RUN_EVENTS[runEvent];
  return registeredHandler(registrations, type, type === "input" ? 2 : 0);
}

for (const { title, before, queuedAtRunEnd = false, reason, willRetry, options } of [
  {
    title:
      "steers the SessionStart context of an overflow compaction into the retried model call (HKRL-03)",
    before: ["overflow_turn_end", "agent_end"],
    reason: "overflow",
    willRetry: true,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of an overflow compaction while a queued message waits ahead of the retry (HKRL-03)",
    before: ["overflow_turn_end_with_queued_message", "agent_end"],
    reason: "overflow",
    willRetry: true,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of an overflow compaction while only a follow-up waits (HKRL-03)",
    before: ["follow_up_input", "overflow_turn_end_with_queued_follow_up", "agent_end"],
    reason: "overflow",
    willRetry: true,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of an overflow compaction after the user steers the run (HKRL-03)",
    before: ["overflow_turn_end", "agent_end", "steer_input"],
    reason: "overflow",
    willRetry: true,
    options: { triggerTurn: false },
  },
  {
    title: "holds the SessionStart context of a manual compaction for the next prompt (HKRL-03)",
    before: [],
    reason: "manual",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of a compaction between two turns into the next model call (HKRL-03)",
    before: ["turn_end"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of a compaction before a queued message's turn to that turn's end (HKRL-03)",
    before: ["turn_end_with_queued_message"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "holds the SessionStart context of a compaction before a queued follow-up's turn to that turn's end (HKRL-03)",
    before: ["follow_up_input", "turn_end_with_queued_follow_up"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of a compaction after a turn whose held hook context Pi appends at the turn end (HKRL-03)",
    before: ["turn_end_with_hook_context"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "steers the SessionStart context of a compaction after a tool call whose held tool context Pi appends at the turn end (HKRL-03)",
    before: ["tool_turn_end_with_tool_context"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of a compaction after a tool call while another extension's message waits (HKRL-03)",
    before: ["tool_turn_end_with_other_message"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of a compaction after a tool call while a follow-up waits, as the tool results take the next call (HKRL-03)",
    before: ["follow_up_input", "tool_turn_end_with_queued_follow_up"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of a compaction after a tool call while a message that no follow-up input gave waits (HKRL-03)",
    before: ["tool_turn_end_with_queued_follow_up"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "holds the SessionStart context of a compaction after a tool call while more queued messages wait than follow-up inputs gave (HKRL-03)",
    before: ["follow_up_input", "tool_turn_end_with_two_queued_follow_ups"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of a compaction after a tool call while two follow-ups wait (HKRL-03)",
    before: ["follow_up_input", "follow_up_input", "tool_turn_end_with_two_queued_follow_ups"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "keeps a follow-up waiting after a tool call, so a compaction after the next tool call steers the SessionStart context (HKRL-03)",
    before: [
      "follow_up_input",
      "tool_turn_end_with_queued_follow_up",
      "tool_turn_end_with_queued_follow_up",
    ],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "counts a follow-up the run read as gone, so the same text queued later holds the SessionStart context (HKRL-03)",
    before: [
      "follow_up_input",
      "turn_end_with_queued_follow_up",
      "tool_turn_end_with_queued_follow_up",
    ],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "forgets the follow-up inputs of a run that ended with nothing queued, so the same text queued later holds the SessionStart context (HKRL-03)",
    before: ["follow_up_input", "agent_end", "tool_turn_end_with_queued_follow_up"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "keeps the follow-up inputs of a failed run that leaves them queued, so a compaction after a tool call of the retried run steers the SessionStart context (HKRL-03)",
    before: [
      "follow_up_input",
      "overflow_turn_end_with_queued_follow_up",
      "agent_end",
      "tool_turn_end_with_queued_follow_up",
    ],
    queuedAtRunEnd: true,
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of a compaction between two turns after the user steers the run (HKRL-03)",
    before: ["turn_end", "steer_input"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "steers the SessionStart context of a compaction between two turns after the user queues a follow-up (HKRL-03)",
    before: ["turn_end", "follow_up_input"],
    reason: "threshold",
    willRetry: false,
    options: { deliverAs: "steer" },
  },
  {
    title:
      "holds the SessionStart context of a compaction after the run ended for the next prompt (HKRL-03)",
    before: ["turn_end", "agent_end"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
  {
    title:
      "holds the SessionStart context of a compaction during a model call to the turn end (HKRL-03)",
    before: ["turn_end", "turn_start"],
    reason: "threshold",
    willRetry: false,
    options: { triggerTurn: false },
  },
] satisfies ReadonlyArray<{
  readonly title: string;
  readonly before: ReadonlyArray<keyof typeof RUN_EVENTS>;
  readonly queuedAtRunEnd?: boolean;
  readonly reason: SessionCompactEvent["reason"];
  readonly willRetry: boolean;
  readonly options: unknown;
}>) {
  test(title, async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-delivery-");
    const runtime = createHooksRuntime();
    const { pi, registrations, messages } = makeRecordingPi();
    await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry) =>
        Promise.resolve(
          entry.claudeEvent === "SessionStart"
            ? { kind: "mutate", additionalContext: "compact context" }
            : { kind: "noop" },
        ),
    });
    routeCompactionHooks(runtime, root);
    const context = makeContext(root, root, true, [], queuedAtRunEnd);
    for (const runEvent of before) {
      await runEventHandler(registrations, runEvent)(RUN_EVENTS[runEvent], context);
    }

    // act
    await registeredHandler(registrations, "session_compact")(
      { ...compactionEvent("delivery summary"), reason, willRetry },
      context,
    );

    // assert
    assert.deepStrictEqual(messages, [
      {
        message: {
          customType: "claude-hook-additional-context",
          content: [
            { type: "text", text: "SessionStart hook additional context: compact context" },
          ],
          display: false,
          details: { event: "SessionStart", values: ["compact context"] },
        },
        options,
      },
    ]);
  });
}

test("holds the SessionStart context of a compaction between two turns when the user steers while the hook runs (HKRL-03)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-late-steer-");
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const context = makeContext(root, root);
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: async (entry) => {
      if (entry.claudeEvent !== "SessionStart") {
        return { kind: "noop" };
      }

      await runEventHandler(registrations, "steer_input")(RUN_EVENTS.steer_input, context);
      return { kind: "mutate", additionalContext: "compact context" };
    },
  });
  routeCompactionHooks(runtime, root);
  await runEventHandler(registrations, "turn_end")(RUN_EVENTS.turn_end, context);

  // act
  await registeredHandler(registrations, "session_compact")(
    { ...compactionEvent("late steer summary"), reason: "threshold" },
    context,
  );

  // assert
  assert.deepStrictEqual(messages, [
    {
      message: {
        customType: "claude-hook-additional-context",
        content: [{ type: "text", text: "SessionStart hook additional context: compact context" }],
        display: false,
        details: { event: "SessionStart", values: ["compact context"] },
      },
      options: { triggerTurn: false },
    },
  ]);
});

test("starts a new registration's run idle, so its compaction holds the SessionStart context (HKRL-03)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-compaction-reregister-");
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const hydration = createHooksHydration(runtime, EMPTY_STATE_READER);
  const options = {
    cwd: root,
    executor: (entry: RoutingEntry) =>
      Promise.resolve(
        entry.claudeEvent === "SessionStart"
          ? ({ kind: "mutate", additionalContext: "compact context" } as const)
          : ({ kind: "noop" } as const),
      ),
  };
  await hydration.registerHooksBridge(pi, options);
  const context = makeContext(root, root);
  await registeredHandler(registrations, "turn_end")(RUN_EVENTS.turn_end, context);
  await hydration.registerHooksBridge(pi, options);
  routeCompactionHooks(runtime, root);

  // act
  await registeredHandler(
    registrations,
    "session_compact",
    1,
  )({ ...compactionEvent("reregistered summary"), reason: "threshold" }, context);

  // assert
  assert.deepStrictEqual(messages, [
    {
      message: {
        customType: "claude-hook-additional-context",
        content: [{ type: "text", text: "SessionStart hook additional context: compact context" }],
        display: false,
        details: { event: "SessionStart", values: ["compact context"] },
      },
      options: { triggerTurn: false },
    },
  ]);
});

/** Collects the OBS-01 debug lines a case emits, restoring the flag afterwards. */
function observeRouterDebug(t: TestContext): () => string[] {
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (diagnostic: unknown) => {
    diagnostics.push(String(diagnostic));
  });
  return () => [...diagnostics];
}

for (const { claudeEvent, event } of [
  { claudeEvent: "SessionEnd", event: { type: "session_shutdown", reason: "quit" } },
  { claudeEvent: "PreCompact", event: { type: "session_before_compact", reason: "manual" } },
  { claudeEvent: "PostCompact", event: { type: "session_compact", reason: "manual" } },
  {
    claudeEvent: "UserPromptSubmit",
    event: { type: "input", text: "hello", source: "interactive" },
  },
  {
    claudeEvent: "PreToolUse",
    event: { type: "tool_call", toolCallId: "mode-call", toolName: "bash", input: {} },
  },
  {
    claudeEvent: "PostToolUse",
    event: {
      type: "tool_result",
      toolCallId: "mode-call",
      toolName: "bash",
      input: {},
      content: [],
      isError: false,
    },
  },
  {
    claudeEvent: "PostToolUseFailure",
    event: {
      type: "tool_result",
      toolCallId: "mode-call",
      toolName: "bash",
      input: {},
      content: [],
      isError: true,
    },
  },
] as const) {
  for (const { failure, readRejectedMode } of [
    { failure: "unknown mode", readRejectedMode: (): string => "unknown" },
    {
      failure: "throwing mode getter",
      readRejectedMode: (): string => {
        throw new Error("stale mode");
      },
    },
  ]) {
    test(`rejects fresh ${claudeEvent} hooks after startup rejects a ${failure}`, async (t) => {
      // arrange
      const { root } = await createHermeticEnvironment(t, "hooks-router-mode-");
      const runtime = createHooksRuntime();
      const { pi, registrations, messages } = makeRecordingPi();
      const dispatches: BucketAEvent[] = [];
      const executor: HookExecutor = (entry) => {
        dispatches.push(entry.claudeEvent);
        return Promise.resolve({ kind: "noop" });
      };

      const context = new Proxy(makeContext(root, root), {
        get(target, property, receiver): unknown {
          if (property === "mode") {
            return readRejectedMode();
          }

          return Reflect.get(target, property, receiver);
        },
      });
      await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
        cwd: root,
        executor,
      });
      const entry: RoutingEntry = {
        ...preToolUseEntry("mode-plugin", root),
        claudeEvent,
        matcher: parseMatcher(""),
        rawMatcher: "",
      };
      runtime.setRoutingBucket(claudeEvent, [entry]);

      // act
      await registeredHandler(registrations, "session_start")(
        { type: "session_start", reason: "startup" },
        context,
      );
      const hookOutput = await registeredHandler(registrations, event.type)(event, context);

      // assert
      assert.strictEqual(hookOutput, undefined);
      assert.deepStrictEqual(runtime.getRoutingBucket(claudeEvent), [entry]);
      assert.deepStrictEqual(messages, []);
      assert.deepStrictEqual(dispatches, []);
    });

    for (const mode of ["tui", "print", "json", "rpc"]) {
      test(`dispatches ${claudeEvent} in ${mode} then rejects a live ${failure}`, async (t) => {
        // arrange
        const { root } = await createHermeticEnvironment(t, "hooks-router-live-mode-");
        const runtime = createHooksRuntime();
        const { pi, registrations, messages } = makeRecordingPi();
        const dispatches: BucketAEvent[] = [];
        const executor: HookExecutor = (entry) => {
          dispatches.push(entry.claudeEvent);
          return Promise.resolve({ kind: "noop" });
        };

        let readMode = (): string => mode;
        const context = new Proxy(makeContext(root, root), {
          get(target, property, receiver): unknown {
            if (property === "mode") {
              return readMode();
            }

            return Reflect.get(target, property, receiver);
          },
        });
        await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
          cwd: root,
          executor,
        });
        await registeredHandler(registrations, "session_start")(
          { type: "session_start", reason: "startup" },
          context,
        );
        const entry: RoutingEntry = {
          ...preToolUseEntry("mode-plugin", root),
          claudeEvent,
          matcher: parseMatcher(""),
          rawMatcher: "",
        };
        runtime.setRoutingBucket(claudeEvent, [entry]);
        const handler = registeredHandler(registrations, event.type);

        // act
        const supportedOutput = await handler(event, context);
        readMode = readRejectedMode;
        const rejectedOutput = await handler(event, context);

        // assert
        assert.deepStrictEqual([supportedOutput, rejectedOutput], [undefined, undefined]);
        assert.deepStrictEqual(runtime.getRoutingBucket(claudeEvent), [entry]);
        assert.deepStrictEqual(messages, []);
        assert.deepStrictEqual(dispatches, [claudeEvent]);
      });
    }
  }
}

function preToolUseEntry(pluginId: string, cwd: string): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId,
    resolvedSource: asAbsolutePluginRoot(path.join(cwd, pluginId)),
    claudeEvent: "PreToolUse",
    matcher: parseMatcher("Bash"),
    rawMatcher: "Bash",
    handlerDecl: { type: "command", command: `run-${pluginId}` },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
    options: resolveOptions(undefined),
  };
}

/**
 * A tool call whose `input` accessor refuses. The bridge's own default
 * executor reads `input` while translating and announces the refusal through
 * OBS-01 before it reaches the process boundary, so a case can tell the
 * default apart from a supplied executor by an observed line rather than by an
 * absence.
 */
function refusingToolCall(): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "executor-seam-call",
    toolName: "bash",
    get input(): never {
      throw new Error("executor seam input refused");
    },
  } satisfies ToolCallEvent;
}

test(
  "registerHooksBridge routes through a supplied executor and through its own default without one",
  { concurrency: false },
  async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-executor-seam-");
    const readDiagnostics = observeRouterDebug(t);
    const suppliedRuntime = createHooksRuntime();
    const defaultedRuntime = createHooksRuntime();
    const suppliedPi = makeRecordingPi();
    const defaultedPi = makeRecordingPi();
    const dispatched: string[] = [];
    const executor: HookExecutor = (entry) => {
      dispatched.push(entry.pluginId);
      return Promise.resolve({ kind: "noop" });
    };

    const suppliedCwd = path.join(root, "supplied");
    const defaultedCwd = path.join(root, "defaulted");
    await createHooksHydration(suppliedRuntime, EMPTY_STATE_READER).registerHooksBridge(
      suppliedPi.pi,
      { cwd: suppliedCwd, executor },
    );
    await createHooksHydration(defaultedRuntime, EMPTY_STATE_READER).registerHooksBridge(
      defaultedPi.pi,
      { cwd: defaultedCwd },
    );
    suppliedRuntime.setRoutingBucket("PreToolUse", [
      preToolUseEntry("supplied-executor-plugin", suppliedCwd),
    ]);
    defaultedRuntime.setRoutingBucket("PreToolUse", [
      preToolUseEntry("defaulted-executor-plugin", defaultedCwd),
    ]);
    const registrationDiagnostics = readDiagnostics().length;

    // act
    const suppliedOutput = await registeredHandler(suppliedPi.registrations, "tool_call")(
      refusingToolCall(),
      makeContext(suppliedCwd, root),
    );
    const afterSupplied = readDiagnostics().slice(registrationDiagnostics);
    const notices: string[] = [];
    const defaultedOutput = await registeredHandler(defaultedPi.registrations, "tool_call")(
      refusingToolCall(),
      makeContext(defaultedCwd, root, true, notices),
    );
    const afterDefaulted = readDiagnostics()
      .slice(registrationDiagnostics + afterSupplied.length)
      .filter((diagnostic) => diagnostic.startsWith("[hooks]"));

    // assert
    assert.deepStrictEqual([suppliedOutput, defaultedOutput], [undefined, undefined]);
    assert.deepStrictEqual(dispatched, ["supplied-executor-plugin"]);
    assert.deepStrictEqual(afterSupplied, []);
    assert.deepStrictEqual(afterDefaulted, [
      "[hooks] exec: caught (defaulted-executor-plugin/PreToolUse): executor seam input refused",
    ]);
    assert.equal(notices.length, 1);
    assert.match(notices[0] ?? "", /executor seam input refused/);
    assert.deepStrictEqual(suppliedPi.messages, []);
    assert.deepStrictEqual(defaultedPi.messages, []);
  },
);

test("propagates a rejecting supplied executor out of the registered tool_call callback", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-executor-refusal-");
  const runtime = createHooksRuntime();
  const { pi, registrations, messages } = makeRecordingPi();
  const cwd = path.join(root, "project");
  // The never-throws contract belongs to the default this seam falls back to.
  // A caller that substitutes a rejecting executor leaves that contract, and
  // the registered callback surfaces the refusal instead of hiding it.
  const executor: HookExecutor = () => Promise.reject(new Error("supplied executor refused"));
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd,
    executor,
  });
  runtime.setRoutingBucket("PreToolUse", [preToolUseEntry("refusing-executor-plugin", cwd)]);
  const toolCall = {
    type: "tool_call",
    toolCallId: "executor-refusal-call",
    toolName: "bash",
    input: { command: "printf refused" },
  } satisfies ToolCallEvent;

  // act & assert
  await assert.rejects(
    Promise.resolve(
      registeredHandler(registrations, "tool_call")(toolCall, makeContext(cwd, root)),
    ),
    { message: "supplied executor refused" },
  );
  assert.deepStrictEqual(messages, []);
});

for (const trusted of [true, false]) {
  test(`a project hydrate with trust ${String(trusted)} reaps only a trusted project PID table`, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "event-router-project-reap-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const runtime = createHooksRuntime();
    const locations = locationsFor("project", root);
    const deadRow = {
      pid: 4_194_305,
      dispatchId: "dispatch-dead",
      scope: "project",
      marketplace: "catalog",
      plugin: "plugin",
      spawnedAt: "2026-11-08T00:00:00.000Z",
    } as const;
    await writePidTable(locations, [deadRow]);

    // act
    await createHooksHydration(runtime, EMPTY_STATE_READER).hydrateProjectScopeForCwd(
      root,
      trusted,
    );

    // assert
    assert.deepStrictEqual(await readPidTable(locations), trusted ? [] : [deadRow]);
  });
}

test("child input does not dispatch a UserPromptSubmit hook", { concurrency: false }, async (t) => {
  const { root } = await createHermeticEnvironment(t, "hooks-router-child-input-");
  const previous = process.env.PI_SUBAGENT_CHILD;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.PI_SUBAGENT_CHILD;
    } else {
      process.env.PI_SUBAGENT_CHILD = previous;
    }
  });
  const runtime = createHooksRuntime();
  const { pi, registrations } = makeRecordingPi();
  const dispatched: BucketAEvent[] = [];
  await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
    cwd: root,
    executor: (entry) => {
      dispatched.push(entry.claudeEvent);
      return Promise.resolve({ kind: "noop" });
    },
  });
  runtime.setRoutingBucket("UserPromptSubmit", [
    { ...preToolUseEntry("child-input", root), claudeEvent: "UserPromptSubmit" },
  ]);
  process.env.PI_SUBAGENT_CHILD = "1";

  await registeredHandler(registrations, "input")(
    { type: "input", text: "hello", source: "interactive" },
    makeContext(root, root),
  );

  assert.deepStrictEqual(dispatched, []);
});

test(
  "a child's boundary handler runs no Stop hook and leaves the cached ending (D-PG5-01)",
  { concurrency: false },
  async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-child-boundary-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const runtime = createHooksRuntime();
    const { pi, registrations, messages } = makeRecordingPi();
    const dispatched: BucketAEvent[] = [];
    await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry) => {
        dispatched.push(entry.claudeEvent);
        return Promise.resolve({ kind: "block", reason: "continue" });
      },
    });
    runtime.setRoutingBucket("Stop", [
      {
        ...preToolUseEntry("child-stop", root),
        claudeEvent: "Stop",
        matcher: parseMatcher(""),
        rawMatcher: "",
      },
    ]);
    const ending: AssistantMessage = { ...assistantForBookkeeping(), stopReason: "stop" };
    runtime.recordLastAssistant(ending);
    process.env.PI_SUBAGENT_CHILD = "1";

    // act
    const boundaryResult = await registeredHandler(registrations, "agent_before_settle")(
      { type: "agent_before_settle", entries: [], continue: false, outcome: "completed" },
      makeContext(root, root),
    );

    // assert
    assert.strictEqual(boundaryResult, undefined);
    assert.deepStrictEqual(dispatched, []);
    assert.strictEqual(runtime.takeLastAssistant(), ending);
    assert.deepStrictEqual(messages, []);
  },
);

// D-PG6-18: no registration dispatches UserPromptExpansion yet, in any session.
function policyRuns(claudeEvent: BucketAEvent, child: boolean): BucketAEvent[] {
  if (child) {
    return (["PreToolUse", "PostToolUse", "PostToolUseFailure"] as BucketAEvent[]).includes(
      claudeEvent,
    )
      ? [claudeEvent]
      : [];
  }

  return claudeEvent === "PostCompact" ? ["SessionStart", "PostCompact"] : [claudeEvent];
}

for (const child of [false, true]) {
  for (const claudeEvent of BUCKET_A_EVENTS) {
    test(
      `${child ? "child" : "main"} routes ${claudeEvent} by the eleven-event policy`,
      { concurrency: false },
      async (t) => {
        const { root } = await createHermeticEnvironment(t, "hooks-router-event-policy-");
        const previous = process.env.PI_SUBAGENT_CHILD;
        t.after(() => {
          if (previous === undefined) {
            delete process.env.PI_SUBAGENT_CHILD;
          } else {
            process.env.PI_SUBAGENT_CHILD = previous;
          }
        });
        const runtime = createHooksRuntime();
        const { pi, registrations, messages } = makeRecordingPi();
        const dispatched: BucketAEvent[] = [];
        await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
          cwd: root,
          executor: (entry) => {
            dispatched.push(entry.claudeEvent);
            return Promise.resolve({ kind: "noop" });
          },
          resolveTypedExpansion: () =>
            Promise.resolve({ commandName: "demo:deploy", commandArgs: "staging" }),
        });
        const entry: RoutingEntry = {
          ...preToolUseEntry("policy-plugin", root),
          scope: "user",
          claudeEvent,
          matcher: parseMatcher(""),
          rawMatcher: "",
        };
        runtime.setRoutingBucket(claudeEvent, [entry]);
        if (claudeEvent === "SessionStart") {
          seedPluginConfig(
            runtime,
            "user",
            "catalog",
            "policy-plugin",
            entry.resolvedSource,
            makeConfig([{ event: "SessionStart", handlers: 1 }]),
            new Map(),
          );
        }

        if (claudeEvent === "PostCompact") {
          runtime.setRoutingBucket("SessionStart", [{ ...entry, claudeEvent: "SessionStart" }]);
        }

        process.env.PI_SUBAGENT_CHILD = child ? "1" : "0";
        const context = makeContext(root, root);
        switch (claudeEvent) {
          case "SessionStart":
            await registeredHandler(registrations, "session_start")(
              { type: "session_start", reason: "new" },
              context,
            );
            break;
          case "UserPromptSubmit":
            await registeredHandler(registrations, "input")(
              { type: "input", text: "hello", source: "interactive" },
              context,
            );
            break;
          case "UserPromptExpansion":
            await registeredHandler(
              registrations,
              "input",
              1,
            )({ type: "input", text: "/demo:deploy staging", source: "interactive" }, context);
            break;
          case "PreToolUse":
            await registeredHandler(registrations, "tool_call")(
              { type: "tool_call", toolCallId: "policy-call", toolName: "bash", input: {} },
              context,
            );
            break;
          case "PostToolUse":
          case "PostToolUseFailure":
            await registeredHandler(registrations, "tool_result")(
              {
                type: "tool_result",
                toolCallId: "policy-call",
                toolName: "bash",
                input: {},
                content: [],
                isError: claudeEvent === "PostToolUseFailure",
              },
              context,
            );
            break;
          case "PreCompact":
            await registeredHandler(registrations, "session_before_compact")(
              { type: "session_before_compact", reason: "manual" },
              context,
            );
            break;
          case "PostCompact":
            await registeredHandler(registrations, "session_compact")(
              compactionEvent("policy summary"),
              context,
            );
            break;
          case "SessionEnd":
            await registeredHandler(registrations, "session_shutdown")(
              { type: "session_shutdown", reason: "quit" },
              context,
            );
            break;
          case "Stop":
          case "StopFailure":
            await registeredHandler(registrations, "agent_end")(
              {
                type: "agent_end",
                messages: [
                  {
                    ...assistantForBookkeeping(),
                    stopReason: claudeEvent === "Stop" ? "stop" : "error",
                  },
                ],
              },
              context,
            );
            await registeredHandler(registrations, "agent_before_settle")(
              { type: "agent_before_settle", entries: [], continue: false, outcome: "completed" },
              context,
            );
            await registeredHandler(registrations, "agent_settled")(
              { type: "agent_settled" },
              context,
            );
            break;
        }

        assert.deepStrictEqual(dispatched, policyRuns(claudeEvent, child));
        assert.deepStrictEqual(messages, []);
      },
    );
  }
}

test(
  "child hydrates user tool hooks without executing untrusted project hooks",
  { concurrency: false },
  async (t) => {
    const { root } = await createHermeticEnvironment(t, "hooks-router-child-trust-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    for (const scope of ["user", "project"] as const) {
      const loc = locationsFor(scope, root);
      const hooksDirectory = path.join(loc.hooksDir, `${scope}-hooks`);
      await mkdir(hooksDirectory, { recursive: true });
      await writeFile(
        path.join(hooksDirectory, "hooks.json"),
        JSON.stringify(makeConfig([{ event: "PreToolUse", matcher: "Bash", handlers: 1 }])),
      );
      await saveState(
        loc.extensionRoot,
        makeScopeState({
          scope,
          cwd: root,
          plugins: {
            [scope]: makeStoredPlugin({ root: path.join(root, scope), hooks: [`${scope}-hooks`] }),
          },
        }),
      );
    }

    const runtime = createHooksRuntime();
    const { pi, registrations } = makeRecordingPi();
    const dispatched: string[] = [];
    await createHooksHydration(runtime, {
      loadState,
      readHooksJson,
      readMcpServerNames: readStoredServerNames,
    }).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry) => {
        dispatched.push(`${entry.scope}:${entry.pluginId}`);
        return Promise.resolve({ kind: "noop" });
      },
    });
    process.env.PI_SUBAGENT_CHILD = "1";
    const context = makeContext(root, root, false);

    await registeredHandler(registrations, "session_start")(
      { type: "session_start", reason: "new" },
      context,
    );
    await registeredHandler(registrations, "tool_call")(
      { type: "tool_call", toolCallId: "trust-call", toolName: "bash", input: {} },
      context,
    );

    assert.deepStrictEqual(dispatched, ["user:user"]);
    assert.deepStrictEqual(
      runtime.getRoutingBucket("PreToolUse").map((entry) => entry.scope),
      ["user"],
    );
  },
);

test(
  "child session shutdown cleans up on reload, quit, and rejected mode",
  { concurrency: false },
  async (t) => {
    const { root } = await createHermeticEnvironment(t, "hooks-router-child-shutdown-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const state = createHooksRuntime();
    let shutdownCalls = 0;
    const runtime = new Proxy(state, {
      get(target, property, receiver): unknown {
        if (property === "shutdownChildren") {
          return (): ReturnType<typeof target.shutdownChildren> => {
            shutdownCalls += 1;
            return target.shutdownChildren();
          };
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const { pi, registrations } = makeRecordingPi();
    const dispatched: BucketAEvent[] = [];
    await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry) => {
        dispatched.push(entry.claudeEvent);
        return Promise.resolve({ kind: "noop" });
      },
    });
    runtime.setRoutingBucket("SessionEnd", [
      { ...preToolUseEntry("shutdown", root), claudeEvent: "SessionEnd" },
    ]);
    process.env.PI_SUBAGENT_CHILD = "1";
    const shutdown = registeredHandler(registrations, "session_shutdown");

    await shutdown({ type: "session_shutdown", reason: "reload" }, makeContext(root, root));
    await shutdown({ type: "session_shutdown", reason: "quit" }, makeContext(root, root));
    const rejectedContext = new Proxy(makeContext(root, root), {
      get(target, property, receiver): unknown {
        return property === "mode" ? "unknown" : Reflect.get(target, property, receiver);
      },
    });
    await shutdown({ type: "session_shutdown", reason: "quit" }, rejectedContext);

    assert.strictEqual(shutdownCalls, 4);
    assert.deepStrictEqual(dispatched, []);
  },
);

function runningAsyncHook(
  dispatchId: string,
  claudeEvent: BucketAEvent,
  loc: HooksRuntimeChildEntry["loc"],
  signals: string[],
): HooksRuntimeChildEntry {
  return {
    dispatchId,
    pid: 47_000 + signals.length,
    scope: "project",
    marketplace: "catalog",
    pluginId: dispatchId,
    claudeEvent,
    spawnedAt: "2026-11-13T00:00:00.000Z",
    rewakeMessage: undefined,
    rewakeSummary: undefined,
    child: {
      kill(signal?: NodeJS.Signals | number): boolean {
        signals.push(`${dispatchId}:${String(signal)}`);
        return true;
      },
    },
    ladder: { cancel: () => undefined, fired: () => false },
    stdout: { text: () => "" },
    stderr: { text: () => "" },
    capturedGeneration: 0,
    loc,
  };
}

for (const scenario of [
  {
    name: "main session quit leaves running async hooks and async SessionEnd hooks alive",
    child: false,
    signals: [],
    running: ["post-tool-use-async", "session-end-async", "session-end-rewake"],
  },
  {
    name: "child session quit stops its running async hooks",
    child: true,
    signals: ["post-tool-use-async:SIGKILL"],
    running: [],
  },
] as const) {
  test(scenario.name, { concurrency: false }, async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-shutdown-async-");
    const previous = process.env.PI_SUBAGENT_CHILD;
    const runtime = createHooksRuntime();
    t.after(async () => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }

      await shutdownInMemoryChildren(runtime);
    });
    const loc = locationsFor("project", root);
    const signals: string[] = [];
    const { pi, registrations } = makeRecordingPi();
    await createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      // Registers the hook as `spawnAndRegister` does before the dispatch returns.
      executor: (entry) => {
        runtime.registerChild(runningAsyncHook(entry.pluginId, entry.claudeEvent, loc, signals));
        return Promise.resolve({ kind: "noop" });
      },
    });
    runtime.setRoutingBucket(
      "SessionEnd",
      (["async", "rewake"] as const).map((kind) => ({
        ...preToolUseEntry(`session-end-${kind}`, root),
        claudeEvent: "SessionEnd",
        matcher: parseMatcher(""),
        rawMatcher: "",
        handlerDecl: {
          type: "command",
          command: `run-session-end-${kind}`,
          ...(kind === "async" ? { async: true } : { asyncRewake: true }),
        },
      })),
    );
    runtime.registerChild(runningAsyncHook("post-tool-use-async", "PostToolUse", loc, signals));
    if (scenario.child) {
      process.env.PI_SUBAGENT_CHILD = "1";
    } else {
      delete process.env.PI_SUBAGENT_CHILD;
    }

    // act
    await registeredHandler(registrations, "session_shutdown")(
      { type: "session_shutdown", reason: "quit" },
      makeContext(root, root),
    );

    // assert
    assert.deepStrictEqual(signals, scenario.signals);
    assert.deepStrictEqual(
      runtime.pidTableEntries(loc).map((row) => row.dispatchId),
      scenario.running,
    );
  });
}

// Saves one hook output of `loc` that is 31 days old, and returns the names
// of its folder after `load` runs (D-PG5-15).
async function hookOutputAfterLoad(
  loc: ReturnType<typeof locationsFor>,
  load: () => Promise<void>,
): Promise<string[]> {
  const savedPath = await saveHookOutput(loc, "old-output", "additionalContext", "saved");
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await utimes(savedPath, old, old);
  await load();
  return readdir(path.dirname(savedPath));
}

test("a bridge load removes the old saved hook output of each scope it reaps (D-PG5-15)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "event-router-output-sweep-");
  const runtime = createHooksRuntime();
  const { pi } = makeRecordingPi();
  const load = (): Promise<void> =>
    createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, { cwd: root });

  // act
  const userNames = await hookOutputAfterLoad(locationsFor("user", root), load);
  const projectNames = await hookOutputAfterLoad(locationsFor("project", root), load);

  // assert
  assert.deepStrictEqual({ userNames, projectNames }, { userNames: [], projectNames: [] });
});

for (const trusted of [true, false]) {
  test(`a project hydrate with trust ${String(trusted)} sweeps only a trusted project's saved hook output (D-PG5-15)`, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "event-router-project-sweep-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const runtime = createHooksRuntime();

    // act
    const names = await hookOutputAfterLoad(locationsFor("project", root), () =>
      createHooksHydration(runtime, EMPTY_STATE_READER).hydrateProjectScopeForCwd(root, trusted),
    );

    // assert
    assert.deepStrictEqual(names, trusted ? [] : ["hook-old-output-additionalContext.txt"]);
  });
}

// D-PG6-07: a reader that gives each extension root its state and refuses
// every other root.
function mcpStateReader(states: ReadonlyMap<string, ExtensionState>): HooksHydrationDeps {
  return {
    loadState(extensionRoot: string): Promise<ExtensionState> {
      const state = states.get(extensionRoot);
      return state === undefined
        ? Promise.reject(new Error(`no state at ${extensionRoot}`))
        : Promise.resolve(state);
    },
    readHooksJson,
    readMcpServerNames: readStoredServerNames,
  };
}

function mcpServerState(scope: "user" | "project", cwd: string, plugin: string): ExtensionState {
  return makeScopeState({
    scope,
    cwd,
    plugins: {
      [plugin]: {
        ...makeStoredPlugin({ root: path.join(cwd, "plugins", plugin), hooks: [] }),
        mcpServerConfigs: [{ name: "stub", config: { command: "stub" } }],
      },
    },
  });
}

const MCP_SERVER_ENTRY = {
  builtinServer: "plugin_seeded_stub",
  adapterKey: "plugin_seeded_stub_",
  server: { name: "plugin:seeded:stub", source: "plugin" },
} as const;

function mcpServerOf(runtime: HooksRuntime, plugin: string): unknown {
  return runtime.mcpServerFor({
    piName: `mcp__plugin_${plugin}_stub__echo`,
    builtinServer: undefined,
  });
}

test("a load names the user scope's plugin MCP servers, also of a plugin with no hooks (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-load-");
  const runtime = createHooksRuntime();
  const reader = mcpStateReader(
    new Map([
      [locationsFor("user", root).extensionRoot, mcpServerState("user", root, "demo")],
      [locationsFor("project", root).extensionRoot, { schemaVersion: 2, marketplaces: {} }],
    ]),
  );

  // act
  await createHooksHydration(runtime, reader).registerHooksBridge(makeRecordingPi().pi, {
    cwd: root,
  });

  // assert
  assert.deepStrictEqual(mcpServerOf(runtime, "demo"), {
    name: "plugin:demo:stub",
    source: "plugin",
  });
});

test("a load whose user state fails to load names no user server (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-load-failure-");
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [MCP_SERVER_ENTRY]);
  const reader = mcpStateReader(
    new Map([
      [locationsFor("project", root).extensionRoot, { schemaVersion: 2, marketplaces: {} }],
    ]),
  );

  // act
  await createHooksHydration(runtime, reader).registerHooksBridge(makeRecordingPi().pi, {
    cwd: root,
  });

  // assert
  assert.strictEqual(mcpServerOf(runtime, "seeded"), undefined);
});

for (const { name, trusted, hasState } of [
  { name: "an untrusted project", trusted: false, hasState: true },
  { name: "a project whose state fails to load", trusted: true, hasState: false },
]) {
  test(`the project hydrate of ${name} names no project server (D-PG6-07)`, async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-project-none-");
    const runtime = createHooksRuntime();
    runtime.setMcpServers("project", [MCP_SERVER_ENTRY]);
    const states = new Map(
      hasState
        ? [[locationsFor("project", root).extensionRoot, mcpServerState("project", root, "demo")]]
        : [],
    );

    // act
    await createHooksHydration(runtime, mcpStateReader(states)).hydrateProjectScopeForCwd(
      root,
      trusted,
    );

    // assert
    assert.deepStrictEqual(
      [mcpServerOf(runtime, "seeded"), mcpServerOf(runtime, "demo")],
      [undefined, undefined],
    );
  });
}

test("the project hydrate of a trusted project names its plugin MCP servers (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-project-");
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [MCP_SERVER_ENTRY]);
  const reader = mcpStateReader(
    new Map([
      [locationsFor("project", root).extensionRoot, mcpServerState("project", root, "demo")],
    ]),
  );

  // act
  await createHooksHydration(runtime, reader).hydrateProjectScopeForCwd(root, true);

  // assert
  assert.deepStrictEqual(
    [mcpServerOf(runtime, "demo"), mcpServerOf(runtime, "seeded")],
    [
      { name: "plugin:demo:stub", source: "plugin" },
      { name: "plugin:seeded:stub", source: "plugin" },
    ],
  );
});

test("a refresh replaces both scopes' servers with the ones their state names now (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-refresh-");
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [MCP_SERVER_ENTRY]);
  const reader = mcpStateReader(
    new Map([
      [locationsFor("user", root).extensionRoot, mcpServerState("user", root, "installed")],
      [locationsFor("project", root).extensionRoot, mcpServerState("project", root, "enabled")],
    ]),
  );

  // act
  await createHooksHydration(runtime, reader).refreshMcpServers(root, true);

  // assert
  assert.deepStrictEqual(
    [
      mcpServerOf(runtime, "seeded"),
      mcpServerOf(runtime, "installed"),
      mcpServerOf(runtime, "enabled"),
    ],
    [
      undefined,
      { name: "plugin:installed:stub", source: "plugin" },
      { name: "plugin:enabled:stub", source: "plugin" },
    ],
  );
});

test("a refresh names no server of a project Pi does not trust, nor of a scope whose state fails to load (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-refresh-none-");
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [MCP_SERVER_ENTRY]);
  runtime.setMcpServers("project", [{ ...MCP_SERVER_ENTRY, adapterKey: "plugin_other_stub_" }]);
  const reader = mcpStateReader(
    new Map([
      [locationsFor("project", root).extensionRoot, mcpServerState("project", root, "demo")],
    ]),
  );

  // act
  await createHooksHydration(runtime, reader).refreshMcpServers(root, false);

  // assert
  assert.deepStrictEqual(
    [mcpServerOf(runtime, "seeded"), mcpServerOf(runtime, "other"), mcpServerOf(runtime, "demo")],
    [undefined, undefined, undefined],
  );
});

test("a refresh changes no server table when a server read advances the generation (D-PG6-07)", async (t) => {
  // arrange
  const { root } = await createHermeticEnvironment(t, "hooks-router-mcp-refresh-stale-");
  const runtime = createHooksRuntime();
  runtime.setMcpServers("user", [MCP_SERVER_ENTRY]);
  const reader: HooksHydrationDeps = {
    ...mcpStateReader(
      new Map([
        [locationsFor("user", root).extensionRoot, mcpServerState("user", root, "demo")],
        [locationsFor("project", root).extensionRoot, { schemaVersion: 2, marketplaces: {} }],
      ]),
    ),
    readMcpServerNames(): Promise<readonly string[]> {
      runtime.advanceGeneration();
      return Promise.resolve(["stub"]);
    },
  };

  // act
  await createHooksHydration(runtime, reader).refreshMcpServers(root, true);

  // assert
  assert.deepStrictEqual(
    [mcpServerOf(runtime, "seeded"), mcpServerOf(runtime, "demo")],
    [{ name: "plugin:seeded:stub", source: "plugin" }, undefined],
  );
});

const EXPANSION_LINE = {
  type: "input",
  text: "/demo:deploy staging",
  source: "interactive",
} satisfies InputEvent;

const DEPLOY_EXPANSION = {
  commandName: "demo:deploy",
  commandArgs: "staging",
  commandSource: "plugin",
} as const;

interface ExpansionRun {
  readonly claudeEvent: BucketAEvent;
  readonly event: unknown;
}

// A registered bridge whose executor records each hook it runs and answers
// `results` by event, with one match-all hook routed for each prompt event.
async function expansionFixture(
  t: TestContext,
  resolve: TypedExpansionResolver | undefined,
  results: Partial<Record<BucketAEvent, HookExecResult>> = {},
): Promise<{
  readonly runtime: HooksRuntime;
  readonly registrations: RecordedRegistration[];
  readonly runs: ExpansionRun[];
  readonly context: ExtensionContext;
  readonly register: () => Promise<void>;
}> {
  const { root } = await createHermeticEnvironment(t, "hooks-router-expansion-");
  const runtime = createHooksRuntime();
  const { pi, registrations } = makeRecordingPi();
  const runs: ExpansionRun[] = [];
  const register = (): Promise<void> =>
    createHooksHydration(runtime, EMPTY_STATE_READER).registerHooksBridge(pi, {
      cwd: root,
      executor: (entry, event) => {
        runs.push({ claudeEvent: entry.claudeEvent, event: structuredClone(event) });
        return Promise.resolve(results[entry.claudeEvent] ?? { kind: "noop" });
      },
      ...(resolve === undefined ? {} : { resolveTypedExpansion: resolve }),
    });
  await register();
  for (const claudeEvent of ["UserPromptSubmit", "UserPromptExpansion"] as const) {
    runtime.setRoutingBucket(claudeEvent, [
      {
        ...preToolUseEntry(`${claudeEvent}-plugin`, root),
        claudeEvent,
        matcher: parseMatcher(""),
        rawMatcher: "",
      },
    ]);
  }

  return { runtime, registrations, runs, context: makeContext(root, root), register };
}

// Walks the bridge's `input` handlers as Pi does: in registration order,
// stopping at the first that answers `handled`.
async function runInputHandlers(
  registrations: readonly RecordedRegistration[],
  event: InputEvent,
  context: ExtensionContext,
): Promise<unknown[]> {
  const answers: unknown[] = [];
  for (const { handler } of registrations.filter(
    (registration) => registration.event === "input",
  )) {
    const answer = await (handler as (...args: unknown[]) => unknown)(event, context);
    answers.push(answer);
    if ((answer as { readonly action?: string } | undefined)?.action === "handled") {
      break;
    }
  }

  return answers;
}

function recordingResolver(
  calls: string[],
  answer: () => Promise<Awaited<ReturnType<TypedExpansionResolver>>>,
): TypedExpansionResolver {
  return (text) => {
    calls.push(text);
    return answer();
  };
}

test("runs the expansion hooks for a line the resolver names, with the synthetic event (D-PG6-18)", async (t) => {
  // arrange
  const resolved: string[] = [];
  const { registrations, runs, context } = await expansionFixture(
    t,
    recordingResolver(resolved, () => Promise.resolve(DEPLOY_EXPANSION)),
    { UserPromptExpansion: { kind: "block", reason: "not now" } },
  );

  // act
  const answer = await registeredHandler(registrations, "input", 1)(EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual(
    { answer, resolved, runs },
    {
      answer: { action: "handled" },
      resolved: ["/demo:deploy staging"],
      runs: [
        {
          claudeEvent: "UserPromptExpansion",
          event: {
            command_name: "demo:deploy",
            command_args: "staging",
            command_source: "plugin",
            input: EXPANSION_LINE,
          },
        },
      ],
    },
  );
});

test("leaves out command_source when the resolver gives none (D-PG6-19)", async (t) => {
  // arrange
  const { registrations, runs, context } = await expansionFixture(t, () =>
    Promise.resolve({ commandName: "deploy", commandArgs: "" }),
  );

  // act
  const answer = await registeredHandler(
    registrations,
    "input",
    1,
  )({ type: "input", text: "/deploy", source: "rpc" }, context);

  // assert
  assert.deepStrictEqual(
    { answer, runs },
    {
      answer: undefined,
      runs: [
        {
          claudeEvent: "UserPromptExpansion",
          event: {
            command_name: "deploy",
            command_args: "",
            input: { type: "input", text: "/deploy", source: "rpc" },
          },
        },
      ],
    },
  );
});

for (const { name, line, answer, resolverCalls } of [
  {
    name: "input from an extension",
    line: { ...EXPANSION_LINE, source: "extension" },
    answer: (): Promise<undefined> => Promise.resolve(undefined),
    resolverCalls: [],
  },
  {
    name: "a line the resolver does not name",
    line: EXPANSION_LINE,
    answer: (): Promise<undefined> => Promise.resolve(undefined),
    resolverCalls: ["/demo:deploy staging"],
  },
] satisfies ReadonlyArray<{
  readonly name: string;
  readonly line: InputEvent;
  readonly answer: () => Promise<undefined>;
  readonly resolverCalls: readonly string[];
}>) {
  test(`runs no expansion hook for ${name} (D-PG6-18)`, async (t) => {
    // arrange
    const resolved: string[] = [];
    const { registrations, runs, context } = await expansionFixture(
      t,
      recordingResolver(resolved, answer),
    );

    // act
    const output = await registeredHandler(registrations, "input", 1)(line, context);

    // assert
    assert.deepStrictEqual(
      { output, resolved, runs },
      { output: undefined, resolved: resolverCalls, runs: [] },
    );
  });
}

test("runs no expansion hook for a registration with no resolver (D-PG6-18)", async (t) => {
  // arrange
  const { registrations, runs, context } = await expansionFixture(t, undefined);

  // act
  const output = await registeredHandler(registrations, "input", 1)(EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual({ output, runs }, { output: undefined, runs: [] });
});

test("asks the resolver nothing when no expansion hook is routed (D-PG6-18)", async (t) => {
  // arrange
  const resolved: string[] = [];
  const { runtime, registrations, runs, context } = await expansionFixture(
    t,
    recordingResolver(resolved, () => Promise.resolve(DEPLOY_EXPANSION)),
  );
  runtime.setRoutingBucket("UserPromptExpansion", []);

  // act
  const output = await registeredHandler(registrations, "input", 1)(EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual({ output, resolved, runs }, { output: undefined, resolved: [], runs: [] });
});

test(
  "runs no expansion hook in a pi-subagents child (D-PG6-18)",
  { concurrency: false },
  async (t) => {
    // arrange
    const previous = process.env.PI_SUBAGENT_CHILD;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previous;
      }
    });
    const resolved: string[] = [];
    const { registrations, runs, context } = await expansionFixture(
      t,
      recordingResolver(resolved, () => Promise.resolve(DEPLOY_EXPANSION)),
    );
    process.env.PI_SUBAGENT_CHILD = "1";

    // act
    const output = await registeredHandler(registrations, "input", 1)(EXPANSION_LINE, context);

    // assert
    assert.deepStrictEqual(
      { output, resolved, runs },
      { output: undefined, resolved: [], runs: [] },
    );
  },
);

test("runs no expansion hook through a registration a reload replaced (D-PG6-18)", async (t) => {
  // arrange
  const resolved: string[] = [];
  const { registrations, runs, context, register } = await expansionFixture(
    t,
    recordingResolver(resolved, () => Promise.resolve(DEPLOY_EXPANSION)),
  );
  const staleHandler = registeredHandler(registrations, "input", 1);
  await register();

  // act
  const output = await staleHandler(EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual({ output, resolved, runs }, { output: undefined, resolved: [], runs: [] });
});

test("runs no expansion hook when the resolver rejects, and logs one debug line (D-PG6-18)", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const { registrations, runs, context } = await expansionFixture(t, () =>
    Promise.reject(new Error("alias table unreadable")),
  );

  // act
  const output = await registeredHandler(registrations, "input", 1)(EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual(
    { output, runs, logged },
    {
      output: undefined,
      runs: [],
      logged: ["[hooks] input: typed expansion not resolved: alias table unreadable"],
    },
  );
});

test("a blocked prompt asks the expansion resolver nothing, by registration order (D-PG6-18)", async (t) => {
  // arrange
  const resolved: string[] = [];
  const { registrations, runs, context } = await expansionFixture(
    t,
    recordingResolver(resolved, () => Promise.resolve(DEPLOY_EXPANSION)),
    { UserPromptSubmit: { kind: "block", reason: "no prompts" } },
  );

  // act
  const answers = await runInputHandlers(registrations, EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual(
    { answers, resolved, events: runs.map((run) => run.claudeEvent) },
    { answers: [{ action: "handled" }], resolved: [], events: ["UserPromptSubmit"] },
  );
});

test("runs the prompt hooks before the expansion hooks of one line (D-PG6-18)", async (t) => {
  // arrange
  const { registrations, runs, context } = await expansionFixture(t, () =>
    Promise.resolve(DEPLOY_EXPANSION),
  );

  // act
  const answers = await runInputHandlers(registrations, EXPANSION_LINE, context);

  // assert
  assert.deepStrictEqual(
    { answers, events: runs.map((run) => run.claudeEvent) },
    {
      answers: [undefined, undefined, undefined],
      events: ["UserPromptSubmit", "UserPromptExpansion"],
    },
  );
});

test("before_agent_start sends the prompt context, then the expansion context, of one line (D-PG6-20)", async (t) => {
  // arrange
  const { registrations, context } = await expansionFixture(
    t,
    () => Promise.resolve(DEPLOY_EXPANSION),
    {
      UserPromptSubmit: { kind: "mutate", additionalContext: "prompt context" },
      UserPromptExpansion: { kind: "mutate", additionalContext: "expansion context" },
    },
  );
  await runInputHandlers(registrations, EXPANSION_LINE, context);

  // act
  const turn = await registeredHandler(registrations, "before_agent_start")(PROMPT_TURN, context);

  // assert
  assert.deepStrictEqual(turn, {
    message: {
      customType: "claude-hook-additional-context",
      content: [
        { type: "text", text: "UserPromptSubmit hook additional context: prompt context" },
        { type: "text", text: "UserPromptExpansion hook additional context: expansion context" },
      ],
      display: false,
    },
  });
});
