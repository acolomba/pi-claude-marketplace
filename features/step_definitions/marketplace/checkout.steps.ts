/**
 * @fileoverview Steps about the marketplace checkouts a scope holds.
 *
 * An add stages its checkout under `sources-staging/` and moves it to
 * `sources/` once it succeeds (FLR-03). A partial checkout may hold no `.git`
 * directory, so the git clone steps cannot see it; this step reads both
 * directories whole.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// The entry names of `directory`; an absent directory holds none.
async function entryNames(directory: string): Promise<string[]> {
  if (!existsSync(directory)) {
    return [];
  }

  return (await readdir(directory)).sort((left, right) => left.localeCompare(right));
}

Then(
  "the {word} scope holds no marketplace checkout",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    assert.deepStrictEqual(
      {
        sources: await entryNames(path.join(extensionRoot, "sources")),
        "sources-staging": await entryNames(path.join(extensionRoot, "sources-staging")),
      },
      { sources: [], "sources-staging": [] },
    );
  },
);
