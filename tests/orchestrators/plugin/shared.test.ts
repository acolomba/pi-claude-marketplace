import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  applyPartialCascadeFold,
  assertNoCrossPluginConflicts,
  cloneMarketplaceRecordForTargetScope,
  absentTargetReasons,
  emitMarketplaceNotAdded,
  emitMarketplaceNotAddedSignal,
  enableRowDependencies,
  MarketplaceNotAddedSignal,
  missIsNotInstalled,
  maybeWritePluginConfigBack,
  pickAgentsSourceDir,
  removePluginRecord,
  resolveCrossScopePluginTarget,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
  selectDeclaringConfigWriteTarget,
  splitStagingWarnings,
  surfaceDiscoveryWarnings,
  writeAdoptingConfigEntries,
  type CrossPluginGeneratedNames,
  type CrossScopePluginResolution,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  CrossPluginConflictError,
  MarketplaceNotFoundError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginEntry } from "../../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type { MaterializablePlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CommandContext } from "../../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import type { PluginSkippedMessage } from "../../../extensions/pi-claude-marketplace/shared/notify.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface TempScopes {
  readonly cwd: string;
  readonly root: string;
}

function makePluginRecord(opts: {
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly enabled?: boolean;
  readonly hooks?: readonly string[];
  readonly mcpServers?: readonly string[];
  readonly skills?: readonly string[];
}): PluginRecord {
  return {
    version: "1.2.3",
    resolvedSource: "/source/alpha",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: [...(opts.skills ?? [])],
      prompts: [...(opts.commands ?? [])],
      agents: [...(opts.agents ?? [])],
      mcpServers: [...(opts.mcpServers ?? [])],
      hooks: [...(opts.hooks ?? [])],
    },
    enabled: opts.enabled ?? true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

function makeMarketplaceRecord(
  name: string,
  scope: Scope,
  plugins: Record<string, PluginRecord>,
): MarketplaceRecord {
  return {
    name,
    scope,
    source: pathSource(`./${name}-source`),
    addedFromCwd: "/workspace",
    manifestPath: `/workspace/${name}/.claude-plugin/marketplace.json`,
    marketplaceRoot: `/workspace/${name}`,
    plugins,
  };
}

function makeState(
  marketplaces: Record<
    string,
    { readonly plugins: Record<string, PluginRecord>; readonly scope?: Scope }
  >,
): ExtensionState {
  return {
    schemaVersion: 1,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([name, marketplace]) => [
        name,
        makeMarketplaceRecord(name, marketplace.scope ?? "user", marketplace.plugins),
      ]),
    ),
  };
}

function makeMaterializablePlugin(
  pluginRoot: string,
  agents: readonly string[] = [],
): MaterializablePlugin {
  return {
    state: "installable",
    installable: true,
    name: "alpha",
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [...agents] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

async function withTempScopes<T>(run: (scopes: TempScopes) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), "plugin-shared-"));
  const cwd = path.join(root, "project");
  const hadAgentDir = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  await mkdir(cwd, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = path.join(root, "agent");
  try {
    return await run({ cwd, root });
  } finally {
    if (hadAgentDir) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(root, { recursive: true, force: true });
  }
}

async function saveScopedState(
  cwd: string,
  scope: Scope,
  marketplaces: Record<string, Record<string, PluginRecord>>,
): Promise<void> {
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([name, plugins]) => [
        name,
        makeMarketplaceRecord(name, scope, plugins),
      ]),
    ),
  });
}

/**
 * A notification boundary that RECORDS instead of expecting: the two
 * `emitMarketplaceNotAddedSignal` arms are discriminated by the bytes they
 * produce, so the case compares the whole recorded list rather than pinning a
 * call count up front.
 */
function makeRecordingBoundary(notifications: { message: string; severity?: string }[]): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
} {
  const ui = {
    notify(message: string, severity?: string) {
      notifications.push(severity === undefined ? { message } : { message, severity });
    },
  } as unknown as ExtensionContext["ui"];
  const ctx = { ui } as ExtensionContext;
  const pi = { getAllTools: () => [] } as unknown as ExtensionAPI;
  return { ctx, pi };
}

async function writeConfig(filePath: string, config: ScopeConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config));
}

