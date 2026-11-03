/**
 * @fileoverview Steps about a user's own choices for a plugin's MCP server
 * across the plugin verbs that rewrite its entry (D-08-01, D-08-02,
 * D-CF6-09).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { writeMcpAdapterOverride } from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The user's own edit of a plugin server's entry, under the key that
// pi-mcp-adapter shows for it, such as `plugin_demo_stub_`. The scenario
// observes the choice only through what pi-mcp-adapter does with it.
Given(
  "the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { disabled: true });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
