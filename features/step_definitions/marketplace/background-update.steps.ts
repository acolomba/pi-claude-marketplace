/**
 * @fileoverview Steps about the background update of marketplaces: the delay
 * Pi waits before it updates them after the first message.
 */

import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// A Pi's environment, PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS included, is
// fixed when it starts, so the scenario gets a Pi of its own. Its startup load
// reads the configs, so the step comes before the steps that write them.
Given(
  "pi runs with the background update delay {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithBackgroundUpdateDelay(value);
  },
);

When("the user starts a tui session", async function (this: ScenarioWorld): Promise<void> {
  await this.startTuiSession();
});

Then(
  "the tui session has an interactive terminal and is ready",
  function (this: ScenarioWorld): void {
    assert.deepStrictEqual(this.requireTuiSession().readiness, { isatty: true, ready: true });
  },
);
