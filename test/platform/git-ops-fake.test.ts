import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import { createCredentialOpsFake } from "./credential-ops-fake.ts";
import {
  GIT_OPS_CASE_NAMES,
  MISSING_OID,
  gitOpsContractCases,
  registerGitOpsContract,
  type GitOpsContractParticipant,
  type GitOpsFactory,
} from "./git-ops-contract.ts";
import { createGitOpsFake, recordedCalls } from "./git-ops-fake.ts";

import type { GitAuthBundle } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

const REMOTE_URL = "https://git.example.invalid/owner/repo.git";
const INITIAL_OID = "1111111111111111111111111111111111111111";
const UPDATED_OID = "2222222222222222222222222222222222222222";

function createFakeParticipant(): GitOpsContractParticipant {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [REMOTE_URL],
    initialOid: INITIAL_OID,
    updatedOid: UPDATED_OID,
    remoteHead: UPDATED_OID,
    worktreeDir: "/memory/worktree",
    listRemotesResult: { kind: "origin", url: REMOTE_URL },
    absentCommits: [MISSING_OID],
  });

  return {
    gitOps: git.gitOps,
    worktreeDir: "/memory/worktree",
    cloneDir: "/memory/clone",
    remoteUrl: REMOTE_URL,
    initialOid: INITIAL_OID,
    updatedOid: UPDATED_OID,
    readFile: (dir, filepath) => git.readFile(dir, filepath),
    copyGitDir: async () => {
      await Promise.resolve();
      return "/memory/copy";
    },
    unfetchedCommit: async () => {
      await Promise.resolve();
      return { dir: "/memory/worktree", sha: UPDATED_OID };
    },
  };
}

function createNoFetchCommitGitOpsFake(): GitOpsContractParticipant {
  const participant = createFakeParticipant();
  return {
    ...participant,
    gitOps: {
      ...participant.gitOps,
      async fetchCommit() {
        await Promise.resolve();
      },
    },
  };
}

describe("createGitOpsFake", () => {
  registerGitOpsContract(async () => {
    await Promise.resolve();
    return createFakeParticipant();
  });

  test("blocks a remote that was not explicitly allowed", async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory" });

    // act
    const resolution = git.gitOps.resolveRemoteRef({
      url: "https://unplanned.example.invalid/repo.git",
    });

    // assert
    await assert.rejects(resolution, {
      name: "Error",
      message:
        "createGitOpsFake blocked unplanned remote https://unplanned.example.invalid/repo.git",
    });
  });

  test("rejects a checkout of a name the clone does not hold as a missing local ref", async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory" });

    // act
    const checkout = git.gitOps.checkout({ dir: "/memory/worktree", ref: "nosuch" });

    // assert
    await assert.rejects(checkout, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { failure: error.failure, operation: error.operation, exitCode: error.exitCode },
        { failure: { kind: "local-ref-missing" }, operation: "checkout -f", exitCode: 128 },
      );
      return true;
    });
  });

  test("SG-TRN-02: rejects a fetch of a commit the remote does not hold as commit-missing", async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory" });

    // act
    const fetching = git.gitOps.fetchCommit({ dir: "/memory/worktree", sha: MISSING_OID });

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { failure: error.failure, operation: error.operation },
        { failure: { kind: "commit-missing" }, operation: "fetch --depth" },
      );
      return true;
    });
  });

  test("records complete public operation calls", async () => {
    // arrange
    const git = createGitOpsFake({
      boundary: "memory",
      allowedRemoteUrls: [REMOTE_URL],
    });

    // act
    await git.gitOps.fetch({ dir: "/memory/worktree", remote: "upstream", ref: "main" });
    await git.gitOps.checkout({ dir: "/memory/copy", ref: "feature", fromCopiedGitDir: true });
    await git.gitOps.resolveRemoteRef({ url: REMOTE_URL, ref: "main" });

    // assert
    assert.deepStrictEqual(git.state.calls, {
      clone: [],
      fetch: [{ dir: "/memory/worktree", remote: "upstream", ref: "main" }],
      fetchCommit: [],
      checkout: [{ dir: "/memory/copy", ref: "feature", fromCopiedGitDir: true }],
      resolveRef: [],
      resolveRemoteRef: [{ url: REMOTE_URL, ref: "main" }],
    });
  });

  test("records callable authentication on every remote operation", async () => {
    // arrange
    const authenticationError = new Error("credential provider unavailable");
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired = (): Promise<never> => Promise.reject(authenticationError);
    const auth = {
      credentialOps: credentials.credentialOps,
      host: "git.example.invalid",
      kind: "device-flow",
      onAuthRequired,
    } satisfies GitAuthBundle;
    const git = createGitOpsFake({
      boundary: "memory",
      allowedRemoteUrls: [REMOTE_URL],
    });

    // act
    await git.gitOps.clone({ dir: "/memory/clone", url: REMOTE_URL, ref: "main", auth });
    await git.gitOps.fetch({ dir: "/memory/clone", remote: "origin", ref: "main", auth });
    await git.gitOps.fetchCommit({
      dir: "/memory/clone",
      sha: "0000000000000000000000000000000000000002",
      ref: "main",
      auth,
    });
    const remoteOid = await git.gitOps.resolveRemoteRef({ url: REMOTE_URL, ref: "main", auth });

    // assert
    assert.strictEqual(remoteOid, "0000000000000000000000000000000000000002");
    assert.deepStrictEqual(git.state.calls, {
      clone: [{ dir: "/memory/clone", url: REMOTE_URL, ref: "main", auth }],
      fetch: [{ dir: "/memory/clone", remote: "origin", ref: "main", auth }],
      fetchCommit: [
        {
          dir: "/memory/clone",
          sha: "0000000000000000000000000000000000000002",
          ref: "main",
          auth,
        },
      ],
      checkout: [],
      resolveRef: [],
      resolveRemoteRef: [{ url: REMOTE_URL, ref: "main", auth }],
    });
    assert.strictEqual(git.state.calls.clone[0]?.auth, auth);
    assert.strictEqual(git.state.calls.fetch[0]?.auth, auth);
    assert.strictEqual(git.state.calls.fetchCommit[0]?.auth, auth);
    assert.strictEqual(git.state.calls.resolveRemoteRef[0]?.auth, auth);
    await assert.rejects(git.state.calls.clone[0]?.auth?.onAuthRequired(), (error: unknown) => {
      assert.strictEqual(error, authenticationError);
      return true;
    });
  });
});

