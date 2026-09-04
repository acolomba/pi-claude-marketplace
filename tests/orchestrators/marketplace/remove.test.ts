import assert from "node:assert/strict";
import { watch } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  removeMarketplace,
  type RemoveMarketplaceOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
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
import { MarketplaceNotFoundError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  readonly pi: ExtensionAPI;
  readonly calls: NotificationCall[];
  verifyInteractions(): void;
}

function notificationBoundary(expectedCalls: 0 | 1): NotificationBoundary {
  const calls: NotificationCall[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  if (expectedCalls === 1) {
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(2);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        calls.push(severity === undefined ? { message } : { message, severity });
      })
      .once();
  }

  return {
    ctx,
    pi,
    calls,
    verifyInteractions(): void {
      verify(ctx);
      verify(pi);
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
    },
    enabled: true,
    installedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };
}

function emptyDropped(): CascadeDropped {
  return { agents: [], commands: [], hooks: [], mcpServers: [], skills: [] };
}

function marketplaceState(args: {
  readonly cwd: string;
  readonly name: string;
  readonly plugins?: Record<string, PluginRecord>;
  readonly scope: "project" | "user";
  readonly source: unknown;
}): ExtensionState {
  return {
    schemaVersion: 2,
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
  const cwd = await mkdtemp(path.join(tmpdir(), "marketplace-remove-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  testContext.after(() => rm(cwd, { recursive: true, force: true }));
  return { cwd, locations };
}

async function dualScopeCase(testContext: TestContext): Promise<{
  cwd: string;
  projectLocations: ScopedLocations;
  userLocations: ScopedLocations;
}> {
  const home = await mkdtemp(path.join(tmpdir(), "marketplace-remove-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "marketplace-remove-scopes-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  const projectLocations = locationsFor("project", cwd);
  const userLocations = locationsFor("user", cwd);
  await Promise.all([
    mkdir(projectLocations.extensionRoot, { recursive: true }),
    mkdir(userLocations.extensionRoot, { recursive: true }),
  ]);
  testContext.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await Promise.all([
      rm(cwd, { recursive: true, force: true }),
      rm(home, { recursive: true, force: true }),
    ]);
  });
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

test("reports an explicit-scope missing marketplace without mutating project state", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
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
    schemaVersion: 2,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("returns the complete orchestrated missing-marketplace outcome without notifying", async (testContext) => {
  // arrange
  const { cwd, projectLocations, userLocations } = await dualScopeCase(testContext);
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
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
    schemaVersion: 2,
    marketplaces: {},
  });
  assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
    schemaVersion: 2,
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
    ctx: notification.ctx,
    pi: notification.pi,
    name: "shared",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "removed", name: "shared", unstaged: [] });
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 2,
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
    ctx: notification.ctx,
    pi: notification.pi,
    name: "user-only",
    cwd,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "removed", name: "user-only", unstaged: [] });
  assert.deepStrictEqual(notification.calls, []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
    schemaVersion: 2,
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
      ctx: notification.ctx,
      pi: notification.pi,
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
      schemaVersion: 2,
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
    ctx: firstNotification.ctx,
    pi: firstNotification.pi,
    name: "gc-failure",
    scope: "project",
    cwd,
  });
  const retryNotification = notificationBoundary(0);
  const retryOutcome = await removeMarketplace({
    ctx: retryNotification.ctx,
    pi: retryNotification.pi,
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
    schemaVersion: 2,
    marketplaces: {},
  });
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
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
      return sourceKindReads <= 8 ? "unknown" : "future";
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
    ctx: notification.ctx,
    pi: notification.pi,
    name: marketplace,
    scope: "project",
    cwd,
  });

  // assert
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [{ message: "● future-source [project] (removed)" }]);
  assert.strictEqual(sourceKindReads, 12);
  assert.strictEqual(await readFile(path.join(cloneDir, "sentinel"), "utf8"), "clone");
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("sweeps marketplace and plugin declarations from both config layers", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "remove-me",
    source: pathSource("./remove-me"),
    plugins: { tool: pluginRecord() },
  });
  await saveConfig(
    locations.configJsonPath,
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
    locations.configLocalJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { "remove-me": { source: "./local-remove", autoupdate: true } },
      plugins: { "local-tool@remove-me": { enabled: false } },
    },
    locations.scopeRoot,
  );
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
    name: "remove-me",
    scope: "project",
    cwd,
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
    await readFile(locations.configJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "keep": {\n      "source": "./keep"\n    }\n  },\n  "plugins": {\n    "keep@keep": {\n      "enabled": true\n    }\n  }\n}\n',
  );
  assert.strictEqual(
    await readFile(locations.configLocalJsonPath, "utf8"),
    '{\n  "schemaVersion": 1,\n  "marketplaces": {},\n  "plugins": {}\n}\n',
  );
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("leaves a valid unrelated sibling config layer byte-identical", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "remove-me",
    source: pathSource("./remove-me"),
  });
  await saveConfig(
    locations.configJsonPath,
    { schemaVersion: 1, marketplaces: { "remove-me": { source: "./remove-me" } } },
    locations.scopeRoot,
  );
  await saveConfig(
    locations.configLocalJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { keep: { source: "./keep" } },
      plugins: { "tool@keep": { enabled: true } },
    },
    locations.scopeRoot,
  );
  const localBytes = await readFile(locations.configLocalJsonPath, "utf8");
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
    name: "remove-me",
    scope: "project",
    cwd,
  });

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: "● remove-me [project] (removed)" }]);
  assert.strictEqual(await readFile(locations.configLocalJsonPath, "utf8"), localBytes);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  notification.verifyInteractions();
});

