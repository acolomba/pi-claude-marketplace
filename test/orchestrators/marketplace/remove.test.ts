import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import {
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  MarketplaceRemoveFailureError,
  removeMarketplace,
  type RemoveMarketplaceOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { buildScopeDeclarationIndex } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import {
  loadConfig,
  saveConfig,
} from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import {
  locationsFor,
  type ScopedLocations,
} from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  MarketplaceNotFoundError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import {
  stateLockHeldCause as lockHeldCause,
  whileStateLockHeld as whileLockHeld,
} from "../state-lock.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

interface NotificationCall {
  readonly message: string;
  readonly severity?: string;
}

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface NotificationBoundary {
  readonly ctx: ExtensionContext;
  readonly run: NotificationRun;
  readonly calls: NotificationCall[];
  verifyInteractions(): void;
}

type InvalidationCall =
  | { readonly kind: "names"; readonly path: string; readonly scope: Scope }
  | {
      readonly kind: "plugins";
      readonly marketplace: string;
      readonly path: string;
      readonly scope: Scope;
    };

function recordingCompletionCache(calls: InvalidationCall[]): CompletionCache {
  const delegate = createCompletionCache();
  return {
    getPluginIndex: (pluginCachePath, scope, marketplace, rebuild, options) =>
      delegate.getPluginIndex(pluginCachePath, scope, marketplace, rebuild, options),
    invalidateMarketplaceCache: (scope, marketplace) => {
      delegate.invalidateMarketplaceCache(scope, marketplace);
    },
    invalidateMarketplaceNames: async (marketplaceNamesCachePath, scope) => {
      calls.push({ kind: "names", path: marketplaceNamesCachePath, scope });
      await delegate.invalidateMarketplaceNames(marketplaceNamesCachePath, scope);
    },
    dropMarketplaceCache: async (pluginCachePath, scope, marketplace) => {
      calls.push({ kind: "plugins", path: pluginCachePath, scope, marketplace });
      await delegate.dropMarketplaceCache(pluginCachePath, scope, marketplace);
    },
  };
}

/**
 * The strict context boundary, sized to the emissions the case promises.
 * `noticeCalls` counts the MCP config notifications sent after the row. Each
 * one reads `ctx.mode` and `ctx.ui` and calls `notify` once.
 * D-05: every emission renders from the run's snapshot, so no tool inventory
 * is present to probe.
 */
function notificationBoundary(expectedCalls: 0 | 1, noticeCalls: 0 | 1 = 0): NotificationBoundary {
  const calls: NotificationCall[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  if (expectedCalls === 1) {
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(1 + noticeCalls);
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(1 + noticeCalls);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        calls.push(severity === undefined ? { message } : { message, severity });
      })
      .times(1 + noticeCalls);
  }

  return {
    ctx,
    run: runWithNothingLoaded(),
    calls,
    verifyInteractions(): void {
      verify(ctx);
      verify(ui);
    },
  };
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type CascadeDropped = Awaited<ReturnType<typeof cascadeUnstagePlugin>>["dropped"];

function pluginRecord(resources: Partial<PluginRecord["resources"]> = {}): PluginRecord {
  return {
    version: "1.2.3",
    resolvedSource: "/fixtures/plugin",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      agents: resources.agents ?? [],
      hooks: resources.hooks ?? [],
      mcpServers: resources.mcpServers ?? [],
      prompts: resources.prompts ?? [],
      skills: resources.skills ?? [],
      workflows: resources.workflows ?? [],
    },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };
}

function emptyDropped(): CascadeDropped {
  return { agents: [], commands: [], hooks: [], mcpServers: [], skills: [], workflows: [] };
}

const unreachableCascade: typeof cascadeUnstagePlugin = () => {
  assert.fail("this remove must not unstage any plugin");
};

function marketplaceState(args: {
  readonly cwd: string;
  readonly name: string;
  readonly plugins?: Record<string, PluginRecord>;
  readonly scope: "project" | "user";
  readonly source: unknown;
}): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      [args.name]: {
        name: args.name,
        scope: args.scope,
        source: args.source,
        addedFromCwd: args.cwd,
        manifestPath: path.join(args.cwd, "marketplace.json"),
        marketplaceRoot: path.join(args.cwd, "marketplace"),
        plugins: args.plugins ?? {},
      },
    },
  };
}

async function seedMarketplace(
  locations: ScopedLocations,
  args: {
    readonly cwd: string;
    readonly name: string;
    readonly plugins?: Record<string, PluginRecord>;
    readonly source: unknown;
  },
): Promise<void> {
  await saveState(locations.extensionRoot, marketplaceState({ ...args, scope: locations.scope }));
}

async function projectCase(
  testContext: TestContext,
): Promise<{ cwd: string; locations: ScopedLocations }> {
  // WPTH-04: `workflowsSavedDir` sits under the engine's storage root, which
  // `PI_CODING_AGENT_DIR` or else `os.homedir()` decides, so a cascade unlinking
  // a recorded envelope would reach the real user's saved workflows unless both
  // are relocated before the bundle is built. `createHermeticEnvironment`
  // relocates HOME and PI_CODING_AGENT_DIR and registers their restore, which
  // is what keeps that reach contained here.
  const { cwd } = await createHermeticEnvironment(testContext, "marketplace-remove-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return { cwd, locations };
}

/**
 * Write one saved workflow envelope at its recorded name. Composed with
 * `path.join` rather than the asynchronous `locations.workflowArtifactPath`, so
 * a forgotten `await` cannot yield a leaf named after a promise.
 */
async function seedWorkflowEnvelope(
  locations: ScopedLocations,
  generatedName: string,
): Promise<string> {
  const target = path.join(locations.workflowsSavedDir, `${generatedName}.json`);
  await mkdir(locations.workflowsSavedDir, { recursive: true });
  await writeFile(
    target,
    JSON.stringify({
      name: generatedName,
      description: "greets",
      script: 'export const meta = { name: "greet", description: "greets" };\n',
    }),
  );
  return target;
}

async function dualScopeCase(testContext: TestContext): Promise<{
  cwd: string;
  projectLocations: ScopedLocations;
  userLocations: ScopedLocations;
}> {
  const { cwd } = await createHermeticEnvironment(testContext, "marketplace-remove-scopes-");
  const projectLocations = locationsFor("project", cwd);
  const userLocations = locationsFor("user", cwd);
  await Promise.all([
    mkdir(projectLocations.extensionRoot, { recursive: true }),
    mkdir(userLocations.extensionRoot, { recursive: true }),
  ]);
  return { cwd, projectLocations, userLocations };
}

function assertFailedOutcome(
  outcome: RemoveMarketplaceOutcome | undefined,
  expected: {
    readonly cause: string;
    readonly reason: "invalid manifest" | "marketplace not added";
  },
): asserts outcome is Extract<RemoveMarketplaceOutcome, { status: "failed" }> {
  assert.ok(outcome !== undefined);
  assert.strictEqual(outcome.status, "failed");
  if (outcome.status !== "failed") {
    return;
  }

  assert.deepStrictEqual(outcome, {
    status: "failed",
    reason: expected.reason,
    error: outcome.error,
    cause: expected.cause,
  });
  assert.strictEqual(outcome.error.message, expected.cause);
}

test("reports a bare-form missing marketplace searched across both scopes without mutating project state", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const notification = notificationBoundary(1);
  const invalidations: InvalidationCall[] = [];

  // act
  const outcome = await removeMarketplace({
    completionCache: recordingCompletionCache(invalidations),
    ctx: notification.ctx,
    run: notification.run,
    name: "absent",
    cwd,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message: "A marketplace operation has failed.\n\n⊘ absent (failed) {marketplace not added}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(invalidations, []);
  notification.verifyInteractions();
});

test("reports an explicit-scope missing marketplace without mutating project state", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const notification = notificationBoundary(1);
  const invalidations: InvalidationCall[] = [];

  // act
  const outcome = await removeMarketplace({
    completionCache: recordingCompletionCache(invalidations),
    ctx: notification.ctx,
    run: notification.run,
    name: "absent",
    scope: "project",
    cwd,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ absent [project] (failed) {marketplace not added}",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(invalidations, []);
  notification.verifyInteractions();
});

test("invalidates committed full removal after persistence and before data hygiene", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "ordered-remove";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./ordered-remove"),
    plugins: { tool: pluginRecord() },
  });
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { [marketplace]: { source: "./ordered-remove" } },
      plugins: { [`tool@${marketplace}`]: { enabled: true } },
    },
    locations.scopeRoot,
  );
  const marketplaceData = await locations.marketplaceDataDir(marketplace);
  const pluginData = await locations.pluginDataDir(marketplace, "tool");
  await mkdir(pluginData, { recursive: true });
  await writeFile(path.join(pluginData, "sentinel"), "installed");
  const events: string[] = [];
  const delegate = createCompletionCache();
  const completionCache: CompletionCache = {
    ...delegate,
    invalidateMarketplaceNames: async (marketplaceNamesCachePath, scope) => {
      events.push("names");
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 3,
        marketplaces: {},
      });
      const config = await loadConfig(locations.baseConfigJsonPath);
      assert.strictEqual(config.status, "valid");
      if (config.status === "valid") {
        assert.deepStrictEqual(config.config, {
          schemaVersion: 1,
          marketplaces: {},
          plugins: {},
        });
      }

      assert.strictEqual(await pathExists(pluginData), true);
      assert.strictEqual(await pathExists(marketplaceData), true);
      assert.strictEqual(scope, "project");
      assert.strictEqual(marketplaceNamesCachePath, locations.marketplaceNamesCacheFile);
      await delegate.invalidateMarketplaceNames(marketplaceNamesCachePath, scope);
    },
    dropMarketplaceCache: async (pluginCachePath, scope, name) => {
      events.push("plugins");
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 3,
        marketplaces: {},
      });
      assert.strictEqual(await pathExists(pluginData), true);
      assert.strictEqual(await pathExists(marketplaceData), true);
      assert.strictEqual(scope, "project");
      assert.strictEqual(name, marketplace);
      assert.strictEqual(pluginCachePath, await locations.pluginCacheFile(marketplace));
      await delegate.dropMarketplaceCache(pluginCachePath, scope, name);
    },
  };
  const notification = notificationBoundary(1);
  const cascade: typeof cascadeUnstagePlugin = () => {
    events.push("cascade");
    return Promise.resolve({ ok: true, dropped: emptyDropped() });
  };

  // act
  const outcome = await removeMarketplace({
    completionCache,
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(events, ["cascade", "names", "plugins"]);
  assert.strictEqual(await pathExists(pluginData), false);
  assert.strictEqual(await pathExists(marketplaceData), false);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "● ordered-remove [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  notification.verifyInteractions();
});

