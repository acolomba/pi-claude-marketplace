/**
 * tests/shared/notify-v2.test.ts -- Per-status unit suite for the V2
 * `notify()` and `notifyUsageError()` entry points landed by Phase 16 plans
 * 02-05. This file IS the de facto v2 spec until Phase 17 lifts the grammar
 * into the output catalog (SNM-19 / SNM-20 / SNM-31).
 *
 * ===========================================================================
 * V2 grammar mini-spec (Phase 16 binding contract; D-16-04 authority)
 * ===========================================================================
 *
 *   ICON DISPATCH (MSG-IC-1..3, duplicated inline in shared/notify.ts per
 *   D-16-04):
 *     - `●` ICON_INSTALLED      -> installed | updated | reinstalled |
 *                                  upgradable plugin rows; added | removed |
 *                                  updated | undefined-list-surface
 *                                  marketplace headers.
 *     - `○` ICON_AVAILABLE      -> available | uninstalled plugin rows.
 *     - `⊘` ICON_UNINSTALLABLE  -> unavailable | skipped | failed |
 *                                  manual-recovery plugin rows; failed
 *                                  marketplace headers.
 *
 *   SCOPE-BRACKET PLACEMENT (unconditional carve-out, MSG-PL-6 / SNM-11):
 *     The `available` and `unavailable` plugin variants have NO `scope` field
 *     at all. The `[<scope>]` bracket is UNCONDITIONALLY omitted on those two
 *     rows (regardless of any caller value). The marketplace-header's
 *     `[<mp.scope>]` bracket still appears.
 *
 *   SCOPE-BRACKET PLACEMENT (conditional emission on the 8 scope-bearing
 *   variants, BLOCKER-1 fix from plan 04):
 *     For `installed` | `updated` | `reinstalled` | `uninstalled` |
 *     `upgradable` | `skipped` | `failed` | `manual recovery`, the
 *     `scope?: Scope` field is OPTIONAL (Phase 15 D-15-02/D-15-04). The
 *     `[<scope>]` bracket is emitted ONLY when `p.scope !== undefined`.
 *     The typical case (cascade rows inheriting the marketplace's scope via
 *     the header) leaves `p.scope` undefined and emits NO bracket on the
 *     row. The orphan-fold case (caller sets `p.scope` explicitly to drive
 *     the inline inflection) emits the bracket inline on the row.
 *
 *     Anti-pattern guarded against: an unconditional `[${p.scope}]`
 *     interpolation produces the literal substring `[undefined]` when
 *     `p.scope` is undefined. The `renderScopeBracket(p.scope)` helper
 *     returns `""` for that case and `joinTokens` filters the empty slot
 *     out, so the row contains NO bracket between the plugin name and the
 *     version/status slots. Tests assert this byte-for-byte (test 21a).
 *
 *   REASONS-BLOCK FORMAT (MSG-GR-4):
 *     `{reason1, reason2}` -- a single brace block joined by `", "`. The
 *     soft-dep markers `requires pi-subagents` and `requires pi-mcp` go
 *     INSIDE the same brace block, NOT in separate braces.
 *
 *   SOFT-DEP MARKER INJECTION (D-16-15):
 *     The marker is emitted iff the row's `dependencies` array includes the
 *     dep AND the probe says it is not loaded. The two markers are
 *     `requires pi-subagents` (for the `"agents"` dep) and `requires pi-mcp`
 *     (for the `"mcp"` dep). Only the 3 dep-bearing arms (installed,
 *     updated, reinstalled) carry `dependencies?` per Phase 15 D-15-02; the
 *     other 7 arms cannot emit the markers.
 *
 *   MARKETPLACE HEADER SHAPE:
 *     - State-change arms ("added" | "removed" | "updated" | "failed"):
 *       `<icon> <mp.name> [<mp.scope>] (<status>)`.
 *     - List-surface arm (mp.status === undefined):
 *       - SUB-BRANCH A (mp.details === undefined): bare header, no
 *         trailing autoupdate token, NO crash. Plan 03's
 *         BLOCKER-3 fix explicitly guards `mp.details === undefined` so the
 *         arm cannot crash at runtime. Tests assert this no-crash invariant
 *         (test 17a).
 *       - SUB-BRANCH B (mp.details !== undefined): bare header +
 *         `" <autoupdate>"` iff `details.autoupdate === true`. The
 *         `details.lastUpdatedAt` field is retained in state/type but is
 *         NOT rendered (UXG-01). Empty token slots are collapsed by the
 *         join discipline.
 *
 *   BODY COMPOSITION:
 *     - Marketplace header at column 0.
 *     - Plugin rows at 2-space indent (D-16-04).
 *     - Multi-marketplace blocks joined by one blank line (D-16-07).
 *     - Per-plugin cause-chain at 4-space indent below the row, only on
 *       `failed` / `manual recovery` rows when `cause?: Error` is set
 *       (D-16-08).
 *     - `failed.rollbackPartial[]` child rows at 4-space indent
 *       (`    [<phase>] (rollback failed)`); each phase emits an optional
 *       6-space-indented cause-chain trailer when `phase.cause` is set
 *       (D-16-08; planner pick byte form from 16-05-SUMMARY).
 *
 *   EMPTY-LIST SENTINELS:
 *     - Empty `marketplaces: []` at the top level: the body is exactly the
 *       17 bytes `"(no marketplaces)"` -- no leading icon, no trailing
 *       newline, no reload-hint, no severity arg (planner pick per 16-05).
 *     - Empty `plugins: []` on a per-marketplace block: bare header alone
 *       (no `(no plugins)` sentinel inside the body; D-15-08).
 *
 *   RELOAD-HINT TRIGGER LADDER (D-16-12 -- refines SNM-15):
 *     - Any plugin.status in {"installed", "updated", "reinstalled",
 *       "uninstalled"}, OR
 *     - Any mp.status in {"added", "removed", "updated"} (state-changing;
 *       NOT "failed").
 *     - Otherwise: suppressed.
 *
 *   RELOAD-HINT APPEND:
 *     `${body}\n\n/reload to pick up changes` -- one blank line between
 *     body and trailer (D-16-13; mirrors V1's appendReloadHint shape).
 *
 *   SEVERITY LADDER (D-16-11, first match wins):
 *     1. Any plugin.status === "failed" OR mp.status === "failed" -> "error"
 *     2. Any plugin.status in {"skipped", "manual recovery"}      -> "warning"
 *     3. Otherwise                                                -> undefined (info)
 *
 *     Pi-API surface: omit-2nd-arg = info severity; pass "warning" / "error"
 *     otherwise.
 *
 *   NOTIFY-USAGE-ERROR SHAPE (SNM-13 / D-16-02):
 *     `ctx.ui.notify(`${msg.message}\n\n${msg.usage}`, "error")` -- one
 *     blank line between message and usage block; severity always
 *     "error" (structural, not a field).
 *
 * Authority: this file is the de facto v2 spec until Phase 17 lifts it into
 * the output catalog (SNM-19 / SNM-20 / SNM-31).
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  notify,
  notifyUsageError,
  type NotificationMessage,
  type UsageErrorMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Mock helpers -- a minimal ctx whose `ui.notify` is a mock.fn, plus mock-pi
// shapes that drive the softDepStatus(pi) probe inspection.
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

/** Probe reports both pi-subagents and pi-mcp-adapter loaded. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

/** Probe reports pi-subagents loaded, pi-mcp-adapter NOT loaded. */
function piWithSubagentsLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }],
  };
}

