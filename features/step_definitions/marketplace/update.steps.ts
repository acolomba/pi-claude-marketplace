/**
 * @fileoverview Marketplace-update setup that changes a published source in place.
 */

import { Given } from "@cucumber/cucumber";

import { rewritePublishedManifest } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the marketplace {string} update source contains this manifest:",
  async function (this: ScenarioWorld, name: string, text: string) {
    await rewritePublishedManifest(this.requirePublished(name), text);
  },
);