test("WR-04: a clean removal shows each plugin's skill warnings after its rows", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "warned-remove";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./warned-remove"),
    plugins: { alpha: pluginRecord(), beta: pluginRecord() },
  });
  // The diagnostic after the row reads the context as an MCP notice does.
  const notification = notificationBoundary(1, 1);
  const cascade: typeof cascadeUnstagePlugin = (plugin) =>
    Promise.resolve(
      plugin === "beta"
        ? { ok: true, dropped: emptyDropped(), skillWarnings: ["ledger refused"] }
        : { ok: true, dropped: emptyDropped() },
    );

  // act
  await removeMarketplace({
    completionCache: recordingCompletionCache([]),
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.deepStrictEqual(
    notification.calls.map(({ message }) => message),
    [
      "● warned-remove [project] (removed)\n  ○ alpha (uninstalled)\n  ○ beta (uninstalled)\n\n" +
        "/reload to pick up changes",
      'Plugin "beta" [project] uninstalled; 1 cleanup warning.\n\nledger refused',
    ],
  );
  notification.verifyInteractions();
});

test("invalidates a partial removal while retaining failed plugin data", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "partial-invalidation";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./partial-invalidation"),
    plugins: { alpha: pluginRecord(), beta: pluginRecord() },
  });
  const marketplaceData = await locations.marketplaceDataDir(marketplace);
  const alphaData = await locations.pluginDataDir(marketplace, "alpha");
  const betaData = await locations.pluginDataDir(marketplace, "beta");
  await mkdir(alphaData, { recursive: true });
  await mkdir(betaData, { recursive: true });
  const invalidations: InvalidationCall[] = [];
  const completionCache = recordingCompletionCache(invalidations);
  const notification = notificationBoundary(1);
  const failure = Object.assign(new Error("beta denied"), { code: "EACCES" });
  const cascade: typeof cascadeUnstagePlugin = (plugin) =>
    Promise.resolve(
      plugin === "beta"
        ? { ok: false, dropped: emptyDropped(), cause: failure }
        : { ok: true, dropped: emptyDropped() },
    );

  // act
  const outcome = await removeMarketplace({
    completionCache,
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(invalidations, [
    { kind: "names", path: locations.marketplaceNamesCacheFile, scope: "project" },
    {
      kind: "plugins",
      marketplace,
      path: await locations.pluginCacheFile(marketplace),
      scope: "project",
    },
  ]);
  assert.deepStrictEqual(
    Object.keys(
      (await loadState(locations.extensionRoot)).marketplaces[marketplace]?.plugins ?? {},
    ),
    ["beta"],
  );
  assert.strictEqual(await pathExists(alphaData), false);
  assert.strictEqual(await pathExists(betaData), true);
  assert.strictEqual(await pathExists(marketplaceData), true);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "Some operations have failed.\n\n⊘ partial-invalidation [project] (failed)\n  ○ alpha (uninstalled)\n  ⊘ beta (failed) {permission denied}\n    cause: beta denied\n\n/reload to pick up changes",
      severity: "error",
    },
  ]);
  notification.verifyInteractions();
});

for (const failurePoint of ["names", "plugins"] as const) {
  test(`continues data hygiene after ${failurePoint} invalidation fails`, async (testContext) => {
    // arrange
    const { cwd, locations } = await projectCase(testContext);
    const marketplace = `${failurePoint}-failure`;
    await seedMarketplace(locations, {
      cwd,
      name: marketplace,
      source: pathSource(`./${marketplace}`),
    });
    const marketplaceData = await locations.marketplaceDataDir(marketplace);
    await mkdir(marketplaceData, { recursive: true });
    await writeFile(path.join(marketplaceData, "sentinel"), "data");
    const events: string[] = [];
    const delegate = createCompletionCache();
    const completionCache: CompletionCache = {
      ...delegate,
      invalidateMarketplaceNames: async (marketplaceNamesCachePath, scope) => {
        events.push("names");
        if (failurePoint === "names") {
          throw new Error("names cache denied");
        }

        await delegate.invalidateMarketplaceNames(marketplaceNamesCachePath, scope);
      },
      dropMarketplaceCache: async (pluginCachePath, scope, name) => {
        events.push("plugins");
        if (failurePoint === "plugins") {
          throw new Error("plugin cache denied");
        }

        await delegate.dropMarketplaceCache(pluginCachePath, scope, name);
      },
    };
    const notification = notificationBoundary(1);

    // act
    const outcome = await removeMarketplace({
      completionCache,
      ctx: notification.ctx,
      run: notification.run,
      name: marketplace,
      scope: "project",
      cwd,
    });

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(events, failurePoint === "names" ? ["names"] : ["names", "plugins"]);
    assert.strictEqual(await pathExists(marketplaceData), false);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.deepStrictEqual(notification.calls, [
      { message: `● ${marketplace} [project] (removed)` },
    ]);
    notification.verifyInteractions();
  });
}

test("returns the complete orchestrated missing-marketplace outcome without notifying", async (testContext) => {
  // arrange
  const { cwd, projectLocations, userLocations } = await dualScopeCase(testContext);
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "absent",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assertFailedOutcome(outcome, {
    reason: "marketplace not added",
    cause: 'Marketplace "absent" not found in project, user scopes.',
  });
  assert.ok(outcome.error instanceof MarketplaceNotFoundError);
  assert.deepStrictEqual(outcome.error.scopes, ["project", "user"]);
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("prefers the project marketplace in orchestrated bare form", async (testContext) => {
  // arrange
  const { cwd, projectLocations, userLocations } = await dualScopeCase(testContext);
  const projectState = marketplaceState({
    cwd,
    name: "shared",
    scope: "project",
    source: pathSource("./project"),
  });
  const userState = marketplaceState({
    cwd,
    name: "shared",
    scope: "user",
    source: pathSource("./user"),
  });
  await saveState(projectLocations.extensionRoot, projectState);
  await saveState(userLocations.extensionRoot, userState);
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "shared",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "removed", name: "shared", unstaged: [] });
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await loadState(userLocations.extensionRoot), userState);
  notification.verifyInteractions();
});

test("selects the user marketplace in orchestrated bare form when project is absent", async (testContext) => {
  // arrange
  const { cwd, projectLocations, userLocations } = await dualScopeCase(testContext);
  const userState = marketplaceState({
    cwd,
    name: "user-only",
    scope: "user",
    source: pathSource("./user"),
  });
  await saveState(userLocations.extensionRoot, userState);
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "user-only",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "removed", name: "user-only", unstaged: [] });
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

const SOURCE_CASES = [
  {
    kind: "github",
    source: () => ({ kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" }),
    cloneRemains: false,
  },
  { kind: "path", source: () => pathSource("./marketplace"), cloneRemains: true },
  {
    kind: "unknown",
    source: () => ({ kind: "unknown", raw: "mystery", reason: "unrecognized" }),
    cloneRemains: true,
  },
  {
    kind: "url",
    source: () => parsePluginSource("https://gitlab.example.com/team/marketplace"),
    cloneRemains: false,
  },
  {
    kind: "hosted",
    source: () => parsePluginSource("https://catalog.example/acme/tools/marketplace.json"),
    cloneRemains: false,
  },
] as const;

for (const sourceCase of SOURCE_CASES) {
  test(`fully removes a ${sourceCase.kind} marketplace and applies its clone policy`, async (testContext) => {
    // arrange
    const { cwd, locations } = await projectCase(testContext);
    const marketplace = `${sourceCase.kind}-marketplace`;
    await seedMarketplace(locations, {
      cwd,
      name: marketplace,
      source: sourceCase.source(),
      plugins: { tool: pluginRecord() },
    });
    const cloneDir = await locations.sourceCloneDir(marketplace);
    const dataDir = await locations.pluginDataDir(marketplace, "tool");
    await mkdir(cloneDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(cloneDir, "sentinel"), "clone");
    await writeFile(path.join(dataDir, "sentinel"), "plugin data");
    const cascadeCalls: Array<{
      plugin: string;
      marketplace: string;
      scope: string;
      version: string;
    }> = [];
    const cascade: typeof cascadeUnstagePlugin = (plugin, owner, scoped, record) => {
      cascadeCalls.push({
        plugin,
        marketplace: owner,
        scope: scoped.scope,
        version: record.version,
      });
      return Promise.resolve({ ok: true, dropped: emptyDropped() });
    };

    const notification = notificationBoundary(1);

    // act
    const outcome = await removeMarketplace({
      completionCache: createCompletionCache(),
      ctx: notification.ctx,
      run: notification.run,
      name: marketplace,
      scope: "project",
      cwd,
      cascade,
    });

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(notification.calls, [
      {
        message: `● ${marketplace} [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes`,
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.strictEqual(await pathExists(dataDir), false);
    assert.strictEqual(
      await pathExists(cloneDir),
      sourceCase.cloneRemains,
      `${sourceCase.kind} clone policy`,
    );
    assert.deepStrictEqual(cascadeCalls, [
      { plugin: "tool", marketplace, scope: "project", version: "1.2.3" },
    ]);
    notification.verifyInteractions();
  });
}

test("swallows clone garbage-collection failure and safely reports the retry", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "gc-failure",
    source: pathSource("./gc-failure"),
  });
  await mkdir(path.dirname(locations.pluginClonesDir), { recursive: true });
  await writeFile(locations.pluginClonesDir, "not a directory");
  const firstNotification = notificationBoundary(1);

  // act
  const firstOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: firstNotification.ctx,
    run: firstNotification.run,
    name: "gc-failure",
    scope: "project",
    cwd,
  });
  const retryNotification = notificationBoundary(0);
  const retryOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: retryNotification.ctx,
    run: retryNotification.run,
    name: "gc-failure",
    scope: "user",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.strictEqual(firstOutcome, undefined);
  assert.deepStrictEqual(firstNotification.calls, [
    { message: "● gc-failure [project] (removed)" },
  ]);
  assert.strictEqual(await readFile(locations.pluginClonesDir, "utf8"), "not a directory");
  assertFailedOutcome(retryOutcome, {
    reason: "marketplace not added",
    cause: 'Marketplace "gc-failure" not found in user scope.',
  });
  assert.deepStrictEqual(retryNotification.calls, []);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
});

