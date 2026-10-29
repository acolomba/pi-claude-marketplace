// platform/package-manager.ts
//
// D-PL9-12: runs one package-manager command for a plugin's own package
// install. The launcher, the timeout, the kill grace, the environment, and
// the host (platform, Node binary, file probe, group signal) are parameters.
// A run never rejects for a process failure: a process that cannot start,
// exits non-zero, or outlives the timeout resolves with what happened.
// A run that outlives the timeout settles one kill grace after its SIGKILL
// even when the process never closes, because a child it started may hold the
// output pipes open, or the kill may fail. The process may then still be
// running, so its work dir may be busy when the caller removes it.
//
// D-PL9-19: the timeout stops the package manager's whole process tree, so a
// child it started cannot keep running and hold the output pipes. On POSIX
// the package manager leads its own process group, which gets SIGTERM and
// then SIGKILL; a group signal that fails falls back to the process alone.
// On Windows both steps run taskkill /T /F from the system folder. A pid
// below 2 signals the process alone, because a group signal to it would reach
// Pi's own group or every process.
//
// D-PL9-15: the argv passes through verbatim, with no shell. The child
// environment adds `npm_config_update_notifier=false`, so npm neither asks the
// registry for its own version nor prints a banner that would become the
// failure note. The spawn is always asynchronous, because the state lock's
// refresh timer needs the event loop while the package manager runs.
//
// D-PL9-18: on Windows a command is looked up only in the absolute entries of
// PATH, never in the current directory, and every launch still has no shell.
// In each directory, in PATH order, <command>.exe comes before <command>.cmd.
// An .exe starts directly. Node cannot start a .cmd without a shell, so
// npm.cmd becomes this Node binary running the npm-cli.js beside it. Any other
// .cmd, and a command that is not found, resolves the run with an error.
// Other platforms start the bare command.
//
// D-21 / D-PL9-11: this is one of four modules that may import
// node:child_process. test/architecture/no-shell-out.test.ts holds the
// whitelist, and the rule pack's child-process-chokepoint rule bans the import
// everywhere else. D-PL9-10: only orchestrators/plugin/package-install.ts may
// import this module (a BLOCK C zone in eslint.config.js).

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

/** The slice of Node's `ChildProcess` a run reads. */
export interface PackageManagerProcess {
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

export interface PackageManagerSpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly stdio: readonly ["ignore", "pipe", "pipe"];
  /** POSIX: the package manager leads a process group of its own. */
  readonly detached: boolean;
}

export type PackageManagerSpawn = (
  command: string,
  args: readonly string[],
  options: PackageManagerSpawnOptions,
) => PackageManagerProcess;

/**
 * The real process launcher: Node's own `spawn`, narrowed to the
 * `PackageManagerSpawn` contract. The cast narrows `ChildProcess` to the two
 * streams, two events, and `kill` a run uses.
 */
export const NODE_PACKAGE_MANAGER_SPAWN = spawn as PackageManagerSpawn;

export interface PackageManagerRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Variables added to the child environment for this run. */
  readonly env?: Readonly<Record<string, string>>;
  /** Stops the package manager and its process tree when the owning operation is cancelled. */
  readonly signal?: AbortSignal;
}

export interface PackageManagerRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly error?: Error;
}

export type PackageManagerRunner = (request: PackageManagerRequest) => Promise<PackageManagerRun>;

/** The platform facts a launch reads. */
export interface PackageManagerHost {
  readonly platform: NodeJS.Platform;
  /** The Node binary that runs npm-cli.js on Windows. */
  readonly execPath: string;
  /** Resolves false for a missing path or a non-file, and never rejects. */
  readonly isFile: (file: string) => Promise<boolean>;
  /** Sends `signal` to the POSIX process group `pid` leads. Throws when it cannot. */
  readonly signalGroup: (pid: number, signal: "SIGTERM" | "SIGKILL") => void;
}

type KillSignal = "SIGTERM" | "SIGKILL";

/** This process's platform and Node binary, a stat probe, and `process.kill`. */
export const NODE_PACKAGE_MANAGER_HOST: PackageManagerHost = Object.freeze({
  platform: process.platform,
  execPath: process.execPath,
  isFile: (file: string) =>
    stat(file).then(
      (stats) => stats.isFile(),
      () => false,
    ),
  signalGroup: (pid: number, signal: KillSignal) => {
    process.kill(-pid, signal);
  },
});

export interface PackageManagerRunnerOptions {
  /** The process launcher. `NODE_PACKAGE_MANAGER_SPAWN` in production. */
  readonly spawn: PackageManagerSpawn;
  /** Milliseconds before a running package manager gets SIGTERM. */
  readonly timeoutMs: number;
  /** Milliseconds after SIGTERM before a package manager that is still running gets SIGKILL. */
  readonly killGraceMs: number;
  /** The environment the child starts from. */
  readonly env: NodeJS.ProcessEnv;
  /** The platform facts. `NODE_PACKAGE_MANAGER_HOST` in production. */
  readonly host: PackageManagerHost;
}

interface Launch {
  readonly command: string;
  readonly args: readonly string[];
}

