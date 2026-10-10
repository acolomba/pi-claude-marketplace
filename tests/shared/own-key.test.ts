import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ownValue, setOwn } from "../../extensions/pi-claude-marketplace/shared/own-key.ts";

describe("ownValue", () => {
  test("returns the value stored under an own key", () => {
    // arrange
    const marketplaces: Record<string, { readonly name: string }> = { tools: { name: "tools" } };

    // act
    const record = ownValue(marketplaces, "tools");

    // assert
    assert.deepStrictEqual(record, { name: "tools" });
  });

  test("returns undefined for a key the map does not hold", () => {
    // arrange
    const marketplaces: Record<string, string> = { tools: "tools" };

    // act
    const record = ownValue(marketplaces, "docs");

    // assert
    assert.strictEqual(record, undefined);
  });

  test("returns undefined for an undefined map", () => {
    // arrange
    const marketplaces: Record<string, string> | undefined = undefined;

    // act
    const record = ownValue(marketplaces, "tools");

    // assert
    assert.strictEqual(record, undefined);
  });

  for (const name of Object.getOwnPropertyNames(Object.prototype)) {
    test(`D-08-07: returns undefined for the inherited ${name} member`, () => {
      // arrange
      const marketplaces: Record<string, unknown> = {};

      // act
      const record = ownValue(marketplaces, name);

      // assert
      assert.strictEqual(record, undefined);
    });
  }

  test("D-08-07: returns an own __proto__ value that JSON.parse created", () => {
    // arrange
    const marketplaces = JSON.parse('{"__proto__":{"name":"__proto__"}}') as Record<
      string,
      unknown
    >;

    // act
    const record = ownValue(marketplaces, "__proto__");

    // assert
    assert.deepStrictEqual(record, { name: "__proto__" });
  });

  test("compares keys by exact code units without Unicode normalization", () => {
    // arrange
    // The stored key is NFC (U+00E9); the looked-up key is NFD (e + U+0301).
    const marketplaces: Record<string, string> = { café: "composed" };

    // act
    const record = ownValue(marketplaces, "café");

    // assert
    assert.strictEqual(record, undefined);
  });
});

describe("setOwn", () => {
  test("stores an ordinary key as an own data property", () => {
    // arrange
    const marketplaces: Record<string, string> = {};
    const expectedDescriptor = {
      value: "tools record",
      enumerable: true,
      writable: true,
      configurable: true,
    };

    // act
    setOwn(marketplaces, "tools", "tools record");

    // assert
    assert.deepStrictEqual(marketplaces, { tools: "tools record" });
    assert.deepStrictEqual(
      Object.getOwnPropertyDescriptor(marketplaces, "tools"),
      expectedDescriptor,
    );
    assert.strictEqual(Object.getPrototypeOf(marketplaces), Object.prototype);
  });

  test("replaces the value under an existing own key", () => {
    // arrange
    const marketplaces: Record<string, string> = { tools: "old record" };

    // act
    setOwn(marketplaces, "tools", "new record");

    // assert
    assert.deepStrictEqual(marketplaces, { tools: "new record" });
  });

  test("D-08-07: stores __proto__ as an own enumerable key and keeps the prototype", () => {
    // arrange
    const marketplaces: Record<string, { readonly name: string }> = {};
    const record = { name: "__proto__" };
    const expectedDescriptor = {
      value: record,
      enumerable: true,
      writable: true,
      configurable: true,
    };

    // act
    setOwn(marketplaces, "__proto__", record);

    // assert
    assert.deepStrictEqual(Object.keys(marketplaces), ["__proto__"]);
    assert.deepStrictEqual(
      Object.getOwnPropertyDescriptor(marketplaces, "__proto__"),
      expectedDescriptor,
    );
    assert.strictEqual(Object.getPrototypeOf(marketplaces), Object.prototype);
    assert.strictEqual(JSON.stringify(marketplaces), '{"__proto__":{"name":"__proto__"}}');
  });
});
