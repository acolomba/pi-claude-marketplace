/**
 * @fileoverview Steps that change a staged project command after its install,
 * as a pull of a repository that commits the project's
 * `.pi/pi-claude-marketplace/` tree does (D-CF3-07).
 */

import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// D-CF3-07: the user's ledger keeps the digest the install recorded, so the
// staged file no longer matches it.
Given(
  "the line {string} was appended to the staged project command {string}",
  async function (this: ScenarioWorld, line: string, command: string) {
    const staged = path.join(
      this.tokens.projectDir,
      ".pi",
      "pi-claude-marketplace",
      "resources",
      "prompts",
      `${command}.md`,
    );
    const added = `\n${line}\n`;
    await appendFile(staged, added, "utf8");
    assert.ok((await readFile(staged, "utf8")).endsWith(added), `${staged} does not end with it`);
  },
);
