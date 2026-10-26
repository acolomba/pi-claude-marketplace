/**
 * @fileoverview Steps about the settings file a Claude Code user keeps, which
 * `import` reads: `.claude/settings.json` under the sandbox HOME for the user
 * scope and under the sandbox project for the project scope.
 *
 * The path comes only from the sandbox tokens, so a step never reaches the
 * home directory of the process that runs the suite. Pi runs with the sandbox
 * HOME and no `CLAUDE_CONFIG_DIR`, so it reads the same files.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { expandTokens } from "../lib/run-tokens.ts";

import type { ScenarioWorld } from "../support/world.ts";

// The settings file of a scope, built from the sandbox tokens only.
function settingsFilePath(world: ScenarioWorld, scope: string): string {
  switch (scope) {
    case "user":
      return path.join(world.tokens.home, ".claude", "settings.json");
    case "project":
      return path.join(world.tokens.projectDir, ".claude", "settings.json");
    default:
      throw new Error(`unknown scope ${scope}; expected user or project`);
  }
}

Given(
  "the claude code settings file of the {word} scope holds this text:",
  async function (this: ScenarioWorld, scope: string, text: string): Promise<void> {
    const file = settingsFilePath(this, scope);
    const expanded = expandTokens(text, this.tokens);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, expanded, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), expanded, `${file} does not hold the text`);
  },
);
