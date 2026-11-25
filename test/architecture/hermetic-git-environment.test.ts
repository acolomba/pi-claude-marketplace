/**
 * @fileoverview Checks that every environment the suites build for a process
 * they start is made from scratch, so no git- or ssh-steering variable of the
 * test runner reaches Pi, the git host, the SSH stand-in, a fixture, or a
 * forked integration child (DRV-03, SG-HRN-04). Each case plants the
 * `GIT_CONFIG_*` family, the git repository, trace, and helper variables,
 * `GIT_SSL_CAINFO`, the ssh variables (`GIT_SSH`, `GIT_SSH_COMMAND`,
 * `GIT_SSH_VARIANT`, `SSH_AUTH_SOCK`, `SSH_ASKPASS`), the proxy variables in
 * both cases, `XDG_CONFIG_HOME`, `GCM_*`, the locale,
 * `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` and `CLAUDE_CODE_REMOTE` (D-SG-24), and
 * the two upstream variables that steer the product's git,
 * `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` (SG-TRN-05) and
 * `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` (SG-TRN-06), then asserts
 * the exact key set of
 * `hermeticGitEnvironment` in each form the suites use, `cgiEnvironment`
 * under both SHA-want policies, `uploadPackEnvironment`, `rpcChildEnvironment`,
 * and `ipcChildEnvironment`, so a key a builder inherits fails one case.
 *
 * Pi gets the run's GitHub base override, never the
 * shell's (GHB-01), and none when the run's environment has none (D-BG-01).
 * The background update variables also stay in the shell: Pi gets the update
 * delay only from the run (D-PL8-09). So do upstream's git timeout and keep
 * variables: only a scenario's own Pi gets them, from the run (D-SG-13,
 * D-SG-15), and so do upstream's https switch and remote-session marker
 * (D-SG-24). A profile Pi gets
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
import { cgiEnvironment } from "../../features/lib/https-git-host/cgi.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { rpcChildEnvironment } from "../../features/lib/pi-rpc.ts";
import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";
import { uploadPackEnvironment } from "../../features/lib/ssh-git-host/launch.ts";
import { ipcChildEnvironment } from "../integration/ipc-child-environment.ts";
import {
  createGitTestRepository,
  initGitTestCheckout,
  runSystemGit,
} from "../platform/git-test-repository.ts";

import type { HermeticGitVariables } from "../../features/lib/hermetic-git.ts";
import type { CgiRequest, ShaWantPolicy } from "../../features/lib/https-git-host/cgi.ts";
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
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "url.https://shell.example/.insteadOf",
  GIT_CONFIG_VALUE_0: "https://127.0.0.1:8443/",
  GIT_CONFIG_PARAMETERS: "'url.https://shell.example/.insteadof'='https://127.0.0.1:8443/'",
  GIT_SSH: "/shell/bin/ssh",
  GIT_SSH_COMMAND: "ssh -i /shell/key",
  GIT_SSH_VARIANT: "ssh",
  SSH_AUTH_SOCK: "/shell/agent.sock",
  SSH_ASKPASS: "/shell/bin/ssh-askpass",
  HTTP_PROXY: "http://shell-proxy.example:1",
  http_proxy: "http://shell-proxy.example:1",
  HTTPS_PROXY: "http://shell-proxy.example:1",
  https_proxy: "http://shell-proxy.example:1",
  ALL_PROXY: "socks5://shell-proxy.example:1",
  all_proxy: "socks5://shell-proxy.example:1",
  NO_PROXY: "*",
  no_proxy: "*",
  XDG_CONFIG_HOME: "/shell/xdg",
  GIT_TRACE: "1",
  GIT_TRACE_PACKET: "1",
  GIT_TRACE2: "1",
  GIT_TRACE_CURL: "1",
  GCM_INTERACTIVE: "always",
  GCM_CREDENTIAL_STORE: "plaintext",
  CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "1",
  CLAUDE_CODE_REMOTE: "1",
  CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS: "1",
  CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: "1",
  GIT_WORK_TREE: "/shell/repo",
  GIT_OBJECT_DIRECTORY: "/shell/repo/.git/objects",
  GIT_EXEC_PATH: "/shell/libexec/git-core",
  GIT_TEMPLATE_DIR: "/shell/share/git-core/templates",
  GIT_ALLOW_PROTOCOL: "ext",
  GIT_CEILING_DIRECTORIES: "/shell",
  GIT_TERMINAL_PROMPT: "1",
  GIT_EDITOR: "/shell/bin/editor",
  LC_ALL: "fr_FR.UTF-8",
  LANG: "de_DE.UTF-8",
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

/** The eight keys of every suite git whose HOME is `home`, with the runner's PATH. */
function suiteGitKeys(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
  };
}

