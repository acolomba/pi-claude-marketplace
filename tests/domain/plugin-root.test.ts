import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
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
  assert.strictEqual(path.relative(directory, pluginRoot), path.join("plugins", "test-plugin"));
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
  assert.strictEqual(path.relative(directory, pluginRoot), path.join("plugins", "test-plugin"));
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
  assert.strictEqual(
    path.relative(directory, rebrandedPluginRoot),
    path.join("plugins", "test-plugin"),
  );
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
  assert.strictEqual(path.relative(directory, path.resolve(pluginRoot)), path.join("plugins", "b"));
});

for (const {
  name,
  makeUnsafePluginRoot,
  makeContainedPaths,
  containedRelativePaths,
  errorMessage,
} of [
  {
    name: "an empty root",
    makeUnsafePluginRoot: (_directory: string) => "",
    makeContainedPaths: (directory: string) => [directory],
    containedRelativePaths: [""],
    errorMessage: "AbsolutePluginRoot: empty string",
  },
  {
    name: "a root with a null byte",
    makeUnsafePluginRoot: (directory: string) => `${path.join(directory, "test")}\0plugin`,
    makeContainedPaths: (directory: string) => [path.join(directory, "test")],
    containedRelativePaths: ["test"],
    errorMessage: "AbsolutePluginRoot: contains null byte",
  },
  {
    name: "a PATH delimiter by itself",
    makeUnsafePluginRoot: (_directory: string) => path.delimiter,
    makeContainedPaths: (directory: string) => [directory],
    containedRelativePaths: [""],
    errorMessage: `AbsolutePluginRoot: contains PATH delimiter: ${path.delimiter}`,
  },
  {
    name: "a leading PATH delimiter",
    makeUnsafePluginRoot: (directory: string) =>
      `${path.delimiter}${path.join(directory, "plugin")}`,
    makeContainedPaths: (directory: string) => [path.join(directory, "plugin")],
    containedRelativePaths: ["plugin"],
    errorMessage: (directory: string) =>
      `AbsolutePluginRoot: contains PATH delimiter: ${path.delimiter}${path.join(directory, "plugin")}`,
  },
  {
    name: "a PATH delimiter between roots",
    makeUnsafePluginRoot: (directory: string) =>
      `${path.join(directory, "first")}${path.delimiter}${path.join(directory, "second")}`,
    makeContainedPaths: (directory: string) => [
      path.join(directory, "first"),
      path.join(directory, "second"),
    ],
    containedRelativePaths: ["first", "second"],
    errorMessage: (directory: string) =>
      `AbsolutePluginRoot: contains PATH delimiter: ${path.join(directory, "first")}${path.delimiter}${path.join(directory, "second")}`,
  },
  {
    name: "a trailing PATH delimiter",
    makeUnsafePluginRoot: (directory: string) =>
      `${path.join(directory, "plugin")}${path.delimiter}`,
    makeContainedPaths: (directory: string) => [path.join(directory, "plugin")],
    containedRelativePaths: ["plugin"],
    errorMessage: (directory: string) =>
      `AbsolutePluginRoot: contains PATH delimiter: ${path.join(directory, "plugin")}${path.delimiter}`,
  },
  {
    name: "a relative root",
    makeUnsafePluginRoot: (directory: string) =>
      path.relative(directory, path.join(directory, "plugin")),
    makeContainedPaths: (directory: string) => [path.join(directory, "plugin")],
    containedRelativePaths: ["plugin"],
    errorMessage: `AbsolutePluginRoot: not absolute: plugin`,
  },
]) {
  test(`rejects ${name} without creating filesystem content`, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-invalid-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const unsafePluginRoot = makeUnsafePluginRoot(directory);
    const expectedErrorMessage =
      typeof errorMessage === "function" ? errorMessage(directory) : errorMessage;
    const containedPaths = makeContainedPaths(directory);

    // act
    const pluginRootError: unknown = (() => {
      try {
        asAbsolutePluginRoot(unsafePluginRoot);
        return undefined;
      } catch (error) {
        return error;
      }
    })();

    // assert
    assert.ok(pluginRootError instanceof Error);
    assert.strictEqual(pluginRootError.constructor, Error);
    assert.strictEqual(pluginRootError.message, expectedErrorMessage);
    assert.deepStrictEqual(
      containedPaths.map((containedPath) => path.relative(directory, containedPath)),
      containedRelativePaths,
    );
    assert.deepStrictEqual(await readdir(directory), []);
  });
}
