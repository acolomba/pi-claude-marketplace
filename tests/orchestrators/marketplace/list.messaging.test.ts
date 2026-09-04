import assert from "node:assert/strict";
import test from "node:test";

import { LIST_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts";

test("exports only the complete marketplace-list context identity", () => {
  // arrange
  const expected = {
    Messaging: { label: "Marketplace list" },
    render: {},
  } as const;

  // act
  const actual = LIST_CONTEXT;

  // assert
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual), ["Messaging", "render"]);
  assert.deepEqual(Object.keys(actual.Messaging), ["label"]);
  assert.deepEqual(Object.keys(actual.render), []);
});
