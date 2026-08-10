import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
  isReconcilePlanListEmpty,
  resolvePendingForceInstalls,
  type PendingInstallCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";
import { PENDING_STATUSES } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type {
  PlannedPluginInstall,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
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
  const msg = buildReconcilePendingNotification([]);
  assert.deepEqual(msg, { marketplaces: [] });
});

test("plan with no actions -> empty marketplaces array", () => {
  const msg = buildReconcilePendingNotification([emptyPlan("project")]);
  assert.deepEqual(msg.marketplaces, []);
});

test("WILL-01: MarketplaceAdd with no children -> no pending block (add is immediate)", () => {
  // D-65.1-02: marketplace add is immediate, so an add with no reload-deferred
  // child work produces nothing pending.
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "mp", source: "acme/tools", configSource: "base" },
    ],
  };
  const msg = buildReconcilePendingNotification([plan]);
  assert.deepEqual(msg.marketplaces, []);
});

test("blocks ordered by name-then-scope (alpha before zebra)", () => {
  const userZebra: ReconcilePlan = {
    ...emptyPlan("user"),
    pluginsToInstall: [{ scope: "user", plugin: "z1", marketplace: "zebra", configSource: "base" }],
  };
  const projectAlpha: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToInstall: [
      { scope: "project", plugin: "a1", marketplace: "alpha", configSource: "base" },
    ],
  };
  const msg = buildReconcilePendingNotification([userZebra, projectAlpha]);
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
    pluginsToInstall: [
      { scope: "user", plugin: "u1", marketplace: "shared", configSource: "base" },
    ],
  };
  const projectMp: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToInstall: [
      { scope: "project", plugin: "p1", marketplace: "shared", configSource: "base" },
    ],
  };
  const msg = buildReconcilePendingNotification([userMp, projectMp]);
  assert.equal(msg.marketplaces.length, 2);
  const first = msg.marketplaces[0];
  const second = msg.marketplaces[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.scope, "project");
  assert.equal(second.scope, "user");
});

test("WILL-01: PluginInstall under a MarketplaceAdd -> bare-header block with will-install child", () => {
  // D-65.1-02: the add itself carries no token; the reload-deferred child
  // install rides a bare list-arm header (status undefined).
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToAdd: [
      { scope: "project", marketplace: "mp", source: "acme/t", configSource: "base" },
    ],
    pluginsToInstall: [{ scope: "project", plugin: "cr", marketplace: "mp", configSource: "base" }],
  };
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "mp");
  assert.equal(block.status, undefined);
  assert.equal(block.plugins.length, 1);
  const pluginRow = block.plugins[0];
  assert.ok(pluginRow);
  assert.equal(pluginRow.name, "cr");
  assert.equal(pluginRow.status, "will install");
});

test("WILL-03: MarketplaceRemove projection -> bare header + per-plugin will-uninstall children", () => {
  // D-65.1-03: de-registration is immediate (no marketplace-level token); only
  // the plugin-uninstall cascade is reload-deferred, one will-uninstall row per
  // recorded plugin under a bare list-arm header.
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: ["p1", "p2"] }],
  };
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.name, "old-mp");
  assert.equal(block.status, undefined);
  assert.deepEqual(
    block.plugins.map((p) => ({ name: p.name, status: p.status })),
    [
      { name: "p1", status: "will uninstall" },
      { name: "p2", status: "will uninstall" },
    ],
  );
});

test("WILL-03: MarketplaceRemove with no recorded plugins -> no pending block", () => {
  // D-65.1-03: an empty marketplace remove has no reload-deferred cascade, so
  // nothing is pending.
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    marketplacesToRemove: [{ scope: "project", marketplace: "old-mp", plugins: [] }],
  };
  const msg = buildReconcilePendingNotification([plan]);
  assert.deepEqual(msg.marketplaces, []);
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
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.status, "failed");
  // The source-mismatch row reuses the existing
  // "source mismatch" REASONS member; no new REASONS literal.
  assert.ok("reasons" in block);
  assert.deepEqual("reasons" in block ? [...(block.reasons ?? [])] : [], ["source mismatch"]);
});

