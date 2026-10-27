import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  copyManifestBoundary,
  inPlaceManifestBoundary,
} from "../../../extensions/pi-claude-marketplace/domain/manifest-containment.ts";
import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  applyPartialCascadeFold,
  assertNoCrossPluginConflicts,
  collectInstallReachableMarketplaces,
  absentTargetReasons,
  emitMarketplaceNotAdded,
  emitMarketplaceNotAddedSignal,
  degradationFromEnable,
  enableRowDependencies,
  isRecordedCandidate,
  isSameRevision,
  keepLocalLayerTargets,
  loadTargetLayers,
  localOnlyMarketplaceRefusal,
  MarketplaceNotAddedSignal,
  missIsNotInstalled,
  namedPluginLayerRefusal,
  overwriteDisabledMemberEntries,
  pluginLayerVerdict,
  readDeclaredPluginVersion,
  removePluginRecord,
  resolveCrossScopePluginTarget,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
  resolveTagPinnedPluginVersion,
  retiresWorkflowCommand,
  sweepWorkflowsStaging,
  undeclarableMarketplaceRefusal,
  writeAdoptingConfigEntries,
  type CrossPluginGeneratedNames,
  type CrossScopePluginResolution,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  CrossPluginConflictError,
  DependencyDeclarationsUnreadableError,
  LayerConfigUnreadableError,
  MarketplaceInLocalLayerOnlyError,
  MarketplaceNotFoundError,
  MarketplaceSourceUndeclarableError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { PluginEntry } from "../../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type { MaterializablePlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CommandContext } from "../../../extensions/pi-claude-marketplace/shared/notify-context.ts";
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
      workflows: [],
    },
    enabled: opts.enabled ?? true,
    provenance: "explicit",
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

/** A scope that records `mp` with a source of a kind this version does not know, and no `raw`. */
function unknownSourceState(): ExtensionState {
  const record = makeMarketplaceRecord("mp", "project", {});
  return {
    schemaVersion: 1,
    marketplaces: {
      mp: { ...record, source: { kind: "unknown", reason: "a future source kind" } },
    },
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
    componentPaths: { skills: [], commands: [], agents: [...agents], workflows: [] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

async function withTempScopes<T>(run: (scopes: TempScopes) => Promise<T>): Promise<T> {
  return withHermeticEnvironment("plugin-shared-", ({ cwd, root }) => run({ cwd, root }));
}

/**
 * Records the marketplace `tools` in the project scope with the given plugins,
 * and writes its manifest under `root` listing each entry with its dependencies.
 */
async function saveToolsScope(args: {
  readonly cwd: string;
  readonly root: string;
  readonly records: Readonly<Record<string, PluginRecord["provenance"]>>;
  readonly entries: Readonly<Record<string, readonly string[]>>;
}): Promise<void> {
  const marketplaceRoot = path.join(args.root, "tools");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "tools",
      plugins: Object.entries(args.entries).map(([name, dependencies]) => ({
        name,
        source: `./plugins/${name}`,
        dependencies,
      })),
    }),
  );
  const locations = locationsFor("project", args.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const plugins = Object.fromEntries(
    Object.entries(args.records).map(([name, provenance]) => [
      name,
      {
        ...makePluginRecord({}),
        provenance,
        resolvedSource: path.join(marketplaceRoot, "plugins", name),
      },
    ]),
  );
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      tools: {
        ...makeMarketplaceRecord("tools", "project", plugins),
        manifestPath,
        marketplaceRoot,
      },
    },
  });
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
} {
  const ui = {
    notify(message: string, severity?: string) {
      notifications.push(severity === undefined ? { message } : { message, severity });
    },
  } as unknown as ExtensionContext["ui"];
  const ctx = { mode: "tui", ui } as ExtensionContext;
  return { ctx };
}

async function writeConfig(filePath: string, config: ScopeConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config));
}

/** Write `content` to `filePath`, or leave the file absent when there is none. */
async function writeOptionalFile(filePath: string, content: string | undefined): Promise<void> {
  if (content !== undefined) {
    await writeFile(filePath, content);
  }
}

/** The file's bytes, or `undefined` when it does not exist. */
async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
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
      baseConfigJsonPath: locations.baseConfigJsonPath,
      localConfigJsonPath: locations.localConfigJsonPath,
      dataRoot: locations.dataRoot,
      extensionRoot: locations.extensionRoot,
      hooksDir: locations.hooksDir,
      marketplaceNamesCacheFile: locations.marketplaceNamesCacheFile,
      mcpAdapterJsonPath: locations.mcpAdapterJsonPath,
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
      baseConfigJsonPath: expectedLocations.baseConfigJsonPath,
      localConfigJsonPath: expectedLocations.localConfigJsonPath,
      dataRoot: expectedLocations.dataRoot,
      extensionRoot: expectedLocations.extensionRoot,
      hooksDir: expectedLocations.hooksDir,
      marketplaceNamesCacheFile: expectedLocations.marketplaceNamesCacheFile,
      mcpAdapterJsonPath: expectedLocations.mcpAdapterJsonPath,
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

// WR-01: the `partition?: never` refusal keeps the update / reinstall outcome
// shapes out of `enableRowDependencies`. Those shapes spell the same facts as
// `declaresAgents` / `declaresMcp` / `declaresWorkflows`, so without the refusal
// they match the all-optional signal shape structurally and silently return an
// empty array for every update. This pin fails to compile the day the refusal is
// dropped.
// @ts-expect-error a partition-discriminated outcome is refused by the signal shape
void enableRowDependencies({ partition: "updated", stagedWorkflows: true });

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

  test("WDEP-02: returns the workflows dependency when the ledger staged a workflow", () => {
    // arrange
    const signals = { stagedWorkflows: true } as const;

    // act
    const dependencies = enableRowDependencies(signals);

    // assert
    assert.deepStrictEqual(dependencies, ["workflows"]);
  });

  test("WDEP-02: returns workflows LAST when all three companion kinds were staged", () => {
    // arrange
    const signals = { stagedAgents: true, stagedMcpServers: true, stagedWorkflows: true } as const;

    // act
    const dependencies = enableRowDependencies(signals);

    // assert
    assert.deepStrictEqual(dependencies, ["agents", "mcp", "workflows"]);
  });

  test("WDEP-02: a ledger that staged no workflow declares no host-engine dependency", () => {
    // arrange
    const signals = { stagedAgents: true, stagedWorkflows: false } as const;

    // act
    const dependencies = enableRowDependencies(signals);

    // assert
    assert.deepStrictEqual(dependencies, ["agents"]);
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
  test("D-08-07: resolves a plugin named constructor to the scope that records it", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: { constructor: makePluginRecord({}) } });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "constructor",
      });

      // assert
      assert.equal(resolution.kind, "resolved");
      if (resolution.kind === "resolved") {
        assert.equal(resolution.scope, "user");
        assertLocationsEquivalent(resolution.locations, locationsFor("user", cwd));
      }
    });
  });

  test("D-08-07: reports an explicit miss when the other container records no plugin named toString", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "mp",
        plugin: "toString",
        explicitScope: "user",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent", requestedScope: "user" });
    });
  });

  test("D-08-07: reports a marketplace named constructor as absent from both scopes", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", {});
      await saveScopedState(cwd, "user", {});

      // act
      const resolution = await resolveCrossScopePluginTarget({
        cwd,
        marketplace: "constructor",
        plugin: "alpha",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent" });
    });
  });

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

describe("collectInstallReachableMarketplaces", () => {
  test("D-03-08 a project-target install reaches both scopes' marketplaces", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "user", { "user-only": {}, shared: {} });
      const targetState: ExtensionState = {
        schemaVersion: 1,
        marketplaces: {
          "project-only": makeMarketplaceRecord("project-only", "project", {}),
          shared: makeMarketplaceRecord("shared", "project", {}),
        },
      };

      // act
      const reachable = await collectInstallReachableMarketplaces({
        targetScope: "project",
        cwd,
        targetState,
      });

      // assert: the union, deduplicated -- this is the set the CMP-3-aware
      // per-marketplace resolver can answer for, so it is the set the
      // dependency guard may admit.
      assert.deepStrictEqual([...reachable].sort(), ["project-only", "shared", "user-only"]);
    });
  });

  test("CMP-4 a user-target install reaches its own scope only", async () => {
    // arrange: the project scope records a marketplace the user scope does
    // not. CMP-3 is a project -> user fallback and has no reverse arm, so a
    // user-target install must not see it.
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { "project-only": {} });
      const targetState: ExtensionState = {
        schemaVersion: 1,
        marketplaces: { "user-only": makeMarketplaceRecord("user-only", "user", {}) },
      };

      // act
      const reachable = await collectInstallReachableMarketplaces({
        targetScope: "user",
        cwd,
        targetState,
      });

      // assert
      assert.deepStrictEqual([...reachable], ["user-only"]);
    });
  });
});

