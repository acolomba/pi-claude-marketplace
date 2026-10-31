import assert from "node:assert/strict";
import test from "node:test";

import { MARKETPLACE_LIST_CONTEXT } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts";

test("exports only the complete marketplace-list context identity", () => {
  // arrange
  const expected = {
    Messaging: { label: "Marketplace list" },
    rowPolicies: {},
  } as const;

  // act
  const actual = MARKETPLACE_LIST_CONTEXT;

  // assert
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual), ["Messaging", "rowPolicies"]);
  assert.deepEqual(Object.keys(actual.Messaging), ["label"]);
  assert.deepEqual(Object.keys(actual.rowPolicies), []);
});

test("MARKETPLACE_LIST_CONTEXT declares complete row policies", () => {
  // act
  const policies = MARKETPLACE_LIST_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {});
});
