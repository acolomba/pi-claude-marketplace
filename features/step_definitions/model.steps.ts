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

import type { ScenarioWorld } from "../support/world.ts";

// HAR-01: a profile Pi started with no companion loads none, so no command
// comes from the optional peer cache.
Given("pi runs with the scripted model", async function (this: ScenarioWorld) {
  await this.usePiWithProfile({});
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
    projectTokens("text", text, this.tokens),
  ]);
  assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
  this.markTurnCompared();
});
