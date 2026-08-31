import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { mock, verify } from "strong-mock";

import { dispatchHookExec } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { StopFailureEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts";
import type { StopEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type {
  BucketAEvent,
  DispatchableEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { SpawnOptions } from "node:child_process";

test("executes a blocking hook through the portable process boundary", async (t) => {
  // arrange
  const caseRoot = await mkdtemp(path.join(tmpdir(), "dispatch-exec-portable-"));
  const agentDir = path.join(caseRoot, "agent");
  const cwd = path.join(caseRoot, "workspace");
  const pluginRoot = path.join(caseRoot, "plugin");
  const stdoutCapturePath = path.join(caseRoot, "stdout.txt");
  const stderrCapturePath = path.join(caseRoot, "stderr.txt");
  await Promise.all([
    mkdir(agentDir, { recursive: true }),
    mkdir(cwd, { recursive: true }),
    mkdir(pluginRoot, { recursive: true }),
  ]);
  t.after(() => rm(caseRoot, { recursive: true, force: true }));

  const ownedEnvironmentKeys = [
    "PI_CODING_AGENT_DIR",
    "PI_CLAUDE_MARKETPLACE_DEBUG",
    "PORTABLE_HOOK_PROBE",
    "CLAUDE_CODE_REMOTE",
    "CLAUDE_ENV_FILE",
  ] as const;
  const previousEnvironment = ownedEnvironmentKeys.map((key) => ({
    key,
    existed: Object.hasOwn(process.env, key),
    value: process.env[key],
  }));
  t.after(() => {
    for (const previous of previousEnvironment) {
      if (previous.existed && previous.value !== undefined) {
        process.env[previous.key] = previous.value;
      } else {
        Reflect.deleteProperty(process.env, previous.key);
      }
    }
  });
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  process.env.PORTABLE_HOOK_PROBE = "case-owned";
  delete process.env.CLAUDE_CODE_REMOTE;
  delete process.env.CLAUDE_ENV_FILE;

  const consoleErrorSpy = t.mock.method(console, "error", () => undefined);
  const childOnceSpy = t.mock.method(ChildProcess.prototype, "once");
  const scheduledSetTimeout = globalThis.setTimeout;
  const scheduledClearTimeout = globalThis.clearTimeout;
  const timerCallbacks: Array<() => void> = [];
  const timerClearHandles: Array<ReturnType<typeof setTimeout>> = [];
  const timerDelays: number[] = [];
  const timerHandles: Array<ReturnType<typeof setTimeout>> = [];
  const pendingTimerHandles = new Set<ReturnType<typeof setTimeout>>();
  const timerUnrefHandles: Array<ReturnType<typeof setTimeout>> = [];

  function observedSetTimeout<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay = 0,
    ...args: TArgs
  ): ReturnType<typeof setTimeout> {
    const observedCallback = (): void => {
      pendingTimerHandles.delete(handle);
      callback(...args);
    };

    const handle = scheduledSetTimeout(observedCallback, delay);
    timerCallbacks.push(observedCallback);
    timerDelays.push(delay);
    timerHandles.push(handle);
    pendingTimerHandles.add(handle);
    const originalUnref = handle.unref.bind(handle);
    t.mock.method(handle, "unref", () => {
      timerUnrefHandles.push(handle);
      return originalUnref();
    });
    return handle;
  }

  function observedClearTimeout(handle: Parameters<typeof clearTimeout>[0]): void {
    if (typeof handle === "object" && handle !== null) {
      timerClearHandles.push(handle);
      pendingTimerHandles.delete(handle);
    }

    scheduledClearTimeout(handle);
  }

  t.mock.method(globalThis, "setTimeout", observedSetTimeout);
  t.mock.method(globalThis, "clearTimeout", observedClearTimeout);

  const literalArgument = "literal;$(echo unsafe)&%PORTABLE_HOOK_PROBE%";
  const childProgram = String.raw`
    const { readFileSync, writeFileSync, writeSync } = require("node:fs");
    const [literalArgument, stdoutCapturePath, stderrCapturePath] = process.argv.slice(1);
    const stdin = readFileSync(0, "utf8");
    const observation = {
      argv: process.argv.slice(1),
      cwd: process.cwd(),
      environment: process.env,
      execPath: process.execPath,
      literalArgument,
      stdin,
    };
    const stdout = JSON.stringify({
      hookSpecificOutput: {
        additionalContext: JSON.stringify(observation),
        permissionDecision: "allow",
      },
    });
    const stderr = "portable child stderr\n";
    writeFileSync(stdoutCapturePath, stdout);
    writeFileSync(stderrCapturePath, stderr);
    writeSync(2, stderr);
    writeSync(1, stdout);
  `;
  const commandArguments = [
    "-e",
    childProgram,
    literalArgument,
    stdoutCapturePath,
    stderrCapturePath,
  ];
  const entry = {
    scope: "user",
    marketplace: "portable-marketplace",
    pluginId: "portable-plugin",
    resolvedSource: asAbsolutePluginRoot(pluginRoot),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: {
      type: "command",
      command: process.execPath,
      args: commandArguments,
      shell: path.join(caseRoot, "must-not-run-shell"),
      timeout: 37,
      asyncRewake: false,
    },
    declarationIndex: 0,
    ifPredicate: MATCH_ALL_IF,
  } satisfies RoutingEntry;
  const event = {
    type: "tool_call",
    toolCallId: "portable-call",
    toolName: "bash",
    input: { command: "printf portable" },
  } satisfies ToolCallEvent;
  const sessionManager = SessionManager.inMemory(cwd, { id: "portable-session" });
  const extensionContext = {
    get ui(): ExtensionContext["ui"] {
      throw new Error("dispatchHookExec must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager,
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("dispatchHookExec must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle(): never {
      throw new Error("dispatchHookExec must not call isIdle");
    },
    isProjectTrusted(): never {
      throw new Error("dispatchHookExec must not call isProjectTrusted");
    },
    signal: undefined,
    abort(): never {
      throw new Error("dispatchHookExec must not call abort");
    },
    hasPendingMessages(): never {
      throw new Error("dispatchHookExec must not call hasPendingMessages");
    },
    shutdown(): never {
      throw new Error("dispatchHookExec must not call shutdown");
    },
    getContextUsage(): never {
      throw new Error("dispatchHookExec must not call getContextUsage");
    },
    compact(): never {
      throw new Error("dispatchHookExec must not call compact");
    },
    getSystemPrompt(): never {
      throw new Error("dispatchHookExec must not call getSystemPrompt");
    },
  } satisfies ExtensionContext;
  const expectedStdin = JSON.stringify({
    session_id: "portable-session",
    transcript_path: "",
    cwd,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "printf portable" },
  });
  const expectedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  Object.assign(expectedEnvironment, {
    CLAUDE_PROJECT_DIR: cwd,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: path.join(agentDir, "pi-claude-marketplace", "data", "portable-plugin"),
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: "portable-session",
    CLAUDE_SESSION_ID: "portable-session",
  });
  const expectedObservation = {
    argv: [literalArgument, stdoutCapturePath, stderrCapturePath],
    cwd,
    environment: expectedEnvironment,
    execPath: process.execPath,
    literalArgument,
    stdin: expectedStdin,
  };
  const expectedAdditionalContext = JSON.stringify(expectedObservation);
  const expectedStdout = JSON.stringify({
    hookSpecificOutput: {
      additionalContext: expectedAdditionalContext,
      permissionDecision: "allow",
    },
  });
  const expectedHookOutcome = {
    kind: "mutate",
    additionalContext: expectedAdditionalContext,
    permissionDecision: "allow",
  } satisfies HookExecResult;

  // act
  const hookOutcome = await dispatchHookExec(entry, event, extensionContext);
  const stdout = await readFile(stdoutCapturePath, "utf8");
  const stderr = await readFile(stderrCapturePath, "utf8");
  const childObservation =
    hookOutcome.kind === "mutate" && hookOutcome.additionalContext !== undefined
      ? (JSON.parse(hookOutcome.additionalContext) as unknown)
      : null;
  const closeListenerCalls = childOnceSpy.mock.calls.filter(
    ({ arguments: listenerArguments }) => listenerArguments[0] === "close",
  );
  const child = closeListenerCalls[0]?.this;

  // assert
  assert.deepStrictEqual(hookOutcome, expectedHookOutcome);
  assert.strictEqual(stdout, expectedStdout);
  assert.strictEqual(stderr, "portable child stderr\n");
  assert.deepStrictEqual(childObservation, expectedObservation);
  const stderrDiagnostic = consoleErrorSpy.mock.calls
    .map(({ arguments: diagnosticArguments }) => diagnosticArguments.map(String).join(" "))
    .find((line) => line.includes("portable child stderr"));
  assert.deepStrictEqual(
    {
      category: stderrDiagnostic?.includes("exec: stderr") ?? false,
      context: stderrDiagnostic?.includes("portable-plugin/PreToolUse") ?? false,
      text: stderrDiagnostic?.includes("portable child stderr") ?? false,
    },
    { category: true, context: true, text: true },
  );
  assert.deepStrictEqual(timerDelays, [37_000, 42_000]);
  assert.strictEqual(timerCallbacks.length, 2);
  assert.strictEqual(timerHandles.length, 2);
  assert.deepStrictEqual(timerUnrefHandles, timerHandles);
  assert.deepStrictEqual(timerClearHandles, timerHandles);
  assert.strictEqual(pendingTimerHandles.size, 0);
  assert.ok(child instanceof ChildProcess);
  assert.deepStrictEqual(
    {
      closeListenerRegistrations: closeListenerCalls.length,
      closeListenersRemaining: child.listenerCount("close"),
      exitCode: child.exitCode,
      killed: child.killed,
      signalCode: child.signalCode,
      spawnargs: child.spawnargs,
      spawnfile: child.spawnfile,
      stderrEnded: child.stderr?.readableEnded,
      stdinEnded: child.stdin?.writableEnded,
      stdinFinished: child.stdin?.writableFinished,
      stdoutEnded: child.stdout?.readableEnded,
    },
    {
      closeListenerRegistrations: 1,
      closeListenersRemaining: 0,
      exitCode: 0,
      killed: false,
      signalCode: null,
      spawnargs: [process.execPath, ...commandArguments],
      spawnfile: process.execPath,
      stderrEnded: true,
      stdinEnded: true,
      stdinFinished: true,
      stdoutEnded: true,
    },
  );
});

interface CapturedSpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: SpawnOptions;
}

interface InjectedChild {
  readonly child: ChildProcess;
  readonly stdout: PassThrough | null;
  readonly stderr: PassThrough | null;
  readonly stdin: PassThrough | null;
  readonly stdinChunks: Buffer[];
  readonly stdinOrder: string[];
  readonly killSignals: NodeJS.Signals[];
  close(code: number | null, signal?: NodeJS.Signals | null): Promise<void>;
  emitError(error: Error): void;
  emitExit(code: number | null, signal?: NodeJS.Signals | null): void;
}

interface InjectedChildOptions {
  readonly stdout?: PassThrough | null;
  readonly stderr?: PassThrough | null;
  readonly stdin?: PassThrough | null;
  readonly initiallyKilled?: boolean;
  readonly pid?: number;
}

function makeInjectedChild(
  t: import("node:test").TestContext,
  options: InjectedChildOptions = {},
): InjectedChild {
  const stdout = options.stdout === undefined ? new PassThrough() : options.stdout;
  const stderr = options.stderr === undefined ? new PassThrough() : options.stderr;
  const stdin = options.stdin === undefined ? new PassThrough() : options.stdin;
  const stdinChunks: Buffer[] = [];
  const stdinOrder: string[] = [];
  const killSignals: NodeJS.Signals[] = [];
  const child = new ChildProcess();

  if (stdin !== null) {
    stdin.on("data", (chunk: Buffer) => {
      stdinChunks.push(Buffer.from(chunk));
    });
    stdin.on("newListener", (event) => {
      if (event === "error") {
        stdinOrder.push("error-listener");
      }
    });
    stdin.on("finish", () => {
      stdinOrder.push("finish");
    });
  }

  Object.defineProperties(child, {
    stdin: { configurable: true, enumerable: true, value: stdin },
    stdout: { configurable: true, enumerable: true, value: stdout },
    stderr: { configurable: true, enumerable: true, value: stderr },
    stdio: {
      configurable: true,
      enumerable: true,
      value: [stdin, stdout, stderr, null, null],
    },
    pid: { configurable: true, enumerable: true, value: options.pid ?? 41_204 },
    killed: {
      configurable: true,
      enumerable: true,
      value: options.initiallyKilled ?? false,
      writable: true,
    },
    kill: {
      configurable: true,
      enumerable: true,
      value: (signal: NodeJS.Signals = "SIGTERM"): boolean => {
        killSignals.push(signal);
        Object.defineProperty(child, "killed", {
          configurable: true,
          enumerable: true,
          value: true,
          writable: true,
        });
        return true;
      },
    },
  });

  t.after(() => {
    stdout?.destroy();
    stderr?.destroy();
    stdin?.destroy();
  });

  return {
    child,
    stdout,
    stderr,
    stdin,
    stdinChunks,
    stdinOrder,
    killSignals,
    async close(code, signal = null): Promise<void> {
      if (stdout !== null && !stdout.writableEnded) {
        stdout.end();
      }

      if (stderr !== null && !stderr.writableEnded) {
        stderr.end();
      }

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      Object.defineProperties(child, {
        exitCode: { configurable: true, enumerable: true, value: code, writable: true },
        signalCode: { configurable: true, enumerable: true, value: signal, writable: true },
      });
      child.emit("close", code, signal);
    },
    emitError(error): void {
      child.emit("error", error);
    },
    emitExit(code, signal = null): void {
      Object.defineProperties(child, {
        exitCode: { configurable: true, enumerable: true, value: code, writable: true },
        signalCode: { configurable: true, enumerable: true, value: signal, writable: true },
      });

      child.emit("exit", code, signal);
    },
  };
}

function isStringArray(candidate: unknown): candidate is string[] {
  return (
    Array.isArray(candidate) &&
    candidate.every((argument): argument is string => typeof argument === "string")
  );
}

function isSpawnOptions(candidate: unknown): candidate is SpawnOptions {
  return candidate !== null && typeof candidate === "object";
}

function observeSpawn(
  t: import("node:test").TestContext,
  processChild: InjectedChild,
): {
  readonly calls: CapturedSpawnCall[];
  readonly spawned: Promise<CapturedSpawnCall>;
  readonly spawnImpl: typeof import("node:child_process").spawn;
} {
  const calls: CapturedSpawnCall[] = [];
  let announceSpawn: (call: CapturedSpawnCall) => void = () => undefined;
  const spawned = new Promise<CapturedSpawnCall>((resolve) => {
    announceSpawn = resolve;
  });
  const spawnPort = new Proxy(spawn, {
    apply(_target, _thisArg, argumentsList): ChildProcess {
      const candidates: readonly unknown[] = argumentsList;
      const command = candidates[0];
      const args = candidates[1];
      const options = candidates[2];
      if (typeof command !== "string" || !isStringArray(args) || !isSpawnOptions(options)) {
        throw new TypeError("dispatch supplied an invalid spawn boundary");
      }

      const call = { command, args: [...args], options } satisfies CapturedSpawnCall;
      calls.push(call);
      announceSpawn(call);
      return processChild.child;
    },
  });
  const spawnImpl = t.mock.fn(spawnPort);

  return { calls, spawned, spawnImpl };
}

function makeEntry(
  cwd: string,
  input: {
    readonly claudeEvent?: BucketAEvent;
    readonly command?: string;
    readonly args?: readonly string[];
    readonly shell?: string;
    readonly timeout?: number;
    readonly asyncRewake?: boolean;
  } = {},
): RoutingEntry {
  const handlerDecl = {
    type: "command",
    command: input.command ?? "hook-command",
    ...(input.args === undefined ? {} : { args: [...input.args] }),
    ...(input.shell === undefined ? {} : { shell: input.shell }),
    ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
    ...(input.asyncRewake === undefined ? {} : { asyncRewake: input.asyncRewake }),
  } satisfies RoutingEntry["handlerDecl"];

  return {
    scope: "project",
    marketplace: "dispatch-marketplace",
    pluginId: "dispatch-plugin",
    resolvedSource: asAbsolutePluginRoot(path.join(cwd, "plugin")),
    claudeEvent: input.claudeEvent ?? "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl,
    declarationIndex: 4,
    ifPredicate: MATCH_ALL_IF,
  };
}

function makeContext(cwd: string, sessionId = "dispatch-session"): ExtensionContext {
  const sessionManager = SessionManager.inMemory(cwd, { id: sessionId });
  return {
    get ui(): ExtensionContext["ui"] {
      throw new Error("dispatchHookExec must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager,
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("dispatchHookExec must not read modelRegistry");
    },
    model: undefined,
    scopedModels: [],
    isIdle(): never {
      throw new Error("dispatchHookExec must not call isIdle");
    },
    isProjectTrusted(): never {
      throw new Error("dispatchHookExec must not call isProjectTrusted");
    },
    signal: undefined,
    abort(): never {
      throw new Error("dispatchHookExec must not call abort");
    },
    hasPendingMessages(): never {
      throw new Error("dispatchHookExec must not call hasPendingMessages");
    },
    shutdown(): never {
      throw new Error("dispatchHookExec must not call shutdown");
    },
    getContextUsage(): never {
      throw new Error("dispatchHookExec must not call getContextUsage");
    },
    compact(): never {
      throw new Error("dispatchHookExec must not call compact");
    },
    getSystemPrompt(): never {
      throw new Error("dispatchHookExec must not call getSystemPrompt");
    },
  } satisfies ExtensionContext;
}

async function makeCaseRoot(t: import("node:test").TestContext, name: string): Promise<string> {
  const caseRoot = await mkdtemp(path.join(tmpdir(), name));
  t.after(() => rm(caseRoot, { recursive: true, force: true, maxRetries: 10 }));
  return caseRoot;
}

function observeDebug(t: import("node:test").TestContext) {
  const previous = {
    existed: Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG"),
    value: process.env.PI_CLAUDE_MARKETPLACE_DEBUG,
  };
  t.after(() => {
    if (previous.existed && previous.value !== undefined) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous.value;
    } else {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  return t.mock.method(console, "error", () => undefined);
}

function debugLines(errorSpy: ReturnType<typeof observeDebug>): string[] {
  return errorSpy.mock.calls.map(({ arguments: values }) => values.map(String).join(" "));
}

interface TranslatorCase {
  readonly claudeEvent: DispatchableEvent;
  readonly requiredFields: readonly string[];
  readonly createEvent: () => unknown;
  readonly eventFields: Readonly<Record<string, unknown>>;
}

const TRANSLATOR_CASES: readonly TranslatorCase[] = [
  {
    claudeEvent: "SessionStart",
    requiredFields: [],
    createEvent: () =>
      ({
        type: "session_start",
        reason: "startup",
      }) satisfies SessionStartEvent,
    eventFields: { source: "startup" },
  },
  {
    claudeEvent: "UserPromptSubmit",
    requiredFields: ["text"],
    createEvent: () =>
      ({
        type: "input",
        text: "dispatch prompt",
        source: "interactive",
      }) satisfies InputEvent,
    eventFields: { prompt: "dispatch prompt" },
  },
  {
    claudeEvent: "PreToolUse",
    requiredFields: ["toolName", "input"],
    createEvent: () =>
      ({
        type: "tool_call",
        toolCallId: "pre-tool-call",
        toolName: "bash",
        input: { command: "printf pre" },
      }) satisfies ToolCallEvent,
    eventFields: {
      tool_name: "Bash",
      tool_input: { command: "printf pre" },
    },
  },
  {
    claudeEvent: "PostToolUse",
    requiredFields: ["toolName", "input"],
    createEvent: () =>
      ({
        type: "tool_result",
        toolCallId: "post-tool-call",
        toolName: "bash",
        input: { command: "printf post" },
        content: [{ type: "text", text: "post\n" }],
        isError: false,
        details: { durationMs: 3 },
      }) satisfies ToolResultEvent,
    eventFields: {
      tool_name: "Bash",
      tool_input: { command: "printf post" },
      tool_response: [{ type: "text", text: "post\n" }],
    },
  },
  {
    claudeEvent: "PostToolUseFailure",
    requiredFields: ["toolName", "input"],
    createEvent: () =>
      ({
        type: "tool_result",
        toolCallId: "failed-tool-call",
        toolName: "bash",
        input: { command: "false" },
        content: [{ type: "text", text: "exit 1" }],
        isError: true,
        details: { exitCode: 1 },
      }) satisfies ToolResultEvent,
    eventFields: {
      tool_name: "Bash",
      tool_input: { command: "false" },
      tool_response: [{ type: "text", text: "exit 1" }],
    },
  },
  {
    claudeEvent: "PreCompact",
    requiredFields: [],
    createEvent: () =>
      ({
        type: "session_before_compact",
        preparation: {
          firstKeptEntryId: "kept-entry",
          messagesToSummarize: [],
          turnPrefixMessages: [],
          isSplitTurn: false,
          tokensBefore: 2_048,
          previousSummary: "summary",
          fileOps: {
            read: new Set(["/workspace/read.ts"]),
            written: new Set(["/workspace/write.ts"]),
            edited: new Set(["/workspace/edit.ts"]),
          },
          settings: {
            enabled: true,
            reserveTokens: 8_192,
            keepRecentTokens: 2_048,
          },
        },
        branchEntries: [],
        customInstructions: "Keep decisions.",
        reason: "threshold",
        willRetry: false,
        signal: new AbortController().signal,
      }) satisfies SessionBeforeCompactEvent,
    eventFields: { trigger: "auto" },
  },
  {
    claudeEvent: "PostCompact",
    requiredFields: [],
    createEvent: () =>
      ({
        type: "session_compact",
        compactionEntry: {
          type: "compaction",
          id: "compact-entry",
          parentId: "message-entry",
          timestamp: "2026-08-31T10:00:00.000Z",
          summary: "summary",
          firstKeptEntryId: "kept-entry",
          tokensBefore: 2_048,
        },
        fromExtension: false,
        reason: "threshold",
        willRetry: false,
      }) satisfies SessionCompactEvent,
    eventFields: { trigger: "auto" },
  },
  {
    claudeEvent: "SessionEnd",
    requiredFields: [],
    createEvent: () =>
      ({
        type: "session_shutdown",
        reason: "quit",
      }) satisfies SessionShutdownEvent,
    eventFields: { reason: "quit" },
  },
  {
    claudeEvent: "Stop",
    requiredFields: [],
    createEvent: () =>
      ({
        last_assistant_message: "completed response",
        stop_hook_active: false,
      }) satisfies StopEvent,
    eventFields: {
      last_assistant_message: "completed response",
      stop_hook_active: false,
    },
  },
  {
    claudeEvent: "StopFailure",
    requiredFields: [],
    createEvent: () =>
      ({
        error: "server_error",
        error_details: "provider failed",
        last_assistant_message: "failed response",
      }) satisfies StopFailureEvent,
    eventFields: {
      error: "server_error",
      error_details: "provider failed",
      last_assistant_message: "failed response",
    },
  },
];

for (const translatorCase of TRANSLATOR_CASES) {
  test(
    "dispatches the " + translatorCase.claudeEvent + " translator with exact stdin bytes",
    async (t) => {
      // arrange
      const caseRoot = await makeCaseRoot(t, "dispatch-translator-");
      const processChild = makeInjectedChild(t);
      const processBoundary = observeSpawn(t, processChild);
      const entry = makeEntry(caseRoot, { claudeEvent: translatorCase.claudeEvent });
      const event = translatorCase.createEvent();
      const context = makeContext(caseRoot);
      const expectedPayload = {
        session_id: "dispatch-session",
        transcript_path: "",
        cwd: caseRoot,
        hook_event_name: translatorCase.claudeEvent,
        ...translatorCase.eventFields,
      };
      const expectedStdin = JSON.stringify(expectedPayload);

      // act
      const pendingOutcome = dispatchHookExec(entry, event, context, undefined, {
        spawnImpl: processBoundary.spawnImpl,
      });
      await processBoundary.spawned;
      await processChild.close(0);
      const hookOutcome = await pendingOutcome;
      const stdin = Buffer.concat(processChild.stdinChunks).toString("utf8");

      // assert
      assert.deepStrictEqual(hookOutcome, { kind: "noop" });
      assert.strictEqual(stdin, expectedStdin);
      assert.deepStrictEqual(JSON.parse(stdin), expectedPayload);
      assert.deepStrictEqual(processChild.stdinOrder, ["error-listener", "finish"]);
      assert.deepStrictEqual(processChild.killSignals, []);
    },
  );
}

for (const translatorCase of TRANSLATOR_CASES) {
  test(
    "diagnoses the " +
      translatorCase.claudeEvent +
      " required-field list as " +
      JSON.stringify(translatorCase.requiredFields),
    async (t) => {
      // arrange
      const caseRoot = await makeCaseRoot(t, "dispatch-required-fields-");
      const errorSpy = observeDebug(t);
      const processChild = makeInjectedChild(t);
      const processBoundary = observeSpawn(t, processChild);
      const entry = makeEntry(caseRoot, { claudeEvent: translatorCase.claudeEvent });

      // act
      const pendingOutcome = dispatchHookExec(entry, {}, makeContext(caseRoot), undefined, {
        spawnImpl: processBoundary.spawnImpl,
      });
      await processBoundary.spawned;
      await processChild.close(0);
      const hookOutcome = await pendingOutcome;
      const missingFieldLines = debugLines(errorSpy).filter((line) =>
        line.includes("missing required field"),
      );

      // assert
      assert.deepStrictEqual(hookOutcome, { kind: "noop" });
      assert.strictEqual(missingFieldLines.length, translatorCase.requiredFields.length);
      for (const requiredField of translatorCase.requiredFields) {
        assert.strictEqual(
          missingFieldLines.some(
            (line) =>
              line.includes(translatorCase.claudeEvent) &&
              line.includes('"' + requiredField + '"') &&
              line.includes("partial envelope"),
          ),
          true,
        );
      }
    },
  );
}

test("contains a null unknown payload with diagnostics and no child", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-null-payload-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" });

  // act
  const hookOutcome = await dispatchHookExec(entry, null, makeContext(caseRoot), undefined, {
    spawnImpl: processBoundary.spawnImpl,
  });
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processBoundary.calls, []);
  assert.deepStrictEqual(
    {
      caught: lines.some(
        (line) =>
          line.includes("exec: caught") &&
          line.includes("dispatch-plugin/UserPromptSubmit") &&
          line.includes("null"),
      ),
      payload: lines.some(
        (line) =>
          line.includes("buildPayload") &&
          line.includes("UserPromptSubmit") &&
          line.includes("null") &&
          line.includes("not an object"),
      ),
    },
    { caught: true, payload: true },
  );
});

test("diagnoses a non-object unknown payload while containing its partial child payload", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-number-payload-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" });

  // act
  const pendingOutcome = dispatchHookExec(entry, 42, makeContext(caseRoot), undefined, {
    spawnImpl: processBoundary.spawnImpl,
  });
  await processBoundary.spawned;
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(processBoundary.calls.length, 1);
  assert.deepStrictEqual(
    {
      caught: lines.some((line) => line.includes("exec: caught")),
      payload: lines.some(
        (line) =>
          line.includes("buildPayload") &&
          line.includes("UserPromptSubmit") &&
          line.includes("number") &&
          line.includes("not an object"),
      ),
    },
    { caught: false, payload: true },
  );
});

test("contains a wrong-shape payload whose required property throws", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-wrong-shape-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "PreToolUse" });
  const event = {
    get toolName(): never {
      throw new Error("wrong-shape toolName getter");
    },
    input: {},
  };

  // act
  const hookOutcome = await dispatchHookExec(entry, event, makeContext(caseRoot), undefined, {
    spawnImpl: processBoundary.spawnImpl,
  });
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processBoundary.calls, []);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("exec: caught") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("wrong-shape toolName getter"),
    ),
    true,
  );
  assert.strictEqual(
    lines.some((line) => line.includes("missing required field")),
    false,
  );
});

