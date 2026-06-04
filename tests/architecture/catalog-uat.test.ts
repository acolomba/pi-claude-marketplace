// tests/architecture/catalog-uat.test.ts
//
// Catalog UAT byte-equality runner.
//
// Reads `docs/output-catalog.md` at test time, extracts every fenced
// renderer-output block annotated with `<!-- catalog-state: STATE -->`
// inside a per-command H2 section, pairs each `(section, STATE)` tuple
// with a programmatic `NotificationMessage` fixture, and asserts byte
// equality between the catalog's expected block and what
// `notify(mockCtx, mockPi, message)` actually emits.
//
// SCOPE GATE (SNM-31): this test drives `notify()` exclusively. Fixtures are
// pure `NotificationMessage` data -- they are not synthesized from domain
// helpers.
//
// FIXTURE SHAPE: the FIXTURES map is keyed
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
//     computeSeverity() to return "warning" or "error" per the D-28-06
//     benign-softening ladder (refines D-16-11):
//       failed-bearing -> "error"
//       manual-recovery (without failed) -> "warning"
//       skipped (plugin or mp) whose reasons are NOT all in BENIGN_REASONS,
//         OR an mp-level skip with missing/empty reasons (D-28-08) -> "warning"
//       an ALL-BENIGN skip cascade (every reason in BENIGN_REASONS:
//         up-to-date / already installed / already autoupdate /
//         already no autoupdate) -> omit the field (info, no 2nd arg) per
//         UXG-02 / D-28-06
//       otherwise omit the field (info severity, no 2nd arg).
//     SUMMARY LINE (Phase 29 / UXG-07 / D-29-02): every fixture carrying
//     `expectedSeverity: "error" | "warning"` has its catalog cascade body
//     PREFIXED with a one-line summary (`"N plugin operation(s) [and M
//     marketplace operation(s)] failed|skipped."`) because `notify()` now
//     prepends that line for error/warning severity. The driver reads the
//     prefixed byte form from `docs/output-catalog.md` and byte-compares it
//     against live `notify()` output, so the catalog (Plan 29-02 Task 1) and
//     the emitted string agree. `expectedSeverity` is KEPT (D-29-06) -- the
//     severity arg routing is unchanged; only the body string gained the
//     prefix. Info-severity fixtures (no `expectedSeverity`) carry NO summary
//     line and are byte-unchanged.
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
              { status: "present", name: "alpha", version: "1.0.0", dependencies: [] },
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
                reasons: ["hooks", "lsp"],
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
            plugins: [{ status: "present", name: "alpha", version: "0.9.0", dependencies: [] }],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [{ status: "present", name: "alpha", version: "1.0.0", dependencies: [] }],
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
                status: "present",
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
                scope: "project",
              },
              {
                status: "present",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                // Same-scope row: no explicit `scope`. The renderer's
                // orphan-fold rule (D-16-17) suppresses the bracket when
                // `p.scope === mp.scope`; here we leave `p.scope`
                // undefined so the short-circuit is on the `undefined`
                // arm rather than the equality arm. Either input shape
                // yields the same byte form; mirrors the cleaner
                // `same-plugin-both-scopes` fixture above.
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
                status: "present",
                name: "dual",
                version: "0.5.0",
                dependencies: ["agents", "mcp"],
              },
              {
                status: "present",
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
              },
              {
                status: "present",
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
            plugins: [{ status: "present", name: "helper", version: "1.0.0", dependencies: [] }],
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
            plugins: [{ status: "present", name: "alpha", version: "1.0.0", dependencies: [] }],
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
            plugins: [{ status: "present", name: "alpha", version: "0.9.0", dependencies: [] }],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              { status: "present", name: "alpha", version: "1.0.0", dependencies: [] },
              { status: "available", name: "beta", version: "2.0.0" },
            ],
          },
          {
            name: "zeta-mp",
            scope: "user",
            plugins: [
              {
                status: "present",
                name: "tool",
                version: "1.0.0",
                dependencies: ["agents"],
              },
            ],
          },
        ],
      },
    },

    // SNM-35: persisted PI-7 hash renders as git-style short SHA on a
    // list-surface inventory row (`hash-2ea95f85703d` -> `v#2ea95f8`).
    "hash-version-list": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "present",
                name: "hashed-plugin",
                version: "hash-2ea95f85703d",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // PL-4: description on all four list-surface variants. Beta's description
    // is 80 chars (> 66) so it truncates to 63 + "..." = 66 chars rendered.
    "description-lines": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "present",
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                description: "A short description of the alpha plugin.",
              },
              {
                status: "upgradable",
                name: "beta",
                version: "1.0.0",
                reasons: ["stale clone"],
                // 80 chars -- truncated to 63 + "..." = 66 displayed.
                description:
                  "A longer description that is exactly sixty-three characters longer than expected.",
              },
              {
                status: "available",
                name: "gamma",
                version: "2.0.0",
                description: "Installable plugin with a description.",
              },
              {
                status: "unavailable",
                name: "delta",
                reasons: ["hooks"],
                description: "Unavailable plugin that still surfaces its description.",
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
                reasons: ["hooks", "lsp"],
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
      // UXG-02 / D-28-06: every reason is `up-to-date` (in BENIGN_REASONS), so
      // this all-benign skip cascade computes INFO -- no `expectedSeverity`.
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

    // SNM-35: an update arrow with PI-7 hashes on BOTH sides renders the
    // git-style short SHAs `#2ea95f8 → v#1c3d9a0` (bare from, v-prefixed
    // to per composeVersionArrow's asymmetry; D-23-05).
    "hash-version-arrow": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                name: "hashed-plugin",
                from: "hash-2ea95f85703d",
                to: "hash-1c3d9a0bbef1",
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
            details: { autoupdate: true },
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
  // /claude:plugin marketplace info -- Phase 42 / INFO-04 / INFO-08
  // anchored the first catalog state (`scope-mismatch-not-added`), and
  // Phase 43 / Plan 43-02 / INFO-07 closes full catalog state coverage
  // for the marketplace info command surface:
  //
  //   - Success states:
  //     * github-single-scope-full       (INFO-01 github + all optionals)
  //     * github-single-scope-minimal    (INFO-01 github, no ref/lastUpdated/desc)
  //     * path-single-scope              (INFO-01 path, minimal)
  //     * path-single-scope-with-description (INFO-01 path + description)
  //   - Multi-scope fan-out:
  //     * both-scopes-fan-out            (INFO-03 project-first fan-out)
  //   - Failure states:
  //     * absent-from-both               (no [scope] bracket; INFO-04 + D-03)
  //     * scope-mismatch-not-added       (Phase 42 anchor; PRESERVED byte-identical)
  //
  // Severity routing: every success + fan-out state is `info` (omits
  // `expectedSeverity`); the two `{not added}` failure states route to
  // `"error"`. The Phase 42 `scope-mismatch-not-added` fixture
  // (annotation, fence body, payload, severity) is preserved
  // byte-identical -- Plan 43-02 additions are purely additive.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace info <name>": {
    // Phase 43 / Plan 43-02 / INFO-07: full catalog state coverage for marketplace info.
    "github-single-scope-full": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "claude-plugins-official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "Official Claude plugin marketplace.",
      } satisfies NotificationMessage,
    },

    "github-single-scope-minimal": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "community-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "community-mp" },
      } satisfies NotificationMessage,
    },

    "path-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "local-mp",
        scope: "project",
        details: { autoupdate: false },
        source: { sourceKind: "path", absPath: "/home/user/marketplaces/local-mp" },
      } satisfies NotificationMessage,
    },

    "path-single-scope-with-description": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "dev-mp",
        scope: "user",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/home/user/src/dev-mp" },
        description: "Local development marketplace; experimental plugins.",
      } satisfies NotificationMessage,
    },

    "both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info-cascade",
        blocks: [
          {
            kind: "marketplace-info",
            name: "my-mp",
            scope: "project",
            details: { autoupdate: true },
            source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
          },
          {
            kind: "marketplace-info",
            name: "my-mp",
            scope: "user",
            details: { autoupdate: false },
            source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
          },
        ],
      } satisfies NotificationMessage,
    },

    "absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "ghost-mp",
        // Unused placeholder per the INFO-04 carve-out (renderer skips
        // the header on the bare `{not added}` row); supply a default.
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "ghost-mp",
          // D-03: `plugin.scope` OMITTED so the renderer's bracket
          // short-circuit emits no `[scope]` token. Absent-from-both
          // states have no [scope] bracket because the marketplace is
          // in NEITHER scope -- emitting one would be misleading.
          reasons: ["not added"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },

    // Phase 42 anchor preserved byte-identical. DO NOT modify.
    "scope-mismatch-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "my-mp",
        marketplaceScope: "user",
        // Minimal MarketplaceDetails -- the carve-out renderer does not
        // emit a marketplace header for this catalog state, so the
        // autoupdate marker is never composed; supply the required
        // `autoupdate` field with a default value.
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "my-mp",
          scope: "user",
          reasons: ["not added"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // Phase 44 / Plan 44-02 / INFO-02 + INFO-05 + INFO-07: full catalog state
  // coverage for `/claude:plugin info <plugin>@<marketplace>`. Mirrors the
  // Phase 43 marketplace-info entry above.
  //
  //   - Success states:
  //     * installed-single-scope                       (INFO-02 happy path)
  //     * installed-single-scope-with-dependencies     (INFO-02 + dependencies line)
  //     * available-single-scope                       (INFO-02 available bucket)
  //     * unavailable-single-scope                     (INFO-02 unavailable + {hooks})
  //   - Multi-scope fan-out:
  //     * installed-both-scopes-fan-out                (INFO-03 project-first fan-out)
  //   - Components arm (INFO-05):
  //     * components-not-resolved                      (external-source marker)
  //   - Failure states:
  //     * missing-plugin-not-in-manifest               ({not in manifest})
  //     * missing-marketplace-not-added-absent-from-both  ({not added}, no [scope])
  //     * missing-marketplace-not-added-scope-mismatch    ({not added}, with [scope])
  //
  // Severity routing: every success + fan-out + components-not-resolved
  // state is `info` (omits `expectedSeverity`); the three `{not added}` /
  // `{not in manifest}` failure states route to `"error"`.
  // -------------------------------------------------------------------------
  "/claude:plugin info <plugin>@<marketplace>": {
    "installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
        },
      } satisfies NotificationMessage,
    },

    "installed-single-scope-with-dependencies": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
          dependencies: ["helper@utils-mp"],
        },
      } satisfies NotificationMessage,
    },

    "available-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "chat-helper",
          version: "0.5.0",
          description: "Quick chat helper plugin; experimental.",
          componentsResolved: true,
          components: {
            commands: ["chat"],
            skills: ["chat-init"],
          },
        },
      } satisfies NotificationMessage,
    },

    "unavailable-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "unavailable",
          name: "legacy-plugin",
          version: "0.1.0",
          description: "Old plugin that declares hooks; not installable in Pi.",
          reasons: ["hooks"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },

    "installed-both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info-cascade",
        blocks: [
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "project",
            marketplaceDetails: { autoupdate: true },
            plugin: {
              status: "installed",
              name: "foo",
              version: "1.0.0",
              componentsResolved: true,
              components: { skills: ["s1"] },
            },
          },
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "user",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "foo",
              version: "2.0.0",
              componentsResolved: true,
              components: { agents: ["a1"] },
            },
          },
        ],
      } satisfies NotificationMessage,
    },

    "components-not-resolved": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "remote-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "remote-plugin",
          version: "1.0.0",
          description: "Remote plugin sourced from an external npm package.",
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },

    "missing-plugin-not-in-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "ghost-plugin",
          reasons: ["not in manifest"],
          // The renderer's standard-body path runs the components switch
          // unconditionally; use `componentsResolved: true` with empty
          // components so no `components: not resolved` marker appears
          // (the failed row is its own structural signal; INFO-05's
          // marker is reserved for installed/available external sources).
          componentsResolved: true,
          components: {},
        },
      } satisfies NotificationMessage,
    },

    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "ghost-mp",
        // Unused placeholder per the INFO-04 carve-out (renderer skips
        // the header on the bare `{not added}` row); supply a default.
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          // The MARKETPLACE name (not the plugin name) -- the
          // user-facing failure is "the marketplace is not added".
          name: "ghost-mp",
          // D-03: `plugin.scope` OMITTED so the renderer's bracket
          // short-circuit emits no `[scope]` token.
          reasons: ["not added"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },

    "missing-marketplace-not-added-scope-mismatch": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "ghost-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "ghost-mp",
          // `--scope user` was requested explicitly -> renderer emits
          // `[user]` bracket.
          scope: "user",
          reasons: ["not added"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace remove -- marketplace + cascade.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace remove <name>": {
    clean: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "removed",
            plugins: [{ status: "uninstalled", name: "helper" }],
          },
        ],
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
              { status: "uninstalled", name: "helper" },
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
    // UXG-05: autoupdate-OFF manifest-only refresh splits into a no-op
    // (`skipped {up-to-date}`) and a changed (`updated`) state. Per UXG-02 /
    // D-28-07 the benign `up-to-date` no-op now computes INFO (no
    // `expectedSeverity`), closing the Plan 27-04 deferral.
    "update-no-op-skipped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // UXG-05 (Phase 27 UAT Test-3 gap closure): the autoupdate-ON cascade
    // no-op converges to the SAME `(skipped) {up-to-date}` byte form as the
    // OFF no-op (plugins:[], dropped all-`unchanged` cascade rows). Distinct
    // mp name (`official`) so the two fixtures are not confusable.
    "update-autoupdate-noop-skipped": {
      pi: piWithBothLoaded(),
      // Benign `up-to-date` no-op -> INFO per UXG-02 / D-28-07 (no
      // `expectedSeverity`); byte form unchanged.
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "skipped",
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    "manifest-refresh-changed": {
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
  "/claude:plugin marketplace autoupdate|noautoupdate <name>": {
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
      // Benign idempotent flip (`already autoupdate` in BENIGN_REASONS) ->
      // INFO per UXG-02 / D-28-07 (no `expectedSeverity`); byte form unchanged.
      message: {
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            reasons: ["already autoupdate"],
            plugins: [],
          },
        ],
      },
    },

    "disable-idempotent": {
      pi: piWithBothLoaded(),
      // Benign idempotent flip (`already no autoupdate` in BENIGN_REASONS) ->
      // INFO per UXG-02 / D-28-07 (no `expectedSeverity`); byte form unchanged.
      message: {
        marketplaces: [
          {
            name: "foo",
            scope: "user",
            status: "skipped",
            reasons: ["already no autoupdate"],
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
