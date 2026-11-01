// platform/prompt-shell.ts
//
// D-CF1-02: runs one `!` command from the body of a user-invoked skill or
// command, as Claude Code's dynamic context injection does. The launcher and
// the host are parameters. A run never rejects: a command that cannot start,
// exits, or is stopped resolves with what happened.
//
// D-21 / D-CF1-02: this is one of five modules that may import
// node:child_process. test/architecture/no-shell-out.test.ts holds the
// whitelist, and the rule pack's child-process-chokepoint rule bans the import
// everywhere else. The command runs as an argv with no shell wrapper.

import { spawn } from "node:child_process";
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

/** One command to run. */
export interface PromptShellRequest {
  readonly command: string;
  readonly shell: PromptShell;
  readonly cwd: string;
  /** The child's whole environment. */
  readonly env: NodeJS.ProcessEnv;
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

export interface PromptShellRunnerOptions {
  /** `NODE_PROMPT_SHELL_SPAWN` in production. */
  readonly spawn: PromptShellSpawn;
  readonly host: PromptShellHost;
}

function launchShell(
  options: PromptShellRunnerOptions,
  request: PromptShellRequest,
): Promise<PromptShellResult> {
  return new Promise((resolve) => {
    const child = options.spawn("bash", ["-c", request.command], {
      cwd: request.cwd,
      env: request.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: options.host.platform !== "win32",
    });
    const out = new StringDecoder("utf8");
    const err = new StringDecoder("utf8");
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += out.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += err.write(chunk);
    });
    child.on("close", (code) => {
      resolve({
        kind: "exited",
        code,
        stdout: stdout + out.end(),
        stderr: stderr + err.end(),
        shell: request.shell,
      });
    });
  });
}

/** Binds the launcher and the host; creating the runner starts nothing. */
export function createPromptShellRunner(
  options: PromptShellRunnerOptions,
): (request: PromptShellRequest) => Promise<PromptShellResult> {
  return (request) => launchShell(options, request);
}
