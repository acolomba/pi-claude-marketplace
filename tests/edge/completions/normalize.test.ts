// tests/edge/completions/normalize.test.ts
//
// TC-7 coverage for normalizeCompletionWhitespace + isClaudePluginCommandLine.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isClaudePluginCommandLine,
  normalizeCompletionWhitespace,
} from "../../../extensions/pi-claude-marketplace/edge/completions/normalize.ts";

test("TC-7 :: normalize collapses two spaces at cursor to one", () => {
  // Layout: "list  --installed"; cursor between the two spaces (col 5).
  //  - line[col-1] = " " (the 4th char, 0-indexed col 4)  -- wait check
  // Cursor before col 5 means line[4] is right of cursor; line[3] is left.
  // "list  --installed"
  //  0123456789
  // l=0 i=1 s=2 t=3 ' '=4 ' '=5 -=6 ...
  // cursorCol = 5: line[4]=' ' (cursor-1), line[5]=' ' (cursor) -> collapse.
  const result = normalizeCompletionWhitespace({
    lines: ["list  --installed"],
    cursorLine: 0,
    cursorCol: 5,
  });
  assert.deepEqual(result.lines, ["list --installed"]);
  assert.equal(result.cursorLine, 0);
  assert.equal(result.cursorCol, 5);
});

test("TC-7 :: normalize is a no-op when no doubled space at cursor", () => {
  const result = normalizeCompletionWhitespace({
    lines: ["install foo@bar"],
    cursorLine: 0,
    cursorCol: 8,
  });
  assert.deepEqual(result.lines, ["install foo@bar"]);
  assert.equal(result.cursorCol, 8);
});

test("TC-7 :: normalize is a no-op at end-of-line trailing space", () => {
  // "list " with cursor at end (col 5). line[4]=' ', line[5]=undefined.
  // No doubled space at cursor -> no-op.
  const result = normalizeCompletionWhitespace({
    lines: ["list "],
    cursorLine: 0,
    cursorCol: 5,
  });
  assert.deepEqual(result.lines, ["list "]);
  assert.equal(result.cursorCol, 5);
});

test("TC-7 :: normalize is idempotent (stacked wrapper safe)", () => {
  const first = normalizeCompletionWhitespace({
    lines: ["list  --installed"],
    cursorLine: 0,
    cursorCol: 5,
  });
  const second = normalizeCompletionWhitespace(first);
  assert.deepEqual(second.lines, first.lines);
  assert.equal(second.cursorLine, first.cursorLine);
  assert.equal(second.cursorCol, first.cursorCol);
});

test("isClaudePluginCommandLine :: matches /claude:plugin", () => {
  assert.equal(isClaudePluginCommandLine("/claude:plugin"), true);
});

test("isClaudePluginCommandLine :: matches /claude:plugin install", () => {
  assert.equal(isClaudePluginCommandLine("/claude:plugin install foo@bar"), true);
});

test("isClaudePluginCommandLine :: matches /claude:plugin:42 install (collision suffix)", () => {
  assert.equal(isClaudePluginCommandLine("/claude:plugin:42 install foo@bar"), true);
});

test("isClaudePluginCommandLine :: does not match /other-extension", () => {
  assert.equal(isClaudePluginCommandLine("/other-extension install foo"), false);
});

test("isClaudePluginCommandLine :: does not match claude:plugin (no leading slash)", () => {
  assert.equal(isClaudePluginCommandLine("claude:plugin install foo"), false);
});

test("isClaudePluginCommandLine :: does not match /claude:plugin-extra", () => {
  assert.equal(isClaudePluginCommandLine("/claude:plugin-extra install"), false);
});
