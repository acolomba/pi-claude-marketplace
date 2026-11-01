import assert from "node:assert/strict";
import { test } from "node:test";

import { splitArguments } from "../../extensions/pi-claude-marketplace/domain/shell-words.ts";

const PARSE_LIMIT_WORD = "x".repeat(9_994);
const OVER_LIMIT_WORD = "x".repeat(9_995);

interface TokenRow {
  readonly text: string;
  readonly tokens: readonly string[];
}

interface ResidualRow extends TokenRow {
  readonly upstream: readonly string[];
}

// The golden vectors: Claude Code 2.1.316's `c$o` over tree-sitter-bash 0.25.1,
// one row per input of the research table (D-CF1-01).
const GOLDEN_ROWS: readonly TokenRow[] = [
  { text: "Ada Lovelace", tokens: ["Ada", "Lovelace"] },
  { text: '"Ada Lovelace" engineer', tokens: ["Ada Lovelace", "engineer"] },
  { text: "'a b' c", tokens: ["a b", "c"] },
  { text: "a\\ b c", tokens: ["a b", "c"] },
  { text: '"a \\"b\\"" c', tokens: ['a \\"b\\"', "c"] },
  { text: 'a"b c"d', tokens: ["ab cd"] },
  { text: "fix the bug; then deploy", tokens: ["fix", "the", "bug"] },
  { text: "one && two", tokens: ["one"] },
  { text: "one | two", tokens: ["one"] },
  { text: "a & b", tokens: ["a"] },
  { text: "one;two", tokens: ["one"] },
  { text: "a > out.txt b", tokens: ["a"] },
  { text: "hello $USER world", tokens: ["hello", "world"] },
  { text: "$HOME is home", tokens: ["$HOME", "is", "home"] },
  { text: "x $(date) y", tokens: ["x"] },
  { text: "x `date` y", tokens: ["x"] },
  { text: "foo <(bar) baz", tokens: ["foo"] },
  { text: "KEY=v other", tokens: ["other"] },
  { text: "a=1 b=2", tokens: ["a=1", "b=2"] },
  { text: "foo key=value", tokens: ["foo", "key=value"] },
  { text: "--flag=1 -v", tokens: ["-v"] },
  { text: "# comment", tokens: ["#", "comment"] },
  { text: "foo # comment", tokens: ["foo"] },
  { text: "*.ts src/**", tokens: ["*.ts", "src/**"] },
  { text: "~/x ~", tokens: ["~/x", "~"] },
  { text: "42 7", tokens: ["42", "7"] },
  { text: "pre$X post", tokens: ["pre$X", "post"] },
  { text: "a ${X} b", tokens: ["a", "b"] },
  { text: "$'a\\nb' c", tokens: ["$'a\\nb'", "c"] },
  { text: "\\$1 x", tokens: ["$1", "x"] },
  { text: "foo\\\\bar", tokens: ["foo\\bar"] },
  { text: "a\nb", tokens: ["a"] },
  { text: "if it works", tokens: ["it", "works"] },
  { text: "for x in y", tokens: ["for", "x", "in", "y"] },
  { text: "{ a b }", tokens: ["a", "b", "}"] },
  { text: "(a b)", tokens: ["a", "b"] },
  { text: "[ a ]", tokens: ["[", "a", "]"] },
  { text: "!", tokens: ["!"] },
  { text: "export FOO=1", tokens: ["export"] },
];

