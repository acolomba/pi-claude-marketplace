/**
 * @fileoverview Steps about what a plugin install leaves in a scope.
 *
 * A result can report a failure after the install already reached disk. These
 * steps look at what the install leaves behind: the plugins the scope's
 * installation record holds, with the version and enabled state of each, the
 * files a plugin's data directory holds, the skills and prompts it stages, and
 * the git clones of plugins and marketplaces the scope keeps. A clone is shown
 * by its origin URL and, when pinned, by its revision, never by its directory
 * name, which hashes a URL with the git host's random port.
 * Three setup steps change files as a user can: one plants a file in an
 * installed plugin's data directory, one deletes a plugin's installed skills,
 * and one writes a file of the user's own in the scope's shared `agents/`
 * directory, where an install writes the agents of every plugin. The other
 * steps only read; one of them lists the files of that `agents/` directory.
 *
 * A missing installation record fails the step; it never reads as no plugins.
 * A scope that has a marketplace added always has one.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { readGitClones } from "../../lib/git-clones.ts";
import { projectTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

/** One plugin of a scope's installation record. */
interface RecordedPlugin {
  /** The `plugin@marketplace` id. */
  readonly id: string;
  readonly version: string;
  readonly enabled: boolean;
  /** The names of the plugin's installed skill directories. */
  readonly skills: readonly string[];
}

// The directory where the extension keeps the scope's record, staged resources, and data.
function extensionRoot(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}

// Whether `name` names one entry of a directory: no separator, and not `.` or `..`.
function isEntryName(name: string): boolean {
  return name !== "" && name !== "." && name !== ".." && !/[/\\]/u.test(name);
}

// The plugin `id` as its record in `file` holds it; `content` is the file's text.
function recordedPlugin(
  id: string,
  record: unknown,
  file: string,
  content: string,
): RecordedPlugin {
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

  const skills =
    "resources" in record && isPlainObject(record.resources) && "skills" in record.resources
      ? record.resources.skills
      : undefined;
  if (
    !Array.isArray(skills) ||
    !skills.every((skill): skill is string => typeof skill === "string")
  ) {
    assert.fail(`the plugin ${id} in ${file} has no resources.skills list of names: ${content}`);
  }

  return { id, version: record.version, enabled: record.enabled, skills };
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

    return Object.entries(entry.plugins).map(([plugin, record]) =>
      recordedPlugin(`${plugin}@${marketplace}`, record, file, content),
    );
  });
}

// The data directory of the plugin `id` (`plugin@marketplace`) in the scope.
function pluginDataDirectory(world: ScenarioWorld, scope: string, id: string): string {
  const [plugin, marketplace, ...rest] = id.split("@");
  if (
    plugin === undefined ||
    marketplace === undefined ||
    rest.length > 0 ||
    !isEntryName(plugin) ||
    !isEntryName(marketplace)
  ) {
    assert.fail(`${id} is not a plugin@marketplace id`);
  }

  return path.join(extensionRoot(world, scope), "data", marketplace, plugin);
}

// The scope's shared directory of Pi agents.
function agentsDirectory(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "agents");
}

// Writes the user's file `name` holding `text` in `directory`, which must not
// hold it yet, and removes it on release.
async function writeUserFile(
  world: ScenarioWorld,
  directory: string,
  name: string,
  text: string,
): Promise<void> {
  assert.ok(isEntryName(name), `${name} is not a file name`);
  const file = path.join(directory, name);
  await writeFile(file, text, { flag: "wx" });
  world.onRelease(() => rm(file, { force: true }));
  assert.equal(await readFile(file, "utf8"), text);
}

// The `| file | text |` rows of every file under `directory`, which must
// exist, sorted by the file's `/`-separated path inside it.
async function fileRows(directory: string): Promise<string[][]> {
  assert.ok(existsSync(directory), `${directory} does not exist`);
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const file = path.join(entry.parentPath, entry.name);
        return {
          name: path.relative(directory, file).split(path.sep).join("/"),
          text: await readFile(file, "utf8"),
        };
      }),
  );
  const rows = files
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((file) => [file.name, file.text]);
  return [["file", "text"], ...rows];
}

// The entries a staged-resource directory holds; an absent directory holds none.
async function stagedEntries(directory: string): Promise<readonly string[]> {
  return existsSync(directory) ? readdir(directory) : [];
}

