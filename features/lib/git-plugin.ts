/**
 * @fileoverview Plugins published in git repositories on the git host, and the
 * marketplace entries that offer them.
 *
 * A plugin repository is a work tree under the sandbox HOME that holds one or
 * more plugins, each at the repository root or at a path inside it, published
 * as a bare repository the git host serves. Stating its plugins again commits
 * and pushes a new revision, as does turning a plugin's manifest into a link or
 * linking a file of its skill to another. A plugin may also be published with
 * no manifest at all. A marketplace offers a
 * plugin of such a repository as a `github` source, which the GitHub base
 * override sends to the git host, or as a `url` or `git-subdir` source that
 * names the host's loopback address, unpinned or pinned to the repository's
 * latest revision, and its entry may declare dependencies. The `ssh` kind is a
 * `url` source whose url is the scp address `git@127.0.0.1:<owner>/<name>.git`,
 * which the ssh stand-in serves from the git host's repositories (D-SG-17). The
 * `github ssh` kind is a `url` source whose url is the scp address
 * `git@github.com:<owner>/<name>.git`, which the GitHub base override sends to
 * the git host over https (D-SG-21). A url marketplace
 * can also offer a plugin of its own repository as a `git-subdir` source,
 * unpinned or pinned to the marketplace's latest commit (D-SEED-01).
 */

