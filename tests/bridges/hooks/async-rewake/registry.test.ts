import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { watch, type FSWatcher } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test, type TestContext } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  pidTablePath,
  readPidTable,
  writePidTable,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  MARKER_ENV,
  reapOrphans,
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import {
  bumpEpoch,
  resetRoutingState,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { asAbsolutePluginRoot } from "../../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type {
  OrphanProbes,
  SpawnDeps,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { RoutingEntry } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { BucketAEvent } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
}

interface ChildHarness {
  readonly child: ChildProcess;
  readonly stdin: PassThrough | null;
  readonly stdout: PassThrough;
  readonly stderr: PassThrough;
  readonly signals: Array<number | NodeJS.Signals>;
  emitClose(code?: number | null, signal?: NodeJS.Signals | null): void;
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
  emitError(error: Error): void;
}

interface ContextHarness {
  readonly context: ExtensionContext;
  readonly notifications: Array<{
    readonly text: string;
    readonly severity: "info" | "warning" | "error" | undefined;
  }>;
  setIdle(idle: boolean): void;
}

interface PiHarness {
  readonly pi: ExtensionAPI;
  readonly messages: Array<{ readonly message: unknown; readonly options: unknown }>;
  setSendError(error: Error | undefined): void;
}

interface TimerObservation {
  readonly clearHandles: Array<ReturnType<typeof setTimeout>>;
  readonly handles: Array<ReturnType<typeof setTimeout>>;
}

interface ChildOptions {
  readonly stdin?: PassThrough | null;
  readonly stdout?: "absent";
  readonly stderr?: "absent";
  readonly killError?: Error;
}