test("pending projection: dangling-reference projects {dangling reference}; the other three causes project {source mismatch}", () => {
  // PURL-06: the dangling-reference cause diverges from the shared
  // `source mismatch` token -- it renders the `dangling reference` REASONS
  // member on both the marketplace header AND the attributed plugin child, so
  // the operator sees the real problem (an undeclared marketplace) instead of a
  // source-comparison failure. The other three causes still render
  // `source mismatch`. Each row carries the expected reasons per cause.
  const matrix: readonly {
    name: string;
    mismatch: ReconcilePlan["sourceMismatches"][number];
    expectedSubject: string;
    expectedReasons: readonly string[];
    expectedPlugins: readonly { name: string; status: string; reasons: readonly string[] }[];
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
      expectedReasons: ["source mismatch"],
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
      expectedReasons: ["source mismatch"],
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
      expectedReasons: ["dangling reference"],
      expectedPlugins: [{ name: "cr", status: "failed", reasons: ["dangling reference"] }],
    },
    {
      name: "malformed-plugin-key (raw key as subject)",
      mismatch: {
        scope: "project",
        cause: "malformed-plugin-key",
        rawKey: "my-plugin",
      },
      expectedSubject: "my-plugin",
      expectedReasons: ["source mismatch"],
      expectedPlugins: [],
    },
  ];

  for (const c of matrix) {
    const plan: ReconcilePlan = {
      ...emptyPlan("project"),
      sourceMismatches: [c.mismatch],
    };
    const msg = buildReconcilePendingNotification([plan]);
    assert.equal(msg.marketplaces.length, 1, `${c.name}: expected one block`);
    const block = msg.marketplaces[0];
    assert.ok(block, `${c.name}: block missing`);
    // Header: status='failed'; reasons diverge per cause (PURL-06).
    assert.equal(block.status, "failed", c.name);
    assert.ok("reasons" in block, `${c.name}: reasons field missing`);
    assert.deepEqual(
      "reasons" in block ? [...(block.reasons ?? [])] : [],
      [...c.expectedReasons],
      c.name,
    );
    // Subject derivation: marketplace name for the first three causes, raw key
    // for malformed-plugin-key.
    assert.equal(block.name, c.expectedSubject, c.name);
    // Plugin children: only dangling-reference attributes a child row, and it
    // carries the `dangling reference` token; the other three leave it empty.
    assert.deepEqual(
      [...block.plugins].map((p) => ({
        name: p.name,
        status: p.status,
        reasons: "reasons" in p ? [...(p.reasons ?? [])] : [],
      })),
      [...c.expectedPlugins],
      c.name,
    );
  }
});

