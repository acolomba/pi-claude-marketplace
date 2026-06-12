import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  locationsFor,
  type ScopedLocations,
} from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { StateLockHeldError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  withLockedStateTransaction,
  withStateGuard,
} from "../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * ST-7 / ST-8 / ST-9 / SC-3 -- withStateGuard intra-process state lifecycle.
 *
 * The guard's contract is "load fresh, hand to closure, save only on no-throw"
 * (ST-7). ST-8 (concurrent install hard-fail) and ST-9 (update concurrent
 * change) are caller-supplied invariants checked INSIDE the mutate closure;
 * the guard itself does not enforce them. The SC-3 success-criterion-3
 * verifier is the in-process concurrent install round-trip: caller A commits,
 * caller B sees the commit on its own fresh-load and either hard-fails
 * (install) or soft-converges (idempotent uninstall).
 */

interface TmpScope {
  readonly loc: ScopedLocations;
  readonly cleanup: () => Promise<void>;
}

async function setupTmpScope(): Promise<TmpScope> {
  const tmp = await mkdtemp(path.join(tmpdir(), "pi-cm-guard-test-"));
  const loc = locationsFor("project", tmp);
  await mkdir(loc.extensionRoot, { recursive: true });
  return {
    loc,
    cleanup: async (): Promise<void> => {
      await rm(tmp, { recursive: true, force: true });
    },
  };
}

/** Helper to add a marketplace record with a single plugin install. */
function withInstalledPlugin(
  state: ExtensionState,
  mpName: string,
  plName: string,
  version: string,
): void {
  state.marketplaces[mpName] = {
    name: mpName,
    scope: "project",
    source: pathSource("./local"),
    addedFromCwd: "/cwd",
    manifestPath: `/abs/${mpName}/.claude-plugin/marketplace.json`,
    marketplaceRoot: `/abs/${mpName}`,
    plugins: {
      [plName]: {
        version,
        resolvedSource: `/abs/${plName}`,
        compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
        installedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    },
  };
}

interface OnDiskState {
  marketplaces: Record<
    string,
    {
      plugins: Record<string, { version?: string } | undefined>;
    }
  >;
}

async function readOnDisk(stateJsonPath: string): Promise<OnDiskState> {
  const raw = await readFile(stateJsonPath, "utf8");
  return JSON.parse(raw) as OnDiskState;
}

test("ST-7 happy path: mutate succeeds -> state.json reflects mutation", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
  } finally {
    await cleanup();
  }
});

test("ST-7 throw path: mutate throws -> state.json UNCHANGED on disk", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    // Pre-populate with a single plugin record.
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    // Now simulate a throw inside the mutate.
    await assert.rejects(
      () =>
        withStateGuard(loc, (state) => {
          // Attempt to attach a duplicate record then bail.
          const existing = state.marketplaces.mp1?.plugins.p1;
          if (existing) {
            state.marketplaces.mp1!.plugins.p2 = existing;
          }

          throw new Error("simulated mid-mutation failure");
        }),
      /simulated mid-mutation failure/,
    );
    // Verify state.json on disk was NOT updated.
    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
    assert.equal(
      onDisk.marketplaces.mp1?.plugins.p2,
      undefined,
      "save-on-throw should NOT have happened",
    );
  } finally {
    await cleanup();
  }
});

test("ST-7 fresh-load: second withStateGuard sees first's commit", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    const observed = await withStateGuard(loc, (state) => {
      return state.marketplaces.mp1?.plugins.p1?.version;
    });
    assert.equal(observed, "1.0.0");
  } finally {
    await cleanup();
  }
});

test("D-06 withStateGuard holds the per-scope lock across load-mutate-save", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withStateGuard(loc, async (state) => {
      assert.equal(
        await lockfile.check(loc.extensionRoot, {
          lockfilePath: loc.stateLockFile,
          realpath: false,
        }),
        true,
      );
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    assert.equal(
      await lockfile.check(loc.extensionRoot, {
        lockfilePath: loc.stateLockFile,
        realpath: false,
      }),
      false,
    );
  } finally {
    await cleanup();
  }
});

test("D-07 pre-held state lock fails fast with StateLockHeldError and does not run mutate", async () => {
  const { loc, cleanup } = await setupTmpScope();
  const release = await lockfile.lock(loc.extensionRoot, {
    lockfilePath: loc.stateLockFile,
    realpath: false,
  });

  try {
    let mutateRan = false;
    await assert.rejects(
      () =>
        withStateGuard(loc, () => {
          mutateRan = true;
        }),
      (err: unknown) => err instanceof StateLockHeldError && err.lockPath === loc.stateLockFile,
    );
    assert.equal(mutateRan, false);
  } finally {
    await release();
    await cleanup();
  }
});

