import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { PathLike } from "node:fs";

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
  const lstatPaths: string[] = [];
  const lstat = fs.lstat.bind(fs);
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  t.mock.method(fs, "lstat", (target: PathLike) => {
    lstatPaths.push(String(target));
    return lstat(target);
  });
  syncBuiltinESMExports();

  // act
  await assertPathInside(directory, child, "future component");

  // assert
  assert.deepStrictEqual(lstatPaths, [path.join(directory, "missing")]);
});

test("walks touching components in parent-to-child order", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-order-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "alpha", "beta", "component.md");
  await fs.mkdir(path.dirname(child), { recursive: true });
  await fs.writeFile(child, "content");
  const lstatPaths: string[] = [];
  const lstat = fs.lstat.bind(fs);
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  t.mock.method(fs, "lstat", (target: PathLike) => {
    lstatPaths.push(String(target));
    return lstat(target);
  });
  syncBuiltinESMExports();

  // act
  await assertPathInside(directory, child, "ordered component");

  // assert
  assert.deepStrictEqual(lstatPaths, [
    path.join(directory, "alpha"),
    path.join(directory, "alpha", "beta"),
    child,
  ]);
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

test("uses the unreadable target marker when readlink fails", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-readlink-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const linkPath = path.join(directory, "link.md");
  await fs.symlink("/outside/plugin", linkPath);
  const readlinkError = Object.assign(new Error("permission denied"), { code: "EACCES" });
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  t.mock.method(fs, "readlink", (): Promise<never> => Promise.reject(readlinkError));
  syncBuiltinESMExports();
  const expectedError = {
    name: "SymlinkRefusedError",
    message: `plugin component contains symlink ${linkPath} -> <unreadable> (parent: ${directory}, target: ${linkPath}).`,
    parent: directory,
    child: linkPath,
    linkPath,
    linkTarget: "<unreadable>",
  };
  let symlinkError: unknown;

  // act
  try {
    await assertPathInside(directory, linkPath, "plugin component");
  } catch (error) {
    symlinkError = error;
  }

  // assert
  assert.ok(symlinkError instanceof SymlinkRefusedError);
  assert.ok(symlinkError instanceof PathContainmentError);
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

test("propagates an unexpected lstat failure unchanged", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-lstat-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "blocked");
  const lstatError = Object.assign(new Error("permission denied"), { code: "EACCES" });
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  t.mock.method(fs, "lstat", (): Promise<never> => Promise.reject(lstatError));
  syncBuiltinESMExports();
  let lstatFailure: unknown;

  // act
  try {
    await assertPathInside(directory, child, "blocked component");
  } catch (error) {
    lstatFailure = error;
  }

  // assert
  assert.strictEqual(lstatFailure, lstatError);
});
