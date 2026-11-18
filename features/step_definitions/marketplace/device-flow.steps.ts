/**
 * @fileoverview Steps about the credentials that the user's git keeps after a
 * GitHub Device Flow sign-in and about the user's `gh` CLI stand-in. The
 * credential steps read `.git-credentials` in the sandbox HOME, which git's
 * `store` helper writes when the product approves a Device Flow token
 * (D-BG-1102).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import {
  GITHUB_CLI_LOG,
  installGitHubCliStandIn,
  readGitHubCliCalls,
  type GitHubCliCall,
  type GitHubCliStandInState,
} from "../../lib/github-cli.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
} from "../../lib/pi-launch-environment.ts";
import { PROFILE_PI_START_TIMEOUT_MS, type ScenarioWorld } from "../../support/world.ts";

async function configureGitHubCli(
  world: ScenarioWorld,
  state: GitHubCliStandInState,
): Promise<void> {
  const installed = await installGitHubCliStandIn(world.tokens.home, state);
  world.onRelease(async () => {
    await rm(installed.launchFile, { force: true });
    await rm(installed.binDirectory, { recursive: true, force: true });
  });
  assert.strictEqual(existsSync(path.join(installed.binDirectory, "gh")), true);
}

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

Given(
  "the user's gh cli is signed in to github.com with the token {string}",
  async function (this: ScenarioWorld, token: string): Promise<void> {
    await configureGitHubCli(this, { signedIn: true, token });
  },
);

Given("the user's gh cli is signed out", async function (this: ScenarioWorld): Promise<void> {
  await configureGitHubCli(this, { signedIn: false });
});

Given(
  "pi runs with the user's gh cli",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld): Promise<void> {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.strictEqual((await readAppliedLaunchEnvironments(this.profileHarness())).length, 1);
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

async function gitHubCliCallsOfLastWhen(world: ScenarioWorld): Promise<GitHubCliCall[]> {
  const calls = await readGitHubCliCalls(world.profileHarness());
  return calls.slice(world.harnessLogLinesBeforeLastWhen(GITHUB_CLI_LOG));
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

Then(
  "the user's gh cli receives these calls:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = (await gitHubCliCallsOfLastWhen(this)).map((call) => [
      call.arguments.join(" "),
      call.promptDisabled ?? "",
    ]);
    assert.deepStrictEqual([["arguments", "prompt disabled"], ...rows], table.raw());
  },
);

Then("the user's gh cli receives no call", async function (this: ScenarioWorld): Promise<void> {
  assert.deepStrictEqual(await gitHubCliCallsOfLastWhen(this), []);
});
