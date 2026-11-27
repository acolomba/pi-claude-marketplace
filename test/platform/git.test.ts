import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import * as path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  checkout,
  clone,
  fetchCommit,
  listRemotes,
  listLocalTags,
  listRemoteTags,
  probeGitHubSsh,
  resolveRef,
  resolveRemoteRef,
  runWithGitAbortSignal,
  sshShowsDirectGitHub,
  sshShowsDirectGitHubThroughGit,
  sshUrlRewritten,
  userSshOverride,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  FetchedUrlCause,
  GitCommandError,
  InvalidGitHubBaseUrlError,
  StoredCredentialRejectedError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import { captureDebugLog } from "./debug-log-capture.ts";
import { registerGitOpsContract } from "./git-ops-contract.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  gitTestCheckout,
} from "./git-test-repository.ts";
import { hermeticGitProcess, recordingGitProcess, systemGitOps } from "./system-git-ops.ts";

import type {
  GitProcess,
  GitRequest,
  GitResult,
  SshRun,
  SystemGitProcess,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type * as GitPlatform from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  RemoteTag,
  SshProbeResult,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { GitOpsContractParticipant } from "./git-ops-contract.ts";

// SG-TRN-01: the in-process authentication callbacks left with the second git
// transport; git asks its credential helpers itself. Restoring the export
// makes the `satisfies` resolve and turns the directive below into an unused
// one (TS2578).
// @ts-expect-error platform/git.ts does not expose the auth-callback factory
void ({} satisfies { readonly retired?: typeof GitPlatform.buildAuthCallbacks });

// The branch enumeration wrapper had no production caller: no module outside
// this file ever imported it, and it does not appear in the GitOps surface
// the orchestrators inject. Restoring the export makes the `satisfies`
// resolve and turns the directive into an unused one (TS2578).
// @ts-expect-error platform/git.ts does not expose a branch-listing wrapper
void ({} satisfies { readonly retired?: typeof GitPlatform.listBranches });
// @ts-expect-error platform/git.ts does not expose branch-listing options
void ({} satisfies { readonly retired?: GitPlatform.ListBranchesOptions });

const HOST = "git.example.invalid";
const REMOTE_URL = `https://${HOST}/owner/repo.git`;
const GITHUB_REMOTE_URL = "https://github.com/owner/repo.git";
const GITHUB_TOOLS_URL = "https://github.com/acme/tools.git";
const OTHER_HOST = "other.example.invalid";
const OTHER_REMOTE_URL = `https://${OTHER_HOST}/owner/repo.git`;
const OID_MAIN = "1111111111111111111111111111111111111111";
const OID_TAG = "3333333333333333333333333333333333333333";
const OID_PEELED = "4444444444444444444444444444444444444444";
const OID_LIGHTWEIGHT = "5555555555555555555555555555555555555555";
/**
 * Copies the `.git` of `dir` into a new directory, without its index, as the
 * clone cache's copy step does, and returns the new directory.
 */
async function copyOfGitDir(t: TestContext, dir: string): Promise<string> {
  const copyDir = await createGitTestDirectory(t, { boundary: "local" });
  await cp(path.join(dir, ".git"), path.join(copyDir, ".git"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  await rm(path.join(copyDir, ".git", "index"));
  return copyDir;
}

/**
 * D-SG-11: a repository whose last commit adds the relative symlink `link`,
 * with the clone keys an `isomorphic-git` clone writes (03-EVIDENCE Q5), and a
 * copy of its `.git` taken after the keys were set.
 */
async function copyOfOldClone(
  t: TestContext,
): Promise<{ readonly copyDir: string; readonly linkOid: string }> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await fs.promises.symlink("README.md", path.join(repository.dir, "link"));
  const linkOid = await repository.commitPaths("link", ["link"]);
  await repository.run("config", "core.symlinks", "false");
  await repository.run("config", "core.ignorecase", "true");
  await repository.run("config", "core.filemode", "false");
  return { copyDir: await copyOfGitDir(t, repository.dir), linkOid };
}

/** The target of the copy's `link` when it is a symlink, and its local `core.` keys. */
async function copyCheckoutShape(
  copyDir: string,
): Promise<{ readonly link: string; readonly coreKeys: readonly string[] }> {
  const linkPath = path.join(copyDir, "link");
  const link = (await lstat(linkPath)).isSymbolicLink()
    ? await readlink(linkPath)
    : "a regular file";
  const coreKeys = await gitTestCheckout(copyDir).run(
    "config",
    "--local",
    "--name-only",
    "--get-regexp",
    String.raw`^core\.`,
  );
  return { link, coreKeys: coreKeys.split("\n") };
}

/** Sets CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS for one case and restores it afterwards. */
function setGitTimeoutVariable(t: TestContext, value: string): void {
  const previous = process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
    } else {
      process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = previous;
    }
  });
  process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = value;
}

/**
 * The real participant serves one repository to system git through a user
 * config `insteadOf` whose base is its local path (D-SG-16), so no request
 * leaves the machine.
 */
async function createProductionGitOps(t: TestContext): Promise<GitOpsContractParticipant> {
  const remote = await createGitTestRepository(t, { boundary: "local" });
  const updatedOid = await remote.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  await remote.run("tag", "-a", "-m", "v1.0.0", "v1.0.0");
  const systemGit = await hermeticGitProcess(t, {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${remote.dir}.insteadOf`,
    GIT_CONFIG_VALUE_0: REMOTE_URL,
  });
  const worktree = await createGitTestRepository(t, { boundary: "local" });
  const localUpdatedOid = await worktree.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  assert.strictEqual(localUpdatedOid, updatedOid);
  await worktree.run("update-ref", "refs/heads/main", worktree.initialOid);
  await worktree.run("update-ref", "refs/heads/feature", updatedOid);
  await worktree.run("checkout", "-q", "-f", "main");
  await worktree.run("remote", "add", "origin", REMOTE_URL);
  const cloneDir = await createGitTestDirectory(t, { boundary: "local" });

  return {
    gitOps: systemGitOps(systemGit),
    worktreeDir: worktree.dir,
    cloneDir,
    remoteUrl: REMOTE_URL,
    initialOid: worktree.initialOid,
    updatedOid,
    readFile: async (dir, filepath) => {
      try {
        return await readFile(`${dir}/${filepath}`, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },
    copyGitDir: () => copyOfGitDir(t, worktree.dir),
    unfetchedCommit: async () => {
      const { dir, olderOids } = await shallowFileClone(t);
      return { dir, sha: olderOids[0] };
    },
  };
}

/**
 * SG-TRN-02: a repository with three commits and a depth-1 clone of it over
 * `file://`, so the clone holds only the last commit. `olderOids` are the two
 * commits the clone lacks, oldest first.
 */
async function shallowFileClone(t: TestContext): Promise<{
  readonly dir: string;
  readonly olderOids: readonly [string, string];
}> {
  const origin = await createGitTestRepository(t, { boundary: "local" });
  const secondOid = await origin.commit([{ filepath: "two.txt", contents: "two\n" }], "two");
  await origin.commit([{ filepath: "three.txt", contents: "three\n" }], "three");
  const dir = path.join(await createGitTestDirectory(t, { boundary: "local" }), "clone");
  await origin.run("clone", "-q", "--depth", "1", `file://${origin.dir}`, dir);
  return { dir, olderOids: [origin.initialOid, secondOid] };
}

/**
 * SG-PRC-06: the git process module's own failure, unwrapped, so a missing git
 * gets no fetched-URL cause even when the GitHub base override rewrote the URL.
 */
function isGitMissingWithoutCause(error: unknown): boolean {
  assert.ok(error instanceof GitCommandError);
  assert.deepStrictEqual(error.failure, { kind: "git-missing", detail: "not-found" });
  assert.strictEqual(error.message, "Git is required to install marketplaces.");
  assert.strictEqual(error.cause, undefined);
  return true;
}

/** The auth bundle bound to `HOST`. */
function boundAuth(): NonNullable<GitPlatform.CloneOptions["auth"]> {
  return { host: HOST };
}

/** The branch HEAD names in `dir`, or undefined when HEAD is detached. */
async function checkedOutBranch(dir: string): Promise<string | undefined> {
  const branch = await gitTestCheckout(dir).run("rev-parse", "--abbrev-ref", "HEAD");
  return branch === "HEAD" ? undefined : branch;
}

describe("local Git operations", () => {
  test("resolves HEAD to the initial commit", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "HEAD" }, systemGit);

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("SG-TRN-01: answers undefined for a ref the repository does not hold", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const oid = await resolveRef(
      { dir: repository.dir, ref: "refs/remotes/origin/nosuch" },
      systemGit,
    );

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("SG-TRN-01: resolves an annotated tag to the commit it tags", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("tag", "-a", "-m", "release", "v1", repository.initialOid);

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "refs/tags/v1" }, systemGit);

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("SG-TRN-01: answers undefined for a tag that names a tree", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const tree = await repository.run("rev-parse", `${repository.initialOid}^{tree}`);
    await repository.run("tag", "tree-tag", tree);

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "refs/tags/tree-tag" }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("checks out an existing branch", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("branch", "feature", repository.initialOid);

    // act
    await checkout({ dir: repository.dir, ref: "feature" }, systemGit);

    // assert
    assert.strictEqual(await checkedOutBranch(repository.dir), "feature");
  });

  test("SG-TRN-01: checks out the files of a commit the current branch moved to", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const movedOid = await repository.commit(
      [{ filepath: "README.md", contents: "# moved\n" }],
      "moved",
    );
    await repository.run("reset", "-q", "--hard", repository.initialOid);
    await repository.run("update-ref", "refs/heads/main", movedOid);

    // act
    await checkout({ dir: repository.dir, ref: "main" }, systemGit);

    // assert
    assert.deepStrictEqual(
      {
        branch: await checkedOutBranch(repository.dir),
        readme: await readFile(path.join(repository.dir, "README.md"), "utf8"),
      },
      { branch: "main", readme: "# moved\n" },
    );
  });

  test("checks out a detached commit", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    await checkout({ dir: repository.dir, ref: repository.initialOid }, systemGit);

    // assert
    assert.strictEqual(await checkedOutBranch(repository.dir), undefined);
    assert.strictEqual(
      await resolveRef({ dir: repository.dir, ref: "HEAD" }),
      repository.initialOid,
    );
  });

  test("D-SG-11: a copy checkout unsets the copied clone keys and writes a symlink as a link", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { copyDir, linkOid } = await copyOfOldClone(t);

    // act
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // assert
    assert.deepStrictEqual(await copyCheckoutShape(copyDir), {
      link: "README.md",
      coreKeys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
    });
  });

  test("D-SG-11: a second copy checkout finds the keys absent and leaves the same tree", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { copyDir, linkOid } = await copyOfOldClone(t);
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // act
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // assert
    assert.deepStrictEqual(await copyCheckoutShape(copyDir), {
      link: "README.md",
      coreKeys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
    });
  });

  test("D-SG-13: a copy checkout sends three key drops and the checkout, each with the configured limit", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const requests: GitRequest[] = [];
    const recordingGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };
    const keyDrop = (key: string): GitRequest => ({
      subcommand: "config",
      lane: "local",
      cwd: "/copy",
      options: ["--local", "--unset-all"],
      operands: [key],
      allowExit: [5],
      timeoutMs: 4321,
    });

    // act
    await checkout({ dir: "/copy", ref: OID_MAIN, fromCopiedGitDir: true }, recordingGit);

    // assert
    assert.deepStrictEqual(requests, [
      keyDrop("core.symlinks"),
      keyDrop("core.ignorecase"),
      keyDrop("core.filemode"),
      {
        subcommand: "checkout",
        lane: "local",
        cwd: "/copy",
        options: ["-f", "--quiet"],
        operands: [OID_MAIN],
        timeoutMs: 4321,
      },
    ]);
  });
});

