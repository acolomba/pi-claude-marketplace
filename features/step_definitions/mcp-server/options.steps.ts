/**
 * @fileoverview Steps about a plugin MCP server whose fields name the
 * plugin's options: a stub server whose tool name is an argument the
 * scenario writes (PG-CORE-03, D-PG10-11).
 *
 * The stub lists one tool named by its fourth argument, so an option that
 * reaches that argument shows in the tool the model can call.
 */

import { Given } from "@cucumber/cucumber";

import { publishStubServersFile, withStubServers } from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The stub's own entry from its marker, with `toolArgument` after the
// plugin and server arguments.
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} whose tool name argument is {string}",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    server: string,
    toolArgument: string,
  ) {
    const document = withStubServers(plugin, { mcpServers: { [server]: { stub: {} } } }) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    const entry = document.mcpServers[server];
    if (entry === undefined) {
      throw new Error(`the stub marker of "${server}" wrote no server`);
    }

    entry.args.push(toolArgument);
    await publishStubServersFile(
      this.requirePublished(name),
      plugin,
      ".mcp.json",
      JSON.stringify(document),
    );
  },
);
