/**
 * tests/shared/notify-v2.test.ts -- Per-status unit suite for the
 * `notify()` and `notifyUsageError()` entry points
 * (SNM-19 / SNM-20 / SNM-31).
 *
 * ===========================================================================
 * notify grammar mini-spec (binding contract; D-16-04 authority)
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
 *   variants):
 *     For `installed` | `updated` | `reinstalled` | `uninstalled` |
 *     `upgradable` | `skipped` | `failed` | `manual recovery`, the
 *     `scope?: Scope` field is OPTIONAL (D-15-02/D-15-04). The
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
 *     updated, reinstalled) carry `dependencies?` per D-15-02; the
 *     other 7 arms cannot emit the markers.
 *
 *   MARKETPLACE HEADER SHAPE:
 *     - State-change arms ("added" | "removed" | "updated" | "failed"):
 *       `<icon> <mp.name> [<mp.scope>] (<status>)`.
 *     - List-surface arm (mp.status === undefined):
 *       - SUB-BRANCH A (mp.details === undefined): bare header, no
 *         trailing autoupdate token, NO crash. The renderer
 *         explicitly guards `mp.details === undefined` so the
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
 *       (D-16-08).
 *
 *   EMPTY-LIST SENTINELS:
 *     - Empty `marketplaces: []` at the top level: the body is exactly the
 *       17 bytes `"(no marketplaces)"` -- no leading icon, no trailing
 *       newline, no reload-hint, no severity arg.
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
 *   SUMMARY-LINE COMPOSITION (UXG-07 / D-29-02/03/04):
 *     For `error` and `warning` severity, notify() PREPENDS a summary line
 *     before the cascade body: `{summary}\n\n{body}` (the reload-hint, if
 *     any, stays last). The summary counts failed (error) /
 *     actionable-skip + manual-recovery (warning) plugin and marketplace
 *     operations: `"N plugin operation(s) <verb>."`,
 *     `"N marketplace operation(s) <verb>."`, or the mixed
 *     `"N plugin operation(s) and M marketplace operation(s) <verb>."`;
 *     verb is "failed" (error) / "skipped" (warning). Info severity carries
 *     NO summary line.
 *
 *   NOTIFY-USAGE-ERROR SHAPE (SNM-13 / D-16-02):
 *     `ctx.ui.notify(`${msg.message}\n\n${msg.usage}`, "error")` -- one
 *     blank line between message and usage block; severity always
 *     "error" (structural, not a field).
 *
 * Authority: this file is the de facto spec for the notify grammar
 * (SNM-19 / SNM-20 / SNM-31).
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
    `● demo [user] (added)\n  ● commit-commands v1.0.0 → v1.1.0 (updated) {requires pi-mcp}\n\n/reload to pick up changes`,
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

test("notify renders benign skipped plugin with up-to-date reason (info severity, UXG-02 / D-28-06)", () => {
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
  // Per UXG-02 / D-28-06 the single reason `up-to-date` is in BENIGN_REASONS,
  // so this all-benign cascade computes INFO (no 2nd severity arg).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ⊘ commit-commands v1.0.0 (skipped) {up-to-date}`,
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
  // routes severity to "error" per D-16-11. UXG-07 (D-29-02/03):
  // 1 failed plugin + 1 failed marketplace -> mixed-type summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation and 1 marketplace operation failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
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
  // marketplace operations roll back; no state landed). UXG-07
  // (D-29-03): 0 failed plugins, 1 failed marketplace -> marketplace-only
  // singular summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

// ===========================================================================
// D-48-A byte-regression locks: adding `reasons?` to the MpFailed
// arm MUST NOT change the byte form of an existing bare-`(failed)`
// marketplace state that omits `reasons`. `composeReasons(undefined, ...)`
// returns "", and the renderer's `reasonsBrace === ""` ternary then emits the
// bare `⊘ <name> [<scope>] (failed)` header with NO reason brace. These tests
// pin the THREE pre-existing bare-`(failed)` byte forms that this milestone's
// catalog states reference:
//   - `failure-unreachable` (marketplace add)  -> `⊘ <mp> [<scope>] (failed)`
//   - `mp-failure-network`  (marketplace update) -> same header (cause rides a
//      synthetic child row in the live path; the bare header is the locked form)
//   - the autoupdate bare-not-found form was SUPERSEDED to `{not added}` in Plan
//      48-02, so the third bare form is re-asserted here on the same MpFailed
//      arm (an autoupdate-shaped marketplace `failed` with reasons omitted) to
//      prove the arm itself stayed byte-stable for any reasons-omitted failed mp.
// The load-bearing proof is that each renders `(failed)` with NO `{...}` brace.
// ===========================================================================

test("D-48-A: bare-(failed) add `failure-unreachable` form is byte-unchanged (reasons omitted -> brace collapses)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "unreachable-mp", scope: "user", status: "failed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ unreachable-mp [user] (failed)`,
    "error",
  ]);
  // The header carries NO reason brace -- the D-48-A `reasons?` addition did not
  // regress the bare form.
  assert.match(rendered, /⊘ unreachable-mp \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: bare-(failed) update `mp-failure-network` header is byte-unchanged (reasons omitted -> brace collapses)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "official", scope: "user", status: "failed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ official [user] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ official \[user\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

test("D-48-A: a reasons-omitted failed marketplace arm renders bare `(failed)` (the third bare form; arm byte-stable)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // Explicitly omit `reasons` on the MpFailed arm: the brace MUST collapse.
  const msg: NotificationMessage = {
    marketplaces: [{ name: "missing-mp", scope: "project", status: "failed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const rendered = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ missing-mp [project] (failed)`,
    "error",
  ]);
  assert.match(rendered, /⊘ missing-mp \[project\] \(failed\)$/m);
  assert.doesNotMatch(rendered, /\(failed\) \{/);
});

// ===========================================================================
// 15a-15e (D-17.1-05.2): tests covering the autoupdate
// surface (D-17.1-02 / D-18-05). Three per-arm byte-equality tests
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
  // UXG-04 governs the autoupdate-enabled status token: the
  // fresh flip renders the <autoupdate> marker-as-outcome. D-22-03 governs
  // the reload-trigger: a fresh flip mutates a
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
  // UXG-04 governs the autoupdate-disabled status token: the
  // fresh flip renders the explicit <no autoupdate> off-marker. D-22-03
  // suppresses the trailer; no severity arg (info routing).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`● foo [user] <no autoupdate>`]);
});

test("notify renders idempotent-enable marketplace header with <autoupdate> marker + reasons brace (UXG-04, info severity per UXG-02 / D-28-07, NO reload-hint per D-17.1-05)", () => {
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
  // idempotence brace (no `(skipped)` token). Per UXG-02 / D-28-07 the mp-level
  // `skipped` reason `already autoupdate` is in BENIGN_REASONS, so this benign
  // no-op computes INFO (no 2nd arg); NO reload-hint (no state changed).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● foo [user] <autoupdate> {already autoupdate}`,
  ]);
});

test("notify severity tier mp-skipped: idempotent-disable marketplace renders <no autoupdate> + brace, computes info (benign per UXG-02 / D-28-07)", () => {
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
  // Structural assertion of the severity-arg ABSENCE; the byte form is
  // covered by the preceding test. Per UXG-02 / D-28-07 the mp-level
  // `skipped` reason `already no autoupdate` is in BENIGN_REASONS, so this
  // benign no-op computes INFO -- the 2nd arg is omitted (length 1).
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
});

test('UXG-05: marketplace update no-op (mp.skipped + reasons:["up-to-date"], plugins:[]) renders `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // The autoupdate-OFF manifest-only refresh whose validated manifest content
  // did not change. Reuses the SAME mp-level `skipped` arm as the idempotent
  // autoupdate no-ops, but with the generic `up-to-date` reason -> the
  // `(skipped) {<reason>}` byte form (NOT the marker-as-outcome autoupdate
  // branch). `up-to-date` is already a REASONS member; the renderer needs no
  // change. Locks renderer reuse + severity + trailer-absence in one byte test.
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "skipped",
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0] as string;
  // (a) Byte form: the shared mp-skipped arm renders `(skipped) {up-to-date}`.
  assert.equal(body, "● local-mp [user] (skipped) {up-to-date}");
  // (b) Severity: mp.status === "skipped" with the benign reason `up-to-date`
  //     (in BENIGN_REASONS) computes INFO via computeSeverity -- the 2nd arg
  //     is omitted (length 1). This realizes UXG-02 / D-28-07.
  assert.equal(args.length, 1);
  // (c) NO reload-hint: plugins:[] means no Pi-visible resource change, so the
  //     `/reload to pick up changes` trailer is absent (SNM-33 / orthogonal to
  //     UXG-05).
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test('UXG-05 (UAT Test-3 gap): autoupdate-ON no-op payload (mp.skipped + reasons:["up-to-date"], plugins:[]) renders byte-identically to the OFF no-op `● <mp> [<scope>] (skipped) {up-to-date}`, computes info (benign per UXG-02 / D-28-07), emits NO /reload trailer', () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // The autoupdate-ON cascade no-op: the orchestrator drops the all-`unchanged`
  // cascade rows (plugins:[]) and emits the SAME mp-level `skipped` payload as
  // the autoupdate-OFF no-op. This locks that the renderer is
  // autoupdate-flag-agnostic -- the no-op vs changed distinction is purely the
  // orchestrator's decision; the same shared mp-`skipped` arm composes the byte
  // form regardless of whether autoupdate was ON or OFF. `up-to-date` is
  // already a REASONS member; the renderer needs no change.
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "skipped",
        reasons: ["up-to-date"],
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  const body = args[0] as string;
  // (a) Byte form: same shared mp-skipped arm -> `(skipped) {up-to-date}`.
  assert.equal(body, "● official [user] (skipped) {up-to-date}");
  // (b) Severity: mp.status === "skipped" with the benign reason `up-to-date`
  //     computes INFO via computeSeverity (UXG-02 / D-28-07) -- 2nd arg
  //     omitted (length 1).
  assert.equal(args.length, 1);
  // (c) NO reload-hint: plugins:[] means no Pi-visible resource change.
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("notify benign-only cascade: benign mp.skipped coexists with healthy plugin row -> computes info (UXG-02 / D-28-06/07)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // Benign-only payload: mp-level "skipped" (idempotent autoupdate flip,
  // reason `already autoupdate` in BENIGN_REASONS) sitting OVER a healthy
  // plugin row. This proves the benign-softening ladder dominates a
  // non-empty healthy plugin set: the cascade's ONLY non-success row is a
  // BENIGN mp-skip, so per UXG-02 / D-28-06 arm 5 it computes INFO.
  //
  // The "healthy" plugin row is "available" rather than "installed". Per
  // D-16-12, plugin
  // statuses {"installed", "updated", "reinstalled", "uninstalled"} ARE
  // reload-hint triggers; "available" is NOT. Using "available" keeps
  // assertion (c) below (no reload-hint trailer) clean while isolating the
  // benign mp.skip severity routing.
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
  // (a) Severity ladder: the cascade's ONLY non-success row is the BENIGN
  //     mp.skip (`already autoupdate`), and the "available" plugin row is
  //     success -> arm 5 returns undefined (info), so the 2nd arg is
  //     omitted (length 1).
  assert.equal(args.length, 1);
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
        // prove the retained field is not rendered (UXG-01).
        details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // SUB-BRANCH B byte form per UXG-01: bare header + " <autoupdate>" only.
  // The list surface carries no `<last-updated <iso>>` token --
  // `details.lastUpdatedAt` stays in state/type but the renderer does not
  // emit it. No reload-hint (no state-changing status); no severity arg.
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
// PL-4: description second line (4-space indent, truncated at column 66).
// Tests cover all four list-surface variants (present / upgradable /
// available / unavailable) and the truncation boundary.
// ===========================================================================

test("PL-4: present row with description emits a 4-space-indented second line", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
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
            description: "A short description of the alpha plugin.",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(
    body,
    "● official [user]\n  ● alpha v1.0.0 (installed)\n    A short description of the alpha plugin.",
  );
});

test("PL-4: upgradable row with description emits description line", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "upgradable",
            name: "beta",
            version: "1.0.0",
            reasons: [],
            description: "Beta plugin description.",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(
    body,
    "● official [user]\n  ● beta v1.0.0 (upgradable)\n    Beta plugin description.",
  );
});

test("PL-4: available row with description emits description line", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "gamma",
            version: "2.0.0",
            description: "Installable plugin with a description.",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(
    body,
    "● official [user]\n  ○ gamma v2.0.0 (available)\n    Installable plugin with a description.",
  );
});

test("PL-4: unavailable row with description emits description line", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "delta",
            reasons: ["hooks"],
            description: "Unavailable plugin that still surfaces its description.",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(
    body,
    "● official [user]\n  ⊘ delta (unavailable) {hooks}\n    Unavailable plugin that still surfaces its description.",
  );
});

test("PL-4: description absent -- no second line emitted", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", version: "2.0.0" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  // Exactly one line under the header; no trailing newline or second indent.
  assert.equal(body, "● official [user]\n  ○ gamma v2.0.0 (available)");
});

test("PL-4: description exactly 66 chars -- emitted verbatim (no truncation)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const exactly66 = "A".repeat(66);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: exactly66 }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes(`    ${exactly66}`),
    `expected 66-char description verbatim, got: ${body}`,
  );
});

test("PL-4: description 67 chars -- truncated to 63 + '...' (column 66)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const over = "B".repeat(67);
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: over }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.includes(`    ${"B".repeat(63)}...`),
    `expected truncated description, got: ${body}`,
  );
});

test("PL-4: empty string description -- no second line emitted", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "available", name: "gamma", description: "" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.equal(body, "● official [user]\n  ○ gamma (available)");
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
// 17: Empty top-level marketplaces -- the "(no marketplaces)" sentinel.
// No reload-hint, no severity.
// ===========================================================================

test("notify renders (no marketplaces) sentinel for empty marketplaces array (no reload-hint, no severity)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = { marketplaces: [] };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // Bare sentinel; no leading icon, no trailing newline, no reload-hint, no
  // severity arg (no state-changing or failure-class statuses in the
  // payload). 17 bytes "(no marketplaces)".
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [`(no marketplaces)`]);
});

// ===========================================================================
// 17a: BLOCKER-3 coverage.
//
// Empty-list-surface payload: single marketplace with `status: undefined`,
// `details: undefined` (BOTH absent independently per D-15-06's
// optional-and-independent typing), `plugins: []`. Expected output: the
// BARE marketplace header from SUB-BRANCH A of renderMpHeader (no trailing
// autoupdate token). Critical assertion: the call MUST NOT
// throw -- the `case undefined:` arm explicitly guards
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
        // surface payload that test 17a guards against the
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
  // SUB-BRANCH A byte form: bare header "● demo [user]"
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
// 21a: BLOCKER-1 coverage.
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
// 21b-21e: orphan-fold contract locks (D-17.2-07)
//
// These four tests lock the 2-arg `renderScopeBracket(pluginScope,
// mpScope)` contract at the renderer level, independent of the catalog UAT.
// Coverage spans `installed` (same-scope + orphan-fold), `updated`
// (same-scope), and `failed` (orphan-fold) so the 8 scope-bearing variants
// are exercised across both dep-bearing and error-class arms. Each test
// inherits the defense-in-depth assertions from test 21a:
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
  // `v<from> → v<to>`.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [project] (added)\n  ● alpha v0.9.0 → v1.0.0 (updated)\n\n/reload to pick up changes`,
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
  // UXG-07 (D-29-03): 1 failed plugin, 0 failed marketplace
  // (mp.status is "added", not "failed") -> plugin-only singular summary.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation failed.\n\n● demo [user] (added)\n  ⊘ alpha [project] v1.0.0 (failed) {unsupported source}`,
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
  // The summary line is line 0; the marketplace header is line 2; the plugin
  // row is line 3 (after the blank line separating summary from cascade).
  const pluginRow = body.split("\n")[3]!;
  assert.ok(
    pluginRow.includes("[project]"),
    "D-17.2-07d: orphan-fold failed row must contain the [project] bracket",
  );
});

// ===========================================================================
// 22: Failed plugin with rollbackPartial (no causes) -- assert the
// 4-space-indented child rows per phase byte form.
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
  // Each rollbackPartial child row is
  // "    [<phase>] (rollback failed)" (4-space indent). No causes -> no
  // 6-space-indent trailers. mp.status === "failed" -> error severity but
  // no reload-hint (D-16-12). UXG-07 (D-29-02/03): 1 failed
  // plugin + 1 failed marketplace -> mixed-type summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation and 1 marketplace operation failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    [skills] (rollback failed)\n    [agents] (rollback failed)`,
    "error",
  ]);
});

// ===========================================================================
// 23: Failed plugin with cause + rollbackPartial-with-cause -- assert the
// full nested indent shape. Per-plugin cause-chain at 4-space indent;
// rollback child rows at 4-space indent; per-phase cause-chain at
// 6-space indent.
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
  // UXG-07 (D-29-02/03): 1 failed plugin + 1 failed marketplace
  // -> mixed-type summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation and 1 marketplace operation failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}\n    cause: inner -> root\n    [skills] (rollback failed)\n      cause: EACCES`,
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
  // UXG-07 (D-29-03): 2 failed plugins, 0 failed marketplace (mp "added")
  // -> plugin-only plural summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `2 plugin operations failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {permission denied}\n    cause: alpha-root\n  ⊘ beta v2.0.0 (failed) {network unreachable}\n    cause: beta-root`,
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

test('notify severity tier warning: single actionable skipped plugin -> arguments = [..., "warning"]', () => {
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
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // An ACTIONABLE skip (`not installed`, D-28-03) is NOT in BENIGN_REASONS, so
  // arm 3 of the D-28-06 ladder routes it to "warning" (a benign `up-to-date`
  // skip would compute info per UXG-02 -- see the dedicated info tests above).
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
  // UXG-07 (D-29-02/03): 1 failed plugin + 1 failed marketplace
  // -> mixed-type summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation and 1 marketplace operation failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {permission denied}`,
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
// emits it verbatim per shared/grammar/status-tokens.ts. Carries optional
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
  // per D-16-08. UXG-07 (D-29-04): a manual-recovery row counts
  // as 1 actionable skip -> "1 plugin operation skipped." summary prefix.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation skipped.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
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

test("notify renders update arrow with hash on both sides as v#<7hex> → v#<7hex> via composeVersionArrow (SNM-35)", () => {
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
  // Both sides v-prefixed: `from` = `v#2ea95f8`, `to` = `v#1c3d9a0`.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● commit-commands v#2ea95f8 → v#1c3d9a0 (updated)\n\n/reload to pick up changes`,
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

// ===========================================================================
// 33-35: UXG-02 benign-softening ladder (D-28-06 arms 2-4). The
// still-`warning` cases that the benign-skip variants above do NOT cover:
//   (i)  an actionable plugin skip (`reasons:["not installed"]`, D-28-03);
//   (ii) a MIXED cascade (one benign skip + one actionable skip under the
//        same marketplace) -- first-match poisoning per D-28-09;
//   (iii) an mp-level skip with `reasons` OMITTED -- D-28-08 safe default.
// The benign-only info cases are asserted in-place above (the plugin
// `up-to-date` skip, the idempotent autoupdate flips, the UXG-05 mp no-ops,
// the mixed mp.skipped+available cascade, and severity tier info). The
// manual-recovery -> warning case is asserted by the manual-recovery test above.
// ===========================================================================

test('UXG-02 (D-28-03/06): actionable plugin skip ("not installed") computes warning', () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // `not installed` is the actionable "can't update/reinstall a plugin that
  // isn't there" reason (D-28-03); it is NOT in BENIGN_REASONS, so arm 3 of
  // the D-28-06 ladder routes the cascade to "warning".
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
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-09): mixed cascade (benign skip + actionable skip) computes warning -- first-match poisoning", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // A benign `up-to-date` skip and an actionable `not installed` skip under
  // the SAME marketplace. Per D-28-09 the actionable row poisons the whole
  // cascade -> "warning" (the requirement's "*only* non-success rows are
  // benign skips -> info" is NOT satisfied here).
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "skipped", name: "alpha", version: "1.0.0", reasons: ["up-to-date"] },
          { status: "skipped", name: "beta", version: "2.0.0", reasons: ["not installed"] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning (allBenign guard on length)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // The plugin `skipped` variant's `reasons` is REQUIRED, so a literal empty
  // `reasons: []` is a structurally reachable input. `allBenign([])` returns
  // false (the `reasons.length > 0` guard), so arm 3 of the D-28-06 ladder
  // routes it to "warning" -- empty reasons cannot be proven benign, matching
  // the D-28-08 safe-default intent. Distinct from the actionable-reason case
  // and the mp-omitted-reasons case (arm 4, below).
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [{ status: "skipped", name: "alpha", version: "1.0.0", reasons: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

test("UXG-02 (D-28-08): mp-level skip with reasons OMITTED computes warning -- safe default", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // An mp-level `skipped` whose OPTIONAL `reasons?` is missing cannot be
  // proven benign (allBenign returns false on undefined), so arm 4 of the
  // D-28-06 ladder routes it to "warning" -- the D-28-08 safe default.
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "skipped", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "warning");
});

// ===========================================================================
// 36-43: UXG-07 summary-line composition (D-29-02/03/04). For
// `error` and `warning` severity, notify() PREPENDS a human-readable summary
// line before the cascade body: `{summary}\n\n{cascade body}` (+ optional
// reload-hint). The summary counts failed (error) / actionable-skip +
// manual-recovery (warning) plugin and marketplace operations, applying the
// singular/plural and mixed-type grammar. Info severity carries
// NO summary line. These tests assert the
// composition through the public `notify()` surface (buildSummaryLine is
// file-private).
// ===========================================================================

test("UXG-07 (D-29-02/03): error -- single failed plugin under failed mp -> '1 plugin operation and 1 marketplace operation failed.' summary prepended", () => {
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
  // 1 failed plugin + 1 failed marketplace -> mixed-type sentence.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation and 1 marketplace operation failed.\n\n⊘ demo [user] (failed)\n  ⊘ commit-commands v1.0.0 (failed) {network unreachable}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- single failed plugin, non-failed mp -> '1 plugin operation failed.' (single-type singular)", () => {
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
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // 1 failed plugin, 0 failed marketplace -> single-type singular.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation failed.\n\n● demo [user] (added)\n  ⊘ alpha v1.0.0 (failed) {unsupported source}`,
    "error",
  ]);
});

test("UXG-07 (D-29-03): error -- two failed plugins, non-failed mp -> '2 plugin operations failed.' (single-type plural)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          { status: "failed", name: "alpha", version: "1.0.0", reasons: ["permission denied"] },
          { status: "failed", name: "beta", version: "2.0.0", reasons: ["network unreachable"] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("2 plugin operations failed.\n\n"),
    "two-failed-plugin cascade summary must read '2 plugin operations failed.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-03): error -- failed mp only, no plugin rows -> '1 marketplace operation failed.' (single-type marketplace)", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "failed", plugins: [] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  // 0 failed plugins, 1 failed marketplace -> single-type marketplace.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- single actionable-skip plugin -> '1 plugin operation skipped.'", () => {
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
            reasons: ["not installed"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("1 plugin operation skipped.\n\n"),
    "single actionable-skip cascade summary must read '1 plugin operation skipped.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-04): warning -- manual-recovery plugin counts as an actionable skip -> '1 plugin operation skipped.'", () => {
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
  // manual-recovery row counts toward the skipped/actionable count (D-29-04).
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 plugin operation skipped.\n\n● demo [user]\n  ⊘ commit-commands v1.0.0 (manual recovery) {rollback partial}\n    cause: EACCES`,
    "warning",
  ]);
});

test("UXG-07 (D-29-03/04): warning -- two actionable-skip plugins + one actionable-skip mp -> mixed plural summary", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "skipped", name: "alpha", version: "1.0.0", reasons: ["not installed"] },
          { status: "skipped", name: "beta", version: "2.0.0", reasons: ["not installed"] },
        ],
      },
      { name: "other", scope: "user", status: "skipped", plugins: [] },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("2 plugin operations and 1 marketplace operation skipped.\n\n"),
    "mixed actionable-skip cascade summary must read '2 plugin operations and 1 marketplace operation skipped.'",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "warning");
});

test("UXG-07 (D-29-02): info severity -- NO summary line prepended (byte-identical to pre-Phase-29)", () => {
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
  // Info severity -> single-arg call, NO summary line, byte-identical cascade.
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● alpha v1.0.0 (installed)\n\n/reload to pick up changes`,
  ]);
});

test("UXG-07 (D-29-02): error -- summary prepended BEFORE cascade body AND reload-hint stays last", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // A cascade that both fails one plugin AND uninstalls another emits the
  // reload-hint (uninstalled is a state-change token). The summary line must
  // be FIRST, the reload-hint LAST: `{summary}\n\n{body}\n\n{reload-hint}`.
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "uninstalled", name: "alpha", version: "1.0.0" },
          { status: "failed", name: "beta", version: "2.0.0", reasons: ["permission denied"] },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    body.startsWith("1 plugin operation failed.\n\n"),
    "summary line must be the first line of the composed string",
  );
  assert.ok(
    body.endsWith("\n\n/reload to pick up changes"),
    "reload-hint must remain the last trailer after the cascade body",
  );
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("UXG-07 (D-29-02): warning -- benign-only cascade routes to INFO so NO summary line is prepended", () => {
  const ctx = makeCtx();
  const pi = piWithNothingLoaded();
  // A benign `up-to-date` plugin skip computes INFO under the D-28-06 ladder,
  // so notify() emits a single-arg call with NO summary line -- the summary
  // composition is gated on error/warning severity only (D-29-02). This pins
  // the negative: benign no-ops never gain a summary line.
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [{ status: "skipped", name: "alpha", version: "1.0.0", reasons: ["up-to-date"] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1, "benign-only skip is info severity -- single-arg call, no summary");
  assert.ok(
    !(args[0] as string).includes("operation skipped."),
    "info-severity cascade must NOT carry a summary line",
  );
});

// ===========================================================================
// INFO-04 / INFO-08 -- info-message variants + `wrapDescription`
//
// Two top-level NotificationMessage variants (`MarketplaceInfoMessage`,
// `PluginInfoMessage`), the `"not added"` REASON closed-set entry, and
// the file-private `wrapDescription` helper. The tests below lock:
//   - wrapDescription edge cases (6 tests covering empty, short, exact-fit,
//     long, over-length single word, whitespace normalization) -- driven
//     end-to-end through `notify()` with a `plugin-info` payload whose
//     description exercises each case (do NOT export wrapDescription).
//   - The INFO-04 `{not added}` --scope mismatch byte form + severity.
//   - renderMarketplaceInfo: github source with ref + lastUpdated +
//     description; path source without lastUpdated and without description.
//   - renderPluginInfo: componentsResolved:true with sorted components +
//     dependencies + wrapping description; componentsResolved:false with
//     the `components: not resolved` marker.
//   - Cascade backward-compat smoke: a payload without `kind` (Migration
//     Strategy #2) routes through the cascade arm byte-identically to a
//     payload with `kind: "cascade"` carrying the same marketplaces array.
// ===========================================================================

/**
 * Helper: construct a minimal PluginInfoMessage carrying the supplied
 * description (and otherwise stable shape) so the wrapDescription edge-case
 * tests can lock the description block bytes without re-stating the
 * marketplace header / plugin row scaffolding each time. Returns the body
 * lines that follow the 2-space-indented plugin row (i.e., the description
 * block + any per-kind component lines or the not-resolved marker).
 */
