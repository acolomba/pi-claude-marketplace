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

// SG-SSH-02: the probe authenticates, but every repository the user's ssh
// asks for is one GitHub says it cannot find.
Given(
  "the user's ssh authenticates to {string} as {string} without access to its repositories",
  async function (this: ScenarioWorld, host: string, user: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "no-repository", user } });
  },
);

// SG-SSH-02: the probe's three answers that are not an authentication: GitHub
// refuses every key, the host key is not known, and no answer comes before
// the probe's time limit.
Given(
  "the user's ssh is denied for {string}",
  async function (this: ScenarioWorld, host: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "denied" } });
  },
);

Given(
  "the user's ssh does not know the host key for {string}",
  async function (this: ScenarioWorld, host: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "host-key" } });
  },
);

// D-SG-18: the user's ssh config sends the host through a proxy, the line
// `ssh -G` prints, such as `proxycommand nc %h %p`. GitHub refuses every key,
// so only that line keeps a github plugin install on ssh.
Given(
  "the user's ssh is denied for {string} and its config names the proxy {string}",
  async function (this: ScenarioWorld, host: string, proxy: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "denied" }, proxy });
  },
);

Given(
  "the user's ssh never answers for {string}",
  async function (this: ScenarioWorld, host: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "hold" } });
  },
);

Then(
  "the user's ssh receives these launches:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = (await this.sshLaunchesOfLastCommand()).map((launch) => [launch.argv.join(" ")]);
    assert.deepStrictEqual([["argv"], ...rows], table.raw());
  },
);

Then("the user's ssh receives no launch", async function (this: ScenarioWorld): Promise<void> {
  assert.deepStrictEqual(await this.sshLaunchesOfLastCommand(), []);
});
