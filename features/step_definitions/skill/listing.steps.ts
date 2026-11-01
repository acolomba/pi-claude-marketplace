/**
 * @fileoverview Steps every skill feature shares: the skills a published
 * plugin holds.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishSkill, publishSkillFile, skillFileText } from "../../lib/skill-files.ts";

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

// The doc string is the whole file, written as typed: no run token expands,
// so a `${CLAUDE_*}` variable reaches the plugin literally.
Given(
  "the published plugin {string} of the marketplace {string} has the skill {string} with this skill file:",
  async function (this: ScenarioWorld, plugin: string, name: string, skill: string, text: string) {
    const published = this.requirePublished(name);
    const file = await publishSkillFile(published, plugin, skill, text);
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