describe("loadTargetLayers", () => {
  test("targets the base layer without --local even when only the local layer declares the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const localConfig: ScopeConfig = {
        schemaVersion: 1,
        plugins: { "alpha@mp": { enabled: false } },
      };
      await writeConfig(locations.localConfigJsonPath, localConfig);

      // act
      const target = await loadTargetLayers({ locations, local: undefined });

      // assert
      assert.deepStrictEqual(target, {
        kind: "loaded",
        targetConfigPath: locations.baseConfigJsonPath,
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: localConfig,
      });
    });
  });

  test("targets the local layer with --local even when only the base layer declares the plugin", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const baseConfig: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp" } },
        plugins: { "alpha@mp": {} },
      };
      await writeConfig(locations.baseConfigJsonPath, baseConfig);

      // act
      const target = await loadTargetLayers({ locations, local: true });

      // assert
      assert.deepStrictEqual(target, {
        kind: "loaded",
        targetConfigPath: locations.localConfigJsonPath,
        targetIsLocal: true,
        current: { schemaVersion: 1 },
        other: baseConfig,
      });
    });
  });

  test("reads absent layers as layers that declare nothing", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);

      // act
      const target = await loadTargetLayers({ locations, local: false });

      // assert
      assert.deepStrictEqual(target, {
        kind: "loaded",
        targetConfigPath: locations.baseConfigJsonPath,
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
      });
    });
  });

  for (const { invalid, file, local, layer } of [
    { invalid: "local", file: "localConfigJsonPath", local: undefined, layer: "the other layer" },
    { invalid: "local", file: "localConfigJsonPath", local: true, layer: "the target layer" },
    { invalid: "base", file: "baseConfigJsonPath", local: false, layer: "the target layer" },
    { invalid: "base", file: "baseConfigJsonPath", local: true, layer: "the other layer" },
  ] satisfies readonly {
    invalid: string;
    file: "baseConfigJsonPath" | "localConfigJsonPath";
    local: boolean | undefined;
    layer: string;
  }[]) {
    test(`CFG-03: reports an invalid ${invalid} layer that is ${layer} (local ${local})`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        const invalidPath = locations[file];
        await mkdir(path.dirname(invalidPath), { recursive: true });
        await writeFile(invalidPath, "{");

        // act
        const target = await loadTargetLayers({ locations, local });

        // assert
        assert.deepStrictEqual(target, { kind: "unreadable", filePath: invalidPath });
      });
    });
  }

  test("CFG-03: names the target layer first when both layers are invalid", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.baseConfigJsonPath), { recursive: true });
      await writeFile(locations.baseConfigJsonPath, "{");
      await writeFile(locations.localConfigJsonPath, "{");

      // act
      const target = await loadTargetLayers({ locations, local: true });

      // assert
      assert.deepStrictEqual(target, {
        kind: "unreadable",
        filePath: locations.localConfigJsonPath,
      });
    });
  });
});

describe("undeclarableMarketplaceRefusal", () => {
  for (const { targetIsLocal, layer } of [
    { targetIsLocal: true, layer: "local" },
    { targetIsLocal: false, layer: "base" },
  ] as const) {
    test(`refuses a ${layer}-layer target when no layer declares the marketplace and its record holds no string source`, () => {
      // arrange
      const selection = {
        targetIsLocal,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1, marketplaces: { other: { source: "./other-src" } } },
      } satisfies Parameters<typeof undeclarableMarketplaceRefusal>[0];

      // act
      const refusal = undeclarableMarketplaceRefusal(selection, unknownSourceState(), "mp");

      // assert
      assert.ok(refusal instanceof MarketplaceSourceUndeclarableError);
      assert.deepStrictEqual(
        { marketplace: refusal.marketplace, layer: refusal.layer },
        { marketplace: "mp", layer },
      );
    });
  }

  for (const { layout, state, selection } of [
    {
      layout: "a marketplace the target layer declares",
      state: unknownSourceState(),
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
        other: { schemaVersion: 1 },
      },
    },
    {
      layout: "a marketplace only the other layer declares",
      state: unknownSourceState(),
      selection: {
        targetIsLocal: true,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
      },
    },
    {
      layout: "a marketplace whose record holds a string source",
      state: makeState({ mp: { scope: "project", plugins: {} } }),
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
      },
    },
    {
      layout: "a marketplace the scope does not record yet",
      state: makeState({}),
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
      },
    },
  ] satisfies readonly {
    layout: string;
    state: ExtensionState;
    selection: Parameters<typeof undeclarableMarketplaceRefusal>[0];
  }[]) {
    test(`does not refuse ${layout}`, () => {
      // arrange
      const expectedRefusal = undefined;

      // act
      const refusal = undeclarableMarketplaceRefusal(selection, state, "mp");

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }
});

describe("localOnlyMarketplaceRefusal", () => {
  test("refuses a base-config target when only the local config declares the marketplace", () => {
    // arrange
    const selection = {
      targetIsLocal: false,
      current: { schemaVersion: 1 },
      other: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
    } satisfies Parameters<typeof localOnlyMarketplaceRefusal>[0];

    // act
    const refusal = localOnlyMarketplaceRefusal(selection, "mp");

    // assert
    assert.ok(refusal instanceof MarketplaceInLocalLayerOnlyError);
    assert.deepStrictEqual(
      { marketplace: refusal.marketplace, message: refusal.message },
      {
        marketplace: "mp",
        message:
          "The marketplace mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
      },
    );
  });

  for (const { layout, marketplace, selection } of [
    {
      layout: "a local-config target",
      marketplace: "mp",
      selection: {
        targetIsLocal: true,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
        other: { schemaVersion: 1 },
      },
    },
    {
      layout: "a marketplace both files declare",
      marketplace: "mp",
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
        other: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
      },
    },
    {
      layout: "a marketplace only the base config declares",
      marketplace: "mp",
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./mp-src" } } },
        other: { schemaVersion: 1 },
      },
    },
    {
      layout: "a marketplace neither file declares",
      marketplace: "mp",
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1, marketplaces: { other: { source: "./other-src" } } },
      },
    },
    {
      layout: "a prototype-named marketplace neither file owns",
      marketplace: "constructor",
      selection: {
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1, marketplaces: {} },
      },
    },
  ] satisfies readonly {
    layout: string;
    marketplace: string;
    selection: Parameters<typeof localOnlyMarketplaceRefusal>[0];
  }[]) {
    test(`does not refuse ${layout}`, () => {
      // arrange
      const expectedRefusal = undefined;

      // act
      const refusal = localOnlyMarketplaceRefusal(selection, marketplace);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }
});

