/**
 * @fileoverview Runs several Pi sessions of one sandbox side by side, a main
 * session and pi-subagents background children, and observes the async hooks
 * they leave waiting: each hook's process and the record that the hooks
 * bridge keeps of it, so that a later load can stop the hook after a crash.
 *
 * Each Pi runs in RPC mode with the real extension and the extensions the
 * caller names, the scripted model first. A child Pi carries pi-subagents'
 * marker `PI_SUBAGENT_CHILD=1` in its spawn environment (D-BG-10). Every Pi
 * selects the scripted model and turns auto retry off, so a call past the
 * script fails at once.
 *
 * A waiting hook is a script hook with `waits` (D-BG-12). Its start line in
 * the lifecycle log gives its pid, and Linux's `/proc/<pid>/environ` gives its
 * dispatch marker, `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH`. The record of the
 * hook is the journal under `<data root>/_shared` whose rows hold that
 * marker: the main session's PID table, or the child journal of the session
 * that started the hook. An observation reads the hook's process and its
 * journal again: the journal is kept while its bytes are those that the
 * capture read.
 *
 * A stand-in child gets the agent pi-subagents launches it as in the
 * structured section of its system prompt that pi-subagents tags (E1, E3):
 * the tag `<active_agent name="..."/>` with the name XML-escaped as
 * pi-subagents escapes it, a blank line, and the agent's body. Pi reads
 * `<agent dir>/SYSTEM.md` as that section in replace mode and
 * `<agent dir>/APPEND_SYSTEM.md` in append mode, when it starts and when it
 * starts a new session, before any extension's before-run handler. A stand-in
 * is not a real pi-subagents launch: `features/lib/real-subagent-child.ts`
 * runs the installed companion.
 *
 * Every wait is bounded by `STAGE_TIMEOUT_MS`. `close()` stops every Pi that
 * the session started and kills the process group of every hook script of
 * the sandbox that still runs with its dispatch marker and the sandbox HOME,
 * so a failed assertion leaves no process behind.
 */

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { promptDisposition } from "../../test/e2e/_rpc.ts";

import { closeHookGate, openHookGate, readHookScriptPids } from "./hook-files.ts";
import { HOOK_LIFECYCLE_LOG, waitForHookLifecycle } from "./hook-recorder.ts";
import { startSession } from "./pi-commands.ts";
import { DIALOG_METHODS, PiProcess } from "./pi-process.ts";
import { harnessDirectory, isRunning, readLogLengths, readLogLinesSince } from "./turn-records.ts";

import type { HookGate } from "./hook-files.ts";
import type { HookLifecycleEvent } from "./hook-recorder.ts";
import type { RpcGitEnvironment, RpcRecord, RpcRequest, RpcSandbox } from "./pi-process.ts";

/**
 * The bound of every stage: a Pi's start with a warm compile cache, a
 * scripted turn, a hook's start or end, and a journal write each take a few
 * seconds at most; the margin covers a loaded CI runner.
 */
export const STAGE_TIMEOUT_MS = 30_000;

// How often a wait reads the files it waits on again.
const POLL_MS = 50;

// The variable whose value names one async hook's dispatch (D-62-05).
const DISPATCH_MARKER = "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH";

// The main session's PID table and the directory of the child journals,
// under `<data root>/_shared`.
const PID_TABLE = "async-rewake-pids.json";
const CHILD_JOURNALS = "async-rewake-children";

/** Whether a Pi runs as a main session or as a pi-subagents background child. */
export type SessionRole = "main" | "child";

/**
 * The section of a child's system prompt that pi-subagents tags: Pi's custom
 * prompt when the agent replaces the system prompt, its appended prompt
 * otherwise (E1).
 */
export type ChildPromptMode = "append" | "replace";

const PROMPT_SECTION_FILES: Readonly<Record<ChildPromptMode, string>> = {
  append: "APPEND_SYSTEM.md",
  replace: "SYSTEM.md",
};

/** Where the Pis of a session run and what they load. */
export interface SubagentHookSessionOptions {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  /** The `TMPDIR` of every Pi, whose `jiti` entry holds the compile cache. */
  readonly temporaryDirectory: string;
  /** The extensions every Pi loads after the real one, the scripted model first. */
  readonly extensions: readonly string[];
  /** `<scope root>/pi-claude-marketplace/data` of the scope the hooks are installed in. */
  readonly dataRoot: string;
}

