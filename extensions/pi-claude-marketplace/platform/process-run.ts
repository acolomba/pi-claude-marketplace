// platform/process-run.ts
//
// SG-PRC-01, SG-PRC-02: the one process launcher that the package manager and
// the git module share. A run starts one command with an argument array and no
// shell, keeps a bounded part of each output stream, and stops the whole
// process tree at its timeout or when its signal aborts. A run never rejects
// for a process failure: a process that cannot start, exits non-zero, or
// outlives the timeout resolves with what happened. A run that outlives the
// timeout settles one kill grace after its SIGKILL even when the process never
// closes, because a child it started may hold the output pipes open, or the
// kill may fail. The process may then still be running.
//
// D-PL9-19: the timeout stops the whole process tree, so a child the process
// started cannot keep running and hold the output pipes. On POSIX the process
// leads its own process group, which gets SIGTERM and then SIGKILL; a group
// signal that fails falls back to the process alone. On Windows both steps run
// taskkill /T /F from the system folder. A pid below 2 signals the process
// alone, because a group signal to it would reach Pi's own group or every
// process.
//
// D-PL9-18: on Windows a command is looked up only in the absolute entries of
// PATH, never in the current directory. In each directory, in PATH order,
// <command>.exe comes before <command>.cmd.
//
// D-PL9-11, D-SG-01: the launcher is injected. This module imports nothing from
// Node's child-process module, so the rule pack's child-process-chokepoint rule
// does not name it, and each runner owns its own spawn binding.

import { stat } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

type KillSignal = "SIGTERM" | "SIGKILL";

/** The slice of Node's `ChildProcess` a run reads. */
export interface RunningProcess {
  /** Absent when the process could not start. */
  readonly pid?: number | undefined;
  readonly stdout: { on(event: "data", listener: (chunk: Buffer) => void): void };
  readonly stderr: { on(event: "data", listener: (chunk: Buffer) => void): void };
  kill(signal: "SIGTERM" | "SIGKILL"): boolean;
  on(
    event: "error" | "close",
    listener: ((error: Error) => void) | ((code: number | null) => void),
  ): void;
}

/** The options the launcher receives: no shell, piped output, and no stdin. */
export interface ProcessSpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly stdio: readonly ["ignore", "pipe", "pipe"];
  /** POSIX: the process leads a process group of its own. */
  readonly detached: boolean;
}

/** Starts one process. Throws when it cannot start one. */
export type ProcessSpawn = (
  command: string,
  args: readonly string[],
  options: ProcessSpawnOptions,
) => RunningProcess;

/** The platform facts a run reads. */
export interface ProcessHost {
  readonly platform: NodeJS.Platform;
  /** Resolves false for a missing path or a non-file, and never rejects. */
  readonly isFile: (file: string) => Promise<boolean>;
  /** Sends `signal` to the POSIX process group `pid` leads. Throws when it cannot. */
  readonly signalGroup: (pid: number, signal: "SIGTERM" | "SIGKILL") => void;
}

/** What starts a process, and the platform it starts on. */
export interface ProcessLauncher {
  readonly spawn: ProcessSpawn;
  readonly host: ProcessHost;
}

/** One process to run. */
export interface ProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** The complete child environment. */
  readonly env: NodeJS.ProcessEnv;
  /** Milliseconds before a running process gets SIGTERM. */
  readonly timeoutMs: number;
  /** Milliseconds after SIGTERM before a process that is still running gets SIGKILL. */
  readonly killGraceMs: number;
  /** Stops the process and its process tree when the owning operation is cancelled. */
  readonly signal?: AbortSignal | undefined;
}

/** What happened to a run; `error` is set when the process could not start. */
export interface ProcessRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly error?: Error;
}

/** This process's platform, a stat probe, and `process.kill` on the group. */
export const NODE_PROCESS_HOST: ProcessHost = Object.freeze({
  platform: process.platform,
  isFile: (file: string) =>
    stat(file).then(
      (stats) => stats.isFile(),
      () => false,
    ),
  signalGroup: (pid: number, signal: KillSignal) => {
    process.kill(-pid, signal);
  },
});

