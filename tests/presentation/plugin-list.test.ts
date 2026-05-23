// tests/presentation/plugin-list.test.ts
//
// Phase 13 Wave 2 sub-wave 2d (Plan 13-02d-01):
//
// CMC-22 / CMC-06 / CMC-09 / CMC-13 -- plugin-list renderer rewritten on
// top of the Wave 1 keystone primitives. The renderer is a pure formatter
// over `PluginListPayload` (orchestrator-constructed marketplace blocks
// with sorted-or-soon-to-be-sorted plugin children). The orphan-fold
// computation lives in `orchestrators/plugin/list.ts` per D-13-19; this
// file's tests cover ONLY the byte-shape of the rendered output for each
// catalog-aligned fixture.
//
// Catalog references (docs/output-catalog.md):
//   - lines 162-263 (`/claude:plugin list` per-state forms)
//   - line 169 -- empty case `(no plugins)`
//   - lines 174-184 -- single-mp mixed plugin statuses
//   - lines 196-210 -- same plugin both scopes
//   - lines 205-213 -- project orphan folded under user-scope header
//   - lines 217-222 -- soft-dep marker rows
//   - lines 228-235 -- unparseable marketplace
//   - lines 240-246 -- zero-plugin marketplace
//   - lines 250-258 -- multiple marketplaces
//
// Style-guide references (docs/messaging-style-guide.md):
//   - §3 status tokens; MSG-PL-4 `(upgradable)` list-only
//   - §3.1 MSG-PL-1 PL-4 description truncation at column 66
//   - §3.4 MSG-PL-6 scope-bracket carve-out for `(available)`/`(unavailable)`
//   - §6 MSG-SD-1..3 per-row soft-dep markers

import assert from "node:assert/strict";
import test from "node:test";

import {
  renderPluginList,
  truncateColumn66,
  type PluginListMarketplaceBlock,
  type PluginListPayload,
} from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

import type { SoftDepProbe } from "../../extensions/pi-claude-marketplace/presentation/compact-line.ts";

// ---------------------------------------------------------------------------
// Probe fixtures
// ---------------------------------------------------------------------------

const PROBE_LOADED: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

const PROBE_UNLOADED: SoftDepProbe = {
  piSubagentsLoaded: false,
  piMcpAdapterLoaded: false,
};

// ---------------------------------------------------------------------------
// Top-level empty case (CMC-10 / MSG-ER-1)
// ---------------------------------------------------------------------------

test("CMC-10 / MSG-ER-1: empty payload renders bare `(no plugins)` EmptyToken", () => {
  const payload: PluginListPayload = { marketplaceBlocks: [] };
  assert.equal(renderPluginList(payload, PROBE_LOADED), "(no plugins)");
});

// ---------------------------------------------------------------------------
// Single-marketplace mixed statuses (catalog lines 174-184)
// ---------------------------------------------------------------------------

test("CMC-22 single marketplace, mixed plugin statuses match catalog form", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "user",
        version: "1.0.0",
        status: "installed",
        description: "Short description of alpha.",
      },
      {
        kind: "plugin-list",
        name: "gamma",
        scope: "user",
        version: "2.0.0",
        status: "available",
        description: "Free-text description; renders verbatim under 66 cols.",
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  // Marketplace header at column 0; plugin rows at 2-space indent;
  // description at 4-space indent on next line.
  const expected = [
    "● official [user] <autoupdate>",
    "  ● alpha [user] v1.0.0 (installed)",
    "    Short description of alpha.",
    // gamma is `(available)` -- MSG-PL-6 omits the [<scope>] bracket
    "  ○ gamma v2.0.0 (available)",
    "    Free-text description; renders verbatim under 66 cols.",
  ].join("\n");
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// Same plugin in both scopes (catalog lines 196-201)
// ---------------------------------------------------------------------------

test("CMC-21 / D-13-18: same plugin both scopes -- per-scope marketplace headers + per-scope rows; project-before-user sort", () => {
  const projectBlock: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "project",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "project",
        version: "0.9.0",
        status: "installed",
      },
    ],
  };
  const userBlock: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "user",
        version: "1.0.0",
        status: "installed",
      },
    ],
  };
  // Pass user first to verify the renderer's MSG-GR-3 sort moves project
  // ahead of user when names are equal.
  const out = renderPluginList({ marketplaceBlocks: [userBlock, projectBlock] }, PROBE_LOADED);
  const expected = [
    "● official [project] <autoupdate>",
    "  ● alpha [project] v0.9.0 (installed)",
    "● official [user] <autoupdate>",
    "  ● alpha [user] v1.0.0 (installed)",
  ].join("\n");
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// Soft-dep markers on installed rows (catalog lines 217-222)
// ---------------------------------------------------------------------------