describe("pluginLayerVerdict", () => {
  for (const { layout, target, other, kind } of [
    {
      layout: "only the target layer declares the plugin",
      target: { schemaVersion: 1, plugins: { "demo@mp": {} } },
      other: { schemaVersion: 1 },
      kind: "target-only",
    },
    {
      layout: "both layers declare the plugin",
      target: { schemaVersion: 1, plugins: { "demo@mp": {} } },
      other: { schemaVersion: 1, plugins: { "demo@mp": { enabled: false } } },
      kind: "both",
    },
    {
      layout: "neither layer declares the plugin",
      target: { schemaVersion: 1, plugins: { "other@mp": {} } },
      other: { schemaVersion: 1, plugins: { "demo@other-mp": {} } },
      kind: "neither",
    },
  ] satisfies readonly {
    layout: string;
    target: ScopeConfig;
    other: ScopeConfig;
    kind: "target-only" | "both" | "neither";
  }[]) {
    test(`answers ${kind} when ${layout}`, () => {
      // arrange
      const expectedVerdict = { kind };

      // act
      const verdict = pluginLayerVerdict({
        target,
        other,
        targetIsLocal: false,
        marketplace: "mp",
        plugin: "demo",
      });

      // assert
      assert.deepStrictEqual(verdict, expectedVerdict);
    });
  }

  test("refuses as plugin in local layer only when only the local layer declares a base-layer target", () => {
    // arrange
    const target: ScopeConfig = { schemaVersion: 1 };
    const other: ScopeConfig = { schemaVersion: 1, plugins: { "demo@mp": {} } };

    // act
    const verdict = pluginLayerVerdict({
      target,
      other,
      targetIsLocal: false,
      marketplace: "mp",
      plugin: "demo",
    });

    // assert
    assert.ok(verdict.kind === "other-only");
    assert.ok(verdict.refusal instanceof PluginInLocalLayerOnlyError);
    assert.deepStrictEqual(
      {
        kind: verdict.kind,
        reason: verdict.reason,
        plugin: verdict.refusal.plugin,
        marketplace: verdict.refusal.marketplace,
        message: verdict.refusal.message,
      },
      {
        kind: "other-only",
        reason: "plugin in local layer only",
        plugin: "demo",
        marketplace: "mp",
        message:
          "The plugin demo@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
      },
    );
  });

  test("refuses as plugin in base layer only when only the base layer declares a local-layer target", () => {
    // arrange
    const target: ScopeConfig = { schemaVersion: 1, plugins: {} };
    const other: ScopeConfig = { schemaVersion: 1, plugins: { "demo@mp": { enabled: true } } };

    // act
    const verdict = pluginLayerVerdict({
      target,
      other,
      targetIsLocal: true,
      marketplace: "mp",
      plugin: "demo",
    });

    // assert
    assert.ok(verdict.kind === "other-only");
    assert.ok(verdict.refusal instanceof PluginInBaseLayerOnlyError);
    assert.deepStrictEqual(
      {
        kind: verdict.kind,
        reason: verdict.reason,
        plugin: verdict.refusal.plugin,
        marketplace: verdict.refusal.marketplace,
        message: verdict.refusal.message,
      },
      {
        kind: "other-only",
        reason: "plugin in base layer only",
        plugin: "demo",
        marketplace: "mp",
        message:
          "The plugin demo@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
      },
    );
  });

  test("does not count a plugin key the other layer holds only through its prototype", () => {
    // arrange
    const inherited: ScopeConfig["plugins"] = Object.create({ "demo@mp": {} }) as Record<
      string,
      { enabled?: boolean }
    >;
    const target: ScopeConfig = { schemaVersion: 1 };
    const other: ScopeConfig = { schemaVersion: 1, plugins: inherited };

    // act
    const verdict = pluginLayerVerdict({
      target,
      other,
      targetIsLocal: false,
      marketplace: "mp",
      plugin: "demo",
    });

    // assert
    assert.deepStrictEqual(verdict, { kind: "neither" });
  });
});

describe("namedPluginLayerRefusal", () => {
  for (const { layout, local, baseConfig, localConfig } of [
    {
      layout: "the target layer declares the plugin",
      local: false,
      baseConfig: '{"schemaVersion":1,"plugins":{"demo@mp":{}}}',
      localConfig: undefined,
    },
    {
      layout: "both layers declare the plugin",
      local: true,
      baseConfig: '{"schemaVersion":1,"plugins":{"demo@mp":{}}}',
      localConfig: '{"schemaVersion":1,"plugins":{"demo@mp":{"enabled":false}}}',
    },
    {
      layout: "no layer declares the plugin",
      local: true,
      baseConfig: undefined,
      localConfig: undefined,
    },
  ] satisfies readonly {
    layout: string;
    local: boolean;
    baseConfig: string | undefined;
    localConfig: string | undefined;
  }[]) {
    test(`LAYER-04: does not refuse when ${layout} (local ${local})`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        await mkdir(path.dirname(locations.baseConfigJsonPath), { recursive: true });
        await writeOptionalFile(locations.baseConfigJsonPath, baseConfig);
        await writeOptionalFile(locations.localConfigJsonPath, localConfig);

        // act
        const refusal = await namedPluginLayerRefusal({
          locations,
          local,
          marketplace: "mp",
          plugin: "demo",
        });

        // assert
        assert.equal(refusal, undefined);
      });
    });
  }

  test("LAYER-04: refuses as plugin in local layer only a base-layer target only the local layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "demo@mp": {} },
      });

      // act
      const refusal = await namedPluginLayerRefusal({
        locations,
        local: false,
        marketplace: "mp",
        plugin: "demo",
      });

      // assert
      assert.ok(refusal instanceof PluginInLocalLayerOnlyError);
      assert.deepStrictEqual(
        { plugin: refusal.plugin, marketplace: refusal.marketplace, message: refusal.message },
        {
          plugin: "demo",
          marketplace: "mp",
          message:
            "The plugin demo@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
        },
      );
    });
  });

  test("LAYER-04: refuses as plugin in base layer only a local-layer target only the base layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.baseConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "demo@mp": {} },
      });

      // act
      const refusal = await namedPluginLayerRefusal({
        locations,
        local: true,
        marketplace: "mp",
        plugin: "demo",
      });

      // assert
      assert.ok(refusal instanceof PluginInBaseLayerOnlyError);
      assert.deepStrictEqual(
        { plugin: refusal.plugin, marketplace: refusal.marketplace, message: refusal.message },
        {
          plugin: "demo",
          marketplace: "mp",
          message:
            "The plugin demo@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
        },
      );
    });
  });

  for (const { file, basename, local, layer } of [
    {
      file: "baseConfigJsonPath",
      basename: "claude-plugins.json",
      local: false,
      layer: "the target layer",
    },
    {
      file: "localConfigJsonPath",
      basename: "claude-plugins.local.json",
      local: false,
      layer: "the other layer",
    },
    {
      file: "localConfigJsonPath",
      basename: "claude-plugins.local.json",
      local: true,
      layer: "the target layer",
    },
    {
      file: "baseConfigJsonPath",
      basename: "claude-plugins.json",
      local: true,
      layer: "the other layer",
    },
  ] satisfies readonly {
    file: "baseConfigJsonPath" | "localConfigJsonPath";
    basename: string;
    local: boolean;
    layer: string;
  }[]) {
    test(`CFG-03: an unreadable ${basename} that is ${layer} (local ${local}) is an invalid manifest naming it`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        await mkdir(path.dirname(locations[file]), { recursive: true });
        await writeFile(locations[file], "{");

        // act
        const refusal = await namedPluginLayerRefusal({
          locations,
          local,
          marketplace: "mp",
          plugin: "demo",
        });

        // assert
        assert.ok(refusal instanceof LayerConfigUnreadableError);
        assert.deepStrictEqual(
          { basename: refusal.basename, message: refusal.message },
          { basename, message: `Config file "${basename}" failed schema validation.` },
        );
      });
    });
  }
});

