import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test, type TestContext } from "node:test";
import { isDeepStrictEqual } from "node:util";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  pidTablePath,
  readPidTable,
  writePidTable,
  type PidTableEntry,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import {
  reapOrphans,
  shutdownInMemoryChildren,
  spawnAndRegister,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import { createHooksRuntime } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { asAbsolutePluginRoot } from "../../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createJsonCapture } from "../../../edge/json-capture.ts";
import { createHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { useAllowlistedProcessEnvironment } from "../../../platform/process-environment.ts";

import type {
  OrphanProbes,
  SpawnDeps,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts";
import type { UserPromptExpansionEvent } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts";
import type { RoutingEntry } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { HooksRuntime } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { BucketAEvent } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { ChildProcess, SpawnOptions } from "node:child_process";

const PLAIN_ANSWER =
  '{"systemMessage":"remember","hookSpecificOutput":{"additionalContext":"context"}}';

for (const eventName of ["PostToolUse", "PostToolUseFailure"] as const) {
  test(`serializes translated Read input for ${eventName} rewake`, async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), "async-read-input-"));
    const runtime = createHooksRuntime();
    const locations = locationsFor("project", root);
    const child = createChild(31_090);
    const chunks: Buffer[] = [];
    child.stdin?.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    });
    const stdinEnd = child.stdin === null ? Promise.resolve([]) : once(child.stdin, "end");
    t.after(async () => {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });

    await spawnAndRegister(
      runtime,
      createEntry(root, { claudeEvent: eventName }),
      {
        type: "tool_result",
        toolCallId: "read-rewake",
        toolName: "read",
        input: { path: "missing.txt" },
        content: [{ type: "text", text: "missing file" }],
        isError: eventName === "PostToolUseFailure",
        details: undefined,
      },
      createContext(root, "read-rewake-session", true).context,
      createPi().pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "read-rewake-dispatch" },
    );
    await stdinEnd;

    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const common = {
      session_id: "read-rewake-session",
      transcript_path: "",
      cwd: root,
      hook_event_name: eventName,
      tool_name: "Read",
      tool_input: { file_path: path.join(root, "missing.txt") },
      tool_use_id: "read-rewake",
    };
    assert.deepStrictEqual(
      payload,
      eventName === "PostToolUse"
        ? {
            ...common,
            tool_response: {
              type: "text",
              file: {
                filePath: path.join(root, "missing.txt"),
                content: "missing file",
                startLine: 1,
                numLines: 1,
                totalLines: 1,
              },
            },
          }
        : { ...common, error: "missing file", is_interrupt: false },
    );
  });
}

test("D-PG6-19: serializes the UserPromptExpansion stdin for a background hook", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-expansion-"));
  const runtime = createHooksRuntime();
  const locations = locationsFor("project", root);
  const child = createChild(31_091);
  const chunks: Buffer[] = [];
  child.stdin?.on("data", (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk));
  });
  const stdinEnd = child.stdin === null ? Promise.resolve([]) : once(child.stdin, "end");
  t.after(async () => {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true });
  });
  const event = {
    command_name: "demo:deploy",
    command_args: "staging",
    command_source: "plugin",
    input: { type: "input", text: "/demo:deploy staging", source: "interactive" },
  } satisfies UserPromptExpansionEvent;

  // act
  await spawnAndRegister(
    runtime,
    createEntry(root, { claudeEvent: "UserPromptExpansion" }),
    event,
    createContext(root, "expansion-session", true).context,
    createPi().pi,
    locations,
    { spawnImpl: createSpawn(child.child, []), dispatchId: () => "expansion-dispatch" },
  );
  await stdinEnd;
  const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  // assert
  assert.deepStrictEqual(payload, {
    session_id: "expansion-session",
    transcript_path: "",
    cwd: root,
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "demo:deploy",
    command_args: "staging",
    command_source: "plugin",
    prompt: "/demo:deploy staging",
  });
});

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
}

for (const scenario of [
  {
    name: "json",
    mode: "json",
    failure: "none",
    summary: "scan complete",
    emits: true,
    injects: true,
  },
  {
    name: "rpc",
    mode: "rpc",
    failure: "none",
    summary: "scan complete",
    emits: true,
    injects: true,
  },
  {
    name: "empty summary",
    mode: "json",
    failure: "none",
    summary: "",
    emits: false,
    injects: true,
  },
  {
    name: "whitespace summary",
    mode: "rpc",
    failure: "none",
    summary: " \n",
    emits: true,
    injects: true,
  },
  {
    name: "append failure",
    mode: "json",
    failure: "append",
    summary: "scan complete",
    emits: true,
    injects: true,
  },
  {
    name: "stale append getter",
    mode: "json",
    failure: "sink",
    summary: "scan complete",
    emits: false,
    injects: true,
  },
  {
    name: "unsupported mode",
    mode: "unknown",
    failure: "none",
    summary: "scan complete",
    emits: false,
    injects: false,
  },
  {
    name: "stale mode",
    mode: "json",
    failure: "mode",
    summary: "scan complete",
    emits: false,
    injects: false,
  },
  {
    name: "stale inventory",
    mode: "json",
    failure: "inventory",
    summary: "scan complete",
    emits: true,
    injects: true,
  },
  {
    name: "stale generation",
    mode: "json",
    failure: "generation",
    summary: "scan complete",
    emits: false,
    injects: false,
  },
]) {
  test(`settles rewake with ${scenario.name} and persists terminal cleanup`, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-machine-"));
    const runtime = createHooksRuntime();
    const locations = locationsFor("project", root);
    const capture = createJsonCapture();
    const host = createPi();
    const baseContext = createContext(root, "machine-session", true);
    let terminal = false;
    const context = new Proxy(baseContext.context, {
      get(target, property): unknown {
        if (property === "mode") {
          if (terminal && scenario.failure === "mode") {
            throw new Error("stale mode");
          }

          return scenario.mode;
        }

        if (property === "ui") {
          return capture.ui;
        }

        return Reflect.get(target, property);
      },
    });
    const inventory = t.mock.fn(() => {
      if (scenario.failure === "inventory") {
        throw new Error("stale inventory");
      }

      return [];
    });
    const pi = {
      ...host.pi,
      getAllTools: inventory,
      get appendEntry(): ExtensionAPI["appendEntry"] {
        if (scenario.failure === "sink") {
          throw new Error("stale sink");
        }

        return (customType, payload) => {
          capture.entrySink.appendEntry(customType, payload);
          if (scenario.failure === "append") {
            throw new Error("entry unavailable before bind");
          }
        };
      },
    };
    const child = createChild(31_001);
    t.after(async () => {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await waitForPidTable(locations, []);
      await rm(root, { recursive: true, force: true });
    });
    const entry = createEntry(root);
    await spawnAndRegister(
      runtime,
      {
        ...entry,
        handlerDecl: { ...entry.handlerDecl, rewakeSummary: scenario.summary },
      },
      {},
      context,
      pi,
      locations,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "machine-dispatch",
      },
    );
    assert.strictEqual((await readPidTable(locations)).length, 1);
    child.stderr.write("finding");
    if (scenario.failure === "generation") {
      runtime.advanceGeneration();
    }

    terminal = true;

    // act
    child.emitExit(2);
    child.emitClose();
    await waitForPidTable(locations, []);

    // assert
    assert.deepStrictEqual(await readPidTable(locations), []);
    assert.strictEqual(runtime.takeChild("machine-dispatch"), undefined);
    assert.deepStrictEqual(
      host.messages,
      scenario.injects
        ? [
            {
              message: {
                customType: "claude-hook-rewake",
                content: "Review finding: finding",
                display: false,
                details: { pluginId: "plugin-lifecycle", dispatchId: "machine-dispatch" },
              },
              options: { triggerTurn: true, deliverAs: "steer" },
            },
          ]
        : [],
    );
    assert.deepStrictEqual(
      capture.entries,
      scenario.emits
        ? [
            {
              customType: "claude-plugin",
              payload: {
                schemaVersion: 1,
                origin: { kind: "hook" },
                kind: "async-rewake-summary",
                severity: "info",
                needsReload: false,
                text: scenario.summary,
              },
            },
          ]
        : [],
    );
    assert.strictEqual(
      inventory.mock.callCount(),
      ["mode", "generation"].includes(scenario.failure) || scenario.mode === "unknown" ? 0 : 3,
    );
    capture.assertValid();
  });
}

for (const ending of [
  { name: "exit 2", code: 2, signal: null, stdout: PLAIN_ANSWER, sent: ["remember", "context"] },
  { name: "exit 0", code: 0, signal: null, stdout: PLAIN_ANSWER, sent: ["remember", "context"] },
  {
    name: "a signal",
    code: null,
    signal: "SIGTERM",
    stdout: PLAIN_ANSWER,
    sent: ["remember", "context"],
  },
  { name: "plain stdout", code: 0, signal: null, stdout: "plain text", sent: [] },
] as const) {
  test(`gives a plain async hook's answer to the next call after ${ending.name}`, async () => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-plain-"));
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-plain", true);
    const pi = createPi();
    const child = createChild(24_701);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          claudeEvent: "UserPromptSubmit",
          handlerDecl: {
            type: "command",
            command: "/opt/hooks/note",
            timeout: 600,
            async: true,
            rewakeSummary: "never shown",
          },
        }),
        { type: "input", text: "prompt", source: "interactive" },
        context.context,
        pi.pi,
        locations,
        { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-plain" },
      );
      child.stdout.end(ending.stdout);
      await once(child.stdout, "end");

      // act
      child.emitExit(ending.code, ending.signal);
      child.emitClose(ending.code, ending.signal);
      await waitForPidTable(locations, []);

      // assert
      assert.deepStrictEqual(
        pi.messages,
        ending.sent.map((content) => ({
          message: {
            customType: "claude-hook-async-response",
            content,
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-plain" },
          },
          options: { deliverAs: "nextTurn" },
        })),
      );
      assert.deepStrictEqual(context.notifications, []);
      assert.strictEqual(runtime.isStopHookActive(), false);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });
}

test("contains a send failure of a plain async hook's answer", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-plain-fail-"));
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-plain-fail", true);
  const pi = createPi();
  pi.setSendError(new Error("send unavailable"));
  const child = createChild(24_702);

  try {
    await spawnAndRegister(
      runtime,
      createEntry(root, {
        handlerDecl: { type: "command", command: "/opt/hooks/note", timeout: 600, async: true },
      }),
      {},
      context.context,
      pi.pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-plain-fail" },
    );
    child.stdout.end(PLAIN_ANSWER);
    await once(child.stdout, "end");

    // act
    child.emitExit(0);
    child.emitClose();
    await waitForPidTable(locations, []);

    // assert
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

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

interface ControlledPidTableWrite {
  readonly completion: Promise<void>;
  readonly entries: readonly PidTableEntry[];
  reject(error: Error): void;
  release(): void;
}

interface ControlledPidTableWriter {
  readonly maxActiveWrites: number;
  readonly writesStarted: number;
  readonly writer: NonNullable<SpawnDeps["pidTableWriter"]>;
  releaseAll(): void;
  waitForWrite(index: number): Promise<ControlledPidTableWrite>;
}

interface ChildOptions {
  readonly stdin?: PassThrough | null;
  readonly stdout?: "absent";
  readonly stderr?: "absent";
  readonly killError?: Error;
  readonly killReturnsFalse?: boolean;
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

      if (options.killReturnsFalse === true) {
        return false;
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
  // `Object.assign` copies each getter's value once, so the exit state is
  // defined again as live accessors, as a `ChildProcess` reports it.
  Object.defineProperties(child, {
    exitCode: { configurable: true, enumerable: true, get: () => exitCode },
    signalCode: { configurable: true, enumerable: true, get: () => signalCode },
    killed: { configurable: true, enumerable: true, get: () => killed },
  });

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

  const pi = { sendMessage, getAllTools: () => [] } as unknown as ExtensionAPI;

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
    options: resolveOptions(undefined),
  } satisfies RoutingEntry;
}

function createSpawn(child: ChildProcess, calls: SpawnCall[]): NonNullable<SpawnDeps["spawnImpl"]> {
  return ((command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
    calls.push({ command, args: [...args], options });
    return child;
  }) as NonNullable<SpawnDeps["spawnImpl"]>;
}

function createControlledPidTableWriter(): ControlledPidTableWriter {
  const records: ControlledPidTableWrite[] = [];
  const waiters = new Map<number, (record: ControlledPidTableWrite) => void>();
  let activeWrites = 0;
  let maxActiveWrites = 0;
  let releaseFutureWrites = false;

  const writer: NonNullable<SpawnDeps["pidTableWriter"]> = async (loc, entries) => {
    activeWrites += 1;
    maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
    let release!: () => void;
    let fail!: (error: Error) => void;
    const controlled = new Promise<void>((resolve, reject) => {
      release = resolve;
      fail = reject;
    });
    let complete!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const record: ControlledPidTableWrite = {
      completion,
      entries: entries.map((entry) => ({ ...entry })),
      reject: fail,
      release,
    };
    const index = records.push(record) - 1;
    waiters.get(index)?.(record);
    waiters.delete(index);
    if (releaseFutureWrites) {
      record.release();
    }

    try {
      await controlled;
      await writePidTable(loc, entries);
    } finally {
      activeWrites -= 1;
      complete();
    }
  };

  return {
    get maxActiveWrites(): number {
      return maxActiveWrites;
    },
    get writesStarted(): number {
      return records.length;
    },
    writer,
    releaseAll(): void {
      releaseFutureWrites = true;
      for (const record of records) {
        record.release();
      }
    },
    waitForWrite(index): Promise<ControlledPidTableWrite> {
      const record = records[index];
      if (record !== undefined) {
        return Promise.resolve(record);
      }

      return new Promise((resolve) => {
        waiters.set(index, resolve);
      });
    },
  };
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

async function waitForPidTable(
  loc: ReturnType<typeof locationsFor>,
  expected: readonly PidTableEntry[],
): Promise<void> {
  // The registry persists the table after `close` through async file
  // operations it does not await, so the test reads the file until it
  // settles. Wall-clock time is the only bound: a count of attempts is not,
  // because a fast runner exhausts it in a fraction of the deadline.
  const deadline = process.hrtime.bigint() + 2_000_000_000n;
  while (process.hrtime.bigint() < deadline) {
    const entries = await readPidTable(loc);
    if (isDeepStrictEqual(entries, expected)) {
      return;
    }

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }

  assert.deepStrictEqual(await readPidTable(loc), expected, "PID table did not reach exact state");
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

async function foreignJournal(
  loc: ReturnType<typeof locationsFor>,
  entries: readonly PidTableEntry[],
  ownerPid = 42,
): Promise<string> {
  const sessionId = "foreign-session";
  const ownerToken = "foreign-token";
  const key = createHash("sha256")
    .update(JSON.stringify([ownerPid, sessionId, ownerToken]))
    .digest("hex");
  const filePath = path.join(loc.dataRoot, "_shared", "async-rewake-children", `${key}.json`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify({ version: 1, ownerPid, sessionId, ownerToken, entries }),
  );
  return filePath;
}

function foreignRow(): PidTableEntry {
  return {
    pid: 29_151,
    dispatchId: "foreign-dispatch",
    scope: "project",
    marketplace: "catalog",
    plugin: "plugin",
    spawnedAt: "2026-11-13T00:00:00.000Z",
  };
}

test(
  "keeps a waiting parent hook and its table intact while a child hook runs",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-ownership-"));
    const locations = locationsFor("project", root);
    const parentRuntime = createHooksRuntime();
    const childRuntime = createHooksRuntime();
    const parent = createChild(29_101);
    const child = createChild(29_102);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(parentRuntime);
      await shutdownInMemoryChildren(childRuntime);
      destroyChild(parent);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });
    delete process.env.PI_SUBAGENT_CHILD;
    await spawnAndRegister(
      parentRuntime,
      createEntry(root),
      {},
      createContext(root, "parent-session", true).context,
      createPi().pi,
      locations,
      { spawnImpl: createSpawn(parent.child, []), dispatchId: () => "parent-dispatch" },
    );
    const parentBytes = await readFile(pidTablePath(locations));

    // act
    process.env.PI_SUBAGENT_CHILD = "1";
    await spawnAndRegister(
      childRuntime,
      createEntry(root),
      {},
      createContext(root, "child-session", true).context,
      createPi().pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "child-dispatch" },
    );
    await reapOrphans(childRuntime, locations, deadOrphanProbes());
    const parentBytesAfterChild = await readFile(pidTablePath(locations));
    child.stdout.end();
    child.stderr.end();
    await Promise.all([once(child.stdout, "end"), once(child.stderr, "end")]);
    child.emitExit(0);
    child.emitClose();
    const parentBytesAfterExit = await readFile(pidTablePath(locations));

    // assert
    assert.deepStrictEqual(parentBytesAfterChild, parentBytes);
    assert.deepStrictEqual(parentBytesAfterExit, parentBytes);
    assert.deepStrictEqual(
      parentRuntime.pidTableEntries(locations).map((row) => row.dispatchId),
      ["parent-dispatch"],
    );
    assert.deepStrictEqual(parent.signals, []);
  },
);

