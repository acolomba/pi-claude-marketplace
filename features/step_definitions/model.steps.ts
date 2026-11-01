/**
 * @fileoverview Steps about the scripted model of a profile Pi: starting the
 * profile Pi with it, arming its script, and the calls it receives (D-CF1-17).
 *
 * A feature file writes the whole script as literals. The calls step reads
 * the call log, never the script, so it states what Pi sent the model.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { listedCommands } from "../../test/e2e/_rpc.ts";
import { isInPeerCache } from "../lib/companions.ts";
import { expandTokens, projectTokens } from "../lib/run-tokens.ts";
import {
  callMessageRows,
  modelCallsOf,
  parseScriptTable,
  readModelScript,
  writeModelScript,
} from "../lib/scripted-model/script.ts";

import type { RunTokens } from "../lib/run-tokens.ts";
import type { ScenarioWorld } from "../support/world.ts";

// A companion stamps some texts with an id it draws for each run, such as the
// mission id pi-subagents appends to a subagent result.
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu;

// A text Pi sent the model, with the run tokens projected and each UUID read
// as `{uuid}`, so a scenario states a per-run id without knowing its value.
function projectCallText(text: string, tokens: RunTokens): string {
  return projectTokens("text", text, tokens).replaceAll(UUID_PATTERN, "{uuid}");
}

// HAR-01: a profile Pi started with no companion loads none, so no command
// comes from the optional peer cache.
Given("pi runs with the scripted model", async function (this: ScenarioWorld) {
  await this.usePiWithProfile({ companions: [] });
  const { response } = await this.pi.request({ type: "get_commands" });
  const commands = listedCommands(response);
  assert.notDeepStrictEqual(commands, [], JSON.stringify(response));
  assert.deepStrictEqual(
    commands.filter(({ sourcePath }) => sourcePath !== undefined && isInPeerCache(sourcePath)),
    [],
  );
});

Given(
  "the scripted model plays these steps:",
  async function (this: ScenarioWorld, table: DataTable) {
    const rows = table.raw().map((cells) => cells.map((cell) => expandTokens(cell, this.tokens)));
    const steps = parseScriptTable(rows);
    const harness = this.profileHarness();
    await writeModelScript(harness, steps);
    assert.deepStrictEqual(await readModelScript(harness), steps);
  },
);

// One row per message of every call of the last turn, system messages aside,
// in call order: each call repeats the conversation so far.
Then("the model receives these calls:", function (this: ScenarioWorld, table: DataTable) {
  const rows = callMessageRows(modelCallsOf(this.requireTurn().logs)).map(([call, role, text]) => [
    call,
    role,
    projectCallText(text, this.tokens),
  ]);
  assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
  this.markTurnCompared();
});

// The whole system prompt of one call of the last turn, numbered from 1 as
// the calls step numbers them, with the run tokens projected. A child agent's
// call is one of the turn's calls, so this states the prompt the child ran on.
Then(
  "the model call {int} receives this system prompt:",
  function (this: ScenarioWorld, number: number, expected: string) {
    const call = modelCallsOf(this.requireTurn().logs).find(({ index }) => index + 1 === number);
    if (call === undefined) {
      assert.fail(`the last turn has no model call ${number}`);
    }

    assert.strictEqual(projectCallText(call.systemPrompt, this.tokens), expected);
    this.markTurnCompared();
  },
);
