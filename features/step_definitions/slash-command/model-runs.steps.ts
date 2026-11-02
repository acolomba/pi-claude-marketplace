/**
 * @fileoverview Steps about the tool through which the model runs a bridged
 * slash command: the description Pi offers the model for it.
 */

import assert from "node:assert/strict";

import { Then } from "@cucumber/cucumber";

import { projectTokens } from "../../lib/run-tokens.ts";
import { numberedModelCall } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The whole description of one tool that one call of the last turn offered,
// with the run tokens projected. A scenario that uses it also states the
// calls, so this step leaves the turn for that step to mark compared.
Then(
  "the model call {int} is offered the tool {string} with this description:",
  function (this: ScenarioWorld, number: number, name: string, expected: string) {
    const call = numberedModelCall(this.requireTurn().logs, number);

    const tool = call.tools.find((offered) => offered.name === name);
    if (tool === undefined) {
      assert.fail(`model call ${number} is not offered the tool ${name}`);
    }

    assert.strictEqual(projectTokens("text", tool.description, this.tokens), expected);
  },
);
