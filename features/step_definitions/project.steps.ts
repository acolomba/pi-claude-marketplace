/**
 * @fileoverview Steps about the project directory of the session, the folder
 * Pi runs in. A git repository in it is made with the suite's hermetic git,
 * so the developer's git configuration never reaches it.
 *
 * The release removes the repository data the step made. The reset of the
 * next scenario empties the project as well, which also removes what a
 * companion added to the repository, such as a worktree of the workflow
 * engine.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { runGit } from "../lib/hermetic-git.ts";

import type { ScenarioWorld } from "../support/world.ts";

Given("the project is a git repository with one commit", async function (this: ScenarioWorld) {
  const { projectDir, home } = this.tokens;
  await runGit(projectDir, home, "init", "-q");
  this.onRelease(() => rm(path.join(projectDir, ".git"), { recursive: true, force: true }));
  await runGit(projectDir, home, "commit", "-q", "--allow-empty", "-m", "start");
  assert.strictEqual(await runGit(projectDir, home, "rev-list", "--count", "HEAD"), "1");
});
