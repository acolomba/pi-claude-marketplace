import assert from "node:assert/strict";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  isRecordedButDisabled,
  planReconcile,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
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
      // ENBL-02: a non-empty resources array signals "currently installed
      // and enabled" (the install path's statePhase populates at least one
      // array for any installable plugin per `requireInstallable`). Tests
      // that need a "currently disabled" record use `stateWithDisabledRecord`
      // (all four arrays empty -- A1).
      resources: { skills: ["s1"], prompts: [], agents: [], mcpServers: [] },
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
      // ENBL-02: a non-empty resources array signals "currently installed
      // and enabled" (the install path's statePhase populates at least one
      // array for any installable plugin per `requireInstallable`). Tests
      // that need a "currently disabled" record use `stateWithDisabledRecord`
      // (all four arrays empty -- A1).
      resources: { skills: ["s1"], prompts: [], agents: [], mcpServers: [] },
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
  assert.equal(mm.cause, "source-mismatch");
  if (mm.cause !== "source-mismatch") {
    throw new Error("test fixture broken -- expected cause=source-mismatch");
  }

  assert.equal(mm.marketplace, "mp");
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
  // implementation detail downstream consumers may refine; the structural assertion
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

test("Plugin cell (declared+enabled-true, recorded, non-empty resources): pluginsToEnable empty (steady-state preserved)", () => {
  // ENBL-02: the empty-resources arrays serve as the implicit
  // "currently disabled" marker (A1; SPLIT-01 preserved -- no schema bump).
  // A recorded plugin with non-empty resources is steady-state, NOT a
  // candidate for the enable bucket.
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToEnable.length, 0);
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-02 recorded-but-disabled (empty-resources marker)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a state with a recorded plugin whose four resources arrays are all
 * empty -- the implicit "currently disabled" marker (Pattern 4 / A1). The
 * statePhase in `orchestrators/plugin/install.ts:617-664` only writes empty
 * arrays through the disable path; an installable plugin always populates
 * at least one component (the resolver's `requireInstallable` gate rules
 * out the zero-component degenerate).
 */
function stateWithDisabledRecord(
  mpName: string,
  rawSource: string,
  plugin: string,
): ExtensionState {
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
        plugins: {
          [plugin]: {
            version: "1.0.0",
            resolvedSource: "/abs/whatever",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            // All four arrays empty -- the disabled marker per A1.
            resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
            installedAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
}

test("ENBL-02 (a): recorded + empty resources + enabled!==false -> pluginsToEnable non-empty (isRecordedButDisabled fires)", () => {
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToEnable.length, 1);
  assert.deepEqual(plan.pluginsToEnable[0], {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
  });
  // Steady-state buckets stay empty.
  assert.equal(plan.pluginsToInstall.length, 0);
  assert.equal(plan.pluginsToUninstall.length, 0);
  assert.equal(plan.pluginsToDisable.length, 0);
});

test("ENBL-02 (b): recorded + NON-empty resources + enabled!==false -> pluginsToEnable empty (steady state preserved)", () => {
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToEnable.length, 0);
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("ENBL-02 (c) / WR-05: recorded + empty resources + enabled===false -> STEADY STATE (converged disabled is no divergence)", () => {
  // WR-05: the terminal state of a successful disable is exactly "recorded
  // with empty resources + config enabled:false" (ENBL-02 keeps the
  // record). The planner must treat it as steady state -- NOT a perpetual
  // pluginsToDisable entry that would render `(will disable)` forever and
  // make the apply path re-run a no-op disable on every reload.
  // Symmetric with the enable case: "recorded + populated + enabled" is
  // steady state too.
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: false } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToEnable.length, 0);
  assert.equal(plan.pluginsToDisable.length, 0);
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});

test("WR-05 convergence: populated record + enabled===false -> disable; disabled record + enabled===false -> empty plan (disable -> re-plan converges)", () => {
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: false } }),
    {},
  );

  // Step 1: artefacts still materialised -> the planner emits the disable.
  const populated = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const planBefore = planReconcile(merged, populated, "project");
  assert.equal(planBefore.pluginsToDisable.length, 1);
  assert.deepEqual(planBefore.pluginsToDisable[0], {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
  });

  // Step 2: after the disable ran (record kept, resources emptied per
  // ENBL-02), the re-plan must converge to the empty plan.
  const disabled = stateWithDisabledRecord("mp", "acme/tools", "cr");
  const planAfter = planReconcile(merged, disabled, "project");
  assert.deepEqual(planAfter, emptyReconcilePlan("project"));
});

