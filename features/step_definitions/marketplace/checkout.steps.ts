/**
 * @fileoverview Steps about the marketplace checkouts a scope holds.
 *
 * An add stages its checkout under `sources-staging/` and moves it to
 * `sources/` once it succeeds (FLR-03). A partial checkout may hold no `.git`
 * directory, so the git clone steps cannot see it; the checkout step reads
 * both directories whole. The record step separately proves a failed add did
 * not retain a marketplace entry in state.json.
 *
 * The setup steps also plant a checkout that an interrupted add left, with
 * the ownership marker and a stale file (MA-12), and a read step lists the
 * files a checkout holds outside `.git/`. A setup step also plants a
 * directory of the user's own at a checkout path (MA-13).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

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

Given(
  "the {word} scope has lost the checkout of the marketplace {string}",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    assert.equal((await stat(checkout)).isDirectory(), true);
    await rm(checkout, { recursive: true });
    assert.equal(existsSync(checkout), false);
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
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    assert.equal((await stat(checkout)).isDirectory(), true);
    const entries = await readdir(checkout, { recursive: true, withFileTypes: true });
    const rows = entries
      .filter((entry) => !entry.isDirectory())
      .map((entry) =>
        path.relative(checkout, path.join(entry.parentPath, entry.name)).split(path.sep),
      )
      .filter((segments) => segments[0] !== ".git")
      .map((segments) => segments.join("/"))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => [file]);
    assert.deepStrictEqual([["file"], ...rows], table.raw());
  },
);
