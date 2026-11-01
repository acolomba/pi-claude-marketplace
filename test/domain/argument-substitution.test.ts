import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  claudeEffort,
  InvocationTooLargeError,
  parseArgumentNames,
  substituteArguments,
} from "../../extensions/pi-claude-marketplace/domain/argument-substitution.ts";

import type { ClaudeEffort } from "../../extensions/pi-claude-marketplace/domain/argument-substitution.ts";

describe("substituteArguments", () => {
  test("D-CF1-01: replaces $0 and $1 with the first and second argument", () => {
    // arrange
    const body = "Hi $0 and $1";

    // act
    const content = substituteArguments({
      body,
      args: "Ada Lovelace",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Hi Ada and Lovelace");
  });

  test("D-CF1-01: leaves $5 literal when only two arguments exist", () => {
    // arrange
    const body = "Hi $0, $5";

    // act
    const content = substituteArguments({
      body,
      args: "Ada Lovelace",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Hi Ada, $5");
  });

  test("D-CF1-01: replaces $ARGUMENTS[1] with the second argument", () => {
    // arrange
    const body = "Last: $ARGUMENTS[1]";

    // act
    const content = substituteArguments({
      body,
      args: "Ada Lovelace",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Last: Lovelace");
  });

  test("D-CF1-01: leaves a missing $ARGUMENTS[9] literal for the $ARGUMENTS pass", () => {
    // arrange
    const body = "$0: $ARGUMENTS[9]";

    // act
    const content = substituteArguments({
      body,
      args: "Ada Lovelace",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Ada: $ARGUMENTS[9]");
  });

  test("D-CF1-01: replaces $ARGUMENTS with the raw argument text", () => {
    // arrange
    const body = "Hi $ARGUMENTS!";

    // act
    const content = substituteArguments({
      body,
      args: "Ada  'Lovelace'",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Hi Ada  'Lovelace'!");
  });

  test("D-CF1-01: appends the arguments when the body references none", () => {
    // arrange
    const body = "Say hello.";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Say hello.\n\nARGUMENTS: Ada");
  });

  test("D-CF1-01: appends nothing when the argument text is empty", () => {
    // arrange
    const body = "Say hello.";

    // act
    const content = substituteArguments({ body, args: "", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Say hello.");
  });

  test("D-CF1-01: appends nothing when append is false", () => {
    // arrange
    const body = "Say hello.";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: [],
      variables: {},
      append: false,
    });

    // assert
    assert.strictEqual(content, "Say hello.");
  });

  test("D-CF1-01: returns the body unchanged when no arguments were given", () => {
    // arrange
    const body = "Hi $0 and $ARGUMENTS";

    // act
    const content = substituteArguments({
      body,
      args: undefined,
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Hi $0 and $ARGUMENTS");
  });

  test("D-CF1-01: turns an escaped \\$0 into a literal $0", () => {
    // arrange
    const body = "Cost: \\$0 for $0";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Cost: $0 for Ada");
  });

  test("D-CF1-01: still substitutes $0 after an escaped backslash", () => {
    // arrange
    const body = "Path: \\\\$0";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Path: \\\\Ada");
  });

  test("D-CF1-01: keeps an escaped \\$ARGUMENTS literal and appends the arguments", () => {
    // arrange
    const body = "Use \\$ARGUMENTS";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Use $ARGUMENTS\n\nARGUMENTS: Ada");
  });

  test("D-CF1-01: turns an escaped declared \\$name into a literal $name", () => {
    // arrange
    const body = "\\$name is $name";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: ["name"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "$name is Ada");
  });

  test("D-CF1-01: leaves a backslash before any other $ text in place", () => {
    // arrange
    const body = "Keep \\$x";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "Keep \\$x\n\nARGUMENTS: Ada");
  });

  test("D-CF1-01: replaces a named $name with the argument at its declared index", () => {
    // arrange
    const body = "$last, $first";

    // act
    const content = substituteArguments({
      body,
      args: "Ada Lovelace",
      argumentNames: ["first", "last"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Lovelace, Ada");
  });

  test("D-CF1-01: replaces a named argument that was not given with the empty string", () => {
    // arrange
    const body = "[$last]";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: ["first", "last"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "[]");
  });

  test("D-CF1-01: does not read $names or $name[0] as the declared $name", () => {
    // arrange
    const body = "$names $name[0] $name";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: ["name"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "$names $name[0] Ada");
  });

  test("D-CF1-01: replaces the longest declared name first", () => {
    // arrange
    const body = "$a-b";

    // act
    const content = substituteArguments({
      body,
      args: "x y",
      argumentNames: ["a", "a-b"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "y");
  });

  test("D-CF1-01: skips a name over 64 characters and keeps the next name's index", () => {
    // arrange
    const longName = "n".repeat(65);
    const body = `$short $${longName}`;

    // act
    const content = substituteArguments({
      body,
      args: "x y",
      argumentNames: [longName, "short"],
      variables: {},
    });

    // assert
    assert.strictEqual(content, `y $${longName}`);
  });

  test("D-CF1-01: honors only the first 64 declared names", () => {
    // arrange
    const argumentNames = Array.from({ length: 65 }, (_, index) => `n${index}`);
    const args = Array.from({ length: 65 }, (_, index) => `a${index}`).join(" ");
    const body = "$n63 $n64";

    // act
    const content = substituteArguments({ body, args, argumentNames, variables: {} });

    // assert
    assert.strictEqual(content, "a63 $n64");
  });

  test("D-CF1-01: never substitutes a value again in a later pass", () => {
    // arrange
    const body = "A $0 B";

    // act
    const content = substituteArguments({ body, args: "$1", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "A $1 B");
  });

  test("D-CF1-01: leaves ${1:-x}, $@, and ${@:2} literal", () => {
    // arrange
    const body = "${1:-x} $@ ${@:2} $0";

    // act
    const content = substituteArguments({ body, args: "Ada", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "${1:-x} $@ ${@:2} Ada");
  });

  test("D-CF1-01: puts a backslash before a word-initial ! in an argument", () => {
    // arrange
    const body = "Flag: $0";

    // act
    const content = substituteArguments({
      body,
      args: "!important",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Flag: \\!important");
  });

  test("D-CF1-01: splits backtick-bang pairs in an argument value", () => {
    // arrange
    const body = "Run $ARGUMENTS";

    // act
    const content = substituteArguments({
      body,
      args: "`!ls` and !`ls`",
      argumentNames: [],
      variables: {},
    });

    // assert
    assert.strictEqual(content, "Run ` \\!ls` and \\! `ls`");
  });

  test("D-CF1-01: expands the session and effort variables in the body", () => {
    // arrange
    const body = "Session ${CLAUDE_SESSION_ID} at ${CLAUDE_EFFORT}: $0";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: [],
      variables: { CLAUDE_SESSION_ID: "s-1", CLAUDE_EFFORT: "high" },
    });

    // assert
    assert.strictEqual(content, "Session s-1 at high: Ada");
  });

  test("D-CF1-01: expands variables the user typed in an argument", () => {
    // arrange
    const body = "Id: $0";

    // act
    const content = substituteArguments({
      body,
      args: "${CLAUDE_SESSION_ID}",
      argumentNames: [],
      variables: { CLAUDE_SESSION_ID: "s-1" },
    });

    // assert
    assert.strictEqual(content, "Id: s-1");
  });

  test("D-CF1-01: expands the six Claude variables and leaves other names literal", () => {
    // arrange
    const body =
      "${CLAUDE_PLUGIN_ROOT} ${CLAUDE_PROJECT_DIR} ${CLAUDE_PLUGIN_DATA} ${CLAUDE_SKILL_DIR} ${CLAUDE_SESSION_ID} ${CLAUDE_EFFORT} ${OTHER} ${user_config.token}";

    // act
    const content = substituteArguments({
      body,
      args: undefined,
      argumentNames: [],
      variables: {
        CLAUDE_PLUGIN_ROOT: "r",
        CLAUDE_PROJECT_DIR: "p",
        CLAUDE_PLUGIN_DATA: "d",
        CLAUDE_SKILL_DIR: "k",
        CLAUDE_SESSION_ID: "s",
        CLAUDE_EFFORT: "max",
        OTHER: "o",
      },
    });

    // assert
    assert.strictEqual(content, "r p d k s max ${OTHER} ${user_config.token}");
  });

  test("D-CF1-01: applies the variables in Claude Code's fixed order", () => {
    // arrange
    const body = "${CLAUDE_PLUGIN_ROOT}|${CLAUDE_SESSION_ID}";

    // act
    const content = substituteArguments({
      body,
      args: undefined,
      argumentNames: [],
      variables: {
        CLAUDE_SESSION_ID: "${CLAUDE_PLUGIN_ROOT}",
        CLAUDE_PLUGIN_ROOT: "/r/${CLAUDE_SESSION_ID}",
      },
    });

    // assert
    assert.strictEqual(content, "/r/${CLAUDE_PLUGIN_ROOT}|${CLAUDE_PLUGIN_ROOT}");
  });

  test("D-CF1-01: never reads a variable value in the argument passes", () => {
    // arrange
    const body = "${CLAUDE_SESSION_ID}";

    // act
    const content = substituteArguments({
      body,
      args: "Ada",
      argumentNames: [],
      variables: { CLAUDE_SESSION_ID: "$0" },
    });

    // assert
    assert.strictEqual(content, "$0\n\nARGUMENTS: Ada");
  });

  test("D-CF1-01: applies only the variables when no arguments were given", () => {
    // arrange
    const body = "${CLAUDE_SESSION_ID} $0 \uFFFF\uFFFE";

    // act
    const content = substituteArguments({
      body,
      args: undefined,
      argumentNames: [],
      variables: { CLAUDE_SESSION_ID: "s-1" },
    });

    // assert
    assert.strictEqual(content, "s-1 $0 \uFFFF\uFFFE");
  });

  test("D-CF1-01: turns U+FFFF and U+FFFE in the body into U+FFFD when arguments were given", () => {
    // arrange
    const body = "a\uFFFFb\uFFFEc $0";

    // act
    const content = substituteArguments({ body, args: "x", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "a\uFFFDb\uFFFDc x");
  });

  test("D-CF1-01: throws InvocationTooLargeError past 4,000,000 characters", () => {
    // arrange
    const body = `${"x".repeat(3_999_991)}$ARGUMENTS`;

    // act & assert
    assert.throws(
      () => substituteArguments({ body, args: "", argumentNames: [], variables: {} }),
      (error: unknown) => {
        assert.ok(error instanceof InvocationTooLargeError);
        assert.strictEqual(error.name, "InvocationTooLargeError");
        assert.strictEqual(error.size, 4_000_001);
        assert.strictEqual(error.limit, 4_000_000);
        assert.strictEqual(
          error.message,
          "This skill, command or hook and the arguments filled into it add up to more than 4,000,000 characters. Use shorter arguments or fewer placeholders such as $ARGUMENTS.",
        );
        return true;
      },
    );
  });

  test("D-CF1-01: accepts exactly 4,000,000 characters", () => {
    // arrange
    const body = `${"x".repeat(3_999_990)}$ARGUMENTS`;

    // act
    const content = substituteArguments({ body, args: "", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, "x".repeat(3_999_990));
  });

  test("D-CF1-01: counts the longer of the typed and transformed value against the cap", () => {
    // arrange
    const body = `${"x".repeat(3_999_996)}$0`;

    // act & assert
    assert.throws(
      () => substituteArguments({ body, args: "!a", argumentNames: [], variables: {} }),
      (error: unknown) => {
        assert.ok(error instanceof InvocationTooLargeError);
        assert.strictEqual(error.size, 4_000_001);
        return true;
      },
    );
  });

  test("D-CF1-01: returns an oversized body when nothing is substituted", () => {
    // arrange
    const body = "x".repeat(4_000_001);

    // act
    const content = substituteArguments({ body, args: "", argumentNames: [], variables: {} });

    // assert
    assert.strictEqual(content, body);
  });
});

describe("parseArgumentNames", () => {
  test("D-CF1-01: drops empty and all-digit names from a list", () => {
    // arrange
    const frontmatterArguments = ["a", "", "12", "  ", "b"];

    // act
    const argumentNames = parseArgumentNames(frontmatterArguments);

    // assert
    assert.deepStrictEqual(argumentNames, ["a", "b"]);
  });

  test("D-CF1-01: drops entries of a list that are not strings", () => {
    // arrange
    const frontmatterArguments = ["a", 3, null, "b"];

    // act
    const argumentNames = parseArgumentNames(frontmatterArguments);

    // assert
    assert.deepStrictEqual(argumentNames, ["a", "b"]);
  });

  test("D-CF1-01: splits a string on whitespace and keeps the declared order", () => {
    // arrange
    const frontmatterArguments = " long  short 7 ";

    // act
    const argumentNames = parseArgumentNames(frontmatterArguments);

    // assert
    assert.deepStrictEqual(argumentNames, ["long", "short"]);
  });

  for (const frontmatterArguments of [undefined, null, "", 42, { name: "a" }]) {
    test(`D-CF1-01: gives no names for ${JSON.stringify(frontmatterArguments)}`, () => {
      // arrange
      const expectedNames: readonly string[] = [];

      // act
      const argumentNames = parseArgumentNames(frontmatterArguments);

      // assert
      assert.deepStrictEqual(argumentNames, expectedNames);
    });
  }
});

describe("claudeEffort", () => {
  for (const { thinkingLevel, effort } of [
    { thinkingLevel: "off", effort: "low" },
    { thinkingLevel: "minimal", effort: "low" },
    { thinkingLevel: "low", effort: "low" },
    { thinkingLevel: "medium", effort: "medium" },
    { thinkingLevel: "high", effort: "high" },
    { thinkingLevel: "xhigh", effort: "xhigh" },
    { thinkingLevel: "max", effort: "max" },
    { thinkingLevel: "turbo", effort: "high" },
    { thinkingLevel: undefined, effort: "high" },
  ] satisfies readonly { thinkingLevel: string | undefined; effort: ClaudeEffort }[]) {
    test(`D-CF1-01: maps the ${String(thinkingLevel)} thinking level to ${effort} effort`, () => {
      // arrange
      const expectedEffort = effort;

      // act
      const mappedEffort = claudeEffort(thinkingLevel);

      // assert
      assert.strictEqual(mappedEffort, expectedEffort);
    });
  }
});
