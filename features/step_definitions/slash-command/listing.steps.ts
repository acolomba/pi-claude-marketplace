/**
 * @fileoverview Steps about listing the slash commands of a plugin: the
 * commands a published plugin holds.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishSlashCommand, slashCommandFileText } from "../../lib/slash-command-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} has the slash command {string} described as {string} with this body:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    command: string,
    description: string,
    body: string,
  ) {
    const published = this.requirePublished(name);
    const file = await publishSlashCommand(published, plugin, { name: command, description, body });
    assert.strictEqual(
      await readFile(file, "utf8"),
      slashCommandFileText({ name: command, description, body }),
    );
  },
);
