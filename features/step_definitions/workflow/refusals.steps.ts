/**
 * @fileoverview Steps about workflow scripts that the bridge or the workflow
 * engine refuses: the install that reports a note on each such script.
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { NotificationPayload } from "../../lib/pi-commands.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Every note the bridge reports on a workflow script starts this way.
const WORKFLOW_NOTE = 'workflow script "';

// The lines of a diagnostic that are not notes on a workflow script, or
// `undefined` for a payload that is not a diagnostic.
function linesOtherThanWorkflowNotes(
  payload: NotificationPayload | undefined,
): readonly string[] | undefined {
  if (payload?.kind !== "diagnostic") {
    return undefined;
  }

  return payload.lines.filter((line) => !line.startsWith(WORKFLOW_NOTE));
}

// D-CF7-04 / WGATE-03: an install that refused, skipped, or noted a workflow
// script reports an info cascade beside one warning diagnostic, so it fits
// neither `the user has run` (all info) nor `..., which warned` (all
// warnings). A precondition that broke, such as a script the bridge installed
// without a note, fails here.
Given(
  "the user has run {string}, which reported notes on workflow scripts of the plugin",
  async function (this: ScenarioWorld, command: string): Promise<void> {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    const [cascade, diagnostic, ...extra] = payloads;
    assert.deepStrictEqual(
      {
        cascade: [cascade?.kind, cascade?.severity],
        diagnostic: [diagnostic?.kind, diagnostic?.severity],
        otherLines: linesOtherThanWorkflowNotes(diagnostic),
        extra,
      },
      {
        cascade: ["cascade", "info"],
        diagnostic: ["diagnostic", "warning"],
        otherLines: [],
        extra: [],
      },
    );
  },
);
