/**
 * @fileoverview Steps that check which plugins a scope has installed.
 *
 * A result can report a failure after the install already reached disk. These
 * steps look at what the install leaves behind: the scope's installation
 * record and the skills and prompts it stages. The steps only read.
 *
 * A missing installation record fails the step; it never reads as no plugins.
 * A scope that has a marketplace added always has one.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import { isPlainObject } from "../lib/field-rows.ts";

import type { ScenarioWorld } from "../support/world.ts";

// The `plugin@marketplace` keys the scope's installation record holds.
async function recordedPlugins(extensionRoot: string): Promise<readonly string[]> {
  const file = path.join(extensionRoot, "state.json");
  assert.ok(existsSync(file), `${file} does not exist, which is not an empty record`);
  const content = await readFile(file, "utf8");
  const state: unknown = JSON.parse(content);
  if (!isPlainObject(state) || !("marketplaces" in state) || !isPlainObject(state.marketplaces)) {
    assert.fail(`${file} has no marketplaces object: ${content}`);
  }

  return Object.entries(state.marketplaces).flatMap(([marketplace, entry]) => {
    if (!isPlainObject(entry) || !("plugins" in entry) || !isPlainObject(entry.plugins)) {
      assert.fail(`the marketplace ${marketplace} in ${file} has no plugins object: ${content}`);
    }

    return Object.keys(entry.plugins).map((plugin) => `${plugin}@${marketplace}`);
  });
}

// The entries a staged-resource directory holds; an absent directory holds none.
async function stagedEntries(directory: string): Promise<readonly string[]> {
  return existsSync(directory) ? readdir(directory) : [];
}

Then(
  "the {word} scope has no installed plugins",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const resources = path.join(extensionRoot, "resources");
    assert.deepStrictEqual(
      {
        recorded: await recordedPlugins(extensionRoot),
        skills: await stagedEntries(path.join(resources, "skills")),
        prompts: await stagedEntries(path.join(resources, "prompts")),
      },
      { recorded: [], skills: [], prompts: [] },
    );
  },
);
