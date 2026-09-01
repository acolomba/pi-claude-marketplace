import assert from "node:assert/strict";
import fs, {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { fetchPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { FetchCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { GitCredentials } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { PathLike } from "node:fs";

type ManifestEntry = MarketplaceManifest["plugins"][number];
type MarketplaceRecord = ExtensionState["marketplaces"][string];
type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface CapturedNotification {
  readonly message: string;
  readonly severity?: NotificationSeverity;
}

interface NotificationBoundary {
  readonly ctx: ExtensionContext;
  readonly notifications: CapturedNotification[];
  readonly pi: ExtensionAPI;
  readonly ui: NotificationUi;
}

interface TreeEntry {
  readonly contents?: string;
  readonly path: string;
  readonly type: "directory" | "file";
}

interface GitBoundaryOptions {
  readonly allowedRemoteUrls: readonly string[];
  readonly cloneError?: Error;
  readonly fetchError?: Error;
  readonly fixtureSourceDir?: string;
  readonly head?: string;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteHead?: string;
  readonly remoteRefs?: Readonly<Record<string, string>>;
  readonly writeHead?: boolean;
}

interface GitBoundary {
  readonly gitOps: GitOps;
  readonly schedule: string[];
}

interface CacheBoundary {
  readonly calls: string[];
  readonly seam: FetchCloneCacheSeam;
}

function notificationBoundary(name: string, expectedCalls = 1): NotificationBoundary {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: `${name} context` });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: `${name} extension API` });
  const ui = mock<NotificationUi>({ exactParams: true, name: `${name} UI` });
  const notifications: CapturedNotification[] = [];
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(expectedCalls);
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push({ message, ...(severity === undefined ? {} : { severity }) });
    })
    .times(expectedCalls);
  return { ctx, notifications, pi, ui };
}

function verifyNotifications(boundary: NotificationBoundary): void {
  verify(boundary.ctx);
  verify(boundary.pi);
  verify(boundary.ui);
}

function requiredAuth(auth: GitAuthBundle | undefined): GitAuthBundle {
  if (auth === undefined) {
    assert.fail("expected git authentication callbacks");
  }

  return auth;
}

function gitBoundary(options: GitBoundaryOptions): GitBoundary {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: options.allowedRemoteUrls,
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
    ...(options.fetchError === undefined ? {} : { fetchError: options.fetchError }),
    ...(options.fixtureSourceDir === undefined
      ? {}
      : { cloneFixture: { boundary: "local", sourceDir: options.fixtureSourceDir } }),
    ...(options.head === undefined ? {} : { initialOid: options.head }),
    ...(options.localRefs === undefined ? {} : { localRefs: options.localRefs }),
    ...(options.remoteHead === undefined ? {} : { remoteHead: options.remoteHead }),
    ...(options.remoteRefs === undefined ? {} : { remoteRefs: options.remoteRefs }),
  });
  const schedule: string[] = [];
  const gitOps: GitOps = {
    ...git.gitOps,
    async checkout(options) {
      schedule.push(`checkout ${options.ref}`);
      await git.gitOps.checkout(options);
    },
    async clone(cloneOptions) {
      schedule.push(
        `clone ${cloneOptions.url} ref=${cloneOptions.ref ?? "-"} single=${String(cloneOptions.singleBranch ?? false)} auth=${cloneOptions.auth?.host ?? "-"}`,
      );
      const { auth: _auth, ...authlessOptions } = cloneOptions;
      await git.gitOps.clone(authlessOptions);
      if (options.writeHead === true) {
        await mkdir(path.join(cloneOptions.dir, ".git"), { recursive: true });
        await writeFile(path.join(cloneOptions.dir, ".git", "HEAD"), `${git.state.head}\n`);
      }
    },
    async currentBranch(options) {
      schedule.push("current-branch");
      return git.gitOps.currentBranch(options);
    },
    async fetch(options) {
      schedule.push(
        `fetch remote=${options.remote ?? "-"} ref=${options.ref ?? "-"} auth=${options.auth?.host ?? "-"}`,
      );
      const { auth: _auth, ...authlessOptions } = options;
      await git.gitOps.fetch(authlessOptions);
    },
    async forceUpdateRef(options) {
      schedule.push(`force-update ${options.ref}=${options.value}`);
      await git.gitOps.forceUpdateRef(options);
    },
    async resolveRef(options) {
      schedule.push(`resolve-local ${options.ref}`);
      try {
        return await git.gitOps.resolveRef(options);
      } catch (error) {
        const oid =
          git.state.remoteRefs[options.ref] ??
          (options.ref === "refs/remotes/origin/HEAD"
            ? git.state.remoteRefs["refs/remotes/origin/main"]
            : undefined);
        if (oid !== undefined) {
          return oid;
        }

        throw error;
      }
    },
    async resolveRemoteRef(options) {
      schedule.push(
        `resolve-remote ${options.url} ref=${options.ref ?? "-"} auth=${options.auth?.host ?? "-"}`,
      );
      const { auth: _auth, ...authlessOptions } = options;
      return git.gitOps.resolveRemoteRef(authlessOptions);
    },
  };
  return { gitOps, schedule };
}