test("noops an admitted event that has no dispatch translator", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-unknown-event-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = {
    ...makeEntry(caseRoot),
    claudeEvent: "SubagentStop" as BucketAEvent,
  };

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processBoundary.calls, []);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("SubagentStop") &&
        line.includes("dispatch-plugin") &&
        line.includes("not dispatchable"),
    ),
    true,
  );
});

test("delegates only literal async true and preserves absent async stdin", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-async-");
  const processChild = makeInjectedChild(t, { stdin: null, pid: 52_101 });
  const processBoundary = observeSpawn(t, processChild);
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" });
  const entry = makeEntry(caseRoot, {
    claudeEvent: "UserPromptSubmit",
    command: "async-hook",
    args: ["--literal"],
    timeout: 12,
    asyncRewake: true,
  });
  const event = {
    type: "input",
    text: "async prompt",
    source: "interactive",
  } satisfies InputEvent;

  // act
  const hookOutcome = await dispatchHookExec(entry, event, makeContext(caseRoot), pi, {
    spawnImpl: processBoundary.spawnImpl,
    dispatchId: () => "dispatch-async-1",
  });
  processChild.emitError(new Error("async child cleanup"));
  const call = await processBoundary.spawned;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(
    {
      args: call.args,
      command: call.command,
      cwd: call.options.cwd,
      detached: call.options.detached,
      marker: call.options.env?.PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH,
      shell: call.options.shell,
      stdio: call.options.stdio,
    },
    {
      args: ["--literal"],
      command: "async-hook",
      cwd: caseRoot,
      detached: false,
      marker: "dispatch-async-1",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  assert.deepStrictEqual(processChild.stdinChunks, []);
  assert.deepStrictEqual(processChild.stdinOrder, []);
  verify(pi);
});

test("noops async dispatch without Pi before resolving locations or spawning", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-async-no-pi-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, {
    claudeEvent: "SessionStart",
    asyncRewake: true,
  });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { type: "session_start", reason: "startup" } satisfies SessionStartEvent,
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processBoundary.calls, []);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("pi missing") &&
        line.includes("dispatch-plugin/SessionStart") &&
        line.includes("skipping spawn"),
    ),
    true,
  );
});