describe("keepLocalLayerTargets", () => {
  test("LAYER-04: keeps, in order, the targets whose key the scope's local layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "alpha@mp": {}, "gamma@mp": {} },
      });
      const targets = [
        { plugin: "gamma", marketplace: "mp", scope: "project" },
        { plugin: "beta", marketplace: "mp", scope: "project" },
        { plugin: "alpha", marketplace: "mp", scope: "project" },
      ] as const;

      // act
      const kept = await keepLocalLayerTargets(targets, cwd);

      // assert
      assert.deepStrictEqual(kept, [
        { plugin: "gamma", marketplace: "mp", scope: "project" },
        { plugin: "alpha", marketplace: "mp", scope: "project" },
      ]);
    });
  });

  test("LAYER-04: keeps no target when the local layer is absent", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await writeConfig(locationsFor("project", cwd).baseConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "alpha@mp": {} },
      });

      // act
      const kept = await keepLocalLayerTargets(
        [{ plugin: "alpha", marketplace: "mp", scope: "project" }],
        cwd,
      );

      // assert
      assert.deepStrictEqual(kept, []);
    });
  });

  test("LAYER-04: reads each scope's own local layer", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await writeConfig(locationsFor("project", cwd).localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "alpha@mp": {} },
      });
      await writeConfig(locationsFor("user", cwd).localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "beta@mp": {} },
      });
      const targets = [
        { plugin: "alpha", marketplace: "mp", scope: "project" },
        { plugin: "alpha", marketplace: "mp", scope: "user" },
        { plugin: "beta", marketplace: "mp", scope: "project" },
        { plugin: "beta", marketplace: "mp", scope: "user" },
      ] as const;

      // act
      const kept = await keepLocalLayerTargets(targets, cwd);

      // assert
      assert.deepStrictEqual(kept, [
        { plugin: "alpha", marketplace: "mp", scope: "project" },
        { plugin: "beta", marketplace: "mp", scope: "user" },
      ]);
    });
  });

  test("CFG-03: an unreadable local layer is an invalid manifest naming claude-plugins.local.json", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.localConfigJsonPath), { recursive: true });
      await writeFile(locations.localConfigJsonPath, "{");

      // act & assert
      await assert.rejects(
        keepLocalLayerTargets([{ plugin: "alpha", marketplace: "mp", scope: "project" }], cwd),
        (error: unknown) => {
          assert.ok(error instanceof LayerConfigUnreadableError);
          assert.deepStrictEqual(
            { basename: error.basename, message: error.message },
            {
              basename: "claude-plugins.local.json",
              message: 'Config file "claude-plugins.local.json" failed schema validation.',
            },
          );
          return true;
        },
      );
    });
  });

  test("LAYER-04: a plugins entry named __proto__ declares nothing it holds", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.localConfigJsonPath), { recursive: true });
      await writeFile(
        locations.localConfigJsonPath,
        '{"schemaVersion":1,"plugins":{"__proto__":{"alpha@mp":{}}}}',
      );

      // act
      const kept = await keepLocalLayerTargets(
        [{ plugin: "alpha", marketplace: "mp", scope: "project" }],
        cwd,
      );

      // assert
      assert.deepStrictEqual(kept, []);
    });
  });

  test("LAYER-04: keeps the dependencies the local layer's plugins need, through plugins no layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd, root }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "app@tools": {} },
      });
      await writeConfig(locations.baseConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "svc@tools": {} },
      });
      await saveToolsScope({
        cwd,
        root,
        records: {
          app: "explicit",
          lib: "dependency",
          base: "dependency",
          svc: "explicit",
          core: "dependency",
        },
        entries: { app: ["lib", "base"], lib: ["base"], base: [], svc: ["core", "lib"], core: [] },
      });
      const targets = [
        { plugin: "svc", marketplace: "tools", scope: "project" },
        { plugin: "core", marketplace: "tools", scope: "project" },
        { plugin: "base", marketplace: "tools", scope: "project" },
        { plugin: "lib", marketplace: "tools", scope: "project" },
        { plugin: "app", marketplace: "tools", scope: "project" },
      ] as const;

      // act
      const kept = await keepLocalLayerTargets(targets, cwd);

      // assert
      assert.deepStrictEqual(kept, [
        { plugin: "base", marketplace: "tools", scope: "project" },
        { plugin: "lib", marketplace: "tools", scope: "project" },
        { plugin: "app", marketplace: "tools", scope: "project" },
      ]);
    });
  });

  test("LAYER-04: keeps no dependency past a plugin the base layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd, root }) => {
      const locations = locationsFor("project", cwd);
      await writeConfig(locations.localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "app@tools": {} },
      });
      await writeConfig(locations.baseConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "kit@tools": {} },
      });
      await saveToolsScope({
        cwd,
        root,
        records: { app: "explicit", kit: "explicit", gear: "dependency" },
        entries: { app: ["kit"], kit: ["gear"], gear: [] },
      });
      const targets = [
        { plugin: "app", marketplace: "tools", scope: "project" },
        { plugin: "gear", marketplace: "tools", scope: "project" },
        { plugin: "kit", marketplace: "tools", scope: "project" },
      ] as const;

      // act
      const kept = await keepLocalLayerTargets(targets, cwd);

      // assert
      assert.deepStrictEqual(kept, [{ plugin: "app", marketplace: "tools", scope: "project" }]);
    });
  });

  test("LAYER-04: a local plugin whose dependencies cannot be read refuses the selection, naming it", async () => {
    // arrange
    await withTempScopes(async ({ cwd, root }) => {
      await writeConfig(locationsFor("project", cwd).localConfigJsonPath, {
        schemaVersion: 1,
        plugins: { "app@tools": {} },
      });
      await saveToolsScope({
        cwd,
        root,
        records: { app: "explicit", lib: "dependency" },
        entries: { lib: [] },
      });
      const targets = [
        { plugin: "app", marketplace: "tools", scope: "project" },
        { plugin: "lib", marketplace: "tools", scope: "project" },
      ] as const;

      // act & assert
      await assert.rejects(keepLocalLayerTargets(targets, cwd), (error: unknown) => {
        assert.ok(error instanceof DependencyDeclarationsUnreadableError);
        assert.deepStrictEqual(
          { declarer: error.declarer, message: error.message },
          {
            declarer: "app@tools",
            message:
              "cannot read the dependencies of app@tools: not declared by its marketplace, and its installed copy cannot be read",
          },
        );
        return true;
      });
    });
  });

  test("CFG-03: an unreadable base layer is an invalid manifest naming claude-plugins.json", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.baseConfigJsonPath), { recursive: true });
      await writeFile(locations.baseConfigJsonPath, "{");

      // act & assert
      await assert.rejects(
        keepLocalLayerTargets([{ plugin: "alpha", marketplace: "mp", scope: "project" }], cwd),
        (error: unknown) => {
          assert.ok(error instanceof LayerConfigUnreadableError);
          assert.deepStrictEqual(
            { basename: error.basename, message: error.message },
            {
              basename: "claude-plugins.json",
              message: 'Config file "claude-plugins.json" failed schema validation.',
            },
          );
          return true;
        },
      );
    });
  });
});