test("D-06 mutate failure releases the lock for the next state guard call", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await assert.rejects(
      () =>
        withStateGuard(loc, () => {
          throw new Error("simulated mutate failure while lock held");
        }),
      /simulated mutate failure while lock held/,
    );

    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
  } finally {
    await cleanup();
  }
});

test("D-06 save failure releases the lock for the next state guard call", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await assert.rejects(
      () =>
        withStateGuard(loc, (state) => {
          (state as { schemaVersion: number }).schemaVersion = 2;
        }),
      /saveState refused/,
    );

    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PRL-10: manual-save transaction helper for reinstall rollback
// ──────────────────────────────────────────────────────────────────────────

test("PRL-10 manual transaction saves only when tx.save is called", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    await withLockedStateTransaction(loc, async (tx) => {
      const record = tx.state.marketplaces.mp1?.plugins.p1;
      assert.equal(record?.version, "1.0.0", "transaction receives freshly loaded state");
      assert.ok(record, "expected pre-populated plugin record");

      record.version = "2.0.0";

      const beforeSave = await readOnDisk(loc.stateJsonPath);
      assert.equal(
        beforeSave.marketplaces.mp1?.plugins.p1?.version,
        "1.0.0",
        "mutating tx.state must not write state.json before tx.save()",
      );

      await tx.save();
    });

    const afterSave = await readOnDisk(loc.stateJsonPath);
    assert.equal(afterSave.marketplaces.mp1?.plugins.p1?.version, "2.0.0");
  } finally {
    await cleanup();
  }
});

test("PRL-10 manual transaction holds the per-scope lock while callback runs", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withLockedStateTransaction(loc, async () => {
      assert.equal(
        await lockfile.check(loc.extensionRoot, {
          lockfilePath: loc.stateLockFile,
          realpath: false,
        }),
        true,
      );
    });

    assert.equal(
      await lockfile.check(loc.extensionRoot, {
        lockfilePath: loc.stateLockFile,
        realpath: false,
      }),
      false,
    );
  } finally {
    await cleanup();
  }
});

test("PRL-10 manual transaction save failure releases lock", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await assert.rejects(
      () =>
        withLockedStateTransaction(
          loc,
          async (tx) => {
            withInstalledPlugin(tx.state, "mp1", "p1", "1.0.0");
            await tx.save();
          },
          {
            saveState: () => Promise.reject(new Error("simulated explicit save failure")),
          },
        ),
      /simulated explicit save failure/,
    );

    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
  } finally {
    await cleanup();
  }
});

test("PRL-10 manual transaction callback failure does not save and releases lock", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });

    await assert.rejects(
      () =>
        withLockedStateTransaction(loc, (tx) => {
          const record = tx.state.marketplaces.mp1?.plugins.p1;
          assert.ok(record, "expected pre-populated plugin record");
          record.version = "2.0.0";
          throw new Error("simulated callback failure before save");
        }),
      /simulated callback failure before save/,
    );

    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");

    await withStateGuard(loc, (state) => {
      const record = state.marketplaces.mp1?.plugins.p1;
      assert.ok(record, "expected plugin record after callback failure");
      record.version = "1.0.1";
    });

    const afterRetry = await readOnDisk(loc.stateJsonPath);
    assert.equal(afterRetry.marketplaces.mp1?.plugins.p1?.version, "1.0.1");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// SC-3 success criterion 3: in-process concurrent install round-trip
// ──────────────────────────────────────────────────────────────────────────

test("SC-3 / ST-8 hard-fail: caller B detects A's prior commit and throws 'was installed concurrently'", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    // Caller A: install p1@v1.0
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    // Caller B: also tries to install p1, runs commit-time invariant inside mutate.
    await assert.rejects(
      () =>
        withStateGuard(loc, (state) => {
          const mp = state.marketplaces.mp1;
          if (mp?.plugins.p1 !== undefined) {
            // ST-8: install hard-fails on conflicting target.
            throw new Error(`Plugin "p1" was installed concurrently in marketplace "mp1".`);
          }
          // (would mutate here)
        }),
      /was installed concurrently/,
    );
    // State on disk reflects ONLY caller A's mutation.
    const onDisk = await readOnDisk(loc.stateJsonPath);
    assert.equal(onDisk.marketplaces.mp1?.plugins.p1?.version, "1.0.0");
  } finally {
    await cleanup();
  }
});

