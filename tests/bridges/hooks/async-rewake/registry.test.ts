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
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  MARKER_ENV,
  reapOrphans,
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import { resetRoutingState } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import { asAbsolutePluginRoot } from "../../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { SpawnDeps } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { RoutingEntry } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
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
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
}

interface ContextHarness {
  readonly context: ExtensionContext;
  readonly notifications: Array<{
    readonly text: string;
    readonly severity: "info" | "warning" | "error" | undefined;
  }>;
}

interface PiHarness {
  readonly pi: ExtensionAPI;
  readonly messages: Array<{ readonly message: unknown; readonly options: unknown }>;
}

interface TimerObservation {
  readonly clearHandles: Array<ReturnType<typeof setTimeout>>;
  readonly handles: Array<ReturnType<typeof setTimeout>>;
}

function createChild(pid: number, stdin: PassThrough | null = new PassThrough()): ChildHarness {
  const events = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdio: ChildProcess["stdio"] = [stdin, stdout, stderr, undefined, undefined];
  const signals: Array<number | NodeJS.Signals> = [];
  let exitCode: number | null = null;
  let signalCode: NodeJS.Signals | null = null;
  let killed = false;
  const child = Object.assign(events, {
    stdin,
    stdout,
    stderr,
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
    emitExit(code, signal = null): void {
      exitCode = code;
      signalCode = signal;
      events.emit("exit", code, signal);
    },
  };
}

function createContext(root: string, sessionId: string, idle: boolean): ContextHarness {
  const notifications: ContextHarness["notifications"] = [];
  const sessionManager = SessionManager.inMemory(root, { id: sessionId });
  const ui = {
    notify(text: string, severity?: "info" | "warning" | "error"): void {
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

  return { context, notifications };
}

function createPi(): PiHarness {
  const messages: PiHarness["messages"] = [];
  const sendMessage: ExtensionAPI["sendMessage"] = (message, options) => {
    messages.push({ message, options });
  };

  const pi = { sendMessage } as ExtensionAPI;

  return { pi, messages };
}

function createEntry(root: string): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog-lifecycle",
    pluginId: "plugin-lifecycle",
    resolvedSource: asAbsolutePluginRoot(path.join(root, "plugin-source")),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "Bash",
    handlerDecl: {
      type: "command",
      command: "/opt/hooks/scan",
      args: ["--policy", "strict"],
      timeout: 600,
      asyncRewake: true,
      rewakeMessage: "Review finding:",
      rewakeSummary: "scan complete",
    },
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
  const child = createChild(24_681, null);
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