/** Probe reports pi-mcp-adapter loaded, pi-subagents NOT loaded. */
function piWithMcpLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "mcp" }],
  };
}

/** Probe reports nothing loaded -- both soft-dep markers fire when declared. */
function piWithNothingLoaded(): MockPi {
  return {
    getAllTools: () => [],
  };
}

// ===========================================================================
// 1-10: Per-plugin-status variants (one test per PluginNotificationMessage
// discriminant). Each test wraps the plugin row inside an "added" marketplace
// header so the 2-line body shape is asserted alongside the per-row grammar.
// Baselines omit `p.scope` to exercise the non-orphan-fold path (no `[scope]`
// bracket on the row).
// ===========================================================================

test("notify renders single installed plugin with empty deps under added marketplace (info severity + reload-hint)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders installed plugin with agents dep + probe unloaded (soft-dep marker emitted inside brace)", () => {
  const ctx = makeCtx();
  const pi = piWithMcpLoaded(); // agents NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed) {requires pi-subagents}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders updated plugin with version arrow + mcp dep marker", () => {
  const ctx = makeCtx();
  const pi = piWithSubagentsLoaded(); // mcp NOT loaded
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            name: "commit-commands",
            from: "1.0.0",
            to: "1.1.0",
            dependencies: ["mcp"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands 1.0.0 → v1.1.0 (updated) {requires pi-mcp}\n\n/reload to pick up changes`,
  ]);
});

test("notify renders reinstalled plugin with both deps loaded (no soft-dep marker, empty brace suppressed)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "reinstalled",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: ["agents", "mcp"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (reinstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders uninstalled plugin (no dependencies field, ICON_AVAILABLE)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "uninstalled",
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ○ commit-commands v1.0.0 (uninstalled)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders available plugin (MSG-PL-6 carve-out: NO scope bracket ever, list-surface header)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        // list-surface (no status); details undefined -> SUB-BRANCH A bare header.
        plugins: [
          {
            status: "available",
            name: "commit-commands",
            version: "1.0.0",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Bare header (SUB-BRANCH A) + indented available row (no scope bracket on
  // the row per MSG-PL-6 / SNM-11). No reload-hint (no state-changing
  // statuses); no severity arg (info).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ○ commit-commands v1.0.0 (available)`,
  ]);
});

test("notify renders unavailable plugin with reasons (MSG-PL-6 carve-out: NO scope bracket)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "commit-commands",
            reasons: ["hooks"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Variant has no `version` set -> renderVersion("") -> "" slot collapsed.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊘ commit-commands (unavailable) {hooks}`,
  ]);
});

test("notify renders upgradable plugin with version and reasons brace", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["stale clone"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // No scope bracket on the row (p.scope omitted); no reload-hint (no
  // state-changing status); upgradable does not trigger severity warning.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ● commit-commands v1.0.0 (upgradable) {stale clone}`,
  ]);
});

