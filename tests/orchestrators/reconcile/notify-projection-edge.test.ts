/**
 * tests/orchestrators/reconcile/notify-projection-edge.test.ts -- edge and
 * defensive-arm coverage for the `buildReconcileAppliedCascade` projection
 * (DIFF-02) that the realized-transition stamp tests
 * (`notify-stamp-coverage.test.ts`) do not exercise:
 *
 *   - the `mp-remove-partial` arm (I1 / PR #51): a bare `(failed)` marketplace
 *     header with NO mp-level `reasons` brace (the per-plugin children carry the
 *     granular reasons);
 *   - the `reasonAsContent` `"not added"` defensive fallback: the structural
 *     marketplace-absent marker is unreachable from the planner-driven apply
 *     pass, but the projection maps it to `"not found"` rather than crashing;
 *   - the `assertNever` exhaustiveness guard on an out-of-set outcome kind.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildReconcileAppliedCascade } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";

test("I1: mp-remove-partial projects a bare (failed) marketplace header with no mp-level reasons", () => {
  const msg = buildReconcileAppliedCascade([
    { kind: "mp-remove-partial", scope: "user", marketplace: "partial-mp" },
  ]);

  assert.equal(msg.marketplaces.length, 1);
  const block = msg.marketplaces[0]!;
  assert.equal(block.status, "failed");
  // The bare `(failed)` header carries no reasons brace -- the children own the
  // granular reasons (none in this minimal fixture).
  assert.equal(block.reasons, undefined);
});

test("reasonAsContent: the structural 'not added' marker falls back to 'not found' rather than crashing", () => {
  const msg = buildReconcileAppliedCascade([
    { kind: "mp-remove-failed", scope: "user", marketplace: "absent-mp", reason: "not added" },
  ]);

  const block = msg.marketplaces[0]!;
  assert.equal(block.status, "failed");
  // The defensive fallback maps the structural `"not added"` sentinel to the
  // closed-set `"not found"` ContentReason so the projection never crashes.
  assert.deepEqual(block.reasons, ["not found"]);
});

test("DIFF-02: an out-of-set outcome kind trips the assertNever exhaustiveness guard", () => {
  // Force the projection's default arm with a kind outside the closed
  // PerEntryOutcome union; the `assertNever(outcome)` tail must throw.
  const bogus = {
    kind: "totally-bogus-kind",
    scope: "user",
    marketplace: "x",
  } as unknown as PerEntryOutcome;
  assert.throws(() => buildReconcileAppliedCascade([bogus]));
});