// A caller reads at most a short note from the output, so a run keeps a
// bounded prefix of each stream rather than everything the process prints.
const OUTPUT_LIMIT = 65_536;

interface CapturedOutput {
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function appendCapped(captured: string, text: string): string {
  return (captured + text).slice(0, OUTPUT_LIMIT);
}

function finishOutput(captured: string, decoder: StringDecoder): string {
  // Keep the bounded prefix during capture, then drop a high surrogate the
  // cap separated from its low surrogate.
  return appendCapped(captured, decoder.end()).replace(/[\uD800-\uDBFF]$/u, "");
}

interface KillTimers {
  readonly cancel: () => void;
  readonly isTerminating: () => boolean;
  readonly terminate: () => void;
}

// SIGTERM at the timeout or cancellation, SIGKILL once the grace runs out,
// and `abandon` one more grace later. The live child keeps the initial timeout
// reachable. After termination starts, the escalation timers stay referenced
// until settlement because the parent and its pipes may close before its
// descendants.
function startKillTimers(
  stop: (signal: KillSignal) => void,
  request: ProcessRequest,
  captured: CapturedOutput,
  abandon: () => void,
): KillTimers {
  let graceTimer: NodeJS.Timeout | undefined;
  let deadlineTimer: NodeJS.Timeout | undefined;
  const timers: { timeout?: NodeJS.Timeout } = {};
  let terminating = false;
  const terminate = (): void => {
    if (terminating) {
      return;
    }

    terminating = true;
    clearTimeout(timers.timeout);
    stop("SIGTERM");
    graceTimer = setTimeout(() => {
      stop("SIGKILL");
      deadlineTimer = setTimeout(abandon, request.killGraceMs);
    }, request.killGraceMs);
  };

  timers.timeout = setTimeout(() => {
    captured.timedOut = true;
    terminate();
  }, request.timeoutMs);
  timers.timeout.unref();
  return {
    cancel: () => {
      clearTimeout(timers.timeout);
      clearTimeout(graceTimer);
      clearTimeout(deadlineTimer);
    },
    isTerminating: () => terminating,
    terminate,
  };
}

function watchProcess(
  child: RunningProcess,
  request: ProcessRequest,
  resolve: (run: ProcessRun) => void,
  stop: (signal: KillSignal) => void,
): void {
  const { signal } = request;
  const captured: CapturedOutput = { stdout: "", stderr: "", timedOut: false };
  const stdoutDecoder = new StringDecoder("utf8");
  const stderrDecoder = new StringDecoder("utf8");
  child.stdout.on("data", (chunk: Buffer) => {
    captured.stdout = appendCapped(captured.stdout, stdoutDecoder.write(chunk));
  });
  child.stderr.on("data", (chunk: Buffer) => {
    captured.stderr = appendCapped(captured.stderr, stderrDecoder.write(chunk));
  });
  // Node emits `close` after `error` for a process that cannot start. A close
  // after termination begins waits for the process-group escalation before it
  // settles.
  let settled = false;
  let closeCode: number | null = null;
  const killTimers = startKillTimers(stop, request, captured, () => {
    settle(closeCode);
  });
  const abort = (): void => {
    killTimers.terminate();
  };

  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted === true) {
    abort();
  }

  function settle(code: number | null, error?: Error): void {
    if (settled) {
      return;
    }

    settled = true;
    captured.stdout = finishOutput(captured.stdout, stdoutDecoder);
    captured.stderr = finishOutput(captured.stderr, stderrDecoder);
    killTimers.cancel();
    signal?.removeEventListener("abort", abort);

    const run = { code, ...captured };
    resolve(error === undefined ? run : { ...run, error });
  }

  // Node also emits `error` for a signal it could not send to a running
  // process. That process is still running, so only a process that never
  // started (no pid) settles here; the kill timers bound a running one.
  child.on("error", (error: Error) => {
    if (child.pid === undefined) {
      settle(null, error);
    }
  });
  child.on("close", (code: number | null) => {
    closeCode = code;
    if (!killTimers.isTerminating()) {
      settle(code);
    }
  });
}

