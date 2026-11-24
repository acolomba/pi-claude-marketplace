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
 * interrupted-update step leaves a checkout there with no live checkout.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, Then, When } from "@cucumber/cucumber";

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
