/**
 * @fileoverview Steps about the plugin options Pi's built-in MCP holds for a
 * plugin server: the whole config of each server, command and arguments
 * included, as Pi's registry holds it (PG-CORE-03, D-PG10-12).
 *
 * A plugin option can fill a server's command and arguments, so a server
 * whose command names no run path shows them in full.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { lastRegisteredConfigs } from "../../lib/mcp-builtin-config-probe/snapshot.ts";
import { projectTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

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
