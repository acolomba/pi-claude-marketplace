import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findDependents,
  isHeldBy,
  pruneOrphans,
} from "../../extensions/pi-claude-marketplace/domain/dependency-orphans.ts";

import type {
  DeclarationIndex,
  OrphanCandidate,
} from "../../extensions/pi-claude-marketplace/domain/dependency-orphans.ts";

/** A synthetic index: holder key -> the keys that holder declares. */
type IndexShape = Readonly<Record<string, readonly string[]>>;

function declarationIndex(shape: IndexShape): DeclarationIndex {
  return new Map(Object.entries(shape).map(([holder, declared]) => [holder, new Set(declared)]));
}

interface DependentsCase {
  readonly title: string;
  readonly shape: IndexShape;
  readonly target: string;
  readonly expected: readonly string[];
}

const DEPENDENTS_CASES: readonly DependentsCase[] = [
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

for (const { title, shape, target, expected } of DEPENDENTS_CASES) {
  test(title, () => {
    // arrange
    const index = declarationIndex(shape);

    // act
    const dependents = findDependents(target, index);

    // assert
    assert.deepStrictEqual(dependents, expected);
  });
}

/** `key` as a dependency-provenance candidate. */
function dependency(key: string): OrphanCandidate {
  return { key, provenance: "dependency" };
}

/** `key` as an explicit-provenance candidate. */
function explicit(key: string): OrphanCandidate {
  return { key, provenance: "explicit" };
}

interface OrphanCase {
  readonly title: string;
  readonly records: readonly OrphanCandidate[];
  readonly shape: IndexShape;
  readonly removed: readonly string[];
  readonly expected: readonly string[];
}

const ORPHAN_CASES: readonly OrphanCase[] = [
  {
    title: "D-05-01: an empty candidate list prunes nothing",
    records: [],
    shape: {},
    removed: ["x@mp"],
    expected: [],
  },
  {
    title: "PRUNE-02: a candidate list holding no dependency-provenance record prunes nothing",
    records: [explicit("e@mp"), explicit("f@mp")],
    shape: { "e@mp": ["f@mp"] },
    removed: ["x@mp"],
    expected: [],
  },
  {
    title: "D-05-01: a single dependency declared only by the removed plugin is pruned",
    records: [dependency("d@mp")],
    shape: { "x@mp": ["d@mp"] },
    removed: ["x@mp"],
    expected: ["d@mp"],
  },
  {
    title: "D-05-02: a transitive chain is pruned dependents before dependencies",
    records: [dependency("d2@mp"), dependency("d1@mp")],
    shape: { "x@mp": ["d1@mp"], "d1@mp": ["d2@mp"] },
    removed: ["x@mp"],
    expected: ["d1@mp", "d2@mp"],
  },
  {
    title: "PRUNE-03: a dependency a remaining holder still declares survives (diamond)",
    records: [dependency("d@mp")],
    shape: { "x@mp": ["d@mp"], "y@mp": ["d@mp"] },
    removed: ["x@mp"],
    expected: [],
  },
  {
    title: "PRUNE-02: an explicit record nothing declares survives",
    records: [explicit("e@mp")],
    shape: {},
    removed: ["x@mp"],
    expected: [],
  },
  {
    title: "PRUNE-02: an explicit record declared only by the removed plugin survives",
    records: [explicit("e@mp")],
    shape: { "x@mp": ["e@mp"] },
    removed: ["x@mp"],
    expected: [],
  },
  {
    title: "PRUNE-03: a cyclic island of two dependency records holds itself (documented residue)",
    records: [dependency("a@mp"), dependency("b@mp")],
    shape: { "a@mp": ["b@mp"], "b@mp": ["a@mp"] },
    removed: ["x@mp"],
    expected: [],
  },
  {
    title:
      "D-05-01: a pre-existing orphan the removed set does not name is pruned (whole-scope sweep)",
    records: [dependency("o@mp")],
    shape: {},
    removed: ["x@mp"],
    expected: ["o@mp"],
  },
  {
    title:
      "D-05-02: a batch is emitted in sorted key order and a later pass follows every earlier pass",
    records: [dependency("z@mp"), dependency("c@mp"), dependency("a@mp"), dependency("m@mp")],
    shape: { "x@mp": ["z@mp", "c@mp"], "z@mp": ["m@mp"], "c@mp": ["a@mp"] },
    removed: ["x@mp"],
    expected: ["c@mp", "z@mp", "a@mp", "m@mp"],
  },
  {
    title:
      "PRUNE-03: a dependency the removed plugin's surviving sibling declares transitively survives",
    records: [dependency("d1@mp"), dependency("d2@mp")],
    shape: { "x@mp": ["d1@mp"], "d1@mp": ["d2@mp"], "y@mp": ["d2@mp"] },
    removed: ["x@mp"],
    expected: ["d1@mp"],
  },
];

for (const { title, records, shape, removed, expected } of ORPHAN_CASES) {
  test(title, () => {
    // arrange
    const index = declarationIndex(shape);

    // act
    const pruned = pruneOrphans(records, index, new Set(removed));

    // assert
    assert.deepStrictEqual(pruned, expected);
  });
}

interface HeldCase {
  readonly title: string;
  readonly shape: IndexShape;
  readonly gone: readonly string[];
  readonly key: string;
  readonly expected: boolean;
}

const HELD_CASES: readonly HeldCase[] = [
  {
    title: "PRUNE-03: a key a present holder declares is held",
    shape: { "x@mp": ["d1@mp"], "d1@mp": ["d2@mp"] },
    gone: ["x@mp"],
    key: "d2@mp",
    expected: true,
  },
  {
    title: "PRUNE-03: a key only a gone holder declares is not held",
    shape: { "x@mp": ["d1@mp"], "d1@mp": ["d2@mp"] },
    gone: ["x@mp", "d1@mp"],
    key: "d2@mp",
    expected: false,
  },
  {
    title: "D-05-13: the answer is one-pass -- a present holder holds even when nothing holds it",
    shape: { "d1@mp": ["d2@mp"] },
    gone: [],
    key: "d2@mp",
    expected: true,
  },
  {
    title: "PRUNE-03: a key nobody declares is not held",
    shape: { "x@mp": ["d1@mp"] },
    gone: [],
    key: "o@mp",
    expected: false,
  },
];

for (const { title, shape, gone, key, expected } of HELD_CASES) {
  test(title, () => {
    // arrange
    const index = declarationIndex(shape);

    // act
    const held = isHeldBy(index, new Set(gone), key);

    // assert
    assert.equal(held, expected);
  });
}
