// Owner suite for orchestrators/reconcile/convergence.ts.
//
// Every case stages a real path-source marketplace on a case-owned temporary
// tree and hands the planner a seeded state, so the declaration walk, the
// manifest read and the candidate resolve all run against disk.

import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { planConvergence } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { PlannedMove } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import type { ReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

interface Fixture {
  readonly locations: ScopedLocations;
  readonly cwd: string;
}

async function createFixture(t: TestContext, label: string): Promise<Fixture> {
  const { cwd } = await createHermeticEnvironment(t, `convergence-${label}-`);
  return { cwd, locations: locationsFor("project", cwd) };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

function marketplaceRootOf(fixture: Fixture, marketplace: string): string {
  return path.join(fixture.locations.extensionRoot, "marketplaces", marketplace);
}

/** A plugin directory with its own manifest, which declares `version` when given. */
async function stagePlugin(root: string, version?: string): Promise<void> {
  await writeUnder(
    path.join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify(version === undefined ? {} : { version }),
  );
}

/** Writes the marketplace manifest and returns its record (without plugins). */
async function stageMarketplace(
  fixture: Fixture,
  marketplace: string,
  entries: readonly Record<string, unknown>[],
): Promise<Omit<MarketplaceRecord, "plugins">> {
  const marketplaceRoot = marketplaceRootOf(fixture, marketplace);
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(manifestPath, JSON.stringify({ name: marketplace, plugins: entries }));
  return {
    name: marketplace,
    scope: "project",
    source: `acme/${marketplace}`,
    addedFromCwd: fixture.cwd,
    manifestPath,
    marketplaceRoot,
  };
}

function pluginRecord(resolvedSource: string, overrides: Partial<PluginRecord> = {}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stateOf(...marketplaces: readonly MarketplaceRecord[]): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(marketplaces.map((mp) => [mp.name, mp])),
  };
}

/** `tools` offers `demo` at `offered`; the record holds `demo` 1.0.0 at its catalog root. */
async function stageDemo(
  fixture: Fixture,
  offered: string,
  record: Partial<PluginRecord> = {},
): Promise<ExtensionState> {
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", source: "./demo" }]);
  const root = path.join(mp.marketplaceRoot, "demo");
  await stagePlugin(root, offered);
  return stateOf({ ...mp, plugins: { demo: pluginRecord(root, record) } });
}

function demoMove(overrides: Partial<PlannedMove> = {}): PlannedMove {
  return {
    scope: "project",
    marketplace: "tools",
    plugin: "demo",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    revisionChanged: true,
    grew: false,
    partial: false,
    ...overrides,
  };
}

function planWith(overrides: Partial<ReconcilePlan>): ReconcilePlan {
  return { ...emptyReconcilePlan("project"), ...overrides };
}

const DEMO_OP = { scope: "project", marketplace: "tools", plugin: "demo" } as const;

test("D-10: a newer catalog version is a move that names both versions", async (t) => {
  // arrange
  const fixture = await createFixture(t, "newer");
  const state = await stageDemo(fixture, "1.1.0");

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove()] });
});

test("D-10: a move of a record installed partial says so", async (t) => {
  // arrange
  const fixture = await createFixture(t, "partial");
  const state = await stageDemo(fixture, "1.1.0", {
    compatibility: { installable: false, notes: [], supported: [], unsupported: ["lsp"] },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ partial: true })] });
});

test("D-10: the recorded version at the recorded root is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "same");
  const state = await stageDemo(fixture, "1.0.0");

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-10 / D-18-11: a changed plugin root at the same version is a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "root");
  const state = await stageDemo(fixture, "1.0.0", {
    resolvedSource: path.join(marketplaceRootOf(fixture, "tools"), "demo-old"),
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ toVersion: "1.0.0" })] });
});

test("D-10: a move from a recorded commit carries it as the from side", async (t) => {
  // arrange
  const fixture = await createFixture(t, "commit");
  const fromCommit = "a".repeat(40);
  const state = await stageDemo(fixture, "1.1.0", { resolvedSha: fromCommit });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ fromCommit })] });
});

test("ENBL-08: a disabled record is never a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "disabled");
  const state = await stageDemo(fixture, "1.1.0", { enabled: false });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

const PLANS_THAT_LEAVE_NO_MOVE: readonly {
  readonly title: string;
  readonly plan: ReconcilePlan;
}[] = [
  {
    title: "a record the plan disables",
    plan: planWith({ pluginsToDisable: [DEMO_OP] }),
  },
  {
    title: "a record the plan dependency-disables",
    plan: planWith({
      pluginsToDependencyDisable: [{ ...DEMO_OP, dependency: "lib@tools", kind: "missing" }],
    }),
  },
  {
    title: "a record the plan uninstalls",
    plan: planWith({ pluginsToUninstall: [DEMO_OP] }),
  },
  {
    title: "a record of a marketplace the plan removes",
    plan: planWith({
      marketplacesToRemove: [{ scope: "project", marketplace: "tools", plugins: ["demo"] }],
    }),
  },
];

for (const { title, plan: reconcilePlan } of PLANS_THAT_LEAVE_NO_MOVE) {
  test(`D-10: ${title} is not a move`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "planned");
    const state = await stageDemo(fixture, "1.1.0");

    // act
    const plan = await planConvergence({
      scope: "project",
      state,
      locations: fixture.locations,
      plan: reconcilePlan,
    });

    // assert
    assert.deepStrictEqual(plan, { moves: [] });
  });
}