describe("recordedCalls", () => {
  test("SG-TRN-01: reports nothing for a fake that recorded no call", () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory" });

    // act
    const recorded = recordedCalls(git.state.calls);

    // assert
    assert.deepStrictEqual(recorded, {});
  });

  test("SG-TRN-01: reports only the member a fake recorded a call for", async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [REMOTE_URL] });
    await git.gitOps.clone({ dir: "/memory/clone", url: REMOTE_URL, ref: "main" });

    // act
    const recorded = recordedCalls(git.state.calls);

    // assert
    assert.deepStrictEqual(recorded, {
      clone: [{ dir: "/memory/clone", url: REMOTE_URL, ref: "main" }],
    });
  });

  test("SG-TRN-01: reports each member a fake recorded a call for", async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [REMOTE_URL] });
    await git.gitOps.clone({ dir: "/memory/clone", url: REMOTE_URL, ref: "main" });
    await git.gitOps.resolveRef({ dir: "/memory/clone", ref: "HEAD" });

    // act
    const recorded = recordedCalls(git.state.calls);

    // assert
    assert.deepStrictEqual(recorded, {
      clone: [{ dir: "/memory/clone", url: REMOTE_URL, ref: "main" }],
      resolveRef: [{ dir: "/memory/clone", ref: "HEAD" }],
    });
  });
});

test("the no-fetch-commit fake fails only the fetch-commit invariant", async (t) => {
  // arrange
  const failures: string[] = [];
  const createBrokenGitOps: GitOpsFactory = async (_t: TestContext) => {
    await Promise.resolve();
    return createNoFetchCommitGitOpsFake();
  };

  // act
  for (const contractCase of gitOpsContractCases) {
    try {
      await contractCase.run(createBrokenGitOps, t);
    } catch (error) {
      if (!(error instanceof assert.AssertionError)) {
        throw error;
      }

      failures.push(contractCase.name);
    }
  }

  // assert
  assert.deepStrictEqual(
    gitOpsContractCases.map((contractCase) => contractCase.name),
    GIT_OPS_CASE_NAMES,
  );
  assert.deepStrictEqual(failures, ["fetches one commit the remote holds"]);
});
