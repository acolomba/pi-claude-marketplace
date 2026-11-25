/**
 * @fileoverview Checks the SSH stand-in's own answers: a system git clone
 * over an SSH URL reaches the stub `ssh` first on PATH and gets the bare
 * repository served under the repositories root, every launch is recorded
 * whole, a host the run did not register fails as an unreachable host, and a
 * reset leaves no host and no launch (SG-HRN-03, HOST-02). It also checks
 * that a probe and `ssh -G` get the answers Claude Code 2.1.330 reads, that
 * a held probe ends when its caller kills it or dies, that a path outside
 * the repositories root is never served, and that one repository clones the
 * same over HTTPS and over SSH.
 */

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { waitUntilProcessesExit } from "../../features/lib/mcp-implementation.ts";
import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";
import { parseSshLaunch, servedRepository } from "../../features/lib/ssh-git-host/launch.ts";
import { isRunning } from "../../features/lib/turn-records.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  runSystemGit,
  SystemGitError,
} from "../platform/git-test-repository.ts";

import type { SshLaunchRecord } from "../../features/lib/ssh-git-host/launch.ts";
import type { SystemGitCall } from "../platform/git-test-repository.ts";
import type { ChildProcess, ExecFileException } from "node:child_process";
import type { TestContext } from "node:test";

const HOST = "stand-in.test";

// The probe argv of Claude Code 2.1.330, before its destination.
const PROBE_OPTIONS = [
  "-T",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=2",
  "-o",
  "StrictHostKeyChecking=yes",
];

// The ssh command Claude Code 2.1.330 pins for git's transport.
const UPSTREAM_SSH_COMMAND = "core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes";

// A stub records its launch within milliseconds; the margin covers a loaded CI runner.
const LAUNCH_TIMEOUT_MS = 10_000;

// A stub that answers a probe does so within milliseconds of recording its
// launch, so one that still runs after this wait holds the probe.
const ANSWER_WAIT_MS = 300;

/** A fresh root for one case, and a way to close a host in it before the root goes. */
interface CaseRoot {
  readonly root: string;
  readonly closeLater: (host: { close(): Promise<void> }) => void;
}

