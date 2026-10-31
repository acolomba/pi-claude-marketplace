/**
 * @fileoverview Steps about the marketplace checkouts a scope holds.
 *
 * An add stages its checkout under `sources-staging/` and moves it to
 * `sources/` once it succeeds (FLR-03). A partial checkout may hold no `.git`
 * directory, so the git clone steps cannot see it; the checkout step reads
 * both directories whole. The record step separately proves a failed add did
 * not retain a marketplace entry in state.json.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

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
