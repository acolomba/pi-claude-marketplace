// tests/orchestrators/marketplace/shared.test.ts
//
// Focused unit tests for `refreshGitHubClone`'s typed catch around
// `gitOps.resolveRef('refs/remotes/origin/<storedRef>')`. The catch only
// swallows isomorphic-git's `NotFoundError` (which has
// `err.name === "NotFoundError"`) into the detached-HEAD fallback path;
// any other failure (EACCES, corrupted git dir, programming bug in a
// `GitOps` stub) must propagate so the caller surfaces the real cause
// instead of silently falling back to stale local state.

import assert from "node:assert/strict";
import test from "node:test";

import { refreshGitHubClone } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

interface CallLog {
  fetch: number;
  resolveRef: { dir: string; ref: string }[];
  forceUpdateRef: { dir: string; ref: string; value: string }[];
  checkout: { dir: string; ref: string }[];
  currentBranch: number;
  clone: number;
}

function makeStubGitOps(opts: { resolveRefThrows?: Error; resolveRefReturns?: string }): {
  gitOps: GitOps;
  log: CallLog;
} {
  const log: CallLog = {
    fetch: 0,
    resolveRef: [],
    forceUpdateRef: [],
    checkout: [],
    currentBranch: 0,
    clone: 0,
  };

  const gitOps: GitOps = {
    async clone(): Promise<void> {
      log.clone++;
      await Promise.resolve();
    },
    async fetch(): Promise<void> {
      log.fetch++;
      await Promise.resolve();
    },
    async forceUpdateRef(args): Promise<void> {
      log.forceUpdateRef.push({ ...args });
      await Promise.resolve();
    },
    async checkout(args): Promise<void> {
      log.checkout.push({ ...args });
      await Promise.resolve();
    },
    async resolveRef(args): Promise<string> {
      log.resolveRef.push({ ...args });
      await Promise.resolve();
      if (opts.resolveRefThrows !== undefined) {
        throw opts.resolveRefThrows;
      }

      return opts.resolveRefReturns ?? "0000000000000000000000000000000000000001";
    },
    async currentBranch(): Promise<string | undefined> {
      log.currentBranch++;
      await Promise.resolve();
      return undefined;
    },
  };

  return { gitOps, log };
}

test("refreshGitHubClone: NotFoundError on resolveRef falls back to detached checkout", async () => {
  // isomorphic-git's NotFoundError has both `name` and `code` set to the
  // string "NotFoundError" (see node_modules/isomorphic-git/index.cjs).
  const nfe = new Error("Could not find ref refs/remotes/origin/v1.0.0.");
  nfe.name = "NotFoundError";

  const { gitOps, log } = makeStubGitOps({ resolveRefThrows: nfe });

  await refreshGitHubClone("/tmp/clone-dir", "v1.0.0", gitOps);

  // resolveRef threw NotFoundError -> remoteSha undefined -> detached-HEAD
  // checkout against the storedRef directly. forceUpdateRef must NOT be
  // called in this path.
  assert.equal(log.fetch, 1);
  assert.equal(log.resolveRef.length, 1);
  assert.equal(log.resolveRef[0]?.ref, "refs/remotes/origin/v1.0.0");
  assert.equal(log.forceUpdateRef.length, 0);
  assert.equal(log.checkout.length, 1);
  assert.equal(log.checkout[0]?.ref, "v1.0.0");
});

test("refreshGitHubClone: non-NotFoundError on resolveRef propagates", async () => {
  // Any other error (EACCES on .git, corrupted pack, programming bug)
  // must NOT be swallowed: the caller needs the real cause, not a
  // misleading silent fallback to stale local state.
  const eaccess = new Error("EACCES: permission denied, open '/path/.git/refs/.../HEAD'");

  const { gitOps, log } = makeStubGitOps({ resolveRefThrows: eaccess });

  await assert.rejects(refreshGitHubClone("/tmp/clone-dir", "v1.0.0", gitOps), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal(err.message, eaccess.message);
    return true;
  });

  assert.equal(log.fetch, 1);
  assert.equal(log.resolveRef.length, 1);
  // The fallback paths (checkout / forceUpdateRef) must NOT have run.
  assert.equal(log.forceUpdateRef.length, 0);
  assert.equal(log.checkout.length, 0);
});

test("refreshGitHubClone: resolveRef returns SHA -> forceUpdateRef + checkout", async () => {
  // Sanity check the happy path so the test file proves coverage on
  // both arms of the typed catch.
  const sha = "abcdef0000000000000000000000000000000000";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  await refreshGitHubClone("/tmp/clone-dir", "main", gitOps);

  assert.equal(log.fetch, 1);
  assert.equal(log.resolveRef.length, 1);
  assert.equal(log.forceUpdateRef.length, 1);
  assert.equal(log.forceUpdateRef[0]?.ref, "refs/heads/main");
  assert.equal(log.forceUpdateRef[0]?.value, sha);
  assert.equal(log.checkout.length, 1);
  assert.equal(log.checkout[0]?.ref, "main");
});
