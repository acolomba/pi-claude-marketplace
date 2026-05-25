// tests/architecture/catalog-uat.test.ts
//
// Phase 13 Wave 3 Plan 13-03-01 -- catalog UAT byte-equality runner.
//
// Reads `docs/output-catalog.md` at test time, extracts every fenced
// renderer-output block annotated with `<!-- catalog-state: STATE -->`
// inside a per-command H2 section, pairs each `(section, STATE)` tuple
// with a programmatic fixture, and asserts byte equality against the
// rendered output of the Wave 1 + Wave 2 presentation primitives:
//
//   - renderRow (presentation/compact-line.ts)
//   - cascadeSummary (presentation/cascade-summary.ts)
//   - renderManualRecovery (presentation/manual-recovery.ts)
//   - renderRollbackPartial (presentation/rollback-partial.ts)
//   - renderPluginList (presentation/plugin-list.ts)
//   - renderMarketplaceList (presentation/marketplace-list.ts)
//   - appendReloadHint (presentation/reload-hint.ts)
//
// This test is the BINDING verification gate for every per-command
// requirement (CMC-22..34) and the Wave 3 plan #1 gate per D-13-04: if
// any assertion fails, the Wave 3 ES-5 atomic commit (plan #2) DOES NOT
// RUN. The catalog is the SOLE source of truth (D-30); the test reads
// the .md at runtime and does NOT duplicate the rendered examples into
// test code -- fixtures construct the renderer-input state and let the
// renderer produce the comparison string.
//
// Parser shape (RESEARCH.md Pitfall 7): anchor extraction to the
// per-command H2 boundaries (`/^## /` lines whose heading text starts
// with a backtick-wrapped `/claude:plugin ` command, or matches the
// `Manual recovery anchors` heading). Within each section, walk lines;
// a `<!-- catalog-state: STATE -->` comment is paired with the NEXT
// fenced block (triple-backtick optionally followed by a language tag).
//
// Templates in non-command sections (Conventions, Severity routing,
// Status token reference, Empty / no-op surfaces, Usage errors,
// Resolutions, Cross-references) carry no discriminator and are skipped.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  appendReloadHint,
  cascadeSummary,
  renderManualRecovery,
  renderMarketplaceList,
  renderRow,
} from "../../extensions/pi-claude-marketplace/presentation/index.ts";
import { renderPluginList } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

import type {
  EntityErrorRow,
  ManualRecoveryLine,
  MarketplaceRow,
  PluginCascadeRow,
  PluginInlineRow,
  PluginInlineUninstalledRow,
  SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/index.ts";
import type { PluginListMarketplaceBlock } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

// ---------------------------------------------------------------------------
// Catalog extraction
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");

interface CatalogExample {
  readonly section: string;
  readonly state: string;
  readonly expected: string;
}

/**
 * Walk catalog lines, tracking the current per-command H2 section, and
 * pair each `<!-- catalog-state: STATE -->` annotation with the body of
 * the next fenced block.
 *
 * Per-command H2 sections:
 *   - Backtick-wrapped command tokens: `` ## `/claude:plugin <verb>` ``
 *   - Plain heading: `## Manual recovery anchors`
 *
 * Non-command H2 sections (Conventions, Severity routing, etc.) reset
 * `currentSection` to `null`; any subsequent fenced block in those
 * sections is skipped because no `catalog-state:` discriminator can
 * appear under a null section.
 */
function loadCatalogExamples(catalog: string): readonly CatalogExample[] {
  const lines = catalog.split("\n");
  const examples: CatalogExample[] = [];
  let currentSection: string | null = null;
  let pendingState: string | null = null;
  let inFence = false;
  let fenceBody: string[] = [];

  const sectionRe = /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors)\s*$/;
  const stateRe = /^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/;

  for (const line of lines) {
    if (inFence) {
      if (line.startsWith("```")) {
        if (pendingState !== null && currentSection !== null) {
          examples.push({
            section: currentSection,
            state: pendingState,
            expected: fenceBody.join("\n"),
          });
        }

        pendingState = null;
        fenceBody = [];
        inFence = false;
        continue;
      }

      fenceBody.push(line);
      continue;
    }

    const sectionMatch = sectionRe.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[2] ?? "manual-recovery-anchors";
      pendingState = null;
      continue;
    }

    if (line.startsWith("## ")) {
      currentSection = null;
      pendingState = null;
      continue;
    }

    const stateMatch = stateRe.exec(line);
    if (stateMatch !== null) {
      pendingState = stateMatch[1] ?? null;
      continue;
    }

    if (line.startsWith("```")) {
      inFence = true;
      fenceBody = [];
    }
  }

  return examples;
}