function sourceIdentity(source: GitBackedSource): string {
  if (source.kind === "github") {
    return `${source.owner}/${source.repo}`;
  }

  return source.url;
}

function cacheBoundary(gitOps: GitOps): CacheBoundary {
  const calls: string[] = [];
  const seam: FetchCloneCacheSeam = {
    async materializeOrRefreshPluginMirror(args) {
      calls.push(`mirror ${args.cloneUrl} ref=${args.ref ?? "-"} auth=${args.auth?.host ?? "-"}`);
      return materializeOrRefreshPluginMirror({ ...args, gitOps });
    },
    async materializePluginClone(args) {
      calls.push(
        `clone ${args.cloneUrl} pin=${args.pin} ref=${args.ref ?? "-"} auth=${args.auth?.host ?? "-"}`,
      );
      return materializePluginClone({ ...args, gitOps });
    },
    async resolvePluginPin(args) {
      calls.push(
        `resolve ${args.source.kind} ${sourceIdentity(args.source)} sha=${args.source.sha ?? "-"} ref=${args.source.ref ?? "-"}`,
      );
      return resolvePluginPin({ ...args, gitOps });
    },
  };
  return { calls, seam };
}

async function writePluginTree(directory: string, name: string, version: string): Promise<void> {
  await mkdir(path.join(directory, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(directory, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version }),
  );
  await mkdir(path.join(directory, "skills", "greet"), { recursive: true });
  await writeFile(
    path.join(directory, "skills", "greet", "SKILL.md"),
    `---\nname: greet\n---\n\nHello ${version}.\n`,
  );
}

async function marketplaceRecord(options: {
  readonly cwd: string;
  readonly entries: readonly ManifestEntry[];
  readonly name: string;
  readonly scope: Scope;
}): Promise<MarketplaceRecord> {
  const marketplaceRoot = path.join(options.cwd, `${options.scope}-${options.name}-source`);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name: options.name, plugins: options.entries }));
  return {
    addedFromCwd: options.cwd,
    manifestPath,
    marketplaceRoot,
    name: options.name,
    plugins: {},
    scope: options.scope,
    source: pathSource(marketplaceRoot),
  };
}

async function saveMarketplaces(
  cwd: string,
  scope: Scope,
  marketplaces: readonly MarketplaceRecord[],
): Promise<ScopedLocations> {
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(
      marketplaces.map((marketplace) => [marketplace.name, marketplace]),
    ),
  });
  return locations;
}

async function snapshotTree(root: string): Promise<readonly TreeEntry[]> {
  const tree: TreeEntry[] = [];
  try {
    await stat(root);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return tree;
    }

    throw error;
  }

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        tree.push({ path: relativePath, type: "directory" });
        await visit(absolutePath, relativePath);
      } else {
        tree.push({
          contents: await readFile(absolutePath, "utf8"),
          path: relativePath,
          type: "file",
        });
      }
    }
  }

  await visit(root, "");
  return tree;
}

async function stagingEntries(locations: ScopedLocations): Promise<readonly TreeEntry[]> {
  return snapshotTree(path.join(locations.extensionRoot, "sources-staging"));
}

