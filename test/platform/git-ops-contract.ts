import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

export interface GitOpsContractParticipant {
  readonly gitOps: GitOps;
  readonly worktreeDir: string;
  readonly cloneDir: string;
  readonly remoteUrl: string;
  readonly initialOid: string;
  readonly updatedOid: string;
  readFile(dir: string, filepath: string): Promise<string | null>;
  /**
   * Returns a new directory that holds a copy of the worktree's `.git` and no
   * index or work-tree file, as the clone cache's copy step makes one.
   */
  copyGitDir(): Promise<string>;
  /**
   * Returns a clone whose `origin` holds the commit `sha` and which does not
   * hold it yet. The real participant's origin is a `file://` repository.
   */
  unfetchedCommit(): Promise<{ readonly dir: string; readonly sha: string }>;
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
  "clones with no checkout and leaves the work tree empty",
  "fetches updated remote state without moving the worktree",
  "fetches one commit the remote holds",
  "checks out the requested branch and worktree",
  "checks out a commit into a copied git directory",
  "rejects a checkout of a commit the clone does not hold",
  "resolves a local ref to its commit",
  "answers undefined for a missing local ref",
  "resolves the remote HEAD commit",
  "resolves a named remote branch",
  "resolves a remote annotated tag to its peeled commit",
  "answers undefined for an unadvertised remote ref",
  "reports the origin remote url",
] as const;

// Mutable aliasing is inapplicable because GitOps returns only void or immutable string primitives.
// Global ordering is caller-owned; the port exposes per-operation effects rather than a workflow API.
// Deletion is inapplicable because GitOps has no delete operation.
// Raw HTTP, auth, filesystem cleanup, and option forwarding are production-owner mechanics.

/** A commit id that neither participant's repositories hold; the fake names it absent. */
export const MISSING_OID = "0123456789abcdef0123456789abcdef01234567";

function observeVoid(promise: Promise<void>): Promise<unknown> {
  return promise;
}

/** Clones with `options`, then reads the clone's HEAD and its `README.md`. */
async function cloneAndRead(
  participant: GitOpsContractParticipant,
  options: Omit<Parameters<GitOps["clone"]>[0], "dir" | "url">,
): Promise<{ readonly cloning: unknown; readonly oid: unknown; readonly contents: unknown }> {
  const cloning = await observeVoid(
    participant.gitOps.clone({
      dir: participant.cloneDir,
      url: participant.remoteUrl,
      ...options,
    }),
  );
  const oid = await participant.gitOps.resolveRef({ dir: participant.cloneDir, ref: "HEAD" });
  const contents = await participant.readFile(participant.cloneDir, "README.md");
  return { cloning, oid, contents };
}

export const gitOpsContractCases = [
  {
    name: "clones the requested branch into the requested directory",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const cloned = await cloneAndRead(participant, { ref: "main", singleBranch: true });

      // assert
      assert.deepStrictEqual(cloned, {
        cloning: undefined,
        oid: participant.updatedOid,
        contents: "# updated\n",
      });
    },
  },
  {
    name: "clones with no checkout and leaves the work tree empty",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const cloned = await cloneAndRead(participant, { noCheckout: true });

      // assert
      assert.deepStrictEqual(cloned, {
        cloning: undefined,
        oid: participant.updatedOid,
        contents: null,
      });
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
    name: "fetches one commit the remote holds",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);
      const { dir, sha } = await participant.unfetchedCommit();

      // act
      const fetching = await observeVoid(participant.gitOps.fetchCommit({ dir, sha }));
      const oid = await participant.gitOps.resolveRef({ dir, ref: sha });

      // assert
      assert.strictEqual(fetching, undefined);
      assert.strictEqual(oid, sha);
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
      const oid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "HEAD",
      });
      const contents = await participant.readFile(participant.worktreeDir, "README.md");

      // assert
      assert.strictEqual(checkout, undefined);
      assert.strictEqual(oid, participant.updatedOid);
      assert.strictEqual(contents, "# updated\n");
    },
  },
  {
    name: "checks out a commit into a copied git directory",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);
      const copyDir = await participant.copyGitDir();

      // act
      const checkout = await observeVoid(
        participant.gitOps.checkout({
          dir: copyDir,
          ref: participant.updatedOid,
          fromCopiedGitDir: true,
        }),
      );
      const oid = await participant.gitOps.resolveRef({ dir: copyDir, ref: "HEAD" });
      const contents = await participant.readFile(copyDir, "README.md");

      // assert
      assert.strictEqual(checkout, undefined);
      assert.strictEqual(oid, participant.updatedOid);
      assert.strictEqual(contents, "# updated\n");
    },
  },
  {
    name: "rejects a checkout of a commit the clone does not hold",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const checkout = participant.gitOps.checkout({
        dir: participant.worktreeDir,
        ref: MISSING_OID,
      });

      // assert
      await assert.rejects(checkout, (error: unknown) => {
        assert.ok(error instanceof GitCommandError);
        assert.deepStrictEqual(
          { kind: error.kind, operation: error.operation },
          { kind: "commit-missing", operation: "checkout -f" },
        );
        return true;
      });
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
    name: "answers undefined for a missing local ref",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRef({
        dir: participant.worktreeDir,
        ref: "refs/heads/missing",
      });

      // assert
      assert.strictEqual(oid, undefined);
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
    name: "answers undefined for an unadvertised remote ref",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const oid = await participant.gitOps.resolveRemoteRef({
        url: participant.remoteUrl,
        ref: "missing",
      });

      // assert
      assert.strictEqual(oid, undefined);
    },
  },
  {
    // D-3-03: only the origin arm is parity-tested here. The three failure
    // arms are filesystem mechanics of the real implementation, which this
    // contract's header already excludes from parity scope.
    name: "reports the origin remote url",
    run: async (createGitOps, t) => {
      // arrange
      const participant = await createGitOps(t);

      // act
      const remotes = await participant.gitOps.listRemotes({ dir: participant.worktreeDir });

      // assert
      assert.deepStrictEqual(remotes, { kind: "origin", url: participant.remoteUrl });
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
