/**
 * @fileoverview Checks that every git environment the suite builds is made from
 * scratch, so no inherited `GIT_*` variable reaches Pi, the git host, or a
 * fixture (DRV-03). Pi gets the run's GitHub base override, never the
 * shell's (GHB-01), and none when the run's environment has none (D-BG-01).
 * The background update variables also stay in the shell: Pi gets the update
 * delay only from the run (D-PL8-09). A profile Pi gets
 * the run's `TMPDIR`, inside the sandbox home, never the shell's (HAR-05),
 * and pi-subagents' background-child marker (D-BG-10) and its hook gate
 * (D-BG-12) only from its profile. Pi gets system git's CA file and its
 * `PATH` only from the run, never the shell's `GIT_SSL_CAINFO` (SG-HRN-02).
 *
 * It also runs real system-git fixtures and clones while the runner's own
 * environment holds the cloud sandbox's kind of leak: a URL rewrite, an
 * ignore file, a repository pointer, and ssh overrides. Each would send a
 * fixture or a clone somewhere else, so the clones succeed only when no suite
 * git inherits them (SG-HRN-01, SG-HRN-03).
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { rpcChildEnvironment } from "../../features/lib/pi-rpc.ts";
import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";
import {
  createGitTestRepository,
  initGitTestCheckout,
  runSystemGit,
} from "../platform/git-test-repository.ts";

import type {
  RpcGitEnvironment,
  RpcProfileEnvironment,
  RpcSandbox,
} from "../../features/lib/pi-rpc.ts";
import type { TestContext } from "node:test";

const INHERITED_VARIABLES = {
  GIT_DIR: "/shell/repo/.git",
  GIT_INDEX_FILE: "/shell/repo/.git/index",
  GIT_CONFIG_SYSTEM: "/shell/etc/gitconfig",
  GIT_CONFIG_GLOBAL: "/shell/home/.gitconfig",
  GIT_ASKPASS: "/shell/bin/askpass",
  GIT_SSL_CAINFO: "/shell/ca-bundle.crt",
  PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://operator.example/git",
  PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "5",
  DISABLE_UPDATES: "1",
  DISABLE_AUTOUPDATER: "true",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  FORCE_AUTOUPDATE_PLUGINS: "1",
  TMPDIR: "/shell/tmp",
  PI_SUBAGENT_CHILD: "1",
  PI_CM_HOOK_GATE: "shell-gate",
} as const;

/** Sets `name` in `process.env` to `value`, or removes it when `value` is undefined. */
function setVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

/**
 * Sets each of `planted` in `process.env` until the case `t` ends, removing a
 * name whose value is undefined, then restores what the runner had.
 */
function plantVariables(
  t: TestContext,
  planted: Readonly<Record<string, string | undefined>>,
): void {
  const saved = Object.keys(planted).map((name) => [name, process.env[name]] as const);
  t.after(() => {
    for (const [name, value] of saved) {
      setVariable(name, value);
    }
  });
  for (const [name, value] of Object.entries(planted)) {
    setVariable(name, value);
  }
}

/** Sets the inherited variables in `process.env` until the case `t` ends. */
function inheritVariables(t: TestContext): void {
  plantVariables(t, INHERITED_VARIABLES);
}

/** A fresh root for one case, and a way to close a host in it before the root goes. */
interface CaseRoot {
  readonly root: string;
  readonly closeLater: (host: { close(): Promise<void> }) => void;
}

/**
 * Makes a fresh root for one case and removes it when the case ends, after
 * closing every host handed to `closeLater`.
 */
async function caseRoot(t: TestContext): Promise<CaseRoot> {
  const root = await mkdtemp(path.join(tmpdir(), "hermetic-git-"));
  const started: Array<{ close(): Promise<void> }> = [];
  t.after(async () => {
    try {
      await Promise.all(started.map((host) => host.close()));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  return { root, closeLater: (host) => started.push(host) };
}

/** Writes `contents` to `file`, making its directory first. */
async function writeFixtureFile(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
}

/** A port that nothing listens on, so a leaked rewrite fails the git that reads it. */
const CLOSED_PORT_URL = "https://127.0.0.1:9/";

const SSH_HOST = "stand-in.test";

const sandbox = {
  home: "/sandbox/home",
  agentDir: "/sandbox/agent",
  cwd: "/sandbox/project",
} satisfies RpcSandbox;

describe("hermeticGitEnvironment", () => {
  test("returns its eight keys and no inherited git variable", (t) => {
    // arrange
    inheritVariables(t);

    // act
    const environment = hermeticGitEnvironment("/scratch/home");

    // assert
    assert.deepStrictEqual(environment, {
      PATH: process.env.PATH ?? "",
      HOME: "/scratch/home",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "features",
      GIT_AUTHOR_EMAIL: "features@example.test",
      GIT_COMMITTER_NAME: "features",
      GIT_COMMITTER_EMAIL: "features@example.test",
    });
  });
});

describe("rpcChildEnvironment", () => {
  test("adds the four git keys, the run's PATH and GitHub base override, and no inherited variable", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    } satisfies RpcGitEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    });
  });

  test("adds the run's background update delay, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "0",
    } satisfies RpcGitEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "0",
    });
  });

  test("omits the GitHub base override when the run's git environment has none", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
    } satisfies RpcGitEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
    });
  });

  test("adds the profile's TMPDIR, not the shell's, to the git environment", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    } satisfies RpcGitEnvironment;
    const profile = { TMPDIR: "/sandbox/home/tmp" } satisfies RpcProfileEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git, profile);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      TMPDIR: "/sandbox/home/tmp",
    });
  });

  test("adds the profile's background-child marker, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    } satisfies RpcGitEnvironment;
    const profile = {
      TMPDIR: "/sandbox/home/tmp",
      PI_SUBAGENT_CHILD: "1",
    } satisfies RpcProfileEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git, profile);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      TMPDIR: "/sandbox/home/tmp",
      PI_SUBAGENT_CHILD: "1",
    });
  });

  test("adds the profile's hook gate, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    } satisfies RpcGitEnvironment;
    const profile = {
      TMPDIR: "/sandbox/home/tmp",
      PI_CM_HOOK_GATE: "profile-gate",
    } satisfies RpcProfileEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git, profile);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: "/run/ssh-host/bin:/usr/bin",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      TMPDIR: "/sandbox/home/tmp",
      PI_CM_HOOK_GATE: "profile-gate",
    });
  });

  test("returns only the allowlist, with the worker's PATH, without a git environment", (t) => {
    // arrange
    inheritVariables(t);

    // act
    const environment = rpcChildEnvironment(sandbox);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: process.env.PATH ?? "",
    });
  });
});

