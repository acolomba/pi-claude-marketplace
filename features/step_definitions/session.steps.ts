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
 * the user scope alone offers.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { startSession } from "../lib/pi-commands.ts";
import { resultsTable } from "../lib/result-rows.ts";

import type { SessionReport } from "../lib/pi-commands.ts";
import type { ScenarioWorld } from "../support/world.ts";

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

Then("the session offers these skills:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});

Then("the session offers no skills", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.sessionSkills(), []);
});

// D-02 for a new session: one row per payload, in session order. Pi reports a
// lasting reconcile failure twice, and both rows are stated.
Then("the session reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  assert.deepStrictEqual(resultsTable(stated, this.resultsOf("session"), this.tokens), table.raw());
  this.markNoticesCompared();
  this.markResultsCompared();
});