test("notify renders skipped plugin with reasons (warning severity)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "skipped",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["up-to-date"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // The marketplace-status arm is deleted per SNM-33 / D-22-01, so a
  // `(skipped)` row under an `(added)` marketplace emits NO trailer
  // (`skipped` is not one of installed/updated/reinstalled/uninstalled).
  // p.status === "skipped" still routes severity to "warning" per D-16-11
  // (computeSeverity is independent of shouldEmitReloadHint).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ commit-commands v1.0.0 (skipped) {up-to-date}`,
    "warning",
  ]);
});

test("notify renders failed plugin with reasons only -- no cause, no rollback (error severity, NO reload-hint when mp.status=failed)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["network unreachable"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // mp.status === "failed" does NOT trigger reload-hint (D-16-12: SNM-15
  // refinement -- failed rollbacks do not trigger). p.status === "failed"
  // routes severity to "error" per D-16-11.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

// ===========================================================================
// 11-15: Marketplace-header variants (5 cases). Each uses empty `plugins: []`
// to focus the assertion on the header byte form. The first 4 are
// state-change arms (status set); the 5th is the list-surface SUB-BRANCH B
// case (mp.status undefined, details defined).
// ===========================================================================

test("notify renders added marketplace header alone (empty plugins -> header-only body, NO reload-hint per SNM-33/D-22-01)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // No plugin rows -> no Pi-visible state change -> no trailer (D-22-01).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

test("notify renders removed marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-02)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "removed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Empty remove (no plugins unstaged) -> no trailer (G-MIL-02 / D-22-01).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (removed)`]);
});

test("notify renders updated marketplace header alone (empty plugins -> header-only, NO reload-hint per SNM-33/D-22-01, G-MIL-06)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "updated", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Empty `plugins:[]` update (manifest refresh, no plugin children) -> no
  // trailer (G-MIL-06 / D-22-01).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (updated)`]);
});

test("notify renders failed marketplace header alone (empty plugins -> NO reload-hint per D-16-12; no severity because no failed plugin)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "failed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // mp.status === "failed" triggers severity "error" per D-16-11 (the
  // severity ladder catches mp.status === "failed" even with no failed
  // plugins). But the reload-hint is suppressed per D-16-12 (failed
  // marketplace operations roll back; no state landed).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`⊘ demo [user] (failed)`, "error"]);
});

// ===========================================================================
// 15a-15e (Phase 17.1 D-17.1-05.2): five new tests covering the autoupdate
// surface added by D-17.1-02 / D-18-05. Three per-arm byte-equality tests
// (autoupdate enabled, autoupdate disabled, skipped + reasons) lock the
// renderer arms; two ladder tests structurally lock the severity ladder
// (mp.skipped -> "warning") and prove the first-match severity routing
// fires on mp-level status even when a healthy plugin row coexists.
// ===========================================================================

test("notify renders autoupdate enabled marketplace header alone (UXG-04 <autoupdate> marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // UXG-04 supersedes the D-18-05 (autoupdate enabled) status token: the
  // fresh flip renders the <autoupdate> marker-as-outcome. D-22-03 still
  // supersedes the reload-trigger half of D-17.1-02: a fresh flip mutates a
  // marketplace record, not a Pi-visible resource, so NO trailer; no severity
  // arg (info routing).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <autoupdate>`]);
});

test("notify renders autoupdate disabled marketplace header alone (UXG-04 <no autoupdate> off-marker, info severity, NO reload-hint per SNM-33/D-22-01/D-22-03)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // UXG-04 supersedes the D-18-05 (autoupdate disabled) status token: the
  // fresh flip renders the explicit <no autoupdate> off-marker. D-22-03 still
  // suppresses the trailer; no severity arg (info routing).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <no autoupdate>`]);
});

test("notify renders idempotent-enable marketplace header with <autoupdate> marker + reasons brace (UXG-04, warning severity, NO reload-hint per D-17.1-05)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        reasons: ["already autoupdate"],
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // UXG-04 byte form: idempotent flip renders the marker-as-outcome plus the
  // idempotence brace (no `(skipped)` token) and routes severity to "warning";
  // NO reload-hint (no state changed).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● foo [user] <autoupdate> {already autoupdate}`,
    "warning",
  ]);
});