async function withWorkspace<T>(
  run: (workspace: { readonly cwd: string; readonly home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "plugin-fetch-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plugin-fetch-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await run({ cwd, home });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 10 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10 });
  }
}

test("keeps a path source offline through the production defaults", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "path-plugin", source: "./path-plugin" }],
      name: "marketplace",
      scope: "project",
    });
    await writePluginTree(
      path.join(marketplace.marketplaceRoot, "path-plugin"),
      "path-plugin",
      "1.0.0",
    );
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const boundary = notificationBoundary("path default");

    // act
    await fetchPlugins({
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "path-plugin" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ path-plugin (skipped) {up-to-date}" },
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), []);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("keeps a pinned warm URL clone offline and byte-identical", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/plugin";
    const pin = "1111111111111111111111111111111111111111";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "warm", source: { source: "url", url: cloneUrl, sha: pin }, version: "1.0.0" },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const cloneKey = pluginCloneKey(cloneUrl, pin);
    const cloneRoot = await locations.pluginCloneDir(cloneKey);
    await writePluginTree(cloneRoot, "warm", "1.0.0");
    const cacheBefore = await snapshotTree(locations.pluginClonesDir);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const git = gitBoundary({ allowedRemoteUrls: [] });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "unused",
        expires_in: 1,
        interval: 0,
        user_code: "UNUSED",
        verification_uri: "https://example.invalid/device",
      },
      network: "disabled",
    });
    const boundary = notificationBoundary("pinned warm");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ warm v1.0.0 (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    assert.deepStrictEqual(deviceFlow.calls, { pollToken: [], requestCode: [] });
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), cacheBefore);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("materializes a cold pinned URL clone at its recorded SHA", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/plugin";
    const networkUrl = "https://example.com/plugin.git";
    const pin = "2222222222222222222222222222222222222222";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "cold", "2.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          name: "cold",
          source: { source: "url", url: cloneUrl, sha: pin, ref: "v2" },
          version: "2.0.0",
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const git = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("cold pinned URL");
    const cloneKey = pluginCloneKey(cloneUrl, pin);

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "cold" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ cold v2.0.0 (available)" },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${cloneUrl} sha=${pin} ref=v2`,
      `clone ${cloneUrl} pin=${pin} ref=v2 auth=-`,
    ]);
    assert.deepStrictEqual(git.schedule, [
      `clone ${networkUrl} ref=v2 single=true auth=-`,
      `checkout ${pin}`,
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), [
      { path: cloneKey, type: "directory" },
      { path: path.join(cloneKey, ".claude-plugin"), type: "directory" },
      {
        contents: '{"name":"cold","version":"2.0.0"}',
        path: path.join(cloneKey, ".claude-plugin", "plugin.json"),
        type: "file",
      },
      { path: path.join(cloneKey, "skills"), type: "directory" },
      { path: path.join(cloneKey, "skills", "greet"), type: "directory" },
      {
        contents: "---\nname: greet\n---\n\nHello 2.0.0.\n",
        path: path.join(cloneKey, "skills", "greet", "SKILL.md"),
        type: "file",
      },
    ]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    verifyNotifications(boundary);
  });
});

test("refreshes an unpinned warm mirror with its ref and leaves state immutable", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/plugin";
    const networkUrl = "https://example.com/plugin.git";
    const head = "3333333333333333333333333333333333333333";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "moving", source: { source: "url", url: cloneUrl, ref: "main" } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const mirrorKey = pluginMirrorKey(cloneUrl);
    const mirrorRoot = await locations.pluginCloneDir(mirrorKey);
    await writePluginTree(mirrorRoot, "moving", "3.0.0");
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
    await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${head}\n`);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const git = gitBoundary({
      allowedRemoteUrls: [networkUrl],
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/main": head },
    });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("warm mirror");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "moving" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ moving (available)" },
    ]);
    assert.deepStrictEqual(cache.calls, [`mirror ${cloneUrl} ref=main auth=-`]);
    assert.deepStrictEqual(git.schedule, [
      "fetch remote=origin ref=main auth=-",
      "resolve-local refs/remotes/origin/main",
      `force-update refs/heads/main=${head}`,
      "checkout main",
      "resolve-local HEAD",
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("materializes a cold unpinned GitHub mirror through Device Flow once per host", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://github.com/acme/plugin";
    const networkUrl = "https://github.com/acme/plugin.git";
    const head = "4444444444444444444444444444444444444444";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "private", "4.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "private", source: { source: "github", repo: "acme/plugin" }, version: "4.0.0" },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const git = gitBoundary({
      allowedRemoteUrls: [networkUrl],
      fixtureSourceDir: fixture,
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/HEAD": head },
      writeHead: true,
    });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "device-code",
        expires_in: 900,
        interval: 0,
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
      },
      network: "disabled",
      pollResponses: [
        { accessToken: "token", kind: "success", scope: "repo", tokenType: "bearer" },
      ],
    });
    const boundary = notificationBoundary("Device Flow", 2);
    const originalMirror = cache.seam.materializeOrRefreshPluginMirror;
    const seam: FetchCloneCacheSeam = {
      ...cache.seam,
      async materializeOrRefreshPluginMirror(args) {
        const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
        assert.deepStrictEqual(await callbacks.onAuth(networkUrl), {
          password: "token",
          username: "x-access-token",
        });
        return originalMirror(args);
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "private" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "Open https://github.com/login/device and enter: ABCD-1234",
        severity: "info",
      },
      { message: "● marketplace [project]\n  ○ private v4.0.0 (available)" },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [
        {
          credential: { password: "token", username: "x-access-token" },
          host: "github.com",
        },
      ],
      fill: [{ host: "github.com" }],
      reject: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      pollToken: [{ clientId: "Ov23liNcyK08uGdU0mMl", deviceCode: "device-code", intervalSec: 0 }],
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
    });
    assert.deepStrictEqual(cache.calls, [`mirror ${cloneUrl} ref=- auth=github.com`]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("reuses a stored GitHub credential without Device Flow", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://github.com/acme/plugin";
    const pin = "5555555555555555555555555555555555555555";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "stored", source: { source: "github", repo: "acme/plugin", sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const storedCredential: GitCredentials = {
      password: "stored-token",
      username: "x-access-token",
    };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["github.com", storedCredential]],
    });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "unused",
        expires_in: 1,
        interval: 0,
        user_code: "UNUSED",
        verification_uri: "https://example.invalid/device",
      },
      network: "disabled",
    });
    const boundary = notificationBoundary("stored credential");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
        assert.deepStrictEqual(await callbacks.onAuth(`${cloneUrl}.git`), storedCredential);
        return path.join(cwd, "not-written");
      },
      resolvePluginPin(args) {
        return Promise.resolve({ cloneUrl, pin: args.source.sha ?? pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "stored" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ◌ stored (remote)" },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [],
      fill: [{ host: "github.com" }],
      reject: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, { pollToken: [], requestCode: [] });
    verifyNotifications(boundary);
  });
});

test("memoizes one accepted Device Flow result across a same-host sweep", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const pinA = "6666666666666666666666666666666666666666";
    const pinB = "7777777777777777777777777777777777777777";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "zeta", source: { source: "github", repo: "acme/a", sha: pinA } },
        { name: "alpha", source: { source: "github", repo: "acme/b", sha: pinB } },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "device-code",
        expires_in: 900,
        interval: 0,
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
      },
      network: "disabled",
      pollResponses: [
        { accessToken: "token", kind: "success", scope: "repo", tokenType: "bearer" },
      ],
    });
    const boundary = notificationBoundary("memoized Device Flow", 2);
    const authResults: unknown[] = [];
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        authResults.push(await requiredAuth(args.auth).onAuthRequired());
        return path.join(cwd, "not-written");
      },
      resolvePluginPin(args) {
        return Promise.resolve({
          cloneUrl:
            args.source.kind === "github"
              ? `https://github.com/${args.source.owner}/${args.source.repo}`
              : args.source.url,
          pin: args.source.sha ?? "missing",
        });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(authResults, [
      {
        authAttempted: true,
        cred: { password: "token", username: "x-access-token" },
        ok: true,
      },
      {
        authAttempted: true,
        cred: { password: "token", username: "x-access-token" },
        ok: true,
      },
    ]);
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "Open https://github.com/login/device and enter: ABCD-1234",
        severity: "info",
      },
      {
        message:
          "● marketplace [project]\n  ◌ zeta (remote)\n  ◌ alpha (remote)\n\nPlugin fetch: 2 successes",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [
        {
          credential: { password: "token", username: "x-access-token" },
          host: "github.com",
        },
      ],
      fill: [],
      reject: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      pollToken: [{ clientId: "Ov23liNcyK08uGdU0mMl", deviceCode: "device-code", intervalSec: 0 }],
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
    });
    verifyNotifications(boundary);
  });
});

