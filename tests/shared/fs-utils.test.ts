import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cleanupStaging,
  pathExists,
  removeOrphanIfPresent,
  rollbackReplacementCommon,
} from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

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

const LABELS = {
  replacement: "replacement test entry",
  previous: "previous test entry",
  stagingDir: "test staging dir",
  backupDir: "test backup dir",
};

test("rollbackReplacementCommon removes renamed, restores backups, cleans up dirs (happy path)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "rr-happy-"));
  const stagingRoot = path.join(tmp, "staging");
  const backupRoot = path.join(tmp, "backup");
  await mkdir(stagingRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });

  const replacementPath = path.join(tmp, "live.txt");
  await writeFile(replacementPath, "new");
  const backupSource = path.join(tmp, "live2.txt");
  const backupCopy = path.join(backupRoot, "live2.txt.bak");
  await writeFile(backupCopy, "old");

  const leaks = await rollbackReplacementCommon({
    renamed: [{ from: path.join(stagingRoot, "live.txt"), to: replacementPath }],
    backups: [{ name: "live2", from: backupSource, to: backupCopy }],
    stagingRoot,
    backupRoot,
    removeMode: "file",
    labels: LABELS,
  });

  assert.deepEqual([...leaks], []);
  assert.equal(await pathExists(replacementPath), false);
  assert.equal(await pathExists(backupSource), true);
  assert.equal(await pathExists(stagingRoot), false);
  assert.equal(await pathExists(backupRoot), false);
});

test("rollbackReplacementCommon records leak when rm of replacement fails (POSIX chmod 0)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block rm");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "rr-rm-fail-"));
  const locked = path.join(tmp, "locked");
  await mkdir(locked);
  const replacementPath = path.join(locked, "victim.txt");
  await writeFile(replacementPath, "x");
  const stagingRoot = path.join(tmp, "staging");
  const backupRoot = path.join(tmp, "backup");
  await mkdir(stagingRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });

  try {
    await chmod(locked, 0o000);

    const leaks = await rollbackReplacementCommon({
      renamed: [{ from: path.join(stagingRoot, "victim.txt"), to: replacementPath }],
      backups: [],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    });

    assert.ok(leaks.length >= 1, "expected a leak");
    assert.match(leaks[0] ?? "", /failed to remove replacement test entry/);
  } finally {
    await chmod(locked, 0o755);
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("rollbackReplacementCommon records leak when rename of backup fails (target chmod 0)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block rename");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "rr-restore-fail-"));
  const lockedParent = path.join(tmp, "locked");
  await mkdir(lockedParent);
  const backupDest = path.join(lockedParent, "where-it-should-go.txt");
  const backupRoot = path.join(tmp, "backup");
  const stagingRoot = path.join(tmp, "staging");
  await mkdir(backupRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  const backupCopy = path.join(backupRoot, "saved.txt");
  await writeFile(backupCopy, "old");

  try {
    await chmod(lockedParent, 0o000);

    const leaks = await rollbackReplacementCommon({
      renamed: [],
      backups: [{ name: "saved", from: backupDest, to: backupCopy }],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    });

    assert.ok(leaks.length >= 1, "expected a leak");
    assert.match(leaks[0] ?? "", /failed to restore previous test entry/);
  } finally {
    await chmod(lockedParent, 0o755);
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("rollbackReplacementCommon surfaces cleanupStaging leak when staging dir cannot be removed", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block rm");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "rr-cleanup-fail-"));
  const stagingParent = path.join(tmp, "locked");
  await mkdir(stagingParent);
  const stagingRoot = path.join(stagingParent, "staging");
  await mkdir(stagingRoot);
  await writeFile(path.join(stagingRoot, "leftover.txt"), "x");
  const backupRoot = path.join(tmp, "backup");
  await mkdir(backupRoot, { recursive: true });

  try {
    await chmod(stagingParent, 0o000);

    const leaks = await rollbackReplacementCommon({
      renamed: [],
      backups: [],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    });

    assert.ok(leaks.length >= 1, "expected a cleanupStaging leak");
    assert.match(leaks[0] ?? "", /failed to clean up test staging dir/);
  } finally {
    await chmod(stagingParent, 0o755);
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("rollbackReplacementCommon honors beforeCleanup hook output", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "rr-hook-"));
  const stagingRoot = path.join(tmp, "staging");
  const backupRoot = path.join(tmp, "backup");
  await mkdir(stagingRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });

  const leaks = await rollbackReplacementCommon({
    renamed: [],
    backups: [],
    stagingRoot,
    backupRoot,
    removeMode: "tree",
    labels: LABELS,
    beforeCleanup: () => Promise.resolve(["hook leak 1", "hook leak 2"]),
  });

  assert.deepEqual([...leaks], ["hook leak 1", "hook leak 2"]);
});

// TR-06 removeOrphanIfPresent kind-strict matrix --------------------------

test("removeOrphanIfPresent mode='tree' rms directory target", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  try {
    const dir = path.join(tmp, "victim");
    await mkdir(dir);
    await writeFile(path.join(dir, "leaf.txt"), "x");

    await removeOrphanIfPresent(dir, "tree");

    await assert.rejects(
      () => stat(dir),
      (err: unknown) => (err as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("removeOrphanIfPresent mode='tree' leaves file target alone (kind mismatch)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  try {
    const file = path.join(tmp, "victim.txt");
    await writeFile(file, "preserve-me");

    await removeOrphanIfPresent(file, "tree");

    const s = await stat(file);
    assert.ok(s.isFile(), "kind mismatch must leave the file target alone");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("removeOrphanIfPresent mode='file' rms file target", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  try {
    const file = path.join(tmp, "victim.md");
    await writeFile(file, "x");

    await removeOrphanIfPresent(file, "file");

    await assert.rejects(
      () => stat(file),
      (err: unknown) => (err as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("removeOrphanIfPresent mode='file' leaves directory target alone (kind mismatch)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  try {
    const dir = path.join(tmp, "victim");
    await mkdir(dir);

    await removeOrphanIfPresent(dir, "file");

    const s = await stat(dir);
    assert.ok(s.isDirectory(), "kind mismatch must leave the directory target alone");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("removeOrphanIfPresent swallows ENOENT for missing target", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  try {
    const missing = path.join(tmp, "never-existed");
    // Both modes must no-op on ENOENT; neither call should throw.
    await removeOrphanIfPresent(missing, "tree");
    await removeOrphanIfPresent(missing, "file");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
