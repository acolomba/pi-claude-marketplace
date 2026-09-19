// Fixtures for the executed-source mapping (D-03, D-04, D-09): modules whose
// coordinates only an exact UTF-16 mapping reproduces, with the functions,
// statements and branches a faithful conversion must report for the recorded
// execution. Every expectation is written from the source text, never from
// converter output; spans are named by unique snippets so a reader can check
// each coordinate against the module by eye.

import { prefixOf, spanOf, suffixOf } from "./coverage-producer-fixtures.ts";

import type { ProducerFixture } from "./coverage-producer-fixtures.ts";

// Two arrows on one line after a surrogate pair, with opposite coverage, and
// two bodies that end exactly at the end of their line. A converter that
// counts code points or bytes moves every column after the emoji; one that
// lacks the line-length mapping loses both endpoints.
const endpointsSource = `export const tag = "π🎉", pick = (): number => 1, skip = (): number => 2
export function width(text: string): number { return text.length }
`;

const endpointsTest = `import assert from "node:assert/strict";
import test from "node:test";

import { pick, width } from "../../extensions/pi-claude-marketplace/domain/endpoints.ts";

test("picks and measures", () => {
  assert.equal(pick(), 1);
  assert.equal(width("🎉"), 2);
});
`;

/**
 * Two arrows after a surrogate pair, with bodies ending at end-of-line, so a
 * converter that miscounts code points or bytes shifts every later column.
 */
export function endpointsFixture(): ProducerFixture {
  const source = endpointsSource;

  return {
    name: "endpoints",
    sourcePath: "extensions/pi-claude-marketplace/domain/endpoints.ts",
    source,
    tests: { "tests/domain/endpoints.test.ts": endpointsTest },
    functions: [
      {
        name: "(anonymous_0)",
        decl: prefixOf(source, "(): number => 1"),
        loc: suffixOf(source, "=> 1", 1),
        hits: 1,
      },
      {
        name: "(anonymous_1)",
        decl: prefixOf(source, "(): number => 2"),
        loc: suffixOf(source, "=> 2", 1),
        hits: 0,
      },
      {
        name: "width",
        decl: spanOf(source, "width"),
        loc: spanOf(source, "{ return text.length }"),
        hits: 1,
      },
    ],
    statements: [
      { loc: spanOf(source, '"π🎉"'), hits: 1 },
      { loc: spanOf(source, "(): number => 1"), hits: 1 },
      { loc: suffixOf(source, "=> 1", 1), hits: 1 },
      { loc: spanOf(source, "(): number => 2"), hits: 1 },
      { loc: suffixOf(source, "=> 2", 1), hits: 0 },
      { loc: spanOf(source, "return text.length"), hits: 1 },
    ],
    branches: [],
  };
}

// Repeated method spellings across two object literals on one line each, a
// class with a constructor, an accessor pair and a method that repeats an
// object method's name, a second class repeating `constructor` and `pick`, a
// function whose real name ends in `_2`, a function declared inside another,
// and a one-line arrow. The producer numbers every repeated spelling; only
// the declaration identifier at each exact span restores the source name.
const declarationsSource = `export const pair = { pick(): number { return 1; }, skip(): number { return 2; } };
export const other = { pick(): number { return 3; }, skip(): number { return 4; } };

export class Counter {
  private value: number;

  constructor() {
    this.value = 1;
  }

  get current(): number {
    return this.value;
  }

  set current(next: number) {
    this.value = next;
  }

  pick(): number {
    return this.value * 2;
  }
}

export class Gauge {
  private level: number;

  constructor(level: number) {
    this.level = level;
  }

  pick(): number {
    return this.level;
  }
}

export function count_2(): number {
  return 5;
}

export function nested(): () => number {
  function pick(): number {
    return 6;
  }

  return pick;
}

export const inline = (n: number): number => n + 1;
`;

const declarationsTest = `import assert from "node:assert/strict";
import test from "node:test";

import {
  Counter,
  Gauge,
  inline,
  nested,
  other,
  pair,
} from "../../extensions/pi-claude-marketplace/domain/declarations.ts";

test("exercises one of each repeated spelling", () => {
  assert.equal(pair.pick(), 1);
  assert.equal(other.skip(), 4);
  assert.equal(new Counter().current, 1);
  assert.equal(new Gauge(2).pick(), 2);
  assert.equal(typeof nested(), "function");
  assert.equal(inline(1), 2);
});
`;

/**
 * Every repeated method and function spelling the producer numbers; only the
 * declaration identifier at its exact span restores the source name.
 */
