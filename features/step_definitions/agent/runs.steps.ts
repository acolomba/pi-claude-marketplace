/**
 * @fileoverview Steps about running a bridged agent: the tools that
 * pi-subagents offers the child the run starts (AGT-02).
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { modelCallsOf } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The names of the tools of model call `number` of the last turn, numbered
// from 1, in the order Pi offered them.
function offeredToolNames(world: ScenarioWorld, number: number): string[] {
  const calls = modelCallsOf(world.requireTurn().logs);
  const tools = calls.find((call) => call.index === number - 1)?.tools;
  assert.ok(tools !== undefined, `the last turn has no model call ${number}`);
  return tools.map((tool) => tool.name);
}

// The whole tool list of one call. A child agent's call is one of the turn's
// calls, so this states the tools the child ran with.
Then(
  "the agent's model call {int} offers these tools:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const rows = offeredToolNames(this, number).map((name) => [name]);
    assert.deepStrictEqual([["tool"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
