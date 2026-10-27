/**
 * @fileoverview A marketplace published as one source kind.
 *
 * The dir and file kinds write the path fixture under the sandbox HOME. The
 * url and github kinds write the same files in a work tree there and publish
 * them as a commit in a bare repository that the run's git host serves. Every
 * later change to a git marketplace writes the work tree the same way and
 * pushes a new commit, so Pi sees it through a clone or fetch (HOST-01). The
 * github kind publishes the same way; its source is the `owner/repo`
 * shorthand, which the GitHub base override sends to the git host (GHB-01).
 * The hosted kind writes the same files in a work tree there and has the git
 * host serve its manifest as one catalog file at an https URL; every later
 * change to it serves the manifest's new bytes again (D-PL5-06).
 */

import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { publishGitRepository, pushGitBranch, pushGitRepository } from "./git-marketplace.ts";
import {
  writeDependencyAllowance,
  writeInvalidManifest,
  writeMalformedManifest,
  writeManifestText,
  writeMarketplace,
  writeMarketplaceDescription,
} from "./path-marketplace.ts";

import type { OfferedPlugin } from "./path-marketplace.ts";

/** A kind of source a marketplace is published as. */
export type SourceKind = "dir" | "file" | "url" | "github" | "hosted";

const SOURCE_KINDS: readonly SourceKind[] = ["dir", "file", "url", "github", "hosted"];

// The file a hosted marketplace's manifest is served as, unless a scenario names another.
const HOSTED_MANIFEST = "marketplace.json";

/**
 * A way a manifest is broken: JSON that does not parse, or JSON that breaks
 * the manifest schema.
 */
export type ManifestProblem = "malformed" | "schema-invalid";

const MANIFEST_WRITERS: Readonly<
  Record<ManifestProblem, (manifestFile: string, name: string) => Promise<void>>
> = {
  malformed: writeMalformedManifest,
  "schema-invalid": writeInvalidManifest,
};

/**
 * The git host as the publishing code needs it: where it keeps and serves
 * repositories, and the catalog files it serves. A repository or a file
 * belongs to an owner, the host's default owner when a caller names none.
 */
export interface GitRepositoryHost {
  /** Returns the bare repository the host serves for `directory` of `owner`. */
  repositoryPath(directory: string, owner?: string): string;
  /** Returns the URL a user types to clone the repository `directory` of `owner`. */
  repositoryUrl(directory: string, owner?: string): string;
  /** Returns the `owner/repo` shorthand a user types for the repository `directory` of `owner`. */
  repositoryShorthand(directory: string, owner?: string): string;
  /** Serves `bytes` as the file `file` of `directory` of `owner`, replacing any bytes served there. */
  serveFile(directory: string, file: string, bytes: Buffer, owner?: string): void;
  /** Returns the URL a user types to read the file `file` of `directory` of `owner`. */
  fileUrl(directory: string, file: string, owner?: string): string;
  /** The owner a repository is served under when a caller names none. */
  readonly defaultOwner: string;
  /** The scratch HOME of every git that writes the host's repositories. */
  readonly gitHome: string;
}

/** Where marketplaces are published: local directories and the run's git host. */
export interface PublicationSites {
  readonly marketplacesRoot: string;
  readonly gitHost: GitRepositoryHost;
}

/**
 * A marketplace published as a local path: its kind, the directory it is
 * published in, the source a user types to add it, and its manifest.
 */
export interface PathPublication {
  readonly kind: "dir" | "file";
  readonly root: string;
  readonly source: string;
  readonly manifestPath: string;
}

/**
 * A marketplace published as a git repository: `root` is the work tree that
 * holds its files, `owner` and `repository` the owner and directory the git
 * host serves it under, and `bareRepository` the repository the host serves.
 * `gitHome` is the HOME of the git that commits and publishes it.
 */
export interface GitPublication {
  readonly kind: "url" | "github";
  readonly root: string;
  readonly source: string;
  readonly manifestPath: string;
  readonly owner: string;
  readonly repository: string;
  readonly bareRepository: string;
  readonly gitHome: string;
}

/**
 * A marketplace published as one catalog file the git host serves: `root` is
 * the work tree that holds its files, and `owner` and `directory` are where
 * the host serves its manifest as `file`. `host` serves the manifest again
 * after every change.
 */
