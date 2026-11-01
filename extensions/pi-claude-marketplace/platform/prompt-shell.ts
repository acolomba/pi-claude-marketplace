// platform/prompt-shell.ts
//
// D-CF1-02: runs one `!` command from the body of a user-invoked skill or
// command, as Claude Code's dynamic context injection does. The launcher, the
// host, the timeout, and the kill grace are parameters. A run never rejects:
// a command that exits, cannot start, or is stopped resolves with what
// happened, in the shape of the domain's `ShellRunResult`.
//
// Shell selection follows Claude Code 2.1.316: `shell: powershell` runs
// PowerShell only when its PowerShell tool is on, and otherwise Bash runs
// whenever it is available. Off Windows, Bash is always available and the
// tool is on only when CLAUDE_CODE_USE_POWERSHELL_TOOL is true, so
// `shell: powershell` runs Bash unless that variable is set. On Windows, Bash
// is Git Bash, found as Claude Code finds it.
//
// The command runs as an argv with no shell wrapper: `bash -c <command>`, or
// PowerShell with `-NoProfile -Command <command>`. On POSIX the shell leads
// its own process group, so a timeout or a cancelled operation stops every
// process the command started: SIGTERM to the group, then SIGKILL one grace
// later, after which the run resolves as interrupted. A group signal that
// fails, a pid below 2 (whose group would be Pi's own or every process), and
// Windows signal the shell process alone.
//
// D-21 / D-CF1-02: this is one of five modules that may import
// node:child_process. test/architecture/no-shell-out.test.ts holds the
// whitelist, and the rule pack's child-process-chokepoint rule bans the import
// everywhere else.

import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

/** The shell that runs a command. */
export type PromptShell = "bash" | "powershell";

/** The output stream of a started process. */
export interface PromptShellStream {
  on(event: "data", listener: (chunk: Buffer) => void): unknown;
}

/** The part of Node's `ChildProcess` a prompt shell run uses. */
export interface PromptShellProcess {
  /** Undefined when the process did not start. */
  readonly pid?: number | undefined;
  readonly stdout: PromptShellStream;
  readonly stderr: PromptShellStream;
  on(event: "close", listener: (code: number | null) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  kill(signal: NodeJS.Signals): boolean;
}

/** The launch options: no shell wrapper, no stdin, and piped output. */
export interface PromptShellSpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly shell: false;
  readonly stdio: readonly ["ignore", "pipe", "pipe"];
  /** POSIX: the shell leads a process group of its own. */
  readonly detached: boolean;
}

/** Starts one process, or throws when it cannot. */
export type PromptShellSpawn = (
  file: string,
  args: readonly string[],
  options: PromptShellSpawnOptions,
) => PromptShellProcess;

/**
 * Node's own `spawn`, narrowed to the `PromptShellSpawn` contract: the cast
 * keeps the two streams, two events, and `kill` that a run reads.
 */
export const NODE_PROMPT_SHELL_SPAWN = spawn as PromptShellSpawn;

/** The facts about the machine that choose and stop a shell. */
export interface PromptShellHost {
  readonly platform: NodeJS.Platform;
  /** The environment that shell selection reads. */
  readonly env: NodeJS.ProcessEnv;
  /** True for an existing file. Never throws. */
  readonly isFile: (file: string) => boolean;
  /** Signals the POSIX process group that `pid` leads; throws when it cannot. */
  readonly signalGroup: (pid: number, signal: NodeJS.Signals) => void;
}

/** This process's platform and live environment, a stat probe, and `process.kill`. */
export const NODE_PROMPT_SHELL_HOST: PromptShellHost = Object.freeze({
  platform: process.platform,
  env: process.env,
  isFile: (file: string) => statSync(file, { throwIfNoEntry: false })?.isFile() === true,
  signalGroup: (pid: number, signal: NodeJS.Signals) => {
    process.kill(-pid, signal);
  },
});

/** One command to run. */
export interface PromptShellRequest {
  readonly command: string;
  /** The shell `selectPromptShell` chose. */
  readonly shell: PromptShell;
  readonly cwd: string;
  /** The child's whole environment. */
  readonly env: NodeJS.ProcessEnv;
  /** Stops the run when the owning operation is cancelled. */
  readonly signal?: AbortSignal;
}

