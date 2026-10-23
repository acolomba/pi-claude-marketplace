/**
 * @fileoverview Steps about plugin fetch: the revision a fetch leaves in a scope's copy of a plugin.
 *
 * A fetch refreshes the URL-keyed mirror of a plugin repository, the clone
 * whose directory name has no commit (MIRR-01); the per-commit copies an
 * installed plugin runs from are not fetched copies (GIT-01).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import { runGit } from "../../lib/hermetic-git.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const MIRROR_KEY = /^[0-9a-f]{12}$/u;

Then(
  "the fetched copy of the plugin {string} in the {word} scope holds revision {int} of its repository",
  async function (this: ScenarioWorld, plugin: string, scope: string, revision: number) {
    const repository = this.gitRepositoryServing(plugin);
    const clones = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "plugin-clones");
    const keys = (existsSync(clones) ? await readdir(clones) : []).filter((key) =>
      MIRROR_KEY.test(key),
    );
    const suffix = `/${repository.owner}/${repository.name}.git`;
    const copies: string[] = [];
    for (const key of keys) {
      const checkout = path.join(clones, key);
      const origin = await runGit(checkout, repository.gitHome, "config", "remote.origin.url");
      if (origin.endsWith(suffix)) {
        copies.push(checkout);
      }
    }

    assert.strictEqual(copies.length, 1, `copies of ${repository.name}: ${copies.join(", ")}`);
    const [copy = ""] = copies;
    assert.strictEqual(
      await runGit(copy, repository.gitHome, "rev-parse", "HEAD"),
      repository.revisions[revision - 1],
    );
  },
);
