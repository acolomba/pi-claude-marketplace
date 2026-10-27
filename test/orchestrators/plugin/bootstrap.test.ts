// Owner suite for orchestrators/plugin/bootstrap.ts.
// behavioral-composition-exception: bootstrapClaudePlugin
//
// D-115-03: bootstrap's contract is the on-disk user scope it leaves behind, so
// every case drives the real `addMarketplace` + `setMarketplaceAutoupdate`
// composition against a case-owned temporary tree and fakes only the git
// remote. Notification bytes follow the compact MarketplaceRow forms of
// CMC-28 / CMC-30 / CMC-33; SNM-33 / D-22-01 / D-22-03 keep the `/reload`
// trailer off every marketplace-status-only block, because a marketplace
// record and its autoupdate flag are not Pi-visible resources.

import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  bootstrapClaudePlugin,
  BootstrapStepError,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import { retryTree } from "./scope-tree-inventory.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
const BOOTSTRAP_REMOTE = "https://github.com/anthropics/claude-plugins-official.git";
const BOOTSTRAP_MANIFEST_JSON = JSON.stringify({
  name: "claude-plugins-official",
  owner: { name: "Quick 260516-02r Tests" },
  plugins: [
    {
      name: "stub",
      source: "./plugins/stub",
      description: "Stub plugin for bootstrap fixture",
      version: "1.0.0",
    },
  ],
});

function fixtureClaudePluginsOfficial(): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "_fixtures",
    "claude-plugins-official",
  );
}

interface BootstrapGitOptions {
  readonly cloneError?: Error;
}

/**
 * The single network edge. `allowedRemoteUrls` carries exactly the canonical
 * Anthropic remote, so any other remote fails the clone immediately; that
 * refusal, not the absence of a call, is what keeps these cases offline.
 */
function createBootstrapGitOps(options: BootstrapGitOptions = {}): {
  readonly gitOps: GitOps;
  readonly clonedUrls: () => readonly string[];
} {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [BOOTSTRAP_REMOTE],
    cloneFixture: { boundary: "local", sourceDir: fixtureClaudePluginsOfficial() },
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(cloneOptions) {
      // The fake records its arguments through `structuredClone`, and `auth`
      // carries credential callbacks, which are not structured-cloneable.
      const { auth: _auth, ...transportOptions } = cloneOptions;
      await git.gitOps.clone(transportOptions);
    },
  };

  return {
    gitOps,
    clonedUrls: () => git.state.calls.clone.map((call) => call.url),
  };
}

/** A missing-dependency step that finds nothing to install in the user scope. */
const noDependencyInstalls: ScopeDependencyInstallFn = () =>
  Promise.resolve({ rows: [], mcpConfigNotices: [] });

interface DependencyInstallCall {
  readonly scope: Scope;
  readonly cwd: string;
  readonly selects: readonly boolean[];
}

/**
 * A recording missing-dependency step (D-PL2-09). Each call records the
 * request's scope and cwd, and what `select` answers for an entry of the
 * official marketplace and one of another marketplace.
 */
function recordingDependencyInstall(result: ScopeDependencyInstallResult): {
  readonly installMissingDependencies: ScopeDependencyInstallFn;
  readonly calls: DependencyInstallCall[];
} {
  const calls: DependencyInstallCall[] = [];
  const installMissingDependencies: ScopeDependencyInstallFn = (request) => {
    calls.push({
      scope: request.scope,
      cwd: request.cwd,
      selects: [
        request.select({
          plugin: "lib",
          marketplace: "claude-plugins-official",
          declarers: ["app@tools"],
        }),
        request.select({ plugin: "lib", marketplace: "other", declarers: ["app@tools"] }),
      ],
    });
    return Promise.resolve(result);
  };

  return { installMissingDependencies, calls };
}

/** A missing-dependency step a case promises is never reached. */
function unreachedDependencyInstall(): ScopeDependencyInstallFn {
  return () => Promise.reject(new Error("the missing-dependency step must not run"));
}