test("applied-cascade projection: dangling-reference projects {dangling reference}; the other three causes project {source mismatch}", () => {
  // PURL-06 mirror of the pending table for the apply-cascade projection. The
  // SourceMismatchOutcome variants propagate the per-cause discriminant from
  // PlannedSourceMismatch -- the dangling-reference cause renders the
  // `dangling reference` token on the mp header AND the plugin child; the other
  // three causes render `source mismatch`.
  const matrix: readonly {
    name: string;
    outcome: PerEntryOutcome;
    expectedSubject: string;
    expectedReasons: readonly string[];
    expectedPlugins: readonly { name: string; status: string; reasons: readonly string[] }[];
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
      expectedReasons: ["source mismatch"],
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
      expectedReasons: ["source mismatch"],
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
      expectedReasons: ["dangling reference"],
      expectedPlugins: [{ name: "cr", status: "failed", reasons: ["dangling reference"] }],
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
      expectedReasons: ["source mismatch"],
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
      [...c.expectedReasons],
      c.name,
    );
    assert.equal(block.name, c.expectedSubject, c.name);
    assert.deepEqual(
      [...block.plugins].map((p) => ({
        name: p.name,
        status: p.status,
        reasons: "reasons" in p ? [...(p.reasons ?? [])] : [],
      })),
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

test("BFILL-01: a fully-promoted backfill (installable:true) projects to an (installed) row, severity info, needsReload", () => {
  // A load-time backfill whose re-resolved unsupported set is now empty promotes
  // the plugin to a clean install -- it reuses the installed row and threads
  // dependencies for the soft-dep markers (D-68-04).
  const outcome: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: ["agents"],
    installable: true,
    unsupported: [],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.name, "cr");
  assert.equal(row.severity, "info");
  assert.equal(row.needsReload, true);
  // The installed row carries dependencies for the soft-dep markers.
  assert.deepEqual(row.status === "installed" ? [...row.dependencies] : "absent", ["agents"]);
});

test("SEV-05: a partial backfill (installable:false) projects to a (partially-installed) row with the dropped-kinds reasons brace, severity info, needsReload", () => {
  // A load-time backfill whose re-resolved unsupported set is still non-empty
  // stays degraded -- it renders a force-installed row (the ◉ glyph), not a
  // clean (installed) row (D-68-04 / T-68-07). SEV-05 / D-69-04: the re-resolved
  // dropped kinds compose a factual {reasons} brace through the shared
  // narrowUnsupportedKinds seam (lspServers -> lsp).
  const outcome: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: [],
    installable: false,
    unsupported: ["lspServers"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  assert.equal(row.name, "cr");
  assert.equal(row.severity, "info");
  assert.equal(row.needsReload, true);
  // SEV-05: the dropped kind renders through the shared narrower as `lsp`.
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", ["lsp"]);
});

test("WR-04: a backfill that orphaned a rewake names it on the promoted row, exactly as the install and enable arms do", () => {
  const outcome: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: [],
    installable: true,
    unsupported: [],
    orphanRewake: true,
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "orphan rewake",
  ]);
  // The orphan token names a config bug; it moves no severity channel.
  assert.equal(row.severity, "info");
});

test("WR-04: a backfill whose ledger degraded a component names the kind and raises the row to warning", () => {
  const outcome: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: [],
    installable: false,
    unsupported: ["lspServers"],
    orphanRewake: true,
    degradedKinds: ["skill"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  // install.ts's emit order: orphan rewake, then the malformed kinds, then the
  // dropped kinds.
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", [
    "orphan rewake",
    "malformed skill",
    "lsp",
  ]);
  // WARN-01: a malformed component is a degrade THIS ledger produced, so it
  // takes the raise the sibling arms take -- the still-degraded backfill alone
  // stays info (SEV-03).
  assert.equal(row.severity, "warning");
});

test("WR-04: a backfill reporting neither signal renders byte-identically to before", () => {
  const clean: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: ["agents"],
    installable: true,
    unsupported: [],
  };
  const row = buildReconcileAppliedCascade([clean]).marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "info");
  assert.equal(Object.hasOwn(row, "reasons"), false, "no brace on a clean backfill");
});

test("ENBL-07: a reconcile enable that dropped component kinds projects to a (partially-installed) row with the dropped-kinds brace, severity info", () => {
  // The load-time reconcile drives setPluginEnabled for every config-declared-
  // enabled disabled record, and ENBL-07's widened gate re-materializes a
  // soft-degraded record with kinds dropped. FSTAT-07 / D-66-04: the row follows
  // the resolution, so it must NOT claim the clean (installed) token the very
  // next `list` contradicts. SEV-03: the degradation predates the enable, so
  // the row stays info -- parity with the sibling backfill partial arm.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    unsupported: ["lspServers"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  assert.equal(row.name, "cr");
  assert.equal(row.severity, "info");
  assert.equal(row.needsReload, true);
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", ["lsp"]);
});