test('notify severity tier mp-skipped: idempotent-disable marketplace renders <no autoupdate> + brace, routes "warning" (UXG-04 / D-17.1-05 ladder)', () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        reasons: ["already no autoupdate"],
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Structural assertion of the severity-arg presence; the byte form is
  // covered by the preceding test. The Pi API surface routes the second
  // arg as the severity magic-string per D-16-11.
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("notify mixed-severity payload: mp.skipped coexists with healthy plugin row -> first-match severity routing fires on mp.status (D-17.1-05)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // Mixed payload: mp-level "skipped" (idempotent autoupdate flip) sitting
  // OVER a healthy plugin row. Plan 17.1-02 Task 3 (checker Issue #3
  // reframing) calls for this test to PROVE the routing semantics that
  // Tests 3 and 4 above do not cover (those tests use empty plugins).
  //
  // The "healthy" plugin row is "available" rather than "installed". Per
  // D-16-12 + the Phase 17.1 amendment to shouldEmitReloadHint, plugin
  // statuses {"installed", "updated", "reinstalled", "uninstalled"} ARE
  // reload-hint triggers; "available" is NOT. Using "available" lets the
  // test cleanly isolate the mp.skipped severity routing while honoring
  // assertion (c) below (no reload-hint trailer). The plan's intent is to
  // prove "the mp-level routing dominates a non-empty healthy plugin set"
  // -- the specific healthy variant is unconstrained as long as it routes
  // to info/no-trigger when alone. (Deviation from plan's "installed"
  // wording: see SUMMARY for rationale; "installed" would itself trigger
  // the reload-hint per D-16-12, contradicting assertion (c).)
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        reasons: ["already autoupdate"],
        plugins: [
          // "available" is a non-state-changing plugin row (no version,
          // no scope per MSG-PL-6 / SNM-11 carve-out, no reasons). Alone
          // it routes severity to info AND does NOT trigger the
          // reload-hint per D-16-12.
          {
            name: "p1",
            status: "available",
            version: "1.0.0",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  // (a) Severity ladder: first-match pass routes mp.skipped to "warning"
  //     REGARDLESS of the healthy "available" plugin row underneath
  //     (which alone would route to info).
  assert.equal(args[1], "warning");
  // (b) mp header renders the idempotent-autoupdate state as the UXG-04
  //     marker-as-outcome plus the idempotence brace.
  const body = args[0] as string;
  assert.ok(
    body.includes(`● foo [user] <autoupdate> {already autoupdate}`),
    `expected body to include mp-skipped header, got: ${body}`,
  );
  // (c) Reload-hint is absent. mp.skipped is an idempotent no-op (no
  //     state change); the healthy "available" plugin row alone is NOT a
  //     trigger per D-16-12. Together they yield no reload-hint trailer.
  assert.ok(
    !body.includes(`/reload to pick up changes`),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify renders SUB-BRANCH B list-surface marketplace header with autoupdate token; lastUpdatedAt field persists but is not rendered (UXG-01)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        // mp.status omitted (list-surface). lastUpdatedAt is supplied to
        // prove the retained field is no longer rendered (UXG-01).
        details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // SUB-BRANCH B byte form per UXG-01: bare header + " <autoupdate>" only.
  // The `<last-updated <iso>>` token was dropped from the list surface --
  // `details.lastUpdatedAt` stays in state/type but the renderer no longer
  // emits it. No reload-hint (no state-changing status); no severity arg.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] <autoupdate>`]);
});

// ===========================================================================
// 16: Empty plugins on a state-change marketplace -- already covered by 11
// but reasserted as a single-purpose test of the "header-only block when
// plugins: []" invariant alongside its reload-hint trigger semantics.
// ===========================================================================

test("notify renders header-only block on empty plugins under added marketplace (NO reload-hint per SNM-33/D-22-01)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Header-only block; no plugin rows -> no trailer (D-22-01).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user] (added)`]);
});

// ===========================================================================
// 16a / 16b: UAT G-21-01 inventory-vs-transition discriminator (SNM-15
// surface tightening). The list-only `present` token does NOT trigger
// the reload-hint; the cascade-context `installed` token DOES.
// ===========================================================================

test("UAT G-21-01: list-shaped message with status: 'present' plugin row emits NO /reload trailer (SNM-15 inventory-vs-transition discriminator)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // List-shaped payload: mp.status === undefined (list surface) +
  // single steady-state inventory row using the new list-only token
  // `status: "present"`. shouldEmitReloadHint must NOT fire because
  // "present" is deliberately ABSENT from the trigger set (gap fix).
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "present",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  // The list-only `present` token renders byte-identical to `installed`
  // on the human-visible row text (the renderer arm preserves the
  // `(installed)` parenthetical so the list-surface byte assertions are
  // preserved); only the trailing reload-hint is removed.
  assert.ok(
    body.includes("● alpha v1.0.0 (installed)"),
    `expected body to include byte-identical-to-installed row, got: ${body}`,
  );
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("UAT G-21-01: cascade-shaped message with status: 'installed' plugin row continues to emit the /reload trailer (transition token preserved)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // Cascade-shaped payload: bare marketplace header (mp.status ===
  // undefined, no details) + single `installed` cascade transition row.
  // shouldEmitReloadHint MUST fire because `installed` is one of the
  // four state-change tokens that drive the trigger set; the gap fix
  // does not touch that discriminator path.
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected body to include reload-hint trailer, got: ${body}`,
  );
});

// ===========================================================================
// 16c-16g: D-22-04 reload-trailer discipline (SNM-33). Three NEGATIVE
// regressions lock the G-MIL-01/02/06 gaps (a marketplace-status-only
// operation with no plugin state-change row emits NO trailer); two POSITIVE
// guards (SC#4) prove the trailer STILL fires for every true state-change
// path. Mirrors the G-21-01 16a/16b template.
// ===========================================================================

test("D-22-04 NEGATIVE: empty `marketplace add` ({status:'added', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-01)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty add to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: empty `marketplace remove` ({status:'removed', plugins:[]}) emits NO /reload trailer (SNM-33 / G-MIL-02)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected empty remove to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 NEGATIVE: no-op `marketplace update` (all plugin rows skipped) emits NO /reload trailer (SNM-33 / G-MIL-06)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [{ status: "skipped", name: "alpha", reasons: ["up-to-date"] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  // No plugin row carries a state-change token (all `skipped`), so the
  // trailer is suppressed even though mp.status === "updated".
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected all-skipped update to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace remove` that uninstalled >=1 plugin emits the /reload trailer (SC#4)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "removed",
        plugins: [{ status: "uninstalled", name: "alpha" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected non-empty remove to include reload-hint trailer, got: ${body}`,
  );
});

test("D-22-04 POSITIVE: `marketplace update` with >=1 changed plugin emits the /reload trailer (SC#4)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "updated",
        plugins: [
          { status: "updated", name: "alpha", from: "1.0.0", to: "2.0.0", dependencies: [] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected update with a changed plugin to include reload-hint trailer, got: ${body}`,
  );
});

// ===========================================================================
// 17: Empty top-level marketplaces -- the "(no marketplaces)" sentinel per
// 16-05-SUMMARY. No reload-hint, no severity.
// ===========================================================================

test("notify renders (no marketplaces) sentinel for empty marketplaces array (no reload-hint, no severity)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = { marketplaces: [] };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Bare sentinel; no leading icon, no trailing newline, no reload-hint, no
  // severity arg (no state-changing or failure-class statuses in the
  // payload). Planner pick per 16-05-SUMMARY: 17 bytes "(no marketplaces)".
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`(no marketplaces)`]);
});

// ===========================================================================
// 17a: BLOCKER-COVERAGE (locks in plan-03 BLOCKER-3 fix).
//
// Empty-list-surface payload: single marketplace with `status: undefined`,
// `details: undefined` (BOTH absent independently per Phase 15 D-15-06's
// optional-and-independent typing), `plugins: []`. Expected output: the
// BARE marketplace header from SUB-BRANCH A of renderMpHeader (no trailing
// autoupdate token). Critical assertion: the call MUST NOT
// throw -- plan 03's `case undefined:` arm explicitly guards
// `mp.details === undefined` before reading `mp.details.autoupdate`.
// Reload-hint MUST be suppressed (neither plugin nor marketplace status is
// in the trigger set).
// ===========================================================================

test("notify renders bare marketplace header when mp.status and mp.details are both undefined (no-crash, BLOCKER-3 coverage)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        // status: undefined (omitted) AND details: undefined (omitted).
        // BOTH absent independently per D-15-06 -- this is the empty-list-
        // surface payload that test 17a guards against the plan-03
        // BLOCKER-3 regression (runtime crash when reading mp.details
        // .autoupdate without a guard).
        plugins: [],
      },
    ],
  };
  // The next call MUST NOT throw. If `renderMpHeader`'s `case undefined:`
  // arm regresses and unconditionally reads `mp.details.autoupdate`, this
  // would throw `TypeError: Cannot read properties of undefined`.
  assert.doesNotThrow(() => {
    notify(ctx as never, pi as never, msg);
  });
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // SUB-BRANCH A byte form per 16-03-SUMMARY: bare header "● demo [user]"
  // with NO trailing autoupdate token. No reload-hint, no severity arg.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● demo [user]`]);
});

