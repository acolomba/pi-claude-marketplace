import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isRenderableDependencyToken,
  parseDeclaredDependencies,
  type DeclaredDependency,
} from "../../extensions/pi-claude-marketplace/domain/dependencies.ts";

void ({ name: "helper" } satisfies DeclaredDependency);
void ({
  name: "helper",
  version: "^1.0.0",
  marketplace: "utils-mp",
  sha: "abc1234",
} satisfies DeclaredDependency);
// @ts-expect-error A declared dependency always carries a name.
void ({ version: "^1.0.0" } satisfies DeclaredDependency);
// @ts-expect-error A declared dependency carries no fields beyond the four.
void ({ name: "helper", source: "./helper" } satisfies DeclaredDependency);

describe("isRenderableDependencyToken", () => {
  for (const { label, candidate, expected } of [
    {
      label: "a token of letters, digits, dots, hyphens and underscores",
      candidate: "my-plugin_v2.0",
      expected: true,
    },
    { label: "a token opening with a hyphen", candidate: "-leading-hyphen", expected: false },
    { label: "a token carrying an address separator", candidate: "helper@mp", expected: false },
    { label: "a non-string", candidate: 7, expected: false },
  ]) {
    test(`${label} is ${expected ? "" : "not "}a renderable dependency token`, () => {
      // arrange
      const name = candidate;

      // act
      const renderable = isRenderableDependencyToken(name);

      // assert
      assert.equal(renderable, expected);
    });
  }
});

describe("parseDeclaredDependencies", () => {
  for (const { label, raw, reason } of [
    {
      label: "a non-array field",
      raw: { helper: "^1.0.0" },
      reason: "dependencies: expected an array",
    },
    { label: "a null field", raw: null, reason: "dependencies: expected an array" },
    { label: "a bare tilde range", raw: ["foo@~1.0.0"], reason: "dependencies.0: Invalid input" },
    {
      label: "a missing name",
      raw: [{ version: "^1.0.0" }],
      reason: "dependencies.0: Invalid input",
    },
    {
      label: "an invalid element after a valid sibling",
      raw: ["keeper", 42],
      reason: "dependencies.1: Invalid input",
    },
  ]) {
    test(`rejects the entire declaration containing ${label}`, () => {
      // arrange
      const declaration = raw;

      // act
      const parsed = parseDeclaredDependencies(declaration);

      // assert
      assert.deepStrictEqual(parsed, { ok: false, reason });
    });
  }

  test("an absent dependencies field parses to no entries", () => {
    // arrange
    const raw = undefined;

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, { ok: true, dependencies: [] });
  });

  test("an empty dependencies array parses to no entries", () => {
    // arrange
    const raw: readonly unknown[] = [];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, { ok: true, dependencies: [] });
  });

  test("a bare string carrying an address splits into a name and a marketplace", () => {
    // arrange
    const raw = ["helper@utils-mp"];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "helper", marketplace: "utils-mp" }],
    });
  });

  test("a bare string carrying no address yields a name with no marketplace", () => {
    // arrange
    const raw = ["helper"];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, { ok: true, dependencies: [{ name: "helper" }] });
  });

  test("a bare string carrying a trailing range keeps the range as a version", () => {
    // arrange
    const raw = ["foo@^1.0.0"];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "foo", version: "^1.0.0" }],
    });
  });

  test("a bare string carrying both an address and a range splits into all three fields", () => {
    // arrange
    const raw = ["foo@mp@^1.0.0"];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "foo", marketplace: "mp", version: "^1.0.0" }],
    });
  });

  test("an object element yields its name, version and marketplace", () => {
    // arrange
    const raw = [{ name: "a", version: "^2.0.0", marketplace: "mp" }];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "a", version: "^2.0.0", marketplace: "mp" }],
    });
  });

  test("an object element yields its sha unshortened", () => {
    // arrange
    const raw = [{ name: "a", sha: "abc1234def5678abc1234def5678abc1234def56" }];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "a", sha: "abc1234def5678abc1234def5678abc1234def56" }],
    });
  });

  test("a mixed array yields one entry per usable element in declaration order", () => {
    // arrange
    const raw = ["zulu@mp", { name: "alpha", version: "^1.0.0" }, "mike"];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [
        { name: "zulu", marketplace: "mp" },
        { name: "alpha", version: "^1.0.0" },
        { name: "mike" },
      ],
    });
  });

  test("the parser preserves declaration order and neither sorts nor collapses duplicates", () => {
    // arrange
    const raw = ["zulu@mp", "alpha@mp", { name: "zulu", marketplace: "mp", version: "^2.0.0" }];

    // act
    const parsed = parseDeclaredDependencies(raw);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [
        { name: "zulu", marketplace: "mp" },
        { name: "alpha", marketplace: "mp" },
        { name: "zulu", marketplace: "mp", version: "^2.0.0" },
      ],
    });
  });

  for (const element of [
    "",
    { name: "" },
    { name: 7 },
    null,
    42,
    ["a"],
    "-leading-hyphen",
    "sp ace",
    { name: "line\nbreak" },
    { name: "ok", marketplace: "bad mp" },
    { name: "ok", marketplace: "\u001b[31mred" },
    { name: "a", version: "^1.0.0\ninjected" },
    { name: "b", version: 1 },
    { name: "c", sha: "nothex!" },
    { name: "d", sha: "abc12" },
    { name: "e", sha: false },
  ]) {
    test(`rejects an invalid element ${JSON.stringify(element)} without returning siblings`, () => {
      // arrange
      const declaration = ["keeper", element];

      // act
      const parsed = parseDeclaredDependencies(declaration);

      // assert
      assert.deepStrictEqual(parsed, { ok: false, reason: "dependencies.1: Invalid input" });
    });
  }

  test("preserves compound object ranges", () => {
    // arrange
    const declaration = [{ name: "helper", version: ">=1.0.0 <2.0.0 || 3.x" }];

    // act
    const parsed = parseDeclaredDependencies(declaration);

    // assert
    assert.deepStrictEqual(parsed, {
      ok: true,
      dependencies: [{ name: "helper", version: ">=1.0.0 <2.0.0 || 3.x" }],
    });
  });

  for (const { field, dependency } of [
    { field: "name", dependency: { name: "a".repeat(256) } },
    { field: "marketplace", dependency: { name: "helper", marketplace: "a".repeat(256) } },
    { field: "version", dependency: { name: "helper", version: "a".repeat(64) } },
    { field: "sha", dependency: { name: "helper", sha: "a".repeat(40) } },
  ]) {
    test(`accepts a ${field} at its length limit`, () => {
      // arrange
      const declaration = [dependency];

      // act
      const parsed = parseDeclaredDependencies(declaration);

      // assert
      assert.deepStrictEqual(parsed, { ok: true, dependencies: [dependency] });
    });
  }

  for (const { field, dependency } of [
    { field: "name", dependency: { name: "a".repeat(257) } },
    { field: "marketplace", dependency: { name: "helper", marketplace: "a".repeat(257) } },
    { field: "version", dependency: { name: "helper", version: "a".repeat(65) } },
    { field: "sha", dependency: { name: "helper", sha: "a".repeat(41) } },
  ]) {
    test(`rejects a ${field} beyond its length limit`, () => {
      // arrange
      const declaration = [dependency];

      // act
      const parsed = parseDeclaredDependencies(declaration);

      // assert
      assert.deepStrictEqual(parsed, { ok: false, reason: "dependencies.0: Invalid input" });
    });
  }
});