test("GLK-03 / D-PL7-05: a held scope lock leaves the removed plugins' clone and the remove still succeeds", async (testContext) => {
  // arrange -- the names-cache invalidation runs after the remove's lock is
  // released and before the clone GC, so a second holder taken there holds the
  // lock while the GC tries to take it.
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "tools",
    source: pathSource("./tools"),
    plugins: {
      tool: {
        ...pluginRecord(),
        resolvedSource: path.join(locations.pluginClonesDir, "keyTool"),
        resolvedSha: "1111111111111111111111111111111111111111",
      },
    },
  });
  await mkdir(path.join(locations.pluginClonesDir, "keyTool"), { recursive: true });
  const releases: Array<() => Promise<void>> = [];
  const completionCache: CompletionCache = {
    ...createCompletionCache(),
    invalidateMarketplaceNames: async () => {
      releases.push(
        await lockfile.lock(locations.extensionRoot, {
          lockfilePath: locations.stateLockFile,
          realpath: false,
        }),
      );
    },
  };
  const cascade: typeof cascadeUnstagePlugin = () =>
    Promise.resolve({ ok: true, dropped: emptyDropped() });
  const notification = notificationBoundary(1);

  // act
  let outcome: RemoveMarketplaceOutcome | undefined;
  try {
    outcome = await removeMarketplace({
      completionCache,
      ctx: notification.ctx,
      run: notification.run,
      name: "tools",
      scope: "project",
      cwd,
      cascade,
    });
  } finally {
    await Promise.all(releases.map((release) => release()));
  }

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message: "● tools [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.deepStrictEqual(await readdir(locations.pluginClonesDir), ["keyTool"]);
  notification.verifyInteractions();
});

test("retains the source clone when a forward-compatible recorded kind is unavailable", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "future-source";
  await saveState(
    locations.extensionRoot,
    marketplaceState({
      cwd,
      name: marketplace,
      scope: "project",
      source: { raw: "forward-compatible" },
    }),
  );
  const cloneDir = await locations.sourceCloneDir(marketplace);
  await mkdir(cloneDir, { recursive: true });
  await writeFile(path.join(cloneDir, "sentinel"), "clone");
  const originalKindDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "kind");
  let sourceKindReads = 0;
  Object.defineProperty(Object.prototype, "kind", {
    configurable: true,
    get(this: { readonly raw?: unknown }) {
      if (this.raw !== "forward-compatible") {
        return undefined;
      }

      sourceKindReads += 1;
      return sourceKindReads <= 10 ? "unknown" : "future";
    },
  });
  testContext.after(() => {
    if (originalKindDescriptor === undefined) {
      Reflect.deleteProperty(Object.prototype, "kind");
    } else {
      Object.defineProperty(Object.prototype, "kind", originalKindDescriptor);
    }
  });
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [{ message: "● future-source [project] (removed)" }]);
  assert.strictEqual(sourceKindReads, 15);
  assert.strictEqual(await readFile(path.join(cloneDir, "sentinel"), "utf8"), "clone");
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("LAYER-03: drops only the base layer's declarations while the local layer still declares the marketplace", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "remove-me",
    source: pathSource("./remove-me"),
    plugins: { tool: pluginRecord() },
  });
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: {
        keep: { source: "./keep" },
        "remove-me": { source: "./remove-me" },
      },
      plugins: {
        "keep@keep": { enabled: true },
        "tool@remove-me": { enabled: true },
      },
    },
    locations.scopeRoot,
  );
  await saveConfig(
    locations.localConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { "remove-me": { source: "./local-remove", autoupdate: true } },
      plugins: { "local-tool@remove-me": { enabled: false } },
    },
    locations.scopeRoot,
  );
  const localBytes = await readFile(locations.localConfigJsonPath, "utf8");
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "remove-me",
    scope: "project",
    cwd,
    declarationIndex: syntheticIndex({ "tool@remove-me": [] }),
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "● remove-me [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.strictEqual(
    await readFile(locations.baseConfigJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "keep": {\n      "source": "./keep"\n    }\n  },\n  "plugins": {\n    "keep@keep": {\n      "enabled": true\n    }\n  }\n}\n',
  );
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), localBytes);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    marketplaceState({
      cwd,
      name: "remove-me",
      scope: "project",
      source: pathSource("./remove-me"),
    }),
  );
  notification.verifyInteractions();
});

test("leaves the other layer's valid config byte-identical", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "remove-me",
    source: pathSource("./remove-me"),
  });
  await saveConfig(
    locations.baseConfigJsonPath,
    { schemaVersion: 1, marketplaces: { "remove-me": { source: "./remove-me" } } },
    locations.scopeRoot,
  );
  await saveConfig(
    locations.localConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { keep: { source: "./keep" } },
      plugins: { "tool@keep": { enabled: true } },
    },
    locations.scopeRoot,
  );
  const localBytes = await readFile(locations.localConfigJsonPath, "utf8");
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "remove-me",
    scope: "project",
    cwd,
  });

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: "● remove-me [project] (removed)" }]);
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), localBytes);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("aborts a standalone local remove on invalid target config without leaking its path", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "invalid-config",
    source: pathSource("./invalid"),
  });
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  const invalidBytes = "{ invalid local config";
  await writeFile(locations.localConfigJsonPath, invalidBytes);
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "invalid-config",
    scope: "project",
    cwd,
    local: true,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "A marketplace operation has failed.\n\n⊘ invalid-config [project] (failed) {invalid manifest}",
      severity: "error",
    },
  ]);
  assert.strictEqual(notification.calls[0]?.message.includes(locations.localConfigJsonPath), false);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), invalidBytes);
  notification.verifyInteractions();
});

test("returns an orchestrated invalid-config outcome without notifying or saving state", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "invalid-config",
    source: pathSource("./invalid"),
  });
  const stateBytes = await readFile(locations.stateJsonPath, "utf8");
  await writeFile(locations.baseConfigJsonPath, "{ invalid base config");
  const notification = notificationBoundary(0);
  const invalidations: InvalidationCall[] = [];

  // act
  const outcome = await removeMarketplace({
    completionCache: recordingCompletionCache(invalidations),
    ctx: notification.ctx,
    run: notification.run,
    name: "invalid-config",
    scope: "project",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assertFailedOutcome(outcome, {
    reason: "invalid manifest",
    cause: 'Config file "claude-plugins.json" failed schema validation.',
  });
  assert.deepStrictEqual(notification.calls, []);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
  assert.deepStrictEqual(invalidations, []);
  notification.verifyInteractions();
});