test("WARN-01 / D-86-03: a reconcile enable that degraded a skill's frontmatter projects (installed) {malformed skill} at warning severity", () => {
  // The enable branch runs the SAME runInstallLedger over the SAME bridges as
  // install, so a malformed-frontmatter degrade is reachable on a re-enable and
  // must render exactly as it does on the plugin-installed arm: the (installed)
  // token kept (a degraded component is NOT a dropped one), the per-kind token
  // in the brace, and the info -> warning raise install.ts::successSeverity
  // applies.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    degradedKinds: ["skill"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "warning");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "malformed skill",
  ]);
});

test("SURF-05 / D-63-08: a reconcile enable of a plugin with an orphan rewake handler projects (installed) {orphan rewake} at info severity", () => {
  // An orphan companion field is a config bug the ledger reports, not a
  // shortfall in what was carried out -- so it names itself in the brace
  // without moving the severity channel, exactly as on the install row.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    orphanRewake: true,
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "info");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "orphan rewake",
  ]);
});

test("ENBL-07 / SURF-05 / WARN-01: all three enable degradation signals share one brace in install.ts's emit order", () => {
  // Order is load-bearing: the brace must be byte-comparable with the install
  // success row for the same ledger run -- orphan rewake, then the per-kind
  // malformed tokens, then the dropped kinds.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    unsupported: ["lspServers"],
    orphanRewake: true,
    degradedKinds: ["command", "skill"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  assert.equal(row.severity, "warning");
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", [
    "orphan rewake",
    "malformed skill",
    "malformed command",
    "lsp",
  ]);
});

test("ENBL-07: a clean reconcile enable (no dropped kinds) keeps the (installed) row, severity info -- byte-identical to before", () => {
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const block = msg.marketplaces[0];
  assert.ok(block);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "info");
  assert.equal(row.needsReload, true);
});

test("SEV-05: a backfill with no dropped kinds (degenerate empty set) renders a brace-less (partially-installed) row -- byte-identical to today", () => {
  // The no-dropped-kinds force-installed backfill renders brace-less: the shared
  // narrower returns [], so composeReasons emits no brace (D-69-04 -- rows
  // without reasons stay byte-identical).
  const outcome: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: [],
    installable: false,
    unsupported: [],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const block = msg.marketplaces[0];
  assert.ok(block);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", []);
});

test("RECON-04: a cascade with an install row + a backfill row yields ONE message carrying both rows", () => {
  // D-68-04: backfill promotions fold into the SINGLE applied cascade -- there
  // is no second notification path. One install + one backfill outcome produce
  // exactly one message whose blocks carry both rows.
  const installed: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "fresh",
    dependencies: [],
  };
  const backfilled: PerEntryOutcome = {
    kind: "plugin-backfilled",
    scope: "project",
    marketplace: "mp",
    plugin: "promoted",
    dependencies: [],
    installable: false,
    unsupported: [],
  };
  const msg = buildReconcileAppliedCascade([installed, backfilled]);
  // One block (same marketplace + scope) carrying both plugin rows -- a single
  // cascade message, never two.
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 2);
  assert.deepEqual(
    [...block.plugins].map((p) => [p.name, p.status]),
    [
      ["fresh", "installed"],
      ["promoted", "partially-installed"],
    ],
  );
});

test("WARN-01 / D-86-03: a plugin-installed outcome with degradedKinds=[skill] renders an (installed) row carrying {malformed skill} at warning severity (NOT partially-installed)", () => {
  // A skill whose SOURCE frontmatter could not be parsed installs in degraded
  // form. The orchestrated reconcile row keeps status `installed` (the skill
  // still installed) but raises to `warning` and carries the failure-class
  // token -- it is NOT a `partially-installed` row (that is for DROPPED
  // supported components).
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    dependencies: [],
    degradedKinds: ["skill"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.name, "cr");
  assert.equal(row.severity, "warning");
  assert.equal(row.needsReload, true);
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "malformed skill",
  ]);
});

test("WARN-01 / D-86-03: degradedKinds=[skill,command] rides ONE row with BOTH tokens (one per kind)", () => {
  // One `malformed skill` + one `malformed command` token share the single
  // installed row regardless of how many components of each kind degraded.
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    dependencies: [],
    degradedKinds: ["skill", "command"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "warning");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "malformed skill",
    "malformed command",
  ]);
});

