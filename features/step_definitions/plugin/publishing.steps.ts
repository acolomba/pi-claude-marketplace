/**
 * @fileoverview Steps that publish plugins, shared by every plugin verb: the
 * plugins a git repository on the git host holds, the plugins a marketplace
 * offers from those repositories, and the changes to a plugin a marketplace
 * already offers.
 *
 * The first statement of a git repository's plugins publishes it, and each
 * later one publishes a new revision. A marketplace offers git plugins after
 * the repositories hold them. A step that changes a plugin the marketplace
 * already offers, such as giving it a component Pi does not support or an
 * agent, follows the plugins the marketplace offers.
 */

import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, stat } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import {
  gitPluginEntry,
  offerGitPlugins,
  publishPluginRepository,
  pushLinkedManifest,
  pushPluginRepository,
  readGitPluginOffers,
  readRepositoryPlugins,
  repositoryPluginRoot,
} from "../../lib/git-plugin.ts";
import { runGit } from "../../lib/hermetic-git.ts";
import {
  linkPublishedManifest,
  publishAgent,
  publishOutputStyle,
  publishReadOnlySkillDirectory,
  readOnlySkillRemovalError,
  removePublishedOutputStyle,
  restoreDirectoryWrites,
  rewritePublishedManifest,
  writePublishedPluginFile,
} from "../../lib/published-marketplace.ts";
import { READ_ONLY_SKILL_REMOVAL_ERROR_TOKEN } from "../../lib/run-tokens.ts";

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
  "the git repository {string} holds these plugins with no manifest:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const plugins = readRepositoryPlugins(table).map((plugin) => ({
      ...plugin,
      withoutManifest: true as const,
    }));
    const repository = await publishRepositoryRevision(this, name, plugins);
    this.recordGitRepository(repository);
    const pushed = await Promise.all(
      plugins.map((plugin) =>
        runGit(
          repository.bareRepository,
          repository.gitHome,
          "ls-tree",
          "main",
          "--",
          path.posix.join(plugin.path, ".claude-plugin", "plugin.json"),
        ),
      ),
    );
    assert.deepStrictEqual(
      pushed,
      plugins.map(() => ""),
      `a plugin of ${name} still has a pushed manifest`,
    );
  },
);

// Files that a plugin's manifest links to from outside its repository live
// apart from the work trees, which a later revision replaces.
const LINKED_MANIFESTS_DIRECTORY = "linked-manifests";

/**
 * Pushes the manifest of the plugin `plugin` of the git repository `name` as
 * a link to `target`, records the revision, and checks that the work tree and
 * the pushed revision both hold the manifest as a link.
 */
async function pushLinkedManifestRevision(
  world: ScenarioWorld,
  name: string,
  plugin: string,
  target: string,
): Promise<void> {
  const repository = await pushLinkedManifest(world.requireGitRepository(name), plugin, target);
  world.recordGitRepository(repository);
  const manifest = path.posix.join(
    path.relative(repository.workTree, repositoryPluginRoot(repository, plugin)),
    ".claude-plugin",
    "plugin.json",
  );
  assert.strictEqual(
    (await lstat(path.join(repository.workTree, manifest))).isSymbolicLink(),
    true,
    `${manifest} of ${name} is not a link`,
  );
  const entry = await runGit(
    repository.bareRepository,
    repository.gitHome,
    "ls-tree",
    "main",
    "--",
    manifest,
  );
  assert.strictEqual(entry.split(" ")[0], "120000", `${manifest} of ${name} is not a pushed link`);
}

Given(
  "the git repository {string} links the manifest of the plugin {string} to a file inside the plugin",
  async function (this: ScenarioWorld, name: string, plugin: string) {
    const pluginRoot = repositoryPluginRoot(this.requireGitRepository(name), plugin);
    await pushLinkedManifestRevision(this, name, plugin, path.join(pluginRoot, "manifest.json"));
  },
);

Given(
  "the git repository {string} links the manifest of the plugin {string} to a file outside the repository",
  async function (this: ScenarioWorld, name: string, plugin: string) {
    const directory = path.join(this.tokens.home, LINKED_MANIFESTS_DIRECTORY, name);
    this.onRelease(() => rm(directory, { recursive: true, force: true }));
    await mkdir(directory, { recursive: true });
    await pushLinkedManifestRevision(this, name, plugin, path.join(directory, "plugin.json"));
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
  "the published plugin {string} of the marketplace {string} links its manifest to a file outside the marketplace",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const published = this.requirePublished(name);
    const directory = path.join(this.tokens.home, LINKED_MANIFESTS_DIRECTORY, name);
    this.onRelease(() => rm(directory, { recursive: true, force: true }));
    const manifest = await linkPublishedManifest(
      published,
      plugin,
      path.join(directory, `${plugin}.json`),
    );
    assert.strictEqual((await lstat(manifest)).isSymbolicLink(), true, `${manifest} is not a link`);
    const relative = path.relative(published.root, await readlink(manifest));
    assert.strictEqual(
      relative.startsWith(`..${path.sep}`),
      true,
      `the manifest link of ${plugin} stays inside the marketplace ${name}`,
    );
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

// A Pi agent has no color, so staging drops the field and says so in a
// hygiene warning (D-PL1-02): a staging warning that skips nothing.
Given(
  "the published plugin {string} of the marketplace {string} has an agent {string} that sets a color",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const text = `---\nname: ${agent}\ndescription: The ${agent} agent.\ncolor: blue\n---\n\nThe ${agent} agent.\n`;
    const file = await writePublishedPluginFile(
      this.requirePublished(name),
      plugin,
      path.join("agents", `${agent}.md`),
      text,
    );
    assert.strictEqual(await readFile(file, "utf8"), text);
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

Given(
  "the published plugin {string} of the marketplace {string} has a read-only skill directory",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const published = this.requirePublished(name);
    const scratch = await mkdtemp(path.join(this.tokens.home, "skill-removal-"));
    this.onRelease(() => rm(scratch, { recursive: true, force: true }));
    // Releases run most recent first, so the restore runs before every removal
    // registered so far, including one of a read-only copy Pi leaves behind.
    const { home, agentDir, projectDir } = this.tokens;
    this.onRelease(() => restoreDirectoryWrites([home, agentDir, projectDir]));
    const directory = await publishReadOnlySkillDirectory(published, plugin);
    assert.strictEqual((await stat(directory)).mode & 0o777, 0o555);
    assert.deepStrictEqual(await readdir(directory), ["data.txt"]);
    const error = await readOnlySkillRemovalError(published, plugin, scratch);
    assert.deepStrictEqual([error.code, error.syscall], ["EACCES", "unlink"]);
    this.recordErrorMessage(READ_ONLY_SKILL_REMOVAL_ERROR_TOKEN, error.message);
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has the agent {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const file = await publishAgent(this.requirePublished(name), plugin, agent);
    assert.strictEqual((await stat(file)).isFile(), true, `${file} is not a file`);
  },
);
