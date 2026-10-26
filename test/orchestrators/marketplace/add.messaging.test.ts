import assert from "node:assert/strict";
import test from "node:test";

import { ADD_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts";

test("exports the complete marketplace-add command context", () => {
  // arrange
  const expected = {
    Messaging: { label: "Marketplace add" },
    rowPolicies: { failed: { markers: false, contentReasons: true } },
  } as const;

  // act
  const context = ADD_CONTEXT;

  // assert
  assert.deepStrictEqual(context, expected);
  assert.deepStrictEqual(Object.keys(context), ["Messaging", "rowPolicies"]);
  assert.deepStrictEqual(Object.keys(context.Messaging), ["label"]);
  assert.deepStrictEqual(Object.keys(context.rowPolicies), ["failed"]);
});

test("ADD_CONTEXT declares complete row policies", () => {
  // act
  const policies = ADD_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, { failed: { markers: false, contentReasons: true } });
});