function assertLocationsEquivalent(
  locations: ScopedLocations,
  expectedLocations: ScopedLocations,
): void {
  const keys = Reflect.ownKeys(locations).sort((a, b) => String(a).localeCompare(String(b)));
  const expectedKeys = Reflect.ownKeys(expectedLocations).sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
  assert.deepStrictEqual(keys, expectedKeys);
  assert.deepStrictEqual(
    {
      agentsDir: locations.agentsDir,
      agentsIndexPath: locations.agentsIndexPath,
      agentsStagingDir: locations.agentsStagingDir,
      cacheDir: locations.cacheDir,
      commandsStagingDir: locations.commandsStagingDir,
      configJsonPath: locations.configJsonPath,
      configLocalJsonPath: locations.configLocalJsonPath,
      dataRoot: locations.dataRoot,
      extensionRoot: locations.extensionRoot,
      hooksDir: locations.hooksDir,
      marketplaceNamesCacheFile: locations.marketplaceNamesCacheFile,
      mcpJsonPath: locations.mcpJsonPath,
      pluginClonesDir: locations.pluginClonesDir,
      promptsTargetDir: locations.promptsTargetDir,
      scope: locations.scope,
      scopeRoot: locations.scopeRoot,
      skillsStagingDir: locations.skillsStagingDir,
      skillsTargetDir: locations.skillsTargetDir,
      sourcesDir: locations.sourcesDir,
      stateJsonPath: locations.stateJsonPath,
      stateLockFile: locations.stateLockFile,
    },
    {
      agentsDir: expectedLocations.agentsDir,
      agentsIndexPath: expectedLocations.agentsIndexPath,
      agentsStagingDir: expectedLocations.agentsStagingDir,
      cacheDir: expectedLocations.cacheDir,
      commandsStagingDir: expectedLocations.commandsStagingDir,
      configJsonPath: expectedLocations.configJsonPath,
      configLocalJsonPath: expectedLocations.configLocalJsonPath,
      dataRoot: expectedLocations.dataRoot,
      extensionRoot: expectedLocations.extensionRoot,
      hooksDir: expectedLocations.hooksDir,
      marketplaceNamesCacheFile: expectedLocations.marketplaceNamesCacheFile,
      mcpJsonPath: expectedLocations.mcpJsonPath,
      pluginClonesDir: expectedLocations.pluginClonesDir,
      promptsTargetDir: expectedLocations.promptsTargetDir,
      scope: expectedLocations.scope,
      scopeRoot: expectedLocations.scopeRoot,
      skillsStagingDir: expectedLocations.skillsStagingDir,
      skillsTargetDir: expectedLocations.skillsTargetDir,
      sourcesDir: expectedLocations.sourcesDir,
      stateJsonPath: expectedLocations.stateJsonPath,
      stateLockFile: expectedLocations.stateLockFile,
    },
  );
  assert.deepStrictEqual(
    [
      typeof locations.marketplaceDataDir,
      typeof locations.pluginCacheFile,
      typeof locations.pluginCloneDir,
      typeof locations.pluginDataDir,
      typeof locations.sourceCloneDir,
      typeof locations.sourcesStagingDir,
    ],
    ["function", "function", "function", "function", "function", "function"],
  );
}

describe("enableRowDependencies", () => {
  test("returns no dependencies when the ledger staged neither companion kind", () => {
    // arrange
    const signals = {};

    // act
    const dependencies = enableRowDependencies(signals);

    // assert
    assert.deepStrictEqual(dependencies, []);
  });

  test("returns agent then MCP dependencies when both companion kinds were staged", () => {
    // arrange
    const signals = { stagedAgents: true, stagedMcpServers: true } as const;

    // act
    const dependencies = enableRowDependencies(signals);

    // assert
    assert.deepStrictEqual(dependencies, ["agents", "mcp"]);
  });
});

describe("MarketplaceNotAddedSignal", () => {
  test("omits requestedScope when no scope was requested", () => {
    // arrange
    const marketplace = "ghost";

    // act
    const signal = new MarketplaceNotAddedSignal(marketplace);

    // assert
    assert.equal(signal.name, "MarketplaceNotAddedSignal");
    assert.equal(signal.message, 'Marketplace "ghost" not added.');
    assert.equal(signal.marketplace, "ghost");
    assert.equal(Object.hasOwn(signal, "requestedScope"), true);
    assert.equal(signal.requestedScope, undefined);
  });

  test("carries the requested scope when one was supplied", () => {
    // arrange
    const marketplace = "ghost";

    // act
    const signal = new MarketplaceNotAddedSignal(marketplace, "project");

    // assert
    assert.equal(signal.name, "MarketplaceNotAddedSignal");
    assert.equal(signal.message, 'Marketplace "ghost" not added.');
    assert.equal(signal.marketplace, "ghost");
    assert.equal(signal.requestedScope, "project");
  });

  test("carries the named scope and the plugin subject when nothing is installed there", () => {
    // arrange
    const marketplace = "mp";

    // act
    const signal = new MarketplaceNotAddedSignal(marketplace, "project", {
      scope: "project",
      plugin: "hello",
    });

    // assert
    assert.equal(signal.name, "MarketplaceNotAddedSignal");
    assert.equal(signal.message, 'Marketplace "mp" not added.');
    assert.equal(signal.marketplace, "mp");
    assert.equal(signal.requestedScope, "project");
    assert.equal(signal.notInstalledAt, "project");
    assert.equal(signal.plugin, "hello");
  });
});

