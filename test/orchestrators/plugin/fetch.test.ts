import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { DEFAULT_CREDENTIAL_OPS } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { createPluginTransportContext } from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { createFetchPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import { makePresenceProbe } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { resolveListCandidate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { softDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import {
  GitCommandError,
  InvalidGitHubBaseUrlError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import {
  adapterCommand,
  builtinMcpCommand,
  builtinMcpTool,
} from "../../platform/pi-inventory-seed.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded, runWithSoftDeps } from "../../shared/notification-run-seeds.ts";
import { whileStateLockHeld } from "../state-lock.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  CloneTransport,
  PluginTransportContext,
} from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import type { RenameOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts";
import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  FetchCloneCacheSeam,
  FetchStatus,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import type * as FetchOrchestrator from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { GitFailure } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { CloneTransportNote } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type ManifestEntry = MarketplaceManifest["plugins"][number];

// fetch.ts publishes the factory and its injected status contract; the single
// production composition of them lives in orchestrators/plugin/operations.ts.
// Re-adding a composed value here would give the command two production
// bindings. Restoring the export makes the `satisfies` resolve and turns the
// directive below into an unused one (TS2578).
// @ts-expect-error fetch.ts does not expose a composed fetchPlugins value
void ({} satisfies { readonly retired?: typeof FetchOrchestrator.fetchPlugins });

/**
 * The composition every case below drives: this module's own factory bound to
 * the real fs-only status capability, stated at one site so each case reads as
 * the command rather than as its assembly. It is the same pair of reads the
 * production composition binds.
 */
const fetchPlugins = createFetchPlugins({ makePresenceProbe, resolveListCandidate });

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
  readonly run: NotificationRun;
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
  readonly fixtureSourceDir?: string;
  readonly head?: string;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteHead?: string;
  readonly remoteRefs?: Readonly<Record<string, string>>;
  readonly resolveRemoteRefError?: Error;
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

function notificationBoundary(
  name: string,
  expectedCalls = 1,
  expectedModeReads = expectedCalls,
): NotificationBoundary {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: `${name} context` });
  const ui = mock<NotificationUi>({ exactParams: true, name: `${name} UI` });
  const notifications: CapturedNotification[] = [];
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(expectedModeReads);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(expectedCalls);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push({ message, ...(severity === undefined ? {} : { severity }) });
    })
    .times(expectedCalls);
  return { ctx, notifications, run: runWithNothingLoaded(), ui };
}

/** SG-PRC-05: a system-git clone that failed as `failure`, with `cause` when one is given. */
function cloneFailure(failure: GitFailure, cause?: unknown): GitCommandError {
  return new GitCommandError(
    failure,
    { operation: "clone", exitCode: 128 },
    cause === undefined ? undefined : { cause },
  );
}

function verifyNotifications(boundary: NotificationBoundary): void {
  verify(boundary.ctx);
  verify(boundary.ui);
}

function requiredAuth(auth: GitAuthBundle | undefined): GitAuthBundle {
  if (auth === undefined) {
    assert.fail("expected a git auth bundle");
  }

  return auth;
}

