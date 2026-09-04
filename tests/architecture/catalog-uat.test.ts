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
// the Pi-API magic-string severity arg shape.
//
// PARSER PRESERVATION (D-17-05, D-17-06): the catalog-walking logic
// (`loadCatalogExamples` + the section/state regular expressions + the
// `currentSection = sectionMatch[2] ?? "manual-recovery-anchors"` fallback).
// The catalog convention: a
// `<!-- catalog-state: STATE -->` comment is paired with the next fenced
// block inside a per-command H2 section.
//
// BINDING USER-CONTRACT GATE: byte-equality between `notify()`'s output
// and the catalog (`docs/output-catalog.md`)
// is the closed-loop SNM-31 gate. Every byte change
// in either side must agree, structurally enforcing the user
// contract.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";

import { LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import {
  notifyUpdateNoOpWithContext,
  notifyWithContext,
} from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import { narrowUnsupportedKinds } from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

// ---------------------------------------------------------------------------
// Catalog extraction (D-17-05 + D-17-06)
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");

interface CatalogExample {
  readonly section: string;
  readonly state: string;
  readonly expected: string;
}

/**
 * Resolve the catalog section identifier from a heading match.
 *
 * Group 2 is the backtick-wrapped `/claude:plugin ...` capture, present only
 * on the command-section arm. When it is absent the literal section name in
 * group 1 is used: kebab-cased for the `Manual recovery anchors` arm, and
 * left verbatim for the plain `reconcile-applied-cascade` arm (RECON-04).
 */
function resolveSectionName(sectionMatch: RegExpExecArray): string {
  if (sectionMatch[2] !== undefined) {
    return sectionMatch[2];
  }

  const groupOne = sectionMatch[1] ?? "";
  return groupOne === "Manual recovery anchors" ? "manual-recovery-anchors" : groupOne;
}

/** Mutable scan position for the catalog line parser. */
interface CatalogScanState {
  currentSection: string | null;
  pendingState: string | null;
  inFence: boolean;
  fenceBody: string[];
}

// RECON-04: the `reconcile-applied-cascade` H2 is a command-less section --
// the cascade is emitted programmatically by the load-time apply
// orchestrator, not via a `/claude:plugin` verb. The parser therefore accepts
// a plain non-backtick heading whose text matches the discriminator-style
// identifier.
const CATALOG_SECTION_RE =
  /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors|reconcile-applied-cascade)\s*$/;
const CATALOG_STATE_RE = /^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/;

/**
 * Consume one line while inside a fenced block. The closing fence emits the
 * accumulated example, but only when the fence was preceded by BOTH a section
 * heading and a `catalog-state` marker.
 */
function scanInsideFence(line: string, st: CatalogScanState, examples: CatalogExample[]): void {
  if (!line.startsWith("```")) {
    st.fenceBody.push(line);
    return;
  }

  if (st.pendingState !== null && st.currentSection !== null) {
    examples.push({
      section: st.currentSection,
      state: st.pendingState,
      expected: st.fenceBody.join("\n"),
    });
  }

  st.pendingState = null;
  st.fenceBody = [];
  st.inFence = false;
}

/**
 * Consume one line while outside a fenced block: a recognised section heading
 * arms the section, any other H2 disarms it, a `catalog-state` marker arms the
 * next fence, and an opening fence starts accumulating.
 */
function scanOutsideFence(line: string, st: CatalogScanState): void {
  const sectionMatch = CATALOG_SECTION_RE.exec(line);
  if (sectionMatch !== null) {
    st.currentSection = resolveSectionName(sectionMatch);
    st.pendingState = null;
    return;
  }

  if (line.startsWith("## ")) {
    st.currentSection = null;
    st.pendingState = null;
    return;
  }

  const stateMatch = CATALOG_STATE_RE.exec(line);
  if (stateMatch !== null) {
    st.pendingState = stateMatch[1] ?? null;
    return;
  }

  if (line.startsWith("```")) {
    st.inFence = true;
    st.fenceBody = [];
  }
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
  const examples: CatalogExample[] = [];
  const st: CatalogScanState = {
    currentSection: null,
    pendingState: null,
    inFence: false,
    fenceBody: [],
  };

  for (const line of catalog.split("\n")) {
    if (st.inFence) {
      scanInsideFence(line, st, examples);
    } else {
      scanOutsideFence(line, st);
    }
  }

  return examples;
}

// ---------------------------------------------------------------------------
// Mock helpers.
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
// Fixture map shape (D-17-05).
// ---------------------------------------------------------------------------

interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
  // UGRM-01/UGRM-02: an optional emit override for catalog states whose
  // user-visible output is produced by the ORCHESTRATOR, not by `notify()`. The
  // bulk-`update` never-silent no-op headline (`all-up-to-date-noop`,
  // `skip-partially-upgradable-bulk`) is emitted via `emitUpdateNoOpCascade` -- the
  // `notify()` renderer alone (with a `tally {count: 0}` override) would collapse
  // the headline to `""`. When `emit` is present the driver calls it instead of
  // `notify()`, then byte-pairs the resulting `ctx.ui.notify` call against the
  // catalog block exactly as it does for the renderer path.
  readonly emit?: (ctx: MockCtx, pi: MockPi) => void;
}

type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;

// ---------------------------------------------------------------------------
// FIXTURES -- one entry per `(section, state)` tuple parsed from the
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
//     benign-softening ladder (D-16-11):
//       failed-bearing -> "error"
//       manual-recovery (without failed) -> "warning"
//       skipped (plugin or mp) whose reasons are NOT all in BENIGN_REASONS,
//         OR an mp-level skip with missing/empty reasons (D-28-08) -> "warning"
//       an ALL-BENIGN skip cascade (every reason in BENIGN_REASONS:
//         up-to-date / already installed / already autoupdate /
//         already no autoupdate) -> omit the field (info, no 2nd arg) per
//         UXG-02 / D-28-06
//       otherwise omit the field (info severity, no 2nd arg).
//     SUMMARY LINE (UXG-07 / D-29-02): every fixture carrying
//     `expectedSeverity: "error" | "warning"` has its catalog cascade body
//     PREFIXED with a one-line summary (`"N plugin operation(s) [and M
//     marketplace operation(s)] failed|skipped."`) because `notify()`
//     prepends that line for error/warning severity. The driver reads the
//     prefixed byte form from `docs/output-catalog.md` and byte-compares it
//     against live `notify()` output, so the catalog and
//     the emitted string agree. `expectedSeverity` is KEPT (D-29-06) -- the
//     severity arg routing is unchanged; only the body string gained the
//     prefix. Info-severity fixtures (no `expectedSeverity`) carry NO summary
//     line.
//   - Plugin variants honor the discriminated-union carve-outs in
//     `shared/notify.ts` (required vs absent reasons /
//     dependencies / scope / version / cause / rollbackPartial fields).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// USTAT-01 / D-64-01: the list/info render now de-collapses by resolver STATE.
// A not-installed plugin that resolves `partially-available` (lsp,
// unsupported component kind, or a parseable-but-unsupportable `hooks.json`)
// renders the distinct `(partially-available)` / `⊖` token; a STRUCTURALLY malformed
// plugin (invalid JSON / `type:"command"` missing `command`) stays
// `(unavailable)` / `⊘`. Classify each fixture below by its modeled resolver
// state, NOT by its reason brace -- the same `{unsupported hooks}` brace can
// appear on both arms (the structural arm via `narrowResolverNotes`, the
// partially-available arm via `narrowUnsupportedKinds`):
//   - list `single-mp-mixed`: `epsilon` carries `lsp` -> unambiguously resolver
//     `partially-available` -> modeled as `status: "partially-available"` -> `⊖ (partially-available)`;
//     `delta` models the structural malformed-`hooks.json` arm -> stays
//     `status: "unavailable"` -> `⊘ (unavailable)`. The catalog thus documents
//     BOTH de-collapsed byte forms on the list surface.
//   - info `unavailable-single-scope` carries `componentsResolved: false` --
//     the malformed-structural case (a partially-available plugin resolves,
//     setting `componentsResolved: true`, and renders `partially-installed`), so it
//     keeps its `(unavailable) {unsupported hooks}` bytes.
// The filter buckets (`--partial` / `--unavailable`) are unchanged; only the
// rendered token splits.
// ---------------------------------------------------------------------------
// OUT-02 / OUT-05 / DFEN-04 / RSTA-01: the two list-surface rows whose reason
// brace is composed by `LIST_RENDER` rather than by the central
// `renderPluginRow` arms. Declared once each so the fixture's `message` payload
// and its `emit` override cannot drift apart -- the driver byte-pairs whatever
// `emit` produces, and a second copy of the rows would let the documented
// payload and the emitted one diverge silently.
const AVAILABLE_INSTALLS_DISABLED_ROWS = [
  {
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    plugins: [
      {
        status: "available",
        name: "helper",
        version: "1.0.0",
        severity: "info",
        needsReload: false,
        reasons: ["installs disabled"],
      },
    ],
  },
] as const;

