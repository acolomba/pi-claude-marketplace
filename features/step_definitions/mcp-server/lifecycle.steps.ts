/**
 * @fileoverview Steps about a user's own choices for a plugin's MCP server
 * across the plugin verbs that rewrite its entry, including a request timeout
 * the user wrote (D-08-01, D-08-02, D-CF6-09, D-PG1-11).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import {
  writeMcpAdapterEntryWithoutRequestTimeout,
  writeMcpAdapterOverride,
} from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The user's own edit of a plugin server's entry, under the key that
// pi-mcp-adapter shows for it, such as `plugin_demo_stub_`. The scenario
// observes the disabled choice or request timeout through the adapter entry.
Given(
  "the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { disabled: true });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

Given(
  "the user has set the request timeout of the mcp server {string} to {int} ms in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, timeoutMs: number, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { requestTimeoutMs: timeoutMs });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

Given(
  "the mcp-adapter.json file of the {word} scope holds the entry {string} with no request timeout, as an earlier release wrote it",
  async function (this: ScenarioWorld, scope: string, key: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterEntryWithoutRequestTimeout(file, key);
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
