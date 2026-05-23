import assert from "node:assert/strict";
import test from "node:test";

import {
  renderRow,
  type EmptyToken,
  type EntityErrorRow,
  type MarketplaceRow,
  type PluginCascadeRow,
  type PluginInlineRow,
  type PluginInlineUninstalledRow,
  type PluginListRow,
  type RowSpec,
  type SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/compact-line.ts";

const PROBE_BOTH_LOADED: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

const PROBE_NONE_LOADED: SoftDepProbe = {
  piSubagentsLoaded: false,
  piMcpAdapterLoaded: false,
};

// ----------------------------------------------------------------------
// MSG-GR-1 token order: every variant tested with maximal-slot input.
// ----------------------------------------------------------------------

test("MSG-GR-1: plugin-inline emits icon name@mp [scope] v<ver> (status) {reasons}", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    status: "installed",
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "● alpha@official [user] v1.0.0 (installed)");
});

test("MSG-GR-1: plugin-inline-uninstalled emits icon name@mp [scope] v<ver> (uninstalled)", () => {
  const row: PluginInlineUninstalledRow = {
    kind: "plugin-inline-uninstalled",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
  };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "○ alpha@official [user] v1.0.0 (uninstalled)");
});

test("CMC-02: plugin-cascade never emits @<marketplace> (carve-out MSG-GR-2)", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    version: "1.0.0",
    status: "reinstalled",
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.equal(out, "● alpha [user] v1.0.0 (reinstalled)");
  assert.ok(!out.includes("@"), "cascade row must not contain @marketplace");
});

test("CMC-02: plugin-inline always emits @<marketplace>", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.ok(out.includes("@official"), "inline row must contain @marketplace");
});

test("MSG-PL-6: plugin-list omits [scope] for (available) and (unavailable)", () => {
  const available: PluginListRow = {
    kind: "plugin-list",
    name: "serena",
    scope: "user",
    status: "available",
    version: "2.0.0",
  };
  assert.equal(renderRow(available, PROBE_BOTH_LOADED), "○ serena v2.0.0 (available)");

  const unavailable: PluginListRow = {
    kind: "plugin-list",
    name: "hookify",
    scope: "user",
    status: "unavailable",
    reasons: ["hooks"],
  };
  assert.equal(renderRow(unavailable, PROBE_BOTH_LOADED), "⊘ hookify (unavailable) {hooks}");
});

test("MSG-PL-6: plugin-list keeps [scope] for (installed) and (upgradable)", () => {
  const installed: PluginListRow = {
    kind: "plugin-list",
    name: "alpha",
    scope: "user",
    status: "installed",
    version: "1.0.0",
  };
  assert.equal(renderRow(installed, PROBE_BOTH_LOADED), "● alpha [user] v1.0.0 (installed)");

  const upgradable: PluginListRow = {
    kind: "plugin-list",
    name: "alpha",
    scope: "project",
    status: "upgradable",
    version: "1.0.0",
  };
  assert.equal(renderRow(upgradable, PROBE_BOTH_LOADED), "● alpha [project] v1.0.0 (upgradable)");
});

test("MSG-GR-5: marketplace row emits <marker> slot between scope and status", () => {
  const row: MarketplaceRow = {
    kind: "marketplace",
    name: "official",
    scope: "user",
    marker: "autoupdate",
    status: "added",
    outcomeClass: "ok",
  };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "● official [user] <autoupdate> (added)");
});

test("MSG-GR-5: marketplace row without marker omits the slot entirely", () => {
  const row: MarketplaceRow = {
    kind: "marketplace",
    name: "official",
    scope: "user",
    status: "removed",
    outcomeClass: "ok",
  };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "● official [user] (removed)");
});

// ----------------------------------------------------------------------
// CMC-06 / MSG-IC-1..3 icon discipline
// ----------------------------------------------------------------------

test("CMC-06: (installed)/(updated)/(reinstalled) on cascade rows -> ●", () => {
  const variants: PluginCascadeRow["status"][] = ["installed", "updated", "reinstalled"];
  for (const status of variants) {
    const row: PluginCascadeRow = {
      kind: "plugin-cascade",
      name: "alpha",
      scope: "user",
      status,
    };
    const out = renderRow(row, PROBE_BOTH_LOADED);
    assert.ok(out.startsWith("● "), `expected ● for ${status}, got: ${out}`);
  }
});

test("CMC-06: (upgradable) on plugin-list row -> ● (list-only per MSG-PL-4)", () => {
  const row: PluginListRow = {
    kind: "plugin-list",
    name: "alpha",
    scope: "user",
    status: "upgradable",
    version: "1.0.0",
  };
  assert.ok(renderRow(row, PROBE_BOTH_LOADED).startsWith("● "));
});

