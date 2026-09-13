import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { MANIFEST_CANDIDATES } from "../../extensions/pi-claude-marketplace/domain/manifest-path.ts";

test("orders the wrapped manifest location ahead of the bare one", () => {
  // act
  const candidates = [...MANIFEST_CANDIDATES];

  // assert
  assert.deepStrictEqual(candidates, [path.join(".claude-plugin", "plugin.json"), "plugin.json"]);
});

test("names exactly the two known manifest locations", () => {
  // assert
  assert.strictEqual(MANIFEST_CANDIDATES.length, 2);
});

test("is frozen so no reader can reorder the list every reader shares", () => {
  // assert
  assert.ok(Object.isFrozen(MANIFEST_CANDIDATES));
});

test("keeps every candidate relative, for joining onto a plugin root", () => {
  // assert
  for (const candidate of MANIFEST_CANDIDATES) {
    assert.ok(!path.isAbsolute(candidate), `absolute candidate: ${candidate}`);
  }
});