export interface HostedPublication {
  readonly kind: "hosted";
  readonly root: string;
  readonly source: string;
  readonly manifestPath: string;
  readonly owner: string;
  readonly directory: string;
  readonly file: string;
  readonly host: Pick<GitRepositoryHost, "serveFile">;
}

/** A published marketplace of any source kind. */
export type PublishedMarketplace = PathPublication | GitPublication | HostedPublication;

/** Has the git host serve the manifest of `published` as it is in the work tree now. */
async function serveHostedManifest(published: HostedPublication): Promise<void> {
  const bytes = await readFile(published.manifestPath);
  published.host.serveFile(published.directory, published.file, bytes, published.owner);
}

/** Returns the source kind `text` names, throwing on any other text. */
export function parseSourceKind(text: string): SourceKind {
  const kind = SOURCE_KINDS.find((candidate) => candidate === text);
  if (kind === undefined) {
    throw new Error(`unknown source kind "${text}"; expected one of ${SOURCE_KINDS.join(", ")}`);
  }

  return kind;
}

/**
 * Runs `write`, which changes the files of `published`. For a git
 * publication, it then commits the change and pushes it to the bare
 * repository the git host serves. For a hosted publication, it serves the
 * manifest's new bytes.
 */
async function changePublication(
  published: PublishedMarketplace,
  write: () => Promise<void>,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await write();
      return;
    case "url":
    case "github":
      await write();
      await pushGitRepository(published.root, published.gitHome);
      return;
    case "hosted":
      await write();
      await serveHostedManifest(published);
      return;
  }
}

async function requireAbsent(location: string, directory: string): Promise<void> {
  await assert.rejects(
    stat(location),
    { code: "ENOENT" },
    `${directory} already holds a marketplace`,
  );
}

/**
 * Returns the directory that a `kind` marketplace published in `directory`
 * lives in, failing when a marketplace is published there already. A git
 * marketplace lives in a work tree under the marketplaces root and is served
 * as a commit in a bare repository on the git host, so neither may exist. A
 * hosted marketplace lives in a work tree under the marketplaces root.
 */
export async function requireFreeRoot(
  sites: PublicationSites,
  directory: string,
  kind: SourceKind,
): Promise<string> {
  const root = path.join(sites.marketplacesRoot, directory);
  switch (kind) {
    case "dir":
    case "file":
    case "hosted":
      await requireAbsent(root, directory);
      return root;
    case "url":
    case "github":
      await requireAbsent(root, directory);
      await requireAbsent(sites.gitHost.repositoryPath(directory), directory);
      return root;
  }
}

/**
 * Publishes the marketplace `name` at `sites` as a `kind` source offering
 * `plugins`, in a directory of its own name. A file source is the manifest
 * inside `.claude-plugin/`.
 */
export function publishMarketplace(
  sites: PublicationSites,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  return publishMarketplaceIn(sites, name, name, kind, plugins);
}

/**
 * Publishes a marketplace whose manifest declares `name` in the directory
 * `directory` at `sites`, as a `kind` source offering `plugins`. For a git
 * kind, `directory` is the repository the git host serves (ADD-04). For the
 * hosted kind, the git host serves the manifest as
 * `<directory>/marketplace.json` under its default owner.
 */
export async function publishMarketplaceIn(
  sites: PublicationSites,
  directory: string,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  const root = path.join(sites.marketplacesRoot, directory);
  const manifestPath = path.join(root, ".claude-plugin", "marketplace.json");
  switch (kind) {
    case "dir":
      await writeMarketplace(root, name, plugins, manifestPath);
      return { kind, root, source: root, manifestPath };
    case "file":
      await writeMarketplace(root, name, plugins, manifestPath);
      return { kind, root, source: manifestPath, manifestPath };
    case "url":
    case "github": {
      const { gitHost } = sites;
      const bareRepository = gitHost.repositoryPath(directory);
      await writeMarketplace(root, name, plugins, manifestPath);
      await publishGitRepository(root, bareRepository, gitHost.gitHome);
      return {
        kind,
        root,
        source:
          kind === "url"
            ? gitHost.repositoryUrl(directory)
            : gitHost.repositoryShorthand(directory),
        manifestPath,
        owner: gitHost.defaultOwner,
        repository: directory,
        bareRepository,
        gitHome: gitHost.gitHome,
      };
    }

    case "hosted":
      return publishHosted(sites, directory, name, plugins, HOSTED_MANIFEST);
  }
}

