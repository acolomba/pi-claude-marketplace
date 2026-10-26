import assert from "node:assert/strict";
import { test } from "node:test";

import { compareByNameThenScope } from "../../extensions/pi-claude-marketplace/shared/compare-name-scope.ts";

test("exports the name-first scope comparator from its named owner", () => {
  // arrange
  const expectedType = "function";

  // act
  const actualType = typeof compareByNameThenScope;

  // assert
  assert.equal(actualType, expectedType);
});

for (const { name, left, right, expected } of [
  {
    name: "sorts unequal names case-insensitively",
    left: { name: "alpha", scope: "user" },
    right: { name: "Beta", scope: "project" },
    expected: -1,
  },
  {
    name: "keeps equal names and equal scopes stable",
    left: { name: "Alpha", scope: "project" },
    right: { name: "alpha", scope: "project" },
    expected: 0,
  },
  {
    name: "sorts project before user for equal names",
    left: { name: "alpha", scope: "project" },
    right: { name: "ALPHA", scope: "user" },
    expected: -1,
  },
  {
    name: "sorts user after project for equal names",
    left: { name: "alpha", scope: "user" },
    right: { name: "ALPHA", scope: "project" },
    expected: 1,
  },
] as const) {
  test(name, () => {
    // arrange
    const expectedOrder = expected;

    // act
    const order = Math.sign(compareByNameThenScope(left, right));

    // assert
    assert.equal(order, expectedOrder);
  });
}

test("sorts empty, one, and many collections without changing cardinality", () => {
  // arrange
  const empty: Array<{ name: string; scope: "user" | "project" }> = [];
  const single = [{ name: "only", scope: "user" }] as const;
  const many = [
    { name: "zeta", scope: "user" },
    { name: "Alpha", scope: "user" },
    { name: "alpha", scope: "project" },
    { name: "beta", scope: "project" },
  ] as const;

  // act
  const sortedEmpty = [...empty].sort(compareByNameThenScope);
  const sortedSingle = [...single].sort(compareByNameThenScope);
  const sortedMany = [...many].sort(compareByNameThenScope);

  // assert
  assert.deepStrictEqual(sortedEmpty, []);
  assert.deepStrictEqual(sortedSingle, single);
  assert.deepStrictEqual(sortedMany, [many[2], many[1], many[3], many[0]]);
});

test("preserves stable exact ties and repeated-sort idempotency", () => {
  // arrange
  const rows = [
    { id: "first", name: "Alpha", scope: "project" },
    { id: "second", name: "alpha", scope: "project" },
    { id: "user", name: "ALPHA", scope: "user" },
  ] as const;

  // act
  const once = [...rows].sort(compareByNameThenScope);
  const twice = [...once].sort(compareByNameThenScope);

  // assert
  assert.deepStrictEqual(
    once.map(({ id }) => id),
    ["first", "second", "user"],
  );
  assert.deepStrictEqual(twice, once);
});