function pluginInfoDescriptionBlock(description: string): string[] {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description,
      componentsResolved: false,
    },
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  const lines = body.split("\n");
  // Drop the marketplace header line and the 2-space-indent plugin row;
  // return the description block + the `components: not resolved` marker.
  return lines.slice(2);
}

test("wrapDescription: empty description omits the wrap block entirely", () => {
  // Empty input -> wrapDescription returns [] -> renderer pushes no
  // description lines. The body skips straight from the plugin row to the
  // `components: not resolved` marker.
  const tail = pluginInfoDescriptionBlock("");
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("wrapDescription: short description renders as a single 4-space-indented line", () => {
  const tail = pluginInfoDescriptionBlock("Hello world.");
  assert.deepEqual(tail, ["    Hello world.", "    components: not resolved"]);
});

test("wrapDescription: text fitting exactly 66 chars on a word boundary stays on one line", () => {
  // 66 chars of text (no indent) -- last word ends at col 66 exactly.
  // 6 words of 10 chars + 5 single-space separators = 65 chars; add a
  // trailing 1-char word to hit 66 (with the leading space, +2).
  // Compose deterministically: "aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd
  // eeeeeeeeee" = 5 * 10 + 4 = 54; append " ffffffffff" (11 more) = 65;
  // append " g" (2 more) = 67 -- too long. Instead: build 66 chars from
  // 11 * 6-char words separated by single spaces.
  // 11 words of 6 chars = 66 chars; with 10 single-space separators between
  // them = 66 + 10 = 76. Too long. Use 6 words of 10 chars + 5 spaces = 65,
  // plus a single trailing char... easier: 11 chars * 6 = 66 with NO
  // spaces (single token). But a single-token of 66 chars fits.
  const text = "x".repeat(66);
  const tail = pluginInfoDescriptionBlock(text);
  assert.deepEqual(tail, [`    ${text}`, "    components: not resolved"]);
});

test("wrapDescription: long description wraps at word boundary at 66-char text width", () => {
  // Two 60-char words separated by a space -- 121 chars total; the first
  // word fits on line 1 (60 chars), the second wraps to line 2 (also 60).
  // Lock: both lines indented 4 spaces; no ellipsis; no truncation.
  const first = "a".repeat(60);
  const second = "b".repeat(60);
  const tail = pluginInfoDescriptionBlock(`${first} ${second}`);
  assert.deepEqual(tail, [`    ${first}`, `    ${second}`, "    components: not resolved"]);
});

test("wrapDescription: an over-length single word emits on its own line at indent with no ellipsis", () => {
  // INFO-02 forbids ellipsis. A 70-char single token is emitted at indent;
  // the rendered line WILL exceed the 70-char total width and that is the
  // intentional contract (no truncation).
  const word = "supercalifragilisticexpialidociousandevenlongerwithanotherwordtoexceed";
  const tail = pluginInfoDescriptionBlock(word);
  assert.deepEqual(tail, [`    ${word}`, "    components: not resolved"]);
});

test("wrapDescription: whitespace collapsed (tabs, newlines, double spaces) into single-space-separated words", () => {
  // Mixed whitespace input -> tokenized via /\s+/ -> joined with single
  // spaces. Three words ("hello", "world", "foo") fit on a single line.
  const tail = pluginInfoDescriptionBlock("  hello\t\tworld\n\nfoo  ");
  assert.deepEqual(tail, ["    hello world foo", "    components: not resolved"]);
});

test("WR-05 / wrapDescription: whitespace-only description reaches wrapDescription and returns no body lines", () => {
  // WR-05: the renderer's short-circuit at `description.length > 0` only
  // catches the empty-string case. A whitespace-only string (e.g. "   ")
  // has length > 0, so wrapDescription IS called -- it splits on /\s+/,
  // filters empty tokens, ends up with `words.length === 0`, and returns
  // []. This locks the wrapDescription empty-token-filter + empty-return
  // branch via end-to-end render: the body collapses to just the
  // marketplace header + plugin row + the components-not-resolved marker
  // (no description block).
  const tail = pluginInfoDescriptionBlock("   ");
  assert.deepEqual(tail, ["    components: not resolved"]);
});

test("WR-05 / wrapDescription: two words whose `current.length + 1 + word.length === wrapCol` stay on one line (boundary-equality)", () => {
  // WR-05: the greedy accumulator's boundary predicate is
  // `current.length + 1 + word.length <= wrapCol`. Exercise the equality
  // (<=) branch with two words whose joined length is EXACTLY 66 chars.
  // Compose: word A is 32 chars + " " (1) + word B 33 chars = 66 chars.
  // Both must end up on the same line (the predicate <= holds with =).
  const a = "a".repeat(32);
  const b = "b".repeat(33);
  assert.equal(
    a.length + 1 + b.length,
    66,
    "fixture precondition: joined width must be exactly 66",
  );
  const tail = pluginInfoDescriptionBlock(`${a} ${b}`);
  assert.deepEqual(tail, [`    ${a} ${b}`, "    components: not resolved"]);
});

test("GRAM-01 / GRAM-02: standalone {not added} row renders the two-block summary + separate detail block (marketplace subject, error severity)", () => {
  // GRAM-01: an error-severity standalone emission carries a non-empty summary
  // first line, with the detail row as its own block below (separated by
  // `\n\n`) -- never the glued single line. GRAM-02: the summary subject
  // follows the failed row -- a `marketplace-not-added` failure reads
  // "1 marketplace operation failed." The variant routes to "error" through
  // the single `isInfoKind` guard.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "1 marketplace operation failed.\n\n⊘ my-mp [user] (failed) {not added}",
    "error",
  ]);
});