function gitBoundary(options: GitBoundaryOptions): GitBoundary {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: options.allowedRemoteUrls,
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
    ...(options.fixtureSourceDir === undefined
      ? {}
      : { cloneFixture: { boundary: "local", sourceDir: options.fixtureSourceDir } }),
    ...(options.head === undefined ? {} : { initialOid: options.head }),
    ...(options.localRefs === undefined ? {} : { localRefs: options.localRefs }),
    ...(options.remoteHead === undefined ? {} : { remoteHead: options.remoteHead }),
    ...(options.remoteRefs === undefined ? {} : { remoteRefs: options.remoteRefs }),
    ...(options.resolveRemoteRefError === undefined
      ? {}
      : { resolveRemoteRefError: options.resolveRemoteRefError }),
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
      await git.gitOps.clone(cloneOptions);
      if (options.writeHead === true) {
        await mkdir(path.join(cloneOptions.dir, ".git"), { recursive: true });
        await writeFile(path.join(cloneOptions.dir, ".git", "HEAD"), `${git.state.head}\n`);
      }
    },
    async fetchCommit(options) {
      schedule.push(
        `fetch-commit ${options.sha} ref=${options.ref ?? "-"} auth=${options.auth?.host ?? "-"}`,
      );
      await git.gitOps.fetchCommit(options);
    },
    async resolveRef(options) {
      schedule.push(`resolve-local ${options.ref}`);
      return (
        (await git.gitOps.resolveRef(options)) ??
        git.state.remoteRefs[options.ref] ??
        (options.ref === "refs/remotes/origin/HEAD"
          ? git.state.remoteRefs["refs/remotes/origin/main"]
          : undefined)
      );
    },
    async resolveRemoteRef(options) {
      schedule.push(
        `resolve-remote ${options.url} ref=${options.ref ?? "-"} auth=${options.auth?.host ?? "-"}`,
      );
      return git.gitOps.resolveRemoteRef(options);
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

function cacheBoundary(gitOps: GitOps, renameOps?: RenameOps): CacheBoundary {
  const calls: string[] = [];
  const seam: FetchCloneCacheSeam = {
    async materializeOrRefreshPluginMirror(args) {
      calls.push(`mirror ${args.cloneUrl} ref=${args.ref ?? "-"} auth=${args.auth?.host ?? "-"}`);
      return materializeOrRefreshPluginMirror({
        ...args,
        gitOps,
        ...(renameOps === undefined ? {} : { renameOps }),
      });
    },
    async materializePluginClone(args) {
      calls.push(
        `clone ${args.cloneUrl} pin=${args.pin} ref=${args.ref ?? "-"} auth=${args.resolveAuth().host}`,
      );
      return materializePluginClone({ ...args, gitOps });
    },
    async resolvePluginPin(args) {
      calls.push(
        `resolve ${args.source.kind} ${sourceIdentity(args.source)} sha=${args.source.sha} ref=${args.source.ref ?? "-"}`,
      );
      return resolvePluginPin(args);
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
  return withHermeticEnvironment("plugin-fetch-", run);
}

test("constructs the fetch command without using its status capability or starting asynchronous work", (t) => {
  // arrange
  const status = mock<FetchStatus>({ exactParams: true, name: "fetch status" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const fetchWithStatus = createFetchPlugins(status);
  resources.disable();

  // assert
  assert.strictEqual(typeof fetchWithStatus, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(status);
});

test("exposes a required fetch status factory", async () => {
  // arrange
  const fetchModule =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts");

  // act
  const exportNames = Object.keys(fetchModule);

  // assert
  assert.strictEqual(exportNames.includes("createFetchPlugins"), true);
});

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
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "path-plugin" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ path-plugin v1.0.0 (skipped) {up-to-date}" },
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
    const boundary = notificationBoundary("pinned warm");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ warm v1.0.0 (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), cacheBefore);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("materializes a cold pinned URL clone at its recorded SHA", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    // D-2-01: the manifest url carries a `.git`, so the identity `cloneUrl`
    // (which keys the clone dir) and the wire `networkUrl` differ, and the
    // gitBoundary admits only the suffixed remote.
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
          source: { source: "url", url: networkUrl, sha: pin, ref: "v2" },
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
    const boundary = notificationBoundary("cold pinned URL");
    const cloneKey = pluginCloneKey(cloneUrl, pin);

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "cold" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ cold v2.0.0 (available)" },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${cloneUrl} sha=${pin} ref=v2`,
      `clone ${cloneUrl} pin=${pin} ref=v2 auth=example.com`,
    ]);
    // SG-TRN-02, C5: the pin ladder clones no branch, fetches the pin with
    // the ref, checks it out, and reads HEAD back.
    assert.deepStrictEqual(git.schedule, [
      `clone ${networkUrl} ref=- single=false auth=example.com`,
      `fetch-commit ${pin} ref=v2 auth=example.com`,
      `checkout ${pin}`,
      "resolve-local HEAD",
    ]);
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

test("D-SG-10: checks an unpinned warm mirror's ref with ls-remote, keeps a current mirror, and leaves state immutable", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/plugin";
    const networkUrl = "https://example.com/plugin";
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
    const boundary = notificationBoundary("warm mirror");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "moving" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ moving v3.0.0 (available)" },
    ]);
    assert.deepStrictEqual(cache.calls, [`mirror ${cloneUrl} ref=main auth=example.com`]);
    assert.deepStrictEqual(git.schedule, [
      "resolve-local HEAD",
      `resolve-remote ${networkUrl} ref=main auth=example.com`,
      "resolve-local HEAD",
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("materializes a cold unpinned URL mirror at the typed wire url", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    // D-2-01 / D-2-03: the mirror dir is keyed on the identity url; the COLD
    // clone goes out at the wire url, `.git` and all.
    const cloneUrl = "https://example.com/cold-mirror";
    const networkUrl = "https://example.com/cold-mirror.git";
    const head = "5555555555555555555555555555555555555555";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "cold-mirror", "5.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "cold-mirror", source: { source: "url", url: networkUrl }, version: "5.0.0" },
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
    const boundary = notificationBoundary("cold URL mirror");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "cold-mirror" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ cold-mirror v5.0.0 (available)" },
    ]);
    assert.deepStrictEqual(cache.calls, [`mirror ${cloneUrl} ref=- auth=example.com`]);
    assert.deepStrictEqual(git.schedule, [
      `clone ${networkUrl} ref=- single=false auth=example.com`,
      "resolve-local HEAD",
    ]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.deepStrictEqual(
      await snapshotTree(await locations.pluginCloneDir(pluginMirrorKey(cloneUrl))),
      [
        { path: ".claude-plugin", type: "directory" },
        {
          contents: '{"name":"cold-mirror","version":"5.0.0"}',
          path: path.join(".claude-plugin", "plugin.json"),
          type: "file",
        },
        { path: ".git", type: "directory" },
        { contents: `${head}\n`, path: path.join(".git", "HEAD"), type: "file" },
        { path: "skills", type: "directory" },
        { path: path.join("skills", "greet"), type: "directory" },
        {
          contents: "---\nname: greet\n---\n\nHello 5.0.0.\n",
          path: path.join("skills", "greet", "SKILL.md"),
          type: "file",
        },
      ],
    );
    verifyNotifications(boundary);
  });
});

test("a pinned GitHub clone's bundle carries the production credential surface by reference", async () => {
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
    const boundary = notificationBoundary("production credential surface");
    const bundles: GitAuthBundle[] = [];
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      materializePluginClone(args) {
        bundles.push(args.resolveAuth());
        return Promise.resolve(path.join(cwd, "not-written"));
      },
      resolvePluginPin(args) {
        return Promise.resolve({ cloneUrl, pin: args.source.sha ?? pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "stored" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ◌ stored (remote)" },
    ]);
    assert.strictEqual(bundles.length, 1);
    const [bundle] = bundles;
    assert.strictEqual(bundle?.host, "github.com");
    assert.strictEqual(bundle.credentialOps, DEFAULT_CREDENTIAL_OPS);
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
    const boundary = notificationBoundary("ordered sweep");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
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
    const boundary = notificationBoundary("filtered target");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "selected", plugin: "chosen" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● selected [project]\n  ⊘ chosen v1.2.3 (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
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
    const boundary = notificationBoundary("malformed manifest", 1);

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
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
      allowedRemoteUrls: [okUrl, badUrl],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const originalClone = cache.seam.materializePluginClone;
    const seam: FetchCloneCacheSeam = {
      ...cache.seam,
      async materializePluginClone(args) {
        if (args.cloneUrl === badUrl) {
          throw cloneFailure({ kind: "network", curlCode: 7 });
        }

        return originalClone(args);
      },
    };
    const boundary = notificationBoundary("failure-tolerant sweep");

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
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
          "    cause: git clone failed: network, exit code 128",
          "",
          "Plugin fetch: 1 failure, 1 success",
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${okUrl} sha=${okPin} ref=-`,
      `clone ${okUrl} pin=${okPin} ref=- auth=example.com`,
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
      allowedRemoteUrls: [partialUrl, subdirUrl],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const boundary = notificationBoundary("reasoned rows");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "● marketplace [project]",
          "  ⊖ partial v1.0.0 (partially-available) {lsp}",
          "  ⊘ missing-subdir (unavailable) {unsupported source}",
          "",
          "Plugin fetch: 2 successes",
        ].join("\n"),
      },
    ]);
    assert.deepStrictEqual(cache.calls, [
      `resolve url ${partialUrl} sha=${partialPin} ref=-`,
      `clone ${partialUrl} pin=${partialPin} ref=- auth=example.com`,
      `resolve git-subdir ${subdirUrl} sha=${subdirPin} ref=-`,
      `clone ${subdirUrl} pin=${subdirPin} ref=- auth=example.com`,
    ]);
    verifyNotifications(boundary);
  });
});

test("flags binaries on a fetched git row of an official marketplace", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/official";
    const pin = "dddddddddddddddddddddddddddddddddddddddd";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "fixture", "1.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          ...{ binaries: { tool: "https://example.com/tool" } },
          name: "official",
          source: { source: "url", url: cloneUrl, sha: pin },
        },
      ],
      name: "claude-plugins-official",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const git = gitBoundary({ allowedRemoteUrls: [cloneUrl], fixtureSourceDir: fixture });
    const cache = cacheBoundary(git.gitOps);
    const boundary = notificationBoundary("official binaries");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "marketplace", marketplace: "claude-plugins-official" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "● claude-plugins-official [project]",
          "  ⊖ official v1.0.0 (partially-available) {unsupported component}",
          "",
          "Plugin fetch: 1 success",
        ].join("\n"),
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("GLK-07: a successful seam with a still-cold cache reports remote with the entry version", async () => {
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
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "remote" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "● marketplace [project]\n  ◌ remote v3.2.1 (remote)\n    Remote plugin",
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("GLK-07: reads the post-fetch row once through list's rule against the warm clone", async () => {
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
    const boundary = notificationBoundary("concurrent cache visibility");
    let postFetchReads = 0;
    const status: FetchStatus = {
      makePresenceProbe,
      async resolveListCandidate(entry, marketplaceContext, statusLocations) {
        postFetchReads += 1;
        return resolveListCandidate(entry, marketplaceContext, statusLocations);
      },
    };
    const fetchPluginsWithStatus = createFetchPlugins(status);
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      async materializePluginClone() {
        await writePluginTree(cloneRoot, "concurrent", "1.0.0");
        return cloneRoot;
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPluginsWithStatus({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "concurrent" },
    });

    // assert
    assert.equal(postFetchReads, 1);
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ concurrent v1.0.0 (available)" },
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
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("renders fresh status after materialization through the required capability", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/status-capability";
    const networkUrl = "https://example.com/status-capability";
    const pin = "acacacacacacacacacacacacacacacacacacacac";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "fresh", "4.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          description: "Fresh plugin",
          name: "fresh",
          source: { source: "url", url: cloneUrl, sha: pin },
          version: "4.0.0",
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const git = gitBoundary({ allowedRemoteUrls: [networkUrl], fixtureSourceDir: fixture });
    const cache = cacheBoundary(git.gitOps);
    const sequence: string[] = [];
    const seam: FetchCloneCacheSeam = {
      ...cache.seam,
      async materializePluginClone(args) {
        sequence.push("materialize");
        return cache.seam.materializePluginClone(args);
      },
    };
    const status: FetchStatus = {
      makePresenceProbe(statusLocations) {
        const probe = makePresenceProbe(statusLocations);
        return async (source) => {
          const presence = await probe(source);
          sequence.push(`presence:${presence.kind}`);
          return presence;
        };
      },
      async resolveListCandidate(entry, marketplaceContext, statusLocations) {
        const candidate = await resolveListCandidate(entry, marketplaceContext, statusLocations);
        sequence.push(`candidate:${candidate.kind}`);
        return candidate;
      },
    };
    const controlledFetch = createFetchPlugins(status);
    const boundary = notificationBoundary("fresh status capability");
    const cloneKey = pluginCloneKey(cloneUrl, pin);

    // act
    await controlledFetch({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "fresh" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "● marketplace [project]\n  ○ fresh v4.0.0 (available)\n    Fresh plugin",
      },
    ]);
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), [
      { path: cloneKey, type: "directory" },
      { path: path.join(cloneKey, ".claude-plugin"), type: "directory" },
      {
        contents: '{"name":"fresh","version":"4.0.0"}',
        path: path.join(cloneKey, ".claude-plugin", "plugin.json"),
        type: "file",
      },
      { path: path.join(cloneKey, "skills"), type: "directory" },
      { path: path.join(cloneKey, "skills", "greet"), type: "directory" },
      {
        contents: "---\nname: greet\n---\n\nHello 4.0.0.\n",
        path: path.join(cloneKey, "skills", "greet", "SKILL.md"),
        type: "file",
      },
    ]);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(sequence, ["presence:not-cached", "materialize", "candidate:resolved"]);
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
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
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
    verifyNotifications(boundary);
  });
});

test("cleans failed clone staging and converges on retry", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/retry";
    const networkUrl = "https://example.com/retry";
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

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      ctx: failedBoundary.ctx,
      cwd,
      run: failedBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "retry" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    const stagingAfterFailure = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      ctx: retryBoundary.ctx,
      cwd,
      run: retryBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "retry" },
    });

    // assert
    assert.deepStrictEqual(failedBoundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ retry (failed) {network error}\n    cause: clone failed",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(treeAfterFailure, []);
    assert.deepStrictEqual(stagingAfterFailure, []);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ retry v1.0.0 (available)" },
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
    const networkUrl = "https://example.com/race";
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
    const boundary = notificationBoundary("cache race");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "race" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ race v1.0.0 (available)" },
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
    const networkUrl = "https://example.com/leak";
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

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      ctx: failedBoundary.ctx,
      cwd,
      run: failedBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "leak" },
    });
    await chmod(path.join(locations.extensionRoot, "sources-staging"), 0o700);
    const leakedTree = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      ctx: retryBoundary.ctx,
      cwd,
      run: retryBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "leak" },
    });

    // assert
    assert.strictEqual(failedBoundary.notifications.length, 1);
    assert.match(
      failedBoundary.notifications[0]?.message ?? "",
      /^A plugin operation has failed\.\n\n● marketplace \[project\]\n {2}⊘ leak \(failed\) \{network error\}\n {4}cause: clone interrupted \(additionally: failed to clean up plugin clone staging at [0-9a-f-]+: EACCES: permission denied, rmdir '[0-9a-f-]+'\) -> clone interrupted$/,
    );
    assert.strictEqual(failedBoundary.notifications[0]?.severity, "error");
    assert.notDeepStrictEqual(leakedTree, []);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ leak v1.0.0 (available)" },
    ]);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("GHB-03: fetching a GitHub-source plugin on an invalid base fails the command instead of rendering a failed row", async (t) => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "first", source: { source: "github", repo: "acme/first" } },
        { name: "second", source: { source: "github", repo: "acme/second" } },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const git = gitBoundary({ allowedRemoteUrls: [] });
    const cache = cacheBoundary(git.gitOps);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "invalid base context" });

    // act & assert
    await assert.rejects(
      () =>
        fetchPlugins({
          cloneCacheSeam: cache.seam,
          ctx,
          cwd,
          run: runWithNothingLoaded(),
          scope: "project",
          target: { kind: "marketplace", marketplace: "marketplace" },
        }),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
    assert.deepStrictEqual(cache.calls, []);
    assert.deepStrictEqual(git.schedule, []);
    verify(ctx);
  });
});

test("D-SG-14: a clone the host refused fails the row as authentication required", async () => {
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
    const boundary = notificationBoundary("refused credential");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror() {
        return Promise.reject(new Error("unexpected mirror call"));
      },
      materializePluginClone(args) {
        assert.strictEqual(requiredAuth(args.resolveAuth()).host, "github.com");
        return Promise.reject(cloneFailure({ kind: "https-auth", detail: "rejected" }));
      },
      resolvePluginPin() {
        return Promise.resolve({ cloneUrl, pin });
      },
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "stale" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ stale (failed) {authentication required}\n    cause: git clone failed: https-auth, exit code 128",
        severity: "error",
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("D-SG-10: retains a warm mirror whose check and re-clone fail and converges on retry", async () => {
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
    const unreachable = cloneFailure({ kind: "network", curlCode: 7 });
    const failedGit = gitBoundary({
      allowedRemoteUrls: [cloneUrl],
      cloneError: unreachable,
      resolveRemoteRefError: unreachable,
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/HEAD": head },
    });
    const failedCache = cacheBoundary(failedGit.gitOps);
    const failedBoundary = notificationBoundary("mirror refresh failure");
    const retryGit = gitBoundary({
      allowedRemoteUrls: [cloneUrl],
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/HEAD": head },
    });
    const retryCache = cacheBoundary(retryGit.gitOps);
    const retryBoundary = notificationBoundary("mirror refresh retry");

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      ctx: failedBoundary.ctx,
      cwd,
      run: failedBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm-retry" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      ctx: retryBoundary.ctx,
      cwd,
      run: retryBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm-retry" },
    });

    // assert
    assert.deepStrictEqual(failedBoundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ warm-retry (failed) {network unreachable}\n    cause: git clone failed: network, exit code 128",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(treeAfterFailure, treeBefore);
    assert.deepStrictEqual(failedGit.schedule, [
      "resolve-local HEAD",
      `resolve-remote ${cloneUrl} ref=- auth=example.com`,
      `clone ${cloneUrl} ref=- single=false auth=example.com`,
    ]);
    assert.deepStrictEqual(retryBoundary.notifications, [
      { message: "● marketplace [project]\n  ○ warm-retry v1.0.0 (available)" },
    ]);
    assert.deepStrictEqual(retryGit.schedule, [
      "resolve-local HEAD",
      `resolve-remote ${cloneUrl} ref=- auth=example.com`,
      "resolve-local HEAD",
    ]);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(failedBoundary);
    verifyNotifications(retryBoundary);
  });
});

test("D-SG-10 / SG-TRN-03: a moved warm mirror that cannot be moved aside fails as permission denied and is never used", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/in-use";
    const head = "4567890abcdef1234567890abcdef12345678901";
    const moved = "567890abcdef1234567890abcdef123456789012";
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "in-use", "2.0.0");
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "in-use", source: { source: "url", url: cloneUrl } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
    await writePluginTree(mirrorRoot, "in-use", "1.0.0");
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
    await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${head}\n`);
    const treeBefore = await snapshotTree(locations.pluginClonesDir);
    const git = gitBoundary({
      allowedRemoteUrls: [cloneUrl],
      fixtureSourceDir: fixture,
      head,
      remoteHead: moved,
    });
    const renameError = Object.assign(new Error("EBUSY: resource busy or locked, rename"), {
      code: "EBUSY",
      syscall: "rename",
    });
    const cache = cacheBoundary(git.gitOps, {
      rename: (from, to) => (from === mirrorRoot ? Promise.reject(renameError) : rename(from, to)),
    });
    const boundary = notificationBoundary("mirror in use");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "in-use" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ in-use (failed) {permission denied}\n    cause: Could not replace the plugin mirror because it is in use; the existing copy was kept and the next command will try again. -> EBUSY: resource busy or locked, rename",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(git.schedule, [
      "resolve-local HEAD",
      `resolve-remote ${cloneUrl} ref=- auth=example.com`,
      `clone ${cloneUrl} ref=- single=false auth=example.com`,
    ]);
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), treeBefore);
    assert.deepStrictEqual(await stagingEntries(locations), []);
    verifyNotifications(boundary);
  });
});