test("contains a rejected async spawn delegation and returns noop", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-async-rejection-");
  const errorSpy = observeDebug(t);
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" });
  const spawnPort = new Proxy(spawn, {
    apply(): never {
      throw new Error("async spawn rejected");
    },
  });
  const spawnImpl = t.mock.fn(spawnPort);
  const entry = makeEntry(caseRoot, {
    claudeEvent: "UserPromptSubmit",
    asyncRewake: true,
  });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { type: "input", text: "rejected", source: "interactive" } satisfies InputEvent,
    makeContext(caseRoot),
    pi,
    {
      spawnImpl,
      dispatchId: () => "dispatch-rejected",
    },
  );
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("async-rewake: spawn threw") &&
        line.includes("dispatch-plugin/UserPromptSubmit") &&
        line.includes("async spawn rejected"),
    ),
    true,
  );
  verify(pi);
});

test("contains an async delegate rejection from its failing diagnostic sink", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-async-diagnostic-rejection-");
  const previousDebug = {
    existed: Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG"),
    value: process.env.PI_CLAUDE_MARKETPLACE_DEBUG,
  };
  t.after(() => {
    if (previousDebug.existed && previousDebug.value !== undefined) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug.value;
    } else {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  let diagnosticCall = 0;
  const errorSpy = t.mock.method(console, "error", () => {
    diagnosticCall += 1;
    if (diagnosticCall <= 2) {
      throw new Error("diagnostic sink rejection " + diagnosticCall.toString());
    }
  });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" });
  const spawnPort = new Proxy(spawn, {
    apply(): never {
      throw new Error("async child spawn failed");
    },
  });
  const spawnImpl = t.mock.fn(spawnPort);
  const entry = makeEntry(caseRoot, {
    claudeEvent: "UserPromptSubmit",
    asyncRewake: true,
  });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { type: "input", text: "diagnostic rejection", source: "interactive" } satisfies InputEvent,
    makeContext(caseRoot),
    pi,
    {
      spawnImpl,
      dispatchId: () => "dispatch-diagnostic-rejection",
    },
  );
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(diagnosticCall, 3);
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(
    lines.every((line) => line.includes("dispatch-plugin/UserPromptSubmit")),
    true,
  );
  assert.strictEqual(
    lines.some((line) => line.includes("spawn threw") && line.includes("async child spawn failed")),
    true,
  );
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("spawnAndRegister threw") && line.includes("diagnostic sink rejection 1"),
    ),
    true,
  );
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("spawnAndRegister threw") && line.includes("diagnostic sink rejection 2"),
    ),
    true,
  );
  verify(pi);
});

