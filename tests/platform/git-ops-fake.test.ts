import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import {
  gitOpsContractCases,
  registerGitOpsContract,
  type GitOpsContractParticipant,
  type GitOpsFactory,
} from "./git-ops-contract.ts";
import { createGitOpsFake } from "./git-ops-fake.ts";

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
  });

  return {
    gitOps: git.gitOps,
    worktreeDir: "/memory/worktree",
    cloneDir: "/memory/clone",
    remoteUrl: REMOTE_URL,
    initialOid: INITIAL_OID,
    updatedOid: UPDATED_OID,
    readFile: (dir, filepath) => git.readFile(dir, filepath),
  };
}

function createNoForceUpdateGitOpsFake(): GitOpsContractParticipant {
  const participant = createFakeParticipant();
  return {
    ...participant,
    gitOps: {
      ...participant.gitOps,
      async forceUpdateRef() {
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

  test("records complete public operation calls", async () => {
    // arrange
    const git = createGitOpsFake({
      boundary: "memory",
      allowedRemoteUrls: [REMOTE_URL],
    });

    // act
    await git.gitOps.fetch({ dir: "/memory/worktree", remote: "upstream", ref: "main" });
    await git.gitOps.resolveRemoteRef({ url: REMOTE_URL, ref: "main" });

    // assert
    assert.deepStrictEqual(git.state.calls, {
      clone: [],
      fetch: [{ dir: "/memory/worktree", remote: "upstream", ref: "main" }],
      forceUpdateRef: [],
      checkout: [],
      resolveRef: [],
      currentBranch: [],
      resolveRemoteRef: [{ url: REMOTE_URL, ref: "main" }],
    });
  });
});

test("the no-force-update fake fails only the force-update invariant", async (t) => {
  // arrange
  const failures: string[] = [];
  const createBrokenGitOps: GitOpsFactory = async (_t: TestContext) => {
    await Promise.resolve();
    return createNoForceUpdateGitOpsFake();
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
  assert.deepStrictEqual(failures, ["force-updates a ref to the requested commit"]);
});