test("GRAM-02: standalone failed plugin-info renders `1 plugin operation failed.` + separate multi-line detail block", () => {
  // GRAM-02: a failed `plugin-info` emission (e.g. plugin info on a
  // schema-invalid manifest) takes the PLUGIN subject. The summary is its own
  // block above the existing multi-line plugin-info body (header + indented
  // failed row + `components: not resolved`). Modelled on the catalog-uat
  // `manifest-invalid` fixture. Exactly one `ctx.ui.notify` call (IL-2).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    [
      "1 plugin operation failed.",
      "",
      "● bad-mp [user] <no autoupdate>",
      "  ⊘ bad-mp (failed) {invalid manifest}",
      "    components: not resolved",
    ].join("\n"),
    "error",
  ]);
});

test("INFO-04: {not added} row never carries a reload-hint (read-only surface)", () => {
  // TYPE-03: `shouldEmitReloadHint` routes the new `marketplace-not-added`
  // arm to `false` through the single `isInfoKind` guard. Lock that the bare
  // row does NOT carry `\n\n/reload to pick up changes`.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-not-added",
    name: "my-mp",
    scope: "user",
  };
  notify(ctx as never, pi as never, msg);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload"),
    "marketplace-not-added must NOT carry the reload-hint trailer",
  );
});