describe("SG-PRC-06: the git-required gate", () => {
  /**
   * A git process over real system git whose own search path is an empty
   * directory, so it finds no git, recording each lookup and each request it
   * is asked for. The search path of this process stays as it is.
   */
  async function gitlessProcess(t: TestContext): Promise<{
    readonly gitProcess: GitProcess;
    readonly asked: () => { readonly lookups: number; readonly subcommands: readonly string[] };
  }> {
    const gitless = await hermeticGitProcess(t, {
      PATH: await createGitTestDirectory(t, { boundary: "local" }),
    });
    let lookups = 0;
    const subcommands: string[] = [];
    return {
      gitProcess: {
        locate: () => {
          lookups += 1;
          return gitless.locate();
        },
        run: (request) => {
          subcommands.push(request.subcommand);
          return gitless.run(request);
        },
      },
      asked: () => ({ lookups, subcommands }),
    };
  }

  const networkVerbs: readonly {
    readonly name: string;
    /** `target` is an empty directory a clone would write into. */
    readonly call: (target: string, gitProcess: GitProcess) => Promise<unknown>;
    /** The subcommand of the verb's first request. */
    readonly firstRequest: string;
  }[] = [
    {
      name: "clone",
      call: (target, gitProcess) => clone({ dir: target, url: GITHUB_REMOTE_URL }, gitProcess),
      firstRequest: "clone",
    },
    {
      name: "fetchCommit",
      call: (target, gitProcess) => fetchCommit({ dir: target, sha: OID_MAIN }, gitProcess),
      firstRequest: "config",
    },
    {
      name: "resolveRemoteRef",
      call: (_target, gitProcess) => resolveRemoteRef({ url: GITHUB_REMOTE_URL }, gitProcess),
      firstRequest: "ls-remote",
    },
    {
      name: "listRemoteTags",
      call: (_target, gitProcess) => listRemoteTags({ url: GITHUB_REMOTE_URL }, gitProcess),
      firstRequest: "ls-remote",
    },
  ];

  for (const verb of networkVerbs) {
    test(`D-SG-01: ${verb.name} fails as git missing in its first request and looks git up no other way`, async (t) => {
      // arrange
      const target = await createGitTestDirectory(t, { boundary: "local" });
      const gitless = await gitlessProcess(t);
      setGitHubBaseUrl(t, `https://${HOST}`);

      // act
      const calling = verb.call(target, gitless.gitProcess);

      // assert
      await assert.rejects(calling, isGitMissingWithoutCause);
      assert.deepStrictEqual(gitless.asked(), { lookups: 0, subcommands: [verb.firstRequest] });
      assert.deepStrictEqual(await readdir(target), []);
    });
  }

  test("D-SG-04: a clone succeeds once git is back", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const url = `file://${repository.dir}`;
    const refused = await createGitTestDirectory(t, { boundary: "local" });
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    const systemGit = await hermeticGitProcess(t);
    let current = (await gitlessProcess(t)).gitProcess;
    const gitProcess: GitProcess = {
      locate: () => current.locate(),
      run: (request) => current.run(request),
    };
    await assert.rejects(clone({ dir: refused, url }, gitProcess), isGitMissingWithoutCause);
    current = systemGit;

    // act
    await clone({ dir, url }, gitProcess);

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }, systemGit), repository.initialOid);
  });
});

/** Whether `dir` is a depth-1 clone: git wrote its `shallow` file. */
async function isShallowCheckout(dir: string): Promise<boolean> {
  return (await gitTestCheckout(dir).run("rev-parse", "--is-shallow-repository")) === "true";
}

/** A path inside a fresh test directory, where git makes the clone's own directory. */
async function cloneTarget(t: TestContext): Promise<string> {
  return path.join(await createGitTestDirectory(t, { boundary: "local" }), "clone");
}

/** Whether `target` exists. */
async function exists(target: string): Promise<boolean> {
  return lstat(target).then(
    () => true,
    () => false,
  );
}

