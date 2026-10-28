import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  cascadeStagingDiagnostics,
  collectPostCommitWarnings,
  declareInstalledPlugin,
  declaredRowOutcome,
  dependencyInstallsMember,
  failedRowOutcome,
  handleCaughtInstallFailure,
  landedMoves,
  movedMember,
  movedRows,
  promoteDependencyRecord,
  promotedRowOutcome,
  standaloneMarketplaceRefusal,
  writeOrchestratedDeclarations,
  writeReEnabledCascadeMemberConfigEntries,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  InvalidGitHubBaseUrlError,
  MarketplaceInLocalLayerOnlyError,
  MarketplaceSourceUndeclarableError,
  PluginShapeError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import { makeCtx } from "./install-flow-fixture.ts";
import { seedMarketplaceRecord } from "./marketplace-seed.ts";

import type { CascadeInstalledRow } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import type { CascadeMemberOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type { CascadeFailureSink } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts";
import type {
  InstallFailureCapture,
  InstallLedgerSummary,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts";
import type { MovedDependency } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const EMPTY_RESOURCES: PluginInstallRecord["resources"] = {
  agents: [],
  hooks: [],
  mcpServers: [],
  prompts: [],
  skills: [],
  workflows: [],
};

function pluginRecord(overrides: Partial<PluginInstallRecord> = {}): PluginInstallRecord {
  return {
    version: "1.2.3",
    resolvedSource: "/market/plugins/app",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: EMPTY_RESOURCES,
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function stateWith(record: PluginInstallRecord, sourceRoot = "/market"): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./market"),
        addedFromCwd: "/workspace",
        manifestPath: path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: sourceRoot,
        plugins: { app: record },
      },
    },
  };
}

function cascadeMember(overrides: Partial<CascadeMemberOutcome> = {}): CascadeMemberOutcome {
  return {
    key: "dep@mp",
    name: "dep",
    marketplace: "mp",
    requiredBy: "app@mp",
    version: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    pluginRoot: "/market/plugins/dep",
    hooksConfigPath: undefined,
    fellBackToCurrentCopy: false,
    reEnabledFromRecord: false,
    ...overrides,
  };
}

function installedRow(overrides: Partial<CascadeInstalledRow> = {}): CascadeInstalledRow {
  return {
    key: "dep@mp",
    version: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    fellBackToCurrentCopy: false,
    reEnabledFromRecord: false,
    ...overrides,
  };
}

function movedDependency(
  key = "dep@mp",
  reasons: readonly ["already disabled"] | readonly [] = [],
): MovedDependency {
  const at = key.lastIndexOf("@");
  return {
    key,
    name: key.slice(0, at),
    marketplace: key.slice(at + 1),
    row: {
      status: "updated",
      name: key,
      from: "1.0.0",
      to: "2.0.0",
      dependencies: [],
      reasons,
      severity: "info",
      needsReload: true,
    },
  };
}

async function tempLocations(
  t: TestContext,
  prefix: string,
): Promise<{
  readonly cwd: string;
  readonly locations: ScopedLocations;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return { cwd, locations: locationsFor("project", cwd) };
}

function installSummary(args: {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly pluginDataDir: string;
  readonly discoveryWarnings?: InstallLedgerSummary["discoveryWarnings"];
  readonly bridgeWarnings?: InstallLedgerSummary["bridgeWarnings"];
  readonly frontmatterDegradations?: InstallLedgerSummary["frontmatterDegradations"];
  readonly agentForeignFailures?: InstallLedgerSummary["agentForeignFailures"];
}): InstallLedgerSummary {
  const pluginRoot = path.join(args.cwd, "market", "plugins", "app");
  return {
    locations: args.locations,
    cwd: args.cwd,
    marketplace: "mp",
    plugin: "app",
    resolved: {
      state: "installable",
      installable: true,
      name: "app",
      pluginRoot,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    },
    version: "1.2.3",
    pluginDataDir: args.pluginDataDir,
    frontmatterDegradations: args.frontmatterDegradations ?? [],
    stagedSkillNames: [],
    stagedCommandNames: [],
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    stagedWorkflowNames: [],
    bridgeWarnings: args.bridgeWarnings ?? [],
    discoveryWarnings: args.discoveryWarnings ?? [],
    agentForeignFailures: args.agentForeignFailures ?? [],
    mcpConfigNotices: [],
  };
}

