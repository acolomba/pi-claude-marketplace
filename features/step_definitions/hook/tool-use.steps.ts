/**
 * @fileoverview Tool-use hook steps: the hooks' own MCP stub server, which a
 * hooked plugin holds so its hooks can watch a call that the model makes
 * through pi-mcp-adapter's `mcp` proxy, and the wait for the adapter's first
 * listing of that server (HOOK-08, D-CF5-12).
 *
 * The plugin's `.mcp.json` names one stdio server that runs the frozen MCP
 * stub with this process's Node, given the plugin and server names, so the
 * stub logs which server it is. When a session starts, pi-mcp-adapter lists
 * the tools of a server it has not cached and then disconnects, in the
 * background, so a scenario waits until that listing is over before it
 * prompts.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";

import { Given } from "@cucumber/cucumber";

import { MCP_STUB_SERVER, readStubRequests, stubPidFiles } from "../../lib/mcp-stub-server.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// A Node start and one listing take well under a second; the deadline leaves
// room for a loaded runner and stays inside the step timeout.
const HOOK_STUB_LISTING_DEADLINE_MS = 15_000;
const HOOK_STUB_LISTING_RECHECK_MS = 100;

const MCP_FILE = ".mcp.json";

// The `.mcp.json` of a plugin whose only server is the stub, started as the
// server `server` of the plugin `plugin`.
function hookStubMcpText(plugin: string, server: string): string {
  const launch = { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] };
  return `${JSON.stringify({ mcpServers: { [server]: launch } }, null, 2)}\n`;
}

// True once the stub logged the adapter's `tools/list` for that server and no
// stub process is left, which means the adapter closed the listing.
async function hookStubListingDone(
  harness: string,
  plugin: string,
  server: string,
): Promise<boolean> {
  const requests = await readStubRequests(harness);
  const listed = requests.some(
    ({ method, plugin: from, server: name }) =>
      method === "tools/list" && from === plugin && name === server,
  );
  return listed && (await stubPidFiles(harness)).length === 0;
}

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    const published = this.requirePublished(name);
    const text = hookStubMcpText(plugin, server);
    await writePublishedPluginFiles(published, plugin, { [MCP_FILE]: text });
    const written = path.join(published.root, "plugins", plugin, MCP_FILE);
    assert.strictEqual(await readFile(written, "utf8"), text);
  },
);

Given(
  "pi-mcp-adapter has listed the hooks' stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    const harness = this.profileHarness();
    const deadline = Date.now() + HOOK_STUB_LISTING_DEADLINE_MS;
    while (!(await hookStubListingDone(harness, plugin, server))) {
      assert.ok(
        Date.now() < deadline,
        `pi-mcp-adapter did not end its listing of ${plugin}/${server} within ${HOOK_STUB_LISTING_DEADLINE_MS} ms`,
      );
      await pause(HOOK_STUB_LISTING_RECHECK_MS);
    }
  },
);