describe("clone", () => {
  test("SG-TRN-02, C5: clones a branch at depth 1 and records the URL it was given", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);
    const dir = await cloneTarget(t);

    // act
    await clone({ dir, url: remote.url, ref: "dev", singleBranch: true }, systemGit);

    // assert
    assert.deepStrictEqual(
      {
        head: await resolveRef({ dir, ref: "HEAD" }, systemGit),
        shallow: await isShallowCheckout(dir),
        devFile: await readFile(path.join(dir, "dev.txt"), "utf8"),
        origin: await listRemotes({ dir }, systemGit),
      },
      {
        head: remote.devOid,
        shallow: true,
        devFile: "dev\n",
        origin: { kind: "origin", url: remote.url },
      },
    );
  });

  test("SG-TRN-02: a no-checkout clone writes no work tree file", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);
    const dir = await cloneTarget(t);

    // act
    await clone({ dir, url: remote.url, noCheckout: true }, systemGit);

    // assert
    assert.deepStrictEqual(
      {
        head: await resolveRef({ dir, ref: "HEAD" }, systemGit),
        entries: await readdir(dir),
      },
      { head: remote.initialOid, entries: [".git"] },
    );
  });

  test("SG-TRN-02: a clone of a branch the remote lacks fails as remote-ref-missing and leaves no target", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);
    const dir = await cloneTarget(t);

    // act
    const cloning = clone({ dir, url: remote.url, ref: "nosuch", singleBranch: true }, systemGit);

    // assert
    await assert.rejects(cloning, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "remote-ref-missing", operation: "clone --depth" },
      );
      return true;
    });
    assert.strictEqual(await exists(dir), false);
  });

  test("C5, D-SG-13, D-PL8-24: the argv puts --depth first and the ref in one word, with the limit and the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const signal = new AbortController().signal;
    const requests: GitRequest[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };

    // act
    await runWithGitAbortSignal(signal, () =>
      clone(
        { dir: "/staging", url: REMOTE_URL, ref: "dev", singleBranch: true, noCheckout: true },
        stubGit,
      ),
    );

    // assert
    assert.deepStrictEqual(requests, [
      {
        subcommand: "clone",
        lane: "network",
        options: [
          "--depth",
          "1",
          "--no-recurse-submodules",
          "--no-checkout",
          "--branch=dev",
          "--single-branch",
        ],
        operands: [REMOTE_URL, "/staging"],
        config: [],
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16, GHB-01: clones a github.com URL from the base and records the canonical origin", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);
    const recorded = recordingGitProcess(standIn.gitProcess);
    const dir = await cloneTarget(t);

    // act
    await clone({ dir, url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      {
        commands: recorded.commands,
        config: recorded.requests[0]?.config,
        head: await resolveRef({ dir, ref: "HEAD" }, standIn.gitProcess),
        origin: await listRemotes({ dir }, standIn.gitProcess),
      },
      {
        commands: [`clone --depth 1 --no-recurse-submodules ${GITHUB_TOOLS_URL} ${dir}`],
        config: [`url.https://${standIn.host.address}/.insteadOf=https://github.com/`],
        head: standIn.oid,
        origin: { kind: "origin", url: GITHUB_TOOLS_URL },
      },
    );
  });

  test("GHB-04: a clone of a non-GitHub URL ignores an invalid base", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);
    const dir = await cloneTarget(t);
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    await clone({ dir, url: remote.url }, systemGit);

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }, systemGit), remote.initialOid);
  });

  test("GHB-01: a failed clone from the base names the URL git fetched", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);
    const dir = await cloneTarget(t);

    // act
    const cloning = clone({ dir, url: "https://github.com/acme/missing.git" }, standIn.gitProcess);

    // assert
    await assert.rejects(cloning, (error: unknown) => {
      assert.ok(error instanceof GitCommandError && error.cause instanceof FetchedUrlCause);
      assert.deepStrictEqual(
        { operation: error.operation, url: error.cause.url },
        {
          operation: "clone --depth",
          url: `https://${standIn.host.address}/acme/missing.git`,
        },
      );
      return true;
    });
  });
});

const ORIGIN_READ = "config --local --get remote.origin.url";

describe("fetchCommit", () => {
  test("SG-TRN-02: fetches an older commit into a depth-1 clone with one depth-1 fetch", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    await fetchCommit({ dir, sha: olderOids[0] }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      {
        commands: recorded.commands,
        oid: await resolveRef({ dir, ref: olderOids[0] }, systemGit),
      },
      {
        commands: [ORIGIN_READ, `fetch --depth 1 origin ${olderOids[0]}`],
        oid: olderOids[0],
      },
    );
  });

  test("SG-TRN-02: a commit the remote lacks makes a shallow clone fetch its whole history", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    await fetchCommit({ dir, sha: OID_MAIN }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      {
        commands: recorded.commands,
        shallow: await gitTestCheckout(dir).run("rev-parse", "--is-shallow-repository"),
        oid: await resolveRef({ dir, ref: olderOids[1] }, systemGit),
      },
      {
        commands: [
          ORIGIN_READ,
          `fetch --depth 1 origin ${OID_MAIN}`,
          "rev-parse --is-shallow-repository",
          "fetch --unshallow origin",
        ],
        shallow: "false",
        oid: olderOids[1],
      },
    );
  });

  test("SG-TRN-02: the unshallow rung fetches the source's ref, and its failure is the one thrown", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    const fetching = fetchCommit({ dir, sha: OID_MAIN, ref: "nosuch" }, recorded.gitProcess);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "remote-ref-missing", operation: "fetch --unshallow" },
      );
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${OID_MAIN}`,
      "rev-parse --is-shallow-repository",
      "fetch --unshallow origin nosuch",
    ]);
  });

  test("D-SG-09: with unshallow false, a shallow clone fetches the one commit only and throws the first failure", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    const fetching = fetchCommit({ dir, sha: OID_MAIN, unshallow: false }, recorded.gitProcess);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "commit-missing", operation: "fetch --depth" },
      );
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [ORIGIN_READ, `fetch --depth 1 origin ${OID_MAIN}`]);
    assert.strictEqual(
      await gitTestCheckout(dir).run("rev-parse", "--is-shallow-repository"),
      "true",
    );
  });

  test("SG-TRN-02: a complete clone skips the unshallow rung and throws the first failure", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const origin = await createGitTestRepository(t, { boundary: "local" });
    const dir = path.join(await createGitTestDirectory(t, { boundary: "local" }), "clone");
    await origin.run("clone", "-q", `file://${origin.dir}`, dir);
    const recorded = recordingGitProcess(systemGit);

    // act
    const fetching = fetchCommit({ dir, sha: OID_MAIN }, recorded.gitProcess);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "commit-missing", operation: "fetch --depth" },
      );
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${OID_MAIN}`,
      "rev-parse --is-shallow-repository",
    ]);
  });

  test("D-PL8-24: an aborted first rung is thrown at once, with no second rung", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));

    // act
    const fetching = runWithGitAbortSignal(controller.signal, () =>
      fetchCommit({ dir, sha: olderOids[0] }, recorded.gitProcess),
    );

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.strictEqual(error.kind, "aborted");
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${olderOids[0]}`,
    ]);
  });

  test("D-SG-13 / D-PL8-24: each rung reads its own limit and carries the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const signal = new AbortController().signal;
    const requests: GitRequest[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        if (requests.length === 1) {
          return Promise.resolve({ exitCode: 0, stdout: `${REMOTE_URL}\n`, stderr: "" });
        }

        if (requests.length === 2) {
          return Promise.reject(
            new GitCommandError({ kind: "commit-missing" }, { operation: "fetch --depth" }),
          );
        }

        return Promise.resolve({ exitCode: 0, stdout: "true\n", stderr: "" });
      },
    };

    // act
    await runWithGitAbortSignal(signal, () =>
      fetchCommit({ dir: "/clone", sha: OID_MAIN, ref: "dev" }, stubGit),
    );

    // assert
    assert.deepStrictEqual(requests, [
      {
        subcommand: "config",
        lane: "local",
        cwd: "/clone",
        options: ["--local", "--get"],
        operands: ["remote.origin.url"],
        allowExit: [1],
        timeoutMs: 4321,
      },
      {
        subcommand: "fetch",
        lane: "network",
        options: ["--depth", "1"],
        operands: ["origin", OID_MAIN],
        config: [],
        cwd: "/clone",
        timeoutMs: 4321,
        signal,
      },
      {
        subcommand: "rev-parse",
        lane: "local",
        cwd: "/clone",
        options: ["--is-shallow-repository"],
        timeoutMs: 4321,
      },
      {
        subcommand: "fetch",
        lane: "network",
        options: ["--unshallow"],
        operands: ["origin", "dev"],
        config: [],
        cwd: "/clone",
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16: a clone whose origin is a github.com URL fetches with the base as insteadOf", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://127.0.0.1:4443/base/");
    const requests: GitRequest[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        return Promise.resolve({ exitCode: 0, stdout: `${GITHUB_TOOLS_URL}\n`, stderr: "" });
      },
    };

    // act
    await fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    assert.deepStrictEqual(
      requests.map((request) => [request.subcommand, request.config]),
      [
        ["config", undefined],
        ["fetch", ["url.https://127.0.0.1:4443/base/.insteadOf=https://github.com/"]],
      ],
    );
  });

  test("GHB-01: a failed rung under the base names the URL git fetched", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://127.0.0.1:4443/base/");
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) =>
        request.subcommand === "config"
          ? Promise.resolve({ exitCode: 0, stdout: `${GITHUB_TOOLS_URL}\n`, stderr: "" })
          : Promise.reject(
              new GitCommandError({ kind: "repository-not-found" }, { operation: "fetch --depth" }),
            ),
    };

    // act
    const fetching = fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError && error.cause instanceof FetchedUrlCause);
      assert.strictEqual(error.cause.url, "https://127.0.0.1:4443/base/acme/tools.git");
      return true;
    });
  });

  test("SG-TRN-02: a shallow check that fails throws the first rung's failure", async () => {
    // arrange
    const firstFailure = new GitCommandError(
      { kind: "commit-missing" },
      { operation: "fetch --depth" },
    );
    const subcommands: string[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        subcommands.push(request.subcommand);
        if (request.subcommand === "config") {
          return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        }

        return Promise.reject(
          request.subcommand === "fetch"
            ? firstFailure
            : new GitCommandError({ kind: "not-a-repository" }, { operation: "rev-parse" }),
        );
      },
    };

    // act
    const fetching = fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    await assert.rejects(fetching, (error: unknown) => error === firstFailure);
    assert.deepStrictEqual(subcommands, ["config", "fetch", "rev-parse"]);
  });
});

