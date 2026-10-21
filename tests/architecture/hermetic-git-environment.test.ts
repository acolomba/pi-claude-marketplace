/**
 * @fileoverview Checks that every git environment the suite builds is made from
 * scratch, so no inherited `GIT_*` variable reaches Pi, the git host, or a
 * fixture (DRV-03).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import { rpcChildEnvironment } from "../e2e/_rpc.ts";

import type { RpcGitEnvironment, RpcSandbox } from "../e2e/_rpc.ts";
import type { TestContext } from "node:test";

const INHERITED_GIT_VARIABLES = {
  GIT_DIR: "/shell/repo/.git",
  GIT_INDEX_FILE: "/shell/repo/.git/index",
  GIT_CONFIG_SYSTEM: "/shell/etc/gitconfig",
  GIT_CONFIG_GLOBAL: "/shell/home/.gitconfig",
  GIT_ASKPASS: "/shell/bin/askpass",
} as const;

/** Sets the inherited git variables in `process.env` until the case `t` ends. */
function inheritGitVariables(t: TestContext): void {
  const saved = Object.keys(INHERITED_GIT_VARIABLES).map((name) => ({
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
  Object.assign(process.env, INHERITED_GIT_VARIABLES);
}

const sandbox = {
  home: "/sandbox/home",
  agentDir: "/sandbox/agent",
  cwd: "/sandbox/project",
} satisfies RpcSandbox;

describe("hermeticGitEnvironment", () => {
  test("returns its eight keys and no inherited git variable", (t) => {
    // arrange
    inheritGitVariables(t);

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
  test("adds the three git keys to the allowlist and no inherited git variable", (t) => {
    // arrange
    inheritGitVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
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
    });
  });

  test("returns only the allowlist without a git environment", (t) => {
    // arrange
    inheritGitVariables(t);

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
