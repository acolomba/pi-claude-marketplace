// Fixtures for the independent function/statement correspondence (D-03,
// D-04, D-09): a module whose two nested callbacks share a name, a hit count
// and a statement hit ratio, so that a validator which matches by name, by
// nearest position or by counts cannot tell which one a map dropped. Every
// expectation is written from the source text and V8's block-coverage
// semantics, never from converter output; spans are named by unique snippets
// so a reader can check each coordinate against the module by eye.

import { absentLocation, prefixOf, spanOf } from "./coverage-producer-fixtures.ts";

import type { ProducerFixture } from "./coverage-producer-fixtures.ts";

// Both callbacks are named `check`, sit in the left operand of a chained
// `&&`, run twice, never take their `if`, and execute three of their four
// statements. `anyLarge([1, 2])` short-circuits before its right operand;
// `allSmall([1, 2])` reaches it.
const twinsSource = `export function anyLarge(values: number[]): boolean {
  return values.some(function check(value: number): boolean {
    const doubled = value * 2;
    if (doubled > 10) {
      return true;
    }

    return false;
  }) && values.length > 0;
}

export function allSmall(values: number[]): boolean {
  return values.every(function check(value: number): boolean {
    const halved = value / 2;
    if (halved > 10) {
      return !halved;
    }

    return halved < 10;
  }) && values.length !== 0;
}
`;

const twinsTest = `import assert from "node:assert/strict";
import test from "node:test";

import { allSmall, anyLarge } from "../../extensions/pi-claude-marketplace/domain/twins.ts";

test("checks both callbacks twice", () => {
  assert.equal(anyLarge([1, 2]), false);
  assert.equal(allSmall([1, 2]), true);
});
`;

export function twinsFixture(): ProducerFixture {
  const source = twinsSource;
  const firstIf = spanOf(source, "if (doubled > 10) {", "return true;\n    }");
  const secondIf = spanOf(source, "if (halved > 10) {", "return !halved;\n    }");

  return {
    name: "twins",
    sourcePath: "extensions/pi-claude-marketplace/domain/twins.ts",
    source,
    tests: { "tests/domain/twins.test.ts": twinsTest },
    functions: [
      {
        name: "anyLarge",
        decl: spanOf(source, "anyLarge"),
        loc: spanOf(source, "{\n  return values.some", "values.length > 0;\n}"),
        hits: 1,
      },
      {
        name: "check",
        decl: prefixOf(source, "check(value: number): boolean {\n    const doubled", 5),
        loc: spanOf(source, "{\n    const doubled", "return false;\n  }"),
        hits: 2,
      },
      {
        name: "allSmall",
        decl: spanOf(source, "allSmall"),
        loc: spanOf(source, "{\n  return values.every", "values.length !== 0;\n}"),
        hits: 1,
      },
      {
        name: "check",
        decl: prefixOf(source, "check(value: number): boolean {\n    const halved", 5),
        loc: spanOf(source, "{\n    const halved", "return halved < 10;\n  }"),
        hits: 2,
      },
    ],
    statements: [
      { loc: spanOf(source, "return values.some", "values.length > 0;"), hits: 1 },
      { loc: spanOf(source, "value * 2"), hits: 2 },
      { loc: firstIf, hits: 2 },
      { loc: spanOf(source, "return true;"), hits: 0 },
      { loc: spanOf(source, "return false;"), hits: 2 },
      { loc: spanOf(source, "return values.every", "values.length !== 0;"), hits: 1 },
      { loc: spanOf(source, "value / 2"), hits: 2 },
      { loc: secondIf, hits: 2 },
      { loc: spanOf(source, "return !halved;"), hits: 0 },
      { loc: spanOf(source, "return halved < 10;"), hits: 2 },
    ],
    branches: [
      {
        type: "binary-expr",
        loc: spanOf(source, "values.some(", "values.length > 0"),
        locations: [
          spanOf(source, "values.some(", "return false;\n  })"),
          spanOf(source, "values.length > 0"),
        ],
        hits: [1, 0],
      },
      { type: "if", loc: firstIf, locations: [firstIf, absentLocation], hits: [0, 2] },
      {
        type: "binary-expr",
        loc: spanOf(source, "values.every(", "values.length !== 0"),
        locations: [
          spanOf(source, "values.every(", "return halved < 10;\n  })"),
          spanOf(source, "values.length !== 0"),
        ],
        hits: [1, 1],
      },
      { type: "if", loc: secondIf, locations: [secondIf, absentLocation], hits: [0, 2] },
    ],
  };
}