// ---------------------------------------------------------------------------
// Fixture helpers + the FIXTURES map
// ---------------------------------------------------------------------------

const PROBE_BOTH_LOADED: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

const PROBE_SUBAGENTS_UNLOADED: SoftDepProbe = {
  piSubagentsLoaded: false,
  piMcpAdapterLoaded: true,
};

const PROBE_BOTH_UNLOADED: SoftDepProbe = {
  piSubagentsLoaded: false,
  piMcpAdapterLoaded: false,
};

const RELOAD_HINT = "/reload to pick up changes";

function inlineWithReload(row: PluginInlineRow | PluginInlineUninstalledRow): string {
  return appendReloadHint(renderRow(row, PROBE_BOTH_LOADED), RELOAD_HINT);
}

function cascadeWithOptionalReload(
  marketplace: MarketplaceRow,
  rows: readonly PluginCascadeRow[],
  probe: SoftDepProbe,
  withReload: boolean,
): string {
  const { message } = cascadeSummary({ marketplace, rows, probe });
  return withReload ? appendReloadHint(message, RELOAD_HINT) : message;
}

type FixtureFactory = () => string;
type FixtureMap = Readonly<Record<string, Readonly<Record<string, FixtureFactory>>>>;

const FIXTURES: FixtureMap = {
  "/claude:plugin list": {
    empty: () => renderPluginList({ marketplaceBlocks: [] }, PROBE_BOTH_LOADED),

    "single-mp-mixed": () => {
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
            name: "beta",
            scope: "user",
            version: "0.5.0 → v1.0.0",
            status: "upgradable",
            description: "Long description that exceeds the col-66 width budget will be truncated.",
          },
          {
            kind: "plugin-list",
            name: "delta",
            scope: "user",
            status: "unavailable",
            reasons: ["hooks"],
            description: "Free-text description; renders verbatim under 66 cols.",
          },
          {
            kind: "plugin-list",
            name: "epsilon",
            scope: "user",
            status: "unavailable",
            reasons: ["hooks", "lspServers"],
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
      return renderPluginList({ marketplaceBlocks: [block] }, PROBE_BOTH_LOADED);
    },

    "same-plugin-both-scopes": () => {
      const blocks: PluginListMarketplaceBlock[] = [
        {
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
        },
        {
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
        },
      ];
      return renderPluginList({ marketplaceBlocks: blocks }, PROBE_BOTH_LOADED);
    },

    "project-orphan-folded": () => {
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
      return renderPluginList({ marketplaceBlocks: [block] }, PROBE_BOTH_LOADED);
    },

    "soft-dep-on-installed": () => {
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
      return renderPluginList({ marketplaceBlocks: [block] }, PROBE_BOTH_UNLOADED);
    },

    "unparseable-mp": () => {
      const blocks: PluginListMarketplaceBlock[] = [
        {
          header: {
            kind: "marketplace",
            name: "unparseable-mp",
            scope: "user",
            outcomeClass: "failure",
            status: "failed",
            reasons: ["unparseable"],
          },
          plugins: [],
          causeTrailer: "JSON parse error at line 3",
        },
        {
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
        },
      ];
      return renderPluginList({ marketplaceBlocks: blocks }, PROBE_BOTH_LOADED);
    },

    "zero-plugin-mp-block": () => {
      const blocks: PluginListMarketplaceBlock[] = [
        {
          header: {
            kind: "marketplace",
            name: "empty-mp",
            scope: "project",
            outcomeClass: "ok",
          },
          plugins: [{ kind: "empty", token: "no plugins" }],
        },
        {
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
        },
      ];
      return renderPluginList({ marketplaceBlocks: blocks }, PROBE_BOTH_LOADED);
    },

    "multiple-mps": () => {
      const blocks: PluginListMarketplaceBlock[] = [
        {
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
        },
        {
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
        },
        {
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
        },
      ];
      return renderPluginList({ marketplaceBlocks: blocks }, PROBE_SUBAGENTS_UNLOADED);
    },
  },

  "/claude:plugin install <plugin>@<marketplace>": {
    success: () =>
      inlineWithReload({
        kind: "plugin-inline",
        name: "helper",
        marketplace: "official",
        scope: "user",
        version: "1.0.0",
        status: "installed",
      }),

    "success-with-soft-dep": () =>
      appendReloadHint(
        renderRow(
          {
            kind: "plugin-inline",
            name: "helper",
            marketplace: "official",
            scope: "user",
            version: "1.0.0",
            status: "installed",
            declaresAgents: true,
            declaresMcp: true,
          },
          PROBE_BOTH_UNLOADED,
        ),
        RELOAD_HINT,
      ),

    "failure-unsupported-features": () =>
      renderRow(
        {
          kind: "plugin-inline",
          name: "helper",
          marketplace: "official",
          scope: "user",
          status: "unavailable",
          reasons: ["hooks", "lspServers"],
        },
        PROBE_BOTH_LOADED,
      ),

    "failure-runtime-with-cause": () => {
      const head: PluginInlineRow = {
        kind: "plugin-inline",
        name: "helper",
        marketplace: "official",
        scope: "user",
        status: "failed",
      };
      const causeLine =
        "  cause: state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0";
      return `${renderRow(head, PROBE_BOTH_LOADED)}\n${causeLine}`;
    },

    "failure-rollback-partial": () => {
      const parent: PluginInlineRow = {
        kind: "plugin-inline",
        name: "helper",
        marketplace: "official",
        scope: "user",
        status: "failed",
        reasons: ["rollback partial"],
      };
      // Catalog form: rollback-partial children carry bracketed phase
      // prefixes and a cause line at the same indent. The
      // `presentation/rollback-partial.ts` composer pairs a parent row
      // with `RollbackChild` compact rows; the catalog example uses a
      // textual / prose form for the children (operator-readable, no
      // compact-line status token). The fixture composes the catalog form
      // directly to mirror the orchestrator's actual emission.
      return [
        renderRow(parent, PROBE_BOTH_LOADED),
        "  [phase3a] failed to remove staged agent: EACCES",
        "  [phase3b] orphan path: /.../helper.bak",
        "  cause: orchestrator failed mid-staging",
      ].join("\n");
    },
  },

  "/claude:plugin uninstall <plugin>@<marketplace>": {
    success: () =>
      inlineWithReload({
        kind: "plugin-inline-uninstalled",
        name: "helper",
        marketplace: "official",
        scope: "user",
        version: "1.0.0",
      }),

    "success-soft-dep-omitted": () =>
      inlineWithReload({
        kind: "plugin-inline-uninstalled",
        name: "helper",
        marketplace: "official",
        scope: "user",
        version: "1.0.0",
      }),

    "failure-permission-denied": () => {
      // Uninstall failure renders the failed plugin as an EntityErrorRow
      // (the only structural variant carrying `name@marketplace [scope]
      // (status) {reasons}` plus an indented `cause:` trailer) so the
      // catalog's compact-line + cause-line shape matches by byte.
      const row: EntityErrorRow = {
        kind: "entity-error",
        name: "helper",
        marketplace: "official",
        scope: "user",
        status: "failed",
        reasons: ["permission denied"],
      };
      const cause = "  cause: EACCES: permission denied, unlink '/path/to/file'";
      return `${renderRow(row, PROBE_BOTH_LOADED)}\n${cause}`;
    },
  },

  "/claude:plugin reinstall": {
    "single-mp-all-reinstalled": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            version: "0.5.0",
            status: "reinstalled",
          },
        ],
        PROBE_BOTH_LOADED,
        true,
      ),

    "success-with-soft-dep": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
            declaresAgents: true,
            declaresMcp: true,
          },
        ],
        PROBE_BOTH_UNLOADED,
        true,
      ),

    "single-mp-mixed-outcomes": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            status: "failed",
            reasons: ["source missing"],
          },
        ],
        PROBE_BOTH_LOADED,
        true,
      ),

    "single-mp-all-failed": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            status: "failed",
            reasons: ["source missing"],
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "failed",
            reasons: ["unreadable manifest"],
          },
        ],
        PROBE_BOTH_LOADED,
        false,
      ),

    "plugin-became-unavailable": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            status: "unavailable",
            reasons: ["hooks"],
          },
        ],
        PROBE_BOTH_LOADED,
        true,
      ),

    "bare-multi-mp": () => {
      const local = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "local-mp",
          scope: "project",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "helper",
            scope: "project",
            version: "0.5.0",
            status: "reinstalled",
          },
          {
            kind: "plugin-cascade",
            name: "tool",
            scope: "project",
            version: "1.0.0",
            status: "reinstalled",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      const official = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            status: "failed",
            reasons: ["source missing"],
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      return appendReloadHint(`${local}\n${official}`, RELOAD_HINT);
    },

    // CR-01 / 14.2-01 D-03: same-marketplace-name-cross-scope fixture
    // locks project-before-user cascade-block ordering by byte equality.
    // Pair with `<!-- catalog-state: same-mp-both-scopes -->` annotation
    // under `## /claude:plugin reinstall` in docs/output-catalog.md.
    "same-mp-both-scopes": () => {
      const project = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "project",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "project",
            version: "1.0.0",
            status: "reinstalled",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      const user = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "user",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            version: "1.0.0",
            status: "reinstalled",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      return appendReloadHint(`${project}\n${user}`, RELOAD_HINT);
    },
  },

  "/claude:plugin update": {
    "single-mp-mixed": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "0.5.0 → v1.0.0",
            status: "updated",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            version: "1.0.0 → v1.4.0",
            status: "failed",
            reasons: ["network unreachable"],
          },
        ],
        PROBE_BOTH_LOADED,
        true,
      ),

    "failed-with-rollback-partial": () => {
      const mp: MarketplaceRow = {
        kind: "marketplace",
        name: "official",
        scope: "user",
        marker: "autoupdate",
        outcomeClass: "ok",
      };
      const parent: PluginCascadeRow = {
        kind: "plugin-cascade",
        name: "delta",
        scope: "user",
        version: "1.0.0 → v1.4.0",
        status: "failed",
        reasons: ["rollback partial"],
      };
      const mpLine = renderRow(mp, PROBE_BOTH_LOADED);
      const parentLine = `  ${renderRow(parent, PROBE_BOTH_LOADED)}`;
      const children = [
        "    [phase3a] failed to remove staged agent: EACCES",
        "    [phase3b] orphan path: /.../delta.bak",
        "    cause: orchestrator failed mid-staging",
      ];
      return [mpLine, parentLine, ...children].join("\n");
    },

    "all-up-to-date-noop": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
        ],
        PROBE_BOTH_LOADED,
        false,
      ),

    "bare-multi-mp": () => {
      const local = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "local-mp",
          scope: "project",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "helper",
            scope: "project",
            version: "0.5.0 → v1.0.0",
            status: "updated",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      const official = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "0.5.0 → v1.0.0",
            status: "updated",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            version: "1.0.0 → v1.4.0",
            status: "failed",
            reasons: ["network unreachable"],
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      return appendReloadHint(`${local}\n${official}`, RELOAD_HINT);
    },

    // CR-01 / 14.2-01 D-03: same-marketplace-name-cross-scope fixture
    // locks project-before-user cascade-block ordering by byte equality.
    // Pair with `<!-- catalog-state: same-mp-both-scopes -->` annotation
    // under `## /claude:plugin update` in docs/output-catalog.md.
    "same-mp-both-scopes": () => {
      const project = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "project",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "project",
            version: "0.9.0 → v1.0.0",
            status: "updated",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      const user = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "user",
          outcomeClass: "ok",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            version: "0.5.0 → v1.0.0",
            status: "updated",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      return appendReloadHint(`${project}\n${user}`, RELOAD_HINT);
    },
  },

  "/claude:plugin import": {
    "fresh-mixed-both-scopes": () => {
      const blocks: Array<{ mp: MarketplaceRow; rows: PluginCascadeRow[] }> = [
        {
          mp: {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "project",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "official-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "official-plugin",
              scope: "user",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "directory-marketplace",
            scope: "project",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "local-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "directory-marketplace",
            scope: "user",
            outcomeClass: "ok",
            status: "skipped",
            reasons: ["already installed"],
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "local-plugin",
              scope: "user",
              status: "installed",
            },
            {
              kind: "plugin-cascade",
              name: "preinstalled-plugin",
              scope: "user",
              status: "skipped",
              reasons: ["already installed"],
            },
            {
              kind: "plugin-cascade",
              name: "unavailable-plugin",
              scope: "user",
              status: "unavailable",
              reasons: ["hooks"],
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "github-marketplace",
            scope: "project",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "github-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "github-marketplace",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "github-plugin",
              scope: "user",
              status: "installed",
            },
          ],
        },
      ];
      const bodies = blocks.map(
        (b) =>
          cascadeSummary({ marketplace: b.mp, rows: b.rows, probe: PROBE_BOTH_LOADED }).message,
      );
      return appendReloadHint(`Claude plugin import summary\n\n${bodies.join("\n")}`, RELOAD_HINT);
    },

    "soft-dep-markers": () => {
      const blocks: Array<{ mp: MarketplaceRow; rows: PluginCascadeRow[] }> = [
        {
          mp: {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "project",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "agent-only-plugin",
              scope: "project",
              status: "installed",
              declaresAgents: true,
              declaresMcp: false,
            },
            {
              kind: "plugin-cascade",
              name: "dual-plugin",
              scope: "project",
              status: "installed",
              declaresAgents: true,
              declaresMcp: true,
            },
          ],
        },
      ];
      const bodies = blocks.map(
        (b) =>
          cascadeSummary({ marketplace: b.mp, rows: b.rows, probe: PROBE_BOTH_UNLOADED }).message,
      );
      return appendReloadHint(`Claude plugin import summary\n\n${bodies.join("\n")}`, RELOAD_HINT);
    },

    "scope-project-narrow": () => {
      const blocks: Array<{ mp: MarketplaceRow; rows: PluginCascadeRow[] }> = [
        {
          mp: {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "project",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "official-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "directory-marketplace",
            scope: "project",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "local-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
        {
          mp: {
            kind: "marketplace",
            name: "github-marketplace",
            scope: "project",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          rows: [
            {
              kind: "plugin-cascade",
              name: "github-plugin",
              scope: "project",
              status: "installed",
            },
          ],
        },
      ];
      const bodies = blocks.map(
        (b) =>
          cascadeSummary({ marketplace: b.mp, rows: b.rows, probe: PROBE_BOTH_LOADED }).message,
      );
      return appendReloadHint(`Claude plugin import summary\n\n${bodies.join("\n")}`, RELOAD_HINT);
    },

    "source-mismatch": () => {
      const officialBody = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "claude-plugins-official",
          scope: "project",
          marker: "autoupdate",
          outcomeClass: "ok",
          status: "added",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "official-plugin",
            scope: "project",
            status: "installed",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;

      const githubBody = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "github-marketplace",
          scope: "project",
          marker: "autoupdate",
          outcomeClass: "ok",
          status: "added",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "github-plugin",
            scope: "project",
            status: "installed",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;

      const mismatchHeader = renderRow(
        {
          kind: "marketplace",
          name: "directory-marketplace",
          scope: "project",
          outcomeClass: "failure",
          status: "failed",
          reasons: ["source mismatch"],
        },
        PROBE_BOTH_LOADED,
      );
      const mismatchDiagnostic =
        "  Existing marketplace source ./mismatched-directory-marketplace does not match Claude settings source ./directory-marketplace.";
      const mismatchPlugin = `  ${renderRow(
        {
          kind: "plugin-cascade",
          name: "local-plugin",
          scope: "project",
          status: "skipped",
          reasons: ["source mismatch"],
        },
        PROBE_BOTH_LOADED,
      )}`;
      const mismatchBody = [mismatchHeader, mismatchDiagnostic, mismatchPlugin].join("\n");

      return appendReloadHint(
        `Claude plugin import summary\n\n${officialBody}\n${mismatchBody}\n${githubBody}`,
        RELOAD_HINT,
      );
    },

    // CR-01 / 14.2-01 D-03: same-marketplace-name-cross-scope fixture
    // locks project-before-user cascade-block ordering by byte equality.
    // Pair with `<!-- catalog-state: same-mp-both-scopes -->` annotation
    // under `## /claude:plugin import` in docs/output-catalog.md.
    "same-mp-both-scopes": () => {
      const project = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "project",
          outcomeClass: "ok",
          status: "added",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "project",
            status: "installed",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      const user = cascadeSummary({
        marketplace: {
          kind: "marketplace",
          name: "official",
          scope: "user",
          outcomeClass: "ok",
          status: "added",
        },
        rows: [
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "installed",
          },
        ],
        probe: PROBE_BOTH_LOADED,
      }).message;
      return appendReloadHint(`Claude plugin import summary\n\n${project}\n${user}`, RELOAD_HINT);
    },
  },

  "/claude:plugin bootstrap": {
    fresh: () =>
      appendReloadHint(
        renderRow(
          {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          PROBE_BOTH_LOADED,
        ),
        RELOAD_HINT,
      ),

    "already-bootstrapped": () =>
      renderRow(
        {
          kind: "marketplace",
          name: "claude-plugins-official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
          status: "skipped",
          reasons: ["already installed"],
        },
        PROBE_BOTH_LOADED,
      ),
  },

  "/claude:plugin marketplace list": {
    empty: () => renderMarketplaceList([]),

    "mixed-scopes": () =>
      renderMarketplaceList([
        { name: "alpha", scope: "project", source: pathSource("./alpha"), autoupdate: true },
        { name: "alpha", scope: "user", source: pathSource("./alpha-user") },
        { name: "beta", scope: "user", source: pathSource("./beta") },
        { name: "zeta", scope: "project", source: pathSource("./zeta"), autoupdate: true },
      ]),
  },

  "/claude:plugin marketplace add <source>": {
    "path-source": () =>
      appendReloadHint(
        renderRow(
          {
            kind: "marketplace",
            name: "local-mp",
            scope: "user",
            outcomeClass: "ok",
            status: "added",
          },
          PROBE_BOTH_LOADED,
        ),
        RELOAD_HINT,
      ),

    "github-source": () =>
      appendReloadHint(
        renderRow(
          {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
            status: "added",
          },
          PROBE_BOTH_LOADED,
        ),
        RELOAD_HINT,
      ),

    "failure-unreachable": () => {
      const row: MarketplaceRow = {
        kind: "marketplace",
        name: "unreachable-mp",
        scope: "user",
        outcomeClass: "failure",
        status: "failed",
      };
      const cause = "  cause: fatal: unable to access 'https://...': Could not resolve host";
      return `${renderRow(row, PROBE_BOTH_LOADED)}\n${cause}`;
    },
  },

  "/claude:plugin marketplace remove <name>": {
    clean: () =>
      appendReloadHint(
        renderRow(
          {
            kind: "marketplace",
            name: "local-mp",
            scope: "user",
            outcomeClass: "ok",
            status: "removed",
          },
          PROBE_BOTH_LOADED,
        ),
        RELOAD_HINT,
      ),

    partial: () => {
      // The partial-removal cascade renders a failed marketplace header
      // followed by indented child rows (uninstalled successes + failed
      // children with cause trailers), the reload-hint trailer, and the
      // recovery anchor.
      const header = renderRow(
        {
          kind: "marketplace",
          name: "local-mp",
          scope: "user",
          outcomeClass: "failure",
          status: "failed",
          reasons: ["plugins remain"],
        },
        PROBE_BOTH_LOADED,
      );
      // Successful uninstall child: indented 2 spaces, no `@local-mp`
      // marketplace anchor (MSG-GR-2 cascade carve-out). Use a cascade
      // row variant with status "uninstalled" so the @<mp> token is
      // omitted; render at the bare compact-line shape.
      const successChild = `  ${renderRow(
        {
          kind: "plugin-cascade",
          name: "helper",
          scope: "user",
          version: "1.0.0",
          status: "uninstalled",
        },
        PROBE_BOTH_LOADED,
      )}`;
      const failedChild = `  ${renderRow(
        {
          kind: "plugin-cascade",
          name: "tool",
          scope: "user",
          status: "failed",
          reasons: ["permission denied"],
        },
        PROBE_BOTH_LOADED,
      )}`;
      const failedChildCause = "    cause: EACCES: permission denied";
      const body = [header, successChild, failedChild, failedChildCause].join("\n");
      const retry = "Fix the underlying issue and retry.";
      return `${appendReloadHint(body, RELOAD_HINT)}\n\n${retry}`;
    },
  },

  "/claude:plugin marketplace update <name>": {
    "autoupdate-off-manifest-refresh": () =>
      renderRow(
        {
          kind: "marketplace",
          name: "local-mp",
          scope: "user",
          outcomeClass: "ok",
          status: "updated",
        },
        PROBE_BOTH_LOADED,
      ),

    "mixed-outcomes": () =>
      cascadeWithOptionalReload(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "ok",
          status: "updated",
        },
        [
          {
            kind: "plugin-cascade",
            name: "alpha",
            scope: "user",
            version: "0.5.0 → v1.0.0",
            status: "updated",
          },
          {
            kind: "plugin-cascade",
            name: "beta",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
          },
          {
            kind: "plugin-cascade",
            name: "delta",
            scope: "user",
            version: "1.0.0 → v1.4.0",
            status: "failed",
            reasons: ["network unreachable"],
          },
        ],
        PROBE_BOTH_LOADED,
        true,
      ),

    "mp-failure-network": () => {
      const head = renderRow(
        {
          kind: "marketplace",
          name: "official",
          scope: "user",
          marker: "autoupdate",
          outcomeClass: "failure",
          status: "failed",
          reasons: ["network unreachable"],
        },
        PROBE_BOTH_LOADED,
      );
      const cause = "  cause: fatal: unable to access 'https://...': Could not resolve host";
      return `${head}\n${cause}`;
    },
  },

  "/claude:plugin marketplace autoupdate <enable|disable> <name>": {
    "enable-mixed": () =>
      [
        renderRow(
          {
            kind: "marketplace",
            name: "local-mp",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
          },
          PROBE_BOTH_LOADED,
        ),
        renderRow(
          {
            kind: "marketplace",
            name: "github-mp",
            scope: "project",
            marker: "autoupdate",
            outcomeClass: "ok",
          },
          PROBE_BOTH_LOADED,
        ),
        renderRow(
          {
            kind: "marketplace",
            name: "claude-plugins-official",
            scope: "user",
            marker: "autoupdate",
            outcomeClass: "ok",
            reasons: ["already enabled"],
          },
          PROBE_BOTH_LOADED,
        ),
      ].join("\n"),

    "disable-mixed": () =>
      [
        renderRow(
          {
            kind: "marketplace",
            name: "local-mp",
            scope: "user",
            marker: "no autoupdate",
            outcomeClass: "ok",
          },
          PROBE_BOTH_LOADED,
        ),
        renderRow(
          {
            kind: "marketplace",
            name: "some-mp",
            scope: "user",
            marker: "no autoupdate",
            outcomeClass: "ok",
            reasons: ["already disabled"],
          },
          PROBE_BOTH_LOADED,
        ),
      ].join("\n"),

    "failure-not-found": () =>
      renderRow(
        {
          kind: "marketplace",
          name: "missing-mp",
          scope: "user",
          outcomeClass: "failure",
          status: "failed",
          reasons: ["not found"],
        },
        PROBE_BOTH_LOADED,
      ),
  },

  "manual-recovery-anchors": {
    "install-failure-with-anchor": () => {
      // The catalog renders the failure row WITHOUT a reasons block; the
      // EntityErrorRow variant requires a reasons array, so emit it empty
      // (renderRow's composeReasons returns "" when the composed list is
      // empty -- MSG-GR-4 forbids `{}`).
      const installFailure: EntityErrorRow = {
        kind: "entity-error",
        name: "official-plugin",
        marketplace: "official",
        scope: "user",
        status: "failed",
        reasons: [],
      };
      const head = renderRow(installFailure, PROBE_BOTH_LOADED);
      const headWithCause = `${head}\n  cause: bridge: agent staging conflict`;

      const recovery: ManualRecoveryLine = {
        kind: "manual-recovery",
        resource: "agent index",
        reasons: ["unreadable"],
        orphanDetails: ["/path/to/agents-index.json", "/path/to/another-agent.md"],
      };
      const recoveryBody = renderManualRecovery(recovery, PROBE_BOTH_LOADED);

      return `${headWithCause}\n\n${recoveryBody}`;
    },
  },
};

