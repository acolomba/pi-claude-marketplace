/**
 * @fileoverview Steps every skill feature shares: the skills a published
 * plugin holds.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishSkill, skillFileText } from "../../lib/skill-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} has the skill {string} described as {string} with this body:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    skill: string,
    description: string,
    body: string,
  ) {
    const published = this.requirePublished(name);
    const file = await publishSkill(published, plugin, { name: skill, description, body });
    assert.strictEqual(
      await readFile(file, "utf8"),
      skillFileText({ name: skill, description, body }),
    );
  },
);