test(
  "isolates two child runtime journals in one PID through plain and rewake exits",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-siblings-"));
    const loc = locationsFor("project", root);
    const firstRuntime = createHooksRuntime();
    const secondRuntime = createHooksRuntime();
    const first = createChild(29_111);
    const second = createChild(29_112);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(firstRuntime);
      await shutdownInMemoryChildren(secondRuntime);
      destroyChild(first);
      destroyChild(second);
      await rm(root, { recursive: true, force: true });
    });
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");

    // act
    await spawnAndRegister(
      firstRuntime,
      createEntry(root),
      {},
      createContext(root, "shared-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(first.child, []),
        dispatchId: () => "first-child-dispatch",
      },
    );
    await spawnAndRegister(
      secondRuntime,
      createEntry(root, {
        handlerDecl: { type: "command", command: "/opt/hooks/plain", async: true },
      }),
      {},
      createContext(root, "shared-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(second.child, []),
        dispatchId: () => "second-child-dispatch",
      },
    );
    const names = await readdir(journalDir);
    const before = await Promise.all(names.map((name) => readFile(path.join(journalDir, name))));
    const stdoutEnd = once(first.stdout, "end");
    const stderrEnd = once(first.stderr, "end");
    first.stdout.end();
    first.stderr.end();
    await Promise.all([stdoutEnd, stderrEnd]);
    first.emitExit(0);
    first.emitClose();
    const firstName = names.find((_name, index) =>
      before[index]?.toString("utf8").includes("first-child-dispatch"),
    );
    assert.ok(firstName);
    await firstRuntime.runPidTableOperation(path.join(journalDir, firstName), () =>
      Promise.resolve(),
    );
    const remainingNames = await readdir(journalDir);
    const remaining = await readFile(path.join(journalDir, remainingNames[0] ?? ""));

    // assert
    assert.strictEqual(names.length, 2);
    assert.ok(names.every((name) => /^[a-f0-9]{64}\.json$/.test(name)));
    assert.notDeepStrictEqual(before[0], before[1]);
    assert.strictEqual(remainingNames.length, 1);
    assert.match(remaining.toString("utf8"), /second-child-dispatch/);
    assert.deepStrictEqual(await stat(pidTablePath(loc)).catch(filesystemErrorCode), "ENOENT");
    assert.deepStrictEqual(second.signals, []);
  },
);

test(
  "plain async and asyncRewake hooks share their captured runtime journal",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-shared-owner-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const rewake = createChild(29_118);
    const plain = createChild(29_119);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(rewake);
      destroyChild(plain);
      await rm(root, { recursive: true, force: true });
    });
    const ctx = createContext(root, "shared-owner-session", true).context;
    const pi = createPi().pi;
    const event = {
      type: "tool_call",
      toolCallId: "shared-owner-call",
      toolName: "bash",
      input: { command: "printf shared" },
    } satisfies ToolCallEvent;
    const rewakeChunks: Buffer[] = [];
    const plainChunks: Buffer[] = [];
    rewake.stdin?.on("data", (chunk: Buffer) => rewakeChunks.push(Buffer.from(chunk)));
    plain.stdin?.on("data", (chunk: Buffer) => plainChunks.push(Buffer.from(chunk)));
    const rewakeEnd = once(rewake.stdin!, "end");
    const plainEnd = once(plain.stdin!, "end");
    runtime.captureChildIdentity(
      {
        type: "before_agent_start",
        systemPromptOptions: { customPrompt: '<active_agent name="shared-runner"/>\n\n' },
      } as BeforeAgentStartEvent,
      "shared-owner-session",
    );

    // act
    await spawnAndRegister(runtime, createEntry(root), event, ctx, pi, loc, {
      spawnImpl: createSpawn(rewake.child, []),
      dispatchId: () => "rewake-dispatch",
    });
    await spawnAndRegister(
      runtime,
      createEntry(root, {
        handlerDecl: { type: "command", command: "/opt/hooks/plain", async: true },
      }),
      event,
      ctx,
      pi,
      loc,
      {
        spawnImpl: createSpawn(plain.child, []),
        dispatchId: () => "plain-dispatch",
      },
    );
    runtime.captureChildIdentity(
      {
        type: "before_agent_start",
        systemPromptOptions: { customPrompt: '<active_agent name="later-runner"/>\n\n' },
      } as BeforeAgentStartEvent,
      "later-session",
    );
    await Promise.all([rewakeEnd, plainEnd]);
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    const names = await readdir(journalDir);
    const journal: unknown = JSON.parse(
      await readFile(path.join(journalDir, names[0] ?? ""), "utf8"),
    );

    // assert
    assert.strictEqual(names.length, 1);
    const expectedPayload = {
      session_id: "shared-owner-session",
      transcript_path: "",
      cwd: root,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "printf shared" },
      tool_use_id: "shared-owner-call",
      agent_type: "shared-runner",
      agent_id: "shared-owner-session",
    };
    assert.deepStrictEqual(
      JSON.parse(Buffer.concat(rewakeChunks).toString("utf8")),
      expectedPayload,
    );
    assert.deepStrictEqual(
      JSON.parse(Buffer.concat(plainChunks).toString("utf8")),
      expectedPayload,
    );
    assert.deepStrictEqual(
      (journal as { entries: PidTableEntry[] }).entries.map((row) => row.dispatchId),
      ["rewake-dispatch", "plain-dispatch"],
    );
  },
);

// D-PG6-03: two children of one launching session read one `session_id`, and
// each keeps the journal owner of its own session id.
test(
  "keys the journal owners of two children of one launching session by their own sessions",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-rooted-owner-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const children = [createChild(29_121), createChild(29_122)];
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      children.forEach(destroyChild);
      await rm(root, { recursive: true, force: true });
    });
    const launching = {
      sessionId: "launching-session",
      transcriptPath: "/sessions/launching.jsonl",
    };
    const payloads: unknown[] = [];

    // act
    for (const [index, sessionId] of ["first-child", "second-child"].entries()) {
      const harness = children[index];
      assert.ok(harness !== undefined);
      const chunks: Buffer[] = [];
      harness.stdin?.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      const stdinEnd = once(harness.stdin!, "end");
      runtime.captureChildIdentity(
        {
          type: "before_agent_start",
          systemPromptOptions: { customPrompt: '<active_agent name="rooted-runner"/>\n\n' },
        } as BeforeAgentStartEvent,
        sessionId,
      );
      runtime.recordChildRoot(sessionId, launching);
      await spawnAndRegister(
        runtime,
        createEntry(root),
        {
          type: "tool_call",
          toolCallId: `${sessionId}-call`,
          toolName: "bash",
          input: { command: "printf rooted" },
        } satisfies ToolCallEvent,
        createContext(root, sessionId, true).context,
        createPi().pi,
        loc,
        { spawnImpl: createSpawn(harness.child, []), dispatchId: () => `${sessionId}-dispatch` },
      );
      await stdinEnd;
      payloads.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    }

    // assert
    assert.deepStrictEqual(
      runtime.persistenceOwners().map((owner) => owner.sessionId),
      ["first-child", "second-child"],
    );
    assert.deepStrictEqual(
      payloads,
      ["first-child", "second-child"].map((sessionId) => ({
        session_id: "launching-session",
        transcript_path: "/sessions/launching.jsonl",
        cwd: root,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "printf rooted" },
        tool_use_id: `${sessionId}-call`,
        agent_type: "rooted-runner",
        agent_id: sessionId,
      })),
    );
  },
);

for (const { name, marker, handlerDecl } of [
  {
    name: "main plain async",
    marker: "0",
    handlerDecl: { type: "command", command: "/opt/hooks/plain", async: true },
  },
  {
    name: "main asyncRewake",
    marker: "0",
    handlerDecl: { type: "command", command: "/opt/hooks/rewake", asyncRewake: true },
  },
  {
    name: "unavailable child plain async",
    marker: "1",
    handlerDecl: { type: "command", command: "/opt/hooks/plain", async: true },
  },
  {
    name: "unavailable child asyncRewake",
    marker: "1",
    handlerDecl: { type: "command", command: "/opt/hooks/rewake", asyncRewake: true },
  },
] as const) {
  test(`omits identity from ${name} stdin`, { concurrency: false }, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-identity-absent-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_120);
    const chunks: Buffer[] = [];
    child.stdin?.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    const stdinEnd = once(child.stdin!, "end");
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = marker;
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });

    // act
    await spawnAndRegister(
      runtime,
      createEntry(root, { handlerDecl }),
      {
        type: "tool_call",
        toolCallId: "identity-absent-call",
        toolName: "bash",
        input: { command: "printf absent" },
      } satisfies ToolCallEvent,
      createContext(root, "identity-absent-session", true).context,
      createPi().pi,
      loc,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "identity-absent-dispatch" },
    );
    await stdinEnd;
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    // assert
    assert.deepStrictEqual(payload, {
      session_id: "identity-absent-session",
      transcript_path: "",
      cwd: root,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "printf absent" },
      tool_use_id: "identity-absent-call",
    });
    assert.strictEqual(Object.hasOwn(payload, "agent_type"), false);
    assert.strictEqual(Object.hasOwn(payload, "agent_id"), false);
  });
}

test(
  "a delayed exit after reload removes only its captured session row",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-delayed-exit-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const oldChild = createChild(29_114);
    const newChild = createChild(29_115);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(oldChild);
      destroyChild(newChild);
      await rm(root, { recursive: true, force: true });
    });
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "old-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(oldChild.child, []),
        dispatchId: () => "old-dispatch",
      },
    );
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    const [oldName] = await readdir(journalDir);
    assert.ok(oldName);
    const oldBytes = await readFile(path.join(journalDir, oldName));
    await shutdownInMemoryChildren(runtime);
    // The journal still lists the old row, as when shutdown could not rewrite it.
    await writeFile(path.join(journalDir, oldName), oldBytes);
    runtime.advanceGeneration();
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "new-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(newChild.child, []),
        dispatchId: () => "new-dispatch",
      },
    );
    const before = await readdir(journalDir);
    const newName = before.find((name) => name !== oldName);
    assert.ok(newName);
    const newBytes = await readFile(path.join(journalDir, newName));
    const stdoutEnd = once(oldChild.stdout, "end");
    const stderrEnd = once(oldChild.stderr, "end");
    oldChild.stdout.end();
    oldChild.stderr.end();
    await Promise.all([stdoutEnd, stderrEnd]);

    // act
    oldChild.emitExit(0);
    oldChild.emitClose();
    await runtime.runPidTableOperation(path.join(journalDir, oldName), () => Promise.resolve());

    // assert
    assert.deepStrictEqual(
      await stat(path.join(journalDir, oldName)).catch(filesystemErrorCode),
      "ENOENT",
    );
    assert.deepStrictEqual(await readFile(path.join(journalDir, newName)), newBytes);
    assert.deepStrictEqual(
      runtime.persistenceOwners().map((owner) => owner.sessionId),
      ["new-session"],
    );
  },
);

test("contains a retired child journal cleanup error", { concurrency: false }, async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-retired-error-"));
  const loc = locationsFor("project", root);
  const innerRuntime = createHooksRuntime();
  let rejectOperations = false;
  const runtime = new Proxy(innerRuntime, {
    get(target, property, receiver): unknown {
      if (property === "runPidTableOperation" && rejectOperations) {
        return (): Promise<void> => Promise.reject(new Error("journal unavailable"));
      }

      return Reflect.get(target, property, receiver);
    },
  });
  const child = createChild(29_116);
  const previousMarker = process.env.PI_SUBAGENT_CHILD;
  process.env.PI_SUBAGENT_CHILD = "1";
  t.after(async () => {
    if (previousMarker === undefined) {
      delete process.env.PI_SUBAGENT_CHILD;
    } else {
      process.env.PI_SUBAGENT_CHILD = previousMarker;
    }

    rejectOperations = false;
    await shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true });
  });
  await spawnAndRegister(
    runtime,
    createEntry(root),
    {},
    createContext(root, "retired-session", true).context,
    createPi().pi,
    loc,
    {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "retired-dispatch",
    },
  );
  const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
  const [name] = await readdir(journalDir);
  assert.ok(name);
  const journalBytes = await readFile(path.join(journalDir, name));
  await shutdownInMemoryChildren(runtime);
  // The journal still lists the retired row, as when shutdown could not rewrite it.
  await writeFile(path.join(journalDir, name), journalBytes);
  const stdoutEnd = once(child.stdout, "end");
  const stderrEnd = once(child.stderr, "end");
  child.stdout.end();
  child.stderr.end();
  await Promise.all([stdoutEnd, stderrEnd]);
  rejectOperations = true;

  // act
  child.emitExit(0);
  child.emitClose();
  await new Promise<void>((resolve) => setImmediate(resolve));

  // assert
  assert.notStrictEqual(
    await stat(path.join(journalDir, name)).catch(filesystemErrorCode),
    "ENOENT",
  );
});

