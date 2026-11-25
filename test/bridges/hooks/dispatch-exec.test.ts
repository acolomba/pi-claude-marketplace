import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test, { describe } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { mock, verify } from "strong-mock";

import { dispatchHookExec } from "../../../extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts";
import { MATCH_ALL_IF } from "../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { createHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";
import type { StopFailureEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts";
import type { StopEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts";
import type { UserPromptExpansionEvent } from "../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts";
import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { DispatchableEvent } from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  SessionBeforeCompactEvent,
  BeforeAgentStartEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { SpawnOptions } from "node:child_process";

test("executes a blocking hook through the portable process boundary", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const { root: caseRoot, agentDir } = await createHermeticEnvironment(
    t,
    "dispatch-exec-portable-",
  );
  const cwd = path.join(caseRoot, "workspace");
  const pluginRoot = path.join(caseRoot, "plugin");
  const stdoutCapturePath = path.join(caseRoot, "stdout.txt");
  const stderrCapturePath = path.join(caseRoot, "stderr.txt");
  // The child writes its environment here, not to its hook output, because
  // the bridge caps a hook's context at 10,000 characters (D-PG5-14).
  const environmentCapturePath = path.join(caseRoot, "environment.json");
  await Promise.all([mkdir(cwd, { recursive: true }), mkdir(pluginRoot, { recursive: true })]);

  const ownedEnvironmentKeys = [
    "PI_CLAUDE_MARKETPLACE_DEBUG",
    "PORTABLE_HOOK_PROBE",
    "CLAUDE_CODE_REMOTE",
    "CLAUDE_ENV_FILE",
    "PI_SUBAGENT_CHILD",
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
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  process.env.PORTABLE_HOOK_PROBE = "case-owned";
  delete process.env.CLAUDE_CODE_REMOTE;
  delete process.env.CLAUDE_ENV_FILE;
  process.env.PI_SUBAGENT_CHILD = "1";
  runtime.captureChildIdentity(
    {
      type: "before_agent_start",
      systemPromptOptions: { customPrompt: '<active_agent name="a&amp;b&quot;c"/>\n\n' },
    } as BeforeAgentStartEvent,
    "portable-session",
  );

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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- the timer calls back only after `handle` is assigned
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
    const [literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath] =
      process.argv.slice(1);
    const stdin = readFileSync(0, "utf8");
    const observation = {
      argv: process.argv.slice(1),
      cwd: process.cwd(),
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
    writeFileSync(environmentCapturePath, JSON.stringify(process.env));
    writeSync(2, stderr);
    writeSync(1, stdout);
  `;
  const commandArguments = [
    "-e",
    childProgram,
    literalArgument,
    stdoutCapturePath,
    stderrCapturePath,
    environmentCapturePath,
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
    options: resolveOptions(undefined),
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
    tool_use_id: "portable-call",
    agent_type: 'a&b"c',
    agent_id: "portable-session",
  });
  const expectedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  Object.assign(expectedEnvironment, {
    CLAUDE_PROJECT_DIR: cwd,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_DATA: path.join(
      agentDir,
      "pi-claude-marketplace",
      "data",
      "portable-marketplace",
      "portable-plugin",
    ),
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: "portable-session",
    CLAUDE_SESSION_ID: "portable-session",
  });
  const expectedObservation = {
    argv: [literalArgument, stdoutCapturePath, stderrCapturePath, environmentCapturePath],
    cwd,
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
  const hookOutcome = await dispatchHookExec(entry, event, extensionContext, undefined, runtime);
  const stdout = await readFile(stdoutCapturePath, "utf8");
  const stderr = await readFile(stderrCapturePath, "utf8");
  const childEnvironment = JSON.parse(await readFile(environmentCapturePath, "utf8")) as unknown;
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
  assert.deepStrictEqual(childEnvironment, expectedEnvironment);
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
  readonly killReturnsFalse?: boolean;
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

  Object.assign(child, {
    stdin,
    stdout,
    stderr,
    stdio: [stdin, stdout, stderr, null, null],
    pid: options.pid ?? 41_204,
    killed: options.initiallyKilled ?? false,
    kill: (signal: NodeJS.Signals = "SIGTERM"): boolean => {
      killSignals.push(signal);
      if (options.killReturnsFalse === true) {
        return false;
      }

      Object.assign(child, { killed: true });

      return true;
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
    readonly claudeEvent?: DispatchableEvent;
    readonly command?: string;
    readonly args?: readonly string[];
    readonly shell?: string;
    readonly timeout?: number;
    readonly asyncRewake?: boolean;
    readonly async?: unknown;
    readonly onFailure?: string;
  } = {},
): RoutingEntry {
  const handlerDecl = {
    type: "command",
    command: input.command ?? "hook-command",
    ...(input.args === undefined ? {} : { args: [...input.args] }),
    ...(input.shell === undefined ? {} : { shell: input.shell }),
    ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
    ...(input.asyncRewake === undefined ? {} : { asyncRewake: input.asyncRewake }),
    ...(input.async === undefined ? {} : { async: input.async }),
    ...(input.onFailure === undefined ? {} : { onFailure: input.onFailure }),
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
    options: resolveOptions(undefined),
  };
}

function makeContext(
  cwd: string,
  sessionId = "dispatch-session",
  model?: NonNullable<ExtensionContext["model"]>,
  sessionName?: string,
): ExtensionContext {
  const sessionManager = SessionManager.inMemory(cwd, { id: sessionId });
  if (sessionName !== undefined) {
    sessionManager.appendSessionInfo(sessionName);
  }

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
    model,
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

/**
 * One dispatchable event's translator probe.
 *
 * `diagnosedOmissions` and `benignOmission` are drivers, not expectations:
 * each names a field the case deletes from an otherwise complete envelope so
 * that `buildPayload`'s own WR-03 debug output can say whether the module
 * treats that field as required. The expectation is the wording the module
 * emits, so an edit to its required-field table changes the observed lines and
 * fails the case, rather than agreeing with a second copy of the table.
 *
 * `benignOmission` is the control for the same probe: a field the envelope
 * carries that the module does not require. Its omission must stay silent,
 * which is also the whole contract for the six events whose required set is
 * empty -- an empty required set is a real state, not an untested one.
 */
interface TranslatorCase {
  readonly claudeEvent: DispatchableEvent;
  readonly diagnosedOmissions: readonly string[];
  readonly benignOmission: string;
  readonly createEvent: () => unknown;
  readonly eventFields: Readonly<Record<string, unknown>>;
  /** What a quiet exit 0 settles with, when it is not a bare noop (D-BG-503). */
  readonly expectedOutcome?: HookExecResult;
}

const TRANSLATOR_CASES: readonly TranslatorCase[] = [
  {
    claudeEvent: "SessionStart",
    diagnosedOmissions: [],
    benignOmission: "source",
    // The router dispatches the Claude-side SessionStart event (D-CF5-01).
    createEvent: () => ({ source: "startup" }),
    eventFields: { source: "startup" },
  },
  {
    claudeEvent: "UserPromptSubmit",
    diagnosedOmissions: ["text"],
    benignOmission: "source",
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
    diagnosedOmissions: ["toolName", "input", "toolCallId"],
    benignOmission: "type",
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
      tool_use_id: "pre-tool-call",
    },
  },
  {
    claudeEvent: "PostToolUse",
    diagnosedOmissions: ["toolName", "input", "toolCallId"],
    benignOmission: "type",
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
      tool_use_id: "post-tool-call",
      tool_response: { interrupted: false, structuredContent: [{ type: "text", text: "post\n" }] },
    },
  },
  {
    claudeEvent: "PostToolUseFailure",
    diagnosedOmissions: ["toolName", "input", "toolCallId"],
    benignOmission: "type",
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
      tool_use_id: "failed-tool-call",
      error: "exit 1",
      is_interrupt: false,
    },
  },
  {
    claudeEvent: "PreCompact",
    diagnosedOmissions: [],
    benignOmission: "customInstructions",
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
    // An automatic compaction sends no instructions, also when Pi carries a text (D-PG6-08).
    eventFields: { trigger: "auto", custom_instructions: null },
  },
  {
    claudeEvent: "PostCompact",
    diagnosedOmissions: [],
    benignOmission: "fromExtension",
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
    eventFields: { trigger: "auto", compact_summary: "summary" },
    expectedOutcome: { kind: "noop", postCompactRun: { succeeded: true, output: "" } },
  },
  {
    claudeEvent: "SessionEnd",
    diagnosedOmissions: [],
    benignOmission: "type",
    createEvent: () =>
      ({
        type: "session_shutdown",
        reason: "quit",
      }) satisfies SessionShutdownEvent,
    eventFields: { reason: "quit" },
  },
  {
    claudeEvent: "Stop",
    diagnosedOmissions: [],
    benignOmission: "stop_hook_active",
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
    diagnosedOmissions: [],
    benignOmission: "error_details",
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
  {
    claudeEvent: "UserPromptExpansion",
    diagnosedOmissions: ["command_name", "command_args"],
    benignOmission: "command_source",
    createEvent: () =>
      ({
        command_name: "demo:deploy",
        command_args: "staging",
        command_source: "plugin",
        input: { type: "input", text: "/demo:deploy staging", source: "interactive" },
      }) satisfies UserPromptExpansionEvent,
    eventFields: {
      expansion_type: "slash_command",
      command_name: "demo:deploy",
      command_args: "staging",
      command_source: "plugin",
      prompt: "/demo:deploy staging",
    },
  },
];

for (const translatorCase of TRANSLATOR_CASES) {
  test(
    "dispatches the " + translatorCase.claudeEvent + " translator with exact stdin bytes",
    async (t) => {
      // arrange
      const runtime = createHooksRuntime();
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
      const pendingOutcome = dispatchHookExec(entry, event, context, undefined, runtime, {
        spawnImpl: processBoundary.spawnImpl,
      });
      await processBoundary.spawned;
      await processChild.close(0);
      const hookOutcome = await pendingOutcome;
      const stdin = Buffer.concat(processChild.stdinChunks).toString("utf8");

      // assert
      assert.deepStrictEqual(hookOutcome, translatorCase.expectedOutcome ?? { kind: "noop" });
      assert.strictEqual(stdin, expectedStdin);
      assert.deepStrictEqual(JSON.parse(stdin), expectedPayload);
      assert.deepStrictEqual(processChild.stdinOrder, ["error-listener", "finish"]);
      assert.deepStrictEqual(processChild.killSignals, []);
    },
  );
}

// Only SessionStart sends the model, and only it and UserPromptSubmit send the
// session title (D-PG6-09).
const SESSION_FACT_FIELDS: Partial<Record<DispatchableEvent, Readonly<Record<string, string>>>> = {
  SessionStart: { model: "dispatch-model", session_title: "Release prep" },
  UserPromptSubmit: { session_title: "Release prep" },
};

const DISPATCH_MODEL = {
  provider: "dispatch-provider",
  id: "dispatch-model",
  name: "Dispatch model",
  api: "openai-completions",
  baseUrl: "http://localhost:0",
  reasoning: true,
  input: ["text", "image"],
  contextWindow: 32_000,
  maxTokens: 4_000,
  cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
} satisfies NonNullable<ExtensionContext["model"]>;

for (const translatorCase of TRANSLATOR_CASES) {
  test(
    "sends the " + translatorCase.claudeEvent + " stdin the model and the session name it takes",
    async (t) => {
      // arrange
      const runtime = createHooksRuntime();
      const caseRoot = await makeCaseRoot(t, "dispatch-session-facts-");
      const processChild = makeInjectedChild(t);
      const processBoundary = observeSpawn(t, processChild);
      const entry = makeEntry(caseRoot, { claudeEvent: translatorCase.claudeEvent });
      const context = makeContext(caseRoot, "dispatch-session", DISPATCH_MODEL, "Release prep");
      const expectedPayload = {
        session_id: "dispatch-session",
        transcript_path: "",
        cwd: caseRoot,
        hook_event_name: translatorCase.claudeEvent,
        ...translatorCase.eventFields,
        ...SESSION_FACT_FIELDS[translatorCase.claudeEvent],
      };

      // act
      const pendingOutcome = dispatchHookExec(
        entry,
        translatorCase.createEvent(),
        context,
        undefined,
        runtime,
        { spawnImpl: processBoundary.spawnImpl },
      );
      await processBoundary.spawned;
      await processChild.close(0);
      await pendingOutcome;
      const stdin = Buffer.concat(processChild.stdinChunks).toString("utf8");

      // assert
      assert.strictEqual(stdin, JSON.stringify(expectedPayload));
    },
  );
}

test("omits stale child identity from synchronous stdin", { concurrency: false }, async (t) => {
  // arrange
  const previousMarker = process.env.PI_SUBAGENT_CHILD;
  process.env.PI_SUBAGENT_CHILD = "1";
  t.after(() => {
    if (previousMarker === undefined) {
      delete process.env.PI_SUBAGENT_CHILD;
    } else {
      process.env.PI_SUBAGENT_CHILD = previousMarker;
    }
  });
  const runtime = createHooksRuntime();
  runtime.captureChildIdentity(
    {
      type: "before_agent_start",
      systemPromptOptions: { customPrompt: '<active_agent name="other-runner"/>\n\n' },
    } as BeforeAgentStartEvent,
    "other-session",
  );
  const root = await makeCaseRoot(t, "dispatch-identity-stale-");
  const child = makeInjectedChild(t);
  const boundary = observeSpawn(t, child);

  // act
  const pendingOutcome = dispatchHookExec(
    makeEntry(root),
    {
      type: "tool_call",
      toolCallId: "stale-call",
      toolName: "bash",
      input: { command: "printf stale" },
    } satisfies ToolCallEvent,
    makeContext(root, "current-session"),
    undefined,
    runtime,
    { spawnImpl: boundary.spawnImpl },
  );
  await boundary.spawned;
  await child.close(0);
  const outcome = await pendingOutcome;
  const payload: unknown = JSON.parse(Buffer.concat(child.stdinChunks).toString("utf8"));

  // assert
  assert.deepStrictEqual(outcome, { kind: "noop" });
  assert.deepStrictEqual(payload, {
    session_id: "current-session",
    transcript_path: "",
    cwd: root,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "printf stale" },
    tool_use_id: "stale-call",
  });
  assert.strictEqual(Object.hasOwn(payload, "agent_type"), false);
  assert.strictEqual(Object.hasOwn(payload, "agent_id"), false);
});

const LAUNCHING_SESSION = {
  sessionId: "launching-session",
  transcriptPath: "/sessions/launching-session.jsonl",
};

function markSubagentChild(t: import("node:test").TestContext): void {
  const previousMarker = process.env.PI_SUBAGENT_CHILD;
  process.env.PI_SUBAGENT_CHILD = "1";
  t.after(() => {
    if (previousMarker === undefined) {
      delete process.env.PI_SUBAGENT_CHILD;
    } else {
      process.env.PI_SUBAGENT_CHILD = previousMarker;
    }
  });
}

// D-PG6-01: a known child with a root names the launching session in its tool
// payload and its session variables, and itself in `agent_id`.
for (const translatorCase of TRANSLATOR_CASES.filter(({ claudeEvent }) =>
  ["PreToolUse", "PostToolUse", "PostToolUseFailure"].includes(claudeEvent),
)) {
  test(
    `names the launching session in a child's synchronous ${translatorCase.claudeEvent} stdin and env (D-PG6-01)`,
    { concurrency: false },
    async (t) => {
      // arrange
      markSubagentChild(t);
      const runtime = createHooksRuntime();
      runtime.captureChildIdentity(
        {
          type: "before_agent_start",
          systemPromptOptions: { customPrompt: '<active_agent name="rooted-runner"/>\n\n' },
        } as BeforeAgentStartEvent,
        "rooted-session",
      );
      runtime.recordChildRoot("rooted-session", LAUNCHING_SESSION);
      const root = await makeCaseRoot(t, "dispatch-identity-root-");
      const child = makeInjectedChild(t);
      const boundary = observeSpawn(t, child);

      // act
      const pendingOutcome = dispatchHookExec(
        makeEntry(root, { claudeEvent: translatorCase.claudeEvent }),
        translatorCase.createEvent(),
        makeContext(root, "rooted-session"),
        undefined,
        runtime,
        { spawnImpl: boundary.spawnImpl },
      );
      const call = await boundary.spawned;
      await child.close(0);
      const outcome = await pendingOutcome;
      const payload: unknown = JSON.parse(Buffer.concat(child.stdinChunks).toString("utf8"));

      // assert
      assert.deepStrictEqual(outcome, { kind: "noop" });
      assert.deepStrictEqual(payload, {
        session_id: "launching-session",
        transcript_path: "/sessions/launching-session.jsonl",
        cwd: root,
        hook_event_name: translatorCase.claudeEvent,
        ...translatorCase.eventFields,
        agent_type: "rooted-runner",
        agent_id: "rooted-session",
      });
      assert.deepStrictEqual(
        {
          CLAUDE_CODE_SESSION_ID: call.options.env?.CLAUDE_CODE_SESSION_ID,
          CLAUDE_SESSION_ID: call.options.env?.CLAUDE_SESSION_ID,
        },
        { CLAUDE_CODE_SESSION_ID: "launching-session", CLAUDE_SESSION_ID: "launching-session" },
      );
    },
  );
}

// D-PG6-02: a child with no agent tag sends no `agent_id`, so it keeps its
// own session fields even when its session has a recorded root.
test(
  "keeps the own session of a child whose identity is unavailable (D-PG6-02)",
  { concurrency: false },
  async (t) => {
    // arrange
    markSubagentChild(t);
    const runtime = createHooksRuntime();
    runtime.captureChildIdentity(
      {
        type: "before_agent_start",
        systemPromptOptions: { customPrompt: "Answer the task." },
      } as BeforeAgentStartEvent,
      "untagged-session",
    );
    runtime.recordChildRoot("untagged-session", LAUNCHING_SESSION);
    const root = await makeCaseRoot(t, "dispatch-identity-untagged-");
    const child = makeInjectedChild(t);
    const boundary = observeSpawn(t, child);

    // act
    const pendingOutcome = dispatchHookExec(
      makeEntry(root),
      {
        type: "tool_call",
        toolCallId: "untagged-call",
        toolName: "bash",
        input: { command: "printf untagged" },
      } satisfies ToolCallEvent,
      makeContext(root, "untagged-session"),
      undefined,
      runtime,
      { spawnImpl: boundary.spawnImpl },
    );
    const call = await boundary.spawned;
    await child.close(0);
    const outcome = await pendingOutcome;
    const payload: unknown = JSON.parse(Buffer.concat(child.stdinChunks).toString("utf8"));

    // assert
    assert.deepStrictEqual(outcome, { kind: "noop" });
    assert.deepStrictEqual(payload, {
      session_id: "untagged-session",
      transcript_path: "",
      cwd: root,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "printf untagged" },
      tool_use_id: "untagged-call",
    });
    assert.deepStrictEqual(
      {
        CLAUDE_CODE_SESSION_ID: call.options.env?.CLAUDE_CODE_SESSION_ID,
        CLAUDE_SESSION_ID: call.options.env?.CLAUDE_SESSION_ID,
      },
      { CLAUDE_CODE_SESSION_ID: "untagged-session", CLAUDE_SESSION_ID: "untagged-session" },
    );
  },
);

// D-PG3-07: the synchronous lane of each tool event a child dispatches. A real
// hook process records its stdin; the runtime captures another session's
// identity once the process runs, and the recorded payload keeps the identity
// of its own dispatch.
for (const translatorCase of TRANSLATOR_CASES.filter(({ claudeEvent }) =>
  ["PreToolUse", "PostToolUse", "PostToolUseFailure"].includes(claudeEvent),
)) {
  for (const { role, marker, identity } of [
    {
      role: "child",
      marker: "1",
      identity: { agent_type: "sync-runner", agent_id: "sync-session" },
    },
    { role: "main", marker: "0", identity: {} },
  ] as const) {
    test(
      `records ${role} synchronous ${translatorCase.claudeEvent} stdin through a real process`,
      { concurrency: false, timeout: 15_000 },
      async (t) => {
        // arrange
        const previousMarker = process.env.PI_SUBAGENT_CHILD;
        process.env.PI_SUBAGENT_CHILD = marker;
        t.after(() => {
          if (previousMarker === undefined) {
            delete process.env.PI_SUBAGENT_CHILD;
          } else {
            process.env.PI_SUBAGENT_CHILD = previousMarker;
          }
        });
        const runtime = createHooksRuntime();
        const identityEvent = (agent: string): BeforeAgentStartEvent =>
          ({
            type: "before_agent_start",
            systemPromptOptions: { customPrompt: `<active_agent name="${agent}"/>\n\n` },
          }) as BeforeAgentStartEvent;
        runtime.captureChildIdentity(identityEvent("sync-runner"), "sync-session");
        const root = await makeCaseRoot(t, "dispatch-identity-real-");
        const recordingPath = path.join(root, "stdin.json");
        const spawned: ChildProcess[] = [];
        const spawnImpl = t.mock.fn(
          (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
            const child = spawn(command, [...args], options);
            spawned.push(child);
            runtime.captureChildIdentity(identityEvent("later-runner"), "later-session");
            return child;
          },
        );
        const entry = makeEntry(root, {
          claudeEvent: translatorCase.claudeEvent,
          command: process.execPath,
          args: [
            "-e",
            'require("node:fs").writeFileSync(process.argv[1], require("node:fs").readFileSync(0));',
            recordingPath,
          ],
        });

        // act
        const outcome = await dispatchHookExec(
          entry,
          translatorCase.createEvent(),
          makeContext(root, "sync-session"),
          undefined,
          runtime,
          // dispatchHookExec uses only spawn's three-argument overload with piped streams.
          { spawnImpl: spawnImpl as unknown as typeof spawn },
        );
        const recorded: unknown = JSON.parse(await readFile(recordingPath, "utf8"));

        // assert
        assert.deepStrictEqual(outcome, { kind: "noop" });
        assert.strictEqual(spawned.length, 1);
        assert.deepStrictEqual(recorded, {
          session_id: "sync-session",
          transcript_path: "",
          cwd: root,
          hook_event_name: translatorCase.claudeEvent,
          ...translatorCase.eventFields,
          ...identity,
        });
        assert.strictEqual(Object.hasOwn(recorded as object, "agent_type"), role === "child");
        assert.strictEqual(Object.hasOwn(recorded as object, "agent_id"), role === "child");
        assert.deepStrictEqual(runtime.childIdentityFor("later-session"), {
          kind: role === "child" ? "known" : "main",
          ...(role === "child" ? { agentType: "later-runner", childId: "later-session" } : {}),
        });
      },
    );
  }
}

/**
 * One dispatch of `translatorCase`'s envelope with `omittedField` deleted (or
 * of the complete envelope when `omittedField` is `undefined`), reported
 * through the module's own observable surface: the WR-03 required-field lines
 * it emitted, the arm it resolved to, and whether the translator still reached
 * the process boundary after the probe.
 */
interface OmissionObservation {
  readonly missingFieldLines: readonly string[];
  readonly outcome: HookExecResult;
  readonly spawnCount: number;
}

async function observeFieldOmission(
  t: import("node:test").TestContext,
  errorSpy: ReturnType<typeof observeDebug>,
  caseRoot: string,
  translatorCase: TranslatorCase,
  omittedField: string | undefined,
): Promise<OmissionObservation> {
  const runtime = createHooksRuntime();
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: translatorCase.claudeEvent });
  const event = translatorCase.createEvent() as Record<string, unknown>;
  if (omittedField !== undefined) {
    Reflect.deleteProperty(event, omittedField);
  }

  errorSpy.mock.resetCalls();
  const pendingOutcome = dispatchHookExec(entry, event, makeContext(caseRoot), undefined, runtime, {
    spawnImpl: processBoundary.spawnImpl,
  });
  await processBoundary.spawned;
  await processChild.close(0);
  const outcome = await pendingOutcome;

  return {
    missingFieldLines: debugLines(errorSpy).filter((line) =>
      line.includes("missing required field"),
    ),
    outcome,
    spawnCount: processBoundary.calls.length,
  };
}