/**
 * SG-TRN-01: a repository served at a `file://` URL. `main` holds the initial
 * commit, which the lightweight tag `light`, the annotated tag `v1`, and an
 * annotated tag named `dev` name; the branch `dev` is one commit past it.
 */
async function advertisingRemote(t: TestContext): Promise<{
  readonly url: string;
  readonly initialOid: string;
  readonly devOid: string;
}> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await repository.run("tag", "light");
  await repository.run("tag", "-a", "-m", "v1", "v1");
  await repository.run("tag", "-a", "-m", "dev", "dev");
  await repository.run("checkout", "-q", "-b", "dev");
  const devOid = await repository.commit([{ filepath: "dev.txt", contents: "dev\n" }], "dev");
  await repository.run("checkout", "-q", "main");
  return { url: `file://${repository.dir}`, initialOid: repository.initialOid, devOid };
}

/**
 * The https git host serving the repository `acme/tools`, and a git process
 * that trusts its certificate, with `variables` over its environment.
 */
async function httpsStandIn(
  t: TestContext,
  variables: NodeJS.ProcessEnv = {},
): Promise<{
  readonly host: HttpsGitHost;
  readonly oid: string;
  readonly gitProcess: GitProcess;
}> {
  const root = await realpath(await createGitTestDirectory(t, { boundary: "local" }));
  const host = await HttpsGitHost.start(root);
  t.after(() => host.close());
  const served = await createGitTestRepository(t, { boundary: "local" });
  await served.cloneBare(host.repositoryPath("tools"));
  return {
    host,
    oid: served.initialOid,
    gitProcess: await hermeticGitProcess(t, {
      GIT_SSL_CAINFO: host.certificatePath,
      ...variables,
    }),
  };
}

/** D-SG-16: the https git host, with the GitHub base override pointed at it. */
async function gitHubBaseStandIn(t: TestContext): ReturnType<typeof httpsStandIn> {
  const standIn = await httpsStandIn(t);
  setGitHubBaseUrl(t, `https://${standIn.host.address}`);
  return standIn;
}

describe("resolveRemoteRef", () => {
  const SELECTIONS: ReadonlyArray<{
    readonly title: string;
    readonly ref?: string;
    readonly expected: (remote: Awaited<ReturnType<typeof advertisingRemote>>) => string;
  }> = [
    { title: "resolves the remote HEAD", expected: (remote) => remote.initialOid },
    {
      title: "resolves a branch by its short name before a tag of the same name",
      ref: "dev",
      expected: (remote) => remote.devOid,
    },
    {
      title: "resolves an annotated tag to the commit it peels to",
      ref: "v1",
      expected: (remote) => remote.initialOid,
    },
    {
      title: "resolves a lightweight tag to its commit",
      ref: "light",
      expected: (remote) => remote.initialOid,
    },
    {
      title: "resolves a bare advertised ref name",
      ref: "HEAD",
      expected: (remote) => remote.initialOid,
    },
  ];

  for (const { title, ref, expected } of SELECTIONS) {
    test(`SG-TRN-01: ${title}`, async (t) => {
      // arrange
      const remote = await advertisingRemote(t);
      const systemGit = await hermeticGitProcess(t);

      // act
      const oid = await resolveRemoteRef(
        { url: remote.url, ...(ref !== undefined && { ref }) },
        systemGit,
      );

      // assert
      assert.strictEqual(oid, expected(remote));
    });
  }

  test("SG-TRN-01: answers undefined for a ref the remote does not advertise", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);

    // act
    const oid = await resolveRemoteRef({ url: remote.url, ref: "missing" }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("SG-TRN-01: answers undefined for a remote whose HEAD names no commit", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const bare = path.join(await createGitTestDirectory(t, { boundary: "local" }), "unborn.git");
    await repository.cloneBare(bare);
    await gitTestCheckout(bare).run("symbolic-ref", "HEAD", "refs/heads/nosuch");
    const systemGit = await hermeticGitProcess(t);

    // act
    const oid = await resolveRemoteRef({ url: `file://${bare}` }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("D-SG-13 / D-PL8-24: sends one ls-remote of the four names with the limit and the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const remote = await advertisingRemote(t);
    const recorded = recordingGitProcess(await hermeticGitProcess(t));
    const signal = new AbortController().signal;

    // act
    await runWithGitAbortSignal(signal, () =>
      resolveRemoteRef({ url: remote.url, ref: "dev" }, recorded.gitProcess),
    );

    // assert
    assert.deepStrictEqual(recorded.requests, [
      {
        subcommand: "ls-remote",
        lane: "network",
        options: [],
        operands: [remote.url, "refs/heads/dev", "refs/tags/dev^{}", "refs/tags/dev", "dev"],
        config: [],
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16, GHB-01: resolves a github.com URL at the base through its insteadOf pair", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);
    const recorded = recordingGitProcess(standIn.gitProcess);

    // act
    const oid = await resolveRemoteRef({ url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    assert.strictEqual(oid, standIn.oid);
    assert.deepStrictEqual(
      recorded.requests.map((request) => request.config),
      [[`url.https://${standIn.host.address}/.insteadOf=https://github.com/`]],
    );
  });

  test("GHB-01: a failure at the base names the URL git fetched", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);

    // act
    const resolution = resolveRemoteRef(
      { url: "https://github.com/acme/missing.git" },
      standIn.gitProcess,
    );

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.ok(error.cause instanceof FetchedUrlCause);
      assert.deepStrictEqual(
        { kind: error.kind, url: error.cause.url },
        { kind: "repository-not-found", url: standIn.host.repositoryUrl("missing") },
      );
      return true;
    });
  });

  test("GHB-04: a failure outside github.com carries no cause and never reads the variable", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const missing = path.join(await createGitTestDirectory(t, { boundary: "local" }), "missing");
    const systemGit = await hermeticGitProcess(t);

    // act
    const resolution = resolveRemoteRef({ url: `file://${missing}` }, systemGit);

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, cause: error.cause },
        { kind: "repository-not-found", cause: undefined },
      );
      return true;
    });
  });

  test("GHB-03: an invalid base refuses a github.com URL before git runs", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://h.example/a=b");
    const recorded = recordingGitProcess(await hermeticGitProcess(t));

    // act
    const resolution = resolveRemoteRef({ url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof InvalidGitHubBaseUrlError);
      assert.strictEqual(error.problem, "equals-sign");
      return true;
    });
    assert.deepStrictEqual(recorded.requests, []);
  });
});

/** The password the credential stand-in wants. */
const HOST_PASSWORD = "stand-in-password";

/** The https git host serving `acme/tools`, armed to want `acme` and `HOST_PASSWORD`. */
async function credentialStandIn(
  t: TestContext,
  helper?: string,
): Promise<Awaited<ReturnType<typeof httpsStandIn>> & { readonly url: string }> {
  const standIn = await httpsStandIn(
    t,
    helper === undefined
      ? {}
      : {
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "credential.helper",
          GIT_CONFIG_VALUE_0: helper,
        },
  );
  await standIn.host.arm("tools", { kind: "credential", user: "acme", password: HOST_PASSWORD });
  return { ...standIn, url: standIn.host.repositoryUrl("tools") };
}

/** A user helper that answers every `get` with a password the host refuses. */
const WRONG_PASSWORD_HELPER = "!f() { echo username=acme; echo password=wrong; }; f";

/**
 * A git process whose every remote run fails as `https-auth` with `detail`,
 * in a clone whose recorded origin is `origin`.
 */