// ===========================================================================
// 18: Single-plugin payload -- explicit 2-line shape assertion (header + row).
// ===========================================================================

test("notify renders single-plugin payload as 2-line body (header + 2-space indented row)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

// ===========================================================================
// 19: Multi-plugin payload (3 installed plugins under one "added"
// marketplace). Verify caller-supplied order is preserved (D-16-06 -- no
// internal sort). Pass plugins in non-alphabetical order (gamma, alpha, beta)
// and assert the output reflects the caller order.
// ===========================================================================

test("notify preserves caller-supplied plugin order across multi-plugin payload (D-16-06: no internal sort)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          { status: "installed", name: "gamma", version: "1.0.0", dependencies: [] },
          { status: "installed", name: "alpha", version: "2.0.0", dependencies: [] },
          { status: "installed", name: "beta", version: "3.0.0", dependencies: [] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Order MUST be gamma, alpha, beta (caller-supplied), NOT alpha, beta,
  // gamma (alphabetical). D-16-06: notify() iterates msg.marketplaces[] and
  // each mp.plugins[] in caller order with no internal sort.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● gamma v1.0.0 (installed)\n  ● alpha v2.0.0 (installed)\n  ● beta v3.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

// ===========================================================================
// 20: Multi-marketplace payload (2 "added" marketplaces with 1 plugin each).
// Verify blocks separated by one blank line (D-16-07) and reload-hint
// appended at end.
// ===========================================================================

test("notify joins multi-marketplace blocks with single blank line and appends reload-hint at end (D-16-07)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "alpha-mp",
        scope: "user",
        status: "added",
        plugins: [
          { status: "installed", name: "alpha-plugin", version: "1.0.0", dependencies: [] },
        ],
      },
      {
        name: "beta-mp",
        scope: "project",
        status: "added",
        plugins: [{ status: "installed", name: "beta-plugin", version: "2.0.0", dependencies: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Two marketplace blocks separated by "\n\n" (D-16-07); reload-hint
  // appended after one additional "\n\n" (D-16-13).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● alpha-mp [user] (added)\n  ● alpha-plugin v1.0.0 (installed)\n\n● beta-mp [project] (added)\n  ● beta-plugin v2.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

// ===========================================================================
// 21: Orphan-fold PRESENT -- plugin row with `scope: "user"` explicitly set
// inside a marketplace header with `scope: "project"`. Plugin row's [user]
// bracket reflects the plugin's scope; header's [project] bracket reflects
// the marketplace's scope.
// ===========================================================================

test("notify emits inline [scope] bracket on plugin row when p.scope set (orphan-fold PRESENT)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // The header carries [project]; the plugin row carries the inline [user]
  // bracket reflecting the plugin's scope.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands [user] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

// ===========================================================================
// 21a: BLOCKER-COVERAGE (locks in plan-04 BLOCKER-1 fix).
//
// Orphan-fold ABSENT: the same `installed` plugin payload as test 21 BUT
// with `p.scope` OMITTED (undefined). Expected output: the plugin row
// contains NO `[scope]` bracket at all -- `renderScopeBracket(p.scope)`
// yields "" when `p.scope === undefined` and `joinTokens` filters the empty
// slot out. Critical assertions: the row MUST NOT contain `[undefined]`,
// MUST NOT contain ANY `[...]` bracket between the plugin name and the
// version slot (the marketplace header's `[project]` is the only `[...]`
// bracket in the body). This test would fail LOUDLY if the implementation
// regressed to an unconditional `[${p.scope}]` interpolation.
// ===========================================================================

test("notify omits scope bracket on plugin row when p.scope is undefined (non-orphan-fold, BLOCKER-1 coverage)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            // p.scope OMITTED (undefined) -- non-orphan-fold case. The
            // BLOCKER-1 anti-pattern would emit the literal "[undefined]"
            // here via an unconditional `[${p.scope}]` interpolation.
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // The header carries [project]; the plugin row has NO bracket at all
  // between "commit-commands" and "v1.0.0". The exact-byte assertion
  // catches both the [undefined] regression AND any accidental [project]
  // leak from the header.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);

  // Defense-in-depth anti-regression check: explicitly assert the
  // [undefined] anti-pattern is absent from the body.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "BLOCKER-1: row must not contain the literal [undefined] substring",
  );
  // The plugin row line is the second line of the body.
  const lines = body.split("\n");
  const pluginRow = lines[1]!;
  assert.ok(
    !pluginRow.includes("[project]"),
    "BLOCKER-1: plugin row must not leak the marketplace's [project] bracket",
  );
  assert.ok(
    !pluginRow.includes("[user]"),
    "BLOCKER-1: plugin row must not contain a stray [user] bracket either",
  );
});

// ===========================================================================
// 21b-21e: Post-CR-01 orphan-fold contract locks (Phase 17.2 D-17.2-07)
//
// These four tests lock the corrected 2-arg `renderScopeBracket(pluginScope,
// mpScope)` contract at the renderer level, independent of the catalog UAT.
// Coverage spans `installed` (same-scope + orphan-fold), `updated`
// (same-scope), and `failed` (orphan-fold) so the 8 scope-bearing variants
// are exercised across both dep-bearing and error-class arms. Each test
// inherits the defense-in-depth assertions from test 21a (lines 957-973):
// the body MUST NOT contain `[undefined]`; the plugin row MUST NOT leak
// the marketplace header's bracket.
// ===========================================================================

test("notify omits scope bracket on installed plugin row when p.scope === mp.scope (D-17.2-07a)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "user", // same-scope: plugin scope matches marketplace scope -> no bracket
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Header carries [user]; plugin row has NO bracket between "alpha" and
  // "v1.0.0" because p.scope === mp.scope (orphan-fold contract).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);

  // Defense-in-depth (mirrors 21a): no `[undefined]`; plugin row contains
  // no `[user]` or `[project]` bracket of any kind.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07a: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07a: same-scope plugin row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07a: same-scope plugin row must not leak any other [scope] bracket",
  );
});

test("notify emits [project] bracket on installed plugin row when p.scope !== mp.scope (D-17.2-07b)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            version: "1.0.0",
            dependencies: [],
            scope: "project", // orphan-fold: plugin scope differs from marketplace scope
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Header carries [user]; plugin row carries inline [project] bracket.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha [project] v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);

  // Defense-in-depth: no `[undefined]`; plugin row DOES contain the
  // literal `[project]` substring.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07b: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07b: orphan-fold plugin row must contain the [project] bracket",
  );
});