describe("writeOrchestratedDeclarations", () => {
  test("writes only a landed disabled declaration", async (t) => {
    // arrange
    const { locations } = await tempLocations(t, "install-results-declaration-");
    const current = { schemaVersion: 1 } satisfies ScopeConfig;

    // act
    await writeOrchestratedDeclarations({
      current,
      targetConfigPath: locations.baseConfigJsonPath,
      scopeRoot: locations.scopeRoot,
      plugin: "app",
      marketplace: "mp",
      landedDisabled: false,
    });
    await writeOrchestratedDeclarations({
      current,
      targetConfigPath: locations.baseConfigJsonPath,
      scopeRoot: locations.scopeRoot,
      plugin: "app",
      marketplace: "mp",
      landedDisabled: true,
    });

    // assert
    assert.match(await readFile(locations.baseConfigJsonPath, "utf8"), /"enabled": false/u);
  });
});

describe("collectPostCommitWarnings", () => {
  test("keeps discovery warnings and suppresses standalone hygiene warnings", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-warning-clean-");
    const summary = installSummary({
      cwd,
      locations,
      pluginDataDir: path.join(locations.dataRoot, "mp", "app"),
      discoveryWarnings: [{ kind: "discovery", message: "one resource was skipped" }],
    });

    // act
    const warnings = await collectPostCommitWarnings(
      summary,
      createCompletionCache(),
      "project",
      false,
    );

    // assert
    assert.deepStrictEqual(warnings, ["one resource was skipped"]);
  });

  test("collects every orchestrated maintenance warning in order", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-warning-failed-");
    const blockedParent = path.join(cwd, "not-a-directory");
    await writeFile(blockedParent, "blocked");
    const summary = installSummary({
      cwd,
      locations,
      pluginDataDir: path.join(blockedParent, "app"),
      discoveryWarnings: [{ kind: "discovery", message: "discovery first" }],
      agentForeignFailures: [{ generatedName: "agent-a", reason: "foreign bytes" }],
      frontmatterDegradations: [
        { kind: "skill", generatedName: "skill-a", parseError: "bad frontmatter" },
      ],
      bridgeWarnings: [{ kind: "hygiene", message: "bridge cleanup deferred" }],
    });
    const completionCache = createCompletionCache();
    t.mock.method(completionCache, "dropMarketplaceCache", () =>
      Promise.reject(new Error("cache locked")),
    );
    const logged = captureDebugLog(t);

    // act
    const warnings = await collectPostCommitWarnings(summary, completionCache, "project", true);

    // assert
    assert.deepStrictEqual(warnings, [
      "discovery first",
      `Plugin "app" installed; data dir creation deferred at ${summary.pluginDataDir}: ENOTDIR: not a directory, mkdir '${summary.pluginDataDir}'`,
      'Plugin "app" installed; completion cache refresh deferred: cache locked',
      'Plugin "app" installed; 1 pre-existing agent file(s) preserved on disk: agent-a: foreign bytes',
      "app/skill-a: bad frontmatter",
      "bridge cleanup deferred",
    ]);
    assert.strictEqual(logged.length, 5);
  });
});

