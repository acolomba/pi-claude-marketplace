/**
 * @fileoverview Steps about plugin prune: a preview whose rows it states, an
 * installation record the prune cannot read, and the skill directories a
 * failed prune left that the user repairs.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { recordTable } from "../../lib/field-rows.ts";
import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { restoreDirectoryWrites } from "../../lib/published-marketplace.ts";
import { pluginRowRecords } from "../../lib/result-rows.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The directory where the extension keeps the scope's record, staged resources, and backups.
function extensionRoot(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}

// A preview that a later Given makes stale: the step states the rows it listed.
Given(
  "the user has previewed the prune with {string}, which listed these plugins:",
  async function (this: ScenarioWorld, command: string, table: DataTable) {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    const [payload, ...rest] = payloads;
    assert.ok(payload !== undefined && rest.length === 0, JSON.stringify(payloads));
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
    const [stated = []] = table.raw();
    assert.deepStrictEqual(
      recordTable(stated, pluginRowRecords(payload, this.tokens)),
      table.raw(),
    );
  },
);

Given(
  "the installation record of the {word} scope to prune is not valid json",
  async function (this: ScenarioWorld, scope: string) {
    const file = path.join(extensionRoot(this, scope), "state.json");
    assert.ok(existsSync(file), `${file} does not exist`);
    await writeFile(file, "{");
    assert.strictEqual(await readFile(file, "utf8"), "{");
  },
);

// The repair a user makes after a prune failed on a read-only directory
// that a plugin's skill ships.
Given(
  "the user has made the skills the prune could not remove in the {word} scope writable",
  async function (this: ScenarioWorld, scope: string) {
    const skills = path.join(extensionRoot(this, scope), "resources", "skills");
    await restoreDirectoryWrites([skills]);
    const entries = await readdir(skills, { recursive: true, withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
      const directory = path.join(entry.parentPath, entry.name);
      assert.notStrictEqual((await stat(directory)).mode & 0o200, 0, `${directory} is read-only`);
    }
  },
);