async function caseRoot(t: TestContext): Promise<CaseRoot> {
  const root = await mkdtemp(path.join(tmpdir(), "ssh-git-host-"));
  const started: Array<{ close(): Promise<void> }> = [];
  // node:test runs after hooks in the order they were added, and close()
  // reads the launch log under the root, so one hook closes, then removes.
  t.after(async () => {
    try {
      await Promise.all(started.map((host) => host.close()));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  return { root, closeLater: (host) => started.push(host) };
}

/** A started stand-in, the repositories root it serves, and the commits of `acme/tools`. */
interface ServedHost {
  readonly host: SshGitHost;
  readonly repositoriesRoot: string;
  readonly first: string;
  readonly tip: string;
}

/**
 * Builds a two-commit repository and publishes it bare at `target`, so the
 * first commit is reachable but no ref names it.
 */
async function publish(
  t: TestContext,
  target: string,
): Promise<{ readonly first: string; readonly tip: string }> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const tip = await repository.commit([{ filepath: "NOTES.md", contents: "notes\n" }], "second");
  await repository.cloneBare(target);
  return { first: repository.initialOid, tip };
}

/**
 * Starts a stand-in in a fresh root that registers `stand-in.test` as an
 * authenticated host and serves a two-commit `acme/tools` repository.
 */
async function startHost(t: TestContext): Promise<ServedHost> {
  const { root, closeLater } = await caseRoot(t);
  const repositoriesRoot = path.join(root, "repositories");
  const host = await SshGitHost.start(path.join(root, "ssh-host"), { repositoriesRoot });
  closeLater(host);
  await host.register(HOST, { probe: { kind: "authenticated", user: "acme" } });
  const commits = await publish(t, path.join(repositoriesRoot, "acme", "tools.git"));
  return { host, repositoriesRoot, ...commits };
}

/** A system git client with its own scratch HOME whose PATH finds the stub first. */
interface SshClient {
  readonly call: SystemGitCall;
  inClone(clone: string): SystemGitCall;
}

async function sshClient(t: TestContext, host: SshGitHost): Promise<SshClient> {
  const root = await createGitTestDirectory(t, { boundary: "local" });
  const home = await createGitTestDirectory(t, { boundary: "local" });
  const variables = { PATH: host.searchPath() };
  return {
    call: { cwd: root, home, variables },
    inClone: (clone) => ({ cwd: path.join(root, clone), home, variables }),
  };
}

/** How one launch of the stub `ssh` ended, and what it wrote. */
interface SshRun {
  readonly exitCode: number | undefined;
  readonly stdout: string;
  readonly stderr: string;
}

function exitCodeOf(error: ExecFileException | null): number | undefined {
  if (error === null) {
    return 0;
  }

  return typeof error.code === "number" ? error.code : undefined;
}

/** Runs the stub `ssh` of `host` with `argv`, as Claude Code runs its probe. */
function runSsh(host: SshGitHost, argv: readonly string[]): Promise<SshRun> {
  return new Promise((resolve) => {
    execFile(
      path.join(host.binDirectory, "ssh"),
      [...argv],
      { env: { PATH: host.searchPath() }, timeout: LAUNCH_TIMEOUT_MS },
      (error, stdout, stderr) => {
        resolve({
          exitCode: exitCodeOf(error),
          stdout,
          stderr,
        });
      },
    );
  });
}

/** How a child process ended: its exit code, or the signal that ended it. */
interface ProcessExit {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

/** A probe of `hold.test` started on the stub `ssh`, and its exit. */
interface HeldProbe {
  readonly child: ChildProcess;
  readonly exited: Promise<ProcessExit>;
}

/** Starts a probe of `hold.test` as Claude Code runs it, killed after the case if it still runs. */
function startHeldProbe(t: TestContext, host: SshGitHost): HeldProbe {
  const child = spawn(path.join(host.binDirectory, "ssh"), [...PROBE_OPTIONS, "git@hold.test"], {
    env: { PATH: host.searchPath() },
    stdio: "ignore",
  });
  const exited = new Promise<ProcessExit>((resolve) => {
    child.once("exit", (exitCode, signal) => {
      resolve({ exitCode, signal });
    });
  });
  t.after(async () => {
    child.kill("SIGKILL");
    await exited;
  });
  return { child, exited };
}

/** Waits until the stand-in has recorded a launch since `window`, and returns the first. */
async function firstLaunchSince(host: SshGitHost, window: number): Promise<SshLaunchRecord> {
  const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
  for (;;) {
    const [launch] = await host.launchesSince(window);
    if (launch !== undefined) {
      return launch;
    }

    assert.ok(Date.now() < deadline, "the stub recorded no launch");
    await delay(20);
  }
}

describe("parseSshLaunch", () => {
  const cases: ReadonlyArray<{
    readonly title: string;
    readonly argv: readonly string[];
    readonly expected: ReturnType<typeof parseSshLaunch>;
  }> = [
    {
      title: "reads Claude Code's probe as four options, a destination, and no command",
      argv: [...PROBE_OPTIONS, "git@github.com"],
      expected: {
        options: [
          { name: "-T" },
          { name: "-o", value: "BatchMode=yes" },
          { name: "-o", value: "ConnectTimeout=2" },
          { name: "-o", value: "StrictHostKeyChecking=yes" },
        ],
        printConfig: false,
        destination: "git@github.com",
        command: "",
      },
    },
    {
      title: "reads git's transport launch with its SendEnv option and upload-pack command",
      argv: ["-o", "SendEnv=GIT_PROTOCOL", `git@${HOST}`, "git-upload-pack 'acme/tools.git'"],
      expected: {
        options: [{ name: "-o", value: "SendEnv=GIT_PROTOCOL" }],
        printConfig: false,
        destination: `git@${HOST}`,
        command: "git-upload-pack 'acme/tools.git'",
      },
    },
    {
      title: "reads the port of an ssh:// URL",
      argv: [
        "-o",
        "SendEnv=GIT_PROTOCOL",
        "-p",
        "2222",
        `git@${HOST}`,
        "git-upload-pack '/acme/tools.git'",
      ],
      expected: {
        options: [
          { name: "-o", value: "SendEnv=GIT_PROTOCOL" },
          { name: "-p", value: "2222" },
        ],
        printConfig: false,
        destination: `git@${HOST}`,
        command: "git-upload-pack '/acme/tools.git'",
      },
    },
    {
      title: "reads -G as a launch that prints its config",
      argv: ["-G", "git@github.com"],
      expected: {
        options: [{ name: "-G" }],
        printConfig: true,
        destination: "git@github.com",
        command: "",
      },
    },
    {
      title: "reads flags that take no value",
      argv: ["-4", "-v", "-T", "git@github.com"],
      expected: {
        options: [{ name: "-4" }, { name: "-v" }, { name: "-T" }],
        printConfig: false,
        destination: "git@github.com",
        command: "",
      },
    },
    {
      title: "reads attached option values",
      argv: ["-p2222", "-oBatchMode=yes", "git@github.com"],
      expected: {
        options: [
          { name: "-p", value: "2222" },
          { name: "-o", value: "BatchMode=yes" },
        ],
        printConfig: false,
        destination: "git@github.com",
        command: "",
      },
    },
  ];

  for (const { title, argv, expected } of cases) {
    test(title, () => {
      assert.deepStrictEqual(parseSshLaunch(argv), expected);
    });
  }
});

describe("servedRepository", () => {
  const root = path.join(path.sep, "run", "repositories");
  const cases: ReadonlyArray<readonly [string, string | undefined]> = [
    ["acme/tools.git", path.join(root, "acme", "tools.git")],
    ["/acme/tools.git", path.join(root, "acme", "tools.git")],
    ["", undefined],
    ["/", undefined],
    ["../outside.git", undefined],
    ["acme/../../outside.git", undefined],
    ["//etc/passwd", undefined],
    ["acme/to'ols.git", undefined],
    ['acme/to"ols.git', undefined],
    ["acme/tools.git\0", undefined],
  ];

  for (const [requested, expected] of cases) {
    test(`maps ${JSON.stringify(requested)} to ${String(expected)}`, () => {
      assert.strictEqual(servedRepository(root, requested), expected);
    });
  }
});

describe("SshGitHost with system git", () => {
  test("clones a repository over an scp-like SSH URL through the stub first on PATH", async (t) => {
    const { host, tip } = await startHost(t);
    const client = await sshClient(t, host);
    const window = await host.mark();

    await runSystemGit(client.call, "clone", "-q", `git@${HOST}:acme/tools.git`, "tools");

    assert.strictEqual(await runSystemGit(client.inClone("tools"), "rev-parse", "HEAD"), tip);
    const launches = await host.launchesSince(window);
    assert.strictEqual(launches.length, 1);
    const [launch] = launches;
    assert.ok(launch !== undefined && Number.isInteger(launch.pid) && launch.pid > 0);
    assert.deepStrictEqual(launch.argv.slice(-2), [
      `git@${HOST}`,
      "git-upload-pack 'acme/tools.git'",
    ]);
    assert.strictEqual(launch.gitProtocol, "version=2");
  });

  test("clones over an ssh:// URL with a port, and records the port", async (t) => {
    const { host, tip } = await startHost(t);
    const client = await sshClient(t, host);
    const window = await host.mark();

    await runSystemGit(
      client.call,
      "clone",
      "-q",
      `ssh://git@${HOST}:2222/acme/tools.git`,
      "tools",
    );

    assert.strictEqual(await runSystemGit(client.inClone("tools"), "rev-parse", "HEAD"), tip);
    const [launch] = await host.launchesSince(window);
    const argv = launch?.argv ?? [];
    assert.strictEqual(argv[argv.indexOf("-p") + 1], "2222");
    assert.strictEqual(argv.at(-1), "git-upload-pack '/acme/tools.git'");
  });

  test("clones with Claude Code's pinned core.sshCommand, whose options come first", async (t) => {
    const { host, tip } = await startHost(t);
    const client = await sshClient(t, host);
    const window = await host.mark();

    await runSystemGit(
      client.call,
      "-c",
      UPSTREAM_SSH_COMMAND,
      "clone",
      "-q",
      `git@${HOST}:acme/tools.git`,
      "tools",
    );

    assert.strictEqual(await runSystemGit(client.inClone("tools"), "rev-parse", "HEAD"), tip);
    const [launch] = await host.launchesSince(window);
    assert.deepStrictEqual(launch?.argv.slice(0, 4), [
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
    ]);
  });

  test("fetches a commit no ref names by its SHA into a shallow SSH clone", async (t) => {
    const { host, first } = await startHost(t);
    const client = await sshClient(t, host);
    await runSystemGit(
      client.call,
      "clone",
      "-q",
      "--depth",
      "1",
      `git@${HOST}:acme/tools.git`,
      "tools",
    );

    const clone = client.inClone("tools");
    await runSystemGit(clone, "fetch", "-q", "--depth", "1", "origin", first);

    assert.strictEqual(await runSystemGit(clone, "rev-parse", "FETCH_HEAD"), first);
  });

  test("fails a clone from a host the run did not register as an unreachable host", async (t) => {
    const { host } = await startHost(t);
    const client = await sshClient(t, host);

    await assert.rejects(
      runSystemGit(client.call, "clone", "-q", "git@unregistered.test:acme/tools.git", "tools"),
      (error: unknown) =>
        error instanceof SystemGitError && error.stderr.includes("Could not resolve hostname"),
    );
  });

  test("never serves a repository outside the repositories root", async (t) => {
    const { host, repositoriesRoot } = await startHost(t);
    await publish(t, path.join(repositoriesRoot, "..", "outside.git"));

    const run = await runSsh(host, [`git@${HOST}`, "git-upload-pack '../outside.git'"]);

    assert.strictEqual(run.exitCode, 128);
    assert.strictEqual(run.stdout, "");
    assert.ok(run.stderr.includes("does not appear to be a git repository"), run.stderr);
  });

  test("holds no host and no launch after a reset", async (t) => {
    const { host } = await startHost(t);
    const client = await sshClient(t, host);
    await runSystemGit(client.call, "clone", "-q", `git@${HOST}:acme/tools.git`, "tools");

    await host.reset();

    assert.deepStrictEqual(await host.snapshot(), { hosts: [], launches: [] });
  });
});

describe("SshGitHost answers to Claude Code's probe", () => {
  const cases: ReadonlyArray<{
    readonly host: string;
    readonly exitCode: number;
    readonly fragments: readonly string[];
  }> = [
    {
      host: "authenticated.test",
      exitCode: 1,
      fragments: ["Hi acme!", "successfully authenticated"],
    },
    { host: "denied.test", exitCode: 255, fragments: ["Permission denied (publickey)"] },
    { host: "host-key.test", exitCode: 255, fragments: ["Host key verification failed."] },
    { host: "unknown.test", exitCode: 255, fragments: ["Could not resolve hostname"] },
  ];

  for (const { host: name, exitCode, fragments } of cases) {
    test(`answers a probe of ${name} with exit ${exitCode}`, async (t) => {
      const { host } = await startHost(t);
      await host.register("authenticated.test", { probe: { kind: "authenticated", user: "acme" } });
      await host.register("denied.test", { probe: { kind: "denied" } });
      await host.register("host-key.test", { probe: { kind: "host-key" } });

      const run = await runSsh(host, [...PROBE_OPTIONS, `git@${name}`]);

      assert.strictEqual(run.exitCode, exitCode);
      for (const fragment of fragments) {
        assert.ok(run.stderr.includes(fragment), run.stderr);
      }
    });
  }

  test("names the destination's user and host in a denied answer", async (t) => {
    const { host } = await startHost(t);
    await host.register("denied.test", { probe: { kind: "denied" } });

    const run = await runSsh(host, [...PROBE_OPTIONS, "git@denied.test"]);

    assert.ok(run.stderr.includes("git@denied.test: Permission denied (publickey)."), run.stderr);
  });

  test("holds a probe until its caller kills it, leaving no stub", async (t) => {
    const { host } = await startHost(t);
    await host.register("hold.test", { probe: { kind: "hold" } });
    const window = await host.mark();
    const { child, exited } = startHeldProbe(t, host);
    const launch = await firstLaunchSince(host, window);
    await delay(ANSWER_WAIT_MS);

    child.kill("SIGTERM");
    const exit = await exited;

    assert.deepStrictEqual(exit, { exitCode: null, signal: "SIGTERM" });
    assert.strictEqual(launch.pid, child.pid);
    assert.ok(!isRunning(launch.pid));
    await host.reset();
  });

  test("fails a reset, naming the pid, while a held probe still runs", async (t) => {
    const { host } = await startHost(t);
    await host.register("hold.test", { probe: { kind: "hold" } });
    const window = await host.mark();
    const { child, exited } = startHeldProbe(t, host);
    const launch = await firstLaunchSince(host, window);

    await assert.rejects(
      host.reset(),
      (error: unknown) => error instanceof Error && error.message.includes(String(launch.pid)),
    );
    child.kill("SIGTERM");
    await exited;
    assert.ok(!isRunning(launch.pid));
  });

  test("ends a held probe on its own once its caller dies", async (t) => {
    const { host } = await startHost(t);
    await host.register("hold.test", { probe: { kind: "hold" } });
    const window = await host.mark();
    // The shell is the stub's caller: it starts the probe in the background
    // and waits, so a SIGKILL ends the shell and leaves the stub orphaned.
    const caller = spawn(
      "/bin/sh",
      [
        "-c",
        '"$0" "$@" & wait',
        path.join(host.binDirectory, "ssh"),
        ...PROBE_OPTIONS,
        "git@hold.test",
      ],
      { env: { PATH: host.searchPath() }, stdio: "ignore" },
    );
    const exited = once(caller, "exit");
    t.after(async () => {
      caller.kill("SIGKILL");
      await exited;
    });
    const launch = await firstLaunchSince(host, window);

    caller.kill("SIGKILL");
    await exited;

    try {
      await waitUntilProcessesExit([launch.pid], LAUNCH_TIMEOUT_MS);
    } finally {
      // A stub that missed its caller's death would hold until its limit, and
      // the case root's close() would fail on it before any later hook ran.
      if (isRunning(launch.pid)) {
        process.kill(launch.pid, "SIGKILL");
      }
    }
  });

  test("records two probes started at once as two whole launches", async (t) => {
    const { host } = await startHost(t);
    const window = await host.mark();

    await Promise.all([
      runSsh(host, [...PROBE_OPTIONS, `git@${HOST}`]),
      runSsh(host, [...PROBE_OPTIONS, `git@${HOST}`]),
    ]);

    const launches = await host.launchesSince(window);
    assert.strictEqual(launches.length, 2);
    assert.notStrictEqual(launches[0]?.pid, launches[1]?.pid);
  });
});

describe("SshGitHost answers to a transport launch", () => {
  const UPLOAD_PACK = "git-upload-pack 'acme/tools.git'";

  test("authenticates a probe of a host without repository access", async (t) => {
    const { host } = await startHost(t);
    await host.register("no-repository.test", { probe: { kind: "no-repository", user: "acme" } });

    const run = await runSsh(host, [...PROBE_OPTIONS, "git@no-repository.test"]);

    assert.deepStrictEqual(run, {
      exitCode: 1,
      stdout: "",
      stderr:
        "Hi acme! You've successfully authenticated, but GitHub does not provide shell access.\n",
    });
  });

  test("refuses a git-upload-pack launch to a host without repository access as GitHub does", async (t) => {
    const { host } = await startHost(t);
    await host.register("no-repository.test", { probe: { kind: "no-repository", user: "acme" } });

    const run = await runSsh(host, ["git@no-repository.test", UPLOAD_PACK]);

    assert.deepStrictEqual(run, {
      exitCode: 1,
      stdout: "",
      stderr: "ERROR: Repository not found.\n",
    });
  });

  test("fails a system git clone from a host without repository access", async (t) => {
    const { host } = await startHost(t);
    await host.register("no-repository.test", { probe: { kind: "no-repository", user: "acme" } });
    const client = await sshClient(t, host);

    await assert.rejects(
      runSystemGit(client.call, "clone", "-q", "git@no-repository.test:acme/tools.git", "tools"),
      (error: unknown) =>
        error instanceof SystemGitError &&
        error.stderr.includes("ERROR: Repository not found.") &&
        error.stderr.includes("Could not read from remote repository."),
    );
  });
});

describe("SshGitHost answers to ssh -G", () => {
  test("prints the host's config with no proxy line", async (t) => {
    const { host } = await startHost(t);
    await host.register("github.com", { probe: { kind: "denied" } });

    const run = await runSsh(host, ["-G", "git@github.com"]);

    assert.strictEqual(run.exitCode, 0);
    const lines = run.stdout.split("\n");
    assert.ok(lines.includes("hostname github.com"), run.stdout);
    assert.ok(!lines.some((line) => /^(proxycommand|proxyjump) /.test(line)), run.stdout);
  });

  test("prints the proxy line the host's arm names", async (t) => {
    const { host } = await startHost(t);
    await host.register("proxied.test", {
      probe: { kind: "denied" },
      proxy: "proxycommand nc %h %p",
    });

    const run = await runSsh(host, ["-G", "git@proxied.test"]);

    assert.strictEqual(run.exitCode, 0);
    assert.ok(run.stdout.split("\n").includes("proxycommand nc %h %p"), run.stdout);
  });

  test("refuses a proxy that is not one proxy line", async (t) => {
    const { host } = await startHost(t);

    await assert.rejects(
      host.register("proxied.test", { probe: { kind: "denied" }, proxy: "user root" }),
      /not one proxy line/,
    );
  });
});

describe("SshGitHost beside HttpsGitHost", () => {
  test("serves a repository the https host publishes with the same HEAD over both", async (t) => {
    const { root, closeLater } = await caseRoot(t);
    const https = await HttpsGitHost.start(path.join(root, "git-host"));
    closeLater(https);
    const ssh = await SshGitHost.start(path.join(root, "ssh-host"), {
      repositoriesRoot: https.repositoriesRoot,
    });
    closeLater(ssh);
    await ssh.register(HOST, { probe: { kind: "authenticated", user: "acme" } });
    const { tip } = await publish(t, https.repositoryPath("tools"));
    const client = await sshClient(t, ssh);
    const overHttps = { ...client.call, variables: { GIT_SSL_CAINFO: https.certificatePath } };

    await runSystemGit(overHttps, "clone", "-q", https.repositoryUrl("tools"), "over-https");
    await runSystemGit(client.call, "clone", "-q", `git@${HOST}:acme/tools.git`, "over-ssh");

    const heads = await Promise.all(
      ["over-https", "over-ssh"].map((clone) =>
        runSystemGit(client.inClone(clone), "rev-parse", "HEAD"),
      ),
    );
    assert.deepStrictEqual(heads, [tip, tip]);
  });
});