describe("row outcomes", () => {
  test("returns an orchestrated failed outcome with landed moves", () => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const error = new Error("stopped");
    const moved = [movedDependency()];

    // act
    const outcome = failedRowOutcome({
      ctx,
      run,
      marketplace: "mp",
      scope: "project",
      plugin: "app",
      error,
      reasons: ["invalid manifest"],
      orchestrated: true,
      moved,
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      error,
      cause: "stopped",
      movedDependencies: moved,
    });
    assert.deepStrictEqual(notifications, []);
  });

  test("renders a standalone failed row before moved dependency rows", () => {
    // arrange
    const { ctx, run, notifications } = makeCtx();

    // act
    const outcome = failedRowOutcome({
      ctx,
      run,
      marketplace: "mp",
      scope: "project",
      plugin: "app",
      error: new Error("stopped"),
      reasons: ["invalid manifest"],
      orchestrated: false,
      moved: [movedDependency()],
    });

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /app \(failed\)[\s\S]*dep@mp/u);
  });

  for (const { orchestrated, materialized, resourcesChanged } of [
    { orchestrated: true, materialized: [], resourcesChanged: false },
    {
      orchestrated: false,
      materialized: [
        {
          key: "app@mp",
          name: "app",
          marketplace: "mp",
          pluginRoot: "/market/plugins/app",
          hooksConfigPath: undefined,
        },
      ],
      resourcesChanged: true,
    },
  ] as const) {
    test(`projects a ${orchestrated ? "silent" : "rendered"} promotion`, () => {
      // arrange
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = promotedRowOutcome({
        ctx,
        run,
        marketplace: "mp",
        scope: "project",
        plugin: "app",
        promotion: {
          version: "1.2.3",
          declaresAgents: true,
          declaresMcp: false,
          declaresWorkflows: true,
          materialized,
          mcpConfigNotices: [],
        },
        orchestrated,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "installed",
        version: "1.2.3",
        resourcesChanged,
        declaresAgents: true,
        declaresMcp: false,
        declaresWorkflows: true,
        promoted: true,
      });
      assert.strictEqual(notifications.length, orchestrated ? 0 : 1);
    });
  }

  test("renders a declaration-only install from the stored record", () => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const record = pluginRecord({
      resources: { ...EMPTY_RESOURCES, agents: ["agent"], workflows: ["flow"] },
    });

    // act
    const outcome = declaredRowOutcome({
      ctx,
      run,
      marketplace: "mp",
      scope: "project",
      plugin: "app",
      record,
      reason: "already installed in local layer",
    });

    // assert
    assert.deepStrictEqual(outcome, {
      status: "installed",
      version: "1.2.3",
      resourcesChanged: false,
      declaresAgents: true,
      declaresMcp: false,
      declaresWorkflows: true,
    });
    assert.match(notifications[0]?.message ?? "", /already installed in local layer/u);
  });
});