/**
 * Publishes the marketplace `name` in `directory` at `sites` as a hosted
 * catalog offering `plugins`, which the git host serves as
 * `<directory>/<file>` under its default owner.
 */
async function publishHosted(
  sites: PublicationSites,
  directory: string,
  name: string,
  plugins: readonly OfferedPlugin[],
  file: string,
): Promise<HostedPublication> {
  const { gitHost } = sites;
  const root = path.join(sites.marketplacesRoot, directory);
  const manifestPath = path.join(root, ".claude-plugin", "marketplace.json");
  await writeMarketplace(root, name, plugins, manifestPath);
  const published: HostedPublication = {
    kind: "hosted",
    root,
    source: gitHost.fileUrl(directory, file),
    manifestPath,
    owner: gitHost.defaultOwner,
    directory,
    file,
    host: gitHost,
  };
  await serveHostedManifest(published);
  return published;
}

/**
 * Publishes the marketplace `name` at `sites` as a hosted catalog that offers
 * no plugin, which the git host serves as `<name>/<file>`.
 */
export function publishHostedMarketplace(
  sites: PublicationSites,
  name: string,
  file: string,
): Promise<HostedPublication> {
  return publishHosted(sites, name, name, [], file);
}

// The GitHub organization Claude Code reserves its official marketplace names
// for, and the official marketplace `bootstrap` adds from it.
const ANTHROPICS_OWNER = "anthropics";
const OFFICIAL_NAME = "claude-plugins-official";

/**
 * Publishes the marketplace `name` at `sites` as a github source that offers
 * no plugin, served by the git host as `anthropics/<name>`, so it may declare
 * a name Claude Code reserves for that organization. It fails when its work
 * tree or its repository exists already.
 */
export async function publishAnthropicsMarketplace(
  sites: PublicationSites,
  name: string,
): Promise<GitPublication> {
  const { gitHost } = sites;
  const root = path.join(sites.marketplacesRoot, name);
  const manifestPath = path.join(root, ".claude-plugin", "marketplace.json");
  const bareRepository = gitHost.repositoryPath(name, ANTHROPICS_OWNER);
  await requireAbsent(root, name);
  await requireAbsent(bareRepository, `${ANTHROPICS_OWNER}/${name}`);
  await writeMarketplace(root, name, [], manifestPath);
  await publishGitRepository(root, bareRepository, gitHost.gitHome);
  return {
    kind: "github",
    root,
    source: gitHost.repositoryShorthand(name, ANTHROPICS_OWNER),
    manifestPath,
    owner: ANTHROPICS_OWNER,
    repository: name,
    bareRepository,
    gitHome: gitHost.gitHome,
  };
}

/**
 * Publishes the official marketplace `name` as `publishAnthropicsMarketplace`
 * does, served as `anthropics/claude-plugins-official`. It refuses any name
 * other than the one the official manifest declares.
 */
export async function publishOfficialMarketplace(
  sites: PublicationSites,
  name: string,
): Promise<GitPublication> {
  if (name !== OFFICIAL_NAME) {
    throw new Error(`the official marketplace is named ${OFFICIAL_NAME}, not ${name}`);
  }

  return publishAnthropicsMarketplace(sites, name);
}

/** Publishes a file source outside the conventional manifest directory. */
export async function publishExternalMarketplace(
  marketplacesRoot: string,
  name: string,
): Promise<PublishedMarketplace> {
  const root = path.join(marketplacesRoot, name);
  const manifestPath = path.join(root, "catalog", "marketplace.json");
  await writeMarketplace(root, name, [], manifestPath);
  return { kind: "file", root, source: manifestPath, manifestPath };
}

/** Publishes new offers at the recorded source without moving its manifest. */
export async function republishMarketplace(
  published: PublishedMarketplace,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  await changePublication(published, () =>
    writeMarketplace(published.root, name, plugins, published.manifestPath),
  );
}

/** Rewrites the exact published manifest with the supplied JSON text. */
export async function rewritePublishedManifest(
  published: PublishedMarketplace,
  text: string,
): Promise<void> {
  await changePublication(published, () => writeManifestText(published.manifestPath, text));
}