test("notify omits scope bracket on updated plugin row when p.scope === mp.scope (D-17.2-07c)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "project",
        status: "added",
        plugins: [
          {
            status: "updated",
            name: "alpha",
            from: "0.9.0",
            to: "1.0.0",
            dependencies: [],
            scope: "project", // same-scope: no bracket
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Header carries [project]; plugin row has NO bracket between "alpha"
  // and the version-arrow slot. The version-arrow renders as
  // `<from> → v<to>`.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha 0.9.0 → v1.0.0 (updated)\n\n/reload to pick up changes`,
  ]);

  // Defense-in-depth: no `[undefined]`; plugin row contains no `[...]`
  // bracket at all.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07c: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    !pluginRow.includes("[user]"),
    "D-17.2-07c: same-scope updated row must not contain a [user] bracket",
  );
  assert.ok(
    !pluginRow.includes("[project]"),
    "D-17.2-07c: same-scope updated row must not leak the [project] bracket",
  );
});

test("notify emits [project] bracket on failed plugin row when p.scope !== mp.scope (D-17.2-07d)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            version: "1.0.0",
            reasons: ["unsupported source"],
            scope: "project", // orphan-fold on an error-class arm
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // mp.status === "added" (fresh-add cascade) + 1 failed plugin -> "error"
  // severity. Under SNM-33 / D-22-01 the only plugin row is `failed`, which
  // is NOT one of the four state-change tokens, and the marketplace-status
  // arm is gone -- so NO reload-hint trailer is appended. (Severity routing
  // is independent and still returns "error" for the failed plugin.)
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ alpha [project] v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);

  // Defense-in-depth: no `[undefined]`; plugin row DOES contain the
  // literal `[project]` substring.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("[undefined]"),
    "D-17.2-07d: row must not contain the literal [undefined] substring",
  );
  const pluginRow = body.split("\n")[1]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07d: orphan-fold failed row must contain the [project] bracket",
  );
});