test("preserves marketplace and manifest ordering across both scopes", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const zulu = await marketplaceRecord({
      cwd,
      entries: [
        { name: "zeta", source: "./zeta" },
        { name: "alpha", source: "./alpha" },
      ],
      name: "Zulu",
      scope: "project",
    });
    const sameProject = await marketplaceRecord({
      cwd,
      entries: [{ name: "project-plugin", source: "./project-plugin" }],
      name: "same",
      scope: "project",
    });
    const alpha = await marketplaceRecord({
      cwd,
      entries: [{ name: "user-plugin", source: "./user-plugin" }],
      name: "alpha",
      scope: "user",
    });
    const sameUser = await marketplaceRecord({
      cwd,
      entries: [{ name: "user-same-plugin", source: "./user-same-plugin" }],
      name: "same",
      scope: "user",
    });
    await saveMarketplaces(cwd, "project", [zulu, sameProject]);
    await saveMarketplaces(cwd, "user", [sameUser, alpha]);
    const git = gitBoundary({ allowedRemoteUrls: [] });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("ordered sweep");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      target: { kind: "all" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "● alpha [user]",
          "  ⊘ user-plugin (skipped) {up-to-date}",
          "",
          "● same [project]",
          "  ⊘ project-plugin (skipped) {up-to-date}",
          "",
          "● same [user]",
          "  ⊘ user-same-plugin (skipped) {up-to-date}",
          "",
          "● Zulu [project]",
          "  ⊘ zeta (skipped) {up-to-date}",
          "  ⊘ alpha (skipped) {up-to-date}",
          "",
          "Plugin fetch: 5 successes",
        ].join("\n"),
      },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});

