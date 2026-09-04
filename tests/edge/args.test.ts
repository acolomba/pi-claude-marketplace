import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, type ParsedArgs } from "../../extensions/pi-claude-marketplace/edge/args.ts";

test("parseArgs returns positionals in input order and omits scope when no pair is supplied", () => {
  // arrange
  const rawArgs = "official alpha";
  const expectedArgs = { positional: ["official", "alpha"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs returns the user scope alongside the positionals in input order", () => {
  // arrange
  const rawArgs = "install official --scope user";
  const expectedArgs = {
    positional: ["install", "official"],
    scope: "user",
  } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs returns the project scope alongside the positionals in input order", () => {
  // arrange
  const rawArgs = "install official --scope project";
  const expectedArgs = {
    positional: ["install", "official"],
    scope: "project",
  } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

for (const { placement, rawArgs } of [
  { placement: "leading", rawArgs: "--scope user install official" },
  { placement: "between two positionals", rawArgs: "install --scope user official" },
  { placement: "trailing", rawArgs: "install official --scope user" },
]) {
  test(`parseArgs returns the same whole value with the scope pair ${placement}`, () => {
    // arrange
    const expectedArgs = {
      positional: ["install", "official"],
      scope: "user",
    } satisfies ParsedArgs;

    // act
    const parsedArgs = parseArgs(rawArgs);

    // assert
    assert.deepStrictEqual(parsedArgs, expectedArgs);
  });
}

test("parseArgs keeps a single-quoted run together as one token including its spaces", () => {
  // arrange
  const rawArgs = "install 'alpha beta'";
  const expectedArgs = { positional: ["install", "alpha beta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs keeps a double-quoted run together as one token including its spaces", () => {
  // arrange
  const rawArgs = 'install "alpha beta"';
  const expectedArgs = { positional: ["install", "alpha beta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs treats a single quote as ordinary text inside a double-quoted run", () => {
  // arrange
  const rawArgs = '"alpha\'beta gamma" delta';
  const expectedArgs = { positional: ["alpha'beta gamma", "delta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs treats a double quote as ordinary text inside a single-quoted run", () => {
  // arrange
  const rawArgs = "'alpha\"beta gamma' delta";
  const expectedArgs = { positional: ['alpha"beta gamma', "delta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs applies no backslash escape, so a backslash before a space splits the tokens", () => {
  // arrange
  const rawArgs = "alpha\\ beta";
  const expectedArgs = { positional: ["alpha\\", "beta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs collapses leading, trailing, and repeated interior spaces into no empty tokens", () => {
  // arrange
  const rawArgs = "  install   official  ";
  const expectedArgs = { positional: ["install", "official"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs returns an empty positional list and omits scope for an empty argument vector", () => {
  // arrange
  const rawArgs = "";
  const expectedArgs = { positional: [] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs returns a one-element positional list for a bare verb with no operand", () => {
  // arrange
  const rawArgs = "list";
  const expectedArgs = { positional: ["list"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs flushes the trailing buffer into one token when a quoted run is never closed", () => {
  // arrange
  const rawArgs = "install 'alpha beta";
  const expectedArgs = { positional: ["install", "alpha beta"] } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});

test("parseArgs rejects a trailing scope flag with the missing-value diagnostic", () => {
  // arrange
  const rawArgs = "install --scope";

  // act & assert
  assert.throws(
    () => parseArgs(rawArgs),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, '--scope requires a value: "user" or "project".');
      return true;
    },
  );
});

test("parseArgs rejects an empty quoted scope value with the missing-value diagnostic", () => {
  // arrange
  const rawArgs = 'install --scope ""';

  // act & assert
  assert.throws(
    () => parseArgs(rawArgs),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, '--scope requires a value: "user" or "project".');
      return true;
    },
  );
});

test("parseArgs rejects an unrecognised scope value with the invalid-value diagnostic", () => {
  // arrange
  const rawArgs = "install --scope bogus";

  // act & assert
  assert.throws(
    () => parseArgs(rawArgs),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(
        error.message,
        'Invalid --scope value: "bogus". Must be "user" or "project".',
      );
      return true;
    },
  );
});

test("parseArgs keeps the last scope value when the pair is supplied twice", () => {
  // arrange
  const rawArgs = "--scope user install --scope project official";
  const expectedArgs = {
    positional: ["install", "official"],
    scope: "project",
  } satisfies ParsedArgs;

  // act
  const parsedArgs = parseArgs(rawArgs);

  // assert
  assert.deepStrictEqual(parsedArgs, expectedArgs);
});
