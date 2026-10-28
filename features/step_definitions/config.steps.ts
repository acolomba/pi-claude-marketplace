/**
 * @fileoverview Steps about the configs a user owns in a scope: the base config
 * `claude-plugins.json` and the local config `claude-plugins.local.json`.
 *
 * Setup steps each write one layer config, to model a hand edit or a
 * version-control update. One writes the `plugins` member and one the
 * `marketplaces` member, each keeping the config's other members; the
 * marketplaces step expands the run tokens in each source. The third writes
 * the whole text, which can leave the file broken. A fourth delays that edit
 * until an npm response, so an install sees a config edit between dependency
 * transactions. Every other step only
 * reads, so this module writes nothing else and deletes nothing. `holds this
 * text` compares the raw text of a config, while the byte snapshot steps prove
 * a no-op leaves both the base config and installation record untouched.
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
import {
  readLayerMarketplaces,
  readLayerPlugins,
  writeLayerMarketplaces,
  writeLayerPlugins,
  writeLayerText,
} from "../lib/layer-config.ts";
import { expandTokens } from "../lib/run-tokens.ts";

import type { ScenarioWorld } from "../support/world.ts";

const CONFIG_FILES: ReadonlySet<string> = new Set([
  "claude-plugins.json",
  "claude-plugins.local.json",
]);

interface ScopeBytes {
  readonly config: Buffer;
  readonly state: Buffer;
}

const rememberedScopeBytes = new WeakMap<ScenarioWorld, ReadonlyMap<string, ScopeBytes>>();

async function scopeBytes(world: ScenarioWorld, scope: string): Promise<ScopeBytes> {
  const scopeRoot = world.scopeRoot(scope);
  return {
    config: await readFile(path.join(scopeRoot, "claude-plugins.json")),
    state: await readFile(path.join(scopeRoot, "pi-claude-marketplace", "state.json")),
  };
}

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

// Reads the file back and asserts that one declaration map holds exactly
// `declarations`, so a broken write fails in the step that made it.
async function assertDeclared(
  file: string,
  member: "marketplaces" | "plugins",
  declarations: ReadonlyArray<readonly [string, object]>,
): Promise<void> {
  const { config, content } = await readConfigObject(file);
  assert.deepStrictEqual(
    Reflect.get(config, member),
    Object.fromEntries(declarations),
    `${file} does not declare the ${member} of the table: ${content}`,
  );
}

Given(
  "a config in scope {word} and layer {word}, with these plugins:",
  async function (this: ScenarioWorld, scope: string, layer: string, table: DataTable) {
    const file = layerConfigPath(this, scope, layer);
    const plugins = readLayerPlugins(table);
    await writeLayerPlugins(file, plugins);
    await assertDeclared(
      file,
      "plugins",
      plugins.map(({ key, entry }) => [key, entry]),
    );
  },
);

Given(
  "the config and installation record bytes of the {word} scope are remembered",
  async function (this: ScenarioWorld, scope: string) {
    const remembered = new Map(rememberedScopeBytes.get(this));
    remembered.set(scope, await scopeBytes(this, scope));
    rememberedScopeBytes.set(this, remembered);
  },
);

Given(
  "a config in scope {word} and layer {word}, with these marketplaces:",
  async function (this: ScenarioWorld, scope: string, layer: string, table: DataTable) {
    const file = layerConfigPath(this, scope, layer);
    const marketplaces = readLayerMarketplaces(table).map(({ name, entry }) => ({
      name,
      entry: { ...entry, source: expandTokens(entry.source, this.tokens) },
    }));
    await writeLayerMarketplaces(file, marketplaces);
    await assertDeclared(
      file,
      "marketplaces",
      marketplaces.map(({ name, entry }) => [name, entry]),
    );
  },
);

Given(
  "a config in scope {word} and layer {word}, with this text:",
  async function (this: ScenarioWorld, scope: string, layer: string, text: string) {
    const file = layerConfigPath(this, scope, layer);
    await writeLayerText(file, text);
    assert.strictEqual(await readFile(file, "utf8"), text, `${file} does not hold the text`);
  },
);

Given(
  "the local config of the project scope changes to this text while the npm registry serves {string}:",
  function (this: ScenarioWorld, name: string, text: string) {
    const file = layerConfigPath(this, "project", "local");
    this.requireNpmRegistry().beforeNextResponse(name, async () => {
      await writeLayerText(file, text);
      assert.strictEqual(await readFile(file, "utf8"), text);
    });
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
  "the config and installation record bytes of the {word} scope are unchanged",
  async function (this: ScenarioWorld, scope: string) {
    const remembered = rememberedScopeBytes.get(this)?.get(scope);
    assert.ok(remembered !== undefined, `the ${scope} scope bytes were not remembered`);
    assert.deepStrictEqual(await scopeBytes(this, scope), remembered);
  },
);

Then(
  "the {string} file of the {word} scope declares these plugins:",
  async function (this: ScenarioWorld, fileName: string, scope: string, table: DataTable) {
    await compareDeclarations(this, configFilePath(this, fileName, scope), table, "plugins", "id");
  },
);

Then(
  "the {string} file of the {word} scope holds this text:",
  async function (this: ScenarioWorld, fileName: string, scope: string, text: string) {
    const file = configFilePath(this, fileName, scope);
    assert.ok(existsSync(file), `${file} does not exist`);
    assert.strictEqual(await readFile(file, "utf8"), text, `${file} does not hold the text`);
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
