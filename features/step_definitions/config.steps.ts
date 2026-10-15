/**
 * @fileoverview Steps that read the configuration files a user owns in a
 * scope: `claude-plugins.json` and `claude-plugins.local.json`.
 *
 * The steps only read (D-07), so this module never writes or deletes a file.
 *
 * A missing file fails the step; it never reads as zero declarations. The
 * extension treats a missing `claude-plugins.json` as not yet written and
 * rebuilds it from its own records on the next load (MIG-01). A file whose
 * `marketplaces` map is empty declares that no marketplace is wanted. A
 * scenario that needs zero declarations adds its own step and says which of
 * the two it means.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import { fieldRecord, flatten, isPlainObject, recordTable } from "../lib/field-rows.ts";

import type { ScenarioWorld } from "../support/world.ts";

const CONFIG_FILES: ReadonlySet<string> = new Set([
  "claude-plugins.json",
  "claude-plugins.local.json",
]);

Then(
  "the {string} file of the {word} scope declares these marketplaces:",
  async function (this: ScenarioWorld, fileName: string, scope: string, table: DataTable) {
    if (!CONFIG_FILES.has(fileName)) {
      throw new Error(`${fileName} is not a configuration file of a scope`);
    }

    const file = path.join(this.scopeRoot(scope), fileName);
    assert.ok(existsSync(file), `${file} does not exist, which is not an empty declaration`);
    const content = await readFile(file, "utf8");
    const config: unknown = JSON.parse(content);
    if (
      !isPlainObject(config) ||
      !("marketplaces" in config) ||
      !isPlainObject(config.marketplaces)
    ) {
      assert.fail(`${file} has no marketplaces object: ${content}`);
    }

    const records = Object.entries(config.marketplaces).map(([name, entry]) => {
      if (!isPlainObject(entry)) {
        assert.fail(`the marketplace ${name} in ${file} is not an object: ${content}`);
      }

      return fieldRecord([["name", name], ...flatten(entry, this.tokens)]);
    });
    const [stated = []] = table.raw();
    assert.deepStrictEqual(recordTable(stated, records), table.raw());
  },
);