test("preserves chunk order within each stream and decodes split UTF-8", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-split-utf8-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const stdout = Buffer.from(
    '{"hookSpecificOutput":{"additionalContext":"first € last","permissionDecision":"ask","permissionDecisionReason":"review"}}',
    "utf8",
  );
  const euro = Buffer.from("€", "utf8");
  const euroStart = stdout.indexOf(euro);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    {
      type: "tool_call",
      toolCallId: "split-call",
      toolName: "bash",
      input: { command: "printf split" },
    } satisfies ToolCallEvent,
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stderr?.write("stderr-");
  processChild.stdout?.write(stdout.subarray(0, euroStart + 1));
  processChild.stderr?.write("lane");
  processChild.stdout?.write(stdout.subarray(euroStart + 1, euroStart + 2));
  processChild.stdout?.write(stdout.subarray(euroStart + 2));
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "mutate",
    additionalContext: "first € last",
    permissionDecision: "ask",
    permissionDecisionReason: "review",
  });
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("exec: stderr") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("stderr-lane"),
    ),
    true,
  );
  assert.deepStrictEqual(processChild.killSignals, []);
});

test("accepts string stream chunks and parses their complete result", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-string-chunks-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.emit("data", '{"continue":false,');
  processChild.stdout?.emit("data", '"stopReason":"string chunks"}');
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "stop", stopReason: "string chunks" });
  assert.deepStrictEqual(processChild.killSignals, []);
});