describe("missIsNotInstalled", () => {
  test("names the requested scope when the plugin row was found under the sibling scope", async () => {
    // arrange
    const resolution = {
      kind: "other-scope",
      presentIn: "project",
      requestedScope: "user",
    } satisfies CrossScopePluginResolution;

    // act
    const notInstalledAt = await missIsNotInstalled({
      cwd: "/work/project",
      marketplace: "mp",
      resolution,
    });

    // assert
    assert.strictEqual(notInstalledAt, "user");
  });

  test("names no scope for a resolved target", async () => {
    await withTempScopes(async ({ cwd }) => {
      // arrange
      const resolution = {
        kind: "resolved",
        scope: "project",
        locations: locationsFor("project", cwd),
      } satisfies CrossScopePluginResolution;

      // act
      const notInstalledAt = await missIsNotInstalled({ cwd, marketplace: "mp", resolution });

      // assert
      assert.strictEqual(notInstalledAt, undefined);
    });
  });

  test("names no scope for a bare form that consulted both scopes", async () => {
    // arrange
    const resolution = { kind: "marketplace-absent" } satisfies CrossScopePluginResolution;

    // act
    const notInstalledAt = await missIsNotInstalled({
      cwd: "/work/project",
      marketplace: "mp",
      resolution,
    });

    // assert
    assert.strictEqual(notInstalledAt, undefined);
  });

  test("names the requested scope when the container is registered in the other one", async () => {
    await withTempScopes(async ({ cwd }) => {
      // arrange
      await saveScopedState(cwd, "project", { mp: {} });
      const resolution = {
        kind: "marketplace-absent",
        requestedScope: "user",
      } satisfies CrossScopePluginResolution;

      // act
      const notInstalledAt = await missIsNotInstalled({ cwd, marketplace: "mp", resolution });

      // assert
      assert.strictEqual(notInstalledAt, "user");
    });
  });

  test("names no scope when the container is missing from both scopes", async () => {
    await withTempScopes(async ({ cwd }) => {
      // arrange
      await saveScopedState(cwd, "project", {});
      const resolution = {
        kind: "marketplace-absent",
        requestedScope: "user",
      } satisfies CrossScopePluginResolution;

      // act
      const notInstalledAt = await missIsNotInstalled({ cwd, marketplace: "mp", resolution });

      // assert
      assert.strictEqual(notInstalledAt, undefined);
    });
  });
});

for (const { notInstalledAt, expectedReasons } of [
  { notInstalledAt: undefined, expectedReasons: ["not installed"] },
  {
    notInstalledAt: "user",
    expectedReasons: ["not installed", "marketplace in project scope"],
  },
  {
    notInstalledAt: "project",
    expectedReasons: ["not installed", "marketplace in user scope"],
  },
] satisfies readonly {
  notInstalledAt: Scope | undefined;
  expectedReasons: readonly string[];
}[]) {
  test(`absentTargetReasons answers ${expectedReasons.join(", ")} for ${notInstalledAt ?? "an in-scope container"}`, () => {
    // arrange
    const namedScope = notInstalledAt;

    // act
    const reasons = absentTargetReasons(namedScope);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });
}

describe("resolveCrossScopePluginTarget", () => {
  test("resolves an explicit scope whose marketplace container exists", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
        explicitScope: "project",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "project");
        assertLocationsEquivalent(resolution.locations, locationsFor("project", cwd));
      }
    });
  });

  test("reports the other scope when an explicit-scope miss finds the plugin there", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
        explicitScope: "project",
      });

      // assert
      assert.deepStrictEqual(resolution, {
        kind: "other-scope",
        presentIn: "user",
        requestedScope: "project",
      });
    });
  });

  test("reports an explicit miss when the other container lacks the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
        explicitScope: "user",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent", requestedScope: "user" });
    });
  });

  test("prefers a project plugin for an unqualified target", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: { alpha: makePluginRecord({}) } });
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "project");
        assertLocationsEquivalent(resolution.locations, locationsFor("project", cwd));
      }
    });
  });

  test("uses a user plugin when the project scope lacks it", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("prefers a project container when neither scope has the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "project");
        assertLocationsEquivalent(resolution.locations, locationsFor("project", cwd));
      }
    });
  });

  test("uses a user container when the project scope has no matching container", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("omits requestedScope when an unqualified target is absent everywhere", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent" });
    });
  });
});

describe("resolveInstallMarketplaceSource", () => {
  test("returns the target-scope marketplace record when it exists", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const sourceRecord = makeMarketplaceRecord("mp", "project", {});
      const targetState: ExtensionState = { schemaVersion: 1, marketplaces: { mp: sourceRecord } };

      // act
      const source = await resolveInstallMarketplaceSource({
        targetScope: "project",
        cwd,
        marketplace: "mp",
        targetState,
      });

      // assert
      assert.deepStrictEqual(source, { sourceScope: "project", sourceRecord });
    });
  });

  test("does not fall back across scopes for a user-target install", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const targetState: ExtensionState = { schemaVersion: 1, marketplaces: {} };

      // act
      const source = await resolveInstallMarketplaceSource({
        targetScope: "user",
        cwd,
        marketplace: "mp",
        targetState,
      });

      // assert
      assert.equal(source, undefined);
    });
  });

  test("falls back to the user marketplace for a project-target install", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: {} });
      const sourceRecord = makeMarketplaceRecord("mp", "user", {});
      const targetState: ExtensionState = { schemaVersion: 1, marketplaces: {} };

      // act
      const source = await resolveInstallMarketplaceSource({
        targetScope: "project",
        cwd,
        marketplace: "mp",
        targetState,
      });

      // assert
      assert.deepStrictEqual(source, { sourceScope: "user", sourceRecord });
    });
  });

  test("returns undefined when neither scope has the marketplace", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const targetState: ExtensionState = { schemaVersion: 1, marketplaces: {} };

      // act
      const source = await resolveInstallMarketplaceSource({
        targetScope: "project",
        cwd,
        marketplace: "mp",
        targetState,
      });

      // assert
      assert.equal(source, undefined);
    });
  });
});

