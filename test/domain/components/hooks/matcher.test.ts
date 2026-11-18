import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  parseMatcher,
  parseNameMatcher,
} from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts";

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

  test("splits comma and pipe lists while trimming surrounding ASCII spaces", () => {
    // arrange
    const raw = " Edit, Write | Read , Bash | Edit ";

    // act
    const matcher = parseMatcher(raw);

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "tool-set",
      toolNames: new Set(["edit", "write", "read", "bash"]),
    });
  });

  test("keeps spaces inside one literal and discards empty list members", () => {
    // arrange

    // act
    const spaced = parseMatcher("Read Write, Bash");
    const empty = parseMatcher(" , | , ");

    // assert
    assert.deepStrictEqual(spaced, { kind: "tool-set", toolNames: new Set(["bash"]) });
    assert.deepStrictEqual(empty, { kind: "tool-set", toolNames: new Set() });
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

  for (const expression of [
    "mcp__plugin_acme_db__.*",
    "mcp__plugin_my-plugin_database-tools__.*",
    "mcp__plugin_acme_db__.*|Write",
    "mcp__*",
    "mcp__acme__get_.*",
    "mcp__a.b__.*",
    "mcp____.*",
    "mcp__plugin_acme_db__.*|.*",
  ]) {
    test(`compiles ${expression} as one whole regex`, () => {
      // arrange

      // act
      const matcher = parseMatcher(expression);

      // assert
      assert.deepStrictEqual(matcher, { kind: "regex", pattern: new RegExp(expression) });
    });
  }

  test("ANAME-02: reports mcp__acme__ without the .* wildcard as unmapped", () => {
    // arrange

    // act
    const matcher = parseMatcher("mcp__acme__");

    // assert
    assert.deepStrictEqual(matcher, { kind: "unmapped", token: "mcp__acme__" });
  });

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
    ".*",
    "Edit$",
    "(Edit)",
    "mcp__bad!__tool",
    "mcp__server__bad!",
  ]) {
    test(`compiles the regex matcher ${expression} without flags`, () => {
      // arrange

      // act
      const matcher = parseMatcher(expression);

      // assert
      assert.deepStrictEqual(matcher, { kind: "regex", pattern: new RegExp(expression) });
    });
  }

  test("compiles an MCP matcher that differs from a literal by one regex character", () => {
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
    assert.deepStrictEqual(unsafeMatcher, { kind: "regex", pattern: /mcp__server__tool!/ });
  });

  for (const expression of ["[", "*bash", "(Read"] as const) {
    test(`marks invalid regex ${expression} without throwing`, () => {
      // arrange

      // act
      const matcher = parseMatcher(expression);

      // assert
      assert.deepStrictEqual(matcher, { kind: "invalid-pattern" });
    });
  }

  test("compiles non-ASCII regex with JavaScript's default UTF-16 behavior", () => {
    // arrange

    // act
    const matcher = parseMatcher("é");

    // assert
    assert.deepStrictEqual(matcher, { kind: "regex", pattern: /é/ });
  });
});

describe("parseNameMatcher", () => {
  for (const sentinel of ["", "*"]) {
    test(`D-PG6-19: maps ${JSON.stringify(sentinel)} to match-all`, () => {
      // arrange

      // act
      const matcher = parseNameMatcher(sentinel);

      // assert
      assert.deepStrictEqual(matcher, { kind: "match-all" });
    });
  }

  test("D-PG6-19: splits an exact list on commas and pipes and trims each name", () => {
    // arrange

    // act
    const matcher = parseNameMatcher("deploy, ship | test");

    // assert
    assert.deepStrictEqual(matcher, {
      kind: "name-set",
      names: new Set(["deploy", "ship", "test"]),
    });
  });

  test("D-PG6-19: keeps exact names as written, with no tool map, and drops empty members", () => {
    // arrange

    // act
    const matcher = parseNameMatcher("Bash,,Deploy|");

    // assert
    assert.deepStrictEqual(matcher, { kind: "name-set", names: new Set(["Bash", "Deploy"]) });
  });

  test("D-PG6-19: reads a name with a colon as an unanchored expression with no flags", () => {
    // arrange
    const matcher = parseNameMatcher("demo:deploy");
    assert.ok(matcher.kind === "regex");

    // act
    const matches = ["demo:deploy", "demo:deploy-all", "deploy", "Demo:Deploy"].map((name) =>
      matcher.pattern.test(name),
    );

    // assert
    assert.deepStrictEqual(
      { pattern: matcher.pattern, matches },
      { pattern: /demo:deploy/, matches: [true, true, false, false] },
    );
  });

  test("D-PG6-19: an anchored expression matches only its one name", () => {
    // arrange
    const matcher = parseNameMatcher("^claude-security:claude-security$");
    assert.ok(matcher.kind === "regex");

    // act
    const matches = [
      "claude-security:claude-security",
      "claude-security:claude-security-scan",
      "x-claude-security:claude-security",
    ].map((name) => matcher.pattern.test(name));

    // assert
    assert.deepStrictEqual(matches, [true, false, false]);
  });

  test("D-PG6-19: reports an expression that does not compile as an invalid pattern", () => {
    // arrange

    // act
    const matcher = parseNameMatcher("[");

    // assert
    assert.deepStrictEqual(matcher, { kind: "invalid-pattern" });
  });
});