describe("writeAdoptingConfigEntries", () => {
  test("writes the adopted marketplace source and plugin declaration together", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const other: ScopeConfig = { schemaVersion: 1 };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        other,
        state,
        marketplace: "mp",
        plugin: "alpha",
        locations,
        targetIsLocal: false,
        pluginPatch: { enabled: false },
      });

      // assert
      assert.equal(
        await readFile(locations.baseConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {\n      "enabled": false\n    }\n  }\n}\n',
      );
      assert.deepStrictEqual(current, { schemaVersion: 1 });
      assert.deepStrictEqual(other, { schemaVersion: 1 });
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
      const other: ScopeConfig = { schemaVersion: 1 };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        other,
        state,
        marketplace: "mp",
        plugin: "alpha",
        locations,
        targetIsLocal: false,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.baseConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./declared",\n      "autoupdate": false\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  test("LAYER-06: declares the plugin's marketplace in the target layer even when only the other layer declares it", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const other: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./sibling", autoupdate: false } },
      };
      const state = makeState({ mp: { scope: "project", plugins: {} } });

      // act
      await writeAdoptingConfigEntries({
        current,
        other,
        state,
        marketplace: "mp",
        plugin: "alpha",
        locations,
        targetIsLocal: true,
        pluginPatch: { enabled: true },
      });

      // assert
      assert.equal(
        await readFile(locations.localConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {\n      "enabled": true\n    }\n  }\n}\n',
      );
    });
  });

  test("LAYER-06: declares a github marketplace with the raw source its record holds", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const other: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "acme/mp" } },
      };
      const record = makeMarketplaceRecord("mp", "project", {});
      const state: ExtensionState = {
        schemaVersion: 1,
        marketplaces: { mp: { ...record, source: githubSource("acme/mp") } },
      };

      // act
      await writeAdoptingConfigEntries({
        current,
        other,
        state,
        marketplace: "mp",
        plugin: "alpha",
        locations,
        targetIsLocal: true,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.localConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "acme/mp"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  test("LAYER-06: declares the marketplace with the other layer's source when the record holds no string source", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const current: ScopeConfig = { schemaVersion: 1 };
      const other: ScopeConfig = {
        schemaVersion: 1,
        marketplaces: { mp: { source: "./sibling" } },
      };

      // act
      await writeAdoptingConfigEntries({
        current,
        other,
        state: unknownSourceState(),
        marketplace: "mp",
        plugin: "alpha",
        locations,
        targetIsLocal: true,
        pluginPatch: {},
      });

      // assert
      assert.equal(
        await readFile(locations.localConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./sibling"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
      );
    });
  });

  for (const { targetIsLocal, layer } of [
    { targetIsLocal: false, layer: "base" },
    { targetIsLocal: true, layer: "local" },
  ] as const) {
    test(`LAYER-06: refuses a plugin declaration in the ${layer} layer whose marketplace no source can declare and writes nothing`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        const targetConfigPath = targetIsLocal
          ? locations.localConfigJsonPath
          : locations.baseConfigJsonPath;
        const current: ScopeConfig = { schemaVersion: 1 };
        const other: ScopeConfig = { schemaVersion: 1 };

        // act & assert
        await assert.rejects(
          writeAdoptingConfigEntries({
            current,
            other,
            state: unknownSourceState(),
            marketplace: "mp",
            plugin: "alpha",
            locations,
            targetIsLocal,
            pluginPatch: {},
          }),
          (error: unknown) => {
            assert.ok(error instanceof MarketplaceSourceUndeclarableError);
            assert.deepStrictEqual(
              { marketplace: error.marketplace, layer: error.layer },
              { marketplace: "mp", layer },
            );
            return true;
          },
        );
        await assert.rejects(readFile(targetConfigPath, "utf8"), { code: "ENOENT" });
      });
    });
  }

  for (const { behavior, current, other, addedMarketplaces, config } of [
    {
      behavior: "declares each added marketplace beside the root's in the one write",
      current: { schemaVersion: 1 },
      other: { schemaVersion: 1 },
      addedMarketplaces: ["tools"],
      config:
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp-source"\n    },\n    "tools": {\n      "source": "./tools-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
    },
    {
      behavior: "declares no added marketplace that either config file declares",
      current: { schemaVersion: 1, marketplaces: { tools: { source: "./declared" } } },
      other: { schemaVersion: 1, marketplaces: { extra: { source: "./sibling" } } },
      addedMarketplaces: ["tools", "extra"],
      config:
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "tools": {\n      "source": "./declared"\n    },\n    "mp": {\n      "source": "./mp-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
    },
    {
      behavior: "declares the root's marketplace once when it is also an added one",
      current: { schemaVersion: 1 },
      other: { schemaVersion: 1 },
      addedMarketplaces: ["mp"],
      config:
        '{\n  "schemaVersion": 1,\n  "marketplaces": {\n    "mp": {\n      "source": "./mp-source"\n    }\n  },\n  "plugins": {\n    "alpha@mp": {}\n  }\n}\n',
    },
  ] satisfies readonly {
    behavior: string;
    current: ScopeConfig;
    other: ScopeConfig;
    addedMarketplaces: readonly string[];
    config: string;
  }[]) {
    test(`LAYER-07 / UAT-05: ${behavior}`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        const state = makeState({
          mp: { scope: "project", plugins: {} },
          tools: { scope: "project", plugins: {} },
          extra: { scope: "project", plugins: {} },
        });

        // act
        await writeAdoptingConfigEntries({
          current,
          other,
          state,
          marketplace: "mp",
          plugin: "alpha",
          locations,
          targetIsLocal: false,
          pluginPatch: {},
          addedMarketplaces,
        });

        // assert
        assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), config);
      });
    });
  }
});

describe("overwriteDisabledMemberEntries", () => {
  const disabledB = '{"schemaVersion":1,"plugins":{"b@mp":{"enabled":false}}}';
  const enabledB =
    '{\n  "schemaVersion": 1,\n  "plugins": {\n    "b@mp": {\n      "enabled": true\n    }\n  }\n}\n';

  for (const { layout, base, local, expectedBase, expectedLocal } of [
    {
      layout: "the base layer",
      base: disabledB,
      local: undefined,
      expectedBase: enabledB,
      expectedLocal: undefined,
    },
    {
      layout: "the local layer",
      base: undefined,
      local: disabledB,
      expectedBase: undefined,
      expectedLocal: enabledB,
    },
    {
      layout: "both layers",
      base: disabledB,
      local: disabledB,
      expectedBase: enabledB,
      expectedLocal: enabledB,
    },
    {
      layout: "the base layer beside an invalid local layer",
      base: disabledB,
      local: "{",
      expectedBase: enabledB,
      expectedLocal: "{",
    },
  ] satisfies readonly {
    layout: string;
    base: string | undefined;
    local: string | undefined;
    expectedBase: string | undefined;
    expectedLocal: string | undefined;
  }[]) {
    test(`CR-06: overwrites a member disabled in ${layout} where it is disabled`, async () => {
      // arrange
      await withTempScopes(async ({ cwd }) => {
        const locations = locationsFor("project", cwd);
        await mkdir(locations.scopeRoot, { recursive: true });
        await writeOptionalFile(locations.baseConfigJsonPath, base);
        await writeOptionalFile(locations.localConfigJsonPath, local);

        // act
        await overwriteDisabledMemberEntries({
          locations,
          keys: ["b@mp"],
        });

        // assert
        assert.deepStrictEqual(
          {
            base: await readOptionalFile(locations.baseConfigJsonPath),
            local: await readOptionalFile(locations.localConfigJsonPath),
          },
          { base: expectedBase, local: expectedLocal },
        );
      });
    });
  }

  test("D-04-02: creates no file for a member no layer declares", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);

      // act
      await overwriteDisabledMemberEntries({
        locations,
        keys: ["b@mp"],
      });

      // assert
      assert.deepStrictEqual(
        {
          base: await readOptionalFile(locations.baseConfigJsonPath),
          local: await readOptionalFile(locations.localConfigJsonPath),
        },
        { base: undefined, local: undefined },
      );
    });
  });

  test("leaves a key whose entry is already enabled untouched", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      const seeded = '{"schemaVersion":1,"plugins":{"b@mp":{"enabled":true}}}';
      await mkdir(locations.scopeRoot, { recursive: true });
      await writeFile(locations.localConfigJsonPath, seeded);

      // act
      await overwriteDisabledMemberEntries({
        locations,
        keys: ["b@mp"],
      });

      // assert
      assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), seeded);
    });
  });

  test("processes every key in the list", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.scopeRoot, { recursive: true });
      await writeFile(
        locations.baseConfigJsonPath,
        '{"schemaVersion":1,"plugins":{"b@mp":{"enabled":false},"c@mp":{"enabled":false}}}',
      );

      // act
      await overwriteDisabledMemberEntries({
        locations,
        keys: ["b@mp", "c@mp"],
      });

      // assert
      assert.strictEqual(
        await readFile(locations.baseConfigJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "plugins": {\n    "b@mp": {\n      "enabled": true\n    },\n    "c@mp": {\n      "enabled": true\n    }\n  }\n}\n',
      );
    });
  });
});

