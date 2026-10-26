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
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** One git clone of a scope: a plugin or marketplace clone, its origin URL, and its pin. */
export interface GitClone {
  readonly clone: "plugin" | "marketplace";
  readonly origin: string;
  /** The first 12 hex digits of the commit a pinned plugin clone holds. */
  readonly pin?: string;
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

// The `url` of `[remote "origin"]` in the `.git/config` of `checkout`.
async function originUrl(checkout: string): Promise<string> {
  const file = path.join(checkout, ".git", "config");
  const config = await readFile(file, "utf8");
  let inOrigin = false;
  for (const rawLine of config.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("[")) {
      inOrigin = line === '[remote "origin"]';
    } else if (inOrigin && line.startsWith("url")) {
      const [, url = ""] = /^url\s*=(.*)$/u.exec(line) ?? [];
      if (url.trim() !== "") {
        return url.trim();
      }
    }
  }

  assert.fail(`${file} has no origin url: ${config}`);
}

async function pluginClone(clonesDirectory: string, key: string): Promise<GitClone> {
  const origin = await originUrl(path.join(clonesDirectory, key));
  if (MIRROR_KEY.test(key)) {
    return { clone: "plugin", origin };
  }

  const pin = PINNED_KEY.exec(key)?.[1];
  if (pin === undefined) {
    assert.fail(`${path.join(clonesDirectory, key)} is not named by a plugin clone key`);
  }

  return { clone: "plugin", origin, pin };
}

/**
 * Returns the git clones under the extension root `extensionRoot` of a scope:
 * each directory under `plugin-clones/`, which must be named by a clone key,
 * and each directory under `sources/` that holds a `.git` directory. Fails
 * when a clone records no origin URL.
 */
export async function readGitClones(extensionRoot: string): Promise<GitClone[]> {
  const clonesDirectory = path.join(extensionRoot, "plugin-clones");
  const sourcesDirectory = path.join(extensionRoot, "sources");
  const pluginClones = await Promise.all(
    (await subdirectories(clonesDirectory)).map((key) => pluginClone(clonesDirectory, key)),
  );
  const marketplaceCheckouts = (await subdirectories(sourcesDirectory))
    .map((name) => path.join(sourcesDirectory, name))
    .filter((checkout) => existsSync(path.join(checkout, ".git")));
  const marketplaceClones = await Promise.all(
    marketplaceCheckouts.map(async (checkout): Promise<GitClone> => ({
      clone: "marketplace",
      origin: await originUrl(checkout),
    })),
  );
  return [...pluginClones, ...marketplaceClones];
}
