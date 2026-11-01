/**
 * @fileoverview Steps about running the workflows of a plugin: the workflows
 * a published plugin holds, running one through its command, and the result
 * or error the run ends with (HAR-07).
 *
 * The workflow engine runs a workflow command in the background and does not
 * answer over RPC with the run's result. It does append progress entries to
 * Pi's session, and Pi prints each one, so the run `When` waits for the entry
 * that ends the run and the run-ending `Then` steps read the entries of the
 * turn.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { expandTokens } from "../../lib/run-tokens.ts";
import {
  progressOf,
  publishWorkflow,
  sendWorkflowCommand,
  workflowScriptText,
} from "../../lib/workflow-files.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "aborted"]);

// A script with no agent call ends within a second; the margin covers a
// loaded CI runner and stays below the 30-second step timeout, so a run that
// never ends fails here with Pi's stderr (D-CF1-17).
const WORKFLOW_RUN_TIMEOUT_MS = 20_000;

function endsRun(record: RpcRecord): boolean {
  const status = progressOf(record)?.status;
  return typeof status === "string" && TERMINAL_STATUSES.has(status);
}

// The last progress entry of the turn's one run carries the run's final
// status, the whole text of a text result, and the error a failed run threw.
function runOutcome(world: ScenarioWorld): Readonly<Record<string, unknown>> {
  const entries = world.requireTurn().records.flatMap((record) => {
    const progress = progressOf(record);
    return progress === undefined ? [] : [progress];
  });
  const runs = [...new Set(entries.map((entry) => entry.runId))];
  assert.strictEqual(runs.length, 1, `the command started ${runs.length} runs`);
  const last = entries.at(-1);
  return { status: last?.status, result: last?.resultPreview, error: last?.error };
}

Given(
  "the published plugin {string} of the marketplace {string} has the workflow {string} described as {string} that returns {string}",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    workflow: string,
    description: string,
    returns: string,
  ) {
    const published = this.requirePublished(name);
    const file = await publishWorkflow(published, plugin, { name: workflow, description, returns });
    assert.strictEqual(
      await readFile(file, "utf8"),
      workflowScriptText({ name: workflow, description, returns }),
    );
  },
);

// The engine handles the command itself, so Pi answers `handled` and starts
// no model turn; the step then waits for the progress entry that ends the
// run, never for a fixed time (D-CF1-17).
When(
  "the user runs the workflow command {string}",
  async function (this: ScenarioWorld, text: string) {
    const settle = (from: number): Promise<RpcRecord> =>
      this.pi.waitForRecord(from, endsRun, WORKFLOW_RUN_TIMEOUT_MS);
    const command = expandTokens(text, this.tokens);
    this.recordTurn(await sendWorkflowCommand(this.pi, this.profileHarness(), command, settle));
  },
);

Then(
  "the workflow run ends with the status {string} and the result {string}",
  function (this: ScenarioWorld, status: string, result: string) {
    assert.deepStrictEqual(runOutcome(this), { status, result, error: undefined });
    this.markTurnCompared();
  },
);

// A run whose script throws ends with the thrown error and no result.
Then(
  "the workflow run ends with the status {string} and the error {string}",
  function (this: ScenarioWorld, status: string, error: string) {
    assert.deepStrictEqual(runOutcome(this), { status, result: undefined, error });
    this.markTurnCompared();
  },
);
