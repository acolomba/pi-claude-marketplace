/**
 * @fileoverview Steps about the state plugin info shows for a plugin's MCP
 * servers under Pi's built-in MCP: a server the user's own Pi `mcp.json`
 * configures under the plugin server's name (BLT-04, BLT-05).
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { MCP_STUB_SERVER } from "../../lib/mcp-stub-server.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi reads the user's `mcp.json` when its session starts, so this precedes
// the profile Pi. The configured server runs the stub as the plugin's server,
// so only its name in `mcp.json` tells the two apart.
Given(
  "the user's pi mcp.json configures the stub mcp server {string} of the plugin {string} under the name {string}",
  async function (this: ScenarioWorld, server: string, plugin: string, name: string) {
    const file = path.join(this.tokens.agentDir, "mcp.json");
    const text = `${JSON.stringify(
      {
        mcpServers: {
          [name]: { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] },
        },
      },
      null,
      2,
    )}\n`;
    await writeFile(file, text, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
