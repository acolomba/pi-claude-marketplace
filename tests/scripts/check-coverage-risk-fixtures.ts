// The production CRAP policy corpus (D-06, D-08, D-09): small production
// modules laid out like the repository, the unit tests that exercise them,
// and for every function the risk gate must report its exact anchor, its
// cyclomatic complexity, the statements its body contains and how many of
// those execute. Every expectation is written from the source text and the
// standard cyclomatic rules (one plus each `if` and each `&&`), never from
// the consumer's output; the CRAP score follows from those by the formula
// `cc * cc * (1 - covered / total) ** 3 + cc`.
//
// A function's anchor is where the installed consumer reports it: the start
// of the function node itself, which is the `function` keyword of a
// declaration, the first character of an arrow, and the parameter list of a
// method. Anchors are named by a snippet that occurs once in the source, so
// a reader can check each coordinate by eye.

import { fixturePackageJson, prefixOf } from "./coverage-producer-fixtures.ts";

import type { SourcePosition } from "./coverage-producer-fixtures.ts";

export interface ExpectedRisk {
  readonly name: string;
  readonly anchor: SourcePosition;
  readonly cyclomatic: number;
  readonly statements: { readonly total: number; readonly covered: number };
  /** Whether a statement-empty body was entered; the entry rule's only input. */
  readonly entered?: boolean;
}

export interface RiskFixture {
  readonly name: string;
  readonly sourcePath: string;
  readonly source: string;
  readonly tests: Readonly<Record<string, string>>;
  readonly functions: readonly ExpectedRisk[];
}

/** The `{ path, line, column, ... }` row shape the gate reports for one function. */
export interface ExpectedRow {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly name: string;
  readonly cyclomatic: number;
  readonly statements: { readonly total: number; readonly covered: number };
  readonly coverage: number;
  readonly crap: number;
}

export const CLASSIFY_PATH = "extensions/pi-claude-marketplace/domain/classify.ts";
export const GRADE_PATH = "extensions/pi-claude-marketplace/domain/grade.ts";
export const BELOW_PATH = "extensions/pi-claude-marketplace/domain/below.ts";
export const TWINS_PATH = "extensions/pi-claude-marketplace/domain/twins.ts";
export const UNICODE_PATH = "extensions/pi-claude-marketplace/domain/unicode.ts";

function anchorOf(source: string, snippet: string): SourcePosition {
  return prefixOf(source, snippet).start;
}

function importingTest(modulePath: string, names: readonly string[], body: string): string {
  return `import assert from "node:assert/strict";
import test from "node:test";

import { ${names.join(", ")} } from "../../${modulePath}";

test("exercises the module", () => {
${body}
});
`;
}

// Five `if`s: cyclomatic 6; eleven statements (five `if`s, five early
// returns and the last return). Uncovered it scores 36 + 6 = 42; fully
// exercised it scores 6.
const classifySource = `export function classify(n: number): string {
  if (n === 1) {
    return "one";
  }
  if (n === 2) {
    return "two";
  }
  if (n === 3) {
    return "three";
  }
  if (n === 4) {
    return "four";
  }
  if (n === 5) {
    return "five";
  }
  return "many";
}
`;

/** The complexity-6 function, exercised through every arm or only imported. */
export function classifyFixture(exercised: boolean): RiskFixture {
  const source = classifySource;
  const body = exercised
    ? `  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((n) => classify(n)),
    ["one", "two", "three", "four", "five", "many"],
  );`
    : `  assert.equal(typeof classify, "function");`;

  return {
    name: exercised ? "classify-exercised" : "classify-uncovered",
    sourcePath: CLASSIFY_PATH,
    source,
    tests: { "tests/domain/classify.test.ts": importingTest(CLASSIFY_PATH, ["classify"], body) },
    functions: [
      {
        name: "classify",
        anchor: anchorOf(source, "function classify"),
        cyclomatic: 6,
        statements: { total: 11, covered: exercised ? 11 : 0 },
      },
    ],
  };
}