test("CMC-06: (available)/(uninstalled) -> ○", () => {
  const available: PluginListRow = {
    kind: "plugin-list",
    name: "alpha",
    scope: "user",
    status: "available",
  };
  assert.ok(renderRow(available, PROBE_BOTH_LOADED).startsWith("○ "));

  const uninstalled: PluginInlineUninstalledRow = {
    kind: "plugin-inline-uninstalled",
    name: "alpha",
    marketplace: "official",
    scope: "user",
  };
  assert.ok(renderRow(uninstalled, PROBE_BOTH_LOADED).startsWith("○ "));
});

test("CMC-06: (failed)/(rollback failed)/(manual recovery)/(unavailable) -> ⊘", () => {
  const failed: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "failed",
    reasons: ["rollback partial"],
  };
  assert.ok(renderRow(failed, PROBE_BOTH_LOADED).startsWith("⊘ "));

  const rbFailed: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "rollback failed",
  };
  assert.ok(renderRow(rbFailed, PROBE_BOTH_LOADED).startsWith("⊘ "));

  const unavailable: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "unavailable",
    reasons: ["hooks"],
  };
  assert.ok(renderRow(unavailable, PROBE_BOTH_LOADED).startsWith("⊘ "));

  const manualRecovery: RowSpec = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unreadable"],
  };
  assert.ok(renderRow(manualRecovery, PROBE_BOTH_LOADED).startsWith("⊘ "));
});

test("CMC-06: (skipped) {up-to-date} -> ● (trivial skip)", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "skipped",
    reasons: ["up-to-date"],
  };
  assert.ok(renderRow(row, PROBE_BOTH_LOADED).startsWith("● "));
});

test("CMC-06: (skipped) {source mismatch} -> ⊘ (non-trivial / failure-cascade child)", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "skipped",
    reasons: ["source mismatch"],
  };
  assert.ok(renderRow(row, PROBE_BOTH_LOADED).startsWith("⊘ "));
});

test("CMC-07: marketplace outcomeClass:'ok' -> ●; outcomeClass:'failure' -> ⊘", () => {
  const ok: MarketplaceRow = {
    kind: "marketplace",
    name: "official",
    scope: "user",
    status: "added",
    outcomeClass: "ok",
  };
  assert.ok(renderRow(ok, PROBE_BOTH_LOADED).startsWith("● "));

  const fail: MarketplaceRow = {
    kind: "marketplace",
    name: "official",
    scope: "user",
    status: "failed",
    outcomeClass: "failure",
    reasons: ["not found"],
  };
  assert.ok(renderRow(fail, PROBE_BOTH_LOADED).startsWith("⊘ "));
});

// ----------------------------------------------------------------------
// CMC-04: reasons block formatting (MSG-GR-4)
// ----------------------------------------------------------------------

test("CMC-04: empty reasons array omits {} entirely", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "installed",
    reasons: [],
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.ok(!out.includes("{"), `empty reasons must omit {}; got: ${out}`);
});

test("CMC-04: single reason emits {reason}", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "skipped",
    reasons: ["up-to-date"],
  };
  assert.ok(renderRow(row, PROBE_BOTH_LOADED).endsWith("{up-to-date}"));
});

test("CMC-04: multi-reason emits {reason1, reason2} comma-joined", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "unavailable",
    reasons: ["hooks", "lspServers"],
  };
  assert.ok(renderRow(row, PROBE_BOTH_LOADED).endsWith("{hooks, lspServers}"));
});

// ----------------------------------------------------------------------
// CMC-10 / MSG-ER-1: empty token bare form
// ----------------------------------------------------------------------

test("CMC-10: empty {token:'no plugins'} renders bare '(no plugins)'", () => {
  const row: EmptyToken = { kind: "empty", token: "no plugins" };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "(no plugins)");
});

test("CMC-10: empty {token:'no marketplaces'} renders bare '(no marketplaces)'", () => {
  const row: EmptyToken = { kind: "empty", token: "no marketplaces" };
  assert.equal(renderRow(row, PROBE_BOTH_LOADED), "(no marketplaces)");
});

// ----------------------------------------------------------------------
// CMC-13 / MSG-SD-1..3: per-row soft-dep emission
// ----------------------------------------------------------------------

test("CMC-13: declaresAgents=true + pi-subagents unloaded -> {requires pi-subagents}", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
    declaresAgents: true,
  };
  const out = renderRow(row, PROBE_NONE_LOADED);
  assert.ok(out.includes("{requires pi-subagents}"), `expected marker; got: ${out}`);
});

test("CMC-13: declaresMcp=true + pi-mcp-adapter unloaded -> {requires pi-mcp}", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
    declaresMcp: true,
  };
  const out = renderRow(row, PROBE_NONE_LOADED);
  assert.ok(out.includes("{requires pi-mcp}"), `expected marker; got: ${out}`);
});

