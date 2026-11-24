import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  DEFAULT_RENAME_OPS,
  ownershipMarkerPath,
  refreshCloneBySwap,
  type CloneSwapArgs,
  type RenameOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  CleanupLeakError,
  GitCommandError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { RemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

const REMOTE_URL = "https://git.example/acme/tools.git";
const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);
const MANIFEST_A = '{"name":"tools","revision":"a"}\n';
const MANIFEST_B = '{"name":"tools","revision":"b"}\n';
const OWNERSHIP_MARKER = '{\n  "generatedBy": "pi-claude-marketplace"\n}\n';

const AUTH: GitAuthBundle = {
  kind: "stored-credential",
  credentialOps: createCredentialOpsFake({ boundary: "memory", credentials: [] }).credentialOps,
  host: "git.example",
};

interface Swap {
  readonly locations: ScopedLocations;
  readonly liveDir: string;
  readonly backupDir: string;
  readonly stagingRoot: string;
}

async function swapRoot(t: TestContext): Promise<Swap> {
  const root = await mkdtemp(path.join(os.tmpdir(), "clone-swap-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const locations = locationsFor("project", path.join(root, "project"));
  return {
    locations,
    liveDir: await locations.sourceCloneDir("tools"),
    backupDir: await locations.sourceBackupDir("tools"),
    stagingRoot: path.join(locations.extensionRoot, "sources-staging"),
  };
}

/** A checkout tree whose manifest is `manifest`, as a clone writes it. */
async function writeCheckout(dir: string, manifest: string): Promise<void> {
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(dir, ".git"), { recursive: true });
  await writeFile(path.join(dir, ".claude-plugin", "marketplace.json"), manifest);
  await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
}

/** The tree a clone of the remote writes, kept outside the extension root. */
async function remoteTree(t: TestContext, manifest: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "clone-swap-remote-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeCheckout(dir, manifest);
  return dir;
}

async function manifestOf(dir: string): Promise<string> {
  return readFile(path.join(dir, ".claude-plugin", "marketplace.json"), "utf8");
}

async function entriesOf(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort((left, right) => left.localeCompare(right));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

function gitAt(options: {
  readonly localHead: string;
  readonly remoteHead: string;
  readonly cloneFrom: string;
  readonly cloneError?: Error;
}) {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [REMOTE_URL],
    initialOid: options.localHead,
    remoteHead: options.remoteHead,
    cloneFixture: { boundary: "local", sourceDir: options.cloneFrom },
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
  });
}

function swapArgs(
  swap: Swap,
  gitOps: GitOps,
  overrides: Partial<Pick<CloneSwapArgs, "ref" | "onReplaced" | "removalOps" | "renameOps">> = {},
): CloneSwapArgs {
  return {
    locations: swap.locations,
    liveDir: swap.liveDir,
    backupDir: swap.backupDir,
    url: REMOTE_URL,
    gitOps,
    auth: AUTH,
    removalOps: createRemovalOps(),
    renameOps: DEFAULT_RENAME_OPS,
    ...overrides,
  };
}

/** A rename that fails with `error` when it moves `from`, and renames otherwise. */
function renameFailingFrom(from: string, error: Error): RenameOps {
  return {
    rename: (source, target) =>
      source === from ? Promise.reject(error) : DEFAULT_RENAME_OPS.rename(source, target),
  };
}

