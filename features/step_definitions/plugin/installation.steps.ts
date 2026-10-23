/**
 * @fileoverview Steps that check which plugins a scope has installed.
 *
 * A result can report a failure after the install already reached disk. These
 * steps look at what the install leaves behind: the plugins the scope's
 * installation record holds, with the version and enabled state of each, and
 * the skills and prompts it stages. The steps only read.
 *
 * A missing installation record fails the step; it never reads as no plugins.
 * A scope that has a marketplace added always has one.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";

import type { ScenarioWorld } from "../../support/world.ts";

/** One plugin of a scope's installation record. */
interface RecordedPlugin {
  /** The `plugin@marketplace` id. */
  readonly id: string;
  readonly version: string;
  readonly enabled: boolean;
}

// The directory where the extension keeps the scope's record and staged resources.
function extensionRoot(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}

// The plugins the scope's installation record holds, in record order.
async function recordedPlugins(root: string): Promise<readonly RecordedPlugin[]> {
  const file = path.join(root, "state.json");
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

    return Object.entries(entry.plugins).map(([plugin, record]): RecordedPlugin => {
      const id = `${plugin}@${marketplace}`;
      if (
        !isPlainObject(record) ||
        !("version" in record) ||
        typeof record.version !== "string" ||
        !("enabled" in record) ||
        typeof record.enabled !== "boolean"
      ) {
        assert.fail(
          `the plugin ${id} in ${file} has no string version and boolean enabled: ${content}`,
        );
      }

      return { id, version: record.version, enabled: record.enabled };
    });
  });
}

// The entries a staged-resource directory holds; an absent directory holds none.
async function stagedEntries(directory: string): Promise<readonly string[]> {
  return existsSync(directory) ? readdir(directory) : [];
}

Then(
  "the {word} scope has no installed plugins",
  async function (this: ScenarioWorld, scope: string) {
    const root = extensionRoot(this, scope);
    const resources = path.join(root, "resources");
    const recorded = await recordedPlugins(root);
    assert.deepStrictEqual(
      {
        recorded: recorded.map((plugin) => plugin.id),
        skills: await stagedEntries(path.join(resources, "skills")),
        prompts: await stagedEntries(path.join(resources, "prompts")),
      },
      { recorded: [], skills: [], prompts: [] },
    );
  },
);

Then(
  "the installation record of the {word} scope holds these plugins:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    const recorded = await recordedPlugins(extensionRoot(this, scope));
    const rows = [...recorded]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((plugin) => [plugin.id, plugin.version, String(plugin.enabled)]);
    assert.deepStrictEqual([["id", "version", "enabled"], ...rows], table.raw());
  },
);
