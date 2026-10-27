/**
 * @fileoverview Steps about the background update of marketplaces: the delay
 * Pi waits before it updates them after the first message.
 */

import { Given } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi reads PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS once, at start, so the
// scenario gets a Pi of its own. Its startup load reads the configs, so the
// step comes before the steps that write them.
Given(
  "pi runs with the background update delay {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithBackgroundUpdateDelay(value);
  },
);
