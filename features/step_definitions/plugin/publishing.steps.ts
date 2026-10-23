/**
 * @fileoverview Steps that publish plugins of a published marketplace, shared
 * by every plugin verb.
 *
 * A step here changes a plugin the marketplace already offers, such as giving
 * it a component Pi does not support, so a scenario states the plugins the
 * marketplace offers first.
 */

import assert from "node:assert/strict";
import { stat } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishOutputStyle } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} has an output style",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const file = await publishOutputStyle(this.requirePublished(name), plugin);
    assert.strictEqual((await stat(file)).isFile(), true, `${file} is not a file`);
  },
);