describe("promotion", () => {
  test("ignores absent, direct, pinned, and unaccepted partial records", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-promotion-skip-");
    const { ctx, run } = makeCtx();
    const sink: CascadeFailureSink = { mcpConfigNotices: [] };
    const baseArgs = {
      opts: { ctx, run, scope: "project" as const, cwd, marketplace: "mp", plugin: "app" },
      locations,
      orchestrated: true,
      config: {
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
        targetIsLocal: false,
      },
      capture: { rollbackPartials: [], version: undefined } satisfies InstallFailureCapture,
      transaction: { runPhases, withLockedStateTransaction },
      sink,
      env: {},
    } satisfies Omit<Parameters<typeof promoteDependencyRecord>[0], "state">;
    const records = [
      undefined,
      pluginRecord(),
      pluginRecord({ provenance: "dependency" }),
      pluginRecord({
        provenance: "dependency",
        compatibility: {
          installable: false,
          notes: ["one component skipped"],
          supported: [],
          unsupported: ["themes"],
        },
      }),
    ] as const;

    // act
    const outcomes = await Promise.all([
      promoteDependencyRecord({
        ...baseArgs,
        state: { schemaVersion: 3, marketplaces: {} },
      }),
      promoteDependencyRecord({ ...baseArgs, state: stateWith(records[1]) }),
      promoteDependencyRecord({
        ...baseArgs,
        opts: { ...baseArgs.opts, pinVersionOverride: "2.0.0" },
        state: stateWith(records[2]),
      }),
      promoteDependencyRecord({ ...baseArgs, state: stateWith(records[3]) }),
    ]);

    // assert
    assert.deepStrictEqual(outcomes, [undefined, undefined, undefined, undefined]);
  });

  test("promotes an enabled dependency without materializing it", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-promotion-enabled-");
    const { ctx, run } = makeCtx();
    const record = pluginRecord({
      provenance: "dependency",
      resources: { ...EMPTY_RESOURCES, agents: ["agent"], mcpServers: ["mcp"] },
    });

    // act
    const promotion = await promoteDependencyRecord({
      opts: { ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "app" },
      state: stateWith(record),
      locations,
      orchestrated: true,
      config: {
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
        targetIsLocal: false,
      },
      capture: { rollbackPartials: [], version: undefined },
      transaction: { runPhases, withLockedStateTransaction },
      sink: { mcpConfigNotices: [] },
      env: {},
    });

    // assert
    assert.strictEqual(record.provenance, "explicit");
    assert.deepStrictEqual(promotion, {
      version: "1.2.3",
      declaresAgents: true,
      declaresMcp: true,
      declaresWorkflows: false,
      materialized: [],
      mcpConfigNotices: [],
    });
  });

  test("promotes and declares an enabled dependency in standalone mode", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-promotion-declare-");
    const { ctx, run } = makeCtx();
    const record = pluginRecord({ provenance: "dependency" });
    const state = stateWith(record);

    // act
    await promoteDependencyRecord({
      opts: { ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "app" },
      state,
      locations,
      orchestrated: false,
      config: {
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./market" } } },
        other: { schemaVersion: 1 },
        targetIsLocal: false,
      },
      capture: { rollbackPartials: [], version: undefined },
      transaction: { runPhases, withLockedStateTransaction },
      sink: { mcpConfigNotices: [] },
      env: {},
    });

    // assert
    assert.match(await readFile(locations.baseConfigJsonPath, "utf8"), /"app@mp": \{\}/u);
  });

  test("re-materializes a disabled dependency and carries its resolved version", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-promotion-disabled-");
    const { ctx, run } = makeCtx();
    const record = pluginRecord({
      provenance: "dependency",
      enabled: false,
      resolvedVersion: "1.2.3",
    });
    const marketplaceRoot = path.join(cwd, "market");
    record.resolvedSource = path.join(marketplaceRoot, "plugins", "app");
    const marketplace = await seedMarketplaceRecord({
      cwd,
      marketplace: "market",
      plugins: { app: record },
      scope: "project",
    });
    const state: ExtensionState = {
      schemaVersion: 3,
      marketplaces: { mp: { ...marketplace, name: "mp" } },
    };
    const sink: CascadeFailureSink = { mcpConfigNotices: [] };

    // act
    const promotion = await promoteDependencyRecord({
      opts: {
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "app",
        notifications: { mode: "orchestrated" },
      },
      state,
      locations,
      orchestrated: true,
      config: {
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1 },
        targetIsLocal: false,
      },
      capture: { rollbackPartials: [], version: undefined },
      transaction: { runPhases, withLockedStateTransaction },
      sink,
      env: {},
    });

    // assert
    assert.strictEqual(promotion?.materialized.length, 1);
    assert.strictEqual(promotion?.version, "1.2.3");
    assert.deepStrictEqual(sink.mcpConfigNotices, []);
  });
});

