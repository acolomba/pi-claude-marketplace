import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { githubSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  DEFAULT_RENAME_OPS,
  installedRootsInside,
  KEEP_MARKETPLACE_ON_FAILURE_VARIABLE,
  keepMarketplaceOnFailure,
  MARKETPLACE_MANIFEST_MARKER,
  ownershipMarkerPath,
  refreshCloneBySwap,
  swapCloneUrl,
  type CloneSwapArgs,
  type RenameOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  CleanupLeakError,
  GitCommandError,
  InvalidGitHubBaseUrlError,
  type GitFailure,
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
const MANIFEST_C = '{"name":"tools","revision":"c"}\n';
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
  readonly stagingDir: string;
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
    stagingDir: await locations.sourceSwapStagingDir("tools"),
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
  readonly lsRemoteError?: Error;
}) {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [REMOTE_URL],
    initialOid: options.localHead,
    remoteHead: options.remoteHead,
    cloneFixture: { boundary: "local", sourceDir: options.cloneFrom },
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
    ...(options.lsRemoteError === undefined
      ? {}
      : { resolveRemoteRefError: options.lsRemoteError }),
  });
}

function swapArgs(
  swap: Swap,
  gitOps: GitOps,
  overrides: Partial<
    Pick<
      CloneSwapArgs,
      | "ref"
      | "onReplaced"
      | "removalOps"
      | "renameOps"
      | "keepOnUnreachable"
      | "liveMarker"
      | "ownershipMarker"
      | "carryOver"
    >
  > = {},
): CloneSwapArgs {
  return {
    liveDir: swap.liveDir,
    backupDir: swap.backupDir,
    stagingDir: swap.stagingDir,
    url: REMOTE_URL,
    gitOps,
    auth: AUTH,
    liveMarker: MARKETPLACE_MANIFEST_MARKER,
    keepOnUnreachable: false,
    ownershipMarker: true,
    carryOver: [],
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
  assert.deepStrictEqual(git.state.calls.clone, [
    { dir: swap.stagingDir, url: REMOTE_URL, auth: AUTH },
  ]);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("MA-12 / D-SG-10: a mirror swap writes no ownership marker into its new clone", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, {
      liveMarker: path.join(".git", "HEAD"),
      ownershipMarker: false,
    }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(await entriesOf(path.join(swap.liveDir, ".git")), ["HEAD"]);
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

function lsRemoteFailure(failure: GitFailure): GitCommandError {
  return new GitCommandError(failure, { operation: "ls-remote", exitCode: 128 });
}

test("D-SG-10 / NFR-3: a backup beside no checkout is renamed back before the freshness check", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.backupDir, MANIFEST_A);
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
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
  assert.deepStrictEqual(git.state.calls.clone, []);
});

test("D-SG-10 / NFR-3: a checkout without its manifest beside a backup is removed and the backup restored", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.backupDir, MANIFEST_A);
  await mkdir(path.join(swap.liveDir, ".git"), { recursive: true });
  await writeFile(path.join(swap.liveDir, "half-moved.txt"), "partial\n");
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_A,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "current" });
  assert.deepStrictEqual(await entriesOf(swap.liveDir), [".claude-plugin", ".git"]);
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("D-SG-10 / NFR-3: a backup beside a valid checkout is removed and the checkout kept", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_B);
  await writeCheckout(swap.backupDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_B,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "current" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("D-SG-10 / NFR-3: a refresh removes the staging directory an interrupted refresh left, and leaves other staging alone", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writeCheckout(swap.stagingDir, MANIFEST_C);
  await writeFile(path.join(swap.stagingDir, "half-written"), "left by a killed clone\n");
  const otherRun = path.join(swap.stagingRoot, "123e4567-e89b-12d3-a456-426614174000");
  await writeCheckout(otherRun, MANIFEST_C);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), [path.basename(otherRun)]);
});

test("D-SG-10 / NFR-3: a current checkout still loses the staging directory an interrupted refresh left", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writeCheckout(swap.stagingDir, MANIFEST_C);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_A,
    cloneFrom: await remoteTree(t, MANIFEST_B),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps));

  // assert
  assert.deepStrictEqual(swapped, { kind: "current" });
  assert.deepStrictEqual(await entriesOf(swap.stagingRoot), []);
});

