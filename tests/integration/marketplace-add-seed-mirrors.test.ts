import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";
import { mock, verify, when } from "strong-mock";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { garbageCollectPluginClones } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts";
import {
  probeManifestEntry,
  type ManifestEntry,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const OTHER_URL = "https://other.example.com/different";
const PIN_40 = "1234567890abcdef1234567890abcdef12345678";
const REPO_URL = "https://example.com/repo";

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface NotificationBoundary {
  readonly ctx: ExtensionContext;
  readonly notifications: Array<{
    readonly message: string;
    readonly severity?: NotificationSeverity;
  }>;
  readonly pi: ExtensionAPI;
  readonly ui: NotificationUi;
}

interface GitOpsAdapterOptions {
  readonly checkoutThrows?: Error;
  readonly fixtureSourceDir?: string;
}

function notificationBoundary(name: string): NotificationBoundary {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: `${name} context` });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: `${name} extension API` });
  const ui = mock<NotificationUi>({ exactParams: true, name: `${name} UI` });
  const notifications: NotificationBoundary["notifications"] = [];
  when(() => ctx.ui).thenReturn(ui);
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
  when(() => ui.notify).thenReturn((message, severity) => {
    notifications.push({ message, ...(severity === undefined ? {} : { severity }) });
  });
  return { ctx, notifications, pi, ui };
}

function credentialOps() {
  return createCredentialOpsFake({ boundary: "memory" });
}

function gitOpsAdapter(initial: GitOpsAdapterOptions = {}) {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [REPO_URL, `${REPO_URL}.git`],
    ...(initial.fixtureSourceDir === undefined
      ? {}
      : { cloneFixture: { boundary: "local" as const, sourceDir: initial.fixtureSourceDir } }),
    ...(initial.checkoutThrows === undefined ? {} : { checkoutError: initial.checkoutThrows }),
  });
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

async function buildCheckout(
  cwd: string,
  options: { readonly originUrl?: string; readonly plugins: readonly ManifestEntry[] },
): Promise<string> {
  const root = await mkdtemp(path.join(cwd, "seed-fixture-"));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "mp", plugins: options.plugins }),
  );
  await mkdir(path.join(root, "plugins", "foo", ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, "plugins", "foo", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "foo" }),
  );
  await git.init({ fs, dir: root, defaultBranch: "main" });
  if (options.originUrl !== undefined) {
    await git.addRemote({ fs, dir: root, remote: "origin", url: options.originUrl });
  }

  await git.add({ fs, dir: root, filepath: ".claude-plugin/marketplace.json" });
  await git.add({ fs, dir: root, filepath: "plugins/foo/.claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: root,
    message: "init",
    author: { name: "test author", email: "test@example.com" },
  });
  return root;
}

function gitSubdirEntry(url: string, sha?: string): ManifestEntry {
  return {
    name: "foo",
    source: {
      source: "git-subdir",
      url,
      path: "plugins/foo",
      ...(sha === undefined ? {} : { sha }),
    },
  };
}

async function firstEntry(
  locations: ScopedLocations,
): Promise<{ readonly entry: ManifestEntry; readonly marketplaceRoot: string }> {
  const state = await loadState(locations.extensionRoot);
  const marketplace = state.marketplaces.mp;
  assert.ok(marketplace);
  const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
  const entry = manifest.plugins[0];
  assert.ok(entry);
  return { entry, marketplaceRoot: marketplace.marketplaceRoot };
}