test("cleans a non-race promotion failure and converges on retry", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/promotion";
    const networkUrl = "https://example.com/promotion";
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

    // act
    await fetchPlugins({
      cloneCacheSeam: failedCache.seam,
      ctx: failedBoundary.ctx,
      cwd,
      run: failedBoundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "promotion" },
    });
    const treeAfterFailure = await snapshotTree(locations.pluginClonesDir);
    const stagingAfterFailure = await stagingEntries(locations);
    await fetchPlugins({
      cloneCacheSeam: retryCache.seam,
      ctx: retryBoundary.ctx,
      cwd,
      run: retryBoundary.run,
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
      { message: "● marketplace [project]\n  ○ promotion v1.0.0 (available)" },
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
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "corrupt" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ corrupt (unavailable) {source missing}" },
    ]);
    verifyNotifications(boundary);
  });
});

test("GIT-03: a held state lock fails the row as lock held and refreshes no mirror", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "locked", source: { source: "github", repo: "acme/plugin" } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const seam: FetchCloneCacheSeam = {
      resolvePluginPin: () => assert.fail("a held lock never resolves a pin"),
      materializePluginClone: () => assert.fail("a held lock never clones"),
      materializeOrRefreshPluginMirror: () => assert.fail("a held lock never refreshes the mirror"),
    };
    const boundary = notificationBoundary("lock held");
    await whileStateLockHeld(locations, async () => {
      // act
      await fetchPlugins({
        cloneCacheSeam: seam,
        ctx: boundary.ctx,
        cwd,
        run: boundary.run,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "locked" },
      });
    });

    // assert
    assert.strictEqual(boundary.notifications.length, 1);
    assert.match(boundary.notifications[0]?.message ?? "", /locked \(failed\) \{lock held\}/);
    assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), []);
    verifyNotifications(boundary);
  });
});

