/**
 * @fileoverview Steps about slash commands that do not come from a plugin:
 * the prompt templates the user writes into their own Pi directory.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// D-CF1-03: Pi loads `<agent dir>/prompts/<name>.md` as the user's own slash
// command `/<name>`. The doc string is the whole file, written as typed.
Given(
  "the user's pi directory has the slash command {string} with this command file:",
  async function (this: ScenarioWorld, name: string, text: string) {
    const prompts = path.join(this.tokens.agentDir, "prompts");
    const file = path.join(prompts, `${name}.md`);
    await mkdir(prompts, { recursive: true });
    await writeFile(file, text, "utf8");
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
