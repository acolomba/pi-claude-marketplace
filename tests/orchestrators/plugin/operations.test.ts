import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  createDependencyInstallOperation,
  createEnableOperation,
  createInstallOperation,
  createPruneOperation,
  createReinstallOperation,
  createUninstallOperation,
  fetchPlugins,
  getPluginInfo,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { EnableDisableHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts";
import type { InstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts";
import type { ReinstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
import type { UninstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  NotificationContext,
  ToolInventory,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { TestContext } from "node:test";

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface FetchBoundary {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly notifications: NotifyRecord[];
  readonly verifyBoundary: () => void;
}

/**
 * The fetch command's notification boundary. fetch is handed the whole
 * `ExtensionContext` / `ExtensionAPI` rather than the two narrow read contracts
 * `makeCtx` builds, so the members it may reach are stated as expectations and
 * verified after the call: one cascade emission and the single soft-dependency
 * probe, which reads the tool list twice.
 */
function makeFetchBoundary(): FetchBoundary {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "fetch context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "fetch extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "fetch UI" });
  const notifications: NotifyRecord[] = [];
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .once();
  return {
    ctx,
    pi,
    notifications,
    verifyBoundary: () => {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
}

function makeCtx(): {
  ctx: NotificationContext;
  pi: ToolInventory;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  return { ctx, pi: { getAllTools: () => [] }, notifications };
}

/**
 * The project-scope state that records one path-source marketplace and no
 * installed plugin. Shared by the seeders below so the record they write is one
 * literal rather than one per fixture.
 */
function marketplaceOnlyState(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly manifestPath: string;
  readonly marketplaceRoot: string;
}): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      [opts.marketplace]: {
        name: opts.marketplace,
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath: opts.manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  };
}

/**
 * Seed a path-source marketplace whose single plugin declares `hooks/hooks.json`,
 * plus the state record that makes it resolvable. Deliberately minimal: this
 * owner asserts the composed operation's real effects, not fixture variety.
 */
async function seedHooksDeclaringPlugin(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly hooksJson: object;
  /** Optional `commands/<name>.md` declaration, for cases that need one. */
  readonly commandName?: string;
}): Promise<void> {
  const { cwd, marketplace, plugin } = opts;
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "hooks"));
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"));
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin, version: "0.0.1" }),
  );
  await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(opts.hooksJson));
  if (opts.commandName !== undefined) {
    await mkdir(path.join(pluginRoot, "commands"));
    await writeFile(
      path.join(pluginRoot, "commands", `${opts.commandName}.md`),
      `Run ${opts.commandName}.\n`,
    );
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: [{ name: plugin, source: `./plugins/${plugin}` }],
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(
    locations.extensionRoot,
    marketplaceOnlyState({ cwd, marketplace, manifestPath, marketplaceRoot }),
  );
}

/**
 * Seed a marketplace whose single plugin entry is a PINNED url source, with the
 * per-sha clone already materialized under the scope's clone cache.
 *
 * That combination is the one fetch shape that reaches the bound status
 * capability and then returns without any git materialize: `fetchOne` runs the
 * fs-only presence probe first and short-circuits a pinned source it finds
 * warm. A composition holding anything other than the real
 * `makePresenceProbe` would miss the warm clone and fall through to the clone
 * seam, which this case supplies no override for.
 */
async function seedWarmPinnedPlugin(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly cloneUrl: string;
  readonly sha: string;
}): Promise<void> {
  const { cwd, marketplace, plugin, cloneUrl, sha } = opts;
  const marketplaceRoot = path.join(cwd, "mp-src");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: [{ name: plugin, source: { source: "url", url: cloneUrl, sha } }],
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(
    locations.extensionRoot,
    marketplaceOnlyState({ cwd, marketplace, manifestPath, marketplaceRoot }),
  );

  const cloneDir = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, sha));
  await mkdir(path.join(cloneDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(cloneDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin, version: "2.0.0" }),
  );
}

async function seedOrphanForPrune(scope: Scope, cwd: string): Promise<ExtensionState> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(locations.extensionRoot, "sources", "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "orphan");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./plugins/orphan" }] }),
  );
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "orphan", version: "1.0.0" }),
  );
  const skillPath = path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, "---\nname: orphan-skill\n---\nbody\n");
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          orphan: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: ["orphan-skill"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            provenance: "dependency",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await saveState(locations.extensionRoot, state);
  return state;
}

