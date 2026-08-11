import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { mergeScopeConfigs } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { isRecordedButDisabled } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
      resources: { skills: ["s1"], prompts: [], agents: [], mcpServers: [], hooks: [] },
      enabled: true,
      installedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
  }

  return {
    schemaVersion: 2,
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
      resources: { skills: ["s1"], prompts: [], agents: [], mcpServers: [], hooks: [] },
      enabled: true,
      installedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
  }

  return {
    schemaVersion: 2,
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
  // WILL-03 / D-65.1-03: PlannedMarketplaceRemove carries the recorded plugin
  // names so the PENDING projection can synthesize per-plugin will-uninstall
  // rows; this marketplace records no plugins, so `plugins` is empty.
  assert.deepEqual(plan.marketplacesToRemove[0], {
    scope: "project",
    marketplace: "mp",
    plugins: [],
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
 * Build a state with a recorded plugin carrying the disabled marker -- the
 * explicit `enabled: false` boolean (ENBL-05) -- and every `resources.*` array
 * emptied, which is what the disable path leaves behind.
 *
 * `opts.unsupported` seeds the soft-degraded axis: a non-empty list derives
 * `installable: false`, giving the disabled PARTIAL shape. The two axes are
 * orthogonal, so the default (an empty list) is the canonical fully-available
 * disabled record.
 */
function stateWithDisabledRecord(
  mpName: string,
  rawSource: string,
  plugin: string,
  opts: { readonly unsupported?: readonly string[] } = {},
): ExtensionState {
  const unsupported = opts.unsupported ?? [];
  return {
    schemaVersion: 2,
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
            compatibility: {
              installable: unsupported.length === 0,
              notes: [],
              supported: [],
              unsupported: [...unsupported],
            },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: false,
            installedAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
}

test("ENBL-02 self-heal: migrated legacy-disabled record (state enabled:true + empty resources) + config-disabled -> pluginsToDisable non-empty", () => {
  // After migration a legacy-disabled plugin is mislabeled state enabled:true
  // while its resources stay empty (see migrate.test.ts). The config still
  // carries enabled:false, so reconcile must emit exactly one disable to
  // re-converge: isRecordedButDisabled is false (enabled:true), so the
  // declared-disabled branch fires the disable action rather than treating it
  // as steady state.
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr");
  state.marketplaces["mp"]!.plugins["cr"]!.enabled = true;
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
  assert.equal(plan.pluginsToEnable.length, 0);
});

test("ENBL-02 (a): recorded + state enabled:false + config-enabled -> pluginsToEnable non-empty (isRecordedButDisabled fires)", () => {
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

  // Step 1: artifacts still materialised -> the planner emits the disable.
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

test("ENBL-08: two identical planReconcile passes over a disabled PARTIAL both return the empty plan (fixed point)", () => {
  // The record is the shape ENBL-05 made recognizable: soft-degraded
  // (`installable: false` with an unsupported kind) AND explicitly disabled,
  // every `resources.*` array empty. The config declares it disabled, so the
  // declared-disabled branch must read it as converged. Re-planning the disable
  // on every load would re-run the whole unstage cascade forever and the
  // reconcile would never quiesce. The planner is pure (DIFF-01), so two
  // identical calls prove the fixed point without an apply step.
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr", {
    unsupported: ["lspServers"],
  });
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: false } }),
    {},
  );

  const pass1 = planReconcile(merged, state, "project");
  const pass2 = planReconcile(merged, state, "project");
  assert.deepEqual(pass1, emptyReconcilePlan("project"));
  assert.deepEqual(pass2, emptyReconcilePlan("project"));

  // Mutual exclusion asserted by identifier rather than left to the empty-plan
  // equality alone: a later change that populated BOTH buckets must not be able
  // to pass by deep-equalling some other empty-ish shape.
  for (const plan of [pass1, pass2]) {
    assert.ok(
      !plan.pluginsToDisable.some((p) => p.plugin === "cr" && p.marketplace === "mp"),
      "cr@mp must not appear in the disable bucket",
    );
    assert.ok(
      !plan.pluginsToEnable.some((p) => p.plugin === "cr" && p.marketplace === "mp"),
      "cr@mp must not appear in the enable bucket",
    );
  }
});

