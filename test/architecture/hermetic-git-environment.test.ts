/**
 * @fileoverview Checks that every git environment the suite builds is made from
 * scratch, so no inherited `GIT_*` variable reaches Pi, the git host, or a
 * fixture (DRV-03). Pi gets the run's GitHub base override, never the
 * shell's (GHB-01). The background update variables also stay in the shell:
 * Pi gets the update delay only from the run (D-PL8-09). A profile Pi gets
 * the run's `TMPDIR`, inside the sandbox home, never the shell's (HAR-05).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import { rpcChildEnvironment } from "../e2e/_rpc.ts";

import type { RpcGitEnvironment, RpcProfileEnvironment, RpcSandbox } from "../e2e/_rpc.ts";
import type { TestContext } from "node:test";

const INHERITED_VARIABLES = {
  GIT_DIR: "/shell/repo/.git",
  GIT_INDEX_FILE: "/shell/repo/.git/index",
  GIT_CONFIG_SYSTEM: "/shell/etc/gitconfig",
  GIT_CONFIG_GLOBAL: "/shell/home/.gitconfig",
  GIT_ASKPASS: "/shell/bin/askpass",
  PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://operator.example/git",
  PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "5",
  DISABLE_UPDATES: "1",
  DISABLE_AUTOUPDATER: "true",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  FORCE_AUTOUPDATE_PLUGINS: "1",
  TMPDIR: "/shell/tmp",
} as const;

/** Sets the inherited variables in `process.env` until the case `t` ends. */
function inheritVariables(t: TestContext): void {
  const saved = Object.keys(INHERITED_VARIABLES).map((name) => ({
    name,
    existed: Object.hasOwn(process.env, name),
    value: process.env[name],
  }));
  t.after(() => {
    for (const { name, existed, value } of saved) {
      if (existed) {
        process.env[name] = value;
      } else {
        Reflect.deleteProperty(process.env, name);
      }
    }
  });
  Object.assign(process.env, INHERITED_VARIABLES);
}

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
  test("adds the three git keys and the run's GitHub base override, and no inherited variable", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
    } satisfies RpcGitEnvironment;

    // act
    const environment = rpcChildEnvironment(sandbox, git);

    // assert
    assert.deepStrictEqual(environment, {
      HOME: "/sandbox/home",
      PI_CODING_AGENT_DIR: "/sandbox/agent",
      PI_OFFLINE: "1",
      PATH: process.env.PATH ?? "",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
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
      PATH: process.env.PATH ?? "",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "0",
    });
  });

  test("adds the profile's TMPDIR, not the shell's, to the git environment", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
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
      PATH: process.env.PATH ?? "",
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: "https://127.0.0.1:8443",
      TMPDIR: "/sandbox/home/tmp",
    });
  });

  test("returns only the allowlist without a git environment", (t) => {
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
