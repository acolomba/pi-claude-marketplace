/**
 * @fileoverview Steps about failed tool calls that no frozen module offers:
 * for now, a prompt whose running tool the user interrupts.
 *
 * The interrupting `When` sends the prompt, waits until the running tool has
 * created a marker file, and sends Pi's RPC `abort`. Pi answers the abort only
 * after the turn has settled, aborted, so the step then reads that settle and
 * keeps every record and stand-in log line from the prompt on as the last
 * turn (HAR-03). The marker's removal is registered before the prompt, and it
 * ends the command's wait loop whatever fails.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The scripted tool call starts well within a second; the margin covers a
// loaded CI runner and leaves the settle wait room below the 30-second step
// timeout, so a tool that never runs fails here.
const MARKER_DEADLINE_MS = 10_000;

const MARKER_POLL_MS = 50;

// Pi answers the abort after the turn settled, so the settle record is
// normally there already; the bound fails a Pi that never settles while
// keeping the step below its 30-second timeout.
const ABORTED_SETTLE_TIMEOUT_MS = 15_000;

// Polls until `file` exists, and fails once the deadline passes.
async function awaitMarker(file: string): Promise<void> {
  const deadline = Date.now() + MARKER_DEADLINE_MS;
  while (!existsSync(file)) {
    if (Date.now() > deadline) {
      assert.fail(`the running tool did not create ${file} within ${MARKER_DEADLINE_MS} ms`);
    }

    await delay(MARKER_POLL_MS);
  }
}

// The records of the run that no turn may print: an extension error, or a
// dialog Pi opened.
function unexpectedRecords(records: readonly RpcRecord[]): readonly RpcRecord[] {
  return records.filter((record) =>
    record.type === "extension_ui_request"
      ? DIALOG_METHODS.has(String(record.method))
      : record.type === "extension_error",
  );
}

// The numbers of the model calls that went past the end of the script.
function overflowingCalls(logs: ReadonlyMap<string, readonly unknown[]>): readonly number[] {
  return modelCallsOf(logs).flatMap((call) => (call.overflow ? [call.index + 1] : []));
}

When(
  "the user prompts {string} and interrupts the running tool once it has created {string}",
  async function (this: ScenarioWorld, text: string, marker: string): Promise<void> {
    const prompt = expandTokens(text, this.tokens);
    const markerFile = path.join(this.tokens.projectDir, marker);
    this.onRelease(() => rm(markerFile, { force: true }));
    const harness = this.profileHarness();
    const lengths = await readLogLengths(harness);
    const from = this.pi.recordCount();

    const started = await this.pi.request({ type: "prompt", message: prompt });
    assert.strictEqual(
      promptDisposition(started.response),
      "started",
      JSON.stringify(started.response),
    );
    await awaitMarker(markerFile);
    const abort = await this.pi.request({ type: "abort" });
    assert.strictEqual(abort.response.success, true, JSON.stringify(abort.response));
    const settled = await this.pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      ABORTED_SETTLE_TIMEOUT_MS,
    );
    assert.strictEqual(settled.aborted, true, JSON.stringify(settled));

    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(unexpectedRecords(records), []);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(overflowingCalls(logs), [], "the model was called past its script");
    this.recordTurn({ prompt, disposition: "started", records, logs });
  },
);