function ownedTarget(published: PublishedMarketplace, target: string): string {
  const root = path.resolve(published.root);
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  if (
    root === path.parse(root).root ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`refusing to change ${resolved} outside the published root ${root}`);
  }

  return resolved;
}

/**
 * Removes only the directory, exact manifest, or bare repository recorded for
 * this publication. Once a git publication's bare repository is gone, the git
 * host answers a clone or fetch of it with 404. A hosted publication refuses.
 */
export async function removePublishedSource(published: PublishedMarketplace): Promise<void> {
  switch (published.kind) {
    case "dir":
      await rm(ownedTarget(published, published.root), { recursive: true });
      return;
    case "file":
      await rm(ownedTarget(published, published.manifestPath));
      return;
    case "url":
    case "github":
      await rm(published.bareRepository, { recursive: true });
      return;
    case "hosted":
      throw new Error(
        "a served catalog has no source directory to remove; arm the git host instead",
      );
  }
}

/** Writes a visibly different conventional manifest beside an external file source. */
export async function publishConventionalDecoy(
  published: PublishedMarketplace,
  name: string,
): Promise<void> {
  if (published.kind !== "file") {
    throw new Error(`a ${published.kind} publication cannot have a file-source decoy`);
  }

  const conventionalPath = ownedTarget(
    published,
    path.join(published.root, ".claude-plugin", "marketplace.json"),
  );
  if (conventionalPath === path.resolve(published.manifestPath)) {
    throw new Error("the published manifest is already the conventional manifest");
  }

  await writeMarketplace(published.root, `${name}-decoy`, [], conventionalPath);
}

/**
 * Breaks the manifest of the marketplace `name` in the directory `published`
 * records, with `problem`: JSON that does not parse, or JSON that breaks the
 * manifest schema (ADD-07).
 */
export async function invalidateManifest(
  name: string,
  published: PublishedMarketplace,
  problem: ManifestProblem,
): Promise<void> {
  await changePublication(published, () => MANIFEST_WRITERS[problem](published.manifestPath, name));
}

/**
 * Takes away every permission on the manifest of a local publication, so
 * reading it fails with EACCES. Git stores no file mode that denies reading,
 * so a git publication refuses, and so does a hosted one, whose manifest the
 * git host serves from memory.
 */
export async function makeManifestUnreadable(published: PublishedMarketplace): Promise<void> {
  if (published.kind === "url" || published.kind === "github") {
    throw new Error("a git repository cannot hold a file nobody may read");
  }

  if (published.kind === "hosted") {
    throw new Error("a served catalog cannot hold a file nobody may read");
  }

  await chmod(published.manifestPath, 0o000);
}

/**
 * Adds a file nobody may read to the skill of the published plugin `plugin`,
 * and returns its path. Pi reads the plugin's manifest and dependencies as
 * usual, then fails to copy the skill when it stages the update. Only a local
 * publication can hold such a file: git stores no file mode that denies
 * reading.
 */
export async function publishUnreadableSkillFile(
  published: PublishedMarketplace,
  plugin: string,
): Promise<string> {
  const file = unreadableSkillFile(published, plugin);
  await writeFile(file, "Unreadable.\n", { mode: 0o000 });
  return file;
}

/**
 * Lets everyone read the file `publishUnreadableSkillFile` left in the plugin
 * `plugin` again, and returns its path.
 */
export async function restoreUnreadableSkillFile(
  published: PublishedMarketplace,
  plugin: string,
): Promise<string> {
  const file = unreadableSkillFile(published, plugin);
  await chmod(file, 0o644);
  return file;
}

/**
 * Copies the skill directory that holds the file `publishUnreadableSkillFile`
 * left in `plugin` into a new directory under `scratch`, as Pi stages a skill,
 * and returns the error the copy fails with. Each quoted path in its message
 * is cut to its last segment, as Pi shows a cause, so the message reads as
 * Pi reports the failed copy on this Node.
 */
