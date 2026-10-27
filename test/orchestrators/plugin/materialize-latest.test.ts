import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeLatestVersion,
  recordCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { CandidateReport } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts";
import type { MaterializationPolicy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type {
  ThreePhaseArgsBase,
  UpdateDependencySettler,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import type {
  RevisionMove,
  UpdateDependencyRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

const UPDATE_POLICY = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: true,
} satisfies MaterializationPolicy;

function recordedPlugin(version: string, pluginRoot: string): PluginRecord {
  return {
    version,
    resolvedSource: pluginRoot,
    compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
    resources: {
      skills: ["hello-tool"],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
      workflows: [],
    },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Seeds a path marketplace `mp` offering `hello` at `offered`, and a record
 * of `hello` at `recorded` whose `resolvedSource` is the real plugin root.
 */
async function seedRecordedPlugin(
  t: TestContext,
  versions: { readonly recorded: string; readonly offered: string },
): Promise<{ readonly base: ThreePhaseArgsBase; readonly pluginRoot: string }> {
  const { cwd } = await createHermeticEnvironment(t, "materialize-latest-");
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: versions.offered }),
  );
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "hello", source: "./plugins/hello" }] }),
  );
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: { hello: recordedPlugin(versions.recorded, pluginRoot) },
      },
    },
  });
  return {
    pluginRoot,
    base: {
      plugin: "hello",
      marketplace: "mp",
      scope: "project",
      cwd,
      locations,
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache: createCompletionCache(),
      env: {},
      cleanupClones: () => Promise.resolve(),
    },
  };
}

test("returns the unchanged verdict for the recorded revision in direct mode", async (t) => {
  // arrange
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const stateBefore = await readFile(base.locations.stateJsonPath, "utf8");
  const ctx: NotificationContext = {
    mode: "tui",
    ui: { notify: () => assert.fail("the unchanged verdict notifies nothing") },
  };

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: false,
      ctx,
      run: runWithNothingLoaded(),
      cardinality: "single",
      notifyPhaseFailure: () => assert.fail("the unchanged verdict stages nothing"),
    },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  assert.strictEqual(await readFile(base.locations.stateJsonPath, "utf8"), stateBefore);
});

test("swaps the offered version in and records it in cascade mode", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });

  // act
  const outcome = await materializeLatestVersion({ ...base, cascade: true }, UPDATE_POLICY);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    resourcesChanged: true,
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...recordedPlugin("1.1.0", pluginRoot),
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
});

test("REI-01: a policy that does not skip the recorded revision restores its deleted skill", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const reinstallPolicy = {
    refreshSource: false,
    skipSameRevision: false,
    overwrite: true,
    searchReleaseTags: true,
  } satisfies MaterializationPolicy;

  // act
  const outcome = await materializeLatestVersion({ ...base, cascade: true }, reinstallPolicy);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    resourcesChanged: true,
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  assert.strictEqual(
    await readFile(path.join(base.locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
    '---\nname: hello-tool\ndescription: "No description provided."\n---\n',
  );
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...recordedPlugin("1.0.0", pluginRoot),
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
});

test("UPR-03: reports the derived candidate's revisions once before the swap", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const reported: RevisionMove[] = [];

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      onCandidate: (move) => {
        reported.push(move);
      },
    },
    UPDATE_POLICY,
  );

  // assert
  assert.strictEqual(outcome.partition, "updated");
  assert.deepStrictEqual(reported, [{ fromVersion: "1.0.0", toVersion: "1.1.0" }]);
});

test("UPR-03: reports no candidate for a verdict the preflight returns", async (t) => {
  // arrange
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const reported: RevisionMove[] = [];

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      onCandidate: (move) => {
        reported.push(move);
      },
    },
    UPDATE_POLICY,
  );

  // assert
  assert.strictEqual(outcome.partition, "unchanged");
  assert.deepStrictEqual(reported, []);
});

test("UPR-03: a candidate report holds the whole move once the runner derived a candidate", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const report: CandidateReport = {};

  // act
  await materializeLatestVersion(
    { ...base, cascade: true, ...recordCandidate(report) },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(report, { move: { fromVersion: "1.0.0", toVersion: "1.1.0" } });
});

