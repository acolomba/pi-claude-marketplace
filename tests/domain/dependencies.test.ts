import assert from "node:assert/strict";
import { test } from "node:test";

import {
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

test("an absent dependencies field parses to no entries", () => {
  // arrange
  const raw = undefined;

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, []);
});

test("a non-array dependencies field parses to no entries", () => {
  // arrange
  const raw = { helper: "^1.0.0" };

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, []);
});

test("an empty dependencies array parses to no entries", () => {
  // arrange
  const raw: readonly unknown[] = [];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, []);
});

test("a bare string carrying an address splits into a name and a marketplace", () => {
  // arrange
  const raw = ["helper@utils-mp"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "helper", marketplace: "utils-mp" }]);
});

test("a bare string carrying no address yields a name with no marketplace", () => {
  // arrange
  const raw = ["helper"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "helper" }]);
});

test("a bare string carrying a trailing range keeps the range as a version", () => {
  // arrange
  const raw = ["foo@^1.0.0"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "foo", version: "^1.0.0" }]);
});

test("a bare string carrying both an address and a range splits into all three fields", () => {
  // arrange
  const raw = ["foo@mp@^1.0.0"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "foo", marketplace: "mp", version: "^1.0.0" }]);
});

test("an object element yields its name, version and marketplace", () => {
  // arrange
  const raw = [{ name: "a", version: "^2.0.0", marketplace: "mp" }];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "a", version: "^2.0.0", marketplace: "mp" }]);
});

test("an object element yields its sha unshortened", () => {
  // arrange
  const raw = [{ name: "a", sha: "abc1234def5678abc1234def5678abc1234def56" }];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "a", sha: "abc1234def5678abc1234def5678abc1234def56" }]);
});

test("a mixed array yields one entry per usable element in declaration order", () => {
  // arrange
  const raw = ["zulu@mp", { name: "alpha", version: "^1.0.0" }, "mike"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [
    { name: "zulu", marketplace: "mp" },
    { name: "alpha", version: "^1.0.0" },
    { name: "mike" },
  ]);
});

test("an element with a missing, empty or non-string name is dropped without throwing", () => {
  // arrange
  const raw = [{ version: "^1.0.0" }, "", { name: "" }, { name: 7 }, null, 42, ["a"], "keeper"];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "keeper" }]);
});

test("an element whose name or marketplace fails the allowlist is dropped", () => {
  // arrange
  const raw = [
    "-leading-hyphen",
    "sp ace",
    { name: "line\nbreak" },
    { name: "ok", marketplace: "bad mp" },
    { name: "ok", marketplace: "\u001b[31mred" },
    "keeper@mp",
  ];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "keeper", marketplace: "mp" }]);
});

test("an element whose present version or sha is unrenderable is dropped whole", () => {
  // arrange
  const raw = [
    { name: "a", version: "^1.0.0\ninjected" },
    { name: "b", version: 1 },
    { name: "c", sha: "nothex!" },
    { name: "d", sha: "abc12" },
    { name: "e", sha: false },
    { name: "keeper", version: ">=1.0.0 <2.0.0 || 3.x" },
  ];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [{ name: "keeper", version: ">=1.0.0 <2.0.0 || 3.x" }]);
});

test("the parser preserves declaration order and neither sorts nor collapses duplicates", () => {
  // arrange
  const raw = ["zulu@mp", "alpha@mp", { name: "zulu", marketplace: "mp", version: "^2.0.0" }];

  // act
  const parsed = parseDeclaredDependencies(raw);

  // assert
  assert.deepStrictEqual(parsed, [
    { name: "zulu", marketplace: "mp" },
    { name: "alpha", marketplace: "mp" },
    { name: "zulu", marketplace: "mp", version: "^2.0.0" },
  ]);
});
