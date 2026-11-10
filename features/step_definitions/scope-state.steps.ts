/**
 * @fileoverview Steps about the state of a scope that other processes share:
 * the state lock a command takes before it changes the scope, held by a live
 * process or left by one that died (D-BG-11).
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { holdStateLock, isStateLockHeld, leaveStaleStateLock } from "../lib/state-lock-holder.ts";

import type { ScenarioWorld } from "../support/world.ts";

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