test("flushes an incomplete decoder tail before parsing", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-decoder-tail-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write(Buffer.from([0xe2, 0x82]));
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("wire-protocol") &&
        line.includes("JSON.parse failed") &&
        line.includes("noop"),
    ),
    true,
  );
  assert.deepStrictEqual(processChild.killSignals, []);
});

test("cancels timers and returns noop when the child emits a spawn error", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-spawn-error-");
  const errorSpy = observeDebug(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { timeout: 2 });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.emitError(new Error("spawn ENOENT"));
  const hookOutcome = await pendingOutcome;
  t.mock.timers.tick(7_000);
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.strictEqual(processChild.child.listenerCount("error"), 0);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("spawn error") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("spawn ENOENT"),
    ),
    true,
  );
});

test("waits for pipe close after an earlier process exit", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-exit-before-close-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  let settled = false;

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  void pendingOutcome.then(() => {
    settled = true;
  });
  await processBoundary.spawned;
  processChild.emitExit(0);
  await Promise.resolve();
  const settledAfterExit = settled;
  processChild.stdout?.write('{"decision":"block","reason":"drained"}');
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.strictEqual(settledAfterExit, false);
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "drained" });
  assert.deepStrictEqual(processChild.killSignals, []);
});

test("ignores a late error after close has already settled the child", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-late-error-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write('{"suppressOutput":true}');
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  processChild.emitError(new Error("late duplicate"));
  processChild.child.emit("close", 2, null);
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop", suppressOutput: true });
  assert.strictEqual(processChild.child.listenerCount("close"), 0);
  assert.strictEqual(processChild.child.listenerCount("error"), 0);
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("spawn error") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("late duplicate"),
    ),
    true,
  );
});

