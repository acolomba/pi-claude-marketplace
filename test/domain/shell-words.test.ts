import assert from "node:assert/strict";
import { test } from "node:test";

import { splitArguments } from "../../extensions/pi-claude-marketplace/domain/shell-words.ts";

const PARSE_LIMIT_WORD = "x".repeat(9_994);
const OVER_LIMIT_WORD = "x".repeat(9_995);

for (const { text, tokens } of [
  { text: "", tokens: [] },
  { text: "   ", tokens: [] },
  { text: "Ada Lovelace", tokens: ["Ada", "Lovelace"] },
  { text: "  Ada\tLovelace  ", tokens: ["Ada", "Lovelace"] },
  { text: "# comment", tokens: ["#", "comment"] },
  { text: "'a b", tokens: ["'a", "b"] },
]) {
  test(`D-CF1-01: splits ${JSON.stringify(text)} into ${JSON.stringify(tokens)}`, () => {
    // arrange
    const expectedTokens = tokens;

    // act
    const splitTokens = splitArguments(text);

    // assert
    assert.deepStrictEqual(splitTokens, expectedTokens);
  });
}

test("D-CF1-01: parses quoting in text of exactly 10,000 characters", () => {
  // arrange
  const text = `'a b' ${PARSE_LIMIT_WORD}`;

  // act
  const splitTokens = splitArguments(text);

  // assert
  assert.deepStrictEqual(splitTokens, ["a b", PARSE_LIMIT_WORD]);
});

test("D-CF1-01: splits text over 10,000 characters on whitespace only", () => {
  // arrange
  const text = `'a b' ${OVER_LIMIT_WORD}`;

  // act
  const splitTokens = splitArguments(text);

  // assert
  assert.deepStrictEqual(splitTokens, ["'a", "b'", OVER_LIMIT_WORD]);
});