export async function unreadableSkillCopyError(
  published: PublishedMarketplace,
  plugin: string,
  scratch: string,
): Promise<NodeJS.ErrnoException> {
  const skillDir = path.dirname(unreadableSkillFile(published, plugin));
  const error = await cp(skillDir, path.join(scratch, path.basename(skillDir)), {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    errorOnExist: true,
    force: false,
  }).then(
    () => assert.fail(`copying ${skillDir} did not fail`),
    (reason: unknown) => reason as NodeJS.ErrnoException,
  );
  error.message = error.message.replaceAll(
    /'([^']+)'/gu,
    (_quoted, quotedPath: string) => `'${path.basename(quotedPath)}'`,
  );
  return error;
}

// The skill file of `plugin` that `publishUnreadableSkillFile` writes.
function unreadableSkillFile(published: PublishedMarketplace, plugin: string): string {
  switch (published.kind) {
    case "dir":
    case "file":
      return ownedTarget(
        published,
        path.join(published.root, "plugins", plugin, "skills", `${plugin}-skill`, "notes.md"),
      );
    case "url":
    case "github":
      throw new Error("a git repository cannot hold a file nobody may read");
    case "hosted":
      throw new Error("a served catalog cannot hold a file nobody may read");
  }
}

/**
 * Deletes the directory of the published plugin `plugin`, which must exist,
 * as a marketplace does when it stops shipping a plugin. A git publication
 * commits and pushes the deletion.
 */
export async function removePublishedPlugin(
  published: PublishedMarketplace,
  plugin: string,
): Promise<void> {
  const target = ownedTarget(published, path.join(published.root, "plugins", plugin));
  await changePublication(published, () => rm(target, { recursive: true }));
}

/**
 * Writes `text` to `file` inside the published plugin `plugin`, which must
 * not hold that file yet, and creates the directories above it. It refuses a
 * path outside the publication, and a git publication commits and pushes the
 * new file.
 */
export async function writePublishedPluginFile(
  published: PublishedMarketplace,
  plugin: string,
  file: string,
  text: string,
): Promise<string> {
  const target = ownedTarget(published, path.join(published.root, "plugins", plugin, file));
  await changePublication(published, async () => {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text, { flag: "wx" });
  });
  return target;
}

/**
 * Gives the published plugin `plugin` an output style and returns the path
 * of its file. A plugin's `output-styles` directory holds its output styles,
 * a component Pi does not support, so the plugin becomes partially
 * available.
 */
export async function publishOutputStyle(
  published: PublishedMarketplace,
  plugin: string,
): Promise<string> {
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("output-styles", `${plugin}-style.md`),
    [
      "---",
      `name: ${plugin}-style`,
      `description: An output style of ${plugin}.`,
      "---",
      "",
      "Answer in short sentences.",
      "",
    ].join("\n"),
  );
}

/**
 * Deletes the `output-styles` directory of the published plugin `plugin`,
 * which must exist, and returns its path. Re-offering a plugin keeps the files
 * its directory already holds, so this is how a new version stops shipping
 * the output style an earlier one had. A git publication commits and pushes
 * the deletion.
 */
export async function removePublishedOutputStyle(
  published: PublishedMarketplace,
  plugin: string,
): Promise<string> {
  const target = ownedTarget(
    published,
    path.join(published.root, "plugins", plugin, "output-styles"),
  );
  await changePublication(published, () => rm(target, { recursive: true }));
  return target;
}

/**
 * Lets the plugins of the marketplace `published` records depend on plugins of
 * the marketplace `target`.
 */
export async function allowDependenciesOn(
  published: PublishedMarketplace,
  target: string,
): Promise<void> {
  await changePublication(published, () =>
    writeDependencyAllowance(published.manifestPath, target),
  );
}

/** Sets the description of the marketplace `published` records. */
export async function describeMarketplace(
  published: PublishedMarketplace,
  description: string,
): Promise<void> {
  await changePublication(published, () =>
    writeMarketplaceDescription(published.manifestPath, description),
  );
}

/**
 * Sets the description of the manifest on the branch `branch` of the git
 * marketplace `published` records, leaving `main` as it is (D-02). A local or
 * hosted publication has no branch.
 */
export async function describeMarketplaceBranch(
  published: PublishedMarketplace,
  branch: string,
  description: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
    case "hosted":
      throw new Error(`a ${published.kind} publication has no branch`);
    case "url":
    case "github":
      await pushGitBranch(published.root, published.gitHome, branch, () =>
        writeMarketplaceDescription(published.manifestPath, description),
      );
      return;
  }
}