test("GLK-07: folds a non-Error status read after the locked fetch into list's unavailable row", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "odd", source: { source: "github", repo: "acme/plugin" } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const seam: FetchCloneCacheSeam = {
      resolvePluginPin: () => assert.fail("an unpinned source never resolves a pin"),
      materializePluginClone: () => assert.fail("an unpinned source never clones a pin"),
      materializeOrRefreshPluginMirror: () =>
        Promise.resolve({ pluginRoot: cwd, resolvedSha: "6".repeat(40) }),
    };
    const fetchWithStatus = createFetchPlugins({
      makePresenceProbe,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the non-Error arm is the case under test.
      resolveListCandidate: () => Promise.reject("status unreadable"),
    });
    const boundary = notificationBoundary("non-Error status");

    // act
    await fetchWithStatus({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "odd" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ odd (unavailable) {unreadable}" },
    ]);
    verifyNotifications(boundary);
  });
});

for (const { title, failure, expectedRow } of [
  {
    title:
      "GLK-01: a host 503 on a mirror refresh fails the row as network error framed by its status and URL",
    failure: { kind: "network", httpStatus: 503 },
    expectedRow: [
      "  ⊘ refused (failed) {network error}",
      "    cause: 503 on https://example.com/refused -> git clone failed: network, exit code 128",
    ],
  },
  {
    title:
      "GLK-01: a host 404 on a mirror refresh fails the row as source missing framed by its status and URL",
    failure: { kind: "repository-not-found", httpStatus: 404 },
    expectedRow: [
      "  ⊘ refused (failed) {source missing}",
      "    cause: 404 on https://example.com/refused -> git clone failed: repository-not-found, exit code 128",
    ],
  },
  {
    title:
      "GLK-01: a host 401 on a mirror refresh fails the row as authentication required with no frame",
    failure: { kind: "https-auth", detail: "rejected" },
    expectedRow: [
      "  ⊘ refused (failed) {authentication required}",
      "    cause: git clone failed: https-auth, exit code 128",
    ],
  },
] satisfies ReadonlyArray<{
  title: string;
  failure: GitFailure;
  expectedRow: readonly string[];
}>) {
  test(title, async () => {
    await withWorkspace(async ({ cwd }) => {
      // arrange
      const cloneUrl = "https://example.com/refused";
      const marketplace = await marketplaceRecord({
        cwd,
        entries: [{ name: "refused", source: { source: "url", url: cloneUrl } }],
        name: "marketplace",
        scope: "project",
      });
      await saveMarketplaces(cwd, "project", [marketplace]);
      const boundary = notificationBoundary(`host ${failure.kind}`);
      const seam: FetchCloneCacheSeam = {
        materializeOrRefreshPluginMirror: () => Promise.reject(cloneFailure(failure)),
        materializePluginClone: () => assert.fail("an unpinned source never clones a pin"),
        resolvePluginPin: () => assert.fail("an unpinned source never resolves a pin"),
      };

      // act
      await fetchPlugins({
        cloneCacheSeam: seam,
        ctx: boundary.ctx,
        cwd,
        run: boundary.run,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "refused" },
      });

      // assert
      assert.deepStrictEqual(boundary.notifications, [
        {
          message: [
            "A plugin operation has failed.",
            "",
            "● marketplace [project]",
            ...expectedRow,
          ].join("\n"),
          severity: "error",
        },
      ]);
      verifyNotifications(boundary);
    });
  });
}

