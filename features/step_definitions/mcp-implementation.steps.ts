/**
 * @fileoverview Steps about the MCP implementation a profile Pi runs: the
 * profile Pi that runs the profile's implementation, the built-in stand-in
 * that serves a stub server to Pi's built-in MCP, the wait for the first
 * listing of a stub's tools, turning Pi's built-in MCP off in the user's
 * settings, the restarts that switch the implementation while the sandbox and
 * the installed plugins stay, and the MCP servers extensions registered with
 * Pi (DUAL-01).
 *
 * A scenario that uses these steps runs under both profiles without naming
 * an implementation. A restart stops the scenario's profile Pi and starts
 * another, which the world checks against the implementation its launch
 * implies (DUAL-02). The new Pi's first session becomes the last session
 * results, as a new session does, so the session steps read its skills and
 * results.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { readStandInServers, writeStandInServers } from "../lib/builtin-mcp-stand-in/servers.ts";
import { mcpImplementationLaunch, waitForStubListing } from "../lib/mcp-implementation.ts";
import { expandTokens } from "../lib/run-tokens.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { PiRestart, ScenarioWorld } from "../support/world.ts";

// A restarted Pi's first session is kept as a new session's is.
async function restart(world: ScenarioWorld, change: PiRestart): Promise<void> {
  const report = await world.restartPi(change);
  world.recordResults(report.payloads, "session");
  world.skills = report.skills;
}

// P1-DC-05: the stand-in reads its list when the profile Pi's session
// starts, so this precedes the profile Pi. Under the adapter profile no
// stand-in loads, and the list it writes has no effect.
Given(
  "a stand-in registers the stub mcp server {string} of the plugin {string} with pi's built-in mcp",
  async function (this: ScenarioWorld, server: string, plugin: string) {
    assert.ok(!this.profilePiStarted, "a profile Pi already started in this scenario");
    const { home } = this.tokens;
    const servers = [...(await readStandInServers(home)), { plugin, server }];
    const file = await writeStandInServers(home, servers);
    this.onRelease(() => rm(file, { force: true }));
    assert.deepStrictEqual(await readStandInServers(home), servers);
  },
);

Given(
  "pi runs with the scripted model and the mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile(mcpImplementationLaunch(this.mcpProfile));
  },
);

// The plugin is the argument the stub logs, with run tokens expanded, as in
// pi-mcp-adapter's listing wait.
Given(
  "the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}",
  async function (this: ScenarioWorld, server: string, pluginText: string) {
    const plugin = expandTokens(pluginText, this.tokens);
    await waitForStubListing(this.mcpProfile, this.pi, this.profileHarness(), plugin, server);
  },
);

// Pi reads its settings when it starts, so this precedes the profile Pi.
Given("the user's pi settings turn off pi's built-in mcp", async function (this: ScenarioWorld) {
  await this.turnOffBuiltinMcpBeforeStart();
});

When(
  "the user restarts pi without pi-mcp-adapter",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await restart(this, "without-adapter");
  },
);

When(
  "the user restarts pi with pi-mcp-adapter",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await restart(this, "with-adapter");
  },
);

// P1-DC-08: the harness edits the settings as the user would; D-MB-01 binds
// the extension, not the user.
When(
  "the user restarts pi with pi's built-in mcp turned on",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await restart(this, "builtin-on");
  },
);

When(
  "the user restarts pi with no mcp",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await restart(this, "no-mcp");
  },
);

// D-MB-02: the whole list of the MCP servers that extensions registered with
// Pi, by name in Pi's order, as the last registry probe report holds it.
Then("pi lists these registered mcp servers:", function (this: ScenarioWorld, table: DataTable) {
  const snapshot = this.registrySnapshot;
  if (snapshot === undefined) {
    assert.fail("no step listed the mcp tools pi offers");
  }

  const rows = snapshot.mcpServers.map(({ name }) => [name]);
  assert.deepStrictEqual([["name"], ...rows], table.raw());
});