/** A hook script that waits for its release, and its record as a capture read it. */
export interface WaitingHook {
  readonly hook: string;
  readonly pid: number;
  readonly dispatchId: string;
  readonly journal: string;
  readonly journalText: string;
}

/** Whether a waiting hook still runs, and whether its journal kept its bytes. */
export interface WaitingHookObservation {
  readonly hook: string;
  readonly running: boolean;
  readonly record: "kept" | "changed" | "removed";
}

/** What a waiting hook's journal and process hold after one stage of a child. */
export interface ChildStageObservation {
  readonly stage: ChildStage;
  readonly hooks: readonly WaitingHookObservation[];
}

/** The stages of a child that `runChildStages` observes after, in order. */
export type ChildStage = "load" | "hook start" | "hook end" | "new session" | "stop";

/** The tagged section of a stand-in child's system prompt and its text. */
export interface ChildPromptSection {
  readonly mode: ChildPromptMode;
  readonly text: string;
}

/** The Pis of one sandbox and the waiting hooks they start. */
export interface SubagentHookSession {
  /**
   * Starts a Pi in `role` and selects the scripted model. With `prompt`, the
   * Pi loads that section of its system prompt, and the sandbox's sections
   * are as they were once it started, so a Pi that starts later loads them.
   */
  start(role: SessionRole, prompt?: ChildPromptSection): Promise<PiProcess>;
  /**
   * Prompts `pi`, waits for its turn to settle, asserts that Pi reported no
   * fault, and returns the records since the prompt.
   */
  runTurn(pi: PiProcess, prompt: string): Promise<readonly RpcRecord[]>;
  /**
   * Prompts `pi`, waits for the turn to settle and for `hook` to log a start,
   * asserts that the hook has not ended, and captures it.
   */
  promptPastWaitingHook(pi: PiProcess, prompt: string, hook: string): Promise<WaitingHook>;
  /** Captures every hook of the lifecycle log that started and has not ended, by start order. */
  waitingHooks(): Promise<readonly WaitingHook[]>;
  /** Reads each hook's process and journal again. */
  observe(hooks: readonly WaitingHook[]): Promise<readonly WaitingHookObservation[]>;
  /**
   * Starts a child, runs `hook` for `prompt` in it until the hook ends, starts
   * a new session in it, and stops it, observing `foreign` after each stage.
   * Returns the child's records and the observations in stage order.
   */
  runChildStages(
    foreign: readonly WaitingHook[],
    prompt: string,
    hook: string,
  ): Promise<{
    readonly records: readonly RpcRecord[];
    readonly stages: readonly ChildStageObservation[];
  }>;
  /** Releases `hook` and returns the end line it logs after the release. */
  release(hook: string): Promise<HookLifecycleEvent>;
  /** Stops every Pi of the session and every hook script of the sandbox that still runs. */
  close(): Promise<void>;
}

function isFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" &&
      typeof record.method === "string" &&
      DIALOG_METHODS.has(record.method))
  );
}

/**
 * Settles as `promise` does, or rejects naming `what` when it does not settle
 * within `timeoutMs`. The timer stops once `promise` settles.
 */
export async function within<T>(promise: Promise<T>, timeoutMs: number, what: string): Promise<T> {
  const controller = new AbortController();
  const timeout = delay(timeoutMs, undefined, { signal: controller.signal }).then(() => {
    throw new Error(`${what} did not finish within ${timeoutMs} ms`);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    controller.abort();
    timeout.catch(() => undefined);
  }
}

// Waits until `check` returns a value, reading again every `POLL_MS`, and
// fails with `what` after `STAGE_TIMEOUT_MS`.
async function poll<T>(check: () => Promise<T | undefined>, what: string): Promise<T> {
  const deadline = Date.now() + STAGE_TIMEOUT_MS;
  for (;;) {
    const value = await check();
    if (value !== undefined) {
      return value;
    }

    assert.ok(Date.now() < deadline, `${what} within ${STAGE_TIMEOUT_MS} ms`);
    await delay(POLL_MS);
  }
}

// Reads a file or directory that is gone as nothing, and rethrows any other failure.
function absentWhenMissing(error: unknown): undefined {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return undefined;
  }

  throw error;
}

async function readOptional(file: string): Promise<string | undefined> {
  return readFile(file, "utf8").catch(absentWhenMissing);
}

/** Returns `mode` as a prompt mode, or throws when it names none. */
export function parseChildPromptMode(mode: string): ChildPromptMode {
  if (mode !== "append" && mode !== "replace") {
    throw new Error(`a child prompt mode is append or replace, not ${mode}`);
  }

  return mode;
}