test("ENBL-05 / ENBL-08 counter-case: a config-declared-ENABLED disabled PARTIAL reaches the enable bucket", () => {
  // The same record under the opposite declaration. This is what makes the
  // fixed point above a property of the disabled DECLARATION rather than of a
  // record the planner simply cannot see: before the ENBL-05 collapse the
  // enable bucket was unreachable for a partially-installed plugin.
  const state = stateWithDisabledRecord("mp", "acme/tools", "cr", {
    unsupported: ["lspServers"],
  });
  const merged = mergeScopeConfigs(
    configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
    {},
  );

  const plan = planReconcile(merged, state, "project");
  assert.deepEqual(plan.pluginsToEnable, [{ scope: "project", plugin: "cr", marketplace: "mp" }]);
  assert.equal(plan.pluginsToDisable.length, 0);
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
  // self-contradictory plan (removing mp AND installing cr into it) that the
  // apply path would consume verbatim. The entry must surface as a dangling
  // diagnostic instead.
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
  // down is equally contradictory (the teardown subsumes the artifact
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
  // must get a (failed) diagnostic, not a pending listing that simply omits the
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
// ENBL-05: the disabled-state predicate has ONE definition -- exported from
// `persistence/state-io.ts` as the read-side twin of `toDisabledRecord` --
// and it reads ONLY the explicit `enabled` boolean. The availability axis
// (`compatibility.installable`) is deliberately not an input: the disable
// orchestrator places no availability guard before writing `enabled: false`,
// so a soft-degraded record can be explicitly disabled too, and merging the
// two axes made every surface misread that record.
//
// Two gates live below:
//   1. A matrix truth-table assertion over
//      `installable: true | false` x `enabled: true | false`. Every
//      `enabled: false` cell is disabled; the (installable: false,
//      enabled: true) cell stays NOT disabled and is the over-reach guard --
//      it is the shape the convergence proof at plan-convergence.test.ts
//      rests on (a soft-degraded but never-disabled plugin must not be
//      planned as `pluginsToEnable`).
//   2. A source gate asserting no module re-derives the predicate locally.
//      It is a WALK of the whole extension tree, not an allowlist of the
//      sites that once held a copy: an allowlist is structurally blind to the
//      next copy, which is exactly how a fifth twin landed in
//      `reconcile/apply.ts` while the gate stayed green. Two checks run over
//      every source file -- the removed two-axis conjunction must be absent,
//      and the inline single-axis rederivation (`!rec.enabled` and its
//      `=== false` / `!== true` spellings) must be absent outside the module
//      that DEFINES the predicate. The former-definition sites additionally
//      have to import it, which pins the collapse itself.
// ──────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const EXTENSION_SOURCE_ROOT = "extensions/pi-claude-marketplace";

/** The four modules that each held their own copy of the predicate. */
const FORMER_DEFINITION_SITES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts",
];

/**
 * The module that OWNS the rule. It is the one place the `enabled` boolean may
 * be read directly, because reading it there IS the definition.
 */
const PREDICATE_DEFINITION_SITE = "extensions/pi-claude-marketplace/persistence/state-io.ts";

/** The removed two-axis conjunction, in any of its parameter spellings. */
const TWO_AXIS_CONJUNCTION = /compatibility\.installable\s*&&\s*![\w.]+\.enabled/;

/**
 * D-99-02b: a destructure that BINDS the `enabled` key. `[^{}]*` never crosses a
 * nested brace, and the `=` must follow the closing brace, so an object LITERAL
 * carrying an `enabled` property (its `=` precedes the brace) cannot reach the
 * match.
 *
 * WR-05: unlike its two siblings this pattern carries NO axis anchor, and that
 * is deliberate rather than an oversight. The source of a destructure is an
 * arbitrary expression -- `record`, `sRecord`, `mp.plugins[plugin]`, a function
 * parameter -- so any anchor tight enough to exclude the config-declaration axis
 * is a naming heuristic that a real record-axis twin walks straight past, and a
 * drift gate that misses a twin has failed at the only job it has. The pattern
 * therefore FAILS CLOSED: it also flags a destructure off a config entry, which
 * is a false positive an author resolves by keeping that axis's established
 * non-destructured `entry.enabled !== false` spelling. `DELIBERATE_OVER_REACH`
 * below pins that reach as data, so the property is proven either way instead of
 * asserted in prose.
 */
const DESTRUCTURED_ENABLED_BINDING = /\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/;

/**
 * D-99-02b: bracket access to the `enabled` key. No legitimate use of it exists
 * anywhere in this tree, so the ACCESS shape is flagged unconditionally instead
 * of enumerating every negation and comparison that could wrap it.
 */
const BRACKET_ENABLED_ACCESS = /\[\s*["']enabled["']\s*\]/;

/**
 * D-99-02b: a `Boolean(...)` coercion wrapping an `.enabled` read -- again the
 * access shape, not the comparison. Requiring the read INSIDE the call leaves
 * the `Type.Boolean()` schema declarations alone, and the leading `\.` keeps
 * the pattern off the config-declaration axis.
 */
const BOOLEAN_ENABLED_COERCION = /Boolean\s*\([^)]*\.enabled\b[^)]*\)/;

/**
 * The single-axis rederivation, in the six spellings that mean "this record
 * is disabled": the three operator-adjacent forms, plus the destructured,
 * bracket-access and `Boolean()` twins that a `(`, a `[` or a bare bound
 * identifier would otherwise hide from them (D-99-02b). Deliberately does NOT
 * match `entry.enabled !== false`: that is the CONFIG-declaration axis
 * (`persistence/config-io.ts`), a different fact about a different object,
 * whose default is enabled-when-absent -- which is why the two ACCESS-shape
 * patterns keep their leading `[` or `Boolean(` anchor rather than matching a
 * bare `enabled`. WR-05: the destructured pattern has no such anchor and cannot
 * have one; it fails closed onto the config axis by design, pinned as data in
 * `DELIBERATE_OVER_REACH`. Every member is non-global: a `/g/` regex carries
 * `lastIndex` across `.test()` calls and would silently skip alternating files
 * in the walk.
 */
const INLINE_REDERIVATIONS: ReadonlyArray<RegExp> = [
  /!\s*[\w.]+\.enabled\b/,
  /\.enabled\s*===\s*false/,
  /\.enabled\s*!==\s*true/,
  DESTRUCTURED_ENABLED_BINDING,
  BRACKET_ENABLED_ACCESS,
  BOOLEAN_ENABLED_COERCION,
];

/**
 * D-99-02b: the twin spellings a gate built only from `!` and comparison
 * operators adjacent to an identifier path cannot see -- a `(`, a `[` or a bare
 * bound identifier each break the match. Held as DATA rather than described in
 * prose, so the proof below cannot be satisfied (or defeated) by comment text.
 */
const ESCAPING_TWIN_SPELLINGS: ReadonlyArray<{
  readonly label: string;
  readonly pattern: RegExp;
  readonly line: string;
}> = [
  {
    label: "destructured binding",
    pattern: DESTRUCTURED_ENABLED_BINDING,
    line: "const { enabled } = record;",
  },
  {
    label: "bracket access",
    pattern: BRACKET_ENABLED_ACCESS,
    line: 'if (!record["enabled"]) {',
  },
  {
    label: "Boolean() coercion",
    pattern: BOOLEAN_ENABLED_COERCION,
    line: "if (Boolean(record.enabled) === false) {",
  },
];

/**
 * The shapes every rederivation pattern must LEAVE ALONE: the config-declaration
 * axis (`persistence/config-io.ts`, a different object whose default is
 * enabled-when-absent) and a legitimate call into the single predicate.
 */
const NON_REDERIVATIONS: ReadonlyArray<{ readonly label: string; readonly line: string }> = [
  { label: "config-declaration axis", line: "if (entry.enabled !== false) {" },
  { label: "legitimate predicate call", line: "if (isRecordedButDisabled(record)) {" },
];

/**
 * WR-05: the shapes `DESTRUCTURED_ENABLED_BINDING` flags even though they are
 * NOT record-axis rederivations. Held as DATA next to the controls above so the
 * gate's actual reach is pinned rather than described: a future author who
 * tightens the pattern to exclude these has to delete this list to do it, which
 * is the conversation that tightening deserves. The trade is deliberate -- see
 * the pattern's own comment for why no anchor can separate the two axes here,
 * and why a false positive is the cheaper failure for a drift gate.
 *
 * The reach stops at the `=`: a TYPE-annotated destructured parameter
 * (`{ scope, enabled }: Args = defaults`) puts `: Args` between the brace and
 * the `=` and is not matched at all. That is a limit of matching the BINDING
 * rather than the use, and it is recorded here so the next reader does not
 * mistake the over-reach below for the pattern's full extent.
 */
const DELIBERATE_OVER_REACH: ReadonlyArray<{ readonly label: string; readonly line: string }> = [
  { label: "config-declaration destructure", line: "const { enabled } = entry;" },
  {
    label: "untyped destructured parameter",
    line: "function f({ scope, enabled } = defaults) {",
  },
];

/** Every `.ts` file under the extension source tree, repo-relative. */
async function extensionSourceFiles(): Promise<readonly string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    const entries = await readdir(path.join(REPO_ROOT, rel), { withFileTypes: true });
    for (const entry of entries) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(childRel);
      } else if (entry.name.endsWith(".ts")) {
        out.push(childRel);
      }
    }
  };

  await walk(EXTENSION_SOURCE_ROOT);
  return out;
}

