import assert from "node:assert/strict";
import test from "node:test";

import { ADD_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";

test("exports the complete marketplace-add command context", () => {
  // arrange
  const expected = {
    Messaging: { label: "Marketplace add" },
    render: {},
  } as const;

  // act
  const context = ADD_CONTEXT;

  // assert
  assert.deepStrictEqual(context, expected);
  assert.deepStrictEqual(Object.keys(context), ["Messaging", "render"]);
  assert.deepStrictEqual(Object.keys(context.Messaging), ["label"]);
  assert.deepStrictEqual(Object.keys(context.render), []);
});