for (const value of [undefined, "", "   ", "0", "false", "no", "off", "2"]) {
  test(`D-SG-15: ${JSON.stringify(value)} reads false`, () => {
    // arrange
    const env = value === undefined ? {} : { [KEEP_MARKETPLACE_ON_FAILURE_VARIABLE]: value };

    // act
    const keep = keepMarketplaceOnFailure(env);

    // assert
    assert.strictEqual(keep, false);
  });
}

for (const value of ["1", " TRUE ", "yes", "On"]) {
  test(`D-SG-15: ${JSON.stringify(value)} reads true`, () => {
    // arrange
    const env = { [KEEP_MARKETPLACE_ON_FAILURE_VARIABLE]: value };

    // act
    const keep = keepMarketplaceOnFailure(env);

    // assert
    assert.strictEqual(keep, true);
  });
}

test("D-SG-15: the keep variable is read from the process environment by default", (t) => {
  // arrange
  const hadValue = Object.hasOwn(process.env, KEEP_MARKETPLACE_ON_FAILURE_VARIABLE);
  const previous = process.env[KEEP_MARKETPLACE_ON_FAILURE_VARIABLE];
  t.after(() => {
    if (hadValue) {
      process.env[KEEP_MARKETPLACE_ON_FAILURE_VARIABLE] = previous;
    } else {
      Reflect.deleteProperty(process.env, KEEP_MARKETPLACE_ON_FAILURE_VARIABLE);
    }
  });
  process.env[KEEP_MARKETPLACE_ON_FAILURE_VARIABLE] = "yes";

  // act
  const keep = keepMarketplaceOnFailure();

  // assert
  assert.strictEqual(keep, true);
});

for (const failure of [
  { kind: "network" },
  { kind: "timeout", timeoutMs: 120_000 },
  { kind: "https-auth", detail: "no-credential" },
  { kind: "repository-not-found" },
] as const satisfies readonly GitFailure[]) {
  test(`D-SG-15: an ls-remote failing as ${failure.kind} keeps a valid checkout and clones nothing`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const lsRemoteError = lsRemoteFailure(failure);
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead: COMMIT_B,
      cloneFrom: await remoteTree(t, MANIFEST_B),
      lsRemoteError,
    });

    // act
    const swapped = await refreshCloneBySwap(
      swapArgs(swap, git.gitOps, { keepOnUnreachable: true }),
    );

    // assert
    assert.deepStrictEqual(swapped, { kind: "kept-stale", cause: lsRemoteError });
    assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
    assert.deepStrictEqual(git.state.calls.clone, []);
  });
}

for (const failure of [
  { kind: "git-missing", detail: "not-found" },
  { kind: "refused-input" },
  { kind: "aborted" },
] as const satisfies readonly GitFailure[]) {
  test(`D-SG-15: an ls-remote failing as ${failure.kind} is thrown and nothing is kept or cloned`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const lsRemoteError = lsRemoteFailure(failure);
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead: COMMIT_B,
      cloneFrom: await remoteTree(t, MANIFEST_B),
      lsRemoteError,
    });

    // act & assert
    await assert.rejects(
      refreshCloneBySwap(swapArgs(swap, git.gitOps, { keepOnUnreachable: true })),
      (error: unknown) => {
        assert.strictEqual(error, lsRemoteError);
        return true;
      },
    );
    assert.deepStrictEqual(git.state.calls.clone, []);
  });
}

test("GHB-03: an invalid GitHub base from the ls-remote is thrown, not kept", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const lsRemoteError = new InvalidGitHubBaseUrlError(
    "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
    "scheme",
  );
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTree(t, MANIFEST_B),
    lsRemoteError,
  });

  // act & assert
  await assert.rejects(
    refreshCloneBySwap(swapArgs(swap, git.gitOps, { keepOnUnreachable: true })),
    (error: unknown) => {
      assert.strictEqual(error, lsRemoteError);
      return true;
    },
  );
  assert.deepStrictEqual(git.state.calls.clone, []);
});

