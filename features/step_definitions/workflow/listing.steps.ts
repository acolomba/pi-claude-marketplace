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
 * engine reports a delivery problem before the progress entry that ends the
 * run, so the run `When` holds every notice of the run too.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";
import { progressOf, sendWorkflowCommand } from "../../lib/workflow-files.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
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

// The run that the progress entry in `record` belongs to, or undefined for
// any other record.
function runIdOf(record: RpcRecord): string | undefined {
  const runId = progressOf(record)?.runId;
  return typeof runId === "string" ? runId : undefined;
}

// `message` with each of `runIds` shown as `{run id}` and `sessionId` shown
// as `{session id}`.
function namedAsTokens(message: string, runIds: readonly string[], sessionId: string): string {
  return runIds.reduce(
    (text, runId) => text.replaceAll(runId, "{run id}"),
    message.replaceAll(sessionId, "{session id}"),
  );
}

// The id of Pi's current session, as its RPC state reports it.
async function currentSessionId(world: ScenarioWorld): Promise<string> {
  const { response } = await world.pi.request({ type: "get_state" });
  const { data } = response;
  const sessionId =
    typeof data === "object" && data !== null && "sessionId" in data ? data.sessionId : undefined;
  if (typeof sessionId !== "string" || sessionId === "") {
    assert.fail(`pi reported no session id: ${JSON.stringify(response)}`);
  }

  return sessionId;
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

// Every slash command of the last listing whose name holds `text`, from any
// source: an engine command, a prompt template, a skill, or another
// extension's command. Without the engine, a workflow must reach Pi as none
// of them, so this step does not filter on the engine's path.
Then(
  "pi offers no slash command whose name contains {string}",
  function (this: ScenarioWorld, text: string): void {
    const snapshot = this.registrySnapshot;
    if (snapshot === undefined) {
      assert.fail("no step listed the slash commands pi offers");
    }

    const matching = snapshot.commands
      .filter((command) => command.name.includes(text))
      .map((command) => [command.source, `/${command.name}`, command.path]);
    assert.deepStrictEqual(matching, []);
  },
);

// Every notice of the last workflow command, in Pi's order. The engine names
// the run a command started and Pi's session in its notices, and both change
// every run, so the step shows them as `{run id}` and `{session id}`. The run
// is the one the turn's progress entries name, and the session is the one
// Pi's RPC state reports, so a notice that names another run or session
// fails.
Then(
  "the workflow engine shows these notices:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const { records } = this.requireTurn();
    const runIds = [...new Set(records.flatMap((record) => runIdOf(record) ?? []))];
    const sessionId = await currentSessionId(this);
    const notices = records.filter(
      (record) => record.type === "extension_ui_request" && record.method === "notify",
    );
    const rows = notices.map(({ notifyType, message }) => [
      String(notifyType),
      projectTokens(
        "message",
        namedAsTokens(String(message), runIds, sessionId).replaceAll(EM_DASH, "--"),
        this.tokens,
      ),
    ]);
    assert.deepStrictEqual([["severity", "message"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
