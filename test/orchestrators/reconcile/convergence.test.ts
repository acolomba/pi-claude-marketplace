// Owner suite for orchestrators/reconcile/convergence.ts.
//
// Every case stages a real marketplace on a case-owned temporary tree and
// hands the planner a seeded state, so the declaration walk, the manifest read
// and the candidate resolve all run against disk. A git case seeds the clone
// cache the fs-only presence probe reads; nothing reaches a network.

import assert from "node:assert/strict";
import { chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  installedCopyReader,
  cascadeDependencies,
  movesAfterInstalls,
  planConvergenceCascade,
  settleMoveCascade,
  stepsAfterInstalls,
  withPlannedInstallsLanded,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import { buildScopeSatisfactionVerdict } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { CHMOD_DENIAL_HINT, chmodDeniesThisProcess } from "../../chmod-denial.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { seedWarmMirror } from "../plugin/warm-mirror-seed.ts";

import type {
  IndexFailure,
  RecordDeclarations,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type {
  ConvergenceCascade,
  ConvergenceInput,
  ConvergencePlan,
  PlannedHold,
  PlannedMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts";
import type {
  ScopeSatisfactionVerdict,
  UnsatisfiedDeclaration,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
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

/** The catalog moves `planConvergenceCascade` plans for `input`. */
async function plannedMoves(input: ConvergenceInput): Promise<ConvergencePlan> {
  return (await planConvergenceCascade(input)).plan;
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ partial: true })], holds: [], declines: [] });
});

test("D-10: the recorded version at the recorded root is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "same");
  const state = await stageDemo(fixture, "1.0.0");

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const copy = path.join(fixture.locations.pluginClonesDir, "demo-copy");
  await stagePlugin(copy, "1.0.0");
  const state = await stageDemo(fixture, "1.1.0", {
    resolvedSha: fromCommit,
    resolvedSource: copy,
  });

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [demoMove({ fromCommit })], holds: [], declines: [] });
});