function failingAuthGitProcess(
  detail: "no-credential" | "rejected",
  origin = REMOTE_URL,
): {
  readonly gitProcess: GitProcess;
  readonly failures: GitCommandError[];
  readonly requests: GitRequest[];
} {
  const failures: GitCommandError[] = [];
  const requests: GitRequest[] = [];
  return {
    failures,
    requests,
    gitProcess: {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        if (request.subcommand === "config") {
          return Promise.resolve({ exitCode: 0, stdout: `${origin}\n`, stderr: "" });
        }

        const failure = new GitCommandError(
          { kind: "https-auth", detail },
          { operation: request.subcommand, exitCode: 128 },
        );
        failures.push(failure);
        return Promise.reject(failure);
      },
    },
  };
}

/** The requests of `requests` that ran `git fetch`. */
function fetchRequests(requests: readonly GitRequest[]): GitRequest[] {
  return requests.filter((request) => request.subcommand === "fetch");
}

describe("GAUTH-04 and D-1-03: an auth failure of a remote request", () => {
  test("GAUTH-04: a missing credential under a bundle is thrown as it failed, and git runs once", async (t) => {
    // arrange
    const standIn = await credentialStandIn(t);
    const recorded = recordingGitProcess(standIn.gitProcess);

    // act
    const resolution = resolveRemoteRef(
      {
        url: standIn.url,
        auth: { host: standIn.host.address },
      },
      recorded.gitProcess,
    );

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { failure: error.failure, cause: error.cause },
        { failure: { kind: "https-auth", detail: "no-credential" }, cause: undefined },
      );
      return true;
    });
    assert.strictEqual(recorded.requests.length, 1);
  });

  test("GAUTH-04: a refused stored credential throws StoredCredentialRejectedError with the git failure as its cause, and git runs once", async (t) => {
    // arrange
    const standIn = await credentialStandIn(t, WRONG_PASSWORD_HELPER);
    const recorded = recordingGitProcess(standIn.gitProcess);

    // act
    const resolution = resolveRemoteRef(
      {
        url: standIn.url,
        auth: { host: standIn.host.address },
      },
      recorded.gitProcess,
    );

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof StoredCredentialRejectedError);
      assert.ok(error.cause instanceof GitCommandError);
      assert.deepStrictEqual(
        { host: error.host, failure: error.cause.failure },
        { host: standIn.host.address, failure: { kind: "https-auth", detail: "rejected" } },
      );
      return true;
    });
    assert.strictEqual(recorded.requests.length, 1);
  });

  test("GAUTH-04: a refused credential of a fetchCommit rung in a clone of the bundle's host throws StoredCredentialRejectedError", async () => {
    // arrange
    const failing = failingAuthGitProcess("rejected");

    // act
    const fetching = fetchCommit(
      { dir: "/clone", sha: OID_MAIN, auth: boundAuth() },
      failing.gitProcess,
    );

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof StoredCredentialRejectedError);
      assert.deepStrictEqual(
        { host: error.host, causeIsFailure: error.cause === failing.failures[0] },
        { host: HOST, causeIsFailure: true },
      );
      return true;
    });
    assert.strictEqual(fetchRequests(failing.requests).length, 1);
  });

  test("D-1-03: a bundle for another host throws a refused credential's failure unchanged", async (t) => {
    // arrange
    const standIn = await credentialStandIn(t, WRONG_PASSWORD_HELPER);

    // act
    const resolution = resolveRemoteRef(
      {
        url: standIn.url,
        auth: { host: "github.com" },
      },
      standIn.gitProcess,
    );

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(error.failure, { kind: "https-auth", detail: "rejected" });
      return true;
    });
  });

  test("D-1-03: a fetchCommit rung in a clone whose origin is another host throws its refused credential's failure unchanged", async () => {
    // arrange
    const failing = failingAuthGitProcess("rejected", OTHER_REMOTE_URL);

    // act
    const fetching = fetchCommit(
      { dir: "/clone", sha: OID_MAIN, auth: boundAuth() },
      failing.gitProcess,
    );

    // assert
    await assert.rejects(fetching, (error: unknown) => error === failing.failures[0]);
    assert.strictEqual(fetchRequests(failing.requests).length, 1);
  });

  for (const url of [`http://${HOST}/owner/repo.git`, "/srv/git/repo.git"]) {
    test(`D-1-03: a request to ${url} is no https request to the bundle's host, so its refused credential's failure is thrown unchanged`, async () => {
      // arrange
      const failing = failingAuthGitProcess("rejected");

      // act
      const resolution = resolveRemoteRef({ url, auth: boundAuth() }, failing.gitProcess);

      // assert
      await assert.rejects(resolution, (error: unknown) => error === failing.failures[0]);
      assert.strictEqual(failing.requests.length, 1);
    });
  }
});

describe("listRemotes", () => {
  test("reports the origin remote url of a real repository", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "origin", url: REMOTE_URL });
  });

  // The not-a-repo and no-origin arms are distinguished by the wrapper's own
  // `.git/config` read, not by anything isomorphic-git reports -- kept
  // adjacent so a future reader sees both cases the probe read exists for.
  test("reports not-a-repo for a directory with no .git", async (t) => {
    // arrange
    const directory = await createGitTestDirectory(t, { boundary: "local" });

    // act
    const remotes = await listRemotes({ dir: directory });

    // assert
    assert.deepStrictEqual(remotes, { kind: "not-a-repo" });
  });

  test("reports no-origin for a real repository with no remote configured", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "no-origin" });
  });

  test("SG-TRN-01: reports unreadable for a .git/config that git cannot parse", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await writeFile(path.join(repository.dir, ".git", "config"), "[core\n");

    // act
    const remotes = await listRemotes({ dir: repository.dir }, systemGit);

    // assert
    assert.deepStrictEqual(remotes, { kind: "unreadable" });
  });

  test("reports unreadable for a .git/config that cannot be read as a file", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const configPath = path.join(repository.dir, ".git", "config");
    await rm(configPath);
    await mkdir(configPath);

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "unreadable" });
  });

  for (const code of ["EACCES", "EPERM"]) {
    test(`reports permission-denied when reading .git/config fails with ${code}`, async (t) => {
      // arrange
      const repository = await createGitTestRepository(t, { boundary: "local" });
      t.mock.method(fs.promises, "readFile", () =>
        Promise.reject(Object.assign(new Error(`${code}: operation not permitted`), { code })),
      );

      // act
      const remotes = await listRemotes({ dir: repository.dir });

      // assert
      assert.deepStrictEqual(remotes, { kind: "permission-denied" });
    });
  }

  // D-3-03 / MA-13: the origin shapes an interrupted rewrite or a hand edit
  // leaves behind. `fileUrls` is every `remote.origin.url` value in file
  // order, which is the read `listRemotes` makes; git fetches from the first
  // (WR-11, T-3-05).
  interface OriginSectionShape {
    readonly title: string;
    readonly config: string;
    readonly fileUrls: readonly string[];
    readonly wrapperResult: GitPlatform.ListRemotesResult;
  }

  /** Every `remote.origin.url` value of the clone `dir`, in file order, as `git config --list` reads them. */
  async function originUrlsInFile(dir: string): Promise<string[]> {
    const key = "remote.origin.url\n";
    const listed = await gitTestCheckout(dir).run("config", "--local", "--null", "--list");
    return listed
      .split("\0")
      .filter((entry) => entry.startsWith(key))
      .map((entry) => entry.slice(key.length));
  }

  const ORIGIN_SECTION_SHAPES: readonly OriginSectionShape[] = [
    {
      title: "reports no-origin for an origin section with a fetch line but no url",
      config:
        '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
      fileUrls: [],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for an origin section with no keys",
      config: '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n',
      fileUrls: [],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports the empty url of an origin section whose url value is empty",
      config: '[remote "origin"]\n\turl =\n',
      fileUrls: [""],
      wrapperResult: { kind: "origin", url: "" },
    },
    {
      title: "reports no-origin for an origin section whose first of two urls is foreign",
      config: `[remote "origin"]\n\turl = ${OTHER_REMOTE_URL}\n\turl = ${REMOTE_URL}\n`,
      fileUrls: [OTHER_REMOTE_URL, REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for an origin section whose second of two urls is foreign",
      config: `[remote "origin"]\n\turl = ${REMOTE_URL}\n\turl = ${OTHER_REMOTE_URL}\n`,
      fileUrls: [REMOTE_URL, OTHER_REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for two origin sections that each record a url",
      config: `[remote "origin"]\n\turl = ${OTHER_REMOTE_URL}\n[remote "origin"]\n\turl = ${REMOTE_URL}\n`,
      fileUrls: [OTHER_REMOTE_URL, REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports the origin url of an origin section whose section name is capitalized",
      config: `[Remote "origin"]\n\turl = ${REMOTE_URL}\n`,
      fileUrls: [REMOTE_URL],
      wrapperResult: { kind: "origin", url: REMOTE_URL },
    },
  ];

  for (const { title, config, fileUrls, wrapperResult } of ORIGIN_SECTION_SHAPES) {
    test(title, async (t) => {
      // arrange
      const repository = await createGitTestRepository(t, { boundary: "local" });
      await writeFile(path.join(repository.dir, ".git", "config"), config);

      // act
      const remotes = await listRemotes({ dir: repository.dir });

      // assert
      // Proves the fixture reproduces the shape, so a mis-authored config
      // cannot pass through the empty-remote-list path.
      assert.deepStrictEqual(await originUrlsInFile(repository.dir), fileUrls);
      assert.deepStrictEqual(remotes, wrapperResult);
    });
  }
});

/**
 * RESV-03, SG-TRN-01, D-SG-09: a repository with the lightweight tag `light`
 * on the initial commit, and the annotated tag `v2` and the tag of a tag
 * `tot` on the second commit.
 */
async function taggedHistory(t: TestContext): Promise<{
  readonly repository: Awaited<ReturnType<typeof createGitTestRepository>>;
  readonly secondOid: string;
}> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await repository.run("tag", "light");
  const secondOid = await repository.commit([{ filepath: "two.txt", contents: "two\n" }], "two");
  await repository.run("tag", "-a", "-m", "v2", "v2");
  await repository.run("tag", "-a", "-m", "tot", "tot", "v2");
  return { repository, secondOid };
}