for (const translatorCase of TRANSLATOR_CASES) {
  test(
    "probes each " +
      translatorCase.claudeEvent +
      " envelope field against buildPayload's own required-field diagnostic",
    async (t) => {
      // arrange
      const errorSpy = observeDebug(t);
      const caseRoot = await makeCaseRoot(t, "dispatch-required-fields-");
      const missingFieldLine = (omittedField: string): string =>
        `[hooks] buildPayload: ${translatorCase.claudeEvent} event missing required field ` +
        `"${omittedField}"; partial envelope likely`;
      const expectedDiagnosed = translatorCase.diagnosedOmissions.map((omittedField) => [
        missingFieldLine(omittedField),
      ]);
      // Every probe leaves the never-throws contract intact: the translator
      // still runs after a miss and the child still receives an envelope.
      const expectedSurvival = Array.from(
        { length: translatorCase.diagnosedOmissions.length + 2 },
        () => ({ outcome: translatorCase.expectedOutcome ?? { kind: "noop" }, spawnCount: 1 }),
      );

      // act
      const complete = await observeFieldOmission(t, errorSpy, caseRoot, translatorCase, undefined);
      const diagnosed: OmissionObservation[] = [];
      for (const omittedField of translatorCase.diagnosedOmissions) {
        diagnosed.push(
          await observeFieldOmission(t, errorSpy, caseRoot, translatorCase, omittedField),
        );
      }

      const benign = await observeFieldOmission(
        t,
        errorSpy,
        caseRoot,
        translatorCase,
        translatorCase.benignOmission,
      );
      const survival = [complete, ...diagnosed, benign].map((observation) => ({
        outcome: observation.outcome,
        spawnCount: observation.spawnCount,
      }));

      // assert
      assert.deepStrictEqual(complete.missingFieldLines, []);
      assert.deepStrictEqual(
        diagnosed.map((observation) => observation.missingFieldLines),
        expectedDiagnosed,
      );
      assert.deepStrictEqual(benign.missingFieldLines, []);
      assert.deepStrictEqual(survival, expectedSurvival);
    },
  );
}

