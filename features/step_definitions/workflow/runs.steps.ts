/**
 * @fileoverview Steps about running the workflows of a plugin: the workflows
 * a published plugin holds, running one through its command or through a
 * prompt whose model turn starts it, and the result or error the run ends
 * with (HAR-07).
 *
 * The workflow engine runs a workflow command in the background and does not
 * answer over RPC with the run's result. It does append progress entries to
 * Pi's session, and Pi prints each one, so the run `When` waits for the entry
 * that ends the run and the run-ending `Then` steps read the entries of the
 * turn. The engine's `workflow` tool also starts its run in the background,
 * so a prompt whose model calls it keeps the run's entries with its turn in
 * the same way (D-PG4-08).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import {
  progressOf,
  publishWorkflow,
  sendWorkflowCommand,
  workflowScriptText,
} from "../../lib/workflow-files.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { WorkflowModelCalls } from "../../lib/workflow-files.ts";
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

function isSettled(record: RpcRecord): boolean {
  return record.type === "agent_settled";
}

// An extension error or a dialog during a model turn is never expected.
function isTurnFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method)))
  );
}

// The engine reports what a script threw as text that can carry the error's
// class before the message, such as `Error: Nope.`, and stack lines after it.
// The message the script threw is the rest of the first line after the last
// such class.
const THROWN_CLASS = /^.*\b\w*Error: /u;

/** What a run ended with: its status, and the text its script returned or threw. */
interface RunOutcome {
  readonly status: string;
  readonly result: string | undefined;
  readonly error: string | undefined;
}

// The first of `fields` of `entry` that holds text.
function textField(
  entry: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = entry[field];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

// The last progress entry of the turn's one run carries the run's final
// status, the text the script returned, and the error it threw. The engine
// names and wraps those values its own way, so this reads them tolerantly,
// and fails with the entry when it finds no status or not the value that the
// status calls for.
function runOutcome(world: ScenarioWorld): RunOutcome {
  const entries = world.requireTurn().records.flatMap((record) => {
    const progress = progressOf(record);
    return progress === undefined ? [] : [progress];
  });
  const runs = [...new Set(entries.map((entry) => entry.runId))];
  assert.strictEqual(runs.length, 1, `the command started ${runs.length} runs`);
  const last: Readonly<Record<string, unknown>> = entries.at(-1) ?? {};
  const unreadable = `cannot read the run's outcome from its last progress entry: ${JSON.stringify(last)}`;
  const { status } = last;
  if (typeof status !== "string") {
    assert.fail(unreadable);
  }

  const result = textField(last, ["resultPreview", "result"]);
  const thrown = textField(last, ["error"])?.split("\n")[0]?.replace(THROWN_CLASS, "").trim();
  const error = thrown === "" ? undefined : thrown;
  if (
    (status === "completed" && result === undefined) ||
    (status === "failed" && error === undefined)
  ) {
    assert.fail(unreadable);
  }

  return { status, result, error };
}

// Runs the workflow command `text` and records what it left as the last turn.
async function runWorkflowCommand(
  world: ScenarioWorld,
  text: string,
  modelCalls: WorkflowModelCalls,
): Promise<void> {
  const settle = (from: number): Promise<RpcRecord> =>
    world.pi.waitForRecord(from, endsRun, WORKFLOW_RUN_TIMEOUT_MS);
  const command = expandTokens(text, world.tokens);
  world.recordTurn(
    await sendWorkflowCommand(world.pi, world.profileHarness(), command, settle, modelCalls),
  );
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
    await runWorkflowCommand(this, text, "none");
  },
);

// A script's `agent()` step runs in a child session of the engine, which
// calls the scripted model; the step otherwise waits as the one above does.
When(
  "the user runs the workflow command {string}, whose agent steps the model answers",
  async function (this: ScenarioWorld, text: string) {
    await runWorkflowCommand(this, text, "agent steps");
  },
);

// The engine's `workflow` tool answers at once and runs the script in the
// background, so the turn can settle before or after the run ends. The step
// waits for both, never for a fixed time, makes the checks the model-turn
// `When` makes, and keeps every record and stand-in log line from the prompt
// on as the last turn.
When(
  "the user prompts {string} and the model starts a workflow run",
  async function (this: ScenarioWorld, text: string) {
    const harness = this.profileHarness();
    const start = { record: this.pi.recordCount(), logs: await readLogLengths(harness) };
    const prompt = expandTokens(text, this.tokens);
    const answer = await this.pi.request({ type: "prompt", message: prompt });
    assert.strictEqual(promptDisposition(answer.response), "started", JSON.stringify(answer));
    const [settled] = await Promise.all(
      [isSettled, endsRun].map((until) =>
        this.pi.waitForRecord(start.record, until, WORKFLOW_RUN_TIMEOUT_MS),
      ),
    );
    assert.strictEqual(settled?.aborted, false, JSON.stringify(settled));
    const records = this.pi.recordsSince(start.record);
    const logs = await readLogLinesSince(harness, start.logs);
    assert.deepStrictEqual(
      {
        faults: records.filter(isTurnFault),
        callsPastScript: modelCallsOf(logs).filter((call) => call.overflow),
      },
      { faults: [], callsPastScript: [] },
    );
    this.recordTurn({ prompt, disposition: "started", records, logs });
  },
);

// The run-ending steps read only the progress entries, so they leave the turn
// uncompared: `the workflow engine shows these notices:` marks a command's
// run, `the model receives these calls:` marks a run the model starts, and a
// run scenario that leaves them unstated fails.
Then(
  "the workflow run ends with the status {string} and the result {string}",
  function (this: ScenarioWorld, status: string, result: string) {
    assert.deepStrictEqual(runOutcome(this), { status, result, error: undefined });
  },
);

// A run whose script throws ends with the message it threw and no result.
Then(
  "the workflow run ends with the status {string} and the error {string}",
  function (this: ScenarioWorld, status: string, error: string) {
    assert.deepStrictEqual(runOutcome(this), { status, result: undefined, error });
  },
);
