/**
 * @fileoverview Steps that publish local marketplaces by source kind and add
 * them to a scope, shared by every marketplace verb.
 *
 * A scenario publishes a marketplace once, naming its source kind, and that
 * step offers no plugins. Stating the plugins it offers, with or without the
 * dependencies each declares, republishes it as the same kind, so a scenario
 * states the kind before the plugins, and the plugins before the marketplaces
 * they may depend on.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { type DataTable, Given } from "@cucumber/cucumber";

import {
  readOfferedPlugins,
  readOfferedPluginsWithDependencies,
} from "../../lib/path-marketplace.ts";
import { runCommand } from "../../lib/pi-commands.ts";
import {
  allowDependenciesOn,
  invalidateManifest,
  publishMarketplace,
  requireFreeRoot,
} from "../../lib/published-marketplace.ts";

import type { OfferedPlugin } from "../../lib/path-marketplace.ts";
import type { SourceKind } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

/** Republishes the marketplace `name` as its recorded kind, offering `plugins`. */
async function offer(
  world: ScenarioWorld,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  const { kind } = world.requirePublished(name);
  world.recordPublished(
    name,
    await publishMarketplace(world.marketplacesRoot, name, kind, plugins),
  );
}

Given(
  "the marketplace {string} is published as a {source kind} source",
  async function (this: ScenarioWorld, name: string, kind: SourceKind) {
    if (this.publishedMarketplace(name) !== undefined) {
      assert.fail(`the marketplace ${name} is already published in this scenario`);
    }

    const root = await requireFreeRoot(this.marketplacesRoot, name, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    this.recordPublished(name, await publishMarketplace(this.marketplacesRoot, name, kind, []));
  },
);

Given(
  "the marketplace {string} offers these plugins:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    await offer(this, name, readOfferedPlugins(table));
  },
);

Given(
  "the marketplace {string} offers these plugins with dependencies:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    await offer(this, name, readOfferedPluginsWithDependencies(table));
  },
);

Given(
  "the marketplace {string} allows dependencies on the marketplace {string}",
  async function (this: ScenarioWorld, name: string, target: string) {
    await allowDependenciesOn(this.requirePublished(name), target);
  },
);

Given(
  "the marketplace {string} is added to the {word} scope",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const { source } = this.requirePublished(name);
    const payload = await runCommand(
      this.pi,
      `/claude:plugin marketplace add ${source} --scope ${scope}`,
    );
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  },
);

Given(
  "the manifest of the marketplace {string} has become invalid",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "schema-invalid");
  },
);
