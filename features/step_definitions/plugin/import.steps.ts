/**
 * @fileoverview Steps about `import`: what it leaves in the scope it did not
 * select.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// A scope that no command has touched has no state file at all, so the shared
// record steps, which read an existing record, cannot state it.
Then(
  "the import leaves no installation record in the {word} scope",
  function (this: ScenarioWorld, scope: string) {
    const file = path.join(this.scopeRoot(scope), "pi-claude-marketplace", "state.json");
    assert.strictEqual(existsSync(file), false, `${file} exists`);
  },
);
