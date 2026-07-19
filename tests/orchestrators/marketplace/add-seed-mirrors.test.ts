// tests/orchestrators/marketplace/add-seed-mirrors.test.ts
//
// SEED-01..06: end-to-end acceptance for same-repo plugin mirror seeding driven
// through `marketplace add`. A marketplace that declares a git-source plugin
// whose canonical clone URL is the repository the marketplace itself lives in
// seeds that plugin's mirror from the local checkout at add time, network-free,
// so the plugin renders non-`(remote)` right after add (SEED-01 Case A url/github,
// SEED-02 Case B path). A different-repo source is unaffected (SEED-03); a pinned
// source seeds only when the pin is reachable (SEED-04); the seeded mirror origin
// is the real remote URL (SEED-05); the seeded dir is a standard-key cache dir
// swept by normal GC with no special-casing (SEED-06).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { addMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { garbageCollectPluginClones } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts";
import { probeManifestEntry } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const REPO_URL = "https://example.com/repo";
const OTHER_URL = "https://other.example.com/different";
const PIN_40 = "1234567890abcdef1234567890abcdef12345678";

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI } {
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: { notify: (): void => {} },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi };
}

async function withTmpScope<T>(
  fn: (env: { cwd: string; locations: ScopedLocations }) => Promise<T>,
): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-seed-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

/**
 * Build a real on-disk marketplace checkout carrying a `.git` (HEAD + committed
 * ref so the presence probe can read HEAD; origin remote in `.git/config`). Used
 * both as the git-mock `fixtureSourceDir` (Case A: the mock clone copies it into
 * staging) and as an on-disk path-source root (Case B).
 */
async function buildCheckout(opts: { originUrl?: string; plugins: unknown[] }): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "seed-fixture-"));
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

function gitSubdirEntry(url: string, extra?: Record<string, unknown>): unknown {
  return { name: "foo", source: { source: "git-subdir", url, path: "plugins/foo", ...extra } };
}

async function firstEntry(
  locations: ScopedLocations,
): Promise<{ entry: unknown; marketplaceRoot: string }> {
  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces["mp"];
  assert.ok(mp, "the marketplace must be recorded under its manifest name");
  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  return { entry: manifest.plugins[0], marketplaceRoot: mp.marketplaceRoot };
}

void test("SEED-01 Case A: a url marketplace seeds its same-repo plugin, non-`(remote)`, one clone total", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps({ fixtureSourceDir: fixture });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    // Zero extra network for the plugin: the ONLY clone is the marketplace.
    assert.equal(state.cloneCalls.length, 1, "only the marketplace clone -- no plugin clone");

    const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    assert.ok(await pathExists(dest), "the plugin mirror is seeded from the marketplace checkout");

    const { entry, marketplaceRoot } = await firstEntry(locations);
    const status = await probeManifestEntry(
      entry as Parameters<typeof probeManifestEntry>[0],
      marketplaceRoot,
      locations,
    );
    assert.notEqual(status, "remote", "the seeded plugin no longer renders (remote)");
  });
});

void test("SEED-02 Case B: a path marketplace seeds a matching plugin with NO network op (NFR-5)", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const checkout = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const { ctx, pi } = makeCtx();
    const { gitOps, state } = makeMockGitOps();

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: checkout,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    // NFR-5: a path-source add (plus its seeding) touches zero network surface.
    assert.equal(state.cloneCalls.length, 0, "path add clones nothing");
    assert.equal(state.fetchCalls.length, 0, "path add fetches nothing");
    assert.equal(state.resolveRemoteRefCalls.length, 0, "path add resolves no remote refs");

    const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    assert.ok(await pathExists(dest), "origin read fs-only seeds the matching plugin");

    const { entry, marketplaceRoot } = await firstEntry(locations);
    const status = await probeManifestEntry(
      entry as Parameters<typeof probeManifestEntry>[0],
      marketplaceRoot,
      locations,
    );
    assert.notEqual(status, "remote", "the seeded plugin no longer renders (remote)");
  });
});

void test("SEED-03: a different-repo git plugin source stays `(remote)` and is not seeded", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(OTHER_URL)],
    });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixture });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    const otherDest = await locations.pluginCloneDir(pluginMirrorKey(OTHER_URL));
    assert.equal(await pathExists(otherDest), false, "a different-repo source is not seeded");

    const { entry, marketplaceRoot } = await firstEntry(locations);
    const status = await probeManifestEntry(
      entry as Parameters<typeof probeManifestEntry>[0],
      marketplaceRoot,
      locations,
    );
    assert.equal(status, "remote", "a different-repo source keeps its (remote) status");
  });
});

void test("SEED-04: a reachable pin seeds the per-sha clone dir; an unreachable pin does not", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL, { sha: PIN_40 })],
    });
    const { ctx, pi } = makeCtx();
    // Reachable: the mock checkout succeeds for a 40-hex ref.
    const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixture });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    const dest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
    assert.ok(await pathExists(dest), "a reachable pin seeds the per-sha clone dir");
  });

  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL, { sha: PIN_40 })],
    });
    const { ctx, pi } = makeCtx();
    const notFetched = new Error("commit not fetched");
    notFetched.name = "CommitNotFetchedError";
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixture,
      checkoutThrows: notFetched,
    });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    const dest = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
    assert.equal(
      await pathExists(dest),
      false,
      "an unreachable pin falls back to the network path",
    );
  });
});

void test("SEED-05: the seeded mirror's origin remote is the real remote URL", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixture });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    const origin = (await git.getConfig({ fs, dir: dest, path: "remote.origin.url" })) as
      string | undefined;
    assert.equal(
      origin,
      REPO_URL,
      "a later mirror refresh targets the network, not the local path",
    );
  });
});

void test("SEED-06: a seeded mirror is a standard-key cache dir swept by normal GC with no special-casing", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    const fixture = await buildCheckout({
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixture });

    await addMarketplace({
      ctx,
      pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps,
      credentialOps: makeMockCredentialOps().credOps,
    });

    const dest = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    assert.ok(await pathExists(dest), "the mirror is seeded before GC");

    // No installed plugin record references the mirror, so the existing live-key
    // derivation treats it as an ordinary unreferenced cache dir and sweeps it --
    // no special-casing, no change to clone-gc.ts.
    await garbageCollectPluginClones(locations);
    assert.equal(await pathExists(dest), false, "normal GC sweeps the unreferenced seeded mirror");
  });
});
