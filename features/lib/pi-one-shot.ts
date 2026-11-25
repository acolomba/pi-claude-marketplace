/**
 * @fileoverview Runs one command in a one-shot Pi, in json mode or in print
 * mode, and returns its exit code and output (D-BG-09).
 *
 * Both modes exit with no model before they run the command, so the one-shot
 * Pi loads and selects the scripted model; the command never calls it. Pi runs
 * in a process group of its own, which the runner kills once Pi exits or its
 * deadline passes, so nothing Pi started outlives the command. The json driver
 * and the print-mode steps share this one runner, so a print driver never
 * duplicates the json one (D-BG-601).
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { killProcessGroup, piArguments, resolveRpcSandbox, rpcChildEnvironment } from "./pi-rpc.ts";

import type { RpcGitEnvironment, RpcProfileEnvironment, RpcSandbox } from "./pi-rpc.ts";

/**
 * What a one-shot Pi starts with: the run's sandbox, the git environment and
 * the extensions of the scenario's Pi, and `TMPDIR`. A scenario whose Pi runs
 * without the GitHub base override passes the GitHub redirect here, so the
 * one-shot Pi keeps its requests on this machine too (D-BG-01).
 */
export interface OneShotLaunch {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly environment: RpcProfileEnvironment;
  readonly extensions: readonly string[];
}

/** The exit code of a one-shot Pi and the two streams it wrote, whole. */
export interface OneShotOutput {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("./scripted-model/extension.ts", import.meta.url),
);
const SCRIPTED_MODEL_ARGUMENTS = ["--provider", "faux", "--model", "faux-1"];

// Pi's arguments for `mode`: json mode takes `--mode json` and the command as
// its message; print mode takes the terminal form, with no `--mode`, and `-p`
// takes the command as the prompt.
function oneShotArguments(
  mode: "json" | "print",
  extensions: readonly string[],
  command: string,
): string[] {
  const loaded = [SCRIPTED_MODEL_EXTENSION, ...extensions];
  return mode === "json"
    ? [...piArguments("json", loaded), ...SCRIPTED_MODEL_ARGUMENTS, command]
    : [...piArguments("tui", loaded), ...SCRIPTED_MODEL_ARGUMENTS, "-p", command];
}

/**
 * Runs `command` in a one-shot Pi in `mode`, with stdin closed, because both
 * modes read piped stdin to its end before they run the command. Fails, with
 * Pi's stderr, once `timeoutMs` has passed. It hands the group kill to
 * `onRelease` before it waits, so the scenario's release frees the group when
 * the wait is abandoned.
 */
export async function runOneShotPi(
  launch: OneShotLaunch,
  mode: "json" | "print",
  command: string,
  onRelease: (release: () => void) => void,
  timeoutMs: number,
): Promise<OneShotOutput> {
  const sandbox = await resolveRpcSandbox(launch.sandbox);
  const child = spawn(process.execPath, oneShotArguments(mode, launch.extensions, command), {
    cwd: sandbox.cwd,
    detached: true,
    env: rpcChildEnvironment(sandbox, launch.git, launch.environment),
    stdio: ["ignore", "pipe", "pipe"],
  });
  // A second kill could reach an unrelated group that took the id.
  let groupKilled = false;
  const killGroup = (): void => {
    if (!groupKilled) {
      groupKilled = true;
      killProcessGroup(child);
    }
  };

  onRelease(killGroup);
  const output = { stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => (output.stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (output.stderr += chunk));
  let closed: unknown[];
  try {
    closed = await once(child, "close", { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(
      `${command} in ${mode} mode failed or did not exit within ${timeoutMs} ms:\n${output.stderr}`,
      { cause: error },
    );
  } finally {
    killGroup();
  }

  const [exitCode] = closed;
  return { exitCode: typeof exitCode === "number" ? exitCode : null, ...output };
}