test("INFO-01: renderMarketplaceInfo (github source + ref + lastUpdated + description)", () => {
  // Full github source rendering: header + github line with #ref + last_updated
  // + single-attribute description line (NOT wrapped -- description wrapping
  // is plugin info-only per INFO-02).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    // WR-04: timestamp lives ONLY on `details.lastUpdatedAt`
    // (single source of truth -- there is no parallel top-level
    // `lastUpdated?` field). Renderer reads it from `details` on the
    // github-source arm.
    details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
    source: { sourceKind: "github", owner: "acolombo", repo: "official", ref: "main" },
    description: "The official Claude plugin marketplace.",
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: acolombo/official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  // marketplace-info routes to info severity (no failure surface on the
  // variant itself per computeSeverity).
  assert.equal(args.length, 1);
});

test("INFO-01: renderMarketplaceInfo (path source, no lastUpdated, no description)", () => {
  // Path source omits the `last_updated:` line (last_updated is github-only
  // per INFO-01) AND omits the `description:` line when description is
  // undefined. The header carries the `<no autoupdate>` marker because
  // autoupdate:false on the info surface (INFO-01: both markers emitted,
  // unlike the list surface's absence-conveys-off rule).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info",
    name: "local-mp",
    scope: "project",
    details: { autoupdate: false },
    source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 / INFO-05: renderPluginInfo (componentsResolved:true with sorted components + dependencies + wrapping description)", () => {
  // Full plugin info path: marketplace header + 2-space-indent plugin row +
  // wrapped description (4-space indent, 66-col text width) + per-kind
  // component lines (alphabetical by kind: agents, commands, mcp, skills)
  // + dependencies line last. The renderer assumes pre-sorted per-kind name
  // arrays (the orchestrator sorts at construction).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "installed",
      name: "alpha",
      version: "1.0.0",
      description: "A short description of the alpha plugin.",
      componentsResolved: true,
      components: {
        agents: ["agent-a", "agent-b"],
        commands: ["cmd-a"],
        skills: ["skill-a", "skill-b"],
        // mcp omitted -- the renderer must skip the kind when the array is
        // undefined / empty.
      },
      dependencies: ["beta@official", "gamma@official"],
    },
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● alpha v1.0.0 (installed)",
      "    A short description of the alpha plugin.",
      "    agents: agent-a, agent-b",
      "    commands: cmd-a",
      "    skills: skill-a, skill-b",
      "    dependencies: beta@official, gamma@official",
    ].join("\n"),
  );
  // status:"installed" routes to info severity.
  assert.equal(args.length, 1);
});

