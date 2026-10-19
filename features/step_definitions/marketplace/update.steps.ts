/**
 * @fileoverview Marketplace-update setup that changes a published source in place.
 */

import { Given } from "@cucumber/cucumber";

import { rewritePublishedManifest } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

type CosmeticRewrite = "formatting" | "nested keys" | "top-level keys";

const COMPARISON_FIXTURES: Readonly<
  Record<CosmeticRewrite, { readonly baseline: string; readonly refreshed: string }>
> = {
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
};

function comparisonFixture(rewrite: string): (typeof COMPARISON_FIXTURES)[CosmeticRewrite] {
  if (!(rewrite in COMPARISON_FIXTURES)) {
    throw new Error(`unknown cosmetic rewrite ${rewrite}`);
  }

  return COMPARISON_FIXTURES[rewrite as CosmeticRewrite];
}

Given(
  "the marketplace {string} update source contains this manifest:",
  async function (this: ScenarioWorld, name: string, text: string) {
    await rewritePublishedManifest(this.requirePublished(name), text);
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