test("propagates config write failure, preserves state, and converges on retry", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const initialState = marketplaceState({
    cwd,
    name: "write-failure",
    scope: "project",
    source: pathSource("./write-failure"),
    plugins: { tool: pluginRecord() },
  });
  await saveState(locations.extensionRoot, initialState);
  await saveConfig(
    locations.baseConfigJsonPath,
    { schemaVersion: 1, marketplaces: { "write-failure": { source: "./write-failure" } } },
    locations.scopeRoot,
  );
  const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
  const outsideRoot = await mkdtemp(path.join(tmpdir(), "marketplace-remove-config-outside-"));
  testContext.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideConfigPath = path.join(outsideRoot, "claude-plugins.json");
  await writeFile(outsideConfigPath, configBytes);
  const originalConfigPath = `${locations.baseConfigJsonPath}.original`;
  const firstNotification = notificationBoundary(0);
  let blockWrite = true;
  const firstCascade: typeof cascadeUnstagePlugin = async () => {
    if (blockWrite) {
      await rename(locations.baseConfigJsonPath, originalConfigPath);
      await symlink(outsideConfigPath, locations.baseConfigJsonPath);
    }

    return { ok: true, dropped: emptyDropped() };
  };

  let thrown: unknown;
  const failedInvalidations: InvalidationCall[] = [];

  // act
  try {
    await removeMarketplace({
      completionCache: recordingCompletionCache(failedInvalidations),
      ctx: firstNotification.ctx,
      run: firstNotification.run,
      name: "write-failure",
      scope: "project",
      cwd,
      cascade: firstCascade,
    });
  } catch (error) {
    thrown = error;
  }

  const stateAfterFailure = await loadState(locations.extensionRoot);
  const configAfterFailure = await readFile(locations.baseConfigJsonPath, "utf8");
  await rm(locations.baseConfigJsonPath, { force: true });
  await rename(originalConfigPath, locations.baseConfigJsonPath);
  blockWrite = false;
  const retryNotification = notificationBoundary(1);
  const retryOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: retryNotification.ctx,
    run: retryNotification.run,
    name: "write-failure",
    scope: "project",
    cwd,
    cascade: firstCascade,
  });

  // assert
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /contains symlink/i);
  assert.deepStrictEqual(firstNotification.calls, []);
  assert.deepStrictEqual(failedInvalidations, []);
  assert.deepStrictEqual(stateAfterFailure, initialState);
  assert.strictEqual(configAfterFailure, configBytes);
  assert.strictEqual(await readFile(outsideConfigPath, "utf8"), configBytes);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.strictEqual(retryOutcome, undefined);
  assert.deepStrictEqual(retryNotification.calls, [
    {
      message:
        "● write-failure [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
});

test("preserves the state record after state-save failure while retaining committed config removal", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const initialState = marketplaceState({
    cwd,
    name: "state-failure",
    scope: "project",
    source: pathSource("./state-failure"),
    plugins: { tool: pluginRecord() },
  });
  await saveState(locations.extensionRoot, initialState);
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { "state-failure": { source: "./state-failure" } },
      plugins: { "tool@state-failure": { enabled: true } },
    },
    locations.scopeRoot,
  );
  const originalStatePath = `${locations.stateJsonPath}.original`;
  const firstNotification = notificationBoundary(0);
  let breakStateSave = true;
  const cascade: typeof cascadeUnstagePlugin = async () => {
    if (breakStateSave) {
      await rename(locations.stateJsonPath, originalStatePath);
      await mkdir(locations.stateJsonPath);
    }

    return { ok: true, dropped: emptyDropped() };
  };

  let thrown: unknown;

  // act
  try {
    await removeMarketplace({
      completionCache: createCompletionCache(),
      ctx: firstNotification.ctx,
      run: firstNotification.run,
      name: "state-failure",
      scope: "project",
      cwd,
      cascade,
    });
  } catch (error) {
    thrown = error;
  }

  await rm(locations.stateJsonPath, { recursive: true, force: true });
  await rename(originalStatePath, locations.stateJsonPath);
  const stateAfterFailure = await loadState(locations.extensionRoot);
  const configAfterFailure = await loadConfig(locations.baseConfigJsonPath);
  breakStateSave = false;
  const retryNotification = notificationBoundary(1);
  const retryOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: retryNotification.ctx,
    run: retryNotification.run,
    name: "state-failure",
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /EISDIR|directory/i);
  assert.deepStrictEqual(firstNotification.calls, []);
  assert.deepStrictEqual(stateAfterFailure, initialState);
  assert.deepStrictEqual(configAfterFailure, {
    status: "valid",
    filePath: locations.baseConfigJsonPath,
    config: { schemaVersion: 1, marketplaces: {}, plugins: {} },
  });
  assert.strictEqual(retryOutcome, undefined);
  assert.deepStrictEqual(retryNotification.calls, [
    {
      message:
        "● state-failure [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
});

test("keeps exact partial state and silent cleanup residue before retry convergence", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "partial-marketplace";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
    plugins: {
      alpha: pluginRecord(),
      beta: pluginRecord({
        agents: ["agent-a", "agent-b"],
        mcpServers: ["mcp-a", "mcp-b"],
        prompts: ["command-a", "command-b"],
        skills: ["skill-a", "skill-b"],
      }),
      gamma: pluginRecord(),
    },
  });
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { [marketplace]: { source: "owner/repo" } },
      plugins: {
        [`alpha@${marketplace}`]: { enabled: true },
        [`beta@${marketplace}`]: { enabled: true },
        [`gamma@${marketplace}`]: { enabled: true },
      },
    },
    locations.scopeRoot,
  );
  const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
  const marketplaceData = await locations.marketplaceDataDir(marketplace);
  const alphaData = await locations.pluginDataDir(marketplace, "alpha");
  const betaData = await locations.pluginDataDir(marketplace, "beta");
  const gammaData = await locations.pluginDataDir(marketplace, "gamma");
  const cloneDir = await locations.sourceCloneDir(marketplace);
  await mkdir(marketplaceData, { recursive: true });
  const outside = await mkdtemp(path.join(tmpdir(), "marketplace-remove-outside-"));
  testContext.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, alphaData);
  await mkdir(betaData, { recursive: true });
  await mkdir(gammaData, { recursive: true });
  await writeFile(path.join(betaData, "sentinel"), "beta");
  await writeFile(path.join(gammaData, "sentinel"), "gamma");
  await mkdir(cloneDir, { recursive: true });
  await writeFile(path.join(cloneDir, "sentinel"), "clone");
  const pluginCache = await locations.pluginCacheFile(marketplace);
  await mkdir(pluginCache, { recursive: true });
  const cascadeCalls: string[] = [];
  let retry = false;
  const betaFailure = Object.assign(new Error("beta cascade denied"), { code: "EACCES" });
  const cascade: typeof cascadeUnstagePlugin = (plugin) => {
    cascadeCalls.push(`${retry ? "retry" : "first"}:${plugin}`);
    if (!retry && plugin === "beta") {
      return Promise.resolve({
        ok: false,
        dropped: {
          agents: [],
          commands: ["command-a"],
          hooks: [],
          mcpServers: [],
          skills: ["skill-a"],
          workflows: [],
        },
        cause: betaFailure,
      });
    }

    return Promise.resolve({ ok: true, dropped: emptyDropped() });
  };

  const firstNotification = notificationBoundary(1);

  // act
  const firstOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: firstNotification.ctx,
    run: firstNotification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });
  const stateAfterFirst = await loadState(locations.extensionRoot);
  const configAfterFirst = await readFile(locations.baseConfigJsonPath, "utf8");
  const residueAfterFirst = {
    alpha: await pathExists(alphaData),
    beta: await pathExists(betaData),
    cache: await pathExists(pluginCache),
    clone: await pathExists(cloneDir),
    gamma: await pathExists(gammaData),
    marketplace: await pathExists(marketplaceData),
  };
  await rm(pluginCache, { recursive: true, force: true });
  retry = true;
  const retryNotification = notificationBoundary(1);
  const retryOutcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: retryNotification.ctx,
    run: retryNotification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.strictEqual(firstOutcome, undefined);
  assert.deepStrictEqual(firstNotification.calls, [
    {
      message:
        "Some operations have failed.\n\n⊘ partial-marketplace [project] (failed)\n  ○ alpha (uninstalled)\n  ○ gamma (uninstalled)\n  ⊘ beta (failed) {permission denied}\n    cause: beta cascade denied\n\n/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(stateAfterFirst, {
    schemaVersion: 3,
    marketplaces: {
      "partial-marketplace": {
        name: "partial-marketplace",
        scope: "project",
        source: { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" },
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: path.join(cwd, "marketplace"),
        plugins: {
          beta: {
            version: "1.2.3",
            resolvedSource: "/fixtures/plugin",
            compatibility: {
              installable: true,
              notes: [],
              supported: [],
              unsupported: [],
            },
            resources: {
              agents: ["agent-a", "agent-b"],
              hooks: [],
              mcpServers: ["mcp-a", "mcp-b"],
              prompts: ["command-b"],
              skills: ["skill-b"],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        },
      },
    },
  });
  assert.strictEqual(configAfterFirst, configBytes);
  assert.deepStrictEqual(residueAfterFirst, {
    alpha: true,
    beta: true,
    cache: true,
    clone: true,
    gamma: false,
    marketplace: true,
  });
  assert.strictEqual(retryOutcome, undefined);
  assert.deepStrictEqual(retryNotification.calls, [
    {
      message:
        "● partial-marketplace [project] (removed)\n  ○ beta (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(cascadeCalls, ["first:alpha", "first:beta", "first:gamma", "retry:beta"]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  assert.strictEqual(await pathExists(marketplaceData), false);
  assert.strictEqual(await pathExists(cloneDir), false);
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
});

test("D-PL5-15: a partial failure subtracts every dropped axis, hooks and workflows included, from the persisted row", async (testContext) => {
  // arrange -- every axis keeps one name the cascade did not drop, and the
  // dropped command sits in `prompts`, so a fold that skips an axis or maps
  // one to the wrong field leaves a different row.
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "workflow-partial";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./workflow-partial"),
    plugins: {
      beta: pluginRecord({
        agents: ["beta-agent", "beta-kept-agent"],
        hooks: ["beta", "beta-kept-hook"],
        mcpServers: ["beta-mcp", "beta-kept-mcp"],
        prompts: ["beta-command", "beta-kept-command"],
        skills: ["beta-skill", "beta-kept-skill"],
        workflows: ["beta:greet", "beta:farewell"],
      }),
    },
  });
  const cascade: typeof cascadeUnstagePlugin = () =>
    Promise.resolve({
      ok: false,
      dropped: {
        agents: ["beta-agent"],
        commands: ["beta-command"],
        hooks: ["beta"],
        mcpServers: ["beta-mcp"],
        skills: ["beta-skill"],
        workflows: ["beta:greet"],
      },
      cause: Object.assign(new Error("mcp write denied"), { code: "EACCES" }),
    });
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
    completionCache: createCompletionCache(),
  });

  // assert
  const persisted = await loadState(locations.extensionRoot);
  const resources = persisted.marketplaces[marketplace]?.plugins["beta"]?.resources;
  assert.deepStrictEqual(resources, {
    agents: ["beta-kept-agent"],
    hooks: ["beta-kept-hook"],
    mcpServers: ["beta-kept-mcp"],
    prompts: ["beta-kept-command"],
    skills: ["beta-kept-skill"],
    workflows: ["beta:farewell"],
  });
  notification.verifyInteractions();
});

test("WLIF-03: a cascade removal takes every plugin's workflow envelope off disk", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "workflow-cascade";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./workflow-cascade"),
    plugins: {
      alpha: pluginRecord({ workflows: ["alpha:greet"] }),
      beta: pluginRecord({ workflows: ["beta:greet"] }),
    },
  });
  const alphaEnvelope = await seedWorkflowEnvelope(locations, "alpha:greet");
  const betaEnvelope = await seedWorkflowEnvelope(locations, "beta:greet");
  await stat(alphaEnvelope);
  await stat(betaEnvelope);
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
  });

  // assert
  await assert.rejects(() => stat(alphaEnvelope), { code: "ENOENT" });
  await assert.rejects(() => stat(betaEnvelope), { code: "ENOENT" });
  assert.deepStrictEqual(await readdir(locations.workflowsSavedDir), []);
  notification.verifyInteractions();
});