describe("hermeticGitEnvironment", () => {
  for (const { title, variables, expectedEnvironment } of [
    {
      title: "returns its eight keys and no inherited variable",
      variables: {},
      expectedEnvironment: suiteGitKeys("/scratch/home"),
    },
    {
      title: "adds both named dates, for ten keys and no inherited variable",
      variables: { GIT_AUTHOR_DATE: "1700000001 +0000", GIT_COMMITTER_DATE: "1700000001 +0000" },
      expectedEnvironment: {
        ...suiteGitKeys("/scratch/home"),
        GIT_AUTHOR_DATE: "1700000001 +0000",
        GIT_COMMITTER_DATE: "1700000001 +0000",
      },
    },
    {
      title: "adds the named CA file, for nine keys and not the runner's",
      variables: { GIT_SSL_CAINFO: "/run/cert.pem" },
      expectedEnvironment: { ...suiteGitKeys("/scratch/home"), GIT_SSL_CAINFO: "/run/cert.pem" },
    },
    {
      title: "replaces the runner's PATH with the named one, keeping eight keys",
      variables: { PATH: "/run/ssh-host/bin:/usr/bin" },
      expectedEnvironment: { ...suiteGitKeys("/scratch/home"), PATH: "/run/ssh-host/bin:/usr/bin" },
    },
  ] satisfies ReadonlyArray<{
    title: string;
    variables: HermeticGitVariables;
    expectedEnvironment: NodeJS.ProcessEnv;
  }>) {
    test(title, (t) => {
      // arrange
      inheritVariables(t);

      // act
      const environment = hermeticGitEnvironment("/scratch/home", variables);

      // assert
      assert.deepStrictEqual(environment, expectedEnvironment);
    });
  }
});

describe("cgiEnvironment", () => {
  for (const { title, policy, expectedProtocol } of [
    {
      title: "passes the request's Git-Protocol and no inherited variable under allow-reachable",
      policy: "allow-reachable",
      expectedProtocol: { GIT_PROTOCOL: "version=2" },
    },
    {
      title: "passes neither the Git-Protocol nor an inherited variable under refuse",
      policy: "refuse",
      expectedProtocol: {},
    },
  ] satisfies ReadonlyArray<{
    title: string;
    policy: ShaWantPolicy;
    expectedProtocol: NodeJS.ProcessEnv;
  }>) {
    test(title, (t) => {
      // arrange
      inheritVariables(t);
      const request = {
        method: "GET",
        url: new URL("https://127.0.0.1:4443/acme/tools.git/info/refs?service=git-upload-pack"),
        headers: { "git-protocol": "version=2" },
        body: Buffer.alloc(0),
      } satisfies CgiRequest;

      // act
      const environment = cgiEnvironment(request, "/run/repositories", "/run/cgi-home", policy);

      // assert
      assert.deepStrictEqual(environment, {
        ...suiteGitKeys("/run/cgi-home"),
        GIT_PROJECT_ROOT: "/run/repositories",
        GIT_HTTP_EXPORT_ALL: "1",
        PATH_INFO: "/acme/tools.git/info/refs",
        QUERY_STRING: "service=git-upload-pack",
        REQUEST_METHOD: "GET",
        CONTENT_TYPE: "",
        CONTENT_LENGTH: "0",
        ...expectedProtocol,
      });
    });
  }
});

