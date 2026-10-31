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
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { armedStatus } from "../lib/https-git-host/server.ts";
import { expandTokens } from "../lib/run-tokens.ts";

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
    const config = path.join(this.tokens.home, ".gitconfig");
    const credentials = path.join(this.tokens.home, ".git-credentials");
    const configText = "[credential]\n\thelper = store\n";
    const credentialsText = `https://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${this.gitHost.address}\n`;
    await writeFile(config, configText, { flag: "wx" });
    this.onRelease(() => rm(config, { force: true }));
    await writeFile(credentials, credentialsText, { flag: "wx", mode: 0o600 });
    this.onRelease(() => rm(credentials, { force: true }));
    assert.deepStrictEqual(
      [await readFile(config, "utf8"), await readFile(credentials, "utf8")],
      [configText, credentialsText],
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

// A request over a kept-alive socket shows only in the requests, and a non-TLS
// attempt that never becomes a request shows only in the connection count, so
// the step asserts both.
Then("the git host receives no request", function (this: ScenarioWorld) {
  assert.deepStrictEqual(this.requestsOfLastCommand(), { requests: [], connections: 0 });
});