test("constructs the install operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const installPlugin = createInstallOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof installPlugin, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after a successful installPlugin for a plugin declaring a
// hooks.json, the hooks-bridge routing table reflects the new entry. Without
// the rebuildRoutingTables call inside the per-plugin lock, the routing table
// would stay pinned to whatever the last reconcile produced and the new
// plugin would not receive dispatch until `/reload` (NFR-2 violation).
//
// This case owns the CONCRETE transaction wrapper: it runs the composed
// operation against the real phase ledger and the real state lock, so the
// production bindings this module holds are the ones under test.
// ─────────────────────────────────────────────────────────────────────────────

test("constructs the dependency-install operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const installMissingDependency = createDependencyInstallOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof installMissingDependency, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

test("WR-03: installPlugin of a hooks-declaring plugin rebuilds the routing table without /reload", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
  const { cwd } = await createHermeticEnvironment(t, "install-operation-wr03-");
  const ownerRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const installPlugin = createInstallOperation(
    createHooksRouting(ownerRuntime, { readHooksJson }),
    createCompletionCache(),
  );
  const locations = locationsFor("project", cwd);
  await seedHooksDeclaringPlugin({
    cwd,
    marketplace: "mp",
    plugin: "p1",
    hooksJson: {
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
    },
  });
  // Pre-condition: the routing table's PreToolUse bucket is empty.
  assert.deepStrictEqual(ownerRuntime.getRoutingBucket("PreToolUse"), []);
  const { ctx, pi, notifications } = makeCtx();

  // act
  const outcome = await installPlugin({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    status: "installed",
    version: "0.0.1",
    resourcesChanged: false,
    declaresAgents: false,
    declaresMcp: false,
  });

  // Confirm install succeeded (no "failed" / "unavailable" notification).
  // The first notification carries the cascade text; we only need the
  // routing-table effect to be observable.
  const summary = notifications.map((n) => n.message).join("\n");
  assert.ok(
    !summary.includes("(failed)") && !summary.includes("(unavailable)"),
    `expected clean install notification; got: ${summary}`,
  );

  // The plugin must have its hooks resource recorded -- otherwise the
  // bridge cache lookup at rebuild time would silently skip it. The whole
  // record is pinned, which also covers D-100-01 / ENBL-11: the same install
  // describes the hook entries `info` reports once the artifacts are gone.
  // A tool event carries its matcher (empty string = match-all); no handler
  // payload is recorded.
  const afterState = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins["p1"], {
    version: "0.0.1",
    resolvedSource: path.join(cwd, "mp-src", "plugins", "p1"),
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["p1"] },
    hookEntries: [{ event: "PreToolUse", matcher: "" }],
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // The materialized config is the dispatch input, so its complete bytes are
  // the contract -- not a re-parsed object a consumer never sees.
  assert.strictEqual(
    await readFile(path.join(locations.hooksDir, "p1", "hooks.json"), "utf8"),
    '{\n  "PreToolUse": [\n    {\n      "matcher": "",\n      "hooks": [\n        {\n          "type": "command",\n          "command": "echo hello"\n        }\n      ]\n    }\n  ]\n}\n',
  );

  // Post-condition: the routing table now reflects the installed plugin's
  // PreToolUse entry. This proves WR-03's `rebuildRoutingTables()` ran
  // inside the per-plugin lock right after `addPluginConfigToCache`.
  // resolvedSource must propagate from the resolver -> cache -> routing
  // table; without it a regression that drops the pluginRoot argument from
  // addPluginConfigToCache(...) would not be caught at the orchestrator-test
  // layer. CLAUDE_PLUGIN_ROOT export at dispatch depends on this field.
  const bucket = ownerRuntime.getRoutingBucket("PreToolUse");
  assert.equal(bucket.length, 1);
  assert.equal(bucket[0]?.pluginId, "p1");
  assert.equal(bucket[0]?.scope, "project");
  assert.equal(bucket[0]?.handlerDecl["command"], "echo hello");
  assert.equal(
    bucket[0]?.resolvedSource,
    afterState.marketplaces["mp"]?.plugins["p1"]?.resolvedSource,
    "RoutingEntry.resolvedSource must mirror state.json's resolvedSource",
  );
  assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
});

test("constructs the enable operation without using its owner or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<EnableDisableHooksRouting>({
    exactParams: true,
    name: "hooks routing",
  });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const setPluginEnabled = createEnableOperation(hooksRouting);
  resources.disable();

  // assert
  assert.strictEqual(typeof setPluginEnabled, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
});