describe("cascade projections", () => {
  test("projects moved rows and optional moved members", () => {
    // arrange
    const moved = [movedDependency()];

    // act
    const rows = movedRows(moved);
    const absentRows = movedRows(undefined);
    const member = movedMember(moved);
    const absentMember = movedMember(undefined);
    const emptyMember = movedMember([]);

    // assert
    assert.deepStrictEqual(rows, [moved[0]?.row]);
    assert.deepStrictEqual(absentRows, []);
    assert.deepStrictEqual(member, { movedDependencies: moved });
    assert.deepStrictEqual(absentMember, {});
    assert.deepStrictEqual(emptyMember, {});
  });

  test("removes superseded disabled pin refreshes from landed moves", () => {
    // arrange
    const moved = [movedDependency("dep@mp", ["already disabled"]), movedDependency("kept@mp")];

    // act
    const absent = landedMoves(undefined, []);
    const landed = landedMoves(moved, [installedRow({ key: "dep@mp" })]);

    // assert
    assert.strictEqual(absent, undefined);
    assert.deepStrictEqual(landed, [moved[1]]);
  });

  test("projects installed dependencies only after a dependency plan", () => {
    // arrange
    const members = [installedRow({ key: "app@mp" }), installedRow({ key: "dep@mp" })];
    const softDeps = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    };

    // act
    const absent = dependencyInstallsMember(undefined, members, "app@mp", softDeps);
    const empty = dependencyInstallsMember([], [members[0]!], "app@mp", softDeps);
    const projected = dependencyInstallsMember([], members, "app@mp", softDeps);

    // assert
    assert.deepStrictEqual(absent, {});
    assert.deepStrictEqual(empty, {});
    assert.deepStrictEqual(projected, {
      dependencyInstalls: [
        {
          key: "dep@mp",
          name: "dep",
          marketplace: "mp",
          row: {
            status: "installed",
            severity: "info",
            name: "dep@mp",
            version: "2.0.0",
            dependencies: [],
            needsReload: true,
          },
        },
      ],
    });
  });

  test("projects discovery diagnostics only for members that raised them", () => {
    // arrange
    const members = [
      cascadeMember(),
      cascadeMember({
        key: "warned@mp",
        name: "warned",
        discoveryWarnings: [{ kind: "discovery", message: "one component skipped" }],
      }),
    ];

    // act
    const diagnostics = cascadeStagingDiagnostics(members, "project");

    // assert
    assert.deepStrictEqual(diagnostics, [
      {
        plugin: "warned",
        scope: "project",
        verb: "installed",
        warnings: [{ kind: "discovery", message: "one component skipped" }],
      },
    ]);
  });
});