describe("resolveInstalledPluginTarget", () => {
  test("D-08-07: finds no installed plugin named toString or __proto__ in either scope", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", { mp: {} });
      await saveScopedState(cwd, "user", { mp: {} });

      // act
      const targets = await Promise.all(
        ["toString", "__proto__"].map((plugin) =>
          resolveInstalledPluginTarget({ cwd, marketplace: "mp", plugin }),
        ),
      );

      // assert
      assert.deepStrictEqual(targets, [undefined, undefined]);
    });
  });

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
  test("D-08-07: reports a marketplace named constructor as absent with no record anywhere", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      // act
      const resolution = await resolveInstalledMarketplaceTarget({
        cwd,
        marketplace: "constructor",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent" });
    });
  });

  test("D-08-07: reports an explicit miss for a marketplace named __proto__", async () => {
    // arrange
    await withTempScopes(async ({ cwd }) => {
      await saveScopedState(cwd, "project", {});
      await saveScopedState(cwd, "user", {});

      // act
      const resolution = await resolveInstalledMarketplaceTarget({
        cwd,
        marketplace: "__proto__",
        explicitScope: "user",
      });

      // assert
      assert.deepStrictEqual(resolution, { kind: "marketplace-absent", requestedScope: "user" });
    });
  });

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
  test("VER-01: a git commit names the version when none is declared", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{}");
      const entry = { name: "alpha", source: "./alpha" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(
        entry,
        installable,
        { marketplaceName: "mp", marketplaceRoot: root },
        "0123456789abcdef0123456789abcdef01234567",
      );

      // assert
      assert.equal(version, "0123456789ab");
    });
  });

  test("VER-01: a declared version wins over a git commit", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(
        entry,
        installable,
        { marketplaceName: "mp", marketplaceRoot: root },
        "0123456789abcdef0123456789abcdef01234567",
      );

      // assert
      assert.equal(version, "1.0.0");
    });
  });

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
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

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
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

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
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  for (const { label, manifest } of [
    { label: "declares no version", manifest: "{}" },
    { label: "is null", manifest: "null" },
    { label: "is a bare string", manifest: '"2.0.0"' },
  ]) {
    test(`uses the marketplace entry when the manifest ${label}`, async () => {
      // arrange
      await withTempScopes(async ({ root }) => {
        const pluginRoot = path.join(root, "alpha");
        await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
        await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), manifest);
        const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
        const installable = makeMaterializablePlugin(pluginRoot);

        // act
        const version = await resolvePluginVersion(entry, installable, {
          marketplaceName: "mp",
          marketplaceRoot: root,
        });

        // assert
        assert.equal(version, "1.0.0");
      });
    });
  }

  test("uses the marketplace entry when the manifest cannot be parsed", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{");
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  test("uses the entry version when a symlink loop prevents probing the wrapped manifest", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      const wrapper = path.join(pluginRoot, ".claude-plugin");
      await mkdir(pluginRoot, { recursive: true });
      await symlink(wrapper, wrapper, "junction");
      await writeFile(path.join(pluginRoot, "plugin.json"), '{"version":"9.9.9"}');
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.strictEqual(version, "1.0.0");
    });
  });

  test("uses the bare manifest version when the wrapper is a regular file", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin"), "not a directory");
      await writeFile(path.join(pluginRoot, "plugin.json"), '{"version":"9.9.9"}');
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.strictEqual(version, "9.9.9");
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
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "hash-e3b0c44298fc");
    });
  });

  test("MANF-01 reads tier 1 from a manifest at the bare plugin.json path", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      await writeFile(path.join(pluginRoot, "plugin.json"), JSON.stringify({ version: "2.0.0" }));
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "2.0.0");
    });
  });

  test("MANF-02 prefers the wrapped manifest version over a bare sibling", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ version: "2.0.0" }),
      );
      await writeFile(path.join(pluginRoot, "plugin.json"), JSON.stringify({ version: "9.9.9" }));
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "2.0.0");
    });
  });

  // D-01-07: the walk falls through on ABSENCE ONLY, so an unparseable wrapped
  // manifest drops to tier 2 rather than to its readable bare sibling.
  test("D-01-07 falls to the marketplace entry when the wrapped manifest is unparseable", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{");
      await writeFile(path.join(pluginRoot, "plugin.json"), JSON.stringify({ version: "9.9.9" }));
      const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(entry, installable, {
        marketplaceName: "mp",
        marketplaceRoot: root,
      });

      // assert
      assert.equal(version, "1.0.0");
    });
  });

  test("GV-01: a git-subdir commit names the version with its path hash", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      const entry = {
        name: "alpha",
        source: { source: "git-subdir", url: "https://h/acme/mono.git", path: "plugins/subp" },
      } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(
        entry,
        installable,
        { marketplaceName: "mp", marketplaceRoot: root },
        "0123456789abcdef0123456789abcdef01234567",
      );

      // assert
      assert.equal(version, "0123456789ab-3989e95a");
    });
  });

  test("GV-01: a pinned plugin of the plugin directory records its pin", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      const sha = "0123456789abcdef0123456789abcdef01234567";
      const entry = {
        name: "alpha",
        source: { source: "github", repo: "acme/alpha", sha },
        version: "1.0.0",
      } satisfies PluginEntry;
      const installable = makeMaterializablePlugin(pluginRoot);

      // act
      const version = await resolvePluginVersion(
        entry,
        installable,
        { marketplaceName: "anthropic-plugin-directory", marketplaceRoot: root },
        sha,
      );

      // assert
      assert.equal(version, "1.0.0-0123456789ab");
    });
  });
});

/** A marketplace holding the plugin `alpha` with its wrapper directory, and a root outside it. */
async function plantLinkedAlpha(t: TestContext): Promise<{
  readonly marketplaceRoot: string;
  readonly pluginRoot: string;
  readonly wrapped: string;
  readonly outside: string;
}> {
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "linked-version-mp-"));
  const outside = await mkdtemp(path.join(tmpdir(), "linked-version-outside-"));
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const pluginRoot = path.join(marketplaceRoot, "alpha");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  return {
    marketplaceRoot,
    pluginRoot,
    wrapped: path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    outside,
  };
}

describe("readDeclaredPluginVersion", () => {
  test("D-PL2-24: reads the version of a manifest linked inside the plugin", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await writeFile(path.join(tree.pluginRoot, "manifest.json"), '{"version":"3.0.0"}');
    await symlink(path.join(tree.pluginRoot, "manifest.json"), tree.wrapped);

    // act
    const version = await readDeclaredPluginVersion(copyManifestBoundary(tree.pluginRoot));

    // assert
    assert.strictEqual(version, "3.0.0");
  });

  test("D-PL2-24: declares no version for a manifest linked outside the boundary", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await writeFile(path.join(tree.outside, "plugin.json"), '{"version":"3.0.0"}');
    await symlink(path.join(tree.outside, "plugin.json"), tree.wrapped);
    await writeFile(path.join(tree.pluginRoot, "plugin.json"), '{"version":"9.9.9"}');
    const logged = captureDebugLog(t);

    // act
    const version = await readDeclaredPluginVersion(
      inPlaceManifestBoundary(tree.pluginRoot, tree.marketplaceRoot),
    );

    // assert
    assert.strictEqual(version, undefined);
    assert.deepStrictEqual(logged, [
      "[hooks] resolvePluginVersion: plugin manifest not confirmed inside the plugin directory and its marketplace directory",
    ]);
  });

  test("D-PL2-24: declares no version for a manifest link loop", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await symlink(tree.wrapped, tree.wrapped);
    await writeFile(path.join(tree.pluginRoot, "plugin.json"), '{"version":"9.9.9"}');

    // act
    const version = await readDeclaredPluginVersion(copyManifestBoundary(tree.pluginRoot));

    // assert
    assert.strictEqual(version, undefined);
  });

  test("D-01-06: reads the bare manifest past a dangling wrapped link", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await symlink(path.join(tree.pluginRoot, "missing.json"), tree.wrapped);
    await writeFile(path.join(tree.pluginRoot, "plugin.json"), '{"version":"9.9.9"}');

    // act
    const version = await readDeclaredPluginVersion(copyManifestBoundary(tree.pluginRoot));

    // assert
    assert.strictEqual(version, "9.9.9");
  });
});

describe("resolvePluginVersion boundaries", () => {
  test("D-PL2-17: a path source reads a manifest linked into its marketplace directory", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await writeFile(path.join(tree.marketplaceRoot, "shared.json"), '{"version":"3.0.0"}');
    await symlink(path.join(tree.marketplaceRoot, "shared.json"), tree.wrapped);
    const entry = { name: "alpha", source: "./alpha", version: "1.0.0" } satisfies PluginEntry;

    // act
    const version = await resolvePluginVersion(entry, makeMaterializablePlugin(tree.pluginRoot), {
      marketplaceName: "mp",
      marketplaceRoot: tree.marketplaceRoot,
    });

    // assert
    assert.strictEqual(version, "3.0.0");
  });

  test("D-PL2-17: a git source refuses that link and falls to its commit", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await writeFile(path.join(tree.marketplaceRoot, "shared.json"), '{"version":"3.0.0"}');
    await symlink(path.join(tree.marketplaceRoot, "shared.json"), tree.wrapped);
    const entry = {
      name: "alpha",
      source: { source: "github", repo: "acme/alpha" },
    } satisfies PluginEntry;

    // act
    const version = await resolvePluginVersion(
      entry,
      makeMaterializablePlugin(tree.pluginRoot),
      { marketplaceName: "mp", marketplaceRoot: tree.marketplaceRoot },
      "0123456789abcdef0123456789abcdef01234567",
    );

    // assert
    assert.strictEqual(version, "0123456789ab");
  });

  test("D-PL2-17: a git source refuses that link and falls to its entry version first", async (t) => {
    // arrange
    const tree = await plantLinkedAlpha(t);
    await writeFile(path.join(tree.marketplaceRoot, "shared.json"), '{"version":"3.0.0"}');
    await symlink(path.join(tree.marketplaceRoot, "shared.json"), tree.wrapped);
    const entry = {
      name: "alpha",
      source: { source: "github", repo: "acme/alpha" },
      version: "1.0.0",
    } satisfies PluginEntry;

    // act
    const version = await resolvePluginVersion(
      entry,
      makeMaterializablePlugin(tree.pluginRoot),
      { marketplaceName: "mp", marketplaceRoot: tree.marketplaceRoot },
      "0123456789abcdef0123456789abcdef01234567",
    );

    // assert
    assert.strictEqual(version, "1.0.0");
  });
});