const REMOTE_INSTALLS_DISABLED_ROWS = [
  {
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    plugins: [
      {
        status: "remote",
        name: "git-plugin",
        version: "1.2.3",
        severity: "info",
        needsReload: false,
        reasons: ["installs disabled"],
      },
    ],
  },
] as const;

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
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "upgradable",
                name: "beta",
                version: "1.0.0",
                reasons: ["stale clone"],
              },
              { status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
              {
                status: "partially-available",
                name: "epsilon",
                reasons: ["unsupported hooks", "lsp"],
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
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
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
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
                scope: "project",
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
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
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "dual",
                version: "0.5.0",
                dependencies: ["agents", "mcp"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
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
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "unparseable-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            // Empty plugins[] -- the bare failed marketplace header is the
            // entire block. The type model does not carry cause on
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
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
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
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "available", name: "beta", version: "2.0.0" },
            ],
          },
          {
            name: "zeta-mp",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
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
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "hashed-plugin",
                version: "hash-2ea95f85703d",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // D-77-01 / PURL-09: a persisted git-source `sha-<12hex>` version renders as
    // the git-style short SHA on a list-surface inventory row
    // (`sha-a1b2c3d4e5f6` -> `v#a1b2c3d`).
    "sha-version-list": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "git-plugin",
                version: "sha-a1b2c3d4e5f6",
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
                status: "installed",
                severity: "info",
                needsReload: false,
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
                reasons: ["unsupported hooks"],
                description: "Unavailable plugin that still surfaces its description.",
              },
            ],
          },
        ],
      },
    },

    // D-54-01 / ENBL-04: list-surface inventory row for a
    // recorded-but-disabled plugin. The new `(disabled)` closed-set token
    // mirrors the catalog list section's `disabled-inventory` state.
    "disabled-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // PL-4: the disabled inventory row carries the manifest description on a
    // second 4-space-indented line, same as the other list-surface variants.
    "disabled-inventory-with-description": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
                description: "Disabled plugin that still surfaces its description.",
              },
            ],
          },
        ],
      },
    },

    // ENBL-16 / D-100-07: the disabled inventory row carries `not in manifest`
    // -- and no other reason. The stamp is an orchestrator decision made at the
    // inventory site, so the fresh-disable transition row (which stamps
    // nothing) keeps rendering bare. `piWithBothLoaded` is not what suppresses
    // the soft-dep markers here: the renderer passes both soft-dep flags as
    // `false` for this variant whatever the probe reports (ENBL-15).
    "disabled-inventory-not-in-manifest": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                reasons: ["not in manifest"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // OUT-02 / DFEN-04: list-surface inventory row for a not-installed plugin
    // whose marketplace ENTRY declares `defaultEnabled: false`. The claim is
    // entry-derived -- the cached manifest carries it whatever the clone state --
    // so the `(available)` row names the author's install-time declaration
    // before the install runs, not after it. The same plugin's post-install row
    // is the `install-disabled` state on the install surface. Severity `info`;
    // `needsReload: false`.
    //
    // Driven through the list surface's own `CommandContext` via `emit`, for
    // the same reason the bulk-update no-op states are: the reason brace on a
    // `(available)` / `(remote)` row is composed by `LIST_RENDER`, while the
    // central `renderPluginRow` arms omit `composeReasons` by construction --
    // no producer that renders through THEM stamps `reasons` on those two
    // statuses (OUT-05 / RSTA-01). `notifyWithContext` is the seam `listPlugins`
    // itself
    // calls, so the block below is byte-paired with the real list surface.
    "available-installs-disabled": {
      pi: piWithBothLoaded(),
      message: { marketplaces: AVAILABLE_INSTALLS_DISABLED_ROWS },
      emit: (ctx, pi) => {
        notifyWithContext(
          ctx as never,
          pi as never,
          LIST_CONTEXT,
          AVAILABLE_INSTALLS_DISABLED_ROWS,
        );
      },
    },

    // RSTA-01 / D-80-03: list-surface inventory row for a not-installed
    // git-source plugin whose clone/mirror is not materialized locally. The
    // `(remote)` closed-set token wears the dedicated `◌` glyph. Bare row --
    // no scope bracket (SNM-11), no reasons brace (D-80-03). Severity `info`;
    // `needsReload: false`.
    "remote-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "remote",
                name: "git-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // PL-4: the remote inventory row carries the manifest description on a
    // second 4-space-indented line, same as the other list-surface variants.
    "remote-inventory-with-description": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "remote",
                name: "git-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
                description: "Remote git-source plugin not yet fetched locally.",
              },
            ],
          },
        ],
      },
    },

    // OUT-02 / OUT-05 / RSTA-01: the `remote-inventory` row above
    // whose marketplace ENTRY declares `defaultEnabled: false`. This NARROWS
    // the bare-row rule rather than reversing it: the row still refuses every
    // probe-derived reason and both soft-dependency markers (no materialized
    // tree exists to derive either from) and admits exactly one entry-derived
    // token, which needs no tree at all. Severity `info`; `needsReload: false`.
    // Driven through the list surface's `CommandContext` via `emit`, for the
    // reason recorded on the `(available)` state above.
    "remote-installs-disabled": {
      pi: piWithBothLoaded(),
      message: { marketplaces: REMOTE_INSTALLS_DISABLED_ROWS },
      emit: (ctx, pi) => {
        notifyWithContext(ctx as never, pi as never, LIST_CONTEXT, REMOTE_INSTALLS_DISABLED_ROWS);
      },
    },

    // WDET-04: a workflow-bearing plugin uses the existing partial inventory
    // grammar. The typed reason has info severity and adds no hint or reload
    // trailer before installation.
    "workflow-partially-available-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                version: "1.0.0",
                reasons: ["workflows"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-02 / D-66-03: list-surface inventory row for a recorded-installed
    // plugin currently re-resolving `partially-available`. The derived `partially-installed`
    // token wears the dedicated `◉` glyph, distinct from the clean `●`
    // `(installed)` row. Severity `info` (the row omits `severity`).
    "partially-installed-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-02 / PHOOK-04 / PHOOK-05 / D-71-04: list-surface inventory row for
    // a recorded-installed partial-hook plugin re-resolving `partially-available` with
    // one or more hook events / matcher groups dropped. The partially-available
    // `hooks` kind rides the SINGLE aggregate `{unsupported hooks}` brace (no
    // per-handler fan-out on the list row -- D-71-04); the
    // `event(matcher) (unsupported)` breakdown lives on `info` (D-71-05). The
    // brace is sourced via `narrowUnsupportedKinds` (typed kind), distinct from
    // the structural `narrowResolverNotes` path an `unavailable` malformed-hooks
    // row uses.
    "partially-installed-inventory-hooks": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "hook-plugin",
                version: "1.0.0",
                reasons: ["unsupported hooks"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-04 / D-66-02 / D-66-03: list-surface inventory row for a
    // currently-clean installed plugin whose newer no-network candidate would
    // newly degrade it. The derived `partially-upgradable` token REUSES the `●`
    // glyph (the row is clean today), mirroring the `upgradable` precedent.
    "partially-upgradable-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-upgradable",
                name: "clean-plugin",
                version: "1.0.0",
                reasons: ["unsupported component"],
              },
            ],
          },
        ],
      },
    },

    // INV-01: the steady-state inventory row for a record whose marketplace
    // manifest loaded successfully but does not declare it. The clean
    // `(installed)` token and `●` glyph are unchanged -- manifest absence is a
    // reason, not a status. Severity stays `info` (no `expectedSeverity`).
    "manifest-absent-inventory": {
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
                name: "orphan-plugin",
                version: "1.0.0",
                needsReload: false,
                dependencies: [],
                reasons: ["not in manifest"],
                severity: "info",
              },
            ],
          },
        ],
      },
    },

    // INV-02: manifest absence and dropped components are independent axes, so
    // a degraded manifest-absent record carries BOTH -- absence first, then the
    // `narrowUnsupportedKinds` output. Severity stays `info`.
    "manifest-absent-partially-installed-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                version: "1.0.0",
                reasons: ["not in manifest", "lsp"],
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
            plugins: [
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // SEV-01: both declared companions are unloaded, so the otherwise-clean
    // install row stamps `warning` (silent degradation) and the cascade carries
    // the `needs attention` summary line. The per-row bytes are unchanged from
    // the info form -- only the severity / summary line moves.
    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08: install succeeds but the parsed hooks.json carries
    // an orphan-rewake handler (`rewakeMessage` / `rewakeSummary` without
    // `asyncRewake: true`). The closed-set REASONS token rides the existing
    // installed-row reasons brace. No soft-dep markers (both companion
    // extensions are loaded), so the brace contains exactly one reason.
    "success-with-orphan-rewake": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08 + D-16-15: the orphan-rewake token and the soft-dep
    // marker share ONE brace block. `composeReasons` appends the soft-dep
    // markers AFTER the typed `reasons[]`, so the brace renders as
    // `{orphan rewake, requires pi-subagents}`. Probe with only `mcp`
    // loaded so the `agents` soft-dep marker fires.
    // SEV-01: the declared `agents` companion is unloaded, so the success row
    // stamps `warning` even though the install succeeded -- the cascade carries
    // the `needs attention` summary line (per-row bytes unchanged).
    "success-with-orphan-rewake-and-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // WR-03: a `--partial` install succeeds with one or more components dropped
    // (the resolver's `partially-available` arm) -- the success row is
    // `(partially-installed)`. The partially-available arm still stages the SUPPORTED
    // components, so the row carries `dependencies`; with the `agents` companion
    // extension unloaded the soft-dep marker fires in the SAME brace AFTER the
    // dropped-component reason (MSG-GR-4), rendering `{lsp, requires
    // pi-subagents}`. Probe with only `mcp` loaded so the `agents` marker fires.
    // SEV-01: the unloaded `agents` companion is a silent degradation
    // independent of the dropped components, so the partially-installed success row
    // stamps `warning` and the cascade carries the `needs attention` summary
    // line. The direct `--partial` opt-in itself stays benign info -- the warning
    // is the missing companion, not the partial install.
    "success-partially-installed-with-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // WDET-04: explicit partial consent installs the supported components and
    // reports the dropped workflow kind through the existing success grammar.
    "workflow-partial-install-success": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                reasons: ["workflows"],
              },
            ],
          },
        ],
      },
    },

    // DFEN-04 / OUT-01 / OUT-04: the install ran whole and then unstaged
    // because the plugin's own `defaultEnabled` said so. The `◍` row names the
    // author-declared cause and carries the frozen enable-hint trailer; no
    // reload hint, because nothing net entered or left Pi's resource view.
    "install-disabled": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "helper",
                version: "1.0.0",
                reasons: ["installs disabled"],
                enableHint: true,
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / FSTAT-07: the same row over a degraded ledger run. The durable
    // facts ride the same brace after the cause, and the frontmatter degrade
    // raises the row to warning (so the cascade carries its summary line).
    "install-disabled-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "helper",
                version: "1.0.0",
                reasons: ["installs disabled", "malformed skill", "unsupported component"],
                enableHint: true,
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SEV-02 / D-69-03 / XSURF-01: partially-available install failure -- the row
    // renders the resolver-state-driven `(partially-available)` token (consistent with
    // list / info), carries the `--partial` hint trailer, and renders at error
    // severity.
    "failure-unsupported-features": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                reasons: ["unsupported hooks", "lsp"],
                partialHint: true,
                severity: "error",
              },
            ],
          },
        ],
      },
    },

    // WDET-04: a normal install rejects a workflow-bearing plugin through the
    // existing partially-available error row and partial-install hint.
    "workflow-install-rejection": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                reasons: ["workflows"],
                partialHint: true,
                severity: "error",
              },
            ],
          },
        ],
      },
    },

    // SEV-02 / D-69-03 / D-70-02: structurally `unavailable` install failure --
    // force cannot degrade-install a structural defect, so the row carries NO
    // `--partial` hint, but it still stamps error severity (the leading summary
    // line fires) because an install failure must read as an error.
    "failure-structural-unavailable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "unavailable",
                name: "helper",
                reasons: ["unsupported source"],
                severity: "error",
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
                severity: "error",
                needsReload: false,
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
                severity: "error",
                needsReload: false,
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

    // ATTR-01 / ATTR-08 / M1: marketplace absent -> standalone
    // `marketplace-not-added` variant on the marketplace subject (NOT
    // `{not in manifest}` on a plugin row). install always carries a
    // resolved scope, so the `[scope]` bracket is always present.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },

    // CMP-4 / SCOPE-01: the container exists in the scope the install did not
    // target, so the brace carries the cross-scope structural token INSTEAD of
    // `marketplace not added`. The message field is a BOOLEAN -- notify.ts owns the bytes.
    // The bare-row state above is the SAME variant with the flag omitted, which
    // is what a miss in both scopes emits.
    "missing-marketplace-not-added-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "user",
        presentInOtherScope: true,
      } satisfies NotificationMessage,
    },

    // The project-target direction of the same claim. Unreachable from
    // `install` (the CMP-3 fallback adopts a user-scope marketplace into
    // project scope) but reachable from every other verb that renders this row.
    "missing-marketplace-not-added-cross-scope-project": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "project",
        presentInOtherScope: true,
      } satisfies NotificationMessage,
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
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
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
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
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
                severity: "error",
                needsReload: false,
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

    // ATTR-04 / SCOPE-01 / M3 / M4: marketplace never added (or present only
    // in the other scope) -> LOUD standalone `marketplace-not-added` variant
    // carrying the requested-scope bracket (distinct from the silent PU-5
    // already-gone-plugin converge).
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // D-01 / PU-5: standalone uninstall of an already-gone (not-installed)
    // plugin -- the marketplace IS present, so the header renders; the absent
    // target reports an `error` row (was literal silence). The orchestrated
    // reconcile converge stays silent (no row) per WR-06 / NFR-2.
    "already-gone-not-installed": {
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
                reasons: ["not installed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target, so the brace names it beside `not installed` -- the scope word is
    // always the OPPOSITE of the row's bracket.
    "already-gone-cross-scope": {
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
                reasons: ["not installed", "marketplace in project scope"],
                severity: "error",
                needsReload: false,
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
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
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
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / WR-09: a component the reinstall's own ledger degraded names
    // its kind on the `(reinstalled)` row and takes the info -> warning raise,
    // matching the install / enable / backfill arms.
    "reinstall-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // ENBL-05 / ENBL-18 / DFEN-07: a cascade reaching an already-disabled
    // record short-circuits before the resolve, so nothing is re-materialized
    // and the record keeps its component inventory. The row is benign and
    // idempotent, hence info severity and no summary line; the reload hint
    // still fires off the sibling `(reinstalled)` row, and the plural tally
    // counts the informational skip as a success.
    "reinstall-disabled-record-cascade": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["already disabled"],
                severity: "info",
                needsReload: false,
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
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "single-mp-all-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "alpha",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "beta",
                reasons: ["invalid manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "plugin-became-unavailable": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
            ],
          },
        ],
      },
    },

    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "0.5.0",
                dependencies: [],
              },
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
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
                severity: "info",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                name: "delta",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "reinstalled",
                severity: "info",
                needsReload: true,
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
                severity: "info",
                needsReload: true,
                name: "beta",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // CR-02 / D-01: standalone reinstall of a present marketplace whose plugin
    // record is absent -> the `(skipped) {not installed}` row stamps `error`
    // (absent-target across the board), single cardinality so no tally. Mirrors
    // the byte form the `reinstallPlugin` standalone path now emits.
    "standalone-not-installed-error": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                reasons: ["not installed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target, so the brace names it beside `not installed`.
    "reinstall-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin reinstall",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                reasons: ["not installed", "marketplace in user scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // ATTR-03 / SCOPE-01 / M6 / M7 / M8: marketplace not added in the requested
    // explicit scope (or present only in the other scope) -> standalone
    // `marketplace-not-added` variant carrying the requested-scope bracket,
    // form-independent across the explicit-scope-plugin / explicit-scope-
    // marketplace forms.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },

    // ATTR-03: bare `reinstall @<marketplace>` form absent in BOTH scopes ->
    // standalone `marketplace-not-added` variant with NO bracket (the
    // absent-from-both form; no requested scope to report).
    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin update -- multi-plugin cascade; version-arrow rows.
  // -------------------------------------------------------------------------
  "/claude:plugin update": {
    // SCOPE-01: `update <plugin>@<mp> --scope <scope>` where the container sits
    // one scope over. The plugin is the subject and the brace names where the
    // container really is -- the scope word is the OPPOSITE of the bracket.
    "update-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                reasons: ["not installed", "marketplace in project scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // UGRM-01: the bulk-update up-to-date `beta` row is suppressed at the
    // orchestrator, so the fixture omits it. UGRM-02: the `tally` override owns
    // the success category (one realized `updated` row -> `1 updated`); the
    // failure category still folds in from the rows -> `1 failure, 1 updated`.
    "single-mp-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    // UGRM-02: the override carries a 0 success count (zero `updated` rows), so
    // `composeTally` drops the success category and the failure math is
    // unchanged -- the summary stays byte-identical at `Plugin update: 1
    // failure`. Proves the override does not perturb a failure-only cascade.
    "failed-with-rollback-partial": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 0 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
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

    // UGRM-01/UGRM-02: an all-up-to-date bulk update suppresses every per-plugin
    // row (and drops the now-empty marketplace headers), leaving an empty
    // cascade. The never-silent `Plugin update: nothing to update` headline is
    // emitted by the ORCHESTRATOR (`notifyUpdateNoOpWithContext` ->
    // `emitUpdateNoOpCascade`), NOT the `notify()` renderer -- so this fixture
    // drives the orchestrator no-op seam via `emit`. Info severity, no
    // reload-hint.
    "all-up-to-date-noop": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        marketplaces: [],
      },
      emit: (ctx, pi) => {
        notifyUpdateNoOpWithContext(ctx as never, pi as never, UPDATE_CONTEXT, []);
      },
    },

    // UGRM-01: the up-to-date `beta` row is suppressed. UGRM-02: two realized
    // `updated` rows (`helper` + `alpha`) -> `tally` count 2; the one `failed`
    // row composes ahead -> `1 failure, 2 updated`.
    "bare-multi-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 2 },
        marketplaces: [
          {
            name: "local-mp",
            scope: "project",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
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
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    // UGRM-02: two realized `updated` rows across the per-scope blocks -> `tally`
    // count 2 -> `Plugin update: 2 updated` (no suppression -- no up-to-date
    // rows here; only the verb/count grammar changes).
    "same-mp-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 2 },
        marketplaces: [
          {
            name: "official",
            scope: "project",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
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
                severity: "info",
                needsReload: true,
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
      // UGRM-02: one realized `updated` row -> `tally` count 1 -> `Plugin
      // update: 1 updated`.
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
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

    // D-78-06 / PURL-06: a git-source update from `sha-<12hex>OLD` to
    // `sha-<12hex>NEW` renders the version arrow as `v#<7hex> → v#<7hex>` through
    // the SAME composeVersionArrow -> renderVersion -> formatShaVersionForDisplay
    // path the hash-version arrow uses (`sha-a1b2c3d4e5f6` -> `v#a1b2c3d`,
    // `sha-2222333344455` -> `v#2222333`). Verify-only: no render code changes.
    "sha-version-arrow": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        tally: { verb: "updated", count: 1 },
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "git-plugin",
                from: "sha-a1b2c3d4e5f6",
                to: "sha-222233334445",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / WR-12 / D-99-03: a component the update's own ledger degraded
    // names its kind on the `(updated)` row and takes the info -> warning raise,
    // matching the install / enable / reinstall arms. Distinct from the
    // dropped-kind axis below, which renders `(partially-installed)`.
    "update-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                from: "1.0.0",
                to: "1.0.1",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08 / WR-01: the update verb's orphan-rewake row. Same token
    // and same info severity as the install / enable / backfill rows -- the
    // config bug names itself in the brace and moves no severity channel.
    "update-orphan-rewake": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "updated",
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "1.0.0",
                to: "1.0.1",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // CR-01 / WARN-01 / FSTAT-07: the dropped-kind and malformed-component axes
    // firing on one ledger run. The drop picks the row FORM
    // (`partially-installed`, post-update version, no arrow); the malformed
    // component adds its token to the same brace, in the install row's emit
    // order (malformed first). Both cascade surfaces compose this through the
    // one `updatedRowFromOutcome` seam, so neither can name one axis and
    // swallow the other.
    "update-degraded-and-dropped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                scope: "user",
                version: "1.0.1",
                dependencies: [],
                reasons: ["malformed skill", "unsupported component"],
              },
            ],
          },
        ],
      },
    },

    // SEV-04 / D-69-02 / XSURF-03: a TARGETED `update <plugin>@<marketplace>`
    // that declines a partially-upgradable candidate (no `--partial`) is actionable
    // -> warning. The decline flips to the `partially-upgradable` token (consistent
    // with how `list` describes the same plugin) carrying the list-consistent
    // degrade reason + the update-worded `--partial` trailer (partialHint). Single
    // cardinality, so no trailing tally; the cascade carries the `needs
    // attention` summary line.
    "decline-partially-upgradable-targeted": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "partially-upgradable",
                severity: "warning",
                needsReload: false,
                partialHint: true,
                name: "hello",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // SEV-04 / D-69-02 / XSURF-03: a BULK `update @<marketplace>` that skips the
    // same partially-upgradable candidate the user did NOT target is benign -> info.
    // Same `partially-upgradable` token + `--partial` trailer as the targeted form; no
    // summary line; the plural tally counts the info skip among its successes.
    // UGRM-01/UGRM-02: a bulk update whose only non-`updated` row is a benign
    // info `(partially-upgradable)` decline (partition `skipped`, 0 updated, 0
    // failures/warnings) is a zero-realized-transition cascade. The Phase-73
    // `(partially-upgradable) {lsp}` body row + `--partial` trailer still render, but
    // the headline is the never-silent `Plugin update: nothing to update`
    // constant -- emitted by the ORCHESTRATOR (`notifyUpdateNoOpWithContext`),
    // NOT by composeTally (which would collapse a `tally {count: 0}` override to
    // `""`, dropping the line = the byte-drift defect). So this fixture drives
    // the orchestrator no-op seam via `emit`, keeping the Phase-73 row as the
    // body. Info severity, no reload-hint.
    "skip-partially-upgradable-bulk": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "partially-upgradable",
                severity: "info",
                needsReload: false,
                partialHint: true,
                name: "hello",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
      emit: (ctx, pi) => {
        notifyUpdateNoOpWithContext(ctx as never, pi as never, UPDATE_CONTEXT, [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "partially-upgradable",
                severity: "info",
                needsReload: false,
                partialHint: true,
                name: "hello",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ]);
      },
    },

    // WR-04 / D-98-04: a targeted `update` against a DISABLED record that is
    // ALREADY degraded and whose candidate re-resolves `partially-available`.
    // The record-derived gate admits it with no flag typed and the D-UPD
    // short-circuit refreshes the record's metadata while staging nothing.
    // WR-02: the row names why nothing was materialized rather than claiming
    // `up-to-date` in the very call that moved the pin -- both tokens are
    // inherited closed-set members, and `already disabled` is idempotent, so the
    // row keeps its info severity. No trailer.
    "disabled-record-refresh": {
      pi: piWithBothLoaded(),
      message: {
        label: "Plugin update",
        cardinality: "single",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "hello",
                reasons: ["already disabled"],
              },
            ],
          },
        ],
      },
    },

    // ATTR-02 / SCOPE-01 / M10 / M11: marketplace not added in the requested
    // explicit scope (or present only in the other scope) -> standalone
    // `marketplace-not-added` variant carrying the requested-scope bracket,
    // form-independent across the `<plugin>@<mp>` / `@<mp>` forms. No raw
    // throw escapes the orchestrator.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // ATTR-02: bare `update @<marketplace>` form absent in BOTH scopes ->
    // standalone `marketplace-not-added` variant with NO bracket (the
    // absent-from-both form; no requested scope to report).
    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin fetch -- pi-only cache-warming verb (FTCH-02 / FTCH-03).
  // A post-fetch success renders the plugin's DERIVED status row (available /
  // partially-available / unavailable), a no-op renders `(skipped) {up-to-date}`,
  // and the plural sweep carries a default `successes` tally. A fetch installs
  // nothing, so no row is a reload-trigger.
  // -------------------------------------------------------------------------
  "/claude:plugin fetch": {
    // FTCH-02: a cold git-source plugin warmed to an installable tree resolves
    // `available`; the bare row omits the scope bracket (MSG-PL-6 / SNM-11).
    // Single cardinality -> no tally. Info; no reload-hint.
    "single-available": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "available",
                name: "gp",
                version: "1.0.0",
              },
            ],
          },
        ],
      },
    },

    // FTCH-02: the warmed tree resolves `partially-available`; the `⊖` row
    // carries the `{lsp}` degrade reason via the same narrowUnsupportedKinds
    // seam `list` uses. Info; no reload-hint.
    "single-partially-available": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "gp",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // FTCH-03 / D-81-02: a path/non-git source or a pinned-warm clone is a
    // no-op; the row is `⊘ (skipped) {up-to-date}` at info severity, carrying
    // the existing `up-to-date` reason (closed set does not grow).
    "single-noop-skipped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "gp",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // FTCH-02 / D-81-01: the plural sweep captures a per-plugin throw as a
    // `(failed)` row and continues; the succeeding plugin renders its fresh
    // derived status row. The default tally counts the info row as one success
    // and folds the failure in -> `Plugin fetch: 1 failure, 1 success`.
    // Severity `error` (first-match wins); no reload-hint (a fetch installs
    // nothing).
    "bulk-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Plugin fetch",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "available",
                name: "ok",
                version: "1.0.0",
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "bad",
                reasons: ["network unreachable"],
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
      // WR-02: the lone `unavailable` row now stamps `warning`, so the cascade
      // reduces to warning severity at the wire.
      expectedSeverity: "warning",
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              // WR-02: the import producer stamps unavailable rows `warning`
              // (actionable -- the user cannot complete the install without
              // addressing them), bumping the envelope severity and counting
              // the row under the warning tally rather than success.
              {
                status: "unavailable",
                name: "unavailable-plugin",
                reasons: ["unsupported hooks"],
                severity: "warning",
                needsReload: false,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "scope-project-narrow": {
      pi: piWithBothLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "official-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "directory-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "local-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "github-marketplace",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "github-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "soft-dep-markers": {
      pi: piWithNothingLoaded(),
      message: {
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "agent-only-plugin",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: true,
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
        label: "Import",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "alpha",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "beta",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
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
            severity: "error",
            needsReload: false,
            plugins: [],
          },
        ],
      },
    },

    // ATTR-07 / D-48-A: the five marketplace-add precondition reasons render on
    // the marketplace subject via the MpFailed.reasons brace. Post-manifest
    // failures carry the derived name; pre-manifest failures carry the raw
    // source string (A2). All route to `error` severity (failed-bearing).
    "add-duplicate-name": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["duplicate name"],
            plugins: [],
          },
        ],
      },
    },

    "add-stale-clone": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["stale clone"],
            plugins: [],
          },
        ],
      },
    },

    "add-unsupported-source": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "git@github.com:foo/bar.git",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["unsupported source"],
            plugins: [],
          },
        ],
      },
    },

    "add-source-missing": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "./missing-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["source missing"],
            plugins: [],
          },
        ],
      },
    },

    "add-invalid-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "anthropics/claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },

    // D-76-08: a url-source `marketplace add` whose clone hits an HTTP auth
    // challenge (401/403). Truthful attribution -- `{authentication required}`,
    // NOT `{network unreachable}`. The reason + HTTP cause chain ride a
    // synthetic-child failed row (marketplace headers carry no `cause`; SNM-10),
    // mirroring the `update-path-invalid-manifest` recipe. The subject is the
    // user-typed URL (pre-name failure). Severity `error`; no reload-hint.
    "add-authentication-required": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "https://gitlab.com/acme/private-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "https://gitlab.com/acme/private-mp",
                reasons: ["authentication required"],
                cause: new Error("HTTP Error: 401 Unauthorized"),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace info -- INFO-04 / INFO-08 / INFO-07: full
  // catalog state coverage for the marketplace info command surface:
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
  //     * scope-mismatch-not-added       (anchor; byte-identical)
  //
  // Severity routing: every success + fan-out state is `info` (omits
  // `expectedSeverity`); the two `{marketplace not added}` failure states route to
  // `"error"`. The `scope-mismatch-not-added` fixture
  // (annotation, fence body, payload, severity) is
  // byte-identical.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace info <name>": {
    // INFO-07: full catalog state coverage for marketplace info.
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

    // MURL-05 / D-76-09 / D-76-10: url source with ref, lastUpdatedAt, and
    // description. The `url: <url>#<ref>` line replaces `github:`/`path:`, and
    // `last_updated:` renders because url is a git-backed kind. Non-github host.
    "url-single-scope-full": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "acme-mp",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: { sourceKind: "url", url: "https://gitlab.com/acme/mp", ref: "main" },
        description: "An ACME marketplace hosted on GitLab.",
      } satisfies NotificationMessage,
    },

    // MURL-05 / D-76-09: url source with NO ref -> the `url:` line drops the
    // `#<ref>` suffix; no lastUpdatedAt so no `last_updated:` line.
    "url-single-scope-minimal": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "acme-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "url", url: "https://gitlab.com/acme/mp" },
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
      // TYPE-01: the dedicated `marketplace-not-added` variant. `scope` is
      // OMITTED so the renderer emits no `[scope]` token -- absent-from-both
      // states have no bracket because the marketplace is in NEITHER scope.
      // Byte form is unchanged (`⊘ ghost-mp (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },

    // Byte form preserved byte-identical (`⊘ my-mp [user] (failed) {marketplace not added}`).
    // The fixture shape is re-keyed to the TYPE-01 variant; the rendered BYTES
    // are unchanged.
    "scope-mismatch-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "my-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // D-48-B IN-02: a schema-invalid `marketplace.json` (typed
    // InvalidMarketplaceManifestError, NO SyntaxError cause) reads
    // `{invalid manifest}` for parity with the `marketplace add` write path,
    // not the former generic `{unreadable}` fallback. Mirrors
    // buildManifestFailureMessage: a `plugin-info` payload on the marketplace
    // subject (marketplaceName === plugin.name, plugin.scope ===
    // marketplaceScope so the renderer's orphan-fold rule drops the failed-row
    // bracket), status `failed`, reasons `["invalid manifest"]`,
    // componentsResolved false. Byte form: header + 2-space-indent failed row.
    "manifest-invalid": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "bad-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "bad-mp",
          scope: "user",
          reasons: ["invalid manifest"],
          componentsResolved: false,
        },
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // INFO-02 + INFO-05 + INFO-07: full catalog state
  // coverage for `/claude:plugin info <plugin>@<marketplace>`.
  //
  //   - Success states:
  //     * installed-single-scope                       (INFO-02 happy path)
  //     * installed-single-scope-with-dependencies     (INFO-02 + dependencies line)
  //     * state-only-installed-single-scope            (INFO-09 record-backed row)
  //     * state-only-partially-installed-single-scope  (INFO-10 record-backed partial)
  //     * state-only-installed-with-hooks              (INFO-11 materialized hooks block)
  //     * state-only-installed-hooks-degraded          (D-96-03 unlistable hooks marker)
  //     * state-only-disabled-with-components          (ENBL-17 disabled record, retained inventory)
  //     * available-single-scope                       (INFO-02 available bucket)
  //     * unavailable-single-scope                     (INFO-02 unavailable + {unsupported hooks})
  //   - Warning states:
  //     * state-only-fetch-skipped                     (D-96-04 skipped --fetch note, "warning")
  //     * disabled-fetch-skipped                       (D-96-04 skipped --fetch on a disabled record)
  //     * mixed-fetch-skipped                          (D-96-04 both causes in one note, MSG-GR-3 order)
  //   - Multi-scope fan-out:
  //     * installed-both-scopes-fan-out                (INFO-03 project-first fan-out)
  //     * state-only-installed-both-scopes-fan-out     (INFO-09 record-backed fan-out)
  //   - Components arm (INFO-05):
  //     * components-not-resolved                      (external-source marker)
  //   - Failure states:
  //     * missing-plugin-not-in-manifest               ({not in manifest})
  //     * missing-marketplace-not-added-absent-from-both  ({marketplace not added}, no [scope])
  //     * missing-marketplace-not-added-scope-mismatch    ({marketplace not added}, with [scope])
  //
  // Severity routing: every success + fan-out + components-not-resolved
  // state is `info` (omits `expectedSeverity`); the three `{marketplace not added}` /
  // `{not in manifest}` failure states route to `"error"`; the three D-96-04
  // fetch-skip notes are the only `"warning"` states on this surface.
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

    "state-only-installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },

    "state-only-partially-installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "partially-installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest", "lsp"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },

    "state-only-installed-with-hooks": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            hooks: [{ event: "Stop" }, { event: "PreToolUse", matcher: "Bash" }],
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },

    "state-only-installed-hooks-degraded": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest", "source missing"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },

    // ENBL-16 / ENBL-17: a recorded-but-disabled record the manifest no longer
    // declares. `status: "disabled"` on a `PluginInfoRow` is what the reroute
    // added: the row travels the shared block builder, so it carries the
    // component inventory the disable preserved (ENBL-18) and the hook entries
    // the record holds -- the materialized configuration is gone. `reasons`
    // carries the absence token ALONE: a persisted unsupported kind would be
    // suppressed on this row (ENBL-16 / D-100-07), so no fixture can show one.
    "state-only-disabled-with-components": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "disabled",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            hooks: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },

    // D-96-04: `--fetch` against a manifest-absent installation record. This is
    // a CASCADE row, not a `PluginInfoRow`: the standalone info status set
    // admits no `skipped`. The `severity: "warning"` on the row is what selects
    // the `needs attention` summary and the second `notify` argument.
    "state-only-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["not in manifest"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    // D-96-04: `--fetch` against an all-disabled marketplace. Same cascade row
    // shape as the state-only note above, with the reason token that names the
    // OTHER cause of a skipped fetch -- a disabled record has no materialized
    // artifacts to refresh (ENBL-02).
    "disabled-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["already disabled"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    // D-96-04 / MSG-GR-3: the two skip causes in ONE run. This is the byte
    // shape `info-manifest-absent.test.ts`'s mixed-run test pins by index --
    // plural summary, two marketplace headers, one reason token each, ordered
    // project-first by SCOPE rather than grouped by the arm that produced the
    // row. It composes the two states above; it is not a third cause.
    "mixed-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["already disabled"],
                severity: "warning",
              },
            ],
          },
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "2.0.0",
                reasons: ["not in manifest"],
                severity: "warning",
              },
            ],
          },
        ],
      },
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

    // OUT-03 / DFEN-04: the `available-single-scope` row above whose
    // marketplace ENTRY declares `defaultEnabled: false`. The info surface
    // states the fact through the reason brace the row already had, so the two
    // renders differ by that brace alone -- no extra body line, description and
    // component lines untouched. The claim is entry-derived, so nothing on disk
    // is read to answer it. Severity `info`; no reload-hint (read-only surface).
    "available-installs-disabled": {
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
          reasons: ["installs disabled"],
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
          reasons: ["unsupported hooks"],
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

    // INFO-09: the same fan-out when NEITHER scope's manifest declares the
    // plugin. Both blocks are `(installed) {not in manifest}` rather than
    // `(failed)`, so they join one `info` cascade instead of being separated
    // into two `error` notifications by the GRAM-04 failure split.
    "state-only-installed-both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info-cascade",
        blocks: [
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "project",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "alpha",
              version: "1.0.0",
              reasons: ["not in manifest"],
              componentsResolved: true,
              components: { skills: ["alpha-skill"] },
            },
          },
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "user",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "alpha",
              version: "1.0.0",
              reasons: ["not in manifest"],
              componentsResolved: true,
              components: { skills: ["alpha-skill"] },
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

    // RSTA-01 / D-80-04: info-surface row for a not-installed git-source plugin
    // whose clone/mirror is not materialized. The status glyph is `◌`
    // (`pluginInfoStatusGlyph` remote arm) and the row reads `(remote)`. The
    // `componentsResolved: false` arm keeps the `components: not resolved`
    // marker (existing wording preserved) -- an unfetched source has no warm
    // tree to resolve. Severity `info`.
    "remote-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "remote",
          name: "git-helper",
          version: "0.5.0",
          description: "Git-source helper plugin; not yet fetched.",
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
      // TYPE-01 variant. `name` carries the MARKETPLACE name (the user-facing
      // failure is "the marketplace is not added"). `scope` OMITTED -> no
      // bracket. Byte form unchanged (`⊘ ghost-mp (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },

    "missing-marketplace-not-added-scope-mismatch": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      // TYPE-01 variant. `--scope user` requested explicitly -> renderer emits
      // the `[user]` bracket. Byte form unchanged
      // (`⊘ ghost-mp [user] (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
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
            plugins: [
              { status: "uninstalled", name: "helper", severity: "info", needsReload: true },
            ],
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
            severity: "error",
            plugins: [
              { status: "uninstalled", name: "helper", severity: "info", needsReload: true },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "tool",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied"),
              },
            ],
          },
        ],
      },
    },

    // ATTR-06 / S3 / D-48-C Shape 1: explicit-scope remove of a name not added
    // in the requested scope -> standalone `marketplace-not-added` `{marketplace not added}`
    // variant carrying the requested scope bracket (pre-guard miss; no raw
    // MarketplaceNotFoundError escapes the orchestrator).
    "remove-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // ATTR-06 / S4: bare-form remove of a name absent from BOTH scopes -> the
    // SAME standalone variant with NO bracket (resolveScopeFromState's
    // MarketplaceNotFoundError caught at the entrypoint, absent-from-both form).
    "remove-missing-not-added-bare": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin marketplace update -- marketplace + plugin cascade.
  // -------------------------------------------------------------------------
  "/claude:plugin marketplace update <name>": {
    // UXG-05: autoupdate-OFF manifest-only refresh splits into a no-op
    // (`skipped {up-to-date}`) and a changed (`updated`) state. Per UXG-02 /
    // D-28-07 the benign `up-to-date` no-op computes INFO (no
    // `expectedSeverity`).
    "update-no-op-skipped": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "skipped",
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // UXG-05: the autoupdate-ON cascade
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
            severity: "info",
            needsReload: false,
            reasons: ["up-to-date"],
            plugins: [],
          },
        ],
      },
    },

    // WR-10: the near miss of the no-op above. A disabled record whose
    // content-derived pin moved is a `skipped` outcome, not `unchanged`, so it
    // leaves the no-op gate and the cascade rows render. Benign idempotent
    // reason -> INFO (no `expectedSeverity`).
    "update-autoupdate-disabled-repin": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "disabled-mp",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                scope: "user",
                reasons: ["already disabled"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // LIFE-06 / D-98-13: the cascade skip row for an installed record whose
    // manifest entry is gone. `outcomeToCascadePluginMessage`'s `skipped` arm
    // forwards name, scope and reasons ONLY -- no version -- so this row is
    // version-less while the single-plugin `update` surface renders `v1.0.0` on
    // the same skip. That asymmetry is the byte contract, not a bug.
    // `not in manifest` is non-idempotent, so `skipSeverity` stamps `warning`.
    "update-autoupdate-cascade-not-in-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "auto-skip",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "skipped",
                name: "hello",
                scope: "user",
                reasons: ["not in manifest"],
                severity: "warning",
                needsReload: false,
              },
            ],
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
                severity: "info",
                needsReload: true,
                name: "alpha",
                from: "0.5.0",
                to: "1.0.0",
                dependencies: [],
              },
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "delta",
                reasons: ["network unreachable"],
              },
            ],
          },
        ],
      },
    },

    // SEV-03 / D-69-01: the autoupdate cascade TAKES the partial path, so a
    // candidate re-resolving `partially-available` renders `(partially-installed) {dropped
    // kinds}` (◉ glyph, via the shared `partiallyInstalledRow`) instead of
    // declining with `(skipped) {no longer installable}`. ALREADY-degraded case:
    // the persisted `compatibility.unsupported` was non-empty before the
    // auto-update, so re-degrading is benign -> INFO (no `expectedSeverity`).
    // partially-installed is a realized transition -> reload-hint fires.
    "autoupdate-partially-installed-already-degraded": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                scope: "user",
                version: "1.0.0",
                dependencies: [],
                reasons: ["lsp"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // SEV-03 / D-69-01: the SAME `(partially-installed)` autoupdate row, but the
    // auto-update NEWLY degrades a previously-clean plugin (the persisted
    // `compatibility.unsupported` was empty before the update). A silent
    // automatic degradation is actionable -> `warning` + the `needs attention`
    // summary line. The per-row bytes are identical to the already-degraded
    // info fixture above; only the stamped severity moves.
    "autoupdate-partially-installed-newly-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "updated",
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                scope: "user",
                version: "1.0.0",
                dependencies: [],
                reasons: ["lsp"],
                severity: "warning",
                needsReload: true,
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
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "failed",
            plugins: [],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    },

    // ATTR-10 / D-48-B: a path-source marketplace.json that is malformed or
    // schema-invalid renders `(failed) {invalid manifest}` on the synthetic-child
    // failed row -- never `{network unreachable}` (NFR-5: path-source touches no
    // network). The orchestrator's refreshOneMarketplace catch carries the
    // classified reason on a synthetic child (mirroring the mp-failure recipe);
    // this fixture pins that byte form. `cause` is omitted so the byte form is
    // deterministic (the live cause-chain trailer carries data-dependent JSON
    // parser text). Summary counts the synthetic child as one plugin operation.
    "update-path-invalid-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "official",
                reasons: ["invalid manifest"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SC#1 / ATTR-06 / D-48-C: the marketplace-form update now converges on the
    // standalone `marketplace-not-added` variant for the marketplace-absent
    // precondition (closing the last residual Class-C raw-throw). Explicit scope
    // carries the requested `[scope]` bracket (SCOPE-01); the bare absent-from-both
    // form carries NO bracket. Both severity `error` via computeSeverity.
    "update-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      },
    },

    "update-missing-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
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
            severity: "info",
            needsReload: false,
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
            severity: "info",
            needsReload: false,
            reasons: ["already no autoupdate"],
            plugins: [],
          },
        ],
      },
    },

    // ATTR-05 / S1 / D-48-C Shape 1: an explicit-scope flip of a name not
    // added in the requested scope routes to the standalone
    // `marketplace-not-added` `{marketplace not added}` variant carrying the requested
    // scope bracket -- superseding the former reason-less / `{not found}` form.
    "autoupdate-missing-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "missing-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // ATTR-05 / S2: the bare form absent from EVERY iterated scope routes to
    // the SAME standalone variant carrying `first.scope` (project-before-user
    // SC-6 order -> `[project]`). Supersedes the former reason-LESS bare
    // `(failed)` row.
    "autoupdate-missing-not-added-bare": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "missing-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin enable -- D-54-01 / ENBL-01 / ENBL-03 enable-from-cache.
  // -------------------------------------------------------------------------
  "/claude:plugin enable <plugin>@<marketplace>": {
    "enable-fresh": {
      pi: piWithBothLoaded(),
      // Re-materialization through the install ledger -- UAT-04 (decision
      // 2026-06-11): BARE always-marketplace-header
      // form (no `(added)` token; that header belongs to `marketplace add`)
      // + `(installed)` plugin row (existing state-change token);
      // reload-hint fires per SNM-33.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // ENBL-07 / FSTAT-07 / D-66-04: a re-enable admitted through the partial
    // gate drops component kinds, so the row follows the RESOLUTION (`◉
    // (partially-installed)` + the kinds) rather than the verb. SEV-03: the
    // degradation predates the enable, so the row stays `info` (no summary
    // line) -- parity with install --partial and the backfill partial arm.
    "enable-partial": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: narrowUnsupportedKinds(["lspServers"]),
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / D-86-03: the enable branch runs the same ledger over the same
    // bridges as install, so a malformed-frontmatter degrade renders the same
    // `(installed) {malformed skill}` row at the same `warning` raise. Distinct
    // from `enable-partial`: a DEGRADED component installed short, a DROPPED
    // one is absent.
    "enable-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08: an orphan companion field is a config bug the ledger
    // reports; it names itself in the brace without moving the severity
    // channel, exactly as on the install row.
    "enable-orphan-rewake": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // SEV-01 / WR-06: the enable row derives `dependencies` from the ledger's
    // staged counts, so a re-enable that staged an agent declares the
    // `pi-subagents` companion. With that companion unloaded the row takes the
    // marker AND the info -> warning raise, exactly as the install row does for
    // the same ledger run.
    "enable-soft-dep": {
      pi: piWithNothingLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: ["agents"],
              },
            ],
          },
        ],
      },
    },

    "enable-idempotent": {
      pi: piWithBothLoaded(),
      // Idempotent no-op -- benign reason routes to info per UXG-02 / D-28-06.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["already enabled"],
              },
            ],
          },
        ],
      },
    },

    "enable-not-installed": {
      pi: piWithBothLoaded(),
      // WR-03 / D-01: marketplace present, plugin row absent. Nothing was
      // enabled or disabled, so the operation was NOT carried out -> `error`,
      // the same stamp every sibling verb applies to `["not installed"]`.
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["not installed"],
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target. The brace names it beside `not installed` so this miss stops
    // rendering byte-identically to `enable-not-installed` above -- the two take
    // different remedies. The scope word is the OPPOSITE of the row's bracket.
    "enable-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["not installed", "marketplace in user scope"],
              },
            ],
          },
        ],
      },
    },

    "enable-source-missing": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["source missing"],
              },
            ],
          },
        ],
      },
    },

    // WR-02 / CR-01 / D-98-03: the stale-gate enable failure. `partialHint` on a
    // `failed` row is set ONLY by the enable-failure narrowing, and it selects
    // the enable-worded `STALE_GATE_UPDATE_HINT_TRAILER` -- NOT the XSURF-03
    // update-decline trailer, whose "re-run" wording would name `enable`, the
    // one command that rejects `--partial`. The `{lsp}` brace comes through the
    // same `narrowUnsupportedKinds` seam the list `(partially-upgradable)` row
    // uses.
    "enable-failed-stale-gate": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                version: "1.2.3",
                reasons: narrowUnsupportedKinds(["lspServers"]),
                partialHint: true,
                cause: new Error('Plugin "foo-plugin" is not installable: contains lspServers'),
              },
            ],
          },
        ],
      },
    },

    "enable-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    "enable-invalid-config": {
      // CFG-03 abort. T-53-02-02: the marketplace name carries
      // the file BASENAME via the renderer; here the plugin row carries the
      // `{invalid manifest}` reason -- the orchestrator aborts BEFORE entering
      // the cascade, so the body is the bare cascade with the failed plugin
      // row.
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["invalid manifest"],
              },
            ],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // /claude:plugin disable -- D-54-01 / ENBL-02 cascade unstage + config flip.
  // -------------------------------------------------------------------------
  "/claude:plugin disable <plugin>@<marketplace>": {
    "disable-fresh": {
      pi: piWithBothLoaded(),
      // UAT-03: the fresh-disable
      // row carries the closed-set `(disabled)` token -- same glyph + token
      // as the disabled-inventory row, version slot kept. RLD-05 / D-07: the
      // reload-hint fires via the row's `needsReload: true` stamp (RLD-02
      // OR-reduce), not a cascade kind; list/info inventory `disabled` rows
      // stamp `needsReload: false` and stay hint-free.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
              },
            ],
          },
        ],
      },
    },

    "disable-idempotent": {
      pi: piWithBothLoaded(),
      // Benign reason -> info severity.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["already disabled"],
              },
            ],
          },
        ],
      },
    },

    "disable-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    "disable-invalid-config": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["invalid manifest"],
              },
            ],
          },
        ],
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
                severity: "warning",
                needsReload: false,
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

  // -------------------------------------------------------------------------
  // /claude:plugin pending -- DIFF-01 SC #2 / D-53-01 read-only diff command.
  // -------------------------------------------------------------------------
  "/claude:plugin pending": {
    "empty-steady-state": {
      pi: piWithBothLoaded(),
      // Dedicated standalone variant; the renderer hard-codes the advisory
      // body line so the byte form cannot drift from the catalog state.
      message: { kind: "reconcile-pending-empty" },
    },
    // WILL-01 / D-65.1-02: marketplace add is immediate (no `will add` token);
    // the child install is the reload-deferred work, rendered under a bare
    // list-arm header (no marketplace status).
    "mp-add-plugin-install": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "new-mp",
            scope: "user",
            plugins: [{ status: "will install", name: "new-plugin" }],
          },
        ],
      },
    },
    // FSTAT-06 / D-66-04: a pending child install whose no-network candidate
    // resolves `partially-available` carries the `partial` modifier, rendering
    // `(will partially install)` in place of `(will install)`. A render modifier,
    // not a new token; no `will partially update` analog exists (D-66-05).
    "mp-add-plugin-partial-install": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "new-mp",
            scope: "user",
            plugins: [{ status: "will install", name: "degraded-plugin", partial: true }],
          },
        ],
      },
    },
    "plugin-pending-uninstall": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [{ status: "will uninstall", name: "old-plugin" }],
          },
        ],
      },
    },
    // WILL-03 / D-65.1-03: removing a marketplace that still has installed
    // plugins is reload-deferred ONLY for its plugin-uninstall cascade --
    // de-registration itself is immediate (no `will remove` marketplace token).
    // The pending preview renders the bare list-arm header (no marketplace
    // status) plus one `(will uninstall)` row per recorded plugin, byte-identical
    // to the surviving `plugin-pending-uninstall` form above.
    "marketplace-remove-with-installed-plugins": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "old-mp",
            scope: "user",
            plugins: [
              { status: "will uninstall", name: "p1" },
              { status: "will uninstall", name: "p2" },
            ],
          },
        ],
      },
    },
    "enable-disable-transitions": {
      // The will-enable bucket is populated only by the
      // recorded-but-disabled marker; the catalog fixture is hand-constructed
      // (not routed through planReconcile) so the enable-bucket wiring can
      // land against an exercised path.
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              { status: "will enable", name: "to-enable" },
              { status: "will disable", name: "to-disable" },
            ],
          },
        ],
      },
    },
    "source-mismatch": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["source mismatch"],
            plugins: [],
          },
        ],
      },
    },
    "invalid-config-abort": {
      // CFG-03: the marketplace `name` is the file BASENAME
      // (never the absolute path -- T-53-02-02 information-disclosure
      // mitigation). The orchestrator passes path.basename(filePath).
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },
  },

  // -------------------------------------------------------------------------
  // reconcile-applied-cascade -- RECON-04 load-time apply
  // cascade. Standalone-dispatched variant; severity is content-derived
  // (mirrors the cascade-arm ladder); shouldEmitReloadHint structurally
  // false (the reconcile already ran on /reload).
  // -------------------------------------------------------------------------
  "reconcile-applied-cascade": {
    "success-cascade-mixed": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "new-mp",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "new-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "other-mp",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "other-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "soft-fail-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "flaky-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["network unreachable"],
            plugins: [],
          },
          {
            name: "ok-mp",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "ok-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "invalid-config-row": {
      // T-55-02-01 / T-53-02-02: BASENAME only -- never the absolute path.
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },

    // I5 / PR #51: invalid-config row that carries the loadConfig diagnostic
    // detail (EACCES / JSON-parse / schema key) via a synthetic plugin child
    // (SNM-10 pattern -- mp headers cannot carry a cause). Absolute paths
    // are stripped at the apply boundary via `redactAbsolutePaths`; the
    // parse / permission detail survives so the operator can debug.
    "invalid-config-row-with-cause": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            reasons: ["invalid manifest"],
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "claude-plugins.json",
                reasons: ["invalid manifest"],
                cause: new Error("schema validation failed: /marketplaces: Expected object"),
              },
            ],
          },
        ],
      },
    },

    // I1 / PR #51: reconcile-driven `marketplace remove` whose cascade
    // unstaged some plugins and failed others. Bare `(failed)` mp header +
    // one row per unstaged plugin (○ uninstalled) + one row per failed
    // plugin (⊘ {reason}). Mirrors the standalone `marketplace remove`
    // `partial` byte form. Pre-fix the orchestrated arm collapsed this to
    // ONE mp-failed row, silently dropping the N-1 other rows.
    "partial-marketplace-remove": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "acme-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              { status: "uninstalled", name: "plugin-ok", severity: "info", needsReload: true },
              {
                status: "failed",
                name: "plugin-fail-a",
                reasons: ["permission denied"],
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "plugin-fail-b",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // BFILL-01 / SEV-05 / D-69-04: a load-time backfill promotion row carries
    // the re-resolved dropped-component kinds as a factual {reasons} brace
    // through the shared narrowUnsupportedKinds seam (lspServers -> lsp). The
    // marketplace was already added, so its header is bare (no status token).
    // SEV-03 / A3: a benign promotion stays info -- no expectedSeverity.
    "backfill-partially-installed": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                name: "hello",
                version: "1.0.0",
                dependencies: [],
                reasons: ["lsp"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // SEV-05 / D-69-04: a backfill partially-installed row whose dropped-kind set is
    // empty renders brace-less -- byte-identical to the pre-SEV-05 form (the
    // change is additive; rows without reasons do not gain a brace).
    "backfill-partially-installed-no-reasons": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                name: "hello",
                version: "1.0.0",
                dependencies: [],
                reasons: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WR-06 / SEV-01: the projected enable row derives `dependencies` from the
    // ledger's staged counts, so the soft-dep marker fires on the load-time
    // surface too. Severity stays `info` -- this projection applies the
    // companion raise on neither arm, so its enable arm agrees with its
    // install arm; the standalone verb owns the SEV-01 composition.
    "reconcile-enable-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "hello",
                version: "1.0.0",
                dependencies: ["agents"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // DFEN-04 / OUT-01 / OUT-04: the load-time counterpart of the standalone
    // install-disabled row. Same cause token and same remedy trailer; the
    // reload stamp differs (`true` here) because this row shares the arm every
    // other reconcile disable uses.
    "reconcile-install-disabled": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "hello",
                version: "1.0.0",
                reasons: ["installs disabled"],
                enableHint: true,
                severity: "info",
                needsReload: true,
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

/** One catalog example's disagreement with what `notify()` actually rendered. */
interface Failure {
  readonly section: string;
  readonly state: string;
  readonly kind: "missing-fixture" | "byte-mismatch" | "severity-mismatch";
  readonly expected?: string;
  readonly actual?: string;
}

/**
 * Assert the severity ARG shape for one rendered call. A fixture that declares
 * `expectedSeverity` requires exactly that second argument; a fixture that
 * declares none requires the second argument be absent (the info default).
 */
function checkSeverityArg(
  example: CatalogExample,
  expectedSeverity: string | undefined,
  callArgs: [string, string?],
): Failure | undefined {
  if (expectedSeverity !== undefined) {
    if (callArgs.length === 2 && callArgs[1] === expectedSeverity) {
      return undefined;
    }

    return {
      section: example.section,
      state: example.state,
      kind: "severity-mismatch",
      expected: expectedSeverity,
      actual: callArgs[1] ?? "(info / no 2nd arg)",
    };
  }

  if (callArgs.length === 1) {
    return undefined;
  }

  return {
    section: example.section,
    state: example.state,
    kind: "severity-mismatch",
    expected: "(info / no 2nd arg)",
    actual: callArgs[1] ?? "?",
  };
}

/**
 * Render one catalog example through `notify()` against a FRESH mock ctx and
 * compare the emitted bytes and severity arg. A fresh ctx per example is
 * required because `mock.fn()` accumulates calls across invocations, so
 * reusing one would leak state between fixtures.
 */
function checkCatalogExample(example: CatalogExample): Failure[] {
  const fixture = FIXTURES[example.section]?.[example.state];
  if (fixture === undefined) {
    return [{ section: example.section, state: example.state, kind: "missing-fixture" }];
  }

  const ctx = makeCtx();
  // UGRM-01 / UGRM-02: orchestrator-emitted no-op states route through the
  // fixture's `emit` override (`emitUpdateNoOpCascade`); every other state
  // drives the `notify()` renderer directly.
  if (fixture.emit !== undefined) {
    fixture.emit(ctx, fixture.pi);
  } else {
    notify(ctx as never, fixture.pi as never, fixture.message);
  }

  assert.equal(
    ctx.ui.notify.mock.calls.length,
    1,
    `notify() must call ctx.ui.notify exactly once per invocation (section=${example.section} state=${example.state})`,
  );

  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
  const failures: Failure[] = [];
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

  const severityFailure = checkSeverityArg(example, fixture.expectedSeverity, callArgs);
  if (severityFailure !== undefined) {
    failures.push(severityFailure);
  }

  return failures;
}

/** Render one failure as the operator-facing diff block. */
function formatCatalogFailure(f: Failure): string {
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
}

test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  // Exact count, not a floor: 182 is the number of annotated examples in
  // docs/output-catalog.md, and it is what stops a `loadCatalogExamples`
  // refactor from silently parsing a fraction of the corpus. Update it
  // deliberately when catalog examples are added or removed.
  assert.equal(
    examples.length,
    182,
    `Expected exactly 182 annotated catalog examples; found ${examples.length}. Check that the discriminator comments in docs/output-catalog.md were not lost, and update this count when examples are added.`,
  );

  const failures: Failure[] = [];

  for (const example of examples) {
    failures.push(...checkCatalogExample(example));
  }

  if (failures.length > 0) {
    const formatted = failures.map(formatCatalogFailure).join("\n\n");
    assert.fail(`catalog UAT failures (${failures.length}):\n${formatted}`);
  }
});

// XSURF-03 cross-surface byte-parity: the `update`-decline `partially-upgradable`
// reason brace MUST be byte-identical to the `list (partially-upgradable)` reason
// brace for the SAME degrade kinds. This is what justifies sourcing the
// update-decline reason via the SAME `narrowUnsupportedKinds` seam the `list`
// row uses (rather than the install-path `narrowResolverReasons`, which also
// folds in note-derived reasons and could diverge). The assertion renders both
// rows through `notify()` and compares the `(partially-upgradable) {…}` segment.
test("XSURF-03: update-decline partially-upgradable reason brace === list partially-upgradable brace (same kinds)", () => {
  // Both surfaces source the degrade reason from the shared kind-narrowing seam.
  const kinds = ["lspServers", "themes"];
  const reasons = narrowUnsupportedKinds(kinds);

  // The list-inventory row (no partialHint -> no trailer).
  const listCtx = makeCtx();
  notify(listCtx as never, piWithBothLoaded() as never, {
    marketplaces: [
      {
        name: "mp",
        scope: "project",
        plugins: [{ status: "partially-upgradable", name: "hello", version: "1.0.0", reasons }],
      },
    ],
  });

  // The update-decline row (partialHint -> update trailer + warning severity).
  const declineCtx = makeCtx();
  notify(declineCtx as never, piWithBothLoaded() as never, {
    label: "Plugin update",
    cardinality: "single",
    marketplaces: [
      {
        name: "mp",
        scope: "project",
        plugins: [
          {
            status: "partially-upgradable",
            name: "hello",
            version: "1.0.0",
            reasons,
            partialHint: true,
            severity: "warning",
            needsReload: false,
          },
        ],
      },
    ],
  });

  const extractBrace = (s: string): string => {
    const m = /\(partially-upgradable\) (\{[^}]*\})/.exec(s);
    assert.ok(m, `expected a (partially-upgradable) {…} brace in:\n${s}`);
    return m[1]!;
  };

  const listBody = listCtx.ui.notify.mock.calls[0]!.arguments[0] as string;
  const declineBody = declineCtx.ui.notify.mock.calls[0]!.arguments[0] as string;

  assert.equal(
    extractBrace(declineBody),
    extractBrace(listBody),
    "the update-decline reason brace must be byte-identical to the list partially-upgradable brace",
  );
});

