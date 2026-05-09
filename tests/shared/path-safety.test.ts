import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
} from "../../extensions/claude-marketplace/shared/path-safety.ts";

/**
 * PS-1..5, NFR-10, D-14..17 -- assertPathInside symlink-refusing chokepoint.
 *
 * Tests use real tmp dirs + real symlinks. Each test creates an isolated
 * tmpdir, exercises the SUT, then cleans up. The non-existent-leaf cases
 * specifically must NOT throw (the function is called BEFORE writes, so
 * the leaf typically does not exist yet).
 */

async function makeTmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "ps-"));
}

test("happy path: child inside parent does not throw (PS-1)", async () => {
  const dir = await makeTmpDir();
  try {
    await mkdir(path.join(dir, "a", "b", "c"), { recursive: true });
    await assertPathInside(dir, path.join(dir, "a", "b", "c"), "happy");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("direct escape: child outside parent throws PathContainmentError (NFR-10)", async () => {
  const dir = await makeTmpDir();
  try {
    let caught: unknown = null;
    try {
      await assertPathInside(dir, "/etc/passwd", "escape-label");
    } catch (err) {
      caught = err;
    }

    assert.ok(caught !== null, "expected throw on direct escape");
    assert.ok(
      caught instanceof PathContainmentError,
      `expected PathContainmentError, got ${(caught as Error | null)?.constructor.name ?? "null"}`,
    );
    assert.ok(
      !(caught instanceof SymlinkRefusedError),
      "string-level escape must NOT be reported as SymlinkRefusedError",
    );
    assert.match((caught as Error).message, /escape-label/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("leaf symlink to outside path throws SymlinkRefusedError with linkTarget (D-14)", async () => {
  const dir = await makeTmpDir();
  try {
    const linkPath = path.join(dir, "innocent.md");
    await symlink("/etc/passwd", linkPath);

    let caught: unknown = null;
    try {
      await assertPathInside(dir, linkPath, "leaf-sym");
    } catch (err) {
      caught = err;
    }

    assert.ok(
      caught instanceof SymlinkRefusedError,
      `expected SymlinkRefusedError, got ${(caught as Error | null)?.constructor.name ?? "null"}`,
    );
    // D-17 inheritance:
    assert.ok(
      caught instanceof PathContainmentError,
      "SymlinkRefusedError must be instanceof PathContainmentError",
    );
    assert.equal(caught.linkTarget, "/etc/passwd");
    assert.equal(caught.linkPath, linkPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("parent-component symlink throws SymlinkRefusedError with offending parent path (D-16)", async () => {
  const dir = await makeTmpDir();
  const externalDir = await makeTmpDir(); // a real dir outside `dir`
  try {
    // Make `dir/agents` a symlink to externalDir (escapes via parent).
    const parentLink = path.join(dir, "agents");
    await symlink(externalDir, parentLink);

    let caught: unknown = null;
    try {
      await assertPathInside(dir, path.join(dir, "agents", "foo.md"), "parent-sym");
    } catch (err) {
      caught = err;
    }

    assert.ok(
      caught instanceof SymlinkRefusedError,
      `expected SymlinkRefusedError, got ${(caught as Error | null)?.constructor.name ?? "null"}`,
    );
    // The OFFENDING linkPath is the parent dir, not the leaf:
    assert.equal(
      caught.linkPath,
      parentLink,
      "linkPath must be the offending parent component, not the leaf",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(externalDir, { recursive: true, force: true });
  }
});

test("non-existent leaf (write-target case) does not throw (D-14 ENOENT tolerance)", async () => {
  const dir = await makeTmpDir();
  try {
    // The leaf does not exist; assertPathInside is being called BEFORE a write.
    await assertPathInside(dir, path.join(dir, "agents", "not-yet-created.md"), "enoent-leaf");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ENOENT mid-walk (intermediate dir absent) does not throw (D-14 ENOENT tolerance)", async () => {
  const dir = await makeTmpDir();
  try {
    // Neither `agents` nor the leaf exists -- the walk hits ENOENT on the first
    // intermediate component and returns early.
    await assertPathInside(dir, path.join(dir, "agents", "subdir", "leaf.md"), "enoent-mid");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("error class hierarchy: SymlinkRefusedError instanceof PathContainmentError (D-17)", async () => {
  const dir = await makeTmpDir();
  try {
    const linkPath = path.join(dir, "lk");
    await symlink("/tmp", linkPath);

    let sym: SymlinkRefusedError | null = null;
    try {
      await assertPathInside(dir, linkPath, "hierarchy");
    } catch (err) {
      sym = err as SymlinkRefusedError;
    }

    assert.ok(sym instanceof SymlinkRefusedError);
    assert.ok(
      sym instanceof PathContainmentError,
      "PI-14 inheritance: callers using `instanceof PathContainmentError` must catch both classes",
    );
    assert.ok(sym instanceof Error);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("foreign content: regular file (non-symlink) inside parent does not throw (PS-2 baseline)", async () => {
  const dir = await makeTmpDir();
  try {
    const filePath = path.join(dir, "a", "b.txt");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "hello");
    await assertPathInside(dir, filePath, "regular-file");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