export function declarationsFixture(): ProducerFixture {
  const source = declarationsSource;

  return {
    name: "declarations",
    sourcePath: "extensions/pi-claude-marketplace/domain/declarations.ts",
    source,
    tests: { "tests/domain/declarations.test.ts": declarationsTest },
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
        name: "pick",
        decl: prefixOf(source, "pick(): number { return 3; }", 4),
        loc: spanOf(source, "{ return 3; }"),
        hits: 0,
      },
      {
        name: "skip",
        decl: prefixOf(source, "skip(): number { return 4; }", 4),
        loc: spanOf(source, "{ return 4; }"),
        hits: 1,
      },
      {
        name: "constructor",
        decl: prefixOf(source, "constructor() {", 11),
        loc: spanOf(source, "{\n    this.value = 1;\n  }"),
        hits: 1,
      },
      {
        name: "current",
        decl: prefixOf(source, "current(): number", 7),
        loc: spanOf(source, "{\n    return this.value;\n  }"),
        hits: 1,
      },
      {
        name: "current",
        decl: prefixOf(source, "current(next: number)", 7),
        loc: spanOf(source, "{\n    this.value = next;\n  }"),
        hits: 0,
      },
      {
        name: "pick",
        decl: prefixOf(source, "pick(): number {\n    return this.value * 2;", 4),
        loc: spanOf(source, "{\n    return this.value * 2;\n  }"),
        hits: 0,
      },
      {
        name: "constructor",
        decl: prefixOf(source, "constructor(level: number)", 11),
        loc: spanOf(source, "{\n    this.level = level;\n  }"),
        hits: 1,
      },
      {
        name: "pick",
        decl: prefixOf(source, "pick(): number {\n    return this.level;", 4),
        loc: spanOf(source, "{\n    return this.level;\n  }"),
        hits: 1,
      },
      {
        name: "count_2",
        decl: spanOf(source, "count_2"),
        loc: spanOf(source, "{\n  return 5;\n}"),
        hits: 0,
      },
      {
        name: "nested",
        decl: spanOf(source, "nested"),
        loc: spanOf(source, "{\n  function pick", "return pick;\n}"),
        hits: 1,
      },
      {
        name: "pick",
        decl: prefixOf(source, "pick(): number {\n    return 6;", 4),
        loc: spanOf(source, "{\n    return 6;\n  }"),
        hits: 0,
      },
      {
        name: "(anonymous_13)",
        decl: prefixOf(source, "(n: number): number => n + 1"),
        loc: spanOf(source, "n + 1"),
        hits: 1,
      },
    ],
    statements: [
      {
        loc: spanOf(source, "{ pick(): number { return 1; }, skip(): number { return 2; } }"),
        hits: 1,
      },
      { loc: spanOf(source, "return 1;"), hits: 1 },
      { loc: spanOf(source, "return 2;"), hits: 0 },
      {
        loc: spanOf(source, "{ pick(): number { return 3; }, skip(): number { return 4; } }"),
        hits: 1,
      },
      { loc: spanOf(source, "return 3;"), hits: 0 },
      { loc: spanOf(source, "return 4;"), hits: 1 },
      { loc: spanOf(source, "this.value = 1;"), hits: 1 },
      { loc: spanOf(source, "return this.value;"), hits: 1 },
      { loc: spanOf(source, "this.value = next;"), hits: 0 },
      { loc: spanOf(source, "return this.value * 2;"), hits: 0 },
      { loc: spanOf(source, "this.level = level;"), hits: 1 },
      { loc: spanOf(source, "return this.level;"), hits: 1 },
      { loc: spanOf(source, "return 5;"), hits: 0 },
      { loc: spanOf(source, "return 6;"), hits: 0 },
      { loc: spanOf(source, "return pick;"), hits: 1 },
      { loc: spanOf(source, "(n: number): number => n + 1"), hits: 1 },
      { loc: spanOf(source, "n + 1"), hits: 1 },
    ],
    branches: [],
  };
}

// The same accessor pair with CRLF line endings and blank lines between
// members: every `\r` is a column of its line, and a converter that splits
// lines on `\r` or drops it from the count reports every later coordinate
// wrong.
const crlfSource = `${[
  "export class Meter {",
  "  private value: number;",
  "",
  "  constructor(value: number) {",
  "    this.value = value;",
  "  }",
  "",
  "  get current(): number {",
  "    return this.value;",
  "  }",
  "",
  "  set current(next: number) {",
  "    this.value = next;",
  "  }",
  "}",
].join("\r\n")}\r\n`;

const crlfTest = `import assert from "node:assert/strict";
import test from "node:test";

import { Meter } from "../../extensions/pi-claude-marketplace/domain/meter.ts";

test("reads the meter", () => {
  assert.equal(new Meter(1).current, 1);
});
`;

/**
 * The same accessor pair under CRLF line endings, so a converter that
 * mishandles `\r` reports every later coordinate wrong.
 */
export function crlfFixture(): ProducerFixture {
  const source = crlfSource;

  return {
    name: "crlf",
    sourcePath: "extensions/pi-claude-marketplace/domain/meter.ts",
    source,
    tests: { "tests/domain/meter.test.ts": crlfTest },
    functions: [
      {
        name: "constructor",
        decl: spanOf(source, "constructor"),
        loc: spanOf(source, "{\r\n    this.value = value;\r\n  }"),
        hits: 1,
      },
      {
        name: "current",
        decl: prefixOf(source, "current(): number", 7),
        loc: spanOf(source, "{\r\n    return this.value;\r\n  }"),
        hits: 1,
      },
      {
        name: "current",
        decl: prefixOf(source, "current(next: number)", 7),
        loc: spanOf(source, "{\r\n    this.value = next;\r\n  }"),
        hits: 0,
      },
    ],
    statements: [
      { loc: spanOf(source, "this.value = value;"), hits: 1 },
      { loc: spanOf(source, "return this.value;"), hits: 1 },
      { loc: spanOf(source, "this.value = next;"), hits: 0 },
    ],
    branches: [],
  };
}