test("D-PL10-11: an unrecognized mirror failure is a redacted network error", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/unknown";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "unknown", source: { source: "url", url: cloneUrl } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const boundary = notificationBoundary("unknown host failure");
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror: () =>
        Promise.reject(new Error(`transport failed while opening ${cwd}/private/credential.txt`)),
      materializePluginClone: () => assert.fail("an unpinned source never clones a pin"),
      resolvePluginPin: () => assert.fail("an unpinned source never resolves a pin"),
    };

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "unknown" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ unknown (failed) {network error}\n    cause: transport failed while opening credential.txt",
        severity: "error",
      },
    ]);
    assert.doesNotMatch(boundary.notifications[0]?.message ?? "", new RegExp(cwd));
    verifyNotifications(boundary);
  });
});

for (const { title, sha, expectedLockObservations } of [
  {
    title:
      "GLK-05: an unpinned fetch reads its row inside the scope lock it refreshed the mirror under",
    sha: undefined,
    expectedLockObservations: [true],
  },
  {
    title: "GLK-05: a pinned fetch clones and reads its row without taking the scope lock",
    sha: "c".repeat(40),
    expectedLockObservations: [false],
  },
]) {
  test(title, async () => {
    await withWorkspace(async ({ cwd }) => {
      // arrange
      const cloneUrl = "https://example.com/locked-read";
      const marketplace = await marketplaceRecord({
        cwd,
        entries: [
          {
            name: "locked-read",
            source: { source: "url", url: cloneUrl, ...(sha === undefined ? {} : { sha }) },
          },
        ],
        name: "marketplace",
        scope: "project",
      });
      const locations = await saveMarketplaces(cwd, "project", [marketplace]);
      const lockOptions = { lockfilePath: locations.stateLockFile, realpath: false };
      const lockObservations: boolean[] = [];
      const fetchWithStatus = createFetchPlugins({
        makePresenceProbe,
        async resolveListCandidate(entry, marketplaceContext, statusLocations) {
          lockObservations.push(await lockfile.check(locations.extensionRoot, lockOptions));
          return resolveListCandidate(entry, marketplaceContext, statusLocations);
        },
      });
      const seam: FetchCloneCacheSeam = {
        materializeOrRefreshPluginMirror: () =>
          Promise.resolve({ pluginRoot: path.join(cwd, "absent"), resolvedSha: "6".repeat(40) }),
        materializePluginClone: () => Promise.resolve(path.join(cwd, "absent")),
        resolvePluginPin: () => Promise.resolve({ cloneUrl, pin: sha ?? "unpinned" }),
      };
      const boundary = notificationBoundary("locked read");

      // act
      await fetchWithStatus({
        cloneCacheSeam: seam,
        ctx: boundary.ctx,
        cwd,
        run: boundary.run,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "locked-read" },
      });

      // assert
      assert.deepStrictEqual(boundary.notifications, [
        { message: "● marketplace [project]\n  ◌ locked-read (remote)" },
      ]);
      assert.deepStrictEqual(lockObservations, expectedLockObservations);
      assert.strictEqual(await lockfile.check(locations.extensionRoot, lockOptions), false);
      verifyNotifications(boundary);
    });
  });
}

