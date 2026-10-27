/**
 * @fileoverview Steps that publish local marketplaces by source kind, or as
 * Claude Code's official marketplace on the git host, and add them to a
 * scope or record them as an earlier version added them, shared by every
 * marketplace verb.
 *
 * A scenario publishes a marketplace once, naming its source kind, and that
 * step offers no plugins. Stating the plugins it offers, with or without the
 * dependencies each declares, republishes it as the same kind, so a scenario
 * states the kind before the plugins, and the plugins before the marketplaces
 * they may depend on.
 */

import assert from "node:assert/strict";
import { rm, stat } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import {
  recordEarlierVersionMarketplace,
  recordedMarketplace,
} from "../../lib/earlier-version-state.ts";
import {
  readOfferedPlugins,
  readOfferedPluginsWithDependencies,
} from "../../lib/path-marketplace.ts";
import { runCommand } from "../../lib/pi-commands.ts";
import {
  allowDependenciesOn,
  describeMarketplace,
  describeMarketplaceBranch,
  invalidateManifest,
  publishAnthropicsMarketplace,
  publishExternalMarketplace,
  publishMarketplace,
  publishOfficialMarketplace,
  removePublishedPlugin,
  removePublishedSource,
  republishMarketplace,
  requireFreeRoot,
  rewritePublishedManifest,
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
  await republishMarketplace(world.requirePublished(name), name, plugins);
}

Given(
  "the marketplace {string} is published as a {source kind} source",
  async function (this: ScenarioWorld, name: string, kind: SourceKind) {
    if (this.publishedMarketplace(name) !== undefined) {
      assert.fail(`the marketplace ${name} is already published in this scenario`);
    }

    const root = await requireFreeRoot(this.publicationSites, name, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    this.recordPublished(name, await publishMarketplace(this.publicationSites, name, kind, []));
  },
);

/**
 * Publishes the marketplace `name` with `publish`, as a github source of the
 * anthropics organization on the git host, and records it for the scenario.
 */
async function publishAnthropicsRepository(
  world: ScenarioWorld,
  name: string,
  publish: typeof publishAnthropicsMarketplace,
): Promise<void> {
  if (world.publishedMarketplace(name) !== undefined) {
    assert.fail(`the marketplace ${name} is already published in this scenario`);
  }

  world.onRelease(() =>
    rm(path.join(world.marketplacesRoot, name), { recursive: true, force: true }),
  );
  const published = await publish(world.publicationSites, name);
  world.recordPublished(name, published);
  assert.strictEqual((await stat(published.bareRepository)).isDirectory(), true);
}

Given(
  "the marketplace {string} is published as the official marketplace",
  async function (this: ScenarioWorld, name: string) {
    await publishAnthropicsRepository(this, name, publishOfficialMarketplace);
  },
);

Given(
  "the marketplace {string} is published by the anthropics organization",
  async function (this: ScenarioWorld, name: string) {
    await publishAnthropicsRepository(this, name, publishAnthropicsMarketplace);
  },
);

Given(
  "the marketplace {string} is published as an external manifest",
  async function (this: ScenarioWorld, name: string) {
    assert.strictEqual(this.publishedMarketplace(name), undefined);
    const root = await requireFreeRoot(this.publicationSites, name, "file");
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    this.recordPublished(name, await publishExternalMarketplace(this.marketplacesRoot, name));
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
  "the marketplace {string} no longer holds the files of the plugin {string}",
  async function (this: ScenarioWorld, name: string, plugin: string) {
    const published = this.requirePublished(name);
    await removePublishedPlugin(published, plugin);
    await assert.rejects(stat(path.join(published.root, "plugins", plugin)), { code: "ENOENT" });
  },
);

Given(
  "the published source of the marketplace {string} is removed",
  async function (this: ScenarioWorld, name: string) {
    await removePublishedSource(this.requirePublished(name));
  },
);

Given(
  "the marketplace {string} has the description {string}",
  async function (this: ScenarioWorld, name: string, description: string) {
    await describeMarketplace(this.requirePublished(name), description);
  },
);

Given(
  "the branch {string} of the marketplace {string} has the description {string}",
  async function (this: ScenarioWorld, branch: string, name: string, description: string) {
    await describeMarketplaceBranch(this.requirePublished(name), branch, description);
  },
);

Given(
  "the marketplace {string} publishes this manifest:",
  async function (this: ScenarioWorld, name: string, text: string) {
    await rewritePublishedManifest(this.requirePublished(name), text);
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
  "an earlier version recorded the marketplace {string} in the {word} scope",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const published = this.requirePublished(name);
    if (published.kind !== "dir") {
      assert.fail(`the marketplace ${name} is published as a ${published.kind} source, not dir`);
    }

    const scopeRoot = this.scopeRoot(scope);
    const record = await recordEarlierVersionMarketplace({
      scopeRoot,
      scope,
      projectDir: this.tokens.projectDir,
      name,
      published,
    });
    assert.deepStrictEqual(await recordedMarketplace(scopeRoot, name), record);
  },
);

Given(
  "the manifest of the marketplace {string} has become invalid",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "schema-invalid");
  },
);

Given(
  "the manifest of the marketplace {string} is no longer valid json",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "malformed");
  },
);

Given(
  "the marketplace {string} source is repaired with a changed valid manifest",
  async function (this: ScenarioWorld, name: string) {
    await rewritePublishedManifest(
      this.requirePublished(name),
      JSON.stringify({
        name,
        owner: { name: "features" },
        plugins: [],
        description: "Repaired marketplace",
      }),
    );
  },
);