async function createHermeticUserScope(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly locations: ScopedLocations }> {
  const { cwd } = await createHermeticEnvironment(t, `bootstrap-${label}-`);
  return { cwd, locations: locationsFor("user", cwd) };
}

function addedMarketplaceRecord(cwd: string, marketplaceRoot: string): MarketplaceRecord {
  return {
    name: "claude-plugins-official",
    scope: "user",
    source: {
      kind: "github",
      raw: "anthropics/claude-plugins-official",
      owner: "anthropics",
      repo: "claude-plugins-official",
    },
    addedFromCwd: cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {},
  };
}

/** SPLIT-01: the marketplace record lives in state, the autoupdate flag in config. */
async function seedAddedMarketplace(
  locations: ScopedLocations,
  cwd: string,
  autoupdate: boolean,
  configPath = locations.baseConfigJsonPath,
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: { "claude-plugins-official": addedMarketplaceRecord(cwd, marketplaceRoot) },
  });
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        marketplaces: {
          "claude-plugins-official": {
            source: "anthropics/claude-plugins-official",
            autoupdate,
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

/** Every path a clean bootstrap leaves under the user scope root. */
function bootstrappedScopeTree(): readonly string[] {
  return [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/sources/",
    "pi-claude-marketplace/sources/claude-plugins-official/",
    "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/",
    "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/marketplace.json",
    "pi-claude-marketplace/sources/claude-plugins-official/.git/",
    "pi-claude-marketplace/sources/claude-plugins-official/.git/pi-claude-marketplace.json",
    "pi-claude-marketplace/sources-staging/",
    "pi-claude-marketplace/state.json",
  ];
}

/** The seeded tree, which a bootstrap that clones nothing leaves as it is. */
function seededScopeTree(): readonly string[] {
  return ["claude-plugins.json", "pi-claude-marketplace/", "pi-claude-marketplace/state.json"];
}

test("adds the canonical marketplace and enables autoupdate on a clean user scope", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "clean");
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-02-03T04:05:06.000Z") });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const completionCache = createCompletionCache();
  const peerCompletionCache = createCompletionCache();
  const pluginCachePath = await locations.pluginCacheFile("claude-plugins-official");
  await completionCache.getPluginIndex(pluginCachePath, "user", "claude-plugins-official", () =>
    Promise.resolve([{ name: "owner-stale", status: "available" }]),
  );
  await rm(pluginCachePath, { force: true });
  await peerCompletionCache.getPluginIndex(pluginCachePath, "user", "claude-plugins-official", () =>
    Promise.resolve([{ name: "peer-stale", status: "available" }]),
  );
  await rm(path.dirname(path.dirname(pluginCachePath)), { force: true, recursive: true });

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });
  const scopeTree = await retryTree(locations.scopeRoot);
  const ownerRows = await completionCache.getPluginIndex(
    pluginCachePath,
    "user",
    "claude-plugins-official",
    () => Promise.resolve([{ name: "owner-fresh", status: "available" }]),
  );
  const peerRows = await peerCompletionCache.getPluginIndex(
    pluginCachePath,
    "user",
    "claude-plugins-official",
    () => Promise.reject(new Error("the peer cache must retain its warmed row")),
  );

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    // UXG-04: a fresh autoupdate enable renders the marker as the outcome.
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {
      "claude-plugins-official": {
        ...addedMarketplaceRecord(cwd, marketplaceRoot),
        lastSuccessfulManifest: BOOTSTRAP_MANIFEST_JSON,
        lastUpdatedAt: "2026-02-03T04:05:06.000Z",
      },
    },
  });
  // WB-04: both composed writes converge on one config entry.
  assert.deepStrictEqual(JSON.parse(await readFile(locations.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  assert.deepStrictEqual(scopeTree, bootstrappedScopeTree());
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  assert.deepStrictEqual(ownerRows, [{ name: "owner-fresh", status: "available" }]);
  assert.deepStrictEqual(peerRows, [{ name: "peer-stale", status: "available" }]);
  verifyBoundary();
});

test("D-PL2-09: hands its missing-dependency step to the add, which runs it in the user scope for the official marketplace and lists its rows under the added row", async (t) => {
  // arrange
  const { cwd } = await createHermeticUserScope(t, "dependency-step");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps } = createBootstrapGitOps();
  const step = recordingDependencyInstall({
    rows: [
      {
        status: "installed",
        name: "lib@claude-plugins-official",
        version: "1.0.0",
        dependencies: [],
        reasons: ["dependency installed"],
        severity: "info",
        needsReload: true,
      },
    ],
    mcpConfigNotices: [],
  });

  // act
  await bootstrapClaudePlugin({
    completionCache: createCompletionCache(),
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: step.installMissingDependencies,
  });

  // assert
  assert.deepStrictEqual(step.calls, [{ scope: "user", cwd, selects: [true, false] }]);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● claude-plugins-official [user] (added)\n" +
        "  ● lib@claude-plugins-official v1.0.0 (installed) {dependency installed}\n" +
        "\n" +
        "/reload to pick up changes",
    },
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  verifyBoundary();
});

