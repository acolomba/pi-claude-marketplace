// tests/integration/reconcile-plan-convergence.test.ts
//
// Cross-module fixed-point integration: state-to-config migration, scope merge,
// and reconcile planning compose to a complete no-op for populated state.

import assert from "node:assert/strict";
import { test } from "node:test";

import { githubSource, pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { buildConfigFromState } from "../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
            },
            enabled: true,
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
            },
            enabled: true,
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
            },
            enabled: true,
            installedAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      },
    },
  };
}

test("config migration, merge, and planning converge populated state for project scope", () => {
  // arrange
  const state = populatedMixedState();
  const config = buildConfigFromState(state);
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
    sourceMismatches: [],
  });
});

test("config migration, merge, and planning converge populated state for user scope", () => {
  // arrange
  const state = populatedMixedState();
  const config = buildConfigFromState(state);
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
    sourceMismatches: [],
  });
});