test("contains a null unknown payload as a runner failure with diagnostics and no child", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-null-payload-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    null,
    makeContext(caseRoot),
    undefined,
    runtime,
    {
      spawnImpl: processBoundary.spawnImpl,
    },
  );
  const lines = debugLines(errorSpy);
  const caughtHead = "[hooks] exec: caught (dispatch-plugin/UserPromptSubmit): ";
  const caughtError = lines.find((line) => line.startsWith(caughtHead))?.slice(caughtHead.length);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "run", error: caughtError },
  });
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
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-number-payload-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" });

  // act
  const pendingOutcome = dispatchHookExec(entry, 42, makeContext(caseRoot), undefined, runtime, {
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

test("contains a wrong-shape payload whose required property throws as a runner failure", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-wrong-shape-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "PreToolUse" });
  const event = {
    toolCallId: "wrong-shape-call",
    get toolName(): never {
      throw new Error("wrong-shape toolName getter");
    },
    input: {},
  };

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    event,
    makeContext(caseRoot),
    undefined,
    runtime,
    {
      spawnImpl: processBoundary.spawnImpl,
    },
  );
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "run", error: "wrong-shape toolName getter" },
  });
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

for (const field of ["asyncRewake", "async"] as const) {
  test(`delegates a literal ${field} true to the background and preserves absent stdin`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const caseRoot = await makeCaseRoot(t, "dispatch-async-");
    const processChild = makeInjectedChild(t, { stdin: null, pid: 52_101 });
    const processBoundary = observeSpawn(t, processChild);
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension api" });
    const entry = makeEntry(caseRoot, {
      claudeEvent: "UserPromptSubmit",
      command: "async-hook",
      args: ["--literal"],
      timeout: 12,
      [field]: true,
    });
    const event = {
      type: "input",
      text: "async prompt",
      source: "interactive",
    } satisfies InputEvent;

    // act
    const hookOutcome = await dispatchHookExec(entry, event, makeContext(caseRoot), pi, runtime, {
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
        detached: process.platform !== "win32",
        marker: "dispatch-async-1",
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    assert.deepStrictEqual(processChild.stdinChunks, []);
    assert.deepStrictEqual(processChild.stdinOrder, []);
    verify(pi);
  });
}

for (const value of ["yes", false]) {
  test(`keeps an async value of ${JSON.stringify(value)} on the synchronous path`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const caseRoot = await makeCaseRoot(t, "dispatch-async-sync-");
    const processChild = makeInjectedChild(t, { pid: 52_102 });
    const processBoundary = observeSpawn(t, processChild);
    const entry = makeEntry(caseRoot, { claudeEvent: "SessionStart", async: value });

    // act
    const outcome = dispatchHookExec(
      entry,
      { type: "session_start", reason: "startup" } satisfies SessionStartEvent,
      makeContext(caseRoot),
      undefined,
      runtime,
      { spawnImpl: processBoundary.spawnImpl },
    );
    const call = await processBoundary.spawned;
    await processChild.close(0);

    // assert
    assert.deepStrictEqual(await outcome, { kind: "noop" });
    assert.strictEqual(call.options.env?.PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH, undefined);
  });
}

