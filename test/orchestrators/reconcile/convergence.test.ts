// Owner suite for orchestrators/reconcile/convergence.ts.
//
// Every case stages a real marketplace on a case-owned temporary tree and
// hands the planner a seeded state, so the declaration walk, the manifest read
// and the candidate resolve all run against disk. A git case seeds the clone
// cache the fs-only presence probe reads; nothing reaches a network.

import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { planConvergence } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { seedWarmMirror } from "../plugin/warm-mirror-seed.ts";

import type {
  PlannedHold,
  PlannedMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
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

/**
 * A plugin directory with its own manifest, which declares `version` and
 * `dependencies` when given.
 */
async function stagePlugin(
  root: string,
  version?: string,
  dependencies?: readonly Record<string, string>[],
): Promise<void> {
  await writeUnder(
    path.join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      ...(version !== undefined && { version }),
      ...(dependencies !== undefined && { dependencies }),
    }),
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
  assert.deepStrictEqual(plan, { moves: [demoMove()], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [demoMove({ partial: true })], holds: [], declines: [] });
});

test("D-10: the recorded version at the recorded root is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "same");
  const state = await stageDemo(fixture, "1.0.0");

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ toVersion: "1.0.0" })],
    holds: [],
    declines: [],
  });
});

test("D-10: a move from a recorded commit carries it as the from side", async (t) => {
  // arrange
  const fixture = await createFixture(t, "commit");
  const fromCommit = "a".repeat(40);
  const state = await stageDemo(fixture, "1.1.0", { resolvedSha: fromCommit });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ fromCommit })], holds: [], declines: [] });
});

test("ENBL-08: a disabled record is never a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "disabled");
  const state = await stageDemo(fixture, "1.1.0", { enabled: false });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
    assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [demoMove()], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [demoMove()], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

const DEMO_URL = "https://example.com/demo";
const RECORDED_COMMIT = "a".repeat(40);
const PINNED_COMMIT = "b".repeat(40);

/** The per-commit copy of `demo` at `commit`, the root a git install records (GIT-01). */
function demoCopy(fixture: Fixture, commit: string): Promise<string> {
  return fixture.locations.pluginCloneDir(pluginCloneKey(DEMO_URL, commit));
}

/**
 * `tools` offers `demo` from a git `source`; the record holds `demo` 1.0.0 at
 * its per-commit copy of `recordedCommit`.
 */
async function stageGitDemo(
  fixture: Fixture,
  entry: Record<string, unknown>,
  recordedCommit = RECORDED_COMMIT,
): Promise<ExtensionState> {
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", ...entry }]);
  const copy = await demoCopy(fixture, recordedCommit);
  return stateOf({
    ...mp,
    plugins: { demo: pluginRecord(copy, { resolvedSha: recordedCommit }) },
  });
}

test("D-10 / GIT-01: a fetched mirror at a new commit and version is a move naming both commits", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-warm-move");
  const { head } = await seedWarmMirror(fixture.locations, DEMO_URL, { version: "2.0.0" });
  const state = await stageGitDemo(fixture, { source: { source: "url", url: DEMO_URL } });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ toVersion: "2.0.0", fromCommit: RECORDED_COMMIT, toCommit: head })],
    holds: [],
    declines: [],
  });
});