/** The tagged history, served at a `file://` URL. */
async function taggedRemote(t: TestContext): Promise<{
  readonly url: string;
  readonly initialOid: string;
  readonly secondOid: string;
}> {
  const { repository, secondOid } = await taggedHistory(t);
  return { url: `file://${repository.dir}`, initialOid: repository.initialOid, secondOid };
}

/** A git process whose remote runs print `stdout` and succeed. */
function printingGitProcess(stdout: string): GitProcess {
  return {
    locate: () => Promise.resolve("/usr/bin/git"),
    run: () => Promise.resolve({ exitCode: 0, stdout, stderr: "" }),
  };
}

describe("listRemoteTags", () => {
  test("RESV-03, SG-TRN-01: lists each tag once with the commit it names, a peeled line winning", async (t) => {
    // arrange
    const remote = await taggedRemote(t);
    const systemGit = await hermeticGitProcess(t);

    // act
    const tags = await listRemoteTags({ url: remote.url }, systemGit);

    // assert
    assert.deepStrictEqual(tags, [
      { name: "light", oid: remote.initialOid },
      { name: "tot", oid: remote.secondOid },
      { name: "v2", oid: remote.secondOid },
    ]);
  });

  test("RESV-03: a remote with no tags answers an empty list", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const systemGit = await hermeticGitProcess(t);

    // act
    const tags = await listRemoteTags({ url: `file://${repository.dir}` }, systemGit);

    // assert
    assert.deepStrictEqual(tags, []);
  });

  test("SG-TRN-01: pairs a peeled line with its tag whatever order git prints them in", async () => {
    // arrange
    const stdout = [
      `${OID_PEELED}\trefs/tags/v1^{}`,
      `${OID_TAG}\trefs/tags/v1`,
      `${OID_LIGHTWEIGHT}\trefs/tags/light`,
      "",
    ].join("\n");

    // act
    const tags = await listRemoteTags({ url: REMOTE_URL }, printingGitProcess(stdout));

    // assert
    assert.deepStrictEqual(tags, [
      { name: "v1", oid: OID_PEELED },
      { name: "light", oid: OID_LIGHTWEIGHT },
    ]);
  });

  test("D-SG-13 / D-PL8-24: sends one ls-remote --tags with the limit and the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const remote = await taggedRemote(t);
    const recorded = recordingGitProcess(await hermeticGitProcess(t));
    const signal = new AbortController().signal;

    // act
    await runWithGitAbortSignal(signal, () =>
      listRemoteTags({ url: remote.url }, recorded.gitProcess),
    );

    // assert
    assert.deepStrictEqual(recorded.requests, [
      {
        subcommand: "ls-remote",
        lane: "network",
        options: ["--tags"],
        operands: [remote.url],
        config: [],
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16, GHB-01: lists the tags of a github.com URL at the base through its insteadOf pair", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);
    await gitTestCheckout(standIn.host.repositoryPath("tools")).run("tag", "v1.0.0");
    const recorded = recordingGitProcess(standIn.gitProcess);

    // act
    const tags = await listRemoteTags({ url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(tags, [{ name: "v1.0.0", oid: standIn.oid }]);
    assert.deepStrictEqual(
      recorded.requests.map((request) => request.config),
      [[`url.https://${standIn.host.address}/.insteadOf=https://github.com/`]],
    );
  });

  test("GHB-01: a failed listing at the base names the URL git fetched", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);

    // act
    const listing = listRemoteTags(
      { url: "https://github.com/acme/missing.git" },
      standIn.gitProcess,
    );

    // assert
    await assert.rejects(listing, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.ok(error.cause instanceof FetchedUrlCause);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation, url: error.cause.url },
        {
          kind: "repository-not-found",
          operation: "ls-remote --tags",
          url: standIn.host.repositoryUrl("missing"),
        },
      );
      return true;
    });
  });

  test("RESV-03, GAUTH-04: the supplied bundle maps an auth failure of the listing", async () => {
    // arrange
    const failing = failingAuthGitProcess("rejected");

    // act
    const listing = listRemoteTags({ url: REMOTE_URL, auth: boundAuth() }, failing.gitProcess);

    // assert
    await assert.rejects(listing, (error: unknown) => {
      assert.ok(error instanceof StoredCredentialRejectedError);
      assert.strictEqual(error.cause, failing.failures[0]);
      return true;
    });
  });
});

/**
 * D-SG-09: the tagged history with a lightweight and an annotated tag of the
 * second commit's tree, and a lightweight tag of a blob.
 */
async function taggedRepository(t: TestContext): Promise<{
  readonly dir: string;
  readonly initialOid: string;
  readonly secondOid: string;
}> {
  const { repository, secondOid } = await taggedHistory(t);
  const tree = await repository.run("rev-parse", `${secondOid}^{tree}`);
  await repository.run("tag", "tree-light", tree);
  await repository.run("tag", "-a", "-m", "tree", "tree-annotated", tree);
  await repository.run("update-ref", "refs/tags/blob-light", await repository.hashObject("blob"));
  return { dir: repository.dir, initialOid: repository.initialOid, secondOid };
}

describe("listLocalTags", () => {
  test("D-SG-09, WR-06: lists each commit-backed tag with the commit it names and drops a tree or blob tag", async (t) => {
    // arrange
    const repository = await taggedRepository(t);
    const systemGit = await hermeticGitProcess(t);

    // act
    const tags = await listLocalTags({ dir: repository.dir }, systemGit);

    // assert
    assert.deepStrictEqual(tags, [
      { name: "light", oid: repository.initialOid },
      { name: "tot", oid: repository.secondOid },
      { name: "v2", oid: repository.secondOid },
    ]);
  });

  test("D-SG-09: a repository with no tags answers an empty list", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const systemGit = await hermeticGitProcess(t);

    // act
    const tags = await listLocalTags({ dir: repository.dir }, systemGit);

    // assert
    assert.deepStrictEqual(tags, []);
  });

  test("D-SG-09, D-SG-13: lists with one local for-each-ref and peels only a tag of a tag again", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const repository = await taggedRepository(t);
    const recorded = recordingGitProcess(await hermeticGitProcess(t));

    // act
    await listLocalTags({ dir: repository.dir }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      recorded.requests.map(({ subcommand, lane, cwd, options, operands, timeoutMs }) => ({
        subcommand,
        lane,
        cwd,
        options,
        operands,
        timeoutMs,
      })),
      [
        {
          subcommand: "for-each-ref",
          lane: "local",
          cwd: repository.dir,
          options: [
            "--format=%(refname:strip=2) %(objecttype) %(objectname) %(*objecttype) %(*objectname)",
          ],
          operands: ["refs/tags"],
          timeoutMs: 4321,
        },
        {
          subcommand: "rev-parse",
          lane: "local",
          cwd: repository.dir,
          options: ["--verify", "--quiet"],
          operands: ["refs/tags/tot^{commit}"],
          timeoutMs: 4321,
        },
      ],
    );
  });
});