test("INFO-05: renderPluginInfo (componentsResolved:false emits the `components: not resolved` marker)", () => {
  // INFO-05 unresolved marker: when the plugin's plugin.json lives at an
  // unsynced external source, the renderer emits a single marker line
  // INSTEAD of per-kind component lists. No per-kind lines, no dependencies
  // line; the marker is the entire components block.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: {
      status: "available",
      name: "external",
      version: "2.0.0",
      componentsResolved: false,
    },
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ○ external v2.0.0 (available)",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

// ===========================================================================
// INFO-03 -- MarketplaceInfoCascadeMessage fan-out variant.
//
// Per-status byte tests for the 4th NotificationMessage arm. The
// fan-out wrapper carries one or more MarketplaceInfoMessage blocks; the
// renderer joins per-block bodies with `\n\n` (mirrors the cascade
// composeMarketplaceBlock `\n\n` join). Severity is ALWAYS info (no
// failure surface on the fan-out wrapper itself -- the orchestrator routes
// `{not added}` through PluginInfoMessage); reload-hint NEVER fires (info
// surface, read-only). The single-block case is byte-identical to a bare
// MarketplaceInfoMessage so the wrapper composes via reuse of
// `renderMarketplaceInfo` rather than re-implementing the per-block
// renderer (SC#4 byte-equality).
// ===========================================================================

test("INFO-03: marketplace-info-cascade with a single block byte-equals the bare marketplace-info render", () => {
  // The single-block case is the SAME byte form as the bare
  // MarketplaceInfoMessage variant -- no extra blank line, no header
  // decoration. Locks the composition discipline: the wrapper is just a
  // `renderMarketplaceInfo` map + `\n\n` join.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "Official Claude plugin marketplace.",
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-06-03T00:00:00Z",
      "description: Official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03: marketplace-info-cascade with two blocks renders project-first then user, joined by one blank line", () => {
  // The orchestrator iterates project-first per MSG-GR-3 / INFO-03; the
  // renderer honors caller-supplied order (no internal sort). Lock the
  // `\n\n` separator + project-first ordering.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● my-mp [project] <autoupdate>",
      "path: /repo/path/my-mp",
      "",
      "● my-mp [user] <no autoupdate>",
      "github: someuser/my-mp",
    ].join("\n"),
  );
});

