/**
 * @fileoverview Steps about the user's ssh: the hosts it authenticates to, and
 * the launches a command makes of it.
 *
 * The ssh stand-in is first on every Pi's PATH, so git's ssh transport and
 * every ssh launch of the product reach it, and it serves the git host's
 * repositories to a registered host (SG-HRN-03). A registration that fails
 * throws, and the run's reset releases each host a scenario registers.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../support/world.ts";

Given(
  "the user's ssh authenticates to {string} as {string}",
  async function (this: ScenarioWorld, host: string, user: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "authenticated", user } });
  },
);

Then(
  "the user's ssh receives these launches:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = (await this.sshLaunchesOfLastCommand()).map((launch) => [launch.argv.join(" ")]);
    assert.deepStrictEqual([["argv"], ...rows], table.raw());
  },
);
