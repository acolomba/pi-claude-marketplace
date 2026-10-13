/**
 * @fileoverview Steps that start a new Pi session and check the skills it offers.
 *
 * A result can claim an install that never reached disk. These steps look
 * where the user looks: the `/skill:` commands of the next session.
 */

import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import { startSession } from "../lib/pi-commands.ts";

import type { PluginWorld } from "../lib/world.ts";
import type { DataTable } from "@cucumber/cucumber";

async function newSession(this: PluginWorld): Promise<void> {
  this.skills = await startSession(this.pi);
}

When("the user starts a new pi session", newSession);

function assertOfferedSkills(this: PluginWorld, table: DataTable): void {
  assert.deepStrictEqual(this.sessionSkills(), table.hashes());
}

Then("the session offers these skills:", assertOfferedSkills);

function assertNoSkills(this: PluginWorld): void {
  assert.deepStrictEqual(this.sessionSkills(), []);
}

Then("the session offers no skills", assertNoSkills);