test("D-10: a cached copy at the recorded commit and version is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-warm-same");
  await stagePlugin(await demoCopy(fixture, RECORDED_COMMIT), "1.0.0");
  const state = await stageGitDemo(fixture, {
    source: { source: "url", url: DEMO_URL, sha: RECORDED_COMMIT },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

test("GIT-01: an unpinned mirror at the recorded commit is not a move although its root differs", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-warm-mirror-root");
  const { head } = await seedWarmMirror(fixture.locations, DEMO_URL, { version: "1.0.0" });
  const state = await stageGitDemo(fixture, { source: { source: "url", url: DEMO_URL } }, head);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

test("D-10: a cached git tree that resolves unavailable is not a move", async (t) => {
  // arrange: a component path that is not a string makes the candidate unavailable
  const fixture = await createFixture(t, "git-warm-unavailable");
  await seedWarmMirror(fixture.locations, DEMO_URL, { version: "2.0.0" });
  const state = await stageGitDemo(fixture, {
    source: { source: "url", url: DEMO_URL },
    skills: 5,
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

const COLD_MOVES: readonly {
  readonly title: string;
  readonly entry: Record<string, unknown>;
  readonly move: Partial<PlannedMove>;
}[] = [
  {
    title: "a changed commit pin moves to the version the entry declares",
    entry: { source: { source: "url", url: DEMO_URL, sha: PINNED_COMMIT }, version: "2.0.0" },
    move: { toVersion: "2.0.0", toCommit: PINNED_COMMIT },
  },
  {
    title: "a changed commit pin with no declared version moves to the pin's sha version",
    entry: { source: { source: "url", url: DEMO_URL, sha: PINNED_COMMIT } },
    move: { toVersion: "sha-bbbbbbbbbbbb", toCommit: PINNED_COMMIT },
  },
  {
    title: "an unpinned entry that declares another version moves to it",
    entry: { source: { source: "github", repo: "acme/demo" }, version: "2.0.0" },
    move: { toVersion: "2.0.0" },
  },
];

for (const { title, entry, move } of COLD_MOVES) {
  test(`D-11: with no cached tree, ${title}`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "git-cold-move");
    const state = await stageGitDemo(fixture, entry);

    // act
    const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

    // assert
    assert.deepStrictEqual(plan, {
      moves: [demoMove({ fromCommit: RECORDED_COMMIT, ...move })],
      holds: [],
      declines: [],
    });
  });
}

const COLD_STAYS: readonly { readonly title: string; readonly entry: Record<string, unknown> }[] = [
  {
    title: "the recorded commit pin and version",
    entry: { source: { source: "url", url: DEMO_URL, sha: RECORDED_COMMIT }, version: "1.0.0" },
  },
  {
    title: "no pin and no declared version",
    entry: { source: { source: "github", repo: "acme/demo" } },
  },
];

for (const { title, entry } of COLD_STAYS) {
  test(`D-11: with no cached tree, an entry naming ${title} is not a move`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "git-cold-stay");
    const state = await stageGitDemo(fixture, entry);

    // act
    const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

    // assert
    assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
  });
}

test("D-11: a cached clone that lacks the plugin's subdirectory is judged by the entry alone", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-missing-subdir");
  await seedWarmMirror(fixture.locations, DEMO_URL, undefined);
  const state = await stageGitDemo(fixture, {
    source: { source: "git-subdir", url: DEMO_URL, path: "plugins/demo" },
    version: "2.0.0",
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ toVersion: "2.0.0", fromCommit: RECORDED_COMMIT })],
    holds: [],
    declines: [],
  });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
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

/** One plugin of the `tools` marketplace: what the catalog offers and what is recorded. */
interface StagedPlugin {
  readonly name: string;
  readonly offered: string;
  readonly declares?: readonly Record<string, string>[];
  readonly record?: Partial<PluginRecord>;
  /** The installed copy, staged apart from the catalog root when given. */
  readonly installed?: {
    readonly dir: string;
    readonly declares?: readonly Record<string, string>[];
  };
}

/**
 * Stages every plugin under `tools` and records each at 1.0.0, in the given
 * insertion order, so a case can reverse it.
 */
async function stageTools(
  fixture: Fixture,
  plugins: readonly StagedPlugin[],
): Promise<ExtensionState> {
  const mp = await stageMarketplace(
    fixture,
    "tools",
    plugins.map(({ name }) => ({ name, source: `./${name}` })),
  );
  const records: Record<string, PluginRecord> = {};
  for (const plugin of plugins) {
    const catalogRoot = path.join(mp.marketplaceRoot, plugin.name);

    await stagePlugin(catalogRoot, plugin.offered, plugin.declares);
    let recordedRoot = catalogRoot;
    if (plugin.installed !== undefined) {
      recordedRoot = path.join(mp.marketplaceRoot, plugin.installed.dir);
      if (plugin.installed.declares !== undefined) {
        await stagePlugin(recordedRoot, "1.0.0", plugin.installed.declares);
      }
    }

    records[plugin.name] = pluginRecord(recordedRoot, plugin.record);
  }

  return stateOf({ ...mp, plugins: records });
}

function toolsHold(plugin: string, cause: string): PlannedHold {
  return { scope: "project", marketplace: "tools", plugin, version: "1.0.0", cause };
}

const APP_HOLDS_LIB: readonly StagedPlugin[] = [
  { name: "app", offered: "1.0.0", declares: [{ name: "lib", version: "^1.0.0" }] },
  { name: "lib", offered: "2.0.0" },
];

const LIB_OUT_OF_RANGE =
  'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools"';

test("D-12 / D-23: a catalog version a dependent's range does not admit is held, not moved", async (t) => {
  // arrange
  const fixture = await createFixture(t, "held");
  const state = await stageTools(fixture, APP_HOLDS_LIB);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [toolsHold("lib", LIB_OUT_OF_RANGE)],
    declines: [],
  });
});