test("GLK-05: a lock lost after the locked fetch read its row fails the row as lock held", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/lost-lock";
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "lost-lock", source: { source: "url", url: cloneUrl } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const lockOptions = { lockfilePath: locations.stateLockFile, realpath: false };
    const fetchWithStatus = createFetchPlugins({
      makePresenceProbe,
      async resolveListCandidate(entry, marketplaceContext, statusLocations) {
        const candidate = await resolveListCandidate(entry, marketplaceContext, statusLocations);
        await lockfile.unlock(locations.extensionRoot, lockOptions);
        return candidate;
      },
    });
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror: () =>
        Promise.resolve({ pluginRoot: path.join(cwd, "absent"), resolvedSha: "6".repeat(40) }),
      materializePluginClone: () => assert.fail("an unpinned fetch never clones by sha"),
      resolvePluginPin: () => assert.fail("an unpinned fetch never resolves a pin"),
    };
    const boundary = notificationBoundary("lost lock");

    // act
    await fetchWithStatus({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "lost-lock" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● marketplace [project]\n  ⊘ lost-lock (failed) {lock held}\n    cause: Lock is already released",
        severity: "error",
      },
    ]);
    assert.strictEqual(await lockfile.check(locations.extensionRoot, lockOptions), false);
    verifyNotifications(boundary);
  });
});

test("GLK-07: a fetched row shows the version its plugin.json declares over its entry's", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const cloneUrl = "https://example.com/declared";
    const pin = "d".repeat(40);
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "declared", source: { source: "url", url: cloneUrl, sha: pin }, version: "1.0.0" },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, pin));
    const seam: FetchCloneCacheSeam = {
      materializeOrRefreshPluginMirror: () =>
        assert.fail("a pinned source never refreshes a mirror"),
      async materializePluginClone() {
        await writePluginTree(cloneRoot, "declared", "2.0.0");
        return cloneRoot;
      },
      resolvePluginPin: () => Promise.resolve({ cloneUrl, pin }),
    };
    const boundary = notificationBoundary("declared version");

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "declared" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ declared v2.0.0 (available)" },
    ]);
    verifyNotifications(boundary);
  });
});

test("GLK-07: a skipped path row shows the version its plugin.json declares over its entry's", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "path-plugin", source: "./path-plugin", version: "1.0.0" }],
      name: "marketplace",
      scope: "project",
    });
    await writePluginTree(
      path.join(marketplace.marketplaceRoot, "path-plugin"),
      "path-plugin",
      "2.0.0",
    );
    await saveMarketplaces(cwd, "project", [marketplace]);
    const boundary = notificationBoundary("path declared version");

    // act
    await fetchPlugins({
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "path-plugin" },
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ path-plugin v2.0.0 (skipped) {up-to-date}" },
    ]);
    verifyNotifications(boundary);
  });
});

for (const { implementation, inventory, row } of [
  {
    implementation: "adapter",
    inventory: { commands: [adapterCommand()] },
    row: "  ○ events v1.0.0 (available)",
  },
  {
    implementation: "none",
    inventory: {},
    row: "  ○ events v1.0.0 (available)",
  },
  {
    implementation: "builtin",
    inventory: { tools: [builtinMcpTool()], commands: [builtinMcpCommand()] },
    row: "  ⊖ events v1.0.0 (partially-available) {unsupported mcp}",
  },
] as const) {
  test(`P3-DC-25: under ${implementation} a fetched sse-only plugin reads for that implementation`, async () => {
    await withWorkspace(async ({ cwd }) => {
      // arrange
      const eventsUrl = "https://example.com/events";
      const eventsPin = "cccccccccccccccccccccccccccccccccccccccc";
      const fixture = path.join(cwd, "fixture");
      await writePluginTree(fixture, "events", "1.0.0");
      await writeFile(
        path.join(fixture, ".mcp.json"),
        JSON.stringify({ mcpServers: { events: { type: "sse", url: "http://127.0.0.1:9/sse" } } }),
      );
      const marketplace = await marketplaceRecord({
        cwd,
        entries: [{ name: "events", source: { source: "url", url: eventsUrl, sha: eventsPin } }],
        name: "marketplace",
        scope: "project",
      });
      await saveMarketplaces(cwd, "project", [marketplace]);
      const git = gitBoundary({ allowedRemoteUrls: [eventsUrl], fixtureSourceDir: fixture });
      const cache = cacheBoundary(git.gitOps);
      const boundary = notificationBoundary(`${implementation} fetch row`);
      const run = runWithSoftDeps(
        softDepStatus({
          getAllTools: () => ("tools" in inventory ? inventory.tools : []),
          getCommands: () => inventory.commands ?? [],
        }),
      );

      // act
      await fetchPlugins({
        cloneCacheSeam: cache.seam,
        ctx: boundary.ctx,
        cwd,
        run,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "events" },
      });

      // assert
      assert.strictEqual(run.softDeps.mcpImplementation, implementation);
      assert.deepStrictEqual(boundary.notifications, [
        { message: ["● marketplace [project]", row].join("\n") },
      ]);
      verifyNotifications(boundary);
    });
  });
}

// ─── OQ-7, D-SG-19: one GitHub transport context per fetch command ──────────

/**
 * OQ-7: a transport context whose user has no ssh setting and whose probe
 * finds no configured ssh, so an `owner/repo` plan clones over HTTPS first.
 * `probes` counts the probes.
 */
function httpsFirstContext(probes: { count: number }): PluginTransportContext {
  return createPluginTransportContext({
    env: {},
    platform: "linux",
    ssh: {
      probe: () => {
        probes.count += 1;
        return Promise.resolve("not-configured");
      },
      userOverride: () => Promise.resolve(false),
      urlRewritten: () => Promise.resolve({ rewritten: false, exitCode: 1 }),
      showsDirectGitHub: () => Promise.resolve({ kind: "ran", direct: true, exitCode: 0 }),
      showsDirectGitHubThroughGit: () => Promise.resolve(true),
    },
  });
}

