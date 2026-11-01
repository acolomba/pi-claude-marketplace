/**
 * @fileoverview Steps about Stop hooks that send the turn back: a prompt
 * whose turn the Stop hooks continue, recorded with the turn they start.
 *
 * Pi runs the extension `agent_settled` handlers, the Stop hooks among them,
 * before it reports `agent_settled`, and it starts the turn a Stop hook asks
 * for only after that report (STOP-03). So the model-turn `When` ends before
 * the re-entered turn runs. The `When` here waits for the second
 * `agent_settled` instead, and keeps every record and stand-in log line of
 * both turns as the last turn (HAR-03).
 */

import assert from "node:assert/strict";

import { When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Two scripted turns settle in well under a second each; the margin covers a
// loaded CI runner and stays below the 30-second step timeout, so a turn the
// Stop hooks never send back fails here.
const REENTERED_TURNS_DEADLINE_MS = 20_000;

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// An extension error or a dialog during the two turns is never expected.
function isFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method)))
  );
}

function isSettled(record: RpcRecord): boolean {
  return record.type === "agent_settled";
}

// Waits for the next `agent_settled` at or after `from`, within the time left
// before `deadline`, asserts that its turn was not aborted, and returns the
// index after it.
async function settledAfter(world: ScenarioWorld, from: number, deadline: number): Promise<number> {
  const settled = await world.pi.waitForRecord(from, isSettled, deadline - Date.now());
  assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  return from + world.pi.recordsSince(from).indexOf(settled) + 1;
}

// Sends `prompt` and asserts that Pi started a turn for it. Returns the log
// lengths and the record count from before the prompt, so the turn keeps
// only what the prompt added.
async function startPrompt(
  world: ScenarioWorld,
  prompt: string,
): Promise<{ readonly lengths: ReadonlyMap<string, number>; readonly from: number }> {
  const lengths = await readLogLengths(world.profileHarness());
  const from = world.pi.recordCount();
  const { response } = await world.pi.request({ type: "prompt", message: prompt });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  return { lengths, from };
}

// The model calls past the end of the script, by number.
function callsPastScript(logs: ReadonlyMap<string, readonly unknown[]>): string[] {
  return modelCallsOf(logs)
    .filter((call) => call.overflow)
    .map((call) => `call ${call.index + 1}`);
}

When(
  "the user prompts {string} and the stop hooks send the turn back",
  async function (this: ScenarioWorld, text: string) {
    const deadline = Date.now() + REENTERED_TURNS_DEADLINE_MS;
    const prompt = expandTokens(text, this.tokens);
    const { lengths, from } = await startPrompt(this, prompt);
    await settledAfter(this, await settledAfter(this, from, deadline), deadline);
    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(records.filter(isFault), []);
    const logs = await readLogLinesSince(this.profileHarness(), lengths);
    assert.deepStrictEqual(callsPastScript(logs), [], "the model was called past its script");
    this.recordTurn({ prompt, disposition: "started", records, logs });
  },
);