describe("uploadPackEnvironment", () => {
  for (const { title, gitProtocol, expectedProtocol } of [
    {
      title: "adds git's GIT_PROTOCOL, for nine keys and no inherited variable",
      gitProtocol: "version=2",
      expectedProtocol: { GIT_PROTOCOL: "version=2" },
    },
    {
      title: "returns the eight suite git keys and no inherited variable without a protocol",
      gitProtocol: undefined,
      expectedProtocol: {},
    },
  ] satisfies ReadonlyArray<{
    title: string;
    gitProtocol: string | undefined;
    expectedProtocol: NodeJS.ProcessEnv;
  }>) {
    test(title, (t) => {
      // arrange
      inheritVariables(t);

      // act
      const environment = uploadPackEnvironment("/run/ssh-host/home", gitProtocol);

      // assert
      assert.deepStrictEqual(environment, {
        ...suiteGitKeys("/run/ssh-host/home"),
        ...expectedProtocol,
      });
    });
  }
});

describe("ipcChildEnvironment", () => {
  // The runner's own values, which the child must keep: the preload's test
  // home always, and the coverage directory only when the runner collects.
  const testHome = process.env.PI_CM_TEST_HOME;
  const coverage = process.env.NODE_V8_COVERAGE;
  const runnerKeys = {
    PATH: process.env.PATH ?? "",
    PI_CM_TEST_HOME: testHome,
    ...(coverage === undefined ? {} : { NODE_V8_COVERAGE: coverage }),
  };

  for (const { title, options, expectedEnvironment } of [
    {
      title: "returns PATH, HOME, the runner's test home and coverage, and no inherited variable",
      options: { home: "/run/child-home" },
      expectedEnvironment: { ...runnerKeys, HOME: "/run/child-home" },
    },
    {
      title: "adds the named agent directory and no inherited variable",
      options: { home: "/run/child-home", agentDir: "/run/child-agent" },
      expectedEnvironment: {
        ...runnerKeys,
        HOME: "/run/child-home",
        PI_CODING_AGENT_DIR: "/run/child-agent",
      },
    },
  ] satisfies ReadonlyArray<{
    title: string;
    options: Parameters<typeof ipcChildEnvironment>[0];
    expectedEnvironment: NodeJS.ProcessEnv;
  }>) {
    test(title, (t) => {
      // arrange
      inheritVariables(t);

      // act
      const environment = ipcChildEnvironment(options);

      // assert
      assert.deepStrictEqual(environment, expectedEnvironment);
    });
  }

  test("throws when the runner has no test home, so a forked child cannot move its HOME", (t) => {
    // arrange
    inheritVariables(t);
    plantVariables(t, { PI_CM_TEST_HOME: undefined });

    // act & assert
    assert.throws(() => ipcChildEnvironment({ home: "/run/child-home" }), {
      name: "Error",
      message:
        "PI_CM_TEST_HOME is not set: run the integration suite through " +
        "`node --import scripts/isolated-pi-home.mjs`, or a forked child moves its HOME",
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

  test("D-SG-13, D-SG-15: adds a scenario Pi's git timeout and keep variables, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS: "1000",
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: "true",
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
      CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS: "1000",
      CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: "true",
    });
  });

  test("D-SG-24: adds a scenario Pi's CLAUDE_CODE_PLUGIN_PREFER_HTTPS and CLAUDE_CODE_REMOTE, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "on",
      CLAUDE_CODE_REMOTE: "true",
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
      CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "on",
      CLAUDE_CODE_REMOTE: "true",
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

  test("D-SG-14: adds the Device Flow profile's https_proxy and no_proxy, not the shell's", (t) => {
    // arrange
    inheritVariables(t);
    const git = {
      NODE_EXTRA_CA_CERTS: "/run/cert.pem",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig",
      GIT_SSL_CAINFO: "/run/cert.pem",
      PATH: "/run/ssh-host/bin:/usr/bin",
      https_proxy: "http://127.0.0.1:8080",
      no_proxy: "127.0.0.1",
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
      https_proxy: "http://127.0.0.1:8080",
      no_proxy: "127.0.0.1",
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