describe("declaration policy", () => {
  test("refuses only standalone local-only and unknown-source marketplaces", () => {
    // arrange
    const record = pluginRecord();
    const localOnly: Parameters<typeof standaloneMarketplaceRefusal>[1] = {
      targetIsLocal: false,
      current: { schemaVersion: 1 },
      other: { schemaVersion: 1, marketplaces: { mp: { source: "./market" } } },
    };
    const unknownSource = stateWith(record);
    unknownSource.marketplaces.mp!.source = { kind: "unknown", reason: "future source" };
    const neither: Parameters<typeof standaloneMarketplaceRefusal>[1] = {
      ...localOnly,
      other: { schemaVersion: 1 },
    };

    // act
    const orchestrated = standaloneMarketplaceRefusal(
      { marketplace: "mp", notifications: { mode: "orchestrated" } },
      localOnly,
      stateWith(record),
    );
    const localRefusal = standaloneMarketplaceRefusal(
      { marketplace: "mp" },
      localOnly,
      stateWith(record),
    );
    const unknownRefusal = standaloneMarketplaceRefusal(
      { marketplace: "mp" },
      neither,
      unknownSource,
    );
    const allowed = standaloneMarketplaceRefusal({ marketplace: "mp" }, neither, {
      schemaVersion: 3,
      marketplaces: {},
    });

    // assert
    assert.strictEqual(orchestrated, undefined);
    assert.ok(localRefusal?.refusal instanceof MarketplaceInLocalLayerOnlyError);
    assert.ok(unknownRefusal?.refusal instanceof MarketplaceSourceUndeclarableError);
    assert.strictEqual(allowed, undefined);
  });

  test("declares an installed plugin in either target layer", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-declared-");
    const { ctx, run } = makeCtx();
    const record = pluginRecord();
    const state = stateWith(record);

    // act
    const base = await declareInstalledPlugin({
      opts: { ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "app" },
      state,
      locations,
      orchestrated: false,
      selection: {
        kind: "loaded",
        targetConfigPath: locations.baseConfigJsonPath,
        targetIsLocal: false,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./market" } } },
        other: { schemaVersion: 1, plugins: { "app@mp": {} } },
      },
    });
    const local = await declareInstalledPlugin({
      opts: { ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "app" },
      state,
      locations,
      orchestrated: false,
      selection: {
        kind: "loaded",
        targetConfigPath: locations.localConfigJsonPath,
        targetIsLocal: true,
        current: { schemaVersion: 1, marketplaces: { mp: { source: "./market" } } },
        other: { schemaVersion: 1, plugins: { "app@mp": {} } },
      },
    });

    // assert
    assert.strictEqual(base?.kind, "declared");
    assert.strictEqual(
      base?.kind === "declared" ? base.reason : undefined,
      "already installed in local layer",
    );
    assert.strictEqual(local?.kind, "declared");
    assert.strictEqual(
      local?.kind === "declared" ? local.reason : undefined,
      "already installed in base layer",
    );
  });

  test("skips declaration for each ineligible condition", async (t) => {
    // arrange
    const { cwd, locations } = await tempLocations(t, "install-results-declared-skip-");
    const { ctx, run } = makeCtx();
    const selections = {
      otherOnly: {
        kind: "loaded" as const,
        targetConfigPath: locations.baseConfigJsonPath,
        targetIsLocal: false,
        current: { schemaVersion: 1 },
        other: { schemaVersion: 1, plugins: { "app@mp": {} } },
      },
      targetOnly: {
        kind: "loaded" as const,
        targetConfigPath: locations.baseConfigJsonPath,
        targetIsLocal: false,
        current: { schemaVersion: 1, plugins: { "app@mp": {} } },
        other: { schemaVersion: 1 },
      },
    } satisfies Record<
      "otherOnly" | "targetOnly",
      Parameters<typeof declareInstalledPlugin>[0]["selection"]
    >;
    const base = {
      opts: { ctx, run, scope: "project" as const, cwd, marketplace: "mp", plugin: "app" },
      locations,
      selection: selections.otherOnly,
    };

    // act
    const outcomes = await Promise.all([
      declareInstalledPlugin({ ...base, state: stateWith(pluginRecord()), orchestrated: true }),
      declareInstalledPlugin({
        ...base,
        state: stateWith(pluginRecord({ provenance: "dependency" })),
        orchestrated: false,
      }),
      declareInstalledPlugin({
        ...base,
        opts: { ...base.opts, pinVersionOverride: "2.0.0" },
        state: stateWith(pluginRecord()),
        orchestrated: false,
      }),
      declareInstalledPlugin({
        ...base,
        state: stateWith(pluginRecord()),
        orchestrated: false,
        selection: selections.targetOnly,
      }),
      declareInstalledPlugin({
        ...base,
        state: { schemaVersion: 3, marketplaces: {} },
        orchestrated: false,
      }),
    ]);

    // assert
    assert.deepStrictEqual(outcomes, [undefined, undefined, undefined, undefined, undefined]);
  });

  test("rewrites only re-enabled member declarations", async (t) => {
    // arrange
    const { locations } = await tempLocations(t, "install-results-reenabled-");
    await mkdir(path.dirname(locations.baseConfigJsonPath), { recursive: true });
    await writeFile(
      locations.baseConfigJsonPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: { "dep@mp": { enabled: false }, "kept@mp": { enabled: false } },
      }),
    );

    // act
    await writeReEnabledCascadeMemberConfigEntries(locations, [
      cascadeMember({ reEnabledFromRecord: true }),
      cascadeMember({ key: "kept@mp", name: "kept", reEnabledFromRecord: false }),
    ]);

    // assert
    assert.deepStrictEqual(JSON.parse(await readFile(locations.baseConfigJsonPath, "utf8")), {
      schemaVersion: 1,
      plugins: { "dep@mp": { enabled: true }, "kept@mp": { enabled: false } },
    });
  });
});

