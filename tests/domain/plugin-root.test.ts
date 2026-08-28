import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  asAbsolutePluginRoot,
  type AbsolutePluginRoot,
} from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

// @ts-expect-error A plain string does not carry the validated root brand.
void ("/plugin" satisfies AbsolutePluginRoot);

test("returns a valid absolute path unchanged", () => {
  // arrange
  const absolutePath = path.resolve("test-plugin");

  // act
  const pluginRoot: AbsolutePluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(pluginRoot, absolutePath);
});

test("accepts an already branded root without changing it", () => {
  // arrange
  const pluginRoot = asAbsolutePluginRoot(path.resolve("test-plugin"));

  // act
  const rebrandedPluginRoot = asAbsolutePluginRoot(pluginRoot);

  // assert
  assert.strictEqual(rebrandedPluginRoot, pluginRoot);
});

test("preserves parent segments in an absolute path", () => {
  // arrange
  const absolutePath = `${path.resolve("tmp", "a")}${path.sep}..${path.sep}b`;

  // act
  const pluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(pluginRoot, absolutePath);
});

for (const { pluginRoot, errorMessage } of [
  {
    pluginRoot: "",
    errorMessage: "AbsolutePluginRoot: empty string",
  },
  {
    pluginRoot: `${path.resolve("test")}\0plugin`,
    errorMessage: "AbsolutePluginRoot: contains null byte",
  },
  {
    pluginRoot: path.resolve(`test${path.delimiter}plugin`),
    errorMessage: `AbsolutePluginRoot: contains PATH delimiter: ${path.resolve(`test${path.delimiter}plugin`)}`,
  },
  {
    pluginRoot: `relative${path.sep}plugin`,
    errorMessage: `AbsolutePluginRoot: not absolute: relative${path.sep}plugin`,
  },
]) {
  test(`rejects ${JSON.stringify(pluginRoot)}`, () => {
    // arrange
    const unsafePluginRoot = pluginRoot;

    // act & assert
    assert.throws(
      () => asAbsolutePluginRoot(unsafePluginRoot),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      },
    );
  });
}
