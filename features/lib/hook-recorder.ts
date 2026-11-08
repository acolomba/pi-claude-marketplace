/**
 * @fileoverview The hook recorder: a command a plugin hook runs, which records
 * what the hook received (HAR-04, D-CF1-17).
 *
 * A hook runs a command in a process of its own, so the recorder cannot be a
 * function the steps call. This module is both sides: the fixture writer
 * imports `HOOK_RECORDER_PATH` to write a hook command that runs Node on this
 * file, and run as that command, the module appends one JSON line per run to
 * `<harness dir>/hook-runs.jsonl` and exits 0 with no output, so the hook
 * allows what it was asked about. The line holds the hook event, the whole
 * parsed stdin, the arguments after this file, and every `CLAUDE_*` variable
 * of the environment, plus `CLAUDECODE`, which Claude Code sets beside them.
 * The recorder never filters or merges runs: two hook processes write two
 * lines, in the order they append them.
 *
 * Run with `--lifecycle` as its first argument, then `start` or `end`, the
 * hook's name, the pid of the hook's script, and for `end` the script's exit
 * code, the recorder is the lifecycle mode of a script that outlives its
 * event (D-BG-12). It appends one line to `<harness dir>/hook-lifecycle.jsonl`
 * in one write and exits 0. The line holds only those arguments: the
 * lifecycle mode reads no stdin and records nothing of the environment.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { harnessDirectory, readLogLinesSince } from "./turn-records.ts";

/** The absolute path of this file, which a recording hook's command runs. */
export const HOOK_RECORDER_PATH = fileURLToPath(import.meta.url);

/** The name of the log, in the harness directory, that holds one line per hook run. */
export const HOOK_RUNS_LOG = "hook-runs.jsonl";

/**
 * The name of the log, in the harness directory, that holds one line per
 * start and per end of a hook script that outlives its event (D-BG-12).
 */
export const HOOK_LIFECYCLE_LOG = "hook-lifecycle.jsonl";

/** One line of the hook lifecycle log: a hook script started or ended. */
export interface HookLifecycleEvent {
  /** The name of the hook, as its row of the hooks table states it. */
  readonly hook: string;
  /** The pid of the hook's script. */
  readonly pid: number;
  readonly phase: "start" | "end";
  /** The exit code of the script, on an end line only. */
  readonly code?: number;
}

// The first argument that runs the recorder in its lifecycle mode.
const LIFECYCLE_FLAG = "--lifecycle";

// How often a wait reads the lifecycle log again.
const LIFECYCLE_POLL_MS = 50;

/** One line of the hook runs log: what one hook process received. */
export interface HookRun {
  /** The `hook_event_name` of the stdin. */
  readonly event: string;
  /** The whole stdin, parsed as JSON. */
  readonly stdin: Readonly<Record<string, unknown>>;
  /** The arguments of the command after the recorder's path. */
  readonly arguments: readonly string[];
  /** Every `CLAUDE_*` variable of the environment, and `CLAUDECODE`, by name. */
  readonly environment: Readonly<Record<string, string>>;
}

// T-01-31: only Claude's own variables, never the rest of the environment.
function isClaudeVariable(name: string): boolean {
  return name.startsWith("CLAUDE_") || name === "CLAUDECODE";
}

function claudeEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment)
      .filter(
        (entry): entry is [string, string] => isClaudeVariable(entry[0]) && entry[1] !== undefined,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readStdin(): Record<string, unknown> {
  const stdin: unknown = JSON.parse(readFileSync(0, "utf8"));
  if (typeof stdin !== "object" || stdin === null || Array.isArray(stdin)) {
    throw new Error(`the hook stdin is not a JSON object: ${JSON.stringify(stdin)}`);
  }

  return stdin as Record<string, unknown>;
}

// Appends `line` to the harness log `log` in one write, so two hook
// processes never split each other's line.
function appendHarnessLine(log: string, line: unknown): void {
  const home = process.env.HOME;
  if (home === undefined) {
    throw new Error("the hook process has no HOME");
  }

  const directory = harnessDirectory(home);
  mkdirSync(directory, { recursive: true });
  appendFileSync(path.join(directory, log), `${JSON.stringify(line)}\n`);
}

function recordRun(): void {
  const stdin = readStdin();
  const run: HookRun = {
    event: String(stdin.hook_event_name),
    stdin,
    arguments: process.argv.slice(2),
    environment: claudeEnvironment(process.env),
  };
  appendHarnessLine(HOOK_RUNS_LOG, run);
}

function wholeNumber(text: string | undefined, what: string): number {
  if (text === undefined || !/^\d+$/u.test(text)) {
    throw new Error(`a hook lifecycle ${what} is a whole number: ${String(text)}`);
  }

  return Number(text);
}

// Reads the arguments after `--lifecycle`: the phase, the hook, the pid, and
// for `end` the exit code.
function lifecycleEvent(argv: readonly string[]): HookLifecycleEvent {
  const [phase, hook, pid, code, ...rest] = argv;
  if (hook === undefined || rest.length > 0) {
    throw new Error(`a hook lifecycle line has a phase, a hook, and a pid: ${argv.join(" ")}`);
  }

  if (phase === "start" && code === undefined) {
    return { hook, pid: wholeNumber(pid, "pid"), phase };
  }

  if (phase === "end") {
    return { hook, pid: wholeNumber(pid, "pid"), phase, code: wholeNumber(code, "exit code") };
  }

  throw new Error(`a hook lifecycle line starts or ends a hook: ${argv.join(" ")}`);
}

// Returns every line of the hook lifecycle log in `harness`, in append order.
async function readHookLifecycle(harness: string): Promise<readonly HookLifecycleEvent[]> {
  const logs = await readLogLinesSince(harness, new Map());
  return (logs.get(HOOK_LIFECYCLE_LOG) ?? []) as readonly HookLifecycleEvent[];
}

/**
 * Waits until the lifecycle log in `harness` holds a `phase` line of `hook`,
 * by reading it again every `LIFECYCLE_POLL_MS`, never for a fixed time
 * alone, and fails after `timeoutMs`.
 */
export async function waitForHookLifecycle(
  harness: string,
  hook: string,
  phase: HookLifecycleEvent["phase"],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const logged = (event: HookLifecycleEvent): boolean =>
    event.hook === hook && event.phase === phase;
  while (!(await readHookLifecycle(harness)).some(logged)) {
    if (Date.now() >= deadline) {
      throw new Error(`the hook ${hook} logged no ${phase} within ${timeoutMs} ms`);
    }

    await delay(LIFECYCLE_POLL_MS);
  }
}

if (process.argv[1] === HOOK_RECORDER_PATH) {
  if (process.argv[2] === LIFECYCLE_FLAG) {
    appendHarnessLine(HOOK_LIFECYCLE_LOG, lifecycleEvent(process.argv.slice(3)));
  } else {
    recordRun();
  }
}