test("a missing-dependency step that throws after the add committed still turns on autoupdate and rejects with the step error instead of reporting a failed add", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "dependency-step-throws");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps } = createBootstrapGitOps();
  const stepError = Object.assign(new Error("dependency copy vanished"), { code: "ENOENT" });

  // act
  const bootstrap = bootstrapClaudePlugin({
    completionCache: createCompletionCache(),
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: () => Promise.reject(stepError),
  });

  // assert
  await assert.rejects(bootstrap, (err: unknown) => {
    assert.ok(err instanceof BootstrapStepError);
    assert.strictEqual(err.name, "BootstrapStepError");
    assert.strictEqual(err.cause, stepError);
    return true;
  });
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(locations.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  verifyBoundary();
});

test("converges on a second bootstrap without changing the recorded state or the tree", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "repeat");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(4);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });
  const stateAfterFirst = await readFile(locations.stateJsonPath, "utf8");
  const configAfterFirst = await readFile(locations.baseConfigJsonPath, "utf8");
  const treeAfterFirst = await retryTree(locations.scopeRoot);
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
    // MPA-01: the re-run reports the add as a no-op, then the idempotent
    // autoupdate row; both benign reasons route to info, which the renderer
    // emits with no severity argument (UXG-02 / UXG-04).
    { message: "● claude-plugins-official [user] (skipped) {already added}" },
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateAfterFirst);
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), configAfterFirst);
  assert.deepStrictEqual(treeAfterFirst, bootstrappedScopeTree());
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), treeAfterFirst);
  // WR-05: the re-run's source matches the recorded one, so it is recognized
  // before any clone.
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("MPA-01: reports an already added marketplace and an idempotent autoupdate when already bootstrapped", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "already");
  await seedAddedMarketplace(locations, cwd, true);
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const seededConfig = await readFile(locations.baseConfigJsonPath, "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: unreachedDependencyInstall(),
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (skipped) {already added}" },
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  // RECON-05: an idempotent flip skips the write-back, so the config stays byte-stable.
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), seededConfig);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
  assert.deepStrictEqual(clonedUrls(), []);
  verifyBoundary();
});

test("flips autoupdate on when the marketplace is added but autoupdate is off", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "half");
  await seedAddedMarketplace(locations, cwd, false);
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: unreachedDependencyInstall(),
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (skipped) {already added}" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(locations.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  // WR-05: the flip is a config write-back only; state.json is never rewritten.
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
  assert.deepStrictEqual(clonedUrls(), []);
  verifyBoundary();
});

test("LAYER-01: declares a marketplace only the local layer holds in the base layer without a clone", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "local-only");
  await seedAddedMarketplace(locations, cwd, false, locations.localConfigJsonPath);
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const seededLocalConfig = await readFile(locations.localConfigJsonPath, "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(locations.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), seededLocalConfig);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  assert.deepStrictEqual(clonedUrls(), []);
  verifyBoundary();
});