test("WLIF-03: one plugin's cascade failure strands only its own envelope", async (testContext) => {
  // arrange -- beta's skill name carries a separator, so its cascade throws on
  // the FIRST arm and never reaches its workflows arm. alpha's cascade is
  // unaffected, and a hand-saved file the user owns shares the directory.
  const { cwd, locations } = await projectCase(testContext);
  const marketplace = "workflow-adjacency";
  await seedMarketplace(locations, {
    cwd,
    name: marketplace,
    source: pathSource("./workflow-adjacency"),
    plugins: {
      alpha: pluginRecord({ workflows: ["alpha:greet"] }),
      beta: pluginRecord({ skills: ["../escape"], workflows: ["beta:greet"] }),
    },
  });
  const alphaEnvelope = await seedWorkflowEnvelope(locations, "alpha:greet");
  const betaEnvelope = await seedWorkflowEnvelope(locations, "beta:greet");
  const userOwned = path.join(locations.workflowsSavedDir, "my-own.json");
  await writeFile(userOwned, '{"name":"my-own"}');
  const userOwnedBytes = await readFile(userOwned, "utf8");
  await stat(alphaEnvelope);
  await stat(betaEnvelope);
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    ctx: notification.ctx,
    run: notification.run,
    name: marketplace,
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
  });

  // assert
  await assert.rejects(() => stat(alphaEnvelope), { code: "ENOENT" });
  await stat(betaEnvelope);
  assert.strictEqual(await readFile(userOwned, "utf8"), userOwnedBytes);
  notification.verifyInteractions();
});

test("returns every orchestrated partial row and preserves agent-conflict resources", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "orchestrated-partial",
    source: pathSource("./partial"),
    plugins: {
      alpha: pluginRecord({ skills: ["alpha-skill"] }),
      beta: pluginRecord({ agents: ["beta-agent"], skills: ["beta-skill"] }),
    },
  });
  const agentFailure = new AgentsUnstageFailureError("foreign beta agent", [
    {
      generatedName: "beta-agent",
      targetPath: "/agents/beta-agent.md",
      reason: "missing marker",
    },
  ]);
  const cascadeCalls: string[] = [];
  const cascade: typeof cascadeUnstagePlugin = (plugin) => {
    cascadeCalls.push(plugin);
    if (plugin === "alpha") {
      return Promise.resolve({ ok: false, dropped: emptyDropped() });
    }

    return Promise.resolve({
      ok: false,
      dropped: { ...emptyDropped(), agents: ["beta-agent"], skills: ["beta-skill"] },
      cause: agentFailure,
    });
  };

  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "orchestrated-partial",
    scope: "project",
    cwd,
    cascade,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, {
    status: "partial",
    name: "orchestrated-partial",
    unstaged: [],
    failed: [
      { name: "alpha", reason: "not in manifest" },
      { name: "beta", reason: "source mismatch" },
    ],
  });
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(cascadeCalls, ["alpha", "beta"]);
  assert.deepStrictEqual(
    (await loadState(locations.extensionRoot)).marketplaces["orchestrated-partial"]?.plugins,
    {
      alpha: pluginRecord({ skills: ["alpha-skill"] }),
      beta: pluginRecord({ agents: ["beta-agent"], skills: ["beta-skill"] }),
    },
  );
  notification.verifyInteractions();
});

test("reports a concurrent in-lock disappearance as an empty successful removal", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "concurrent",
    source: pathSource("./concurrent"),
  });
  // The pre-guard probe reads the real file and finds the record; this load,
  // which runs inside the lock, does not. That asymmetry IS the concurrent
  // removal, expressed without racing a real writer.
  let inLockLoads = 0;
  const stateTransaction = {
    loadState: async (): Promise<ExtensionState> => {
      inLockLoads += 1;
      return await Promise.resolve({ schemaVersion: 2 as const, marketplaces: {} });
    },
  };
  const cascade: typeof cascadeUnstagePlugin = () => {
    throw new Error("cascade must not run after the record vanished");
  };

  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "concurrent",
    scope: "project",
    cwd,
    cascade,
    stateTransaction,
  });

  // assert
  assert.strictEqual(inLockLoads, 1);
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [{ message: "● concurrent [project] (removed)" }]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

// AFILE-04: a removal whose plugin cascades rewrite a commented MCP config
// file shows the comments-removed notice after its rows in standalone mode and
// returns it on the outcome in orchestrated mode.

const COMMENTED_ALPHA_ADAPTER =
  '// user note\n{"mcpServers":{"alpha-server":{"command":"alpha","_piClaudeMarketplace":{"plugin":"alpha","marketplace":"commented"}}}}\n';

const ADAPTER_COMMENTS_REMOVED_LINE =
  "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.";

async function seedCommentedMarketplace(
  testContext: TestContext,
  plugins: Record<string, PluginRecord>,
): Promise<{ cwd: string; locations: ScopedLocations }> {
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "commented",
    source: pathSource("./commented"),
    plugins,
  });
  await writeFile(locations.mcpAdapterJsonPath, COMMENTED_ALPHA_ADAPTER);
  return { cwd, locations };
}

/** Alpha runs the real cascade; beta fails with a notice of its own. */
const alphaRealBetaFailing: typeof cascadeUnstagePlugin = (plugin, ...rest) =>
  plugin === "beta"
    ? Promise.resolve({
        ok: false,
        dropped: emptyDropped(),
        cause: Object.assign(new Error("beta denied"), { code: "EACCES" }),
        mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
      })
    : cascadeUnstagePlugin(plugin, ...rest);

test("AFILE-04: marketplace remove over a commented mcp-adapter.json shows the comments-removed notice", async (testContext) => {
  // arrange
  const { cwd, locations } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
  });
  const notification = notificationBoundary(1, 1);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "commented",
    scope: "project",
    cwd,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "● commented [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes",
    },
    {
      message: `MCP config comments removed.\n\n${ADAPTER_COMMENTS_REMOVED_LINE}`,
      severity: "warning",
    },
  ]);
  assert.strictEqual(
    await readFile(locations.mcpAdapterJsonPath, "utf8"),
    '{\n  "mcpServers": {}\n}\n',
  );
  notification.verifyInteractions();
});

test("AFILE-04: a partial marketplace remove still shows the notice", async (testContext) => {
  // arrange
  const { cwd } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
    beta: pluginRecord(),
  });
  const notification = notificationBoundary(1, 1);

  // act
  await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "commented",
    scope: "project",
    cwd,
    cascade: alphaRealBetaFailing,
  });

  // assert
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "Some operations have failed.\n\n⊘ commented [project] (failed)\n  ○ alpha (uninstalled)\n  ⊘ beta (failed) {permission denied}\n    cause: beta denied\n\n/reload to pick up changes",
      severity: "error",
    },
    {
      message:
        "MCP config comments removed.\n\n" +
        `${ADAPTER_COMMENTS_REMOVED_LINE}\n` +
        "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
      severity: "warning",
    },
  ]);
  notification.verifyInteractions();
});

test("AFILE-04: an orchestrated marketplace remove returns the notice and sends nothing", async (testContext) => {
  // arrange
  const { cwd } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
  });
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "commented",
    scope: "project",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, {
    status: "removed",
    name: "commented",
    unstaged: ["alpha"],
    mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
  });
  assert.deepStrictEqual(notification.calls, []);
  notification.verifyInteractions();
});

test("AFILE-04: an orchestrated partial marketplace remove returns every cascade's notice", async (testContext) => {
  // arrange
  const { cwd } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
    beta: pluginRecord(),
  });
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "commented",
    scope: "project",
    cwd,
    cascade: alphaRealBetaFailing,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, {
    status: "partial",
    name: "commented",
    unstaged: ["alpha"],
    failed: [{ name: "beta", reason: "permission denied" }],
    mcpConfigNotices: [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      { kind: "comments-dropped", scope: "project", file: "mcp.json" },
    ],
  });
  assert.deepStrictEqual(notification.calls, []);
  notification.verifyInteractions();
});

/** AFILE-04: a state transaction whose save fails after the plugin cascades ran. */
function failingSave(saveFailure: Error): { saveState: () => Promise<void> } {
  return {
    saveState: async () => {
      await Promise.resolve();
      throw saveFailure;
    },
  };
}