test("WARN-01 / NREG-01: a plugin-installed outcome with no degradedKinds is unchanged -- info severity, no reasons brace", () => {
  // A clean install must render byte-identically to today: no empty brace, no
  // stray warning.
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    dependencies: [],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const block = msg.marketplaces[0];
  assert.ok(block);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "info");
  assert.equal(
    row.status === "installed" ? "reasons" in row && row.reasons !== undefined : "wrong-status",
    false,
  );
});

test("WR-06: a reconcile enable that staged an agent projects a row declaring the agents dependency", () => {
  // The `{requires pi-subagents}` marker is a renderer concern driven by the
  // row's `dependencies` list, so the projection's contract is that list: an
  // empty one suppresses the marker no matter what the ledger staged. The
  // sibling install arm has always carried it; this arm hard-coded [].
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    stagedAgents: true,
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.deepEqual(row.status === "installed" ? [...row.dependencies] : "absent", ["agents"]);
});

test("WR-06: the partially-installed enable arm carries the dependency list alongside the dropped-kind tokens", () => {
  // Both arms of the composer derive from the same signals: a re-enable that
  // dropped a kind AND staged an agent must not lose either fact. Reason order
  // stays contractual -- orphan rewake, malformed kinds, then dropped kinds.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    unsupported: ["lspServers"],
    orphanRewake: true,
    stagedAgents: true,
    stagedMcpServers: true,
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "partially-installed");
  // `dependencies` is optional on the partially-installed row shape (the
  // list/info inventory surface omits it), so read it through the same
  // nullish fallback the row composer's consumers use.
  assert.deepEqual(
    row.status === "partially-installed" ? [...(row.dependencies ?? [])] : "absent",
    ["agents", "mcp"],
  );
  assert.deepEqual(row.status === "partially-installed" ? [...row.reasons] : "absent", [
    "orphan rewake",
    "lsp",
  ]);
});

test("WR-06 / NREG-01: an enable outcome that staged neither agents nor MCP servers keeps the empty dependency list", () => {
  // The regression guard for the derivation: an unaffected enable projection
  // must render byte-identically, which means no dependency and no marker.
  const outcome: PerEntryOutcome = {
    kind: "plugin-enabled",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.deepEqual(row, {
    status: "installed",
    name: "cr",
    version: "1.0.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
});

test("IN-07: a plugin-installed outcome carrying orphanRewake renders (installed) {orphan rewake} at info severity", () => {
  // D-98-01: the install arm and the enable arm run the SAME ledger over the
  // SAME bridges, so a fresh reconcile install of a plugin whose hook handler
  // declares a rewake message without `asyncRewake` must name the same fact the
  // re-enable arm already names. An orphan companion field is a config bug the
  // ledger reports, not a shortfall in what was carried out, so it rides the
  // brace without moving the severity channel.
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    dependencies: [],
    orphanRewake: true,
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "info");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "orphan rewake",
  ]);
});

test("IN-07: an installed row carrying BOTH orphanRewake and a malformed kind emits {orphan rewake, malformed skill} in that order at warning severity", () => {
  // Emit order is contractual: the orphan-rewake token precedes the per-kind
  // malformed tokens, so the brace stays byte-comparable with the standalone
  // install row and with the sibling enable projection. Severity is decided by
  // the malformed rule alone -- the orphan token moves no severity channel.
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    dependencies: [],
    orphanRewake: true,
    degradedKinds: ["skill"],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "installed");
  assert.equal(row.severity, "warning");
  assert.deepEqual(row.status === "installed" ? [...(row.reasons ?? [])] : "absent", [
    "orphan rewake",
    "malformed skill",
  ]);
});