test(
  "a retired child's late exit tolerates an already removed journal",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-retired-absent-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_117);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "retired-absent-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "retired-absent-dispatch",
      },
    );
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    const [name] = await readdir(journalDir);
    assert.ok(name);
    await shutdownInMemoryChildren(runtime);
    const stdoutEnd = once(child.stdout, "end");
    const stderrEnd = once(child.stderr, "end");
    child.stdout.end();
    child.stderr.end();
    await Promise.all([stdoutEnd, stderrEnd]);

    // act
    child.emitExit(0);
    child.emitClose();
    await runtime.runPidTableOperation(path.join(journalDir, name), () => Promise.resolve());

    // assert
    assert.deepStrictEqual(await readdir(journalDir), []);
  },
);

test(
  "preserves a real waiting parent process through a real child spawn and exit",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-real-parent-child-"));
    const loc = locationsFor("project", root);
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    await mkdir(journalDir, { recursive: true });
    const parentRuntime = createHooksRuntime();
    const childRuntime = createHooksRuntime();
    t.after(async () => {
      await shutdownInMemoryChildren(parentRuntime);
      await shutdownInMemoryChildren(childRuntime);
      await rm(root, { recursive: true, force: true });
    });
    useAllowlistedProcessEnvironment(t, ["HOME", "PI_CODING_AGENT_DIR"]);
    const parentEntry = createEntry(root, {
      handlerDecl: {
        type: "command",
        command: process.execPath,
        args: ["-e", "setInterval(() => undefined, 1000)"],
        async: true,
      },
    });
    await spawnAndRegister(
      parentRuntime,
      parentEntry,
      {},
      createContext(root, "real-parent", true).context,
      createPi().pi,
      loc,
    );
    const parentBytes = await readFile(pidTablePath(loc));
    const [parentRow] = await readPidTable(loc);
    assert.ok(parentRow);
    process.env.PI_SUBAGENT_CHILD = "1";
    const childEntry = createEntry(root, {
      handlerDecl: {
        type: "command",
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
        async: true,
      },
    });

    // act
    await spawnAndRegister(
      childRuntime,
      childEntry,
      {},
      createContext(root, "real-child", true).context,
      createPi().pi,
      loc,
    );
    const [childOwner] = childRuntime.persistenceOwners();
    assert.ok(childOwner);
    const deadline = Date.now() + 3000;
    while (childRuntime.pidTableEntries(loc, childOwner).length > 0) {
      assert.ok(Date.now() < deadline, "real child did not exit and clear its journal");

      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }

    const settlingNames = await readdir(journalDir);
    await Promise.all(
      settlingNames.map((name) =>
        childRuntime.runPidTableOperation(path.join(journalDir, name), () => Promise.resolve()),
      ),
    );
    const names = await readdir(journalDir);
    const parentBytesAfter = await readFile(pidTablePath(loc));
    process.kill(parentRow.pid, 0);

    // assert
    assert.deepStrictEqual(parentBytesAfter, parentBytes);
    assert.deepStrictEqual(names, []);
    assert.deepStrictEqual(
      parentRuntime.pidTableEntries(loc).map((row) => row.pid),
      [parentRow.pid],
    );
  },
);

// D-PG3-07: the three tool events a child dispatches, each with the event Pi
// fires and the fields its translator adds to the common envelope.
const IDENTITY_TOOL_EVENTS = [
  {
    claudeEvent: "PreToolUse",
    event: {
      type: "tool_call",
      toolCallId: "recording-call",
      toolName: "bash",
      input: { command: "pwd" },
    } satisfies ToolCallEvent,
    fields: { tool_name: "Bash", tool_input: { command: "pwd" }, tool_use_id: "recording-call" },
  },
  {
    claudeEvent: "PostToolUse",
    event: {
      type: "tool_result",
      toolCallId: "recording-call",
      toolName: "bash",
      input: { command: "pwd" },
      content: [{ type: "text", text: "recorded\n" }],
      isError: false,
      details: { durationMs: 3 },
    } satisfies ToolResultEvent,
    fields: {
      tool_name: "Bash",
      tool_input: { command: "pwd" },
      tool_use_id: "recording-call",
      tool_response: {
        interrupted: false,
        structuredContent: [{ type: "text", text: "recorded\n" }],
      },
    },
  },
  {
    claudeEvent: "PostToolUseFailure",
    event: {
      type: "tool_result",
      toolCallId: "recording-call",
      toolName: "bash",
      input: { command: "pwd" },
      content: [{ type: "text", text: "pwd failed" }],
      isError: true,
      details: { exitCode: 1 },
    } satisfies ToolResultEvent,
    fields: {
      tool_name: "Bash",
      tool_input: { command: "pwd" },
      tool_use_id: "recording-call",
      error: "pwd failed",
      is_interrupt: false,
    },
  },
] as const;

const IDENTITY_ROLES = [
  {
    role: "child",
    marker: "1",
    identity: { agent_type: "recording-agent", agent_id: "recording-session" },
  },
  { role: "main", marker: "0", identity: {} },
] as const;

const IDENTITY_LANES = [
  { lane: "plain async", background: { async: true } },
  { lane: "asyncRewake", background: { asyncRewake: true } },
] as const;

for (const {
  claudeEvent,
  event,
  fields,
  role,
  marker,
  identity,
  lane,
  background,
} of IDENTITY_TOOL_EVENTS.flatMap((toolEvent) =>
  IDENTITY_ROLES.flatMap((identityRole) =>
    IDENTITY_LANES.map((identityLane) => ({ ...toolEvent, ...identityRole, ...identityLane })),
  ),
)) {
  test(
    `records ${role} ${lane} ${claudeEvent} stdin through a real background process`,
    { concurrency: false, timeout: 15_000 },
    async (t) => {
      // arrange
      const root = await mkdtemp(path.join(tmpdir(), "async-real-identity-"));
      const loc = locationsFor("project", root);
      const runtime = createHooksRuntime();
      const recordingPath = path.join(root, "stdin.json");
      let ready: Promise<unknown[]> | undefined;
      let closed: Promise<unknown[]> | undefined;
      let child: ChildProcess | undefined;
      t.after(async () => {
        await shutdownInMemoryChildren(runtime);
        if (child !== undefined) {
          await closed;
        }

        // The hook's exit queues a PID table write that must land before the removal.
        await runtime.runPidTableOperation(pidTablePath(loc), () => Promise.resolve());

        await rm(root, { recursive: true, force: true });
      });
      useAllowlistedProcessEnvironment(t, ["HOME", "PI_CODING_AGENT_DIR"], {
        PI_SUBAGENT_CHILD: marker,
      });
      const beforeRun: BeforeAgentStartEvent = {
        type: "before_agent_start",
        messageType: "user",
        prompt: "record stdin",
        systemPrompt: "",
        systemPromptOptions: {
          cwd: root,
          customPrompt: '<active_agent name="recording-agent"/>\n\n',
          appendSystemPrompt: "",
          selectedTools: [],
          hiddenTools: [],
          toolSnippets: {},
          toolGuidelines: {},
          promptGuidelines: [],
          sections: {},
          contextFiles: [],
          skills: [],
        },
      };
      runtime.captureChildIdentity(beforeRun, "recording-session");
      const recordingSpawn = t.mock.fn(
        (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
          child = spawn(command, [...args], options);
          assert.ok(child.stdout);
          ready = once(child.stdout, "data");
          closed = once(child, "close");
          return child;
        },
      );
      const entry = createEntry(root, {
        claudeEvent,
        handlerDecl: {
          type: "command",
          command: process.execPath,
          args: [
            "-e",
            'const fs = require("node:fs"); let text = ""; ' +
              'process.on("SIGTERM", () => process.exit(0)); ' +
              "setInterval(() => undefined, 1000); " +
              'process.stdin.setEncoding("utf8"); ' +
              'process.stdin.on("data", (chunk) => { text += chunk; }); ' +
              'process.stdin.on("end", () => { fs.writeFileSync(process.argv[1], text); ' +
              'process.stdout.write("ready"); });',
            recordingPath,
          ],
          ...background,
        },
      });

      // act
      await spawnAndRegister(
        runtime,
        entry,
        event,
        createContext(root, "recording-session", true).context,
        createPi().pi,
        loc,
        // The registry uses only spawn's three-argument overload with piped streams.
        { spawnImpl: recordingSpawn as unknown as NonNullable<SpawnDeps["spawnImpl"]> },
      );
      assert.ok(ready);
      assert.ok(closed);
      await ready;
      runtime.captureChildIdentity(
        {
          ...beforeRun,
          systemPromptOptions: {
            ...beforeRun.systemPromptOptions,
            customPrompt: '<active_agent name="later-agent"/>\n\n',
          },
        },
        "later-session",
      );
      assert.ok(child);
      assert.strictEqual(child.exitCode, null);
      child.kill("SIGTERM");
      const exit = await closed;
      const recorded: unknown = JSON.parse(await readFile(recordingPath, "utf8"));

      // assert
      assert.deepStrictEqual(recorded, {
        session_id: "recording-session",
        transcript_path: "",
        cwd: root,
        hook_event_name: claudeEvent,
        ...fields,
        ...identity,
      });
      assert.strictEqual(Object.hasOwn(recorded as object, "agent_type"), role === "child");
      assert.strictEqual(Object.hasOwn(recorded as object, "agent_id"), role === "child");
      assert.deepStrictEqual(exit, [0, null]);
    },
  );
}

for (const scenario of [
  { name: "live owner", ownerSignal: "alive", marker: "matching", reaped: false },
  { name: "permission-denied owner", ownerSignal: "EPERM", marker: "matching", reaped: false },
  { name: "unknown owner probe", ownerSignal: "EIO", marker: "matching", reaped: false },
  {
    name: "dead owner with wrong hook marker",
    ownerSignal: "ESRCH",
    marker: "wrong",
    reaped: false,
  },
  {
    name: "dead owner with matched hook marker",
    ownerSignal: "ESRCH",
    marker: "matching",
    reaped: process.platform === "linux",
  },
] as const) {
  test(`recovers child journal only for ${scenario.name}`, { concurrency: false }, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-recovery-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_121);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "owner-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "owned-dispatch",
      },
    );
    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    const [name] = await readdir(journalDir);
    assert.ok(name);
    const journalPath = path.join(journalDir, name);
    const journalBytes = await readFile(journalPath);
    delete process.env.PI_SUBAGENT_CHILD;
    const probes: Array<{ pid: number; signal: number | NodeJS.Signals }> = [];

    // act
    await reapOrphans(createHooksRuntime(), loc, {
      killProbe(pid, signal): void {
        probes.push({ pid, signal });
        if (pid === process.pid && signal === 0 && scenario.ownerSignal !== "alive") {
          throw Object.assign(new Error("owner unavailable"), { code: scenario.ownerSignal });
        }
      },
      environReader(): Promise<string> {
        return Promise.resolve(
          `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=${scenario.marker === "matching" ? "owned-dispatch" : "other-dispatch"}\0`,
        );
      },
    });
    const journalState = await stat(journalPath).catch(filesystemErrorCode);

    // assert
    if (scenario.reaped) {
      assert.strictEqual(journalState, "ENOENT");
    } else {
      assert.notStrictEqual(journalState, "ENOENT");
    }

    if (!scenario.reaped) {
      assert.deepStrictEqual(await readFile(journalPath), journalBytes);
    }

    assert.strictEqual(
      probes.some((call) => call.signal === "SIGKILL"),
      scenario.reaped,
    );
  });
}

for (const scenario of [
  { name: "invalid JSON", mutate: () => "{" },
  { name: "null envelope", mutate: () => "null" },
  {
    name: "unknown version",
    mutate: (value: Record<string, unknown>) => JSON.stringify({ ...value, version: 2 }),
  },
  {
    name: "invalid owner PID",
    mutate: (value: Record<string, unknown>) => JSON.stringify({ ...value, ownerPid: -1 }),
  },
  {
    name: "mismatched filename digest",
    mutate: (value: Record<string, unknown>) =>
      JSON.stringify({ ...value, ownerToken: "changed-token" }),
  },
  {
    name: "invalid row",
    mutate: (value: Record<string, unknown>) => JSON.stringify({ ...value, entries: [{ pid: 0 }] }),
  },
  {
    name: "null row",
    mutate: (value: Record<string, unknown>) => JSON.stringify({ ...value, entries: [null] }),
  },
  { name: "oversized file", mutate: () => "x".repeat(1024 * 1024 + 1) },
] as const) {
  test(
    `preserves a foreign child journal with ${scenario.name}`,
    { concurrency: false },
    async (t) => {
      // arrange
      const root = await mkdtemp(path.join(tmpdir(), "async-child-invalid-"));
      const loc = locationsFor("project", root);
      const runtime = createHooksRuntime();
      const child = createChild(29_131);
      const previousMarker = process.env.PI_SUBAGENT_CHILD;
      process.env.PI_SUBAGENT_CHILD = "1";
      t.after(async () => {
        if (previousMarker === undefined) {
          delete process.env.PI_SUBAGENT_CHILD;
        } else {
          process.env.PI_SUBAGENT_CHILD = previousMarker;
        }

        await shutdownInMemoryChildren(runtime);
        destroyChild(child);
        await rm(root, { recursive: true, force: true });
      });
      await spawnAndRegister(
        runtime,
        createEntry(root),
        {},
        createContext(root, "invalid-session", true).context,
        createPi().pi,
        loc,
        {
          spawnImpl: createSpawn(child.child, []),
          dispatchId: () => "invalid-dispatch",
        },
      );
      const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
      const [name] = await readdir(journalDir);
      assert.ok(name);
      const journalPath = path.join(journalDir, name);
      const original: unknown = JSON.parse(await readFile(journalPath, "utf8"));
      assert.ok(original !== null && typeof original === "object");
      const altered = scenario.mutate(original as Record<string, unknown>);
      await writeFile(journalPath, altered);
      delete process.env.PI_SUBAGENT_CHILD;
      const signals: Array<number | NodeJS.Signals> = [];

      // act
      await reapOrphans(createHooksRuntime(), loc, {
        killProbe(_pid, signal): void {
          signals.push(signal);
          throw Object.assign(new Error("dead"), { code: "ESRCH" });
        },
        environReader(): Promise<string> {
          return Promise.resolve("PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=invalid-dispatch\0");
        },
      });

      // assert
      assert.strictEqual(await readFile(journalPath, "utf8"), altered);
      assert.deepStrictEqual(signals, []);
    },
  );
}

test("ignores unsafe journal names and symlinks", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-unsafe-"));
  const loc = locationsFor("project", root);
  const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
  await mkdir(journalDir, { recursive: true });
  const unsafePath = path.join(journalDir, "not-a-digest.json");
  const linkPath = path.join(journalDir, `${"a".repeat(64)}.json`);
  await writeFile(unsafePath, "unsafe");
  await symlink(unsafePath, linkPath);
  t.after(async () => rm(root, { recursive: true, force: true }));
  const signals: Array<number | NodeJS.Signals> = [];

  // act
  await reapOrphans(createHooksRuntime(), loc, {
    killProbe(_pid, signal): void {
      signals.push(signal);
    },
    environReader(): Promise<string> {
      return Promise.resolve("");
    },
  });

  // assert
  assert.strictEqual(await readFile(unsafePath, "utf8"), "unsafe");
  assert.deepStrictEqual(signals, []);
});