test("treats null stdout and stderr streams as empty output", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-null-streams-");
  const processChild = makeInjectedChild(t, { stdout: null, stderr: null });
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.deepStrictEqual(processChild.stdinOrder, ["error-listener", "finish"]);
});

test("uses shell form only when the declaration omits args", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-shell-form-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, {
    command: "printf shell",
    shell: "case-shell",
  });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  const call = await processBoundary.spawned;
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(
    {
      args: call.args,
      command: call.command,
      cwd: call.options.cwd,
      shell: call.options.shell,
      stdio: call.options.stdio,
    },
    {
      args: [],
      command: "printf shell",
      cwd: caseRoot,
      shell: "case-shell",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
});

test("contains an EPIPE from stdin after registering its error listener", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-stdin-epipe-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const pipeError = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: { command: "stdin" } },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdin?.emit("error", pipeError);
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.stdinOrder, ["error-listener", "finish"]);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("stdin error") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("write EPIPE"),
    ),
    true,
  );
});

test("contains a synchronous stdin end failure and cancels on child error", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-stdin-end-throw-");
  const errorSpy = observeDebug(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stdin = new PassThrough();
  Object.defineProperty(stdin, "end", {
    configurable: true,
    value: (): never => {
      throw new Error("synchronous stdin end failure");
    },
  });
  const processChild = makeInjectedChild(t, { stdin });
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { timeout: 1 });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  processChild.emitError(new Error("child error after stdin failure"));
  t.mock.timers.tick(6_000);
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.stdinOrder, ["error-listener"]);
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("exec: caught") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("synchronous stdin end failure"),
    ),
    true,
  );
});