// A note uses at most 500 characters of the output, so a run keeps a bounded
// prefix of each stream rather than everything npm prints.
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
  options: PackageManagerRunnerOptions,
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
      deadlineTimer = setTimeout(abandon, options.killGraceMs);
    }, options.killGraceMs);
  };

  timers.timeout = setTimeout(() => {
    captured.timedOut = true;
    terminate();
  }, options.timeoutMs);
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
  child: PackageManagerProcess,
  options: PackageManagerRunnerOptions,
  resolve: (run: PackageManagerRun) => void,
  stop: (signal: KillSignal) => void,
  signal?: AbortSignal,
): void {
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
  const killTimers = startKillTimers(stop, options, captured, () => {
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
  options: PackageManagerRunnerOptions,
  spawnOptions: PackageManagerSpawnOptions,
): void {
  const systemRoot = variable(options.env, "SYSTEMROOT") ?? String.raw`C:\Windows`;
  const taskkill = path.win32.join(systemRoot, "System32", "taskkill.exe");
  try {
    const killer = options.spawn(taskkill, ["/PID", String(pid), "/T", "/F"], spawnOptions);
    killer.on("error", ignoreKillError);
  } catch {
    // The deadline settles the run when the tree outlives a failed taskkill.
  }
}

// Runs in a timer callback, so nothing here may throw.
function stopTree(
  child: PackageManagerProcess,
  signal: KillSignal,
  options: PackageManagerRunnerOptions,
  spawnOptions: PackageManagerSpawnOptions,
): void {
  const { pid } = child;
  if (pid === undefined || !Number.isSafeInteger(pid) || pid <= 1) {
    child.kill(signal);
    return;
  }

  if (options.host.platform === "win32") {
    killWindowsTree(pid, options, spawnOptions);
    return;
  }

  try {
    options.host.signalGroup(pid, signal);
  } catch {
    // The group is gone or cannot be signalled; the process alone still can.
    child.kill(signal);
  }
}

function startProcess(
  options: PackageManagerRunnerOptions,
  request: PackageManagerRequest,
  launch: Launch,
): Promise<PackageManagerRun> {
  if (request.signal?.aborted === true) {
    return Promise.resolve(aborted(request.signal));
  }

  return new Promise((resolve) => {
    // A detached Windows process would open a console window of its own.
    const spawnOptions: PackageManagerSpawnOptions = {
      cwd: request.cwd,
      env: { ...options.env, npm_config_update_notifier: "false", ...request.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: options.host.platform !== "win32",
    };
    let child: PackageManagerProcess;
    try {
      child = options.spawn(launch.command, launch.args, spawnOptions);
    } catch (error: unknown) {
      // Node's spawn throws only Error instances (an invalid argument or an
      // aborted signal), so the cast holds.
      resolve(notStarted(error as Error));
      return;
    }

    watchProcess(
      child,
      options,
      resolve,
      (signal) => {
        stopTree(child, signal, options, { ...spawnOptions, detached: false });
      },
      request.signal,
    );
  });
}

function notStarted(error: Error): PackageManagerRun {
  return { code: null, stdout: "", stderr: "", timedOut: false, error };
}

function aborted(signal: AbortSignal): PackageManagerRun {
  return notStarted(new Error("Package manager run aborted", { cause: signal.reason }));
}

// The absolute directories of PATH, read through any spelling of its name.
function windowsPathDirectories(env: NodeJS.ProcessEnv): string[] {
  return (variable(env, "PATH") ?? "")
    .split(";")
    .map((entry) => (entry.startsWith('"') && entry.endsWith('"') ? entry.slice(1, -1) : entry))
    .filter((entry) => path.win32.isAbsolute(entry));
}

async function findOnWindowsPath(
  command: string,
  env: NodeJS.ProcessEnv,
  host: PackageManagerHost,
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

async function windowsLaunch(
  request: PackageManagerRequest,
  options: PackageManagerRunnerOptions,
): Promise<Launch | Error> {
  const { host } = options;
  const found = await findOnWindowsPath(request.command, options.env, host);
  if (found === undefined) {
    return new Error(`${request.command} was not found on PATH`);
  }

  if (found.endsWith(".exe")) {
    return { command: found, args: request.args };
  }

  if (request.command !== "npm") {
    return new Error(
      `${request.command} on PATH is a batch file (${found}), which this install does not run without a shell`,
    );
  }

  const cli = path.win32.join(
    path.win32.dirname(found),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (!(await host.isFile(cli))) {
    return new Error(`npm-cli.js was not found beside ${found}`);
  }

  return { command: host.execPath, args: [cli, ...request.args] };
}

// Other platforms start synchronously, so a run watches its process before
// any event can fire.
function runPackageManager(
  options: PackageManagerRunnerOptions,
  request: PackageManagerRequest,
): Promise<PackageManagerRun> {
  if (options.host.platform !== "win32") {
    return startProcess(options, request, request);
  }

  return windowsLaunch(request, options).then((launch) =>
    launch instanceof Error ? notStarted(launch) : startProcess(options, request, launch),
  );
}

/**
 * Binds the launcher, timeout, kill grace, environment, and host. Creating the
 * runner starts nothing; each call resolves after the process closes, its
 * timeout escalation completes, or it fails to start.
 */
export function createPackageManagerRunner(
  options: PackageManagerRunnerOptions,
): PackageManagerRunner {
  return (request) => runPackageManager(options, request);
}
