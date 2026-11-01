/**
 * @fileoverview Steps about what pi-mcp-adapter reports about a plugin's
 * servers: the status `/claude:plugin info` reads from its last report
 * (D-CF6-08), and what its `mcp` tool tells the model, such as a
 * project-scope server it blocks (D-CF6-03).
 *
 * pi-mcp-adapter writes an em dash in the reason it gives for a blocked
 * project server. A pre-commit fixer rewrites that character in every feature
 * file, so no scenario can state it: the calls step here reads each em dash
 * as `{em dash}` and otherwise compares the calls whole, as the model's calls
 * step does, with the run tokens projected.
 */

import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { callMessageRows, modelCallsOf } from "../../lib/scripted-model/script.ts";

import type { NotificationPayload } from "../../lib/pi-commands.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// pi-mcp-adapter reports its servers soon after a session starts, or after
// its first listing; the margin covers a loaded CI runner and stays below the
// step timeout.
const REPORT_TIMEOUT_MS = 15_000;
const REPORT_POLL_MS = 50;

// The status info shows for a server before pi-mcp-adapter's first report in
// the session (ASTAT-02).
const NO_REPORT_STATUS = "status unknown";

// Built from its code point, because the same fixer also rewrites this file.
const EM_DASH = String.fromCodePoint(0x2014);
const EM_DASH_TOKEN = "{em dash}";

// The status info shows for each mcp server of every plugin row it emitted.
function serverStatuses(payloads: readonly NotificationPayload[]): (string | undefined)[] {
  return payloads.flatMap((payload) =>
    payload.kind === "plugin-info" && payload.plugin.componentsResolved
      ? (payload.plugin.components.mcp ?? []).map((server) => server.status)
      : [],
  );
}

// D-CF6-08: info reads the last report pi-mcp-adapter sent in this session,
// so a scenario that compares a server's status waits until info shows one
// for every server of the plugin.
Given(
  "pi-mcp-adapter has reported the mcp servers of the plugin {string} of the {word} scope",
  async function (this: ScenarioWorld, plugin: string, scope: string) {
    const command = `/claude:plugin info ${plugin} --scope ${scope}`;
    const deadline = Date.now() + REPORT_TIMEOUT_MS;
    for (;;) {
      const payloads = await runCommandPayloads(this.pi, command);
      const statuses = serverStatuses(payloads);
      if (statuses.length > 0 && !statuses.includes(NO_REPORT_STATUS)) {
        return;
      }

      if (Date.now() > deadline) {
        assert.fail(`pi-mcp-adapter reported no status for ${plugin}: ${JSON.stringify(payloads)}`);
      }

      await delay(REPORT_POLL_MS);
    }
  },
);

// One row per message of every call of the last turn, system messages aside,
// in call order, with the run tokens projected and each em dash read as
// `{em dash}`.
Then("the model receives these mcp calls:", function (this: ScenarioWorld, table: DataTable) {
  const rows = callMessageRows(modelCallsOf(this.requireTurn().logs)).map(([call, role, text]) => [
    call,
    role,
    projectTokens("text", text, this.tokens).replaceAll(EM_DASH, EM_DASH_TOKEN),
  ]);
  assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
  this.markTurnCompared();
});