test("bounds startup journal scanning at 1024 regular JSON entries", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-scan-limit-"));
  const loc = locationsFor("project", root);
  const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
  await mkdir(journalDir, { recursive: true });
  await Promise.all(
    Array.from({ length: 1025 }, (_, index) =>
      writeFile(path.join(journalDir, `${index.toString(16).padStart(64, "0")}.json`), "null"),
    ),
  );
  t.after(async () => rm(root, { recursive: true, force: true }));

  // act
  await reapOrphans(createHooksRuntime(), loc);
  const remaining = await readdir(journalDir);

  // assert
  assert.strictEqual(remaining.length, 1025);
});

test("preserves a journal namespace that cannot be opened as a directory", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-scan-error-"));
  const loc = locationsFor("project", root);
  const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
  await mkdir(path.dirname(journalDir), { recursive: true });
  await writeFile(journalDir, "occupied");
  t.after(async () => rm(root, { recursive: true, force: true }));

  // act
  await reapOrphans(createHooksRuntime(), loc);

  // assert
  assert.strictEqual(await readFile(journalDir, "utf8"), "occupied");
});

test(
  "kills an unrecorded child when its journal cannot persist",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-capacity-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_141);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });

    // act
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "capacity-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "x".repeat(257),
      },
    );

    // assert
    assert.deepStrictEqual(runtime.pidTableEntries(loc), []);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(await stat(pidTablePath(loc)).catch(filesystemErrorCode), "ENOENT");
  },
);

test(
  "contains a kill failure after child journal persistence rejects",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-kill-failed-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_142, { killError: new Error("already gone") });
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });

    // act
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "kill-failure-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "x".repeat(257),
      },
    );

    // assert
    assert.deepStrictEqual(runtime.pidTableEntries(loc), []);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
  },
);

test(
  "signals no child hook that ended before its journal write failed",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-ended-unrecorded-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const child = createChild(29_172);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });
    const key = createHash("sha256")
      .update(JSON.stringify([process.pid, "ended-session", "ended-dispatch"]))
      .digest("hex");
    const journalPath = path.join(loc.dataRoot, "_shared", "async-rewake-children", `${key}.json`);
    // A directory at the journal path makes the hook's journal write fail.
    await mkdir(journalPath, { recursive: true });
    let openQueue!: () => void;
    const queueHeld = runtime.runPidTableOperation(
      journalPath,
      () =>
        new Promise<void>((resolve) => {
          openQueue = resolve;
        }),
    );
    let reportSpawn!: () => void;
    const spawned = new Promise<void>((resolve) => {
      reportSpawn = resolve;
    });
    const baseSpawn = createSpawn(child.child, []);
    const spawnImpl = ((command: string, args: readonly string[], options: SpawnOptions) => {
      reportSpawn();
      return baseSpawn(command, args, options);
    }) as NonNullable<SpawnDeps["spawnImpl"]>;
    const registration = spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "ended-session", true).context,
      createPi().pi,
      loc,
      { spawnImpl, dispatchId: () => "ended-dispatch" },
    );
    await spawned;

    // act
    child.emitError(new Error("case-owned early end"));
    openQueue();
    await Promise.all([queueHeld, registration]);

    // assert
    assert.deepStrictEqual(child.signals, []);
    assert.deepStrictEqual(runtime.pidTableEntries(loc), []);
  },
);

test(
  "rejects a journal over one MiB without losing its previously recorded hooks",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-byte-cap-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const owner = runtime.persistenceOwner(loc, "byte-cap-session", "byte-cap-dispatch");
    const child = createChild(29_143);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true });
    });
    for (let index = 0; index < 1300; index += 1) {
      runtime.registerChild({
        dispatchId: String(index).padStart(256, "x"),
        pid: 30_000 + index,
        scope: "project",
        marketplace: "m".repeat(256),
        pluginId: "p".repeat(256),
        claudeEvent: "PreToolUse",
        spawnedAt: "2026-11-13T00:00:00.000Z",
        rewakeMessage: undefined,
        rewakeSummary: undefined,
        child: { kill: () => true },
        ladder: { cancel: () => undefined, fired: () => false },
        stdout: { text: () => "" },
        stderr: { text: () => "" },
        capturedGeneration: 0,
        loc,
        persistenceOwner: owner,
      });
    }

    // act
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "byte-cap-session", true).context,
      createPi().pi,
      loc,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "byte-cap-dispatch",
      },
    );

    // assert
    assert.strictEqual(runtime.pidTableEntries(loc, owner).length, 1300);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(await stat(pidTablePath(loc)).catch(filesystemErrorCode), "ENOENT");
  },
);

test("shutdown drains and removes a confirmed empty child journal", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-empty-shutdown-"));
  const loc = locationsFor("project", root);
  const runtime = createHooksRuntime();
  const owner = runtime.persistenceOwner(loc, "foreign-session", "foreign-token");
  const journalPath = await foreignJournal(loc, [], owner.ownerPid);
  t.after(async () => rm(root, { recursive: true, force: true }));

  // act
  await shutdownInMemoryChildren(runtime);

  // assert
  assert.deepStrictEqual(await stat(journalPath).catch(filesystemErrorCode), "ENOENT");
  assert.deepStrictEqual(runtime.persistenceOwners(), []);
});

test("shutdown preserves a nonregular child journal target", async (t) => {
  // arrange
  const root = await mkdtemp(path.join(tmpdir(), "async-child-directory-"));
  const loc = locationsFor("project", root);
  const runtime = createHooksRuntime();
  runtime.persistenceOwner(loc, "foreign-session", "foreign-token");
  const journalPath = await foreignJournal(loc, [], process.pid);
  await rm(journalPath);
  await mkdir(journalPath);
  t.after(async () => rm(root, { recursive: true, force: true }));

  // act
  await shutdownInMemoryChildren(runtime);

  // assert
  assert.strictEqual((await stat(journalPath)).isDirectory(), true);
});

for (const scenario of [
  { name: "removes the journal of the hooks it stopped", extraRows: [], remaining: "ENOENT" },
  {
    name: "keeps a journal row of a hook it did not stop",
    extraRows: [foreignRow()],
    remaining: ["foreign-dispatch"],
  },
] as const) {
  test(`child shutdown ${scenario.name} before any close event`, async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-stopped-rows-"));
    const loc = locationsFor("project", root);
    const runtime = createHooksRuntime();
    const rewake = createChild(29_161);
    const plain = createChild(29_162);
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    process.env.PI_SUBAGENT_CHILD = "1";
    t.after(async () => {
      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      destroyChild(rewake);
      destroyChild(plain);
      await rm(root, { recursive: true, force: true });
    });
    const ctx = createContext(root, "stopped-rows-session", true).context;
    for (const [child, dispatchId, handlerDecl] of [
      [
        rewake,
        "rewake-dispatch",
        { type: "command", command: "/opt/hooks/rewake", asyncRewake: true },
      ],
      [plain, "plain-dispatch", { type: "command", command: "/opt/hooks/plain", async: true }],
    ] as const) {
      await spawnAndRegister(
        runtime,
        createEntry(root, { handlerDecl }),
        {},
        ctx,
        createPi().pi,
        loc,
        {
          spawnImpl: createSpawn(child.child, []),
          dispatchId: () => dispatchId,
        },
      );
    }

    const journalDir = path.join(loc.dataRoot, "_shared", "async-rewake-children");
    const [journalName] = await readdir(journalDir);
    const journalPath = path.join(journalDir, journalName ?? "");
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      readonly entries: readonly PidTableEntry[];
    };
    await writeFile(
      journalPath,
      JSON.stringify({ ...journal, entries: [...journal.entries, ...scenario.extraRows] }),
    );

    // act
    await shutdownInMemoryChildren(runtime);

    // assert
    assert.deepStrictEqual([rewake.signals, plain.signals], [["SIGKILL"], ["SIGKILL"]]);
    const remaining = await readFile(journalPath, "utf8").then(
      (text) =>
        (JSON.parse(text) as { readonly entries: readonly PidTableEntry[] }).entries.map(
          (row) => row.dispatchId,
        ),
      filesystemErrorCode,
    );
    assert.deepStrictEqual(remaining, scenario.remaining);
  });
}

for (const scenario of [
  {
    name: "missing hook PID",
    hookSignal: "ESRCH",
    ownerRevives: false,
    killed: false,
    remains: false,
  },
  {
    name: "permission-denied hook PID",
    hookSignal: "EPERM",
    ownerRevives: false,
    killed: false,
    remains: true,
  },
  {
    name: "unknown hook probe",
    hookSignal: "EIO",
    ownerRevives: false,
    killed: false,
    remains: true,
  },
  {
    name: "reused owner PID",
    hookSignal: "alive",
    ownerRevives: true,
    killed: false,
    remains: true,
  },
  {
    name: "failed hook group signal",
    hookSignal: "failed-kill",
    ownerRevives: false,
    killed: false,
    remains: true,
  },
] as const) {
  test(
    `preserves or removes the foreign row for ${scenario.name}`,
    { concurrency: false },
    async (t) => {
      // arrange
      const root = await mkdtemp(path.join(tmpdir(), "async-child-foreign-row-"));
      const loc = locationsFor("project", root);
      const journalPath = await foreignJournal(loc, [foreignRow()]);
      const original = await readFile(journalPath);
      t.after(async () => rm(root, { recursive: true, force: true }));
      let ownerProbes = 0;
      const signals: Array<number | NodeJS.Signals> = [];

      // act
      await reapOrphans(createHooksRuntime(), loc, {
        killProbe(pid, signal): void {
          signals.push(signal);
          if (pid === 42 && signal === 0) {
            ownerProbes += 1;
            if (scenario.ownerRevives && ownerProbes > 1) {
              return;
            }

            throw Object.assign(new Error("dead"), { code: "ESRCH" });
          }

          if (
            signal === 0 &&
            scenario.hookSignal !== "alive" &&
            scenario.hookSignal !== "failed-kill"
          ) {
            throw Object.assign(new Error("hook probe"), { code: scenario.hookSignal });
          }

          if (signal === "SIGKILL" && scenario.hookSignal === "failed-kill") {
            throw new Error("group signal denied");
          }
        },
        environReader(): Promise<string> {
          return Promise.resolve("PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=foreign-dispatch\0");
        },
      });

      // assert
      assert.strictEqual(
        (await stat(journalPath).catch(filesystemErrorCode)) === "ENOENT",
        !scenario.remains,
      );
      if (scenario.remains) {
        assert.deepStrictEqual(await readFile(journalPath), original);
      }

      assert.strictEqual(
        signals.includes("SIGKILL"),
        scenario.hookSignal === "failed-kill" && process.platform === "linux",
      );
    },
  );
}

test(
  "skips a foreign hook when the owner revives after hook marker proof",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-owner-reuse-"));
    const loc = locationsFor("project", root);
    const journalPath = await foreignJournal(loc, [foreignRow()]);
    const original = await readFile(journalPath);
    t.after(async () => rm(root, { recursive: true, force: true }));
    let ownerProbes = 0;
    const signals: Array<number | NodeJS.Signals> = [];

    // act
    await reapOrphans(createHooksRuntime(), loc, {
      killProbe(pid, signal): void {
        signals.push(signal);
        if (pid === 42 && signal === 0) {
          ownerProbes += 1;
          if (ownerProbes === 3) {
            return;
          }

          throw Object.assign(new Error("dead"), { code: "ESRCH" });
        }
      },
      environReader(): Promise<string> {
        return Promise.resolve("PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=foreign-dispatch\0");
      },
    });

    // assert
    assert.deepStrictEqual(await readFile(journalPath), original);
    assert.deepStrictEqual(
      signals.filter((signal) => signal === "SIGKILL"),
      [],
    );
  },
);

test(
  "preserves a dead owner's live hook on a platform without a process marker",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-child-nonlinux-"));
    const loc = locationsFor("project", root);
    const journalPath = await foreignJournal(loc, [foreignRow()]);
    const original = await readFile(journalPath);
    t.mock.property(process, "platform", "darwin");
    t.after(async () => rm(root, { recursive: true, force: true }));
    const signals: Array<number | NodeJS.Signals> = [];

    // act
    await reapOrphans(createHooksRuntime(), loc, {
      killProbe(pid, signal): void {
        signals.push(signal);
        if (pid === 42 && signal === 0) {
          throw Object.assign(new Error("dead"), { code: "ESRCH" });
        }
      },
      environReader(): Promise<string> {
        throw new Error("non-Linux recovery must not read /proc");
      },
    });

    // assert
    assert.deepStrictEqual(await readFile(journalPath), original);
    assert.deepStrictEqual(
      signals.filter((signal) => signal === "SIGKILL"),
      [],
    );
  },
);