// ===========================================================================
// 22: Failed plugin with rollbackPartial (no causes) -- assert the
// 4-space-indented child rows per phase per 16-05-SUMMARY byte form.
// ===========================================================================

test("notify renders rollbackPartial child rows at 4-space indent for failed plugin (no causes)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            rollbackPartial: [{ phase: "skills" }, { phase: "agents" }],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Per 16-05-SUMMARY: each rollbackPartial child row is
  // "    [<phase>] (rollback failed)" (4-space indent). No causes -> no
  // 6-space-indent trailers. mp.status === "failed" -> error severity but
  // no reload-hint (D-16-12).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    [skills] (rollback failed)\n    [agents] (rollback failed)`,
    "error",
  ]);
});

// ===========================================================================
// 23: Failed plugin with cause + rollbackPartial-with-cause -- assert the
// full nested indent shape (PATTERNS.md "Indent shape worked example"
// pattern). Per-plugin cause-chain at 4-space indent; rollback child rows
// at 4-space indent; per-phase cause-chain at 6-space indent.
// ===========================================================================

test("notify renders nested cause chains: per-plugin at 4-space indent, per-phase rollback cause at 6-space indent (D-16-08)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const inner = new Error("inner", { cause: new Error("root") });
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: inner,
            rollbackPartial: [{ phase: "skills", cause: new Error("EACCES") }],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Indent shape:
  //   col 0 -- marketplace header (⊘ demo [user] (failed))
  //   col 2 -- plugin row (⊘ commit-commands v1.0.0 (failed) {install failed})
  //   col 4 -- per-plugin cause-chain trailer (cause: inner -> root)
  //   col 4 -- rollback child row ([skills] (rollback failed))
  //   col 6 -- per-phase cause-chain trailer (cause: EACCES)
  // mp.status === "failed" -> error severity; reload-hint suppressed.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    cause: inner -> root\n    [skills] (rollback failed)\n      cause: EACCES`,
    "error",
  ]);
});

// ===========================================================================
// 24: Multi-cause cascade -- 2 failed plugins each with own cause, both
// under one marketplace. Each plugin row followed by its own 4-space-
// indented cause-chain trailer (D-16-08: cause chains are inline below
// their row, not aggregated).
// ===========================================================================

test("notify emits per-plugin cause-chain inline below each failed row (multi-cause cascade, D-16-08)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: new Error("alpha-root"),
          },
          {
            status: "failed",
            name: "beta",
            version: "2.0.0",
            reasons: ["network unreachable"],
            cause: new Error("beta-root"),
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Each plugin's cause-chain renders inline below its OWN row at 4-space
  // indent (not aggregated under a single trailer). Under SNM-33 / D-22-01
  // every plugin row is `failed` (no state-change token) and the
  // marketplace-status arm is gone, so NO reload-hint trailer; severity is
  // "error" per D-16-11 (independent of the reload-hint ladder).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {permission denied}\n    cause: alpha-root\n  ⊘ beta v2.0.0 (failed) {network unreachable}\n    cause: beta-root`,
    "error",
  ]);
});

// ===========================================================================
// 25-27: Severity routing -- one test per tier (info / warning / error),
// plus the first-match-wins assertion for the error tier.
// ===========================================================================