test("ENBL-02 (d): NOT recorded + enabled!==false -> pluginsToInstall ONLY, NEVER both (mutual exclusion)", () => {
  // A NOT-recorded plugin lands in pluginsToInstall (not pluginsToEnable).
  // The recorded-but-disabled check is gated on `recorded === true` so the
  // install branch and the enable branch are structurally mutually
  // exclusive for the same plugin in the same planner pass.
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToInstall.length, 1);
  assert.equal(plan.pluginsToEnable.length, 0);
  const ins = plan.pluginsToInstall[0];
  assert.ok(ins);
  assert.equal(ins.plugin, "cr");
});

test("ENBL-02 (e): back-to-back planReconcile against same inputs returns deepEqual plans (purity preserved across enable branch)", () => {
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr");
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );
  const plan1 = planReconcile(merged, state, "project");
  const plan2 = planReconcile(merged, state, "project");
  assert.deepEqual(plan1, plan2);
  // Ensure both runs produced the non-empty bucket (guards against an
  // accidental same-empty-shape false positive).
  assert.equal(plan1.pluginsToEnable.length, 1);
  assert.equal(plan2.pluginsToEnable.length, 1);
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

test("Edge: dangling plugin reference (mp not in declared nor recorded) -> PlannedSourceMismatch with cause=dangling-reference", () => {
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  const merged = mergeScopeConfigs(configWith({}, { "cr@phantom-mp": { enabled: true } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.sourceMismatches.length, 1);
  const dangling = plan.sourceMismatches[0];
  assert.ok(dangling);
  assert.equal(dangling.cause, "dangling-reference");
  if (dangling.cause !== "dangling-reference") {
    throw new Error("test fixture broken -- expected cause=dangling-reference");
  }

  assert.equal(dangling.marketplace, "phantom-mp");
  // WR-03: the diagnostic carries the plugin component of the offending
  // config key so N dangling plugins under one undeclared marketplace stay
  // individually attributable.
  assert.equal(dangling.plugin, "cr");
  // Crucially, the dangling reference does NOT land in pluginsToInstall.
  assert.equal(plan.pluginsToInstall.length, 0);
});

test("Edge: declared plugin under a recorded-but-undeclared marketplace -> dangling diagnostic, NOT install (WR-01)", () => {
  // The realistic "user deleted the marketplace entry but forgot the plugin
  // entry" config: mp exists only in state (-> marketplacesToRemove) while
  // cr@mp is still declared. Classifying cr as an install would produce a
  // self-contradictory plan ("will remove" mp AND "will install" cr into
  // it) that the apply path would consume verbatim. The entry must
  // surface as a dangling diagnostic instead.
  const state = stateWithOneGithubMarketplace("mp", "acme/tools");
  const merged = mergeScopeConfigs(configWith({}, { "cr@mp": { enabled: true } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.marketplacesToRemove.length, 1);
  assert.equal(plan.pluginsToInstall.length, 0);
  assert.equal(plan.sourceMismatches.length, 1);
  const dangling = plan.sourceMismatches[0];
  assert.ok(dangling);
  assert.equal(dangling.cause, "dangling-reference");
  if (dangling.cause !== "dangling-reference") {
    throw new Error("test fixture broken -- expected cause=dangling-reference");
  }

  assert.equal(dangling.marketplace, "mp");
  assert.equal(dangling.plugin, "cr");
});

test("Edge: declared-disabled plugin under a recorded-but-undeclared marketplace -> dangling diagnostic, NOT disable (WR-01)", () => {
  // Symmetric to the install case: a disable under a marketplace being torn
  // down is equally contradictory (the teardown subsumes the artefact
  // removal); the entry surfaces as a dangling diagnostic.
  const state = stateWithOneGithubMarketplace("mp", "acme/tools", ["cr"]);
  const merged = mergeScopeConfigs(configWith({}, { "cr@mp": { enabled: false } }), {});
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.marketplacesToRemove.length, 1);
  assert.equal(plan.pluginsToDisable.length, 0);
  assert.equal(plan.pluginsToInstall.length, 0);
  assert.equal(plan.sourceMismatches.length, 1);
  const dangling = plan.sourceMismatches[0];
  assert.ok(dangling);
  assert.equal(dangling.cause, "dangling-reference");
  if (dangling.cause !== "dangling-reference") {
    throw new Error("test fixture broken -- expected cause=dangling-reference");
  }

  assert.equal(dangling.plugin, "cr");
});

test("Edge: malformed plugin keys -> diagnostic with raw key as subject, NEVER silently dropped (WR-02)", () => {
  // A user who declares "my-plugin": {} (forgot the @marketplace suffix)
  // must get a (failed) diagnostic, not a preview that simply omits the
  // entry -- the command's whole purpose is surfacing config<->state
  // divergence. Three malformed shapes: no `@`, leading `@`, trailing `@`.
  const state: ExtensionState = { schemaVersion: 1, marketplaces: {} };
  const merged = mergeScopeConfigs(
    configWith(
      {},
      {
        "my-plugin": {},
        "@leading": {},
        "trailing@": {},
      },
    ),
    {},
  );
  const plan = planReconcile(merged, state, "project");
  assert.equal(plan.pluginsToInstall.length, 0);
  assert.equal(plan.sourceMismatches.length, 3);
  const rawKeys: string[] = [];
  for (const mm of plan.sourceMismatches) {
    assert.equal(mm.cause, "malformed-plugin-key");
    if (mm.cause !== "malformed-plugin-key") {
      throw new Error("test fixture broken -- expected cause=malformed-plugin-key");
    }

    rawKeys.push(mm.rawKey);
  }

  // The raw keys are carried verbatim as the renderable subjects.
  assert.deepEqual(rawKeys.sort(), ["@leading", "my-plugin", "trailing@"]);
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

// ──────────────────────────────────────────────────────────────────────────
// T5 / PR #51: predicate-drift agreement between
// `isRecordedButDisabled` (plan.ts) and `isCurrentlyDisabled`
// (enable-disable.ts). The two predicates are deliberately duplicated --
// enable-disable.ts duplicates the marker locally to avoid pulling the
// reconcile module into the orchestrator's import graph (see the JSDoc on
// `isCurrentlyDisabled` at enable-disable.ts:172-178). The duplication is
// load-bearing for the convergence proof at plan-convergence.test.ts: a
// soft-degraded (installable: false) plugin records all four resource
// arrays empty AND must NOT be classified as `pluginsToEnable`, so both
// predicates must read the installable axis the same way.
//
// This drift gate has two parts:
//   1. A matrix truth-table assertion on `isRecordedButDisabled` over
//      `installable: true | false` x `resources: empty | populated`,
//      pinning the documented "all four empty + installable: true" cell as
//      the only "disabled" cell.
//   2. A source-shape pin: `isCurrentlyDisabled`'s function body in
//      enable-disable.ts is the same `installable && skills.length===0 &&
//      prompts.length===0 && agents.length===0 && mcpServers.length===0`
//      conjunction. Since `isCurrentlyDisabled` is module-private (kept
//      out of the reconcile import graph by design), the structural pin
//      protects against a hand-edit that flips one branch but forgets the
//      other.
// ──────────────────────────────────────────────────────────────────────────

interface DisabledMarkerRecord {
  compatibility: {
    installable: boolean;
    notes: string[];
    supported: string[];
    unsupported: string[];
  };
  resources: {
    skills: string[];
    prompts: string[];
    agents: string[];
    mcpServers: string[];
  };
  version: string;
  resolvedSource: string;
  installedAt: string;
  updatedAt: string;
}

function recordWith(installable: boolean, populated: boolean): DisabledMarkerRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/abs/whatever",
    compatibility: { installable, notes: [], supported: [], unsupported: [] },
    resources: populated
      ? { skills: ["s1"], prompts: [], agents: [], mcpServers: [] }
      : { skills: [], prompts: [], agents: [], mcpServers: [] },
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("T5 / PR #51: isRecordedButDisabled truth table over the installable x populated matrix -- only the (installable: true, populated: false) cell is 'disabled'", () => {
  const cases: ReadonlyArray<{
    name: string;
    installable: boolean;
    populated: boolean;
    expected: boolean;
  }> = [
    {
      name: "installable: true,  populated: true  (currently installed and enabled)",
      installable: true,
      populated: true,
      expected: false,
    },
    {
      name: "installable: true,  populated: false (the ENBL-02 disabled marker)",
      installable: true,
      populated: false,
      expected: true,
    },
    {
      name: "installable: false, populated: true  (impossible by construction; never disabled)",
      installable: false,
      populated: true,
      expected: false,
    },
    {
      name: "installable: false, populated: false (soft-degraded -- D-04 / Rule 2; never disabled)",
      installable: false,
      populated: false,
      expected: false,
    },
  ];
  for (const c of cases) {
    const rec = recordWith(c.installable, c.populated);
    assert.equal(
      isRecordedButDisabled(rec),
      c.expected,
      `T5: isRecordedButDisabled mismatch for cell -- ${c.name}`,
    );
  }
});

test("T5 / PR #51: isCurrentlyDisabled (enable-disable.ts) source-shape pin -- same installable + four-axis-empty conjunction as isRecordedButDisabled (drift gate)", async () => {
  // The two predicates are deliberately duplicated (see the JSDoc on
  // `isCurrentlyDisabled` at enable-disable.ts:172-178) to keep the
  // orchestrator import graph free of the reconcile module. The drift
  // gate: assert the function body still names the same boolean axes in
  // the same conjunction, so a hand-edit that flips one side without the
  // other trips this test before it reaches the convergence proof.
  const { readFile } = await import("node:fs/promises");
  const enableSrc = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
    "utf8",
  );

  // Extract the isCurrentlyDisabled function body (signature + return
  // expression). The function is module-private; we match its declaration
  // textually and assert the body carries every axis isRecordedButDisabled
  // also tests.
  const fnMatch = /function isCurrentlyDisabled\([\s\S]*?\): boolean \{([\s\S]*?)\n\}/.exec(
    enableSrc,
  );
  assert.ok(
    fnMatch,
    "T5: isCurrentlyDisabled declaration not found -- has the helper been renamed or removed without updating the drift gate?",
  );
  const body = fnMatch[1]!;

  // Each axis from isRecordedButDisabled must appear in the
  // isCurrentlyDisabled body (same conjunction). If any axis is missing or
  // renamed, the predicates have drifted.
  const requiredAxes: ReadonlyArray<string> = [
    "compatibility.installable",
    "resources.skills.length === 0",
    "resources.prompts.length === 0",
    "resources.agents.length === 0",
    "resources.mcpServers.length === 0",
  ];
  for (const axis of requiredAxes) {
    assert.ok(
      body.includes(axis) ||
        // The orchestrator destructures `installed.resources` / `installed.compatibility`
        // before the conjunction, so the textual form drops the `installed.` prefix.
        body.includes(axis.replace("compatibility.installable", "installable")),
      `T5 drift: isCurrentlyDisabled body must reference \`${axis}\` (same axis as isRecordedButDisabled); body was:\n${body}`,
    );
  }

  // The connectives must all be conjunctions (&&) -- a stray || would flip
  // the predicate to "disabled if ANY axis is empty", catastrophically
  // misclassifying populated records.
  assert.ok(
    !body.includes("||"),
    `T5 drift: isCurrentlyDisabled body must NOT contain || (disjunction would flip the truth table); body was:\n${body}`,
  );
});