test("filters unrelated marketplaces and nonmatching manifest entries", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const unrelated = await marketplaceRecord({
      cwd,
      entries: [{ name: "ignored", source: "./ignored" }],
      name: "unrelated",
      scope: "project",
    });
    const selected = await marketplaceRecord({
      cwd,
      entries: [
        { name: "first", source: "./first" },
        { name: "chosen", source: "./chosen", version: "1.2.3" },
      ],
      name: "selected",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [unrelated, selected]);
    const git = gitBoundary({ allowedRemoteUrls: [] });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("filtered target");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "selected", plugin: "chosen" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● selected [project]\n  ⊘ chosen v1.2.3 (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});

test("isolates a malformed manifest and continues the healthy marketplace", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const broken = await marketplaceRecord({
      cwd,
      entries: [{ name: "unused", source: "./unused" }],
      name: "broken",
      scope: "project",
    });
    await writeFile(broken.manifestPath, "{ not json");
    const healthy = await marketplaceRecord({
      cwd,
      entries: [{ name: "healthy-plugin", source: "./healthy-plugin" }],
      name: "healthy",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [healthy, broken]);
    const git = gitBoundary({ allowedRemoteUrls: [] });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("malformed manifest", 1);

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "all" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "A marketplace operation has failed.",
          "",
          "⊘ broken [project] (failed) {unparseable}",
          "",
          "● healthy [project]",
          "  ⊘ healthy-plugin (skipped) {up-to-date}",
          "",
          "Plugin fetch: 1 failure, 1 success",
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});

test("continues a manifest-ordered sweep after a network failure", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const okUrl = "https://example.com/ok";
    const badUrl = "https://example.com/bad";
    const okPin = "8888888888888888888888888888888888888888";
    const badPin = "9999999999999999999999999999999999999999";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "ok", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "ok", source: { source: "url", url: okUrl, sha: okPin }, version: "1.0.0" },
        { name: "bad", source: { source: "url", url: badUrl, sha: badPin } },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const git = gitBoundary({
      allowedRemoteUrls: [`${okUrl}.git`, `${badUrl}.git`],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const originalClone = cache.seam.materializePluginClone;
    const seam: FetchCloneCacheSeam = {
      ...cache.seam,
      async materializePluginClone(args) {
        if (args.cloneUrl === badUrl) {
          throw Object.assign(new Error("host unreachable"), { code: "ENETUNREACH" });
        }

        return originalClone(args);
      },
    };
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("failure-tolerant sweep");

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● marketplace [project]",
          "  ○ ok v1.0.0 (available)",
          "  ⊘ bad (failed) {network unreachable}",
          "    cause: host unreachable",
          "",
          "Plugin fetch: 1 failure, 1 success",
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${okUrl} sha=${okPin} ref=-`,
      `clone ${okUrl} pin=${okPin} ref=- auth=-`,
      `resolve url ${badUrl} sha=${badPin} ref=-`,
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("derives partially available and unavailable git rows exactly", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const partialUrl = "https://example.com/partial";
    const subdirUrl = "https://example.com/monorepo";
    const partialPin = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const subdirPin = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "fixture", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          lspServers: { server: {} },
          name: "partial",
          source: { source: "url", url: partialUrl, sha: partialPin },
        },
        {
          name: "missing-subdir",
          source: {
            path: "plugins/missing",
            sha: subdirPin,
            source: "git-subdir",
            url: subdirUrl,
          },
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const git = gitBoundary({
      allowedRemoteUrls: [`${partialUrl}.git`, `${subdirUrl}.git`],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("reasoned rows");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "● marketplace [project]",
          "  ⊖ partial (partially-available) {lsp}",
          "  ⊘ missing-subdir (unavailable) {unsupported source}",
          "",
          "Plugin fetch: 2 successes",
        ].join("\n"),
      },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${partialUrl} sha=${partialPin} ref=-`,
      `clone ${partialUrl} pin=${partialPin} ref=- auth=-`,
      `resolve git-subdir ${subdirUrl} sha=${subdirPin} ref=-`,
      `clone ${subdirUrl} pin=${subdirPin} ref=- auth=-`,
    ]);
    verifyNotifications(boundary);
  });
});

test("reports a successful seam with a still-cold cache as remote", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/cold";
    const pin = "cccccccccccccccccccccccccccccccccccccccc";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          description: "Remote plugin",
          name: "remote",
          source: { source: "url", url: cloneUrl, sha: pin },
          version: "3.2.1",
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("remote row");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.resolve({ pluginRoot: path.join(cwd, "absent"), resolvedSha: pin });
      },
      materializePluginClone() {
        return Promise.resolve(path.join(cwd, "absent"));
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "remote" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "● marketplace [project]\n  ◌ remote v3.2.1 (remote)\n    Remote plugin",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});