import assert from "node:assert/strict";
import { readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { publishGitRepository, pushGitRepository, pushGitTag } from "./git-marketplace.ts";
import { runGit } from "./hermetic-git.ts";
import {
  readDependencyCell,
  requireColumns,
  writeLinkedSkillFile,
  writePluginFiles,
} from "./path-marketplace.ts";

import type { OfferedPlugin, RangedDependency } from "./path-marketplace.ts";
import type { GitRepositoryHost } from "./published-marketplace.ts";
import type { DataTable } from "@cucumber/cucumber";

/**
 * One plugin a git repository holds, at `path` inside it; an empty path is the
 * root. `withoutManifest` publishes it with no `.claude-plugin` directory.
 */
export interface RepositoryPlugin extends OfferedPlugin {
  readonly path: string;
  readonly withoutManifest?: true;
}

/**
 * A git repository of plugins on the git host: the work tree that holds its
 * files, the bare repository the host serves as `<owner>/<name>.git`, the HOME
 * of the git that publishes it, the plugins it holds now, and the full sha of
 * every revision it published, oldest first.
 */
export interface GitPluginRepository {
  readonly name: string;
  readonly owner: string;
  readonly workTree: string;
  readonly bareRepository: string;
  readonly gitHome: string;
  readonly plugins: readonly RepositoryPlugin[];
  readonly revisions: readonly string[];
}

/** A kind of git source a marketplace offers a plugin as. */
export type GitPluginSourceKind = "github" | "url" | "git-subdir" | "ssh" | "github ssh";

const GIT_PLUGIN_SOURCE_KINDS: readonly GitPluginSourceKind[] = [
  "github",
  "url",
  "git-subdir",
  "ssh",
  "github ssh",
];

/** The host of the scp address an `ssh` offer names, which a scenario registers with the ssh stand-in. */
const SSH_SOURCE_HOST = "127.0.0.1";

/** The scp user and host of a `github ssh` offer, the spelling GitHub gives its ssh clone URLs. */
const GITHUB_SSH_SOURCE_PREFIX = "git@github.com:";

/**
 * A plugin a marketplace offers from the git repository `repository`, as a
 * `kind` source, pinned or not to the repository's latest revision, with the
 * dependencies its entry declares, if any.
 */
export interface GitPluginOffer {
  readonly name: string;
  readonly kind: GitPluginSourceKind;
  readonly repository: string;
  readonly pinned: boolean;
  readonly dependencies?: readonly (string | RangedDependency)[];
}

/** The `source` object of a marketplace entry that offers a git plugin. */
export interface GitPluginSource {
  readonly source: Exclude<GitPluginSourceKind, "ssh" | "github ssh">;
  readonly repo?: string;
  readonly url?: string;
  readonly path?: string;
  readonly sha?: string;
}

/** A marketplace entry that offers a git plugin. It has no version: the install derives one. */
export interface GitPluginEntry {
  readonly name: string;
  readonly source: GitPluginSource;
  readonly dependencies?: readonly (string | RangedDependency)[];
}

const REPOSITORY_COLUMNS = ["name", "version", "path"] as const;

/**
 * Reads a `| name | version | path |` table, or one with a last
 * `dependencies` column that `readDependencyCell` reads, throwing on a
 * missing or unknown column, on a path that is absolute or climbs out with
 * `..`, and on two plugins at one path.
 */
export function readRepositoryPlugins(table: DataTable): RepositoryPlugin[] {
  const declaresDependencies = table.raw()[0]?.length === REPOSITORY_COLUMNS.length + 1;
  requireColumns(
    table,
    declaresDependencies ? [...REPOSITORY_COLUMNS, "dependencies"] : REPOSITORY_COLUMNS,
  );
  const plugins = table.hashes().map((row) => {
    const pluginPath = String(row.path);
    if (path.posix.isAbsolute(pluginPath) || pluginPath.split("/").includes("..")) {
      throw new Error(`the plugin path ${pluginPath} is not a path inside the repository`);
    }

    const dependencies = declaresDependencies ? readDependencyCell(String(row.dependencies)) : [];
    return {
      name: String(row.name),
      version: String(row.version),
      path: pluginPath,
      ...(dependencies.length > 0 && { dependencies }),
    };
  });
  const paths = plugins.map((plugin) => plugin.path);
  if (new Set(paths).size !== paths.length) {
    throw new Error(`two plugins share a path in ${JSON.stringify(paths)}`);
  }

  return plugins;
}

async function writeRepositoryPlugins(
  workTree: string,
  plugins: readonly RepositoryPlugin[],
): Promise<void> {
  await Promise.all(
    plugins.map(async (plugin) => {
      const pluginRoot = path.join(workTree, plugin.path);
      await writePluginFiles(pluginRoot, plugin);
      if (plugin.withoutManifest === true) {
        await rm(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      }
    }),
  );
}

/** Replaces every file of the work tree `workTree`, but `.git`, with `plugins`. */
async function replaceRepositoryPlugins(
  workTree: string,
  plugins: readonly RepositoryPlugin[],
): Promise<void> {
  const entries = (await readdir(workTree)).filter((entry) => entry !== ".git");
  await Promise.all(entries.map((entry) => rm(path.join(workTree, entry), { recursive: true })));
  await writeRepositoryPlugins(workTree, plugins);
}

/**
 * Writes `plugins` in the work tree `workTree` and publishes them as the git
 * repository `name` of the host's default owner, failing when the host
 * already serves a repository there. Returns the repository with its one
 * revision.
 */
export async function publishPluginRepository(
  host: GitRepositoryHost,
  workTree: string,
  name: string,
  plugins: readonly RepositoryPlugin[],
): Promise<GitPluginRepository> {
  const bareRepository = host.repositoryPath(name);
  await assert.rejects(
    stat(bareRepository),
    { code: "ENOENT" },
    `the git host already serves ${host.repositoryShorthand(name)}`,
  );
  await writeRepositoryPlugins(workTree, plugins);
  await publishGitRepository(workTree, bareRepository, host.gitHome);
  return {
    name,
    owner: host.defaultOwner,
    workTree,
    bareRepository,
    gitHome: host.gitHome,
    plugins,
    revisions: [await runGit(workTree, host.gitHome, "rev-parse", "HEAD")],
  };
}

/**
 * Replaces every file of the work tree of `repository` with `plugins`,
 * commits them, and pushes the commit as a new revision. Returns the
 * repository with that revision appended.
 */
export async function pushPluginRepository(
  repository: GitPluginRepository,
  plugins: readonly RepositoryPlugin[],
): Promise<GitPluginRepository> {
  const { workTree, gitHome } = repository;
  await replaceRepositoryPlugins(workTree, plugins);
  await pushGitRepository(workTree, gitHome);
  return {
    ...repository,
    plugins,
    revisions: [...repository.revisions, await runGit(workTree, gitHome, "rev-parse", "HEAD")],
  };
}

/**
 * Commits `plugins` on a branch started from `main`, tags the commit `tag`,
 * pushes the tag alone, and returns the work tree to `main` with the branch
 * deleted, so only the tag reaches the commit. Returns the repository with
 * that revision appended; its plugins stay those of `main`.
 */
export async function pushTagOnlyRevision(
  repository: GitPluginRepository,
  plugins: readonly RepositoryPlugin[],
  tag: string,
): Promise<GitPluginRepository> {
  const { workTree, gitHome } = repository;
  const branch = `tag-only-${tag}`;
  await runGit(workTree, gitHome, "checkout", "-q", "-b", branch, "main");
  await replaceRepositoryPlugins(workTree, plugins);
  await runGit(workTree, gitHome, "add", "-A");
  await runGit(workTree, gitHome, "commit", "-q", "-m", `publish ${tag}`);
  const revision = await pushGitTag(workTree, gitHome, tag);
  await runGit(workTree, gitHome, "checkout", "-q", "main");
  await runGit(workTree, gitHome, "branch", "-q", "-D", branch);
  return { ...repository, revisions: [...repository.revisions, revision] };
}

/** Returns the directory of the plugin `pluginName` in the work tree of `repository`. */
export function repositoryPluginRoot(repository: GitPluginRepository, pluginName: string): string {
  const plugin = repository.plugins.find((candidate) => candidate.name === pluginName);
  if (plugin === undefined) {
    assert.fail(`the git repository ${repository.name} holds no plugin ${pluginName}`);
  }

  return path.join(repository.workTree, plugin.path);
}

/**
 * Moves the manifest of the plugin `pluginName` of `repository` to the file
 * `target`, makes its `.claude-plugin/plugin.json` a link to that file, and
 * pushes the result as a new revision. The link text is relative when `target`
 * lies in the work tree and absolute otherwise. Returns the repository with
 * that revision appended; its plugins declare what they did before.
 */
export async function pushLinkedManifest(
  repository: GitPluginRepository,
  pluginName: string,
  target: string,
): Promise<GitPluginRepository> {
  const { workTree, gitHome } = repository;
  const manifest = path.join(
    repositoryPluginRoot(repository, pluginName),
    ".claude-plugin",
    "plugin.json",
  );
  const relative = path.relative(workTree, target);
  const insideWorkTree = !relative.startsWith("..") && !path.isAbsolute(relative);
  await writeFile(target, await readFile(manifest));
  await rm(manifest);
  await symlink(insideWorkTree ? path.relative(path.dirname(manifest), target) : target, manifest);
  await pushGitRepository(workTree, gitHome);
  return {
    ...repository,
    revisions: [...repository.revisions, await runGit(workTree, gitHome, "rev-parse", "HEAD")],
  };
}

/**
 * Gives the skill of the plugin `pluginName` of `repository` a file that is a
 * relative symbolic link to another file of the skill, as
 * `writeLinkedSkillFile` writes them, and pushes the result as a new revision
 * (D-SG-11, SG-MIG-01). Returns the repository with that revision appended and
 * the path of the link in its work tree.
 */
export async function pushLinkedSkillFile(
  repository: GitPluginRepository,
  pluginName: string,
): Promise<{ readonly repository: GitPluginRepository; readonly link: string }> {
  const { workTree, gitHome } = repository;
  const link = await writeLinkedSkillFile(repositoryPluginRoot(repository, pluginName), pluginName);
  await pushGitRepository(workTree, gitHome);
  const revision = await runGit(workTree, gitHome, "rev-parse", "HEAD");
  return { repository: { ...repository, revisions: [...repository.revisions, revision] }, link };
}

function parseGitPluginSourceKind(text: string): GitPluginSourceKind {
  const kind = GIT_PLUGIN_SOURCE_KINDS.find((candidate) => candidate === text);
  if (kind === undefined) {
    throw new Error(
      `unknown plugin source kind "${text}"; expected one of ${GIT_PLUGIN_SOURCE_KINDS.join(", ")}`,
    );
  }

  return kind;
}

function parsePinned(text: string): boolean {
  switch (text) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      throw new Error(`pinned is "${text}"; expected true or false`);
  }
}

const OFFER_COLUMNS = ["name", "source kind", "repository", "pinned"] as const;

/**
 * Reads a `| name | source kind | repository | pinned |` table, or one with a
 * last `dependencies` column that `readDependencyCell` reads, throwing on a
 * missing or unknown column, a source kind other than `github`, `url`,
 * `git-subdir`, `ssh`, and `github ssh`, and a pinned cell other than `true`
 * and `false`.
 */
export function readGitPluginOffers(table: DataTable): GitPluginOffer[] {
  const declaresDependencies = table.raw()[0]?.length === OFFER_COLUMNS.length + 1;
  requireColumns(table, declaresDependencies ? [...OFFER_COLUMNS, "dependencies"] : OFFER_COLUMNS);
  return table.hashes().map((row) => {
    const dependencies = declaresDependencies ? readDependencyCell(String(row.dependencies)) : [];
    return {
      name: String(row.name),
      kind: parseGitPluginSourceKind(String(row["source kind"])),
      repository: String(row.repository),
      pinned: parsePinned(String(row.pinned)),
      ...(dependencies.length > 0 ? { dependencies } : {}),
    };
  });
}

function latestRevision(repository: GitPluginRepository): string {
  const latest = repository.revisions.at(-1);
  if (latest === undefined) {
    assert.fail(`the git repository ${repository.name} has no revision`);
  }

  return latest;
}

/**
 * Returns the marketplace entry that offers the plugin of `offer` from
 * `repository` on `host`. A github, url, ssh, or github ssh source clones the whole
 * repository, so it needs the plugin at the root; a git-subdir source names the plugin's
 * path. A pinned offer carries the repository's latest revision as its `sha`,
 * and an offer that declares dependencies carries them on the entry.
 */
export function gitPluginEntry(
  offer: GitPluginOffer,
  repository: GitPluginRepository,
  host: GitRepositoryHost,
): GitPluginEntry {
  const plugin = repository.plugins.find((candidate) => candidate.name === offer.name);
  if (plugin === undefined) {
    assert.fail(`the git repository ${repository.name} holds no plugin ${offer.name}`);
  }

  if ((offer.kind === "git-subdir") === (plugin.path === "")) {
    assert.fail(
      `a ${offer.kind} source cannot offer ${offer.name} at the path "${plugin.path}" of ${repository.name}`,
    );
  }

  return {
    name: offer.name,
    source: gitPluginSource(offer, repository, host, plugin.path),
    ...(offer.dependencies === undefined ? {} : { dependencies: offer.dependencies }),
  };
}

function gitPluginSource(
  offer: GitPluginOffer,
  repository: GitPluginRepository,
  host: GitRepositoryHost,
  pluginPath: string,
): GitPluginSource {
  const sha = offer.pinned ? { sha: latestRevision(repository) } : {};
  const url = host.repositoryUrl(repository.name, repository.owner);
  switch (offer.kind) {
    case "github":
      return {
        source: offer.kind,
        repo: host.repositoryShorthand(repository.name, repository.owner),
        ...sha,
      };
    case "url":
      return { source: offer.kind, url, ...sha };
    case "git-subdir":
      return { source: offer.kind, url, path: pluginPath, ...sha };
    case "ssh":
      return {
        source: "url",
        url: `git@${SSH_SOURCE_HOST}:${repository.owner}/${repository.name}.git`,
        ...sha,
      };
    case "github ssh":
      return {
        source: "url",
        url: `${GITHUB_SSH_SOURCE_PREFIX}${repository.owner}/${repository.name}.git`,
        ...sha,
      };
  }
}

/**
 * Returns the manifest text `text` with `entries` among its plugins. An entry
 * replaces the plugin of the same name and is appended otherwise, so one
 * marketplace can offer path and git plugins together.
 */
export function offerGitPlugins(text: string, entries: readonly GitPluginEntry[]): string {
  const manifest = JSON.parse(text) as { plugins: Array<{ name: string }> };
  for (const entry of entries) {
    const index = manifest.plugins.findIndex((plugin) => plugin.name === entry.name);
    if (index === -1) {
      manifest.plugins.push(entry);
    } else {
      manifest.plugins[index] = entry;
    }
  }

  return JSON.stringify(manifest);
}

/**
 * A plugin a url marketplace offers from its own repository (D-SEED-01): its
 * name and version, the url its entry names, which may end in `.git`, `/`, or
 * both, and whether the entry pins the marketplace's latest commit.
 */
export interface OwnRepositoryOffer {
  readonly name: string;
  readonly version: string;
  readonly url: string;
  readonly pinned: boolean;
}

const OWN_REPOSITORY_COLUMNS = ["name", "version", "url", "pinned"] as const;

/**
 * Reads a `| name | version | url | pinned |` table of plugins a marketplace
 * offers from its own repository (D-SEED-01), throwing on a missing or unknown
 * column and on a pinned cell other than `true` and `false`. The url keeps its
 * run tokens.
 */
export function readOwnRepositoryOffers(table: DataTable): OwnRepositoryOffer[] {
  requireColumns(table, OWN_REPOSITORY_COLUMNS);
  return table.hashes().map((row) => ({
    name: String(row.name),
    version: String(row.version),
    url: String(row.url),
    pinned: parsePinned(String(row.pinned)),
  }));
}

/**
 * Returns the marketplace entry that offers `offer` from the marketplace's own
 * repository at `url`, as a `git-subdir` source at `plugins/<name>`, where the
 * marketplace keeps the plugin's files. A pinned offer carries `commit` as its
 * `sha`. The entry keeps the offer's version, so the install reports it
 * (D-SEED-01).
 */
export function ownRepositoryEntry(
  offer: OwnRepositoryOffer,
  url: string,
  commit: string,
): GitPluginEntry & { readonly version: string } {
  return {
    name: offer.name,
    version: offer.version,
    source: {
      source: "git-subdir",
      url,
      path: `plugins/${offer.name}`,
      ...(offer.pinned ? { sha: commit } : {}),
    },
  };
}
