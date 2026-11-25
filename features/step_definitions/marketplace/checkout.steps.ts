/**
 * @fileoverview Steps about the marketplace checkouts a scope holds.
 *
 * An add stages its checkout under `sources-staging/` and moves it to
 * `sources/` once it succeeds (FLR-03). A partial checkout may hold no `.git`
 * directory, so the git clone steps cannot see it; the checkout step reads
 * both directories whole. The record step separately proves a failed add did
 * not retain a marketplace entry in state.json. An update moves a checkout
 * aside to `sources-backup/` before its new clone moves in (D-SG-10), so the
 * read-only folder steps make that move fail and let it succeed again, and the
 * interrupted-update step leaves a checkout there with no live checkout. The
 * earlier-version steps give a checkout the git settings of a clone that an
 * earlier version made with `isomorphic-git`, and find them kept (SG-MIG-01).
 *
 * The setup steps also plant a checkout that an interrupted add left, with
 * the ownership marker and a stale file (MA-12), and a read step lists the
 * files a checkout holds outside `.git/`. A setup step also plants a
 * directory of the user's own at a checkout path (MA-13). A refused add must
 * leave that directory exactly as it was, so one read step lists every entry
 * it holds, directories and `.git/` included, with the text of each file, and
 * another proves the refusal removed the clone it staged first.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import {
  EARLIER_VERSION_GIT_SETTINGS,
  giveEarlierVersionGitSettings,
  readEarlierVersionGitSettings,
} from "../../lib/git-clones.ts";
import { runGit } from "../../lib/hermetic-git.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The entry names of `directory`; an absent directory holds none.
async function entryNames(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  return (await readdir(directory)).sort((left, right) => left.localeCompare(right));
}

// The directory under which the scope keeps its marketplace checkouts.
function extensionRootOf(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}

// Every entry under the checkout of the marketplace `name`, as its absolute
// path and its path segments under the checkout; the checkout itself must be
// a directory.
async function checkoutEntries(
  world: ScenarioWorld,
  name: string,
  scope: string,
): Promise<{ absolutePath: string; segments: string[]; isDirectory: boolean }[]> {
  const checkout = path.join(extensionRootOf(world, scope), "sources", name);
  assert.equal((await stat(checkout)).isDirectory(), true);
  const entries = await readdir(checkout, { recursive: true, withFileTypes: true });
  return entries.map((entry) => {
    const absolutePath = path.join(entry.parentPath, entry.name);
    return {
      absolutePath,
      segments: path.relative(checkout, absolutePath).split(path.sep),
      isDirectory: entry.isDirectory(),
    };
  });
}

// One table row per path, in path order.
function pathRows(paths: readonly string[]): string[][] {
  return [...paths].sort((left, right) => left.localeCompare(right)).map((entry) => [entry]);
}

Given(
  "the {word} scope has lost the checkout of the marketplace {string}",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    assert.equal((await stat(checkout)).isDirectory(), true);
    await rm(checkout, { recursive: true });
    assert.equal(existsSync(checkout), false);
  },
);

// D-SG-10 / NFR-3: an update moves the checkout to `sources-backup/<name>`
// before its new clone moves in. An update interrupted between the two moves
// leaves the checkout there and no live checkout.
Given(
  "an update of the marketplace {string} in the {word} scope was interrupted after it moved the checkout aside",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    const backup = path.join(extensionRootOf(this, scope), "sources-backup", name);
    assert.equal(existsSync(backup), false);
    await mkdir(path.dirname(backup), { recursive: true });
    await rename(checkout, backup);
    assert.deepStrictEqual(
      {
        checkout: existsSync(checkout),
        backupManifest: existsSync(path.join(backup, ".claude-plugin", "marketplace.json")),
      },
      { checkout: false, backupManifest: true },
    );
  },
);

// The checkout of the marketplace `name` in the scope `scope`.
function checkoutOf(world: ScenarioWorld, scope: string, name: string): string {
  return path.join(extensionRootOf(world, scope), "sources", name);
}

// SG-MIG-01, D-SG-11: an `isomorphic-git` clone records `core.symlinks=false`,
// `core.ignorecase=true`, `core.filemode=false`, and the wildcard fetch refspec
// `+refs/heads/*:refs/remotes/origin/*` in its own config.
Given(
  "the checkout of the marketplace {string} in the {word} scope has the git settings an earlier version made",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const checkout = checkoutOf(this, scope, name);
    assert.deepStrictEqual(
      await giveEarlierVersionGitSettings(checkout, this.gitHost.gitHome),
      EARLIER_VERSION_GIT_SETTINGS,
    );
  },
);

// The folder that holds the scope's marketplace checkouts. A checkout moves
// out of it only when the folder is writable.
function checkoutsFolderOf(world: ScenarioWorld, scope: string): string {
  return path.join(extensionRootOf(world, scope), "sources");
}

// The error a call that must fail gave, or a failed step when it succeeded.
async function failureOf(call: Promise<void>, what: string): Promise<NodeJS.ErrnoException> {
  return call.then(
    () => assert.fail(`${what} did not fail`),
    (reason: unknown) => reason as NodeJS.ErrnoException,
  );
}

// D-SG-10: an update moves the checkout to `sources-backup/<name>` before its
// new clone moves in. With the folder read-only, that rename fails with
// EACCES. The step makes the same rename and records its message, and a run
// whose user bypasses permission bits fails here rather than passing.
Given(
  "the folder that holds the checkout of the marketplace {string} in the {word} scope is read-only",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const folder = checkoutsFolderOf(this, scope);
    const backupFolder = path.join(extensionRootOf(this, scope), "sources-backup");
    assert.equal((await stat(path.join(folder, name))).isDirectory(), true);
    await mkdir(backupFolder, { recursive: true });
    await chmod(folder, 0o555);
    this.onRelease(() => chmod(folder, 0o755));
    assert.strictEqual((await stat(folder)).mode & 0o777, 0o555);
    const createError = await failureOf(
      writeFile(path.join(folder, "write-probe"), ""),
      "creating a file in the read-only checkout folder",
    );
    assert.deepStrictEqual([createError.code, createError.syscall], ["EACCES", "open"]);
    const renameError = await failureOf(
      rename(path.join(folder, name), path.join(backupFolder, name)),
      "moving the checkout out of the read-only checkout folder",
    );
    assert.deepStrictEqual([renameError.code, renameError.syscall], ["EACCES", "rename"]);
    this.recordErrorMessage("{read-only checkout folder rename error}", renameError.message);
  },
);

When(
  "the folder that holds the checkout of the marketplace {string} in the {word} scope becomes writable again",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const folder = checkoutsFolderOf(this, scope);
    await chmod(folder, 0o755);
    assert.strictEqual((await stat(folder)).mode & 0o777, 0o755);
    assert.equal((await stat(path.join(folder, name))).isDirectory(), true);
  },
);

// APL-D1, NFR-5: a load repairs no clone, so the settings stay until an update
// clones the marketplace again.
Then(
  "the checkout of the marketplace {string} in the {word} scope keeps the git settings an earlier version made",
  async function (this: ScenarioWorld, name: string, scope: string) {
    assert.deepStrictEqual(
      await readEarlierVersionGitSettings(checkoutOf(this, scope, name), this.gitHost.gitHome),
      EARLIER_VERSION_GIT_SETTINGS,
    );
  },
);

Given(
  "the {word} scope holds a checkout of the marketplace {string} that an interrupted add left",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const published = this.requirePublished(name);
    if (published.kind !== "url") {
      assert.fail(`the marketplace ${name} is not published as a url source`);
    }

    const sources = path.join(extensionRootOf(this, scope), "sources");
    const checkout = path.join(sources, name);
    assert.equal(existsSync(checkout), false);
    await mkdir(sources, { recursive: true });
    await runGit(sources, published.gitHome, "clone", "--quiet", published.bareRepository, name);
    await runGit(checkout, published.gitHome, "remote", "set-url", "origin", published.source);
    // Q-01: the ownership marker `marketplace add` writes into every clone it creates.
    const marker = path.join(checkout, ".git", "pi-claude-marketplace.json");
    await writeFile(marker, JSON.stringify({ generatedBy: "pi-claude-marketplace" }));
    await writeFile(path.join(checkout, "stale.txt"), "left behind");
    assert.equal(
      await runGit(checkout, published.gitHome, "remote", "get-url", "origin"),
      published.source,
    );
    assert.equal(existsSync(marker), true);
  },
);

Given(
  "the {word} scope holds a directory of the user's own where the checkout of the marketplace {string} goes",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    assert.equal(existsSync(checkout), false);
    await mkdir(checkout, { recursive: true });
    await writeFile(path.join(checkout, "notes.txt"), "the user's notes");
    assert.deepStrictEqual(await readdir(checkout), ["notes.txt"]);
  },
);

Then(
  "the {word} scope holds no marketplace checkout",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = extensionRootOf(this, scope);
    assert.deepStrictEqual(
      {
        sources: await entryNames(path.join(extensionRoot, "sources")),
        "sources-staging": await entryNames(path.join(extensionRoot, "sources-staging")),
      },
      { sources: [], "sources-staging": [] },
    );
  },
);

Then(
  "the {word} scope holds no staged marketplace checkout",
  async function (this: ScenarioWorld, scope: string) {
    const staging = path.join(extensionRootOf(this, scope), "sources-staging");
    assert.deepStrictEqual(await entryNames(staging), []);
  },
);

Then(
  "the {word} scope holds no marketplace record",
  async function (this: ScenarioWorld, scope: string) {
    const stateFile = path.join(extensionRootOf(this, scope), "state.json");
    if (!existsSync(stateFile)) {
      return;
    }

    const state = JSON.parse(await readFile(stateFile, "utf8")) as { marketplaces?: unknown };
    assert.deepStrictEqual(state.marketplaces ?? {}, {});
  },
);

Then(
  "the checkout of the marketplace {string} in the {word} scope holds these files:",
  async function (this: ScenarioWorld, name: string, scope: string, table: DataTable) {
    const files = (await checkoutEntries(this, name, scope))
      .filter((entry) => !entry.isDirectory && entry.segments[0] !== ".git")
      .map((entry) => entry.segments.join("/"));
    assert.deepStrictEqual([["file"], ...pathRows(files)], table.raw());
  },
);

// A directory reads as its path and a trailing `/` with no content, so a new
// empty directory, such as a `.git/` an add began, changes the list. A file
// reads as its path and its text, so an overwritten or truncated file does too.
Then(
  "the checkout of the marketplace {string} in the {word} scope holds exactly these entries:",
  async function (this: ScenarioWorld, name: string, scope: string, table: DataTable) {
    const rows = await Promise.all(
      (await checkoutEntries(this, name, scope)).map(async (entry): Promise<[string, string]> => {
        const entryPath = entry.segments.join("/");
        if (entry.isDirectory) {
          return [`${entryPath}/`, ""];
        }

        return [entryPath, await readFile(entry.absolutePath, "utf8")];
      }),
    );
    rows.sort(([left], [right]) => left.localeCompare(right));
    assert.deepStrictEqual([["entry", "content"], ...rows], table.raw());
  },
);
