/**
 * @fileoverview Runs one `/claude:plugin` command in a one-shot Pi in json mode (D-BG-09).
 *
 * In json mode Pi prints one JSON record per session event on stdout, and the
 * extension appends each result as a `claude-plugin` custom entry, which Pi
 * prints as an `entry_appended` record. The driver keeps those entries and
 * returns their payloads, each validated as an RPC command's are (DRV-01), so
 * a scenario compares a json result with an rpc result through the same steps.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import {
  killProcessGroup,
  piArguments,
  resolveRpcSandbox,
  rpcChildEnvironment,
} from "../../test/e2e/_rpc.ts";

import { claudePluginPayloads } from "./pi-commands.ts";

import type { NotificationPayload } from "./pi-commands.ts";
import type { RpcGitEnvironment, RpcProfileEnvironment, RpcSandbox } from "../../test/e2e/_rpc.ts";

/** What the one-shot Pi starts with: the run's sandbox, git environment, and `TMPDIR`. */
export interface JsonModeLaunch {
  readonly sandbox: RpcSandbox;
  readonly git: RpcGitEnvironment;
  readonly environment: RpcProfileEnvironment;
}

// Json mode exits with no model before it runs the command, so the one-shot
// Pi loads and selects the scripted model. The command never calls it.
const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("./scripted-model/extension.ts", import.meta.url),
);
const SCRIPTED_MODEL_ARGUMENTS = ["--provider", "faux", "--model", "faux-1"];

// Starting Pi takes a few seconds and a command a fraction of that; the
// deadline stays below the 30-second step timeout, so a hung Pi fails here,
// with its stderr, and not as a bare step timeout.
const DEFAULT_JSON_MODE_MS = 25_000;

// The record Pi prints when the session appends a custom entry.
const CUSTOM_ENTRY_RECORD = Type.Object({
  type: Type.Literal("entry_appended"),
  entry: Type.Object({
    type: Type.Literal("custom"),
    customType: Type.Optional(Type.String()),
    data: Type.Optional(Type.Unknown()),
  }),
});

type CustomEntryRecord = Type.Static<typeof CUSTOM_ENTRY_RECORD>;

const CUSTOM_ENTRY_VALIDATOR = Compile(CUSTOM_ENTRY_RECORD);

// The custom entries among the records Pi printed, in the order it printed them.
function customEntries(stdout: string): CustomEntryRecord["entry"][] {
  return stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): unknown => JSON.parse(line))
    .filter((record): record is CustomEntryRecord => CUSTOM_ENTRY_VALIDATOR.Check(record))
    .map((record) => record.entry);
}

/**
 * Runs `command` in a one-shot Pi in json mode, with stdin closed, because
 * json mode reads stdin to its end before it runs the command. Returns every
 * payload the command emitted, in emission order, each valid against the
 * payload schema (DRV-01). Fails, with Pi's stderr, on a non-zero exit, on no
 * payload, and once `timeoutMs` has passed, after it kills the process group.
 */
export async function runJsonModeCommand(
  launch: JsonModeLaunch,
  command: string,
  timeoutMs = DEFAULT_JSON_MODE_MS,
): Promise<readonly NotificationPayload[]> {
  const sandbox = await resolveRpcSandbox(launch.sandbox);
  const child = spawn(
    process.execPath,
    [...piArguments("json", [SCRIPTED_MODEL_EXTENSION]), ...SCRIPTED_MODEL_ARGUMENTS, command],
    {
      cwd: sandbox.cwd,
      detached: true,
      env: rpcChildEnvironment(sandbox, launch.git, launch.environment),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = { stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => (output.stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => (output.stderr += chunk));
  let closed: unknown[];
  try {
    closed = await once(child, "close", { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    killProcessGroup(child);
    throw new Error(
      `${command} in json mode failed or did not exit within ${timeoutMs} ms:\n${output.stderr}`,
      { cause: error },
    );
  }

  const [exitCode] = closed;
  if (exitCode !== 0) {
    throw new Error(`${command} in json mode exited with ${String(exitCode)}:\n${output.stderr}`);
  }

  const payloads = claudePluginPayloads(customEntries(output.stdout));
  if (payloads.length === 0) {
    throw new Error(`${command} in json mode emitted no claude-plugin payload:\n${output.stderr}`);
  }

  return payloads;
}
