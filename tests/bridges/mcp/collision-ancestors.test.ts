import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { ancestorSourcePaths } from "../../../extensions/pi-claude-marketplace/bridges/mcp/collision-ancestors.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

interface AncestorLayout {
  readonly root: string;
  readonly home: string;
  readonly cwd: string;
}

/** A hermetic HOME with the project at `~/work/a/repo`. */
async function allocateLayout(t: TestContext): Promise<AncestorLayout> {
  const { home, root } = await createHermeticEnvironment(t, "mcp-collision-ancestors-");
  const cwd = path.join(home, "work", "a", "repo");
  await mkdir(cwd, { recursive: true });
  return { root, home, cwd };
}

function sourcesIn(directories: readonly string[]): string[] {
  return directories.flatMap((directory) => [
    path.join(directory, ".mcp.json"),
    path.join(directory, ".pi", "mcp-adapter.json"),
  ]);
}

test("AFILE-05: lists two files per directory from the root down to the parent of cwd, farthest first", async (t) => {
  // arrange
  const { home, cwd } = await allocateLayout(t);
  const expectedPaths = [
    path.join(home, "work", ".mcp.json"),
    path.join(home, "work", ".pi", "mcp-adapter.json"),
    path.join(home, "work", "a", ".mcp.json"),
    path.join(home, "work", "a", ".pi", "mcp-adapter.json"),
  ];

  // act
  const ancestorPaths = await ancestorSourcePaths(cwd, [path.join(home, "work")]);

  // assert
  assert.deepStrictEqual(ancestorPaths, expectedPaths);
});

test("AFILE-05: the deepest of two valid roots wins", async (t) => {
  // arrange
  const { home, cwd } = await allocateLayout(t);

  // act
  const ancestorPaths = await ancestorSourcePaths(cwd, [home, path.join(home, "work")]);

  // assert
  assert.deepStrictEqual(
    ancestorPaths,
    sourcesIn([path.join(home, "work"), path.join(home, "work", "a")]),
  );
});

test("AFILE-05: a root equal to cwd yields no ancestor directory", async (t) => {
  // arrange
  const { cwd } = await allocateLayout(t);

  // act
  const ancestorPaths = await ancestorSourcePaths(cwd, [cwd]);

  // assert
  assert.deepStrictEqual(ancestorPaths, []);
});

for (const { label, invalidRoot } of [
  { label: "a relative path", invalidRoot: () => "work" },
  {
    label: "a missing path",
    invalidRoot: (layout: AncestorLayout) => path.join(layout.home, "gone"),
  },
  {
    label: "a file instead of a directory",
    invalidRoot: (layout: AncestorLayout) => path.join(layout.home, "work", "notes.txt"),
  },
  {
    label: "a root that does not contain cwd",
    invalidRoot: (layout: AncestorLayout) => path.join(layout.home, "work", "elsewhere", "deeper"),
  },
  { label: "a non-string entry", invalidRoot: () => 42 },
]) {
  test(`AFILE-05: skips ${label} and keeps the valid root`, async (t) => {
    // arrange
    const layout = await allocateLayout(t);
    await mkdir(path.join(layout.home, "work", "elsewhere", "deeper"), { recursive: true });
    await writeFile(path.join(layout.home, "work", "notes.txt"), "notes\n");

    // act
    const ancestorPaths = await ancestorSourcePaths(layout.cwd, [layout.home, invalidRoot(layout)]);

    // assert
    assert.deepStrictEqual(
      ancestorPaths,
      sourcesIn([layout.home, path.join(layout.home, "work"), path.join(layout.home, "work", "a")]),
    );
  });
}

test("AFILE-05: skips a root outside HOME", async (t) => {
  // arrange
  const { root, cwd } = await allocateLayout(t);

  // act
  const ancestorPaths = await ancestorSourcePaths(cwd, [root]);

  // assert
  assert.deepStrictEqual(ancestorPaths, []);
});

test("AFILE-05: expands a ~/ prefix to the home directory", async (t) => {
  // arrange
  const { home, cwd } = await allocateLayout(t);

  // act
  const ancestorPaths = await ancestorSourcePaths(cwd, ["~/work"]);

  // assert
  assert.deepStrictEqual(
    ancestorPaths,
    sourcesIn([path.join(home, "work"), path.join(home, "work", "a")]),
  );
});

for (const { label, configuredRoots } of [
  { label: "an absent value", configuredRoots: undefined },
  { label: "an empty array", configuredRoots: [] },
  { label: "a non-array value", configuredRoots: "~/work" },
]) {
  test(`AFILE-05: ${label} yields no ancestors`, async (t) => {
    // arrange
    const { cwd } = await allocateLayout(t);

    // act
    const ancestorPaths = await ancestorSourcePaths(cwd, configuredRoots);

    // assert
    assert.deepStrictEqual(ancestorPaths, []);
  });
}

test("AFILE-05: resolves a cwd that does not exist lexically", async (t) => {
  // arrange
  const { home } = await allocateLayout(t);
  const missingCwd = path.join(home, "work", "a", "missing", "repo");

  // act
  const ancestorPaths = await ancestorSourcePaths(missingCwd, ["~/work"]);

  // assert
  assert.deepStrictEqual(
    ancestorPaths,
    sourcesIn([
      path.join(home, "work"),
      path.join(home, "work", "a"),
      path.join(home, "work", "a", "missing"),
    ]),
  );
});