test(
  "keeps same-shaped child persistence and stale completion isolated by runtime",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-runtime-isolation-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:10:00.000Z"));
    const locations = locationsFor("project", root);
    const firstRuntime = createHooksRuntime();
    const secondRuntime = createHooksRuntime();
    firstRuntime.advanceGeneration();
    secondRuntime.advanceGeneration();
    const firstContext = createContext(root, "session-runtime-first", true);
    const secondContext = createContext(root, "session-runtime-second", true);
    const firstPi = createPi();
    const secondPi = createPi();
    const firstChild = createChild(24_678);
    const secondChild = createChild(24_679);
    const firstWrites: Array<readonly PidTableEntry[]> = [];
    const secondWrites: Array<readonly PidTableEntry[]> = [];

    try {
      // act
      await spawnAndRegister(
        firstRuntime,
        createEntry(root, {
          pluginId: "plugin-runtime-first",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/runtime-first",
            timeout: 600,
            rewakeSummary: "first summary",
          },
        }),
        {},
        firstContext.context,
        firstPi.pi,
        locations,
        {
          spawnImpl: createSpawn(firstChild.child, []),
          dispatchId: () => "dispatch-runtime-first",
          pidTableWriter: (_loc, entries) => {
            firstWrites.push(entries);
            return Promise.resolve();
          },
        },
      );
      await spawnAndRegister(
        secondRuntime,
        createEntry(root, {
          pluginId: "plugin-runtime-second",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/runtime-second",
            timeout: 600,
            rewakeMessage: "Second finding:",
            rewakeSummary: "second summary",
          },
        }),
        {},
        secondContext.context,
        secondPi.pi,
        locations,
        {
          spawnImpl: createSpawn(secondChild.child, []),
          dispatchId: () => "dispatch-runtime-second",
          pidTableWriter: (_loc, entries) => {
            secondWrites.push(entries);
            return Promise.resolve();
          },
        },
      );
      firstRuntime.advanceGeneration();
      firstChild.stderr.end("stale first body");
      secondChild.stderr.end("live second body");
      await Promise.all([once(firstChild.stderr, "end"), once(secondChild.stderr, "end")]);

      firstChild.emitExit(2);
      firstChild.emitClose();
      secondChild.emitExit(2);
      secondChild.emitClose();
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      // assert
      assert.deepStrictEqual(firstPi.messages, []);
      assert.deepStrictEqual(firstContext.notifications, []);
      assert.deepStrictEqual(secondPi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: "Second finding: live second body",
            display: false,
            details: {
              pluginId: "plugin-runtime-second",
              dispatchId: "dispatch-runtime-second",
            },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
        },
      ]);
      assert.deepStrictEqual(secondContext.notifications, [
        { text: "second summary", severity: "info" },
      ]);
      assert.deepStrictEqual(
        firstWrites.map((entries) => entries.map((entry) => entry.dispatchId)),
        [["dispatch-runtime-first"], []],
      );
      assert.deepStrictEqual(
        secondWrites.map((entries) => entries.map((entry) => entry.dispatchId)),
        [["dispatch-runtime-second"], []],
      );
      assert.deepStrictEqual(firstRuntime.pidTableEntries(locations), []);
      assert.deepStrictEqual(secondRuntime.pidTableEntries(locations), []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      firstRuntime.shutdownChildren();
      secondRuntime.shutdownChildren();
      destroyChild(firstChild);
      destroyChild(secondChild);
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "registers one child and rewakes the idle session through complete public cleanup",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-lifecycle-"));
    const fixedNow = Date.parse("2026-08-31T10:00:00.000Z");
    const timers = observeTimers(t, fixedNow);
    shutdownInMemoryChildren(runtime);
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
        "catalog-lifecycle",
        "plugin-lifecycle",
      ),
      ["PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH"]: "dispatch-lifecycle",
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
      tool_use_id: "tool-call-lifecycle",
    });
    const tablePath = pidTablePath(locations);
    const expectedRegisteredBytes =
      '{\n  "version": 1,\n  "entries": [\n    {\n      "pid": 24680,\n' +
      '      "dispatchId": "dispatch-lifecycle",\n      "scope": "project",\n' +
      '      "marketplace": "catalog-lifecycle",\n      "plugin": "plugin-lifecycle",\n' +
      '      "spawnedAt": "2026-08-31T10:00:00.000Z"\n    }\n  ]\n}\n';
    const expectedRemovedBytes = '{\n  "version": 1,\n  "entries": []\n}\n';

    try {
      // act
      await spawnAndRegister(runtime, entry, event, context.context, pi.pi, locations, {
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
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      const removedBytes = await readFile(tablePath, "utf8");
      const listenersAfterExit = {
        childExit: child.child.listenerCount("exit"),
        childError: child.child.listenerCount("error"),
      };
      const orphanProbeCalls: Array<{ pid: number; signal: number | NodeJS.Signals }> = [];
      await reapOrphans(runtime, locations, {
        killProbe(pid, signal): void {
          orphanProbeCalls.push({ pid, signal });
        },
        environReader(): Promise<string> {
          throw new Error("an empty table must not inspect /proc");
        },
      });
      const finalTableState = await stat(tablePath).catch(filesystemErrorCode);
      shutdownInMemoryChildren(runtime);
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
            detached: process.platform !== "win32",
          },
        },
      ]);
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
            content: "Review finding: stderr-one-stderr-two",
            display: false,
            details: {
              pluginId: "plugin-lifecycle",
              dispatchId: "dispatch-lifecycle",
            },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
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
      shutdownInMemoryChildren(runtime);
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
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-stdin-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:05:00.000Z"));
  shutdownInMemoryChildren(runtime);
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
    await spawnAndRegister(runtime, entry, event, context.context, pi.pi, locations, {
      spawnImpl,
      dispatchId: () => "dispatch-no-stdin",
    });
    const registeredEntries = await readPidTable(locations);
    shutdownInMemoryChildren(runtime);
    t.mock.timers.tick(605_000);
    const probeCalls: Array<{ pid: number; signal: number | NodeJS.Signals }> = [];
    await reapOrphans(runtime, locations, {
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
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("spawns an async-rewake hook with Claude's path variables filled in", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-substitution-"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const entry = createEntry(root, {
    handlerDecl: {
      type: "command",
      command: "${CLAUDE_PLUGIN_ROOT}/bin/scan",
      args: ["--data=${CLAUDE_PLUGIN_DATA}", "${CLAUDE_PROJECT_DIR}", "${HOME}"],
      asyncRewake: true,
    },
  });
  const context = createContext(root, "session-substitution", true);
  const pi = createPi();
  const spawnCalls: Array<{ command: string; args: readonly string[] }> = [];
  const spawnImpl = ((
    command: string,
    args: readonly string[],
    _options: SpawnOptions,
  ): ChildProcess => {
    spawnCalls.push({ command, args: [...args] });
    throw new Error("the case stops at the spawn boundary");
  }) as NonNullable<SpawnDeps["spawnImpl"]>;

  try {
    // act
    await spawnAndRegister(runtime, entry, {}, context.context, pi.pi, locations, {
      spawnImpl,
      dispatchId: () => "dispatch-substitution",
    });

    // assert
    assert.deepStrictEqual(spawnCalls, [
      {
        command: path.join(root, "plugin-source", "bin", "scan"),
        args: [
          `--data=${path.join(root, ".pi", "pi-claude-marketplace", "data", "catalog-lifecycle", "plugin-lifecycle")}`,
          root,
          "${HOME}",
        ],
      },
    ]);
  } finally {
    shutdownInMemoryChildren(runtime);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "keeps a main-session hook running when its PID table write fails",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-table-failure-"));
    const child = createChild(29_171);
    const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    const previousMarker = process.env.PI_SUBAGENT_CHILD;
    t.after(async () => {
      if (previousDebug === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
      }

      if (previousMarker === undefined) {
        delete process.env.PI_SUBAGENT_CHILD;
      } else {
        process.env.PI_SUBAGENT_CHILD = previousMarker;
      }

      await shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    });
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
    delete process.env.PI_SUBAGENT_CHILD;
    const diagnostics: string[] = [];
    t.mock.method(console, "error", (...parts: unknown[]) => {
      diagnostics.push(parts.map(String).join(" "));
    });
    const locations = locationsFor("project", root);

    // act
    await spawnAndRegister(
      runtime,
      createEntry(root),
      {},
      createContext(root, "table-failure-session", true).context,
      createPi().pi,
      locations,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "table-failure-dispatch",
        pidTableWriter: () => Promise.reject(new Error("pid table unavailable")),
      },
    );

    // assert
    assert.deepStrictEqual(child.signals, []);
    assert.deepStrictEqual(
      runtime.pidTableEntries(locations).map((row) => row.dispatchId),
      ["table-failure-dispatch"],
    );
    assert.strictEqual(diagnostics.length, 1);
    assert.match(
      diagnostics[0] ?? "",
      /async-rewake: pid table persistence failed \(plugin-lifecycle\/PreToolUse\): pid table unavailable/,
    );
  },
);

test("contains a synchronous spawn failure with semantic diagnostics", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
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
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-spawn-throw", true);
  const pi = createPi();
  const spawnError = new Error("spawn denied by case boundary");
  const spawnImpl = (() => {
    throw spawnError;
  }) as NonNullable<SpawnDeps["spawnImpl"]>;

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
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
    shutdownInMemoryChildren(runtime);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("D-PG10-10: spawns no shell-form async hook that names a plugin option and logs the refusal", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-shell-option-"));
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
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-shell-option", true);
  const pi = createPi();
  const spawnCalls: SpawnCall[] = [];
  const entry = createEntry(root, {
    handlerDecl: {
      type: "command",
      command: "/opt/hooks/scan ${user_config.mode}",
      asyncRewake: true,
    },
  });

  try {
    // act
    await spawnAndRegister(runtime, entry, {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(createChild(4242).child, spawnCalls),
      dispatchId: () => "dispatch-shell-option",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

    // assert
    assert.deepStrictEqual(spawnCalls, []);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(diagnostics, [
      "[hooks] async-rewake: spawnAndRegister threw (plugin-lifecycle/PreToolUse): Hook from " +
        "plugin plugin-lifecycle@catalog-lifecycle references ${user_config.*} in a shell-form " +
        "command. The substituted value would be re-parsed by the shell. Use exec form instead " +
        '\u2014 {"command": "<executable>", "args": ["${user_config.KEY}", ...]} \u2014 or read ' +
        "$CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: /opt/hooks/scan " +
        "${user_config.mode}",
    ]);
  } finally {
    shutdownInMemoryChildren(runtime);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("kills a spawned child that has no PID and leaves no registry state", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-no-pid", true);
  const pi = createPi();
  const child = createChild(undefined);
  const spawnCalls: SpawnCall[] = [];

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, spawnCalls),
      dispatchId: () => "dispatch-no-pid",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);
    shutdownInMemoryChildren(runtime);

    // assert
    assert.strictEqual(spawnCalls.length, 1);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "contains an asynchronous spawn error for a child with no PID",
  { concurrency: false, timeout: 5_000 },
  async () => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-error-"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-no-pid-error", true);
    const pi = createPi();
    const child = createChild(undefined);
    const spawnCalls: SpawnCall[] = [];
    const uncaughtExceptions: unknown[] = [];
    const unhandledRejections: unknown[] = [];
    const onUncaughtException = (error: Error): void => {
      uncaughtExceptions.push(error);
    };

    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };

    let reportLifecycle!: () => void;
    const lifecycleEmitted = new Promise<void>((resolve) => {
      reportLifecycle = resolve;
    });
    const spawnImpl = ((
      command: string,
      args: readonly string[],
      options: SpawnOptions,
    ): ChildProcess => {
      spawnCalls.push({ command, args: [...args], options });
      setImmediate(() => {
        reportLifecycle();
        child.emitError(new Error("ENOENT from exec-form spawn"));
        child.emitClose(1);
      });
      return child.child;
    }) as NonNullable<SpawnDeps["spawnImpl"]>;

    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      // act
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl,
        dispatchId: () => "dispatch-no-pid-error",
      });
      await lifecycleEmitted;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      child.emitClose(2);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);
      shutdownInMemoryChildren(runtime);

      // assert
      assert.strictEqual(spawnCalls.length, 1);
      assert.strictEqual(spawnCalls[0]?.options.shell, false);
      assert.deepStrictEqual(child.signals, ["SIGKILL"]);
      assert.strictEqual(child.child.listenerCount("error"), 0);
      assert.strictEqual(child.child.listenerCount("close"), 0);
      assert.strictEqual(tableState, "ENOENT");
      assert.deepStrictEqual(uncaughtExceptions, []);
      assert.deepStrictEqual(unhandledRejections, []);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
    } finally {
      process.off("uncaughtException", onUncaughtException);
      process.off("unhandledRejection", onUnhandledRejection);
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("contains a kill failure for a spawned child that has no PID", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-kill-"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-no-pid-kill", true);
  const pi = createPi();
  const child = createChild(undefined, { killError: new Error("already exited") });

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-no-pid-kill",
    });

    // assert
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("logs a failed SIGKILL for a spawned child that has no PID", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-no-pid-kill-false-"));
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-no-pid-kill-false", true);
  const pi = createPi();
  const child = createChild(undefined, { killReturnsFalse: true });
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]) => {
    diagnostics.push(parts.map(String).join(" "));
  });

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-no-pid-kill-false",
    });

    // assert
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.strictEqual(diagnostics.length, 2);
    assert.match(diagnostics[0] ?? "", /child has no pid/);
    assert.match(diagnostics[1] ?? "", /kill\(SIGKILL\) returned false/);
    assert.match(diagnostics[1] ?? "", /plugin-lifecycle\/PreToolUse/);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains stdin errors after registering the listener before delivery", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdin-error-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:10:00.000Z"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdin-error", true);
  const pi = createPi();
  const child = createChild(24_683);

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stdin-error",
    });
    child.stdin?.emit("error", new Error("EPIPE from case child"));
    shutdownInMemoryChildren(runtime);
    t.mock.timers.tick(605_000);

    // assert
    assert.strictEqual(child.stdin?.listenerCount("error"), 1);
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await reapOrphans(runtime, locations, {
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

test("contains stdout errors after registering the listener before delivery", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdout-error-"));
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdout-error", true);
  const pi = createPi();
  const child = createChild(24_686);
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]) => {
    diagnostics.push(parts.map(String).join(" "));
  });

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stdout-error",
    });
    child.stdout.emit("error", new Error("EPIPE from case child stdout"));

    // assert
    assert.strictEqual(child.stdout.listenerCount("error"), 1);
    assert.strictEqual(diagnostics.length, 1);
    assert.match(diagnostics[0] ?? "", /stdout error/);
    assert.match(diagnostics[0] ?? "", /plugin-lifecycle\/PreToolUse/);
    assert.match(diagnostics[0] ?? "", /EPIPE from case child stdout/);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains stderr errors after registering the listener before delivery", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stderr-error-"));
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stderr-error", true);
  const pi = createPi();
  const child = createChild(24_687);
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]) => {
    diagnostics.push(parts.map(String).join(" "));
  });

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stderr-error",
    });
    child.stderr.emit("error", new Error("EPIPE from case child stderr"));

    // assert
    assert.strictEqual(child.stderr.listenerCount("error"), 1);
    assert.strictEqual(diagnostics.length, 1);
    assert.match(diagnostics[0] ?? "", /stderr error/);
    assert.match(diagnostics[0] ?? "", /plugin-lifecycle\/PreToolUse/);
    assert.match(diagnostics[0] ?? "", /EPIPE from case child stderr/);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("contains a synchronous stdin end failure and cleans the registered child", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdin-end-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:15:00.000Z"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdin-end", true);
  const pi = createPi();
  const child = createChild(24_684);
  const stdin = child.stdin;
  assert.ok(stdin !== null);
  t.mock.method(stdin, "end", () => {
    throw new Error("synchronous stdin end failure");
  });

  try {
    // act
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-stdin-end",
    });
    const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);
    shutdownInMemoryChildren(runtime);
    t.mock.timers.tick(605_000);

    // assert
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(child.signals, ["SIGKILL"]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
  } finally {
    shutdownInMemoryChildren(runtime);
    child.child.removeAllListeners();
    child.stdin?.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

interface GroupStop {
  readonly name: string;
  readonly stop: (t: TestContext, runtime: ReturnType<typeof createHooksRuntime>) => void;
  readonly timeout: number;
  readonly expectedSignal: NodeJS.Signals;
}

const GROUP_STOPS: readonly GroupStop[] = [
  {
    name: "at its timeout",
    stop: (t) => {
      t.mock.timers.tick(1_000);
    },
    timeout: 1,
    expectedSignal: "SIGTERM",
  },
  {
    name: "on the reload walk",
    stop: (_t, runtime) => {
      shutdownInMemoryChildren(runtime);
    },
    timeout: 600,
    expectedSignal: "SIGKILL",
  },
];

for (const { name, stop, timeout, expectedSignal } of GROUP_STOPS) {
  test(`starts a background hook as a process group leader and signals the group ${name}`, async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-group-"));
    const locations = locationsFor("project", root);
    const entry = createEntry(root, {
      handlerDecl: {
        type: "command",
        command: "/opt/hooks/scan",
        args: [],
        timeout,
        asyncRewake: true,
      },
    });
    const context = createContext(root, "session-group", true);
    const pi = createPi();
    const child = createChild(24_690);
    const spawnCalls: SpawnCall[] = [];
    const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
    t.after(async () => {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    });

    // act
    await spawnAndRegister(runtime, entry, {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, spawnCalls),
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
      },
      dispatchId: () => "dispatch-group",
    });
    stop(t, runtime);

    // assert
    assert.deepStrictEqual(
      spawnCalls.map((call) => call.options.detached),
      [process.platform !== "win32"],
    );
    assert.deepStrictEqual(groupSignals, [[24_690, expectedSignal]]);
    assert.deepStrictEqual(child.signals, []);
  });
}

