/**
 * @fileoverview Steps that only `marketplace add` uses: sources that are
 * broken or missing before the user adds them.
 *
 * Each step text names add, so no other verb module defines the same text
 * (D-08 of the suite foundation).
 */

import assert from "node:assert/strict";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { invalidateManifest } from "../../lib/published-marketplace.ts";

import type { ManifestProblem } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

async function breakManifest(
  world: ScenarioWorld,
  name: string,
  problem: ManifestProblem,
): Promise<void> {
  const published = world.publishedMarketplace(name);
  if (published === undefined) {
    assert.fail(`the marketplace ${name} is not published in this scenario`);
  }

  await invalidateManifest(world.marketplacesRoot, name, published, problem);
}

// Two literal texts rather than one with a parameter: a misspelled problem in
// a row the default profile excludes is then an undefined step, which the
// feature gate rejects (D-04).
Given(
  "the manifest of the marketplace {string} to add is not valid json",
  async function (this: ScenarioWorld, name: string) {
    await breakManifest(this, name, "malformed");
  },
);

Given(
  "the manifest of the marketplace {string} to add breaks the manifest schema",
  async function (this: ScenarioWorld, name: string) {
    await breakManifest(this, name, "schema-invalid");
  },
);

Given(
  "the directory {string} to add holds no marketplace manifest",
  async function (this: ScenarioWorld, name: string) {
    const directory = path.join(this.marketplacesRoot, name);
    this.onRelease(() => rm(directory, { recursive: true, force: true }));
    await mkdir(directory, { recursive: true });
    await assert.rejects(stat(path.join(directory, ".claude-plugin", "marketplace.json")), {
      code: "ENOENT",
    });
  },
);
