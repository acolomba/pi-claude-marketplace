/**
 * @fileoverview Marketplace-info fixtures that add same-name sources to
 * separate scopes without replacing the world's primary publication.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { fieldRecord, flatten } from "../../lib/field-rows.ts";
import { expectedInfoFields } from "../../lib/marketplace-info-fields.ts";
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
    const root = await requireFreeRoot(this.publicationSites, directory, first.kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    const second = await publishMarketplaceIn(
      this.publicationSites,
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

Then(
  "the marketplace info result has these fields:",
  function (this: ScenarioWorld, table: DataTable) {
    const result = this.lastResult();
    assert.strictEqual(result.kind, "marketplace-info", JSON.stringify(result));
    const body = Object.fromEntries(
      Object.entries(result).filter(([name]) => name !== "schemaVersion" && name !== "origin"),
    );
    assert.deepStrictEqual(fieldRecord(flatten(body, this.tokens)), expectedInfoFields(table));
  },
);
