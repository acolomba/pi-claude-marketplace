import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePreviewNotification,
  isReconcilePlanListEmpty,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * DIFF-01 + DIFF-02 plan-to-message projection tests. DIFF-02 replaced
 * the initial DIFF-01 placeholder status strings ("added" / "removed" /
 * "uninstalled") on the projection's output with the pending-tense
 * `will *` token set; the structural shape tests are unchanged.
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
  assert.equal(block.status, "will add");
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
  assert.equal(block.status, "will add");
  assert.equal(block.plugins.length, 1);
  const pluginRow = block.plugins[0];
  assert.ok(pluginRow);
  assert.equal(pluginRow.name, "cr");
  assert.equal(pluginRow.status, "will install");
});

test("MarketplaceRemove projection -> block.status='will remove'", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToRemove: [{ scope: "project", marketplace: "old-mp" }],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "old-mp");
  assert.equal(block.status, "will remove");
});

test("sourceMismatch projection -> block.status='failed' + reasons=['source mismatch']", () => {
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
  // The source-mismatch row reuses the existing
  // "source mismatch" REASONS member; no new REASONS literal.
  assert.ok("reasons" in block);
  assert.deepEqual("reasons" in block ? [...(block.reasons ?? [])] : [], ["source mismatch"]);
});

test("Y2 byte-neutral preview projection: all four PlannedSourceMismatch causes produce identical block bytes (failed + reasons=['source mismatch'])", () => {
  // The Y2 widening of PlannedSourceMismatch from a fused 2-discriminant
  // shape (with sentinel strings in data fields) to four per-cause variants
  // MUST keep the rendered byte form identical to the pre-cut output. The
  // catalog UAT byte gate proves this end-to-end; this unit-level table
  // pins the byte-equality at the projection seam (closer to the cut).
  const matrix: readonly {
    name: string;
    mismatch: ReconcilePlan["sourceMismatches"][number];
    expectedSubject: string;
    expectedPlugins: readonly { name: string; status: string }[];
  }[] = [
    {
      name: "source-mismatch (declared + recorded both recognised)",
      mismatch: {
        scope: "project",
        cause: "source-mismatch",
        marketplace: "mp",
        declaredSource: "acme/new",
        recordedSource: "https://github.com/acme/old",
      },
      expectedSubject: "mp",
      expectedPlugins: [],
    },
    {
      name: "unknown-stored (stored shape unrecognised)",
      mismatch: {
        scope: "project",
        cause: "unknown-stored",
        marketplace: "mp",
        declaredSource: "acme/new",
        recordedSource: "[object Object]",
      },
      expectedSubject: "mp",
      expectedPlugins: [],
    },
    {
      name: "dangling-reference (plugin under undeclared mp)",
      mismatch: {
        scope: "project",
        cause: "dangling-reference",
        marketplace: "phantom-mp",
        plugin: "cr",
      },
      expectedSubject: "phantom-mp",
      expectedPlugins: [{ name: "cr", status: "failed" }],
    },
    {
      name: "malformed-plugin-key (raw key as subject)",
      mismatch: {
        scope: "project",
        cause: "malformed-plugin-key",
        rawKey: "my-plugin",
      },
      expectedSubject: "my-plugin",
      expectedPlugins: [],
    },
  ];

  for (const c of matrix) {
    const plan: ReconcilePlan = {
      ...emptyPlan("project"),
      sourceMismatches: [c.mismatch],
    };
    const msg = buildReconcilePreviewNotification([plan]);
    assert.equal(msg.marketplaces.length, 1, `${c.name}: expected one block`);
    const block = msg.marketplaces[0];
    assert.ok(block, `${c.name}: block missing`);
    // Byte-stable header: status='failed' + reasons=['source mismatch'].
    assert.equal(block.status, "failed", c.name);
    assert.ok("reasons" in block, `${c.name}: reasons field missing`);
    assert.deepEqual(
      "reasons" in block ? [...(block.reasons ?? [])] : [],
      ["source mismatch"],
      c.name,
    );
    // Byte-stable subject derivation: marketplace name for the first three
    // causes, raw key for malformed-plugin-key.
    assert.equal(block.name, c.expectedSubject, c.name);
    // Byte-stable plugin children: only dangling-reference attributes a
    // child row; the other three variants leave plugins empty.
    assert.deepEqual(
      [...block.plugins].map((p) => ({ name: p.name, status: p.status })),
      [...c.expectedPlugins],
      c.name,
    );
  }
});

