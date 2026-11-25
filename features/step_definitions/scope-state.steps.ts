/**
 * @fileoverview Steps about the state of a scope: the state lock a command
 * takes before it changes the scope, held by a live process or left by one
 * that died (D-BG-11), and the files under the scope's root, which a refused
 * command leaves as they were.
 */

import assert from "node:assert/strict";
import { readdir, readFile, readlink, rm } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import { holdStateLock, isStateLockHeld, leaveStaleStateLock } from "../lib/state-lock-holder.ts";

import type { ScenarioWorld, ScopeFiles } from "../support/world.ts";

// Every entry under the scope's root, so a new empty directory, a new file,
// and a changed byte each change the list.
async function scopeFiles(world: ScenarioWorld, scope: string): Promise<ScopeFiles> {
  const root = world.scopeRoot(scope);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<readonly [string, string]> => {
      const file = path.join(entry.parentPath, entry.name);
      const relative = path.relative(root, file);
      if (entry.isDirectory()) {
        return [`${relative}/`, ""];
      }

      if (entry.isSymbolicLink()) {
        return [relative, `-> ${await readlink(file)}`];
      }

      return [relative, (await readFile(file)).toString("base64")];
    }),
  );
  return files.sort(([left], [right]) => left.localeCompare(right));
}

Given(
  "another process holds the state lock of the {word} scope",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const lockFile = path.join(extensionRoot, ".state-lock");
    this.onRelease(await holdStateLock(extensionRoot, lockFile));
    assert.equal(await isStateLockHeld(extensionRoot, lockFile), true);
  },
);

// The command under test takes and releases the lock; the release only
// removes a lock directory that a failed scenario left behind.
Given(
  "a process that died left the state lock of the {word} scope",
  async function (this: ScenarioWorld, scope: string) {
    const extensionRoot = path.join(this.scopeRoot(scope), "pi-claude-marketplace");
    const lockFile = path.join(extensionRoot, ".state-lock");
    this.onRelease(() => rm(lockFile, { recursive: true, force: true }));
    await leaveStaleStateLock(extensionRoot, lockFile);
  },
);

Given(
  "the files of the {word} scope are remembered",
  async function (this: ScenarioWorld, scope: string) {
    this.rememberedScopeFiles.set(scope, await scopeFiles(this, scope));
  },
);

Then(
  "the files of the {word} scope are unchanged",
  async function (this: ScenarioWorld, scope: string) {
    const remembered = this.rememberedScopeFiles.get(scope);
    assert.ok(remembered !== undefined, `the files of the ${scope} scope were not remembered`);
    assert.deepStrictEqual(await scopeFiles(this, scope), remembered);
  },
);