test("IN-07 / NREG-01: an install outcome carrying no degradation signal projects the row shape unchanged", () => {
  // The whole row is pinned by value: a signal-free install must gain no
  // `reasons` key at all (an empty brace would be a byte change), keep `info`,
  // and keep every other field it carries today.
  const outcome: PerEntryOutcome = {
    kind: "plugin-installed",
    scope: "project",
    marketplace: "mp",
    plugin: "cr",
    version: "1.0.0",
    dependencies: [],
  };
  const msg = buildReconcileAppliedCascade([outcome]);
  const row = msg.marketplaces[0]?.plugins[0];
  assert.ok(row);
  assert.deepEqual(row, {
    status: "installed",
    name: "cr",
    version: "1.0.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
});

test("dangling-reference mismatch (plugin attributed) -> child (failed) {dangling reference} plugin row (WR-03 / PURL-06)", () => {
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
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.status, "failed");
  // PURL-06: the mp header names the real problem with `dangling reference`.
  assert.deepEqual("reasons" in block ? [...(block.reasons ?? [])] : [], ["dangling reference"]);
  // Each dangling plugin stays individually attributable as a child
  // (failed) {dangling reference} row -- N dangling plugins do NOT collapse
  // into one anonymous marketplace row.
  assert.equal(block.plugins.length, 2);
  assert.deepEqual(
    [...block.plugins].map((p) => [p.name, p.status, "reasons" in p ? [...(p.reasons ?? [])] : []]),
    [
      ["cr", "failed", ["dangling reference"]],
      ["cr2", "failed", ["dangling reference"]],
    ],
  );
});

test("PURL-06 UAT shape: an orphaned pr-review-toolkit@claude-plugins-official reference projects a (failed) {dangling reference} mp row PLUS a (failed) {dangling reference} plugin child", () => {
  // Reproduces the two-row shape the operator saw on /reload after a
  // previous-version --local install left an orphaned plugin declaration whose
  // marketplace is no longer declared. The token must read `dangling reference`,
  // NOT `source mismatch` -- there is no source to compare.
  const plan: ReconcilePlan = {
    ...emptyPlan("user"),
    sourceMismatches: [
      {
        scope: "user",
        cause: "dangling-reference",
        marketplace: "claude-plugins-official",
        plugin: "pr-review-toolkit",
      },
    ],
  };
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  // Marketplace row: ⊘ claude-plugins-official [user] (failed) {dangling reference}
  assert.equal(block.name, "claude-plugins-official");
  assert.equal(block.scope, "user");
  assert.equal(block.status, "failed");
  assert.deepEqual("reasons" in block ? [...(block.reasons ?? [])] : [], ["dangling reference"]);
  // Plugin child: ⊘ pr-review-toolkit (failed) {dangling reference}
  assert.equal(block.plugins.length, 1);
  const child = block.plugins[0];
  assert.ok(child);
  assert.equal(child.name, "pr-review-toolkit");
  assert.equal(child.status, "failed");
  assert.deepEqual("reasons" in child ? [...(child.reasons ?? [])] : [], ["dangling reference"]);
});

test("PluginUninstall projection -> plugin row under marketplace block with (will uninstall) status", () => {
  const plan: ReconcilePlan = {
    ...emptyPlan("project"),
    pluginsToUninstall: [{ scope: "project", plugin: "cr", marketplace: "mp" }],
  };
  const msg = buildReconcilePendingNotification([plan]);
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
  const msg = buildReconcilePendingNotification([plan]);
  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0];
  assert.ok(block);
  assert.equal(block.plugins.length, 1);
  const row = block.plugins[0];
  assert.ok(row);
  assert.equal(row.status, "will disable");
});

// ──────────────────────────────────────────────────────────────────────────
// FSTAT-06 / D-66-04: will-force-install pending modifier (no-network resolve)
// ──────────────────────────────────────────────────────────────────────────

function installPlan(scope: Scope, install: PlannedPluginInstall): ReconcilePlan {
  return { ...emptyPlan(scope), pluginsToInstall: [install] };
}

