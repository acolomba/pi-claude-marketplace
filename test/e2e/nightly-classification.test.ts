import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyNightlyFailure } from "./_helpers.ts";

test("nightly classifier treats failing non-empty snapshot diff as upstream change", () => {
  assert.equal(
    classifyNightlyFailure({ failed: true, snapshotDiff: "changed" }),
    "upstream-change",
  );
});

test("nightly classifier treats failing empty snapshot diff as regression", () => {
  assert.equal(classifyNightlyFailure({ failed: true, snapshotDiff: "" }), "regression");
});

test("nightly classifier treats passing run as pass", () => {
  assert.equal(classifyNightlyFailure({ failed: false, snapshotDiff: "changed" }), "pass");
});