/** What one clone-cache call received as its transport. */
interface SeenTransport {
  readonly call: string;
  readonly subject: string | undefined;
  readonly sharesNotes: boolean;
  readonly first: string | undefined;
}

/**
 * D-SG-22: whether a note `transport` records reaches the command's own
 * collector in `context`. The note goes under a subject no row reads, so it
 * changes no row.
 */
function reachesCommandNotes(
  transport: CloneTransport,
  context: PluginTransportContext | undefined,
): boolean {
  const note: CloneTransportNote = { note: "via-https", url: "https://github.com/probe.git" };
  transport.notes.record("seam-probe", note);
  return context?.notes.noteFor("seam-probe") === note;
}

/**
 * OQ-7: a seam that clones nothing. Each call records the transport it got
 * and makes its plan, as a clone step would, so the context's checks run.
 */
function transportRecordingSeam(
  cwd: string,
  contexts: readonly PluginTransportContext[],
  seen: SeenTransport[],
): FetchCloneCacheSeam {
  const record = async (call: string, transport: CloneTransport | undefined): Promise<void> => {
    seen.push({
      call,
      subject: transport?.subject,
      sharesNotes: transport !== undefined && reachesCommandNotes(transport, contexts[0]),
      first: transport === undefined ? undefined : (await transport.plan()).first.url,
    });
  };

  return {
    async materializeOrRefreshPluginMirror(args) {
      await record("mirror", args.transport);
      return { pluginRoot: path.join(cwd, "not-written"), resolvedSha: "a".repeat(40) };
    },
    async materializePluginClone(args) {
      await record("clone", args.transport);
      return path.join(cwd, "not-written");
    },
    resolvePluginPin(args) {
      return Promise.resolve({ cloneUrl: "https://github.com/acme/pinned", pin: args.source.sha });
    },
  };
}

test("OQ-7, D-SG-19: a fetch makes one transport context, and every clone-cache call of its sweep plans over it", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        { name: "pinned", source: { source: "github", repo: "acme/pinned", sha: "8".repeat(40) } },
        { name: "moving", source: { source: "github", repo: "acme/moving" } },
      ],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const probes = { count: 0 };
    const contexts: PluginTransportContext[] = [];
    const seen: SeenTransport[] = [];
    const fetchWithContexts = createFetchPlugins(
      { makePresenceProbe, resolveListCandidate },
      () => {
        const context = httpsFirstContext(probes);
        contexts.push(context);
        return context;
      },
    );
    const boundary = notificationBoundary("one transport context");

    // act
    await fetchWithContexts({
      cloneCacheSeam: transportRecordingSeam(cwd, contexts, seen),
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "marketplace", marketplace: "marketplace" },
    });

    // assert
    assert.deepStrictEqual(
      { made: contexts.length, probes: probes.count, seen },
      {
        made: 1,
        probes: 1,
        seen: [
          {
            call: "clone",
            subject: "pinned@marketplace",
            sharesNotes: true,
            first: "https://github.com/acme/pinned.git",
          },
          {
            call: "mirror",
            subject: "moving@marketplace",
            sharesNotes: true,
            first: "https://github.com/acme/moving.git",
          },
        ],
      },
    );
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "● marketplace [project]\n  ◌ pinned (remote)\n  ◌ moving (remote)\n\nPlugin fetch: 2 successes",
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("OQ-7: a fetch given a transport context plans over it and makes none", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "moving", source: { source: "github", repo: "acme/moving" } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const probes = { count: 0 };
    const given = httpsFirstContext(probes);
    let made = 0;
    const seen: SeenTransport[] = [];
    const fetchWithContexts = createFetchPlugins(
      { makePresenceProbe, resolveListCandidate },
      () => {
        made += 1;
        return httpsFirstContext(probes);
      },
    );
    const boundary = notificationBoundary("given transport context");

    // act
    await fetchWithContexts({
      cloneCacheSeam: transportRecordingSeam(cwd, [given], seen),
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "moving" },
      transportContext: given,
    });

    // assert
    assert.deepStrictEqual(
      { made, probes: probes.count, seen },
      {
        made: 0,
        probes: 1,
        seen: [
          {
            call: "mirror",
            subject: "moving@marketplace",
            sharesNotes: true,
            first: "https://github.com/acme/moving.git",
          },
        ],
      },
    );
    verifyNotifications(boundary);
  });
});

test("D-SG-19: two fetch commands make two transport contexts", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "moving", source: { source: "github", repo: "acme/moving" } }],
      name: "marketplace",
      scope: "project",
    });
    await saveMarketplaces(cwd, "project", [marketplace]);
    const probes = { count: 0 };
    const contexts: PluginTransportContext[] = [];
    const fetchWithContexts = createFetchPlugins(
      { makePresenceProbe, resolveListCandidate },
      () => {
        const context = httpsFirstContext(probes);
        contexts.push(context);
        return context;
      },
    );
    const fetchOnce = async (): Promise<void> => {
      const boundary = notificationBoundary("one of two fetches");
      await fetchWithContexts({
        cloneCacheSeam: transportRecordingSeam(cwd, [], []),
        ctx: boundary.ctx,
        cwd,
        run: boundary.run,
        scope: "project",
        target: { kind: "plugin", marketplace: "marketplace", plugin: "moving" },
      });
      verifyNotifications(boundary);
    };

    // act
    await fetchOnce();
    await fetchOnce();

    // assert
    assert.deepStrictEqual(
      { made: contexts.length, distinct: contexts[0] !== contexts[1], probes: probes.count },
      { made: 2, distinct: true, probes: 2 },
    );
  });
});

test("NFR-5: a fetch of a pinned github plugin whose clone is warm asks no transport check", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const pin = "9".repeat(40);
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [
        {
          name: "warm",
          source: { source: "github", repo: "acme/warm", sha: pin },
          version: "1.0.0",
        },
      ],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    await writePluginTree(
      await locations.pluginCloneDir(pluginCloneKey("https://github.com/acme/warm", pin)),
      "warm",
      "1.0.0",
    );
    const unasked = (): Promise<never> => Promise.reject(new Error("no plan is made"));
    const seen: SeenTransport[] = [];
    const boundary = notificationBoundary("warm pinned github");

    // act
    await fetchPlugins({
      cloneCacheSeam: transportRecordingSeam(cwd, [], seen),
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "warm" },
      transportContext: createPluginTransportContext({
        env: {},
        platform: "linux",
        ssh: {
          probe: unasked,
          userOverride: unasked,
          urlRewritten: unasked,
          showsDirectGitHub: unasked,
          showsDirectGitHubThroughGit: unasked,
        },
      }),
    });

    // assert
    assert.deepStrictEqual(seen, []);
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ⊘ warm v1.0.0 (skipped) {up-to-date}" },
    ]);
    verifyNotifications(boundary);
  });
});

