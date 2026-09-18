// The production population fixture (D-04, D-07): four production sources a
// verified unit run must account for in four different ways. One module is
// loaded by two workers that each execute a different function, one is
// imported but never called, one executable module is never loaded, and one
// module is type-only. Every expectation is written from the source text and
// V8's block-coverage semantics, never from converter output; spans are named
// by unique snippets so a reader can check each coordinate against the module
// by eye.

import {
  absentLocation,
  fixturePackageJson,
  prefixOf,
  spanOf,
} from "./coverage-producer-fixtures.ts";

import type { ProjectedCoverage } from "./coverage-projection.ts";

export interface PopulationSource {
  readonly path: string;
  readonly source: string;
  readonly expected: ProjectedCoverage;
}

// Two workers load `pair.ts`: `pair-first.test.ts` calls `first` once and
// `pair-second.test.ts` calls `second` twice, so the merged record sums them
// and each worker alone shows the other function at zero.
const pairSource = `export function first(items: string[]): number {
  return items.length;
}

export function second(items: string[]): number {
  return items.length * 2;
}
`;

// `idle.test.ts` imports `idle` and never calls it: the module loads and its
// one function stays at zero.
const idleSource = `export function idle(): string {
  return "idle";
}
`;

// No test imports `unimported.ts`: it is executable and never loaded.
const unimportedSource = `export function unimported(flag: boolean): number {
  if (flag) {
    return 1;
  }

  return 0;
}
`;

// `types.ts` strips to nothing: no statement survives, so it is type-only.
const typesSource = `export interface Thing {
  readonly name: string;
}

export type Kind = "a" | "b";
`;

const pairFirstTest = `import assert from "node:assert/strict";
import test from "node:test";

import { first } from "../../extensions/pi-claude-marketplace/domain/pair.ts";

test("counts once", () => {
  assert.equal(first(["x"]), 1);
});
`;

const pairSecondTest = `import assert from "node:assert/strict";
import test from "node:test";

import { second } from "../../extensions/pi-claude-marketplace/domain/pair.ts";

test("doubles twice", () => {
  assert.equal(second(["x"]), 2);
  assert.equal(second(["x", "y"]), 4);
});
`;

const idleTest = `import assert from "node:assert/strict";
import test from "node:test";

import { idle } from "../../extensions/pi-claude-marketplace/domain/idle.ts";

test("imports without calling", () => {
  assert.equal(typeof idle, "function");
});
`;

export const PAIR_PATH = "extensions/pi-claude-marketplace/domain/pair.ts";
export const IDLE_PATH = "extensions/pi-claude-marketplace/domain/idle.ts";
export const UNIMPORTED_PATH = "extensions/pi-claude-marketplace/domain/unimported.ts";
export const TYPES_PATH = "extensions/pi-claude-marketplace/domain/types.ts";

/** The raw record each worker contributes for `pair.ts`, by its test file. */
export const pairWorkerHits: Readonly<Record<string, { first: number; second: number }>> = {
  "tests/domain/pair-first.test.ts": { first: 1, second: 0 },
  "tests/domain/pair-second.test.ts": { first: 0, second: 2 },
};

/** The merged `pair.ts` record, or one worker's alone when `hits` is given. */
export function pairCoverage(hits = { first: 1, second: 2 }): ProjectedCoverage {
  const source = pairSource;

  return {
    functions: [
      {
        name: "first",
        decl: spanOf(source, "first"),
        loc: spanOf(source, "{\n  return items.length;\n}"),
        hits: hits.first,
      },
      {
        name: "second",
        decl: spanOf(source, "second"),
        loc: spanOf(source, "{\n  return items.length * 2;\n}"),
        hits: hits.second,
      },
    ],
    statements: [
      { loc: spanOf(source, "return items.length;"), hits: hits.first },
      { loc: spanOf(source, "return items.length * 2;"), hits: hits.second },
    ],
    branches: [],
  };
}

function idleCoverage(): ProjectedCoverage {
  const source = idleSource;

  return {
    functions: [
      {
        name: "idle",
        decl: prefixOf(source, "idle(): string", 4),
        loc: spanOf(source, '{\n  return "idle";\n}'),
        hits: 0,
      },
    ],
    statements: [{ loc: spanOf(source, 'return "idle";'), hits: 0 }],
    branches: [],
  };
}

// The zero-execution model of a module V8 never saw: every construct present,
// every counter zero, the implicit else as the absent location.
export function unimportedCoverage(): ProjectedCoverage {
  const source = unimportedSource;
  const ifStatement = spanOf(source, "if (flag) {", "return 1;\n  }");

  return {
    functions: [
      {
        name: "unimported",
        decl: spanOf(source, "unimported"),
        loc: spanOf(source, "{\n  if (flag)", "return 0;\n}"),
        hits: 0,
      },
    ],
    statements: [
      { loc: ifStatement, hits: 0 },
      { loc: spanOf(source, "return 1;"), hits: 0 },
      { loc: spanOf(source, "return 0;"), hits: 0 },
    ],
    branches: [
      { type: "if", loc: ifStatement, locations: [ifStatement, absentLocation], hits: [0, 0] },
    ],
  };
}

const emptyCoverage: ProjectedCoverage = { functions: [], statements: [], branches: [] };

/** The four production sources with the coverage each must show after the run. */
export function populationSources(): readonly PopulationSource[] {
  return [
    { path: IDLE_PATH, source: idleSource, expected: idleCoverage() },
    { path: PAIR_PATH, source: pairSource, expected: pairCoverage() },
    { path: TYPES_PATH, source: typesSource, expected: emptyCoverage },
    { path: UNIMPORTED_PATH, source: unimportedSource, expected: unimportedCoverage() },
  ];
}

/** The fixture root's files: package.json, the four sources and the three tests. */
export function populationFiles(): Record<string, string> {
  const files: Record<string, string> = {
    "package.json": fixturePackageJson,
    "tests/domain/pair-first.test.ts": pairFirstTest,
    "tests/domain/pair-second.test.ts": pairSecondTest,
    "tests/domain/idle.test.ts": idleTest,
  };

  for (const { path, source } of populationSources()) {
    files[path] = source;
  }

  return files;
}