test("seeds a same-repository URL plugin mirror with one marketplace clone", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixture = await buildCheckout(cwd, {
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const boundary = notificationBoundary("URL seed");
    const credentials = credentialOps();
    const gitBoundary = gitOpsAdapter({ fixtureSourceDir: fixture });

    // act
    await addMarketplace({
      ctx: boundary.ctx,
      pi: boundary.pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps: gitBoundary.gitOps,
      credentialOps: credentials.credentialOps,
    });

    // assert
    const mirror = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    const { entry, marketplaceRoot } = await firstEntry(locations);
    assert.deepStrictEqual(
      gitBoundary.state.calls.clone.map(({ url }) => url),
      [`${REPO_URL}.git`],
    );
    assert.strictEqual(await pathExists(mirror), true);
    assert.strictEqual(await probeManifestEntry(entry, marketplaceRoot, locations), "available");
    assert.deepStrictEqual(boundary.notifications, [{ message: "● mp [project] (added)" }]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("seeds a matching path marketplace without network operations", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const checkout = await buildCheckout(cwd, {
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const boundary = notificationBoundary("path seed");
    const credentials = credentialOps();
    const gitBoundary = gitOpsAdapter();

    // act
    await addMarketplace({
      ctx: boundary.ctx,
      pi: boundary.pi,
      scope: "project",
      cwd,
      rawSource: checkout,
      gitOps: gitBoundary.gitOps,
      credentialOps: credentials.credentialOps,
    });

    // assert
    const mirror = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    const { entry, marketplaceRoot } = await firstEntry(locations);
    assert.deepStrictEqual(gitBoundary.state.calls, {
      checkout: [],
      clone: [],
      currentBranch: [],
      fetch: [],
      forceUpdateRef: [],
      resolveRef: [],
      resolveRemoteRef: [],
    });
    assert.strictEqual(await pathExists(mirror), true);
    assert.strictEqual(await probeManifestEntry(entry, marketplaceRoot, locations), "available");
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("leaves a different-repository plugin remote and unseeded", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixture = await buildCheckout(cwd, {
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(OTHER_URL)],
    });
    const boundary = notificationBoundary("different repository");
    const credentials = credentialOps();
    const gitBoundary = gitOpsAdapter({ fixtureSourceDir: fixture });

    // act
    await addMarketplace({
      ctx: boundary.ctx,
      pi: boundary.pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps: gitBoundary.gitOps,
      credentialOps: credentials.credentialOps,
    });

    // assert
    const otherMirror = await locations.pluginCloneDir(pluginMirrorKey(OTHER_URL));
    const { entry, marketplaceRoot } = await firstEntry(locations);
    assert.strictEqual(await pathExists(otherMirror), false);
    assert.strictEqual(await probeManifestEntry(entry, marketplaceRoot, locations), "remote");
    assert.deepStrictEqual(
      gitBoundary.state.calls.clone.map(({ url }) => url),
      [`${REPO_URL}.git`],
    );
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("seeds a reachable pin and leaves an unreachable pin unseeded", async () => {
  // arrange
  const unreachable = new Error("commit not fetched");
  unreachable.name = "CommitNotFetchedError";

  // act
  const observations = await Promise.all(
    [undefined, unreachable].map((checkoutThrows) =>
      withTmpScope(async ({ cwd, locations }) => {
        const fixture = await buildCheckout(cwd, {
          originUrl: REPO_URL,
          plugins: [gitSubdirEntry(REPO_URL, PIN_40)],
        });
        const boundary = notificationBoundary(
          checkoutThrows === undefined ? "reachable" : "unreachable",
        );
        const credentials = credentialOps();
        const gitBoundary = gitOpsAdapter({
          fixtureSourceDir: fixture,
          ...(checkoutThrows === undefined ? {} : { checkoutThrows }),
        });
        await addMarketplace({
          ctx: boundary.ctx,
          pi: boundary.pi,
          scope: "project",
          cwd,
          rawSource: REPO_URL,
          gitOps: gitBoundary.gitOps,
          credentialOps: credentials.credentialOps,
        });
        const clone = await locations.pluginCloneDir(pluginCloneKey(REPO_URL, PIN_40));
        const exists = await pathExists(clone);
        verify(boundary.ctx);
        verify(boundary.pi);
        verify(boundary.ui);
        return { exists, gitCalls: gitBoundary.state.calls, credentialCalls: credentials.calls };
      }),
    ),
  );

  // assert
  assert.deepStrictEqual(
    observations.map(({ exists }) => exists),
    [true, false],
  );
  assert.deepStrictEqual(
    observations.map(({ gitCalls }) => gitCalls.clone.map(({ url }) => url)),
    [[`${REPO_URL}.git`], [`${REPO_URL}.git`]],
  );
  assert.deepStrictEqual(
    observations.map(({ credentialCalls }) => credentialCalls),
    [
      { approve: [], fill: [], reject: [] },
      { approve: [], fill: [], reject: [] },
    ],
  );
});

test("preserves the real remote URL on the seeded mirror", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixture = await buildCheckout(cwd, {
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const boundary = notificationBoundary("origin remote");
    const credentials = credentialOps();
    const gitBoundary = gitOpsAdapter({ fixtureSourceDir: fixture });

    // act
    await addMarketplace({
      ctx: boundary.ctx,
      pi: boundary.pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps: gitBoundary.gitOps,
      credentialOps: credentials.credentialOps,
    });

    // assert
    const mirror = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    assert.strictEqual(
      await git.getConfig({ fs, dir: mirror, path: "remote.origin.url" }),
      REPO_URL,
    );
    assert.deepStrictEqual(
      gitBoundary.state.calls.clone.map(({ url }) => url),
      [`${REPO_URL}.git`],
    );
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});

test("lets normal clone garbage collection sweep an unreferenced seeded mirror", async () => {
  await withTmpScope(async ({ cwd, locations }) => {
    // arrange
    const fixture = await buildCheckout(cwd, {
      originUrl: REPO_URL,
      plugins: [gitSubdirEntry(REPO_URL)],
    });
    const boundary = notificationBoundary("garbage collection");
    const credentials = credentialOps();
    const gitBoundary = gitOpsAdapter({ fixtureSourceDir: fixture });
    await addMarketplace({
      ctx: boundary.ctx,
      pi: boundary.pi,
      scope: "project",
      cwd,
      rawSource: REPO_URL,
      gitOps: gitBoundary.gitOps,
      credentialOps: credentials.credentialOps,
    });
    const mirror = await locations.pluginCloneDir(pluginMirrorKey(REPO_URL));
    assert.strictEqual(await pathExists(mirror), true);

    // act
    await garbageCollectPluginClones(locations);

    // assert
    assert.strictEqual(await pathExists(mirror), false);
    assert.deepStrictEqual(
      gitBoundary.state.calls.clone.map(({ url }) => url),
      [`${REPO_URL}.git`],
    );
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verify(boundary.ctx);
    verify(boundary.pi);
    verify(boundary.ui);
  });
});
