/**
 * @fileoverview Steps about skills whose names clash with a command or with
 * another skill of their plugin.
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// D-CF2-03 / D-07: an install that skipped a skill reports an info cascade
// and one warning diagnostic, so it fits neither `the user has run` (all
// info) nor `..., which warned` (all warnings). A precondition that broke,
// such as a skill that was not skipped, fails here.
Given(
  "the user has run {string}, which skipped a skill of the plugin",
  async function (this: ScenarioWorld, command: string) {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    assert.deepStrictEqual(
      payloads.map((payload) => [payload.kind, payload.severity]),
      [
        ["cascade", "info"],
        ["diagnostic", "warning"],
      ],
    );
  },
);
