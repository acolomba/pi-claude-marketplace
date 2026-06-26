/**
 * tests/architecture/notify-producer-wire-coverage.test.ts -- WR-01 / D-05
 * producer -> reducer -> wire backstop for the render-map (standalone)
 * producers.
 *
 * The catalog-uat forward walk drives `notify()` / `notifyWithContext()` with
 * hand-written FIXTURE payloads whose `severity` / `needsReload` stamps are
 * authored independently of what the orchestrators actually stamp. It proves
 * the REDUCER renders byte-correctly given correctly-stamped input, and
 * `notify-stamp-coverage.test.ts` covers the two reconcile PROJECTIONS. But no
 * gate binds the per-arm RENDER-MAP producer stamps to the wire: a producer
 * that regressed a realized install row to `needsReload:false`, or a failed row
 * to `severity:"warning"`, would still type-check (the fields are present on the
 * broad union) and would NOT be caught by catalog-uat (which never invokes the
 * orchestrator).
 *
 * This is the WR-01 backstop, the render-map analogue of
 * `notify-stamp-coverage.test.ts`: it routes a representative stamped row for
 * each STANDALONE orchestrator arm through the REAL `notifyWithContext` wire
 * seam (`emitContextCascade` -> `emitWithSummary` -> `computeSeverity` /
 * `shouldEmitReloadHint` -> the single mock `ctx.ui.notify`) and asserts the
 * emitted 2nd-arg severity AND the presence/absence of the
 * `/reload to pick up changes` trailer. It asserts the producer -> reducer ->
 * wire path, not just the reducer:
 *
 *   - install / uninstall / update / reinstall / enable / disable SUCCESS rows
 *     stamp `severity:"info"`, `needsReload:true`  -> info wire (no 2nd arg),
 *     trailer PRESENT.
 *   - a benign idempotent skip (enable `already enabled`) stamps
 *     `severity:"info"`, `needsReload:false`       -> info wire, trailer ABSENT.
 *   - a failure row stamps `severity:"error"`, `needsReload:false`
 *                                                  -> error wire, trailer ABSENT.
 *
 * The stamped values mirror the producer sites EXACTLY (install.ts:1359,
 * uninstall.ts:625, update.ts:1525, reinstall.ts:288, enable-disable.ts:982,
 * enable-disable.ts:930, install.ts:1512). Regressing any of those stamps trips
 * this test with an arm-named diagnostic.
 *
 * This test changes NO rendered output: it asserts the wire severity + trailer,
 * never the byte body, so it is orthogonal to the catalog-uat byte contract.
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { INSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { REINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { UNINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import { notifyWithContext } from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";

import type { PluginNotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Mock helpers -- mirror the notify-grammar-invariant / catalog-uat harness
// (makeCtx + piWithBothLoaded). The probe reports both companion extensions
// loaded so no soft-dep markers append (irrelevant to the severity/trailer
// assertions, but keeps the wire input clean).
// ---------------------------------------------------------------------------

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

function piWithBothLoaded(): { getAllTools: () => { name?: string }[] } {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

const RELOAD_TRAILER = "/reload to pick up changes";

// ---------------------------------------------------------------------------
// Per-arm fixtures. Each carries the EXACT producer-stamped row plus its OWN
// CommandContext, and the wire facts that row must reduce to. The row is the
// minimal shape the producer emits for that arm (the byte body is the catalog's
// job; here only the stamped severity/needsReload are load-bearing).
// ---------------------------------------------------------------------------

interface WireFixture {
  readonly label: string;
  // The producer's OWN exported context. Each context is generic over its own
  // Status/Msg, so the field is held as `unknown` and upcast once at the
  // `notifyWithContext` call site -- the dispatch arm is selected by
  // `row.status`, exactly as the orchestrator's own emission does.
  readonly context: unknown;
  readonly row: PluginNotificationMessage;
  // undefined = info wire (no 2nd ctx.ui.notify arg).
  readonly expectedSeverity: "warning" | "error" | undefined;
  readonly expectTrailer: boolean;
}

// SUCCESS arms: every realized standalone transition stamps
// severity:"info" + needsReload:true (install.ts:1359, uninstall.ts:625,
// update.ts:1525, reinstall.ts:288, enable-disable.ts:982 enable + disable).
const FIXTURES: readonly WireFixture[] = [
  {
    label: "install success (installed transition)",
    context: INSTALL_CONTEXT,
    row: {
      status: "installed",
      name: "new-plugin",
      dependencies: [],
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  {
    label: "uninstall success (uninstalled transition)",
    context: UNINSTALL_CONTEXT,
    row: {
      status: "uninstalled",
      name: "gone-plugin",
      version: "0.9.0",
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  {
    label: "update success (updated transition)",
    context: UPDATE_CONTEXT,
    row: {
      status: "updated",
      name: "delta-plugin",
      from: "1.0.0",
      to: "1.1.0",
      dependencies: [],
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  {
    label: "reinstall success (reinstalled transition)",
    context: REINSTALL_CONTEXT,
    row: {
      status: "reinstalled",
      name: "redo-plugin",
      dependencies: [],
      version: "2.0.0",
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  {
    label: "enable success (fresh re-materialized installed transition)",
    context: ENABLE_CONTEXT,
    row: {
      status: "installed",
      name: "rewoken-plugin",
      dependencies: [],
      version: "2.1.0",
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  {
    label: "disable success (fresh disabled transition)",
    context: DISABLE_CONTEXT,
    row: {
      status: "disabled",
      name: "muted-plugin",
      version: "3.0.0",
      severity: "info",
      needsReload: true,
    },
    expectedSeverity: undefined,
    expectTrailer: true,
  },
  // BENIGN SKIP: an idempotent `already enabled` skip is info, no reload
  // (enable-disable.ts:930). Distinct from an actionable skip (warning).
  {
    label: "benign idempotent skip (enable already-enabled)",
    context: ENABLE_CONTEXT,
    row: {
      status: "skipped",
      name: "settled-plugin",
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    },
    expectedSeverity: undefined,
    expectTrailer: false,
  },
  // FAILURE: a failed install stamps error, no reload (install.ts:1512).
  {
    label: "failure row (failed install)",
    context: INSTALL_CONTEXT,
    row: {
      status: "failed",
      name: "broken-plugin",
      reasons: [],
      scope: "user",
      cause: new Error("network unreachable"),
      severity: "error",
      needsReload: false,
    },
    expectedSeverity: "error",
    expectTrailer: false,
  },
  // D-01 absent-target: reinstall of a not-installed plugin stamps error
  // directly (was `skipSeverity` -> warning) on a `skipped` row carrying
  // `not installed`; no reload (nothing changed).
  {
    label: "absent-target skip (reinstall not-installed)",
    context: REINSTALL_CONTEXT,
    row: {
      status: "skipped",
      name: "missing-plugin",
      reasons: ["not installed"],
      severity: "error",
      needsReload: false,
    },
    expectedSeverity: "error",
    expectTrailer: false,
  },
  // D-01 absent-target: update of a not-installed plugin stamps error directly
  // (was `skipSeverity` -> warning); no reload.
  {
    label: "absent-target skip (update not-installed)",
    context: UPDATE_CONTEXT,
    row: {
      status: "skipped",
      name: "missing-plugin",
      reasons: ["not installed"],
      severity: "error",
      needsReload: false,
    },
    expectedSeverity: "error",
    expectTrailer: false,
  },
  // D-01 / PU-5: standalone uninstall of an already-gone (not-installed) plugin
  // emits an error `failed` row (was literal silence); no reload. uninstall's
  // render map renders `uninstalled` / `failed` only, so the absent target is a
  // `failed` row. The orchestrated reconcile converge stays silent and is not
  // exercised here.
  {
    label: "absent-target failure (uninstall PU-5 already-gone)",
    context: UNINSTALL_CONTEXT,
    row: {
      status: "failed",
      name: "helper",
      reasons: ["not installed"],
      severity: "error",
      needsReload: false,
    },
    expectedSeverity: "error",
    expectTrailer: false,
  },
];

test("WR-01/D-05: every standalone render-map arm reduces its producer-stamped row to the correct wire severity + reload trailer", () => {
  for (const fixture of FIXTURES) {
    const ctx = makeCtx();
    notifyWithContext(ctx as never, piWithBothLoaded() as never, fixture.context as never, [
      { name: "official", scope: "user", plugins: [fixture.row] as never },
    ]);

    // IL-2: exactly one ctx.ui.notify call per orchestration arm.
    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `${fixture.label}: must call ctx.ui.notify exactly once (IL-2)`,
    );

    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const emittedSeverity = args[1];

    // SEV-02: the wire severity is the MAX-reduce of the stamped row.severity.
    // info reduces to the omitted 2nd arg; warning/error pass it through.
    assert.equal(
      emittedSeverity,
      fixture.expectedSeverity,
      `${fixture.label}: expected wire severity ${String(fixture.expectedSeverity)}, got ${String(emittedSeverity)}`,
    );

    // RLD-02: the trailer fires iff the OR-reduce of the stamped
    // row.needsReload is true.
    const hasTrailer = args[0].includes(RELOAD_TRAILER);
    assert.equal(
      hasTrailer,
      fixture.expectTrailer,
      `${fixture.label}: reload trailer presence must be ${String(fixture.expectTrailer)} (RLD-02 OR-reduce of needsReload)`,
    );
  }
});
