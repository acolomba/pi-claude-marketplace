/**
 * @fileoverview Steps about switching the MCP implementation that serves an
 * installed plugin's servers. They cover a plugin record that an earlier
 * release wrote, before records held the plugin's MCP servers (MREC-02); the
 * wait for the implementation that a restart brought in to list a stub
 * server's tools (MSEL-02, MSEL-04); and the extension errors that Pi
 * reported since it started, which include a registration that no
 * implementation serves (MSEL-03).
 */

import assert from "node:assert/strict";

import { Given, Then } from "@cucumber/cucumber";

import { readPluginRecord } from "../../lib/installation-record.ts";
import { dropRecordedMcpServers } from "../../lib/mcp-builtin-earlier-record.ts";
import { waitForStubListing } from "../../lib/mcp-implementation.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { McpProfile } from "../../lib/mcp-implementation.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// After a restart the implementation differs from the profile's, so the step
// names the one it waits for. The plugin is the argument the stub logs, with
// run tokens expanded, as in the profile's own listing wait.
async function waitForListingAfterRestart(
  world: ScenarioWorld,
  implementation: McpProfile,
  server: string,
  pluginText: string,
): Promise<void> {
  const plugin = expandTokens(pluginText, world.tokens);
  await waitForStubListing(implementation, world.pi, world.profileHarness(), plugin, server);
}

Given(
  "the installation record of the plugin {string} in the {word} scope has no recorded mcp servers, as an earlier release wrote it",
  async function (this: ScenarioWorld, pluginId: string, scope: string) {
    const scopeRoot = this.scopeRoot(scope);
    await dropRecordedMcpServers(scopeRoot, pluginId);
    const record = await readPluginRecord(scopeRoot, pluginId);
    assert.deepStrictEqual(
      ["mcpServerConfigs", "mcpBundle"].filter((member) => Object.hasOwn(record, member)),
      [],
    );
  },
);

Then(
  "pi-mcp-adapter lists the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    await waitForListingAfterRestart(this, "adapter", server, plugin);
  },
);

Then(
  "pi's built-in mcp lists the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    await waitForListingAfterRestart(this, "builtin", server, plugin);
  },
);

// Pi's RPC mode prints each extension error, among them the one it raises at
// startup for an MCP server registration that no extension serves, as a
// record of type `extension_error`. A restarted Pi is a new process, so its
// records start at its own start. The message shows every error Pi reported.
Then("pi reports no extension error", function (this: ScenarioWorld) {
  const errors = this.pi.recordsSince(0).filter((record) => record.type === "extension_error");
  assert.deepStrictEqual(errors, []);
});
