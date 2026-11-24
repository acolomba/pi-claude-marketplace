/**
 * @fileoverview The git clones a scope holds.
 *
 * A scope keeps a clone of each git plugin repository it installs from under
 * `plugin-clones/`, and a clone of each git marketplace under `sources/`. A
 * plugin clone's directory name is its key: 12 hex digits of a hash of the
 * clone URL, followed by `-` and the first 12 hex digits of the commit for a
 * clone pinned to a commit (PURL-04, D-77-04), and alone for the mirror of an
 * unpinned source (MIRR-01). The URL hash covers the git host's random port,
 * so a clone is told apart by the `origin` URL its checkout records instead.
 *
 * Each clone is read with system git, pointed at the clone's own `.git` with
 * `--git-dir`, so a clone without one fails instead of git finding a parent
 * repository (SG-HRN-01). The same git gives a clone the local settings an
 * earlier version's clones carry, and reads them back (SG-MIG-01).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { runGit } from "./hermetic-git.ts";

/** One git clone of a scope: a plugin or marketplace clone, its origin URL, and its pin. */
export interface GitClone {
  readonly clone: "plugin" | "marketplace";
  readonly origin: string;
  /** The first 12 hex digits of the commit a plugin clone holds. */
  readonly revision?: string;
}

const MIRROR_KEY = /^[0-9a-f]{12}$/u;
const PINNED_KEY = /^[0-9a-f]{12}-([0-9a-f]{12})$/u;

// The directories `directory` holds; an absent directory holds none. Any
// other entry fails, so a stray file shows up.
async function subdirectories(directory: string): Promise<readonly string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    assert.ok(entry.isDirectory(), `${path.join(directory, entry.name)} is not a directory`);
  }

  return entries.map((entry) => entry.name);
}

// Runs system git on the repository in the `.git` of `checkout` alone.
function cloneGit(checkout: string, gitHome: string, ...args: string[]): Promise<string> {
  return runGit(checkout, gitHome, `--git-dir=${path.join(checkout, ".git")}`, ...args);
}

// The `origin` URL the clone at `checkout` records.
async function originUrl(checkout: string, gitHome: string): Promise<string> {
  try {
    return await cloneGit(checkout, gitHome, "config", "--get", "remote.origin.url");
  } catch (error) {
    // `git config --get` exits 1 when the key is unset.
    if (error instanceof Error && "code" in error && error.code === 1) {
      assert.fail(`${path.join(checkout, ".git", "config")} has no origin url`);
    }

    throw error;
  }
}

// The first 12 hex digits of the commit checked out at `checkout`.
async function headRevision(checkout: string, gitHome: string): Promise<string> {
  return (await cloneGit(checkout, gitHome, "rev-parse", "HEAD")).slice(0, 12);
}

async function pluginClone(
  clonesDirectory: string,
  key: string,
  gitHome: string,
): Promise<GitClone> {
  const checkout = path.join(clonesDirectory, key);
  const origin = await originUrl(checkout, gitHome);
  if (MIRROR_KEY.test(key)) {
    return { clone: "plugin", origin, revision: await headRevision(checkout, gitHome) };
  }

  const pin = PINNED_KEY.exec(key)?.[1];
  if (pin === undefined) {
    assert.fail(`${path.join(clonesDirectory, key)} is not named by a plugin clone key`);
  }

  return { clone: "plugin", origin, revision: pin };
}

/**
 * SG-MIG-01, D-SG-11: the local git settings of a clone that `isomorphic-git`
 * made, as an earlier version of the extension made every clone. System git
 * writes a link that it checks out into such a clone as a text file.
 */
export const EARLIER_VERSION_GIT_SETTINGS: Readonly<Record<string, string>> = {
  "core.symlinks": "false",
  "core.ignorecase": "true",
  "core.filemode": "false",
  "remote.origin.fetch": "+refs/heads/*:refs/remotes/origin/*",
};

// The values the local config of the clone at `checkout` holds for `key`,
// one per line; an unset key holds none.
async function localSetting(checkout: string, gitHome: string, key: string): Promise<string> {
  try {
    return await cloneGit(checkout, gitHome, "config", "--local", "--get-all", key);
  } catch (error) {
    // `git config --get-all` exits 1 when the key is unset.
    if (error instanceof Error && "code" in error && error.code === 1) {
      return "";
    }

    throw error;
  }
}

/**
 * Returns the local values the clone at `checkout` holds for each key of
 * `EARLIER_VERSION_GIT_SETTINGS`, an empty text for an unset key. Each git runs
 * with the scratch HOME `gitHome`.
 */
export async function readEarlierVersionGitSettings(
  checkout: string,
  gitHome: string,
): Promise<Record<string, string>> {
  const keys = Object.keys(EARLIER_VERSION_GIT_SETTINGS);
  const values = await Promise.all(keys.map((key) => localSetting(checkout, gitHome, key)));
  return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
}

/**
 * Writes `EARLIER_VERSION_GIT_SETTINGS` into the local config of the clone at
 * `checkout`, replacing every value a key had, as an earlier version left a
 * clone it made. Returns the values the clone then holds. Each git runs with
 * the scratch HOME `gitHome`.
 */
export async function giveEarlierVersionGitSettings(
  checkout: string,
  gitHome: string,
): Promise<Record<string, string>> {
  for (const [key, value] of Object.entries(EARLIER_VERSION_GIT_SETTINGS)) {
    // One writer at a time: git config refuses a second while one holds the lock.
    await cloneGit(checkout, gitHome, "config", "--local", "--replace-all", key, value);
  }

  return readEarlierVersionGitSettings(checkout, gitHome);
}

/**
 * Returns the git clones under the extension root `extensionRoot` of a scope:
 * each directory under `plugin-clones/`, which must be named by a clone key,
 * and each directory under `sources/` that holds a `.git` directory. Fails
 * when a clone records no origin URL. Each git runs with the scratch HOME
 * `gitHome`.
 */
export async function readGitClones(extensionRoot: string, gitHome: string): Promise<GitClone[]> {
  const clonesDirectory = path.join(extensionRoot, "plugin-clones");
  const sourcesDirectory = path.join(extensionRoot, "sources");
  const stagingDirectory = path.join(extensionRoot, "sources-staging");
  assert.deepStrictEqual(
    await subdirectories(stagingDirectory),
    [],
    `${stagingDirectory} holds unfinished clone staging directories`,
  );
  const pluginClones = await Promise.all(
    (await subdirectories(clonesDirectory)).map((key) =>
      pluginClone(clonesDirectory, key, gitHome),
    ),
  );
  const marketplaceCheckouts = (await subdirectories(sourcesDirectory)).map((name) =>
    path.join(sourcesDirectory, name),
  );
  const marketplaceClones = await Promise.all(
    marketplaceCheckouts.map(async (checkout): Promise<GitClone> => ({
      clone: "marketplace",
      origin: await originUrl(checkout, gitHome),
    })),
  );
  return [...pluginClones, ...marketplaceClones];
}
