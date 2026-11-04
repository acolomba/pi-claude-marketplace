/**
 * @fileoverview Steps about the MCP implementation a profile Pi runs: the
 * restarts that switch it while the sandbox and the installed plugins stay
 * (DUAL-01).
 *
 * A restart stops the scenario's profile Pi and starts another, which the
 * world checks against the implementation its launch implies (DUAL-02). The
 * new Pi's first session becomes the last session results, as a new session
 * does, so the session steps read its skills and results.
 */

import { When } from "@cucumber/cucumber";

import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { SessionReport } from "../lib/pi-commands.ts";
import type { ScenarioWorld } from "../support/world.ts";

// A restarted Pi's first session is kept as a new session's is.
function keepSession(world: ScenarioWorld, report: SessionReport): void {
  world.recordResults(report.payloads, "session");
  world.skills = report.skills;
}

When(
  "the user restarts pi without pi-mcp-adapter",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    keepSession(this, await this.restartPi("without-adapter"));
  },
);
