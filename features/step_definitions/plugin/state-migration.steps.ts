/**
 * @fileoverview Steps about the installation record that the first load after
 * an upgrade rewrites in the current schema (STMIG-01, D-BG-704).
 *
 * The load saves the migrated record in the background (ST-4), so the step
 * reads the scope's `state.json` until it carries the expected schema version.
 * The save renames a complete file into place, so the version marks the end
 * of the save. A missing file or member still fails the step at once. When
 * the deadline passes, the failure shows Pi's stderr, where a failed save
 * prints its warning (IL-3).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { type DataTable, Then } from "@cucumber/cucumber";

import { jsonObject } from "../../lib/earlier-version-state.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const MIGRATED_SAVE_DEADLINE_MS = 20_000;

const MIGRATED_SAVE_POLL_MS = 50;

// The end of Pi's stderr that a failure shows.
const STDERR_TAIL_CHARS = 4_000;

// One `[id, enabled, provenance]` row for the plugin record `record`.
function migratedRow(id: string, record: unknown, content: string): string[] {
  const plugin = jsonObject(record, `the record of ${id}`);
  const { enabled, provenance } = plugin;
  if (typeof enabled !== "boolean" || typeof provenance !== "string") {
    assert.fail(`the record of ${id} has no boolean enabled and string provenance: ${content}`);
  }

  return [id, String(enabled), provenance];
}

// Returns the parsed `state.json` and its text once it carries `schemaVersion`.
async function readSavedState(
  world: ScenarioWorld,
  file: string,
  schemaVersion: number,
): Promise<{ readonly state: Record<string, unknown>; readonly content: string }> {
  const deadline = Date.now() + MIGRATED_SAVE_DEADLINE_MS;
  for (;;) {
    const content = await readFile(file, "utf8");
    const state = jsonObject(JSON.parse(content), file);
    if (state.schemaVersion === schemaVersion) {
      return { state, content };
    }

    if (Date.now() >= deadline) {
      assert.fail(
        `${file} still has schema version ${String(state.schemaVersion)} after ` +
          `${MIGRATED_SAVE_DEADLINE_MS} ms:\n${content}\n` +
          `Pi's stderr:\n${world.pi.stderrText.slice(-STDERR_TAIL_CHARS)}`,
      );
    }

    await delay(MIGRATED_SAVE_POLL_MS);
  }
}

Then(
  "the migrated installation record of the {word} scope has schema version {int} and these plugins:",
  async function (this: ScenarioWorld, scope: string, schemaVersion: number, table: DataTable) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    const { state, content } = await readSavedState(this, file, schemaVersion);
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