describe("system git under the runner's planted git variables", () => {
  test("builds a fixture and clones it from the HTTPS git host under a planted rewrite, ignore file, and repository pointer (SG-HRN-01)", async (t) => {
    // arrange
    const { root, closeLater } = await caseRoot(t);
    const host = await HttpsGitHost.start(path.join(root, "https-host"));
    closeLater(host);
    await writeFixtureFile(path.join(root, "decoy", "README.md"), "decoy\n");
    const decoy = await initGitTestCheckout(path.join(root, "decoy"));
    const decoyHead = await decoy.commitPaths("decoy", ["README.md"]);
    await writeFixtureFile(path.join(root, "xdg", "git", "ignore"), "*.txt\n");
    await writeFixtureFile(path.join(root, "fixture", "notes.txt"), "notes\n");
    const fixture = await initGitTestCheckout(path.join(root, "fixture"));
    await mkdir(path.join(root, "client-home"));
    const client = {
      cwd: root,
      home: path.join(root, "client-home"),
      variables: { GIT_SSL_CAINFO: host.certificatePath },
    };
    const window = host.mark();
    const rewrite = `url.${CLOSED_PORT_URL}.insteadOf`;
    plantVariables(t, {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: rewrite,
      GIT_CONFIG_VALUE_0: `https://${host.address}/`,
      GIT_CONFIG_PARAMETERS: `'${rewrite}'='https://${host.address}/'`,
      XDG_CONFIG_HOME: path.join(root, "xdg"),
      GIT_DIR: path.join(root, "decoy", ".git"),
      GIT_WORK_TREE: path.join(root, "decoy"),
      HTTPS_PROXY: "http://127.0.0.1:9",
      https_proxy: "http://127.0.0.1:9",
      ALL_PROXY: "http://127.0.0.1:9",
    });

    // act
    await fixture.commitPaths("notes", ["notes.txt"]);
    await fixture.cloneBare(host.repositoryPath("planted"));
    await runSystemGit(client, "clone", "-q", host.repositoryUrl("planted"), "clone");

    // assert
    const requests = host
      .requestsSince(window)
      .requests.map((request) => `${request.method} ${request.path} ${String(request.status)}`);
    assert.deepStrictEqual(
      {
        notes: await readFile(path.join(root, "clone", "notes.txt"), "utf8"),
        requests: [...new Set(requests)],
        decoyHead: await decoy.run("rev-parse", "HEAD"),
      },
      {
        notes: "notes\n",
        requests: [
          "GET /acme/planted.git/info/refs?service=git-upload-pack 200",
          "POST /acme/planted.git/git-upload-pack 200",
        ],
        decoyHead,
      },
    );
  });

  test("clones through the SSH stand-in under planted ssh overrides and a rewrite of the SSH URL (SG-HRN-01, SG-HRN-03)", async (t) => {
    // arrange
    const { root, closeLater } = await caseRoot(t);
    const repositoriesRoot = path.join(root, "repositories");
    const sshHost = await SshGitHost.start(path.join(root, "ssh-host"), { repositoriesRoot });
    closeLater(sshHost);
    await sshHost.register(SSH_HOST, { probe: { kind: "authenticated", user: "acme" } });
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.cloneBare(path.join(repositoriesRoot, "acme", "tools.git"));
    await mkdir(path.join(root, "client-home"));
    const client = {
      cwd: root,
      home: path.join(root, "client-home"),
      variables: { PATH: sshHost.searchPath() },
    };
    const window = await sshHost.mark();
    plantVariables(t, {
      GIT_SSH_COMMAND: "/bin/false",
      GIT_SSH: "/bin/false",
      GIT_SSH_VARIANT: "simple",
      SSH_AUTH_SOCK: path.join(root, "agent.sock"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.${CLOSED_PORT_URL}.insteadOf`,
      GIT_CONFIG_VALUE_0: `git@${SSH_HOST}:`,
    });

    // act
    await runSystemGit(client, "clone", "-q", `git@${SSH_HOST}:acme/tools.git`, "tools");

    // assert
    const launches = await sshHost.launchesSince(window);
    assert.deepStrictEqual(
      {
        head: await runSystemGit({ ...client, cwd: path.join(root, "tools") }, "rev-parse", "HEAD"),
        launches: launches.map((launch) => launch.argv.slice(-2)),
      },
      {
        head: repository.initialOid,
        launches: [[`git@${SSH_HOST}`, "git-upload-pack 'acme/tools.git'"]],
      },
    );
  });
});
