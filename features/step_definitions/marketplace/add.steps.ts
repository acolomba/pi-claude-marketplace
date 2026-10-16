/**
 * @fileoverview Steps that only `marketplace add` uses: sources that are
 * broken or missing before the user adds them, and a second marketplace that
 * declares a name already published.
 *
 * Each step text names add, so no other verb module defines the same text
 * (D-08 in `.agents/skills/cucumber/rules/layout.md`).
 */

import assert from "node:assert/strict";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import {
  invalidateManifest,
  publishMarketplaceIn,
  requireFreeRoot,
} from "../../lib/published-marketplace.ts";

import type { ManifestProblem } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

async function breakManifest(
  world: ScenarioWorld,
  name: string,
  problem: ManifestProblem,
): Promise<void> {
  await invalidateManifest(name, world.requirePublished(name), problem);
}

// Two literal texts rather than one with a parameter: a misspelled problem in
// a row the default profile excludes is then an undefined step, which the
// feature gate rejects (ADD-07).
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

// Every row of the duplicate-name Outline runs this step, so the rows that add
// the first marketplace again also publish this one, and never add it (ADD-04).
Given(
  "a second marketplace declaring the name {string} can be added from {string}",
  async function (this: ScenarioWorld, name: string, location: string) {
    const { kind } = this.requirePublished(name);
    const root = await requireFreeRoot(this.marketplacesRoot, location, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    // Not recorded: the world keys marketplaces by name, so it would replace the first.
    await publishMarketplaceIn(this.marketplacesRoot, location, name, kind, []);
  },
);

Given(
  "the directory {string} to add does not exist",
  async function (this: ScenarioWorld, directory: string) {
    await assert.rejects(stat(path.join(this.marketplacesRoot, directory)), { code: "ENOENT" });
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