// pi-subagents' `escapeXmlAttr` in `src/runs/shared/child-launch.js`.
function escapeXmlAttribute(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Returns the section text that pi-subagents' launch builds for the agent
 * `agent` with the body `body`: its tag, a blank line, and the body.
 */
export function taggedChildPrompt(agent: string, body: string): string {
  return `<active_agent name="${escapeXmlAttribute(agent)}"/>\n\n${body}`;
}

/**
 * Writes `text` as the `mode` section of the system prompt of each Pi that
 * starts, or starts a new session, with the agent directory `agentDir`, and
 * removes the other section, so one section holds the stand-in's metadata.
 */
export async function writeChildPromptSection(
  agentDir: string,
  mode: ChildPromptMode,
  text: string,
): Promise<void> {
  await removeChildPromptSections(agentDir);
  await writeFile(path.join(agentDir, PROMPT_SECTION_FILES[mode]), text);
}

/** Removes both prompt sections from `agentDir`, so a Pi that loads later has no metadata. */
export async function removeChildPromptSections(agentDir: string): Promise<void> {
  await Promise.all(
    Object.values(PROMPT_SECTION_FILES).map((file) =>
      rm(path.join(agentDir, file), { force: true }),
    ),
  );
}

// The prompt sections of `agentDir` as they are, so a write for one Pi can be undone.
async function readChildPromptSections(
  agentDir: string,
): Promise<ReadonlyMap<ChildPromptMode, string>> {
  const sections = new Map<ChildPromptMode, string>();
  for (const mode of ["append", "replace"] as const) {
    const text = await readOptional(path.join(agentDir, PROMPT_SECTION_FILES[mode]));
    if (text !== undefined) {
      sections.set(mode, text);
    }
  }

  return sections;
}

async function restoreChildPromptSections(
  agentDir: string,
  sections: ReadonlyMap<ChildPromptMode, string>,
): Promise<void> {
  await removeChildPromptSections(agentDir);
  for (const [mode, text] of sections) {
    await writeFile(path.join(agentDir, PROMPT_SECTION_FILES[mode]), text);
  }
}

// The environment of process `pid` as name-value lines, or none once it exited.
async function processEnvironment(pid: number): Promise<readonly string[]> {
  const text = await readOptional(`/proc/${pid}/environ`);
  return text?.split("\0") ?? [];
}

// The dispatch marker in the environment of process `pid`, if it carries one.
async function dispatchMarkerOf(pid: number): Promise<string | undefined> {
  assert.strictEqual(process.platform, "linux", "a hook's dispatch marker is read from /proc");
  const prefix = `${DISPATCH_MARKER}=`;
  const line = (await processEnvironment(pid)).find((entry) => entry.startsWith(prefix));
  return line?.slice(prefix.length);
}

// Every journal file under `<data root>/_shared`: the PID table, then the
// child journals in name order.
async function journalFiles(dataRoot: string): Promise<readonly string[]> {
  const shared = path.join(dataRoot, "_shared");
  const children = path.join(shared, CHILD_JOURNALS);
  const names = (await readdir(children).catch(absentWhenMissing)) ?? [];
  return [
    path.join(shared, PID_TABLE),
    ...names
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => path.join(children, name)),
  ];
}

function holdsDispatch(text: string, dispatchId: string): boolean {
  const journal: unknown = JSON.parse(text);
  const entries =
    typeof journal === "object" && journal !== null && "entries" in journal
      ? journal.entries
      : undefined;
  assert.ok(Array.isArray(entries), `a hook journal holds no entries: ${text}`);
  return entries.some(
    (entry: unknown) =>
      typeof entry === "object" &&
      entry !== null &&
      "dispatchId" in entry &&
      entry.dispatchId === dispatchId,
  );
}

// The journal whose rows hold `dispatchId`, with its text, if one does yet.
async function journalHolding(
  dataRoot: string,
  dispatchId: string,
): Promise<{ readonly journal: string; readonly journalText: string } | undefined> {
  for (const journal of await journalFiles(dataRoot)) {
    const journalText = await readOptional(journal);
    if (journalText !== undefined && holdsDispatch(journalText, dispatchId)) {
      return { journal, journalText };
    }
  }

  return undefined;
}

