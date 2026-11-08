/**
 * @fileoverview Steps about the credentials that the user's git keeps after a
 * GitHub Device Flow sign-in. The steps read the credential store file
 * `.git-credentials` in the sandbox HOME. Git's `store` helper writes that
 * file when the product approves the token that the sign-in issued
 * (D-BG-1102).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// The lines of the credential store in the sandbox HOME, in file order and
// without blank lines. An absent store holds no lines.
async function credentialStoreLines(world: ScenarioWorld): Promise<string[]> {
  const store = path.join(world.tokens.home, ".git-credentials");
  if (!existsSync(store)) {
    return [];
  }

  return (await readFile(store, "utf8")).split("\n").filter((line) => line !== "");
}

// D-BG-1102: the store lies in the sandbox HOME, so the token that the product
// approves never reaches the user's own store.
Then(
  "the user's git credential store holds these credentials:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = (await credentialStoreLines(this)).map((line) => {
      const credential = new URL(line);
      return [
        credential.protocol.replace(/:$/u, ""),
        credential.host,
        decodeURIComponent(credential.username),
        decodeURIComponent(credential.password),
      ];
    });
    assert.deepStrictEqual([["protocol", "host", "user", "password"], ...rows], table.raw());
  },
);