/** What happened to a run. The domain's `ShellRunResult` has the same shape. */
export type PromptShellResult =
  | {
      readonly kind: "exited";
      readonly code: number | null;
      readonly stdout: string;
      readonly stderr: string;
      readonly shell: PromptShell;
    }
  | { readonly kind: "interrupted" }
  | { readonly kind: "not-started"; readonly message: string };

/** Runs one request and resolves with what happened; never rejects. */
export type PromptShellRunner = (request: PromptShellRequest) => Promise<PromptShellResult>;

export interface PromptShellRunnerOptions {
  /** `NODE_PROMPT_SHELL_SPAWN` in production. */
  readonly spawn: PromptShellSpawn;
  /** `NODE_PROMPT_SHELL_HOST` in production. */
  readonly host: PromptShellHost;
  /** Milliseconds before a running command is stopped; 120,000 by default. */
  readonly timeoutMs?: number;
  /** Milliseconds between SIGTERM and SIGKILL; 2,000 by default. */
  readonly killGraceMs?: number;
}

// Claude Code's Bash tool stops a command after two minutes by default.
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_KILL_GRACE_MS = 2_000;

const INTERRUPTED: PromptShellResult = Object.freeze({ kind: "interrupted" });

const TRUE_FLAGS: ReadonlySet<string> = new Set(["1", "true"]);

// The names CLAUDE_CODE_GIT_BASH_PATH may end in.
const GIT_BASH_NAMES: ReadonlySet<string> = new Set(["bash.exe", "sh.exe", "bash", "sh"]);

// Where Git for Windows installs Bash, in the order Claude Code checks.
const STANDARD_GIT_BASH = [
  String.raw`C:\Program Files\Git\bin\bash.exe`,
  String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
] as const;

function configuredGitBash(host: PromptShellHost): string | undefined {
  const configured = host.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (configured === undefined) {
    return undefined;
  }

  const named = GIT_BASH_NAMES.has(path.win32.basename(configured).toLowerCase());
  return named && host.isFile(configured) ? configured : undefined;
}

// Git for Windows keeps git.exe in <root>\cmd and Bash in <root>\bin. Only
// absolute PATH entries count, so the current directory is never searched.
function gitBashBesideGit(host: PromptShellHost): string | undefined {
  // PATH under any spelling of its name; join() writes an unset value as "".
  const searchPath = Object.entries(host.env)
    .filter(([key]) => key.toUpperCase() === "PATH")
    .map(([, value]) => value)
    .join(";");
  const git = searchPath
    .split(";")
    .map((entry) => entry.replaceAll('"', ""))
    .filter((entry) => path.win32.isAbsolute(entry))
    .map((entry) => path.win32.join(entry, "git.exe"))
    .find((candidate) => host.isFile(candidate));
  if (git === undefined) {
    return undefined;
  }

  const bash = path.win32.join(git, "..", "..", "bin", "bash.exe");
  return host.isFile(bash) ? bash : undefined;
}

// Claude Code's Git Bash lookup: CLAUDE_CODE_GIT_BASH_PATH, the standard
// install folders, then the bash beside the git on PATH.
function windowsGitBash(host: PromptShellHost): string | undefined {
  return (
    configuredGitBash(host) ??
    STANDARD_GIT_BASH.find((candidate) => host.isFile(candidate)) ??
    gitBashBesideGit(host)
  );
}

function powerShellToolEnabled(host: PromptShellHost): boolean {
  const flag = host.env.CLAUDE_CODE_USE_POWERSHELL_TOOL;
  if (flag !== undefined) {
    return TRUE_FLAGS.has(flag.toLowerCase());
  }

  // Unset on Windows: on only when there is no Git Bash.
  return host.platform === "win32" && windowsGitBash(host) === undefined;
}

function bashAvailable(host: PromptShellHost): boolean {
  return host.platform !== "win32" || windowsGitBash(host) !== undefined;
}

/**
 * D-CF1-02: the shell that runs a skill's or command's `!` commands, given its
 * frontmatter `shell` value, as Claude Code 2.1.316 chooses it.
 */
export function selectPromptShell(
  requested: string | undefined,
  host: PromptShellHost,
): PromptShell {
  if (requested === "powershell" && powerShellToolEnabled(host)) {
    return "powershell";
  }

  return bashAvailable(host) ? "bash" : "powershell";
}