test("sends SIGKILL to the group of a background hook whose shell its SIGTERM ended while a member runs on", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-group-sigkill-"));
  const locations = locationsFor("project", root);
  const entry = createEntry(root, {
    handlerDecl: {
      type: "command",
      command: "/opt/hooks/scan",
      args: [],
      timeout: 1,
      asyncRewake: true,
    },
  });
  const context = createContext(root, "session-group-sigkill", true);
  const pi = createPi();
  const child = createChild(24_691);
  const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
  t.after(async () => {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });

  // act
  await spawnAndRegister(runtime, entry, {}, context.context, pi.pi, locations, {
    spawnImpl: createSpawn(child.child, []),
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
    dispatchId: () => "dispatch-group-sigkill",
  });
  t.mock.timers.tick(1_000);
  child.emitExit(null, "SIGTERM");
  t.mock.timers.tick(5_000);

  // assert
  assert.deepStrictEqual(groupSignals, [
    [24_691, "SIGTERM"],
    [24_691, 0],
    [24_691, "SIGKILL"],
  ]);
  assert.deepStrictEqual(child.signals, []);
});

interface LaneSpawn {
  readonly runtime: HooksRuntime;
  readonly child: ChildHarness;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly pi: PiHarness;
  readonly diagnostics: readonly string[];
  readonly timers: TimerObservation;
}

// Writes each debug line of the case to `lines`.
function captureDebugLines(t: TestContext): string[] {
  const lines: string[] = [];
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.mock.method(console, "error", (...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  });
  return lines;
}

// Spawns one UserPromptSubmit background child of `handlerDecl` under mocked
// timers, with the debug lines captured, and stops it when the case ends.
async function spawnLaneChild(
  t: TestContext,
  handlerDecl: RoutingEntry["handlerDecl"],
): Promise<LaneSpawn> {
  const timers = observeTimers(t, Date.parse("2026-11-14T09:00:00.000Z"));
  const diagnostics = captureDebugLines(t);
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-lane-"));
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-lane", true);
  const pi = createPi();
  const child = createChild(24_720);
  t.after(async () => {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  await spawnAndRegister(
    runtime,
    createEntry(root, { claudeEvent: "UserPromptSubmit", handlerDecl }),
    { type: "input", text: "prompt", source: "interactive" },
    context.context,
    pi.pi,
    locations,
    { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-lane" },
  );
  return { runtime, child, locations, pi, diagnostics, timers };
}

test("a plain async hook receives no signal past its declared timeout (D-PG5-17)", async (t) => {
  // arrange
  const spawned = await spawnLaneChild(t, {
    type: "command",
    command: "/opt/hooks/note",
    timeout: 1,
    async: true,
  });

  // act
  t.mock.timers.tick(6_000);
  const entry = spawned.runtime.takeChild("dispatch-lane");

  // assert
  assert.deepStrictEqual(spawned.child.signals, []);
  assert.deepStrictEqual(spawned.timers.handles, []);
  assert.strictEqual(entry?.ladder.fired(), false);
});

test("the reload walk sends SIGKILL to a plain async hook and forgets it (D-PG5-18)", async (t) => {
  // arrange
  const spawned = await spawnLaneChild(t, {
    type: "command",
    command: "/opt/hooks/note",
    timeout: 1,
    async: true,
  });

  // act
  await shutdownInMemoryChildren(spawned.runtime);

  // assert
  assert.deepStrictEqual(spawned.child.signals, ["SIGKILL"]);
  assert.strictEqual(spawned.runtime.takeChild("dispatch-lane"), undefined);
  assert.deepStrictEqual(spawned.runtime.pidTableEntries(spawned.locations), []);
});

test("the reap of a later load stops a recorded plain async hook (D-PG5-18)", async (t) => {
  // arrange
  setCasePlatform(t, "linux");
  const spawned = await spawnLaneChild(t, {
    type: "command",
    command: "/opt/hooks/note",
    timeout: 1,
    async: true,
  });
  const signals: Array<readonly [number, number | NodeJS.Signals]> = [];

  // act
  await reapOrphans(createHooksRuntime(), spawned.locations, {
    killProbe(pid, signal): void {
      signals.push([pid, signal]);
    },
    environReader(): Promise<string> {
      return Promise.resolve("PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-lane\0");
    },
  });

  // assert
  assert.deepStrictEqual(signals, [
    [24_720, 0],
    [-24_720, "SIGKILL"],
  ]);
  assert.deepStrictEqual(spawned.child.signals, []);
});

test("a plain async hook's child error finalizes it and sends no answer (D-PG5-17)", async (t) => {
  // arrange
  const spawned = await spawnLaneChild(t, {
    type: "command",
    command: "/opt/hooks/note",
    timeout: 1,
    async: true,
  });

  // act
  spawned.child.emitError(new Error("lost the hook"));
  spawned.child.emitExit(0);
  spawned.child.emitClose(0);

  // assert
  assert.strictEqual(spawned.runtime.takeChild("dispatch-lane"), undefined);
  assert.deepStrictEqual(spawned.pi.messages, []);
  assert.deepStrictEqual(spawned.child.signals, []);
});

for (const declared of [
  {
    name: "a declared timeout",
    writes: "one debug line",
    timeout: 1,
    lines: [
      "[hooks] async-hook: timeout 1 ignored (plugin-lifecycle/UserPromptSubmit); " +
        "a plain async hook runs until it ends",
    ],
  },
  { name: "no timeout", writes: "no debug line", timeout: undefined, lines: [] },
  {
    name: "an unusable timeout",
    writes: "only the ignored-timeout line",
    timeout: "soon",
    lines: [
      '[hooks] async-hook: timeout "soon" ignored (plugin-lifecycle/UserPromptSubmit); ' +
        "a plain async hook runs until it ends",
    ],
  },
] as const) {
  test(`a plain async hook with ${declared.name} writes ${declared.writes} (D-PG5-17)`, async (t) => {
    // arrange
    const handlerDecl = {
      type: "command",
      command: "/opt/hooks/note",
      async: true,
      ...(declared.timeout === undefined ? {} : { timeout: declared.timeout }),
    } satisfies RoutingEntry["handlerDecl"];

    // act
    const spawned = await spawnLaneChild(t, handlerDecl);

    // assert
    assert.deepStrictEqual(spawned.diagnostics, declared.lines);
  });
}

for (const lane of [
  { name: "an async rewake hook", flags: { asyncRewake: true } },
  { name: "a hook with both flags", flags: { async: true, asyncRewake: true } },
] as const) {
  test(`${lane.name} receives SIGTERM at its declared timeout (D-PG5-17)`, async (t) => {
    // arrange
    const spawned = await spawnLaneChild(t, {
      type: "command",
      command: "/opt/hooks/scan",
      timeout: 1,
      ...lane.flags,
    });

    // act
    t.mock.timers.tick(999);
    const beforeTimeout = [...spawned.child.signals];
    t.mock.timers.tick(1);

    // assert
    assert.deepStrictEqual(beforeTimeout, []);
    assert.deepStrictEqual(spawned.child.signals, ["SIGTERM"]);
    assert.strictEqual(spawned.runtime.takeChild("dispatch-lane")?.ladder.fired(), true);
  });
}

test("an async rewake hook with no timeout receives SIGTERM at 600 seconds (D-PG5-17)", async (t) => {
  // arrange
  const spawned = await spawnLaneChild(t, {
    type: "command",
    command: "/opt/hooks/scan",
    asyncRewake: true,
  });

  // act
  t.mock.timers.tick(599_999);
  const beforeTimeout = [...spawned.child.signals];
  t.mock.timers.tick(1);

  // assert
  assert.deepStrictEqual(beforeTimeout, []);
  assert.deepStrictEqual(spawned.child.signals, ["SIGTERM"]);
  assert.deepStrictEqual(spawned.diagnostics, [
    "[hooks] exec-timer: SIGTERM after 600s (plugin-lifecycle/UserPromptSubmit)",
  ]);
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
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-child-error-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:20:00.000Z"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-child-error", true);
  const pi = createPi();
  const child = createChild(24_685);

  try {
    await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-child-error",
    });

    // act
    child.emitError(new Error("child launch failed after spawn"));
    await waitForPidTable(locations, []);
    child.emitClose(1);
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
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "ignores a late child error after an exit has already settled",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-late-error-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:25:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-late-error", true);
    const pi = createPi();
    const child = createChild(24_686);

    try {
      await spawnAndRegister(
        runtime,
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

      // act
      child.emitExit(0);
      child.emitClose();
      await waitForPidTable(locations, []);
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
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "shows no summary and sends nothing for an ordinary exit",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-exit-zero-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:30:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-exit-zero", true);
    const pi = createPi();
    const child = createChild(24_687);

    try {
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-exit-zero",
      });
      child.stderr.end("ignored ordinary output");
      await once(child.stderr, "end");

      // act
      child.emitExit(0);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.strictEqual(runtime.isStopHookActive(), false);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("records a signalled exit as silent completion", { concurrency: false }, async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-signal-exit-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:35:00.000Z"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-signal-exit", true);
  const pi = createPi();
  const child = createChild(24_688);

  try {
    await spawnAndRegister(
      runtime,
      createEntry(root, {
        handlerDecl: {
          asyncRewake: true,
          type: "command",
          command: "/opt/hooks/signal",
          timeout: 600,
        },
      }),
      {},
      context.context,
      pi.pi,
      locations,
      { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-signal-exit" },
    );

    // act
    child.emitExit(null, "SIGTERM");
    child.emitClose();
    await waitForPidTable(locations, []);
    t.mock.timers.tick(605_000);

    // assert
    assert.deepStrictEqual(pi.messages, []);
    assert.deepStrictEqual(context.notifications, []);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
    assert.deepStrictEqual(await readPidTable(locations), []);
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "wakes the model with the default texts when an exit two prints nothing",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-empty-exit-two-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:40:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-empty-exit-two", true);
    const pi = createPi();
    const child = createChild(24_689, { stdout: "absent", stderr: "absent" });

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/empty",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        { spawnImpl: createSpawn(child.child, []), dispatchId: () => "dispatch-empty-exit-two" },
      );

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.strictEqual(child.child.stdout, null);
      assert.strictEqual(child.child.stderr, null);
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: 'Stop hook blocking error from command "PreToolUse": ',
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-empty-exit-two" },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [
        { text: "Stop hook feedback", severity: "info" },
      ]);
      assert.strictEqual(runtime.isStopHookActive(), false);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

for (const [index, { title, prepare, marked }] of [
  {
    title: "marks the next Stop run when an exit two wakes the model inside the stop boundary",
    prepare: (runtime: HooksRuntime): void => {
      runtime.openStopBoundary();
    },
    marked: true,
  },
  {
    title:
      "leaves the next Stop run unmarked when an exit two wakes the model outside the stop boundary",
    prepare: (): void => undefined,
    marked: false,
  },
  {
    title: "leaves the next Stop run unmarked when the wake inside the stop boundary fails to send",
    prepare: (runtime: HooksRuntime, pi: PiHarness): void => {
      runtime.openStopBoundary();
      pi.setSendError(new Error("send unavailable"));
    },
    marked: false,
  },
].entries()) {
  test(`${title} (D-BG-210 / D-PG5-06)`, { concurrency: false }, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-boundary-mark-"));
    observeTimers(t, Date.parse("2026-08-31T10:40:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, `session-boundary-mark-${index}`, false);
    const pi = createPi();
    const child = createChild(24_700 + index);
    prepare(runtime, pi);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, { claudeEvent: "Stop" }),
        { last_assistant_message: "done", stop_hook_active: false },
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: createSpawn(child.child, []),
          dispatchId: () => `dispatch-boundary-mark-${index}`,
        },
      );

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);

      // assert
      assert.strictEqual(runtime.isStopHookActive(), marked);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });
}

