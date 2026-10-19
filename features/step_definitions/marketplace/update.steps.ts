/**
 * @fileoverview Marketplace-update setup that changes a published source in place.
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { runCommand } from "../../lib/pi-commands.ts";
import {
  invalidateManifest,
  publishConventionalDecoy,
  publishUnreadableSkillFile,
  removePublishedSource,
  rewritePublishedManifest,
} from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

interface ComparisonFixture {
  readonly baseline: string;
  readonly refreshed: string;
}

const COMPARISON_FIXTURES: Readonly<Record<string, ComparisonFixture>> = {
  formatting: {
    baseline: '{"name":"tools","owner":{"name":"features"},"plugins":[]}',
    refreshed: '{\n  "name": "tools",\n  "owner": { "name": "features" },\n  "plugins": []\n}\n',
  },
  "top-level keys": {
    baseline: '{"name":"tools","owner":{"name":"features"},"plugins":[]}',
    refreshed: '{ "plugins": [], "owner": {"name":"features"}, "name":"tools" }\n',
  },
  "nested keys": {
    baseline:
      '{"name":"tools","owner":{"name":"features","email":"features@example.test"},"plugins":[]}',
    refreshed:
      '{ "name":"tools", "owner":{"email":"features@example.test","name":"features"}, "plugins":[] }\n',
  },
  "unknown field added": {
    baseline: '{"name":"tools","owner":{"name":"features"},"plugins":[]}',
    refreshed:
      '{ "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":1} }\n',
  },
  "unknown field changed": {
    baseline: '{"name":"tools","owner":{"name":"features"},"plugins":[],"vendor":{"revision":1}}',
    refreshed:
      '{ "name":"tools", "owner":{"name":"features"}, "plugins":[], "vendor":{"revision":2} }\n',
  },
  "unknown field removed": {
    baseline:
      '{"name":"tools","owner":{"name":"features"},"plugins":[{"name":"demo","source":"./demo","vendor":{"revision":1}}]}',
    refreshed:
      '{ "name":"tools", "owner":{"name":"features"}, "plugins":[{"name":"demo","source":"./demo"}] }\n',
  },
  "plugin order": {
    baseline:
      '{"name":"tools","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]}',
    refreshed:
      '{ "name":"tools", "plugins":[ {"name":"alpha","source":"./alpha"}, {"name":"zebra","source":"./zebra"} ] }\n',
  },
  "allowed marketplace order": {
    baseline:
      '{"name":"tools","plugins":[],"allowCrossMarketplaceDependenciesOn":["zebra","alpha"]}',
    refreshed:
      '{ "name":"tools", "plugins":[], "allowCrossMarketplaceDependenciesOn":["alpha", "zebra"] }\n',
  },
  "unknown array order": {
    baseline: '{"name":"tools","plugins":[],"vendor":{"sequence":["zebra","alpha"]}}',
    refreshed: '{ "name":"tools", "plugins":[], "vendor":{"sequence":["alpha", "zebra"]} }\n',
  },
  "isolated dependency fields": {
    baseline:
      '{"name":"tools","plugins":[{"name":"broken","source":"./broken","dependencies":["library@~1.0.0"],"vendor":{"revision":1}}]}',
    refreshed:
      '{ "name":"tools", "plugins":[{"name":"broken","source":"./broken","dependencies":["library@~1.0.0"],"vendor":{"revision":2}}] }\n',
  },
};

function comparisonFixture(rewrite: string): ComparisonFixture {
  const fixture = COMPARISON_FIXTURES[rewrite];
  if (fixture === undefined) {
    throw new Error(`unknown cosmetic rewrite ${rewrite}`);
  }

  return fixture;
}

Given(
  "the marketplace {string} update source contains this manifest:",
  async function (this: ScenarioWorld, name: string, text: string) {
    await rewritePublishedManifest(this.requirePublished(name), text);
  },
);

Given(
  "the manifest of the marketplace {string} to update is not valid json",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "malformed");
  },
);

Given(
  "the manifest of the marketplace {string} to update breaks the manifest schema",
  async function (this: ScenarioWorld, name: string) {
    await invalidateManifest(name, this.requirePublished(name), "schema-invalid");
  },
);

Given(
  "updating the marketplace {string} in the {word} scope has failed as invalid manifest",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const payload = await runCommand(
      this.pi,
      `/claude:plugin marketplace update ${name} --scope ${scope}`,
    );
    const [marketplace] = payload.marketplaces;
    const [plugin] = marketplace?.plugins ?? [];
    assert.ok(plugin?.cause !== undefined);
    assert.deepStrictEqual(Object.keys(plugin), [
      "status",
      "name",
      "id",
      "reasons",
      "scope",
      "cause",
      "leaks",
      "rollbackPartial",
    ]);
    assert.strictEqual(plugin.cause.truncated, false);
    assert.match(plugin.cause.causeChain[0] ?? "", /Failed to update marketplace/);
    assert.ok(
      plugin.cause.causeChain.slice(1).some((message) => message.includes("marketplace.json")),
    );
    assert.deepStrictEqual(
      {
        kind: payload.kind,
        severity: payload.severity,
        needsReload: payload.needsReload,
        summary: payload.summary,
        marketplaces: payload.marketplaces.map((marketplace) => ({
          name: marketplace.name,
          scope: marketplace.scope,
          status: marketplace.status,
          plugins: marketplace.plugins.map((plugin) => ({
            status: plugin.status,
            name: plugin.name,
            id: plugin.id,
            reasons: plugin.reasons,
            scope: plugin.scope,
            leaks: plugin.leaks,
            rollbackPartial: plugin.rollbackPartial,
          })),
        })),
      },
      {
        kind: "cascade",
        severity: "error",
        needsReload: false,
        summary: "Some operations have failed.",
        marketplaces: [
          {
            name,
            scope,
            status: "failed",
            plugins: [
              {
                status: "failed",
                name,
                id: `${name}@${name}`,
                reasons: ["invalid manifest"],
                scope,
                leaks: [],
                rollbackPartial: [],
              },
            ],
          },
        ],
      },
    );
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

Given(
  "the published source of the marketplace {string} is removed",
  async function (this: ScenarioWorld, name: string) {
    await removePublishedSource(this.requirePublished(name));
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has an unreadable skill file",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    await publishUnreadableSkillFile(this.requirePublished(name), plugin);
  },
);

Given(
  "a conventional decoy is published for the marketplace {string}",
  async function (this: ScenarioWorld, name: string) {
    await publishConventionalDecoy(this.requirePublished(name), name);
  },
);

Given(
  "the marketplace {string} update source has the {string} semantic rewrite",
  async function (this: ScenarioWorld, name: string, rewrite: string) {
    await rewritePublishedManifest(
      this.requirePublished(name),
      comparisonFixture(rewrite).refreshed,
    );
  },
);

Given(
  "the marketplace {string} has the {string} comparison baseline",
  async function (this: ScenarioWorld, name: string, rewrite: string) {
    await rewritePublishedManifest(
      this.requirePublished(name),
      comparisonFixture(rewrite).baseline,
    );
  },
);

Given(
  "the marketplace {string} update source has the {string} cosmetic rewrite",
  async function (this: ScenarioWorld, name: string, rewrite: string) {
    await rewritePublishedManifest(
      this.requirePublished(name),
      comparisonFixture(rewrite).refreshed,
    );
  },
);
