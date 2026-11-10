/**
 * @fileoverview Steps about the credentials that the user's git keeps after a
 * GitHub Device Flow sign-in. The steps read the credential store file
 * `.git-credentials` in the sandbox HOME. Git's `store` helper writes that
 * file when the product approves the token that the sign-in issued
 * (D-BG-1102).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

// D-BG-1105: the git host's stored-credential step stores the loopback address
// of the override host, so a credential that answers a github.com fill needs
// its own step. Git's `store` helper reads both files from the sandbox HOME.
Given(
  "the user has stored a credential for github.com with the user {string} and the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const login = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
    const files: Record<string, string> = {
      ".gitconfig": "[credential]\n\thelper = store\n",
      ".git-credentials": `https://${login}@github.com\n`,
    };
    const written = await Promise.all(
      Object.entries(files).map(async ([name, text]) => {
        const file = path.join(this.tokens.home, name);
        await writeFile(file, text, { flag: "wx", mode: 0o600 });
        this.onRelease(() => rm(file, { force: true }));
        return [name, await readFile(file, "utf8")] as const;
      }),
    );
    assert.deepStrictEqual(Object.fromEntries(written), files);
  },
);

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

// Git's `store` helper can leave an empty file after it erases a credential,
// so an empty store and an absent one both hold no credentials.
Then(
  "the user's git credential store holds no credentials",
  async function (this: ScenarioWorld): Promise<void> {
    assert.deepStrictEqual(await credentialStoreLines(this), []);
  },
);
