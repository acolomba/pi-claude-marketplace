/**
 * @fileoverview Steps about the installation record that the first load after
 * an upgrade rewrites in the current schema (STMIG-01, D-BG-704).
 *
 * The step reads the scope's `state.json` once. A missing file or member fails
 * the step, so a load that has not written the migrated record yet fails it
 * instead of being waited out.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import { jsonObject } from "../../lib/earlier-version-state.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// One `[id, enabled, provenance]` row for the plugin record `record`.
function migratedRow(id: string, record: unknown, content: string): string[] {
  const plugin = jsonObject(record, `the record of ${id}`);
  const { enabled, provenance } = plugin;
  if (typeof enabled !== "boolean" || typeof provenance !== "string") {
    assert.fail(`the record of ${id} has no boolean enabled and string provenance: ${content}`);
  }

  return [id, String(enabled), provenance];
}

Then(
  "the migrated installation record of the {word} scope has schema version {int} and these plugins:",
  async function (this: ScenarioWorld, scope: string, schemaVersion: number, table: DataTable) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    const content = await readFile(file, "utf8");
    const state = jsonObject(JSON.parse(content), file);
    const rows: string[][] = [];
    for (const [marketplace, entry] of Object.entries(jsonObject(state.marketplaces, file))) {
      const plugins = jsonObject(entry, `the record of the marketplace ${marketplace}`).plugins;
      for (const [plugin, record] of Object.entries(jsonObject(plugins, marketplace))) {
        rows.push(migratedRow(`${plugin}@${marketplace}`, record, content));
      }
    }

    rows.sort((left, right) => String(left[0]).localeCompare(String(right[0])));
    assert.deepStrictEqual(
      { schemaVersion: state.schemaVersion, plugins: [["id", "enabled", "provenance"], ...rows] },
      { schemaVersion, plugins: table.raw() },
    );
  },
);
