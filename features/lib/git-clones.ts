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
 * repository (SG-HRN-01).
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