// A git process whose ssh launches answer `answer`, recording each launch.
function sshAnsweringGitProcess(answer: () => Promise<SshRun>): {
  readonly gitProcess: SystemGitProcess;
  readonly launches: string[];
} {
  const launches: string[] = [];
  return {
    launches,
    gitProcess: {
      locate: () => Promise.reject(new Error("the probe locates no git")),
      run: () => Promise.reject(new Error("the probe runs no git")),
      ssh: (launch) => {
        launches.push(launch);
        return answer();
      },
    },
  };
}

describe("probeGitHubSsh", () => {
  for (const { label, run, verdict, logLine } of [
    {
      label: "GitHub's greeting with exit 1",
      run: {
        kind: "ran",
        exitCode: 1,
        output:
          "\nHi acme! You've successfully authenticated, but GitHub does not provide shell access.\n",
        timedOut: false,
      },
      verdict: "configured",
      logLine: "[git] SSH config check: code=1 configured=true",
    },
    {
      label: "a publickey refusal with exit 255",
      run: {
        kind: "ran",
        exitCode: 255,
        output: "\ngit@github.com: Permission denied (publickey).\n",
        timedOut: false,
      },
      verdict: "not-configured",
      logLine: "[git] SSH config check: code=255 configured=false",
    },
    {
      label: "an unknown host key with exit 255",
      run: {
        kind: "ran",
        exitCode: 255,
        output: "\nHost key verification failed.\n",
        timedOut: false,
      },
      verdict: "not-configured",
      logLine: "[git] SSH config check: code=255 configured=false",
    },
    {
      label: "a probe stopped at its limit",
      run: { kind: "ran", exitCode: null, output: "\n", timedOut: true },
      verdict: "unknown",
      logLine: "[git] SSH config check: code=null configured=false",
    },
    {
      label: "a publickey refusal from a probe stopped at its limit",
      run: {
        kind: "ran",
        exitCode: 255,
        output: "\ngit@github.com: Permission denied (publickey).\n",
        timedOut: true,
      },
      verdict: "unknown",
      logLine: "[git] SSH config check: code=255 configured=false",
    },
    {
      label: "exit 1 without GitHub's greeting",
      run: {
        kind: "ran",
        exitCode: 1,
        output: "\nConnection closed by remote host\n",
        timedOut: false,
      },
      verdict: "unknown",
      logLine: "[git] SSH config check: code=1 configured=false",
    },
    {
      label: "an unresolved host with exit 255",
      run: {
        kind: "ran",
        exitCode: 255,
        output: "\nssh: Could not resolve hostname github.com: Name or service not known\n",
        timedOut: false,
      },
      verdict: "unknown",
      logLine: "[git] SSH config check: code=255 configured=false",
    },
  ] satisfies ReadonlyArray<{
    label: string;
    run: SshRun;
    verdict: SshProbeResult;
    logLine: string;
  }>) {
    test(`SG-SSH-02: reads ${label} as ${verdict} and logs the exit code`, async (t) => {
      // arrange
      const logged = captureDebugLog(t);
      const { gitProcess, launches } = sshAnsweringGitProcess(() => Promise.resolve(run));

      // act
      const probed = await probeGitHubSsh(gitProcess);

      // assert
      assert.strictEqual(probed, verdict);
      assert.deepStrictEqual(launches, ["github-probe"]);
      assert.deepStrictEqual(logged, [logLine]);
    });
  }

  test("SG-SSH-02: reads a missing ssh as not-configured with no run to log", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { gitProcess } = sshAnsweringGitProcess(() => Promise.resolve({ kind: "missing" }));

    // act
    const probed = await probeGitHubSsh(gitProcess);

    // assert
    assert.strictEqual(probed, "not-configured");
    assert.deepStrictEqual(logged, []);
  });

  test("SG-SSH-02, T-04-14: reads a launch that throws as unknown and logs its message without the path", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { gitProcess } = sshAnsweringGitProcess(() =>
      Promise.reject(new Error("spawn /home/user/bin/ssh EACCES")),
    );

    // act
    const probed = await probeGitHubSsh(gitProcess);

    // assert
    assert.strictEqual(probed, "unknown");
    assert.deepStrictEqual(logged, ["[git] SSH configuration check failed: spawn ssh EACCES"]);
  });

  test("T-04-15: probes the refusing ssh that the test run puts first on this process's PATH", async () => {
    // act
    const probed = await probeGitHubSsh();

    // assert
    assert.strictEqual(probed, "not-configured");
  });
});

// A git process whose every run rejects with `failure`.
function failingGitProcess(failure: Error): GitProcess {
  return {
    locate: () => Promise.reject(failure),
    run: () => Promise.reject(failure),
  };
}

// The git config pairs one `GIT_CONFIG_COUNT` block gives a hermetic git.
function configVariables(pairs: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const entries = Object.entries(pairs);
  const variables: NodeJS.ProcessEnv = { GIT_CONFIG_COUNT: String(entries.length) };
  for (const [index, [key, value]] of entries.entries()) {
    variables[`GIT_CONFIG_KEY_${index}`] = key;
    variables[`GIT_CONFIG_VALUE_${index}`] = value;
  }

  return variables;
}

describe("userSshOverride", () => {
  for (const { label, env, platform } of [
    { label: "GIT_SSH_COMMAND set", env: { GIT_SSH_COMMAND: "ssh -i key" }, platform: "linux" },
    {
      label: "GIT_SSH_COMMAND set to the empty string",
      env: { GIT_SSH_COMMAND: "" },
      platform: "linux",
    },
    { label: "GIT_SSH set", env: { GIT_SSH: "/usr/bin/ssh" }, platform: "linux" },
    { label: "GIT_SSH set to the empty string", env: { GIT_SSH: "" }, platform: "linux" },
    {
      label: "a lower-case git_ssh_command on win32",
      env: { git_ssh_command: "" },
      platform: "win32",
    },
  ] satisfies ReadonlyArray<{ label: string; env: NodeJS.ProcessEnv; platform: NodeJS.Platform }>) {
    test(`D-SG-18, Pitfall 4: reads ${label} as the user's choice without a config read`, async () => {
      // arrange
      const gitProcess = failingGitProcess(new Error("the variable answers first"));

      // act
      const chosen = await userSshOverride({ env, platform }, gitProcess);

      // assert
      assert.strictEqual(chosen, true);
    });
  }

  test("D-SG-18: reads a lower-case git_ssh_command off Windows as no choice", async (t) => {
    // arrange
    const gitProcess = await hermeticGitProcess(t);

    // act
    const chosen = await userSshOverride(
      { env: { git_ssh_command: "ssh" }, platform: "linux" },
      gitProcess,
    );

    // assert
    assert.strictEqual(chosen, false);
  });

  test("D-SG-18: reads core.sshCommand in the user's git config as the user's choice", async (t) => {
    // arrange
    const gitProcess = await hermeticGitProcess(
      t,
      configVariables({ "core.sshCommand": "ssh -i key" }),
    );

    // act
    const chosen = await userSshOverride({ env: {}, platform: "linux" }, gitProcess);

    // assert
    assert.strictEqual(chosen, true);
  });

  test("D-SG-18: reads no variable and no core.sshCommand as no choice", async (t) => {
    // arrange
    const gitProcess = await hermeticGitProcess(t, configVariables({ "ssh.variant": "ssh" }));

    // act
    const chosen = await userSshOverride({ env: {} }, gitProcess);

    // assert
    assert.strictEqual(chosen, false);
  });

  test("D-SG-18: reads a config read that fails as no choice and logs it without the path", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const gitProcess = failingGitProcess(new Error("cannot read /home/user/.gitconfig"));

    // act
    const chosen = await userSshOverride({ env: {}, platform: "linux" }, gitProcess);

    // assert
    assert.strictEqual(chosen, false);
    assert.deepStrictEqual(logged, [
      "[git] could not read the user's git ssh settings: cannot read .gitconfig",
    ]);
  });
});