test("INFO-03: marketplace-info-cascade severity is always info (no second arg) and no reload-hint", () => {
  // No failure can be expressed on the fan-out wrapper -- computeSeverity
  // routes the variant to undefined (info / no 2nd arg). The dispatcher
  // omits the 2nd arg accordingly. Reload-hint never fires (info surface).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !(args[0] as string).includes("/reload"),
    "info-surface marketplace-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-03 + INFO-01: single-block fan-out (github source, all optional fields) byte form", () => {
  // INFO-01 full github happy path through the new fan-out wrapper. The
  // single-block case proves the wrapper does not add any per-block
  // decoration beyond `renderMarketplaceInfo`.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "claude-plugins-official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-01T12:34:56Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "The official Claude plugin marketplace.",
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user] <autoupdate>",
      "github: anthropics/claude-plugins-official#main",
      "last_updated: 2026-05-01T12:34:56Z",
      "description: The official Claude plugin marketplace.",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-03 + INFO-01: single-block fan-out (path source, minimal) byte form omits last_updated and description", () => {
  // INFO-01 path-source arm: NO `last_updated:` (gated on github source);
  // NO `description:` when undefined. The fan-out wrapper preserves the
  // bare two-line body verbatim.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "local-mp",
        scope: "project",
        details: { autoupdate: false },
        source: { sourceKind: "path", absPath: "/home/user/projects/local-mp" },
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    ["● local-mp [project] <no autoupdate>", "path: /home/user/projects/local-mp"].join("\n"),
  );
  assert.equal(args.length, 1);
});

