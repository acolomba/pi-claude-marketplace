/**
 * @fileoverview Steps every slash-command feature shares: the commands a
 * published plugin holds, and the prompt-template commands Pi lists.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given, Then } from "@cucumber/cucumber";

import {
  publishSlashCommand,
  publishSlashCommandFile,
  slashCommandFileText,
} from "../../lib/slash-command-files.ts";

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

// The doc string is the whole command file as typed. No run token expands in
// it, so a `${CLAUDE_*}` variable reaches the plugin literally.
Given(
  "the published plugin {string} of the marketplace {string} has the slash command {string} with this command file:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    marketplace: string,
    command: string,
    text: string,
  ) {
    const written = await publishSlashCommandFile(
      this.requirePublished(marketplace),
      plugin,
      command,
      text,
    );
    assert.strictEqual(await readFile(written, "utf8"), text);
  },
);

// The names of every command Pi built from a prompt template must be none, so
// no command file of any installed plugin became a slash command.
Then("pi offers no slash commands from prompt templates", function (this: ScenarioWorld) {
  const listed = this.registrySnapshot?.commands;
  if (listed === undefined) {
    assert.fail("no step listed the slash commands pi offers");
  }

  const promptNames = listed.flatMap((entry) => (entry.source === "prompt" ? [entry.name] : []));
  assert.deepStrictEqual(promptNames, []);
});