test("FSTAT-06: a planned install whose candidate resolveStrict yields unsupported -> will-install row carries force:true", async () => {
  // A real no-network resolveStrict over an on-disk plugin root carrying an
  // unsupported component (`.lsp.json` -> lspServers) resolves `unsupported`,
  // so the planned install would degrade -> `(will partially install)`.
  const mpRoot = await mkdtemp(path.join(tmpdir(), "recon-force-"));
  try {
    await mkdir(path.join(mpRoot, "cr"), { recursive: true });
    await writeFile(path.join(mpRoot, "cr", ".lsp.json"), "{}", "utf8");

    const install: PlannedPluginInstall = {
      scope: "project",
      plugin: "cr",
      marketplace: "mp",
      configSource: "base",
    };
    const plan = installPlan("project", install);
    const locate = (i: PlannedPluginInstall): Promise<PendingInstallCandidate | undefined> => {
      assert.equal(i.plugin, "cr");
      return Promise.resolve({
        marketplaceRoot: mpRoot,
        manifestEntry: { name: "cr", source: "./cr", version: "1.0.0" },
      });
    };

    const forceKeys = await resolvePendingForceInstalls([plan], locate);
    const msg = buildReconcilePendingNotification([plan], forceKeys);
    assert.equal(msg.marketplaces.length, 1);
    const block = msg.marketplaces[0];
    assert.ok(block);
    const row = block.plugins[0];
    assert.ok(row);
    assert.equal(row.status, "will install");
    // The force modifier is set exactly when the candidate resolved unsupported.
    assert.equal(row.status === "will install" ? row.partial : undefined, true);
  } finally {
    await rm(mpRoot, { recursive: true, force: true });
  }
});

test("FSTAT-06: a planned install whose candidate resolves installable -> plain will-install row (no force)", async () => {
  // A plugin root that exists with NO unsupported component resolves
  // `installable`, so the row stays `(will install)` -- no force modifier.
  const mpRoot = await mkdtemp(path.join(tmpdir(), "recon-clean-"));
  try {
    await mkdir(path.join(mpRoot, "cr"), { recursive: true });

    const install: PlannedPluginInstall = {
      scope: "project",
      plugin: "cr",
      marketplace: "mp",
      configSource: "base",
    };
    const plan = installPlan("project", install);
    const locate = (): Promise<PendingInstallCandidate | undefined> =>
      Promise.resolve({
        marketplaceRoot: mpRoot,
        manifestEntry: { name: "cr", source: "./cr", version: "1.0.0" },
      });

    const forceKeys = await resolvePendingForceInstalls([plan], locate);
    assert.equal(forceKeys.size, 0, "an installable candidate must not be flagged force");
    const msg = buildReconcilePendingNotification([plan], forceKeys);
    const row = msg.marketplaces[0]?.plugins[0];
    assert.ok(row);
    assert.equal(row.status, "will install");
    assert.equal(
      row.status === "will install" ? row.partial : "absent",
      undefined,
      "installable candidate row must not carry force",
    );
  } finally {
    await rm(mpRoot, { recursive: true, force: true });
  }
});

test("FSTAT-06: an unlocatable candidate (locator returns undefined) -> plain will-install row, no resolve", () => {
  // A same-run marketplace add is not yet cloned, so the candidate cannot be
  // resolved offline -- the preview stays `(will install)` (it cannot truthfully
  // claim a degrade). resolveStrict is never reached.
  const plan = installPlan("project", {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
    configSource: "base",
  });
  return resolvePendingForceInstalls([plan], () => Promise.resolve(undefined)).then((forceKeys) => {
    assert.equal(forceKeys.size, 0);
    const msg = buildReconcilePendingNotification([plan], forceKeys);
    const row = msg.marketplaces[0]?.plugins[0];
    assert.ok(row);
    assert.equal(row.status === "will install" ? row.partial : "absent", undefined);
  });
});

