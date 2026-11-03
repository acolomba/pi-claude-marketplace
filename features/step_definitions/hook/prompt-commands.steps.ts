/**
 * @fileoverview Steps about prompts that a UserPromptSubmit hook blocks: the
 * model calls such a prompt leaves.
 */

import assert from "node:assert/strict";

import { Then } from "@cucumber/cucumber";

import { modelCallsOf } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// A blocked prompt never reaches the model, so the last turn holds no model
// call at all. A table with only a header row cannot state that.
Then("the prompt the hook blocked reaches the model in no call", function (this: ScenarioWorld) {
  assert.deepStrictEqual(modelCallsOf(this.requireTurn().logs), []);
});
