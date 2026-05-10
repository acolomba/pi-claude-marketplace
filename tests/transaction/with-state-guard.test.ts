import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/claude-marketplace/domain/source.ts";
import {
  locationsFor,
  type ScopedLocations,
} from "../../extensions/claude-marketplace/persistence/locations.ts";
import { withStateGuard } from "../../extensions/claude-marketplace/transaction/with-state-guard.ts";

import type { ExtensionState } from "../../extensions/claude-marketplace/persistence/state-io.ts";

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
