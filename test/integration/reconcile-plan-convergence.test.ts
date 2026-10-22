// test/integration/reconcile-plan-convergence.test.ts
//
// Cross-module fixed-point integration: state-to-config migration, scope merge,
// and reconcile planning compose to a complete no-op for populated state.

import assert from "node:assert/strict";
import { test } from "node:test";

import { githubSource, pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { buildConfigFromState } from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";

import type { ScopeSatisfactionVerdict } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import type { ScopeConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

function populatedMixedState(): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      "mp-path": {
        name: "mp-path",
        scope: "user",
        source: pathSource("./mp-path-local"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/mp-path/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/mp-path",
        plugins: {
          "code-reviewer": {
            version: "1.0.0",
            resolvedSource: "/marketplaces/mp-path/code-reviewer",
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills"],
              unsupported: [],
            },
            resources: {
              skills: ["review-skill"],
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
          },
          "soft-degraded": {
            version: "0.1.0",
            resolvedSource: "/marketplaces/mp-path/soft-degraded",
            compatibility: {
              installable: false,
              notes: ["missing companion"],
              supported: [],
              unsupported: ["agents"],
            },
            resources: {
              skills: [],
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
          },
        },
      },
      "mp-github": {
        name: "mp-github",
        scope: "project",
        source: githubSource("acme/tools"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/mp-github/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/mp-github",
        plugins: {
          formatter: {
            version: "2.0.0",
            resolvedSource: "/marketplaces/mp-github/formatter",
            compatibility: {
              installable: true,
              notes: [],
              supported: ["prompts"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: ["format"],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      },
    },
  };
}

/**
 * The declared config `buildConfigFromState` must project from
 * `populatedMixedState()`, authored here rather than derived. The two
 * convergence cases below feed the migration's own output into the planner, so
 * without this anchor any field the migration stops emitting AND the planner
 * stops reading would keep both of them green -- the `enabled` flag among
 * others. Pinning the intermediate gives the round trip an independent end.
 */
function declaredConfigForMixedState(): ReturnType<typeof buildConfigFromState> {
  return {
    schemaVersion: 1,
    marketplaces: {
      "mp-github": { source: "acme/tools" },
      "mp-path": { source: "./mp-path-local" },
    },
    plugins: {
      "code-reviewer@mp-path": {},
      "formatter@mp-github": {},
      "soft-degraded@mp-path": {},
    },
  };
}

test("migrates populated state to the declared marketplace and plugin config", () => {
  // arrange
  const state = populatedMixedState();
  const expectedConfig = declaredConfigForMixedState();

  // act
  const config = buildConfigFromState(state, {});

  // assert
  assert.deepStrictEqual(config, expectedConfig);
});

test("config migration, merge, and planning converge populated state for project scope", () => {
  // arrange
  const state = populatedMixedState();
  const config = buildConfigFromState(state, {});
  const merged = mergeScopeConfigs(config, {});

  // act
  const result = planReconcile(merged, state, "project");

  // assert
  assert.deepStrictEqual(result, {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    pluginsToDependencyDisable: [],
    pluginsToDependencyInstall: [],
    sourceMismatches: [],
  });
});

test("config migration, merge, and planning converge populated state for user scope", () => {
  // arrange
  const state = populatedMixedState();
  const config = buildConfigFromState(state, {});
  const merged = mergeScopeConfigs(config, {});

  // act
  const result = planReconcile(merged, state, "user");

  // assert
  assert.deepStrictEqual(result, {
    scope: "user",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    pluginsToDependencyDisable: [],
    pluginsToDependencyInstall: [],
    sourceMismatches: [],
  });
});

test("a distinct declared alias resolves to the canonical recorded marketplace", () => {
  // arrange
  const config = {
    schemaVersion: 1 as const,
    marketplaces: { "declared-name": { source: "./local-marketplace" } },
    plugins: { "formatter@declared-name": {} },
  };
  const merged = mergeScopeConfigs(config, {});
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      "canonical-name": {
        name: "canonical-name",
        scope: "project",
        source: pathSource("./local-marketplace"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/canonical-name/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/canonical-name",
        plugins: {
          formatter: {
            version: "1.0.0",
            resolvedSource: "/marketplaces/canonical-name/formatter",
            compatibility: {
              installable: true,
              notes: [],
              supported: ["prompts"],
              unsupported: [],
            },
            resources: {
              skills: [],
              prompts: ["format"],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };

  // act
  const result = planReconcile(merged, state, "project");

  // assert
  assert.deepStrictEqual(result, {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    pluginsToDependencyDisable: [],
    pluginsToDependencyInstall: [],
    sourceMismatches: [],
  });
});

/**
 * D-09-16: a state recording `app@mp` declaring `vault@mp`, with `vault@mp`
 * either unrecorded (unsatisfied) or recorded as a dependency (satisfied).
 * The verdict is stated as a literal -- the declaration walk reads manifests,
 * which this integration file has none of (matching the file's existing
 * convention for LOAD-01/LOAD-02 style cases).
 */
function unsatisfiedDependencyState(recordVault: boolean): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: githubSource("acme/mp"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/mp/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/mp",
        plugins: {
          app: {
            version: "1.0.0",
            resolvedSource: "/marketplaces/mp/app",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
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
          },
          ...(recordVault && {
            vault: {
              version: "1.0.0",
              resolvedSource: "/marketplaces/mp/vault",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: [],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: [],
                workflows: [],
              },
              enabled: true,
              provenance: "dependency",
              installedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        },
      },
    },
  };
}

test("D-09-16: a recorded plugin declaring a missing key plans the bucket, and the recorded dependency plans nothing", () => {
  // arrange
  const state = unsatisfiedDependencyState(false);
  const config = buildConfigFromState(state, {});
  const merged = mergeScopeConfigs(config, {});
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [{ dependent: "app@mp", dependency: "vault@mp", kind: "missing" }],
  };

  // act
  const unsatisfiedPlan = planReconcile(merged, state, "project", verdict);

  // assert
  assert.deepStrictEqual(unsatisfiedPlan, {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    pluginsToDependencyDisable: [
      {
        scope: "project",
        plugin: "app",
        marketplace: "mp",
        dependency: "vault@mp",
        kind: "missing",
      },
    ],
    pluginsToDependencyInstall: [
      {
        scope: "project",
        plugin: "vault",
        marketplace: "mp",
        ranges: [],
        requiredBy: "app@mp",
        declarers: ["app@mp"],
      },
    ],
    sourceMismatches: [],
  });

  // arrange -- the recorded-dependency arm reuses the same migration + merge
  // + plan pipeline the file's other cases span, with an empty (satisfied)
  // verdict.
  const satisfiedState = unsatisfiedDependencyState(true);
  const satisfiedConfig = buildConfigFromState(satisfiedState, {});
  const satisfiedMerged = mergeScopeConfigs(satisfiedConfig, {});

  // act
  const satisfiedPlan = planReconcile(satisfiedMerged, satisfiedState, "project", {
    ok: true,
    unsatisfied: [],
  });

  // assert
  assert.deepStrictEqual(satisfiedPlan, emptyReconcilePlan("project"));
});

test("D-09-14: an unsatisfied declaration re-plans the same bucket entry", () => {
  // arrange -- no backoff, no persisted failure marker: the same inputs
  // re-plan the same bucket, a deliberate non-fixpoint (D-09-14).
  const state = unsatisfiedDependencyState(false);
  const config = buildConfigFromState(state, {});
  const merged = mergeScopeConfigs(config, {});
  const verdict: ScopeSatisfactionVerdict = {
    ok: true,
    unsatisfied: [{ dependent: "app@mp", dependency: "vault@mp", kind: "missing" }],
  };

  // act
  const firstPlan = planReconcile(merged, state, "project", verdict);
  const secondPlan = planReconcile(merged, state, "project", verdict);

  // assert
  assert.deepStrictEqual(secondPlan, firstPlan);
  assert.deepStrictEqual(secondPlan.pluginsToDependencyInstall, [
    {
      scope: "project",
      plugin: "vault",
      marketplace: "mp",
      ranges: [],
      requiredBy: "app@mp",
      declarers: ["app@mp"],
    },
  ]);
});

function recordedPlugin(
  marketplace: string,
  name: string,
  provenance: "explicit" | "dependency",
): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: `/marketplaces/${marketplace}/${name}`,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * FIX-02: `mp-local` is declared only in the local config and records the
 * explicit plugin `lp` and the dependency `dep`; `mp-base` records the
 * explicit plugins `bp` and `lbp`, and the local config declares `lbp`.
 */
function localDeclarationState(): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      "mp-local": {
        name: "mp-local",
        scope: "project",
        source: pathSource("./mp-local"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/mp-local/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/mp-local",
        plugins: {
          lp: recordedPlugin("mp-local", "lp", "explicit"),
          dep: recordedPlugin("mp-local", "dep", "dependency"),
        },
      },
      "mp-base": {
        name: "mp-base",
        scope: "project",
        source: pathSource("./mp-base"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/mp-base/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/mp-base",
        plugins: {
          bp: recordedPlugin("mp-base", "bp", "explicit"),
          lbp: recordedPlugin("mp-base", "lbp", "explicit"),
        },
      },
    },
  };
}

test("FIX-02: the migration leaves out local declarations and the merged view converges to the empty plan", () => {
  // arrange
  const state = localDeclarationState();
  const local = {
    schemaVersion: 1,
    marketplaces: { "mp-local": { source: "./mp-local" } },
    plugins: { "lp@mp-local": {}, "lbp@mp-base": {} },
  } satisfies ScopeConfig;

  // act
  const projection = buildConfigFromState(state, local);
  const plan = planReconcile(mergeScopeConfigs(projection, local), state, "project");

  // assert
  assert.deepStrictEqual(projection, {
    schemaVersion: 1,
    marketplaces: { "mp-base": { source: "./mp-base" } },
    plugins: { "bp@mp-base": {} },
  });
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("LAYER-01: a marketplace both layers declare with its recorded source converges to the empty plan", () => {
  // arrange
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      tools: {
        name: "tools",
        scope: "project",
        source: pathSource("./tools"),
        addedFromCwd: "/workspace",
        manifestPath: "/marketplaces/tools/.claude-plugin/marketplace.json",
        marketplaceRoot: "/marketplaces/tools",
        plugins: { formatter: recordedPlugin("tools", "formatter", "explicit") },
      },
    },
  };
  const base = {
    schemaVersion: 1,
    marketplaces: { tools: { source: "./tools", autoupdate: true } },
    plugins: { "formatter@tools": {} },
  } satisfies ScopeConfig;
  const local = {
    schemaVersion: 1,
    marketplaces: { tools: { source: "./tools" } },
  } satisfies ScopeConfig;

  // act
  const plan = planReconcile(mergeScopeConfigs(base, local), state, "project");

  // assert
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

/**
 * LAYER-09: `formatter@tools` is declared `{ enabled: false }` in the base
 * layer and `{}` in the local layer, so the merged entry keeps the base
 * `enabled`.
 */
function formatterDeclaredDisabledInBaseLayer(recordEnabled: boolean): {
  readonly state: ExtensionState;
  readonly base: ScopeConfig;
  readonly local: ScopeConfig;
} {
  return {
    state: {
      schemaVersion: 2,
      marketplaces: {
        tools: {
          name: "tools",
          scope: "project",
          source: pathSource("./tools"),
          addedFromCwd: "/workspace",
          manifestPath: "/marketplaces/tools/.claude-plugin/marketplace.json",
          marketplaceRoot: "/marketplaces/tools",
          plugins: {
            formatter: {
              ...recordedPlugin("tools", "formatter", "explicit"),
              enabled: recordEnabled,
            },
          },
        },
      },
    },
    base: {
      schemaVersion: 1,
      marketplaces: { tools: { source: "./tools" } },
      plugins: { "formatter@tools": { enabled: false } },
    },
    local: { schemaVersion: 1, plugins: { "formatter@tools": {} } },
  };
}

test("LAYER-09: a disabled record under a base false and a local entry without enabled converges to the empty plan", () => {
  // arrange
  const { state, base, local } = formatterDeclaredDisabledInBaseLayer(false);

  // act
  const plan = planReconcile(mergeScopeConfigs(base, local), state, "project");

  // assert
  assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
});

test("LAYER-09: an enabled record under a base false and a local entry without enabled plans a disable", () => {
  // arrange
  const { state, base, local } = formatterDeclaredDisabledInBaseLayer(true);

  // act
  const plan = planReconcile(mergeScopeConfigs(base, local), state, "project");

  // assert
  assert.deepStrictEqual(plan, {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [{ scope: "project", plugin: "formatter", marketplace: "tools" }],
    pluginsToDependencyDisable: [],
    pluginsToDependencyInstall: [],
    sourceMismatches: [],
  });
});