describe("sshUrlRewritten", () => {
  const SSH_URL = "git@github.com:acme/ghp.git";

  test("D-SG-18: reads a url git prints unchanged as not rewritten, with no Pi request pair", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/base");
    const { gitProcess, requests } = recordingGitProcess(await hermeticGitProcess(t));

    // act
    const checked = await sshUrlRewritten(SSH_URL, gitProcess);

    // assert
    assert.deepStrictEqual(checked, { rewritten: false, exitCode: 0 });
    assert.deepStrictEqual(requests, [
      {
        subcommand: "ls-remote",
        lane: "local",
        options: ["--get-url"],
        operands: [SSH_URL],
        timeoutMs: 5_000,
      },
    ]);
  });

  test("D-SG-18: reads a url the user's insteadOf rewrites as rewritten", async (t) => {
    // arrange
    const gitProcess = await hermeticGitProcess(
      t,
      configVariables({ "url.https://github.com/.insteadOf": "git@github.com:" }),
    );

    // act
    const checked = await sshUrlRewritten(SSH_URL, gitProcess);

    // assert
    assert.deepStrictEqual(checked, { rewritten: true, exitCode: 0 });
  });

  test("D-SG-18: reads a failed read as rewritten, with git's exit code", async () => {
    // arrange
    const failure = new GitCommandError(
      { kind: "failed" },
      { operation: "ls-remote --get-url", exitCode: 128 },
    );

    // act
    const checked = await sshUrlRewritten(SSH_URL, failingGitProcess(failure));

    // assert
    assert.deepStrictEqual(checked, { rewritten: true, exitCode: 128 });
  });

  test("D-SG-18: reads a read that gives no exit code as rewritten", async () => {
    // act
    const checked = await sshUrlRewritten(SSH_URL, failingGitProcess(new Error("no git")));

    // assert
    assert.deepStrictEqual(checked, { rewritten: true, exitCode: null });
  });
});

describe("sshShowsDirectGitHub", () => {
  const DIRECT = "host github.com\nuser git\nhostname github.com\nport 22\n";

  for (const { label, run, direct } of [
    { label: "a direct hop", run: { exitCode: 0, output: `${DIRECT}\n` }, direct: true },
    {
      label: "a hostname line in another case with spaces around it",
      run: { exitCode: 0, output: "  HostName GitHub.com  \n" },
      direct: true,
    },
    {
      label: "a proxycommand line",
      run: { exitCode: 0, output: `${DIRECT}proxycommand nc %h %p\n` },
      direct: false,
    },
    {
      label: "a proxyjump line",
      run: { exitCode: 0, output: `${DIRECT}ProxyJump bastion\n` },
      direct: false,
    },
    {
      label: "proxycommand none",
      run: { exitCode: 0, output: `${DIRECT}proxycommand none\n` },
      direct: true,
    },
    {
      label: "proxyjump none",
      run: { exitCode: 0, output: `${DIRECT}proxyjump none\n` },
      direct: true,
    },
    {
      label: "another hostname",
      run: { exitCode: 0, output: "hostname ssh.github.com\n" },
      direct: false,
    },
    { label: "a failed ssh -G", run: { exitCode: 255, output: DIRECT }, direct: false },
  ] satisfies ReadonlyArray<{
    label: string;
    run: { exitCode: number; output: string };
    direct: boolean;
  }>) {
    test(`D-SG-18: reads ${label} as ${direct ? "direct" : "not direct"}`, async () => {
      // arrange
      const { gitProcess, launches } = sshAnsweringGitProcess(() =>
        Promise.resolve({ kind: "ran", ...run, timedOut: false }),
      );

      // act
      const checked = await sshShowsDirectGitHub(gitProcess);

      // assert
      assert.deepStrictEqual(checked, { kind: "ran", direct, exitCode: run.exitCode });
      assert.deepStrictEqual(launches, ["github-config"]);
    });
  }

  test("D-SG-18: reads a missing ssh as missing", async () => {
    // arrange
    const { gitProcess } = sshAnsweringGitProcess(() => Promise.resolve({ kind: "missing" }));

    // act
    const checked = await sshShowsDirectGitHub(gitProcess);

    // assert
    assert.deepStrictEqual(checked, { kind: "missing" });
  });

  test("D-SG-18: reads a launch that throws as not direct with no exit code", async () => {
    // arrange
    const { gitProcess } = sshAnsweringGitProcess(() =>
      Promise.reject(new Error("spawn ssh EACCES")),
    );

    // act
    const checked = await sshShowsDirectGitHub(gitProcess);

    // assert
    assert.deepStrictEqual(checked, { kind: "ran", direct: false, exitCode: null });
  });
});

/** A git process that answers each run with `answer` and keeps each request. */
function answeringGitProcess(answer: () => Promise<GitResult>): {
  readonly gitProcess: GitProcess;
  readonly requests: GitRequest[];
} {
  const requests: GitRequest[] = [];
  return {
    requests,
    gitProcess: {
      locate: () => Promise.reject(new Error("the check locates no git")),
      run: (request) => {
        requests.push(request);
        return answer();
      },
    },
  };
}

describe("sshShowsDirectGitHubThroughGit", () => {
  const SSH_URL = "git@github.com:acme/ghp.git";
  const DIRECT = "host github.com\nuser git\nhostname github.com\nport 22\n";
  const NOT_READ = "fatal: Could not read from remote repository.\n";

  test("SG-SSH-05: asks git for a network-lane ls-remote with the -G tail and reads a direct hop", async () => {
    // arrange
    const { gitProcess, requests } = answeringGitProcess(() =>
      Promise.resolve({ exitCode: 0, stdout: "", stderr: DIRECT }),
    );

    // act
    const direct = await sshShowsDirectGitHubThroughGit(SSH_URL, gitProcess);

    // assert
    assert.strictEqual(direct, true);
    assert.deepStrictEqual(requests, [
      {
        subcommand: "ls-remote",
        lane: "network",
        operands: [SSH_URL],
        sshTail: "print-config",
        timeoutMs: 5_000,
      },
    ]);
  });

  test("SG-SSH-05: carries the abort scope's signal", async () => {
    // arrange
    const controller = new AbortController();
    const { gitProcess, requests } = answeringGitProcess(() =>
      Promise.resolve({ exitCode: 0, stdout: "", stderr: DIRECT }),
    );

    // act
    await runWithGitAbortSignal(controller.signal, () =>
      sshShowsDirectGitHubThroughGit(SSH_URL, gitProcess),
    );

    // assert
    assert.deepStrictEqual(
      requests.map((request) => request.signal),
      [controller.signal],
    );
  });

  for (const { label, stderr, direct } of [
    { label: "a direct hop", stderr: `${DIRECT}${NOT_READ}`, direct: true },
    { label: "a proxyjump line", stderr: `${DIRECT}proxyjump bastion\n${NOT_READ}`, direct: false },
    {
      label: "a proxycommand line",
      stderr: `${DIRECT}ProxyCommand nc %h %p\n${NOT_READ}`,
      direct: false,
    },
    { label: "no hostname line", stderr: NOT_READ, direct: false },
  ]) {
    test(`SG-SSH-05: reads ${label} in the stderr of git's failed run as ${direct ? "direct" : "not direct"}`, async () => {
      // arrange
      const failure = new GitCommandError(
        { kind: "ssh-auth", detail: "unconfirmed" },
        { operation: "ls-remote", exitCode: 128, stderr },
      );
      const { gitProcess } = answeringGitProcess(() => Promise.reject(failure));

      // act
      const checked = await sshShowsDirectGitHubThroughGit(SSH_URL, gitProcess);

      // assert
      assert.strictEqual(checked, direct);
    });
  }

  test("SG-SSH-05: reads a run that timed out as not direct, whatever it printed", async () => {
    // arrange
    const failure = new GitCommandError(
      { kind: "timeout", timeoutMs: 5_000 },
      { operation: "ls-remote", stderr: DIRECT },
    );
    const { gitProcess } = answeringGitProcess(() => Promise.reject(failure));

    // act
    const direct = await sshShowsDirectGitHubThroughGit(SSH_URL, gitProcess);

    // assert
    assert.strictEqual(direct, false);
  });

  test("SG-SSH-05: reads a failure that is not git's as not direct", async () => {
    // arrange
    const { gitProcess } = answeringGitProcess(() => Promise.reject(new Error(DIRECT)));

    // act
    const direct = await sshShowsDirectGitHubThroughGit(SSH_URL, gitProcess);

    // assert
    assert.strictEqual(direct, false);
  });
});

describe("GitOps contract", () => {
  registerGitOpsContract(createProductionGitOps);
});

void ({ name: "v1.0.0", oid: OID_MAIN } satisfies RemoteTag);
