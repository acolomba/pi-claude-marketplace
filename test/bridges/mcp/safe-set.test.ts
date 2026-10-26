import assert from "node:assert/strict";
import { test } from "node:test";

import { safeSet } from "../../../extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts";

test("copies an ordinary key as an own data property without changing the prototype", () => {
  // arrange
  const accumulator: Record<string, unknown> = {};
  const server = { command: "node", args: ["server.js"] };
  const expectedAccumulator = {
    server: { command: "node", args: ["server.js"] },
  };
  const expectedDescriptor = {
    value: server,
    enumerable: true,
    writable: true,
    configurable: true,
  };

  // act
  safeSet(accumulator, "server", server);

  // assert
  assert.deepStrictEqual(accumulator, expectedAccumulator);
  assert.deepStrictEqual(
    Object.getOwnPropertyDescriptor(accumulator, "server"),
    expectedDescriptor,
  );
  assert.strictEqual(Object.getPrototypeOf(accumulator), Object.prototype);
});

test("copies __proto__ as an own data property without changing the prototype", () => {
  // arrange
  const accumulator: Record<string, unknown> = {};
  const server = { command: "node", polluted: true };
  const expectedEntries = [["__proto__", server]];
  const expectedDescriptor = {
    value: server,
    enumerable: true,
    writable: true,
    configurable: true,
  };

  // act
  safeSet(accumulator, "__proto__", server);

  // assert
  assert.deepStrictEqual(Object.entries(accumulator), expectedEntries);
  assert.deepStrictEqual(
    Object.getOwnPropertyDescriptor(accumulator, "__proto__"),
    expectedDescriptor,
  );
  assert.strictEqual(Object.getPrototypeOf(accumulator), Object.prototype);
});