// Captures the hook `hook` whose script runs as `pid`: its dispatch marker and
// the journal that records it, once the bridge wrote that journal.
async function captureHook(dataRoot: string, hook: string, pid: number): Promise<WaitingHook> {
  assert.ok(isRunning(pid), `the hook ${hook} (pid ${pid}) no longer runs, and it logged no end`);
  const dispatchId = await dispatchMarkerOf(pid);
  assert.ok(dispatchId !== undefined, `the hook ${hook} (pid ${pid}) carries no dispatch marker`);
  const record = await poll(
    () => journalHolding(dataRoot, dispatchId),
    `no hook journal recorded the hook ${hook}`,
  );
  return { hook, pid, dispatchId, ...record };
}

// The hooks of the lifecycle log in `harness` that logged a start and no end,
// as start lines, in start order.
async function unendedStarts(harness: string): Promise<readonly HookLifecycleEvent[]> {
  const logs = await readLogLinesSince(harness, new Map());
  const events = (logs.get(HOOK_LIFECYCLE_LOG) ?? []) as readonly HookLifecycleEvent[];
  const ended = new Set(events.filter((event) => event.phase === "end").map((event) => event.pid));
  return events.filter((event) => event.phase === "start" && !ended.has(event.pid));
}

/**
 * Returns each hook of the sandbox whose HOME is `home` that logged a start
 * and no end, in start order, and whether its script still runs.
 */
export async function unendedHookProcesses(
  home: string,
): Promise<readonly { readonly hook: string; readonly running: boolean }[]> {
  const starts = await unendedStarts(harnessDirectory(home));
  return starts.map((event) => ({ hook: event.hook, running: isRunning(event.pid) }));
}

async function observeHook(hook: WaitingHook): Promise<WaitingHookObservation> {
  const text = await readOptional(hook.journal);
  let record: WaitingHookObservation["record"] = "changed";
  if (text === undefined) {
    record = "removed";
  } else if (text === hook.journalText) {
    record = "kept";
  }

  return { hook: hook.hook, running: isRunning(hook.pid), record };
}

// Whether `pid` is a hook script of the sandbox whose HOME is `home`: it
// carries a dispatch marker and that HOME, so a recycled pid is never killed.
async function isSandboxHook(pid: number, home: string): Promise<boolean> {
  const environment = await processEnvironment(pid);
  return (
    environment.includes(`HOME=${home}`) &&
    environment.some((entry) => entry.startsWith(`${DISPATCH_MARKER}=`))
  );
}

function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The script already exited.
    }
  }
}

/**
 * Prepares the Pis of one sandbox. Nothing starts until `start()`, and
 * `close()` stops everything the session started or the sandbox's hooks
 * left running.
 */