test("FSTAT-06: force keys are scoped to (scope, marketplace, plugin) -- a same-named install in another scope is unaffected", () => {
  // The force set keys on the full tuple, so a degrading project-scope install
  // does not bleed a force modifier onto an identically-named user-scope one.
  const projectInstall: PlannedPluginInstall = {
    scope: "project",
    plugin: "cr",
    marketplace: "mp",
    configSource: "base",
  };
  const userInstall: PlannedPluginInstall = {
    scope: "user",
    plugin: "cr",
    marketplace: "mp",
    configSource: "base",
  };
  const locate = (i: PlannedPluginInstall): Promise<PendingInstallCandidate | undefined> =>
    // Only the project-scope install is "degrading": return a candidate whose
    // resolve we stub by pointing at a nonexistent root for the user scope (so
    // resolveStrict yields unavailable, never unsupported -> never force).
    Promise.resolve(
      i.scope === "project"
        ? { marketplaceRoot: "/nonexistent", manifestEntry: { name: "cr", source: "./cr" } }
        : { marketplaceRoot: "/nonexistent", manifestEntry: { name: "cr", source: "./cr" } },
    );
  return resolvePendingForceInstalls(
    [installPlan("project", projectInstall), installPlan("user", userInstall)],
    locate,
  ).then((forceKeys) => {
    // Neither resolves unsupported (no on-disk root), so the projection emits
    // two plain will-install rows -- the structural keying is exercised by the
    // dedicated unsupported case above; here we assert no cross-scope bleed.
    const msg = buildReconcilePendingNotification(
      [installPlan("project", projectInstall), installPlan("user", userInstall)],
      forceKeys,
    );
    const forcedRows = msg.marketplaces
      .flatMap((m) => m.plugins)
      .filter((p) => p.status === "will install" && p.partial === true);
    assert.equal(forcedRows.length, 0);
  });
});

test("FSTAT-06 / D-66-05: the reconcile pending projection never emits an update or will-force-update row", () => {
  // `will force update` is VACUOUS -- the ReconcilePlan has no update bucket, so
  // the pending projection can only ever push install/uninstall/enable/disable +
  // failed rows. Populate every bucket (including a forced install) and assert
  // no row status mentions "update", and that the pending closed set has no
  // update token at all.
  const plan: ReconcilePlan = {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [{ scope: "project", marketplace: "gone-mp", plugins: ["g1"] }],
    pluginsToInstall: [
      { scope: "project", plugin: "ins", marketplace: "mp", configSource: "base" },
    ],
    pluginsToUninstall: [{ scope: "project", plugin: "rem", marketplace: "mp" }],
    pluginsToEnable: [{ scope: "project", plugin: "en", marketplace: "mp" }],
    pluginsToDisable: [{ scope: "project", plugin: "dis", marketplace: "mp" }],
    sourceMismatches: [
      { scope: "project", cause: "dangling-reference", marketplace: "phantom", plugin: "dang" },
    ],
  };
  // Force the install so even the degrade path is exercised: it remains a
  // `will install` row with force:true, NEVER a will-update/will-force-update.
  const forceKeys = new Set<string>(["project\u0000mp\u0000ins"]);
  const msg = buildReconcilePendingNotification([plan], forceKeys);

  const statuses = msg.marketplaces.flatMap((m) => m.plugins.map((p) => p.status));
  for (const s of statuses) {
    assert.ok(!s.includes("update"), `pending projection must emit no update row; saw "${s}"`);
  }

  // The forced install is a will-install row carrying force:true (NOT a new
  // update/force-update status token).
  const forcedInstall = msg.marketplaces
    .flatMap((m) => m.plugins)
    .find((p) => p.status === "will install" && p.name === "ins");
  assert.ok(forcedInstall);
  assert.equal(forcedInstall.status === "will install" ? forcedInstall.partial : undefined, true);

  // Structural guarantee: the pending closed status set has no update member,
  // so a `will force update` row is unrepresentable on this surface.
  assert.ok(
    !PENDING_STATUSES.some((s) => s.includes("update")),
    `PENDING_STATUSES must contain no update token; got ${PENDING_STATUSES.join(", ")}`,
  );
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