test("D-12: a catalog version the dependent's range admits moves", async (t) => {
  // arrange
  const fixture = await createFixture(t, "admitted");
  const state = await stageTools(fixture, [
    { name: "app", offered: "1.0.0", declares: [{ name: "lib", version: "^1.0.0" }] },
    { name: "lib", offered: "1.1.0" },
  ]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ plugin: "lib" })],
    holds: [],
    declines: [],
  });
});

test("D-12: ranges that admit no version in common hold the move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "disjoint");
  const state = await stageTools(fixture, [
    { name: "alpha", offered: "1.0.0", declares: [{ name: "lib", version: "^1.0.0" }] },
    { name: "beta", offered: "1.0.0", declares: [{ name: "lib", version: "^2.0.0" }] },
    { name: "lib", offered: "2.0.0" },
  ]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [
      toolsHold(
        "lib",
        'the declared ranges admit no version in common (^1.0.0, ^2.0.0) -- required by "alpha@tools", "beta@tools"',
      ),
    ],
    declines: [],
  });
});

test("D-12: a dependent the plan uninstalls no longer holds the move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "uninstalled-dependent");
  const state = await stageTools(fixture, APP_HOLDS_LIB);

  // act
  const plan = await planConvergence({
    scope: "project",
    state,
    locations: fixture.locations,
    plan: planWith({ pluginsToUninstall: [{ ...DEMO_OP, plugin: "app" }] }),
  });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ plugin: "lib", toVersion: "2.0.0" })],
    holds: [],
    declines: [],
  });
});

/** `APP_HOLDS_LIB` with `app` not yet installed, so only a plan can install it. */
async function stageUninstalledApp(fixture: Fixture): Promise<ExtensionState> {
  const state = await stageTools(fixture, APP_HOLDS_LIB);
  const tools = state.marketplaces["tools"];
  assert.ok(tools !== undefined);
  const { app: _app, ...plugins } = tools.plugins;
  return stateOf({ ...tools, plugins });
}

const INSTALL_APP = { ...DEMO_OP, plugin: "app", configSource: "base" } as const;

for (const { bucket, plan } of [
  { bucket: "an install", plan: planWith({ pluginsToInstall: [INSTALL_APP] }) },
  {
    bucket: "a dependency install",
    plan: planWith({
      pluginsToDependencyInstall: [
        { ...DEMO_OP, plugin: "app", ranges: [], requiredBy: "x@tools", declarers: ["x@tools"] },
      ],
    }),
  },
]) {
  test(`D-12 / D-06: a dependent the plan adds through ${bucket} holds the move`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "planned-install");
    const state = await stageUninstalledApp(fixture);

    // act
    const converged = await planConvergence({
      scope: "project",
      state,
      locations: fixture.locations,
      plan,
    });

    // assert
    assert.deepStrictEqual(converged, {
      moves: [],
      holds: [toolsHold("lib", LIB_OUT_OF_RANGE)],
      declines: [],
    });
  });
}

