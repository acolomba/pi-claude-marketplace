/**
 * @fileoverview Steps about switching the MCP implementation that serves an
 * installed plugin's servers: a plugin record an earlier release wrote, before
 * records held the plugin's MCP servers (MREC-02).
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { dropRecordedMcpServers, recordedPlugin } from "../../lib/mcp-builtin-earlier-record.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the installation record of the plugin {string} in the {word} scope has no recorded mcp servers, as an earlier release wrote it",
  async function (this: ScenarioWorld, pluginId: string, scope: string) {
    const scopeRoot = this.scopeRoot(scope);
    await dropRecordedMcpServers(scopeRoot, pluginId);
    const record = await recordedPlugin(scopeRoot, pluginId);
    assert.deepStrictEqual(
      ["mcpServerConfigs", "mcpBundle"].filter((member) => Object.hasOwn(record, member)),
      [],
    );
  },
);
