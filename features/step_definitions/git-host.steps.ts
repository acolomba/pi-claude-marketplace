/**
 * @fileoverview Steps about the https git host that serves the repositories
 * of git marketplaces and git plugins, and the catalog files of hosted
 * marketplaces: arming one repository or catalog to fail, to redirect, or to
 * require a credential, serving a catalog of a given size, letting it serve
 * again, the GitHub base address pi runs with, the credential a user stores
 * for the host, and the requests the host receives. A step names a repository
 * through the `git repository` parameter type, by the marketplace or the
 * plugin it serves; a hosted marketplace names the directory its catalog is
 * served under. Every arm is released with its scenario (HOST-03).
 *
 * A pi without the GitHub base override signs in through GitHub's Device
 * Flow (GHB-02). Its steps start the Device Flow stand-in with a poll script,
 * start that pi with the GitHub redirect, which sends its github.com requests
 * to the stand-in and to the git host and refuses every other host, and state
 * the requests the stand-in received and the requests the redirect routed or
 * refused (D-BG-01, D-BG-03).
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import {
  GITHUB_REDIRECT_EXTENSION,
  GITHUB_REDIRECT_LOG,
  readRedirectLog,
  writeRedirectConfig,
} from "../lib/github-device-flow/extension.ts";
import {
  DEVICE_FLOW_LOG,
  GitHubDeviceFlow,
  readDeviceFlowRequests,
  readPollScript,
} from "../lib/github-device-flow/server.ts";
import { armedStatus } from "../lib/https-git-host/server.ts";
import { expandTokens } from "../lib/run-tokens.ts";
import { harnessDirectory } from "../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { DeviceFlowRequest } from "../lib/github-device-flow/server.ts";
import type { GitHostArm } from "../lib/https-git-host/server.ts";
import type { GitRepositoryReference } from "../support/git-repository.ts";
import type { ScenarioWorld } from "../support/world.ts";

interface ServedRepository {
  readonly owner: string;
  readonly directory: string;
}

/** Returns the owner and directory the git host serves `reference` under. */
function servedRepository(
  world: ScenarioWorld,
  reference: GitRepositoryReference,
): ServedRepository {
  if (reference.subject === "plugin") {
    const repository = world.gitRepositoryServing(reference.name);
    return { owner: repository.owner, directory: repository.name };
  }

  const published = world.requirePublished(reference.name);
  if (published.kind === "url" || published.kind === "github") {
    return { owner: published.owner, directory: published.repository };
  }

  if (published.kind === "hosted") {
    return { owner: published.owner, directory: published.directory };
  }

  assert.fail(`the marketplace ${reference.name} is not published on the git host`);
}

const CREDENTIAL_STORE_CONFIG = "[credential]\n\thelper = store\n";

/**
 * Writes the sandbox HOME's git config, which Pi's git reads through its
 * global config (DRV-03), so git keeps credentials in its credential store,
 * and registers its removal. Returns the path of the config.
 */
async function useCredentialStore(world: ScenarioWorld): Promise<string> {
  const config = path.join(world.tokens.home, ".gitconfig");
  await writeFile(config, CREDENTIAL_STORE_CONFIG, { flag: "wx" });
  world.onRelease(() => rm(config, { force: true }));
  return config;
}

/**
 * Arms the repository `reference` names to fail as `arm`, and registers a
 * release that disarms it, so the arm never outlives the scenario. The release
 * ignores whether the repository was still armed: a scenario may have let it
 * serve again.
 */
async function armRepository(
  world: ScenarioWorld,
  reference: GitRepositoryReference,
  arm: GitHostArm,
): Promise<void> {
  const { owner, directory } = servedRepository(world, reference);
  const { gitHost } = world;
  await gitHost.arm(directory, arm, owner);
  world.onRelease(() => {
    gitHost.disarm(directory, owner);
  });
}

Given(
  "the git host answers {int} for the {git repository}",
  async function (
    this: ScenarioWorld,
    status: number,
    reference: GitRepositoryReference,
  ): Promise<void> {
    await armRepository(this, reference, { kind: "status", status: armedStatus(status) });
  },
);

Given(
  "the git host drops the connection for the {git repository}",
  async function (this: ScenarioWorld, reference: GitRepositoryReference): Promise<void> {
    await armRepository(this, reference, { kind: "drop" });
  },
);

Given(
  "the git host holds the response body for the {git repository}",
  async function (this: ScenarioWorld, reference: GitRepositoryReference): Promise<void> {
    await armRepository(this, reference, { kind: "hold-git-body" });
  },
);

Given(
  "the git host sends an invalid response for the {git repository}",
  async function (this: ScenarioWorld, reference: GitRepositoryReference): Promise<void> {
    await armRepository(this, reference, { kind: "invalid-response" });
  },
);

Given(
  "the git host requires the user {string} with the password {string} for the {git repository}",
  async function (
    this: ScenarioWorld,
    user: string,
    password: string,
    reference: GitRepositoryReference,
  ): Promise<void> {
    await armRepository(this, reference, { kind: "credential", user, password });
  },
);

Given(
  "the git host redirects the {git repository} to {string}",
  async function (
    this: ScenarioWorld,
    reference: GitRepositoryReference,
    location: string,
  ): Promise<void> {
    await armRepository(this, reference, {
      kind: "redirect",
      location: expandTokens(location, this.tokens),
    });
  },
);