test("SC-3 / ST-8 soft-converge: caller B's idempotent uninstall sees record already gone -> no throw", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    // Caller A: install then uninstall p1.
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    await withStateGuard(loc, (state) => {
      const mp = state.marketplaces.mp1;
      if (mp) {
        delete mp.plugins.p1;
      }
    });
    // Caller B: simulated concurrent uninstall -- should silently converge.
    let didConverge = false;
    await withStateGuard(loc, (state) => {
      const mp = state.marketplaces.mp1;
      if (!mp?.plugins.p1) {
        // ST-8 soft-converge: record already gone, treat as success (no-op).
        didConverge = true;
        return;
      }

      delete mp.plugins.p1;
    });
    assert.equal(didConverge, true, "soft-converge path must execute when record already gone");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// ST-9: update detects concurrent version change
// ──────────────────────────────────────────────────────────────────────────

test("ST-9 update concurrent change: caller B sees caller A's version bump and throws 'changed concurrently'", async () => {
  const { loc, cleanup } = await setupTmpScope();
  try {
    // Caller A: install p1@v1.0
    await withStateGuard(loc, (state) => {
      withInstalledPlugin(state, "mp1", "p1", "1.0.0");
    });
    // Caller B: starts an update from v1.0
    const fromVersion = "1.0.0";
    // Caller A meanwhile bumps to v1.1
    await withStateGuard(loc, (state) => {
      const mp = state.marketplaces.mp1;
      if (mp?.plugins.p1) {
        mp.plugins.p1.version = "1.1.0";
      }
    });
    // Caller B now commits its update -- inside the closure, the freshly-loaded
    // state shows v1.1, so the fromVersion invariant fails.
    await assert.rejects(
      () =>
        withStateGuard(loc, (state) => {
          const current = state.marketplaces.mp1?.plugins.p1?.version;
          if (current !== fromVersion) {
            throw new Error(
              `Plugin "p1" in marketplace "mp1" changed concurrently; retry the update. (saw ${String(current)}, expected ${fromVersion})`,
            );
          }
          // (would update here)
        }),
      /changed concurrently; retry the update/,
    );
  } finally {
    await cleanup();
  }
});

test("PRL-10 manual transaction surfaces StateLockHeldError when scope lock is pre-held", async () => {
  const { loc, cleanup } = await setupTmpScope();
  const release = await lockfile.lock(loc.extensionRoot, {
    lockfilePath: loc.stateLockFile,
    realpath: false,
  });

  try {
    let callbackRan = false;
    await assert.rejects(
      () =>
        withLockedStateTransaction(loc, () => {
          callbackRan = true;
        }),
      (err: unknown) =>
        err instanceof StateLockHeldError &&
        err.lockPath === loc.stateLockFile &&
        err.scope === loc.scope,
    );
    assert.equal(callbackRan, false);
  } finally {
    await release();
    await cleanup();
  }
});

test("PRL-10 manual transaction surfaces release errors when callback succeeds", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block unlink");
    return;
  }

  const { chmod: chmodFn } = await import("node:fs/promises");
  const { loc, cleanup } = await setupTmpScope();
  const lockParent = path.dirname(loc.stateLockFile);

  try {
    let releaseError: Error | undefined;
    try {
      await withLockedStateTransaction(loc, async () => {
        // Chmod the lockfile's parent dir to read-only so proper-lockfile's
        // release() cannot unlink the sentinel during finally. The release
        // throw is surfaced as primaryError because the callback succeeded,
        // exercising the `primaryError = releaseErr` branch.
        await chmodFn(lockParent, 0o500);
      });
    } catch (err) {
      releaseError = err as Error;
    }

    assert.ok(releaseError !== undefined, "release() should have failed and surfaced");
  } finally {
    await chmodFn(lockParent, 0o755);
    await cleanup();
  }
});

test("ST-7 withStateGuard surfaces release errors when mutate succeeds", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block unlink");
    return;
  }

  const { chmod: chmodFn } = await import("node:fs/promises");
  const { loc, cleanup } = await setupTmpScope();
  const lockParent = path.dirname(loc.stateLockFile);

  try {
    let releaseError: Error | undefined;
    try {
      await withStateGuard(loc, async () => {
        // Same chmod trick used for the locked-transaction variant: the
        // unlink in finally fails, so the release error surfaces as the
        // primary error since mutate succeeded.
        await chmodFn(lockParent, 0o500);
      });
    } catch (err) {
      releaseError = err as Error;
    }

    assert.ok(releaseError !== undefined, "release() should have failed and surfaced");
  } finally {
    await chmodFn(lockParent, 0o755);
    await cleanup();
  }
});