test("reports available when the cache becomes visible between fresh probes", async (testContext) => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/concurrent";
    const pin = "abababababababababababababababababababab";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "concurrent", source: { source: "url", url: cloneUrl, sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, pin));
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("concurrent cache visibility");
    const fileStats = await stat(marketplace.manifestPath);
    const originalStat = fs.stat;
    let hideDirectoryKindOnce = false;
    const statMock = testContext.mock.method(fs, "stat", (target: PathLike) => {
      if (hideDirectoryKindOnce && path.resolve(String(target)) === cloneRoot) {
        hideDirectoryKindOnce = false;
        return Promise.resolve(fileStats);
      }

      return originalStat(target);
    });
    syncBuiltinESMExports();
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone() {
        await writePluginTree(cloneRoot, "concurrent", "1.0.0");
        hideDirectoryKindOnce = true;
        return cloneRoot;
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    try {
      await fetchPlugins({
        cloneCacheSeam: seam,
        credentialOps: credentials.credentialOps,
        ctx: boundary.ctx,
        cwd,
        pi: boundary.pi,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "concurrent" },
      });
    } finally {
      statMock.mock.restore();
      syncBuiltinESMExports();
    }

    // assert
    assert.strictEqual(hideDirectoryKindOnce, false);
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ concurrent (available)" },
    ]);
    assert.deepStrictEqual(await snapshotTree(cloneRoot), [
      {
        path: ".claude-plugin",
        type: "directory",
      },
      {
        contents: '{"name":"concurrent","version":"1.0.0"}',
        path: ".claude-plugin/plugin.json",
        type: "file",
      },
      { path: "skills", type: "directory" },
      { path: "skills/greet", type: "directory" },
      {
        contents: "---\nname: greet\n---\n\nHello 1.0.0.\n",
        path: "skills/greet/SKILL.md",
        type: "file",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("narrows permission and non-Error failures without aborting the sweep", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const permissionUrl = "https://example.com/permission";
    const unusualUrl = "https://example.com/unusual";
    const permissionPin = "dddddddddddddddddddddddddddddddddddddddd";
    const unusualPin = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "permission", source: { source: "url", url: permissionUrl, sha: permissionPin } },
        {
          name: "unusual",
          source: { source: "url", url: unusualUrl, sha: unusualPin },
          version: "9.9.9",
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("failure narrowing");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        await Promise.resolve();
        if (args.cloneUrl === permissionUrl) {
          throw Object.assign(new Error("write denied"), { code: "EACCES" });
        }

        throw "disk exploded"; // eslint-disable-line @typescript-eslint/only-throw-error
      },
      resolvePluginPin(args) {
        return Promise.resolve({
          cloneUrl: args.source.kind === "github" ? "unexpected" : args.source.url,
          pin: args.source.sha ?? "missing",
        });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "Some plugin operations have failed.",
          "",
          "● marketplace [project]",
          "  ⊘ permission (failed) {permission denied}",
          "    cause: write denied",
          "  ⊘ unusual v9.9.9 (failed) {source missing}",
          "    cause: disk exploded",
          "",
          "Plugin fetch: 2 failures",
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});

test("cleans failed clone staging and converges on retry", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/retry";
    const networkUrl = "https://example.com/retry.git";
    const pin = "ffffffffffffffffffffffffffffffffffffffff";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "retry", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "retry", source: { source: "url", url: cloneUrl, sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const failedGit = gitBoundary({
      allowedRemoteUrls: [networkUrl],
      cloneError: new Error("clone failed"),
    });
    const failedCache = cacheBoundary(failedGit.gitOps);
    const failedBoundary = notificationBoundary("failed clone");
    const retryGit = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const retryCache = cacheBoundary(retryGit.gitOps);
    const retryBoundary = notificationBoundary("clone retry");
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: failedBoundary.ctx,
      cwd,
      pi: failedBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "retry" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    const stagingAfterFailure = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: retryBoundary.ctx,
      cwd,
      pi: retryBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "retry" },
    });

    // assert
    assert.deepStrictEqual(failedBoundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ retry (failed) {source missing}\n    cause: clone failed",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(treeAfterFailure, []);
    assert.deepStrictEqual(stagingAfterFailure, []);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ retry (available)" },
    ]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("accepts a concurrent cache winner and removes losing staging", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/race";
    const networkUrl = "https://example.com/race.git";
    const pin = "0123456789abcdef0123456789abcdef01234567";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "race", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "race", source: { source: "url", url: cloneUrl, sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, pin));
    const base = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const racingGitOps: GitOps = {
      ...base.gitOps,
      async checkout(options) {
        await base.gitOps.checkout(options);
        await writePluginTree(cloneRoot, "race", "1.0.0");
        await writeFile(path.join(cloneRoot, "winner"), "peer\n");
      },
    };
    const cache = cacheBoundary(racingGitOps);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("cache race");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "race" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ race (available)" },
    ]);
    assert.strictEqual(await readFile(path.join(cloneRoot, "winner"), "utf8"), "peer\n");
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("surfaces a cleanup leak and retries safely after permissions are repaired", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/leak";
    const networkUrl = "https://example.com/leak.git";
    const pin = "89abcdef0123456789abcdef0123456789abcdef";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "leak", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "leak", source: { source: "url", url: cloneUrl, sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const base = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const leakingGitOps: GitOps = {
      ...base.gitOps,
      async clone(options) {
        await base.gitOps.clone(options);
        await chmod(path.dirname(options.dir), 0o500);
        throw new Error("clone interrupted");
      },
    };
    const failedCache = cacheBoundary(leakingGitOps);
    const failedBoundary = notificationBoundary("cleanup leak");
    const retryGit = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const retryCache = cacheBoundary(retryGit.gitOps);
    const retryBoundary = notificationBoundary("cleanup retry");
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: failedBoundary.ctx,
      cwd,
      pi: failedBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "leak" },
    });
    await chmod(path.join(locations.extensionRoot, "sources-staging"), 0o700);
    const leakedTree = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: retryBoundary.ctx,
      cwd,
      pi: retryBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "leak" },
    });

    // assert
    assert.strictEqual(failedBoundary.notifications.length, 1);
    assert.match(
      failedBoundary.notifications[0]?.message ?? "",
      /^A plugin operation has failed\.\n\n● marketplace \[project\]\n {2}⊘ leak \(failed\) \{source missing\}\n {4}cause: clone interrupted \(additionally: failed to clean up plugin clone staging at .*\/sources-staging\/[0-9a-f-]+: EACCES: permission denied, rmdir '.*\/sources-staging\/[0-9a-f-]+'\) -> clone interrupted$/,
    );
    assert.strictEqual(failedBoundary.notifications[0]?.severity, "error");
    assert.notDeepStrictEqual(leakedTree, []);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ leak (available)" },
    ]);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("classifies a denied Device Flow as authentication required", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://github.com/acme/denied";
    const pin = "1234567890abcdef1234567890abcdef12345678";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "denied", source: { source: "github", repo: "acme/denied", sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "device-code",
        expires_in: 900,
        interval: 0,
        user_code: "DENY-1234",
        verification_uri: "https://github.com/login/device",
      },
      network: "disabled",
      pollResponses: [{ kind: "access_denied" }],
    });
    const boundary = notificationBoundary("denied Device Flow", 2);
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
        assert.deepStrictEqual(await callbacks.onAuth(`${cloneUrl}.git`), { cancel: true });
        throw Object.assign(new Error("The operation was canceled."), {
          code: "UserCanceledError",
        });
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "denied" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "Open https://github.com/login/device and enter: DENY-1234",
        severity: "info",
      },
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ denied (failed) {authentication required}\n    cause: The operation was canceled.",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [],
      fill: [{ host: "github.com" }],
      reject: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      pollToken: [{ clientId: "Ov23liNcyK08uGdU0mMl", deviceCode: "device-code", intervalSec: 0 }],
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
    });
    verifyNotifications(boundary);
  });
});

