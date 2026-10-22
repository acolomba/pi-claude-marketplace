// WB-01 SC#4 architecture test gate.
//
// Locks the round-trip integrity contract: after any mutating command lands,
// reading the post-mutation config + state and running planReconcile against
// the merged view yields an empty plan (WB-01 SC#4). Unknown forward-compat
// keys at both entry-level and top-level survive any write-back (D-09 lenient
// schema).
//
// The reconcile no-op proof complements RECON-05 byte-stability: a fixed
// point in the reconcile-then-mutate-then-reconcile dynamic is the goal-
// backward criterion for the config/state split GREEN gate. The orchestrated-
// mode SKIP discipline (WR-09) is also structurally guarded here: when an
// orchestrator is called from a reconciler-driven caller (notifications:
// {mode: "orchestrated"}), the per-entry write-back SKIPS so the parent
// reconcile owns the single write.
//
// Structural shape: mirrors test/architecture/config-state-write-seams.test.ts
// (top-of-file rationale + per-test naming + node:test + node:assert/strict).

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { setMarketplaceAutoupdate } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { planReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import {
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { writeMarketplaceConfigEntry } from "../../extensions/pi-claude-marketplace/persistence/config-write-back.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  DEFAULT_STATE,
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const OFFICIAL_MARKETPLACE_REMOTE = "https://github.com/anthropics/claude-plugins-official.git";

function fixtureMarketplaceDir(name: "valid-marketplace"): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "orchestrators",
    "marketplace",
    "_fixtures",
    name,
  );
}

function createGitOps(options: { readonly fixtureSourceDir: string }) {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [OFFICIAL_MARKETPLACE_REMOTE],
    cloneFixture: {
      boundary: "local",
      sourceDir: options.fixtureSourceDir,
    },
  });
}

const ctx = { mode: "tui", ui: { notify: (): void => undefined } };

/** Loads a config file and narrows it to the valid arm. */
async function loadValidConfig(filePath: string): Promise<ScopeConfig> {
  const loaded = await loadConfig(filePath);
  assert.ok(loaded.status === "valid");
  return loaded.config;
}

/** Plans reconcile for the project scope from the files the case left on disk. */
async function planProjectReconcile(
  locations: ReturnType<typeof locationsFor>,
  config: ScopeConfig,
): Promise<ReconcilePlan> {
  const stateAfter = await loadState(locations.extensionRoot);
  return planReconcile(mergeScopeConfigs(config, {}), stateAfter, "project");
}

function pathMarketplaceRecord(name: string, cwd: string): ExtensionState["marketplaces"][string] {
  return {
    name,
    scope: "project",
    source: pathSource(`./${name}-src`),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, `${name}-src`, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: path.join(cwd, `${name}-src`),
    plugins: {},
  };
}

test("config-state-consistency: writeMarketplaceConfigEntry + planReconcile reads back the one declared marketplace", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const scopeRoot = path.join(cwd, ".pi");
  await mkdir(scopeRoot, { recursive: true });
  const filePath = path.join(scopeRoot, "claude-plugins.json");
  const empty: ScopeConfig = { schemaVersion: 1 };
  const expectedPlan = {
    ...emptyReconcilePlan("user"),
    marketplacesToAdd: [
      { configSource: "base", marketplace: "mp1", scope: "user", source: "owner/repo" },
    ],
  };

  // act
  await writeMarketplaceConfigEntry(empty, filePath, scopeRoot, "mp1", {
    source: "owner/repo",
    autoupdate: true,
  });
  const config = await loadValidConfig(filePath);
  const plan = planReconcile(mergeScopeConfigs(config, {}), DEFAULT_STATE, "user");

  // assert
  // Only the marketplace bucket is non-empty; the full no-op proof needs
  // orchestrator-level state mutation, exercised by the sibling cases.
  assert.deepStrictEqual(plan, expectedPlan);
});

