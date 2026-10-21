/**
 * @fileoverview Steps about the https git host that serves git marketplace
 * sources: arming one repository to fail, and the requests the host receives.
 * Only the feature files of the git source kinds use them.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { armedStatus } from "../../lib/https-git-host/server.ts";

import type { ScenarioWorld } from "../../support/world.ts";

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

Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method,
    request.path,
    String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});
