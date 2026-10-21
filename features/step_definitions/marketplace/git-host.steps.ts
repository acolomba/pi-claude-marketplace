/**
 * @fileoverview Steps about the https git host that serves git marketplace
 * sources: the requests it receives. Only the feature files of the git source
 * kinds use them.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method,
    request.path,
    String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});