test("UGRM-02 scope discipline: a non-update bulk cascade keeps `N successes` (no tally override)", () => {
  // A reinstall cascade carries NO `tally` override, so `composeTally` runs the
  // legacy info-row success math: two `reinstalled` rows + one idempotent
  // `(skipped) {up-to-date}` row are the three at-desired-state successes. The
  // update-scoped UGRM-02 override must NOT leak into other ops -- this proves
  // install / reinstall / marketplace / import keep `N success(es)`.
  const ctx = makeCtx();
  notify(ctx as never, piWithBothLoaded() as never, {
    label: "Plugin reinstall",
    cardinality: "plural",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "reinstalled",
            severity: "info",
            needsReload: true,
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
          {
            status: "reinstalled",
            severity: "info",
            needsReload: true,
            name: "gamma",
            version: "1.0.0",
            dependencies: [],
          },
          {
            status: "skipped",
            name: "beta",
            reasons: ["up-to-date"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  });

  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.match(
    body,
    /Plugin reinstall: 3 successes/,
    "reinstall must keep the at-desired-state `N successes` grammar (no UGRM-02 override)",
  );
  assert.doesNotMatch(
    body,
    /\bupdated\b/,
    "the update-scoped `updated` verb must not leak into a reinstall summary",
  );
});

test("catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)", async () => {
  // SC#3 both-directions gate. The forward walk above (catalog -> fixture)
  // catches an UNDOCUMENTED-fixture gap (a catalog state with no fixture). This
  // inverse walk (fixture -> catalog) catches an ORPHAN fixture: a FIXTURES
  // entry with no corresponding `<!-- catalog-state: STATE -->` annotation is
  // silently never exercised by the forward driver. Asserting both directions
  // makes "no orphaned/stale catalog state remains" (SC#3) a real gate. When
  // Plans 49-01 / 49-02 added new states + fixtures, this confirms they stay
  // paired (every fixture has a catalog annotation).
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  // Set of `${section}::${state}` keys for every parsed catalog annotation.
  const annotated = new Set<string>(examples.map((e) => `${e.section}::${e.state}`));

  // Iterate every FIXTURES (section,state) key; collect orphans -- fixtures with
  // no matching catalog annotation.
  const orphans: string[] = [];
  for (const section of Object.keys(FIXTURES)) {
    const states = FIXTURES[section];
    if (states === undefined) {
      continue;
    }

    for (const state of Object.keys(states)) {
      if (!annotated.has(`${section}::${state}`)) {
        orphans.push(`[ORPHAN FIXTURE] section=${section} state=${state}`);
      }
    }
  }

  if (orphans.length > 0) {
    assert.fail(
      `catalog UAT inverse-walk failures (${orphans.length}) -- FIXTURES entries with no catalog annotation:\n${orphans.join("\n")}`,
    );
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
