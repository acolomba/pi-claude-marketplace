/**
 * @fileoverview Steps about `import`: its state-file inputs and what it leaves
 * in a scope that it did not select.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the import state of the {word} scope has an unsupported schema version",
  async function (this: ScenarioWorld, scope: string): Promise<void> {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    const bytes = '{"schemaVersion":999,"marketplaces":{}}';
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), bytes);
  },
);

// A scope that no command has touched has no state file at all, so the shared
// record steps, which read an existing record, cannot state it.
Then(
  "the import leaves no installation record in the {word} scope",
  function (this: ScenarioWorld, scope: string) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    assert.strictEqual(existsSync(file), false, `${file} exists`);
  },
);