describe("caught failures", () => {
  function failureArgs(
    overrides: {
      readonly err?: unknown;
      readonly orchestrated?: boolean;
      readonly capture?: InstallFailureCapture;
      readonly cascadeFailure?: CascadeFailureSink;
      readonly moved?: readonly MovedDependency[];
    } = {},
  ) {
    const { ctx, run, notifications } = makeCtx();
    return {
      args: {
        err: overrides.err ?? new Error("stopped"),
        ctx,
        run,
        marketplace: "mp",
        scope: "project" as const,
        plugin: "app",
        rootKey: "app@mp",
        capture: overrides.capture ?? { rollbackPartials: [], version: undefined },
        cascadeFailure: overrides.cascadeFailure ?? { mcpConfigNotices: [] },
        orchestrated: overrides.orchestrated ?? true,
        ...(overrides.moved === undefined ? {} : { moved: overrides.moved }),
      },
      notifications,
    };
  }

  test("rethrows an invalid GitHub base URL when no landed fact needs a row", () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError("GITHUB_BASE_URL", "scheme");
    const { args } = failureArgs({ err: invalid });

    // act & assert
    assert.throws(() => handleCaughtInstallFailure(args), invalid);
  });

  test("projects an orchestrated plugin-shape failure", () => {
    // arrange
    const shape = new PluginShapeError({
      kind: "not-in-manifest",
      plugin: "app",
      marketplace: "mp",
    });
    const { args } = failureArgs({ err: shape });

    // act
    const outcome = handleCaughtInstallFailure(args);

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.error, shape);
  });

  for (const thrown of [new Error("stopped"), "stopped"] as const) {
    test(`renders a standalone ${typeof thrown === "string" ? "non-error" : "error"} failure`, () => {
      // arrange
      const { args, notifications } = failureArgs({ err: thrown, orchestrated: false });

      // act
      const outcome = handleCaughtInstallFailure(args);

      // assert
      assert.strictEqual(outcome.status, "failed");
      assert.strictEqual(outcome.error.message, "stopped");
      assert.strictEqual(notifications.length, 1);
    });
  }

  test("keeps landed moves when an invalid base URL needs a row", () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError("GITHUB_BASE_URL", "scheme");
    const moved = [movedDependency()];
    const { args } = failureArgs({ err: invalid, moved });

    // act
    const outcome = handleCaughtInstallFailure(args);

    // assert
    assert.deepStrictEqual(outcome.movedDependencies, moved);
  });

  test("projects an orchestrated dependency failure with rollback partials", () => {
    // arrange
    const memberError = new Error("dependency stopped");
    const { args } = failureArgs({
      cascadeFailure: {
        mcpConfigNotices: [],
        subject: {
          kind: "member",
          key: "dep@mp",
          error: memberError,
          rollbackPartials: [
            { phase: "skills", msg: "undo stopped", cause: new Error("undo stopped") },
          ],
        },
      },
    });

    // act
    const outcome = handleCaughtInstallFailure(args);

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.error.message, memberError.message);
    assert.deepStrictEqual(outcome.rollbackPartials, [
      { phase: "skills", msg: "undo stopped", cause: new Error("undo stopped") },
    ]);
  });

  test("renders a standalone dependency failure without rollback partials", () => {
    // arrange
    const { args, notifications } = failureArgs({
      orchestrated: false,
      cascadeFailure: {
        mcpConfigNotices: [],
        subject: {
          kind: "member",
          key: "dep@mp",
          error: new Error("dependency stopped"),
          rollbackPartials: [],
        },
      },
    });

    // act
    const outcome = handleCaughtInstallFailure(args);

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.rollbackPartials, undefined);
    assert.match(notifications[0]?.message ?? "", /dep@mp/u);
  });

  test("omits rollback partials from an orchestrated clean dependency failure", () => {
    // arrange
    const { args } = failureArgs({
      cascadeFailure: {
        mcpConfigNotices: [],
        subject: {
          kind: "member",
          key: "dep@mp",
          error: new Error("dependency stopped"),
          rollbackPartials: [],
        },
      },
    });

    // act
    const outcome = handleCaughtInstallFailure(args);

    // assert
    assert.strictEqual(outcome.status, "failed");
    assert.strictEqual(outcome.rollbackPartials, undefined);
  });
});