test("leaves an invalid sibling config layer byte-identical", async (testContext) => {
  // arrange
  const { cwd, locations } = await projectCase(testContext);
  await seedMarketplace(locations, {
    cwd,
    name: "remove-me",
    source: pathSource("./remove-me"),
  });
  await saveConfig(
    locations.configJsonPath,
    { schemaVersion: 1, marketplaces: { "remove-me": { source: "./remove-me" } } },
    locations.scopeRoot,
  );
  const invalidLocalBytes = "{ invalid local config";
  await writeFile(locations.configLocalJsonPath, invalidLocalBytes);
  const notification = notificationBoundary(1);

  // act
  await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
    name: "remove-me",
    scope: "project",
    cwd,
  });

  // assert
  assert.deepStrictEqual(notification.calls, [{ message: "● remove-me [project] (removed)" }]);
  assert.strictEqual(await readFile(locations.configLocalJsonPath, "utf8"), invalidLocalBytes);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
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
  await writeFile(locations.configLocalJsonPath, invalidBytes);
  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
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
  assert.strictEqual(notification.calls[0]?.message.includes(locations.configLocalJsonPath), false);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
  assert.strictEqual(await readFile(locations.configLocalJsonPath, "utf8"), invalidBytes);
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
  await writeFile(locations.configJsonPath, "{ invalid base config");
  const notification = notificationBoundary(0);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
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
    locations.configJsonPath,
    { schemaVersion: 1, marketplaces: { "write-failure": { source: "./write-failure" } } },
    locations.scopeRoot,
  );
  const configBytes = await readFile(locations.configJsonPath, "utf8");
  const outsideRoot = await mkdtemp(path.join(tmpdir(), "marketplace-remove-config-outside-"));
  testContext.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideConfigPath = path.join(outsideRoot, "claude-plugins.json");
  await writeFile(outsideConfigPath, configBytes);
  const originalConfigPath = `${locations.configJsonPath}.original`;
  const firstNotification = notificationBoundary(0);
  let blockWrite = true;
  const firstCascade: typeof cascadeUnstagePlugin = async () => {
    if (blockWrite) {
      await rename(locations.configJsonPath, originalConfigPath);
      await symlink(outsideConfigPath, locations.configJsonPath);
    }

    return { ok: true, dropped: emptyDropped() };
  };

  let thrown: unknown;

  // act
  try {
    await removeMarketplace({
      ctx: firstNotification.ctx,
      pi: firstNotification.pi,
      name: "write-failure",
      scope: "project",
      cwd,
      cascade: firstCascade,
    });
  } catch (error) {
    thrown = error;
  }

  const stateAfterFailure = await loadState(locations.extensionRoot);
  const configAfterFailure = await readFile(locations.configJsonPath, "utf8");
  await rm(locations.configJsonPath, { force: true });
  await rename(originalConfigPath, locations.configJsonPath);
  blockWrite = false;
  const retryNotification = notificationBoundary(1);
  const retryOutcome = await removeMarketplace({
    ctx: retryNotification.ctx,
    pi: retryNotification.pi,
    name: "write-failure",
    scope: "project",
    cwd,
    cascade: firstCascade,
  });

  // assert
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /contains symlink/i);
  assert.deepStrictEqual(firstNotification.calls, []);
  assert.deepStrictEqual(stateAfterFailure, initialState);
  assert.strictEqual(configAfterFailure, configBytes);
  assert.strictEqual(await readFile(outsideConfigPath, "utf8"), configBytes);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
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
    locations.configJsonPath,
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
      ctx: firstNotification.ctx,
      pi: firstNotification.pi,
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
  const configAfterFailure = await loadConfig(locations.configJsonPath);
  breakStateSave = false;
  const retryNotification = notificationBoundary(1);
  const retryOutcome = await removeMarketplace({
    ctx: retryNotification.ctx,
    pi: retryNotification.pi,
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
    filePath: locations.configJsonPath,
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
    schemaVersion: 2,
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
    locations.configJsonPath,
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
  const configBytes = await readFile(locations.configJsonPath, "utf8");
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
        },
        cause: betaFailure,
      });
    }

    return Promise.resolve({ ok: true, dropped: emptyDropped() });
  };

  const firstNotification = notificationBoundary(1);

  // act
  const firstOutcome = await removeMarketplace({
    ctx: firstNotification.ctx,
    pi: firstNotification.pi,
    name: marketplace,
    scope: "project",
    cwd,
    cascade,
  });
  const stateAfterFirst = await loadState(locations.extensionRoot);
  const configAfterFirst = await readFile(locations.configJsonPath, "utf8");
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
    ctx: retryNotification.ctx,
    pi: retryNotification.pi,
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
    schemaVersion: 2,
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
            },
            enabled: true,
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
    schemaVersion: 2,
    marketplaces: {},
  });
  assert.strictEqual(await pathExists(marketplaceData), false);
  assert.strictEqual(await pathExists(cloneDir), false);
  firstNotification.verifyInteractions();
  retryNotification.verifyInteractions();
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
    ctx: notification.ctx,
    pi: notification.pi,
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
  const replacementPath = path.join(locations.extensionRoot, "replacement-state.json");
  await writeFile(replacementPath, '{\n  "schemaVersion": 2,\n  "marketplaces": {}\n}\n');
  let replaced = false;
  const stateLockName = path.basename(locations.stateLockFile);
  const watcher = watch(locations.extensionRoot, (_event, filename) => {
    if (!replaced && filename === stateLockName) {
      replaced = true;
      void rename(replacementPath, locations.stateJsonPath);
    }
  });
  testContext.after(() => {
    watcher.close();
  });
  const cascade: typeof cascadeUnstagePlugin = () => {
    throw new Error("cascade must not run after the record vanished");
  };

  const notification = notificationBoundary(1);

  // act
  const outcome = await removeMarketplace({
    ctx: notification.ctx,
    pi: notification.pi,
    name: "concurrent",
    scope: "project",
    cwd,
    cascade,
  });

  // assert
  assert.strictEqual(replaced, true);
  assert.strictEqual(outcome, undefined);
  assert.deepStrictEqual(notification.calls, [{ message: "● concurrent [project] (removed)" }]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  notification.verifyInteractions();
});
