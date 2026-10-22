// Owner for edge/completions/normalize.ts (TC-7).
//
// Comparison form for `isClaudePluginCommandLine`: the candidate line is tested
// against an anchored regular expression that carries no `i` flag, and the module
// calls neither a case-mapping function nor `String.prototype.normalize`. Candidates
// are therefore compared as raw UTF-16 code units -- no case folding and no Unicode
// normalization is applied. The reject rows below prove both halves of that claim.

import assert from "node:assert/strict";
import test from "node:test";

import {
  isClaudePluginCommandLine,
  normalizeCompletionWhitespace,
} from "../../../extensions/pi-claude-marketplace/edge/completions/normalize.ts";

for (const { commandLine, spaceRun } of [
  { commandLine: "list  --installed", spaceRun: 2 },
  { commandLine: "list   --installed", spaceRun: 3 },
  { commandLine: "list    --installed", spaceRun: 4 },
]) {
  test(`normalizeCompletionWhitespace collapses a run of ${spaceRun} spaces at the cursor to one`, () => {
    // arrange
    const expectedNormalized = { lines: ["list --installed"], cursorLine: 0, cursorCol: 5 };

    // act
    const normalized = normalizeCompletionWhitespace({
      lines: [commandLine],
      cursorLine: 0,
      cursorCol: 5,
    });

    // assert
    assert.deepStrictEqual(normalized, expectedNormalized);
  });
}

for (const { commandLine, cursorCol, situation } of [
  {
    commandLine: "list  --installed",
    cursorCol: 4,
    situation: "the character before the cursor is not a space",
  },
  {
    commandLine: "list  --installed",
    cursorCol: 6,
    situation: "the character at the cursor is not a space",
  },
  {
    commandLine: "list ",
    cursorCol: 5,
    situation: "the cursor sits past the last character",
  },
  {
    commandLine: "  list",
    cursorCol: 0,
    situation: "the cursor is at column zero",
  },
]) {
  test(`normalizeCompletionWhitespace is a no-op when ${situation}`, () => {
    // arrange
    const expectedNormalized = { lines: [commandLine], cursorLine: 0, cursorCol };

    // act
    const normalized = normalizeCompletionWhitespace({
      lines: [commandLine],
      cursorLine: 0,
      cursorCol,
    });

    // assert
    assert.deepStrictEqual(normalized, expectedNormalized);
  });
}

test("normalizeCompletionWhitespace is a no-op when the cursor line is outside the lines array", () => {
  // arrange
  const expectedNormalized = { lines: ["list  --installed"], cursorLine: 3, cursorCol: 5 };

  // act
  const normalized = normalizeCompletionWhitespace({
    lines: ["list  --installed"],
    cursorLine: 3,
    cursorCol: 5,
  });

  // assert
  assert.deepStrictEqual(normalized, expectedNormalized);
});

test("normalizeCompletionWhitespace rewrites the cursor line and leaves every other line alone", () => {
  // arrange
  const expectedNormalized = {
    lines: ["marketplace  list", "list --installed", "install  foo@bar"],
    cursorLine: 1,
    cursorCol: 5,
  };

  // act
  const normalized = normalizeCompletionWhitespace({
    lines: ["marketplace  list", "list  --installed", "install  foo@bar"],
    cursorLine: 1,
    cursorCol: 5,
  });

  // assert
  assert.deepStrictEqual(normalized, expectedNormalized);
});

for (const { commandLine, situation } of [
  { commandLine: "list  --installed", situation: "it collapses a space run" },
  { commandLine: "list --installed", situation: "it takes the no-op path" },
]) {
  test(`normalizeCompletionWhitespace returns a fresh lines array when ${situation}`, () => {
    // arrange
    const inputLines = [commandLine];
    const expectedInputLines = [commandLine];

    // act
    const normalized = normalizeCompletionWhitespace({
      lines: inputLines,
      cursorLine: 0,
      cursorCol: 5,
    });
    normalized.lines[0] = "overwritten through the returned array";

    // assert
    assert.deepStrictEqual(inputLines, expectedInputLines);
  });
}

for (const { commandLine, recognized, behavior } of [
  {
    commandLine: "/claude:plugin",
    recognized: true,
    behavior: "accepts the bare command with nothing after it",
  },
  {
    commandLine: "/claude:plugin install foo@bar",
    recognized: true,
    behavior: "accepts the command followed by a space and arguments",
  },
  {
    commandLine: "/claude:plugin:42",
    recognized: true,
    behavior: "accepts the bare collision-suffix form",
  },
  {
    commandLine: "/claude:plugin:42 install foo@bar",
    recognized: true,
    behavior: "accepts the collision-suffix form followed by arguments",
  },
  {
    commandLine: "/CLAUDE:PLUGIN",
    recognized: false,
    behavior: "rejects the all-upper-case spelling, because it applies no case folding",
  },
  {
    commandLine: "/Claude:Plugin install foo@bar",
    recognized: false,
    behavior: "rejects the title-case spelling, because it applies no case folding",
  },
  {
    commandLine: "/claude:\uFF50lugin install foo@bar",
    recognized: false,
    behavior:
      "rejects a fullwidth p whose NFKC form is the accepted command, because it applies no Unicode normalization",
  },
  {
    commandLine: "/claude:plugin-extra install",
    recognized: false,
    behavior: "rejects a longer command name that starts with the same characters",
  },
  {
    commandLine: "/claude:plugin:beta install",
    recognized: false,
    behavior: "rejects a colon suffix that is not digits",
  },
  {
    commandLine: "run /claude:plugin install",
    recognized: false,
    behavior: "rejects a line that contains the command but does not start with it",
  },
  {
    commandLine: "",
    recognized: false,
    behavior: "rejects the empty string",
  },
]) {
  test(`isClaudePluginCommandLine ${behavior}`, () => {
    // arrange
    const expectedRecognized = recognized;

    // act
    const isCommandLine = isClaudePluginCommandLine(commandLine);

    // assert
    assert.strictEqual(isCommandLine, expectedRecognized);
  });
}
