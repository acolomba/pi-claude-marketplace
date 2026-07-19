// tests/orchestrators/plugin/clone-cache-seed.test.ts
//
// SEED-01..06 / D-SEED-01..03: unit coverage for `seedSameRepoPluginMirrors`.
// The seam copies a same-repo git plugin source's clone bytes from the local
// marketplace checkout into the plugin-clone cache at `marketplace add` time,
// network-free, so the plugin stops rendering `(remote)` right after add.
//
// Case A (github/url marketplace): the marketplace source record canonicalizes
// its own URL. Case B (path marketplace): the URL is read fs-only from the
// checkout's `.git/config` origin. A plugin whose canonical URL differs is left
// untouched (SEED-03); a pinned source seeds only when its sha is reachable in
// the copied history (SEED-04); the seeded mirror's origin is the real remote
// URL, never the local path (SEED-05).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { seedSameRepoPluginMirrors } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { readMirrorHeadSha } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const REPO_URL = "https://example.com/repo";
const OTHER_URL = "https://other.example.com/different";
const PIN_40 = "1234567890abcdef1234567890abcdef12345678";

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-seed-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

/**
 * Count the leftover entries under `<extensionRoot>/sources-staging/`. A seed
 * that cleaned its staging dir (warm-cache win or rethrow-and-swallow) leaves
 * zero -- the parent dir may exist but must be empty.
 */
async function stagingEntryCount(locations: ScopedLocations): Promise<number> {
  try {
    return (await readdir(path.join(locations.extensionRoot, "sources-staging"))).length;
  } catch {
    return 0;
  }
}

/**
 * Build a real on-disk marketplace checkout with a `.git` (HEAD + committed ref
 * so the presence probe can read HEAD) and, when `originUrl` is set, an origin
 * remote written into `.git/config`. `plugins` are the manifest plugin entries.
 */
async function buildMarketplaceCheckout(opts: {
  originUrl?: string;
  plugins: unknown[];
}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "seed-mp-"));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "mp", plugins: opts.plugins }),
  );
  await mkdir(path.join(root, "plugins", "foo", ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, "plugins", "foo", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "foo" }),
  );

  await git.init({ fs, dir: root, defaultBranch: "main" });
  if (opts.originUrl !== undefined) {
    await git.addRemote({ fs, dir: root, remote: "origin", url: opts.originUrl });
  }

  await git.add({ fs, dir: root, filepath: ".claude-plugin/marketplace.json" });
  await git.add({ fs, dir: root, filepath: "plugins/foo/.claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: root,
    message: "init",
    author: { name: "t", email: "t@example.com" },
  });
  return root;
}

async function saveMarketplace(
  locations: ScopedLocations,
  mpRoot: string,
  source: unknown,
): Promise<void> {
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source,
        addedFromCwd: "/tmp",
        manifestPath: path.join(mpRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: mpRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

function gitSubdirEntry(extra?: Record<string, unknown>): unknown {
  return {
    name: "foo",
    source: { source: "git-subdir", url: REPO_URL, path: "plugins/foo", ...extra },
  };
}

void test("SEED-01 Case A: a url-marketplace same-repo git-subdir plugin is seeded from the checkout", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry()],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.ok(await pathExists(dest), "the unpinned mirror dir must exist after seeding");
  // The presence probe reads `.git/HEAD` -- it must resolve to a sha.
  const head = await readMirrorHeadSha(dest);
  assert.match(head, /^[0-9a-f]{40}$/, "the seeded mirror HEAD must resolve to a sha");
});

void test("SEED-05: the seeded mirror's origin remote is the real remote URL, not the local checkout path", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry()],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  const origin = (await git.getConfig({ fs, dir: dest, path: "remote.origin.url" })) as
    string | undefined;
  assert.equal(origin, REPO_URL, "origin must be the remote URL preserved by the tree copy");
  assert.notEqual(origin, mpRoot, "origin must never be the local checkout path");
});

void test("SEED-02 Case B: a path-marketplace derives its URL from the checkout's origin and seeds a matching plugin", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry()],
  });
  // The stored source is the local PATH; the URL is read fs-only from origin.
  await saveMarketplace(locations, mpRoot, mpRoot);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.ok(await pathExists(dest), "a path-marketplace with matching origin must seed the plugin");
});

void test("SEED-02 Case B: a path-marketplace whose checkout has no origin remote seeds nothing", async () => {
  const locations = await freshLocations();
  // No originUrl -> `.git/config` carries no `[remote "origin"]` url.
  const mpRoot = await buildMarketplaceCheckout({ plugins: [gitSubdirEntry()] });
  await saveMarketplace(locations, mpRoot, mpRoot);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.equal(await pathExists(dest), false, "no origin -> nothing to match -> no seed");
});

void test("SEED-02 Case B: a path-marketplace on a non-git directory seeds nothing", async () => {
  const locations = await freshLocations();
  // A plain directory with a manifest but NO `.git` at all.
  const mpRoot = await mkdtemp(path.join(tmpdir(), "seed-nogit-"));
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mpRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "mp", plugins: [gitSubdirEntry()] }),
  );
  await saveMarketplace(locations, mpRoot, mpRoot);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.equal(await pathExists(dest), false, "a non-git path directory cannot seed");
});

void test("SEED-03: a different-repo git plugin source is NOT seeded", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [{ name: "other", source: { source: "git-subdir", url: OTHER_URL, path: "p" } }],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(OTHER_URL));
  assert.equal(await pathExists(dest), false, "a different-repo source keeps its (remote) status");
});