/** The single-predicate import the collapse requires of every former site. */
const SINGLE_PREDICATE_IMPORT =
  /import\s*\{[^}]*\bisRecordedButDisabled\b[^}]*\}\s*from\s+["'][^"']*persistence\/state-io\.ts["']/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

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
    hooks: string[];
  };
  enabled: boolean;
  version: string;
  resolvedSource: string;
  installedAt: string;
  updatedAt: string;
}

function recordWith(installable: boolean, enabled: boolean): DisabledMarkerRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/abs/whatever",
    compatibility: { installable, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: enabled ? ["s1"] : [],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
    },
    enabled,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("ENBL-05: isRecordedButDisabled truth table over installable x enabled -- every enabled:false cell is disabled, regardless of availability", () => {
  // ENBL-05: the disabled marker is the explicit `enabled: false` boolean
  // alone. The availability axis is listed here only to prove the predicate
  // ignores it: the two `enabled: false` cells agree, and the two
  // `enabled: true` cells agree.
  const cases: ReadonlyArray<{
    name: string;
    installable: boolean;
    enabled: boolean;
    expected: boolean;
  }> = [
    {
      name: "installable: true,  enabled: true  (installed + enabled -- normal state)",
      installable: true,
      enabled: true,
      expected: false,
    },
    {
      name: "installable: true,  enabled: false (the canonical disabled record)",
      installable: true,
      enabled: false,
      expected: true,
    },
    {
      name: "installable: false, enabled: true  (soft-degraded but never disabled -- the over-reach guard; its supported components stay materialized and plan-convergence.test.ts proves it plans nothing)",
      installable: false,
      enabled: true,
      expected: false,
    },
    {
      name: "installable: false, enabled: false (a soft-degraded record the user explicitly disabled IS disabled -- the disable orchestrator writes `enabled: false` with no availability guard)",
      installable: false,
      enabled: false,
      expected: true,
    },
  ];
  for (const c of cases) {
    const rec = recordWith(c.installable, c.enabled);
    assert.equal(
      isRecordedButDisabled(rec),
      c.expected,
      `ENBL-05: isRecordedButDisabled mismatch for cell -- ${c.name}`,
    );
  }
});