test("CMC-13: both declared + both unloaded -> {requires pi-subagents, requires pi-mcp}", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
    declaresAgents: true,
    declaresMcp: true,
  };
  const out = renderRow(row, PROBE_NONE_LOADED);
  assert.ok(out.includes("{requires pi-subagents, requires pi-mcp}"));
});

test("CMC-13: declares=true + companion LOADED -> marker omitted", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
    declaresAgents: true,
    declaresMcp: true,
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.ok(!out.includes("requires"), `expected no marker; got: ${out}`);
});

test("CMC-13: declares=false -> marker omitted regardless of probe", () => {
  const row: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "installed",
    declaresAgents: false,
    declaresMcp: false,
  };
  const out = renderRow(row, PROBE_NONE_LOADED);
  assert.ok(!out.includes("requires"), `expected no marker; got: ${out}`);
});

test("MSG-SD-1: soft-dep reasons coexist with caller-supplied reasons in a single {} block", () => {
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    status: "installed",
    reasons: ["up-to-date"],
    declaresAgents: true,
  };
  const out = renderRow(row, PROBE_NONE_LOADED);
  assert.ok(out.includes("{up-to-date, requires pi-subagents}"), `got: ${out}`);
});

// ----------------------------------------------------------------------
// Entity-error row (CMC-34 / MSG-NC-1)
// ----------------------------------------------------------------------

test("CMC-34: entity-error emits ⊘ name@mp [scope] (status) {reasons}", () => {
  const row: EntityErrorRow = {
    kind: "entity-error",
    name: "unknown",
    marketplace: "claude-plugins-official",
    status: "failed",
    reasons: ["not found"],
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.equal(out, "⊘ unknown@claude-plugins-official (failed) {not found}");
});

test("CMC-34: entity-error without marketplace omits the @mp slot", () => {
  const row: EntityErrorRow = {
    kind: "entity-error",
    name: "alpha",
    scope: "user",
    status: "unavailable",
    reasons: ["hooks"],
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.equal(out, "⊘ alpha [user] (unavailable) {hooks}");
});

// ----------------------------------------------------------------------
// Manual recovery (MSG-MR-1..2)
// ----------------------------------------------------------------------

test("MSG-MR-2: manual-recovery emits ⊘ <resource> (manual recovery) {<reason>}", () => {
  const row: RowSpec = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unreadable"],
  };
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.equal(out, "⊘ agent index (manual recovery) {unreadable}");
});

// ----------------------------------------------------------------------
// Rollback child (MSG-RP-1)
// ----------------------------------------------------------------------

test("MSG-RP-1: rollback-child emits compact phaseLabel (failed) / (rollback failed) {reasons}", () => {
  const row: RowSpec = {
    kind: "rollback-child",
    phaseLabel: "agents staging",
    status: "rollback failed",
    reasons: ["unreadable"],
  };
  // Renderer emits at the compact level; the parent composer applies indentation.
  const out = renderRow(row, PROBE_BOTH_LOADED);
  assert.equal(out, "agents staging (rollback failed) {unreadable}");
});

// ----------------------------------------------------------------------
// Structural negative tests for MSG-PL-4 and MSG-SD-3 (compile-time guards)
// ----------------------------------------------------------------------

test("MSG-PL-4 / CMC-09 structural: (upgradable) cannot be set on plugin-inline (TS compile gate)", () => {
  // The type system rejects `status: "upgradable"` on a PluginInlineRow because
  // its `status` field excludes "upgradable" via Extract<>.
  const _badInline: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    // @ts-expect-error -- CMC-09 / MSG-PL-4: (upgradable) is structurally restricted to PluginListRow
    status: "upgradable",
  };
  void _badInline;

  // Same restriction on PluginCascadeRow:
  const _badCascade: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: "alpha",
    scope: "user",
    // @ts-expect-error -- CMC-09 / MSG-PL-4: (upgradable) is structurally restricted to PluginListRow
    status: "upgradable",
  };
  void _badCascade;
});

test("MSG-SD-3 structural: PluginInlineUninstalledRow cannot carry declaresAgents (TS compile gate)", () => {
  // The PluginInlineUninstalledRow variant has no declaresAgents/Mcp fields, so
  // setting them is a structural type error.
  const _bad: PluginInlineUninstalledRow = {
    kind: "plugin-inline-uninstalled",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    // @ts-expect-error -- MSG-SD-3: soft-dep marker must never apply to (uninstalled) rows
    declaresAgents: true,
  };
  void _bad;
});

// ----------------------------------------------------------------------
// Exhaustive switch: assertNever sentinel runtime check
// ----------------------------------------------------------------------

test("assertNever sentinel fires when an unknown kind reaches the renderer at runtime", () => {
  // Force a runtime mismatch by casting -- this exercises the default branch.
  const bogus = { kind: "bogus" } as unknown as RowSpec;
  assert.throws(() => renderRow(bogus, PROBE_BOTH_LOADED), /Unexpected value/);
});
