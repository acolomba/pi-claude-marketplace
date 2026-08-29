import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

export interface GitOpsContractParticipant {
  readonly gitOps: GitOps;
  readonly worktreeDir: string;
  readonly cloneDir: string;
  readonly remoteUrl: string;
  readonly initialOid: string;
  readonly updatedOid: string;
  readFile(dir: string, filepath: string): Promise<string | null>;
}

export type GitOpsFactory = (
  t: TestContext,
) => GitOpsContractParticipant | Promise<GitOpsContractParticipant>;

interface GitOpsContractCase {
  readonly name: string;
  readonly run: (createGitOps: GitOpsFactory, t: TestContext) => Promise<void>;
}

export const GIT_OPS_CASE_NAMES = [
  "clones the requested branch into the requested directory",
  "fetches updated remote state without moving the worktree",
  "force-updates a ref to the requested commit",
  "checks out the requested branch and worktree",
  "resolves a local ref to its commit",
  "rejects a missing local ref",
  "returns the attached current branch",
  "returns undefined for a detached HEAD",
  "resolves the remote HEAD commit",
  "resolves a named remote branch",
  "resolves a remote annotated tag to its peeled commit",
  "rejects a missing remote ref",
] as const;

// Mutable aliasing is inapplicable because GitOps returns only void or immutable string primitives.
// Global ordering is caller-owned; the port exposes per-operation effects rather than a workflow API.
// Deletion is inapplicable because GitOps has no delete operation.
// Raw HTTP, auth, filesystem cleanup, and option forwarding are production-owner mechanics.

function observeVoid(promise: Promise<void>): Promise<unknown> {
  return promise;
}

export const gitOpsContractCases = [
  {
    name: "clones the requested branch into the requested directory",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const cloning = await observeVoid(
        participant.gitOps.clone({
          dir: participant.cloneDir,
          url: participant.remoteUrl,
          ref: "main",
          singleBranch: true,
        }),
      );
      const oid = await participant.gitOps.resolveRef({
        dir: participant.cloneDir,
        ref: "HEAD",
      });
      const contents = await participant.readFile(participant.cloneDir, "README.md");

      // assert
      assert.strictEqual(cloning, undefined);
      assert.strictEqual(oid, participant.updatedOid);
      assert.strictEqual(contents, "# updated\n");
    },
  },
  {
    name: "fetches updated remote state without moving the worktree",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const firstFetch = await observeVoid(
        participant.gitOps.fetch({
          dir: participant.worktreeDir,
          remote: "origin",
          ref: "main",
        }),
      );
      const secondFetch = await observeVoid(
        participant.gitOps.fetch({
          dir: participant.worktreeDir,
          remote: "origin",
          ref: "main",
        }),
      );
      const remoteOid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "refs/remotes/origin/main",
      });
      const headOid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "HEAD",
      });
      const contents = await participant.readFile(participant.worktreeDir, "README.md");

      // assert
      assert.strictEqual(firstFetch, undefined);
      assert.strictEqual(secondFetch, undefined);
      assert.strictEqual(remoteOid, participant.updatedOid);
      assert.strictEqual(headOid, participant.initialOid);
      assert.strictEqual(contents, "# local\n");
    },
  },
  {
    name: "force-updates a ref to the requested commit",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);
      const options = {
        dir: participant.worktreeDir,
        ref: "refs/heads/main",
        value: participant.updatedOid,
      } as const;

      // act
      const firstUpdate = await observeVoid(participant.gitOps.forceUpdateRef(options));
      const secondUpdate = await observeVoid(participant.gitOps.forceUpdateRef(options));
      const oid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "refs/heads/main",
      });

      // assert
      assert.strictEqual(firstUpdate, undefined);
      assert.strictEqual(secondUpdate, undefined);
      assert.strictEqual(oid, participant.updatedOid);
    },
  },
  {
    name: "checks out the requested branch and worktree",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const checkout = await observeVoid(
        participant.gitOps.checkout({ dir: participant.worktreeDir, ref: "feature" }),
      );
      const branch = await participant.gitOps.currentBranch({ dir: participant.worktreeDir });
      const oid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "HEAD",
      });
      const contents = await participant.readFile(participant.worktreeDir, "README.md");

      // assert
      assert.strictEqual(checkout, undefined);
      assert.strictEqual(branch, "feature");
      assert.strictEqual(oid, participant.updatedOid);
      assert.strictEqual(contents, "# updated\n");
    },
  },
  {
    name: "resolves a local ref to its commit",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "refs/heads/feature",
      });

      // assert
      assert.strictEqual(oid, participant.updatedOid);
    },
  },
  {
    name: "rejects a missing local ref",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const resolution = participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "refs/heads/missing",
      });

      // assert
      await assert.rejects(resolution, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.name, "NotFoundError");
        assert.strictEqual((error as Error & { code?: string }).code, "NotFoundError");
        return true;
      });
    },
  },
  {
    name: "returns the attached current branch",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const branch = await participant.gitOps.currentBranch({ dir: participant.worktreeDir });

      // assert
      assert.strictEqual(branch, "main");
    },
  },
  {
    name: "returns undefined for a detached HEAD",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);
      await participant.gitOps.checkout({
        dir: participant.worktreeDir,
        ref: participant.updatedOid,
      });

      // act
      const branch = await participant.gitOps.currentBranch({ dir: participant.worktreeDir });

      // assert
      assert.strictEqual(branch, undefined);
    },
  },
  {
    name: "resolves the remote HEAD commit",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRemoteRef({ url: participant.remoteUrl });

      // assert
      assert.strictEqual(oid, participant.updatedOid);
    },
  },
  {
    name: "resolves a named remote branch",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRemoteRef({
        url: participant.remoteUrl,
        ref: "main",
      });

      // assert
      assert.strictEqual(oid, participant.updatedOid);
    },
  },
  {
    name: "resolves a remote annotated tag to its peeled commit",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRemoteRef({
        url: participant.remoteUrl,
        ref: "v1.0.0",
      });

      // assert
      assert.strictEqual(oid, participant.updatedOid);
    },
  },
  {
    name: "rejects a missing remote ref",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const resolution = participant.gitOps.resolveRemoteRef({
        url: participant.remoteUrl,
        ref: "missing",
      });

      // assert
      await assert.rejects(resolution, {
        name: "Error",
        message: `remote ${participant.remoteUrl} has no ref "missing"`,
      });
    },
  },
] satisfies readonly GitOpsContractCase[];

export function registerGitOpsContract(createGitOps: GitOpsFactory): void {
  for (const contractCase of gitOpsContractCases) {
    test(contractCase.name, async (t) => {
      // arrange
      const runCase = contractCase.run;

      // act
      const completed = runCase(createGitOps, t);

      // assert
      await completed;
    });
  }
}
