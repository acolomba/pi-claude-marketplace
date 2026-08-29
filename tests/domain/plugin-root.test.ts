import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  asAbsolutePluginRoot,
  type AbsolutePluginRoot,
} from "../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

// @ts-expect-error A plain string does not carry the validated root brand.
void ("/plugin" satisfies AbsolutePluginRoot);

test("returns an absolute root resolved from relative segments", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-relative-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const absolutePath = path.resolve(directory, "plugins", "test-plugin");

  // act
  const pluginRoot: AbsolutePluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(pluginRoot, path.join(directory, "plugins", "test-plugin"));
});

test("returns an already absolute root unchanged", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-absolute-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const absolutePath = path.join(directory, "plugins", "test-plugin");

  // act
  const pluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(pluginRoot, path.join(directory, "plugins", "test-plugin"));
});

test("accepts an already branded root without changing it", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-idempotent-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const absolutePath = path.join(directory, "plugins", "test-plugin");
  const pluginRoot = asAbsolutePluginRoot(absolutePath);

  // act
  const rebrandedPluginRoot = asAbsolutePluginRoot(pluginRoot);

  // assert
  assert.strictEqual(rebrandedPluginRoot, path.join(directory, "plugins", "test-plugin"));
});

test("preserves parent segments that resolve within the temporary root", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-parent-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const absolutePath = `${directory}${path.sep}plugins${path.sep}a${path.sep}..${path.sep}b`;

  // act
  const pluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(
    pluginRoot,
    `${directory}${path.sep}plugins${path.sep}a${path.sep}..${path.sep}b`,
  );
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