for (const { title, install } of [
  { title: "its marketplace does not list", install: { ...INSTALL_APP, plugin: "ghost" } },
  {
    title: "lands in a marketplace the scope does not record",
    install: { ...INSTALL_APP, marketplace: "elsewhere" },
  },
]) {
  test(`D-12: a planned install ${title} holds nothing`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "planned-install-unread");
    const state = await stageUninstalledApp(fixture);

    // act
    const converged = await planConvergence({
      scope: "project",
      state,
      locations: fixture.locations,
      plan: planWith({ pluginsToInstall: [install] }),
    });

    // assert
    assert.deepStrictEqual(converged, {
      moves: [demoMove({ plugin: "lib", toVersion: "2.0.0" })],
      holds: [],
      declines: [],
    });
  });
}

test("D-12 / UPDT-02: a disabled dependent still holds the move and is marked", async (t) => {
  // arrange
  const fixture = await createFixture(t, "disabled-dependent");
  const state = await stageTools(fixture, [
    {
      name: "app",
      offered: "1.0.0",
      declares: [{ name: "lib", version: "^1.0.0" }],
      record: { enabled: false },
    },
    { name: "lib", offered: "2.0.0" },
  ]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [toolsHold("lib", `${LIB_OUT_OF_RANGE} (currently disabled)`)],
    declines: [],
  });
});

/**
 * `widget` moves to 1.1.0, whose catalog copy admits `core` 2.0.0, but
 * `zhost` holds `widget` at its installed copy, which declares `core@^1.0.0`.
 * `core` sorts first, so only a second round can hold it, and both copies'
 * ranges then judge it.
 */
function heldDependentChain(installedDir: string): readonly StagedPlugin[] {
  return [
    { name: "core", offered: "2.0.0" },
    {
      name: "widget",
      offered: "1.1.0",
      declares: [{ name: "core", version: "^2.0.0" }],
      installed: {
        dir: installedDir,
        declares: [
          { name: "core", version: "^1.0.0" },
          { name: "zhost", marketplace: "tools" },
        ],
      },
    },
    { name: "zhost", offered: "1.0.0", declares: [{ name: "widget", version: "~1.0.0" }] },
  ];
}

const WIDGET_HOLD = toolsHold(
  "widget",
  'version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "zhost@tools"',
);

test("D-12 / DLS-D1: a held dependent is judged by its catalog and installed copies together, to a fixed point", async (t) => {
  // arrange
  const fixture = await createFixture(t, "fixed-point");
  const state = await stageTools(fixture, heldDependentChain("widget-installed"));

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [
      toolsHold(
        "core",
        'the declared ranges admit no version in common (^2.0.0, ^1.0.0) -- required by "widget@tools", "widget@tools"',
      ),
      WIDGET_HOLD,
    ],
    declines: [],
  });
});

test("D-12 / D-05-06: a held dependent whose catalog copy is stricter than its installed copy still holds the move", async (t) => {
  // arrange -- the runner and the load-time check read `widget`'s catalog
  // copy, which admits no `zcore` 2.0.0, so moving `zcore` would break it.
  // `zcore` sorts after `widget`, so it is judged once `widget` is held.
  const fixture = await createFixture(t, "catalog-stricter");
  const state = await stageTools(fixture, [
    { name: "zcore", offered: "2.0.0" },
    {
      name: "widget",
      offered: "1.1.0",
      declares: [{ name: "zcore", version: "^1.0.0" }],
      installed: { dir: "widget-installed", declares: [{ name: "zcore" }] },
    },
    { name: "zzhost", offered: "1.0.0", declares: [{ name: "widget", version: "~1.0.0" }] },
  ]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [
      toolsHold(
        "widget",
        'version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "zzhost@tools"',
      ),
      toolsHold(
        "zcore",
        'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "widget@tools"',
      ),
    ],
    declines: [],
  });
});

/**
 * `xray` stays put and holds `dep` with `^1.0.0`; `host` holds `widget`, whose
 * installed copy also holds `dep` with `~1.0.0`. Whether `dep` sorts before or
 * after `widget` decides nothing.
 */
