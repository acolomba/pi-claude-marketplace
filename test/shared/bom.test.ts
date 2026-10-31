import assert from "node:assert/strict";
import test from "node:test";

import { stripBom } from "../../extensions/pi-claude-marketplace/shared/bom.ts";

test("removes a single leading byte-order mark", () => {
  // arrange
  const markedSource = "\uFEFF---\nname: reviewer\n---\nBody.\n";

  // act
  const strippedSource = stripBom(markedSource);

  // assert
  assert.strictEqual(strippedSource, "---\nname: reviewer\n---\nBody.\n");
});

test("returns unmarked text unchanged", () => {
  // arrange
  const plainSource = "---\nname: reviewer\n---\nBody.\n";

  // act
  const strippedSource = stripBom(plainSource);

  // assert
  assert.strictEqual(strippedSource, plainSource);
});

test("removes only the first of two consecutive leading byte-order marks", () => {
  // arrange
  // T-FMBOM-02: the surviving second marker keeps a doubled marker failing
  // closed to the no-frontmatter path instead of being cleaned into a fence.
  const doublyMarkedSource = "\uFEFF\uFEFF---\nname: reviewer\n---\nBody.\n";

  // act
  const strippedSource = stripBom(doublyMarkedSource);

  // assert
  assert.strictEqual(strippedSource, "\uFEFF---\nname: reviewer\n---\nBody.\n");
});

test("keeps a byte-order mark that is not at the start", () => {
  // arrange
  const interiorlyMarkedSource = "---\nname: reviewer\n---\nBody \uFEFF here.\n";

  // act
  const strippedSource = stripBom(interiorlyMarkedSource);

  // assert
  assert.strictEqual(strippedSource, interiorlyMarkedSource);
});

test("returns the empty string unchanged", () => {
  // arrange
  const emptySource = "";

  // act
  const strippedSource = stripBom(emptySource);

  // assert
  assert.strictEqual(strippedSource, "");
});
