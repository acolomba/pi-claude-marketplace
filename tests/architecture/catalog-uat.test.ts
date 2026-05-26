// tests/architecture/catalog-uat.test.ts
//
// Phase 17 Plan 17-03 -- catalog UAT byte-equality runner (v2 rewrite).
//
// Reads `docs/output-catalog.md` at test time, extracts every fenced
// renderer-output block annotated with `<!-- catalog-state: STATE -->`
// inside a per-command H2 section, pairs each `(section, STATE)` tuple
// with a programmatic `NotificationMessage` fixture, and asserts byte
// equality between the v2 catalog's expected block and what
// `notify(mockCtx, mockPi, message)` actually emits.
//
// SCOPE GATE (SNM-31, D-17-03 pure exclusion): this test drives `notify()`
// exclusively. The V1 composer fan-out (`renderRow`, `cascadeSummary`,
// `renderManualRecovery`, `renderRollbackPartial`, `renderPluginList`,
// `renderMarketplaceList`, `appendReloadHint`) is no longer referenced
// from this file -- Phase 21 owns the deletion of those composers; their
// surface remains covered by `tests/shared/notify.test.ts` until that
// deletion lands. The `domain/source.ts::pathSource` fixture-builder
// dependency is also gone -- v2 fixtures are pure data, not synthesized
// from domain helpers.
//
// FIXTURE SHAPE (D-17-05, RESEARCH.md Pitfall 6): the FIXTURES map is keyed
// by `(section, state)` tuples; each entry is a `CatalogFixture` carrying
// a `NotificationMessage` payload, a `MockPi` factory (to drive the
// `softDepStatus(pi)` probe inside `notify()`) and an optional
// `expectedSeverity` ("warning" | "error") so the driver loop can assert
// the Pi-API magic-string severity arg shape per Pitfall 6.
//
// PARSER PRESERVATION (D-17-05, D-17-06): the catalog-walking logic
// (`loadCatalogExamples` + the section/state regular expressions + the
// `currentSection = sectionMatch[2] ?? "manual-recovery-anchors"` fallback)
// is preserved VERBATIM from v1. The catalog convention is unchanged: a
// `<!-- catalog-state: STATE -->` comment is paired with the next fenced
// block inside a per-command H2 section.
//
// BINDING USER-CONTRACT GATE: byte-equality between `notify()`'s output
// and the v2.0 catalog (`docs/output-catalog.md` rewritten by Plan 17-02)
// is the closed-loop SNM-31 gate. After this plan lands, every byte change
// in either side must agree, structurally enforcing the v1.4 user
// contract.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Catalog extraction (preserved VERBATIM from v1 per D-17-05 + D-17-06)
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
// Mock helpers -- inline duplication of `tests/shared/notify-v2.test.ts`
// lines 136-179 per RESEARCH.md Q1 Option 1 recommendation.
// ---------------------------------------------------------------------------

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

/** Probe reports both pi-subagents and pi-mcp-adapter loaded -- no soft-dep markers fire. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

/** Probe reports pi-subagents loaded, pi-mcp-adapter NOT loaded -- {requires pi-mcp} fires on dep-bearing rows declaring mcp. */
function piWithSubagentsLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }],
  };
}

/** Probe reports pi-mcp-adapter loaded, pi-subagents NOT loaded -- {requires pi-subagents} fires on dep-bearing rows declaring agents. */
function piWithMcpLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "mcp" }],
  };
}

/** Probe reports nothing loaded -- both soft-dep markers fire when the row declares the dep. */
function piWithNothingLoaded(): MockPi {
  return {
    getAllTools: () => [],
  };
}

// ---------------------------------------------------------------------------
// Fixture map shape (D-17-05 + RESEARCH.md Pitfall 6).
// ---------------------------------------------------------------------------

interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
}

type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;

// ---------------------------------------------------------------------------
// FIXTURES -- one entry per `(section, state)` tuple parsed from the v2
// catalog. Outer-map keys are the 12 per-command H2 strings plus the
// `manual-recovery-anchors` fallback key (per the parser's
// `currentSection = sectionMatch[2] ?? "manual-recovery-anchors"` fallback).
// Inner-map keys are the catalog-state STATE strings.
//
// Per-fixture composition:
//   - `pi` picks a MockPi factory consistent with the state's soft-dep
//     markers (or piWithBothLoaded for states that emit no `{requires
//     pi-...}` markers).
//   - `expectedSeverity` is set ONLY when the payload triggers
//     computeSeverity() to return "warning" or "error" per D-16-11:
//       failed-bearing -> "error"
//       skipped or manual-recovery without failed -> "warning"
//       otherwise omit the field (info severity, no 2nd arg).
//   - Plugin variants honor the discriminated-union carve-outs at
//     `shared/notify.ts` lines 288-448 (required vs absent reasons /
//     dependencies / scope / version / cause / rollbackPartial fields).
// ---------------------------------------------------------------------------

