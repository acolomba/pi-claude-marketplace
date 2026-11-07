/**
 * @fileoverview Steps about the model calls of a turn that searches Pi's
 * built-in tool search: each `tool_search` result is reduced to the tools it
 * loads, so a scenario never states Pi's wording (BLT-01).
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { callMessageRows, modelCallsOf } from "../../lib/scripted-model/script.ts";
import { toolSearchCallRows } from "../../lib/upstream/tool-search.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// One row per message of every call of the last turn, system messages aside,
// in call order, as the step that lists the calls of a turn lists them.
Then(
  "the model receives these calls, with each tool search reduced to the tools it loads:",
  function (this: ScenarioWorld, table: DataTable) {
    const rows = toolSearchCallRows(
      callMessageRows(modelCallsOf(this.requireTurn().logs)),
      this.tokens,
    );
    assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
