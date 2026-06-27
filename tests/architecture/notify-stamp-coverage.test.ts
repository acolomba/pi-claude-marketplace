/**
 * tests/architecture/notify-stamp-coverage.test.ts -- GATE-01 / D-05
 * runtime-introspection backstop for the reconcile projection.
 *
 * GATE-01 is enforced primarily at the type level (D-04): the five transition
 * message arms narrow `severity` + `needsReload` to required, so a producer
 * that constructs a transition literal omitting either is a TS2741 compile
 * error AT THE CONSTRUCTION SITE. That gate reaches every render-map producer.
 *
 * It does NOT reach the one producer family that builds rows by PROJECTION
 * rather than through a command render map: `orchestrators/reconcile/notify.ts`.
 * `buildReconcileAppliedCascade` and `buildReconcilePendingNotification` push
 * plugin rows directly into a widening `MarketplaceBlock` accumulator
 * (`plugins: PluginNotificationMessage[]`), so the call-site literal is checked
 * against the broad union -- where the two fields are optional -- not against a
 * narrowed transition arm. The type system cannot force the stamp there.
 *
 * This is the D-05 dynamic-case backstop: drive BOTH reconcile projections with
 * representative outcomes and assert that every REALIZED-TRANSITION plugin row
 * (`installed` / `updated` / `reinstalled` / `uninstalled` / `disabled`) carries
 * BOTH `severity` and `needsReload`, with the D-06 reload semantics:
 *
 *   - realized transition rows  -> needsReload === true
 *   - failed rows               -> severity === "error", needsReload === false
 *
 * Stripping either field from a transition push in the projection trips this
 * test with a row-level diagnostic naming the offending status.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
} from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type {
  CascadeNotificationMessage,
  PluginStatus,
  ReconcileAppliedCascadeMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// D-06 realized-transition status set. A plugin row whose status is one of
// these represents a successful state change and MUST stamp both fields
// (severity present + needsReload:true). The `satisfies readonly
// PluginStatus[]` pin keeps the set honest: renaming or removing any of these
// tokens from PLUGIN_STATUSES is a compile error here, so the set can never
// silently drift out of lockstep with the source of truth.
// ---------------------------------------------------------------------------

const TRANSITION_STATUS_LIST = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "disabled",
  // FSTAT-02 / D-66-04: the install/update success cascade emits
  // `force-installed` as a realized transition (severity "info" + needsReload
  // true, identical to `installed`), so it joins the stamp-coverage set.
  // `force-upgradable` is deliberately EXCLUDED -- it is a list-inventory-only
  // row (needsReload false), never a realized transition.
  "force-installed",
] as const satisfies readonly PluginStatus[];

const TRANSITION_STATUSES: ReadonlySet<PluginStatus> = new Set(TRANSITION_STATUS_LIST);

// ---------------------------------------------------------------------------
// Representative apply-time outcomes: one per realized-transition kind the
// projection emits (install, uninstall, enable->installed, disable), one per
// failed arm, plus a non-transition inventory-style outcome (mp-added carries
// no plugin row -- exercises the "no transition row to stamp" path).
// ---------------------------------------------------------------------------

const APPLIED_OUTCOMES: readonly PerEntryOutcome[] = [
  { kind: "mp-added", scope: "user", marketplace: "fresh-mp" },
  {
    kind: "plugin-installed",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "new-plugin",
    version: "1.0.0",
    dependencies: [],
  },
  {
    kind: "plugin-uninstalled",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "gone-plugin",
    version: "0.9.0",
  },
  {
    // A realized enable re-materializes the plugin -> emits an `installed` row.
    kind: "plugin-enabled",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "rewoken-plugin",
    version: "2.1.0",
  },
  {
    kind: "plugin-disabled",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "muted-plugin",
    version: "3.0.0",
  },
  {
    kind: "plugin-install-failed",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "broken-plugin",
    reason: "network unreachable",
  },
  {
    kind: "plugin-uninstall-failed",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "stuck-plugin",
    reason: "permission denied",
  },
  {
    kind: "plugin-enable-failed",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "wedged-plugin",
    reason: "invalid manifest",
  },
  {
    kind: "plugin-disable-failed",
    scope: "user",
    marketplace: "fresh-mp",
    plugin: "pinned-plugin",
    reason: "permission denied",
  },
];

// ---------------------------------------------------------------------------
// A representative pending plan: the pending projection only ever emits the
// pending-tense `will *` tokens (none of which are realized transitions) plus
// a source-mismatch `failed` child. Driving it proves the projection emits no
// UNSTAMPED transition row by walking the same invariant -- and exercises the
// second exported projection per the D-05 belt-and-suspenders scope.
// ---------------------------------------------------------------------------

const PENDING_PLAN: ReconcilePlan = {
  scope: "user",
  marketplacesToAdd: [
    { scope: "user", marketplace: "pending-mp", source: "owner/repo", configSource: "base" },
  ],
  marketplacesToRemove: [],
  pluginsToInstall: [
    { scope: "user", marketplace: "pending-mp", plugin: "soon-plugin", configSource: "base" },
  ],
  pluginsToUninstall: [{ scope: "user", marketplace: "pending-mp", plugin: "doomed-plugin" }],
  pluginsToEnable: [{ scope: "user", marketplace: "pending-mp", plugin: "wakeable-plugin" }],
  pluginsToDisable: [{ scope: "user", marketplace: "pending-mp", plugin: "sleepable-plugin" }],
  sourceMismatches: [],
};

// ---------------------------------------------------------------------------
// Shared row walk: assert the stamp invariant over a projection's
// marketplaces[].plugins[]. Returns the count of transition rows seen so a
// test can additionally assert the sample actually exercised the path.
// ---------------------------------------------------------------------------

function assertTransitionRowsStamped(
  msg: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  label: string,
): number {
  let transitionRows = 0;
  for (const mp of msg.marketplaces) {
    for (const p of mp.plugins) {
      if (!TRANSITION_STATUSES.has(p.status)) {
        continue;
      }

      transitionRows += 1;
      assert.notEqual(
        p.severity,
        undefined,
        `${label}: '${p.status}' transition row for '${p.name}' must stamp severity (D-05/D-04)`,
      );
      assert.equal(
        typeof p.needsReload,
        "boolean",
        `${label}: '${p.status}' transition row for '${p.name}' must stamp needsReload (D-05/D-04)`,
      );
      // D-06: a realized transition reloads.
      assert.equal(
        p.needsReload,
        true,
        `${label}: '${p.status}' transition row for '${p.name}' must stamp needsReload:true (D-06)`,
      );
    }
  }

  return transitionRows;
}

test("GATE-01/D-05: reconcile-applied projection stamps both fields on every realized-transition row", () => {
  const msg = buildReconcileAppliedCascade(APPLIED_OUTCOMES);
  const transitionRows = assertTransitionRowsStamped(msg, "buildReconcileAppliedCascade");
  // The applied sample drives install + uninstall + enable->installed + disable
  // = at least four realized-transition rows; guard against a sample that
  // silently stops exercising the stamped path.
  assert.ok(
    transitionRows >= 4,
    `expected the applied sample to exercise >= 4 transition rows, saw ${transitionRows}`,
  );
});

test("GATE-01/D-06: reconcile-applied projection stamps failed rows severity:error needsReload:false", () => {
  const msg = buildReconcileAppliedCascade(APPLIED_OUTCOMES);
  let failedRows = 0;
  for (const mp of msg.marketplaces) {
    for (const p of mp.plugins) {
      if (p.status !== "failed") {
        continue;
      }

      failedRows += 1;
      assert.equal(
        p.severity,
        "error",
        `failed row for '${p.name}' must stamp severity:"error" (D-03)`,
      );
      assert.equal(
        p.needsReload,
        false,
        `failed row for '${p.name}' must stamp needsReload:false (D-06)`,
      );
    }
  }

  // The four *-failed outcomes each emit a failed plugin row.
  assert.ok(
    failedRows >= 4,
    `expected the applied sample to exercise >= 4 failed rows, saw ${failedRows}`,
  );
});

test("GATE-01/D-05: reconcile-pending projection emits no unstamped transition row", () => {
  const msg = buildReconcilePendingNotification([PENDING_PLAN]);
  // The pending projection emits only pending-tense `will *` tokens (no
  // realized transitions), so the invariant holds vacuously -- but driving it
  // proves the second exported projection cannot regress into emitting an
  // unstamped transition row.
  const transitionRows = assertTransitionRowsStamped(msg, "buildReconcilePendingNotification");
  assert.equal(
    transitionRows,
    0,
    "the pending projection must not emit realized-transition rows (only will-* tokens)",
  );
});
