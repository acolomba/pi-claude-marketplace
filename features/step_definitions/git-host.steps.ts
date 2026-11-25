/**
 * @fileoverview Steps about the https git host that serves the repositories
 * of git marketplaces and git plugins, and the catalog files of hosted
 * marketplaces: arming one repository or catalog to fail, to redirect, to
 * refuse fetches by SHA, or to require a credential, serving a catalog of a
 * given size, letting it serve again, the GitHub base address pi runs with, a
 * pi with no git on its path, a pi with upstream's git timeout or keep
 * variable, the credential a user stores for the host, and
 * the requests the host receives. A step names a repository
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

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { startGitHubConnectProxy } from "../lib/github-device-flow/connect-proxy.ts";
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
import { runGit } from "../lib/hermetic-git.ts";
import { armedStatus } from "../lib/https-git-host/server.ts";
import { expandTokens } from "../lib/run-tokens.ts";
import { harnessDirectory } from "../lib/turn-records.ts";
import {
  readUserGitProgramRuns,
  removeUserGitProgram,
  writeUserGitProgram,
} from "../lib/user-git-programs.ts";
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

/** Returns the text of `file`, or undefined when there is no such file. */
async function readOptionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
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

/**
 * Disarms the repository `reference` names, so the git host serves it again,
 * and fails when the host had not armed it.
 */
function disarmRepository(world: ScenarioWorld, reference: GitRepositoryReference): void {
  const { owner, directory } = servedRepository(world, reference);
  assert.strictEqual(
    world.gitHost.disarm(directory, owner),
    true,
    `the git host has not armed the repository ${owner}/${directory}.git`,
  );
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

// SG-TRN-02, E3-PIN: the repository serves protocol v0 with no SHA wants, so a
// fetch of a commit by its SHA is refused while a clone and a fetch of a ref
// still serve.
Given(
  "the git host refuses fetches by sha for the {git repository}",
  async function (this: ScenarioWorld, reference: GitRepositoryReference): Promise<void> {
    await armRepository(this, reference, { kind: "refuse-sha-want" });
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
    disarmRepository(this, reference);
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

// D-SG-15, SG-TRN-06: upstream's variable keeps a marketplace's checkout when
// its remote is unreachable. A Pi reads its environment when it starts, and
// the run's Pi never sets the variable, so the scenario gets a Pi of its own.
Given(
  'pi runs with the environment variable "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE" set to {string}',
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithKeptMarketplaceOnFailure(value);
  },
);

// D-SG-13, SG-TRN-05: upstream's variable bounds every git command. A Pi reads
// its environment when it starts, and the run's Pi never sets the variable,
// so the scenario gets a Pi of its own.
Given(
  'pi runs with the environment variable "CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS" set to {string}',
  async function (this: ScenarioWorld, value: string): Promise<void> {
    await this.usePiWithGitTimeout(value);
  },
);

// SG-PRC-06: the scenario's Pi finds no git on its PATH. Pi itself starts
// from an absolute Node path, so only the extension's git lookup changes.
Given("pi runs without git on its path", async function (this: ScenarioWorld): Promise<void> {
  await this.usePiWithoutGit();
});

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

// SG-PRC-02: the askpass program and the config that names it lie in the
// sandbox HOME, which Pi's git reads through its global config (DRV-03). The
// config keeps what an earlier credential-store step wrote, and its release
// puts it back as it was.
Given(
  "the user's git configuration names an askpass program that answers the user {string} with the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const { home } = this.tokens;
    const program = await writeUserGitProgram(home, "askpass", { user, password });
    this.onRelease(() => removeUserGitProgram(home, "askpass"));
    const config = path.join(home, ".gitconfig");
    const previous = await readOptionalText(config);
    const text = `${previous ?? ""}[core]\n\taskPass = ${program}\n`;
    this.onRelease(() =>
      previous === undefined ? rm(config, { force: true }) : writeFile(config, previous),
    );
    await writeFile(config, text);
    assert.deepStrictEqual(
      [await readFile(config, "utf8"), await readUserGitProgramRuns(home, "askpass")],
      [text, []],
    );
  },
);

// SG-PRC-03: a credential lookup never reads the configuration of the
// repository Pi runs in. The suite's hermetic git makes that repository, so the
// developer's own configuration never reaches it, and the release removes it.
Given(
  "the project is a git repository whose own configuration names a credential helper that answers the user {string} with the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const { home, projectDir } = this.tokens;
    const program = await writeUserGitProgram(home, "credential-helper", { user, password });
    this.onRelease(() => removeUserGitProgram(home, "credential-helper"));
    await runGit(projectDir, home, "init", "-q");
    this.onRelease(() => rm(path.join(projectDir, ".git"), { recursive: true, force: true }));
    await runGit(projectDir, home, "config", "credential.helper", program);
    assert.deepStrictEqual(
      [
        await runGit(projectDir, home, "config", "--local", "--get-all", "credential.helper"),
        await readUserGitProgramRuns(home, "credential-helper"),
      ],
      [program, []],
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
// Device Flow, and the redirect keeps every request on this machine. D-SG-14:
// a system git of that pi reaches `github.com` through the CONNECT proxy,
// which tunnels only to the git host and logs to the redirect log.
Given(
  "pi runs with github's requests routed to the stand-ins",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld): Promise<void> {
    const proxy = await startGitHubConnectProxy({
      gitHost: this.gitHost.address,
      logPath: path.join(harnessDirectory(this.tokens.home), GITHUB_REDIRECT_LOG),
    });
    this.onRelease(() => proxy.close());
    await this.usePiWithProfile({
      companions: [],
      extraExtensions: [GITHUB_REDIRECT_EXTENSION],
      withoutGitHubBaseOverride: true,
      httpsProxy: `http://${proxy.address}`,
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

// A retry after a held request: the host answers the repository again, so the
// next command reaches it (HOST-03).
When(
  "the git host stops holding the response body for the {git repository}",
  function (this: ScenarioWorld, reference: GitRepositoryReference): void {
    disarmRepository(this, reference);
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

// A plain-http attempt on the host's TLS port is a connection that never
// becomes a request, so it proves the command reached the host (D-SG-17).
Then(
  "the git host accepts {int} connection(s) and receives no request",
  function (this: ScenarioWorld, connections: number) {
    assert.deepStrictEqual(this.requestsOfLastCommand(), { requests: [], connections });
  },
);

// SG-PRC-02: the product never runs the user's askpass program.
Then(
  "the askpass program has recorded no run",
  async function (this: ScenarioWorld): Promise<void> {
    assert.deepStrictEqual(await readUserGitProgramRuns(this.tokens.home, "askpass"), []);
  },
);

// SG-PRC-03: the product never asks the project repository's credential helper.
Then(
  "the credential helper has recorded no run",
  async function (this: ScenarioWorld): Promise<void> {
    assert.deepStrictEqual(await readUserGitProgramRuns(this.tokens.home, "credential-helper"), []);
  },
);