test("constructs the uninstall operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<UninstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const uninstallPlugin = createUninstallOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof uninstallPlugin, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

test("constructs the prune operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<UninstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const prunePlugin = createPruneOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof prunePlugin, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

test("the composed prune operation removes an orphan in the default user scope", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "prune-operation-user-");
  const seeded = await seedOrphanForPrune("user", cwd);
  const locations = locationsFor("user", cwd);
  const stateBefore = await readFile(locations.stateJsonPath, "utf8");
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  const lockSpy = t.mock.method(lockfile, "lock");
  const fetchSpy = t.mock.method(globalThis, "fetch", () => {
    throw new Error("prune must stay offline");
  });
  const { ctx, pi, notifications } = makeCtx();

  // act
  const prunePlugin = createPruneOperation(hooksRouting, completionCache);
  const stateAfterConstruction = await readFile(locations.stateJsonPath, "utf8");
  const locksAfterConstruction = lockSpy.mock.callCount();
  await prunePlugin({ ctx, pi, cwd });

  // assert
  assert.strictEqual(stateAfterConstruction, stateBefore);
  assert.strictEqual(locksAfterConstruction, 0);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    ...seeded,
    marketplaces: { mp: { ...seeded.marketplaces.mp, plugins: {} } },
  });
  assert.strictEqual(
    await pathExists(path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md")),
    false,
  );
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
    },
  ]);
  assert.strictEqual(lockSpy.mock.callCount(), 1);
  assert.strictEqual(fetchSpy.mock.callCount(), 0);
});

test("the composed prune operation removes only the selected project orphan", async (t) => {
  // arrange
  const {
    cwd,
    runtime,
    hooksRouting,
    locations: project,
  } = await installHooksDeclaringPlugin(t, "prune-operation-project-");
  await seedOrphanForPrune("user", cwd);
  const user = locationsFor("user", cwd);
  const userBefore = await readFile(user.stateJsonPath, "utf8");
  const installed = await loadState(project.extensionRoot);
  const record = installed.marketplaces["mp"]?.plugins["p1"];
  assert.ok(record);
  installed.marketplaces["mp"]!.plugins["p1"] = { ...record, provenance: "dependency" };
  await saveState(project.extensionRoot, installed);
  const completionCache = createCompletionCache();
  const cacheDropSpy = t.mock.method(completionCache, "dropMarketplaceCache");
  const lockSpy = t.mock.method(lockfile, "lock");
  const fetchSpy = t.mock.method(globalThis, "fetch", () => {
    throw new Error("prune must stay offline");
  });
  const { ctx, pi, notifications } = makeCtx();

  // act
  const prunePlugin = createPruneOperation(hooksRouting, completionCache);
  await prunePlugin({ ctx, pi, cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(await loadState(project.extensionRoot), {
    ...installed,
    marketplaces: { mp: { ...installed.marketplaces.mp, plugins: {} } },
  });
  assert.strictEqual(await readFile(user.stateJsonPath, "utf8"), userBefore);
  assert.strictEqual(
    await pathExists(path.join(user.skillsTargetDir, "orphan-skill", "SKILL.md")),
    true,
  );
  assert.strictEqual(await pathExists(path.join(project.hooksDir, "p1", "hooks.json")), false);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project]\n  ○ p1 v0.0.1 (uninstalled) {dependency pruned}\n\n/reload to pick up changes",
    },
  ]);
  assert.strictEqual(cacheDropSpy.mock.callCount(), 1);
  assert.strictEqual(lockSpy.mock.callCount(), 1);
  assert.strictEqual(fetchSpy.mock.callCount(), 0);
});

test("constructs the reinstall operation without using its owners or starting asynchronous work", (t) => {
  // arrange
  const hooksRouting = mock<ReinstallHooksRouting>({ exactParams: true, name: "hooks routing" });
  const completionCache = mock<CompletionCache>({ exactParams: true, name: "completion cache" });
  const startedResourceTypes: string[] = [];
  const resources = createHook({
    init: (_asyncId, type) => {
      startedResourceTypes.push(type);
    },
  });
  t.after(() => resources.disable());

  // act
  resources.enable();
  const reinstallPlugin = createReinstallOperation(hooksRouting, completionCache);
  resources.disable();

  // assert
  assert.strictEqual(typeof reinstallPlugin, "function");
  assert.deepStrictEqual(startedResourceTypes, []);
  verify(hooksRouting);
  verify(completionCache);
});

/**
 * Install the seeded hooks-declaring plugin through the composed install
 * operation and hand back the live lifecycle owners the enable and uninstall
 * operations then act on. The composed install is the fixture here, not the
 * subject: what each caller asserts is what its own operation does next.
 */
