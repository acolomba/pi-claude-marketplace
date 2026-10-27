/**
 * @fileoverview Steps that only `marketplace add` uses: sources that are
 * broken or missing before the user adds them, and a second marketplace that
 * declares a name already published.
 *
 * Each step text names add, so no other verb module defines the same text
 * (D-08 in `.agents/skills/cucumber/rules/layout.md`).
 */

import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import {
  invalidateManifest,
  makeManifestUnreadable,
  publishMarketplaceIn,
  requireFreeRoot,
} from "../../lib/published-marketplace.ts";

import type { ManifestProblem, PublishedMarketplace } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

async function breakManifest(
  world: ScenarioWorld,
  name: string,
  problem: ManifestProblem,
): Promise<void> {
  await invalidateManifest(name, world.requirePublished(name), problem);
}

// A local publication's manifest is read where it is published; a git one's
// is read from the clone, which this cannot reach.
async function replaceManifestWithDirectory(published: PublishedMarketplace): Promise<void> {
  if (published.kind !== "dir" && published.kind !== "file") {
    throw new Error(`a ${published.kind} marketplace's manifest cannot be made a directory`);
  }

  await rm(published.manifestPath);
  await mkdir(published.manifestPath);
  await writeFile(path.join(published.manifestPath, "marketplace.json"), "{}\n");
}

// One literal text per row variant rather than one text with a parameter: a
// misspelled variant is then an undefined step, which the feature gate rejects
// even in a row the default profile excludes
// (`.agents/skills/cucumber/rules/steps.md`).
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
  "the manifest of the marketplace {string} to add cannot be read",
  async function (this: ScenarioWorld, name: string) {
    const published = this.requirePublished(name);
    await makeManifestUnreadable(published);
    await assert.rejects(readFile(published.manifestPath), { code: "EACCES" });
  },
);

Given(
  "the manifest of the marketplace {string} to add is a directory",
  async function (this: ScenarioWorld, name: string) {
    const published = this.requirePublished(name);
    await replaceManifestWithDirectory(published);
    assert.equal((await stat(published.manifestPath)).isDirectory(), true);
  },
);

// It offers a plugin the first does not, so only the shared name explains the
// duplicate-name failure.
Given(
  "a second marketplace declaring the name {string} is ready to add from {string}",
  async function (this: ScenarioWorld, name: string, location: string) {
    const { kind } = this.requirePublished(name);
    const root = await requireFreeRoot(this.publicationSites, location, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    // Not recorded: the world keys marketplaces by name, so it would replace the first.
    await publishMarketplaceIn(this.publicationSites, location, name, kind, [
      { name: "formatter", version: "1.0.0" },
    ]);
  },
);

// One literal text per directory state, for the reason given above the
// manifest problems.
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