test("noops async dispatch without Pi before resolving locations or spawning", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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

test("flushes an incomplete decoder tail before parsing the entry's plain stdout as context (D-CF5-13)", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-decoder-tail-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { type: "input", text: "decoder prompt", source: "interactive" } satisfies InputEvent,
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write(Buffer.from([0xe2, 0x82]));
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "mutate", additionalContext: "\uFFFD" });
  assert.deepStrictEqual(processChild.killSignals, []);
});

test("cancels timers and settles with the spawn failure when the child emits a spawn error", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
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
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.emitError(new Error("spawn ENOENT"));
  const hookOutcome = await pendingOutcome;
  t.mock.timers.tick(7_000);
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "spawn", error: "spawn ENOENT" },
  });
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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
  const runtime = createHooksRuntime();
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
    runtime,
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

test("spawns an exec-form hook with Claude's path variables filled in", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-exec-substitution-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, {
    command: "${CLAUDE_PLUGIN_ROOT}/bin/hook",
    args: ["--data=${CLAUDE_PLUGIN_DATA}", "${CLAUDE_PROJECT_DIR}"],
  });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  const call = await processBoundary.spawned;
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(
    { command: call.command, args: call.args, shell: call.options.shell },
    {
      command: path.join(caseRoot, "plugin", "bin", "hook"),
      args: [
        `--data=${path.join(caseRoot, ".pi", "pi-claude-marketplace", "data", "dispatch-marketplace", "dispatch-plugin")}`,
        caseRoot,
      ],
      shell: false,
    },
  );
});