function launchArgv(request: PromptShellRequest, host: PromptShellHost): readonly string[] {
  const windows = host.platform === "win32";
  if (request.shell === "powershell") {
    return [windows ? "powershell.exe" : "pwsh", "-NoProfile", "-Command", request.command];
  }

  const bash = windows ? (windowsGitBash(host) ?? "bash") : "bash";
  return [bash, "-c", request.command];
}

// Runs in a timer or abort callback, so nothing here may throw.
function signalShell(
  child: PromptShellProcess,
  signal: NodeJS.Signals,
  host: PromptShellHost,
): void {
  const { pid } = child;
  if (host.platform === "win32" || pid === undefined || pid < 2) {
    child.kill(signal);
    return;
  }

  try {
    host.signalGroup(pid, signal);
  } catch {
    // The group is gone or cannot be signalled; the shell alone still can.
    child.kill(signal);
  }
}

interface Stopper {
  readonly stop: () => void;
  readonly stopping: () => boolean;
  readonly cancel: () => void;
}

// Stops the shell at the timeout or on `stop()`: SIGTERM, then SIGKILL one
// grace later, then `onStopped`.
function createStopper(
  child: PromptShellProcess,
  options: PromptShellRunnerOptions,
  onStopped: () => void,
): Stopper {
  let stopping = false;
  let timer = setTimeout(stop, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  function stop(): void {
    if (stopping) {
      return;
    }

    stopping = true;
    clearTimeout(timer);
    signalShell(child, "SIGTERM", options.host);
    timer = setTimeout(() => {
      signalShell(child, "SIGKILL", options.host);
      onStopped();
    }, options.killGraceMs ?? DEFAULT_KILL_GRACE_MS);
  }

  return {
    stop,
    stopping: () => stopping,
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

// Decodes a stream as UTF-8, keeping a character split across chunks whole.
function collectText(stream: PromptShellStream): () => string {
  const decoder = new StringDecoder("utf8");
  let text = "";
  stream.on("data", (chunk) => {
    text += decoder.write(chunk);
  });
  return () => text + decoder.end();
}

function superviseShell(
  child: PromptShellProcess,
  options: PromptShellRunnerOptions,
  request: PromptShellRequest,
  resolve: (result: PromptShellResult) => void,
): void {
  const stdout = collectText(child.stdout);
  const stderr = collectText(child.stderr);
  let settled = false;
  const stopper = createStopper(child, options, () => {
    settle(INTERRUPTED);
  });
  function settle(result: PromptShellResult): void {
    if (settled) {
      return;
    }

    settled = true;
    stopper.cancel();
    request.signal?.removeEventListener("abort", stopper.stop);
    resolve(result);
  }

  request.signal?.addEventListener("abort", stopper.stop, { once: true });
  // Node also reports a signal it could not send to a running shell as an
  // error; only a shell that never started (no pid) ends the run here.
  child.on("error", (error) => {
    if (child.pid === undefined) {
      settle({ kind: "not-started", message: error.message });
    }
  });
  // A stopped shell resolves as interrupted once its group has had SIGKILL.
  child.on("close", (code) => {
    if (!stopper.stopping()) {
      settle({ kind: "exited", code, stdout: stdout(), stderr: stderr(), shell: request.shell });
    }
  });
}

function runPromptShell(
  options: PromptShellRunnerOptions,
  request: PromptShellRequest,
): Promise<PromptShellResult> {
  if (request.signal?.aborted === true) {
    return Promise.resolve(INTERRUPTED);
  }

  const [file = "", ...args] = launchArgv(request, options.host);
  return new Promise((resolve) => {
    let child: PromptShellProcess;
    try {
      // A detached Windows process would open a console window of its own.
      child = options.spawn(file, args, {
        cwd: request.cwd,
        env: request.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        detached: options.host.platform !== "win32",
      });
    } catch (error: unknown) {
      // Node's spawn throws only Error instances, so the cast holds.
      resolve({ kind: "not-started", message: (error as Error).message });
      return;
    }

    superviseShell(child, options, request, resolve);
  });
}

/**
 * D-CF1-02: binds the launcher, the host, the timeout, and the kill grace.
 * Creating the runner starts nothing; each call resolves once the command
 * exits, fails to start, or has been stopped.
 */
export function createPromptShellRunner(options: PromptShellRunnerOptions): PromptShellRunner {
  return (request) => runPromptShell(options, request);
}
