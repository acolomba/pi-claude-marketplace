/**
 * @fileoverview Steps about the MCP implementation a profile Pi runs: turning
 * Pi's built-in MCP off in the user's settings, and the restarts that switch
 * the implementation while the sandbox and the installed plugins stay
 * (DUAL-01).
 *
 * A restart stops the scenario's profile Pi and starts another, which the
 * world checks against the implementation its launch implies (DUAL-02). The
 * new Pi's first session becomes the last session results, as a new session
 * does, so the session steps read its skills and results.
 */

import { Given, When } from "@cucumber/cucumber";

import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { PiRestart, ScenarioWorld } from "../support/world.ts";

// A restarted Pi's first session is kept as a new session's is.
async function restart(world: ScenarioWorld, change: PiRestart): Promise<void> {
  const report = await world.restartPi(change);
  world.recordResults(report.payloads, "session");
  world.skills = report.skills;
}

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
