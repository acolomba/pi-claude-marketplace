import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanupStaging, pathExists } from "../../extensions/claude-marketplace/shared/fs-utils.ts";

// shared/fs-utils.ts -- cleanupStaging + pathExists.

test("cleanupStaging removes existing directory recursively and returns undefined", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "cs-success-"));
  // Populate the dir with a file + nested dir + nested file so recursive
  // removal is actually exercised.
  await writeFile(path.join(tmp, "top.txt"), "hello");
  await mkdir(path.join(tmp, "nested"));
  await writeFile(path.join(tmp, "nested", "inside.txt"), "world");

  const leak = await cleanupStaging(tmp, "test-staging");
  assert.equal(leak, undefined);
  assert.equal(await pathExists(tmp), false);
});

test("cleanupStaging returns undefined when directory does not exist (ENOENT silenced)", async () => {
  const leak = await cleanupStaging("/nonexistent/path/xyz-no-such-dir-here", "test-staging");
  assert.equal(leak, undefined);
});

test("cleanupStaging returns leak message string when rm fails (W-01 chmod 0 case, POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  // Refuse to run as root: chmod 0 has no effect for the superuser, the rm
  // would succeed, and the test would falsely fail. Only flag this case;
  // do not attempt to read process.getuid where it's missing.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block rm");
    return;
  }

  // Create a parent dir and a child dir; populate the child with a file;
  // chmod the PARENT to 0 so the child cannot be unlinked. (chmod'ing the
  // child itself is insufficient on most POSIX FSes -- rm needs write+exec
  // on the parent to remove a child.)
  const parent = await mkdtemp(path.join(os.tmpdir(), "cs-fail-"));
  const child = path.join(parent, "victim");
  await mkdir(child);
  await writeFile(path.join(child, "file.txt"), "x");

  try {
    await chmod(parent, 0o000);

    const leak = await cleanupStaging(child, "test-staging");
    assert.equal(typeof leak, "string", "expected leak message string");
    assert.ok(leak !== undefined);
    assert.match(leak, /failed to clean up test-staging/);
    assert.match(leak, new RegExp(child.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    // Restore permissions so afterwards-cleanup of the tmp tree by node-test
    // / OS does not leak the locked dir.
    await chmod(parent, 0o755);
    // Best-effort cleanup of the test's own tmp tree.
    await cleanupStaging(parent, "test-cleanup");
  }
});

test("pathExists returns true for existing file", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pe-file-"));
  const file = path.join(tmp, "f.txt");
  await writeFile(file, "x");

  try {
    assert.equal(await pathExists(file), true);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("pathExists returns true for existing directory", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pe-dir-"));
  try {
    assert.equal(await pathExists(tmp), true);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("pathExists returns false for missing path (ENOENT)", async () => {
  assert.equal(await pathExists("/no/such/file/here-xyz"), false);
});

test("pathExists returns false for ENOTDIR (file-as-parent component)", async () => {
  // Construct a path where a non-directory file appears as a parent
  // component -- lstat resolves this to ENOTDIR rather than ENOENT.
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pe-notdir-"));
  const file = path.join(tmp, "f.txt");
  await writeFile(file, "x");
  const wrong = path.join(file, "child");

  try {
    assert.equal(await pathExists(wrong), false);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});