for (const { title, keepOnUnreachable, liveMarker } of [
  {
    title: "without the keep variable",
    keepOnUnreachable: false,
    liveMarker: path.join(".claude-plugin", "marketplace.json"),
  },
  {
    title: "with the keep variable but no manifest in the checkout",
    keepOnUnreachable: true,
    liveMarker: path.join(".claude-plugin", "absent.json"),
  },
]) {
  test(`D-SG-15: an unreachable remote ${title} is cloned again and the check's failure thrown`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const lsRemoteError = lsRemoteFailure({ kind: "network" });
    const cloneError = new GitCommandError(
      { kind: "network" },
      { operation: "clone --depth", exitCode: 128 },
    );
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead: COMMIT_B,
      cloneFrom: await remoteTree(t, MANIFEST_B),
      lsRemoteError,
      cloneError,
    });

    // act & assert
    await assert.rejects(
      refreshCloneBySwap(swapArgs(swap, git.gitOps, { keepOnUnreachable, liveMarker })),
      (error: unknown) => {
        assert.strictEqual(error, lsRemoteError);
        return true;
      },
    );
    assert.strictEqual(git.state.calls.clone.length, 1);
    assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_A);
  });
}

for (const { title, remoteHead, ref, expectedKind } of [
  {
    title: "a stale checkout is cloned again",
    remoteHead: COMMIT_B,
    ref: undefined,
    expectedKind: "replaced",
  },
  {
    title: "a current checkout is current",
    remoteHead: COMMIT_A,
    ref: undefined,
    expectedKind: "current",
  },
  {
    title: "a full-SHA ref other than HEAD is cloned again",
    remoteHead: COMMIT_A,
    ref: COMMIT_B,
    expectedKind: "replaced",
  },
] as const) {
  test(`D-SG-15: with the keep variable, ${title}`, async (t) => {
    // arrange
    const swap = await swapRoot(t);
    await writeCheckout(swap.liveDir, MANIFEST_A);
    const git = gitAt({
      localHead: COMMIT_A,
      remoteHead,
      cloneFrom: await remoteTree(t, MANIFEST_B),
    });

    // act
    const swapped = await refreshCloneBySwap(
      swapArgs(swap, git.gitOps, {
        keepOnUnreachable: true,
        ...(ref === undefined ? {} : { ref }),
      }),
    );

    // assert
    assert.deepStrictEqual(swapped, { kind: expectedKind });
  });
}

/** An installed plugin's packages, as its package manager left them. */
async function writePackages(pluginRoot: string, marker: string): Promise<void> {
  await mkdir(path.join(pluginRoot, "node_modules", "dep"), { recursive: true });
  await writeFile(path.join(pluginRoot, "node_modules", "dep", "index.js"), marker);
}

async function packagesOf(pluginRoot: string): Promise<string> {
  return readFile(path.join(pluginRoot, "node_modules", "dep", "index.js"), "utf8");
}

/** A remote tree that holds the plugin roots `roots`, with no packages. */
async function remoteTreeWithPlugins(t: TestContext, roots: readonly string[]): Promise<string> {
  const dir = await remoteTree(t, MANIFEST_B);
  for (const pluginRoot of roots) {
    await mkdir(path.join(dir, pluginRoot), { recursive: true });
  }

  return dir;
}

test("D-PL9-10: an installed plugin's packages move from the old checkout into the new one", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writePackages(path.join(swap.liveDir, "plugins", "pkp"), "old packages\n");
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTreeWithPlugins(t, [path.join("plugins", "pkp")]),
  });

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, { carryOver: [path.join("plugins", "pkp")] }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.strictEqual(await packagesOf(path.join(swap.liveDir, "plugins", "pkp")), "old packages\n");
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("D-PL9-10: packages of a plugin root the new checkout lacks are not carried", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writePackages(path.join(swap.liveDir, "plugins", "gone"), "old packages\n");
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTreeWithPlugins(t, []),
  });

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, { carryOver: [path.join("plugins", "gone")] }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.deepStrictEqual(await entriesOf(path.join(swap.liveDir, "plugins")), []);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("D-PL9-10: a plugin root whose new checkout already has packages keeps its own", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  const pluginRoot = path.join("plugins", "pkp");
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writePackages(path.join(swap.liveDir, pluginRoot), "old packages\n");
  const remote = await remoteTreeWithPlugins(t, [pluginRoot]);
  await writePackages(path.join(remote, pluginRoot), "committed packages\n");
  const git = gitAt({ localHead: COMMIT_A, remoteHead: COMMIT_B, cloneFrom: remote });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps, { carryOver: [pluginRoot] }));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await packagesOf(path.join(swap.liveDir, pluginRoot)), "committed packages\n");
});