describe("resolveTagPinnedPluginVersion", () => {
  const tagCommit = "0123456789abcdef0123456789abcdef01234567";

  test("GV-01: a declared version carries the tag commit", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(pluginRoot, { recursive: true });
      const entry = {
        name: "alpha",
        source: { source: "url", url: "https://example.com/alpha.git" },
        version: "2.0.0",
      } satisfies PluginEntry;

      // act
      const version = await resolveTagPinnedPluginVersion(
        entry,
        makeMaterializablePlugin(pluginRoot),
        "mp",
        tagCommit,
      );

      // assert
      assert.equal(version, "2.0.0-0123456789ab");
    });
  });

  test("GV-01: with no declared version, a path source records the tag commit and its path hash", async () => {
    // arrange
    await withTempScopes(async ({ root }) => {
      const pluginRoot = path.join(root, "alpha");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "{}");
      const entry = { name: "alpha", source: "./plugins/subp" } satisfies PluginEntry;

      // act
      const version = await resolveTagPinnedPluginVersion(
        entry,
        makeMaterializablePlugin(pluginRoot),
        "mp",
        tagCommit,
      );

      // assert
      assert.equal(version, "0123456789ab-3989e95a");
    });
  });
});

describe("isSameRevision", () => {
  const cases: readonly {
    readonly title: string;
    readonly recordVersion?: string;
    readonly recordSha?: string;
    readonly recordResolvedVersion?: string;
    readonly toVersion: string;
    readonly resolvedSha?: string;
    readonly resolvedVersion?: string;
    readonly searched?: boolean;
    readonly expected: boolean;
  }[] = [
    {
      title: "D-16-09: the same version with no sha on either side is the same revision",
      toVersion: "1.2.3",
      expected: true,
    },
    {
      title: "D-16-09: a different version is a new revision",
      toVersion: "1.3.0",
      expected: false,
    },
    {
      title: "D-16-09: the same version at a moved commit is a new revision",
      recordSha: "a".repeat(40),
      toVersion: "1.2.3",
      resolvedSha: "b".repeat(40),
      expected: false,
    },
    {
      title: "GV-02: a legacy sha- version at the same commit is the same revision",
      recordVersion: "sha-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      toVersion: "aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      expected: true,
    },
    {
      title: "D-16-09: a sha on one side only is a new revision",
      toVersion: "1.2.3",
      resolvedSha: "b".repeat(40),
      expected: false,
    },
    {
      title:
        "GV-01: with no tag search, a record at a release tag is the unpinned candidate of the same commit",
      recordVersion: "1.2.3-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "1.2.3",
      resolvedSha: "a".repeat(40),
      expected: true,
    },
    {
      title:
        "GV-01: after a tag search that selected none, a record at a release tag is a new revision at the same commit",
      recordVersion: "1.2.3-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "1.2.3",
      resolvedSha: "a".repeat(40),
      searched: true,
      expected: false,
    },
    {
      title:
        "GV-01: after a tag search that selected none, the version without the tag's commit is the same revision",
      recordVersion: "1.2.3",
      recordSha: "a".repeat(40),
      toVersion: "1.2.3",
      resolvedSha: "a".repeat(40),
      searched: true,
      expected: true,
    },
    {
      title:
        "GV-01: after a tag search that selected none, a commit version recorded at a tag is the same revision",
      recordVersion: "aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      searched: true,
      expected: true,
    },
    {
      title:
        "GV-02: after a tag search, a legacy sha- version at the same commit is the same revision",
      recordVersion: "sha-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      toVersion: "aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      searched: true,
      expected: true,
    },
    {
      title: "GV-01: at a release tag, the same tag version and commit are the same revision",
      recordVersion: "1.2.3-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "1.2.3-aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      resolvedVersion: "1.2.3",
      expected: true,
    },
    {
      title:
        "GV-02: at a release tag, a record holding the tag's semver as its version is the same revision",
      recordVersion: "1.2.3",
      recordSha: "a".repeat(40),
      toVersion: "1.2.3-aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      resolvedVersion: "1.2.3",
      expected: true,
    },
    {
      title: "GV-01: at a release tag, another tag version at the same commit is a new revision",
      recordVersion: "1.2.3-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "1.2.3-aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      resolvedVersion: "1.2.4",
      expected: false,
    },
    {
      title: "GV-01: at a release tag, another commit is a new revision",
      recordVersion: "1.2.3-aaaaaaaaaaaa",
      recordSha: "a".repeat(40),
      recordResolvedVersion: "1.2.3",
      toVersion: "1.2.3-bbbbbbbbbbbb",
      resolvedSha: "b".repeat(40),
      resolvedVersion: "1.2.3",
      expected: false,
    },
  ];

  for (const {
    title,
    recordVersion,
    recordSha,
    recordResolvedVersion,
    toVersion,
    resolvedSha,
    resolvedVersion,
    searched,
    expected,
  } of cases) {
    test(title, () => {
      // arrange
      const record = {
        ...makePluginRecord({}),
        ...(recordVersion !== undefined && { version: recordVersion }),
        ...(recordSha !== undefined && { resolvedSha: recordSha }),
        ...(recordResolvedVersion !== undefined && { resolvedVersion: recordResolvedVersion }),
      };

      // act
      const same = isSameRevision(record, toVersion, resolvedSha, {
        resolvedVersion,
        ...(searched !== undefined && { searched }),
      });

      // assert
      assert.equal(same, expected);
    });
  }
});