test("accepts the exact independent stdout and stderr byte caps", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-exact-caps-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const stdout = Buffer.alloc(1024 * 1024, 0x20);
  const stderr = Buffer.alloc(64 * 1024, 0x65);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write(stdout);
  processChild.stderr?.write(stderr);
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.strictEqual(stdout.byteLength, 1024 * 1024);
  assert.strictEqual(stderr.byteLength, 64 * 1024);
});

test("removes listeners and immediately escalates one-byte stdout overflow", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-stdout-overflow-");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { timeout: 60 });
  const stdout = Buffer.alloc(1024 * 1024 + 1, 0x78);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write(stdout);
  const listenersAfterOverflow = {
    stderrData: processChild.stderr?.listenerCount("data"),
    stderrEnd: processChild.stderr?.listenerCount("end"),
    stdoutData: processChild.stdout?.listenerCount("data"),
    stdoutEnd: processChild.stdout?.listenerCount("end"),
  };
  const immediateSignals = [...processChild.killSignals];
  t.mock.timers.tick(0);
  const zeroDeadlineSignals = [...processChild.killSignals];
  t.mock.timers.tick(4_999);
  const beforeKillSignals = [...processChild.killSignals];
  t.mock.timers.tick(1);
  const killDeadlineSignals = [...processChild.killSignals];
  await processChild.close(null, "SIGKILL");
  const hookOutcome = await pendingOutcome;
  t.mock.timers.tick(60_000);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(listenersAfterOverflow, {
    stderrData: 0,
    stderrEnd: 0,
    stdoutData: 0,
    stdoutEnd: 0,
  });
  assert.deepStrictEqual(immediateSignals, ["SIGTERM"]);
  assert.deepStrictEqual(zeroDeadlineSignals, ["SIGTERM", "SIGTERM"]);
  assert.deepStrictEqual(beforeKillSignals, ["SIGTERM", "SIGTERM"]);
  assert.deepStrictEqual(killDeadlineSignals, ["SIGTERM", "SIGTERM", "SIGKILL"]);
  assert.deepStrictEqual(processChild.killSignals, ["SIGTERM", "SIGTERM", "SIGKILL"]);
  assert.strictEqual(stdout.byteLength, 1024 * 1024 + 1);
});

