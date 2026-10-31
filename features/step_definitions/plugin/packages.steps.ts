/**
 * @fileoverview Steps about a plugin's npm packages: the package files a
 * published plugin ships, the packages an installed plugin holds, and npm's
 * cache of fetched packages.
 *
 * A plugin ships a `package.json` and a `package-lock.json` built from the
 * tarballs the scenario's npm registry serves, so the lockfile names their
 * loopback URLs and integrity. An installed plugin's packages are the entries
 * of the `node_modules` directory in the folder its installation record runs
 * it from.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { pluginPackageFiles, readNpmPackages } from "../../lib/npm-registry.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { LocalFolderPackage } from "../../lib/npm-registry.ts";
import type { PublishedMarketplace } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The hook script: it requires the package its first argument names, from the
// plugin's own folder, and writes what the package exports to the project file
// its second argument names.
const PACKAGE_PROOF_SCRIPT = [
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  "const [name, file] = process.argv.slice(2);",
  "fs.writeFileSync(path.join(process.env.CLAUDE_PROJECT_DIR, file), String(require(name)));",
  "",
].join("\n");

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

// Writes `files` into the published plugin's folder and asserts that each reads back.
async function writePluginFiles(
  published: PublishedMarketplace,
  plugin: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  await writePublishedPluginFiles(published, plugin, files);
  const folder = path.join(published.root, "plugins", plugin);
  const written = await Promise.all(
    Object.keys(files).map(async (file) => [file, await readFile(path.join(folder, file), "utf8")]),
  );
  assert.deepStrictEqual(Object.fromEntries(written), files);
}

// Writes the package files of the published plugin: the npm packages of
// `table`, which the registry serves, and the packages of `localFolders`.
async function writeNpmPackageFiles(
  world: ScenarioWorld,
  plugin: string,
  name: string,
  table: DataTable,
  localFolders: readonly LocalFolderPackage[],
): Promise<void> {
  const registry = world.requireNpmRegistry();
  const tarballs = readNpmPackages(table).map((pkg) => registry.served(pkg));
  const files = pluginPackageFiles(plugin, tarballs, localFolders);
  await writePluginFiles(world.requirePublished(name), plugin, files);
}

Given(
  "the published plugin {string} of the marketplace {string} depends on these npm packages:",
  async function (this: ScenarioWorld, plugin: string, name: string, table: DataTable) {
    await writeNpmPackageFiles(this, plugin, name, table, []);
  },
);

Given(
  "the published plugin {string} of the marketplace {string} depends on these npm packages and on the package {string} from the folder {string}:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    local: string,
    folder: string,
    table: DataTable,
  ) {
    await writeNpmPackageFiles(this, plugin, name, table, [{ name: local, folder }]);
  },
);

// The lockfiles the package step refuses by name before it reads them, so the
// step below cannot create one that npm or bun would run.
const REFUSED_LOCKFILES: readonly string[] = ["yarn.lock", "pnpm-lock.yaml", "bun.lockb"];

Given(
  "the published plugin {string} of the marketplace {string} ships a package.json and the lockfile {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, lockfile: string) {
    if (!REFUSED_LOCKFILES.includes(lockfile)) {
      assert.fail(`${lockfile} is not one of ${REFUSED_LOCKFILES.join(", ")}`);
    }

    const manifest = { name: plugin, version: "0.0.0", dependencies: { "pkd-dep": "1.0.0" } };
    await writePluginFiles(this.requirePublished(name), plugin, {
      "package.json": `${JSON.stringify(manifest)}\n`,
      [lockfile]: "a lockfile the package step refuses by name\n",
    });
  },
);

// npm keeps the tarballs it fetched in the cache under HOME and installs them
// again from there without a request.
Given("the npm cache is empty", async function (this: ScenarioWorld) {
  const cache = path.join(this.tokens.home, ".npm");
  await rm(cache, { recursive: true, force: true });
  assert.strictEqual(existsSync(cache), false, `${cache} exists`);
});

Given(
  "the published plugin {string} of the marketplace {string} has a session start hook that writes what the npm package {string} exports to the project file {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, pkg: string, file: string) {
    const hooks = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `node "\${CLAUDE_PLUGIN_ROOT}/package-proof.cjs" ${pkg} ${file}`,
              },
            ],
          },
        ],
      },
    };
    await writePluginFiles(this.requirePublished(name), plugin, {
      "hooks/hooks.json": `${JSON.stringify(hooks, null, 2)}\n`,
      "package-proof.cjs": PACKAGE_PROOF_SCRIPT,
    });
  },
);

Then(
  "the project directory holds the file {string} with the text {string}",
  async function (this: ScenarioWorld, file: string, text: string) {
    assert.strictEqual(await readFile(path.join(this.tokens.projectDir, file), "utf8"), text);
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

// The plugin folder of a marketplace clone has no record to name it once the
// plugin is uninstalled, so the step reads it where the clone keeps it and
// requires the plugin's own package.json there, so a wrong path cannot pass.
Then(
  "the folder of the plugin {string} in the marketplace {string} of the {word} scope has no npm packages",
  function (this: ScenarioWorld, plugin: string, marketplace: string, scope: string) {
    const folder = path.join(
      this.scopeRoot(scope),
      "pi-claude-marketplace",
      "sources",
      marketplace,
      "plugins",
      plugin,
    );
    assert.strictEqual(existsSync(path.join(folder, "package.json")), true, `${folder} is empty`);
    assert.strictEqual(
      existsSync(path.join(folder, "node_modules")),
      false,
      `${folder} has packages`,
    );
  },
);
