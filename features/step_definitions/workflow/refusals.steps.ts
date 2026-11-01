/**
 * @fileoverview Steps about workflow scripts that the bridge or the workflow
 * engine refuses: the install that reports a note on each such script, and
 * the lines of the diagnostic that holds the notes.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";

import type { NotificationPayload } from "../../lib/pi-commands.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// A note the bridge reports on a workflow script: the script, then what the
// install did with it, then why.
const WORKFLOW_NOTE =
  /^workflow script "([^"]+)" in "workflows" (was refused|was not installed|was installed but the engine will refuse to load it): /u;

// One `script | disposition` row per line of a diagnostic, in its order. A
// line that is no note on a workflow script keeps its whole text in the
// script cell and leaves the disposition empty, so it fails the comparison.
function noteRows(payload: NotificationPayload | undefined): string[][] | undefined {
  if (payload?.kind !== "diagnostic") {
    return undefined;
  }

  return payload.lines.map((line) => {
    const [, script = line, disposition = ""] = WORKFLOW_NOTE.exec(line) ?? [];
    return [script, disposition];
  });
}

// D-CF7-04 / WGATE-03: an install that refused, skipped, or noted a workflow
// script reports an info cascade beside one warning diagnostic, so it fits
// neither `the user has run` (all info) nor `..., which warned` (all
// warnings). The table states every note, so a script the bridge installed
// without a note, or with another disposition, fails here.
Given(
  "the user has run {string}, which reported these notes on workflow scripts:",
  async function (this: ScenarioWorld, command: string, table: DataTable): Promise<void> {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    const [cascade, diagnostic, ...extra] = payloads;
    const notes = noteRows(diagnostic);
    assert.deepStrictEqual(
      {
        cascade: [cascade?.kind, cascade?.severity],
        diagnostic: [diagnostic?.kind, diagnostic?.severity],
        notes: notes === undefined ? undefined : [["script", "disposition"], ...notes],
        extra,
      },
      {
        cascade: ["cascade", "info"],
        diagnostic: ["diagnostic", "warning"],
        notes: table.raw(),
        extra: [],
      },
    );
  },
);

// The results table joins a diagnostic's lines with commas, and a note holds
// commas of its own, so it cannot tell where one note ends. This step states
// one line per row, in the diagnostic's order.
Then("the diagnostic reports these lines:", function (this: ScenarioWorld, table: DataTable) {
  const [lines, ...others] = this.resultsOf("command").flatMap((payload) =>
    payload.kind === "diagnostic" ? [payload.lines] : [],
  );
  assert.deepStrictEqual(others, [], "the command reported more than one diagnostic");
  const rows = (lines ?? assert.fail("the command reported no diagnostic")).map((line) => [
    projectTokens("lines", line, this.tokens),
  ]);
  assert.deepStrictEqual([["line"], ...rows], table.raw());
});
