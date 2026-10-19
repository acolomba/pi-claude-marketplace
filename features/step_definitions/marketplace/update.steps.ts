/**
 * @fileoverview Marketplace-update setup that changes a published source in place.
 */

import { Given } from "@cucumber/cucumber";

import { rewritePublishedManifest } from "../../lib/published-marketplace.ts";

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