test("D-PG10-10: spawns an exec-form hook with its plugin options filled in", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-exec-options-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = {
    ...makeEntry(caseRoot, {
      command: "/usr/bin/${user_config.mode}",
      args: ["--mode=${user_config.mode}"],
    }),
    options: resolveOptions({
      mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
    }),
  } satisfies RoutingEntry;

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  const call = await processBoundary.spawned;
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.deepStrictEqual(
    { command: call.command, args: call.args, shell: call.options.shell },
    { command: "/usr/bin/fast", args: ["--mode=fast"], shell: false },
  );
});

/**
 * Dispatches one PreToolUse hook whose declaration `input` describes, lets
 * `drive` act as its child, and returns the outcome.
 */
async function dispatchDriven(
  t: import("node:test").TestContext,
  input: Parameters<typeof makeEntry>[1],
  drive: (child: InjectedChild) => Promise<void>,
  event: unknown = { toolName: "bash", input: {} },
): Promise<HookExecResult> {
  const caseRoot = await makeCaseRoot(t, "dispatch-on-failure-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const pendingOutcome = dispatchHookExec(
    makeEntry(caseRoot, input),
    event,
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  await drive(processChild);
  return pendingOutcome;
}

const ON_FAILURE_HEAD = '[guard]: failed; blocking because onFailure is "block"';

test("blocks a hook that cannot start when onFailure is block", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard", onFailure: "block" }, (child) => {
    child.emitError(new Error("spawn guard ENOENT"));
    return Promise.resolve();
  });

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: ON_FAILURE_HEAD,
    suppressOriginalPrompt: true,
  });
});

const UNSET_TOKEN_MESSAGE =
  `Plugin option "token" isn't set. Open /plugin manage to configure it, or check that ` +
  `the plugin's userConfig schema declares "token".`;

test("D-PG10-08: fails an exec-form hook that names an unset option without spawning it", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-exec-unset-option-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { command: "guard", args: ["${user_config.token}"] });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "run", error: UNSET_TOKEN_MESSAGE },
  });
  assert.deepStrictEqual(processBoundary.calls, []);
});

test("D-PG10-08: blocks an exec-form hook that names an unset option when onFailure is block", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-exec-unset-option-block-");
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, {
    command: "guard",
    args: ["${user_config.token}"],
    onFailure: "block",
  });

  // act
  const hookOutcome = await dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `${ON_FAILURE_HEAD}\n${UNSET_TOKEN_MESSAGE}`,
    suppressOriginalPrompt: true,
  });
  assert.deepStrictEqual(processBoundary.calls, []);
});

const SHELL_REFUSAL_MESSAGE =
  "Hook from plugin dispatch-plugin@dispatch-marketplace references ${user_config.*} in a " +
  "shell-form command. The substituted value would be re-parsed by the shell. Use exec form " +
  'instead \u2014 {"command": "<executable>", "args": ["${user_config.KEY}", ...]} \u2014 or ' +
  "read $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: guard ${user_config.mode}";

for (const { onFailure, outcome } of [
  {
    onFailure: undefined,
    outcome: { kind: "noop", failure: { kind: "run", error: SHELL_REFUSAL_MESSAGE } },
  },
  {
    onFailure: "block",
    outcome: {
      kind: "block",
      reason:
        '[guard ${user_config.mode}]: failed; blocking because onFailure is "block"\n' +
        SHELL_REFUSAL_MESSAGE,
      suppressOriginalPrompt: true,
    },
  },
] satisfies readonly { onFailure: string | undefined; outcome: HookExecResult }[]) {
  test(`D-PG10-10: refuses a shell-form hook that names an option without spawning it (onFailure ${String(onFailure)})`, async (t) => {
    // arrange
    const runtime = createHooksRuntime();
    const caseRoot = await makeCaseRoot(t, "dispatch-exec-shell-option-");
    const processChild = makeInjectedChild(t);
    const processBoundary = observeSpawn(t, processChild);
    const entry = makeEntry(caseRoot, {
      command: "guard ${user_config.mode}",
      ...(onFailure === undefined ? {} : { onFailure }),
    });

    // act
    const hookOutcome = await dispatchHookExec(
      entry,
      { toolName: "bash", input: {} },
      makeContext(caseRoot),
      undefined,
      runtime,
      { spawnImpl: processBoundary.spawnImpl },
    );

    // assert
    assert.deepStrictEqual(hookOutcome, outcome);
    assert.deepStrictEqual(processBoundary.calls, []);
  });
}

test("blocks a hook that exits 1 when onFailure is block", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stderr?.write("boom\n");
      await child.close(1);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `${ON_FAILURE_HEAD}\nboom`,
    suppressOriginalPrompt: true,
  });
});

test("blocks a hook whose stdout starts and ends a JSON object that does not parse", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stdout?.write("{not json}\n");
      await child.close(0);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: ON_FAILURE_HEAD,
    suppressOriginalPrompt: true,
  });
});

test("lets a hook pass whose stdout opens a JSON object and does not close it", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stdout?.write("{not json\n");
      await child.close(0);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("applies the JSON deny of a hook that exits 1 with its own reason when onFailure is block", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stdout?.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "no echo",
          },
        }),
      );
      child.stderr?.write("boom\n");
      await child.close(1);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "no echo" });
});

test("blocks a hook that exits 1 whose JSON allows the call when onFailure is block", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stdout?.write('{"hookSpecificOutput":{"permissionDecision":"allow"}}');
      await child.close(1);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: ON_FAILURE_HEAD,
    suppressOriginalPrompt: true,
  });
});

test("blocks a hook its timeout killed with the timed out message", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signals: readonly NodeJS.Signals[] = [];

  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block", timeout: 1 },
    async (child) => {
      t.mock.timers.tick(1_000);
      signals = [...child.killSignals];
      await child.close(null, "SIGTERM");
    },
  );

  // assert
  assert.deepStrictEqual(signals, ["SIGTERM"]);
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: '[guard]: timed out; blocking because onFailure is "block"',
    suppressOriginalPrompt: true,
  });
});

test("starts a blocking hook as a process group leader and signals the group at its timeout", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const caseRoot = await makeCaseRoot(t, "dispatch-group-");
  const processChild = makeInjectedChild(t, { pid: 52_103 });
  const processBoundary = observeSpawn(t, processChild);
  const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];

  // act
  const pendingOutcome = dispatchHookExec(
    makeEntry(caseRoot, { command: "guard", timeout: 1 }),
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    {
      spawnImpl: processBoundary.spawnImpl,
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
      },
    },
  );
  const call = await processBoundary.spawned;
  t.mock.timers.tick(1_000);
  const signalsAtTimeout = [...groupSignals];
  await processChild.close(null, "SIGTERM");
  const hookOutcome = await pendingOutcome;

  // assert
  assert.strictEqual(call.options.detached, process.platform !== "win32");
  assert.deepStrictEqual(signalsAtTimeout, [[52_103, "SIGTERM"]]);
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("sends SIGKILL to the group of a blocking hook whose shell its SIGTERM ended while a member runs on", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const caseRoot = await makeCaseRoot(t, "dispatch-group-sigkill-");
  const processChild = makeInjectedChild(t, { pid: 52_104 });
  const processBoundary = observeSpawn(t, processChild);
  const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];

  // act
  const pendingOutcome = dispatchHookExec(
    makeEntry(caseRoot, { command: "guard", timeout: 1 }),
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    {
      spawnImpl: processBoundary.spawnImpl,
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
      },
    },
  );
  await processBoundary.spawned;
  t.mock.timers.tick(1_000);
  processChild.emitExit(null, "SIGTERM");
  t.mock.timers.tick(5_000);
  const signalsAtGrace = [...groupSignals];
  await processChild.close(null, "SIGTERM");
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(signalsAtGrace, [
    [52_104, "SIGTERM"],
    [52_104, 0],
    [52_104, "SIGKILL"],
  ]);
  assert.deepStrictEqual(processChild.killSignals, []);
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

