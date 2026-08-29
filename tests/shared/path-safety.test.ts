import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
} from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

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

  // act
  const containment = await assertPathInside(directory, directory, "equal boundary");

  // assert
  assert.strictEqual(containment, undefined);
});

test("accepts an existing direct child", async (t) => {
  // arrange
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "path-safety-child-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const child = path.join(directory, "component.md");
  await fs.writeFile(child, "content");

  // act
  const containment = await assertPathInside(directory, child, "direct child");

  // assert
  assert.strictEqual(containment, undefined);
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
  const containment = await assertPathInside(directory, child, "future component");

  // assert
  assert.strictEqual(containment, undefined);
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