test("CMC-13 / MSG-SD-1..2 soft-dep markers emit per row when (declares AND companion unloaded)", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "dual",
        scope: "user",
        version: "0.5.0",
        status: "installed",
        declaresAgents: true,
        declaresMcp: true,
      },
      {
        kind: "plugin-list",
        name: "helper",
        scope: "user",
        version: "1.0.0",
        status: "installed",
        declaresAgents: true,
      },
      {
        kind: "plugin-list",
        name: "mcp-tool",
        scope: "user",
        version: "2.0.0",
        status: "installed",
        declaresMcp: true,
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_UNLOADED);
  const expected = [
    "● official [user] <autoupdate>",
    "  ● dual [user] v0.5.0 (installed) {requires pi-subagents, requires pi-mcp}",
    "  ● helper [user] v1.0.0 (installed) {requires pi-subagents}",
    "  ● mcp-tool [user] v2.0.0 (installed) {requires pi-mcp}",
  ].join("\n");
  assert.equal(out, expected);
});

test("MSG-SD-1..2: probe with companions LOADED suppresses every soft-dep marker", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "dual",
        scope: "user",
        version: "0.5.0",
        status: "installed",
        declaresAgents: true,
        declaresMcp: true,
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  assert.equal(out.includes("requires"), false);
});

// ---------------------------------------------------------------------------
// (upgradable) icon + version slot (catalog line 178)
// ---------------------------------------------------------------------------

test("CMC-09 / MSG-PL-4: (upgradable) rows carry the ● effective-state icon", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "beta",
        scope: "user",
        version: "0.5.0",
        status: "upgradable",
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  // The renderer emits `● beta [user] v0.5.0 (upgradable)` -- the catalog
  // form `v<from> → v<to>` is a future enhancement; this plan keeps the
  // version slot as the orchestrator's recorded-version string and lets
  // catalog UAT exercise the from→to arrow form when CMC-22 lands it.
  assert.match(out, /● beta \[user\] v0\.5\.0 \(upgradable\)/);
  assert.equal(out.includes("⊘"), false);
});

// ---------------------------------------------------------------------------
// MSG-PL-6 scope-bracket carve-out for (available)/(unavailable)
// ---------------------------------------------------------------------------

test("MSG-PL-6 carve-out: (available) and (unavailable) rows OMIT the [<scope>] bracket", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "delta",
        scope: "user",
        status: "unavailable",
        reasons: ["hooks"] as const,
      },
      {
        kind: "plugin-list",
        name: "epsilon",
        scope: "user",
        status: "unavailable",
        reasons: ["hooks", "lspServers"] as const,
      },
      {
        kind: "plugin-list",
        name: "gamma",
        scope: "user",
        version: "2.0.0",
        status: "available",
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  assert.match(out, /⊘ delta \(unavailable\) \{hooks\}/);
  assert.match(out, /⊘ epsilon \(unavailable\) \{hooks, lspServers\}/);
  assert.match(out, /○ gamma v2\.0\.0 \(available\)/);
  // No [<scope>] bracket on any of the three rows.
  assert.equal(out.includes("delta [user]"), false);
  assert.equal(out.includes("epsilon [user]"), false);
  assert.equal(out.includes("gamma [user]"), false);
});

// ---------------------------------------------------------------------------
// Unparseable marketplace (catalog lines 228-230)
// ---------------------------------------------------------------------------

test("CMC-22 unparseable marketplace renders as failed header + indented cause trailer; the other marketplace renders normally below", () => {
  const failedBlock: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "unparseable-mp",
      scope: "user",
      status: "failed",
      reasons: ["unparseable"] as const,
      outcomeClass: "failure",
    },
    plugins: [],
    causeTrailer: "JSON parse error at line 3",
  };
  const goodBlock: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "other-mp",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "helper",
        scope: "user",
        version: "1.0.0",
        status: "installed",
      },
    ],
  };
  // Pass the good block first; the renderer's MSG-GR-3 sort should
  // alphabetize so `other-mp` comes after `unparseable-mp`. We assert
  // the catalog ordering directly.
  const out = renderPluginList({ marketplaceBlocks: [goodBlock, failedBlock] }, PROBE_LOADED);
  // Catalog ordering: o-ther-mp comes first alphabetically vs unparseable-mp.
  // Verify both lines are present at the correct positions.
  const otherIdx = out.indexOf("● other-mp");
  const unparseableIdx = out.indexOf("⊘ unparseable-mp");
  assert.ok(otherIdx >= 0, `expected other-mp header in output: ${out}`);
  assert.ok(unparseableIdx >= 0, `expected unparseable-mp header in output: ${out}`);
  // Verify alphabetical sort: other-mp < unparseable-mp.
  assert.ok(otherIdx < unparseableIdx, `expected other-mp before unparseable-mp: ${out}`);
  // Verify the cause trailer sits 2 spaces under the failed header.
  assert.match(
    out,
    /⊘ unparseable-mp \[user\] \(failed\) \{unparseable\}\n {2}cause: JSON parse error at line 3/,
  );
});

