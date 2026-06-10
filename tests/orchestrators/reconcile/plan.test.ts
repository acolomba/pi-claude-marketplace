import assert from "node:assert/strict";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { mergeScopeConfigs } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";

import type {
  MarketplaceConfigEntry,
  PluginConfigEntry,
  ScopeConfig,
} from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * DIFF-01 planner matrix coverage. Tests are organised by the 7-bucket
 * desired-x-actual matrix. Edge-case cells (empty inputs, both-side empties,
 * malformed plugin keys, dangling references) follow the main matrix.
 */

function stateWithOneGithubMarketplace(
  mpName: string,
  rawSource: string,
  pluginNames: readonly string[] = [],
): ExtensionState {
  const plugins: ExtensionState["marketplaces"][string]["plugins"] = {};
  for (const plugin of pluginNames) {
    plugins[plugin] = {
      version: "1.0.0",
      resolvedSource: "/abs/whatever",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
      installedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
  }

  return {
    schemaVersion: 1,
    marketplaces: {
      [mpName]: {
        name: mpName,
        scope: "project",
        source: githubSource(rawSource),
        addedFromCwd: "/some/cwd",
        manifestPath: "/abs/manifest",
        marketplaceRoot: "/abs/root",
        plugins,
      },
    },
  };
}

function stateWithOnePathMarketplace(
  mpName: string,
  rawSource: string,
  pluginNames: readonly string[] = [],
): ExtensionState {
  const plugins: ExtensionState["marketplaces"][string]["plugins"] = {};
  for (const plugin of pluginNames) {
    plugins[plugin] = {
      version: "1.0.0",
      resolvedSource: "/abs/whatever",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
      installedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
  }

  return {
    schemaVersion: 1,
    marketplaces: {
      [mpName]: {
        name: mpName,
        scope: "project",
        source: pathSource(rawSource),
        addedFromCwd: "/some/cwd",
        manifestPath: "/abs/manifest",
        marketplaceRoot: "/abs/root",
        plugins,
      },
    },
  };
}

function configWith(
  marketplaces: Record<string, MarketplaceConfigEntry> = {},
  plugins: Record<string, PluginConfigEntry> = {},
): ScopeConfig {
  return { schemaVersion: 1, marketplaces, plugins };
}

// ──────────────────────────────────────────────────────────────────────────
// Marketplace matrix cells (4 cells)
// ──────────────────────────────────────────────────────────────────────────

test("MP cell (declared, recorded, same-source): NO action", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(configWith({ mp: { source: "acme/tools" } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("MP cell (declared, recorded, source-mismatch): 1 PlannedSourceMismatch with both sources", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(configWith({ mp: { source: "other/tools" } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.sourceMismatches.length, 1);
  const mm = plan.sourceMismatches[0];
  assert.ok(mm);
  assert.equal(mm.scope, "project");
  assert.equal(mm.marketplace, "mp");
  assert.equal(mm.cause, "source-mismatch");
  assert.equal(mm.declaredSource, "other/tools");
  // recordedSource flows through sourceLogical for stable diagnostic form
  // (github gets the https form).
  assert.equal(mm.recordedSource, "https://github.com/acme/tools");
  assert.equal(plan.marketplacesToAdd.length, 0);
  assert.equal(plan.marketplacesToRemove.length, 0);
});

test("MP cell (declared, recorded, unknown-stored): 1 PlannedSourceMismatch cause=unknown-stored", () => {
  // Synthesize a state with an unrecognised source shape. The schema accepts
  // Type.Unknown() for source so an object literal that does not classify
  // legally lands here. Cast via unknown so the test compiles.
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        // Forward-compat (NFR-12) unknown-kind source object: an arbitrary
        // shape with no `kind === "path" | "github"` discriminator.
        source: { kind: "future-thing", raw: "unrecognised" },
        addedFromCwd: "/some/cwd",
        manifestPath: "/abs/manifest",
        marketplaceRoot: "/abs/root",
        plugins: {},
      },
    },
  };
  const merged = mergeScopeConfigs(configWith({ mp: { source: "acme/tools" } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.sourceMismatches.length, 1);
  const mm = plan.sourceMismatches[0];
  assert.ok(mm);
  assert.equal(mm.cause, "unknown-stored");
  assert.equal(mm.declaredSource, "acme/tools");
  // recordedSource is a stable string form of the unrecognised record.
  // The exact bytes (here `String(object) === "[object Object]"`) are an
  // implementation detail Phase 55 may refine; the structural assertion
  // is just that the field is a non-empty string.
  assert.equal(typeof mm.recordedSource, "string");
  assert.ok(mm.recordedSource.length > 0);
});

test("MP cell (declared, not recorded): 1 PlannedMarketplaceAdd carries raw source + configSource", () => {
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  // Declare on the local file (override).
  const merged = mergeScopeConfigs({}, configWith({ mp: { source: "acme/tools" } }));
  const plan = planReconcile(merged, state, "user");
  assert.equal(plan.marketplacesToAdd.length, 1);
  const add = plan.marketplacesToAdd[0];
  assert.ok(add);
  assert.equal(add.scope, "user");
  assert.equal(add.marketplace, "mp");
  assert.equal(add.source, "acme/tools");
  assert.equal(add.configSource, "local");
});

test("MP cell (not declared, recorded): 1 PlannedMarketplaceRemove", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs({}, {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.marketplacesToRemove.length, 1);
  assert.deepEqual(plan.marketplacesToRemove[0], {
    scope: "project",
    marketplace: "mp",
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Plugin matrix cells (6 cells under the three-state enabled model)
// ──────────────────────────────────────────────────────────────────────────

test("Plugin cell (declared+enabled-undefined, not recorded): 1 PlannedPluginInstall (D-04 default includes)", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": {} }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToInstall.length, 1);
  const ins = plan.pluginsToInstall[0];
  assert.ok(ins);
  assert.equal(ins.plugin, "cr");
  assert.equal(ins.marketplace, "mp");
  assert.equal(ins.scope, "project");
  assert.equal(ins.configSource, "base");
});

test("Plugin cell (declared+enabled-true, not recorded): 1 PlannedPluginInstall", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToInstall.length, 1);
  const ins = plan.pluginsToInstall[0];
  assert.ok(ins);
  assert.equal(ins.plugin, "cr");
});

test("Plugin cell (declared+enabled-true, recorded): NO action (steady state)", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("Plugin cell (declared+enabled-false, recorded): 1 PlannedPluginDisable", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: false } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToDisable.length, 1);
  assert.deepEqual(plan.pluginsToDisable[0], {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
  });
  assert.equal(plan.pluginsToInstall.length, 0);
  assert.equal(plan.pluginsToUninstall.length, 0);
});

test("Plugin cell (declared+enabled-false, not recorded): NO action (steady disabled)", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: false } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("Plugin cell (not declared, recorded): 1 PlannedPluginUninstall", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(configWith({ mp: { source: "acme/tools" } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToUninstall.length, 1);
  assert.deepEqual(plan.pluginsToUninstall[0], {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
  });
});

test("Plugin cell (declared+enabled-true, recorded, future-Phase-54-disabled): pluginsToEnable structurally empty (Pitfall 53-4)", () => {
  // Phase 53 cannot distinguish recorded-and-enabled from
  // recorded-and-locally-disabled (no `state.disabled` marker exists yet).
  // The bucket is empty for every legal Phase 53 input -- Phase 54 wires it.
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToEnable.length, 0);
});

// ──────────────────────────────────────────────────────────────────────────
// Edge cells
// ──────────────────────────────────────────────────────────────────────────

test("Edge: empty merged + empty state -> emptyReconcilePlan", () => {
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  const merged = mergeScopeConfigs({}, {});
  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("Edge: empty merged + populated state -> every mp + plugin in remove/uninstall buckets", () => {
  // The "naked uninstall everything" hazard; the orchestrator-level CFG-03
  // abort prevents this from reaching the apply path, but the planner MUST
  // produce the bucket structure unconditionally (the abort is the
  // orchestrator's responsibility, not the planner's).
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr1", "cr2"]);
  const merged = mergeScopeConfigs({}, {});
  const plan = planReconcile(merged, state, "user");
  assert.equal(plan.marketplacesToRemove.length, 1);
  // Plugins under a marketplace marked for removal are NOT double-billed in
  // `pluginsToUninstall`; the marketplace teardown subsumes the plugin
  // cleanup. The plugin uninstall bucket is empty.
  assert.equal(plan.pluginsToUninstall.length, 0);
  assert.equal(plan.marketplacesToAdd.length, 0);
  assert.equal(plan.pluginsToInstall.length, 0);
});

test("Edge: populated merged + empty state -> every mp + enabled plugin in add/install buckets", () => {
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  const merged = mergeScopeConfigs(
    configWith(
      { "mp-a": { source: "acme/a" }, "mp-b": { source: "acme/b" } },
      {
        "cr@mp-a": { enabled: true },
        "cr@mp-b": {},
      },
    ),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.marketplacesToAdd.length, 2);
  assert.equal(plan.pluginsToInstall.length, 2);
  assert.equal(plan.marketplacesToRemove.length, 0);
  assert.equal(plan.pluginsToUninstall.length, 0);
});

test("Edge: dangling plugin reference (mp not in declared nor recorded) -> PlannedSourceMismatch with sentinel", () => {
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  const merged = mergeScopeConfigs(configWith({}, { "cr@phantom-mp": { enabled: true } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.sourceMismatches.length, 1);
  const dangling = plan.sourceMismatches[0];
  assert.ok(dangling);
  assert.equal(dangling.cause, "source-mismatch");
  assert.equal(dangling.marketplace, "phantom-mp");
  assert.equal(dangling.declaredSource, "");
  assert.equal(dangling.recordedSource, "<marketplace not declared>");
  // Crucially, the dangling reference does NOT land in pluginsToInstall.
  assert.equal(plan.pluginsToInstall.length, 0);
});

test("Plugin key parser: lastIndexOf('@') admits plugin names containing '@'", () => {
  // `evil@evil@marketplace` -> plugin "evil@evil", marketplace "marketplace".
  const state = stateWithOnePathMarketplace("marketplace", "./mp");
  const merged = mergeScopeConfigs(
    configWith({ marketplace: { source: "./mp" } }, { "evil@evil@marketplace": {} }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToInstall.length, 1);
  const ins = plan.pluginsToInstall[0];
  assert.ok(ins);
  assert.equal(ins.plugin, "evil@evil");
  assert.equal(ins.marketplace, "marketplace");
});
