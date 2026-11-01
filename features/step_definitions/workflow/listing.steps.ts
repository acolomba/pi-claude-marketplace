/**
 * @fileoverview Steps every workflow feature shares: the workflow commands a
 * new session offers, running a workflow command that starts no run, and the
 * notices the workflow engine shows for it.
 *
 * The workflow engine registers each bridged workflow as an extension command
 * named `<plugin>:<meta.name>`, beside its own commands, which hold no colon.
 * The listing steps read the registry probe's report, which the shared
 * listing `When` keeps on the world. A command the engine refuses shows its
 * notice before Pi answers, so the no-run `When` waits for nothing more.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";
import { progressOf, sendWorkflowCommand } from "../../lib/workflow-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The commit hook's `fix-unicode-dashes` rewrites this character to `--` in
// every committed `.feature` and `.ts` file, so no literal can hold it; the
// notices step projects Pi's text the same way.
const EM_DASH = "\u2014";

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

// A run appends its first progress entry before Pi answers the command, so a
// command that left none by Pi's answer started no run.
When(
  "the user runs the workflow command {string}, which starts no run",
  async function (this: ScenarioWorld, text: string): Promise<void> {
    const turn = await sendWorkflowCommand(
      this.pi,
      this.profileHarness(),
      expandTokens(text, this.tokens),
      () => Promise.resolve(),
    );
    const progress = turn.records.flatMap((record) => progressOf(record) ?? []);
    assert.deepStrictEqual(progress, [], "the workflow command started a run");
    this.recordTurn(turn);
  },
);

Then(
  "pi offers these workflow commands:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = await workflowCommandRows(this);
    assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
  },
);

// Every notice of the last workflow command, in Pi's order.
Then("the workflow engine shows these notices:", function (this: ScenarioWorld, table: DataTable) {
  const notices = this.requireTurn().records.filter(
    (record) => record.type === "extension_ui_request" && record.method === "notify",
  );
  const rows = notices.map(({ notifyType, message }) => [
    String(notifyType),
    projectTokens("message", String(message).replaceAll(EM_DASH, "--"), this.tokens),
  ]);
  assert.deepStrictEqual([["severity", "message"], ...rows], table.raw());
  this.markTurnCompared();
});