test("ENBL-08: a disabled record is never a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "disabled");
  const state = await stageDemo(fixture, "1.1.0", { enabled: false });

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
    const plan = await plannedMoves({
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
  const plan = await plannedMoves({
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
  const plan = await plannedMoves({
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

test("D-PL5-32: a hosted catalog's relative entry is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "hosted-relative");
  const catalogUrl = "https://h.example/acme/tools/marketplace.json";
  const mp = await stageMarketplace(fixture, "tools", [
    { name: "demo", source: "./", version: "1.1.0" },
  ]);
  await stagePlugin(mp.marketplaceRoot, "1.1.0");
  const state = stateOf({
    ...mp,
    source: { kind: "hosted", raw: catalogUrl, url: catalogUrl },
    plugins: { demo: pluginRecord(path.join(mp.marketplaceRoot, "demo-old")) },
  });

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

test("GIT-01: an unpinned mirror at the recorded commit is not a move although its root differs", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-warm-mirror-root");
  const { head } = await seedWarmMirror(fixture.locations, DEMO_URL, { version: "1.0.0" });
  const state = await stageGitDemo(fixture, { source: { source: "url", url: DEMO_URL } }, head);

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
    title: "a changed commit pin with no declared version moves to the pin's 12-hex commit",
    entry: { source: { source: "url", url: DEMO_URL, sha: PINNED_COMMIT } },
    move: { toVersion: "bbbbbbbbbbbb", toCommit: PINNED_COMMIT },
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
    const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
    const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

    // assert
    assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
  });
}

test("D-11 / GV-01: with no cached tree, a record at a release tag of the entry's declared version is not a move", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-cold-tag");
  const state = await stageGitDemo(fixture, {
    source: { source: "github", repo: "acme/demo" },
    version: "1.0.0",
  });
  const record = state.marketplaces["tools"]?.plugins["demo"];
  assert.ok(record !== undefined);
  record.version = `1.0.0-${RECORDED_COMMIT.slice(0, 12)}`;
  record.resolvedVersion = "1.0.0";

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

test("D-11: a cached clone that lacks the plugin's subdirectory is judged by the entry alone", async (t) => {
  // arrange
  const fixture = await createFixture(t, "git-missing-subdir");
  await seedWarmMirror(fixture.locations, DEMO_URL, undefined);
  const state = await stageGitDemo(fixture, {
    source: { source: "git-subdir", url: DEMO_URL, path: "plugins/demo" },
    version: "2.0.0",
  });

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
  assert.equal(
    logged.some((line) => line.includes("recordMoveIsolated: skipped demo@tools")),
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({
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
    const converged = await plannedMoves({
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

test("D-12 / RESV-01: a dependency a planned install's cascade brings in holds the move", async (t) => {
  // arrange -- `top` declares `app` and neither is recorded, so the install
  // of `top` also installs `app`, whose range holds `lib`.
  const fixture = await createFixture(t, "planned-cascade");
  const state = await stageTools(fixture, [
    { name: "top", offered: "1.0.0", declares: [{ name: "app", version: "^1.0.0" }] },
    ...APP_HOLDS_LIB,
  ]);
  const tools = state.marketplaces["tools"];
  assert.ok(tools !== undefined);
  const { app: _app, top: _top, ...plugins } = tools.plugins;

  // act
  const converged = await plannedMoves({
    scope: "project",
    state: stateOf({ ...tools, plugins }),
    locations: fixture.locations,
    plan: planWith({ pluginsToInstall: [{ ...INSTALL_APP, plugin: "top" }] }),
  });

  // assert
  assert.deepStrictEqual(converged, {
    moves: [],
    holds: [toolsHold("lib", LIB_OUT_OF_RANGE)],
    declines: [],
  });
});

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
    const converged = await plannedMoves({
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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

/** D-PL2-25: the failure a refused installed copy of `widget@tools` names. */
const WIDGET_UNREADABLE_MANIFEST = {
  ok: false,
  declarer: "widget@tools",
  reason: "unreadable manifest",
  message:
    "cannot read the dependencies of widget@tools: its own manifest is present but cannot be read",
};

/** A declaration read with its failure's cause reduced to its message. */
function describeFailure(
  read: RecordDeclarations | IndexFailure | null,
): RecordDeclarations | Record<string, unknown> | null {
  return read === null || read.ok
    ? read
    : { ok: read.ok, declarer: read.declarer, reason: read.reason, message: read.cause.message };
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, {
    moves: [],
    holds: [
      toolsHold(
        "core",
        'the declared ranges admit no version in common (^2.0.0, ^1.0.0) -- required by "widget@tools"',
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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
    const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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

test("D-PL2-12 / D-PL2-25: a dependent whose copy sits under neither clone root ends the cascade with no move", async (t) => {
  // arrange: `widget` is pinned to a commit, and its recorded copy, which
  // holds a readable manifest, sits outside both the plugin clones and the
  // marketplace clone
  const fixture = await createFixture(t, "foreign-root-copy");
  const foreignCopy = path.join(fixture.cwd, "elsewhere", "widget");
  await stagePlugin(foreignCopy, "1.0.0", [{ name: "core", version: "^1.0.0" }]);
  const chain = heldDependentChain("widget-installed").map((plugin) =>
    plugin.installed === undefined
      ? plugin
      : { ...plugin, record: { resolvedSha: "a".repeat(40), resolvedSource: foreignCopy } },
  );
  const state = await stageTools(fixture, chain);

  // act
  const cascade = await planConvergenceCascade({
    scope: "project",
    state,
    locations: fixture.locations,
  });

  // assert
  assert.deepStrictEqual(
    { plan: cascade.plan, failure: describeFailure(cascade.installedCopyFailure) },
    { plan: { moves: [], holds: [], declines: [] }, failure: WIDGET_UNREADABLE_MANIFEST },
  );
});

test("D-PL2-23: a dependent left pinned to a stale commit with its copy in the marketplace clone is judged by that copy", async (t) => {
  // arrange
  const fixture = await createFixture(t, "stale-pin-copy");
  const chain = heldDependentChain("widget-installed").map((plugin) =>
    plugin.installed === undefined
      ? plugin
      : { ...plugin, record: { resolvedSha: "a".repeat(40) } },
  );
  const state = await stageTools(fixture, chain);

  // act
  const cascade = await planConvergenceCascade({
    scope: "project",
    state,
    locations: fixture.locations,
  });

  // assert
  assert.deepStrictEqual(
    { plan: cascade.plan, failure: cascade.installedCopyFailure },
    {
      plan: {
        moves: [],
        holds: [
          toolsHold(
            "core",
            'the declared ranges admit no version in common (^2.0.0, ^1.0.0) -- required by "widget@tools"',
          ),
          WIDGET_HOLD,
        ],
        declines: [],
      },
      failure: null,
    },
  );
});

test("D-PL2-25: a candidate whose installed copy's manifest links outside its boundary ends the cascade with no move", async (t) => {
  // arrange: `widget` runs its copy in place, and that copy's manifest links
  // to a file outside the marketplace
  const fixture = await createFixture(t, "escaping-copy");
  const state = await stageTools(fixture, heldDependentChain("widget-installed"));
  const outside = path.join(fixture.cwd, "outside-plugin.json");
  await writeFile(outside, JSON.stringify({ dependencies: [] }), "utf8");
  const manifest = path.join(
    marketplaceRootOf(fixture, "tools"),
    "widget-installed",
    ".claude-plugin",
    "plugin.json",
  );
  await rm(manifest);
  await symlink(outside, manifest);

  // act
  const cascade = await planConvergenceCascade({
    scope: "project",
    state,
    locations: fixture.locations,
  });

  // assert
  assert.deepStrictEqual(
    { plan: cascade.plan, failure: describeFailure(cascade.installedCopyFailure) },
    { plan: { moves: [], holds: [], declines: [] }, failure: WIDGET_UNREADABLE_MANIFEST },
  );
});

test("D-12 / DLS-D1: a cascade whose installed copies are all usable carries no copy failure", async (t) => {
  // arrange
  const fixture = await createFixture(t, "usable-copies");
  const state = await stageTools(fixture, heldDependentChain("widget-installed"));

  // act
  const cascade = await planConvergenceCascade({
    scope: "project",
    state,
    locations: fixture.locations,
  });

  // assert
  assert.equal(cascade.installedCopyFailure, null);
});

test("D-12: a record already installed partial moves to a partial candidate", async (t) => {
  // arrange
  const fixture = await createFixture(t, "partial-to-partial");
  const state = await stageDemo(fixture, "1.1.0", {
    compatibility: { installable: false, notes: [], supported: [], unsupported: ["outputStyles"] },
  });
  await stageOutputStyle(path.join(marketplaceRootOf(fixture, "tools"), "demo"));

  // act
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
    const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

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
  const plan = await plannedMoves({ scope: "project", state, locations: fixture.locations });

  // assert
  assert.deepStrictEqual(plan, { moves: [], holds: [], declines: [] });
});

/**
 * The plan a verdict gives in these cases: each held dependent is disabled,
 * and each record of `lift` the verdict does not hold is enabled, as the
 * planner lifts a LOAD-02 marker.
 */
function planFrom(verdict: ScopeSatisfactionVerdict, lift: readonly string[] = []): ReconcilePlan {
  const unsatisfied = verdict.ok ? verdict.unsatisfied : [];
  const held = new Set(unsatisfied.map((entry) => entry.dependent));
  return planWith({
    pluginsToEnable: lift
      .filter((plugin) => !held.has(`${plugin}@tools`))
      .map((plugin) => ({ ...DEMO_OP, plugin })),
    pluginsToDependencyDisable: unsatisfied.map((entry) => ({
      ...DEMO_OP,
      plugin: entry.dependent.replace("@tools", ""),
      dependency: entry.dependency,
      kind: entry.kind,
    })),
  });
}

const CO_SHIPPED: readonly StagedPlugin[] = [
  { name: "widget", offered: "1.1.0", declares: [{ name: "zcore", version: "^2.0.0" }] },
  { name: "zcore", offered: "2.0.0" },
];

async function settle(
  fixture: Fixture,
  state: ExtensionState,
  lift: readonly string[] = [],
): Promise<Awaited<ReturnType<typeof settleMoveCascade>> & { readonly input: ReconcilePlan }> {
  const verdict = await buildScopeSatisfactionVerdict({ state, locations: fixture.locations });
  const input = planFrom(verdict, lift);
  const settled = await settleMoveCascade({
    scope: "project",
    state,
    locations: fixture.locations,
    plan: input,
    verdict,
    replan: (released) => planFrom(released, lift),
  });
  return { ...settled, input };
}

function moveKeys(moves: readonly PlannedMove[] | undefined): readonly string[] {
  return (moves ?? []).map((move) => `${move.plugin}@${move.marketplace}`);
}

test("APPLY1-01: a dependent the catalog moves with the newer dependency it needs is released, dependencies first", async (t) => {
  // arrange
  const fixture = await createFixture(t, "co-shipped");
  const state = await stageTools(fixture, CO_SHIPPED);

  // act
  const settled = await settle(fixture, state);

  // assert
  assert.equal(settled.input.pluginsToDependencyDisable.length, 1);
  assert.deepStrictEqual(settled.plan, planWith({}));
  assert.deepStrictEqual(moveKeys(settled.cascade?.plan.moves), ["zcore@tools", "widget@tools"]);
  assert.deepStrictEqual(settled.deferredEnables, []);
});

test("APPLY1-01: a released dependent whose own move stays held keeps the caller's plan", async (t) => {
  // arrange -- `zhost` holds `widget` at ~1.0.0, so `widget` stays and its
  // installed copy's core ^1.0.0 holds the move its release relied on.
  const fixture = await createFixture(t, "release-shrinks");
  const state = await stageTools(fixture, heldDependentChain("widget-installed"));

  // act
  const settled = await settle(fixture, state);

  // assert
  assert.deepStrictEqual(settled, {
    input: settled.input,
    plan: settled.input,
    deferredEnables: [],
    preview: settled.input,
    enablesAfterInstalls: [],
  });
  assert.deepStrictEqual(
    settled.input.pluginsToDependencyDisable.map((op) => op.plugin),
    ["widget", "zhost"],
  );
});

test("APPLY1-01: a dependent held down by an earlier pass is enabled only after the moves it waits on", async (t) => {
  // arrange
  const fixture = await createFixture(t, "deferred");
  const state = await stageTools(fixture, [
    { ...CO_SHIPPED[0], record: { enabled: false, dependencyDisabled: true } } as StagedPlugin,
    { name: "zcore", offered: "2.0.0" },
  ]);

  // act
  const settled = await settle(fixture, state, ["widget"]);

  // assert
  assert.deepStrictEqual(moveKeys(settled.cascade?.plan.moves), ["zcore@tools", "widget@tools"]);
  assert.deepStrictEqual(settled.deferredEnables, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.plan.pluginsToEnable, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.preview.pluginsToEnable, []);
});

test("APPLY1-01: a held-down dependent that waits on no move is enabled with the toggles", async (t) => {
  // arrange
  const fixture = await createFixture(t, "lift-no-move");
  const state = await stageTools(fixture, [
    {
      name: "widget",
      offered: "1.0.0",
      declares: [{ name: "zcore" }],
      record: { enabled: false, dependencyDisabled: true },
    },
    { name: "zcore", offered: "1.0.0" },
  ]);

  // act
  const settled = await settle(fixture, state, ["widget"]);

  // assert
  assert.deepStrictEqual(moveKeys(settled.cascade?.plan.moves), []);
  assert.deepStrictEqual(settled.deferredEnables, []);
  assert.deepStrictEqual(settled.plan.pluginsToEnable, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.preview, settled.plan);
  assert.deepStrictEqual(settled.enablesAfterInstalls, []);
});

test("APPLY1-01: a disabled record the caller enables after its move is planned as enabled", async (t) => {
  // arrange
  const fixture = await createFixture(t, "enable-input");
  const state = await stageTools(fixture, [
    { name: "demo", offered: "1.1.0", record: { enabled: false } },
    { name: "lib", offered: "1.0.0" },
  ]);
  const input = { scope: "project" as const, state, locations: fixture.locations };

  // act
  const none = await planConvergenceCascade({ ...input, enable: new Set() });
  const enabled = await planConvergenceCascade({ ...input, enable: new Set(["demo@tools"]) });

  // assert
  assert.deepStrictEqual(none.plan.moves, []);
  assert.deepStrictEqual(enabled.plan.moves, [demoMove()]);
  assert.deepStrictEqual(cascadeDependencies(enabled, "ghost@tools"), []);
});

test("APPLY1-01: the installed-copy reader reads a pinned copy and leaves a path source to the catalog", async (t) => {
  // arrange
  const fixture = await createFixture(t, "copy-reader");
  const pinned = path.join(fixture.locations.pluginClonesDir, "widget-copy");
  await stagePlugin(pinned, "1.0.0", [{ name: "zcore", version: "^1.0.0" }]);
  const mp = await stageMarketplace(fixture, "tools", []);
  const read = installedCopyReader(fixture.locations);
  const marketplace = { ...mp, plugins: {} };

  // act
  const fromPinned = await read(
    marketplace,
    "widget",
    pluginRecord(pinned, { resolvedSha: "a".repeat(40) }),
  );
  const fromPath = await read(
    marketplace,
    "widget",
    pluginRecord(path.join(mp.marketplaceRoot, "widget")),
  );

  // assert
  assert.deepStrictEqual(fromPinned, {
    ok: true,
    declared: [{ name: "zcore", marketplace: "tools", version: "^1.0.0" }],
  });
  assert.deepStrictEqual(fromPath, { ok: true, declared: [] });
});

test("D-PL2-12 / D-PL2-25: the installed-copy reader fails closed on a copy under the plugin clones of a record with no recorded commit", async (t) => {
  // arrange
  const fixture = await createFixture(t, "copy-reader-unowned");
  const copy = path.join(fixture.locations.pluginClonesDir, "widget-copy");
  await stagePlugin(copy, "1.0.0", [{ name: "zcore", version: "^1.0.0" }]);
  const mp = await stageMarketplace(fixture, "tools", []);

  // act
  const read = await installedCopyReader(fixture.locations)(
    { ...mp, plugins: {} },
    "widget",
    pluginRecord(copy),
  );

  // assert
  assert.deepStrictEqual(describeFailure(read), WIDGET_UNREADABLE_MANIFEST);
});

test("D-PL2-25: the installed-copy reader fails closed on a pinned copy whose path cannot be inspected", async (t) => {
  if (!(await chmodDeniesThisProcess())) {
    t.skip(`a mode does not deny this process. ${CHMOD_DENIAL_HINT}`);
    return;
  }

  // arrange
  const fixture = await createFixture(t, "copy-reader-fault");
  const locked = path.join(fixture.locations.pluginClonesDir, "widget-copy");
  await mkdir(path.join(locked, "inner"), { recursive: true });
  const mp = await stageMarketplace(fixture, "tools", []);
  await chmod(locked, 0o000);

  // act
  let read;
  try {
    read = await installedCopyReader(fixture.locations)(
      { ...mp, plugins: {} },
      "widget",
      pluginRecord(path.join(locked, "inner"), { resolvedSha: "a".repeat(40) }),
    );
  } finally {
    await chmod(locked, 0o755);
  }

  // assert
  assert.deepStrictEqual(describeFailure(read), WIDGET_UNREADABLE_MANIFEST);
});

test("APPLY1-01 / CR-A: a held-down record with a move of its own waits for its move, released or not", async (t) => {
  // arrange -- `widget` was held down after its own move failed; its catalog
  // range is met now, so the verdict lifts it, but its move is still pending.
  const fixture = await createFixture(t, "deferred-own-move");
  const state = await stageTools(fixture, [
    {
      name: "widget",
      offered: "1.1.0",
      declares: [{ name: "zcore" }],
      record: { enabled: false, dependencyDisabled: true },
    },
    { name: "zcore", offered: "1.0.0" },
  ]);

  // act
  const settled = await settle(fixture, state, ["widget"]);

  // assert
  assert.deepStrictEqual(settled.deferredEnables, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.preview.pluginsToEnable, []);
});

/** `settleMoveCascade` over `plan`, with the scope's own verdict. */
async function settleWith(
  fixture: Fixture,
  state: ExtensionState,
  plan: ReconcilePlan,
): Promise<Awaited<ReturnType<typeof settleMoveCascade>>> {
  const verdict = await buildScopeSatisfactionVerdict({ state, locations: fixture.locations });
  return settleMoveCascade({
    scope: "project",
    state,
    locations: fixture.locations,
    plan,
    verdict,
    replan: () => plan,
  });
}

const LIB_HELD_AND_OFF: readonly StagedPlugin[] = [
  { name: "app", offered: "1.0.0", declares: [{ name: "lib" }], record: { enabled: false } },
  {
    name: "lib",
    offered: "1.0.0",
    record: { enabled: false, dependencyDisabled: true },
  },
];

test("APPLY1-01 / WR-1: a lift and a config enable the final judgement would hold are both dropped", async (t) => {
  // arrange -- `lib` carries the marker, which the load-time verdict reads as
  // enabled, but stays disabled; `app` needs it.
  const fixture = await createFixture(t, "planned-lift");
  const marker = await stageTools(fixture, [
    {
      ...LIB_HELD_AND_OFF[0],
      record: { enabled: false, dependencyDisabled: true },
    } as StagedPlugin,
    LIB_HELD_AND_OFF[1]!,
  ]);
  const config = await stageTools(await createFixture(t, "planned-config"), LIB_HELD_AND_OFF);
  const enableApp = planWith({ pluginsToEnable: [{ ...DEMO_OP, plugin: "app" }] });

  // act
  const lifted = await settleWith(fixture, marker, enableApp);
  const enabled = await settleWith(fixture, config, enableApp);

  // assert
  assert.deepStrictEqual(lifted.plan.pluginsToEnable, []);
  assert.deepStrictEqual(lifted.plan.pluginsToDependencyDisable, []);
  assert.deepStrictEqual(enabled.plan, planWith({}));
});

test("APPLY1-01 / WR-2: the plan disables a plugin whose dependency it uninstalls, unless the same apply installs it", async (t) => {
  // arrange -- `keeper` declares `orphan`.
  const fixture = await createFixture(t, "planned-uninstall");
  const state = await stageTools(fixture, [
    { name: "keeper", offered: "1.0.0", declares: [{ name: "orphan" }] },
    { name: "orphan", offered: "1.0.0" },
  ]);
  const uninstall = planWith({
    pluginsToUninstall: [{ ...DEMO_OP, plugin: "orphan" }],
  });
  const reinstall = planWith({
    pluginsToUninstall: [{ ...DEMO_OP, plugin: "orphan" }],
    pluginsToDependencyInstall: [
      {
        ...DEMO_OP,
        plugin: "orphan",
        requiredBy: "keeper@tools",
        declarers: ["keeper@tools"],
        ranges: [],
      },
    ],
  });

  // act
  const removed = await settleWith(fixture, state, uninstall);
  const scheduled = await settleWith(fixture, state, reinstall);

  // assert
  assert.deepStrictEqual(removed.plan.pluginsToDependencyDisable, [
    {
      ...DEMO_OP,
      plugin: "keeper",
      dependent: "keeper@tools",
      dependency: "orphan@tools",
      kind: "missing",
    },
  ]);
  assert.deepStrictEqual(scheduled.plan.pluginsToDependencyDisable, []);
});

test("APPLY1-01 / D-05-07: a planned judgement whose walk fails leaves the plan as it was", async (t) => {
  // arrange -- `stray` is recorded but its marketplace does not list it.
  const fixture = await createFixture(t, "planned-unreadable");
  const state = await stageTools(fixture, [{ name: "keeper", offered: "1.0.0" }]);
  const mp = state.marketplaces["tools"];
  assert.ok(mp !== undefined);
  const withStray: ExtensionState = {
    ...state,
    marketplaces: {
      tools: {
        ...mp,
        plugins: { ...mp.plugins, stray: pluginRecord(path.join(mp.marketplaceRoot, "stray")) },
      },
    },
  };
  const uninstall = planWith({
    pluginsToUninstall: [{ ...DEMO_OP, plugin: "keeper" }],
  });

  // act
  const settled = await settleWith(fixture, withStray, uninstall);

  // assert
  assert.deepStrictEqual(settled.plan, uninstall);
});

/**
 * A stand-in for the planner over `verdict`: each held dependent is disabled,
 * as `planFrom` disables it, and each missing dependency is installed once.
 */
function planInstallingMissing(verdict: ScopeSatisfactionVerdict): ReconcilePlan {
  const unsatisfied = verdict.ok ? verdict.unsatisfied : [];
  const missing = [
    ...new Set(
      unsatisfied.filter((entry) => entry.kind === "missing").map((entry) => entry.dependency),
    ),
  ];
  return {
    ...planFrom(verdict),
    pluginsToDependencyInstall: missing.map((dependency) => ({
      ...DEMO_OP,
      plugin: dependency.replace("@tools", ""),
      requiredBy: "widget@tools",
      declarers: ["widget@tools"],
      ranges: [],
    })),
  };
}

/** `state` without the record of `plugin` in `tools`; its catalog entry stays. */
function withoutToolsRecord(state: ExtensionState, plugin: string): ExtensionState {
  const mp = state.marketplaces["tools"];
  assert.ok(mp !== undefined);
  const plugins = Object.fromEntries(
    Object.entries(mp.plugins).filter(([name]) => name !== plugin),
  );
  return { ...state, marketplaces: { tools: { ...mp, plugins } } };
}

/** `zcore` 2.0.0 needs `extra`, which the scope does not record. */
const CO_SHIPPED_NEEDING_EXTRA: readonly StagedPlugin[] = [
  CO_SHIPPED[0]!,
  { name: "zcore", offered: "2.0.0", declares: [{ name: "extra" }] },
  { name: "extra", offered: "1.0.0" },
];

const EXTRA_INSTALL = {
  ...DEMO_OP,
  plugin: "extra",
  requiredBy: "widget@tools",
  declarers: ["widget@tools"],
  ranges: [],
};

test("D-PL2-02: a dependent is released when its dependency moves to a version that needs a planned install", async (t) => {
  // arrange
  const fixture = await createFixture(t, "released-by-install");
  const state = withoutToolsRecord(await stageTools(fixture, CO_SHIPPED_NEEDING_EXTRA), "extra");
  const verdict = await buildScopeSatisfactionVerdict({ state, locations: fixture.locations });
  const replan = (from: ScopeSatisfactionVerdict): ReconcilePlan =>
    withPlannedInstallsLanded(planInstallingMissing(from), from, state, planInstallingMissing);

  // act
  const settled = await settleMoveCascade({
    scope: "project",
    state,
    locations: fixture.locations,
    plan: replan(verdict),
    verdict,
    replan,
  });

  // assert
  assert.deepStrictEqual(settled.plan, planWith({ pluginsToDependencyInstall: [EXTRA_INSTALL] }));
  assert.deepStrictEqual(moveKeys(settled.cascade?.plan.moves), ["zcore@tools", "widget@tools"]);
});

test("D-PL2-02: a dependent stays held when its dependency's new version needs an install the plan does not make", async (t) => {
  // arrange
  const fixture = await createFixture(t, "held-without-install");
  const state = withoutToolsRecord(await stageTools(fixture, CO_SHIPPED_NEEDING_EXTRA), "extra");

  // act
  const settled = await settle(fixture, state);

  // assert
  assert.deepStrictEqual(settled.plan, settled.input);
  assert.deepStrictEqual(
    settled.plan.pluginsToDependencyDisable.map((op) => op.plugin),
    ["widget", "zcore"],
  );
});

function toolsKey(plugin: string): string {
  return `${plugin}@tools`;
}

function missingEntry(dependent: string, dependency: string): UnsatisfiedDeclaration {
  return { dependent: toolsKey(dependent), dependency: toolsKey(dependency), kind: "missing" };
}

function disabledEntry(dependent: string, dependency: string): UnsatisfiedDeclaration {
  return { dependent: toolsKey(dependent), dependency: toolsKey(dependency), kind: "disabled" };
}

/** `tools` records `app` enabled and `core` with `core` overrides; nothing reads disk. */
function appAndCore(core: Partial<PluginRecord> = {}): ExtensionState {
  return stateOf({
    name: "tools",
    scope: "project",
    source: "acme/tools",
    addedFromCwd: "/work",
    manifestPath: "/work/tools/.claude-plugin/marketplace.json",
    marketplaceRoot: "/work/tools",
    plugins: {
      app: pluginRecord("/work/tools/app"),
      core: pluginRecord("/work/tools/core", core),
    },
  });
}

const VAULT_INSTALL = { ...EXTRA_INSTALL, plugin: "vault", requiredBy: "core@tools" };

/** The replan's toggles, distinct from every input plan's, so a case sees which plan it got. */
const FRESH_TOGGLES = {
  pluginsToEnable: [{ ...DEMO_OP, plugin: "fresh-enable" }],
  pluginsToDisable: [{ ...DEMO_OP, plugin: "fresh-disable" }],
  pluginsToDependencyDisable: [],
} satisfies Partial<ReconcilePlan>;

/** A replan stub that records each verdict it is handed. */
function recordingReplan(): {
  readonly replan: (verdict: ScopeSatisfactionVerdict) => ReconcilePlan;
  readonly seen: ScopeSatisfactionVerdict[];
} {
  const seen: ScopeSatisfactionVerdict[] = [];
  return {
    seen,
    replan: (verdict) => {
      seen.push(verdict);
      return planWith({
        ...FRESH_TOGGLES,
        pluginsToInstall: [{ ...DEMO_OP, plugin: "ignored", configSource: "base" }],
      });
    },
  };
}

for (const { title, plan, verdict } of [
  {
    title: "nothing is planned for install",
    plan: planWith({ pluginsToDisable: [{ ...DEMO_OP, plugin: "app" }] }),
    verdict: { ok: true, unsatisfied: [missingEntry("core", "vault")] },
  },
  {
    title: "the verdict's walk failed",
    plan: planWith({ pluginsToDependencyInstall: [VAULT_INSTALL] }),
    verdict: {
      ok: false,
      declarer: "core@tools",
      reason: "unreadable",
      cause: new Error("unreadable manifest"),
    },
  },
] satisfies readonly {
  readonly title: string;
  readonly plan: ReconcilePlan;
  readonly verdict: ScopeSatisfactionVerdict;
}[]) {
  test(`D-PL2-02: withPlannedInstallsLanded keeps the plan as it is when ${title}`, () => {
    // arrange
    const { replan, seen } = recordingReplan();

    // act
    const landed = withPlannedInstallsLanded(plan, verdict, appAndCore(), replan);

    // assert
    assert.strictEqual(landed, plan);
    assert.deepStrictEqual(seen, []);
  });
}

for (const { title, core, unsatisfied, kept } of [
  {
    title: "a dependent whose missing dependency is planned for install",
    core: {},
    unsatisfied: [missingEntry("core", "vault")],
    kept: [],
  },
  {
    title: "a dependent whose held dependency the planned install releases",
    core: { enabled: false, dependencyDisabled: true },
    unsatisfied: [missingEntry("core", "vault"), disabledEntry("app", "core")],
    kept: [],
  },
  {
    title: "a dependent whose dependency the user disabled",
    core: { enabled: false },
    unsatisfied: [missingEntry("core", "vault"), disabledEntry("app", "core")],
    kept: [disabledEntry("app", "core")],
  },
  {
    title: "a dependent with a dependency out of range",
    core: {},
    unsatisfied: [
      missingEntry("core", "vault"),
      { ...missingEntry("app", "core"), kind: "out-of-range", range: "^2.0.0" },
    ],
    kept: [{ ...missingEntry("app", "core"), kind: "out-of-range", range: "^2.0.0" }],
  },
] satisfies readonly {
  readonly title: string;
  readonly core: Partial<PluginRecord>;
  readonly unsatisfied: readonly UnsatisfiedDeclaration[];
  readonly kept: readonly UnsatisfiedDeclaration[];
}[]) {
  test(`D-PL2-02: withPlannedInstallsLanded replans the toggles for ${title}`, () => {
    // arrange
    const plan = planWith({
      pluginsToDependencyInstall: [VAULT_INSTALL],
      pluginsToDependencyDisable: [
        { ...DEMO_OP, plugin: "core", dependency: "vault@tools", kind: "missing" },
      ],
    });
    const { replan, seen } = recordingReplan();

    // act
    const landed = withPlannedInstallsLanded(
      plan,
      { ok: true, unsatisfied },
      appAndCore(core),
      replan,
    );

    // assert
    assert.deepStrictEqual(landed, { ...plan, ...FRESH_TOGGLES });
    assert.deepStrictEqual(seen, [{ ok: true, unsatisfied: kept }]);
  });
}

test("D-PL2-14: withPlannedInstallsLanded releases a dependent whose user-disabled dependency the replan enables", () => {
  // arrange -- `core` is off by the user's hand and waits on `vault`; the
  // config enables `core` once nothing holds it.
  const plan = planWith({ pluginsToDependencyInstall: [VAULT_INSTALL] });
  const seen: ScopeSatisfactionVerdict[] = [];
  const replan = (verdict: ScopeSatisfactionVerdict): ReconcilePlan => {
    seen.push(verdict);
    const holdsCore =
      verdict.ok && verdict.unsatisfied.some((entry) => entry.dependent === "core@tools");
    return planWith({ pluginsToEnable: holdsCore ? [] : [{ ...DEMO_OP, plugin: "core" }] });
  };

  // act
  const landed = withPlannedInstallsLanded(
    plan,
    { ok: true, unsatisfied: [missingEntry("core", "vault"), disabledEntry("app", "core")] },
    appAndCore({ enabled: false }),
    replan,
  );

  // assert
  assert.deepStrictEqual(landed, { ...plan, pluginsToEnable: [{ ...DEMO_OP, plugin: "core" }] });
  assert.deepStrictEqual(seen, [
    { ok: true, unsatisfied: [disabledEntry("app", "core")] },
    { ok: true, unsatisfied: [] },
  ]);
});

/** `settleMoveCascade` over a fixed plan and a given verdict. */
async function settleOver(
  fixture: Fixture,
  state: ExtensionState,
  plan: ReconcilePlan,
  verdict: ScopeSatisfactionVerdict,
): Promise<Awaited<ReturnType<typeof settleMoveCascade>>> {
  return settleMoveCascade({
    scope: "project",
    state,
    locations: fixture.locations,
    plan,
    verdict,
    replan: () => plan,
  });
}

function liftAndInstallExtra(...lifted: readonly string[]): ReconcilePlan {
  return planWith({
    pluginsToEnable: lifted.map((plugin) => ({ ...DEMO_OP, plugin })),
    pluginsToDependencyInstall: [EXTRA_INSTALL],
  });
}

const MARKER = { enabled: false, dependencyDisabled: true } as const;

test("D-PL2-16: a lift whose record waits on a planned install is enabled after the installs", async (t) => {
  // arrange
  const fixture = await createFixture(t, "lift-after-install");
  const state = withoutToolsRecord(
    await stageTools(fixture, [
      { name: "widget", offered: "1.0.0", declares: [{ name: "extra" }], record: MARKER },
      { name: "extra", offered: "1.0.0" },
    ]),
    "extra",
  );
  const verdict = await buildScopeSatisfactionVerdict({ state, locations: fixture.locations });

  // act
  const settled = await settleOver(fixture, state, liftAndInstallExtra("widget"), verdict);

  // assert
  assert.deepStrictEqual(settled.enablesAfterInstalls, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.plan, planWith({ pluginsToDependencyInstall: [EXTRA_INSTALL] }));
  assert.deepStrictEqual(settled.deferredEnables, []);
  assert.deepStrictEqual(settled.preview, settled.plan);
});

test("D-PL2-16: a released record that waits on a move and a planned install keeps its move and is enabled after the installs", async (t) => {
  // arrange
  const fixture = await createFixture(t, "deferred-after-install");
  const state = withoutToolsRecord(
    await stageTools(fixture, [
      {
        name: "widget",
        offered: "1.1.0",
        declares: [{ name: "zcore", version: "^2.0.0" }, { name: "extra" }],
        record: MARKER,
      },
      { name: "zcore", offered: "2.0.0" },
      { name: "extra", offered: "1.0.0" },
    ]),
    "extra",
  );
  const verdict = await buildScopeSatisfactionVerdict({ state, locations: fixture.locations });

  // act
  const settled = await settleOver(fixture, state, liftAndInstallExtra("widget"), verdict);

  // assert
  assert.deepStrictEqual(moveKeys(settled.cascade?.plan.moves), ["zcore@tools", "widget@tools"]);
  assert.deepStrictEqual(settled.enablesAfterInstalls, [{ ...DEMO_OP, plugin: "widget" }]);
  assert.deepStrictEqual(settled.deferredEnables, []);
  assert.deepStrictEqual(settled.plan.pluginsToEnable, []);
  assert.deepStrictEqual(settled.preview.pluginsToEnable, []);
});

test("D-PL2-16: records that wait on each other and on a planned install are all enabled after it", async (t) => {
  // arrange -- the verdict names a declaration cycle between `alpha` and `beta`.
  const fixture = await createFixture(t, "cycle-after-install");
  const state = withoutToolsRecord(
    await stageTools(fixture, [
      { name: "alpha", offered: "1.0.0", declares: [{ name: "extra" }], record: MARKER },
      { name: "beta", offered: "1.0.0", record: MARKER },
      { name: "extra", offered: "1.0.0" },
    ]),
    "extra",
  );
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [
      disabledEntry("alpha", "beta"),
      missingEntry("alpha", "extra"),
      disabledEntry("beta", "alpha"),
    ],
  };

  // act
  const settled = await settleOver(fixture, state, liftAndInstallExtra("alpha", "beta"), verdict);

  // assert
  assert.deepStrictEqual(settled.enablesAfterInstalls, [
    { ...DEMO_OP, plugin: "alpha" },
    { ...DEMO_OP, plugin: "beta" },
  ]);
  assert.deepStrictEqual(settled.plan.pluginsToEnable, []);
});

/** A `tools` move from 1.0.0 to 2.0.0, for the cascade-only cases. */
function toolsMove(plugin: string): PlannedMove {
  return {
    scope: "project",
    marketplace: "tools",
    plugin,
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    revisionChanged: true,
    grew: false,
    partial: false,
  };
}

/** A cascade over `moves`, where each key of `declares` declares the `tools` plugins it maps to. */
function cascadeOver(
  moves: readonly string[],
  declares: Readonly<Record<string, readonly string[]>>,
): ConvergenceCascade {
  return {
    plan: { moves: moves.map(toolsMove), holds: [], declines: [] },
    declarations: new Map(
      Object.entries(declares).map(([plugin, names]) => [
        `${plugin}@tools`,
        names.map((name) => ({ name, marketplace: "tools" })),
      ]),
    ),
    installedCopyFailure: null,
  };
}

test("WR-06: the moves after the installs are a waiting record's and, to a fixed point, each move that declares one", () => {
  // arrange
  const cascade = cascadeOver(["dapp", "bapp", "alib", "ready"], {
    dapp: ["bapp"],
    bapp: ["alib"],
  });

  // act
  const after = movesAfterInstalls(cascade, new Set(["alib@tools", "went@tools"]));

  // assert
  assert.deepStrictEqual(after, new Set(["alib@tools", "bapp@tools", "dapp@tools"]));
});

test("WR-07 / D-PL2-18: the steps after the installs pair each waiting enable with its move, mark it waiting, and run dependencies first", () => {
  // arrange
  const cascade = cascadeOver(["bapp", "alib", "ready", "capp"], {
    went: ["bapp"],
    bapp: ["alib"],
    capp: ["alib"],
  });
  const enable = (plugin: string) => ({ scope: "project", plugin, marketplace: "tools" }) as const;

  // act
  const steps = stepsAfterInstalls(
    cascade,
    {
      waiting: new Set(["went@tools", "alib@tools"]),
      afterInstalls: new Set(["alib@tools", "bapp@tools", "capp@tools"]),
      deferred: [enable("capp"), enable("ready")],
    },
    [enable("went"), enable("alib")],
  );

  // assert
  assert.deepStrictEqual(steps, [
    { key: "alib@tools", move: toolsMove("alib"), enable: enable("alib"), waiting: true },
    { key: "bapp@tools", move: toolsMove("bapp") },
    { key: "went@tools", enable: enable("went") },
    { key: "capp@tools", move: toolsMove("capp"), enable: enable("capp") },
  ]);
});

test("D-PL2-18: a waiting record's move whose enable did not come is still a step after the installs, marked waiting, without an enable", () => {
  // arrange
  const cascade = cascadeOver(["bapp", "alib"], { bapp: ["alib"] });

  // act
  const steps = stepsAfterInstalls(
    cascade,
    {
      waiting: new Set(["alib@tools"]),
      afterInstalls: new Set(["alib@tools", "bapp@tools"]),
      deferred: [],
    },
    [],
  );

  // assert
  assert.deepStrictEqual(steps, [
    { key: "alib@tools", move: toolsMove("alib"), waiting: true },
    { key: "bapp@tools", move: toolsMove("bapp") },
  ]);
});