Given(
  "the git host serves {int} bytes as the catalog of the marketplace {string}",
  function (this: ScenarioWorld, size: number, name: string): void {
    const published = this.requirePublished(name);
    if (published.kind !== "hosted") {
      assert.fail(`the marketplace ${name} is not published as a hosted source`);
    }

    this.gitHost.serveFile(
      published.directory,
      published.file,
      Buffer.alloc(size),
      published.owner,
    );
  },
);

Given(
  "the git host serves the {git repository} again",
  function (this: ScenarioWorld, reference: GitRepositoryReference): void {
    const { owner, directory } = servedRepository(this, reference);
    assert.strictEqual(
      this.gitHost.disarm(directory, owner),
      true,
      `the git host has not armed the repository ${owner}/${directory}.git`,
    );
  },
);

// GHB-03: a value pi refuses fails every command that reaches GitHub. The
// variable is read when Pi starts, so the scenario gets a Pi of its own.
Given(
  "pi runs with the github base address {string}",
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithGitHubBaseUrl(value);
  },
);

// The credential lives only in the sandbox HOME, which Pi's git reads through
// its global config (DRV-03); no git process runs to store it.
Given(
  "the user has stored a credential for the git host with the user {string} and the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const credentials = path.join(this.tokens.home, ".git-credentials");
    const credentialsText = `https://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${this.gitHost.address}\n`;
    const config = await useCredentialStore(this);
    await writeFile(credentials, credentialsText, { flag: "wx", mode: 0o600 });
    this.onRelease(() => rm(credentials, { force: true }));
    assert.deepStrictEqual(
      [await readFile(config, "utf8"), await readFile(credentials, "utf8")],
      [CREDENTIAL_STORE_CONFIG, credentialsText],
    );
  },
);

// The credential store lies in the sandbox HOME, so the token the product
// stores after a sign-in never reaches the user's own store.
Given(
  "the user's git keeps credentials in its credential store",
  async function (this: ScenarioWorld): Promise<void> {
    const config = await useCredentialStore(this);
    assert.strictEqual(await readFile(config, "utf8"), CREDENTIAL_STORE_CONFIG);
  },
);

// D-BG-03: the stand-in serves with the git host's certificate, which Pi
// trusts already, and the redirect config it writes is read when Pi starts.
Given(
  "github's sign-in answers its polls with these outcomes:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const harness = harnessDirectory(this.tokens.home);
    const signIn = await GitHubDeviceFlow.start(this.gitHost, readPollScript(table), harness);
    this.onRelease(() => signIn.close());
    await writeRedirectConfig(this.tokens.home, {
      gitHost: this.gitHost.address,
      signIn: signIn.address,
    });
    assert.deepStrictEqual(await readDeviceFlowRequests(harness), []);
  },
);

// D-BG-01: the pi runs without the GitHub base override, so GHB-02 runs
// Device Flow, and the redirect keeps every request on this machine.
Given(
  "pi runs with github's requests routed to the stand-ins",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld): Promise<void> {
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [GITHUB_REDIRECT_EXTENSION],
      withoutGitHubBaseOverride: true,
    });
    const loads = (await readRedirectLog(this.profileHarness())).flatMap((line) =>
      line.decision === "loaded" ? [line] : [],
    );
    assert.deepStrictEqual(
      loads.map((line) => ({ configured: line.configured, ownProcess: line.pid === process.pid })),
      [{ configured: true, ownProcess: false }],
    );
  },
);

Then("the git host receives these requests:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requestsOfLastCommand().requests.map((request) => [
    request.method,
    request.path,
    String(request.status),
  ]);
  assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
});

// The sign-in requests of the last `When`.
async function signInRequestsOfLastWhen(world: ScenarioWorld): Promise<DeviceFlowRequest[]> {
  const requests = await readDeviceFlowRequests(world.profileHarness());
  return requests.slice(world.harnessLogLinesBeforeLastWhen(DEVICE_FLOW_LOG));
}

Then(
  "github's sign-in receives these requests:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const rows = (await signInRequestsOfLastWhen(this)).map((request) => [
      request.method,
      request.path,
      Object.entries(request.form)
        .map(([key, value]) => `${key}=${value}`)
        .join(", "),
    ]);
    assert.deepStrictEqual([["method", "path", "form"], ...rows], table.raw());
  },
);

Then("github's sign-in receives no request", async function (this: ScenarioWorld): Promise<void> {
  assert.deepStrictEqual(await signInRequestsOfLastWhen(this), []);
});

// The `loaded` lines are not requests; every routed and refused one is a row.
Then(
  "pi routes these github requests:",
  async function (this: ScenarioWorld, table: DataTable): Promise<void> {
    const log = await readRedirectLog(this.profileHarness());
    const lines = log.slice(this.harnessLogLinesBeforeLastWhen(GITHUB_REDIRECT_LOG));
    const rows = lines.flatMap((line) => {
      switch (line.decision) {
        case "loaded":
          return [];
        case "routed":
          return [[line.method, line.url, line.target]];
        case "refused":
          return [[line.method, line.url, "refused"]];
      }
    });
    assert.deepStrictEqual([["method", "url", "routed to"], ...rows], table.raw());
  },
);

// A request over a kept-alive socket shows only in the requests, and a non-TLS
// attempt that never becomes a request shows only in the connection count, so
// the step asserts both.
Then("the git host receives no request", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.requestsOfLastCommand(), { requests: [], connections: 0 });
});
