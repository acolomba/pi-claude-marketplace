/**
 * @fileoverview Steps about the MCP tool grants of a plugin's agents: an
 * agent whose `tools:` line grants a plugin MCP tool by its Claude Code name,
 * and an agent with no `tools:` line (MCP-07, D-CF6-07, D-CF6-10, MGRT-01).
 *
 * Both write the agent through the MCP server fixture writer, never through
 * the agent fixtures, so the agent's file holds only what these steps name.
 *
 * MGRT-01: a profile Pi with pi-subagents and the profile's MCP launch shows
 * the grant form of the active implementation in what pi-subagents reports.
 * An agents index rewritten as a release before MGRT-01 wrote it plays an
 * agent that release installed.
 *
 * MGRT-02 / D-MB-12: a profile Pi started with pi-subagents' child marker,
 * `PI_SUBAGENT_CHILD=1`, plays a pi-subagents background child. pi-subagents
 * 0.84.0 sets the marker in its runner process before any child session
 * starts, and every ambient extension loads into those sessions.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import {
  holdsAgentGrantForms,
  readAgentIndexRows,
  stripAgentGrantForms,
} from "../../lib/mcp-agent-earlier-index.ts";
import { mcpImplementationLaunch } from "../../lib/mcp-implementation.ts";
import { publishMcpServerAgent } from "../../lib/mcp-server-files.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

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

// MGRT-01: pi-subagents with the MCP launch of the profile: pi-mcp-adapter
// under the adapter profile, the built-in stand-in under the builtin profile.
Given(
  "pi runs with the scripted model, pi-subagents, and the mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const launch = mcpImplementationLaunch(this.mcpProfile);
    await this.usePiWithProfile({
      companions: ["pi-subagents", ...launch.companions],
      extraExtensions: launch.extraExtensions,
    });
  },
);

// MGRT-01 / P4-DC-06: a release before MGRT-01 recorded no grant form on an
// agent's row, and its agent files hold pi-mcp-adapter's form. The step checks
// what the index holds afterwards, not how many rows changed, so it passes
// where the rows already hold no forms.
Given(
  "the agents index of the user scope holds the rows an earlier release wrote",
  async function (this: ScenarioWorld) {
    const file = path.join(this.scopeRoot("user"), "pi-claude-marketplace", "agents-index.json");
    await stripAgentGrantForms(file);
    const rows = await readAgentIndexRows(file);
    assert.notStrictEqual(rows.length, 0, `${file} holds no agent`);
    assert.deepStrictEqual(rows.filter(holdsAgentGrantForms), []);
  },
);

// MGRT-02: the launch-environment extension sets the marker in the profile
// Pi's own environment before any session starts, as pi-subagents' runner
// does, and this extension reads it at session start, after every extension
// loaded. This Pi is not a whole child: the world loads companions before
// `extraExtensions`, so pi-subagents' factory runs before the marker is set
// and registers its tools, which pi-subagents 0.84.0 skips in a real child
// (`src/extension/index.js:225`). So no scenario calls `subagent` in this Pi.
// Once it started, the step empties the launch environment, which the
// extension reads at every start, so a restart starts a Pi that is not a
// child, as the user's next Pi outside pi-subagents is.
Given(
  "pi runs with the scripted model and pi-subagents as a pi-subagents background child",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const { home } = this.tokens;
    const file = await writeLaunchEnvironment(home, { PI_SUBAGENT_CHILD: "1" });
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({
      companions: ["pi-subagents"],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.deepStrictEqual(await readAppliedLaunchEnvironments(this.profileHarness()), [
      { PI_SUBAGENT_CHILD: "1" },
    ]);
    await rm(file);
    assert.strictEqual(await writeLaunchEnvironment(home, {}), file);
  },
);