test("contains one-byte stderr overflow when the child is already marked killed", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-stderr-overflow-");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const processChild = makeInjectedChild(t, { initiallyKilled: true });
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const stderr = Buffer.alloc(64 * 1024 + 1, 0x65);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stderr?.write(stderr);
  const listenersAfterOverflow = {
    stderrData: processChild.stderr?.listenerCount("data"),
    stderrEnd: processChild.stderr?.listenerCount("end"),
    stdoutData: processChild.stdout?.listenerCount("data"),
    stdoutEnd: processChild.stdout?.listenerCount("end"),
  };
  await processChild.close(null, "SIGTERM");
  const hookOutcome = await pendingOutcome;
  t.mock.timers.tick(5_000);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(listenersAfterOverflow, {
    stderrData: 0,
    stderrEnd: 0,
    stdoutData: 0,
    stdoutEnd: 0,
  });
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.strictEqual(stderr.byteLength, 64 * 1024 + 1);
});

test("ignores a second overflow after the first lane starts cleanup", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-duplicate-overflow-");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const retainListeners = (stream: PassThrough): void => {
    const removeAllListeners = stream.removeAllListeners.bind(stream);
    Object.defineProperty(stream, "removeAllListeners", {
      configurable: true,
      value: (event?: string | symbol): PassThrough =>
        event === "data" || event === "end" ? stream : removeAllListeners(event),
    });
  };

  retainListeners(stdout);
  retainListeners(stderr);
  const processChild = makeInjectedChild(t, { stdout, stderr });
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  stdout.write(Buffer.alloc(1024 * 1024 + 1, 0x78));
  stderr.write(Buffer.alloc(64 * 1024 + 1, 0x65));
  await processChild.close(null, "SIGTERM");
  const hookOutcome = await pendingOutcome;
  t.mock.timers.tick(5_000);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(processChild.killSignals, ["SIGTERM"]);
});