describe("cloneMarketplaceRecordForTargetScope", () => {
  test("clones metadata into the target scope with no plugin installs", () => {
    // arrange
    const sourceRecord = makeMarketplaceRecord("mp", "user", {
      alpha: makePluginRecord({ skills: ["alpha-skill"] }),
    });

    // act
    const clonedRecord = cloneMarketplaceRecordForTargetScope(sourceRecord, "project");

    // assert
    assert.deepStrictEqual(clonedRecord, {
      name: "mp",
      scope: "project",
      source: { kind: "path", raw: "./mp-source", logical: "./mp-source" },
      addedFromCwd: "/workspace",
      manifestPath: "/workspace/mp/.claude-plugin/marketplace.json",
      marketplaceRoot: "/workspace/mp",
      plugins: {},
    });
    assert.deepStrictEqual(sourceRecord.plugins, {
      alpha: makePluginRecord({ skills: ["alpha-skill"] }),
    });
    assert.notEqual(clonedRecord, sourceRecord);
    assert.notEqual(clonedRecord.plugins, sourceRecord.plugins);
  });
});

describe("selectDeclaringConfigWriteTarget", () => {
  test("reports an unreadable local determinant when no locality was requested", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.configLocalJsonPath), { recursive: true });
      await writeFile(locations.configLocalJsonPath, "{");

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: undefined,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, {
        kind: "unreadable",
        filePath: locations.configLocalJsonPath,
      });
    });
  });

  test("reports an unreadable explicitly selected local file", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.configLocalJsonPath), { recursive: true });
      await writeFile(locations.configLocalJsonPath, "{");

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: true,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, {
        kind: "unreadable",
        filePath: locations.configLocalJsonPath,
      });
    });
  });

  test("selects the local file that already declares the plugin key", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const localConfig: ScopeConfig = {
        schemaVersion: 1,
        plugins: { "alpha@mp": { enabled: false } },
      };
      await writeConfig(locations.configLocalJsonPath, localConfig);

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: undefined,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, {
        kind: "selected",
        targetConfigPath: locations.configLocalJsonPath,
        targetIsLocal: true,
        current: localConfig,
        sibling: { schemaVersion: 1 },
      });
    });
  });

  test("selects the base file when a readable local file lacks the plugin key", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const baseConfig: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp" } },
      };
      const localConfig: ScopeConfig = { schemaVersion: 1, plugins: {} };
      await writeConfig(locations.configJsonPath, baseConfig);
      await writeConfig(locations.configLocalJsonPath, localConfig);

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: undefined,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, {
        kind: "selected",
        targetConfigPath: locations.configJsonPath,
        targetIsLocal: false,
        current: baseConfig,
        sibling: localConfig,
      });
    });
  });

  test("treats an absent local target as empty and preserves unreadable sibling uncertainty", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{");

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: true,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, {
        kind: "selected",
        targetConfigPath: locations.configLocalJsonPath,
        targetIsLocal: true,
        current: { schemaVersion: 1 },
        sibling: undefined,
      });
    });
  });

  test("reports an unreadable explicitly selected base file", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{");

      // act
      const target = await selectDeclaringConfigWriteTarget({
        locations,
        local: false,
        key: "alpha@mp",
      });

      // assert
      assert.deepStrictEqual(target, { kind: "unreadable", filePath: locations.configJsonPath });
    });
  });
});

