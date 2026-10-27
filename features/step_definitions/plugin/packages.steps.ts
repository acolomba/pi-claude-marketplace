/**
 * @fileoverview Steps about a plugin's npm packages: the package files a
 * published plugin ships, and the packages an installed plugin holds.
 *
 * A plugin ships a `package.json` and a `package-lock.json` built from the
 * tarballs the scenario's npm registry serves, so the lockfile names their
 * loopback URLs and integrity. An installed plugin's packages are the entries
 * of the `node_modules` directory in the folder its installation record runs
 * it from.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { pluginPackageFiles, readNpmPackages } from "../../lib/npm-registry.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The folder the one installation record of `plugin` in the scope runs it from.
async function installedPluginFolder(
  world: ScenarioWorld,
  plugin: string,
  scope: string,
): Promise<string> {
  const file = path.join(world.scopeRoot(scope), "pi-claude-marketplace", "state.json");
  const content = await readFile(file, "utf8");
  const state: unknown = JSON.parse(content);
  const marketplaces: unknown[] =
    isPlainObject(state) && "marketplaces" in state && isPlainObject(state.marketplaces)
      ? Object.values(state.marketplaces)
      : [];
  const folders = marketplaces.flatMap((marketplace: unknown) => {
    const record: unknown =
      isPlainObject(marketplace) && "plugins" in marketplace && isPlainObject(marketplace.plugins)
        ? Object.entries(marketplace.plugins).find(([name]) => name === plugin)?.[1]
        : undefined;
    return isPlainObject(record) && "resolvedSource" in record ? [record.resolvedSource] : [];
  });
  const [folder, ...others] = folders;
  if (typeof folder !== "string" || others.length > 0) {
    assert.fail(`expected one installation record of ${plugin} with a source in ${content}`);
  }

  return folder;
}

// The name and version of the package in `directory`, as its package.json states them.
async function installedPackage(directory: string): Promise<string[]> {
  const manifest: unknown = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  if (
    !isPlainObject(manifest) ||
    !("name" in manifest) ||
    !("version" in manifest) ||
    typeof manifest.name !== "string" ||
    typeof manifest.version !== "string"
  ) {
    assert.fail(`the package in ${directory} has no string name and version`);
  }

  return [manifest.name, manifest.version];
}

Given(
  "the published plugin {string} of the marketplace {string} depends on these npm packages:",
  async function (this: ScenarioWorld, plugin: string, name: string, table: DataTable) {
    const registry = this.requireNpmRegistry();
    const published = this.requirePublished(name);
    const tarballs = readNpmPackages(table).map((pkg) => registry.served(pkg));
    const files = pluginPackageFiles(plugin, tarballs);
    await writePublishedPluginFiles(published, plugin, files);
    const folder = path.join(published.root, "plugins", plugin);
    const written = await Promise.all(
      Object.keys(files).map(async (file) => [
        file,
        await readFile(path.join(folder, file), "utf8"),
      ]),
    );
    assert.deepStrictEqual(Object.fromEntries(written), files);
  },
);

Then(
  "the plugin {string} installed in the {word} scope has these npm packages:",
  async function (this: ScenarioWorld, plugin: string, scope: string, table: DataTable) {
    const modules = path.join(await installedPluginFolder(this, plugin, scope), "node_modules");
    const entries = (await readdir(modules))
      .filter((entry) => !entry.startsWith("."))
      .sort((left, right) => left.localeCompare(right));
    const rows = await Promise.all(
      entries.map((entry) => installedPackage(path.join(modules, entry))),
    );
    assert.deepStrictEqual([["name", "version"], ...rows], table.raw());
  },
);

Then(
  "the plugin {string} installed in the {word} scope has no npm packages",
  async function (this: ScenarioWorld, plugin: string, scope: string) {
    const modules = path.join(await installedPluginFolder(this, plugin, scope), "node_modules");
    assert.strictEqual(existsSync(modules), false, `${modules} exists`);
  },
);
