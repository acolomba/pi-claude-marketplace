/**
 * @fileoverview A marketplace published as one source kind.
 *
 * The dir and file kinds write the path fixture under the sandbox HOME
 * (D-04). The url and github kinds write the same files in a work tree there
 * and publish them as a commit in a bare repository that the run's git host
 * serves. Every later change to a git marketplace writes the work tree the
 * same way and pushes a new commit, so Pi sees it through a clone or fetch
 * (HOST-01). The github kind publishes the same way; its source is the
 * `owner/repo` shorthand, which the GitHub base override sends to the git
 * host (GHB-01).
 */

import assert from "node:assert/strict";
import { rm, stat, writeFile } from "node:fs/promises";
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
export type SourceKind = "dir" | "file" | "url" | "github";

const SOURCE_KINDS: readonly SourceKind[] = ["dir", "file", "url", "github"];

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

/** The git host as the publishing code needs it: where it keeps and serves repositories. */
export interface GitRepositoryHost {
  /** Returns the bare repository the host serves for `directory`. */
  repositoryPath(directory: string): string;
  /** Returns the URL a user types to clone the repository `directory`. */
  repositoryUrl(directory: string): string;
  /** Returns the `owner/repo` shorthand a user types for the repository `directory`. */
  repositoryShorthand(directory: string): string;
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
 * holds its files, `repository` the directory the git host serves it under
 * `acme/`, and `bareRepository` the repository the host serves. `gitHome` is
 * the HOME of the git that commits and publishes it.
 */
export interface GitPublication {
  readonly kind: "url" | "github";
  readonly root: string;
  readonly source: string;
  readonly manifestPath: string;
  readonly repository: string;
  readonly bareRepository: string;
  readonly gitHome: string;
}

/** A published marketplace of any source kind. */
export type PublishedMarketplace = PathPublication | GitPublication;

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
 * repository the git host serves.
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
 * as a commit in a bare repository on the git host, so neither may exist.
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
 * inside `.claude-plugin/` (D-04).
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
 * kind, `directory` is the repository the git host serves (ADD-04).
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
        repository: directory,
        bareRepository,
        gitHome: gitHost.gitHome,
      };
    }
  }
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
 * host answers a clone or fetch of it with 404.
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
  switch (published.kind) {
    case "dir":
    case "file": {
      const file = ownedTarget(
        published,
        path.join(published.root, "plugins", plugin, "skills", `${plugin}-skill`, "notes.md"),
      );
      await writeFile(file, "Unreadable.\n", { mode: 0o000 });
      return file;
    }

    case "url":
    case "github":
      throw new Error("a git repository cannot hold a file nobody may read");
  }
}

/**
 * Writes `text` to `file` inside the published plugin `plugin`, which must
 * not hold that file yet. It refuses a path outside the publication, and a
 * git publication commits and pushes the new file.
 */
export async function writePublishedPluginFile(
  published: PublishedMarketplace,
  plugin: string,
  file: string,
  text: string,
): Promise<void> {
  const target = ownedTarget(published, path.join(published.root, "plugins", plugin, file));
  await changePublication(published, () => writeFile(target, text, { flag: "wx" }));
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
 * marketplace `published` records, leaving `main` as it is (D-02). A local
 * publication has no branch.
 */
export async function describeMarketplaceBranch(
  published: PublishedMarketplace,
  branch: string,
  description: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      throw new Error(`a ${published.kind} publication has no branch`);
    case "url":
    case "github":
      await pushGitBranch(published.root, published.gitHome, branch, () =>
        writeMarketplaceDescription(published.manifestPath, description),
      );
      return;
  }
}