test("sends ordered stdout after a declared empty message", { concurrency: false }, async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-stdout-busy-"));
  const timers = observeTimers(t, Date.parse("2026-08-31T10:45:00.000Z"));
  shutdownInMemoryChildren(runtime);
  const locations = locationsFor("project", root);
  const context = createContext(root, "session-stdout-busy", false);
  const pi = createPi();
  const child = createChild(24_690);

  try {
    await spawnAndRegister(
      runtime,
      createEntry(root, {
        handlerDecl: {
          asyncRewake: true,
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

    // act
    child.emitExit(2);
    child.emitClose();
    await waitForPidTable(locations, []);
    t.mock.timers.tick(605_000);

    // assert
    assert.deepStrictEqual(pi.messages, [
      {
        message: {
          customType: "claude-hook-rewake",
          content: " stdout-first-stdout-second",
          display: false,
          details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-stdout-busy" },
        },
        options: { triggerTurn: true, deliverAs: "steer" },
      },
    ]);
    assert.deepStrictEqual(context.notifications, [
      { text: "Stop hook feedback", severity: "info" },
    ]);
    assert.deepStrictEqual(timers.clearHandles, timers.handles);
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

test(
  "preserves each stream order while stderr wins interleaved output",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-interleaved-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:50:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-interleaved", true);
    const pi = createPi();
    const child = createChild(24_691);

    try {
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-interleaved",
      });
      child.stdout.write("stdout-one-");
      child.stderr.write("stderr-one-");
      child.stdout.end("stdout-two");
      child.stderr.end("stderr-two");
      await Promise.all([once(child.stdout, "end"), once(child.stderr, "end")]);

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: "Review finding: stderr-one-stderr-two",
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-interleaved" },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "injects the whole stderr of a large exit-2 output after the rewake message",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-large-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T10:55:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-large", true);
    const pi = createPi();
    const child = createChild(24_692);
    const largeStderr = `d${"x".repeat(65_536)}`;

    try {
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-large",
      });
      child.stderr.end(Buffer.from(largeStderr));
      await once(child.stderr, "end");

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: `Review finding: ${largeStderr}`,
            display: false,
            details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-large" },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [{ text: "scan complete", severity: "info" }]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "waits for late stdio after exit before settling exactly once",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-exit-before-close-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:00:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-exit-before-close", true);
    const pi = createPi();
    const child = createChild(24_693);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          handlerDecl: {
            asyncRewake: true,
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

      // act
      child.emitExit(2);
      const messagesAfterExit = [...pi.messages];
      const stdoutEnd = once(child.stdout, "end");
      child.stdout.end("-after-exit");
      child.stderr.end();
      await Promise.all([stdoutEnd, once(child.stderr, "end")]);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(messagesAfterExit, []);
      assert.deepStrictEqual(pi.messages, [
        {
          message: {
            customType: "claude-hook-rewake",
            content: " available-before-exit-after-exit",
            display: false,
            details: {
              pluginId: "plugin-lifecycle",
              dispatchId: "dispatch-exit-before-close",
            },
          },
          options: { triggerTurn: true, deliverAs: "steer" },
        },
      ]);
      assert.deepStrictEqual(context.notifications, [
        { text: "Stop hook feedback", severity: "info" },
      ]);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "contains a notification failure without changing silent settlement",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-notify-failure-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:05:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(
      root,
      "session-notify-failure",
      true,
      new Error("UI unavailable"),
    );
    const pi = createPi();
    const child = createChild(24_694);

    try {
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-notify-failure",
      });

      // act
      child.emitExit(0);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "contains a send failure after an exit-two body is ready",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-send-failure-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:10:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-send-failure", true);
    const pi = createPi();
    pi.setSendError(new Error("message queue unavailable"));
    const child = createChild(24_695);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          handlerDecl: {
            asyncRewake: true,
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

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, [
        { text: "Stop hook feedback", severity: "info" },
      ]);
      assert.strictEqual(runtime.isStopHookActive(), false);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "discards a stale child after the routing epoch advances",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-stale-epoch-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:15:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-stale-epoch", true);
    const pi = createPi();
    const child = createChild(24_696);

    try {
      await spawnAndRegister(runtime, createEntry(root), {}, context.context, pi.pi, locations, {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-stale-epoch",
      });
      child.stderr.end("stale output");
      await once(child.stderr, "end");
      runtime.advanceGeneration();

      // act
      child.emitExit(2);
      child.emitClose();
      await waitForPidTable(locations, []);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(await readPidTable(locations), []);
    } finally {
      shutdownInMemoryChildren(runtime);
      destroyChild(child);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "serializes overlapping same-table lifecycle persistence in registry order",
  { concurrency: false, timeout: 10_000 },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-persist-order-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:20:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-persist-order", true);
    const pi = createPi();
    const firstChild = createChild(24_697);
    const secondChild = createChild(24_698);
    const persistence = createControlledPidTableWriter();
    let firstSpawn: Promise<void> | undefined;
    let secondSpawn: Promise<void> | undefined;

    try {
      firstSpawn = spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-first",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/first",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: createSpawn(firstChild.child, []),
          dispatchId: () => "dispatch-first",
          pidTableWriter: persistence.writer,
        },
      );
      const firstWrite = await persistence.waitForWrite(0);
      let reportSecondSpawn!: () => void;
      const secondSpawned = new Promise<void>((resolve) => {
        reportSecondSpawn = resolve;
      });
      const baseSecondSpawn = createSpawn(secondChild.child, []);
      const secondSpawnImpl = ((
        command: string,
        args: readonly string[],
        options: SpawnOptions,
      ) => {
        const child = baseSecondSpawn(command, args, options);
        reportSecondSpawn();
        return child;
      }) as NonNullable<SpawnDeps["spawnImpl"]>;
      secondSpawn = spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-second",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/second",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: secondSpawnImpl,
          dispatchId: () => "dispatch-second",
          pidTableWriter: persistence.writer,
        },
      );
      await secondSpawned;

      // act
      firstChild.emitExit(0);
      firstChild.emitClose();
      assert.strictEqual(persistence.writesStarted, 1);
      firstWrite.release();
      const secondWrite = await persistence.waitForWrite(1);
      secondWrite.release();
      const firstRemovalWrite = await persistence.waitForWrite(2);
      firstRemovalWrite.release();
      await Promise.all([firstSpawn, secondSpawn, firstRemovalWrite.completion]);
      const entriesAfterOverlap = await readPidTable(locations);
      secondChild.emitError(new Error("case-owned cleanup"));
      const finalRemovalWrite = await persistence.waitForWrite(3);
      finalRemovalWrite.release();
      await finalRemovalWrite.completion;
      const finalEntries = await readPidTable(locations);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(firstWrite.entries, [
        {
          pid: 24_697,
          dispatchId: "dispatch-first",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-first",
          spawnedAt: "2026-08-31T11:20:00.000Z",
        },
      ]);
      assert.deepStrictEqual(secondWrite.entries, [
        {
          pid: 24_698,
          dispatchId: "dispatch-second",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-second",
          spawnedAt: "2026-08-31T11:20:00.000Z",
        },
      ]);
      assert.deepStrictEqual(firstRemovalWrite.entries, secondWrite.entries);
      assert.deepStrictEqual(entriesAfterOverlap, secondWrite.entries);
      assert.deepStrictEqual(finalRemovalWrite.entries, []);
      assert.deepStrictEqual(finalEntries, []);
      assert.strictEqual(persistence.maxActiveWrites, 1);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
    } finally {
      persistence.releaseAll();
      await Promise.allSettled(
        [firstSpawn, secondSpawn].filter((value): value is Promise<void> => value !== undefined),
      );
      shutdownInMemoryChildren(runtime);
      destroyChild(firstChild);
      destroyChild(secondChild);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "continues queued lifecycle persistence after awaited and terminal write failures",
  { concurrency: false, timeout: 10_000 },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-persist-failure-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:22:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const locations = locationsFor("project", root);
    const context = createContext(root, "session-persist-failure", true);
    const pi = createPi();
    const firstChild = createChild(24_699);
    const secondChild = createChild(24_700);
    const persistence = createControlledPidTableWriter();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };

    process.on("unhandledRejection", onUnhandledRejection);
    let firstSpawn: Promise<void> | undefined;
    let secondSpawn: Promise<void> | undefined;
    let orphanCleanup: Promise<void> | undefined;

    try {
      firstSpawn = spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-failing-first",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/failing-first",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: createSpawn(firstChild.child, []),
          dispatchId: () => "dispatch-failing-first",
          pidTableWriter: persistence.writer,
        },
      );
      const firstWrite = await persistence.waitForWrite(0);
      let reportSecondSpawn!: () => void;
      const secondSpawned = new Promise<void>((resolve) => {
        reportSecondSpawn = resolve;
      });
      const baseSecondSpawn = createSpawn(secondChild.child, []);
      const secondSpawnImpl = ((
        command: string,
        args: readonly string[],
        options: SpawnOptions,
      ) => {
        const child = baseSecondSpawn(command, args, options);
        reportSecondSpawn();
        return child;
      }) as NonNullable<SpawnDeps["spawnImpl"]>;
      secondSpawn = spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-surviving-second",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/surviving-second",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        locations,
        {
          spawnImpl: secondSpawnImpl,
          dispatchId: () => "dispatch-surviving-second",
          pidTableWriter: persistence.writer,
        },
      );
      await secondSpawned;
      firstChild.emitError(new Error("case-owned terminal cleanup"));
      orphanCleanup = reapOrphans(runtime, locations, deadOrphanProbes());
      assert.strictEqual(persistence.writesStarted, 1);

      // act
      firstWrite.reject(new Error("case-owned awaited persistence failure"));
      const secondWrite = await persistence.waitForWrite(1);
      secondWrite.release();
      const terminalWrite = await persistence.waitForWrite(2);
      terminalWrite.reject(new Error("case-owned terminal persistence failure"));
      await Promise.all([firstSpawn, secondSpawn, orphanCleanup, terminalWrite.completion]);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      shutdownInMemoryChildren(runtime);
      t.mock.timers.tick(605_000);

      // assert
      assert.deepStrictEqual(firstWrite.entries, [
        {
          pid: 24_699,
          dispatchId: "dispatch-failing-first",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-failing-first",
          spawnedAt: "2026-08-31T11:22:00.000Z",
        },
      ]);
      assert.deepStrictEqual(secondWrite.entries, [
        {
          pid: 24_700,
          dispatchId: "dispatch-surviving-second",
          scope: "project",
          marketplace: "catalog-lifecycle",
          plugin: "plugin-surviving-second",
          spawnedAt: "2026-08-31T11:22:00.000Z",
        },
      ]);
      assert.deepStrictEqual(terminalWrite.entries, secondWrite.entries);
      assert.deepStrictEqual(await readPidTable(locations), secondWrite.entries);
      assert.strictEqual(persistence.writesStarted, 3);
      assert.strictEqual(persistence.maxActiveWrites, 1);
      assert.deepStrictEqual(unhandledRejections, []);
      assert.deepStrictEqual(timers.clearHandles, timers.handles);
      assert.deepStrictEqual(pi.messages, []);
      assert.deepStrictEqual(context.notifications, []);
    } finally {
      persistence.releaseAll();
      await Promise.allSettled(
        [firstSpawn, secondSpawn, orphanCleanup].filter(
          (value): value is Promise<void> => value !== undefined,
        ),
      );
      shutdownInMemoryChildren(runtime);
      destroyChild(firstChild);
      destroyChild(secondChild);
      await reapOrphans(runtime, locations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      process.off("unhandledRejection", onUnhandledRejection);
    }
  },
);

test(
  "keeps a same-root sibling persisted while one child settles",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-same-root-"));
    const timers = observeTimers(t, Date.parse("2026-08-31T11:20:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const firstLocations = locationsFor("project", root);
    const equalRootLocations = locationsFor("project", root);
    const context = createContext(root, "session-same-root", true);
    const pi = createPi();
    const firstChild = createChild(24_697);
    const secondChild = createChild(24_698);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-first",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/first",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        firstLocations,
        { spawnImpl: createSpawn(firstChild.child, []), dispatchId: () => "dispatch-first" },
      );
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          pluginId: "plugin-second",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/second",
            timeout: 600,
          },
        }),
        {},
        context.context,
        pi.pi,
        equalRootLocations,
        { spawnImpl: createSpawn(secondChild.child, []), dispatchId: () => "dispatch-second" },
      );
      const registeredEntries = await readPidTable(firstLocations);

      // act
      firstChild.emitExit(0);
      firstChild.emitClose();
      await waitForPidTable(firstLocations, registeredEntries.slice(1));
      const entriesAfterFirstExit = await readPidTable(firstLocations);
      secondChild.emitError(new Error("second child terminal error"));
      await waitForPidTable(firstLocations, []);
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
      shutdownInMemoryChildren(runtime);
      destroyChild(firstChild);
      destroyChild(secondChild);
      await reapOrphans(runtime, firstLocations, deadOrphanProbes());
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "reload shutdown clears cross-scope children despite one kill failure",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const { root } = await createHermeticEnvironment(t, "async-registry-cross-scope-");
    const timers = observeTimers(t, Date.parse("2026-08-31T11:25:00.000Z"));
    shutdownInMemoryChildren(runtime);
    const userLocations = locationsFor("user", root);
    const projectLocations = locationsFor("project", root);
    const userContext = createContext(root, "session-user-scope", true);
    const projectContext = createContext(root, "session-project-scope", true);
    const pi = createPi();
    const userChild = createChild(24_699, { killError: new Error("user child already gone") });
    const projectChild = createChild(24_700);

    try {
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          scope: "user",
          marketplace: "catalog-user",
          pluginId: "plugin-user",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/user",
            timeout: 600,
          },
        }),
        {},
        userContext.context,
        pi.pi,
        userLocations,
        { spawnImpl: createSpawn(userChild.child, []), dispatchId: () => "dispatch-user" },
      );
      await spawnAndRegister(
        runtime,
        createEntry(root, {
          scope: "project",
          marketplace: "catalog-project",
          pluginId: "plugin-project",
          handlerDecl: {
            asyncRewake: true,
            type: "command",
            command: "/opt/hooks/project",
            timeout: 600,
          },
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
      shutdownInMemoryChildren(runtime);
      shutdownInMemoryChildren(runtime);
      t.mock.timers.tick(605_000);
      await reapOrphans(runtime, userLocations, deadOrphanProbes());
      await reapOrphans(runtime, projectLocations, deadOrphanProbes());
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
      shutdownInMemoryChildren(runtime);
      destroyChild(userChild);
      destroyChild(projectChild);
      await reapOrphans(runtime, userLocations, deadOrphanProbes());
      await reapOrphans(runtime, projectLocations, deadOrphanProbes());
    }
  },
);

test("uses the real spawn and generated dispatch ID at the default boundary", async (t) => {
  // arrange
  useAllowlistedProcessEnvironment(t, ["HOME", "PI_CODING_AGENT_DIR"]);
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-default-spawn-"));
  shutdownInMemoryChildren(runtime);
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
    await spawnAndRegister(runtime, entry, {}, context.context, pi.pi, locations);
    const registeredEntries = await readPidTable(locations);
    shutdownInMemoryChildren(runtime);
    await reapOrphans(runtime, locations, deadOrphanProbes());
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
    shutdownInMemoryChildren(runtime);
    await reapOrphans(runtime, locations, deadOrphanProbes());
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});

function setCasePlatform(t: TestContext, platform: NodeJS.Platform): void {
  t.mock.property(process, "platform", platform);
}

