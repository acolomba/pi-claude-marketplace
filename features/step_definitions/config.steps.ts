/**
 * @fileoverview Steps about the configs a user owns in a scope: the base config
 * `claude-plugins.json` and the local config `claude-plugins.local.json`.
 *
 * One setup step writes the `plugins` member of one layer config, to model a
 * hand edit or a version-control update. It keeps the config's other members.
 * Every other step only reads, so this module writes nothing else and deletes
 * nothing.
 *
 * A missing file fails every step that reads one; it never reads as zero
 * declarations. A file whose `marketplaces` map is empty declares that no
 * marketplace is wanted. `declares these plugins` lists each plugin declaration
 * under its `<plugin>@<marketplace>` key, in an `id` column, beside the fields of
 * its entry. `declares no marketplaces` and `declares no plugins`
 * pass on an empty or an absent map, because the configuration schema reads an
 * absent map as no declarations (CFG-01). `declares no plugins` is how a
 * scenario shows that a refused command wrote no plugin declaration to either
 * config (FIX-03). `does not exist` is the step that asserts a file is absent:
 * after a load, a missing `claude-plugins.json` means the first-run migration
 * declined to write it (FIX-02, MIG-01).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { fieldRecord, flatten, isPlainObject, recordTable } from "../lib/field-rows.ts";
import { readLayerPlugins, writeLayerPlugins } from "../lib/layer-config.ts";

import type { ScenarioWorld } from "../support/world.ts";

const CONFIG_FILES: ReadonlySet<string> = new Set([
  "claude-plugins.json",
  "claude-plugins.local.json",
]);

function configFilePath(world: ScenarioWorld, fileName: string, scope: string): string {
  if (!CONFIG_FILES.has(fileName)) {
    throw new Error(`${fileName} is not a config of a scope`);
  }

  return path.join(world.scopeRoot(scope), fileName);
}

// The file of each layer word a scenario names.
const LAYER_CONFIGS: ReadonlyMap<string, string> = new Map([
  ["base", "claude-plugins.json"],
  ["local", "claude-plugins.local.json"],
]);

function layerConfigPath(world: ScenarioWorld, scope: string, layer: string): string {
  const fileName = LAYER_CONFIGS.get(layer);
  if (fileName === undefined) {
    throw new Error(`unknown layer ${layer}; expected base or local`);
  }

  return path.join(world.scopeRoot(scope), fileName);
}

// Reads the file as a JSON object, failing on a missing file or other content.
async function readConfigObject(file: string): Promise<{ config: object; content: string }> {
  assert.ok(existsSync(file), `${file} does not exist, which is not an empty declaration`);
  const content = await readFile(file, "utf8");
  const config: unknown = JSON.parse(content);
  if (!isPlainObject(config)) {
    assert.fail(`${file} is not a JSON object: ${content}`);
  }

  return { config, content };
}

// The names one declaration map of the file holds; an absent map holds none.
async function declaredNames(
  file: string,
  member: "marketplaces" | "plugins",
): Promise<{ names: readonly string[]; content: string }> {
  const { config, content } = await readConfigObject(file);
  const declarations: unknown = Object.hasOwn(config, member) ? Reflect.get(config, member) : {};
  if (!isPlainObject(declarations)) {
    assert.fail(`${file} has a ${member} member that is not an object: ${content}`);
  }

  return { names: Object.keys(declarations), content };
}

// Compares the declarations of one map of the file with the table: one record
// per declaration, its key in `keyColumn` beside the fields of its entry. A
// missing map or a non-object entry fails.
async function compareDeclarations(
  world: ScenarioWorld,
  file: string,
  table: DataTable,
  member: "marketplaces" | "plugins",
  keyColumn: "name" | "id",
): Promise<void> {
  const { config, content } = await readConfigObject(file);
  const declarations: unknown = Object.hasOwn(config, member)
    ? Reflect.get(config, member)
    : undefined;
  if (!isPlainObject(declarations)) {
    assert.fail(`${file} has no ${member} object: ${content}`);
  }

  const records = Object.entries(declarations).map(([key, entry]) => {
    if (!isPlainObject(entry)) {
      assert.fail(`the ${member} entry ${key} in ${file} is not an object: ${content}`);
    }

    return fieldRecord([[keyColumn, key], ...flatten(entry, world.tokens)]);
  });
  const [stated = []] = table.raw();
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
}

Given(
  "a config in scope {word} and layer {word}, with these plugins:",
  async function (this: ScenarioWorld, scope: string, layer: string, table: DataTable) {
    const file = layerConfigPath(this, scope, layer);
    const plugins = readLayerPlugins(table);
    await writeLayerPlugins(file, plugins);
    const { config, content } = await readConfigObject(file);
    assert.deepStrictEqual(
      Reflect.get(config, "plugins"),
      Object.fromEntries(plugins.map(({ key, entry }) => [key, entry])),
      `${file} does not declare the plugins of the table: ${content}`,
    );
  },
);

Then(
  "the {string} file of the {word} scope declares these marketplaces:",
  async function (this: ScenarioWorld, fileName: string, scope: string, table: DataTable) {
    await compareDeclarations(
      this,
      configFilePath(this, fileName, scope),
      table,
      "marketplaces",
      "name",
    );
  },
);

Then(
  "the {string} file of the {word} scope declares these plugins:",
  async function (this: ScenarioWorld, fileName: string, scope: string, table: DataTable) {
    await compareDeclarations(this, configFilePath(this, fileName, scope), table, "plugins", "id");
  },
);

Then(
  "the {string} file of the {word} scope does not exist",
  function (this: ScenarioWorld, fileName: string, scope: string) {
    const file = configFilePath(this, fileName, scope);
    assert.strictEqual(existsSync(file), false, `${file} exists`);
  },
);

Then(
  "the {string} file of the {word} scope declares no marketplaces",
  async function (this: ScenarioWorld, fileName: string, scope: string) {
    const file = configFilePath(this, fileName, scope);
    const { names, content } = await declaredNames(file, "marketplaces");
    assert.deepStrictEqual(names, [], `${file} declares marketplaces: ${content}`);
  },
);

Then(
  "the {string} file of the {word} scope declares no plugins",
  async function (this: ScenarioWorld, fileName: string, scope: string) {
    const file = configFilePath(this, fileName, scope);
    const { names, content } = await declaredNames(file, "plugins");
    assert.deepStrictEqual(names, [], `${file} declares plugins: ${content}`);
  },
);
