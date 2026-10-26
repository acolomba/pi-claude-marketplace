// Unit test for the shared PreCompact/PostCompact trigger classification
// (PAYL-01 / D-60-04).

import assert from "node:assert/strict";
import test from "node:test";

import { compactTrigger } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/payloads/compact-trigger.ts";

const cases: readonly {
  readonly reason: "manual" | "threshold" | "overflow";
  readonly trigger: "manual" | "auto";
}[] = [
  { reason: "manual", trigger: "manual" },
  { reason: "threshold", trigger: "auto" },
  { reason: "overflow", trigger: "auto" },
];

for (const { reason, trigger } of cases) {
  test(`compactTrigger maps reason "${reason}" to trigger "${trigger}"`, () => {
    // act
    const actualTrigger = compactTrigger(reason);

    // assert
    assert.strictEqual(actualTrigger, trigger);
  });
}
