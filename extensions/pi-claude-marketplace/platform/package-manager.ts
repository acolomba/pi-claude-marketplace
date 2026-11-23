// platform/package-manager.ts
//
// D-PL9-12: runs one package-manager command for a plugin's own package
// install. The launcher, the timeout, the kill grace, the environment, and
// the host (platform, Node binary, file probe, group signal) are parameters.
// The run itself, its capture, its timeout, and the D-PL9-19 process-tree kill
// are the shared launcher's (platform/process-run.ts), so a run never rejects
// for a process failure.
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
// D-21 / D-PL9-11: this module may import node:child_process, for its own
// spawn binding. The rule pack's child-process-chokepoint rule and
// test/architecture/no-shell-out.test.ts name every module that may.
// D-PL9-10: only orchestrators/plugin/package-install.ts may import this
// module (a BLOCK C zone in eslint.config.js).

import { spawn } from "node:child_process";
import path from "node:path";

import { findOnWindowsPath, NODE_PROCESS_HOST, runProcess } from "./process-run.ts";

import type { OutputCapture, ProcessHost, ProcessRun, ProcessSpawn } from "./process-run.ts";

/**
 * The real process launcher: Node's own `spawn`, narrowed to the
 * `ProcessSpawn` contract. The cast narrows `ChildProcess` to the two
 * streams, two events, and `kill` a run uses.
 */
export const NODE_PACKAGE_MANAGER_SPAWN = spawn as ProcessSpawn;

/** One package-manager command to run. */
export interface PackageManagerRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Variables added to the child environment for this run. */
  readonly env?: Readonly<Record<string, string>>;
  /** Stops the package manager and its process tree when the owning operation is cancelled. */
  readonly signal?: AbortSignal;
}

/** What happened to a run; `error` is set when the process could not start. */
export type PackageManagerRun = ProcessRun;

/** Runs one request and resolves with what happened; never rejects. */
export type PackageManagerRunner = (request: PackageManagerRequest) => Promise<PackageManagerRun>;

/** The platform facts a launch reads. */
export interface PackageManagerHost extends ProcessHost {
  /** The Node binary that runs npm-cli.js on Windows. */
  readonly execPath: string;
}

/** The shared process host, plus this process's Node binary. */
export const NODE_PACKAGE_MANAGER_HOST: PackageManagerHost = Object.freeze({
  ...NODE_PROCESS_HOST,
  execPath: process.execPath,
});

export interface PackageManagerRunnerOptions {
  /** The process launcher. `NODE_PACKAGE_MANAGER_SPAWN` in production. */
  readonly spawn: ProcessSpawn;
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
const OUTPUT_CAPTURE: OutputCapture = { limit: 65_536, keep: "head" };

// D-PL9-18: an .exe starts directly; an npm.cmd becomes npm-cli.js.
const WINDOWS_LOOKUP = { extensions: [".exe", ".cmd"] } as const;

function notStarted(error: Error): PackageManagerRun {
  return { code: null, stdout: "", stderr: "", timedOut: false, error };
}

function startProcess(
  options: PackageManagerRunnerOptions,
  request: PackageManagerRequest,
  launch: Launch,
): Promise<PackageManagerRun> {
  if (request.signal?.aborted === true) {
    return Promise.resolve(
      notStarted(new Error("Package manager run aborted", { cause: request.signal.reason })),
    );
  }

  return runProcess(
    { spawn: options.spawn, host: options.host },
    {
      command: launch.command,
      args: launch.args,
      cwd: request.cwd,
      env: { ...options.env, npm_config_update_notifier: "false", ...request.env },
      timeoutMs: options.timeoutMs,
      killGraceMs: options.killGraceMs,
      signal: request.signal,
      stdout: OUTPUT_CAPTURE,
      stderr: OUTPUT_CAPTURE,
      // Node's default, so a package manager starts as it always did.
      windowsHide: false,
    },
  );
}

async function windowsLaunch(
  request: PackageManagerRequest,
  options: PackageManagerRunnerOptions,
): Promise<Launch | Error> {
  const { host } = options;
  const found = await findOnWindowsPath(request.command, options.env, host, WINDOWS_LOOKUP);
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