// ---------------------------------------------------------------------------
// Test driver
// ---------------------------------------------------------------------------

test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with a fixture", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  assert.ok(
    examples.length >= 30,
    `Expected at least 30 annotated catalog examples; found ${examples.length}. Check that the discriminator comments in docs/output-catalog.md were not lost.`,
  );

  interface Failure {
    readonly section: string;
    readonly state: string;
    readonly kind: "missing-fixture" | "byte-mismatch";
    readonly expected?: string;
    readonly actual?: string;
  }

  const failures: Failure[] = [];

  for (const example of examples) {
    const sectionFixtures = FIXTURES[example.section];
    if (sectionFixtures === undefined) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "missing-fixture",
      });
      continue;
    }

    const factory = sectionFixtures[example.state];
    if (factory === undefined) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "missing-fixture",
      });
      continue;
    }

    const actual = factory();
    if (actual !== example.expected) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "byte-mismatch",
        expected: example.expected,
        actual,
      });
    }
  }

  if (failures.length > 0) {
    const formatted = failures
      .map((f) => {
        if (f.kind === "missing-fixture") {
          return `[MISSING FIXTURE] section=${f.section} state=${f.state}`;
        }

        return [
          `[BYTE MISMATCH] section=${f.section} state=${f.state}`,
          "--- expected ---",
          f.expected ?? "",
          "--- actual ---",
          f.actual ?? "",
          "----------------",
        ].join("\n");
      })
      .join("\n\n");
    assert.fail(`catalog UAT failures (${failures.length}):\n${formatted}`);
  }
});

test("loadCatalogExamples: returns no examples when the catalog has no annotations", () => {
  const noAnnotations =
    "# Bare catalog\n\n## `/claude:plugin list`\n\n```text\n(no plugins)\n```\n";
  const examples = loadCatalogExamples(noAnnotations);
  assert.equal(examples.length, 0);
});

test("loadCatalogExamples: pairs each discriminator with its next fenced block", () => {
  const sample = [
    "# header",
    "",
    "## `/claude:plugin list`",
    "",
    "<!-- catalog-state: empty -->",
    "",
    "```text",
    "(no plugins)",
    "```",
    "",
    "## Conventions",
    "",
    "```text",
    "<should not extract>",
    "```",
  ].join("\n");
  const examples = loadCatalogExamples(sample);
  assert.equal(examples.length, 1);
  assert.equal(examples[0]?.section, "/claude:plugin list");
  assert.equal(examples[0]?.state, "empty");
  assert.equal(examples[0]?.expected, "(no plugins)");
});
