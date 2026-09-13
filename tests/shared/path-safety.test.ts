import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  LexicalTraversalError,
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
  createPathSafetyGuard,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { PathSafetyInspector } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import type { Stats } from "node:fs";

test("PathContainmentError exposes its complete containment failure", () => {
  // arrange
  const parent = "/scope/root";
  const child = "/outside/plugin";
  const label = "plugin source";
  const expectedError = {
    name: "PathContainmentError",
    message: "plugin source escapes /scope/root (resolved: /outside/plugin).",
    parent: "/scope/root",
    child: "/outside/plugin",
  };

  // act
  const containmentError = new PathContainmentError(parent, child, label);

  // assert
  assert.ok(containmentError instanceof PathContainmentError);
  assert.ok(containmentError instanceof Error);
  assert.deepStrictEqual(
    {
      name: containmentError.name,
      message: containmentError.message,
      parent: containmentError.parent,
      child: containmentError.child,
    },
    expectedError,
  );
});

test("SymlinkRefusedError exposes its complete symlink failure", () => {
  // arrange
  const parent = "/scope/root";
  const child = "/scope/root/plugin/file.md";
  const label = "plugin component";
  const linkPath = "/scope/root/plugin";
  const linkTarget = "/outside/plugin";
  const expectedError = {
    name: "SymlinkRefusedError",
    message:
      "plugin component contains symlink /scope/root/plugin -> /outside/plugin (parent: /scope/root, target: /scope/root/plugin/file.md).",
    parent: "/scope/root",
    child: "/scope/root/plugin/file.md",
    linkPath: "/scope/root/plugin",
    linkTarget: "/outside/plugin",
  };

  // act
  const symlinkError = new SymlinkRefusedError(parent, child, label, linkPath, linkTarget);

  // assert
  assert.ok(symlinkError instanceof SymlinkRefusedError);
  assert.ok(symlinkError instanceof PathContainmentError);
  assert.ok(symlinkError instanceof Error);
  assert.deepStrictEqual(
    {
      name: symlinkError.name,
      message: symlinkError.message,
      parent: symlinkError.parent,
      child: symlinkError.child,
      linkPath: symlinkError.linkPath,
      linkTarget: symlinkError.linkTarget,
    },
    expectedError,
  );
});

test("accepts a parent as its own child boundary", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-equal-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let actualError: unknown = undefined;

  // act
  try {
    await assertPathInside(directory, directory, "equal boundary");
  } catch (error) {
    actualError = error;
  }

  // assert
  assert.strictEqual(actualError, undefined);
});

test("accepts an existing direct child", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-child-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "component.md");
  await fs.writeFile(child, "content");
  let actualError: unknown = undefined;

  // act
  try {
    await assertPathInside(directory, child, "direct child");
  } catch (error) {
    actualError = error;
  }

  // assert
  assert.strictEqual(actualError, undefined);
});

const lexicalTraversalSeparators = new Set([path.sep, "/"]);

for (const separator of lexicalTraversalSeparators) {
  test(`rejects raw lexical traversal spelled with ${JSON.stringify(separator)} separators`, async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-traversal-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const scopeRoot = path.join(directory, "root");
    const outsideRoot = path.join(directory, "outside");
    const outsideNested = path.join(outsideRoot, "nested");
    await fs.mkdir(scopeRoot);
    await fs.mkdir(outsideNested, { recursive: true });
    await fs.writeFile(path.join(outsideRoot, "sentinel.txt"), "outside sentinel\n");
    await fs.writeFile(path.join(outsideNested, "child.txt"), "outside child\n");
    await fs.symlink(outsideRoot, path.join(scopeRoot, "a"));
    const rawChild = `${scopeRoot}${separator}a${separator}..${separator}b`;
    const normalizedParent = path.resolve(scopeRoot);
    const normalizedChild = path.resolve(rawChild);
    const outsideTreeBefore = (await fs.readdir(outsideRoot, { recursive: true })).sort();
    const outsideSentinelBefore = await fs.readFile(path.join(outsideRoot, "sentinel.txt"));
    const outsideChildBefore = await fs.readFile(path.join(outsideNested, "child.txt"));
    const expectedError = {
      name: "LexicalTraversalError",
      message: `plugin source contains forbidden lexical traversal (parent: ${normalizedParent}, target: ${normalizedChild}).`,
      parent: normalizedParent,
      child: normalizedChild,
    };
    let traversalError: unknown;

    // act
    try {
      await assertPathInside(scopeRoot, rawChild, "plugin source");
    } catch (error) {
      traversalError = error;
    }

    // assert
    assert.ok(traversalError instanceof LexicalTraversalError);
    assert.ok(traversalError instanceof PathContainmentError);
    assert.ok(traversalError instanceof Error);
    assert.deepStrictEqual(
      {
        name: traversalError.name,
        message: traversalError.message,
        parent: traversalError.parent,
        child: traversalError.child,
      },
      expectedError,
    );
    assert.deepStrictEqual(
      (await fs.readdir(outsideRoot, { recursive: true })).sort(),
      outsideTreeBefore,
    );
    assert.deepStrictEqual(
      await fs.readFile(path.join(outsideRoot, "sentinel.txt")),
      outsideSentinelBefore,
    );
    assert.deepStrictEqual(
      await fs.readFile(path.join(outsideNested, "child.txt")),
      outsideChildBefore,
    );
  });
}

