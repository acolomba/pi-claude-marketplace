import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { MANIFEST_CANDIDATES } from "../../extensions/pi-claude-marketplace/domain/manifest-path.ts";

test("orders the wrapped manifest location ahead of the bare one", () => {
  // arrange
  const expectedCandidates = [path.join(".claude-plugin", "plugin.json"), "plugin.json"];

  // act
  const candidates = MANIFEST_CANDIDATES;

  // assert
  assert.deepStrictEqual(candidates, expectedCandidates);
});

test("is frozen so no reader can reorder the list every reader shares", () => {
  // act
  const candidates = MANIFEST_CANDIDATES;

  // assert
  assert.strictEqual(Object.isFrozen(candidates), true);
});