const POST_COMPACT_EVENT = {
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
  reason: "manual",
  willRetry: false,
} satisfies SessionCompactEvent;

const ON_FAILURE_RUN = 'failed; blocking because onFailure is "block"';

describe("PostCompact runs (D-BG-503)", () => {
  const cases: readonly {
    name: string;
    input: Parameters<typeof makeEntry>[1];
    drive: (child: InjectedChild, t: import("node:test").TestContext) => Promise<void>;
    outcome: HookExecResult;
  }[] = [
    {
      name: "the stdout of a hook that exits 0",
      input: { command: "guard" },
      drive: async (child) => {
        child.stdout?.write("notes saved\n");
        await child.close(0);
      },
      outcome: { kind: "noop", postCompactRun: { succeeded: true, output: "notes saved\n" } },
    },
    {
      name: "the stderr block of a hook that exits 2",
      input: { command: "guard" },
      drive: async (child) => {
        child.stderr?.write("not now\n");
        await child.close(2);
      },
      outcome: {
        kind: "block",
        reason: "not now",
        fromStderr: true,
        postCompactRun: { succeeded: false, output: "not now\n" },
      },
    },
    {
      name: "the onFailure block of a hook that exits 1",
      input: { command: "guard", onFailure: "block" },
      drive: async (child) => {
        child.stderr?.write("boom\n");
        await child.close(1);
      },
      outcome: {
        kind: "block",
        reason: `${ON_FAILURE_HEAD}\nboom`,
        suppressOriginalPrompt: true,
        postCompactRun: { succeeded: false, output: `${ON_FAILURE_RUN}\nboom` },
      },
    },
    {
      name: "the start error of a hook that cannot start",
      input: { command: "guard" },
      drive: (child) => {
        child.emitError(new Error("refusing /home/alice/.pi/agent/data/acme"));
        return Promise.resolve();
      },
      outcome: {
        kind: "noop",
        failure: { kind: "spawn", error: "refusing acme" },
        postCompactRun: { succeeded: false, output: "refusing acme" },
      },
    },
    {
      name: "the onFailure block of a hook that cannot start",
      input: { command: "guard", onFailure: "block" },
      drive: (child) => {
        child.stderr?.write("no shell\n");
        child.emitError(new Error("spawn guard ENOENT"));
        return Promise.resolve();
      },
      outcome: {
        kind: "block",
        reason: `${ON_FAILURE_HEAD}\nno shell`,
        suppressOriginalPrompt: true,
        postCompactRun: { succeeded: false, output: `${ON_FAILURE_RUN}\nspawn guard ENOENT` },
      },
    },
    {
      name: "Claude Code's text for a hook its timeout stopped",
      input: { command: "guard", timeout: 1 },
      drive: async (child, t) => {
        t.mock.timers.tick(1_000);
        await child.close(null, "SIGTERM");
      },
      outcome: { kind: "noop", postCompactRun: { succeeded: false, output: "Hook cancelled" } },
    },
    {
      name: "the timed-out onFailure block without the stderr in the run",
      input: { command: "guard", onFailure: "block", timeout: 1 },
      drive: async (child, t) => {
        child.stderr?.write("late\n");
        t.mock.timers.tick(1_000);
        await child.close(null, "SIGTERM");
      },
      outcome: {
        kind: "block",
        reason: '[guard]: timed out; blocking because onFailure is "block"\nlate',
        suppressOriginalPrompt: true,
        postCompactRun: {
          succeeded: false,
          output: 'timed out; blocking because onFailure is "block"',
        },
      },
    },
  ];

  for (const { name, input, drive, outcome } of cases) {
    test(`carries ${name}`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });

      // act
      const hookOutcome = await dispatchDriven(
        t,
        { ...input, claudeEvent: "PostCompact" },
        (child) => drive(child, t),
        POST_COMPACT_EVENT,
      );

      // assert
      assert.deepStrictEqual(hookOutcome, outcome);
    });
  }

  test("carries the redacted cause of a hook whose spawn throws", async (t) => {
    // arrange
    const caseRoot = await makeCaseRoot(t, "dispatch-start-throw-");
    const spawnImpl = throwingSpawn(t, "refusing /home/alice/.pi/agent/data/acme");

    // act
    const hookOutcome = await dispatchHookExec(
      makeEntry(caseRoot, { command: "guard", claudeEvent: "PostCompact", onFailure: "block" }),
      POST_COMPACT_EVENT,
      makeContext(caseRoot),
      undefined,
      createHooksRuntime(),
      { spawnImpl },
    );

    // assert
    assert.deepStrictEqual(hookOutcome, {
      kind: "block",
      reason: `${ON_FAILURE_HEAD}\nrefusing acme`,
      suppressOriginalPrompt: true,
      postCompactRun: { succeeded: false, output: `${ON_FAILURE_RUN}\nrefusing acme` },
    });
  });
});

/** A spawn port that throws before any child exists, as a NUL byte in the command does. */
function throwingSpawn(
  t: import("node:test").TestContext,
  message = "The argument 'file' must be a string without null bytes",
): typeof spawn {
  return t.mock.fn(
    new Proxy(spawn, {
      apply(): ChildProcess {
        throw new TypeError(message);
      },
    }),
  );
}

test("blocks a hook whose spawn throws when onFailure is block", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-start-throw-");

  // act
  const hookOutcome = await dispatchHookExec(
    makeEntry(caseRoot, { command: "guard", onFailure: "block" }),
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    { spawnImpl: throwingSpawn(t) },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `${ON_FAILURE_HEAD}\nThe argument 'file' must be a string without null bytes`,
    suppressOriginalPrompt: true,
  });
});

test("redacts absolute paths from the cause of a hook that cannot start", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-start-throw-");
  const spawnImpl = throwingSpawn(t, "refusing /home/alice/.pi/agent/data/acme");

  // act
  const hookOutcome = await dispatchHookExec(
    makeEntry(caseRoot, { command: "guard", onFailure: "block" }),
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    { spawnImpl },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `${ON_FAILURE_HEAD}\nrefusing acme`,
    suppressOriginalPrompt: true,
  });
});

test("settles a hook whose spawn throws without onFailure with the runner failure (D-PG5-10)", async (t) => {
  // arrange
  const caseRoot = await makeCaseRoot(t, "dispatch-start-throw-");

  // act
  const hookOutcome = await dispatchHookExec(
    makeEntry(caseRoot, { command: "guard" }),
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    createHooksRuntime(),
    { spawnImpl: throwingSpawn(t, "refusing /home/alice/.pi/agent/data/acme") },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "run", error: "refusing acme" },
  });
});

test("settles a hook whose child cannot be spawned with the redacted spawn failure (D-PG5-10)", async (t) => {
  // arrange
  const spawnError = new Error("spawn /home/alice/plugins/demo/hooks/guard.sh ENOENT");

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, (child) => {
    child.emitError(spawnError);
    return Promise.resolve();
  });

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "spawn", error: "spawn guard.sh ENOENT" },
  });
});

test("settles a hook that exits 1 without onFailure with its failure (D-PG5-10)", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stderr?.write("boom\n");
    await child.close(1);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "exit", stderr: "boom\n" },
  });
});

test("settles a hook that prints a JSON object before it exits 1 with no failure (D-PG5-10)", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stdout?.write('{"systemMessage":"hi"}');
    child.stderr?.write("boom\n");
    await child.close(1);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop", systemMessage: "hi" });
});

test("settles a hook that a signal other than its timeout ended with its failure (D-PG5-10)", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stderr?.write("killed\n");
    await child.close(null, "SIGKILL");
  });

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "exit", stderr: "killed\n" },
  });
});