export function createSubagentHookSession(
  options: SubagentHookSessionOptions,
): SubagentHookSession {
  const harness = harnessDirectory(options.sandbox.home);
  const started: PiProcess[] = [];
  // The hook gate that every Pi of the session shares, opened at the first
  // start, so that its lifecycle hook scripts run (D-BG-12).
  let hookGate: Promise<HookGate> | undefined;

  async function expectSuccess(pi: PiProcess, request: RpcRequest): Promise<void> {
    const { response } = await within(pi.request(request), STAGE_TIMEOUT_MS, request.type);
    assert.strictEqual(response.success, true, JSON.stringify(response));
  }

  async function startPi(role: SessionRole): Promise<PiProcess> {
    hookGate ??= mkdir(harness, { recursive: true }).then(() => openHookGate(harness));
    const gate = await hookGate;
    const pi = await PiProcess.start(options.sandbox, options.git, {
      extensions: options.extensions,
      environment: {
        TMPDIR: options.temporaryDirectory,
        ...(role === "child" ? { PI_SUBAGENT_CHILD: "1" as const } : {}),
        ...gate.environment,
      },
    });
    started.push(pi);
    return pi;
  }

  async function start(role: SessionRole, prompt?: ChildPromptSection): Promise<PiProcess> {
    let pi: PiProcess;
    if (prompt === undefined) {
      pi = await startPi(role);
    } else {
      const agentDir = options.sandbox.agentDir;
      const sections = await readChildPromptSections(agentDir);
      await writeChildPromptSection(agentDir, prompt.mode, prompt.text);
      try {
        pi = await startPi(role);
        // Pi answers a request only after its startup, so the section is read.
        await expectSuccess(pi, { type: "get_state" });
      } finally {
        await restoreChildPromptSections(agentDir, sections);
      }
    }

    await expectSuccess(pi, { type: "set_model", provider: "faux", modelId: "faux-1" });
    await expectSuccess(pi, { type: "set_auto_retry", enabled: false });
    return pi;
  }

  // Prompts `pi`, asserts that the prompt started a turn, and returns the
  // number of records Pi printed before it.
  async function startTurn(pi: PiProcess, prompt: string): Promise<number> {
    const from = pi.recordCount();
    const { response } = await within(
      pi.request({ type: "prompt", message: prompt }),
      STAGE_TIMEOUT_MS,
      `the prompt ${prompt}`,
    );
    assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
    return from;
  }

  async function runTurn(pi: PiProcess, prompt: string): Promise<readonly RpcRecord[]> {
    const from = await startTurn(pi, prompt);
    const settled = await pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      STAGE_TIMEOUT_MS,
    );
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
    const records = pi.recordsSince(from);
    assert.deepStrictEqual(records.filter(isFault), []);
    return records;
  }

  async function promptPastWaitingHook(
    pi: PiProcess,
    prompt: string,
    hook: string,
  ): Promise<WaitingHook> {
    const lengths = await readLogLengths(harness);
    const from = await startTurn(pi, prompt);
    const [settled, startLine] = await Promise.all([
      pi.waitForRecord(from, (record) => record.type === "agent_settled", STAGE_TIMEOUT_MS),
      waitForHookLifecycle(harness, hook, "start", lengths, STAGE_TIMEOUT_MS),
    ]);
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
    assert.deepStrictEqual(pi.recordsSince(from).filter(isFault), []);
    const unended = await unendedStarts(harness);
    assert.ok(
      unended.some((event) => event.pid === startLine.pid),
      `the hook ${hook} ended before its release`,
    );
    return captureHook(options.dataRoot, hook, startLine.pid);
  }

  async function waitingHooks(): Promise<readonly WaitingHook[]> {
    const starts = await unendedStarts(harness);
    return Promise.all(starts.map((event) => captureHook(options.dataRoot, event.hook, event.pid)));
  }

  async function observe(
    hooks: readonly WaitingHook[],
  ): Promise<readonly WaitingHookObservation[]> {
    return Promise.all(hooks.map((hook) => observeHook(hook)));
  }

  async function release(hook: string): Promise<HookLifecycleEvent> {
    const lengths = await readLogLengths(harness);
    const releases = path.join(options.sandbox.home, "hook-releases");
    const marker = path.join(releases, hook);
    await mkdir(releases, { recursive: true });
    await writeFile(marker, "", { flag: "wx" });
    await poll(
      async () => ((await readOptional(marker)) === undefined ? true : undefined),
      `no run of the hook ${hook} took its release marker`,
    );
    return waitForHookLifecycle(harness, hook, "end", lengths, STAGE_TIMEOUT_MS);
  }

  async function runChildStages(
    foreign: readonly WaitingHook[],
    prompt: string,
    hook: string,
  ): Promise<{
    readonly records: readonly RpcRecord[];
    readonly stages: readonly ChildStageObservation[];
  }> {
    const stages: ChildStageObservation[] = [];
    const after = async (stage: ChildStage): Promise<void> => {
      stages.push({ stage, hooks: await observe(foreign) });
    };

    const child = await start("child");
    await after("load");
    const own = await promptPastWaitingHook(child, prompt, hook);
    await after("hook start");
    await release(hook);
    await poll(
      async () => ((await observeHook(own)).record === "removed" ? true : undefined),
      `the child kept the journal of its ended hook ${hook}`,
    );
    await after("hook end");
    await within(startSession(child), STAGE_TIMEOUT_MS, "the child's new session");
    await after("new session");
    const records = child.recordsSince(0);
    assert.deepStrictEqual(records.filter(isFault), []);
    await within(child.stop(), STAGE_TIMEOUT_MS, "the child's stop");
    await after("stop");
    return { records, stages };
  }

  async function close(): Promise<void> {
    await Promise.all(started.splice(0).map((pi) => pi.stop()));
    if (hookGate !== undefined) {
      await closeHookGate(harness, await hookGate);
    }

    const killed: number[] = [];
    for (const pid of await readHookScriptPids(harness)) {
      if (isRunning(pid) && (await isSandboxHook(pid, options.sandbox.home))) {
        killGroup(pid);
        killed.push(pid);
      }
    }

    await poll(
      () => Promise.resolve(killed.some((pid) => isRunning(pid)) ? undefined : true),
      "a hook script of the sandbox kept running after its group was killed",
    );
  }

  return {
    start,
    runTurn,
    promptPastWaitingHook,
    waitingHooks,
    observe,
    runChildStages,
    release,
    close,
  };
}
