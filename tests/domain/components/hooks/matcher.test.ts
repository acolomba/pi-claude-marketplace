import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseMatcher } from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts";

describe("parseMatcher", () => {
  for (const sentinel of ["", "*"]) {
    test(`maps ${JSON.stringify(sentinel)} to match-all`, () => {
      // arrange

      // act
      const matcher = parseMatcher(sentinel);

      // assert
      assert.deepStrictEqual(matcher, { kind: "match-all" });
    });
  }

  for (const [claudeTool, piTool] of [
    ["Bash", "bash"],
    ["Read", "read"],
    ["Edit", "edit"],
    ["Write", "write"],
    ["Grep", "grep"],
    ["Glob", "find"],
    ["LS", "ls"],
  ] as const) {
    test(`maps ${claudeTool} to ${piTool}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(claudeTool);

      // assert
      assert.deepStrictEqual(matcher, {
        kind: "tool-set",
        piTools: new Set([piTool]),
      });
    });
  }

  test("maps an alternation to one tool set", () => {
    // arrange

    // act
    const matcher = parseMatcher("Read|Write|Grep|Read");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      piTools: new Set(["read", "write", "grep"]),
    });
  });

  for (const literal of [
    "mcp__github__create_issue",
    "mcp__my-server-1__some_tool",
    "mcp__server__nested__tool",
  ]) {
    test(`keeps the MCP literal ${literal}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(literal);

      // assert
      assert.deepStrictEqual(matcher, { kind: "mcp-literal", literal });
    });
  }

  for (const token of [
    "edit",
    "MultiEdit",
    "WebFetch",
    "Task",
    "Edit|mcp__server__tool",
    "mcp____tool",
    "mcp__server",
    "mcp__server__",
  ]) {
    test(`reports the first unmapped token in ${token}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(token);

      // assert
      assert.deepStrictEqual(matcher, {
        kind: "unmapped",
        token: token.includes("|") ? "mcp__server__tool" : token,
      });
    });
  }

  for (const expression of [
    "Edit.*",
    "*bash",
    ".*",
    "Edit$",
    "(Edit)",
    "|",
    "Edit|",
    "|Edit",
    "Edit||Write",
    "mcp__bad!__tool",
    "mcp__server__bad!",
  ]) {
    test(`rejects the regex or malformed matcher ${expression}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(expression);

      // assert
      assert.deepStrictEqual(matcher, { kind: "regex" });
    });
  }
});