// ─── D-SG-22: each fetched row names the transport of its own clone ─────────

/** D-SG-22: `ghp@marketplace` from github `acme/ghp`, pinned at `pin`, in `scope`. */
async function seedPinnedGitHubPlugin(
  cwd: string,
  scope: Scope,
  pin: string,
  version?: string,
): Promise<ScopedLocations> {
  const marketplace = await marketplaceRecord({
    cwd,
    entries: [
      {
        name: "ghp",
        source: { source: "github", repo: "acme/ghp", sha: pin },
        ...(version === undefined ? {} : { version }),
      },
    ],
    name: "marketplace",
    scope,
  });
  return saveMarketplaces(cwd, scope, [marketplace]);
}

test("D-SG-22: a fetch that clones a github plugin names the transport under its row", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const pin = "1".repeat(40);
    await seedPinnedGitHubPlugin(cwd, "project", pin, "1.0.0");
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "ghp", "1.0.0");
    const git = gitBoundary({
      allowedRemoteUrls: ["https://github.com/acme/ghp.git"],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const boundary = notificationBoundary("github clone note");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "ghp" },
      transportContext: httpsFirstContext({ count: 0 }),
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "● marketplace [project]",
          "  ○ ghp v1.0.0 (available)",
          "    SSH not configured, cloning via HTTPS: https://github.com/acme/ghp.git",
        ].join("\n"),
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("D-SG-22: a fetch whose github clone fails names each attempt under its failed row", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    await seedPinnedGitHubPlugin(cwd, "project", "2".repeat(40));
    const git = gitBoundary({
      allowedRemoteUrls: ["https://github.com/acme/ghp.git", "git@github.com:acme/ghp.git"],
      cloneError: cloneFailure({ kind: "network", curlCode: 7 }),
    });
    const cache = cacheBoundary(git.gitOps);
    const boundary = notificationBoundary("failed github clone note");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "ghp" },
      transportContext: httpsFirstContext({ count: 0 }),
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● marketplace [project]",
          "  ⊘ ghp (failed) {network unreachable}",
          "    SSH not configured, cloning via HTTPS: https://github.com/acme/ghp.git",
          "    HTTPS clone failed, retrying with SSH: git@github.com:acme/ghp.git",
          "    cause: git clone failed: network, exit code 128",
          "The retry over SSH failed too: git clone failed: network, exit code 128",
          "Check the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again. -> git clone failed: network, exit code 128",
        ].join("\n"),
        severity: "error",
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("D-SG-22: a sweep of one plugin in two scopes names each clone under its own scope's row only", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const projectPin = "3".repeat(40);
    const userPin = "4".repeat(40);
    await seedPinnedGitHubPlugin(cwd, "project", projectPin, "1.0.0");
    await seedPinnedGitHubPlugin(cwd, "user", userPin);
    const fixture = path.join(cwd, "fixture");
    await writePluginTree(fixture, "ghp", "1.0.0");
    const git = gitBoundary({
      allowedRemoteUrls: ["https://github.com/acme/ghp.git"],
      fixtureSourceDir: fixture,
    });
    const cache = cacheBoundary(git.gitOps);
    const seam: FetchCloneCacheSeam = {
      ...cache.seam,
      resolvePluginPin(args) {
        return args.source.sha === userPin
          ? Promise.reject(cloneFailure({ kind: "network", curlCode: 7 }))
          : cache.seam.resolvePluginPin(args);
      },
    };
    const boundary = notificationBoundary("two scopes, one clone");

    // act
    await fetchPlugins({
      cloneCacheSeam: seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      target: { kind: "marketplace", marketplace: "marketplace" },
      transportContext: httpsFirstContext({ count: 0 }),
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● marketplace [project]",
          "  ○ ghp v1.0.0 (available)",
          "    SSH not configured, cloning via HTTPS: https://github.com/acme/ghp.git",
          "",
          "● marketplace [user]",
          "  ⊘ ghp (failed) {network unreachable}",
          "    cause: git clone failed: network, exit code 128",
          "",
          "Plugin fetch: 1 failure, 1 success",
        ].join("\n"),
        severity: "error",
      },
    ]);
    verifyNotifications(boundary);
  });
});

test("D-SG-22, OQ-3: a fetch that finds its github mirror current names no clone", async () => {
  await withWorkspace(async ({ cwd }) => {
    // arrange
    const head = "5".repeat(40);
    const marketplace = await marketplaceRecord({
      cwd,
      entries: [{ name: "moving", source: { source: "github", repo: "acme/moving", ref: "main" } }],
      name: "marketplace",
      scope: "project",
    });
    const locations = await saveMarketplaces(cwd, "project", [marketplace]);
    const mirrorRoot = await locations.pluginCloneDir(
      pluginMirrorKey("https://github.com/acme/moving"),
    );
    await writePluginTree(mirrorRoot, "moving", "3.0.0");
    await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
    await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${head}\n`);
    const git = gitBoundary({
      allowedRemoteUrls: ["https://github.com/acme/moving", "https://github.com/acme/moving.git"],
      head,
      localRefs: { "refs/heads/main": head },
      remoteHead: head,
      remoteRefs: { "refs/remotes/origin/main": head },
    });
    const cache = cacheBoundary(git.gitOps);
    const boundary = notificationBoundary("current github mirror");

    // act
    await fetchPlugins({
      cloneCacheSeam: cache.seam,
      ctx: boundary.ctx,
      cwd,
      run: boundary.run,
      scope: "project",
      target: { kind: "plugin", marketplace: "marketplace", plugin: "moving" },
      transportContext: httpsFirstContext({ count: 0 }),
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● marketplace [project]\n  ○ moving v3.0.0 (available)" },
    ]);
    assert.deepStrictEqual(git.schedule, [
      "resolve-local HEAD",
      "resolve-remote https://github.com/acme/moving.git ref=main auth=github.com",
      "resolve-local HEAD",
    ]);
    verifyNotifications(boundary);
  });
});