test("Y2 byte-neutral applied-cascade projection: all four SourceMismatchOutcome causes produce identical block bytes", () => {
  // Mirror of the Y2 preview table for the apply-cascade projection. The
  // SourceMismatchOutcome variants propagate the per-cause discriminant
  // from PlannedSourceMismatch -- the renderer derives the byte-stable
  // header + plugin children from each variant identically.
  const matrix: readonly {
    name: string;
    outcome: PerEntryOutcome;
    expectedSubject: string;
    expectedPlugins: readonly { name: string; status: string }[];
  }[] = [
    {
      name: "source-mismatch (mp-level)",
      outcome: {
        kind: "source-mismatch",
        cause: "source-mismatch",
        scope: "project",
        marketplace: "mp",
      },
      expectedSubject: "mp",
      expectedPlugins: [],
    },
    {
      name: "unknown-stored (mp-level)",
      outcome: {
        kind: "source-mismatch",
        cause: "unknown-stored",
        scope: "project",
        marketplace: "mp",
      },
      expectedSubject: "mp",
      expectedPlugins: [],
    },
    {
      name: "dangling-reference (plugin attributed)",
      outcome: {
        kind: "source-mismatch",
        cause: "dangling-reference",
        scope: "project",
        marketplace: "phantom-mp",
        plugin: "cr",
      },
      expectedSubject: "phantom-mp",
      expectedPlugins: [{ name: "cr", status: "failed" }],
    },
    {
      name: "malformed-plugin-key (raw key as subject)",
      outcome: {
        kind: "source-mismatch",
        cause: "malformed-plugin-key",
        scope: "project",
        rawKey: "my-plugin",
      },
      expectedSubject: "my-plugin",
      expectedPlugins: [],
    },
  ];

  for (const c of matrix) {
    const msg = buildReconcileAppliedCascade([c.outcome]);
    assert.equal(msg.marketplaces.length, 1, `${c.name}: expected one block`);
    const block = msg.marketplaces[0];
    assert.ok(block, `${c.name}: block missing`);
    assert.equal(block.status, "failed", c.name);
    assert.ok("reasons" in block, `${c.name}: reasons field missing`);
    assert.deepEqual(
      "reasons" in block ? [...(block.reasons ?? [])] : [],
      ["source mismatch"],
      c.name,
    );
    assert.equal(block.name, c.expectedSubject, c.name);
    assert.deepEqual(
      [...block.plugins].map((p) => ({ name: p.name, status: p.status })),
      [...c.expectedPlugins],
      c.name,
    );
  }
});

test("Y4 byte-neutral applied-cascade projection: InvalidBlockOutcome.basename keys the block, cause-chain child surfaces basename", () => {
  // Y4 renamed InvalidBlockOutcome's basename-carrying field from the
  // punned `marketplace` to `basename`. The projection MUST derive the
  // block-keying subject + the synthetic cause-chain child's name from the
  // renamed field; rendered output stays byte-identical.
  const outcome: PerEntryOutcome = {
    kind: "invalid-block",
    scope: "project",
    basename: "claude-plugins.json",
    reason: "invalid manifest",
    cause: new Error("schema validation failed for marketplaces"),
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "claude-plugins.json");
  assert.equal(block.status, "failed");
  assert.ok("reasons" in block);
  assert.deepEqual("reasons" in block ? [...(block.reasons ?? [])] : [], ["invalid manifest"]);
  // The synthetic cause-chain child (I5 surface) reuses the basename as its
  // row name so the cause trailer renders below the right subject.
  assert.equal(block.plugins.length, 1);
  const child = block.plugins[0];
  assert.ok(child);
  assert.equal(child.name, "claude-plugins.json");
});

test("dangling-reference mismatch (plugin attributed) -> child (failed) {source mismatch} plugin row (WR-03)", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    sourceMismatches: [
      {
        scope: "project",
        cause: "dangling-reference",
        marketplace: "phantom-mp",
        plugin: "cr",
      },
      {
        scope: "project",
        cause: "dangling-reference",
        marketplace: "phantom-mp",
        plugin: "cr2",
      },
    ],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.status, "failed");
  // Each dangling plugin stays individually attributable as a child
  // (failed) row -- N dangling plugins do NOT collapse into one anonymous
  // marketplace row.
  assert.equal(block.plugins.length, 2);
  assert.deepEqual(
    [...block.plugins].map((p) => [p.name, p.status]),
    [
      ["cr", "failed"],
      ["cr2", "failed"],
    ],
  );
});

test("PluginUninstall projection -> plugin row under marketplace block with (will uninstall) status", () => {
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
  assert.equal(pluginRow.status, "will uninstall");
});

test("PluginDisable projection -> plugin row with (will disable) status", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToDisable: [{ scope: "project", plugin: "cr", marketplace: "mp" }],
  };
  const msg = buildReconcilePreviewNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "will disable");
});

test("isReconcilePlanListEmpty: empty list -> true", () => {
  assert.equal(isReconcilePlanListEmpty([]), true);
});

test("isReconcilePlanListEmpty: every-bucket-empty plan -> true", () => {
  assert.equal(isReconcilePlanListEmpty([emptyPlan("project"), emptyPlan("user")]), true);
});

test("isReconcilePlanListEmpty: any non-empty bucket -> false", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToInstall: [{ scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" }],
  };
  assert.equal(isReconcilePlanListEmpty([plan]), false);
});