function heldByTwoCopies(dep: string, host: string): readonly StagedPlugin[] {
  return [
    { name: dep, offered: "2.0.0" },
    {
      name: "widget",
      offered: "1.1.0",
      installed: { dir: "widget-installed", declares: [{ name: dep, version: "~1.0.0" }] },
    },
    { name: "xray", offered: "1.0.0", declares: [{ name: dep, version: "^1.0.0" }] },
    { name: host, offered: "1.0.0", declares: [{ name: "widget", version: "~1.0.0" }] },
  ];
}

for (const { dep, host } of [
  { dep: "core", host: "zhost" },
  { dep: "zcore", host: "zzhost" },
]) {
  test(`D-12: a hold names every range in force whatever the plugin names (${dep}, ${host})`, async (t) => {
    // arrange
    const fixture = await createFixture(t, `names-${dep}`);
    const state = await stageTools(fixture, heldByTwoCopies(dep, host));

    // act
    const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

    // assert
    assert.deepStrictEqual(plan.moves, []);
    assert.deepStrictEqual(
      [...plan.holds].sort((a, b) => a.plugin.localeCompare(b.plugin)),
      [
        toolsHold(
          dep,
          `version 2.0.0 falls outside what the combined range admits (~1.0.0, ^1.0.0) -- required by "widget@tools", "xray@tools"`,
        ),
        toolsHold(
          "widget",
          `version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "${host}@tools"`,
        ),
      ].sort((a, b) => a.plugin.localeCompare(b.plugin)),
    );
  });
}

test("D-12: a held dependent whose installed copy cannot be read keeps its catalog declarations", async (t) => {
  // arrange: the recorded root holds no manifest, so `widget` keeps `core@^2.0.0`
  const fixture = await createFixture(t, "unreadable-copy");
  const chain = heldDependentChain("widget-gone").map((plugin) =>
    plugin.installed === undefined ? plugin : { ...plugin, installed: { dir: "widget-gone" } },
  );
  const state = await stageTools(fixture, chain);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ plugin: "core", toVersion: "2.0.0" })],
    holds: [WIDGET_HOLD],
    declines: [],
  });
});

/** Gives the plugin under `root` an output style, a component Pi cannot load. */
async function stageOutputStyle(root: string): Promise<void> {
  await writeUnder(path.join(root, "output-styles", "terse.md"), "# Terse\n");
}

test("D-12 / WCONV-01: a clean record whose candidate would drop components is declined", async (t) => {
  // arrange
  const fixture = await createFixture(t, "declined");
  const state = await stageDemo(fixture, "1.1.0");
  await stageOutputStyle(path.join(marketplaceRootOf(fixture, "tools"), "demo"));

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [],
    declines: [
      {
        scope: "project",
        marketplace: "tools",
        plugin: "demo",
        version: "1.0.0",
        unsupported: ["outputStyles"],
      },
    ],
  });
});

test("D-12: a record already installed partial moves to a partial candidate", async (t) => {
  // arrange
  const fixture = await createFixture(t, "partial-to-partial");
  const state = await stageDemo(fixture, "1.1.0", {
    compatibility: { installable: false, notes: [], supported: [], unsupported: ["outputStyles"] },
  });
  await stageOutputStyle(path.join(marketplaceRootOf(fixture, "tools"), "demo"));

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ partial: true })],
    holds: [],
    declines: [],
  });
});

test("D-12: a partial candidate a dependent's range does not admit is held, not declined", async (t) => {
  // arrange
  const fixture = await createFixture(t, "held-and-partial");
  const state = await stageTools(fixture, APP_HOLDS_LIB);
  await stageOutputStyle(path.join(marketplaceRootOf(fixture, "tools"), "lib"));

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [toolsHold("lib", LIB_OUT_OF_RANGE)],
    declines: [],
  });
});

const COMPONENT_FILES = {
  skills: path.join("skills", "tool", "SKILL.md"),
  agents: path.join("agents", "helper.md"),
} as const;