// More upstream vectors, taken from the same tree-sitter-bash 0.25.1
// re-run of `Ck`, for the rules the golden table does not reach (D-CF1-01).
const UPSTREAM_ROWS: readonly TokenRow[] = [
  { text: "", tokens: [] },
  { text: "   ", tokens: [] },
  { text: "  Ada\tLovelace  ", tokens: ["Ada", "Lovelace"] },
  { text: "fix the bug that doesn't work", tokens: ["fix", "the", "bug", "that", "doesn"] },
  { text: "'a b", tokens: ["'a", "b"] },
  { text: 'say "hi', tokens: ["say"] },
  { text: 'a b"c d', tokens: ["a", 'b"c d'] },
  { text: 'a b"c d\n', tokens: ["a", 'b"c d'] },
  { text: 'a b"', tokens: ["a", "b"] },
  { text: 'x "a"\\"b"', tokens: ["x", 'a"b"'] },
  { text: 'a b"c\\', tokens: ["a", "b"] },
  { text: 'a b"$(c', tokens: ["a", "b"] },
  { text: 'a b"c`d', tokens: ["a", "b"] },
  { text: 'a $"b c', tokens: ["a", '"b c'] },
  { text: 'a b$"c d', tokens: ["a", 'b$"c d'] },
  { text: "a `b c", tokens: ["a"] },
  { text: "a $'b\\'c' d", tokens: ["a", "d"] },
  { text: "a $'b c", tokens: ["a"] },
  { text: 'a $(b "c)" d) e', tokens: ["a"] },
  { text: "a $(b 'c' \\) d", tokens: ["a"] },
  { text: "a $(b 'c d", tokens: ["a"] },
  { text: "a $((1+2)) b", tokens: ["a", "b"] },
  { text: 'a ${b:-"}"} c', tokens: ["a", "c"] },
  { text: "a ${b{c}} d", tokens: ["a", "d"] },
  { text: "a $ b", tokens: ["a", "b"] },
  { text: "a $1aa b", tokens: ["a", "b"] },
  { text: 'a $"x" b', tokens: ["a", "x", "b"] },
  { text: '$"x" b', tokens: ['$"x"', "b"] },
  { text: 'a "x$(y)z" b', tokens: ["a", "x$(y)z", "b"] },
  { text: 'a "x\\"y" b', tokens: ["a", 'x\\"y', "b"] },
  { text: "a 'b'\\c d", tokens: ["a", "b", "c", "d"] },
  { text: "a 'b'\\\\c d", tokens: ["a", "b\\c", "d"] },
  { text: "a 'b'\\ c", tokens: ["a", "b", "c"] },
  { text: 'x a"b"\\c d', tokens: ["x", "ab", "c", "d"] },
  { text: "a\\\tb c", tokens: ["a", "b", "c"] },
  { text: "a\\\nb c", tokens: ["a", "b", "c"] },
  { text: "a b\\", tokens: ["a", "b"] },
  { text: "\\ a b", tokens: ["a", "b"] },
  { text: "a\r\nb", tokens: ["a"] },
  { text: "\n\na b", tokens: ["a", "b"] },
  { text: "a 2>err b", tokens: ["a"] },
  { text: "> out a b", tokens: ["a", "b"] },
  { text: "a <<<x b", tokens: ["a", "b"] },
  { text: "a|&b", tokens: ["a"] },
  { text: "a (b) c", tokens: ["a"] },
  { text: "1) first 2) second", tokens: ["1", "first", "2", "second"] },
  { text: "x$(date)y z", tokens: ["x$(date)y", "z"] },
  { text: "$(date) x", tokens: ["$(date)", "x"] },
  { text: "a=(1 2) b c", tokens: ["b", "c"] },
  { text: "1a=2 b c", tokens: ["b", "c"] },
  { text: "A=1; foo bar", tokens: ["foo", "bar"] },
  { text: "unset A; b c", tokens: ["b", "c"] },
  { text: "declare -x A", tokens: ["declare"] },
  { text: "{ a b; }", tokens: ["a", "b"] },
  { text: "(a b); c d", tokens: ["a", "b"] },
  { text: "! a b", tokens: ["a", "b"] },
  { text: '!"a" b', tokens: ["a", "b"] },
  { text: "!a b", tokens: ["!a", "b"] },
  { text: "while a b", tokens: ["a", "b"] },
  { text: "if'x' y", tokens: ["x", "y"] },
  { text: "[ 'a' ]; b c", tokens: ["b", "c"] },
  { text: "[ a < b ]; c d", tokens: ["c", "d"] },
  { text: "for x in y; do a b; done", tokens: ["a", "b"] },
  { text: "((a)) b c", tokens: ["b", "c"] },
  { text: "# c\nfoo bar", tokens: ["foo", "bar"] },
  { text: '"a"\\$ b', tokens: ["a", "b"] },
  { text: '"cost"\\$ 5 now', tokens: ["cost", "5", "now"] },
  { text: "$X\\$ b", tokens: ["$X", "b"] },
  { text: '"a"\\$"b" c', tokens: ["a", "b", "c"] },
  { text: 'x "a"\\$5 y', tokens: ["x", "a", "$5", "y"] },
  { text: "x 'a'\\$ y", tokens: ["x", "a", "y"] },
  { text: 'x "a"\\$', tokens: ["x", "a"] },
  { text: 'x "a"\\$\n b', tokens: ["x", "a"] },
  { text: "x $\\$ b", tokens: ["x", "$", "b"] },
  { text: 'x "s"\\\\$\\$ b', tokens: ["x", "s\\$", "$", "b"] },
  { text: 'x <<< "a"\\$ b', tokens: ["x", "b"] },
  { text: '> "a"\\$ b', tokens: ["$", "b"] },
  { text: 'x="a"\\$ b c', tokens: ["$", "b", "c"] },
  { text: "x='a'\\$ b", tokens: ["$", "b"] },
  { text: "x=$X\\$ b", tokens: ["$", "b"] },
  { text: 'x=b"a"\\$ b', tokens: ["$", "b"] },
];