test("settles a hook that its own timeout ended with no failure (D-PG5-10)", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard", timeout: 1 }, async (child) => {
    t.mock.timers.tick(1_000);
    child.stderr?.write("late\n");
    await child.close(null, "SIGTERM");
  });

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("keeps the JSON system message of a hook that its timeout ended and that exits 1", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard", timeout: 1 }, async (child) => {
    t.mock.timers.tick(1_000);
    child.stdout?.write('{"systemMessage":"late"}');
    await child.close(1);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop", systemMessage: "late" });
});

test("keeps the JSON block of a hook that its timeout ended and that exits 1", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard", timeout: 1 }, async (child) => {
    t.mock.timers.tick(1_000);
    child.stdout?.write('{"decision":"block","reason":"late"}');
    await child.close(1);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "late" });
});

test("keeps the exit-2 block of a hook with onFailure block", async (t) => {
  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stderr?.write("denied\n");
      await child.close(2);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "denied", fromStderr: true });
});

test("blocks a hook that exits 1 with its whole stderr past 64 KB when onFailure is block", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stderr?.write("boom\n");
      child.stderr?.write(Buffer.alloc(64 * 1024, 0x65));
      await child.close(1);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `${ON_FAILURE_HEAD}\nboom\n${"e".repeat(64 * 1024)}`,
    suppressOriginalPrompt: true,
  });
});

test("blocks a hook that exits 2 with its whole stderr past 64 KB", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signals: readonly NodeJS.Signals[] = [];

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stderr?.write("denied\n");
    child.stderr?.write(Buffer.alloc(64 * 1024, 0x65));
    signals = [...child.killSignals];
    await child.close(2);
  });

  // assert
  assert.deepStrictEqual(signals, []);
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `denied\n${"e".repeat(64 * 1024)}`,
    fromStderr: true,
  });
});

test("blocks a hook that exits 2 after more than 1 MB of plain stdout with its stderr", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signals: readonly NodeJS.Signals[] = [];

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stderr?.write("denied\n");
    child.stdout?.write(Buffer.alloc(1024 * 1024 + 1, 0x78));
    signals = [...child.killSignals];
    await child.close(2);
  });

  // assert
  assert.deepStrictEqual(signals, []);
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "denied", fromStderr: true });
});

test("applies the stdout deny of a hook whose stderr passes 64 KB", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const deny = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "no echo",
    },
  });

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stdout?.write(deny);
    child.stderr?.write(Buffer.alloc(64 * 1024 + 1, 0x65));
    await child.close(0);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "no echo" });
});

test("keeps a hook that exits 0 after more than 1 MB of plain stdout a noop when onFailure is block", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(
    t,
    { command: "guard", onFailure: "block" },
    async (child) => {
      child.stdout?.write(Buffer.alloc(1024 * 1024 + 1, 0x78));
      await child.close(0);
    },
  );

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
});

test("contains an EPIPE from stdin after registering its error listener", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
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
    runtime,
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

test("contains an EPIPE from stdout after registering its error listener", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-stdout-epipe-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const pipeError = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.emit("error", pipeError);
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("stdout error") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("read ECONNRESET"),
    ),
    true,
  );
});

test("contains an EPIPE from stderr after registering its error listener", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-stderr-epipe-");
  const errorSpy = observeDebug(t);
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot);
  const pipeError = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stderr?.emit("error", pipeError);
  await processChild.close(0);
  const hookOutcome = await pendingOutcome;
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, { kind: "noop" });
  assert.strictEqual(
    lines.some(
      (line) =>
        line.includes("stderr error") &&
        line.includes("dispatch-plugin/PreToolUse") &&
        line.includes("read ECONNRESET"),
    ),
    true,
  );
});

test("contains a synchronous stdin end failure and cancels on child error", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-stdin-end-throw-");
  const errorSpy = observeDebug(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stdin = new PassThrough();
  t.mock.method(stdin, "end", (): never => {
    throw new Error("synchronous stdin end failure");
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
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  processChild.emitError(new Error("child error after stdin failure"));
  t.mock.timers.tick(6_000);
  const lines = debugLines(errorSpy);

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "noop",
    failure: { kind: "run", error: "synchronous stdin end failure" },
  });
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

test("applies a JSON deny larger than 1 MB that a hook prints in chunks on exit 0", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const head =
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",' +
    '"permissionDecisionReason":"too large to skip"},"padding":"';
  let signals: readonly NodeJS.Signals[] = [];

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stdout?.write(head);
    child.stdout?.write(Buffer.alloc(1024 * 1024, 0x78));
    child.stdout?.write(Buffer.alloc(512 * 1024, 0x78));
    child.stdout?.write('"}\n');
    signals = [...child.killSignals];
    await child.close(0);
  });

  // assert
  assert.deepStrictEqual(signals, []);
  assert.deepStrictEqual(hookOutcome, { kind: "block", reason: "too large to skip" });
});

test("lets a hook that prints more than 1 MB run to its timeout", async (t) => {
  // arrange
  const runtime = createHooksRuntime();
  const caseRoot = await makeCaseRoot(t, "dispatch-stdout-overflow-");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const processChild = makeInjectedChild(t);
  const processBoundary = observeSpawn(t, processChild);
  const entry = makeEntry(caseRoot, { command: "guard", timeout: 60, onFailure: "block" });

  // act
  const pendingOutcome = dispatchHookExec(
    entry,
    { toolName: "bash", input: {} },
    makeContext(caseRoot),
    undefined,
    runtime,
    { spawnImpl: processBoundary.spawnImpl },
  );
  await processBoundary.spawned;
  processChild.stdout?.write(Buffer.alloc(1024 * 1024 + 1, 0x78));
  processChild.stdout?.write("{");
  t.mock.timers.tick(59_999);
  const beforeTimeoutSignals = [...processChild.killSignals];
  t.mock.timers.tick(1);
  const timeoutSignals = [...processChild.killSignals];
  await processChild.close(null, "SIGTERM");
  const hookOutcome = await pendingOutcome;

  // assert
  assert.deepStrictEqual(beforeTimeoutSignals, []);
  assert.deepStrictEqual(timeoutSignals, ["SIGTERM"]);
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: '[guard]: timed out; blocking because onFailure is "block"',
    suppressOriginalPrompt: true,
  });
});

test("blocks on the exit code of a hook whose two streams pass 1 MB and 64 KB", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });

  // act
  const hookOutcome = await dispatchDriven(t, { command: "guard" }, async (child) => {
    child.stderr?.write("denied\n");
    child.stdout?.write(Buffer.alloc(1024 * 1024 + 1, 0x78));
    child.stderr?.write(Buffer.alloc(64 * 1024, 0x65));
    child.stderr?.write("more\n");
    await child.close(2);
  });

  // assert
  assert.deepStrictEqual(hookOutcome, {
    kind: "block",
    reason: `denied\n${"e".repeat(64 * 1024)}more`,
    fromStderr: true,
  });
});