// The value of the variable `name`, read through any spelling of its name.
function variable(env: NodeJS.ProcessEnv, name: string): string | undefined {
  return Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1];
}

function ignoreKillError(): undefined {
  return undefined;
}

// taskkill.exe from the system folder, never from PATH. A launch that fails
// leaves the run to the deadline that settles it anyway.
function killWindowsTree(
  pid: number,
  launcher: ProcessLauncher,
  spawnOptions: ProcessSpawnOptions,
): void {
  const systemRoot = variable(spawnOptions.env, "SYSTEMROOT") ?? String.raw`C:\Windows`;
  const taskkill = path.win32.join(systemRoot, "System32", "taskkill.exe");
  try {
    const killer = launcher.spawn(taskkill, ["/PID", String(pid), "/T", "/F"], spawnOptions);
    killer.on("error", ignoreKillError);
  } catch {
    // The deadline settles the run when the tree outlives a failed taskkill.
  }
}

// Runs in a timer callback, so nothing here may throw.
function stopTree(
  child: RunningProcess,
  signal: KillSignal,
  launcher: ProcessLauncher,
  spawnOptions: ProcessSpawnOptions,
): void {
  const { pid } = child;
  if (pid === undefined || !Number.isSafeInteger(pid) || pid <= 1) {
    child.kill(signal);
    return;
  }

  if (launcher.host.platform === "win32") {
    killWindowsTree(pid, launcher, spawnOptions);
    return;
  }

  try {
    launcher.host.signalGroup(pid, signal);
  } catch {
    // The group is gone or cannot be signalled; the process alone still can.
    child.kill(signal);
  }
}

function notStarted(error: Error): ProcessRun {
  return { code: null, stdout: "", stderr: "", timedOut: false, error };
}

/**
 * Runs one process and resolves after it closes, its timeout escalation
 * completes, or it fails to start; never rejects. The launch is synchronous,
 * so the run watches its process before any event can fire.
 */
export function runProcess(
  launcher: ProcessLauncher,
  request: ProcessRequest,
): Promise<ProcessRun> {
  if (request.signal?.aborted === true) {
    return Promise.resolve(
      notStarted(new Error("Process run aborted", { cause: request.signal.reason })),
    );
  }

  return new Promise((resolve) => {
    // A detached Windows process would open a console window of its own.
    const spawnOptions: ProcessSpawnOptions = {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: launcher.host.platform !== "win32",
    };
    let child: RunningProcess;
    try {
      child = launcher.spawn(request.command, request.args, spawnOptions);
    } catch (error: unknown) {
      // Node's spawn throws only Error instances (an invalid argument or an
      // aborted signal), so the cast holds.
      resolve(notStarted(error as Error));
      return;
    }

    watchProcess(child, request, resolve, (signal) => {
      stopTree(child, signal, launcher, { ...spawnOptions, detached: false });
    });
  });
}

// The absolute directories of PATH, read through any spelling of its name.
function windowsPathDirectories(env: NodeJS.ProcessEnv): string[] {
  return (variable(env, "PATH") ?? "")
    .split(";")
    .map((entry) => (entry.startsWith('"') && entry.endsWith('"') ? entry.slice(1, -1) : entry))
    .filter((entry) => path.win32.isAbsolute(entry));
}

/**
 * D-PL9-18: the first `<command>.exe` or `<command>.cmd` that is a file, in
 * PATH order, looking only in the absolute entries of the PATH in `env`.
 */
export async function findOnWindowsPath(
  command: string,
  env: NodeJS.ProcessEnv,
  host: ProcessHost,
): Promise<string | undefined> {
  for (const directory of windowsPathDirectories(env)) {
    for (const extension of [".exe", ".cmd"]) {
      const candidate = path.win32.join(directory, `${command}${extension}`);
      // eslint-disable-next-line no-await-in-loop -- PATH order decides which file runs
      if (await host.isFile(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
