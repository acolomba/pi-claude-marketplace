/**
 * @fileoverview Steps about git-source plugins: a repository plugin that
 * declares no version, and the commit the copy an installed plugin runs from
 * holds.
 *
 * An installed git plugin runs from its own copy under `plugin-clones/`,
 * named by a hash of the clone URL and the commit, never from the URL-keyed
 * mirror a fetch refreshes (GIT-01).
 */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { pushGitRepository } from "../../lib/git-marketplace.ts";
import { pushTagOnlyRevision, readRepositoryPlugins } from "../../lib/git-plugin.ts";
import { runGit } from "../../lib/hermetic-git.ts";
import { rewritePublishedManifest } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const PER_COMMIT_KEY = /^[0-9a-f]{12}-[0-9a-f]{12}$/u;

Given(
  "the git-source plugin {string} of the git repository {string} declares no version",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const repository = this.requireGitRepository(name);
    const offered = repository.plugins.find((candidate) => candidate.name === plugin);
    assert.ok(offered !== undefined, `the git repository ${name} holds no plugin ${plugin}`);
    const manifestFile = path.join(
      repository.workTree,
      offered.path,
      ".claude-plugin",
      "plugin.json",
    );
    const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as Record<string, unknown>;
    const { version: _version, ...unversioned } = manifest;
    await writeFile(manifestFile, JSON.stringify(unversioned));
    await pushGitRepository(repository.workTree, repository.gitHome);
    const revision = await runGit(repository.workTree, repository.gitHome, "rev-parse", "HEAD");
    this.recordGitRepository({ ...repository, revisions: [...repository.revisions, revision] });
    const published = await runGit(
      repository.bareRepository,
      repository.gitHome,
      "show",
      `main:${path.posix.join(offered.path, ".claude-plugin", "plugin.json")}`,
    );
    assert.deepStrictEqual(JSON.parse(published), unversioned);
  },
);

Given(
  "the git repository {string} has a revision only the tag {string} reaches, holding these plugins:",
  async function (this: ScenarioWorld, name: string, tag: string, table: DataTable) {
    const repository = await pushTagOnlyRevision(
      this.requireGitRepository(name),
      readRepositoryPlugins(table),
      tag,
    );
    this.recordGitRepository(repository);
    const { bareRepository, gitHome } = repository;
    assert.deepStrictEqual(
      [
        await runGit(bareRepository, gitHome, "rev-parse", `refs/tags/${tag}`),
        await runGit(bareRepository, gitHome, "branch", "--contains", `refs/tags/${tag}`),
      ],
      [repository.revisions.at(-1), ""],
    );
  },
);

/**
 * Sets `fields` on the source of the git plugin `plugin` that the marketplace
 * `name` offers, republishes the manifest, and asserts the entry it now holds.
 */
async function changeGitPluginSource(
  world: ScenarioWorld,
  name: string,
  plugin: string,
  fields: Record<string, string>,
): Promise<void> {
  const published = world.requirePublished(name);
  const manifest = JSON.parse(await readFile(published.manifestPath, "utf8")) as {
    plugins: Array<{ name: string; source: unknown }>;
  };
  const entry = manifest.plugins.find((candidate) => candidate.name === plugin);
  assert.ok(
    entry !== undefined && isPlainObject(entry.source),
    `the marketplace ${name} offers no git plugin ${plugin}`,
  );
  entry.source = { ...entry.source, ...fields };
  await rewritePublishedManifest(published, JSON.stringify(manifest, null, 2));
  const written = JSON.parse(await readFile(published.manifestPath, "utf8")) as typeof manifest;
  assert.deepStrictEqual(
    written.plugins.find((candidate) => candidate.name === plugin),
    entry,
  );
}

Given(
  "the marketplace {string} names the ref {string} for the plugin {string}",
  async function (this: ScenarioWorld, name: string, ref: string, plugin: string) {
    await changeGitPluginSource(this, name, plugin, { ref });
  },
);

// A sha no repository revision has, so the clone the install makes lacks it.
const ABSENT_COMMIT = "0123456789abcdef0123456789abcdef01234567";

Given(
  "the marketplace {string} pins the plugin {string} to a commit its repository lacks",
  async function (this: ScenarioWorld, name: string, plugin: string) {
    assert.strictEqual(this.gitRepositoryServing(plugin).revisions.includes(ABSENT_COMMIT), false);
    await changeGitPluginSource(this, name, plugin, { sha: ABSENT_COMMIT });
  },
);

Then(
  "the git-source plugin {string} installed in the {word} scope runs revision {int} of its repository",
  async function (this: ScenarioWorld, plugin: string, scope: string, revision: number) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const state = JSON.parse(await readFile(path.join(extensionRoot, "state.json"), "utf8")) as {
      readonly marketplaces: Record<string, { readonly plugins: Record<string, unknown> }>;
    };
    const records = Object.values(state.marketplaces).flatMap((marketplace) =>
      Object.entries(marketplace.plugins)
        .filter(([recorded]) => recorded === plugin)
        .map(([, record]) => record),
    );
    assert.strictEqual(records.length, 1, `records of ${plugin}: ${records.length}`);
    const [record] = records;
    const resolvedSource =
      isPlainObject(record) && "resolvedSource" in record ? record.resolvedSource : undefined;
    assert.ok(typeof resolvedSource === "string", `the record of ${plugin} names no source`);
    const clonesDirectory = path.join(extensionRoot, "plugin-clones");
    const [key = ""] = path.relative(clonesDirectory, resolvedSource).split(path.sep);
    assert.match(key, PER_COMMIT_KEY, `${plugin} runs from ${resolvedSource}`);
    const repository = this.gitRepositoryServing(plugin);
    assert.strictEqual(
      await runGit(path.join(clonesDirectory, key), repository.gitHome, "rev-parse", "HEAD"),
      repository.revisions[revision - 1],
    );
  },
);
