import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { garbageCollectPluginClones } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts";
import { probeManifestEntry } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const SHA_A = "1111111111111111111111111111111111111111";
const SHA_B = "2222222222222222222222222222222222222222";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/** Build a ScopedLocations pointing at a per-test tmpdir. */
async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-gc-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

/**
 * Build a git-source install record. When `key` is given, resolvedSource is
 * `<pluginClonesDir>/<key>` (optionally with a trailing subdir) and resolvedSha
 * is set, so the record contributes a live clone key. When `key` is undefined,
 * the record models a path/github-name plugin: no resolvedSha, resolvedSource
 * points outside the clone cache.
 */
function makeRecord(
  locations: ScopedLocations,
  opts: { key?: string; subdir?: string; sha?: string } = {},
): PluginRecord {
  const resolvedSource =
    opts.key === undefined
      ? "/some/local/path"
      : opts.subdir === undefined
        ? path.join(locations.pluginClonesDir, opts.key)
        : path.join(locations.pluginClonesDir, opts.key, opts.subdir);

  const record: PluginRecord = {
    version: "0.0.1",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  if (opts.key !== undefined) {
    record.resolvedSha = opts.sha ?? SHA_A;
  }

  return record;
}

/** Persist a state.json with the given plugin records under one marketplace. */
async function seedState(
  locations: ScopedLocations,
  plugins: Record<string, PluginRecord>,
): Promise<void> {
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: locations.scope,
        source: { kind: "path", raw: "./src" },
        addedFromCwd: "/tmp",
        manifestPath: "/tmp/marketplace.json",
        marketplaceRoot: "/tmp",
        plugins,
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

/** Create on-disk plugin-clones/<key> dirs so GC has something to sweep. */
async function seedCloneDirs(locations: ScopedLocations, keys: string[]): Promise<void> {
  for (const key of keys) {
    await mkdir(path.join(locations.pluginClonesDir, key), { recursive: true });
  }
}

async function listCloneKeys(locations: ScopedLocations): Promise<string[]> {
  try {
    const entries = await readdir(locations.pluginClonesDir);
    return entries.sort();
  } catch {
    return [];
  }
}

void test("derives live keys and deletes only unreferenced clone dirs", async () => {
  const locations = await freshLocations();
  await seedState(locations, {
    alpha: makeRecord(locations, { key: "keyA" }),
    // keyB record references a subdirectory under the clone (git-subdir plugin).
    beta: makeRecord(locations, { key: "keyB", subdir: "plugins/beta", sha: SHA_B }),
  });
  await seedCloneDirs(locations, ["keyA", "keyB", "keyC"]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.deepEqual(await listCloneKeys(locations), ["keyA", "keyB"]);
});

void test("keeps a shared clone alive while any record references it", async () => {
  const locations = await freshLocations();
  await seedState(locations, {
    alpha: makeRecord(locations, { key: "keyShared", sha: SHA_A }),
    beta: makeRecord(locations, { key: "keyShared", sha: SHA_A }),
  });
  await seedCloneDirs(locations, ["keyShared"]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.deepEqual(await listCloneKeys(locations), ["keyShared"]);
});

void test("deletes a clone once its last referencer is gone", async () => {
  const locations = await freshLocations();
  // No record references keyOrphan.
  await seedState(locations, {
    alpha: makeRecord(locations, { key: "keyLive" }),
  });
  await seedCloneDirs(locations, ["keyLive", "keyOrphan"]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.deepEqual(await listCloneKeys(locations), ["keyLive"]);
});

void test("is idempotent: a second pass over a swept cache is a no-op", async () => {
  const locations = await freshLocations();
  await seedState(locations, {
    alpha: makeRecord(locations, { key: "keyLive" }),
  });
  await seedCloneDirs(locations, ["keyLive", "keyOrphan"]);

  await garbageCollectPluginClones(locations);
  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.deepEqual(await listCloneKeys(locations), ["keyLive"]);
});

void test("returns [] when the plugin-clones dir is absent (ENOENT no-op)", async () => {
  const locations = await freshLocations();
  await seedState(locations, {
    alpha: makeRecord(locations, { key: "keyLive" }),
  });
  // Intentionally do NOT create pluginClonesDir on disk.

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
});

void test("routes every delete target through the pluginCloneDir chokepoint", async () => {
  const locations = await freshLocations();
  await seedState(locations, {});
  await seedCloneDirs(locations, ["keyToSweep"]);

  // A well-formed key is deletable and lands exactly at pluginCloneDir(key),
  // proving the containment chokepoint is the composer of the delete target.
  const expected = await locations.pluginCloneDir("keyToSweep");
  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  assert.equal(expected, path.join(locations.pluginClonesDir, "keyToSweep"));
  assert.deepEqual(await listCloneKeys(locations), []);
});

void test("a record without resolvedSha contributes no live key", async () => {
  const locations = await freshLocations();
  // path/github-name plugin: no resolvedSha, resolvedSource outside the cache.
  await seedState(locations, {
    alpha: makeRecord(locations, {}),
  });
  await seedCloneDirs(locations, ["keyC"]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  // The path plugin protects nothing, so keyC is swept.
  assert.deepEqual(await listCloneKeys(locations), []);
});

// ───────────────────────────────────────────────────────────────────────────
// MIRR-04 / MIRR-06 -- mirror-anchored records (bare <urlhash12> key) coexist
// with old-design per-sha records. deriveLiveCloneKeys' first-path-segment
// derivation protects the bare mirror key exactly like a per-sha key; an
// orphaned per-sha clone of a re-anchored unpinned source is swept.
// ───────────────────────────────────────────────────────────────────────────

const MIRROR_URL = "https://example.com/org/repo";

void test("MIRR-04: a mirror-anchored record protects its bare 12-hex clone dir while an orphaned per-sha clone is swept", async () => {
  const locations = await freshLocations();
  const mirrorKey = pluginMirrorKey(MIRROR_URL);
  // The record re-anchored to the bare mirror key; its old per-sha clone is
  // now unreferenced.
  await seedState(locations, {
    gp: makeRecord(locations, { key: mirrorKey }),
  });
  await seedCloneDirs(locations, [mirrorKey, `${mirrorKey}-${SHA_A.slice(0, 12)}`]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  // The bare mirror dir survives (protected by the record); the per-sha orphan
  // is swept (no surviving record references it).
  assert.deepEqual(await listCloneKeys(locations), [mirrorKey]);
});

void test("MIRR-04: a git-subdir mirror record (resolvedSource = mirror root + subdir) still protects the bare mirror root", async () => {
  const locations = await freshLocations();
  const mirrorKey = pluginMirrorKey(MIRROR_URL);
  await seedState(locations, {
    gp: makeRecord(locations, { key: mirrorKey, subdir: "packages/gp" }),
  });
  await seedCloneDirs(locations, [mirrorKey]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  // First-path-segment derivation yields the bare mirror root, not the subdir.
  assert.deepEqual(await listCloneKeys(locations), [mirrorKey]);
});

void test("MIRR-06: an old-design record still referencing its per-sha clone protects that per-sha dir (coexistence, not yet re-anchored)", async () => {
  const locations = await freshLocations();
  const mirrorKey = pluginMirrorKey(MIRROR_URL);
  const perShaKey = `${mirrorKey}-${SHA_A.slice(0, 12)}`;
  // The record has NOT been re-anchored: it still points at the per-sha clone.
  await seedState(locations, {
    gp: makeRecord(locations, { key: perShaKey }),
  });
  await seedCloneDirs(locations, [perShaKey]);

  const leaks = await garbageCollectPluginClones(locations);

  assert.deepEqual(leaks, []);
  // The still-referenced per-sha clone survives (coexistence).
  assert.deepEqual(await listCloneKeys(locations), [perShaKey]);
});

void test("a per-dir rm failure is swallowed -- GC never throws", async () => {
  const locations = await freshLocations();
  await seedState(locations, {});
  await seedCloneDirs(locations, ["keyLocked"]);

  // Chmod the clone dir's parent read-only (0o500) so the child rm fails with
  // EACCES on platforms that honor the bit. The contract under test is
  // unconditional: GC NEVER throws -- it either records the rm failure as a
  // leak string or (where the permission bit is ignored, e.g. running as
  // root) sweeps clean.
  const keyDir = path.join(locations.pluginClonesDir, "keyLocked");
  const { chmod } = await import("node:fs/promises");
  await chmod(locations.pluginClonesDir, 0o500);
  try {
    const leaks = await garbageCollectPluginClones(locations);
    // On systems where root ignores the read-only bit, rm may succeed and the
    // leak array is empty; accept either the swallow (leak recorded) or the
    // clean sweep, but NEVER a throw.
    assert.ok(Array.isArray(leaks));
    if (leaks.length > 0) {
      assert.match(leaks[0] ?? "", /keyLocked/);
    }
  } finally {
    await chmod(locations.pluginClonesDir, 0o700);
    await rm(keyDir, { recursive: true, force: true });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// FTCH-05 -- a fetched-but-uninstalled clone is derive-not-persist state: no
// install record references it, so GC sweeps it, and the entry's next probe
// self-heals to `remote` (the cold-source classification). No fetch registry
// exists; nothing persists the fetch, so there is no code change to make GC
// aware of it -- the existing live-key derivation already excludes it.
// ───────────────────────────────────────────────────────────────────────────

type ManifestEntry = MarketplaceManifest["plugins"][number];

async function dirExists(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

void test("FTCH-05: a fetched-but-uninstalled clone is swept and the entry self-heals to `remote`", async () => {
  const locations = await freshLocations();
  // A fetch materializes the URL-keyed mirror WITHOUT writing a state record --
  // fetch never installs. Use a canonical url (no `.git` suffix) so the mirror
  // key matches the parse-time canonical url the presence probe hashes over.
  const cloneUrl = "https://example.com/fetched-plugin";
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "fetched-plugin" }),
  );
  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDir, filepath: ".claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });

  // State carries no record for this clone: it was fetched, never installed.
  await seedState(locations, {});

  const entry: ManifestEntry = { name: "fetched-plugin", source: cloneUrl };

  // (a) the fetched clone is materialized and the warm entry classifies away
  // from `remote` before GC (it is `available` -- the tree is installable).
  assert.equal(await dirExists(mirrorDir), true);
  assert.equal(await probeManifestEntry(entry, "/nonexistent/mp/root", locations), "available");

  const leaks = await garbageCollectPluginClones(locations);

  // (b) GC sweeps the unreferenced clone dir.
  assert.deepEqual(leaks, []);
  assert.equal(await dirExists(mirrorDir), false);

  // (c) the next probe self-heals to `remote` -- the cold-source classification,
  // derived fresh with no persisted fetch state.
  assert.equal(await probeManifestEntry(entry, "/nonexistent/mp/root", locations), "remote");
});