// Four `if`s: cyclomatic 5 and nine statements, never called, so the score
// is exactly 25 + 5 = 30.
const gradeSource = `export function grade(n: number): string {
  if (n === 1) {
    return "one";
  }
  if (n === 2) {
    return "two";
  }
  if (n === 3) {
    return "three";
  }
  if (n === 4) {
    return "four";
  }
  return "many";
}
`;

/** An uncovered complexity-5 function whose score meets the threshold exactly. */
export function gradeFixture(): RiskFixture {
  const source = gradeSource;

  return {
    name: "grade",
    sourcePath: GRADE_PATH,
    source,
    tests: {
      "tests/domain/grade.test.ts": importingTest(
        GRADE_PATH,
        ["grade"],
        `  assert.equal(typeof grade, "function");`,
      ),
    },
    functions: [
      {
        name: "grade",
        anchor: anchorOf(source, "function grade"),
        cyclomatic: 5,
        statements: { total: 9, covered: 0 },
      },
    ],
  };
}

// One `if` over six `&&`: cyclomatic 8. Ten statements: the initializer,
// the `if`, seven inside its block and the return. Called with the block
// skipped, three of ten execute: 64 * 0.7 ** 3 + 8 = 29.952, which a
// one-decimal display shows as 30.
const belowSource = `export function below(flag: boolean, items: number[]): number {
  let total = 0;
  if (flag && items.length > 0 && items[0] > 1 && items[1] > 2 && items[2] > 3 && items[3] > 4 && items[4] > 5) {
    total += 1;
    total += 2;
    total += 3;
    total += 4;
    total += 5;
    total += 6;
    total += 7;
  }
  return total;
}
`;

/** A partially covered complexity-8 function whose true score is just below 30. */
export function belowFixture(): RiskFixture {
  const source = belowSource;

  return {
    name: "below",
    sourcePath: BELOW_PATH,
    source,
    tests: {
      "tests/domain/below.test.ts": importingTest(
        BELOW_PATH,
        ["below"],
        `  assert.equal(below(false, []), 0);`,
      ),
    },
    functions: [
      {
        name: "below",
        anchor: anchorOf(source, "function below"),
        cyclomatic: 8,
        statements: { total: 10, covered: 3 },
      },
    ],
  };
}

// Two methods named `count` with opposite coverage, two arrows on one line
// with opposite coverage, a callback nested in `outer` whose body is partly
// executed (`outer([1])` runs it once, takes the `if` and its fall-through
// return, and never the early return), and the method shapes whose anchor
// differs from the parameter list: a type parameter list the strip erases,
// an optional marker, and two statement-empty bodies of which one runs.
const twinsSource = `export class Left {
  count(items: string[]): number {
    return items.length;
  }
}

export class Right {
  count(items: string[]): number {
    return items.length * 2;
  }
}

export const same = [(n: number): number => n + 1, (n: number): number => n - 1];

export function outer(values: number[]): number[] {
  return values.map((value) => {
    if (value > 10) {
      return value;
    }
    return value * 2;
  });
}

export class Shapes {
  static async load<T>(x: T): Promise<T> {
    return x;
  }
  opt?(): number {
    return 1;
  }
  noop(): void {}
  idle(): void {}
}
`;

