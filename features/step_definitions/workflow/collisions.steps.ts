/**
 * @fileoverview Steps about workflows whose names clash with a command of
 * their plugin.
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The line an install reports for a command that a workflow's name displaced.
const SKIPPED_COMMAND =
  /^command source "[^"]+" has the same name "[^"]+" as a workflow of the plugin; ignoring the command\.$/u;

// An install that skipped a command for a workflow reports an info cascade
// beside one warning diagnostic, so it fits neither `the user has run` (all
// info) nor `..., which warned` (all warnings). A command that was not
// skipped, or a diagnostic with another note, fails here.
Given(
  "the user has run {string}, which skipped a command that a workflow of the plugin names",
  async function (this: ScenarioWorld, command: string): Promise<void> {
    const [cascade, diagnostic, ...extra] = await runCommandPayloads(
      this.pi,
      expandTokens(command, this.tokens),
    );
    const lines = diagnostic?.kind === "diagnostic" ? diagnostic.lines : [];
    assert.deepStrictEqual(
      {
        cascade: [cascade?.kind, cascade?.severity],
        diagnostic: [diagnostic?.kind, diagnostic?.severity],
        skippedCommandLines: lines.map((line) => SKIPPED_COMMAND.test(line)),
        extra,
      },
      {
        cascade: ["cascade", "info"],
        diagnostic: ["diagnostic", "warning"],
        skippedCommandLines: [true],
        extra: [],
      },
    );
  },
);
