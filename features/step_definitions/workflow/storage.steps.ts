/**
 * @fileoverview Steps about where an install saves a plugin's workflows: the
 * project's own saved workflows directory, and the user's workflow directory,
 * which a project install leaves alone (D-LOC-01).
 *
 * The profile Pi runs with `PI_CODING_AGENT_DIR` set to the sandbox agent
 * directory, so the workflow engine's directory of the user is
 * `<agent dir>/workflows`.
 */

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// Every file under `dir`, relative to it with `/` separators; none when `dir`
// does not exist.
async function filesUnder(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => !entry.isDirectory())
      .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
      .map((file) => file.split(path.sep).join("/"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

Then(
  "the saved workflows directory of the project holds these files:",
  async function (this: ScenarioWorld, table: DataTable) {
    const saved = path.join(this.tokens.projectDir, ".pi", "workflows", "saved");
    assert.deepStrictEqual(
      [["file"], ...(await filesUnder(saved)).map((file) => [file])],
      table.raw(),
    );
  },
);

// A saved workflow sits under a `saved` directory, the user's own or one of a
// project, and a staged one under this extension's staging directory.
Then(
  "the user's workflow directory holds no saved or staged workflows",
  async function (this: ScenarioWorld) {
    const files = await filesUnder(path.join(this.tokens.agentDir, "workflows"));
    assert.deepStrictEqual(
      files.filter((file) =>
        file
          .split("/")
          .some((segment) => segment === "saved" || segment === ".pi-claude-marketplace-staging"),
      ),
      [],
    );
  },
);
