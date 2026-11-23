/**
 * @fileoverview Checks the SSH stand-in's own answers: a system git clone
 * over an SSH URL reaches the stub `ssh` first on PATH and gets the bare
 * repository served under the repositories root, every launch is recorded
 * whole, a host the run did not register fails as an unreachable host, and a
 * reset leaves no host and no launch (SG-HRN-03, HOST-02).
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  runSystemGit,
  SystemGitError,
} from "../platform/git-test-repository.ts";

import type { SystemGitCall } from "../platform/git-test-repository.ts";
import type { TestContext } from "node:test";

const HOST = "stand-in.test";

/** A started stand-in, the repositories root it serves, and the tip of `acme/tools`. */
interface ServedHost {
  readonly host: SshGitHost;
  readonly repositoriesRoot: string;
  readonly first: string;
  readonly tip: string;
}

/**
 * Starts a stand-in in a fresh root that registers `stand-in.test` as an
 * authenticated host and serves a two-commit `acme/tools` repository.
 */
async function startHost(t: TestContext): Promise<ServedHost> {
  const root = await mkdtemp(path.join(tmpdir(), "ssh-git-host-"));
  const repositoriesRoot = path.join(root, "repositories");
  const started: SshGitHost[] = [];
  // node:test runs after hooks in the order they were added, and close()
  // reads the launch log under the root, so one hook closes, then removes.
  t.after(async () => {
    try {
      await Promise.all(started.map((host) => host.close()));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const host = await SshGitHost.start(path.join(root, "ssh-host"), { repositoriesRoot });
  started.push(host);
  await host.register(HOST, { probe: { kind: "authenticated", user: "acme" } });
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const tip = await repository.commit([{ filepath: "NOTES.md", contents: "notes\n" }], "second");
  await repository.cloneBare(path.join(repositoriesRoot, "acme", "tools.git"));
  return { host, repositoriesRoot, first: repository.initialOid, tip };
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

  test("fails a clone from a host the run did not register as an unreachable host", async (t) => {
    const { host } = await startHost(t);
    const client = await sshClient(t, host);

    await assert.rejects(
      runSystemGit(client.call, "clone", "-q", "git@unregistered.test:acme/tools.git", "tools"),
      (error: unknown) =>
        error instanceof SystemGitError && error.stderr.includes("Could not resolve hostname"),
    );
  });

  test("holds no host and no launch after a reset", async (t) => {
    const { host } = await startHost(t);
    const client = await sshClient(t, host);
    await runSystemGit(client.call, "clone", "-q", `git@${HOST}:acme/tools.git`, "tools");

    await host.reset();

    assert.deepStrictEqual(await host.snapshot(), { hosts: [], launches: [] });
  });
});