test("fails cleanly when Device Flow credential approval rejects", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://github.com/acme/approve-failure";
    const pin = "234567890abcdef1234567890abcdef123456789";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          name: "approve-failure",
          source: { source: "github", repo: "acme/approve-failure", sha: pin },
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const credentials = createCredentialOpsFake({
      approveError: new Error("credential approve failed"),
      boundary: "memory",
    });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      deviceCode: {
        device_code: "device-code",
        expires_in: 900,
        interval: 0,
        user_code: "FAIL-1234",
        verification_uri: "https://github.com/login/device",
      },
      network: "disabled",
      pollResponses: [
        { accessToken: "token", kind: "success", scope: "repo", tokenType: "bearer" },
      ],
    });
    const boundary = notificationBoundary("approve failure", 2);
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
        assert.deepStrictEqual(await callbacks.onAuth(`${cloneUrl}.git`), { cancel: true });
        throw Object.assign(new Error("The operation was canceled."), {
          code: "UserCanceledError",
        });
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "approve-failure" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "Open https://github.com/login/device and enter: FAIL-1234",
        severity: "info",
      },
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ approve-failure (failed) {authentication required}\n    cause: The operation was canceled.",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [
        {
          credential: { password: "token", username: "x-access-token" },
          host: "github.com",
        },
      ],
      fill: [{ host: "github.com" }],
      reject: [],
    });
    assert.strictEqual(credentials.storedCredential("github.com"), null);
    verifyNotifications(boundary);
  });
});