// ---------------------------------------------------------------------------
// Zero-plugin marketplace block (catalog lines 240-246)
// ---------------------------------------------------------------------------

test("CMC-22 zero-plugin marketplace renders header + indented `(no plugins)`", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "empty-mp",
      scope: "project",
      outcomeClass: "ok",
    },
    plugins: [{ kind: "empty", token: "no plugins" }],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  const expected = ["● empty-mp [project]", "  (no plugins)"].join("\n");
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// CMC-03 / MSG-GR-3 sort across multiple marketplaces (catalog lines 250-258)
// ---------------------------------------------------------------------------

test("CMC-03 / MSG-GR-3 sort: marketplace blocks ordered by compareByNameThenScope (project before user on tie)", () => {
  const officialProject: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "project",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "project",
        version: "0.9.0",
        status: "installed",
      },
    ],
  };
  const officialUser: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "user",
        version: "1.0.0",
        status: "installed",
      },
      {
        kind: "plugin-list",
        name: "beta",
        scope: "user",
        version: "2.0.0",
        status: "available",
      },
    ],
  };
  const zetaUser: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "zeta-mp",
      scope: "user",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "tool",
        scope: "user",
        version: "1.0.0",
        status: "installed",
        declaresAgents: true,
      },
    ],
  };
  // Pass in non-sorted order to verify the renderer sorts.
  const out = renderPluginList(
    { marketplaceBlocks: [zetaUser, officialUser, officialProject] },
    PROBE_UNLOADED,
  );
  const expected = [
    "● official [project] <autoupdate>",
    "  ● alpha [project] v0.9.0 (installed)",
    "● official [user] <autoupdate>",
    "  ● alpha [user] v1.0.0 (installed)",
    "  ○ beta v2.0.0 (available)",
    "● zeta-mp [user]",
    "  ● tool [user] v1.0.0 (installed) {requires pi-subagents}",
  ].join("\n");
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// Orphan project-scope plugin folded under user-scope header (catalog lines 205-213)
// ---------------------------------------------------------------------------

test("CMC-21 / D-13-17: orphan project plugin folds under user-scope marketplace header (renderer perspective)", () => {
  // The orchestrator at orchestrators/plugin/list.ts builds the folded payload
  // (D-13-19); this test verifies the renderer correctly emits the folded form
  // when the orchestrator passes a block whose plugins include rows whose
  // `scope` differs from the header's `scope`.
  const userBlockWithOrphan: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "official",
      scope: "user",
      marker: "autoupdate",
      outcomeClass: "ok",
    },
    plugins: [
      // D-13-18: per-row [<scope>] reflects the ACTUAL install scope.
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "project",
        version: "0.9.0",
        status: "installed",
      },
      {
        kind: "plugin-list",
        name: "alpha",
        scope: "user",
        version: "1.0.0",
        status: "installed",
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [userBlockWithOrphan] }, PROBE_LOADED);
  // MSG-GR-3 sort within the block: same-name rows tie-break by project-before-user.
  const expected = [
    "● official [user] <autoupdate>",
    "  ● alpha [project] v0.9.0 (installed)",
    "  ● alpha [user] v1.0.0 (installed)",
  ].join("\n");
  assert.equal(out, expected);
});

// ---------------------------------------------------------------------------
// MSG-PL-1 column-66 truncation boundary checks (replicates parametric V1 test)
// ---------------------------------------------------------------------------

test("MSG-PL-1 truncateColumn66 boundary: <=66 unchanged; >66 sliced to 65 + U+2026", () => {
  // 65 chars: no truncation (below boundary)
  const d65 = "a".repeat(65);
  assert.equal(truncateColumn66(d65), d65);
  // 66 chars: no truncation (boundary inclusive)
  const d66 = "b".repeat(66);
  assert.equal(truncateColumn66(d66), d66);
  // 67 chars: truncated to 65 + "…"
  const d67 = "c".repeat(67);
  assert.equal(truncateColumn66(d67), "c".repeat(65) + "…");
  // 100 chars: same envelope
  const d100 = "d".repeat(100);
  assert.equal(truncateColumn66(d100), "d".repeat(65) + "…");
});

test("MSG-PL-1 description truncation renders in the second indented line per CMC-22", () => {
  const block: PluginListMarketplaceBlock = {
    header: {
      kind: "marketplace",
      name: "x",
      scope: "user",
      outcomeClass: "ok",
    },
    plugins: [
      {
        kind: "plugin-list",
        name: "p",
        scope: "user",
        version: "1",
        status: "installed",
        description: "z".repeat(100),
      },
    ],
  };
  const out = renderPluginList({ marketplaceBlocks: [block] }, PROBE_LOADED);
  // Description at 4-space indent; truncated to 65 + U+2026.
  assert.match(out, /\n {4}z{65}…$/);
});