const FIXTURES: FixtureMap = {
  // -------------------------------------------------------------------------
  // /claude:plugin list -- list-surface; mp.status === undefined.
  // -------------------------------------------------------------------------
  "/claude:plugin list": {
    empty: {
      pi: piWithBothLoaded(),
      message: { marketplaces: [] },
    },

    "single-mp-mixed": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              { status: "installed", name: "alpha", version: "1.0.0", dependencies: [] },
              {
                status: "upgradable",
                name: "beta",
                version: "1.0.0",
                reasons: ["stale clone"],
              },
              { status: "unavailable", name: "delta", reasons: ["hooks"] },
              {
                status: "unavailable",
                name: "epsilon",
                reasons: ["hooks", "lspServers"],
              },
              { status: "available", name: "gamma", version: "2.0.0" },
            ],
          },
        ],
      },
    },

    "same-plugin-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            details: { autoupdate: true },
            plugins: [{ status: "installed", name: "alpha", version: "0.9.0", dependencies: [] }],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [{ status: "installed", name: "alpha", version: "1.0.0", dependencies: [] }],
          },
        ],
      },
    },

    "project-orphan-folded": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
                scope: "project",
              },
              {
                status: "installed",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                // Same-scope row also carries explicit `scope` because the
                // orchestrator disambiguates the two `alpha` rows (orphan-
                // folded + same-scope) by emitting both brackets. Without
                // the explicit scope, the user-scoped alpha row would emit
                // no bracket -- catalog renders both with brackets.
                scope: "user",
              },
            ],
          },
        ],
      },
    },

    "soft-dep-on-installed": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                name: "dual",
                version: "0.5.0",
                dependencies: ["agents", "mcp"],
              },
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                name: "mcp-tool",
                version: "2.0.0",
                dependencies: ["mcp"],
              },
            ],
          },
        ],
      },
    },

    "unparseable-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "other-mp",
            scope: "user",
            details: { autoupdate: true },
            plugins: [{ status: "installed", name: "helper", version: "1.0.0", dependencies: [] }],
          },
          {
            name: "unparseable-mp",
            scope: "user",
            status: "failed",
            // Empty plugins[] -- the bare failed marketplace header is the
            // entire block. The v2 type model does not carry cause on
            // marketplace headers; orchestrators wanting to surface the
            // parse error must include a per-plugin failed/manual-recovery
            // row carrying the diagnostic as `cause?: Error`.
            plugins: [],
          },
        ],
      },
    },

    "zero-plugin-mp-block": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          { name: "empty-mp", scope: "project", plugins: [] },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [{ status: "installed", name: "alpha", version: "1.0.0", dependencies: [] }],
          },
        ],
      },
    },

    "multiple-mps": {
      pi: piWithMcpLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            details: { autoupdate: true },
            plugins: [{ status: "installed", name: "alpha", version: "0.9.0", dependencies: [] }],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              { status: "installed", name: "alpha", version: "1.0.0", dependencies: [] },
              { status: "available", name: "beta", version: "2.0.0" },
            ],
          },
          {
            name: "zeta-mp",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "tool",
                version: "1.0.0",
                dependencies: ["agents"],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin install -- single-plugin command; bare mp header.
  // -------------------------------------------------------------------------
  "/claude:plugin install <plugin>@<marketplace>": {
    success: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ status: "installed", name: "helper", version: "1.0.0", dependencies: [] }],
          },
        ],
      },
    },

    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    "failure-unsupported-features": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "unavailable",
                name: "helper",
                reasons: ["hooks", "lspServers"],
              },
            ],
          },
        ],
      },
    },

    "failure-runtime-with-cause": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                version: "1.0.0",
                reasons: ["permission denied"],
                cause: new Error(
                  "state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0",
                ),
              },
            ],
          },
        ],
      },
    },

    "failure-rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                version: "1.0.0",
                reasons: ["rollback partial"],
                cause: new Error("orchestrator failed mid-staging"),
                rollbackPartial: [
                  {
                    phase: "phase3a",
                    cause: new Error("failed to remove staged agent: EACCES"),
                  },
                  { phase: "phase3b", cause: new Error("orphan path: /.../helper.bak") },
                ],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin uninstall -- single-plugin command.
  // -------------------------------------------------------------------------
  "/claude:plugin uninstall <plugin>@<marketplace>": {
    success: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ status: "uninstalled", name: "helper", version: "1.0.0" }],
          },
        ],
      },
    },

    "success-soft-dep-omitted": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [{ status: "uninstalled", name: "helper", version: "1.0.0" }],
          },
        ],
      },
    },

    "failure-permission-denied": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                version: "1.0.0",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied, unlink '/path/to/file'"),
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin reinstall -- multi-plugin cascade; bare mp header.
  // -------------------------------------------------------------------------
  "/claude:plugin reinstall": {
    "single-mp-all-reinstalled": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                name: "beta",
                version: "0.5.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    "single-mp-mixed-outcomes": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
              { status: "failed", name: "delta", reasons: ["source missing"] },
            ],
          },
        ],
      },
    },

    "single-mp-all-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              { status: "failed", name: "alpha", reasons: ["source missing"] },
              { status: "failed", name: "beta", reasons: ["invalid manifest"] },
            ],
          },
        ],
      },
    },

    "plugin-became-unavailable": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "unavailable", name: "delta", reasons: ["hooks"] },
            ],
          },
        ],
      },
    },

    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                name: "helper",
                version: "0.5.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                name: "tool",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
              { status: "failed", name: "delta", reasons: ["source missing"] },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                name: "beta",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin update -- multi-plugin cascade; version-arrow rows.
  // -------------------------------------------------------------------------
  "/claude:plugin update": {
    "single-mp-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
              {
                status: "failed",
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    "failed-with-rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "delta",
                version: "1.0.0",
                reasons: ["rollback partial"],
                cause: new Error("orchestrator failed mid-staging"),
                rollbackPartial: [
                  {
                    phase: "phase3a",
                    cause: new Error("failed to remove staged agent: EACCES"),
                  },
                  { phase: "phase3b", cause: new Error("orphan path: /.../delta.bak") },
                ],
              },
            ],
          },
        ],
      },
    },

    "all-up-to-date-noop": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              { status: "skipped", name: "alpha", reasons: ["up-to-date"] },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
            ],
          },
        ],
      },
    },

    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "updated",
                name: "helper",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
              {
                status: "failed",
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "updated",
                name: "alpha",
                from: "0.9.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                name: "beta",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin import -- multi-marketplace cascade with `added` mp status.
  // -------------------------------------------------------------------------
  "/claude:plugin import": {
    "fresh-mixed-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "official-plugin", dependencies: [] }],
          },
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [{ status: "installed", name: "official-plugin", dependencies: [] }],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "local-plugin", dependencies: [] }],
          },
          {
            name: "directory-marketplace",
            scope: "user",
            status: "added",
            plugins: [
              { status: "installed", name: "local-plugin", dependencies: [] },
              { status: "unavailable", name: "unavailable-plugin", reasons: ["hooks"] },
            ],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "github-plugin", dependencies: [] }],
          },
          {
            name: "github-marketplace",
            scope: "user",
            status: "added",
            plugins: [{ status: "installed", name: "github-plugin", dependencies: [] }],
          },
        ],
      },
    },

    "scope-project-narrow": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "official-plugin", dependencies: [] }],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "local-plugin", dependencies: [] }],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "github-plugin", dependencies: [] }],
          },
        ],
      },
    },

    "soft-dep-markers": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "agent-only-plugin",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                name: "dual-plugin",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            status: "added",
            plugins: [{ status: "installed", name: "alpha", dependencies: [] }],
          },
          {
            name: "official",
            scope: "user",
            status: "added",
            plugins: [{ status: "installed", name: "beta", dependencies: [] }],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin bootstrap -- marketplace-only block.
  // -------------------------------------------------------------------------
  "/claude:plugin bootstrap": {
    fresh: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [],
          },
        ],
      },
    },

    "already-bootstrapped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "updated",
            plugins: [],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace list -- list-surface; mp.status === undefined.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace list": {
    empty: {
      pi: piWithBothLoaded(),
      message: { marketplaces: [] },
    },

    "mixed-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "alpha",
            scope: "project",
            details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
            plugins: [],
          },
          { name: "alpha", scope: "user", plugins: [] },
          { name: "beta", scope: "user", plugins: [] },
          {
            name: "zeta",
            scope: "project",
            details: { autoupdate: true },
            plugins: [],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace add -- marketplace-only block.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace add <source>": {
    "path-source": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
      },
    },

    "github-source": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [],
          },
        ],
      },
    },

    "failure-unreachable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "unreachable-mp",
            scope: "user",
            status: "failed",
            plugins: [],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace remove -- marketplace + cascade.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace remove <name>": {
    clean: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
      },
    },

    partial: {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "failed",
            plugins: [
              { status: "uninstalled", name: "helper", version: "1.0.0" },
              {
                status: "failed",
                name: "tool",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied"),
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace update -- marketplace + plugin cascade.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace update <name>": {
    "autoupdate-off-manifest-refresh": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [{ name: "local-mp", scope: "user", status: "updated", plugins: [] }],
      },
    },

    "mixed-outcomes": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "updated",
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              { status: "skipped", name: "beta", reasons: ["up-to-date"] },
              {
                status: "failed",
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    "mp-failure-network": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [{ name: "official", scope: "user", status: "failed", plugins: [] }],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace autoupdate -- marketplace-only flag flip.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace autoupdate <enable|disable> <name>": {
    "enable-fresh": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
      },
    },

    "disable-fresh": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
      },
    },

    "enable-idempotent": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            reasons: ["already enabled"],
            plugins: [],
          },
        ],
      },
    },

    "disable-idempotent": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            reasons: ["already disabled"],
            plugins: [],
          },
        ],
      },
    },

    "failure-not-found": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [{ name: "missing-mp", scope: "user", status: "failed", plugins: [] }],
      },
    },
  },

  // -------------------------------------------------------------------------
  // Manual recovery anchors -- per-plugin manual-recovery row inside a block.
  // -------------------------------------------------------------------------
  "manual-recovery-anchors": {
    "per-plugin-manual-recovery": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "manual recovery",
                name: "helper",
                version: "1.0.0",
                reasons: ["unreadable"],
                cause: new Error("bridge: agent staging conflict"),
              },
            ],
          },
        ],
      },
    },
  },
};