test("preserves the committed add when the real autoupdate child rejects its config", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "autoupdate-failure");
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-02-03T04:05:06.000Z") });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();
  const ownedCache = createCompletionCache();
  const malformedConfig = "{ malformed";
  const completionCache: CompletionCache = {
    getPluginIndex: (...args) => ownedCache.getPluginIndex(...args),
    invalidateMarketplaceCache: (scope, marketplace) => {
      ownedCache.invalidateMarketplaceCache(scope, marketplace);
    },
    invalidateMarketplaceNames: (marketplaceNamesCachePath, scope) =>
      ownedCache.invalidateMarketplaceNames(marketplaceNamesCachePath, scope),
    async dropMarketplaceCache(pluginCachePath, scope, marketplace) {
      await ownedCache.dropMarketplaceCache(pluginCachePath, scope, marketplace);
      await writeFile(locations.baseConfigJsonPath, malformedConfig, "utf8");
    },
  };

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    {
      message: [
        "Some operations have failed.",
        "",
        "⊘ claude-plugins-official [user] (failed)",
        "  ⊘ claude-plugins-official (failed) {invalid manifest}",
        '    cause: Config file "claude-plugins.json" failed schema validation.',
      ].join("\n"),
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {
      "claude-plugins-official": {
        ...addedMarketplaceRecord(cwd, marketplaceRoot),
        lastSuccessfulManifest: BOOTSTRAP_MANIFEST_JSON,
        lastUpdatedAt: "2026-02-03T04:05:06.000Z",
      },
    },
  });
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), malformedConfig);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), bootstrappedScopeTree());
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("writes into the user scope only and leaves the project scope absent", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "user-only");
  const projectLocations = locationsFor("project", cwd);
  const { ctx, verifyBoundary } = createNotificationBoundary(2);
  const { gitOps } = createBootstrapGitOps();
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: noDependencyInstalls,
  });

  // assert
  assert.deepStrictEqual(await retryTree(projectLocations.scopeRoot), []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), bootstrappedScopeTree());
  verifyBoundary();
});

test("propagates a clone failure silently and never reaches the autoupdate step", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "clone-failure");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const { gitOps, clonedUrls } = createBootstrapGitOps({ cloneError: new Error("network down") });
  const completionCache = createCompletionCache();

  // act & assert
  await assert.rejects(
    bootstrapClaudePlugin({
      completionCache,
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      gitOps,
      installMissingDependencies: unreachedDependencyInstall(),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, "network down");
      return true;
    },
  );
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), ["pi-claude-marketplace/"]);
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("renders a failed add as marketplace add does and never reaches the missing-dependency or autoupdate step", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "missing-source");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cloneError = Object.assign(new Error("HTTP Error: 404"), {
    code: "HttpError",
    data: { statusCode: 404 },
  });
  const { gitOps, clonedUrls } = createBootstrapGitOps({ cloneError });
  const completionCache = createCompletionCache();

  // act
  await bootstrapClaudePlugin({
    completionCache,
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: unreachedDependencyInstall(),
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n" +
        "⊘ anthropics/claude-plugins-official [user] (failed) {source missing}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), ["pi-claude-marketplace/"]);
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("MPA-01: refuses a different source under the official name as a duplicate name and never reaches the autoupdate step", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "fork");
  await mkdir(locations.extensionRoot, { recursive: true });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      "claude-plugins-official": {
        ...addedMarketplaceRecord(cwd, marketplaceRoot),
        source: {
          kind: "github",
          raw: "fork/claude-plugins-official",
          owner: "fork",
          repo: "claude-plugins-official",
        },
      },
    },
  });
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const { gitOps } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({
    completionCache: createCompletionCache(),
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps,
    installMissingDependencies: unreachedDependencyInstall(),
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ claude-plugins-official [user] (failed) {duplicate name}",
      severity: "error",
    },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  verifyBoundary();
});
