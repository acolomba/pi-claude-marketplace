/**
 * @fileoverview Steps about the plugin options Pi's built-in MCP holds for a
 * plugin server: a hand edit that leaves a record's options unreadable, and
 * the whole config of each server, command and arguments included, as Pi's
 * registry holds it (PG-CORE-03, D-PG10-12, D-PG10-25).
 *
 * A plugin option can fill a server's command and arguments, so a server
 * whose command names no run path shows them in full.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { readPluginRecord, rewritePluginRecord } from "../../lib/installation-record.ts";
import { lastRegisteredConfigs } from "../../lib/mcp-builtin-config-probe/snapshot.ts";
import { projectTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// D-PG10-25: a hand edit leaves the record's `userConfig` a string, which the
// manifest parser refuses.
Given(
  "the installation record of the plugin {string} in the {word} scope holds plugin options that do not parse",
  async function (this: ScenarioWorld, pluginId: string, scope: string) {
    const scopeRoot = this.scopeRoot(scope);
    await rewritePluginRecord(scopeRoot, pluginId, (record) => ({
      ...record,
      userConfig: "token=secret",
    }));
    const record = await readPluginRecord(scopeRoot, pluginId);
    assert.strictEqual(record.userConfig, "token=secret");
  },
);

// The whole list of MCP servers that extensions registered with Pi, in Pi's
// order, each with its whole config as JSON and run tokens projected, from
// the probe report the `When` asked for.
Then("pi holds these whole mcp server configs:", function (this: ScenarioWorld, table: DataTable) {
  const rows = lastRegisteredConfigs(this.pi.recordsSince(0)).map(({ name, config }) => [
    name,
    projectTokens("config", JSON.stringify(config), this.tokens),
  ]);
  assert.deepStrictEqual([["name", "config"], ...rows], table.raw());
});