test(
  "kills a Linux orphan's process group only after liveness and exact marker proof",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
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
          `BROKEN\0OTHER=value\0PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-owned\0PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH_SUFFIX=ignored`,
        );
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(runtime, locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { kind: "kill", pid: 31_001, signal: 0 },
        { kind: "environ", pid: 31_001 },
        { kind: "kill", pid: -31_001, signal: "SIGKILL" },
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
    const runtime = createHooksRuntime();
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
          pid === 31_002
            ? `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-other\0OTHER=x`
            : "OTHER=x\0NO_EQUALS",
        );
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(runtime, locations, probes);
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
    const runtime = createHooksRuntime();
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
      await reapOrphans(runtime, locations, probes);
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
    const runtime = createHooksRuntime();
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
        return Promise.resolve(`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-permission`);
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(runtime, locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_005, signal: 0 },
        { pid: -31_005, signal: "SIGKILL" },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test("skips dead and unprobeable orphan PIDs", { concurrency: false }, async (t) => {
  // arrange
  const runtime = createHooksRuntime();
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
    await reapOrphans(runtime, locations, probes);
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
    const runtime = createHooksRuntime();
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
      await reapOrphans(runtime, locations, probes);
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
    const runtime = createHooksRuntime();
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
        return Promise.resolve(`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-kill-failure`);
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(runtime, locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_009, signal: 0 },
        { pid: -31_009, signal: "SIGKILL" },
        { pid: 31_009, signal: "SIGKILL" },
      ]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

test(
  "kills an owned orphan alone when it leads no process group",
  { concurrency: false },
  async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const root = await mkdtemp(path.join(tmpdir(), "async-registry-orphan-no-group-"));
    setCasePlatform(t, "linux");
    const locations = locationsFor("project", root);
    await writePidTable(locations, [
      {
        pid: 31_011,
        dispatchId: "dispatch-no-group",
        scope: "project",
        marketplace: "catalog-no-group",
        plugin: "plugin-no-group",
        spawnedAt: "2026-08-31T12:05:00.000Z",
      },
    ]);
    const calls: Array<{ readonly pid: number; readonly signal: number | NodeJS.Signals }> = [];
    const probes = {
      killProbe(pid, signal): void {
        calls.push({ pid, signal });
        if (pid < 0) {
          const error = new Error("no such process group") as NodeJS.ErrnoException;
          error.code = "ESRCH";
          throw error;
        }
      },
      environReader(): Promise<string> {
        return Promise.resolve(`PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=dispatch-no-group`);
      },
    } satisfies OrphanProbes;

    try {
      // act
      await reapOrphans(runtime, locations, probes);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [
        { pid: 31_011, signal: 0 },
        { pid: -31_011, signal: "SIGKILL" },
        { pid: 31_011, signal: "SIGKILL" },
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
    const runtime = createHooksRuntime();
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
      await reapOrphans(runtime, locations);
      const tableState = await stat(pidTablePath(locations)).catch(filesystemErrorCode);

      // assert
      assert.deepStrictEqual(calls, [{ pid: process.pid, signal: 0 }]);
      assert.strictEqual(tableState, "ENOENT");
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);

const BIG_TEXT = "x".repeat(12_000);

// The wrapper Claude Code 2.1.323 sends for 12,000 `x` characters saved at
// `filePath` (D-PG5-15).
function savedBigText(filePath: string): string {
  return (
    "<persisted-output>\n" +
    `Output too large (11.7KB). Full output saved to: ${filePath}\n\n` +
    `Preview (first 2KB):\n${"x".repeat(2_000)}\n...\n</persisted-output>`
  );
}

// A Pi double whose `sent(count)` resolves once it has received `count`
// messages.
function createCountingPi(): {
  readonly pi: ExtensionAPI;
  readonly messages: { readonly message: unknown; readonly options: unknown }[];
  sent(count: number): Promise<void>;
} {
  const messages: { readonly message: unknown; readonly options: unknown }[] = [];
  const waiters: { readonly count: number; readonly resolve: () => void }[] = [];
  const sendMessage: ExtensionAPI["sendMessage"] = (message, options) => {
    messages.push({ message, options });
    for (const waiter of waiters.filter(({ count }) => count === messages.length)) {
      waiter.resolve();
    }
  };

  return {
    pi: { sendMessage, getAllTools: () => [] } as unknown as ExtensionAPI,
    messages,
    sent: (count) =>
      messages.length >= count
        ? Promise.resolve()
        : new Promise((resolve) => {
            waiters.push({ count, resolve });
          }),
  };
}

// A writer double that records each save and settles as `outcome` gives for
// its source; `called` resolves at the first save.
function createAnswerSaver(
  outcome: (source: string) => Promise<string> = (source) =>
    Promise.resolve(`/saved/${source}.txt`),
) {
  const saves: { dataRoot: string; id: string; source: string; text: string }[] = [];
  let announce: () => void = () => undefined;
  const called = new Promise<void>((resolve) => {
    announce = resolve;
  });
  const saveHookOutput: NonNullable<SpawnDeps["saveHookOutput"]> = (loc, id, source, text) => {
    saves.push({ dataRoot: loc.dataRoot, id, source, text });
    announce();
    return outcome(source);
  };

  return { saves, called, saveHookOutput };
}

// Resolves when the hooks debug channel writes a line that holds `line`.
function hookDebugLineWritten(t: TestContext, line: string): Promise<void> {
  const debugBefore = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.after(() => {
    if (debugBefore === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      return;
    }

    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = debugBefore;
  });
  return new Promise((resolve) => {
    t.mock.method(console, "error", (...parts: unknown[]): void => {
      if (parts.map(String).join(" ").includes(line)) {
        resolve();
      }
    });
  });
}

// Runs a plain async hook whose answer is `stdout` to its exit, with the PID
// table writes kept off the disk.
async function endPlainAnswer(
  t: TestContext,
  stdout: string,
  pi: ExtensionAPI,
  saveHookOutput: NonNullable<SpawnDeps["saveHookOutput"]>,
): Promise<{ readonly runtime: HooksRuntime; readonly dataRoot: string }> {
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-cap-"));
  const locations = locationsFor("project", root);
  const child = createChild(24_801);
  t.after(async () => {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  await spawnAndRegister(
    runtime,
    createEntry(root, {
      claudeEvent: "UserPromptSubmit",
      handlerDecl: { type: "command", command: "/opt/hooks/note", async: true },
    }),
    { type: "input", text: "prompt", source: "interactive" },
    createContext(root, "session-cap", true).context,
    pi,
    locations,
    {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-cap",
      pidTableWriter: () => Promise.resolve(),
      saveHookOutput,
    },
  );
  child.stdout.end(stdout);
  await once(child.stdout, "end");
  child.emitExit(0);
  child.emitClose(0);
  return { runtime, dataRoot: locations.dataRoot };
}

function answerMessage(content: string): { readonly message: unknown; readonly options: unknown } {
  return {
    message: {
      customType: "claude-hook-async-response",
      content,
      display: false,
      details: { pluginId: "plugin-lifecycle", dispatchId: "dispatch-cap" },
    },
    options: { deliverAs: "nextTurn" },
  };
}

function answerOf(systemMessage: string, additionalContext: string): string {
  return JSON.stringify({ systemMessage, hookSpecificOutput: { additionalContext } });
}

test("sends a plain async answer under the limit as it is and saves nothing (D-PG5-14)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();

  // act
  await endPlainAnswer(t, PLAIN_ANSWER, pi.pi, saver.saveHookOutput);
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(
    { messages: pi.messages, saves: saver.saves },
    { messages: [answerMessage("remember"), answerMessage("context")], saves: [] },
  );
});

test("sends a 12,000-character async systemMessage as the saved wrapper (D-PG5-15)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();

  // act
  const { dataRoot } = await endPlainAnswer(
    t,
    JSON.stringify({ systemMessage: BIG_TEXT }),
    pi.pi,
    saver.saveHookOutput,
  );
  await pi.sent(1);

  // assert
  assert.deepStrictEqual(
    { messages: pi.messages, saves: saver.saves },
    {
      messages: [answerMessage(savedBigText("/saved/systemMessage.txt"))],
      saves: [{ dataRoot, id: "dispatch-cap", source: "systemMessage", text: BIG_TEXT }],
    },
  );
});

test("saves each over-limit text of one async answer under its own source (D-PG5-15)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();

  // act
  const { dataRoot } = await endPlainAnswer(
    t,
    answerOf(BIG_TEXT, BIG_TEXT),
    pi.pi,
    saver.saveHookOutput,
  );
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(
    { messages: pi.messages, saves: saver.saves },
    {
      messages: [
        answerMessage(savedBigText("/saved/systemMessage.txt")),
        answerMessage(savedBigText("/saved/additionalContext.txt")),
      ],
      saves: [
        { dataRoot, id: "dispatch-cap", source: "systemMessage", text: BIG_TEXT },
        { dataRoot, id: "dispatch-cap", source: "additionalContext", text: BIG_TEXT },
      ],
    },
  );
});

test("sends the async systemMessage first while only its save is pending (D-PG5-16)", async (t) => {
  // arrange
  const pi = createCountingPi();
  let releaseSave: (filePath: string) => void = () => undefined;
  const held = new Promise<string>((resolve) => {
    releaseSave = resolve;
  });
  const saver = createAnswerSaver(() => held);

  // act
  await endPlainAnswer(t, answerOf(BIG_TEXT, "context"), pi.pi, saver.saveHookOutput);
  await saver.called;
  const sentDuringSave = pi.messages.length;
  releaseSave("/saved/systemMessage.txt");
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(
    { sentDuringSave, messages: pi.messages },
    {
      sentDuringSave: 0,
      messages: [answerMessage(savedBigText("/saved/systemMessage.txt")), answerMessage("context")],
    },
  );
});

test("sends the cut async text with the failure line when the save rejects (D-PG5-15)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver(() => Promise.reject(new Error("disk full")));
  const marker =
    "\n\n[Hook systemMessage truncated at 10000 chars \u2014 persist-to-disk failed: disk full]";

  // act
  await endPlainAnswer(t, JSON.stringify({ systemMessage: BIG_TEXT }), pi.pi, saver.saveHookOutput);
  await pi.sent(1);

  // assert
  assert.deepStrictEqual(pi.messages, [answerMessage("x".repeat(10_000 - marker.length) + marker)]);
});

test("sends no async answer when a reload comes during its save (D-62-03)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const dropped = hookDebugLineWritten(
    t,
    "async-hook: answer dropped after a reload (plugin-lifecycle/UserPromptSubmit)",
  );
  let releaseSave: (filePath: string) => void = () => undefined;
  const held = new Promise<string>((resolve) => {
    releaseSave = resolve;
  });
  const saver = createAnswerSaver(() => held);

  // act
  const { runtime } = await endPlainAnswer(
    t,
    JSON.stringify({ systemMessage: BIG_TEXT }),
    pi.pi,
    saver.saveHookOutput,
  );
  await saver.called;
  runtime.advanceGeneration();
  releaseSave("/saved/systemMessage.txt");
  await dropped;

  // assert
  assert.deepStrictEqual(pi.messages, []);
});

// The UTF-16 code units a plain async hook keeps of its stdout, and of its
// stdout's end past that.
const PLAIN_STREAM_LIMIT = 8 * 1024 * 1024;
const PLAIN_STREAM_TAIL = 64 * 1024;

test("parses a plain async answer whose stdout runs past its bound and drops the rest (D-PG5-17)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();
  const debugBefore = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.after(() => {
    if (debugBefore === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      return;
    }

    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = debugBefore;
  });
  const lines: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]): void => {
    lines.push(parts.map(String).join(" "));
  });

  // act
  await endPlainAnswer(
    t,
    `${PLAIN_ANSWER}\n${"x".repeat(PLAIN_STREAM_LIMIT + PLAIN_STREAM_TAIL)}`,
    pi.pi,
    saver.saveHookOutput,
  );
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(
    { messages: pi.messages, dropped: lines.filter((line) => line.includes("code units dropped")) },
    {
      messages: [answerMessage("remember"), answerMessage("context")],
      dropped: [
        `[hooks] async-hook: stdout past ${PLAIN_STREAM_LIMIT} UTF-16 code units dropped; the last ${PLAIN_STREAM_TAIL} kept (plugin-lifecycle/UserPromptSubmit)`,
      ],
    },
  );
});

test("gives a plain async answer on the last line after more progress than its stdout bound keeps (D-BG-205)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();
  const progress = "progress line\n".repeat(
    Math.ceil((PLAIN_STREAM_LIMIT + PLAIN_STREAM_TAIL) / 14) + 1,
  );

  // act
  await endPlainAnswer(t, `${progress}${PLAIN_ANSWER}\n`, pi.pi, saver.saveHookOutput);
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(pi.messages, [answerMessage("remember"), answerMessage("context")]);
});

test("gives a plain async answer whose line its stdout bound splits when the kept end holds the rest (D-BG-205)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();
  const progress = `${"x".repeat(PLAIN_STREAM_LIMIT - 10)}\n`;

  // act
  await endPlainAnswer(t, `${progress}${PLAIN_ANSWER}\n`, pi.pi, saver.saveHookOutput);
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(pi.messages, [answerMessage("remember"), answerMessage("context")]);
});

test("gives a plain async answer, not the line fragment that the kept end of its stdout starts with (D-BG-205)", async (t) => {
  // arrange
  const pi = createCountingPi();
  const saver = createAnswerSaver();
  const fragment = '{"systemMessage":"wrong"}';
  const padding = "p".repeat(PLAIN_STREAM_TAIL - fragment.length - PLAIN_ANSWER.length - 3);
  const keptEnd = `${fragment}\n${padding}\n${PLAIN_ANSWER}\n`;

  // act
  await endPlainAnswer(
    t,
    `${"x".repeat(PLAIN_STREAM_LIMIT)}\nnote ${keptEnd}`,
    pi.pi,
    saver.saveHookOutput,
  );
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(pi.messages, [answerMessage("remember"), answerMessage("context")]);
});

test("drains a plain async hook's stderr, keeps none of it, and still gives its answer (D-PG5-17)", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-plain-stderr-"));
  const locations = locationsFor("project", root);
  const pi = createCountingPi();
  const saver = createAnswerSaver();
  const child = createChild(24_803);
  t.after(async () => {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  const debugBefore = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.after(() => {
    if (debugBefore === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      return;
    }

    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = debugBefore;
  });
  const lines: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]): void => {
    lines.push(parts.map(String).join(" "));
  });
  await spawnAndRegister(
    runtime,
    createEntry(root, {
      claudeEvent: "UserPromptSubmit",
      handlerDecl: { type: "command", command: "/opt/hooks/note", async: true },
    }),
    { type: "input", text: "prompt", source: "interactive" },
    createContext(root, "session-plain-stderr", true).context,
    pi.pi,
    locations,
    {
      spawnImpl: createSpawn(child.child, []),
      dispatchId: () => "dispatch-cap",
      pidTableWriter: () => Promise.resolve(),
      saveHookOutput: saver.saveHookOutput,
    },
  );

  // act
  child.stderr.write("first warning\n");
  child.stderr.end("second warning\n");
  child.stdout.end(PLAIN_ANSWER);
  await Promise.all([once(child.stderr, "end"), once(child.stdout, "end")]);
  child.emitExit(0);
  child.emitClose(0);
  await pi.sent(2);

  // assert
  assert.deepStrictEqual(
    { messages: pi.messages, stderr: lines.filter((line) => line.includes("stderr")) },
    {
      messages: [answerMessage("remember"), answerMessage("context")],
      stderr: [
        "[hooks] async-hook: stderr not kept; a plain async hook's stderr is unread (plugin-lifecycle/UserPromptSubmit)",
      ],
    },
  );
});

test("keeps every character of an async rewake hook's stderr past the plain lane's bound", async () => {
  // arrange
  const runtime = createHooksRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "async-registry-rewake-whole-"));
  const locations = locationsFor("project", root);
  const pi = createPi();
  const child = createChild(24_802);
  const stderrText = `${"x".repeat(PLAIN_STREAM_LIMIT)}tail`;

  try {
    await spawnAndRegister(
      runtime,
      createEntry(root, {
        handlerDecl: {
          type: "command",
          command: "/opt/hooks/rewake",
          asyncRewake: true,
          rewakeMessage: "woken:",
        },
      }),
      {},
      createContext(root, "session-rewake-whole", true).context,
      pi.pi,
      locations,
      {
        spawnImpl: createSpawn(child.child, []),
        dispatchId: () => "dispatch-rewake-whole",
        pidTableWriter: () => Promise.resolve(),
      },
    );
    child.stderr.end(stderrText);
    child.stdout.end();
    await Promise.all([once(child.stderr, "end"), once(child.stdout, "end")]);

    // act
    child.emitExit(2);
    child.emitClose(2);

    // assert
    const sent = pi.messages.map(({ message }) => (message as { content: string }).content);
    assert.deepStrictEqual(
      sent.map((content) => ({ length: content.length, tail: content.slice(-4) })),
      [{ length: "woken: ".length + stderrText.length, tail: "tail" }],
    );
  } finally {
    shutdownInMemoryChildren(runtime);
    destroyChild(child);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
});