test("WB-01 SC#4 (add path): after addMarketplace, reconcile is a no-op AND state ⊆ config (round-trip integrity)", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") });

  // act
  await addMarketplace({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
  });
  const config = await loadValidConfig(locations.baseConfigJsonPath);
  const state = await loadState(locations.extensionRoot);
  const plan = planReconcile(mergeScopeConfigs(config, {}), state, "project");

  // assert
  assert.ok("valid-marketplace" in state.marketplaces);
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("WB-01 SC#4 (add + autoupdate enable): post-flip reconcile is a no-op AND unknown forward-compat keys survive", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") });
  // futureField at the entry level (D-09); futureTopLevel at the top. The
  // pre-existing `legacy` entry must keep its futureField through the add
  // and the autoupdate flip.
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: {
        legacy: {
          source: "owner/legacy",
          ...({ futureField: "preserve me" } as Record<string, unknown>),
        },
      },
      ...({ futureTopLevel: "preserve me too" } as Record<string, unknown>),
    },
    locations.scopeRoot,
  );

  // act
  await addMarketplace({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
  });
  await setMarketplaceAutoupdate({
    ctx,
    run: runWithNothingLoaded(),
    name: "valid-marketplace",
    enable: true,
    scope: "project",
    cwd,
  });
  const config = await loadValidConfig(locations.baseConfigJsonPath);
  // The legacy entry is declared but not recorded in state, so reconcile
  // would plan it as 'to add'; pruning it focuses the plan on the mutated
  // marketplace.
  const configWithoutLegacy = {
    ...config,
    marketplaces: Object.fromEntries(
      Object.entries(config.marketplaces ?? {}).filter(([name]) => name !== "legacy"),
    ),
  };
  const plan = await planProjectReconcile(locations, configWithoutLegacy);

  // assert
  const configRecord = config as unknown as Record<string, unknown>;
  const legacyEntry = (config.marketplaces?.legacy ?? {}) as Record<string, unknown>;
  assert.strictEqual(legacyEntry.futureField, "preserve me");
  assert.strictEqual(configRecord.futureTopLevel, "preserve me too");
  assert.strictEqual(config.marketplaces?.["valid-marketplace"]?.autoupdate, true);
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("WB-01 SC#4 (add + autoupdate disable): post-flip reconcile is a no-op", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") });

  // act
  await addMarketplace({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
  });
  await setMarketplaceAutoupdate({
    ctx,
    run: runWithNothingLoaded(),
    name: "valid-marketplace",
    enable: true,
    scope: "project",
    cwd,
  });
  await setMarketplaceAutoupdate({
    ctx,
    run: runWithNothingLoaded(),
    name: "valid-marketplace",
    enable: false,
    scope: "project",
    cwd,
  });
  const config = await loadValidConfig(locations.baseConfigJsonPath);
  const plan = await planProjectReconcile(locations, config);

  // assert
  assert.strictEqual(config.marketplaces?.["valid-marketplace"]?.autoupdate, false);
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("WB-01 SC#4 (add + remove cascade): post-remove reconcile is a no-op and config no longer carries the marketplace entry", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") });

  // act
  await addMarketplace({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
  });
  await removeMarketplace({
    completionCache: createCompletionCache(),
    ctx,
    run: runWithNothingLoaded(),
    name: "valid-marketplace",
    scope: "project",
    cwd,
  });
  const config = await loadValidConfig(locations.baseConfigJsonPath);
  const stateAfter = await loadState(locations.extensionRoot);
  const plan = planReconcile(mergeScopeConfigs(config, {}), stateAfter, "project");

  // assert
  assert.strictEqual("valid-marketplace" in (config.marketplaces ?? {}), false);
  assert.strictEqual("valid-marketplace" in stateAfter.marketplaces, false);
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("WB-01 SC#4 (bare-form autoupdate flip, 2 marketplaces): BOTH config entries survive the batched write-back", async (t) => {
  // arrange
  // CR-01: a per-name sequential write loop rebuilt the file from the same
  // stale snapshot on each iteration, so a bare-form flip over N marketplaces
  // would persist only the last entry. The batched write-back lands every
  // flipped entry in one atomic save.
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp1: pathMarketplaceRecord("mp1", cwd),
      mp2: pathMarketplaceRecord("mp2", cwd),
    },
  });
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: { mp1: { source: "./mp1-src" }, mp2: { source: "./mp2-src" } },
    },
    locations.scopeRoot,
  );

  // act
  // Bare form: no name, so every marketplace the config declares flips.
  await setMarketplaceAutoupdate({
    ctx,
    run: runWithNothingLoaded(),
    enable: true,
    scope: "project",
    cwd,
  });
  const config = await loadValidConfig(locations.baseConfigJsonPath);

  // assert
  assert.deepStrictEqual(config.marketplaces, {
    mp1: { source: "./mp1-src", autoupdate: true },
    mp2: { source: "./mp2-src", autoupdate: true },
  });
});

test("WB-01 SC#4 (cross-scope CMP-3 install): project-scope install via user-scope marketplace fallback declares the adopted marketplace -- reconcile is a no-op", async (t) => {
  // arrange
  // CR-02: a project-scope install that resolves the marketplace through the
  // CMP-3 user-scope fallback clones the record into project state. The
  // write-back must declare both the plugin key and the adopted marketplace
  // in the project config; a bare plugin key is a dangling declaration the
  // planner turns into a marketplace removal plus a perpetual failed row.
  const { cwd, home } = await createHermeticEnvironment(t, "pi-cm-cr02-");
  const projectLocations = locationsFor("project", cwd);
  const userLocations = locationsFor("user", cwd);
  await mkdir(projectLocations.extensionRoot, { recursive: true });
  await mkdir(userLocations.extensionRoot, { recursive: true });
  const marketplaceRoot = path.join(home, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "tool");
  const skillDir = path.join(pluginRoot, "skills", "helper");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: helper\n---\n\nBody.\n");
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "tool", version: "0.0.1" }),
  );
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "tool", source: "./plugins/tool" }] }),
  );
  await saveState(userLocations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "user",
        source: pathSource(marketplaceRoot),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );

  // act
  // Marketplace "mp" is not in project state, so the install falls back to
  // the user-scope record and clones it into project state.
  await installPlugin({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "tool",
  });
  const config = await loadValidConfig(projectLocations.baseConfigJsonPath);
  const plan = await planProjectReconcile(projectLocations, config);

  // assert
  assert.strictEqual(config.marketplaces?.mp?.source, marketplaceRoot);
  assert.ok(config.plugins?.["tool@mp"] !== undefined);
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("WR-09 orchestrated-mode SKIP: addMarketplace with notifications.mode 'orchestrated' does NOT touch the config file", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "pi-cm-consistency-test-");
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace") });
  await mkdir(locations.scopeRoot, { recursive: true });
  const initialBytes = JSON.stringify({ schemaVersion: 1 });
  await writeFile(locations.baseConfigJsonPath, initialBytes, "utf8");
  const beforeStat = await stat(locations.baseConfigJsonPath);

  // act
  await addMarketplace({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    completionCache: createCompletionCache(),
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
    notifications: { mode: "orchestrated" },
  });
  const afterBytes = await readFile(locations.baseConfigJsonPath, "utf8");
  const afterStat = await stat(locations.baseConfigJsonPath);

  // assert
  // Only the config side is asserted: state may have changed.
  assert.strictEqual(afterBytes, initialBytes);
  assert.strictEqual(afterStat.mtimeMs, beforeStat.mtimeMs);
});
