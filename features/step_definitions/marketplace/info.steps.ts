/**
 * @fileoverview Marketplace-info fixtures that add same-name sources to
 * separate scopes without replacing the world's primary publication.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { runCommand } from "../../lib/pi-commands.ts";
import { publishMarketplaceIn, requireFreeRoot } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the marketplace {string} and a separate info source {string} are added to the {word} and {word} scopes",
  async function (
    this: ScenarioWorld,
    name: string,
    directory: string,
    firstScope: string,
    secondScope: string,
  ) {
    const first = this.requirePublished(name);
    const root = await requireFreeRoot(this.marketplacesRoot, directory, first.kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    const second = await publishMarketplaceIn(
      this.marketplacesRoot,
      directory,
      name,
      first.kind,
      [],
    );

    const firstResult = await runCommand(
      this.pi,
      `/claude:plugin marketplace add ${first.source} --scope ${firstScope}`,
    );
    assert.strictEqual(firstResult.severity, "info", JSON.stringify(firstResult));
    const secondResult = await runCommand(
      this.pi,
      `/claude:plugin marketplace add ${second.source} --scope ${secondScope}`,
    );
    assert.strictEqual(secondResult.severity, "info", JSON.stringify(secondResult));
  },
);
