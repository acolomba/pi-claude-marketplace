/**
 * @fileoverview Steps that publish plugins, shared by every plugin verb: the
 * plugins a git repository on the git host holds, the plugins a marketplace
 * offers from those repositories, and the changes to a plugin a marketplace
 * already offers.
 *
 * The first statement of a git repository's plugins publishes it, and each
 * later one publishes a new revision. A marketplace offers git plugins after
 * the repositories hold them. A step that changes a plugin the marketplace
 * already offers, such as giving it a component Pi does not support, follows
 * the plugins the marketplace offers.
 */

import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import {
  gitPluginEntry,
  offerGitPlugins,
  publishPluginRepository,
  pushPluginRepository,
  readGitPluginOffers,
  readRepositoryPlugins,
} from "../../lib/git-plugin.ts";
import { runGit } from "../../lib/hermetic-git.ts";
import {
  publishOutputStyle,
  removePublishedOutputStyle,
  rewritePublishedManifest,
  writePublishedPluginFile,
} from "../../lib/published-marketplace.ts";

import type { GitPluginRepository, RepositoryPlugin } from "../../lib/git-plugin.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The work trees of plugin repositories live apart from the marketplaces, so
// a repository and a marketplace never share one.
const PLUGIN_REPOSITORIES_DIRECTORY = "plugin-repositories";

/**
 * Publishes the git repository `name` holding `plugins` the first time a
 * scenario names it, in a work tree its release removes, and pushes a new
 * revision of it every later time.
 */
async function publishRepositoryRevision(
  world: ScenarioWorld,
  name: string,
  plugins: readonly RepositoryPlugin[],
): Promise<GitPluginRepository> {
  const recorded = world.gitRepository(name);
  if (recorded !== undefined) {
    return pushPluginRepository(recorded, plugins);
  }

  const workTree = path.join(world.tokens.home, PLUGIN_REPOSITORIES_DIRECTORY, name);
  world.onRelease(() => rm(workTree, { recursive: true, force: true }));
  return publishPluginRepository(world.gitHost, workTree, name, plugins);
}

Given(
  "the git repository {string} holds these plugins:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const repository = await publishRepositoryRevision(this, name, readRepositoryPlugins(table));
    this.recordGitRepository(repository);
    assert.strictEqual(
      await runGit(repository.bareRepository, repository.gitHome, "rev-parse", "main"),
      repository.revisions.at(-1),
    );
  },
);

Given(
  "the marketplace {string} offers these plugins from git repositories:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const published = this.requirePublished(name);
    const entries = readGitPluginOffers(table).map((offer) =>
      gitPluginEntry(offer, this.requireGitRepository(offer.repository), this.gitHost),
    );
    const text = await readFile(published.manifestPath, "utf8");
    await rewritePublishedManifest(published, offerGitPlugins(text, entries));
    const manifest = JSON.parse(await readFile(published.manifestPath, "utf8")) as {
      plugins: Array<{ name: string }>;
    };
    assert.deepStrictEqual(
      entries.map((entry) => manifest.plugins.find((plugin) => plugin.name === entry.name)),
      entries,
    );
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has an output style",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const file = await publishOutputStyle(this.requirePublished(name), plugin);
    assert.strictEqual((await stat(file)).isFile(), true, `${file} is not a file`);
  },
);

Given(
  "the published plugin {string} of the marketplace {string} no longer has an output style",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const directory = await removePublishedOutputStyle(this.requirePublished(name), plugin);
    await assert.rejects(stat(directory), { code: "ENOENT" }, `${directory} still exists`);
  },
);

// Both agents declare the same name, so the install keeps the first and
// skips the second (D-07).
Given(
  "the published plugin {string} of the marketplace {string} has two agents named {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const published = this.requirePublished(name);
    const agentText = (description: string): string =>
      `---\nname: ${agent}\ndescription: ${description}\n---\n\n${description}\n`;
    const first = await writePublishedPluginFile(
      published,
      plugin,
      path.join("agents", "first.md"),
      agentText("The first agent."),
    );
    const second = await writePublishedPluginFile(
      published,
      plugin,
      path.join("agents", "second.md"),
      agentText("The second agent."),
    );
    assert.deepStrictEqual(
      [await readFile(first, "utf8"), await readFile(second, "utf8")],
      [agentText("The first agent."), agentText("The second agent.")],
    );
  },
);

// The generated name of `skills/skill` is `<plugin>-skill`, the name of the
// plugin's own skill, and `<plugin>-skill/` sorts first, so the install keeps
// that one and skips the new one.
Given(
  "the published plugin {string} of the marketplace {string} has a second skill whose name collides with its first",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const text = "---\nname: skill\ndescription: A colliding skill.\n---\n\nColliding.\n";
    const file = await writePublishedPluginFile(
      this.requirePublished(name),
      plugin,
      path.join("skills", "skill", "SKILL.md"),
      text,
    );
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