// D-CF1-01 licensed residual: tree-sitter-bash error recovery and expansion
// lexing that the port does not reproduce. Each row asserts the port's own
// output and records what upstream gives.
const RESIDUAL_ROWS: readonly ResidualRow[] = [
  { text: "a ${b c", tokens: ["a"], upstream: ["a", "c"] },
  { text: "_=1 b", tokens: ["b"], upstream: ["_=1", "b"] },
  { text: '"a"\\$(b) c', tokens: ["a", "$"], upstream: ["a"] },
  { text: 'x "a"\\$)b c', tokens: ["x", "a", "$", "b", "c"], upstream: ["x", "a", "$)b", "c"] },
  { text: "!{ b", tokens: ["!{", "b"], upstream: ["{", "b"] },
  { text: ") a b", tokens: ["a", "b"], upstream: ["b"] },
  { text: "[ ( ]; b c", tokens: ["b", "c"], upstream: ["]"] },
  { text: "for x in (y); do a b; done", tokens: ["a", "b"], upstream: ["y"] },
  { text: "$@-$1", tokens: ["$@-$1"], upstream: ["$@-$", "1"] },
  { text: 'ab"a\\"', tokens: ['ab"a\\"'], upstream: ["aba\\"] },
];

for (const { text, tokens } of [...GOLDEN_ROWS, ...UPSTREAM_ROWS]) {
  test(`D-CF1-01: splits ${JSON.stringify(text)} into ${JSON.stringify(tokens)}`, () => {
    // arrange
    const expectedTokens = tokens;

    // act
    const splitTokens = splitArguments(text);

    // assert
    assert.deepStrictEqual(splitTokens, expectedTokens);
  });
}

for (const { text, tokens, upstream } of RESIDUAL_ROWS) {
  test(`D-CF1-01 residual: splits ${JSON.stringify(text)} into ${JSON.stringify(tokens)}, not upstream's ${JSON.stringify(upstream)}`, () => {
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

test("D-CF1-01: scans deeply nested quoting without overflowing the stack", () => {
  // arrange
  const text = `x ${'"$('.repeat(3_000)}`;

  // act
  const splitTokens = splitArguments(text);

  // assert
  assert.deepStrictEqual(splitTokens, ["x"]);
});
