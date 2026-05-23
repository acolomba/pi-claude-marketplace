// tests/presentation/cascade-summary.test.ts
//
// CMC-20 / MSG-SR-4..6 severity routing for cascade summaries plus
// per-marketplace cascade body composition. The composer returns
// `{message, severity}`; the orchestrator destructures and dispatches to
// `notifySuccess` (severity === "success") or `notifyWarning` (severity ===
// "warning"). MSG-SR-6 forbids `notifyError` on cascade summaries; the
// `CascadeSeverity` literal union has no "error" arm to enforce that
// structurally.

import assert from "node:assert/strict";
import test from "node:test";

import {
  cascadeSeverity,
  cascadeSummary,
} from "../../extensions/pi-claude-marketplace/presentation/cascade-summary.ts";

import type {
  MarketplaceRow,
  PluginCascadeRow,
  SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/compact-line.ts";

const PROBE_BOTH_LOADED: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

// ----------------------------------------------------------------------
// cascadeSeverity: trivial / non-trivial row classification (MSG-SR-4..6)
// ----------------------------------------------------------------------

test("MSG-SR-4: empty cascade is vacuously trivial -> success", () => {
  assert.equal(cascadeSeverity([]), "success");
});

test("MSG-SR-4: single (installed) row -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "installed" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-4: single (updated) row -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "updated" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-4: single (reinstalled) row -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "reinstalled" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-4: single (uninstalled) row -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "uninstalled" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-4: single (available) row -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "available" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-4: trivial skip {up-to-date} -> success", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "skipped", reasons: ["up-to-date"] },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("MSG-SR-5: non-trivial skip {not in manifest} -> warning", () => {
  const rows: readonly PluginCascadeRow[] = [
    {
      kind: "plugin-cascade",
      name: "a",
      scope: "user",
      status: "skipped",
      reasons: ["not in manifest"],
    },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

test("MSG-SR-5: non-trivial skip {source mismatch} -> warning", () => {
  const rows: readonly PluginCascadeRow[] = [
    {
      kind: "plugin-cascade",
      name: "a",
      scope: "user",
      status: "skipped",
      reasons: ["source mismatch"],
    },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

test("MSG-SR-5: failed row -> warning", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "failed" },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

test("MSG-SR-5: rollback failed row -> warning", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "rollback failed" },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

test("MSG-SR-5: unavailable row -> warning", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "unavailable" },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

test("CascadeSeverity literal union: function NEVER returns 'error' (MSG-SR-6)", () => {
  // Structural check: every cascade severity that can arise from the rows
  // we test must be either "success" or "warning". This is an at-call-time
  // affirmation of the literal union shape; tsc would have failed first if
  // the return type widened to include "error".
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "failed" },
    { kind: "plugin-cascade", name: "b", scope: "user", status: "installed" },
  ];
  const sev = cascadeSeverity(rows);
  assert.ok(sev === "success" || sev === "warning", `unexpected severity: ${sev}`);
});

test("MSG-SR-4: (upgradable) is a list-render token treated as success on a cascade row", () => {
  // CMC-09 / MSG-PL-4 structurally prevents (upgradable) from appearing
  // on PluginCascadeRow.status (the Extract<...> excludes "upgradable").
  // This test affirms the severity helper does not classify any of the
  // remaining cascade-allowed statuses incorrectly when mixed with success
  // rows -- "available" being the closest list-render analogue here.
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "available" },
    { kind: "plugin-cascade", name: "b", scope: "user", status: "installed" },
  ];
  assert.equal(cascadeSeverity(rows), "success");
});

test("Mixed rows: ANY non-trivial row makes severity = warning (OR semantics)", () => {
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "a", scope: "user", status: "installed" },
    { kind: "plugin-cascade", name: "b", scope: "user", status: "updated" },
    {
      kind: "plugin-cascade",
      name: "c",
      scope: "user",
      status: "skipped",
      reasons: ["up-to-date"],
    },
    { kind: "plugin-cascade", name: "d", scope: "user", status: "failed" },
  ];
  assert.equal(cascadeSeverity(rows), "warning");
});

// ----------------------------------------------------------------------
// cascadeSummary: header + sorted indented rows + severity destructure
// ----------------------------------------------------------------------

test("cascadeSummary: returns marketplace header line first, then indented sorted rows", () => {
  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: "mp",
    scope: "user",
    outcomeClass: "ok",
  };
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "beta", scope: "user", status: "installed" },
    { kind: "plugin-cascade", name: "alpha", scope: "user", status: "installed" },
  ];
  const { message, severity } = cascadeSummary({
    marketplace,
    rows,
    probe: PROBE_BOTH_LOADED,
  });
  const lines = message.split("\n");
  assert.equal(lines.length, 3);
  // Marketplace header row (no indentation).
  assert.equal(lines[0], "● mp [user]");
  // Cascade rows: alphabetically sorted, 2-space indentation.
  assert.equal(lines[1], "  ● alpha [user] (installed)");
  assert.equal(lines[2], "  ● beta [user] (installed)");
  assert.equal(severity, "success");
});

test("cascadeSummary: empty rows returns marketplace header alone", () => {
  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: "mp",
    scope: "user",
    outcomeClass: "ok",
  };
  const { message, severity } = cascadeSummary({
    marketplace,
    rows: [],
    probe: PROBE_BOTH_LOADED,
  });
  assert.equal(message, "● mp [user]");
  assert.equal(severity, "success");
});

test("cascadeSummary: severity warning when any non-trivial row present", () => {
  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: "mp",
    scope: "user",
    outcomeClass: "ok",
  };
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "alpha", scope: "user", status: "installed" },
    { kind: "plugin-cascade", name: "beta", scope: "user", status: "failed" },
  ];
  const { severity } = cascadeSummary({
    marketplace,
    rows,
    probe: PROBE_BOTH_LOADED,
  });
  assert.equal(severity, "warning");
});

test("cascadeSummary: project-scope rows sort before user-scope rows for same name (MSG-GR-3)", () => {
  const marketplace: MarketplaceRow = {
    kind: "marketplace",
    name: "mp",
    scope: "user",
    outcomeClass: "ok",
  };
  const rows: readonly PluginCascadeRow[] = [
    { kind: "plugin-cascade", name: "alpha", scope: "user", status: "installed" },
    { kind: "plugin-cascade", name: "alpha", scope: "project", status: "installed" },
  ];
  const { message } = cascadeSummary({
    marketplace,
    rows,
    probe: PROBE_BOTH_LOADED,
  });
  const lines = message.split("\n");
  // project before user when names tie.
  assert.equal(lines[1], "  ● alpha [project] (installed)");
  assert.equal(lines[2], "  ● alpha [user] (installed)");
});