/** Gives the plugin under `root` one component of each named supported kind. */
async function stageComponents(
  root: string,
  kinds: readonly (keyof typeof COMPONENT_FILES)[],
): Promise<void> {
  await Promise.all(
    kinds.map((kind) =>
      writeUnder(
        path.join(root, COMPONENT_FILES[kind]),
        "---\nname: tool\ndescription: d\n---\n\nbody\n",
      ),
    ),
  );
}

function recordSupporting(supported: readonly string[]): Partial<PluginRecord> {
  return {
    compatibility: { installable: true, notes: [], supported: [...supported], unsupported: [] },
  };
}

test("D-10 / BFILL-01: a strictly grown supported set is a growth-only move at the same version", async (t) => {
  // arrange
  const fixture = await createFixture(t, "growth");
  const state = await stageDemo(fixture, "1.0.0");
  await stageComponents(path.join(marketplaceRootOf(fixture, "tools"), "demo"), ["skills"]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ toVersion: "1.0.0", revisionChanged: false, grew: true })],
    holds: [],
    declines: [],
  });
});

test("D-10: a grown supported set rides on a version move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "growth-with-version");
  const state = await stageDemo(fixture, "1.1.0");
  await stageComponents(path.join(marketplaceRootOf(fixture, "tools"), "demo"), ["skills"]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ grew: true })],
    holds: [],
    declines: [],
  });
});

const NOT_GROWN: readonly {
  readonly title: string;
  readonly recorded: readonly string[];
  readonly offered: readonly (keyof typeof COMPONENT_FILES)[];
}[] = [
  { title: "an equal supported set", recorded: ["skills"], offered: ["skills"] },
  {
    title: "a larger supported set that drops a recorded kind",
    recorded: ["commands"],
    offered: ["skills", "agents"],
  },
];

for (const { title, recorded, offered } of NOT_GROWN) {
  test(`BFILL-01: ${title} at the recorded revision is not a move`, async (t) => {
    // arrange
    const fixture = await createFixture(t, "not-grown");
    const state = await stageDemo(fixture, "1.0.0", recordSupporting(recorded));
    await stageComponents(path.join(marketplaceRootOf(fixture, "tools"), "demo"), offered);

    // act
    const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

    // assert
    assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
  });
}

test("D-10 / WCONV-01: a grown set whose candidate would drop components is declined for a clean record", async (t) => {
  // arrange
  const fixture = await createFixture(t, "growth-declined");
  const state = await stageDemo(fixture, "1.0.0");
  const root = path.join(marketplaceRootOf(fixture, "tools"), "demo");
  await stageComponents(root, ["skills"]);
  await stageOutputStyle(root);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [],
    declines: [
      {
        scope: "project",
        marketplace: "tools",
        plugin: "demo",
        version: "1.0.0",
        unsupported: ["outputStyles"],
      },
    ],
  });
});

test("DLS-01: a delisted record whose installed copy reads does not stop another plugin's growth move", async (t) => {
  // arrange: `gone` is delisted, and its installed copy declares a range demo's recorded version meets
  const fixture = await createFixture(t, "growth-beside-delisted");
  const mp = await stageMarketplace(fixture, "tools", [{ name: "demo", source: "./demo" }]);
  const demoRoot = path.join(mp.marketplaceRoot, "demo");
  const goneRoot = path.join(mp.marketplaceRoot, "gone");
  await stagePlugin(demoRoot, "1.0.0");
  await stageComponents(demoRoot, ["skills"]);
  await stagePlugin(goneRoot, "1.0.0", [{ name: "demo", version: "^1.0.0" }]);
  const state = stateOf({
    ...mp,
    plugins: { demo: pluginRecord(demoRoot), gone: pluginRecord(goneRoot) },
  });

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [demoMove({ toVersion: "1.0.0", revisionChanged: false, grew: true })],
    holds: [],
    declines: [],
  });
});

test("ENBL-08: a disabled record whose supported set grew is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "growth-disabled");
  const state = await stageDemo(fixture, "1.0.0", { enabled: false });
  await stageComponents(path.join(marketplaceRootOf(fixture, "tools"), "demo"), ["skills"]);

  // act
  const plan = await planConvergence({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});
