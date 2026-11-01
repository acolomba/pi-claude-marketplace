/**
 * @fileoverview Steps about the record of project installs a project skill
 * needs: a project whose plugin files the user's pi directory does not record
 * as installed by the user, as in a clone of a repository that commits them
 * (D-CF2-13).
 */

import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// D-CF2-13: the project keeps its `.pi/pi-claude-marketplace/` tree and the
// `state.json` that names the skill, as a clone of a repository that commits
// them does; only the user's own record of the install is gone.
Given(
  "the user's pi directory records no plugin install for the project",
  async function (this: ScenarioWorld) {
    const ledger = path.join(
      this.tokens.agentDir,
      "pi-claude-marketplace",
      "project-installs.json",
    );
    await rm(ledger, { force: true });
    await assert.rejects(access(ledger), { code: "ENOENT" });
    await access(path.join(this.tokens.projectDir, ".pi", "pi-claude-marketplace", "state.json"));
  },
);