function errnoError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: rename refused`), { code, syscall: "rename" });
}

test("D-SG-10: a stale checkout is cloned into staging and swapped in with the ownership marker", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  let replacedCount = 0;

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, {
      onReplaced: () => {
        replacedCount += 1;
      },
    }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.strictEqual(await readFile(ownershipMarkerPath(swap.liveDir), "utf8"), OWNERSHIP_MARKER);
  assert.strictEqual(replacedCount, 1);
  assert.deepStrictEqual(git.state.calls.resolveRef, [{ dir: swap.liveDir, ref: "HEAD" }]);
  assert.deepStrictEqual(git.state.calls.resolveRemoteRef, [{ url: REMOTE_URL, auth: AUTH }]);
  const [clone] = git.state.calls.clone;
  assert.deepStrictEqual(
    { ...clone, dir: path.dirname(clone?.dir ?? "") },
    { dir: swap.stagingRoot, url: REMOTE_URL, auth: AUTH },
  );
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("D-SG-10: a checkout at the remote's commit is current and nothing is cloned or written", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_A,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "current" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  assert.deepStrictEqual(git.state.calls.clone, []);
  assert.deepStrictEqual(await entriesOf(swap.locations.extensionRoot), ["sources"]);
});

test("D-SG-10: a branch ref asks the remote for that ref and clones that branch alone", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps, { ref: "main" }));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.deepStrictEqual(git.state.calls.resolveRemoteRef, [
    { url: REMOTE_URL, ref: "main", auth: AUTH },
  ]);
  assert.deepStrictEqual(
    git.state.calls.clone.map(({ ref, singleBranch }) => ({ ref, singleBranch })),
    [{ ref: "main", singleBranch: true }],
  );
});

for (const { title, ref, expectedKind, cloneCount } of [
  {
    title: "a full-SHA ref equal to HEAD is current",
    ref: COMMIT_A.toUpperCase(),
    expectedKind: "current",
    cloneCount: 0,
  },
  {
    title: "a full-SHA ref other than HEAD is stale",
    ref: COMMIT_B,
    expectedKind: "replaced",
    cloneCount: 1,
  },
] as const) {
  test(`D-SG-10: ${title} and asks the remote nothing`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead: COMMIT_B,
      cloneFrom: await remoteTree(t, MANIFEST_B),
    });

    // act
    const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps, { ref }));

    // assert
    assert.deepStrictEqual(swapped, { kind: expectedKind });
    assert.deepStrictEqual(git.state.calls.resolveRemoteRef, []);
    assert.strictEqual(git.state.calls.clone.length, cloneCount);
  });
}

test("D-SG-10: an unreadable HEAD is stale and asks the remote nothing", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_A,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    resolveRef: () =>
      Promise.reject(new GitCommandError({ kind: "not-a-repository" }, { operation: "rev-parse" })),
  };

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(git.state.calls.resolveRemoteRef, []);
});

test("D-SG-10: a missing checkout is cloned again into its place", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_A,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(git.state.calls.resolveRef, []);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
});

test("D-SG-10: a failed clone leaves the live checkout untouched and removes its staging", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const cloneError = new GitCommandError(
    { kind: "network" },
    { operation: "clone --depth", exitCode: 128 },
  );
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
    cloneError,
  });

  // act & assert
  await assert.rejects(refreshCloneBySwap(swapArgs(swap, git.gitOps)), (error: unknown) => {
    assert.strictEqual(error, cloneError);
    return true;
  });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
});

test("MA-9: a failed clone whose staging cannot be removed appends the leak", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const cloneError = new GitCommandError(
    { kind: "network" },
    { operation: "clone --depth", exitCode: 128 },
  );
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
    cloneError,
  });
  const removalOps: RemovalOps = { rm: () => Promise.reject(errnoError("EIO")) };

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(swapArgs(swap, git.gitOps, { removalOps })),
    (error: unknown) => {
      assert.ok(error instanceof CleanupLeakError);
      assert.strictEqual(error.cause, cloneError);
      assert.match(error.message, /failed to clean up marketplace clone staging at /u);
      return true;
    },
  );
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
});

for (const code of ["EBUSY", "EPERM", "EACCES"]) {
  test(`D-SG-10: a checkout that cannot be moved aside with ${code} is kept and the staging removed`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead: COMMIT_B,
      cloneFrom: await remoteTree(t, MANIFEST_B),
    });
    const renameError = errnoError(code);
    let replacedCount = 0;

    // act
    const swapped = await refreshCloneBySwap(
      swapArgs(swap, git.gitOps, {
        renameOps: renameFailingFrom(swap.liveDir, renameError),
        onReplaced: () => {
          replacedCount += 1;
        },
      }),
    );

    // assert
    assert.deepStrictEqual(swapped, { kind: "kept-in-use", cause: renameError });
    assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
    assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
    assert.strictEqual(replacedCount, 0);
  });
}

test("D-SG-10: a move-aside that fails other than by use is thrown and the staging removed", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const renameError = errnoError("ENOSPC");

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(
      swapArgs(swap, git.gitOps, { renameOps: renameFailingFrom(swap.liveDir, renameError) }),
    ),
    (error: unknown) => {
      assert.strictEqual(error, renameError);
      return true;
    },
  );
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
});

test("D-SG-10: a failed move-in renames the backup back, so the old checkout stays live", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const renameError = errnoError("EXDEV");
  const renameOps: RenameOps = {
    rename: (source, target) =>
      target === swap.liveDir && source !== swap.backupDir
        ? Promise.reject(renameError)
        : DEFAULT_RENAME_OPS.rename(source, target),
  };
  let replacedCount = 0;

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(
      swapArgs(swap, git.gitOps, {
        renameOps,
        onReplaced: () => {
          replacedCount += 1;
        },
      }),
    ),
    (error: unknown) => {
      assert.strictEqual(error, renameError);
      return true;
    },
  );
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
  assert.strictEqual(replacedCount, 0);
});

test("MA-9: a failed move-in whose backup cannot be renamed back reports both leaks", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const renameError = errnoError("EXDEV");
  const renameOps: RenameOps = {
    rename: (source, target) =>
      target === swap.liveDir
        ? Promise.reject(renameError)
        : DEFAULT_RENAME_OPS.rename(source, target),
  };
  const removalOps: RemovalOps = { rm: () => Promise.reject(errnoError("EIO")) };

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(swapArgs(swap, git.gitOps, { renameOps, removalOps })),
    (error: unknown) => {
      assert.ok(error instanceof CleanupLeakError);
      assert.strictEqual(error.cause, renameError);
      assert.match(
        error.message,
        /failed to restore marketplace checkout .+; failed to clean up marketplace clone staging at /u,
      );
      return true;
    },
  );
  assert.strictEqual(await manifestOf(swap.backupDir), MANIFEST_A);
});

test("D-SG-10: a missing checkout whose clone cannot move in is thrown with no backup to restore", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const renameError = errnoError("EXDEV");

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(
      swapArgs(swap, git.gitOps, {
        renameOps: { rename: () => Promise.reject(renameError) },
      }),
    ),
    (error: unknown) => {
      assert.strictEqual(error, renameError);
      return true;
    },
  );
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.liveDir)), []);
});

test("D-SG-10: a backup that cannot be deleted after the swap still reports the replacement", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });
  const removalOps: RemovalOps = {
    rm: (target, options) =>
      target === swap.backupDir
        ? Promise.reject(errnoError("EIO"))
        : createRemovalOps().rm(target, options),
  };

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps, { removalOps }));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.strictEqual(await manifestOf(swap.backupDir), MANIFEST_A);
});