test("UPR-03: a candidate report holds the installed version when no candidate was derived", async (t) => {
  // arrange
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const report: CandidateReport = {};

  // act
  await materializeLatestVersion(
    { ...base, cascade: true, ...recordCandidate(report) },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(report, { move: { fromVersion: "1.0.0" } });
});

const ZCORE_ROW = {
  status: "installed",
  name: "zcore@mp",
  dependencies: [],
  version: "1.0.0",
  severity: "info",
  needsReload: true,
} satisfies UpdateDependencyRow;

test("UPD-DEP-D1: settles the new version's dependencies before the swap and reports their rows", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const settledFor: string[] = [];
  const settleDependencies: UpdateDependencySettler = async (args) => {
    settledFor.push(args.plugin);
    const state = await loadState(base.locations.extensionRoot);
    settledFor.push(state.marketplaces.mp?.plugins.hello?.version ?? "");
    return { kind: "settled", rows: [ZCORE_ROW] };
  };

  // act
  const outcome = await materializeLatestVersion(
    { ...base, cascade: true, settleDependencies },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    resourcesChanged: true,
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
    dependencyRows: [ZCORE_ROW],
  });
  assert.deepStrictEqual(settledFor, ["hello", "1.0.0"]);
});

test("UPD-DEP-D1: an update whose dependencies changed nothing reports no dependency rows", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      settleDependencies: () => Promise.resolve({ kind: "settled", rows: [] }),
    },
    UPDATE_POLICY,
  );

  // assert
  assert.strictEqual(outcome.partition, "updated");
  assert.strictEqual(Object.hasOwn(outcome, "dependencyRows"), false);
});

test("UPD-DEP-D1: a refused dependency closure fails the update and keeps the installed version", async (t) => {
  // arrange
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const refusal = {
    status: "failed",
    name: "zcore@mp",
    reasons: ["already installed", "version conflict"],
    severity: "error",
  } satisfies UpdateDependencyRow;

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      settleDependencies: () =>
        Promise.resolve({ kind: "refused", rows: [refusal], cause: new Error("zcore refused") }),
    },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    fromVersion: "1.0.0",
    notes: ["zcore refused"],
    reasons: ["dependency failed"],
    dependencyRows: [refusal],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  });
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, recordedPlugin("1.0.0", pluginRoot));
});

test("UPD-DEP-D1: a disabled record's update settles no dependencies", async (t) => {
  // arrange
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const state = await loadState(base.locations.extensionRoot);
  const marketplace = state.marketplaces.mp;
  assert.ok(marketplace !== undefined);
  marketplace.plugins.hello = { ...recordedPlugin("1.0.0", pluginRoot), enabled: false };
  await saveState(base.locations.extensionRoot, state);

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      settleDependencies: () => assert.fail("a disabled record settles nothing"),
    },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  });
});

test("UPD-DEP-D1: a swap that fails after the settle changed the scope reports the dependency rows on its failed row", async (t) => {
  // arrange
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const diskFull = new Error("disk full");

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: true,
      settleDependencies: () => Promise.resolve({ kind: "settled", rows: [ZCORE_ROW] }),
      stateTransaction: { saveState: () => Promise.reject(diskFull) },
    },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(
    outcome.partition === "failed" && [outcome.fromVersion, outcome.cause, outcome.dependencyRows],
    ["1.0.0", diskFull, [ZCORE_ROW]],
  );
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, recordedPlugin("1.0.0", pluginRoot));
});

test("UPD-DEP-D1: a cascade run authenticates in the command's context when it carries one", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });
  const ctx: NotificationContext = {
    mode: "tui",
    ui: { notify: () => assert.fail("a path source prompts for nothing") },
  };

  // act
  const outcome = await materializeLatestVersion(
    { ...base, cascade: true, preflightNotification: { ctx, run: runWithNothingLoaded() } },
    UPDATE_POLICY,
  );

  // assert
  assert.strictEqual(outcome.partition, "updated");
});