test("ENBL-05: the transient all-empty-resources shape with enabled: true is NOT disabled", () => {
  // A record can legally carry `enabled: true` with every `resources.*` array
  // empty (the post-migration / pre-self-heal shape). The predicate reads the
  // boolean, never the arrays, so that shape stays enabled. The sibling half --
  // an on-disk record with NO `enabled` key loading as `true` -- is the migrate
  // fill pinned by `ENBL-02: ensurePluginEnabled fills enabled: true when
  // absent` in tests/persistence/migrate.test.ts.
  const emptied: DisabledMarkerRecord = {
    ...recordWith(true, true),
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
  };
  assert.equal(isRecordedButDisabled(emptied), false);
});

test("ENBL-05 / ENBL-18: a disabled record with a POPULATED inventory is still reported disabled", () => {
  // The `recordWith` fixture above encodes the retired "disabled implies
  // empty" rule as test data. That shape stays legal, but it is no longer the
  // only one a disabled record can take: disable now preserves every
  // `resources.*` array (D-100-10), so the predicate's array-independence has
  // to be proven against the shape this creates and not only against the one
  // it retires. The predicate reads the boolean; the arrays are irrelevant in
  // both directions.
  const retained: DisabledMarkerRecord = {
    ...recordWith(true, false),
    resources: {
      skills: ["s1"],
      prompts: ["c1"],
      agents: ["a1"],
      mcpServers: ["m1"],
      hooks: ["h1"],
    },
  };
  assert.equal(isRecordedButDisabled(retained), true);
});

