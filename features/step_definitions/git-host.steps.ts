/**
 * @fileoverview Steps about the https git host that serves git marketplace
 * sources: arming one repository to fail or to require a credential, the
 * credential a user stores for the host, and the requests the host receives.
 * Only the feature files of the git source kinds use them.
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { armedStatus } from "../lib/https-git-host/server.ts";

import type { ScenarioWorld } from "../support/world.ts";

/** Returns the repository the git host serves the marketplace `name` from. */
function publishedRepository(world: ScenarioWorld, name: string): string {
  const published = world.requirePublished(name);
  if (published.kind === "url" || published.kind === "github") {
    return published.repository;
  }

  assert.fail(`the marketplace ${name} is not published as a git source`);
}

Given(
  "the git host answers {int} for the marketplace {string}",
  async function (this: ScenarioWorld, status: number, name: string): Promise<void> {
    await this.gitHost.arm(publishedRepository(this, name), {
      kind: "status",
      status: armedStatus(status),
    });
  },
);

Given(
  "the git host drops the connection for the marketplace {string}",
  async function (this: ScenarioWorld, name: string): Promise<void> {
    await this.gitHost.arm(publishedRepository(this, name), { kind: "drop" });
  },
);

Given(
  "the git host requires the user {string} with the password {string} for the marketplace {string}",
  async function (
    this: ScenarioWorld,
    user: string,
    password: string,
    name: string,
  ): Promise<void> {
    await this.gitHost.arm(publishedRepository(this, name), { kind: "credential", user, password });
  },
);

// The credential lives only in the sandbox HOME, which Pi's git reads through
// its global config (DRV-03); no git process runs to store it.
Given(
  "the user has stored a credential for the git host with the user {string} and the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const config = path.join(this.tokens.home, ".gitconfig");
    const credentials = path.join(this.tokens.home, ".git-credentials");
    const configText = "[credential]\n\thelper = store\n";
    const credentialsText = `https://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${this.gitHost.address}\n`;
    await writeFile(config, configText, { flag: "wx" });
    this.onRelease(() => rm(config, { force: true }));
    await writeFile(credentials, credentialsText, { flag: "wx", mode: 0o600 });
    this.onRelease(() => rm(credentials, { force: true }));
    assert.deepStrictEqual(
      [await readFile(config, "utf8"), await readFile(credentials, "utf8")],
      [configText, credentialsText],
    );
  },
);

Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method,
    request.path,
    String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});

// A request over a kept-alive socket shows only in the requests, and a non-TLS
// attempt that never becomes a request shows only in the connection count, so
// the step asserts both.
Then("the git host receives no request", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.requestsOfLastCommand(), { requests: [], connections: 0 });
});
