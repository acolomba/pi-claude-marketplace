/**
 * @fileoverview Runs one `/claude:plugin` command in a one-shot Pi in json mode (D-BG-09).
 *
 * In json mode Pi prints one JSON record per session event on stdout, and the
 * extension appends each result as a `claude-plugin` custom entry, which Pi
 * prints as an `entry_appended` record. The driver keeps those entries and
 * returns their payloads, each validated as an RPC command's are (DRV-01), so
 * a scenario compares a json result with an rpc result through the same steps.
 */

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { claudePluginPayloads } from "./pi-commands.ts";
import { runOneShotPi } from "./pi-one-shot.ts";

import type { NotificationPayload } from "./pi-commands.ts";
import type { OneShotLaunch } from "./pi-one-shot.ts";

/** What the one-shot Pi starts with: the run's sandbox, git environment, extensions, and `TMPDIR`. */
export type JsonModeLaunch = OneShotLaunch;

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
 * payload, and once `timeoutMs` has passed. Pi runs in a process group of its
 * own, which the driver kills once Pi exits or the time passes, so nothing Pi
 * started outlives the command. It hands that kill to `onRelease` before it
 * waits, so the scenario's release frees the group when the wait is abandoned.
 */
export async function runJsonModeCommand(
  launch: JsonModeLaunch,
  command: string,
  onRelease: (release: () => void) => void,
  timeoutMs = DEFAULT_JSON_MODE_MS,
): Promise<readonly NotificationPayload[]> {
  const { exitCode, stdout, stderr } = await runOneShotPi(
    launch,
    "json",
    command,
    onRelease,
    timeoutMs,
  );
  if (exitCode !== 0) {
    throw new Error(`${command} in json mode exited with ${String(exitCode)}:\n${stderr}`);
  }

  const payloads = claudePluginPayloads(customEntries(stdout));
  if (payloads.length === 0) {
    throw new Error(`${command} in json mode emitted no claude-plugin payload:\n${stderr}`);
  }

  return payloads;
}