test("notify severity tier info: installed plugin in added marketplace -> arguments length 1 (no severity arg)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [{ status: "installed", name: "alpha", version: "1.0.0", dependencies: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Info severity = omit 2nd arg (V1 notifySuccess precedent).
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('notify severity tier warning: single skipped plugin -> arguments = [..., "warning"]', () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["up-to-date"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // skipped -> warning severity per D-16-11.
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test('notify severity tier error first-match: failed + skipped in same payload -> "error" (failed beats warning)', () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "skipped", name: "alpha", version: "1.0.0", reasons: ["up-to-date"] },
          { status: "failed", name: "beta", version: "2.0.0", reasons: ["permission denied"] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // failed wins per D-16-11 first-match ladder.
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 2);
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

// ===========================================================================
// 28: Reload-hint suppression -- payload with ONLY failed plugins under
// failed marketplaces: NO `/reload to pick up changes` trailer. Negative
// counterpart to tests 1-5, 9, 11-13, 16, 18-21, 24 (which all assert the
// positive trigger).
// ===========================================================================

test("notify suppresses reload-hint when payload contains only failed statuses (D-16-12 negative case)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["permission denied"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Neither plugin nor marketplace status is in the trigger set (mp.status
  // "failed" is excluded; p.status "failed" is excluded). Body MUST NOT
  // contain the `/reload to pick up changes` trailer.
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  const body = callArgs[0];
  assert.ok(
    !body.includes("/reload to pick up changes"),
    "D-16-12: reload-hint must be suppressed when no state-changing status is present",
  );
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}`,
    "error",
  ]);
});

// ===========================================================================
// 29: notifyUsageError shape (SNM-13 / D-16-02) -- ${message}\n\n${usage}
// with "error" severity arg.
// ===========================================================================

test("notifyUsageError emits ${msg.message}\\n\\n${msg.usage} with 'error' severity (SNM-13)", () => {
  const ctx = makeCtx();
  const msg: UsageErrorMessage = {
    message: "Unknown plugin",
    usage: "Usage: /claude:plugin install <name>",
  };
  notifyUsageError(ctx as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `Unknown plugin\n\nUsage: /claude:plugin install <name>`,
    "error",
  ]);
});

// ===========================================================================
// 30: Manual-recovery plugin -- the 10th PluginNotificationMessage variant.
// Discriminator literal includes the space ("manual recovery"); status slot
// emits it verbatim per shared/grammar/status-tokens.ts:47. Carries optional
// cause (D-16-08 inline cause-chain trailer at 4-space indent below the
// row); severity routes to "warning" per D-16-11.
// ===========================================================================

test("notify renders manual recovery plugin with cause-chain trailer (warning severity, status literal includes the space)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new Error("EACCES"),
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // status slot is the literal "(manual recovery)" WITH a space. Severity
  // is "warning" per D-16-11. Cause-chain at 4-space indent below the row
  // per D-16-08.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("AS-7: manual recovery row names the leaked paths from ManualRecoveryError.leaks", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const leaks = [
    "/home/u/.pi/pi-claude-marketplace/agents-staging/foo.md",
    "/home/u/.pi/pi-claude-marketplace/agents-index.json",
  ];
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("agent index rewrite failed", leaks, {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const [rendered, severity] = ctx.ui.notify.mock.calls[0]!.arguments as [string, string];
  assert.equal(severity, "warning");
  // The cause chain surfaces the wrapped errors, and the AS-7 leaked-paths
  // child rows name each leaked file at the 4-space indent.
  assert.match(rendered, /cause: agent index rewrite failed -> EACCES/);
  for (const leak of leaks) {
    assert.match(rendered, new RegExp(`    leaked: ${leak.replace(/[.]/g, "\\.")}`));
  }
});

test("AS-7: manual recovery row with no leaks emits no leaked-paths child row", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "manual recovery",
            name: "commit-commands",
            version: "1.0.0",
            reasons: ["rollback partial"],
            cause: new ManualRecoveryError("nothing leaked", [], {
              cause: new Error("EACCES"),
            }),
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.doesNotMatch(rendered, /leaked:/);
});

// ===========================================================================
// 31-33: SNM-35 hash-version display (D-23-04 / D-23-05 / D-23-06).
// A persisted PI-7 `hash-<12hex>` renders as a git-style short SHA
// `v#<7hex>` (first 7 of the 12-hex truncation), NOT the verbose
// `v` + `hash-<12hex>` form. Canonical example: `hash-2ea95f85703d` ->
// `v#2ea95f8`. Persistence is unchanged (state.json keeps `hash-<12hex>`,
// PI-7 intact, SC#3); the transform is renderer-only. The verbose
// `v` + raw-hash literal MUST NOT appear in any expected byte string here.
// ===========================================================================

test("notify renders single-version hash row as v#<7hex> via renderVersion chokepoint (SNM-35)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "hash-2ea95f85703d",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // The persisted `hash-2ea95f85703d` renders the version token `v#2ea95f8`
  // (NOT the verbose `v` + raw hash); first 7 hex of the 12-hex truncation.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("notify renders update arrow with hash on both sides as #<7hex> → v#<7hex> via composeVersionArrow (SNM-35)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "updated",
            name: "commit-commands",
            from: "hash-2ea95f85703d",
            to: "hash-1c3d9a0bbef1",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Asymmetric `v`: `from` rendered bare (`#2ea95f8`), `to` v-prefixed
  // (`v#1c3d9a0`) per composeVersionArrow / output-catalog.md.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands #2ea95f8 → v#1c3d9a0 (updated)\n\n/reload to pick up changes`,
  ]);
});

test("notify passes a SemVer version through unchanged -> v1.0.0 (non-hash pass-through guard, SNM-35)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // A non-hash version (SemVer) is NOT transformed: it renders `v1.0.0`,
  // confirming `formatHashVersionForDisplay` only touches `hash-<12hex>`.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});
