/**
 * @fileoverview Steps every workflow feature shares: the workflow commands a
 * new session offers, running a workflow command that starts no run, and the
 * notices the workflow engine shows for it.
 *
 * The workflow engine registers each bridged workflow as an extension command
 * named `<plugin>:<meta.name>`, beside its own commands, which hold no colon.
 * The listing steps read the registry probe's report, which the shared
 * listing `When` keeps on the world. A command the engine refuses shows its
 * notice before Pi answers, so the no-run `When` waits for nothing more. A
 * command that starts a run shows its start notice before Pi answers, and the
 * engine reports on handing back the result before the progress entry that
 * ends the run, so the run `When` holds every notice of the run too.
 *
 * The engine words its notices itself, and a release can reword them. So the
 * notices step reduces each one to the facts this extension owns: which
 * bridged command it is about, and whether that command started a run, was
 * refused, or is gone. It never compares the engine's sentence.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";
import { progressOf, sendWorkflowCommand } from "../../lib/workflow-files.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
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

// The run that the progress entry in `record` belongs to, or undefined for
// any other record.
function runIdOf(record: RpcRecord): string | undefined {
  const runId = progressOf(record)?.runId;
  return typeof runId === "string" ? runId : undefined;
}

// The command a workflow command line runs: its first word, without its
// slash, as the engine names it in its notices.
function commandOf(line: string): string {
  return (line.trim().split(/\s/u)[0] ?? "").replace(/^\//u, "");
}

// The facts this extension owns in one engine notice about `command`, or
// undefined for a notice that carries none. A notice that names the command
// and a run of the turn says the run started. One that names the command and
// no run says that the engine did not start it: an error notice refuses the
// script (D-CF7-04), and any other says the command is gone. A notice that
// names a run of the turn but not the command is the engine's report on
// handing the run's result back to the session, such as a deferred delivery.
// The run's outcome is read from its progress entries, so that report carries
// no fact of this extension's and is left out. Any other notice is shown
// whole, so a scenario fails on it.
function noticeFact(
  severity: string,
  message: string,
  command: string,
  runIds: readonly string[],
): string | undefined {
  const namesRun = runIds.some((runId) => message.includes(runId));
  const namesCommand = message
    .split(/[^\w:.-]+/u)
    .some((word) => word.replace(/[.:]+$/u, "") === command);
  if (!namesCommand) {
    return namesRun ? undefined : `${severity}: ${message}`;
  }

  if (namesRun) {
    return `started /${command}`;
  }

  return severity === "error" ? `refused /${command}` : `unavailable /${command}`;
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

// A table holds at least one row, so an empty listing has its own step.
Then("pi offers no workflow commands", async function (this: ScenarioWorld): Promise<void> {
  assert.deepStrictEqual(await workflowCommandRows(this), []);
});

// Every slash command of the last listing whose name holds the workflow's
// name, from any source: an engine command, a prompt template, a skill, or
// another extension's command. Without the engine, a workflow must reach Pi
// as none of them, so this step does not filter on the engine's path.
Then(
  "pi offers no slash command for the workflow {string}",
  function (this: ScenarioWorld, workflow: string): void {
    const snapshot = this.registrySnapshot;
    if (snapshot === undefined) {
      assert.fail("no step listed the slash commands pi offers");
    }

    const matching = snapshot.commands
      .filter((command) => command.name.includes(workflow))
      .map((command) => [command.source, `/${command.name}`, command.path]);
    assert.deepStrictEqual(matching, []);
  },
);

// The facts of every notice of the last workflow command, in Pi's order. The
// runs are the ones the turn's progress entries name.
Then(
  "the workflow engine shows these notices:",
  function (this: ScenarioWorld, table: DataTable): void {
    const { prompt, records } = this.requireTurn();
    const command = commandOf(prompt);
    const runIds = [...new Set(records.flatMap((record) => runIdOf(record) ?? []))];
    const rows = records
      .filter((record) => record.type === "extension_ui_request" && record.method === "notify")
      .flatMap(({ notifyType, message }) => {
        const fact = noticeFact(String(notifyType), String(message), command, runIds);
        return fact === undefined ? [] : [[projectTokens("notice", fact, this.tokens)]];
      });
    assert.deepStrictEqual([["notice"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
