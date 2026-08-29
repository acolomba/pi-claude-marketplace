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

  test("maps multiple tool tokens in source order", () => {
    // arrange

    // act
    const matcher = parseMatcher("Write|Read|Grep");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      piTools: new Set(["write", "read", "grep"]),
    });
  });

  test("deduplicates repeated tool tokens without changing first-occurrence order", () => {
    // arrange

    // act
    const matcher = parseMatcher("Read|Write|Grep|Read|Write");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      piTools: new Set(["read", "write", "grep"]),
    });
  });

  for (const literal of [
    "mcp__github__create_issue",
    "mcp__server__tool",
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

  test("reports the first unmapped token after a mapped token", () => {
    // arrange

    // act
    const matcher = parseMatcher("Edit|mcp__server__tool|Write");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "unmapped",
      token: "mcp__server__tool",
    });
  });

  for (const token of [
    "edit",
    "MultiEdit",
    "WebFetch",
    "Task",
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
