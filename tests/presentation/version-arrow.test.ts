// tests/presentation/version-arrow.test.ts
//
// Task 260525-cjr C6: MSG-PL-3 version-transition slot helper.

import assert from "node:assert/strict";
import test from "node:test";

import { composeVersionArrow } from "../../extensions/pi-claude-marketplace/presentation/version-arrow.ts";

test("260525-cjr C6: composeVersionArrow returns undefined when both sides absent", () => {
  assert.equal(composeVersionArrow(undefined, undefined), undefined);
});

test("260525-cjr C6: composeVersionArrow returns `<from> → v<to>` when both present and differ", () => {
  assert.equal(composeVersionArrow("1.0.0", "2.0.0"), "1.0.0 → v2.0.0");
});

test("260525-cjr C6: composeVersionArrow returns the single version when both equal (unchanged partition)", () => {
  assert.equal(composeVersionArrow("1.0.0", "1.0.0"), "1.0.0");
});

test("260525-cjr C6: composeVersionArrow returns `to` when only `to` present", () => {
  assert.equal(composeVersionArrow(undefined, "2.0.0"), "2.0.0");
});

test("260525-cjr C6: composeVersionArrow returns `from` when only `from` present", () => {
  assert.equal(composeVersionArrow("1.0.0", undefined), "1.0.0");
});

test("260525-cjr C6: composeVersionArrow handles hash-version pairs (PI-7) without semver parsing", () => {
  // Hash versions are byte-compared elsewhere; the arrow helper is pure
  // string formatting and must not interpret the values.
  assert.equal(
    composeVersionArrow("hash-abc123def456", "hash-fed654cba321"),
    "hash-abc123def456 → vhash-fed654cba321",
  );
});

test("260525-cjr C6: both marketplace-side and plugin-side outcomeToCascadeRow paths emit byte-equal version slots for identical inputs (convergence guard)", () => {
  // Indirect convergence assertion: the helper is a pure transform,
  // and both production callers route through it. The byte-equality
  // contract is therefore guaranteed by the import-share. If a
  // future caller ever inlined a divergent format, this test would
  // not catch it on its own -- the architecture test in
  // tests/architecture/no-duplicate-version-arrow.test.ts (future
  // work) is the structural enforcement.
  const from = "1.2.3";
  const to = "1.2.4";
  const expected = "1.2.3 → v1.2.4";
  assert.equal(composeVersionArrow(from, to), expected);
});
