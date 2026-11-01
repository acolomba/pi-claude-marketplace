import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { substituteArguments } from "../../extensions/pi-claude-marketplace/domain/argument-substitution.ts";

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
});