void test("SEED-01: an already-present mirror is left untouched (warm short-circuit, idempotent)", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry()],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  // Pre-create the mirror dir with a sentinel and NO marketplace.json.
  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  await mkdir(dest, { recursive: true });
  await writeFile(path.join(dest, "SENTINEL"), "pre-existing");

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  assert.ok(await pathExists(path.join(dest, "SENTINEL")), "sentinel must survive (no re-copy)");
  assert.equal(
    await pathExists(path.join(dest, ".claude-plugin", "marketplace.json")),
    false,
    "the warm dir must NOT be overwritten by a fresh copy",
  );
});

void test("SEED-04: a pinned source whose sha is reachable is seeded at the per-sha clone dir", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry({ sha: PIN_40 })],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  // The mock checkout succeeds for a 40-hex ref -> the pin is reachable.
  const { gitOps, state } = makeMockGitOps();
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp", gitOps });

  const dest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
  assert.ok(await pathExists(dest), "a reachable pin seeds the per-sha clone dir");
  assert.equal(state.checkoutCalls.length, 1, "the pin is checked out against the copied history");
  assert.equal(state.checkoutCalls[0]!.ref, PIN_40, "checkout targets the pinned sha");
});

void test("SEED-04: a pinned source whose sha is unreachable is NOT seeded and never throws", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry({ sha: PIN_40 })],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  const notFetched = new Error("commit not fetched");
  notFetched.name = "CommitNotFetchedError";
  const { gitOps } = makeMockGitOps({ checkoutThrows: notFetched });

  // Must not throw despite the unreachable pin.
  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp", gitOps });

  const dest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
  assert.equal(await pathExists(dest), false, "an unreachable pin falls back to the network path");
});

void test("SEED-01: an absent marketplace name is a no-op (does not throw)", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry()],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  await assert.doesNotReject(
    seedSameRepoPluginMirrors({ locations, marketplaceName: "does-not-exist" }),
  );
});

void test("SEED-02 Case B: a path-marketplace whose origin is not a git source seeds nothing", async () => {
  const locations = await freshLocations();
  // The checkout HAS an origin remote, but its URL is a local filesystem path
  // (not an https git source), so deriveMarketplaceUrl parses it to a `path`
  // kind and falls through -- no same-repo URL to match, nothing to seed.
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: "/some/local/checkout",
    plugins: [gitSubdirEntry()],
  });
  await saveMarketplace(locations, mpRoot, mpRoot);

  await seedSameRepoPluginMirrors({ locations, marketplaceName: "mp" });

  const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.equal(await pathExists(dest), false, "a non-git-canonical origin seeds nothing");
});

void test("SEED-04: a concurrent seed winning the rename race is a warm-cache win, not an overwrite", async () => {
  const locations = await freshLocations();
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [gitSubdirEntry({ sha: PIN_40 })],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  const dest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));

  // Simulate a concurrent seed/materialize that populates dest AFTER the warm
  // short-circuit passed but BEFORE our rename fires: the rename then fails
  // ENOTEMPTY and the seed treats dest as a byte-equivalent warm-cache win.
  const base = makeMockGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(opts): Promise<void> {
      await base.gitOps.checkout(opts);
      await mkdir(dest, { recursive: true });
      await writeFile(path.join(dest, "WINNER"), "concurrent");
    },
  };

  await assert.doesNotReject(
    seedSameRepoPluginMirrors({ locations, marketplaceName: "mp", gitOps }),
  );

  assert.ok(
    await pathExists(path.join(dest, "WINNER")),
    "the concurrent winner's tree survives -- no overwrite by the losing seed",
  );
  assert.equal(await stagingEntryCount(locations), 0, "the losing seed's staging dir is cleaned");
});

void test("SEED-04: a non-EEXIST rename failure is swallowed per-entry; other same-repo entries still seed", async () => {
  const locations = await freshLocations();
  // Two same-repo entries: a pinned one whose rename fails ENOENT (below) and an
  // unpinned one that seeds normally -- proving per-entry isolation.
  const mpRoot = await buildMarketplaceCheckout({
    originUrl: REPO_URL,
    plugins: [
      { name: "pinned", source: { source: "git-subdir", url: REPO_URL, path: "p", sha: PIN_40 } },
      gitSubdirEntry(),
    ],
  });
  await saveMarketplace(locations, mpRoot, REPO_URL);

  // The pinned entry's checkout removes the staging tree, so its later
  // rename(staging -> dest) fails ENOENT -- NOT EEXIST/ENOTEMPTY -- and rethrows
  // from seedOnePluginMirror into the per-entry swallow in the sweep.
  const base = makeMockGitOps();
  const gitOps: GitOps = {
    ...base.gitOps,
    async checkout(opts): Promise<void> {
      await base.gitOps.checkout(opts);
      await rm(opts.dir, { recursive: true, force: true });
    },
  };

  await assert.doesNotReject(
    seedSameRepoPluginMirrors({ locations, marketplaceName: "mp", gitOps }),
  );

  const pinnedDest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
  assert.equal(await pathExists(pinnedDest), false, "the ENOENT-failed pinned entry is not seeded");

  const mirrorDest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
  assert.ok(
    await pathExists(mirrorDest),
    "the unpinned entry still seeds -- a per-entry failure does not abort the sweep",
  );
  assert.equal(await stagingEntryCount(locations), 0, "the failed entry's staging dir is cleaned");
});
