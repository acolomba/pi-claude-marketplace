// platform/process-run.ts
//
// SG-PRC-01, SG-PRC-02: the one process launcher that the package manager and
// the git module share. A run starts one command with an argument array and no
// shell, keeps a bounded part of each output stream, reports each stream it
// cut (WR-04), and stops the whole
// process tree at its timeout or when its signal aborts. Without input, stdin
// is closed from the start; with input, the input goes through a stdin pipe,
// which then ends. A run never rejects
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
// PATH, never in the current directory. In each directory, in PATH order, the
// caller's extensions are tried in the caller's order, and the caller may
// refuse a candidate (D-SG-04 refuses one inside the current directory).
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
  /** The stdin pipe, present when the launch asked for one. */
  readonly stdin?: {
    on(event: "error", listener: (error: Error) => void): void;
    write(text: string): void;
    end(): void;
  } | null;
  readonly stdout: { on(event: "data", listener: (chunk: Buffer) => void): void };
  readonly stderr: { on(event: "data", listener: (chunk: Buffer) => void): void };
  kill(signal: "SIGTERM" | "SIGKILL"): boolean;
  on(
    event: "error" | "close",
    listener: ((error: Error) => void) | ((code: number | null) => void),
  ): void;
}

/**
 * The options the launcher receives: no shell, piped output, and a stdin pipe
 * only for a run with input.
 */
export interface ProcessSpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly stdio: readonly ["ignore" | "pipe", "pipe", "pipe"];
  /** POSIX: the process leads a process group of its own. */
  readonly detached: boolean;
  /** Windows: the process gets no console window of its own. */
  readonly windowsHide: boolean;
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

/**
 * How much of one output stream a run keeps: the first `limit` characters
 * (`head`) or the last (`tail`). Either way a run never keeps half a
 * surrogate pair at the cut.
 */
export interface OutputCapture {
  readonly limit: number;
  readonly keep: "head" | "tail";
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
  /**
   * Written to stdin, which then ends; the empty string still gets a pipe.
   * Without input, stdin is closed from the start.
   */
  readonly input?: string;
  /** What the run keeps of stdout. */
  readonly stdout: OutputCapture;
  /** What the run keeps of stderr. A failure reason is often the last line. */
  readonly stderr: OutputCapture;
  /** Passed to every launch of the run, the taskkill launches included. */
  readonly windowsHide: boolean;
}

/** An output stream of a run. */
type OutputStream = "stdout" | "stderr";

const OUTPUT_STREAMS: readonly OutputStream[] = ["stdout", "stderr"];

/** What happened to a run; `error` is set when the process could not start. */
export interface ProcessRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  /**
   * WR-04: the streams that wrote more than their capture keeps, in the order
   * stdout, stderr. Absent when the run kept every character.
   */
  readonly truncated?: readonly ("stdout" | "stderr")[];
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

interface CapturedOutput {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  readonly truncated: Set<OutputStream>;
}

function appendCapped(captured: string, text: string, capture: OutputCapture): string {
  const joined = captured + text;
  return capture.keep === "head"
    ? joined.slice(0, capture.limit)
    : joined.slice(Math.max(0, joined.length - capture.limit));
}

// Keeps the bounded part of `stream` with `text` added, and records a cut.
function append(
  captured: CapturedOutput,
  stream: OutputStream,
  text: string,
  capture: OutputCapture,
): void {
  if (captured[stream].length + text.length > capture.limit) {
    captured.truncated.add(stream);
  }

  captured[stream] = appendCapped(captured[stream], text, capture);
}

// Drops the half of a surrogate pair that the cut separated from its other
// half: a high surrogate at the end of a head, a low surrogate at the start of
// a tail.
function finishOutput(captured: string, capture: OutputCapture): string {
  return capture.keep === "head"
    ? captured.replace(/[\uD800-\uDBFF]$/u, "")
    : captured.replace(/^[\uDC00-\uDFFF]/u, "");
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
  const captured: CapturedOutput = {
    stdout: "",
    stderr: "",
    timedOut: false,
    truncated: new Set(),
  };
  const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
  for (const stream of OUTPUT_STREAMS) {
    child[stream].on("data", (chunk: Buffer) => {
      append(captured, stream, decoders[stream].write(chunk), request[stream]);
    });
  }

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
    for (const stream of OUTPUT_STREAMS) {
      append(captured, stream, decoders[stream].end(), request[stream]);
    }

    killTimers.cancel();
    signal?.removeEventListener("abort", abort);

    const truncated = OUTPUT_STREAMS.filter((stream) => captured.truncated.has(stream));
    const run: ProcessRun = {
      code,
      stdout: finishOutput(captured.stdout, request.stdout),
      stderr: finishOutput(captured.stderr, request.stderr),
      timedOut: captured.timedOut,
      ...(truncated.length > 0 && { truncated }),
    };
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

function ignoreError(): undefined {
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
    killer.on("error", ignoreError);
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

// A process that exits before it reads its input closes the pipe, so the write
// fails with EPIPE. The listener keeps that error from crashing Pi; the run
// still settles on the process's own `close`. Node gives a launch with a stdin
// pipe a stdin stream, so a missing one only means there is nowhere to write.
function writeInput(child: RunningProcess, input: string | undefined): void {
  const { stdin } = child;
  if (input === undefined || !stdin) {
    return;
  }

  stdin.on("error", ignoreError);
  stdin.write(input);
  stdin.end();
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
      stdio: [request.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      detached: launcher.host.platform !== "win32",
      windowsHide: request.windowsHide,
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

    // taskkill reads no input, so its launch closes stdin.
    watchProcess(child, request, resolve, (signal) => {
      stopTree(child, signal, launcher, {
        ...spawnOptions,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });
    });
    writeInput(child, request.input);
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
 * D-PL9-18, D-SG-04: the first `<command><extension>` that is a file and that
 * `lookup.accept` does not refuse, looking only in the absolute entries of the
 * PATH in `env`: directories in PATH order, and in each directory the
 * extensions in `lookup.extensions` order. A refused candidate is skipped and
 * the search goes on. Without `accept`, every file is accepted.
 */
export async function findOnWindowsPath(
  command: string,
  env: NodeJS.ProcessEnv,
  host: ProcessHost,
  lookup: {
    readonly extensions: readonly string[];
    readonly accept?: (candidate: string) => Promise<boolean>;
  },
): Promise<string | undefined> {
  for (const directory of windowsPathDirectories(env)) {
    for (const extension of lookup.extensions) {
      const candidate = path.win32.join(directory, `${command}${extension}`);
      // eslint-disable-next-line no-await-in-loop -- PATH order decides which file runs
      if ((await host.isFile(candidate)) && (await (lookup.accept?.(candidate) ?? true))) {
        return candidate;
      }
    }
  }

  return undefined;
}