test("rejects a stale credential and contains a reject failure", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://github.com/acme/stale";
    const pin = "34567890abcdef1234567890abcdef1234567890";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "stale", source: { source: "github", repo: "acme/stale", sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const staleCredential: GitCredentials = {
      password: "stale-token",
      username: "x-access-token",
    };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["github.com", staleCredential]],
      rejectError: new Error("credential reject failed"),
    });
    const boundary = notificationBoundary("reject failure");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone(args) {
        const callbacks = buildAuthCallbacks(requiredAuth(args.auth));
        assert.deepStrictEqual(await callbacks.onAuthFailure(`${cloneUrl}.git`, staleCredential), {
          cancel: true,
        });
        throw Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
          code: "HttpError",
          data: { statusCode: 401 },
        });
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "stale" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ stale (failed) {authentication required}\n    cause: HTTP Error: 401 Unauthorized",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(credentials.calls, {
      approve: [],
      fill: [],
      reject: [{ credential: staleCredential, host: "github.com" }],
    });
    assert.deepStrictEqual(credentials.storedCredential("github.com"), staleCredential);
    verifyNotifications(boundary);
  });
});

test("retains a warm mirror after refresh failure and converges on retry", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/warm-retry";
    const head = "4567890abcdef1234567890abcdef12345678901";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "warm-retry", source: { source: "url", url: cloneUrl } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
    await writePluginTree(mirrorRoot, "warm-retry", "1.0.0");
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
    await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${head}\n`);
    const treeBefore = await snapshotTree(locations.pluginClonesDir);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const failedGit = gitBoundary({
      allowedRemoteUrls: [],
      fetchError: Object.assign(new Error("network unreachable"), { code: "ENETUNREACH" }),
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/HEAD": head },
    });
    const failedCache = cacheBoundary(failedGit.gitOps);
    const failedBoundary = notificationBoundary("mirror refresh failure");
    const retryGit = gitBoundary({
      allowedRemoteUrls: [],
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/HEAD": head },
    });
    const retryCache = cacheBoundary(retryGit.gitOps);
    const retryBoundary = notificationBoundary("mirror refresh retry");
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: failedBoundary.ctx,
      cwd,
      pi: failedBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm-retry" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: retryBoundary.ctx,
      cwd,
      pi: retryBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm-retry" },
    });

    // assert
    assert.deepStrictEqual(failedBoundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ warm-retry (failed) {network unreachable}\n    cause: network unreachable",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(treeAfterFailure, treeBefore);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ warm-retry (available)" },
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("cleans a non-race promotion failure and converges on retry", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/promotion";
    const networkUrl = "https://example.com/promotion.git";
    const pin = "567890abcdef1234567890abcdef123456789012";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "promotion", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "promotion", source: { source: "url", url: cloneUrl, sha: pin } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const base = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const failingGitOps: GitOps = {
      ...base.gitOps,
      async checkout(options) {
        await base.gitOps.checkout(options);
        await rm(options.dir, { force: true, recursive: true });
      },
    };
    const failedCache = cacheBoundary(failingGitOps);
    const failedBoundary = notificationBoundary("promotion failure");
    const retryGit = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const retryCache = cacheBoundary(retryGit.gitOps);
    const retryBoundary = notificationBoundary("promotion retry");
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: failedBoundary.ctx,
      cwd,
      pi: failedBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "promotion" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    const stagingAfterFailure = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      credentialOps: credentials.credentialOps,
      ctx: retryBoundary.ctx,
      cwd,
      pi: retryBoundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "promotion" },
    });

    // assert
    assert.strictEqual(failedBoundary.notifications.length, 1);
    assert.match(
      failedBoundary.notifications[0]?.message ?? "",
      /^A plugin operation has failed\.\n\n● marketplace \[project\]\n {2}⊘ promotion \(failed\) \{source missing\}\n {4}cause: ENOENT: no such file or directory, rename '.*\/sources-staging\/[0-9a-f-]+' -> '.*\/plugin-clones\/[0-9a-f]{12}-567890abcdef'$/,
    );
    assert.strictEqual(failedBoundary.notifications[0]?.severity, "error");
    assert.deepStrictEqual(treeAfterFailure, []);
    assert.deepStrictEqual(stagingAfterFailure, []);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ promotion (available)" },
    ]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("narrows an unreadable warm mirror probe to source missing", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/corrupt";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "corrupt", source: { source: "url", url: cloneUrl } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
    await writePluginTree(mirrorRoot, "corrupt", "1.0.0");
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
    await writeFile(path.join(mirrorRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const boundary = notificationBoundary("corrupt mirror");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.resolve({
          pluginRoot: mirrorRoot,
          resolvedSha: "67890abcdef1234567890abcdef1234567890123",
        });
      },
      materializePluginClone() {
        return Promise.reject(new Error("unexpected clone call"));
      },
      resolvePluginPin() {
        return Promise.reject(new Error("unexpected resolve call"));
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      credentialOps: credentials.credentialOps,
      ctx: boundary.ctx,
      cwd,
      pi: boundary.pi,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "corrupt" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ corrupt (unavailable) {source missing}" },
    ]);
    assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] });
    verifyNotifications(boundary);
  });
});
