/**
 * @fileoverview Steps that start a new Pi session and check the skills it
 * offers and the results it reports.
 *
 * A result can claim an install that never reached disk. These steps look
 * where the user looks: the `/skill:` commands of the next session. A new
 * session also reports its own payloads, such as its reconcile report. They
 * become the last results, so the row steps compare them and a scenario
 * fails when their rows go uncompared. A new session can also be setup, so a
 * scenario shows that what it set up survives the session. A session in
 * another project runs in a project directory of its own, so it shows what
 * the user scope alone offers. A plain message is sent in the current
 * session, and the results that follow it, such as a background update's
 * notice, become the last results the same way. A prompt to a profile Pi
 * runs a model turn, and every record and stand-in log line the turn
 * produced becomes the last model turn (HAR-03). A profile Pi also lists the
 * slash commands it offers through its registry probe, and the listing stays
 * on the world for the step that compares it (HAR-04).
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../test/e2e/_rpc.ts";
import { sendMessage, startSession } from "../lib/pi-commands.ts";
import { DIALOG_METHODS } from "../lib/pi-process.ts";
import { readRegistrySnapshot, REGISTRY_PROBE_COMMAND } from "../lib/pi-registry-probe/snapshot.ts";
import { resultsTable } from "../lib/result-rows.ts";
import { expandTokens, projectTokens } from "../lib/run-tokens.ts";
import { modelCallsOf } from "../lib/scripted-model/script.ts";
import { readLogLengths, readLogLinesSince } from "../lib/turn-records.ts";

import type { SessionReport } from "../lib/pi-commands.ts";
import type { RpcRecord } from "../lib/pi-process.ts";
import type { ScenarioWorld } from "../support/world.ts";

// A scripted turn takes well under a second; the margin covers a loaded CI
// runner and stays below the 30-second step timeout, so a turn that never
// settles fails here with Pi's stderr.
const MODEL_TURN_TIMEOUT_MS = 20_000;

// An extension error or a dialog during a turn is never expected.
function isTurnFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" &&
      typeof record.method === "string" &&
      DIALOG_METHODS.has(record.method))
  );
}

// A session's payloads become the last results, as a command's do.
function keepSession(world: ScenarioWorld, report: SessionReport): void {
  world.recordResults(report.payloads, "session");
  world.skills = report.skills;
}

// startSession asserts that the session started; the setup keeps nothing on
// the world, and like a setup command it must report nothing but info.
Given("the user has started a new pi session", async function (this: ScenarioWorld) {
  const { payloads } = await startSession(this.pi);
  assert.deepStrictEqual(
    payloads.filter((payload) => payload.severity !== "info"),
    [],
  );
});

When("the user starts a new pi session", async function (this: ScenarioWorld) {
  keepSession(this, await startSession(this.pi));
});

When("the user starts a new pi session in another project", async function (this: ScenarioWorld) {
  keepSession(this, await this.startSessionInAnotherProject());
});

// D-PL8-02 / D-PL8-10: the results that follow a plain message are session
// results, so the world fails a scenario whose fields or rows go uncompared.
When("the user sends the message {string}", async function (this: ScenarioWorld, message: string) {
  this.recordResults(await sendMessage(this.pi, message), "session");
});

// HAR-03: Pi answers the prompt with its disposition before the turn runs.
// `handled` means no turn runs; otherwise the step waits for `agent_settled`,
// never for a fixed time, and keeps every record from the prompt on.
When("the user prompts {string}", async function (this: ScenarioWorld, text: string) {
  const prompt = expandTokens(text, this.tokens);
  const harness = this.profileHarness();
  const lengths = await readLogLengths(harness);
  const from = this.pi.recordCount();
  const { response } = await this.pi.request({ type: "prompt", message: prompt });
  const disposition = promptDisposition(response);
  if (disposition === undefined) {
    assert.fail(`Pi refused the prompt: ${JSON.stringify(response)}`);
  }

  if (disposition !== "handled") {
    const settled = await this.pi.waitForRecord(
      from,
      (record) => record.type === "agent_settled",
      MODEL_TURN_TIMEOUT_MS,
    );
    assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  }

  const records = this.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isTurnFault), []);
  const logs = await readLogLinesSince(harness, lengths);
  const overflow = modelCallsOf(logs).filter((call) => call.overflow);
  assert.deepStrictEqual(
    overflow.map((call) => `call ${call.index + 1}`),
    [],
    "the model was called past the end of its script",
  );
  this.recordTurn({ prompt, disposition, records, logs });
});

// HAR-04: the registry probe of the profile Pi reports every tool and slash
// command Pi offers. Pi runs the probe's command to completion before it
// answers, so its report is among the request's entries.
When("the user lists the slash commands pi offers", async function (this: ScenarioWorld) {
  this.profileHarness();
  const exchange = await this.pi.request({ type: "prompt", message: `/${REGISTRY_PROBE_COMMAND}` });
  assert.deepStrictEqual(
    {
      response: exchange.response.data,
      extensionErrors: exchange.extensionErrors,
      dialogs: exchange.dialogs,
    },
    { response: { disposition: "handled" }, extensionErrors: [], dialogs: [] },
  );
  this.registrySnapshot = readRegistrySnapshot(exchange.entries);
});

// D-PL8-02: an RPC session never arms the background update, so nothing
// follows its first message.
Then("the session reports no results", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.resultsOf("session"), []);
});

Then("the session offers these skills:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});

Then("the session offers no skills", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.sessionSkills(), []);
});

// Every slash command of the listing that Pi built from a prompt template, in
// Pi's order. An empty description cell is a command with no description.
Then(
  "pi offers these slash commands from prompt templates:",
  function (this: ScenarioWorld, table: DataTable) {
    const snapshot = this.registrySnapshot;
    if (snapshot === undefined) {
      assert.fail("no step listed the slash commands pi offers");
    }

    const rows = snapshot.commands
      .filter((command) => command.source === "prompt")
      .map((command) => [
        projectTokens("command", `/${command.name}`, this.tokens),
        projectTokens("description", command.description ?? "", this.tokens),
      ]);
    assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
  },
);

// D-02 for a new session: one row per payload, in session order. Pi reports a
// lasting reconcile failure twice, and both rows are stated.
Then("the session reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  assert.deepStrictEqual(resultsTable(stated, this.resultsOf("session"), this.tokens), table.raw());
  this.markNoticesCompared();
  this.markResultsCompared();
});
