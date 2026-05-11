// tests/edge/args.test.ts
//
// AP-1 / AP-2 / AP-4 coverage for the verbatim V1 tokenizer + --scope
// validator now living in extensions/claude-marketplace/edge/args.ts.

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArgs } from "../../extensions/claude-marketplace/edge/args.ts";

test("AP-1 :: tokenize bare string", () => {
  const result = parseArgs("install foo@bar");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, undefined);
});

test("AP-1 :: tokenize single-quoted spaced argument", () => {
  const result = parseArgs("install 'foo bar'");
  assert.deepEqual(result.positional, ["install", "foo bar"]);
});

test("AP-1 :: tokenize double-quoted spaced argument", () => {
  const result = parseArgs('install "foo bar"');
  assert.deepEqual(result.positional, ["install", "foo bar"]);
});

test("AP-1 :: tokenize mixed quotes in same input", () => {
  // Outer single quotes wrap a literal double quote -- V1 has no escape
  // semantics so the inner `"` is just data.
  const result = parseArgs('install \'foo"bar\' "baz qux"');
  assert.deepEqual(result.positional, ["install", 'foo"bar', "baz qux"]);
});

test("AP-1 :: tokenize unicode/non-ASCII positionals", () => {
  const result = parseArgs("install plügin@märket 𝕦𝕥𝕗-𝟠");
  assert.deepEqual(result.positional, ["install", "plügin@märket", "𝕦𝕥𝕗-𝟠"]);
});

test("AP-2 :: --scope user is valid", () => {
  const result = parseArgs("--scope user install foo@bar");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, "user");
});

test("AP-2 :: --scope project is valid", () => {
  const result = parseArgs("--scope project install foo@bar");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, "project");
});

test("AP-2 :: --scope missing value throws clear error", () => {
  assert.throws(
    () => parseArgs("--scope"),
    /^Error: --scope requires a value: "user" or "project"\.$/,
  );
});

test("AP-2 :: --scope invalid value (foo) throws clear error", () => {
  assert.throws(
    () => parseArgs("--scope foo"),
    /^Error: Invalid --scope value: "foo"\. Must be "user" or "project"\.$/,
  );
});

test("AP-4 :: --scope accepted at position 0", () => {
  const result = parseArgs("--scope user install foo@bar");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, "user");
});

test("AP-4 :: --scope accepted at middle position", () => {
  const result = parseArgs("install --scope user foo@bar");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, "user");
});

test("AP-4 :: --scope accepted at end position", () => {
  const result = parseArgs("install foo@bar --scope user");
  assert.deepEqual(result.positional, ["install", "foo@bar"]);
  assert.equal(result.scope, "user");
});

test("AP-4 :: positionals extracted in order regardless of --scope position", () => {
  const a = parseArgs("--scope user install foo@bar baz");
  const b = parseArgs("install --scope user foo@bar baz");
  const c = parseArgs("install foo@bar --scope user baz");
  const d = parseArgs("install foo@bar baz --scope user");
  assert.deepEqual(a.positional, ["install", "foo@bar", "baz"]);
  assert.deepEqual(b.positional, ["install", "foo@bar", "baz"]);
  assert.deepEqual(c.positional, ["install", "foo@bar", "baz"]);
  assert.deepEqual(d.positional, ["install", "foo@bar", "baz"]);
});
