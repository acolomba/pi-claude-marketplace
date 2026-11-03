/**
 * @fileoverview Steps about the agents of a plugin that call its MCP tools:
 * an agent whose `tools:` line grants a plugin MCP tool by its Claude Code
 * name, and an agent with no `tools:` line (MCP-07, D-CF6-07, D-CF6-10).
 *
 * Both write the agent through the MCP server fixture writer, never through
 * the agent fixtures, so the agent's file holds only what these steps name.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishMcpServerAgent } from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The `tools:` lines of the agent file at `file`, so a step can check that
// the file grants exactly what it names.
async function toolsLines(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  return text.split("\n").filter((line) => line.startsWith("tools:"));
}

// D-CF6-07: `tool` is a plugin MCP tool's Claude Code name, such as
// `mcp__plugin_demo_stub__echo`, which the agents bridge converts to an
// `mcp:` entry for pi-subagents.
Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} granted the mcp tool {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string, tool: string) {
    const file = await publishMcpServerAgent(this.requirePublished(name), plugin, agent, tool);
    assert.deepStrictEqual(await toolsLines(file), [`tools: ${tool}`]);
  },
);

// D-CF6-10: an agent with no `tools:` line gets pi-subagents' default tools.
Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} with no mcp tools",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const file = await publishMcpServerAgent(this.requirePublished(name), plugin, agent, undefined);
    assert.deepStrictEqual(await toolsLines(file), []);
  },
);