function createChild(pid: number | undefined, options: ChildOptions = {}): ChildHarness {
  const events = new EventEmitter();
  const stdin = options.stdin === undefined ? new PassThrough() : options.stdin;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const childStdout = options.stdout === "absent" ? null : stdout;
  const childStderr = options.stderr === "absent" ? null : stderr;
  const stdio: ChildProcess["stdio"] = [stdin, childStdout, childStderr, undefined, undefined];
  const signals: Array<number | NodeJS.Signals> = [];
  let exitCode: number | null = null;
  let signalCode: NodeJS.Signals | null = null;
  let killed = false;
  const child = Object.assign(events, {
    stdin,
    stdout: childStdout,
    stderr: childStderr,
    stdio,
    connected: false,
    pid,
    get exitCode(): number | null {
      return exitCode;
    },
    get signalCode(): NodeJS.Signals | null {
      return signalCode;
    },
    get killed(): boolean {
      return killed;
    },
    spawnargs: [],
    spawnfile: "",
    kill(signal?: NodeJS.Signals | number): boolean {
      signals.push(signal ?? "SIGTERM");
      if (options.killError !== undefined) {
        throw options.killError;
      }

      killed = true;
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
    emitError(error): void {
      events.emit("error", error);
    },
  };
}

function createContext(
  root: string,
  sessionId: string,
  initialIdle: boolean,
  notifyError?: Error,
): ContextHarness {
  const notifications: ContextHarness["notifications"] = [];
  const sessionManager = SessionManager.inMemory(root, { id: sessionId });
  let idle = initialIdle;
  const ui = {
    notify(text: string, severity?: "info" | "warning" | "error"): void {
      if (notifyError !== undefined) {
        throw notifyError;
      }

      notifications.push({ text, severity });
    },
  } as ExtensionContext["ui"];
  const context = {
    ui,
    mode: "print",
    hasUI: false,
    cwd: root,
    sessionManager,
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("async registry must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle: () => idle,
    isProjectTrusted: () => true,
    signal: undefined,
    abort(): never {
      throw new Error("async registry must not abort the session");
    },
    hasPendingMessages: () => false,
    shutdown(): never {
      throw new Error("async registry must not shut down Pi");
    },
    getContextUsage(): never {
      throw new Error("async registry must not inspect context usage");
    },
    compact(): never {
      throw new Error("async registry must not compact the session");
    },
    getSystemPrompt(): never {
      throw new Error("async registry must not read the system prompt");
    },
  } satisfies ExtensionContext;

  return {
    context,
    notifications,
    setIdle(nextIdle): void {
      idle = nextIdle;
    },
  };
}

function createPi(): PiHarness {
  const messages: PiHarness["messages"] = [];
  let sendError: Error | undefined;
  const sendMessage: ExtensionAPI["sendMessage"] = (message, options) => {
    if (sendError !== undefined) {
      throw sendError;
    }

    messages.push({ message, options });
  };

  const pi = { sendMessage } as ExtensionAPI;

  return {
    pi,
    messages,
    setSendError(error): void {
      sendError = error;
    },
  };
}

interface EntryOverrides {
  readonly scope?: "user" | "project";
  readonly marketplace?: string;
  readonly pluginId?: string;
  readonly claudeEvent?: BucketAEvent;
  readonly handlerDecl?: RoutingEntry["handlerDecl"];
}

function createEntry(root: string, overrides: EntryOverrides = {}): RoutingEntry {
  return {
    scope: overrides.scope ?? "project",
    marketplace: overrides.marketplace ?? "catalog-lifecycle",
    pluginId: overrides.pluginId ?? "plugin-lifecycle",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin-source")),
    claudeEvent: overrides.claudeEvent ?? "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "Bash",
    handlerDecl:
      overrides.handlerDecl ??
      ({
        type: "command",
        command: "/opt/hooks/scan",
        args: ["--policy", "strict"],
        timeout: 600,
        asyncRewake: true,
        rewakeMessage: "Review finding:",
        rewakeSummary: "scan complete",
      } satisfies RoutingEntry["handlerDecl"]),
    declarationIndex: 3,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
}

function createSpawn(child: ChildProcess, calls: SpawnCall[]): NonNullable<SpawnDeps["spawnImpl"]> {
  return ((command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
    calls.push({ command, args: [...args], options });
    return child;
  }) as NonNullable<SpawnDeps["spawnImpl"]>;
}

function observeTimers(t: TestContext, now: number): TimerObservation {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const scheduledSetTimeout = globalThis.setTimeout;
  const scheduledClearTimeout = globalThis.clearTimeout;
  const handles: Array<ReturnType<typeof setTimeout>> = [];
  const clearHandles: Array<ReturnType<typeof setTimeout>> = [];

  function observedSetTimeout<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay = 0,
    ...args: TArgs
  ): ReturnType<typeof setTimeout> {
    const handle = scheduledSetTimeout(callback, delay, ...args);
    handles.push(handle);
    return handle;
  }

  function observedClearTimeout(handle: Parameters<typeof clearTimeout>[0]): void {
    if (typeof handle === "object" && handle !== null) {
      clearHandles.push(handle);
    }

    scheduledClearTimeout(handle);
  }

  t.mock.method(globalThis, "setTimeout", observedSetTimeout);
  t.mock.method(globalThis, "clearTimeout", observedClearTimeout);

  return { clearHandles, handles };
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

function filesystemErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

test(
  "registers one child and rewakes the idle session through complete public cleanup",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-lifecycle-"));
    const fixedNow = Date.parse("2026-08-31T10:00:00.000Z");
    const timers = observeTimers(t, fixedNow);
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const entry = createEntry(root);
    const event = {
      type: "tool_call",
      toolCallId: "tool-call-lifecycle",
      toolName: "bash",
      input: { command: "printf ready" },
    } satisfies ToolCallEvent;
    const context = createContext(root, "session-lifecycle", true);
    const pi = createPi();
    const child = createChild(24_680);
    const spawnCalls: SpawnCall[] = [];
    const spawnImpl = createSpawn(child.child, spawnCalls);
    const stdinChunks: Buffer[] = [];
    child.stdin?.on("data", (chunk: Buffer) => {
      stdinChunks.push(Buffer.from(chunk));
    });
    const stdinEnd = child.stdin === null ? Promise.resolve([]) : once(child.stdin, "end");
    const stdoutEnd = once(child.stdout, "end");
    const stderrEnd = once(child.stderr, "end");
    const processEnvironment = { ...process.env };
    const expectedEnvironment = {
      ...processEnvironment,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_PLUGIN_ROOT: path.join(root, "plugin-source"),
      CLAUDE_PLUGIN_DATA: path.join(
        root,
        ".pi",
        "pi-claude-marketplace",
        "data",
        "plugin-lifecycle",
      ),
      [MARKER_ENV]: "dispatch-lifecycle",
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "session-lifecycle",
      CLAUDE_SESSION_ID: "session-lifecycle",
    } satisfies NodeJS.ProcessEnv;
    const expectedStdin = JSON.stringify({
      session_id: "session-lifecycle",
      transcript_path: "",
      cwd: root,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "printf ready" },
    });
    const tablePath = pidTablePath(locations);
    const expectedRegisteredBytes =
      '{\n  "version": 1,\n  "entries": [\n    {\n      "pid": 24680,\n' +
      '      "dispatchId": "dispatch-lifecycle",\n      "scope": "project",\n' +
      '      "marketplace": "catalog-lifecycle",\n      "plugin": "plugin-lifecycle",\n' +
      '      "spawnedAt": "2026-08-31T10:00:00.000Z"\n    }\n  ]\n}\n';
    const expectedRemovedBytes = '{\n  "version": 1,\n  "entries": []\n}\n';
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      // act
      await spawnAndRegister(entry, event, context.context, pi.pi, locations, {
        spawnImpl,
        dispatchId: () => "dispatch-lifecycle",
      });
      await stdinEnd;
      const registeredBytes = await readFile(tablePath, "utf8");
      const listenersAfterRegistration = {
        childExit: child.child.listenerCount("exit"),
        childError: child.child.listenerCount("error"),
        stdinError: child.stdin?.listenerCount("error") ?? 0,
        stdoutData: child.stdout.listenerCount("data"),
        stderrData: child.stderr.listenerCount("data"),
      };
      child.stderr.write("stderr-one");
      child.stdout.write("stdout-one");
      child.stderr.end("-stderr-two");
      child.stdout.end("-stdout-two");
      await Promise.all([stdoutEnd, stderrEnd]);
      tableRewrite = observeTableRewrite(tablePath);
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      const removedBytes = await readFile(tablePath, "utf8");
      const listenersAfterExit = {
        childExit: child.child.listenerCount("exit"),
        childError: child.child.listenerCount("error"),
      };
      const orphanProbeCalls: Array<{ pid: number; signal: number | NodeJS.Signals }> = [];
      await reapOrphans(locations, {
        killProbe(pid, signal): void {
          orphanProbeCalls.push({ pid, signal });
        },
        environReader(): Promise<string> {
          throw new Error("an empty table must not inspect /proc");
        },
      });
      const finalTableState = await stat(tablePath).catch(filesystemErrorCode);
      shutdownInMemoryChildren();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(spawnCalls, [
        {
          command: "/opt/hooks/scan",
          args: ["--policy", "strict"],
          options: {
            cwd: root,
            env: expectedEnvironment,
            stdio: ["pipe", "pipe", "pipe"],
            shell: false,
            detached: false,
          },
        },
      ]);
      assert.strictEqual(MARKER_ENV, "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH");
      assert.strictEqual(Buffer.concat(stdinChunks).toString("utf8"), expectedStdin);
      assert.strictEqual(child.stdin?.writableEnded, true);
      assert.deepStrictEqual(listenersAfterRegistration, {
        childExit: 1,
        childError: 1,
        stdinError: 1,
        stdoutData: 1,
        stderrData: 1,
      });
      assert.strictEqual(registeredBytes, expectedRegisteredBytes);
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: "Review finding:\n\nstderr-one-stderr-two",
            display: false,
            details: {
              pluginId: "plugin-lifecycle",
              dispatchId: "dispatch-lifecycle",
            },
          },
          options: { deliverAs: "nextTurn" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.strictEqual(timers.handles.length, 2);
      assert.deepStrictEqual(listenersAfterExit, { childExit: 0, childError: 1 });
      assert.strictEqual(removedBytes, expectedRemovedBytes);
      assert.deepStrictEqual(orphanProbeCalls, []);
      assert.strictEqual(finalTableState, "ENOENT");
      assert.deepStrictEqual(child.signals, []);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      child.child.removeAllListeners();
      child.stdin?.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("registers a child whose optional stdin pipe is absent", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-stdin-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:05:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const entry = createEntry(root);
  const event = {
    type: "tool_call",
    toolCallId: "tool-call-no-stdin",
    toolName: "bash",
    input: { command: "printf absent" },
  } satisfies ToolCallEvent;
  const context = createContext(root, "session-no-stdin", true);
  const pi = createPi();
  const child = createChild(24_681, { stdin: null });
  const spawnCalls: SpawnCall[] = [];
  const spawnImpl = createSpawn(child.child, spawnCalls);
  const tablePath = pidTablePath(locations);

  try {
    // act
    await spawnAndRegister(entry, event, context.context, pi.pi, locations, {
      spawnImpl,
      dispatchId: () => "dispatch-no-stdin",
    });
    const registeredEntries = await readPidTable(locations);
    shutdownInMemoryChildren();
    t.mock.timers.tick(605_000);
    const probeCalls: Array<{ pid: number; signal: number | NodeJS.Signals }> = [];
    await reapOrphans(locations, {
      killProbe(pid, signal): void {
        probeCalls.push({ pid, signal });
        if (signal === 0) {
          const missing = new Error("case-owned child already stopped") as NodeJS.ErrnoException;
          missing.code = "ESRCH";
          throw missing;
        }
      },
      environReader(): Promise<string> {
        throw new Error("a missing process must not inspect /proc");
      },
    });
    const finalTableState = await stat(tablePath).catch(filesystemErrorCode);

    // assert
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(child.child.stdin, null);
    assert.deepStrictEqual(registeredEntries, [
      {
        pid: 24_681,
        dispatchId: "dispatch-no-stdin",
        scope: "project",
        marketplace: "catalog-lifecycle",
        plugin: "plugin-lifecycle",
        spawnedAt: "2026-08-31T10:05:00.000Z",
      },
    ]);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(probeCalls, [{ pid: 24_681, signal: 0 }]);
    assert.strictEqual(finalTableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("skips a non-dispatchable event without spawning or persisting", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-nondispatch-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const entry = createEntry(root);
  Reflect.set(entry, "claudeEvent", "FutureAdmittedEvent");
  const context = createContext(root, "session-nondispatch", true);
  const pi = createPi();
  const spawnCalls: SpawnCall[] = [];
  const child = createChild(24_682);

  try {
    // act
    await spawnAndRegister(entry, { stop_hook_active: false }, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, spawnCalls),
      dispatchId: () => "dispatch-nondispatch",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

    // assert
    assert.deepStrictEqual(spawnCalls, []);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(child.signals, []);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains a synchronous spawn failure with semantic diagnostics", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-spawn-throw-"));
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]) => {
    diagnostics.push(parts.map(String).join(" "));
  });
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-spawn-throw", true);
  const pi = createPi();
  const spawnError = new Error("spawn denied by case boundary");
  const spawnImpl = (() => {
    throw spawnError;
  }) as NonNullable<SpawnDeps["spawnImpl"]>;

  try {
    // act
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl,
      dispatchId: () => "dispatch-spawn-throw",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

    // assert
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.strictEqual(diagnostics.length, 1);
    assert.match(diagnostics[0] ?? "", /spawn threw/);
    assert.match(diagnostics[0] ?? "", /plugin-lifecycle\/PreToolUse/);
    assert.match(diagnostics[0] ?? "", /spawn denied by case boundary/);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("kills a spawned child that has no PID and leaves no registry state", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-no-pid", true);
  const pi = createPi();
  const child = createChild(undefined);
  const spawnCalls: SpawnCall[] = [];

  try {
    // act
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, spawnCalls),
      dispatchId: () => "dispatch-no-pid",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);
    shutdownInMemoryChildren();

    // assert
    assert.strictEqual(spawnCalls.length, 1);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains a kill failure for a spawned child that has no PID", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-kill-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-no-pid-kill", true);
  const pi = createPi();
  const child = createChild(undefined, { killError: new Error("already exited") });

  try {
    // act
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-no-pid-kill",
    });

    // assert
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains stdin errors after registering the listener before delivery", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdin-error-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:10:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdin-error", true);
  const pi = createPi();
  const child = createChild(24_683);

  try {
    // act
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stdin-error",
    });
    child.stdin?.emit("error", new Error("EPIPE from case child"));
    shutdownInMemoryChildren();
    t.mock.timers.tick(605_000);

    // assert
    assert.strictEqual(child.stdin?.listenerCount("error"), 1);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await reapOrphans(locations, {
      killProbe(): never {
        const error = new Error("child stopped by shutdown") as NodeJS.ErrnoException;
        error.code = "ESRCH";
        throw error;
      },
      environReader(): Promise<string> {
        throw new Error("dead child must not inspect environ");
      },
    });
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains a synchronous stdin end failure and cleans the registered child", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdin-end-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:15:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdin-end", true);
  const pi = createPi();
  const child = createChild(24_684);
  t.mock.method(child.stdin!, "end", () => {
    throw new Error("synchronous stdin end failure");
  });

  try {
    // act
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stdin-end",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);
    shutdownInMemoryChildren();
    t.mock.timers.tick(605_000);

    // assert
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

function destroyChild(child: ChildHarness): void {
  child.child.removeAllListeners();
  child.stdin?.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
}

function deadOrphanProbes(): OrphanProbes {
  return {
    killProbe(): never {
      const error = new Error("case-owned child is no longer live") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    },
    environReader(): Promise<string> {
      throw new Error("a dead child must not inspect environ");
    },
  };
}

test("settles a child error once and ignores its later exit", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-child-error-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:20:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-child-error", true);
  const pi = createPi();
  const child = createChild(24_685);
  let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

  try {
    await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-child-error",
    });
    tableRewrite = observeTableRewrite(pidTablePath(locations));

    // act
    child.emitError(new Error("child launch failed after spawn"));
    await tableRewrite.completion;
    tableRewrite.close();
    child.emitExit(2);
    child.emitClose();
    t.mock.timers.tick(605_000);
    const persistedEntries = await readPidTable(locations);

    // assert
    assert.deepStrictEqual(persistedEntries, []);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.strictEqual(child.child.listenerCount("error"), 0);
    assert.strictEqual(child.child.listenerCount("exit"), 0);
    assert.deepStrictEqual(child.signals, []);
  } finally {
    tableRewrite?.close();
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChild(child);
    await reapOrphans(locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "ignores a late child error after an exit has already settled",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-late-error-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:25:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-late-error", true);
    const pi = createPi();
    const child = createChild(24_686);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(
        createEntry(root, {
          handlerDecl: {
            type: "command",
            command: "/opt/hooks/late-error",
            timeout: 600,
            asyncRewake: true,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: createSpawn(child.child, []),
          dispatchId: () => "dispatch-late-error",
        },
      );
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(0);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      child.emitError(new Error("late duplicate terminal event"));
      t.mock.timers.tick(605_000);
      const persistedEntries = await readPidTable(locations);

      // assert
      assert.deepStrictEqual(persistedEntries, []);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.strictEqual(child.child.listenerCount("error"), 0);
      assert.strictEqual(child.child.listenerCount("exit"), 0);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "notifies a summary but does not inject for an ordinary exit",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-exit-zero-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:30:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-exit-zero", true);
    const pi = createPi();
    const child = createChild(24_687);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-exit-zero",
      });
      child.stderr.end("ignored ordinary output");
      await once(child.stderr, "end");
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(0);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("records a signalled exit as silent completion", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-signal-exit-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:35:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-signal-exit", true);
  const pi = createPi();
  const child = createChild(24_688);
  let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

  try {
    await spawnAndRegister(
      createEntry(root, {
        handlerDecl: { type: "command", command: "/opt/hooks/signal", timeout: 600 },
      }),
      {},
      context.context,
      pi.pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-signal-exit" },
    );
    tableRewrite = observeTableRewrite(pidTablePath(locations));

    // act
    child.emitExit(null, "SIGTERM");
    child.emitClose();
    await tableRewrite.completion;
    tableRewrite.close();
    t.mock.timers.tick(605_000);

    // assert
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(await readPidTable(locations), []);
  } finally {
    tableRewrite?.close();
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChild(child);
    await reapOrphans(locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "does not inject an exit two whose streams are empty or absent",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-empty-exit-two-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:40:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-empty-exit-two", true);
    const pi = createPi();
    const child = createChild(24_689, { stdout: "absent", stderr: "absent" });
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(
        createEntry(root, {
          handlerDecl: { type: "command", command: "/opt/hooks/empty", timeout: 600 },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-empty-exit-two" },
      );
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.strictEqual(child.child.stdout, null);
      assert.strictEqual(child.child.stderr, null);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("injects ordered stdout on the busy follow-up lane", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdout-busy-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:45:00.000Z"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdout-busy", false);
  const pi = createPi();
  const child = createChild(24_690);
  let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

  try {
    await spawnAndRegister(
      createEntry(root, {
        handlerDecl: {
          type: "command",
          command: "/opt/hooks/stdout",
          timeout: 600,
          rewakeMessage: "",
          rewakeSummary: 17,
        },
      }),
      {},
      context.context,
      pi.pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-stdout-busy" },
    );
    child.stdout.write("stdout-first-");
    child.stdout.end("stdout-second");
    await once(child.stdout, "end");
    tableRewrite = observeTableRewrite(pidTablePath(locations));

    // act
    child.emitExit(2);
    child.emitClose();
    await tableRewrite.completion;
    tableRewrite.close();
    t.mock.timers.tick(605_000);

    // assert
    assert.deepStrictEqual(pi.messages, [
      {
        message: {
          customType: "claude-hook-rewake",
          content: "stdout-first-stdout-second",
          display: false,
          details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-stdout-busy" },
        },
        options: { deliverAs: "followUp" },
      },
    ]);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
  } finally {
    tableRewrite?.close();
    shutdownInMemoryChildren();
    resetRoutingState();
    destroyChild(child);
    await reapOrphans(locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "preserves each stream order while stderr wins interleaved output",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-interleaved-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:50:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-interleaved", true);
    const pi = createPi();
    const child = createChild(24_691);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-interleaved",
      });
      child.stdout.write("stdout-one-");
      child.stderr.write("stderr-one-");
      child.stdout.end("stdout-two");
      child.stderr.end("stderr-two");
      await Promise.all([once(child.stdout, "end"), once(child.stderr, "end")]);
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: "Review finding:\n\nstderr-one-stderr-two",
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-interleaved" },
          },
          options: { deliverAs: "nextTurn" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "frames truncated stderr before the surviving tail and rewake message",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-truncated-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:55:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-truncated", true);
    const pi = createPi();
    const child = createChild(24_692);
    const survivingTail = "x".repeat(65_536);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-truncated",
      });
      child.stderr.end(Buffer.from(`d${survivingTail}`));
      await once(child.stderr, "end");
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: `Review finding:\n\n[…truncated]\n${survivingTail}`,
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-truncated" },
          },
          options: { deliverAs: "nextTurn" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "waits for late stdio after exit before settling exactly once",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-exit-before-close-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:00:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-exit-before-close", true);
    const pi = createPi();
    const child = createChild(24_693);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(
        createEntry(root, {
          handlerDecl: {
            type: "command",
            command: "/opt/hooks/early-exit",
            timeout: 600,
            rewakeMessage: "",
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: createSpawn(child.child, []),
          dispatchId: () => "dispatch-exit-before-close",
        },
      );
      child.stdout.write("available-before-exit");
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      const messagesAfterExit = [...pi.messages];
      const stdoutEnd = once(child.stdout, "end");
      child.stdout.end("-after-exit");
      child.stderr.end();
      await Promise.all([stdoutEnd, once(child.stderr, "end")]);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(messagesAfterExit, []);
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: "available-before-exit-after-exit",
            display: false,
            details: {
              pluginId: "plugin-lifecycle",
              dispatchId: "dispatch-exit-before-close",
            },
          },
          options: { deliverAs: "nextTurn" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "contains a notification failure without changing silent settlement",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-notify-failure-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:05:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(
      root,
      "session-notify-failure",
      true,
      new Error("UI unavailable"),
    );
    const pi = createPi();
    const child = createChild(24_694);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-notify-failure",
      });
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(0);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "contains a send failure after an exit-two body is ready",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-send-failure-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:10:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-send-failure", true);
    const pi = createPi();
    pi.setSendError(new Error("message queue unavailable"));
    const child = createChild(24_695);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(
        createEntry(root, {
          handlerDecl: {
            type: "command",
            command: "/opt/hooks/send-failure",
            timeout: 600,
            rewakeMessage: "Send finding:",
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-send-failure" },
      );
      child.stderr.end("send body");
      await once(child.stderr, "end");
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "discards a stale child after the routing epoch advances",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-stale-epoch-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:15:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-stale-epoch", true);
    const pi = createPi();
    const child = createChild(24_696);
    let tableRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-stale-epoch",
      });
      child.stderr.end("stale output");
      await once(child.stderr, "end");
      bumpEpoch();
      tableRewrite = observeTableRewrite(pidTablePath(locations));

      // act
      child.emitExit(2);
      child.emitClose();
      await tableRewrite.completion;
      tableRewrite.close();
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      tableRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(child);
      await reapOrphans(locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "keeps a same-root sibling persisted while one child settles",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-same-root-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:20:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const firstLocations = locationsFor("project", root);
    const equalRootLocations = locationsFor("project", root);
    const context = createContext(root, "session-same-root", true);
    const pi = createPi();
    const firstChild = createChild(24_697);
    const secondChild = createChild(24_698);
    let firstRewrite: ReturnType<typeof observeTableRewrite> | undefined;
    let secondRewrite: ReturnType<typeof observeTableRewrite> | undefined;

    try {
      await spawnAndRegister(
        createEntry(root, {
          pluginId: "plugin-first",
          handlerDecl: { type: "command", command: "/opt/hooks/first", timeout: 600 },
        }),
        {},
        context.context,
        pi.pi,
        firstLocations,
        { spawnImpl: createSpawn(firstChild.child, []), dispatchId: () => "dispatch-first" },
      );
      await spawnAndRegister(
        createEntry(root, {
          pluginId: "plugin-second",
          handlerDecl: { type: "command", command: "/opt/hooks/second", timeout: 600 },
        }),
        {},
        context.context,
        pi.pi,
        equalRootLocations,
        { spawnImpl: createSpawn(secondChild.child, []), dispatchId: () => "dispatch-second" },
      );
      const registeredEntries = await readPidTable(firstLocations);
      firstRewrite = observeTableRewrite(pidTablePath(firstLocations));

      // act
      firstChild.emitExit(0);
      firstChild.emitClose();
      await firstRewrite.completion;
      firstRewrite.close();
      const entriesAfterFirstExit = await readPidTable(firstLocations);
      secondRewrite = observeTableRewrite(pidTablePath(firstLocations));
      secondChild.emitError(new Error("second child terminal error"));
      await secondRewrite.completion;
      secondRewrite.close();
      const finalEntries = await readPidTable(firstLocations);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(registeredEntries, [
        {
          pid: 24_697,
          dispatchId: "dispatch-first",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-first",
          spawnedAt: "2026-08-31T11:20:00.000Z",
        },
        {
          pid: 24_698,
          dispatchId: "dispatch-second",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-second",
          spawnedAt: "2026-08-31T11:20:00.000Z",
        },
      ]);
      assert.deepStrictEqual(entriesAfterFirstExit, [
        {
          pid: 24_698,
          dispatchId: "dispatch-second",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-second",
          spawnedAt: "2026-08-31T11:20:00.000Z",
        },
      ]);
      assert.deepStrictEqual(finalEntries, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.strictEqual(timers.handles.length, 4);
      assert.deepStrictEqual(firstChild.signals, []);
      assert.deepStrictEqual(secondChild.signals, []);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
    } finally {
      firstRewrite?.close();
      secondRewrite?.close();
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(firstChild);
      destroyChild(secondChild);
      await reapOrphans(firstLocations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "reload shutdown clears cross-scope children despite one kill failure",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-cross-scope-"));
    const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (previousAgentDir === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousAgentDir;
      }
    });
    const agentRoot = path.join(root, "agent");
    process.env.PI_CODING_AGENT_DIR = agentRoot;
    const timers = observeTimers(t, Date.parse("2026-08-31T11:25:00.000Z"));
    resetRoutingState();
    shutdownInMemoryChildren();
    const userLocations = locationsFor("user", root);
    const projectLocations = locationsFor("project", root);
    const userContext = createContext(root, "session-user-scope", true);
    const projectContext = createContext(root, "session-project-scope", true);
    const pi = createPi();
    const userChild = createChild(24_699, { killError: new Error("user child already gone") });
    const projectChild = createChild(24_700);

    try {
      await spawnAndRegister(
        createEntry(root, {
          scope: "user",
          marketplace: "catalog-user",
          pluginId: "plugin-user",
          handlerDecl: { type: "command", command: "/opt/hooks/user", timeout: 600 },
        }),
        {},
        userContext.context,
        pi.pi,
        userLocations,
        { spawnImpl: createSpawn(userChild.child, []), dispatchId: () => "dispatch-user" },
      );
      await spawnAndRegister(
        createEntry(root, {
          scope: "project",
          marketplace: "catalog-project",
          pluginId: "plugin-project",
          handlerDecl: { type: "command", command: "/opt/hooks/project", timeout: 600 },
        }),
        {},
        projectContext.context,
        pi.pi,
        projectLocations,
        { spawnImpl: createSpawn(projectChild.child, []), dispatchId: () => "dispatch-project" },
      );
      const userEntries = await readPidTable(userLocations);
      const projectEntries = await readPidTable(projectLocations);

      // act
      shutdownInMemoryChildren();
      shutdownInMemoryChildren();
      t.mock.timers.tick(605_000);
      await reapOrphans(userLocations, deadOrphanProbes());
      await reapOrphans(projectLocations, deadOrphanProbes());
      const userTableState = await stat(pidTablePath(userLocations)).catch(filesystemErrorCode);
      const projectTableState = await stat(pidTablePath(projectLocations)).catch(
        filesystemErrorCode,
      );

      // assert
      assert.deepStrictEqual(userEntries, [
        {
          pid: 24_699,
          dispatchId: "dispatch-user",
          scope: "user",
          marketplace: "catalog-user",
          plugin: "plugin-user",
          spawnedAt: "2026-08-31T11:25:00.000Z",
        },
      ]);
      assert.deepStrictEqual(projectEntries, [
        {
          pid: 24_700,
          dispatchId: "dispatch-project",
          scope: "project",
          marketplace: "catalog-project",
          plugin: "plugin-project",
          spawnedAt: "2026-08-31T11:25:00.000Z",
        },
      ]);
      assert.deepStrictEqual(userChild.signals, ["SIGKILL"]);
      assert.deepStrictEqual(projectChild.signals, ["SIGKILL"]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.strictEqual(timers.handles.length, 4);
      assert.strictEqual(userTableState, "ENOENT");
      assert.strictEqual(projectTableState, "ENOENT");
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(userContext.notifications, []);
      assert.deepStrictEqual(projectContext.notifications, []);
    } finally {
      shutdownInMemoryChildren();
      resetRoutingState();
      destroyChild(userChild);
      destroyChild(projectChild);
      await reapOrphans(userLocations, deadOrphanProbes());
      await reapOrphans(projectLocations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("uses the real spawn and generated dispatch ID at the default boundary", async () => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-default-spawn-"));
  resetRoutingState();
  shutdownInMemoryChildren();
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-default-spawn", true);
  const pi = createPi();
  const entry = createEntry(root, {
    handlerDecl: {
      type: "command",
      command: process.execPath,
      args: ["-e", "setInterval(() => undefined, 1000)"],
      timeout: 600,
      asyncRewake: true,
    },
  });

  try {
    // act
    await spawnAndRegister(entry, {}, context.context, pi.pi, locations);
    const registeredEntries = await readPidTable(locations);
    shutdownInMemoryChildren();
    await reapOrphans(locations, deadOrphanProbes());
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

    // assert
    assert.strictEqual(registeredEntries.length, 1);
    assert.ok((registeredEntries[0]?.pid ?? 0) > 0);
    assert.match(
      registeredEntries[0]?.dispatchId ?? "",
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.deepStrictEqual(
      {
        scope: registeredEntries[0]?.scope,
        marketplace: registeredEntries[0]?.marketplace,
        plugin: registeredEntries[0]?.plugin,
      },
      { scope: "project", marketplace: "catalog-lifecycle", plugin: "plugin-lifecycle" },
    );
    assert.match(
      registeredEntries[0]?.spawnedAt ?? "",
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren();
    resetRoutingState();
    await reapOrphans(locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

function setCasePlatform(t: TestContext, platform: NodeJS.Platform): void {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  if (descriptor === undefined) {
    throw new Error("process.platform descriptor is unavailable");
  }

  t.after(() => {
    Object.defineProperty(process, "platform", descriptor);
  });
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
}

test(
  "kills a Linux orphan only after liveness and exact marker proof",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-owned-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_001,
        dispatchId: "dispatch-owned",
        scope: "project",
        marketplace: "catalog-owned",
        plugin: "plugin-owned",
        spawnedAt: "2026-08-31T11:30:00.000Z",
      },
    ]);
    const calls: Array<
      | { readonly kind: "kill"; readonly pid: number; readonly signal: number | NodeJS.Signals }
      | { readonly kind: "environ"; readonly pid: number }
    > = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ kind: "kill", pid, signal });
      },
      environReader(pid): Promise<string> {
        calls.push({ kind: "environ", pid });
        return Promise.resolve(
          `BROKEN\0OTHER=value\0${MARKER_ENV}=dispatch-owned\0${MARKER_ENV}_SUFFIX=ignored`,
        );
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { kind: "kill", pid: 31_001, signal: 0 },
        { kind: "environ", pid: 31_001 },
        { kind: "kill", pid: 31_001, signal: "SIGKILL" },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "soft-skips Linux orphans with mismatched and absent markers",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-mismatch-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_002,
        dispatchId: "dispatch-expected",
        scope: "project",
        marketplace: "catalog-mismatch",
        plugin: "plugin-mismatch",
        spawnedAt: "2026-08-31T11:35:00.000Z",
      },
      {
        pid: 31_003,
        dispatchId: "dispatch-missing",
        scope: "project",
        marketplace: "catalog-missing",
        plugin: "plugin-missing",
        spawnedAt: "2026-08-31T11:35:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
      },
      environReader(pid): Promise<string> {
        return Promise.resolve(
          pid === 31_002 ? `${MARKER_ENV}=dispatch-other\0OTHER=x` : "OTHER=x\0NO_EQUALS",
        );
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_002, signal: 0 },
        { pid: 31_003, signal: 0 },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "soft-skips a Linux orphan when its marker cannot be read",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-read-failure-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_004,
        dispatchId: "dispatch-read-failure",
        scope: "project",
        marketplace: "catalog-read-failure",
        plugin: "plugin-read-failure",
        spawnedAt: "2026-08-31T11:40:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
      },
      environReader(): Promise<string> {
        return Promise.reject(new Error("proc environ unavailable"));
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [{ pid: 31_004, signal: 0 }]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "treats permission-denied liveness as alive before marker proof",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-permission-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_005,
        dispatchId: "dispatch-permission",
        scope: "project",
        marketplace: "catalog-permission",
        plugin: "plugin-permission",
        spawnedAt: "2026-08-31T11:45:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
        if (signal === 0) {
          const error = new Error("permission denied") as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        }
      },
      environReader(): Promise<string> {
        return Promise.resolve(`${MARKER_ENV}=dispatch-permission`);
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_005, signal: 0 },
        { pid: 31_005, signal: "SIGKILL" },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("skips dead and unprobeable orphan PIDs", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-dead-"));
  setCasePlatform(t, "linux");
  const locations = locationsFor("project", root);
  await writePidTable(locations, [
    {
      pid: 31_006,
      dispatchId: "dispatch-dead",
      scope: "project",
      marketplace: "catalog-dead",
      plugin: "plugin-dead",
      spawnedAt: "2026-08-31T11:50:00.000Z",
    },
    {
      pid: 31_007,
      dispatchId: "dispatch-unprobeable",
      scope: "project",
      marketplace: "catalog-unprobeable",
      plugin: "plugin-unprobeable",
      spawnedAt: "2026-08-31T11:50:00.000Z",
    },
  ]);
  const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
  const probes = {
    killProbe(pid, signal): never {
      calls.push({ pid, signal });
      const error = new Error(
        pid === 31_006 ? "no such process" : "probe failed",
      ) as NodeJS.ErrnoException;
      error.code = pid === 31_006 ? "ESRCH" : "EIO";
      throw error;
    },
    environReader(): Promise<string> {
      throw new Error("failed liveness must not inspect environ");
    },
  } satisfies OrphanProbes;

  try {
    // act
    await reapOrphans(locations, probes);
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

    // assert
    assert.deepStrictEqual(calls, [
      { pid: 31_006, signal: 0 },
      { pid: 31_007, signal: 0 },
    ]);
    assert.strictEqual(tableState, "ENOENT");
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "soft-skips an alive orphan when marker proof is unavailable off Linux",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-nonlinux-"));
    setCasePlatform(t, "darwin");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_008,
        dispatchId: "dispatch-nonlinux",
        scope: "project",
        marketplace: "catalog-nonlinux",
        plugin: "plugin-nonlinux",
        spawnedAt: "2026-08-31T11:55:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
      },
      environReader(): Promise<string> {
        throw new Error("non-Linux must not inspect environ");
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [{ pid: 31_008, signal: 0 }]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "contains an owned orphan kill failure and still unlinks the table",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-kill-failure-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_009,
        dispatchId: "dispatch-kill-failure",
        scope: "project",
        marketplace: "catalog-kill-failure",
        plugin: "plugin-kill-failure",
        spawnedAt: "2026-08-31T12:00:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
        if (signal === "SIGKILL") {
          throw new Error("owned process exited before kill");
        }
      },
      environReader(): Promise<string> {
        return Promise.resolve(`${MARKER_ENV}=dispatch-kill-failure`);
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_009, signal: 0 },
        { pid: 31_009, signal: "SIGKILL" },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "uses default probes behind a mocked signal boundary without killing a process",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-default-probes-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: process.pid,
        dispatchId: "dispatch-that-cannot-match-this-test-process",
        scope: "project",
        marketplace: "catalog-default-probes",
        plugin: "plugin-default-probes",
        spawnedAt: "2026-08-31T12:05:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    t.mock.method(process, "kill", (pid: number, signal?: number | NodeJS.Signals): true => {
      calls.push({ pid, signal: signal ?? "SIGTERM" });
      return true;
    });

    try {
      // act
      await reapOrphans(locations);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [{ pid: process.pid, signal: 0 }]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
