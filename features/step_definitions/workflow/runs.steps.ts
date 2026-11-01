/**
 * @fileoverview Steps about running the workflows of a plugin: the workflows
 * a published plugin holds, running one through its command, and the result
 * the run ends with (HAR-07).
 *
 * The workflow engine runs a workflow command in the background and does not
 * answer over RPC with the run's result. It does append progress entries to
 * Pi's session, and Pi prints each one, so the run `When` waits for the entry
 * that ends the run and the result `Then` reads the entries of the turn.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { publishWorkflow, workflowScriptText } from "../../lib/workflow-files.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const PROGRESS_ENTRY = "pi-dynamic-workflows:progress";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "failed", "aborted"]);

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// A script with no agent call ends within a second; the margin covers a
// loaded CI runner and stays below the 30-second step timeout, so a run that
// never ends fails here with Pi's stderr (D-CF1-17).
const WORKFLOW_RUN_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The data of a progress entry the engine appended, or undefined for any
// other record.
function progressOf(record: RpcRecord): Readonly<Record<string, unknown>> | undefined {
  const { entry } = record;
  if (
    record.type !== "entry_appended" ||
    !isRecord(entry) ||
    entry.type !== "custom" ||
    entry.customType !== PROGRESS_ENTRY ||
    !isRecord(entry.data)
  ) {
    return undefined;
  }

  return entry.data;
}

// An extension error or a dialog during a run is never expected.
function isRunFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" &&
      typeof record.method === "string" &&
      DIALOG_METHODS.has(record.method))
  );
}

function endsRun(record: RpcRecord): boolean {
  const status = progressOf(record)?.status;
  return typeof status === "string" && TERMINAL_STATUSES.has(status);
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
    const harness = this.profileHarness();
    const from = this.pi.recordCount();
    const lengths = await readLogLengths(harness);
    const command = expandTokens(text, this.tokens);
    const { response } = await this.pi.request({ type: "prompt", message: command });
    assert.strictEqual(promptDisposition(response), "handled", JSON.stringify(response));
    await this.pi.waitForRecord(from, endsRun, WORKFLOW_RUN_TIMEOUT_MS);
    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(records.filter(isRunFault), []);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(modelCallsOf(logs), [], "the workflow run called the model");
    this.recordTurn({ prompt: command, disposition: "handled", records, logs });
  },
);

// The last progress entry of the run carries its final status and, for a
// result that is text, the whole text.
Then(
  "the workflow run ends with the status {string} and the result {string}",
  function (this: ScenarioWorld, status: string, result: string) {
    const entries = this.requireTurn().records.flatMap((record) => {
      const progress = progressOf(record);
      return progress === undefined ? [] : [progress];
    });
    const runs = [...new Set(entries.map((entry) => entry.runId))];
    assert.strictEqual(runs.length, 1, `the command started ${runs.length} runs`);
    const last = entries.at(-1);
    assert.deepStrictEqual(
      { status: last?.status, result: last?.resultPreview, error: last?.error },
      { status, result, error: undefined },
    );
    this.markTurnCompared();
  },
);