describe("the 10,000-character context cap (D-PG5-14, D-PG5-15)", () => {
  const PROMPT_EVENT = { type: "input", text: "hello", source: "interactive" } satisfies InputEvent;
  const BIG = "x".repeat(12_000);
  const SAVED_WRAPPER =
    "<persisted-output>\n" +
    "Output too large (11.7KB). Full output saved to: /saved/hook.txt\n\n" +
    `Preview (first 2KB):\n${"x".repeat(2_000)}\n...\n</persisted-output>`;

  function contextStdout(context: string, extra = ""): string {
    return `{${extra}"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"${context}"}}`;
  }

  // A writer double that records each save and settles as `outcome` gives.
  function createSaver(outcome: () => Promise<string> = () => Promise.resolve("/saved/hook.txt")) {
    const saves: { dataRoot: string; id: string; source: string; text: string }[] = [];
    let announceSave: () => void = () => undefined;
    const saving = new Promise<void>((resolve) => {
      announceSave = resolve;
    });
    const saveHookOutput = (
      loc: { readonly dataRoot: string },
      id: string,
      source: string,
      text: string,
    ): Promise<string> => {
      saves.push({ dataRoot: loc.dataRoot, id, source, text });
      announceSave();
      return outcome();
    };

    return { saves, saving, saveHookOutput };
  }

  async function dispatchPrompt(
    t: import("node:test").TestContext,
    stdout: string,
    saver: ReturnType<typeof createSaver>,
  ): Promise<{ readonly outcome: HookExecResult; readonly dataRoot: string }> {
    const caseRoot = await makeCaseRoot(t, "dispatch-context-cap-");
    const processChild = makeInjectedChild(t);
    const processBoundary = observeSpawn(t, processChild);
    const pendingOutcome = dispatchHookExec(
      makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" }),
      PROMPT_EVENT,
      makeContext(caseRoot),
      undefined,
      createHooksRuntime(),
      {
        spawnImpl: processBoundary.spawnImpl,
        dispatchId: () => "id-1",
        saveHookOutput: saver.saveHookOutput,
      },
    );
    await processBoundary.spawned;
    processChild.stdout?.write(stdout);
    await processChild.close(0);
    return {
      outcome: await pendingOutcome,
      dataRoot: path.join(caseRoot, ".pi", "pi-claude-marketplace", "data"),
    };
  }

  test("settles a 12,000-character additionalContext as the saved wrapper", async (t) => {
    // arrange
    const saver = createSaver();

    // act
    const { outcome, dataRoot } = await dispatchPrompt(t, contextStdout(BIG), saver);

    // assert
    assert.deepStrictEqual(
      { outcome, saves: saver.saves },
      {
        outcome: { kind: "mutate", additionalContext: SAVED_WRAPPER },
        saves: [{ dataRoot, id: "id-1", source: "additionalContext", text: BIG }],
      },
    );
  });

  test("saves 12,000 characters of plain prompt stdout with the source stdout", async (t) => {
    // arrange
    const saver = createSaver();

    // act
    const { outcome, dataRoot } = await dispatchPrompt(t, `${BIG}\n`, saver);

    // assert
    assert.deepStrictEqual(
      { outcome, saves: saver.saves },
      {
        outcome: { kind: "mutate", additionalContext: SAVED_WRAPPER },
        saves: [{ dataRoot, id: "id-1", source: "stdout", text: BIG }],
      },
    );
  });

  for (const { name, stdout, outcome } of [
    {
      name: "a context of 10,000 characters",
      stdout: contextStdout("x".repeat(10_000)),
      outcome: { kind: "mutate", additionalContext: "x".repeat(10_000) },
    },
    {
      name: "a context of 6,000 characters",
      stdout: contextStdout("x".repeat(6_000)),
      outcome: { kind: "mutate", additionalContext: "x".repeat(6_000) },
    },
    {
      name: "a result with no context",
      stdout: '{"suppressOutput":true}',
      outcome: { kind: "noop", suppressOutput: true },
    },
  ] satisfies { name: string; stdout: string; outcome: HookExecResult }[]) {
    test(`settles ${name} unchanged and saves nothing`, async (t) => {
      // arrange
      const saver = createSaver();

      // act
      const settled = await dispatchPrompt(t, stdout, saver);

      // assert
      assert.deepStrictEqual(
        { outcome: settled.outcome, saves: saver.saves },
        { outcome, saves: [] },
      );
    });
  }

  test("settles the failure text and keeps the decision when the save rejects", async (t) => {
    // arrange
    const saver = createSaver(() => Promise.reject(new Error("disk full")));
    const marker =
      "\n\n[Hook additionalContext truncated at 10000 chars \u2014 persist-to-disk failed: disk full]";

    // act
    const { outcome } = await dispatchPrompt(
      t,
      contextStdout(BIG, '"decision":"block","reason":"no",'),
      saver,
    );

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "block",
      reason: "no",
      additionalContext: "x".repeat(10_000 - marker.length) + marker,
    });
  });

  test("writes the saved file under the scope's data root with the production writer", async (t) => {
    // arrange
    const caseRoot = await makeCaseRoot(t, "dispatch-context-file-");
    const processChild = makeInjectedChild(t);
    const processBoundary = observeSpawn(t, processChild);
    const folder = path.join(
      caseRoot,
      ".pi",
      "pi-claude-marketplace",
      "data",
      "_shared",
      "hook-output",
    );

    // act
    const pendingOutcome = dispatchHookExec(
      makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" }),
      PROMPT_EVENT,
      makeContext(caseRoot),
      undefined,
      createHooksRuntime(),
      { spawnImpl: processBoundary.spawnImpl },
    );
    await processBoundary.spawned;
    processChild.stdout?.write(contextStdout(BIG));
    await processChild.close(0);
    const outcome = await pendingOutcome;
    const names = await readdir(folder);
    const savedPath = path.join(folder, names[0] ?? "");

    // assert
    assert.deepStrictEqual(
      {
        names: names.map((name) => /^hook-[0-9a-f-]{36}-additionalContext\.txt$/u.test(name)),
        outcome,
        saved: await readFile(savedPath, "utf8"),
      },
      {
        names: [true],
        outcome: {
          kind: "mutate",
          additionalContext: SAVED_WRAPPER.replace("/saved/hook.txt", savedPath),
        },
        saved: BIG,
      },
    );
  });

  test("cancels the timer at close, before the save ends, and ignores an error during the save", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let releaseSave: (filePath: string) => void = () => undefined;
    const held = new Promise<string>((resolve) => {
      releaseSave = resolve;
    });
    const saver = createSaver(() => held);
    const caseRoot = await makeCaseRoot(t, "dispatch-context-order-");
    const processChild = makeInjectedChild(t);
    const processBoundary = observeSpawn(t, processChild);
    let settlements = 0;

    // act
    const pendingOutcome = dispatchHookExec(
      makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit", timeout: 2 }),
      PROMPT_EVENT,
      makeContext(caseRoot),
      undefined,
      createHooksRuntime(),
      { spawnImpl: processBoundary.spawnImpl, saveHookOutput: saver.saveHookOutput },
    );
    void pendingOutcome.then(() => {
      settlements += 1;
    });
    await processBoundary.spawned;
    processChild.stdout?.write(contextStdout(BIG));
    await processChild.close(0);
    await saver.saving;
    t.mock.timers.tick(7_000);
    processChild.emitError(new Error("late during the save"));
    const settledDuringSave = settlements;
    releaseSave("/saved/hook.txt");
    const outcome = await pendingOutcome;

    // assert
    assert.deepStrictEqual(
      { settledDuringSave, killSignals: processChild.killSignals, outcome, settlements },
      {
        settledDuringSave: 0,
        killSignals: [],
        outcome: { kind: "mutate", additionalContext: SAVED_WRAPPER },
        settlements: 1,
      },
    );
  });

  test("settles a spawn error once when the process closes after it", async (t) => {
    // arrange
    const caseRoot = await makeCaseRoot(t, "dispatch-error-then-close-");
    const processChild = makeInjectedChild(t);
    const processBoundary = observeSpawn(t, processChild);

    // act
    const pendingOutcome = dispatchHookExec(
      makeEntry(caseRoot, { claudeEvent: "UserPromptSubmit" }),
      PROMPT_EVENT,
      makeContext(caseRoot),
      undefined,
      createHooksRuntime(),
      { spawnImpl: processBoundary.spawnImpl },
    );
    await processBoundary.spawned;
    processChild.emitError(new Error("spawn ENOENT"));
    processChild.stdout?.write(contextStdout(BIG));
    await processChild.close(0);
    const outcome = await pendingOutcome;

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "noop",
      failure: { kind: "spawn", error: "spawn ENOENT" },
    });
  });
});
