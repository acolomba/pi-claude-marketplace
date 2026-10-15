/**
 * @fileoverview Steps that start a new Pi session and check the skills it offers.
 *
 * A result can claim an install that never reached disk. These steps look
 * where the user looks: the `/skill:` commands of the next session.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { startSession } from "../lib/pi-commands.ts";

import type { PluginWorld } from "../support/world.ts";

When("the user starts a new pi session", async function (this: PluginWorld) {
  this.skills = await startSession(this.pi);
});

Then("the session offers these skills:", function (this: PluginWorld, table: DataTable) {
  assert.deepStrictEqual(this.sessionSkills(), table.hashes());
});

Then("the session offers no skills", function (this: PluginWorld) {
  assert.deepStrictEqual(this.sessionSkills(), []);
});
