// platform/package-manager.ts
//
// D-PL9-12: runs one package-manager command for a plugin's own package
// install. The launcher, the timeout, the kill grace, the environment, and
// the host (platform, Node binary, file probe) are parameters. A run never rejects for a process failure: a process that cannot
// start, exits non-zero, or outlives the timeout resolves with what happened.
// A run that outlives the timeout settles one kill grace after its SIGKILL
// even when the process never closes, because a child it started may hold the
// output pipes open, or the kill may fail. The process may then still be
// running, so its work dir may be busy when the caller removes it.
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
}

/** This process's platform and Node binary, and a stat probe. */
export const NODE_PACKAGE_MANAGER_HOST: PackageManagerHost = Object.freeze({
  platform: process.platform,
  execPath: process.execPath,
  isFile: (file: string) =>
    stat(file).then(
      (stats) => stats.isFile(),
      () => false,
    ),
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

function appendCapped(captured: string, chunk: Buffer): string {
  return (captured + chunk.toString("utf8")).slice(0, OUTPUT_LIMIT);
}

// SIGTERM at the timeout, SIGKILL once the grace runs out, and `abandon` one
// more grace later. Every timer is unref'd so a pending one never keeps the Pi
// process alive. Returns the function that cancels them all.
function startKillTimers(
  child: PackageManagerProcess,
  options: PackageManagerRunnerOptions,
  captured: CapturedOutput,
  abandon: () => void,
): () => void {
  let graceTimer: NodeJS.Timeout | undefined;
  let deadlineTimer: NodeJS.Timeout | undefined;
  const timeoutTimer = setTimeout(() => {
    captured.timedOut = true;
    child.kill("SIGTERM");
    graceTimer = setTimeout(() => {
      child.kill("SIGKILL");
      deadlineTimer = setTimeout(abandon, options.killGraceMs);
      deadlineTimer.unref();
    }, options.killGraceMs);
    graceTimer.unref();
  }, options.timeoutMs);
  timeoutTimer.unref();
  return () => {
    clearTimeout(timeoutTimer);
    clearTimeout(graceTimer);
    clearTimeout(deadlineTimer);
  };
}

function watchProcess(
  child: PackageManagerProcess,
  options: PackageManagerRunnerOptions,
  resolve: (run: PackageManagerRun) => void,
): void {
  const captured: CapturedOutput = { stdout: "", stderr: "", timedOut: false };
  child.stdout.on("data", (chunk: Buffer) => {
    captured.stdout = appendCapped(captured.stdout, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    captured.stderr = appendCapped(captured.stderr, chunk);
  });
  // Node emits `close` after `error` for a process that cannot start; the
  // first event settles the run and the rest are ignored.
  let settled = false;
  const stopTimers = startKillTimers(child, options, captured, () => {
    settle(null);
  });
  function settle(code: number | null, error?: Error): void {
    if (settled) {
      return;
    }

    settled = true;
    stopTimers();
    resolve({ code, ...captured, ...(error !== undefined && { error }) });
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
    settle(code);
  });
}

function startProcess(
  options: PackageManagerRunnerOptions,
  request: PackageManagerRequest,
  launch: Launch,
): Promise<PackageManagerRun> {
  return new Promise((resolve) => {
    let child: PackageManagerProcess;
    try {
      child = options.spawn(launch.command, launch.args, {
        cwd: request.cwd,
        env: { ...options.env, npm_config_update_notifier: "false", ...(request.env ?? {}) },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error: unknown) {
      // Node's spawn throws only Error instances (an invalid argument or an
      // aborted signal), so the cast holds.
      resolve(notStarted(error as Error));
      return;
    }

    watchProcess(child, options, resolve);
  });
}

function notStarted(error: Error): PackageManagerRun {
  return { code: null, stdout: "", stderr: "", timedOut: false, error };
}

// The absolute directories of PATH, read through any spelling of its name.
function windowsPathDirectories(env: NodeJS.ProcessEnv): string[] {
  const value = Object.entries(env).find(([name]) => name.toUpperCase() === "PATH")?.[1] ?? "";
  return value
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
 * runner starts nothing; each call starts one process and resolves once it
 * has closed or failed to start.
 */
export function createPackageManagerRunner(
  options: PackageManagerRunnerOptions,
): PackageManagerRunner {
  return (request) => runPackageManager(options, request);
}
