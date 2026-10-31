/**
 * @fileoverview Marketplace-info fixtures for separate scope sources and
 * tampered stored names.
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { fieldRecord, flatten, isPlainObject } from "../../lib/field-rows.ts";
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

Given(
  "the marketplace {string} info record in the {word} scope has the stored name {string}",
  async function (this: ScenarioWorld, name: string, scope: string, storedName: string) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    const state: unknown = JSON.parse(await readFile(file, "utf8"));
    assert.ok(isPlainObject(state) && "marketplaces" in state);
    assert.ok(isPlainObject(state.marketplaces));
    const marketplaces: Record<string, unknown> = { ...state.marketplaces };
    const record = marketplaces[name];
    assert.ok(isPlainObject(record));
    const tampered = {
      ...state,
      marketplaces: { ...marketplaces, [name]: { ...record, name: storedName } },
    };
    await writeFile(file, JSON.stringify(tampered));
    assert.deepStrictEqual(JSON.parse(await readFile(file, "utf8")), tampered);
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