// Reference `piWithSubagentsLoaded` so the helper does not become dead
// code when no current fixture uses it; it remains available as a
// composition primitive for future states. The other three factories
// are used directly above.
void piWithSubagentsLoaded;

// ---------------------------------------------------------------------------
// Test driver -- walk every parsed catalog example, look up its fixture,
// invoke notify() against a fresh mock ctx + the fixture's mock pi, and
// assert byte equality + severity-arg shape.
// ---------------------------------------------------------------------------

test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  assert.ok(
    examples.length >= 30,
    `Expected at least 30 annotated catalog examples; found ${examples.length}. Check that the discriminator comments in docs/output-catalog.md were not lost.`,
  );

  interface Failure {
    readonly section: string;
    readonly state: string;
    readonly kind: "missing-fixture" | "byte-mismatch" | "severity-mismatch";
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

    const fixture = sectionFixtures[example.state];
    if (fixture === undefined) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "missing-fixture",
      });
      continue;
    }

    // Fresh ctx per iteration -- mock.fn() accumulates calls across
    // invocations, so reusing it would leak state across fixtures.
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);

    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `notify() must call ctx.ui.notify exactly once per invocation (section=${example.section} state=${example.state})`,
    );

    const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const actual = callArgs[0];

    if (actual !== example.expected) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "byte-mismatch",
        expected: example.expected,
        actual,
      });
    }

    // Severity-arg assertion per RESEARCH.md Pitfall 6.
    if (fixture.expectedSeverity !== undefined) {
      if (callArgs.length !== 2 || callArgs[1] !== fixture.expectedSeverity) {
        failures.push({
          section: example.section,
          state: example.state,
          kind: "severity-mismatch",
          expected: fixture.expectedSeverity,
          actual: callArgs[1] ?? "(info / no 2nd arg)",
        });
      }
    } else if (callArgs.length !== 1) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "severity-mismatch",
        expected: "(info / no 2nd arg)",
        actual: callArgs[1] ?? "?",
      });
    }
  }

  if (failures.length > 0) {
    const formatted = failures
      .map((f) => {
        if (f.kind === "missing-fixture") {
          return `[MISSING FIXTURE] section=${f.section} state=${f.state}`;
        }

        if (f.kind === "severity-mismatch") {
          return [
            `[SEVERITY MISMATCH] section=${f.section} state=${f.state}`,
            `--- expected severity --- ${f.expected ?? ""}`,
            `--- actual severity ----- ${f.actual ?? ""}`,
          ].join("\n");
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
