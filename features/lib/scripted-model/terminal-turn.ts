/**
 * @fileoverview A turn of the scripted model in Pi's terminal: the line that
 * starts it, the wait for the reply of the script's last step, and the lines
 * the stand-in logs gained (HAR-03).
 *
 * A terminal Pi prints no RPC record, so a terminal turn ends when the last
 * reply of the script renders, and it keeps only the stand-in log lines. The
 * module registers no step and imports no step module.
 */

import assert from "node:assert/strict";

import { readLogLinesSince } from "../turn-records.ts";

import { modelCallsOf, readModelScript } from "./script.ts";

import type { PiTuiSession } from "../pi-tui.ts";

/** Where a terminal turn reads its logs and what it waits for. */
export interface TerminalTurn {
  /** The harness directory of the scenario's profile Pi, which the terminal Pi shares. */
  readonly harness: string;
  /** The line count of each stand-in log when the turn started. */
  readonly lengths: ReadonlyMap<string, number>;
  /** The reply of the script's last step, from `lastScriptReply()`. */
  readonly reply: string;
  /** How long the turn waits for the reply to render after its line. */
  readonly timeoutMs: number;
}

/**
 * Returns the reply of the last step of the script in `harness`, which a
 * terminal turn waits for. Fails when the last step is not a reply.
 */
export async function lastScriptReply(harness: string): Promise<string> {
  const lastStep = (await readModelScript(harness)).at(-1);
  if (lastStep === undefined || !("reply" in lastStep)) {
    assert.fail("the scripted model's last step is not a reply");
  }

  return lastStep.reply;
}

/**
 * Types `line` into `tui`, waits until the turn's reply renders after it, and
 * returns the lines each stand-in log gained since the turn started. Fails
 * when the model was called past the end of its script.
 */
export async function sendTerminalTurn(
  tui: PiTuiSession,
  line: string,
  turn: TerminalTurn,
): Promise<ReadonlyMap<string, readonly unknown[]>> {
  const beforeSend = tui.markOutput();
  tui.sendLine(line);
  await tui.waitForTextAfter(turn.reply, beforeSend, turn.timeoutMs);
  const logs = await readLogLinesSince(turn.harness, turn.lengths);
  assert.deepStrictEqual(
    modelCallsOf(logs)
      .filter((call) => call.overflow)
      .map((call) => `call ${call.index + 1}`),
    [],
    "the model was called past the end of its script",
  );
  return logs;
}
