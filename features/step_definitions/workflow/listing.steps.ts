/**
 * @fileoverview Steps every workflow feature shares: the workflow commands a
 * new session offers.
 *
 * The workflow engine registers each bridged workflow as an extension command
 * named `<plugin>:<meta.name>`, beside its own commands, which hold no colon.
 * The listing steps read the registry probe's report, which the shared
 * listing `When` keeps on the world.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";
import { projectTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// One `command | description` row per bridged workflow command of the last
// listing, in Pi's order. A command with no description has an empty cell.
async function workflowCommandRows(world: ScenarioWorld): Promise<string[][]> {
  const { entry } = await resolveCompanion("pi-dynamic-workflows");
  const snapshot = world.registrySnapshot;
  if (snapshot === undefined) {
    assert.fail("no step listed the slash commands pi offers");
  }

  const bridged = snapshot.commands.filter(
    (command) =>
      command.source === "extension" && command.path === entry && command.name.includes(":"),
  );
  return bridged.map(({ name, description }) => [
    projectTokens("command", `/${name}`, world.tokens),
    projectTokens("description", description ?? "", world.tokens),
  ]);
}

Then(
  "pi offers these workflow commands:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = await workflowCommandRows(this);
    assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
  },
);