/** Repeated names, one line, nested, opposite coverage and method shapes in one module. */
export function twinsFixture(): RiskFixture {
  const source = twinsSource;

  return {
    name: "twins",
    sourcePath: TWINS_PATH,
    source,
    tests: {
      "tests/domain/twins.test.ts": importingTest(
        TWINS_PATH,
        ["Left", "outer", "same", "Shapes"],
        `  assert.equal(new Left().count(["a"]), 1);
  assert.equal(same[0](1), 2);
  assert.deepEqual(outer([1]), [2]);
  assert.equal(typeof Shapes.load(1).then, "function");
  assert.equal(new Shapes().opt?.(), 1);
  new Shapes().noop();`,
      ),
    },
    functions: [
      {
        name: "count",
        anchor: anchorOf(source, "(items: string[]): number {\n    return items.length;"),
        cyclomatic: 1,
        statements: { total: 1, covered: 1 },
      },
      {
        name: "count",
        anchor: anchorOf(source, "(items: string[]): number {\n    return items.length * 2;"),
        cyclomatic: 1,
        statements: { total: 1, covered: 0 },
      },
      {
        name: "(anonymous)",
        anchor: anchorOf(source, "(n: number): number => n + 1"),
        cyclomatic: 1,
        statements: { total: 1, covered: 1 },
      },
      {
        name: "(anonymous)",
        anchor: anchorOf(source, "(n: number): number => n - 1"),
        cyclomatic: 1,
        statements: { total: 1, covered: 0 },
      },
      {
        name: "outer",
        anchor: anchorOf(source, "function outer"),
        cyclomatic: 1,
        statements: { total: 4, covered: 3 },
      },
      {
        name: "(anonymous)",
        anchor: anchorOf(source, "(value) => {"),
        cyclomatic: 2,
        statements: { total: 3, covered: 2 },
      },
      {
        name: "load",
        anchor: anchorOf(source, "<T>(x: T): Promise<T>"),
        cyclomatic: 1,
        statements: { total: 1, covered: 1 },
      },
      {
        name: "opt",
        anchor: anchorOf(source, "(): number {\n    return 1;"),
        cyclomatic: 1,
        statements: { total: 1, covered: 1 },
      },
      {
        name: "noop",
        anchor: anchorOf(source, "(): void {}\n  idle"),
        cyclomatic: 1,
        statements: { total: 0, covered: 0 },
        entered: true,
      },
      {
        name: "idle",
        anchor: anchorOf(source, "(): void {}\n}"),
        cyclomatic: 1,
        statements: { total: 0, covered: 0 },
      },
    ],
  };
}

// A function that follows a two-byte and a four-byte character on its
// line, so its byte column, code-point column and UTF-16 column all differ.
const unicodeSource = `export const label = "π🎉"; export function width(text: string): number {
  return text.length;
}
`;

/** One function whose anchor sits after non-ASCII text on the same line. */
export function unicodeFixture(): RiskFixture {
  const source = unicodeSource;

  return {
    name: "unicode",
    sourcePath: UNICODE_PATH,
    source,
    tests: {
      "tests/domain/unicode.test.ts": importingTest(
        UNICODE_PATH,
        ["width"],
        `  assert.equal(width("🎉"), 2);`,
      ),
    },
    functions: [
      {
        name: "width",
        anchor: anchorOf(source, "function width"),
        cyclomatic: 1,
        statements: { total: 1, covered: 1 },
      },
    ],
  };
}

/** The fixture root's files: package.json, the module and its tests. */
export function riskFixtureFiles(fixture: RiskFixture): Record<string, string> {
  return {
    "package.json": fixturePackageJson,
    [fixture.sourcePath]: fixture.source,
    ...fixture.tests,
  };
}

/** The CRAP formula the policy applies, from the consumer's complexity and unrounded coverage. */
export function crapOf(cyclomatic: number, coverage: number): number {
  return cyclomatic * cyclomatic * (1 - coverage) ** 3 + cyclomatic;
}

// The statement proportion, or the entry rule for a body with no statement.
function coverageOf(fn: ExpectedRisk): number {
  if (fn.statements.total === 0) {
    return fn.entered === true ? 1 : 0;
  }

  return fn.statements.covered / fn.statements.total;
}

/** The rows the gate must report for `fixture`, in path, line and column order. */
export function expectedRows(fixture: RiskFixture): ExpectedRow[] {
  return fixture.functions
    .map((fn) => ({
      path: fixture.sourcePath,
      line: fn.anchor.line,
      column: fn.anchor.column,
      name: fn.name,
      cyclomatic: fn.cyclomatic,
      statements: fn.statements,
      coverage: coverageOf(fn),
      crap: crapOf(fn.cyclomatic, coverageOf(fn)),
    }))
    .sort((a, b) => a.line - b.line || a.column - b.column);
}
