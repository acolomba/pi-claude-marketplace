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
 *     pass, but the projection maps it to `"not found"` rather than crashing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildReconcileAppliedCascade } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

test("I1: mp-remove-partial projects a bare (failed) marketplace header with no mp-level reasons", () => {
  // arrange
  const outcomes = [
    { kind: "mp-remove-partial", scope: "user", marketplace: "partial-mp" },
  ] as const;

  // act
  const message = buildReconcileAppliedCascade(outcomes);

  // assert
  assert.deepEqual(message, {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "partial-mp",
        plugins: [],
        scope: "user",
        severity: "error",
        status: "failed",
      },
    ],
  });
});

test("reasonAsContent: the structural 'not added' marker falls back to 'not found' rather than crashing", () => {
  // arrange
  const outcomes = [
    { kind: "mp-remove-failed", scope: "user", marketplace: "absent-mp", reason: "not added" },
  ] as const;

  // act
  const message = buildReconcileAppliedCascade(outcomes);

  // assert
  assert.deepEqual(message, {
    kind: "reconcile-applied-cascade",
    marketplaces: [
      {
        name: "absent-mp",
        plugins: [],
        reasons: ["not found"],
        scope: "user",
        severity: "error",
        status: "failed",
      },
    ],
  });
});
