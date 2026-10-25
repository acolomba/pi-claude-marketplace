/**
 * @fileoverview Steps about autoapply: the value a config file sets.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

const AUTOAPPLY_FILES: ReadonlySet<string> = new Set([
  "claude-plugins.json",
  "claude-plugins.local.json",
]);

// The whole file is compared apart from its `autoapply` member, so a write
// that dropped or changed another member fails here.
Then(
  "the {string} file of the {word} scope sets autoapply to {word} and holds nothing else",
  async function (this: ScenarioWorld, fileName: string, scope: string, value: string) {
    assert.ok(AUTOAPPLY_FILES.has(fileName), `${fileName} is not a config of a scope`);
    const file = path.join(this.scopeRoot(scope), fileName);
    const content = await readFile(file, "utf8");
    assert.deepStrictEqual(
      JSON.parse(content),
      { schemaVersion: 1, autoapply: value === "on" },
      `${file} holds ${content}`,
    );
  },
);
