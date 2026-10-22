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
        toolNames: new Set([piTool]),
      });
    });
  }

  test("maps multiple tool tokens to their Pi-form spellings", () => {
    // arrange

    // act
    const matcher = parseMatcher("Write|Read|Grep");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["write", "read", "grep"]),
    });
  });

  test("deduplicates repeated tool tokens", () => {
    // arrange

    // act
    const matcher = parseMatcher("Read|Write|Grep|Read|Write");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["read", "write", "grep"]),
    });
  });

  for (const literal of [
    "mcp__github__create_issue",
    "mcp__server__tool",
    "mcp__my-server-1__some_tool",
    "mcp__server__nested__tool",
    "mcp__plugin_acme_db__query",
  ]) {
    test(`keeps the MCP tool name ${literal} as a matcher member`, () => {
      // arrange

      // act
      const matcher = parseMatcher(literal);

      // assert
      assert.deepStrictEqual(matcher, { kind: "tool-set", toolNames: new Set([literal]) });
    });
  }

  test("keeps a mapped alternative beside an MCP alternative in the same matcher", () => {
    // arrange

    // act
    const matcher = parseMatcher("Edit|mcp__server__tool|Write");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["edit", "mcp__server__tool", "write"]),
    });
  });

  test("keeps a foreign alternative's mapped siblings instead of dropping the whole group (#217)", () => {
    // arrange

    // act
    const matcher = parseMatcher("Write|Edit|apply_patch");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["write", "edit"]),
    });
  });

  test("keeps two mapped alternatives beside a foreign one", () => {
    // arrange

    // act
    const matcher = parseMatcher("Edit|Write|MultiEdit");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["edit", "write"]),
    });
  });

  test("keeps an MCP alternative beside a foreign one", () => {
    // arrange

    // act
    const matcher = parseMatcher("apply_patch|mcp__server__tool");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["mcp__server__tool"]),
    });
  });

  for (const { matcherText, prefix } of [
    { matcherText: "mcp__plugin_acme_db__.*", prefix: "mcp__plugin_acme_db__" },
    {
      matcherText: "mcp__plugin_my-plugin_database-tools__.*",
      prefix: "mcp__plugin_my-plugin_database-tools__",
    },
  ]) {
    test(`ANAME-02: parses ${matcherText} as the server prefix ${prefix}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(matcherText);

      // assert
      assert.deepStrictEqual(matcher, {
        kind: "tool-set",
        toolNames: new Set(),
        toolPrefixes: [prefix],
      });
    });
  }

  test("ANAME-02: keeps a server-prefix alternative beside a mapped tool in a pipe matcher", () => {
    // arrange

    // act
    const matcher = parseMatcher("mcp__plugin_acme_db__.*|Write");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["write"]),
      toolPrefixes: ["mcp__plugin_acme_db__"],
    });
  });

  test("ANAME-02: omits toolPrefixes when no alternative is a server prefix", () => {
    // arrange

    // act
    const matcher = parseMatcher("Write|Edit");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["write", "edit"]),
    });
  });

  test("ANAME-02: reports mcp__acme__ without the .* wildcard as unmapped", () => {
    // arrange

    // act
    const matcher = parseMatcher("mcp__acme__");

    // assert
    assert.deepStrictEqual(matcher, { kind: "unmapped", token: "mcp__acme__" });
  });

  for (const expression of [
    "mcp__*",
    "mcp__acme__get_.*",
    "mcp__a.b__.*",
    "mcp____.*",
    "mcp__plugin_acme_db__.*|.*",
  ]) {
    test(`MATCH-02: rejects the MCP regex matcher ${expression}`, () => {
      // arrange

      // act
      const matcher = parseMatcher(expression);

      // assert
      assert.deepStrictEqual(matcher, { kind: "regex" });
    });
  }

  test("reports the first discarded alternative when no alternative survives", () => {
    // arrange

    // act
    const matcher = parseMatcher("apply_patch|MultiEdit");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "unmapped",
      token: "apply_patch",
    });
  });

  for (const token of [
    "edit",
    "MultiEdit",
    "WebFetch",
    "Task",
    "toString",
    "constructor",
    "__proto__",
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
        token,
      });
    });
  }

  for (const expression of [
    "Edit.*",
    "Edit+",
    "Read?",
    "Write[0]",
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

  test("rejects an MCP matcher that differs from a valid literal by one unsafe character", () => {
    // arrange
    const validLiteral = "mcp__server__tool";
    const unsafeLiteral = "mcp__server__tool!";

    // act
    const validMatcher = parseMatcher(validLiteral);
    const unsafeMatcher = parseMatcher(unsafeLiteral);

    // assert
    assert.deepStrictEqual(validMatcher, {
      kind: "tool-set",
      toolNames: new Set([validLiteral]),
    });
    assert.deepStrictEqual(unsafeMatcher, { kind: "regex" });
  });
});