test("AFILE-04: a standalone marketplace remove whose state save fails still shows the notice", async (testContext) => {
  // arrange
  const { cwd } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
  });
  const saveFailure = new Error("state save failed");
  const calls: NotificationCall[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .once();
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  when(() => ui.notify).thenReturn((message, severity) => {
    calls.push(severity === undefined ? { message } : { message, severity });
  });

  // act
  const failure = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx,
    run: runWithNothingLoaded(),
    name: "commented",
    scope: "project",
    cwd,
    stateTransaction: failingSave(saveFailure),
  }).then(
    () => undefined,
    (error: unknown) => error,
  );

  // assert
  assert.strictEqual(failure, saveFailure);
  assert.deepStrictEqual(calls, [
    {
      message: `MCP config comments removed.\n\n${ADAPTER_COMMENTS_REMOVED_LINE}`,
      severity: "warning",
    },
  ]);
  verify(ctx);
  verify(ui);
});

test("AFILE-04: an orchestrated marketplace remove whose state save fails carries the notice on a typed error", async (testContext) => {
  // arrange
  const { cwd } = await seedCommentedMarketplace(testContext, {
    alpha: pluginRecord({ mcpServers: ["alpha-server"] }),
  });
  const saveFailure = new Error("state save failed");
  const notification = notificationBoundary(0);

  // act
  const failure = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "commented",
    scope: "project",
    cwd,
    notifications: { mode: "orchestrated" },
    stateTransaction: failingSave(saveFailure),
  }).then(
    () => undefined,
    (error: unknown) => error,
  );

  // assert
  assert.ok(failure instanceof MarketplaceRemoveFailureError);
  assert.deepStrictEqual(
    {
      name: failure.name,
      message: failure.message,
      mcpConfigNotices: failure.mcpConfigNotices,
      cause: failure.cause,
    },
    {
      name: "MarketplaceRemoveFailureError",
      message: "Marketplace remove failed after its plugin cascades rewrote MCP config files.",
      mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
      cause: saveFailure,
    },
  );
  assert.deepStrictEqual(notification.calls, []);
  notification.verifyInteractions();
});

test("rethrows a state save failure unchanged when no cascade rewrote an MCP config file", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "plain",
    source: pathSource("./plain"),
    plugins: { alpha: pluginRecord() },
  });
  const saveFailure = new Error("state save failed");
  const notification = notificationBoundary(0);

  // act
  const failure = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "plain",
    scope: "project",
    cwd,
    notifications: { mode: "orchestrated" },
    stateTransaction: failingSave(saveFailure),
  }).then(
    () => undefined,
    (error: unknown) => error,
  );

  // assert
  assert.strictEqual(failure, saveFailure);
  assert.deepStrictEqual(notification.calls, []);
  notification.verifyInteractions();
});

// LAYER-02 / D-MF-03: a named remove changes only its target layer, and the
// layer gate decides before anything changes.

interface LayerConfigs {
  readonly base?: string;
  readonly local?: string;
  readonly source?: unknown;
}

interface LayerCase {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly bytesOnDisk: () => Promise<readonly (string | undefined)[]>;
}

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? await readFile(filePath, "utf8") : undefined;
}

/**
 * A project scope recording `tools` (a path source unless `source` says
 * otherwise) with an installed `tool`, with the two config files written as the
 * given raw text (an omitted file is absent).
 */
async function layerCase(testContext: TestContext, files: LayerConfigs): Promise<LayerCase> {
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "tools",
    source: files.source ?? pathSource("./tools"),
    plugins: { tool: pluginRecord({ skills: ["tool-skill"] }) },
  });
  if (files.base !== undefined) {
    await writeFile(locations.baseConfigJsonPath, files.base);
  }

  if (files.local !== undefined) {
    await writeFile(locations.localConfigJsonPath, files.local);
  }

  return {
    cwd,
    locations,
    bytesOnDisk: async () =>
      await Promise.all([
        readFile(locations.stateJsonPath, "utf8"),
        readIfPresent(locations.baseConfigJsonPath),
        readIfPresent(locations.localConfigJsonPath),
      ]),
  };
}

const TOOLS_DECLARED =
  '{"schemaVersion":1,"marketplaces":{"tools":{"source":"./tools"}},"plugins":{"tool@tools":{"enabled":true}}}\n';

/** The refusal row of a remove whose other file, `claude-plugins.local.json`, is invalid. */
const LOCAL_FILE_INVALID =
  'Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.';

for (const { title, files, local, expectedMessage } of [
  {
    title: "refuses a base-config remove of a marketplace only the local config declares",
    files: {
      base: '{"schemaVersion":1,"marketplaces":{"base":{"source":"./base"}}}\n',
      local: TOOLS_DECLARED,
    },
    local: false,
    expectedMessage:
      "Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {marketplace in local layer only}\n    cause: The marketplace tools is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
  },
  {
    title: "refuses a local-config remove of a marketplace only the base config declares",
    files: { base: TOOLS_DECLARED },
    local: true,
    expectedMessage:
      "Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {marketplace in base layer only}\n    cause: The marketplace tools is declared only in the base config (claude-plugins.json). Run the command again without --local.",
  },
  {
    title: "refuses a remove whose target file is silent while the other file is invalid",
    files: { base: '{"schemaVersion":1}\n', local: "{ invalid local config" },
    local: false,
    expectedMessage: LOCAL_FILE_INVALID,
  },
  {
    title: "refuses a remove whose target file declares it while the other file is invalid",
    files: { base: TOOLS_DECLARED, local: "{ invalid local config" },
    local: false,
    expectedMessage: LOCAL_FILE_INVALID,
  },
] satisfies readonly {
  readonly title: string;
  readonly files: LayerConfigs;
  readonly local: boolean;
  readonly expectedMessage: string;
}[]) {
  test(`LAYER-02: ${title} and changes nothing`, async (testContext) => {
    // arrange
    const { cwd, bytesOnDisk } = await layerCase(testContext, files);
    const expectedBytes = await bytesOnDisk();
    const notification = notificationBoundary(1);

    // act
    const outcome = await removeMarketplace({
      completionCache: createCompletionCache(),
      ctx: notification.ctx,
      run: notification.run,
      name: "tools",
      scope: "project",
      cwd,
      cascade: unreachableCascade,
      local,
    });

    // assert
    assert.strictEqual(outcome, undefined);
    assert.deepStrictEqual(notification.calls, [{ message: expectedMessage, severity: "error" }]);
    assert.deepStrictEqual(await bytesOnDisk(), expectedBytes);
    notification.verifyInteractions();
  });
}

test("WR-09: an orchestrated remove applies no layer rule and writes no config", async (testContext) => {
  // arrange
  const { cwd, locations, bytesOnDisk } = await layerCase(testContext, { local: TOOLS_DECLARED });
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "tools",
    scope: "project",
    cwd,
    cascade: () => Promise.resolve({ ok: true, dropped: emptyDropped() }),
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "removed", name: "tools", unstaged: ["tool"] });
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  const [, baseBytes, localBytes] = await bytesOnDisk();
  assert.deepStrictEqual([baseBytes, localBytes], [undefined, TOOLS_DECLARED]);
  assert.deepStrictEqual(notification.calls, []);
  notification.verifyInteractions();
});

// LAYER-03: a remove from one layer while the other layer declares the
// marketplace drops only that layer's declarations and plugins; the remove of
// the last declaration, or of a marketplace no layer declares, is the full one.

const TOOLS_DECLARED_ONLY = '{"schemaVersion":1,"marketplaces":{"tools":{"source":"./tools"}}}\n';

const NO_DECLARATIONS = '{\n  "schemaVersion": 1,\n  "marketplaces": {},\n  "plugins": {}\n}\n';

const TOOL_UNINSTALLED =
  "● tools [project] (removed)\n  ○ tool (uninstalled)\n\n/reload to pick up changes";

const unstagingCascade: typeof cascadeUnstagePlugin = () =>
  Promise.resolve({ ok: true, dropped: emptyDropped() });

/** Removes `tools`; no installed plugin of these cases declares a dependency. */
async function removeTools(
  cwd: string,
  notification: NotificationBoundary,
  cascade: typeof cascadeUnstagePlugin,
): Promise<RemoveMarketplaceOutcome | undefined> {
  return await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "tools",
    scope: "project",
    cwd,
    cascade,
    declarationIndex: syntheticIndex({}),
  });
}

function toolsState(
  cwd: string,
  source: unknown,
  plugins: Record<string, PluginRecord>,
): ExtensionState {
  return marketplaceState({ cwd, name: "tools", scope: "project", source, plugins });
}

test("LAYER-03: a layer remove keeps a github marketplace's clone and data directory and deletes the unstaged plugin's data", async (testContext) => {
  // arrange
  const source = { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" };
  const { cwd, locations } = await layerCase(testContext, {
    base: TOOLS_DECLARED,
    local: TOOLS_DECLARED_ONLY,
    source,
  });
  const cloneDir = await locations.sourceCloneDir("tools");
  const marketplaceData = await locations.marketplaceDataDir("tools");
  const pluginData = await locations.pluginDataDir("tools", "tool");
  await mkdir(cloneDir, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  await writeFile(path.join(cloneDir, "sentinel"), "clone");
  await writeFile(path.join(marketplaceData, "sentinel"), "marketplace data");
  const notification = notificationBoundary(1);

  // act
  await removeTools(cwd, notification, unstagingCascade);

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: TOOL_UNINSTALLED }]);
  assert.deepStrictEqual(
    [
      await pathExists(path.join(cloneDir, "sentinel")),
      await pathExists(path.join(marketplaceData, "sentinel")),
      await pathExists(pluginData),
    ],
    [true, true, false],
  );
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), NO_DECLARATIONS);
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), TOOLS_DECLARED_ONLY);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), toolsState(cwd, source, {}));
  notification.verifyInteractions();
});