test("accepts a contained absolute child with redundant dot segments", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-absolute-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const containedDirectory = path.join(directory, "contained");
  const child = path.join(containedDirectory, "component.md");
  await fs.mkdir(containedDirectory);
  await fs.writeFile(child, "content");
  const redundantChild = `${directory}${path.sep}.${path.sep}contained${path.sep}component.md`;
  let containmentError: unknown;

  // act
  try {
    await assertPathInside(directory, redundantChild, "absolute child");
  } catch (error) {
    containmentError = error;
  }

  // assert
  assert.strictEqual(containmentError, undefined);
});

test("rejects the direct parent as a one-step escape", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-parent-escape-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.dirname(directory);
  const expectedError = {
    name: "PathContainmentError",
    message: `path target escapes ${directory} (resolved: ${child}).`,
    parent: directory,
    child,
  };
  let containmentError: unknown;

  // act
  try {
    await assertPathInside(directory, child, "path target");
  } catch (error) {
    containmentError = error;
  }

  // assert
  assert.ok(containmentError instanceof PathContainmentError);
  assert.strictEqual(containmentError instanceof SymlinkRefusedError, false);
  assert.deepStrictEqual(
    {
      name: containmentError.name,
      message: containmentError.message,
      parent: containmentError.parent,
      child: containmentError.child,
    },
    expectedError,
  );
});

test("accepts a missing intermediate segment before a write", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-missing-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "missing", "nested", "component.md");

  // act
  await assertPathInside(directory, child, "future component");

  // assert
  assert.deepStrictEqual(await fs.readdir(directory), []);
});

test("rejects a deeper path outside the parent boundary", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-deep-escape-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(path.dirname(directory), "outside", "nested", "component.md");
  const expectedError = {
    name: "PathContainmentError",
    message: `deep target escapes ${directory} (resolved: ${child}).`,
    parent: directory,
    child,
  };
  let containmentError: unknown;

  // act
  try {
    await assertPathInside(directory, child, "deep target");
  } catch (error) {
    containmentError = error;
  }

  // assert
  assert.ok(containmentError instanceof PathContainmentError);
  assert.strictEqual(containmentError instanceof SymlinkRefusedError, false);
  assert.deepStrictEqual(
    {
      name: containmentError.name,
      message: containmentError.message,
      parent: containmentError.parent,
      child: containmentError.child,
    },
    expectedError,
  );
});

for (const { name, existingSegments, linkSegments, childSegments } of [
  {
    name: "refuses a symlink in the first walked segment",
    existingSegments: [],
    linkSegments: ["link"],
    childSegments: ["link", "nested", "component.md"],
  },
  {
    name: "refuses a symlink in an intermediate walked segment",
    existingSegments: ["real"],
    linkSegments: ["real", "link"],
    childSegments: ["real", "link", "component.md"],
  },
  {
    name: "refuses a symlink in the final walked segment",
    existingSegments: ["real", "nested"],
    linkSegments: ["real", "nested", "link.md"],
    childSegments: ["real", "nested", "link.md"],
  },
] as const) {
  test(name, async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-symlink-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const externalDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-external-"));
    t.after(() => fs.rm(externalDirectory, { recursive: true, force: true }));
    await fs.mkdir(path.join(directory, ...existingSegments), { recursive: true });
    const linkPath = path.join(directory, ...linkSegments);
    const child = path.join(directory, ...childSegments);
    await fs.symlink(externalDirectory, linkPath);
    const expectedError = {
      name: "SymlinkRefusedError",
      message: `plugin component contains symlink ${linkPath} -> ${externalDirectory} (parent: ${directory}, target: ${child}).`,
      parent: directory,
      child,
      linkPath,
      linkTarget: externalDirectory,
    };
    let symlinkError: unknown;

    // act
    try {
      await assertPathInside(directory, child, "plugin component");
    } catch (error) {
      symlinkError = error;
    }

    // assert
    assert.ok(symlinkError instanceof SymlinkRefusedError);
    assert.ok(symlinkError instanceof PathContainmentError);
    assert.ok(symlinkError instanceof Error);
    assert.deepStrictEqual(
      {
        name: symlinkError.name,
        message: symlinkError.message,
        parent: symlinkError.parent,
        child: symlinkError.child,
        linkPath: symlinkError.linkPath,
        linkTarget: symlinkError.linkTarget,
      },
      expectedError,
    );
  });
}