describe("writeAdoptingConfigEntries", () => {
  test("writes the adopted marketplace source and plugin declaration together", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const sibling: ScopeConfig = { schemaVersion: 1 };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        sibling,
        state,
        marketplace: "mp",
        plugin: "alpha",
        targetConfigPath: locations.configJsonPath,
        scopeRoot: locations.scopeRoot,
        pluginPatch: { enabled: false },
      });

      // assert
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {\n      "enabled": false\n    }\n  }\n}\n',
      );
      assert.deepStrictEqual(current, { schemaVersion: 1 });
      assert.deepStrictEqual(sibling, { schemaVersion: 1 });
    });
  });

  test("does not duplicate a marketplace already declared in the target config", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./declared", autoupdate: false } },
      };
      const sibling: ScopeConfig = { schemaVersion: 1 };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        sibling,
        state,
        marketplace: "mp",
        plugin: "alpha",
        targetConfigPath: locations.configJsonPath,
        scopeRoot: locations.scopeRoot,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./declared",\n      "autoupdate": false\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  test("does not shadow a marketplace declaration found only in the sibling config", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const sibling: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./sibling", autoupdate: false } },
      };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        sibling,
        state,
        marketplace: "mp",
        plugin: "alpha",
        targetConfigPath: locations.configLocalJsonPath,
        scopeRoot: locations.scopeRoot,
        pluginPatch: { enabled: true },
      });

      // assert
      assert.equal(
        await readFile(locations.configLocalJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {},\n  "plugins": {\n    "alpha@mp": {\n      "enabled": true\n    }\n  }\n}\n',
      );
    });
  });

  test("writes only the plugin declaration when the sibling config is unreadable", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        sibling: undefined,
        state,
        marketplace: "mp",
        plugin: "alpha",
        targetConfigPath: locations.configJsonPath,
        scopeRoot: locations.scopeRoot,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {},\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  test("writes only the plugin declaration when legacy state has no string source", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const sibling: ScopeConfig = { schemaVersion: 1 };
      const marketplace = makeMarketplaceRecord("mp", "project", {});
      const state: ExtensionState = {
        schemaVersion: 1,
        marketplaces: { mp: { ...marketplace, source: { raw: 23 } } },
      };

      // act
      await writeAdoptingConfigEntries({
        current,
        sibling,
        state,
        marketplace: "mp",
        plugin: "alpha",
        targetConfigPath: locations.configJsonPath,
        scopeRoot: locations.scopeRoot,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {},\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });
});

describe("resolveInstalledPluginTarget", () => {
  test("returns an explicit scope without consulting stored state", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      // act
      const target = await resolveInstalledPluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
        explicitScope: "user",
      });

      // assert
      assert.ok(target !== undefined);
      assert.deepStrictEqual(Object.keys(target), ["scope", "locations"]);
      assert.equal(target.scope, "user");
      assertLocationsEquivalent(target.locations, locationsFor("user", cwd));
    });
  });

  test("prefers a project install for an unqualified plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: { alpha: makePluginRecord({}) } });
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const target = await resolveInstalledPluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.ok(target !== undefined);
      assert.deepStrictEqual(Object.keys(target), ["scope", "locations"]);
      assert.equal(target.scope, "project");
      assertLocationsEquivalent(target.locations, locationsFor("project", cwd));
    });
  });

  test("uses a user install when the project scope lacks the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const target = await resolveInstalledPluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.ok(target !== undefined);
      assert.deepStrictEqual(Object.keys(target), ["scope", "locations"]);
      assert.equal(target.scope, "user");
      assertLocationsEquivalent(target.locations, locationsFor("user", cwd));
    });
  });

  test("returns undefined when neither scope has the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const target = await resolveInstalledPluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });

      // assert
      assert.equal(target, undefined);
    });
  });
});

describe("resolveInstalledMarketplaceTarget", () => {
  test("resolves an explicit scope whose marketplace exists", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({
        cwd,
        marketplace: "mp",
        explicitScope: "user",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("reports the other scope when an explicit-scope miss finds the marketplace there", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({
        cwd,
        marketplace: "mp",
        explicitScope: "project",
      });

      // assert
      assert.deepStrictEqual(resolution, {
        kind: "other-scope",
        presentIn: "user",
        requestedScope: "project",
      });
    });
  });

  test("reports an explicit miss when both scopes lack the marketplace", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      // act
      const resolution = await resolveInstalledMarketplaceTarget({
        cwd,
        marketplace: "mp",
        explicitScope: "project",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent", requestedScope: "project" });
    });
  });

  test("prefers a project marketplace with installed plugins", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: { alpha: makePluginRecord({}) } });
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "project");
        assertLocationsEquivalent(resolution.locations, locationsFor("project", cwd));
      }
    });
  });

  test("uses a user marketplace with plugins before an empty project marketplace", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: { alpha: makePluginRecord({}) } });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("prefers an empty project marketplace over an empty user marketplace", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "project");
        assertLocationsEquivalent(resolution.locations, locationsFor("project", cwd));
      }
    });
  });

  test("uses an empty user marketplace when project has no container", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const resolution = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.deepStrictEqual(Object.keys(resolution), ["kind", "scope", "locations"]);
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("omits requestedScope when an unqualified marketplace is absent everywhere", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      // act
      const resolution = await resolveInstalledMarketplaceTarget({ cwd, marketplace: "mp" });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent" });
    });
  });
});

describe("resolvePluginVersion", () => {
  test("prefers a non-empty plugin manifest version over the marketplace entry", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ version: "2.0.0" }),
      );
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable);

      // assert
      assert.equal(version, "2.0.0");
    });
  });

  test("uses the marketplace entry when the manifest version is not a string", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ version: 2 }),
      );
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable);

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  test("uses the marketplace entry when the manifest version is empty", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ version: "" }),
      );
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable);

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  test("uses the marketplace entry when the manifest cannot be parsed", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{");
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable);

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  test("uses the content hash when neither declaration has a usable version", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      const entry = { name: "alpha", source: "./alpha", version: "" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable);

      // assert
      assert.equal(version, "hash-e3b0c44298fc");
    });
  });
});