async function installHooksDeclaringPlugin(
  t: TestContext,
  prefix: string,
  commandName?: string,
): Promise<{
  readonly cwd: string;
  readonly runtime: ReturnType<typeof createHooksRuntime>;
  readonly hooksRouting: ReturnType<typeof createHooksRouting>;
  readonly locations: ReturnType<typeof locationsFor>;
}> {
  const { cwd } = await createHermeticEnvironment(t, prefix);
  const runtime = createHooksRuntime();
  const hooksRouting = createHooksRouting(runtime, { readHooksJson });
  await seedHooksDeclaringPlugin({
    cwd,
    marketplace: "mp",
    plugin: "p1",
    hooksJson: {
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hello" }] }],
    },
    ...(commandName !== undefined && { commandName }),
  });
  const { ctx, pi } = makeCtx();
  await createInstallOperation(
    hooksRouting,
    createCompletionCache(),
  )({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
  });
  return { cwd, runtime, hooksRouting, locations: locationsFor("project", cwd) };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENBL-18 / D-100-10: the composed enable operation runs against the real
// `cascadeUnstagePlugin`, `runInstallLedger`, config-write and state-lock
// bindings this module holds. A disable must unstage the artifacts, flip the
// record to its disabled form with the inventory intact, and drop the plugin's
// routes -- all of which are effects of those concrete bindings, so replacing
// any of them with a no-op is visible here.
// ─────────────────────────────────────────────────────────────────────────────

test("setPluginEnabled(false) unstages the artifacts, flips durable state and drops the routes", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
  const { cwd, runtime, hooksRouting, locations } = await installHooksDeclaringPlugin(
    t,
    "enable-operation-",
  );
  const setPluginEnabled = createEnableOperation(hooksRouting);
  // Pre-conditions: the install left one live route and a staged hooks.json.
  assert.equal(runtime.getRoutingBucket("PreToolUse").length, 1);
  assert.equal(await pathExists(path.join(locations.hooksDir, "p1", "hooks.json")), true);
  const { ctx, pi } = makeCtx();

  // act
  const outcome = await setPluginEnabled({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
    enable: false,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "disabled", name: "p1", version: "0.0.1" });

  // The whole record is pinned: `enabled` flips and `updatedAt` restamps, and
  // every other field -- including the complete `resources` inventory the
  // re-enable ledger replays -- survives the disable unchanged.
  const afterState = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins["p1"], {
    version: "0.0.1",
    resolvedSource: path.join(cwd, "mp-src", "plugins", "p1"),
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["p1"] },
    hookEntries: [{ event: "PreToolUse", matcher: "" }],
    enabled: false,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // The cascade removed the materialized config, and the routing table no
  // longer dispatches to a plugin whose artifacts are gone.
  assert.equal(await pathExists(path.join(locations.hooksDir, "p1", "hooks.json")), false);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// PU-1..8: the composed uninstall operation runs against the real cascade,
// removal-commit, config-sweep, post-commit-cleanup and state-lock bindings.
// Removing the record, the artifacts and the routes together is what proves
// the bound transaction -- not a stand-in -- executed.
// ─────────────────────────────────────────────────────────────────────────────

test("uninstallPlugin removes the record, the staged artifacts and the routes", async (t) => {
  // arrange
  const { cwd, runtime, hooksRouting, locations } = await installHooksDeclaringPlugin(
    t,
    "uninstall-operation-",
  );
  const uninstallPlugin = createUninstallOperation(hooksRouting, createCompletionCache());
  // Pre-conditions: the install left one live route and a staged hooks.json.
  assert.equal(runtime.getRoutingBucket("PreToolUse").length, 1);
  assert.equal(await pathExists(path.join(locations.hooksDir, "p1", "hooks.json")), true);
  const { ctx, pi } = makeCtx();

  // act
  const outcome = await uninstallPlugin({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.deepStrictEqual(outcome, { status: "uninstalled", name: "p1", version: "0.0.1" });

  // The marketplace record survives with an empty plugin map -- uninstall
  // removes the plugin, never the marketplace that declared it.
  const afterState = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins, {});

  assert.equal(await pathExists(path.join(locations.hooksDir, "p1")), false);
  assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// PRL-02 / D-68-02: the composed reinstall operation runs against the real
// prepare, replace, rollback, finalize and state-lock bindings this module
// holds. Re-materializing an edited source in place -- the replaced bytes on
// disk, the replaced handler in the routing table, and the recorded version
// left where it was because reinstall never upgrades -- is an effect of those
// concrete bindings, so replacing any one of them with a no-op is visible here.
// ─────────────────────────────────────────────────────────────────────────────

test("reinstallPlugin replaces the staged artifacts in place and re-routes the plugin", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 0, 1) });
  const { cwd, runtime, hooksRouting, locations } = await installHooksDeclaringPlugin(
    t,
    "reinstall-operation-",
  );
  const reinstallPlugin = createReinstallOperation(hooksRouting, createCompletionCache());
  // Pre-condition: the install staged and routed the original handler.
  assert.equal(runtime.getRoutingBucket("PreToolUse")[0]?.handlerDecl["command"], "echo hello");
  await writeFile(
    path.join(cwd, "mp-src", "plugins", "p1", "hooks", "hooks.json"),
    JSON.stringify({
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo goodbye" }] }],
    }),
  );
  const { ctx, pi } = makeCtx();

  // act
  const outcome = await reinstallPlugin({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "p1",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "reinstalled",
    name: "p1",
    marketplace: "mp",
    scope: "project",
    version: "0.0.1",
    resourcesChanged: false,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
  });

  // The whole record is pinned: D-68-02 forbids an upgrade, so `version` and
  // the complete `resources` inventory survive the replacement unchanged.
  const afterState = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(afterState.marketplaces["mp"]?.plugins["p1"], {
    version: "0.0.1",
    resolvedSource: path.join(cwd, "mp-src", "plugins", "p1"),
    compatibility: { installable: true, notes: [], supported: ["hooks"], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: ["p1"] },
    hookEntries: [{ event: "PreToolUse", matcher: "" }],
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  // The replaced config is the dispatch input, so its complete bytes are the
  // contract -- written as an independent literal, not re-serialized here.
  assert.strictEqual(
    await readFile(path.join(locations.hooksDir, "p1", "hooks.json"), "utf8"),
    '{\n  "PreToolUse": [\n    {\n      "matcher": "",\n      "hooks": [\n        {\n          "type": "command",\n          "command": "echo goodbye"\n        }\n      ]\n    }\n  ]\n}\n',
  );

  // Post-condition: the routing table dispatches the replaced handler, with no
  // stale duplicate left behind by the removed one.
  const bucket = runtime.getRoutingBucket("PreToolUse");
  assert.equal(bucket.length, 1);
  assert.equal(bucket[0]?.pluginId, "p1");
  assert.equal(bucket[0]?.handlerDecl["command"], "echo goodbye");
});

// ─────────────────────────────────────────────────────────────────────────────
// FTCH-01 / D-81-02: the composed fetch command runs against the real
// `git-source-probe` status capability this module binds. A pinned url source
// whose clone is already warm is answered entirely by that fs-only probe: the
// row is the no-op `(skipped) {up-to-date}`, nothing is written, and no clone
// seam override is supplied -- so a composition that failed to see the warm
// clone would fall through to the real git backend rather than pass quietly.
// ─────────────────────────────────────────────────────────────────────────────

test("fetchPlugins answers a warm pinned source from the bound status capability", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "fetch-operation-");
  const cloneUrl = "https://example.com/warm-pinned";
  const sha = "bdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbdbd";
  await seedWarmPinnedPlugin({ cwd, marketplace: "mp", plugin: "p1", cloneUrl, sha });
  const locations = locationsFor("project", cwd);
  const stateBefore = await readFile(locations.stateJsonPath, "utf8");
  const boundary = makeFetchBoundary();

  // act
  await fetchPlugins({
    ctx: boundary.ctx,
    pi: boundary.pi,
    scope: "project",
    cwd,
    target: { kind: "plugin", marketplace: "mp", plugin: "p1" },
  });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project]\n  ⊘ p1 (skipped) {up-to-date}" },
  ]);

  // Derive-not-persist: fetch's only write is the clone seam's, and the warm
  // no-op never reaches it, so the recorded state is byte-unchanged.
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
  boundary.verifyBoundary();
});

// ─────────────────────────────────────────────────────────────────────────────
// INFO-02 / D-100-01: the composed info command runs against the real
// read-only filesystem capability this module binds. BOTH members are
// exercised by one installed plugin that declares a command and a hooks
// config: the hook summary comes from `readTextFile` over `hooks.json`, and
// the command inventory from `listDirectory` over the plugin's `commands/`
// directory, which is why the fixture declares one.
// ─────────────────────────────────────────────────────────────────────────────

test("getPluginInfo reports the installed plugin through the bound reader capability", async (t) => {
  // arrange
  const { cwd } = await installHooksDeclaringPlugin(t, "info-operation-", "c1");
  const { ctx, pi, notifications } = makeCtx();

  // act
  await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p1", scope: "project", cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: [
        "● mp [project] <no autoupdate>",
        "  ● p1 v0.0.1 (installed)",
        "    commands: c1",
        "    hooks:",
        "      PreToolUse()",
      ].join("\n"),
    },
  ]);
});
