/**
 * @fileoverview Steps about the state of a scope that other processes share:
 * the state lock a command takes before it changes the scope.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { holdStateLock, isStateLockHeld } from "../lib/state-lock-holder.ts";

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
