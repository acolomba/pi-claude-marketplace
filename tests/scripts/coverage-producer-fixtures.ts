// The producer conformance corpus (D-03, D-05, D-09): small production
// modules laid out like the repository, the unit tests that exercise them,
// and the functions, statements and branches a faithful converter must
// report for that execution, with the hit each one receives.
//
// Every expectation here is written from the source text and from V8's block
// coverage semantics, never from converter output. A span names its start and
// end by source snippets that occur exactly once, so a reader can check each
// coordinate against the module text by eye; columns are UTF-16 code units,
// lines are 1-based and end columns are exclusive, which is the Istanbul form.

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface ExpectedFunction {
  readonly name: string;
  readonly decl: SourceSpan;
  readonly loc: SourceSpan;
  readonly hits: number;
}

export interface ExpectedStatement {
  readonly loc: SourceSpan;
  readonly hits: number;
}

// An `if` without `else` carries one location with no coordinates at all;
// that is the pinned producer's representation of the implicit branch.
export interface AbsentLocation {
  readonly start: { readonly line: undefined; readonly column: undefined };
  readonly end: { readonly line: undefined; readonly column: undefined };
}

export interface ExpectedBranch {
  readonly type: string;
  readonly loc: SourceSpan;
  readonly locations: ReadonlyArray<SourceSpan | AbsentLocation>;
  readonly hits: readonly number[];
}

export interface ProducerFixture {
  readonly name: string;
  readonly sourcePath: string;
  readonly source: string;
  readonly tests: Readonly<Record<string, string>>;
  readonly functions: readonly ExpectedFunction[];
  readonly statements: readonly ExpectedStatement[];
  readonly branches: readonly ExpectedBranch[];
}

export const fixturePackageJson = `${JSON.stringify({ name: "fixture", type: "module" }, undefined, 2)}\n`;

export const absentLocation: AbsentLocation = {
  start: { line: undefined, column: undefined },
  end: { line: undefined, column: undefined },
};

function offsetOf(source: string, snippet: string): number {
  const first = source.indexOf(snippet);

  if (first === -1 || source.includes(snippet, first + 1)) {
    throw new Error(`snippet must occur exactly once in the fixture source: ${snippet}`);
  }

  return first;
}

function positionAt(source: string, offset: number): SourcePosition {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const line = source.slice(0, lineStart).split("\n").length;
  return { line, column: offset - lineStart };
}

/**
 * The span from the first character of `from` to the last character of `to`
 * (or of `from` when `to` is omitted), each located as a unique snippet.
 */
export function spanOf(source: string, from: string, to: string = from): SourceSpan {
  const start = offsetOf(source, from);
  const end = offsetOf(source, to) + to.length;

  if (end <= start) {
    throw new Error(`span ends before it starts: ${from} .. ${to}`);
  }

  return { start: positionAt(source, start), end: positionAt(source, end) };
}

/** The one-character span at the first character of `at`; a function's `decl`. */
export function pointOf(source: string, at: string): SourceSpan {
  const start = offsetOf(source, at);
  return { start: positionAt(source, start), end: positionAt(source, start + 1) };
}

// One callback sits in the left operand of a chained `&&` and has a body of
// several statements of which only some execute; a second callback sits in
// the right operand. Only the first is subject to the walker omission.
const nestedLogicalSource = `export function anyLarge(values: number[]): boolean {
  return values.some((value) => {
    const doubled = value * 2;
    if (doubled > 10) {
      return true;
    }

    return false;
  }) && values.length > 0 && values.every((value) => value >= 0);
}
`;

const nestedLogicalTest = `import assert from "node:assert/strict";
import test from "node:test";

import { anyLarge } from "../../extensions/pi-claude-marketplace/domain/nested.ts";

test("reports no large value", () => {
  assert.equal(anyLarge([1, 2]), false);
});
`;

// `anyLarge([1, 2])` runs the \`some\` callback twice, never reaches
// \`return true\`, and short-circuits before \`values.length > 0\` and the
// \`every\` callback, so those carry zero.
export function nestedLogicalFixture(): ProducerFixture {
  const source = nestedLogicalSource;

  return {
    name: "nested-logical",
    sourcePath: "extensions/pi-claude-marketplace/domain/nested.ts",
    source,
    tests: { "tests/domain/nested.test.ts": nestedLogicalTest },
    functions: [
      {
        name: "anyLarge",
        decl: spanOf(source, "anyLarge"),
        loc: spanOf(source, "{\n  return values.some", "value >= 0);\n}"),
        hits: 1,
      },
      {
        name: "(anonymous_1)",
        decl: pointOf(source, "(value) => {"),
        loc: spanOf(source, "{\n    const doubled", "return false;\n  }"),
        hits: 2,
      },
      {
        name: "(anonymous_2)",
        decl: pointOf(source, "(value) => value >= 0"),
        loc: spanOf(source, "value >= 0"),
        hits: 0,
      },
    ],
    statements: [
      { loc: spanOf(source, "return values.some", "value >= 0);"), hits: 1 },
      { loc: spanOf(source, "value * 2"), hits: 2 },
      { loc: spanOf(source, "if (doubled > 10) {", "return true;\n    }"), hits: 2 },
      { loc: spanOf(source, "return true;"), hits: 0 },
      { loc: spanOf(source, "return false;"), hits: 2 },
      { loc: spanOf(source, "value >= 0"), hits: 0 },
    ],
    branches: [
      {
        type: "binary-expr",
        loc: spanOf(source, "values.some(", "value >= 0)"),
        locations: [
          spanOf(source, "values.some(", "return false;\n  })"),
          spanOf(source, "values.length > 0"),
          spanOf(source, "values.every(", "value >= 0)"),
        ],
        hits: [1, 0, 0],
      },
      {
        type: "if",
        loc: spanOf(source, "if (doubled > 10) {", "return true;\n    }"),
        locations: [spanOf(source, "{\n      return true;\n    }"), absentLocation],
        hits: [0, 2],
      },
    ],
  };
}

/**
 * What the unmodified producer omits: the callback nested in the left operand,
 * every statement of its body, and the `if` branch inside it.
 */
export function nestedLogicalOmission(): {
  readonly functions: readonly SourceSpan[];
  readonly statements: readonly SourceSpan[];
  readonly branches: readonly SourceSpan[];
} {
  const source = nestedLogicalSource;

  return {
    functions: [spanOf(source, "{\n    const doubled", "return false;\n  }")],
    statements: [
      spanOf(source, "value * 2"),
      spanOf(source, "if (doubled > 10) {", "return true;\n    }"),
      spanOf(source, "return true;"),
      spanOf(source, "return false;"),
    ],
    branches: [spanOf(source, "if (doubled > 10) {", "return true;\n    }")],
  };
}