describe("isRecordedCandidate", () => {
  test("D-18-11: the recorded version at the recorded root is the recorded candidate", () => {
    // arrange
    const record = makePluginRecord({});

    // act
    const recorded = isRecordedCandidate(record, {
      toVersion: "1.2.3",
      resolvedSha: undefined,
      pluginRoot: "/source/alpha",
    });

    // assert
    assert.equal(recorded, true);
  });

  test("D-18-11: the recorded version at another root is a new revision", () => {
    // arrange
    const record = makePluginRecord({});

    // act
    const recorded = isRecordedCandidate(record, {
      toVersion: "1.2.3",
      resolvedSha: undefined,
      pluginRoot: "/source/alpha-copy",
    });

    // assert
    assert.equal(recorded, false);
  });

  test("GV-01: after a tag search that selected none, a record at a release tag is a new revision", () => {
    // arrange
    const record = {
      ...makePluginRecord({}),
      version: "1.2.3-aaaaaaaaaaaa",
      resolvedSha: "a".repeat(40),
      resolvedVersion: "1.2.3",
    };
    const candidate = {
      toVersion: "1.2.3",
      resolvedSha: "a".repeat(40),
      pluginRoot: "/source/alpha",
    };

    // act
    const verdicts = [
      isRecordedCandidate(record, candidate),
      isRecordedCandidate(record, { ...candidate, searchedReleaseTags: true }),
    ];

    // assert
    assert.deepEqual(verdicts, [true, false]);
  });

  test("D-18-11: another version at the recorded root is a new revision", () => {
    // arrange
    const record = makePluginRecord({});

    // act
    const recorded = isRecordedCandidate(record, {
      toVersion: "2.0.0",
      resolvedSha: undefined,
      pluginRoot: "/source/alpha",
    });

    // assert
    assert.equal(recorded, false);
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

describe("applyPartialCascadeFold", () => {
  test("D-PL5-15: subtracts every dropped axis from its record field and keeps the rest", () => {
    // arrange -- each axis drops one recorded name, keeps one, and names one
    // the record never held; `commands` lands in `prompts`.
    const installed = {
      resources: {
        skills: ["drop-skill", "keep-skill"],
        prompts: ["drop-command", "keep-command"],
        agents: ["drop-agent", "keep-agent"],
        mcpServers: ["drop-mcp", "keep-mcp"],
        hooks: ["drop-hook", "keep-hook"],
        workflows: ["sample:drop", "sample:keep"],
      },
    };
    const dropped = {
      skills: ["drop-skill", "missing-skill"],
      commands: ["drop-command", "missing-command"],
      agents: ["drop-agent", "missing-agent"],
      hooks: ["drop-hook", "missing-hook"],
      mcpServers: ["drop-mcp", "missing-mcp"],
      workflows: ["sample:drop", "sample:never-recorded"],
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
        workflows: ["sample:keep"],
      },
    });
    assert.deepStrictEqual(dropped, {
      skills: ["drop-skill", "missing-skill"],
      commands: ["drop-command", "missing-command"],
      agents: ["drop-agent", "missing-agent"],
      hooks: ["drop-hook", "missing-hook"],
      mcpServers: ["drop-mcp", "missing-mcp"],
      workflows: ["sample:drop", "sample:never-recorded"],
    });
  });
});

describe("emitMarketplaceNotAdded", () => {
  test("returns a complete orchestrated failure across both scopes", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      run: runWithNothingLoaded(),
      marketplace: "ghost",
      requestedScope: undefined,
      orchestrated: true,
    });

    // assert
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.equal(failure.error.mpName, "ghost");
    assert.deepStrictEqual(failure.error.scopes, ["project", "user"]);
    assert.equal(failure.cause, 'Marketplace "ghost" not found in project, user scopes.');
    assert.deepStrictEqual(Object.keys(failure), ["status", "reason", "error", "cause"]);
    verify(ctx);
  });

  test("returns a complete orchestrated failure for the requested scope", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    const failure = emitMarketplaceNotAdded({
      ctx,
      run: runWithNothingLoaded(),
      marketplace: "ghost",
      requestedScope: "project",
      orchestrated: true,
    });

    // assert
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.equal(failure.error.mpName, "ghost");
    assert.deepStrictEqual(failure.error.scopes, ["project"]);
    assert.equal(failure.cause, 'Marketplace "ghost" not found in project scope.');
    assert.deepStrictEqual(Object.keys(failure), ["status", "reason", "error", "cause"]);
    verify(ctx);
  });

  test("emits the exact scoped standalone row and still answers with the typed failure", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
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
      run: runWithNothingLoaded(),
      marketplace: "ghost",
      requestedScope: "user",
      orchestrated: false,
    });

    // assert
    // WR-01: the standalone arm emits the row AND answers with the same typed
    // failure the orchestrated arm builds; the standalone entrypoints discard it.
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.deepStrictEqual(failure.error.scopes, ["user"]);
    verify(ctx);
    verify(ui);
  });

  test("emits the exact unscoped standalone row when both scopes miss", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
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
      run: runWithNothingLoaded(),
      marketplace: "ghost",
      requestedScope: undefined,
      orchestrated: false,
    });

    // assert
    assert.equal(failure.status, "failed");
    assert.equal(failure.reason, "marketplace not added");
    assert.ok(failure.error instanceof MarketplaceNotFoundError);
    assert.deepStrictEqual(failure.error.scopes, ["project", "user"]);
    verify(ctx);
    verify(ui);
  });
});

describe("emitMarketplaceNotAddedSignal", () => {
  test("UPR-04: renders the failed plugin row when nothing of the container is installed at the named scope", async () => {
    // arrange
    const context = {
      Messaging: { label: "Plugin reinstall" },
      rowPolicies: { failed: { markers: false, contentReasons: true } },
    } satisfies CommandContext<"failed">;
    const notifications: { message: string; severity?: string }[] = [];
    const { ctx } = makeRecordingBoundary(notifications);

    // act
    await emitMarketplaceNotAddedSignal({
      ctx,
      run: runWithNothingLoaded(),
      cwd: "/work/project",
      context,
      cardinality: "plural",
      err: new MarketplaceNotAddedSignal("mp", "project", { scope: "project", plugin: "hello" }),
    });

    // assert
    assert.deepStrictEqual(context.rowPolicies, {
      failed: { markers: false, contentReasons: true },
    });
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {not installed, marketplace in user scope}\n\n" +
          "Plugin reinstall: 1 failure",
        severity: "error",
      },
    ]);
  });

  test("renders the marketplace row when the container is absent from every scope", async () => {
    await withTempScopes(async ({ cwd }) => {
      // arrange
      const context = {
        Messaging: { label: "Plugin reinstall" },
        rowPolicies: { failed: { markers: false, contentReasons: false } },
      } satisfies CommandContext<"failed">;
      const notifications: { message: string; severity?: string }[] = [];
      const { ctx } = makeRecordingBoundary(notifications);

      // act
      await emitMarketplaceNotAddedSignal({
        ctx,
        run: runWithNothingLoaded(),
        cwd,
        context,
        cardinality: "single",
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

for (const { previousNames, placedNames, expected } of [
  { previousNames: ["alpha:greet"], placedNames: [], expected: true },
  { previousNames: ["alpha:greet", "alpha:wave"], placedNames: ["alpha:greet"], expected: true },
  { previousNames: [], placedNames: [], expected: false },
  { previousNames: ["alpha:greet"], placedNames: ["alpha:greet"], expected: false },
  {
    previousNames: ["alpha:greet"],
    placedNames: ["alpha:greet", "alpha:wave"],
    expected: false,
  },
] satisfies readonly {
  previousNames: readonly string[];
  placedNames: readonly string[];
  expected: boolean;
}[]) {
  test(`WLIF-06: retiresWorkflowCommand(${JSON.stringify(previousNames)}, ${JSON.stringify(placedNames)}) is ${expected}`, () => {
    // act & assert
    assert.strictEqual(retiresWorkflowCommand(previousNames, placedNames), expected);
  });
}

describe("sweepWorkflowsStaging", () => {
  async function workflowsHome(t: TestContext): Promise<string> {
    const home = await mkdtemp(path.join(tmpdir(), "plugin-shared-sweep-"));
    t.after(() => rm(home, { recursive: true, force: true }));
    return home;
  }

  test("logs nothing when the sweep leaves no tree behind", async (t) => {
    // arrange
    const home = await workflowsHome(t);
    const locations = { workflowsHomeDir: home, workflowsStagingDir: path.join(home, "staging") };
    const logged = captureDebugLog(t);

    // act
    await sweepWorkflowsStaging(locations, "install", "hello@mp");

    // assert
    assert.deepStrictEqual(logged, []);
  });

  test("logs the trees the sweep could not remove", async (t) => {
    // arrange -- an aged tree outside the workflows home is refused per entry
    // and recorded as a leak.
    const home = await workflowsHome(t);
    const outside = await workflowsHome(t);
    const abandoned = path.join(outside, "abandoned");
    await mkdir(abandoned);
    const backdated = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(abandoned, backdated, backdated);
    const locations = { workflowsHomeDir: home, workflowsStagingDir: outside };
    const logged = captureDebugLog(t);

    // act
    await sweepWorkflowsStaging(locations, "uninstall", "hello@mp");

    // assert
    assert.equal(logged.length, 1);
    assert.match(
      logged[0] ?? "",
      /^\[hooks\] uninstall: workflows staging GC left 1 tree\(s\) for hello@mp: abandoned: /,
    );
  });

  test("logs and swallows a sweep that throws", async (t) => {
    // arrange -- a file where the staging directory belongs fails enumeration
    // with an errno other than ENOENT, which the sweep rethrows.
    const home = await workflowsHome(t);
    const staging = path.join(home, "staging");
    await writeFile(staging, "not a directory");
    const locations = { workflowsHomeDir: home, workflowsStagingDir: staging };
    const logged = captureDebugLog(t);

    // act
    await sweepWorkflowsStaging(locations, "install", "hello@mp");

    // assert
    assert.deepStrictEqual(logged, [
      `[hooks] install: workflows staging GC failed for hello@mp: ENOTDIR: not a directory, scandir '${staging}'`,
    ]);
  });
});

describe("degradationFromEnable", () => {
  test("lifts every signal the enable outcome carries", () => {
    // act
    const signals = degradationFromEnable({
      unsupported: ["outputStyles"],
      orphanRewake: true,
      degradedKinds: ["skill"],
      stagedAgents: true,
      stagedMcpServers: true,
      stagedWorkflows: true,
    });

    // assert
    assert.deepStrictEqual(signals, {
      unsupported: ["outputStyles"],
      orphanRewake: true,
      degradedKinds: ["skill"],
      stagedAgents: true,
      stagedMcpServers: true,
      stagedWorkflows: true,
    });
  });

  test("lifts nothing from a clean enable", () => {
    // act
    const signals = degradationFromEnable({});

    // assert
    assert.deepStrictEqual(signals, {});
  });
});