describe("pickAgentsSourceDir", () => {
  test("returns null when no agent source is declared", () => {
    // arrange
    const installable = makeMaterializablePlugin("/plugins/alpha");

    // act
    const agentsSourceDir = pickAgentsSourceDir(installable);

    // assert
    assert.equal(agentsSourceDir, null);
  });

  test("returns an absolute first agent source unchanged", () => {
    // arrange
    const installable = makeMaterializablePlugin("/plugins/alpha", ["/shared/agents", "other"]);

    // act
    const agentsSourceDir = pickAgentsSourceDir(installable);

    // assert
    assert.equal(agentsSourceDir, "/shared/agents");
  });

  test("resolves a relative first agent source beneath the plugin root", () => {
    // arrange
    const installable = makeMaterializablePlugin("/plugins/alpha", ["agents", "other"]);

    // act
    const agentsSourceDir = pickAgentsSourceDir(installable);

    // assert
    assert.equal(agentsSourceDir, "/plugins/alpha/agents");
  });
});

describe("assertNoCrossPluginConflicts", () => {
  test("accepts generated names not reserved by another plugin", () => {
    // arrange
    const state = makeState({
      mp: { plugins: { owner: makePluginRecord({ skills: ["owned"] }) } },
    });
    const generatedNames: CrossPluginGeneratedNames = {
      skills: ["new-skill"],
      commands: ["alpha:new-command"],
      agents: ["alpha-new-agent"],
    };

    // act & assert
    assert.doesNotThrow(() => {
      assertNoCrossPluginConflicts("user", generatedNames, state);
    });
  });

  test("reports every conflict by kind and alphabetical name order", () => {
    // arrange
    const state = makeState({
      mp: {
        plugins: {
          owner: makePluginRecord({
            skills: ["b-skill", "a-skill"],
            commands: ["alpha:b", "alpha:a"],
            agents: ["b-agent", "a-agent"],
            mcpServers: ["ignored-mcp"],
          }),
        },
      },
    });
    const generatedNames: CrossPluginGeneratedNames = {
      skills: ["b-skill", "a-skill"],
      commands: ["alpha:b", "alpha:a"],
      agents: ["b-agent", "a-agent"],
    };

    // act & assert
    assert.throws(
      () => {
        assertNoCrossPluginConflicts("user", generatedNames, state);
      },
      (error: unknown) => {
        assert.ok(error instanceof CrossPluginConflictError);
        assert.equal(error.name, "CrossPluginConflictError");
        assert.equal(
          error.message,
          'Cross-plugin name conflict:\n  - skill "a-skill" already owned by plugin "owner"\n  - skill "b-skill" already owned by plugin "owner"\n  - command "alpha:a" already owned by plugin "owner"\n  - command "alpha:b" already owned by plugin "owner"\n  - agent "a-agent" already owned by plugin "owner"\n  - agent "b-agent" already owned by plugin "owner"',
        );
        assert.deepStrictEqual(error.conflicts, [
          'skill "a-skill" already owned by plugin "owner"',
          'skill "b-skill" already owned by plugin "owner"',
          'command "alpha:a" already owned by plugin "owner"',
          'command "alpha:b" already owned by plugin "owner"',
          'agent "a-agent" already owned by plugin "owner"',
          'agent "b-agent" already owned by plugin "owner"',
        ]);
        return true;
      },
    );
  });

  test("identifies a disabled plugin that still reserves generated names", () => {
    // arrange
    const state = makeState({
      mp: { plugins: { owner: makePluginRecord({ enabled: false, skills: ["reserved"] }) } },
    });
    const generatedNames: CrossPluginGeneratedNames = {
      skills: ["reserved"],
      commands: [],
      agents: [],
    };

    // act & assert
    assert.throws(
      () => {
        assertNoCrossPluginConflicts("project", generatedNames, state);
      },
      (error: unknown) => {
        assert.ok(error instanceof CrossPluginConflictError);
        assert.deepStrictEqual(error.conflicts, [
          'skill "reserved" already owned by disabled plugin "owner"',
        ]);
        return true;
      },
    );
  });
});

