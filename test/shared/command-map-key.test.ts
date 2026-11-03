import assert from "node:assert/strict";
import { test } from "node:test";

import { commandMapKeyRefusal } from "../../extensions/pi-claude-marketplace/shared/command-map-key.ts";

for (const { key, expectedReason } of [
  { key: "deploy", expectedReason: undefined },
  { key: "build/web", expectedReason: undefined },
  { key: "deploy:", expectedReason: 'ends with ":"' },
  { key: "a<b", expectedReason: 'holds "<" or ">"' },
  { key: "a>b", expectedReason: 'holds "<" or ">"' },
  { key: "a b", expectedReason: "holds whitespace" },
  { key: "a\u202Eb", expectedReason: "holds a hidden or direction-changing character" },
]) {
  test(`gives ${JSON.stringify(expectedReason)} as the refusal of the key ${JSON.stringify(key)}`, () => {
    // act
    const reason = commandMapKeyRefusal(key);

    // assert
    assert.strictEqual(reason, expectedReason);
  });
}
