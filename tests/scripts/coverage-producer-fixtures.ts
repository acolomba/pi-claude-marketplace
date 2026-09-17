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

/**
 * The span of the first `length` characters of the unique snippet `at`: a
 * function's `decl`, which is the identifier for a named function and the
 * first character for an arrow.
 */
export function prefixOf(source: string, at: string, length = 1): SourceSpan {
  const start = offsetOf(source, at);
  return { start: positionAt(source, start), end: positionAt(source, start + length) };
}

/** The span of the last `length` characters of the unique snippet `at`. */
export function suffixOf(source: string, at: string, length: number): SourceSpan {
  const end = offsetOf(source, at) + at.length;
  return { start: positionAt(source, end - length), end: positionAt(source, end) };
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
        decl: prefixOf(source, "(value) => {"),
        loc: spanOf(source, "{\n    const doubled", "return false;\n  }"),
        hits: 2,
      },
      {
        name: "(anonymous_2)",
        decl: prefixOf(source, "(value) => value >= 0"),
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
        // Istanbul's `if` branch names the whole statement as the first
        // location; the counter is still the consequent block's.
        type: "if",
        loc: spanOf(source, "if (doubled > 10) {", "return true;\n    }"),
        locations: [spanOf(source, "if (doubled > 10) {", "return true;\n    }"), absentLocation],
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

// Two object methods on one line with opposite coverage, a class that
// repeats both names, and a function whose real name ends in `_2`.
const namesSource = `export const pair = { pick(): number { return 1; }, skip(): number { return 2; } };

export class Counter {
  pick(): number {
    return 3;
  }

  skip(): number {
    return 4;
  }
}

export function count_2(): number {
  return 5;
}
`;

const namesTest = `import assert from "node:assert/strict";
import test from "node:test";

import { Counter, pair } from "../../extensions/pi-claude-marketplace/domain/names.ts";

test("picks from the pair and skips on the counter", () => {
  assert.equal(pair.pick(), 1);
  assert.equal(new Counter().skip(), 4);
});
`;

// The producer names a repeated method by appending `_N`; a real identifier
// that already ends in `_2` keeps its own name.
export function namesFixture(): ProducerFixture {
  const source = namesSource;

  return {
    name: "names",
    sourcePath: "extensions/pi-claude-marketplace/domain/names.ts",
    source,
    tests: { "tests/domain/names.test.ts": namesTest },
    functions: [
      {
        name: "pick",
        decl: prefixOf(source, "pick(): number { return 1; }", 4),
        loc: spanOf(source, "{ return 1; }"),
        hits: 1,
      },
      {
        name: "skip",
        decl: prefixOf(source, "skip(): number { return 2; }", 4),
        loc: spanOf(source, "{ return 2; }"),
        hits: 0,
      },
      {
        name: "pick_2",
        decl: prefixOf(source, "pick(): number {\n    return 3;", 4),
        loc: spanOf(source, "{\n    return 3;\n  }"),
        hits: 0,
      },
      {
        name: "skip_2",
        decl: prefixOf(source, "skip(): number {\n    return 4;", 4),
        loc: spanOf(source, "{\n    return 4;\n  }"),
        hits: 1,
      },
      {
        name: "count_2",
        decl: spanOf(source, "count_2"),
        loc: spanOf(source, "{\n  return 5;\n}"),
        hits: 0,
      },
    ],
    statements: [
      {
        loc: spanOf(source, "{ pick(): number { return 1; }, skip(): number { return 2; } }"),
        hits: 1,
      },
      { loc: spanOf(source, "return 1;"), hits: 1 },
      { loc: spanOf(source, "return 2;"), hits: 0 },
      { loc: spanOf(source, "return 3;"), hits: 0 },
      { loc: spanOf(source, "return 4;"), hits: 1 },
      { loc: spanOf(source, "return 5;"), hits: 0 },
    ],
    branches: [],
  };
}

// Constructor, accessor pair, async and generator methods, an empty arrow,
// a ternary, a default argument, an empty declaration, and a statement
// after a call that throws.
const syntaxSource = `export class Box {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  get current(): number {
    return this.value;
  }

  set current(next: number) {
    this.value = next;
  }

  async later(): Promise<number> {
    return this.value * 2;
  }

  *each(): Generator<number> {
    yield this.value;
  }
}

export const noop = (): void => {};

export function pickSign(n: number): string {
  return n < 0 ? "negative" : "positive";
}

export function withDefault(n = 1): number {
  return n;
}

export function empty(): void {}

export function fail(): never {
  throw new Error("boom");
}

export function afterFail(): number {
  fail();
  return 1;
}
`;

const syntaxTest = `import assert from "node:assert/strict";
import test from "node:test";

import {
  afterFail,
  Box,
  empty,
  noop,
  pickSign,
  withDefault,
} from "../../extensions/pi-claude-marketplace/domain/syntax.ts";

test("exercises every syntax form once", async () => {
  const box = new Box(1);
  assert.equal(box.current, 1);
  box.current = 2;
  assert.equal(await box.later(), 4);
  assert.deepEqual([...box.each()], [2]);
  noop();
  assert.equal(pickSign(-1), "negative");
  assert.equal(withDefault(5), 5);
  empty();
  assert.throws(() => afterFail(), /boom/);
});
`;

// Two rows record documented V8 observation limits rather than execution
// facts: \`return 1;\` after the throwing \`fail();\` never runs but shares
// its block's counter, and the default argument \`1\` is never evaluated
// because \`withDefault(5)\` supplies a value, yet V8 has no counter for the
// initializer and the branch reports the function's count.
export function syntaxFixture(): ProducerFixture {
  const source = syntaxSource;

  return {
    name: "syntax",
    sourcePath: "extensions/pi-claude-marketplace/domain/syntax.ts",
    source,
    tests: { "tests/domain/syntax.test.ts": syntaxTest },
    functions: [
      {
        name: "constructor",
        decl: spanOf(source, "constructor"),
        loc: spanOf(source, "{\n    this.value = value;\n  }"),
        hits: 1,
      },
      {
        name: "current",
        decl: prefixOf(source, "current(): number", 7),
        loc: spanOf(source, "{\n    return this.value;\n  }"),
        hits: 1,
      },
      {
        name: "current_2",
        decl: prefixOf(source, "current(next: number)", 7),
        loc: spanOf(source, "{\n    this.value = next;\n  }"),
        hits: 1,
      },
      {
        name: "later",
        decl: spanOf(source, "later"),
        loc: spanOf(source, "{\n    return this.value * 2;\n  }"),
        hits: 1,
      },
      {
        name: "each",
        decl: spanOf(source, "each"),
        loc: spanOf(source, "{\n    yield this.value;\n  }"),
        hits: 1,
      },
      {
        name: "(anonymous_5)",
        decl: prefixOf(source, "(): void => {}"),
        loc: suffixOf(source, "(): void => {}", 2),
        hits: 1,
      },
      {
        name: "pickSign",
        decl: spanOf(source, "pickSign"),
        loc: spanOf(source, "{\n  return n < 0", '"positive";\n}'),
        hits: 1,
      },
      {
        name: "withDefault",
        decl: spanOf(source, "withDefault"),
        loc: spanOf(source, "{\n  return n;\n}"),
        hits: 1,
      },
      {
        name: "empty",
        decl: spanOf(source, "empty"),
        loc: suffixOf(source, "empty(): void {}", 2),
        hits: 1,
      },
      {
        name: "fail",
        decl: prefixOf(source, "fail(): never", 4),
        loc: spanOf(source, '{\n  throw new Error("boom");\n}'),
        hits: 1,
      },
      {
        name: "afterFail",
        decl: spanOf(source, "afterFail"),
        loc: spanOf(source, "{\n  fail();\n  return 1;\n}"),
        hits: 1,
      },
    ],
    statements: [
      { loc: spanOf(source, "this.value = value;"), hits: 1 },
      { loc: spanOf(source, "return this.value;"), hits: 1 },
      { loc: spanOf(source, "this.value = next;"), hits: 1 },
      { loc: spanOf(source, "return this.value * 2;"), hits: 1 },
      { loc: spanOf(source, "yield this.value;"), hits: 1 },
      { loc: spanOf(source, "(): void => {}"), hits: 1 },
      { loc: spanOf(source, 'return n < 0 ? "negative" : "positive";'), hits: 1 },
      { loc: spanOf(source, "return n;"), hits: 1 },
      { loc: spanOf(source, 'throw new Error("boom");'), hits: 1 },
      { loc: spanOf(source, "fail();"), hits: 1 },
      // V8 limit: unreachable after the throw, still counted with its block.
      { loc: spanOf(source, "return 1;"), hits: 1 },
    ],
    branches: [
      {
        type: "cond-expr",
        loc: spanOf(source, 'n < 0 ? "negative" : "positive"'),
        locations: [spanOf(source, '"negative"'), spanOf(source, '"positive"')],
        hits: [1, 0],
      },
      {
        // V8 limit: the initializer never ran, and the branch carries the
        // function's count because V8 keeps no counter for it.
        type: "default-arg",
        loc: spanOf(source, "n = 1"),
        locations: [suffixOf(source, "n = 1", 1)],
        hits: [1],
      },
    ],
  };
}

// Multibyte characters and a surrogate pair before and inside statements,
// CRLF line endings, a blank line, and statements that end at the end of
// their line, so every endpoint is a UTF-16 column that the identity map
// must resolve exactly.
const unicodeSource = `${[
  "// naïve label: π🎉",
  'export const label = "π🎉";',
  "",
  "export function width(text: string): number {",
  "  return text.length;",
  "}",
  "",
  "export const shout = (text: string): string => `${text}🎉`;",
].join("\r\n")}\r\n`;

const unicodeTest = `import assert from "node:assert/strict";
import test from "node:test";

import { label, shout, width } from "../../extensions/pi-claude-marketplace/domain/unicode.ts";

test("measures and decorates text", () => {
  assert.equal(label, "π🎉");
  assert.equal(width("🎉"), 2);
  assert.equal(shout("a"), "a🎉");
});
`;

export function unicodeFixture(): ProducerFixture {
  const source = unicodeSource;

  return {
    name: "unicode",
    sourcePath: "extensions/pi-claude-marketplace/domain/unicode.ts",
    source,
    tests: { "tests/domain/unicode.test.ts": unicodeTest },
    functions: [
      {
        name: "width",
        decl: spanOf(source, "width"),
        loc: spanOf(source, "{\r\n  return text.length;\r\n}"),
        hits: 1,
      },
      {
        name: "(anonymous_1)",
        decl: prefixOf(source, "(text: string): string =>"),
        loc: spanOf(source, "`${text}🎉`"),
        hits: 1,
      },
    ],
    statements: [
      { loc: spanOf(source, '"π🎉"'), hits: 1 },
      { loc: spanOf(source, "return text.length;"), hits: 1 },
      { loc: spanOf(source, "(text: string): string => `${text}🎉`"), hits: 1 },
      { loc: spanOf(source, "`${text}🎉`"), hits: 1 },
    ],
    branches: [],
  };
}

// One module loaded by two test files, so the run has two workers and two
// raw records for it: one worker calls `tally` once, the other twice.
const tallySource = `export function tally(items: string[]): number {
  return items.length;
}
`;

function tallyTest(calls: number): string {
  const assertions = Array.from(
    { length: calls },
    (_, index) =>
      `  assert.equal(tally(${JSON.stringify(Array.from({ length: index + 1 }, () => "x"))}), ${index + 1});`,
  );

  return `import assert from "node:assert/strict";
import test from "node:test";

import { tally } from "../../extensions/pi-claude-marketplace/domain/tally.ts";

test("tallies ${calls} time(s)", () => {
${assertions.join("\n")}
});
`;
}

export const tallyWorkerHits: Readonly<Record<string, number>> = {
  "tests/domain/tally-one.test.ts": 1,
  "tests/domain/tally-two.test.ts": 2,
};

export function tallyFixture(): ProducerFixture {
  const source = tallySource;

  return {
    name: "tally",
    sourcePath: "extensions/pi-claude-marketplace/domain/tally.ts",
    source,
    tests: {
      "tests/domain/tally-one.test.ts": tallyTest(1),
      "tests/domain/tally-two.test.ts": tallyTest(2),
    },
    functions: [
      {
        name: "tally",
        decl: spanOf(source, "tally"),
        loc: spanOf(source, "{\n  return items.length;\n}"),
        hits: 3,
      },
    ],
    statements: [{ loc: spanOf(source, "return items.length;"), hits: 3 }],
    branches: [],
  };
}

/** The complete corpus a qualified producer must reproduce exactly. */
export function conformanceCorpus(): readonly ProducerFixture[] {
  return [
    nestedLogicalFixture(),
    namesFixture(),
    syntaxFixture(),
    unicodeFixture(),
    tallyFixture(),
  ];
}