// ===========================================================================
// INFO-02 + INFO-03 -- PluginInfoCascadeMessage fan-out variant.
//
// Per-status byte tests for the 5th NotificationMessage arm. The
// fan-out wrapper carries one or more PluginInfoMessage blocks; the
// renderer joins per-block bodies with `\n\n` (mirrors the
// MarketplaceInfoCascadeMessage AND the install-cascade
// composeMarketplaceBlock `\n\n` join). Severity is ALWAYS info (no
// failure surface on the fan-out wrapper itself -- the orchestrator
// routes `{not added}` through PluginInfoMessage); reload-hint NEVER
// fires (info surface, read-only). The single-block case is byte-
// identical to a bare PluginInfoMessage so the wrapper composes via
// reuse of `renderPluginInfo` rather than re-implementing the per-block
// renderer (SC#4 byte-equality).
// ===========================================================================

test("INFO-02: plugin-info-cascade with a single block byte-equals the bare plugin-info render", () => {
  // The single-block case is the SAME byte form as the bare
  // PluginInfoMessage variant -- no extra blank line, no header
  // decoration. Locks the composition discipline: the wrapper is just a
  // `renderPluginInfo` map + `\n\n` join.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "foo",
          version: "1.0.0",
          componentsResolved: true,
          components: { skills: ["s1"] },
        },
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    ["● mp [user] <no autoupdate>", "  ● foo v1.0.0 (installed)", "    skills: s1"].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-02 + INFO-03: plugin-info-cascade with two blocks renders project-first then user, joined by one blank line", () => {
  // The orchestrator iterates project-first per MSG-GR-3 / INFO-03; the
  // renderer honors caller-supplied order (no internal sort). Lock the
  // `\n\n` separator + project-first ordering. Each block carries its
  // own marketplace header (mirrors install-cascade `\n\n` join).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● mp [project] <autoupdate>",
      "  ● foo v1.0.0 (installed)",
      "    skills: s1",
      "",
      "● mp [user] <no autoupdate>",
      "  ● foo v2.0.0 (installed)",
      "    agents: a1",
    ].join("\n"),
  );
});

test("INFO-02: plugin-info-cascade severity is always info (no second arg) and no reload-hint", () => {
  // No failure can be expressed on the fan-out wrapper -- computeSeverity
  // routes the variant to undefined (info / no 2nd arg). The dispatcher
  // omits the 2nd arg accordingly. Reload-hint never fires (info surface).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1, "info severity must omit the 2nd arg");
  assert.ok(
    !(args[0] as string).includes("/reload"),
    "info-surface plugin-info-cascade must NOT carry the reload-hint trailer",
  );
});

test("INFO-02: plugin-info-cascade single block installed with resolved components + dependencies renders full INFO-02 happy path", () => {
  // INFO-02 happy path through the new fan-out wrapper: marketplace
  // header at column 0; plugin row at 2-space indent (status glyph +
  // name + version + (status)); description wrapped at col 4 / 66; the
  // per-kind component lines at 4-space indent in `agents, commands,
  // mcp, skills` order (COMPONENT_KINDS tuple); the `dependencies:`
  // line LAST. Severity info; no reload-hint.
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "official",
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
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● official [user] <autoupdate>",
      "  ● commit-commands v1.2.0 (installed)",
      "    Helpful git commit commands for everyday use.",
      "    agents: review-bot",
      "    commands: c1, c2",
      "    skills: commit-summary",
      "    dependencies: helper@utils-mp",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test("INFO-05: plugin-info-cascade single block components-not-resolved emits the marker line at col 4", () => {
  // INFO-05 through the new fan-out wrapper: an external-source plugin
  // surfaces the marker line `    components: not resolved` at 4-space
  // indent in place of the per-kind component lists. The orchestrator
  // deliberately does NOT fetch external sources (NFR-5 preserved).
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "plugin-info-cascade",
    blocks: [
      {
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
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(
    args[0],
    [
      "● remote-mp [user] <no autoupdate>",
      "  ● remote-plugin v1.0.0 (installed)",
      "    Remote plugin sourced from an external npm package.",
      "    components: not resolved",
    ].join("\n"),
  );
  assert.equal(args.length, 1);
});

test('Migration Strategy #2: cascade payload WITHOUT `kind` field byte-equals payload WITH `kind: "cascade"`', () => {
  // The dispatcher uses `message.kind ?? \"cascade\"` so call sites
  // that omit `kind` continue to route through the cascade arm
  // byte-identically. Lock the equivalence end-to-end: invoke notify() with
  // both shapes and assert byte equality.
  const ctxNoKind = makeCtx();
  const ctxWithKind = makeCtx();
  const pi = piWithBothLoaded();
  const noKindMsg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "installed", name: "alpha", version: "1.0.0", dependencies: [] }],
      },
    ],
  };
  const withKindMsg: NotificationMessage = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "installed", name: "alpha", version: "1.0.0", dependencies: [] }],
      },
    ],
  };
  notify(ctxNoKind as never, pi as never, noKindMsg);
  notify(ctxWithKind as never, pi as never, withKindMsg);
  const noKindArgs = ctxNoKind.ui.notify.mock.calls[0]!.arguments;
  const withKindArgs = ctxWithKind.ui.notify.mock.calls[0]!.arguments;
  assert.deepEqual(
    noKindArgs,
    withKindArgs,
    'Optional kind?:"cascade" must produce byte-identical notify() output to omitted kind',
  );
});

// ===========================================================================
// DIFF-02 -- pending-tense `(will *)` preview rows.
//
// Six new tokens (4 plugin + 2 marketplace) emitted by `/claude:plugin preview`.
// All are info-severity (no failure / skipped / manual-recovery semantics) so
// the 2nd `ctx.ui.notify` arg is omitted. None are in shouldEmitReloadHint's
// trigger set, so no `/reload to pick up changes` trailer is appended.
// ===========================================================================

test("DIFF-02: will-add marketplace header + will-install plugin child (orphan-fold suppresses [scope])", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        status: "will add",
        plugins: [{ status: "will install", name: "alpha" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  // info severity -> single-arg notify
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● new-mp [user] (will add)\n  ● alpha (will install)`);
});

test("DIFF-02: will-remove marketplace header (open circle, no plugin children)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "old-mp",
        scope: "project",
        status: "will remove",
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `○ old-mp [project] (will remove)`);
});

test("DIFF-02: will-uninstall plugin under existing (no-status) marketplace block", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [{ status: "will uninstall", name: "old-plugin" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ○ old-plugin (will uninstall)`);
});

test("DIFF-02: will-enable + will-disable rows under same marketplace", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
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
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● mp [user]\n  ● to-enable (will enable)\n  ⊘ to-disable (will disable)`);
});

test("DIFF-02: cross-scope orphan-fold -- plugin scope differs from marketplace scope -> [scope] bracket renders", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "project",
        status: "will add",
        plugins: [
          // Plugin's scope explicitly differs from marketplace -> bracket emits.
          { status: "will install", name: "alpha", scope: "user" },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [project] (will add)\n  ● alpha [user] (will install)`);
});

test("DIFF-02: will-* cascade emits NO /reload to pick up changes trailer (preview rows are pre-transition)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        status: "will add",
        plugins: [
          { status: "will install", name: "a" },
          { status: "will uninstall", name: "b" },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !emitted.includes("/reload to pick up changes"),
    "preview rows MUST NOT emit the reload-hint trailer",
  );
});

