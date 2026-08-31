import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { watch, type FSWatcher } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import { pidTablePath } from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  MARKER_ENV,
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import { dispatchHookExec } from "../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import {
  bumpEpoch,
  resetRoutingState,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { asAbsolutePluginRoot } from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { SpawnDeps } from "../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { RoutingEntry } from "../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
}

interface ChildHarness {
  readonly child: ChildProcess;
  readonly stdin: PassThrough;
  readonly stdout: PassThrough;
  readonly stderr: PassThrough;
  readonly signals: NodeJS.Signals[];
  emitClose(code?: number | null, signal?: NodeJS.Signals | null): void;
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
}

interface SpawnHarness {
  readonly calls: SpawnCall[];
  readonly children: ChildHarness[];
  readonly spawnImpl: NonNullable<SpawnDeps["spawnImpl"]>;
}

function createChild(pid: number): ChildHarness {
  const events = new EventEmitter();
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const signals: NodeJS.Signals[] = [];
  let exitCode: number | null = null;
  let signalCode: NodeJS.Signals | null = null;
  const child = Object.assign(events, {
    stdin,
    stdout,
    stderr,
    stdio: [stdin, stdout, stderr, undefined, undefined] satisfies ChildProcess["stdio"],
    connected: false,
    pid,
    get exitCode(): number | null {
      return exitCode;
    },
    get signalCode(): NodeJS.Signals | null {
      return signalCode;
    },
    killed: false,
    spawnargs: [],
    spawnfile: "",
    kill(signal?: NodeJS.Signals): boolean {
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
  }) satisfies ChildProcess;

  return {
    child,
    stdin,
    stdout,
    stderr,
    signals,
    emitClose(code = exitCode, signal = signalCode): void {
      events.emit("close", code, signal);
    },
    emitExit(code, signal = null): void {
      exitCode = code;
      signalCode = signal;
      events.emit("exit", code, signal);
    },
  };
}

function createSpawnHarness(autoClose: boolean): SpawnHarness {
  const calls: SpawnCall[] = [];
  const children: ChildHarness[] = [];
  const spawnImpl = ((command: string, args: readonly string[], options: SpawnOptions) => {
    const child = createChild(41_000 + children.length);
    calls.push({ command, args: [...args], options });
    children.push(child);
    if (autoClose) {
      queueMicrotask(() => {
        child.stdout.end();
        child.stderr.end();
        child.child.emit("close", 0, null);
      });
    }

    return child.child;
  }) as NonNullable<SpawnDeps["spawnImpl"]>;

  return { calls, children, spawnImpl };
}

function createContext(
  root: string,
  sessionId: string,
): {
  readonly context: ExtensionContext;
  readonly notifications: Array<{
    readonly text: string;
    readonly severity: "info" | "warning" | "error" | undefined;
  }>;
} {
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
    cwd: root,
    sessionManager: SessionManager.inMemory(root, { id: sessionId }),
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("async architecture contract must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort(): never {
      throw new Error("async architecture contract must not abort");
    },
    hasPendingMessages: () => false,
    shutdown(): never {
      throw new Error("async architecture contract must not shut down Pi");
    },
    getContextUsage(): never {
      throw new Error("async architecture contract must not inspect context usage");
    },
    compact(): never {
      throw new Error("async architecture contract must not compact");
    },
    getSystemPrompt(): never {
      throw new Error("async architecture contract must not read the system prompt");
    },
  } satisfies ExtensionContext;

  return { context, notifications };
}

function createPi(): {
  readonly pi: ExtensionAPI;
  readonly messages: Array<{ readonly message: unknown; readonly options: unknown }>;
} {
  const messages: Array<{ readonly message: unknown; readonly options: unknown }> = [];
  const pi = {
    sendMessage(message: unknown, options: unknown): void {
      messages.push({ message, options });
    },
  } as ExtensionAPI;

  return { pi, messages };
}

function createEntry(
  root: string,
  event: "PreToolUse" | "SessionStart",
  asyncRewake: boolean,
): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog-parity",
    pluginId: "plugin-parity",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin-source")),
    claudeEvent: event,
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: asyncRewake
      ? {
          type: "command",
          command: "/opt/hooks/parity",
          args: ["--exact"],
          timeout: 600,
          asyncRewake: true,
        }
      : {
          type: "command",
          command: "/opt/hooks/parity",
          args: ["--exact"],
          timeout: 600,
        },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
}

function destroyChildren(children: readonly ChildHarness[]): void {
  for (const child of children) {
    child.child.removeAllListeners();
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
  }
}