test("walks segments through the required inspector in order", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-port-order-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "alpha", "beta", "component.md");
  const directoryStats = await fs.lstat(directory);
  const inspectionCalls: string[] = [];
  const inspector: PathSafetyInspector = {
    lstat(target: string): Promise<Stats> {
      inspectionCalls.push(`lstat:${target}`);
      return Promise.resolve(directoryStats);
    },
    readlink(target: string): Promise<string> {
      inspectionCalls.push(`readlink:${target}`);
      return Promise.reject(new Error("readlink must not run for a directory"));
    },
  };
  const pathSafetyGuard = createPathSafetyGuard(inspector);

  // act
  await pathSafetyGuard.assertPathInside(directory, child, "ordered component");

  // assert
  assert.deepStrictEqual(inspectionCalls, [
    `lstat:${path.join(directory, "alpha")}`,
    `lstat:${path.join(directory, "alpha", "beta")}`,
    `lstat:${child}`,
  ]);
});

test("rejects lexical traversal before the required inspector runs", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-port-lexical-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const rawChild = `${directory}${path.sep}nested${path.sep}..${path.sep}outside`;
  const inspectionCalls: string[] = [];
  const inspector: PathSafetyInspector = {
    lstat(target: string): Promise<Stats> {
      inspectionCalls.push(`lstat:${target}`);
      return fs.lstat(target);
    },
    readlink(target: string): Promise<string> {
      inspectionCalls.push(`readlink:${target}`);
      return fs.readlink(target);
    },
  };
  const pathSafetyGuard = createPathSafetyGuard(inspector);
  let traversalError: unknown;

  // act
  try {
    await pathSafetyGuard.assertPathInside(directory, rawChild, "plugin source");
  } catch (error) {
    traversalError = error;
  }

  // assert
  assert.ok(traversalError instanceof LexicalTraversalError);
  assert.deepStrictEqual(
    {
      parent: traversalError.parent,
      child: traversalError.child,
    },
    {
      parent: path.resolve(directory),
      child: path.resolve(rawChild),
    },
  );
  assert.deepStrictEqual(inspectionCalls, []);
});

test("reads a symlink only after lstat through the required inspector", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-port-readlink-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const externalDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-port-target-"));
  t.after(() => fs.rm(externalDirectory, { recursive: true, force: true }));
  const linkPath = path.join(directory, "link");
  await fs.symlink(externalDirectory, linkPath);
  const linkStats = await fs.lstat(linkPath);
  const inspectionCalls: string[] = [];
  const readlinkError = Object.assign(new Error("readlink denied"), { code: "EACCES" });
  const inspector: PathSafetyInspector = {
    lstat(target: string): Promise<Stats> {
      inspectionCalls.push(`lstat:${target}`);
      return Promise.resolve(linkStats);
    },
    readlink(target: string): Promise<string> {
      inspectionCalls.push(`readlink:${target}`);
      return Promise.reject(readlinkError);
    },
  };
  const pathSafetyGuard = createPathSafetyGuard(inspector);
  let symlinkError: unknown;

  // act
  try {
    await pathSafetyGuard.assertPathInside(directory, linkPath, "plugin component");
  } catch (error) {
    symlinkError = error;
  }

  // assert
  assert.ok(symlinkError instanceof SymlinkRefusedError);
  assert.deepStrictEqual(
    {
      name: symlinkError.name,
      message: symlinkError.message,
      linkPath: symlinkError.linkPath,
      linkTarget: symlinkError.linkTarget,
    },
    {
      name: "SymlinkRefusedError",
      message: `plugin component contains symlink ${linkPath} -> <unreadable> (parent: ${directory}, target: ${linkPath}).`,
      linkPath,
      linkTarget: "<unreadable>",
    },
  );
  assert.deepStrictEqual(inspectionCalls, [`lstat:${linkPath}`, `readlink:${linkPath}`]);
});

test("propagates a required inspector lstat failure unchanged", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-port-lstat-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "blocked");
  const lstatError = Object.assign(new Error("lstat denied"), { code: "EACCES" });
  const inspectionCalls: string[] = [];
  const inspector: PathSafetyInspector = {
    lstat(target: string): Promise<Stats> {
      inspectionCalls.push(`lstat:${target}`);
      return Promise.reject(lstatError);
    },
    readlink(target: string): Promise<string> {
      inspectionCalls.push(`readlink:${target}`);
      return fs.readlink(target);
    },
  };
  const pathSafetyGuard = createPathSafetyGuard(inspector);
  let lstatFailure: unknown;

  // act
  try {
    await pathSafetyGuard.assertPathInside(directory, child, "blocked component");
  } catch (error) {
    lstatFailure = error;
  }

  // assert
  assert.strictEqual(lstatFailure, lstatError);
  assert.deepStrictEqual(inspectionCalls, [`lstat:${child}`]);
});