test("DIFF-02: will-* cascade computes info severity (no second arg to ctx.ui.notify)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        status: "will remove",
        plugins: [{ status: "will uninstall", name: "p" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  // info severity routing: emitWithSummary omits the 2nd arg entirely.
  assert.equal(args.length, 1);
});

// ===========================================================================
// D-54-01 / ENBL-04: (disabled) inventory row + (already
// enabled) / (already disabled) skip rows. The new closed-set token + REASONS
// members land in lockstep with the catalog/UAT byte-equality runner.
// ===========================================================================

test("D-54-01: (disabled) inventory row renders subject-first with version under list-arm marketplace (info severity, no /reload)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        details: { autoupdate: true },
        plugins: [{ status: "disabled", name: "foo-plugin", version: "1.2.3" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  // info severity -> no 2nd arg.
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user] <autoupdate>\n  ⊘ foo-plugin v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row without version omits the v<version> slot cleanly", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ⊘ foo-plugin (disabled)`);
});

test("D-54-01: (disabled) inventory row with orphan-fold scope bracket -- explicit p.scope differs from mp.scope", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "shared",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin", version: "1.2.3", scope: "project" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● shared [user]\n  ⊘ foo-plugin [project] v1.2.3 (disabled)`);
});

test("D-54-01: (disabled) inventory row WITHOUT orphan-fold -- p.scope matches mp.scope -> no row bracket", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin", version: "1.2.3", scope: "user" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(args[0], `● official [user]\n  ⊘ foo-plugin v1.2.3 (disabled)`);
});

test("UAT-03: (disabled) row on a `disable-cascade`-kind cascade DOES emit the /reload trailer (realized transition; byte-identical row form)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // The /claude:plugin disable command's fresh cascade: the orchestrator
  // dispatches with the `disable-cascade` kind so the `(disabled)` row
  // counts as a state-change transition in shouldEmitReloadHint (artefacts
  // were unstaged -- SNM-33). The row itself renders byte-identically to
  // the kind-less inventory form asserted above; ONLY the trailer differs.
  const msg: NotificationMessage = {
    kind: "disable-cascade",
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [{ status: "disabled", name: "foo-plugin", version: "1.2.3" }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  // info severity -> no 2nd arg (a fresh disable is the user-requested
  // state, not a failure).
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    [
      "● claude-plugins-official [user]",
      "  ⊘ foo-plugin v1.2.3 (disabled)",
      "",
      "/reload to pick up changes",
    ].join("\n"),
  );
});

test("UAT-03: `disable-cascade` kind WITHOUT a (disabled) row stays trailer-free for non-trigger rows (kind alone is not a trigger)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // The disable verb's idempotent arm also carries the kind (a no-op for
  // the hint ladder): a (skipped) {already disabled} row must NOT emit the
  // trailer -- the kind only promotes `(disabled)` rows, it is not a
  // blanket trigger.
  const msg: NotificationMessage = {
    kind: "disable-cascade",
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [{ status: "skipped", name: "foo-plugin", reasons: ["already disabled"] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already disabled}`,
  );
});

test("D-54-01 / ENBL idempotency: (skipped) {already enabled} row routes to info severity (benign reason)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "foo-plugin",
            reasons: ["already enabled"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  // benign reason -> info severity (no 2nd arg).
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already enabled}`,
  );
});

test("D-54-01 / ENBL idempotency: (skipped) {already disabled} row routes to info severity (benign reason)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "foo-plugin",
            reasons: ["already disabled"],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ⊘ foo-plugin (skipped) {already disabled}`,
  );
});

test("D-54-01: enable cascade (installed plugin row under added mp header) emits /reload trailer", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "foo-plugin",
            version: "1.2.3",
            dependencies: [],
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user] (added)\n  ● foo-plugin v1.2.3 (installed)\n\n/reload to pick up changes`,
  );
});

test("D-54-01: disable cascade (uninstalled plugin row under list-arm mp) emits /reload trailer", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            name: "foo-plugin",
            version: "1.2.3",
          },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● claude-plugins-official [user]\n  ○ foo-plugin v1.2.3 (uninstalled)\n\n/reload to pick up changes`,
  );
});

// ===========================================================================
// RECON-04 -- reconcile-applied-cascade standalone
// variant.
//
// Three catalog states:
//   (a) success cascade with mixed mp add + plugin install across both scopes
//   (b) soft-fail per-entry: one failed mp row + one successful install row
//   (c) CFG-03 invalid-config row carrying ONLY the basename
//
// Load-bearing invariants:
//   - Realized transition tokens (`added` / `installed` / `uninstalled` /
//     `disabled` / `failed`) reused from PLUGIN_STATUSES / MARKETPLACE_STATUSES;
//     no new closed-set members.
//   - `/reload to pick up changes` trailer is NEVER emitted even
//     though the rows would otherwise trigger it on the cascade arm.
// ===========================================================================

test("RECON-04: success cascade -- mixed marketplace add + plugin install across both scopes, project-first ordering", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "project",
        status: "added",
        plugins: [{ status: "installed", name: "new-plugin", dependencies: [] }],
      },
      {
        name: "other-mp",
        scope: "user",
        status: "added",
        plugins: [{ status: "installed", name: "other-plugin", dependencies: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  // info severity -> single-arg notify (no second arg).
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 1);
  assert.equal(
    args[0],
    `● new-mp [project] (added)\n  ● new-plugin (installed)\n\n● other-mp [user] (added)\n  ● other-plugin (installed)`,
  );
});

test("RECON-04: success cascade NEVER emits `/reload to pick up changes` trailer", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "new-mp",
        scope: "user",
        status: "added",
        plugins: [
          { status: "installed", name: "a", dependencies: [] },
          { status: "uninstalled", name: "b" },
        ],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !emitted.includes("/reload to pick up changes"),
    "RECON-04: reconcile-applied-cascade MUST NOT emit the reload-hint trailer (the reconcile already ran ON /reload)",
  );
});

test("RECON-04: soft-fail per-entry -- failed mp row mixed with successful install row routes to error + summary prepended", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "flaky-mp",
        scope: "user",
        status: "failed",
        reasons: ["network unreachable"],
        plugins: [],
      },
      {
        name: "ok-mp",
        scope: "user",
        status: "added",
        plugins: [{ status: "installed", name: "ok-plugin", dependencies: [] }],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `1 marketplace operation failed.\n\n⊘ flaky-mp [user] (failed) {network unreachable}\n\n● ok-mp [user] (added)\n  ● ok-plugin (installed)`,
  );
});

test("RECON-04: CFG-03 invalid-config row carries BASENAME only (T-55-02-01 information-disclosure mitigation)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "claude-plugins.json",
        scope: "project",
        status: "failed",
        reasons: ["invalid manifest"],
        plugins: [],
      },
    ],
  };
  notify(ctx as never, pi as never, msg);
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  assert.equal(
    args[0],
    `1 marketplace operation failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}`,
  );
});