test("D-PL9-10: a plugin root with no packages in the old checkout carries nothing", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  const pluginRoot = path.join("plugins", "pkp");
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTreeWithPlugins(t, [pluginRoot]),
  });

  // act
  const swapped = await refreshCloneBySwap(swapArgs(swap, git.gitOps, { carryOver: [pluginRoot] }));

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.deepStrictEqual(await entriesOf(path.join(swap.liveDir, pluginRoot)), []);
});

test("D-PL9-10: a packages move that fails still reports the replacement", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  const pluginRoot = path.join("plugins", "pkp");
  await writeCheckout(swap.liveDir, MANIFEST_A);
  await writePackages(path.join(swap.liveDir, pluginRoot), "old packages\n");
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTreeWithPlugins(t, [pluginRoot]),
  });
  const packagesFrom = path.join(swap.backupDir, pluginRoot, "node_modules");

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, {
      carryOver: [pluginRoot],
      renameOps: renameFailingFrom(packagesFrom, errnoError("EXDEV")),
    }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await manifestOf(swap.liveDir), MANIFEST_B);
  assert.deepStrictEqual(await entriesOf(path.join(swap.liveDir, pluginRoot)), []);
  assert.deepStrictEqual(await entriesOf(path.dirname(swap.backupDir)), []);
});

test("NFR-10: a plugin root outside the checkout carries nothing", async (t) => {
  // arrange
  const swap = await swapRoot(t);
  await writeCheckout(swap.liveDir, MANIFEST_A);
  const outside = path.join(swap.locations.extensionRoot, "outside");
  await writePackages(outside, "outside packages\n");
  const git = gitAt({
    localHead: COMMIT_A,
    remoteHead: COMMIT_B,
    cloneFrom: await remoteTreeWithPlugins(t, []),
  });

  // act
  const swapped = await refreshCloneBySwap(
    swapArgs(swap, git.gitOps, { carryOver: [path.join("..", "..", "outside")] }),
  );

  // assert
  assert.deepStrictEqual(swapped, { kind: "replaced" });
  assert.strictEqual(await packagesOf(outside), "outside packages\n");
  assert.deepStrictEqual(await entriesOf(swap.liveDir), [".claude-plugin", ".git"]);
});

/** A record of the scope whose plugin root is `resolvedSource`. */
function marketplacesWithRoots(
  ...resolvedSources: readonly string[]
): Parameters<typeof installedRootsInside>[1] {
  return {
    tools: {
      source: { source: "url", url: REMOTE_URL },
      plugins: Object.fromEntries(
        resolvedSources.map((resolvedSource, index) => [`p${String(index)}`, { resolvedSource }]),
      ),
    },
  } as unknown as Parameters<typeof installedRootsInside>[1];
}

test("D-PL9-10 / NFR-10: the installed roots inside a checkout are its records' roots relative to it", () => {
  // arrange
  const liveDir = path.join(os.tmpdir(), "scope", "sources", "tools");
  const marketplaces = marketplacesWithRoots(
    path.join(liveDir, "plugins", "pkp"),
    liveDir,
    path.dirname(liveDir),
    path.join(path.dirname(liveDir), "other", "plugin"),
  );

  // act
  const roots = installedRootsInside(liveDir, marketplaces);

  // assert
  assert.deepStrictEqual(roots, [path.join("plugins", "pkp"), ""]);
});

for (const { title, listRemotesResult, expected } of [
  {
    title: "the checkout's recorded origin",
    listRemotesResult: { kind: "origin", url: "https://git.example/acme/tools.git" },
    expected: "https://git.example/acme/tools.git",
  },
  {
    title: "the source's clone URL when the checkout records no origin",
    listRemotesResult: { kind: "not-a-repo" },
    expected: "https://github.com/acme/market.git",
  },
] as const) {
  test(`D-SG-10: a marketplace refresh clones from ${title}`, async () => {
    // arrange
    const git = createGitOpsFake({ boundary: "memory", listRemotesResult });

    // act
    const url = await swapCloneUrl(
      "/scope/sources/market",
      githubSource("https://github.com/acme/market"),
      git.gitOps,
    );

    // assert
    assert.strictEqual(url, expected);
  });
}