function assertLaneParity(syncEnv: NodeJS.ProcessEnv, asyncEnv: NodeJS.ProcessEnv): void {
  const syncKeys = Object.keys(syncEnv).sort();
  const asyncKeysWithoutMarker = Object.keys(asyncEnv)
    .filter((key) => key !== MARKER_ENV)
    .sort();
  assert.deepStrictEqual(asyncKeysWithoutMarker, syncKeys);
  for (const key of syncKeys) {
    assert.strictEqual(asyncEnv[key], syncEnv[key]);
  }
}

function observeTableRewrite(tablePath: string): {
  readonly completion: Promise<void>;
  close(): void;
} {
  let watcher: FSWatcher | undefined;
  const completion = new Promise<void>((resolve, reject) => {
    watcher = watch(path.dirname(tablePath), (_event, filename) => {
      if (filename?.toString() === path.basename(tablePath)) {
        resolve();
      }
    });
    watcher.once("error", reject);
  });

  return {
    completion,
    close(): void {
      watcher?.close();
    },
  };
}

test("keeps PreToolUse hook environments equal across sync and async lanes except the marker", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-architecture-pretool-parity-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-pretool-parity");
  const pi = createPi();
  const syncEntry = createEntry(root, "PreToolUse", false);
  const asyncEntry = createEntry(root, "PreToolUse", true);
  const processes = createSpawnHarness(true);

  try {
    // act
    await dispatchHookExec(syncEntry, { toolName: "bash", input: {} }, context.context, pi.pi, {
      spawnImpl: processes.spawnImpl,
    });
    await spawnAndRegister(
      asyncEntry,
      { toolName: "bash", input: {} },
      context.context,
      pi.pi,
      locations,
      {
        spawnImpl: processes.spawnImpl,
        dispatchId: () => "dispatch-pretool-parity",
      },
    );
    const syncEnvironment = processes.calls[0]?.options.env ?? {};
    const asyncEnvironment = processes.calls[1]?.options.env ?? {};

    // assert
    assert.strictEqual(processes.calls.length, 2);
    assertLaneParity(syncEnvironment, asyncEnvironment);
    assert.strictEqual(asyncEnvironment[MARKER_ENV], "dispatch-pretool-parity");
    assert.strictEqual(Object.hasOwn(syncEnvironment, "CLAUDE_ENV_FILE"), false);
    assert.strictEqual(Object.hasOwn(asyncEnvironment, "CLAUDE_ENV_FILE"), false);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChildren(processes.children);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("keeps SessionStart env-file identity equal across sync and async lanes", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-architecture-session-parity-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-start-parity");
  const pi = createPi();
  const syncEntry = createEntry(root, "SessionStart", false);
  const asyncEntry = createEntry(root, "SessionStart", true);
  const processes = createSpawnHarness(true);

  try {
    // act
    await dispatchHookExec(syncEntry, { reason: "startup" }, context.context, pi.pi, {
      spawnImpl: processes.spawnImpl,
    });
    await spawnAndRegister(asyncEntry, { reason: "startup" }, context.context, pi.pi, locations, {
      spawnImpl: processes.spawnImpl,
      dispatchId: () => "dispatch-session-parity",
    });
    const syncEnvironment = processes.calls[0]?.options.env ?? {};
    const asyncEnvironment = processes.calls[1]?.options.env ?? {};

    // assert
    assert.strictEqual(processes.calls.length, 2);
    assertLaneParity(syncEnvironment, asyncEnvironment);
    assert.strictEqual(asyncEnvironment[MARKER_ENV], "dispatch-session-parity");
    assert.strictEqual(
      syncEnvironment.CLAUDE_ENV_FILE,
      path.join(
        root,
        ".pi",
        "pi-claude-marketplace",
        "data",
        "_shared",
        "claude-env-session-start-parity.env",
      ),
    );
    assert.strictEqual(asyncEnvironment.CLAUDE_ENV_FILE, syncEnvironment.CLAUDE_ENV_FILE);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChildren(processes.children);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("prevents a pre-reload async child from affecting the advanced routing epoch", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-architecture-reload-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-reload");
  const pi = createPi();
  const entry = createEntry(root, "PreToolUse", true);
  const processes = createSpawnHarness(false);
  const tablePath = pidTablePath(locations);
  let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

  try {
    await spawnAndRegister(
      entry,
      { toolName: "bash", input: {} },
      context.context,
      pi.pi,
      locations,
      {
        spawnImpl: processes.spawnImpl,
        dispatchId: () => "dispatch-before-reload",
      },
    );
    const child = processes.children[0];
    child?.stderr.write("stale body");
    bumpEpoch();
    tableRewrite = observeTableRewrite(tablePath);

    // act
    child?.emitExit(2);
    child?.emitClose();
    await tableRewrite.completion;
    tableRewrite.close();
    shutdownInMemoryChildren();

    // assert
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(child?.signals, []);
  } finally {
    tableRewrite?.close();
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChildren(processes.children);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});
