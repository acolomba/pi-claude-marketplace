/**
 * @fileoverview Steps about the npm registry stand-in that plugin package
 * installs reach: the packages it serves, arming one package to fail, and the
 * requests it receives. The first step that serves a package starts the
 * scenario's registry and points the sandbox npm config at it.
 */

import assert from "node:assert/strict";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { npmRequestTable, readNpmPackages } from "../lib/npm-registry.ts";

import type { ScenarioWorld } from "../support/world.ts";

Given(
  "the npm registry serves these packages:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const registry = await this.useNpmRegistry();
    const packages = readNpmPackages(table);
    const served = packages.map((pkg) => registry.serve(pkg).path);
    assert.deepStrictEqual(
      served,
      packages.map((pkg) => `/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`),
    );
  },
);

Given(
  "the npm registry answers {int} for the package {string}",
  function (this: ScenarioWorld, status: number, name: string): void {
    this.requireNpmRegistry().arm(name, status);
  },
);

Then("the npm registry receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  assert.deepStrictEqual(npmRequestTable(this.npmRequestsOfLastCommand()), table.raw());
});

Then("the npm registry receives no request", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.npmRequestsOfLastCommand(), []);
});