test("D-10: a record the plan enables is a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "enabled");
  const state = await stageDemo(fixture, "1.1.0", { enabled: false });

  // act
  const plan = await planConvergence({
    scope: "project",
    state,
    locations: fixture.locations,
    plan: planWith({ pluginsToEnable: [DEMO_OP] }),
  });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove()] });
});

test("D-10: a record the plan leaves alone keeps its move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "untouched");
  const state = await stageDemo(fixture, "1.1.0");

  // act
  const plan = await planConvergence({
    scope: "project",
    state,
    locations: fixture.locations,
    plan: planWith({ pluginsToUninstall: [{ ...DEMO_OP, plugin: "other" }] }),
  });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove()] });
});

test("DLS-D1: a record its marketplace no longer lists is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "delisted");
  const mp = await stageMarketplace(fixture, "tools", []);
  const root = path.join(mp.marketplaceRoot, "demo");
  await stagePlugin(root, "1.1.0");
  const state = stateOf({ ...mp, plugins: { demo: pluginRecord(root) } });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-10: an entry that fails the entry schema is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "invalid");
  const mp = await stageMarketplace(fixture, "tools", [
    { name: "demo", source: "./demo", description: 5 },
  ]);
  const root = path.join(mp.marketplaceRoot, "demo");
  await stagePlugin(root, "1.1.0");
  const state = stateOf({ ...mp, plugins: { demo: pluginRecord(root) } });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-10: an unavailable candidate is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "unavailable");
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", source: "./missing" }]);
  const state = stateOf({
    ...mp,
    plugins: { demo: pluginRecord(path.join(mp.marketplaceRoot, "demo")) },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-10: a git-source record is skipped by the path-source planner", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git");
  const mp = await stageMarketplace(fixture, "tools", [
    { name: "demo", source: { source: "github", repo: "acme/demo" } },
  ]);
  const state = stateOf({
    ...mp,
    plugins: {
      demo: pluginRecord(path.join(fixture.locations.extensionRoot, "plugin-clones", "demo"), {
        resolvedSha: "a".repeat(40),
      }),
    },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-05-07: a scope whose marketplace manifest cannot be read previews no move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "unreadable-manifest");
  const mp = await stageMarketplace(fixture, "tools", []);
  await writeFile(mp.manifestPath, "{", "utf8");
  const state = stateOf({
    ...mp,
    plugins: { demo: pluginRecord(path.join(mp.marketplaceRoot, "demo")) },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("D-05-07: a scope whose declaration walk cannot be read previews no move at all", async (t) => {
  // arrange: demo moves, but the delisted `gone` has no installed copy to read
  const fixture = await createFixture(t, "unreadable-walk");
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", source: "./demo" }]);
  const root = path.join(mp.marketplaceRoot, "demo");
  await stagePlugin(root, "1.1.0");
  const state = stateOf({
    ...mp,
    plugins: {
      demo: pluginRecord(root),
      gone: pluginRecord(path.join(mp.marketplaceRoot, "gone")),
    },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
});

test("T-29-22: a candidate whose version cannot be read is skipped and traced", async (t) => {
  // arrange: no declared version, so the content hash walks an unreadable directory
  const fixture = await createFixture(t, "unreadable-candidate");
  const logged = captureDebugLog(t);
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", source: "./demo" }]);
  const root = path.join(mp.marketplaceRoot, "demo");
  await stagePlugin(root);
  const locked = path.join(root, "locked");
  await mkdir(locked);
  await chmod(locked, 0o000);
  const state = stateOf({ ...mp, plugins: { demo: pluginRecord(root) } });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [] });
  assert.equal(
    logged.some((line) => line.includes("planConvergence: skipped demo@tools")),
    true,
  );
});

test("D-10: moves are ordered by marketplace, then plugin", async (t) => {
  // arrange
  const fixture = await createFixture(t, "order");
  const later = await stageMarketplace(fixture, "zeta-mp", [
    { name: "beta", source: "./beta" },
    { name: "alpha", source: "./alpha" },
  ]);
  const earlier = await stageMarketplace(fixture, "alpha-mp", [
    { name: "gamma", source: "./gamma" },
  ]);
  const roots = {
    alpha: path.join(later.marketplaceRoot, "alpha"),
    beta: path.join(later.marketplaceRoot, "beta"),
    gamma: path.join(earlier.marketplaceRoot, "gamma"),
  };
  await Promise.all(Object.values(roots).map((root) => stagePlugin(root, "2.0.0")));
  const state = stateOf(
    { ...later, plugins: { beta: pluginRecord(roots.beta), alpha: pluginRecord(roots.alpha) } },
    { ...earlier, plugins: { gamma: pluginRecord(roots.gamma) } },
  );

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(
    plan.moves.map((move) => `${move.plugin}@${move.marketplace}`),
    ["gamma@alpha-mp", "alpha@zeta-mp", "beta@zeta-mp"],
  );
});