test("ENBL-05: no disabled-state twin survives ANYWHERE in the extension tree -- the whole source walk, not an allowlist (drift gate)", async () => {
  // The gate this replaces enumerated the four sites that once held a copy, so
  // it was structurally blind to a NEW one: a fifth twin (`!record.enabled`)
  // landed in `orchestrators/reconcile/apply.ts` with the gate green. Walking
  // the tree makes the `state-io.ts` "SOLE predicate" claim enforceable
  // wherever a sixth copy lands. Comments are stripped FIRST: the surviving
  // JSDoc legally describes the removed rule in prose while explaining the
  // collapse.
  const offenders: string[] = [];
  for (const rel of await extensionSourceFiles()) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));

    if (TWO_AXIS_CONJUNCTION.test(stripped)) {
      offenders.push(
        `${rel} re-derives the disabled state from the availability axis (${String(TWO_AXIS_CONJUNCTION)})`,
      );
    }

    if (rel === PREDICATE_DEFINITION_SITE) {
      continue;
    }

    for (const re of INLINE_REDERIVATIONS) {
      if (re.test(stripped)) {
        offenders.push(
          `${rel} re-derives the disabled state inline (${String(re)}) -- call isRecordedButDisabled instead, OR, if this is the config-declaration axis, keep its non-destructured \`entry.enabled !== false\` spelling (WR-05: the destructured pattern fails closed onto that axis)`,
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `ENBL-05 violation: a local disabled-state twin survives:\n  ${offenders.join("\n  ")}`,
  );
});

test("ENBL-05: the drift gate flags the destructured, bracket-access and Boolean() twin spellings (D-99-02b)", () => {
  // The whole-tree walk proves no twin survives in the tree TODAY; it cannot
  // prove the gate would see one that landed tomorrow. These literals stand in
  // for that future twin, so the gate's reach is pinned rather than assumed.
  for (const twin of ESCAPING_TWIN_SPELLINGS) {
    assert.ok(
      twin.pattern.test(twin.line),
      `ENBL-05: ${String(twin.pattern)} does not flag the ${twin.label} twin -- ${twin.line}`,
    );

    for (const control of NON_REDERIVATIONS) {
      assert.ok(
        !twin.pattern.test(control.line),
        `ENBL-05: ${String(twin.pattern)} over-reaches onto the ${control.label} -- ${control.line}`,
      );
    }
  }

  for (const control of NON_REDERIVATIONS) {
    assert.ok(
      !INLINE_REDERIVATIONS.some((re) => re.test(control.line)),
      `ENBL-05: a rederivation pattern over-reaches onto the ${control.label} -- ${control.line}`,
    );
  }
});

test("ENBL-05 / WR-05: the destructured pattern's fail-closed reach is pinned, not assumed (D-99-02b)", () => {
  // The pattern's comment says it flags a destructure off ANY object because no
  // anchor can separate the record axis from the config axis at a destructure.
  // A claim about a gate's reach that only a comment carries is a claim the
  // next edit can silently falsify, so the reach is asserted here as data.
  for (const shape of DELIBERATE_OVER_REACH) {
    assert.ok(
      DESTRUCTURED_ENABLED_BINDING.test(shape.line),
      `ENBL-05: the destructured pattern no longer reaches the ${shape.label} -- ${shape.line}. If that narrowing is intended, the pattern's fail-closed rationale needs rewriting with it.`,
    );
  }
});

test("ENBL-05: every widened pattern reaches the source walk, and no pattern is global (D-99-02b)", () => {
  // A pattern proven against its twin literal but left out of the array is a
  // gate that passes its own self-test while seeing nothing. Membership is the
  // link between the proof above and the walk that consumes it.
  for (const twin of ESCAPING_TWIN_SPELLINGS) {
    assert.ok(
      INLINE_REDERIVATIONS.includes(twin.pattern),
      `ENBL-05: the ${twin.label} pattern is proven but never reaches the source walk`,
    );
  }

  for (const re of INLINE_REDERIVATIONS) {
    assert.equal(
      re.global,
      false,
      `ENBL-05: ${String(re)} is global -- lastIndex carries across .test() calls and would skip alternating files in the walk`,
    );
  }
});

test("ENBL-05: every former definition site imports the single persistence/state-io.ts predicate", async () => {
  // The absence walk above proves no site re-derives the rule; this pins the
  // other half of the collapse -- the four modules that each carried a copy
  // now CONSUME the one definition rather than having dropped the check
  // altogether.
  const offenders: string[] = [];
  for (const rel of FORMER_DEFINITION_SITES) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (!SINGLE_PREDICATE_IMPORT.test(stripped)) {
      offenders.push(`${rel} does not import isRecordedButDisabled from persistence/state-io.ts`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `ENBL-05 violation: a former definition site dropped the single predicate:\n  ${offenders.join("\n  ")}`,
  );
});