describe("removePluginRecord", () => {
  test("returns a new top-level state when the marketplace is absent", () => {
    // arrange
    const state = makeState({ other: { plugins: { beta: makePluginRecord({}) } } });

    // act
    const stateWithoutPlugin = removePluginRecord(state, "mp", "alpha");

    // assert
    assert.deepStrictEqual(stateWithoutPlugin, state);
    assert.notEqual(stateWithoutPlugin, state);
    assert.notEqual(stateWithoutPlugin.marketplaces, state.marketplaces);
    assert.equal(stateWithoutPlugin.marketplaces.other, state.marketplaces.other);
  });

  test("removes only the selected record without mutating the input state", () => {
    // arrange
    const alpha = makePluginRecord({ skills: ["alpha-skill"] });
    const beta = makePluginRecord({ commands: ["beta:command"] });
    const state = makeState({ mp: { plugins: { alpha, beta } } });

    // act
    const stateWithoutPlugin = removePluginRecord(state, "mp", "alpha");

    // assert
    assert.deepStrictEqual(stateWithoutPlugin.marketplaces.mp?.plugins, { beta });
    assert.deepStrictEqual(state.marketplaces.mp?.plugins, { alpha, beta });
    assert.notEqual(stateWithoutPlugin, state);
    assert.notEqual(stateWithoutPlugin.marketplaces, state.marketplaces);
    assert.notEqual(stateWithoutPlugin.marketplaces.mp, state.marketplaces.mp);
    assert.notEqual(stateWithoutPlugin.marketplaces.mp?.plugins, state.marketplaces.mp?.plugins);
  });
});

describe("maybeWritePluginConfigBack", () => {
  test("reports an invalid target config without rewriting it", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{");

      // act
      const writeBack = await maybeWritePluginConfigBack({
        locations,
        marketplace: "mp",
        plugin: "alpha",
        local: false,
      });

      // assert
      assert.deepStrictEqual(writeBack, { invalidConfig: true });
      assert.equal(await readFile(locations.configJsonPath, "utf8"), "{");
    });
  });

  test("leaves an existing plugin declaration byte-identical", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const original = '{"schemaVersion":1,"plugins":{"alpha@mp":{"enabled":false}}}';
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, original);

      // act
      const writeBack = await maybeWritePluginConfigBack({
        locations,
        marketplace: "mp",
        plugin: "alpha",
        local: false,
      });

      // assert
      assert.deepStrictEqual(writeBack, { invalidConfig: false });
      assert.equal(await readFile(locations.configJsonPath, "utf8"), original);
    });
  });

  test("adds a missing plugin declaration to a valid base config", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.configJsonPath, {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp" } },
      });

      // act
      const writeBack = await maybeWritePluginConfigBack({
        locations,
        marketplace: "mp",
        plugin: "alpha",
        local: false,
      });

      // assert
      assert.deepStrictEqual(writeBack, { invalidConfig: false });
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  test("creates the local config when the selected local file is absent", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);

      // act
      const writeBack = await maybeWritePluginConfigBack({
        locations,
        marketplace: "mp",
        plugin: "alpha",
        local: true,
      });

      // assert
      assert.deepStrictEqual(writeBack, { invalidConfig: false });
      assert.equal(
        await readFile(locations.configLocalJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });
});

describe("applyPartialCascadeFold", () => {
  test("subtracts every dropped artifact while preserving retained artifacts", () => {
    // arrange
    const installed = {
      resources: {
        skills: ["drop-skill", "keep-skill"],
        prompts: ["drop-command", "keep-command"],
        agents: ["drop-agent", "keep-agent"],
        mcpServers: ["drop-mcp", "keep-mcp"],
        hooks: ["drop-hook", "keep-hook"],
      },
    };
    const dropped = {
      skills: ["drop-skill", "missing-skill"],
      commands: ["drop-command", "missing-command"],
      agents: ["drop-agent", "missing-agent"],
      hooks: ["drop-hook", "missing-hook"],
      mcpServers: ["drop-mcp", "missing-mcp"],
    };

    // act
    applyPartialCascadeFold(installed, dropped);

    // assert
    assert.deepStrictEqual(installed, {
      resources: {
        skills: ["keep-skill"],
        prompts: ["keep-command"],
        agents: ["keep-agent"],
        mcpServers: ["keep-mcp"],
        hooks: ["keep-hook"],
      },
    });
    assert.deepStrictEqual(dropped, {
      skills: ["drop-skill", "missing-skill"],
      commands: ["drop-command", "missing-command"],
      agents: ["drop-agent", "missing-agent"],
      hooks: ["drop-hook", "missing-hook"],
      mcpServers: ["drop-mcp", "missing-mcp"],
    });
  });
});

describe("emitMarketplaceNotAdded", () => {
  test("returns a complete orchestrated failure across both scopes", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace: "ghost",
      requestedScope: undefined,
      orchestrated: true,
    });

    // assert
    assert.ok(failure !== undefined);
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.equal(failure.error.mpName, "ghost");
    assert.deepStrictEqual(failure.error.scopes, ["project", "user"]);
    assert.equal(failure.cause, 'Marketplace "ghost" not found in project, user scopes.');
    assert.deepStrictEqual(Object.keys(failure), ["status", "reason", "error", "cause"]);
    verify(ctx);
    verify(pi);
  });

  test("returns a complete orchestrated failure for the requested scope", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace: "ghost",
      requestedScope: "project",
      orchestrated: true,
    });

    // assert
    assert.ok(failure !== undefined);
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.equal(failure.error.mpName, "ghost");
    assert.deepStrictEqual(failure.error.scopes, ["project"]);
    assert.equal(failure.cause, 'Marketplace "ghost" not found in project scope.');
    assert.deepStrictEqual(Object.keys(failure), ["status", "reason", "error", "cause"]);
    verify(ctx);
    verify(pi);
  });

  test("emits the exact scoped standalone row and returns undefined", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    when(() => pi.getAllTools())
      .thenReturn([])
      .twice();
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        "A marketplace operation has failed.\n\n⊘ ghost [user] (failed) {marketplace not added}",
        "error",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace: "ghost",
      requestedScope: "user",
      orchestrated: false,
    });

    // assert
    assert.equal(failure, undefined);
    verify(ctx);
    verify(ui);
    verify(pi);
  });

  test("emits the exact unscoped standalone row when both scopes miss", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    when(() => pi.getAllTools())
      .thenReturn([])
      .twice();
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        "A marketplace operation has failed.\n\n⊘ ghost (failed) {marketplace not added}",
        "error",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace: "ghost",
      requestedScope: undefined,
      orchestrated: false,
    });

    // assert
    assert.equal(failure, undefined);
    verify(ctx);
    verify(ui);
    verify(pi);
  });
});

