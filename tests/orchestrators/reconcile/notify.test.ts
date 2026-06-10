import assert from "node:assert/strict";
import test from "node:test";

import { buildReconcilePreviewNotification } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { ReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * DIFF-01 plan-to-message projection tests. Plan 01 asserts STRUCTURAL
 * shape only; the byte-exact rendered output (token strings, catalog
 * states, FIXTURES) lands in Plan 02 alongside the renderer arms it
 * exercises. The placeholder status strings used here ("added",
 * "removed", "failed") are Plan 01 stubs that Plan 02 replaces with the
 * pending-tense token set.
 */

function emptyPlan(scope: Scope): ReconcilePlan {
  return {
    scope,
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    sourceMismatches: [],
  };
}

test("empty plan list -> empty marketplaces array", () => {
  const msg = buildReconcilePreviewNotification([]);
  assert.deepEqual(msg, { marketplaces: [] });
});

test("plan with no actions -> empty marketplaces array", () => {
  const msg = buildReconcilePreviewNotification([emptyPlan("project")]);
  assert.deepEqual(msg.marketplaces, []);
});

test("one plan with one MarketplaceAdd -> one MarketplaceNotificationMessage", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
    ],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "mp");
  assert.equal(block.scope, "project");
  assert.equal(block.status, "added");
  assert.deepEqual([...block.plugins], []);
});

test("blocks ordered by name-then-scope (alpha before zebra)", () => {
  const userZebra: ReconcilePlan = {
    ...emptyPlan("user"),
    marketplacesToAdd: [
      { scope: "user", marketplace: "zebra", source: "acme/z", configSource: "base" },
    ],
  };
  const projectAlpha: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "alpha", source: "acme/a", configSource: "base" },
    ],
  };
  const msg = buildReconcilePreviewNotification([userZebra, projectAlpha]);
  assert.equal(msg.marketplaces.length, 2);
  const first = msg.marketplaces[0];
  const second = msg.marketplaces[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.name, "alpha");
  assert.equal(second.name, "zebra");
});

test("same-name marketplaces ordered project-before-user", () => {
  const userMp: ReconcilePlan = {
    ...emptyPlan("user"),
    marketplacesToAdd: [
      { scope: "user", marketplace: "shared", source: "u/r", configSource: "base" },
    ],
  };
  const projectMp: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "shared", source: "p/r", configSource: "base" },
    ],
  };
  const msg = buildReconcilePreviewNotification([userMp, projectMp]);
  assert.equal(msg.marketplaces.length, 2);
  const first = msg.marketplaces[0];
  const second = msg.marketplaces[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.scope, "project");
  assert.equal(second.scope, "user");
});

test("one plan with one PluginInstall under one MarketplaceAdd -> plugin nested under marketplace", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "mp", source: "acme/t", configSource: "base" },
    ],
    pluginsToInstall: [{ scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" }],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "mp");
  assert.equal(block.status, "added");
  assert.equal(block.plugins.length, 1);
  const pluginRow = block.plugins[0];
  assert.ok(pluginRow);
  assert.equal(pluginRow.name, "cr");
});

test("MarketplaceRemove projection -> block.status='removed'", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToRemove: [{ scope: "project", marketplace: "old-mp" }],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "old-mp");
  assert.equal(block.status, "removed");
});

test("sourceMismatch projection -> block.status='failed'", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    sourceMismatches: [
      {
        scope: "project",
        marketplace: "mp",
        declaredSource: "acme/new",
        recordedSource: "https://github.com/acme/old",
        cause: "source-mismatch",
      },
    ],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.status, "failed");
});

test("PluginUninstall projection -> plugin row under marketplace block", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToUninstall: [{ scope: "project", plugin: "cr", marketplace: "mp" }],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  // The marketplace block is implicitly created with no status (the
  // ensureMarketplaceBlock factory does not require a marketplace-level
  // action), and the plugin row is nested under it.
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "mp");
  assert.equal(block.plugins.length, 1);
  const pluginRow = block.plugins[0];
  assert.ok(pluginRow);
  assert.equal(pluginRow.name, "cr");
});