test("LAYER-03: a plugin key both layers declare stays installed and only the target layer drops it", async (testContext) => {
  // arrange
  const { cwd, locations } = await layerCase(testContext, {
    base: TOOLS_DECLARED,
    local: TOOLS_DECLARED,
  });
  const notification = notificationBoundary(1);

  // act
  await removeTools(cwd, notification, unreachableCascade);

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: "● tools [project] (removed)" }]);
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), NO_DECLARATIONS);
  assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), TOOLS_DECLARED);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    toolsState(cwd, pathSource("./tools"), { tool: pluginRecord({ skills: ["tool-skill"] }) }),
  );
  notification.verifyInteractions();
});

test("LAYER-03: a recorded marketplace no layer declares is fully removed and both layers' plugin keys are swept", async (testContext) => {
  // arrange
  const { cwd, locations } = await layerCase(testContext, {
    base: '{"schemaVersion":1,"marketplaces":{"base":{"source":"./base"}},"plugins":{"tool@tools":{"enabled":true}}}\n',
    local: '{"schemaVersion":1,"plugins":{"other@tools":{"enabled":false}}}\n',
  });
  const marketplaceData = await locations.marketplaceDataDir("tools");
  await mkdir(marketplaceData, { recursive: true });
  const notification = notificationBoundary(1);

  // act
  await removeTools(cwd, notification, unstagingCascade);

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: TOOL_UNINSTALLED }]);
  assert.strictEqual(
    await readFile(locations.baseConfigJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "base": {\n      "source": "./base"\n    }\n  },\n  "plugins": {}\n}\n',
  );
  assert.strictEqual(
    await readFile(locations.localConfigJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "plugins": {},\n  "marketplaces": {}\n}\n',
  );
  assert.strictEqual(await pathExists(marketplaceData), false);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("MR-7: a layer remove whose plugin fails to unstage writes no config and keeps the plugin", async (testContext) => {
  // arrange
  const { cwd, locations, bytesOnDisk } = await layerCase(testContext, {
    base: TOOLS_DECLARED,
    local: TOOLS_DECLARED_ONLY,
  });
  const [, baseBytes, localBytes] = await bytesOnDisk();
  const notification = notificationBoundary(1);

  // act
  await removeTools(cwd, notification, () =>
    Promise.resolve({
      ok: false,
      dropped: emptyDropped(),
      cause: Object.assign(new Error("tool denied"), { code: "EACCES" }),
    }),
  );

  // assert
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tool (failed) {permission denied}\n    cause: tool denied",
      severity: "error",
    },
  ]);
  const [, baseAfter, localAfter] = await bytesOnDisk();
  assert.deepStrictEqual([baseAfter, localAfter], [baseBytes, localBytes]);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    toolsState(cwd, pathSource("./tools"), { tool: pluginRecord({ skills: ["tool-skill"] }) }),
  );
  notification.verifyInteractions();
});

// LAYER-03: a remove also takes the dependency records under the
// marketplace that only its removed plugins needed, and keeps the ones a
// staying plugin declares. The declaration index is a synthetic stand-in.

type IndexShape = Readonly<Record<string, readonly string[]>>;

function syntheticIndex(shape: IndexShape): typeof buildScopeDeclarationIndex {
  return ({ state }) =>
    Promise.resolve({
      ok: true,
      index: new Map(Object.entries(shape).map(([holder, keys]) => [holder, new Set(keys)])),
      candidates: Object.values(state.marketplaces).flatMap((marketplace) =>
        Object.entries(marketplace.plugins).map(([plugin, record]) => ({
          key: `${plugin}@${marketplace.name}`,
          provenance: record.provenance,
          marketplace,
          plugin,
          record,
        })),
      ),
    });
}

const unbuildableIndex: typeof buildScopeDeclarationIndex = () => {
  assert.fail("this remove must not read any declaration");
};

function dependencyRecord(): PluginRecord {
  return { ...pluginRecord(), provenance: "dependency" };
}

/** A cascade that records each plugin it unstages and fails the `failing` one. */
function recordingCascade(calls: string[], failing?: string): typeof cascadeUnstagePlugin {
  return (plugin) => {
    calls.push(plugin);
    return Promise.resolve(
      plugin === failing
        ? {
            ok: false,
            dropped: emptyDropped(),
            cause: Object.assign(new Error(`${plugin} denied`), { code: "EACCES" }),
          }
        : { ok: true, dropped: emptyDropped() },
    );
  };
}

interface DependencySeams {
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly declarationIndex: typeof buildScopeDeclarationIndex;
  readonly orchestrated?: boolean;
}

async function removeToolsWith(
  cwd: string,
  notification: NotificationBoundary,
  seams: DependencySeams,
): Promise<RemoveMarketplaceOutcome | undefined> {
  return await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx: notification.ctx,
    run: notification.run,
    name: "tools",
    scope: "project",
    cwd,
    cascade: seams.cascade,
    declarationIndex: seams.declarationIndex,
    ...(seams.orchestrated === true && { notifications: { mode: "orchestrated" } as const }),
  });
}

/** A layer case whose `tools` record holds `plugins` instead of the one `tool`. */
async function dependencyCase(
  testContext: TestContext,
  files: LayerConfigs,
  plugins: Record<string, PluginRecord>,
): Promise<LayerCase> {
  const layer = await layerCase(testContext, files);
  await saveState(
    layer.locations.extensionRoot,
    toolsState(layer.cwd, files.source ?? pathSource("./tools"), plugins),
  );
  return layer;
}

const ALPHA_DECLARED =
  '{"schemaVersion":1,"marketplaces":{"tools":{"source":"./tools"}},"plugins":{"alpha@tools":{"enabled":true}}}\n';

const BETA_DECLARED =
  '{"schemaVersion":1,"marketplaces":{"tools":{"source":"./tools"}},"plugins":{"beta@tools":{"enabled":true}}}\n';

for (const { title, plugins, shape, unstaged, remaining, expectedMessage } of [
  {
    title:
      "uninstalls the dependency only its removed plugin needed and leaves an orphan it does not reach",
    plugins: ["alpha", "beta", "lib", "orphan"],
    shape: {
      "alpha@tools": ["lib@tools"],
      "beta@tools": [],
      "lib@tools": [],
      "orphan@tools": [],
    },
    unstaged: ["alpha", "lib"],
    remaining: ["beta", "orphan"],
    expectedMessage:
      "● tools [project] (removed)\n  ○ alpha (uninstalled)\n  ○ lib (uninstalled)\n\n/reload to pick up changes",
  },
  {
    title: "keeps a dependency that a plugin of the other layer still needs",
    plugins: ["alpha", "beta", "lib"],
    shape: { "alpha@tools": ["lib@tools"], "beta@tools": ["lib@tools"], "lib@tools": [] },
    unstaged: ["alpha"],
    remaining: ["beta", "lib"],
    expectedMessage:
      "● tools [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes",
  },
] satisfies readonly {
  readonly title: string;
  readonly plugins: readonly string[];
  readonly shape: IndexShape;
  readonly unstaged: readonly string[];
  readonly remaining: readonly string[];
  readonly expectedMessage: string;
}[]) {
  test(`LAYER-03: a layer remove ${title}`, async (testContext) => {
    // arrange
    const recordFor = (name: string): PluginRecord =>
      name === "lib" || name === "orphan" ? dependencyRecord() : pluginRecord();
    const { cwd, locations } = await dependencyCase(
      testContext,
      { base: ALPHA_DECLARED, local: BETA_DECLARED },
      Object.fromEntries(plugins.map((name) => [name, recordFor(name)])),
    );
    const calls: string[] = [];
    const notification = notificationBoundary(1);

    // act
    await removeToolsWith(cwd, notification, {
      cascade: recordingCascade(calls),
      declarationIndex: syntheticIndex(shape),
    });

    // assert
    assert.deepStrictEqual(calls, unstaged);
    assert.deepStrictEqual(notification.calls, [{ message: expectedMessage }]);
    assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), NO_DECLARATIONS);
    assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), BETA_DECLARED);
    assert.deepStrictEqual(
      await loadState(locations.extensionRoot),
      toolsState(
        cwd,
        pathSource("./tools"),
        Object.fromEntries(remaining.map((name) => [name, recordFor(name)])),
      ),
    );
    notification.verifyInteractions();
  });
}

