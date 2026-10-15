/**
 * @fileoverview Steps that start a new Pi session and check the skills it offers.
 *
 * A result can claim an install that never reached disk. These steps look
 * where the user looks: the `/skill:` commands of the next session.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { startSession } from "../lib/pi-commands.ts";

import type { ScenarioWorld } from "../support/world.ts";

When("the user starts a new pi session", async function (this: ScenarioWorld) {
  this.skills = await startSession(this.pi);
});

Then("the session offers these skills:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});

Then("the session offers no skills", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.sessionSkills(), []);
});
