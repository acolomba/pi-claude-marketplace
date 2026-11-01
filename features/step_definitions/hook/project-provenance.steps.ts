/**
 * @fileoverview Steps about the record of project installs a project hook
 * needs: a project whose staged hooks the user's pi directory does not record
 * as installed by the user, as in a clone of a repository that commits them
 * (D-CF2-13).
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

/** The extension's directory in the scenario's project scope. */
function projectExtensionDir(world: ScenarioWorld): string {
  return path.join(world.tokens.projectDir, ".pi", "pi-claude-marketplace");
}

// D-CF2-13: the project keeps its `.pi/pi-claude-marketplace/` tree, the
// `state.json` that names the plugin, and the staged hooks, as a clone of a
// repository that commits them does; only the user's own record is gone.
Given(
  "the user's pi directory records no hook install for the project",
  async function (this: ScenarioWorld) {
    const project = await realpath(this.tokens.projectDir);
    const ledger = path.join(
      this.tokens.agentDir,
      "pi-claude-marketplace",
      "project-installs",
      createHash("sha256").update(project).digest("hex"),
    );
    await access(path.join(ledger, "skills.json"));
    await rm(ledger, { recursive: true, force: true });
    await assert.rejects(access(ledger), { code: "ENOENT" });
    await access(path.join(projectExtensionDir(this), "state.json"));
  },
);

// D-CF2-13: the same hooks with other bytes, as a pull of a repository that
// commits the staged file brings. The file stays valid JSON.
Given(
  "the staged hooks file of the project plugin {string} was rewritten on one line",
  async function (this: ScenarioWorld, plugin: string) {
    const file = path.join(projectExtensionDir(this), "hooks", plugin, "hooks.json");
    const text = await readFile(file, "utf8");
    const oneLine = JSON.stringify(JSON.parse(text));
    assert.notStrictEqual(oneLine, text);
    await writeFile(file, oneLine, "utf8");
  },
);
