import assert from "node:assert/strict";
import test from "node:test";

import { findDependents } from "../../extensions/pi-claude-marketplace/domain/dependency-orphans.ts";

import type { DeclarationIndex } from "../../extensions/pi-claude-marketplace/domain/dependency-orphans.ts";

/** A synthetic index: holder key -> the keys that holder declares. */
type IndexShape = Readonly<Record<string, readonly string[]>>;

function indexOf(shape: IndexShape): DeclarationIndex {
  return new Map(Object.entries(shape).map(([holder, declared]) => [holder, new Set(declared)]));
}

interface DependentsCase {
  readonly title: string;
  readonly shape: IndexShape;
  readonly target: string;
  readonly expected: readonly string[];
}

const CASES: readonly DependentsCase[] = [
  {
    title: "D-05-14: an empty index has no dependents",
    shape: {},
    target: "helper@mp",
    expected: [],
  },
  {
    title: "D-05-14: a holder that declares other keys is not a dependent",
    shape: { "app@mp": ["other@mp"], "tool@mp": [] },
    target: "helper@mp",
    expected: [],
  },
  {
    title: "D-05-14: the one holder that declares the target is reported",
    shape: { "app@mp": ["helper@mp"], "tool@mp": ["other@mp"] },
    target: "helper@mp",
    expected: ["app@mp"],
  },
  {
    title: "D-05-15: two holders are reported in default string sort order",
    shape: { "zeta@mp": ["helper@mp"], "alpha@mp": ["helper@mp"], "mid@mp": [] },
    target: "helper@mp",
    expected: ["alpha@mp", "zeta@mp"],
  },
  {
    title: "PRUNE-05: matching is exact on the whole name@marketplace key",
    shape: { "app@mp": ["helper@other"], "tool@mp": ["Helper@mp"], "kit@mp": ["helper@mp "] },
    target: "helper@mp",
    expected: [],
  },
];

for (const { title, shape, target, expected } of CASES) {
  test(title, () => {
    // arrange
    const index = indexOf(shape);

    // act
    const dependents = findDependents(target, index);

    // assert
    assert.deepStrictEqual(dependents, expected);
  });
}

test("D-05-14: the input index is not mutated by the walk", () => {
  // arrange
  const index = indexOf({ "app@mp": ["helper@mp"], "tool@mp": ["helper@mp", "other@mp"] });
  const before = new Map([...index].map(([holder, declared]) => [holder, [...declared]]));

  // act
  findDependents("helper@mp", index);

  // assert
  const after = new Map([...index].map(([holder, declared]) => [holder, [...declared]]));
  assert.deepStrictEqual(after, before);
});
