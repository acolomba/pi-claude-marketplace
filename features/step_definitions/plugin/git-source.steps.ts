/**
 * @fileoverview Steps about git-source plugins: the commit the copy an
 * installed plugin runs from holds.
 *
 * An installed git plugin runs from its own copy under `plugin-clones/`,
 * named by a hash of the clone URL and the commit, never from the URL-keyed
 * mirror a fetch refreshes (GIT-01).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { runGit } from "../../lib/hermetic-git.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const PER_COMMIT_KEY = /^[0-9a-f]{12}-[0-9a-f]{12}$/u;

Then(
  "the git-source plugin {string} installed in the {word} scope runs revision {int} of its repository",
  async function (this: ScenarioWorld, plugin: string, scope: string, revision: number) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const state = JSON.parse(await readFile(path.join(extensionRoot, "state.json"), "utf8")) as {
      readonly marketplaces: Record<string, { readonly plugins: Record<string, unknown> }>;
    };
    const records = Object.values(state.marketplaces).flatMap((marketplace) =>
      Object.entries(marketplace.plugins)
        .filter(([recorded]) => recorded === plugin)
        .map(([, record]) => record),
    );
    assert.strictEqual(records.length, 1, `records of ${plugin}: ${records.length}`);
    const [record] = records;
    const resolvedSource =
      isPlainObject(record) && "resolvedSource" in record ? record.resolvedSource : undefined;
    assert.ok(typeof resolvedSource === "string", `the record of ${plugin} names no source`);
    const clonesDirectory = path.join(extensionRoot, "plugin-clones");
    const [key = ""] = path.relative(clonesDirectory, resolvedSource).split(path.sep);
    assert.match(key, PER_COMMIT_KEY, `${plugin} runs from ${resolvedSource}`);
    const repository = this.gitRepositoryServing(plugin);
    assert.strictEqual(
      await runGit(path.join(clonesDirectory, key), repository.gitHome, "rev-parse", "HEAD"),
      repository.revisions[revision - 1],
    );
  },
);