Given(
  "the data directory of {string} in the {word} scope holds the file {string} with the text {string}",
  async function (this: ScenarioWorld, id: string, scope: string, name: string, text: string) {
    const directory = pluginDataDirectory(this, scope, id);
    assert.ok(
      existsSync(directory),
      `${directory} does not exist, so the install did not create it`,
    );
    assert.ok((await stat(directory)).isDirectory(), `${directory} is not a directory`);
    await writeUserFile(this, directory, name, text);
  },
);

Given(
  "the agents directory of the {word} scope holds the file {string} with the text {string}",
  async function (this: ScenarioWorld, scope: string, name: string, text: string) {
    const directory = agentsDirectory(this, scope);
    await mkdir(directory, { recursive: true });
    await writeUserFile(this, directory, name, text);
  },
);

Given(
  "the user has deleted the installed skills of {string} in the {word} scope",
  async function (this: ScenarioWorld, id: string, scope: string) {
    const root = extensionRoot(this, scope);
    const recorded = (await recordedPlugins(root)).find((plugin) => plugin.id === id);
    assert.ok(
      recorded !== undefined,
      `the installation record of the ${scope} scope holds no ${id}`,
    );
    assert.notDeepStrictEqual(
      recorded.skills,
      [],
      `the installation record of ${id} lists no skill`,
    );
    const directories = recorded.skills.map((name) => {
      assert.ok(isEntryName(name), `the installation record of ${id} lists the skill ${name}`);
      return path.join(root, "resources", "skills", name);
    });
    // Without force, a skill the install did not stage fails the removal.
    await Promise.all(directories.map((directory) => rm(directory, { recursive: true })));
    await Promise.all(
      directories.map((directory) =>
        assert.rejects(stat(directory), { code: "ENOENT" }, `${directory} still exists`),
      ),
    );
  },
);

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
  "the {word} scope stages these skills and prompts:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    const resources = path.join(extensionRoot(this, scope), "resources");
    const staged = async (kind: string): Promise<string[][]> =>
      [...(await stagedEntries(path.join(resources, `${kind}s`)))]
        .sort((left, right) => left.localeCompare(right))
        .map((name) => [kind, name]);
    const rows = [...(await staged("skill")), ...(await staged("prompt"))];
    assert.deepStrictEqual([["kind", "name"], ...rows], table.raw());
  },
);

Then(
  "the installation record of the {word} scope holds these plugins:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    const recorded = await recordedPlugins(extensionRoot(this, scope));
    const rows = [...recorded]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((plugin) => [
        plugin.id,
        projectTokens("version", plugin.version, this.tokens),
        String(plugin.enabled),
      ]);
    assert.deepStrictEqual([["id", "version", "enabled"], ...rows], table.raw());
  },
);

Then(
  "the data directory of {string} in the {word} scope holds these files:",
  async function (this: ScenarioWorld, id: string, scope: string, table: DataTable) {
    assert.deepStrictEqual(await fileRows(pluginDataDirectory(this, scope, id)), table.raw());
  },
);

Then(
  "the agents directory of the {word} scope holds these files:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    assert.deepStrictEqual(await fileRows(agentsDirectory(this, scope)), table.raw());
  },
);

Then(
  "the {word} scope holds these git clones:",
  async function (this: ScenarioWorld, scope: string, table: DataTable) {
    const clones = (await readGitClones(extensionRoot(this, scope))).map((clone) => ({
      clone: clone.clone,
      origin: projectTokens("origin", clone.origin, this.tokens),
      revision: clone.pin === undefined ? "" : projectTokens("revision", clone.pin, this.tokens),
    }));
    const rows = clones
      .sort(
        (left, right) =>
          left.clone.localeCompare(right.clone) ||
          left.origin.localeCompare(right.origin) ||
          left.revision.localeCompare(right.revision),
      )
      .map((clone) => [clone.clone, clone.origin, clone.revision]);
    assert.deepStrictEqual([["clone", "origin", "revision"], ...rows], table.raw());
  },
);

Then("the {word} scope holds no git clones", async function (this: ScenarioWorld, scope: string) {
  assert.deepStrictEqual(await readGitClones(extensionRoot(this, scope)), []);
});