for (const { holder, title } of [
  { holder: "beta@tools", title: "a plugin the other file declares" },
  { holder: "app@upstream", title: "a plugin of another marketplace" },
]) {
  test(`LAYER-03: a layer remove of a plugin that ${title} still needs is refused as dependents remain and changes nothing`, async (testContext) => {
    // arrange
    const { cwd, bytesOnDisk } = await dependencyCase(
      testContext,
      { base: ALPHA_DECLARED, local: BETA_DECLARED },
      { alpha: pluginRecord(), beta: pluginRecord() },
    );
    const expectedBytes = await bytesOnDisk();
    const notification = notificationBoundary(1);

    // act
    await removeToolsWith(cwd, notification, {
      cascade: unreachableCascade,
      declarationIndex: syntheticIndex({
        "alpha@tools": [],
        "beta@tools": [],
        [holder]: ["alpha@tools"],
      }),
    });

    // assert
    assert.deepStrictEqual(notification.calls, [
      {
        message: `Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ alpha (failed) {dependents remain}\n    cause: Uninstall ${holder} first, then remove the marketplace tools again.`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await bytesOnDisk(), expectedBytes);
    notification.verifyInteractions();
  });
}

test("MPR-01: a layer remove is not refused by a disabled plugin that declares the removed plugin", async (testContext) => {
  // arrange
  const disabledBeta: PluginRecord = { ...pluginRecord(), enabled: false };
  const { cwd, locations } = await dependencyCase(
    testContext,
    { base: ALPHA_DECLARED, local: BETA_DECLARED },
    { alpha: pluginRecord(), beta: disabledBeta },
  );
  const calls: string[] = [];
  const notification = notificationBoundary(1);

  // act
  await removeToolsWith(cwd, notification, {
    cascade: recordingCascade(calls),
    declarationIndex: syntheticIndex({ "alpha@tools": [], "beta@tools": ["alpha@tools"] }),
  });

  // assert
  assert.deepStrictEqual(calls, ["alpha"]);
  assert.deepStrictEqual(notification.calls, [
    {
      message: "● tools [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    toolsState(cwd, pathSource("./tools"), { beta: disabledBeta }),
  );
  notification.verifyInteractions();
});

test("LAYER-03: a layer remove keeps a dependency record its target layer declares while a staying plugin needs it", async (testContext) => {
  // arrange
  const baseDeclaresLib =
    '{"schemaVersion":1,"marketplaces":{"tools":{"source":"./tools"}},"plugins":{"alpha@tools":{"enabled":true},"lib@tools":{"enabled":true}}}\n';
  const { cwd, locations } = await dependencyCase(
    testContext,
    { base: baseDeclaresLib, local: BETA_DECLARED },
    { alpha: pluginRecord(), beta: pluginRecord(), lib: dependencyRecord() },
  );
  const calls: string[] = [];
  const notification = notificationBoundary(1);

  // act
  await removeToolsWith(cwd, notification, {
    cascade: recordingCascade(calls),
    declarationIndex: syntheticIndex({
      "alpha@tools": [],
      "beta@tools": ["lib@tools"],
      "lib@tools": [],
    }),
  });

  // assert
  assert.deepStrictEqual(calls, ["alpha"]);
  assert.deepStrictEqual(notification.calls, [
    {
      message: "● tools [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    toolsState(cwd, pathSource("./tools"), { beta: pluginRecord(), lib: dependencyRecord() }),
  );
  notification.verifyInteractions();
});

test("LAYER-03: a full remove keeps a dependency another marketplace's plugin needs, with its record, data, and clone", async (testContext) => {
  // arrange
  const source = { kind: "github", raw: "owner/repo", owner: "owner", repo: "repo" };
  const strayKey = '{"schemaVersion":1,"plugins":{"stray@tools":{"enabled":true}}}\n';
  const { cwd, locations } = await dependencyCase(
    testContext,
    { base: ALPHA_DECLARED, local: strayKey, source },
    { alpha: pluginRecord(), lib: dependencyRecord(), orphan: dependencyRecord() },
  );
  const upstream = marketplaceState({
    cwd,
    name: "upstream",
    scope: "project",
    source: pathSource("./upstream"),
    plugins: { app: pluginRecord() },
  }).marketplaces;
  const seeded = await loadState(locations.extensionRoot);
  await saveState(locations.extensionRoot, {
    ...seeded,
    marketplaces: { ...seeded.marketplaces, ...upstream },
  });
  const cloneDir = await locations.sourceCloneDir("tools");
  const marketplaceData = await locations.marketplaceDataDir("tools");
  await mkdir(cloneDir, { recursive: true });
  await mkdir(marketplaceData, { recursive: true });
  await writeFile(path.join(cloneDir, "sentinel"), "clone");
  await writeFile(path.join(marketplaceData, "sentinel"), "marketplace data");
  const calls: string[] = [];
  const notification = notificationBoundary(1);

  // act
  await removeToolsWith(cwd, notification, {
    cascade: recordingCascade(calls),
    declarationIndex: syntheticIndex({
      "alpha@tools": ["lib@tools"],
      "app@upstream": ["lib@tools"],
      "lib@tools": [],
      "orphan@tools": [],
    }),
  });

  // assert
  assert.deepStrictEqual(calls, ["alpha", "orphan"]);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "● tools [project] (removed)\n  ○ alpha (uninstalled)\n  ○ orphan (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), NO_DECLARATIONS);
  assert.strictEqual(
    await readFile(locations.localConfigJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "plugins": {},\n  "marketplaces": {}\n}\n',
  );
  assert.deepStrictEqual(
    [
      await readFile(path.join(cloneDir, "sentinel"), "utf8"),
      await readFile(path.join(marketplaceData, "sentinel"), "utf8"),
    ],
    ["clone", "marketplace data"],
  );
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {
      ...toolsState(cwd, source, { lib: dependencyRecord() }).marketplaces,
      ...upstream,
    },
  });
  notification.verifyInteractions();
});

const UNREADABLE_CAUSE =
  "cannot read the dependencies of alpha@tools: not declared by its marketplace, and its installed copy cannot be read";

const unreadableIndex: typeof buildScopeDeclarationIndex = () =>
  Promise.resolve({
    ok: false,
    declarer: "alpha@tools",
    reason: "not in manifest",
    cause: new Error(UNREADABLE_CAUSE),
  });

for (const { mode, orchestrated, expectedCalls } of [
  { mode: "a standalone", orchestrated: false, expectedCalls: 1 },
  { mode: "an orchestrated", orchestrated: true, expectedCalls: 0 },
] as const) {
  test(`D-05-07: ${mode} remove whose declarations cannot be read is refused as unreadable and changes nothing`, async (testContext) => {
    // arrange
    const { cwd, bytesOnDisk } = await dependencyCase(
      testContext,
      { base: ALPHA_DECLARED },
      { alpha: pluginRecord(), lib: dependencyRecord() },
    );
    const expectedBytes = await bytesOnDisk();
    const notification = notificationBoundary(expectedCalls);

    // act
    const outcome = await removeToolsWith(cwd, notification, {
      cascade: unreachableCascade,
      declarationIndex: unreadableIndex,
      orchestrated,
    });

    // assert
    assert.deepStrictEqual(
      notification.calls,
      orchestrated
        ? []
        : [
            {
              message: `Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {unreadable}\n    cause: ${UNREADABLE_CAUSE}`,
              severity: "error",
            },
          ],
    );
    assert.deepStrictEqual(
      outcome === undefined ? undefined : { ...outcome, error: undefined },
      orchestrated
        ? { status: "failed", reason: "unreadable", error: undefined, cause: UNREADABLE_CAUSE }
        : undefined,
    );
    assert.deepStrictEqual(await bytesOnDisk(), expectedBytes);
    notification.verifyInteractions();
  });
}

test("FLR-02: a standalone remove under a held state lock reports lock held and changes nothing", async (testContext) => {
  // arrange
  const { cwd, locations, bytesOnDisk } = await layerCase(testContext, { base: TOOLS_DECLARED });
  const expectedBytes = await bytesOnDisk();
  const notification = notificationBoundary(1);

  // act
  const outcome = await whileLockHeld(locations, () =>
    removeToolsWith(cwd, notification, {
      cascade: unreachableCascade,
      declarationIndex: unbuildableIndex,
    }),
  );

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [
    {
      message: `Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {lock held}\n    cause: ${lockHeldCause(locations)} -> Lock file is already being held`,
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await bytesOnDisk(), expectedBytes);
  notification.verifyInteractions();
});

test("FLR-02: an orchestrated remove under a held state lock returns lock held and changes nothing", async (testContext) => {
  // arrange
  const { cwd, locations, bytesOnDisk } = await layerCase(testContext, { base: TOOLS_DECLARED });
  const expectedBytes = await bytesOnDisk();
  const notification = notificationBoundary(0);

  // act
  const outcome = await whileLockHeld(locations, () =>
    removeToolsWith(cwd, notification, {
      cascade: unreachableCascade,
      declarationIndex: unbuildableIndex,
      orchestrated: true,
    }),
  );

  // assert
  assert.ok(outcome?.status === "failed");
  const { error, ...failure } = outcome;
  assert.deepStrictEqual(failure, {
    status: "failed",
    reason: "lock held",
    cause: lockHeldCause(locations),
  });
  assert.ok(error instanceof StateLockHeldError);
  assert.deepStrictEqual([error.scope, error.lockPath], ["project", locations.stateLockFile]);
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await bytesOnDisk(), expectedBytes);
  notification.verifyInteractions();
});

test("D-09: a marketplace holding no dependency record is removed without reading any declaration", async (testContext) => {
  // arrange
  const { cwd, locations } = await layerCase(testContext, { base: TOOLS_DECLARED });
  const notification = notificationBoundary(1);

  // act
  await removeToolsWith(cwd, notification, {
    cascade: unstagingCascade,
    declarationIndex: unbuildableIndex,
  });

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: TOOL_UNINSTALLED }]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("PRUNE-03: a dependency stays while the plugin that declares it fails to unstage", async (testContext) => {
  // arrange
  const { cwd, locations, bytesOnDisk } = await dependencyCase(
    testContext,
    { base: ALPHA_DECLARED },
    { alpha: pluginRecord(), lib: dependencyRecord() },
  );
  const [, baseBytes] = await bytesOnDisk();
  const calls: string[] = [];
  const notification = notificationBoundary(1);

  // act
  await removeToolsWith(cwd, notification, {
    cascade: recordingCascade(calls, "alpha"),
    declarationIndex: syntheticIndex({ "alpha@tools": ["lib@tools"], "lib@tools": [] }),
  });

  // assert
  assert.deepStrictEqual(calls, ["alpha"]);
  assert.deepStrictEqual(notification.calls, [
    {
      message:
        "Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ alpha (failed) {permission denied}\n    cause: alpha denied",
      severity: "error",
    },
  ]);
  assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), baseBytes);
  assert.deepStrictEqual(
    await loadState(locations.extensionRoot),
    toolsState(cwd, pathSource("./tools"), { alpha: pluginRecord(), lib: dependencyRecord() }),
  );
  notification.verifyInteractions();
});
