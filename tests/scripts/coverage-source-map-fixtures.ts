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