describe("emitMarketplaceNotAddedSignal", () => {
  test("renders the plugin row when nothing of the container is installed at the named scope", async () => {
    // arrange
    const renderedRows: PluginSkippedMessage[] = [];
    const context = {
      Messaging: { label: "Plugin reinstall" },
      render: {
        skipped: (row) => {
          renderedRows.push(row);
          return `⊘ ${row.name} (skipped)`;
        },
      },
    } satisfies CommandContext<"skipped", PluginSkippedMessage>;
    const notifications: { message: string; severity?: string }[] = [];
    const { ctx, pi } = makeRecordingBoundary(notifications);

    // act
    await emitMarketplaceNotAddedSignal({
      ctx,
      pi,
      cwd: "/work/project",
      context,
      err: new MarketplaceNotAddedSignal("mp", "project", { scope: "project", plugin: "hello" }),
    });

    // assert
    assert.deepStrictEqual(renderedRows, [
      {
        status: "skipped",
        name: "hello",
        reasons: ["not installed", "marketplace in user scope"],
        severity: "error",
        needsReload: false,
      },
    ]);
    assert.deepStrictEqual(notifications, [
      {
        message: "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped)",
        severity: "error",
      },
    ]);
  });

  test("renders the marketplace row when the container is absent from every scope", async () => {
    await withTempScopes(async ({ cwd }) => {
      // arrange
      const context = {
        Messaging: { label: "Plugin reinstall" },
        render: {
          skipped: (row) => `⊘ ${row.name} (skipped)`,
        },
      } satisfies CommandContext<"skipped", PluginSkippedMessage>;
      const notifications: { message: string; severity?: string }[] = [];
      const { ctx, pi } = makeRecordingBoundary(notifications);

      // act
      await emitMarketplaceNotAddedSignal({
        ctx,
        pi,
        cwd,
        context,
        err: new MarketplaceNotAddedSignal("ghost", "user"),
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n\n⊘ ghost [user] (failed) {marketplace not added}",
          severity: "error",
        },
      ]);
    });
  });
});

describe("splitStagingWarnings", () => {
  test("preserves discovery order and separates bridge hygiene warnings", () => {
    // arrange
    const warnings = {
      skills: ["skill-a", "skill-b"],
      commands: ["command-a"],
      agents: ["agent-a"],
      mcp: ["mcp-a", "mcp-b"],
    };

    // act
    const split = splitStagingWarnings(warnings);

    // assert
    assert.deepStrictEqual(split, {
      discovery: ["skill-a", "skill-b", "command-a"],
      bridge: ["agent-a", "mcp-a", "mcp-b"],
    });
    assert.equal(Object.isFrozen(split.discovery), true);
    assert.equal(Object.isFrozen(split.bridge), true);
    assert.deepStrictEqual(warnings, {
      skills: ["skill-a", "skill-b"],
      commands: ["command-a"],
      agents: ["agent-a"],
      mcp: ["mcp-a", "mcp-b"],
    });
  });
});

describe("surfaceDiscoveryWarnings", () => {
  test("does not notify when no discovery warning exists", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    surfaceDiscoveryWarnings(ctx, { plugin: "alpha", verb: "installed", warnings: [] });

    // assert
    verify(ctx);
  });

  test("redacts a singular discovery path and emits exact warning bytes", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        'Plugin "alpha" installed; 1 declared component was skipped.\n\nCould not read alpha-skill',
        "warning",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    surfaceDiscoveryWarnings(ctx, {
      plugin: "alpha",
      verb: "installed",
      warnings: ["Could not read /private/plugin/skills/alpha-skill"],
    });

    // assert
    verify(ctx);
    verify(ui);
  });

  test("emits plural updated diagnostics in caller warning order", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        'Plugin "alpha" updated; 2 declared components were skipped.\n\nfirst warning\nsecond warning',
        "warning",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    surfaceDiscoveryWarnings(ctx, {
      plugin: "alpha",
      verb: "updated",
      warnings: ["first warning", "second warning"],
    });

    // assert
    verify(ctx);
    verify(ui);
  });
});
