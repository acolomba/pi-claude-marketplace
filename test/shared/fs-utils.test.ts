import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  cleanupStaging,
  createRemovalOps,
  isPlainMarkdownFile,
  pathExists,
  readDirEntriesTolerant,
  resolveGitSubdirRoot,
} from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import {
  FILE_CONTENTS,
  NESTED_CONTENTS,
  registerRemovalOpsContract,
} from "../platform/removal-ops-contract.ts";
import { createRemovalOpsFake } from "../platform/removal-ops-fake.ts";

// Builtin-module patching that remains in this file, and why. The removal port
// carries `cleanupStaging`'s removals, so every fault on them is injected
// through the collaborator instead. Three faults have no port to travel
// through:
//
//   - `fs.lstat` twice, for `pathExists` and for `isPlainMarkdownFile`.
//   - `fs.readdir` once, for `readDirEntriesTolerant`.
//
// D-08-13 leaves those two verbs outside the port's membership.

/**
 * `createRemovalOps` and `createRemovalOpsFake` answer one shared contract. The
 * fake's half runs in `test/platform/removal-ops-fake.test.ts`; this half drives
 * the real adapter against a per-case temporary root, which is also what covers
 * the adapter's binding.
 */
describe("createRemovalOps", () => {
  registerRemovalOpsContract(async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "fs-removal-ops-"));
    t.after(() => fs.rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const treePath = path.join(root, "tree");
    const filePath = path.join(root, "file-a.md");
    const nestedPath = path.join(treePath, "nested-a.md");
    await fs.mkdir(treePath);
    await fs.writeFile(filePath, FILE_CONTENTS);
    await fs.writeFile(nestedPath, NESTED_CONTENTS);

    return {
      removalOps: createRemovalOps(),
      filePath,
      treePath,
      nestedPath,
      absentPath: path.join(root, "absent"),
      present: (target) => pathExists(target),
    };
  });
});

describe("cleanupStaging", () => {
  test("removes an existing directory tree", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-cleanup-tree-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    await fs.mkdir(path.join(directory, "nested"));
    await fs.writeFile(path.join(directory, "nested", "content.txt"), "content");

    // act
    const leak = await cleanupStaging(createRemovalOps(), directory, "test staging directory");

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(await pathExists(directory), false);
  });

  test("accepts an absent directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-cleanup-missing-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const missingDirectory = path.join(directory, "missing");

    // act
    const leak = await cleanupStaging(
      createRemovalOps(),
      missingDirectory,
      "test staging directory",
    );

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(await pathExists(missingDirectory), false);
  });

  test("accepts an ENOENT removal failure", async () => {
    // arrange
    const removalError = Object.assign(new Error("missing"), { code: "ENOENT" });
    const removal = createRemovalOpsFake({
      boundary: "memory",
      rmErrors: [["/staging/missing", removalError]],
    });

    // act
    const leak = await cleanupStaging(
      removal.removalOps,
      "/staging/missing",
      "test staging directory",
    );

    // assert
    assert.strictEqual(leak, undefined);
  });

  test("returns a complete leak for an adjacent unexpected removal error", async () => {
    // arrange
    const removalError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    const removal = createRemovalOpsFake({
      boundary: "memory",
      rmErrors: [["/staging/blocked", removalError]],
    });
    const expectedLeak =
      "failed to clean up test staging directory at /staging/blocked: permission denied";

    // act
    const leak = await cleanupStaging(
      removal.removalOps,
      "/staging/blocked",
      "test staging directory",
    );

    // assert
    assert.strictEqual(leak, expectedLeak);
  });
});

describe("pathExists", () => {
  test("returns true for an existing file", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-exists-file-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "present.txt");
    await fs.writeFile(filePath, "present");

    // act
    const exists = await pathExists(filePath);

    // assert
    assert.strictEqual(exists, true);
  });

  test("returns false for a missing path", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-exists-missing-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const missingPath = path.join(directory, "missing.txt");

    // act
    const exists = await pathExists(missingPath);

    // assert
    assert.strictEqual(exists, false);
  });

  test("returns false when one parent step is not a directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-exists-notdir-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "file.txt");
    await fs.writeFile(filePath, "content");
    const childPath = path.join(filePath, "child");

    // act
    const exists = await pathExists(childPath);

    // assert
    assert.strictEqual(exists, false);
  });

  test("rethrows an adjacent unexpected lstat error", async (t) => {
    // arrange
    const lstatError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    t.mock.method(fs, "lstat", (): Promise<never> => Promise.reject(lstatError));

    // act & assert
    await assert.rejects(
      () => pathExists("/blocked"),
      (error) => error === lstatError,
    );
  });
});

describe("resolveGitSubdirRoot", () => {
  test("materializes one contained existing path step", async (t) => {
    // arrange
    const cloneRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fs-git-contained-"));
    t.after(() => fs.rm(cloneRoot, { recursive: true, force: true }));
    const pluginRoot = path.join(cloneRoot, "plugin");
    await fs.mkdir(pluginRoot);
    const expectedRoot = { kind: "materialized", pluginRoot };

    // act
    const resolvedRoot = await resolveGitSubdirRoot(cloneRoot, "plugin");

    // assert
    assert.deepStrictEqual(resolvedRoot, expectedRoot);
  });

  test("reports one contained missing path step", async (t) => {
    // arrange
    const cloneRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fs-git-missing-"));
    t.after(() => fs.rm(cloneRoot, { recursive: true, force: true }));
    const expectedRoot = {
      kind: "missing-subdir",
      detail: 'git-subdir path "missing" does not exist in the plugin clone',
    };

    // act
    const resolvedRoot = await resolveGitSubdirRoot(cloneRoot, "missing");

    // assert
    assert.deepStrictEqual(resolvedRoot, expectedRoot);
  });

  test("reports one escaping parent path step", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-git-escape-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const cloneRoot = path.join(directory, "clone");
    const outsideRoot = path.join(directory, "outside");
    await fs.mkdir(cloneRoot);
    const expectedRoot = {
      kind: "escapes",
      detail: `git-subdir path "../outside" escapes ${cloneRoot} (resolved: ${outsideRoot}).`,
    };

    // act
    const resolvedRoot = await resolveGitSubdirRoot(cloneRoot, "../outside");

    // assert
    assert.deepStrictEqual(resolvedRoot, expectedRoot);
  });

  test("materializes the clone root at the equality boundary", async (t) => {
    // arrange
    const cloneRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fs-git-equal-"));
    t.after(() => fs.rm(cloneRoot, { recursive: true, force: true }));
    const expectedRoot = { kind: "materialized", pluginRoot: cloneRoot };

    // act
    const resolvedRoot = await resolveGitSubdirRoot(cloneRoot, ".");

    // assert
    assert.deepStrictEqual(resolvedRoot, expectedRoot);
  });

  test("rethrows an unexpected contained-path error", async (t) => {
    // arrange
    const cloneRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fs-git-invalid-"));
    t.after(() => fs.rm(cloneRoot, { recursive: true, force: true }));

    // act & assert
    await assert.rejects(
      () => resolveGitSubdirRoot(cloneRoot, "\0"),
      (error) => {
        assert.ok(error instanceof TypeError);
        assert.strictEqual((error as NodeJS.ErrnoException).code, "ERR_INVALID_ARG_VALUE");
        return true;
      },
    );
  });
});

describe("readDirEntriesTolerant", () => {
  test("returns the complete entry for a present directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-read-present-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    await fs.writeFile(path.join(directory, "entry.md"), "content");
    const expectedEntries = [
      { name: "entry.md", isDirectory: false, isFile: true, isSymbolicLink: false },
    ];

    // act
    const entries = (await readDirEntriesTolerant(directory)).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      isSymbolicLink: entry.isSymbolicLink(),
    }));

    // assert
    assert.deepStrictEqual(entries, expectedEntries);
  });

  test("returns an empty list for a missing directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-read-missing-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const missingDirectory = path.join(directory, "missing");

    // act
    const entries = await readDirEntriesTolerant(missingDirectory);

    // assert
    assert.deepStrictEqual(entries, []);
  });

  test("returns an empty list for an existing empty directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-read-empty-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));

    // act
    const entries = await readDirEntriesTolerant(directory);

    // assert
    assert.deepStrictEqual(entries, []);
  });

  test("returns an empty list when one path step is not a directory", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-read-notdir-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "file.txt");
    await fs.writeFile(filePath, "content");
    const childPath = path.join(filePath, "child");

    // act
    const entries = await readDirEntriesTolerant(childPath);

    // assert
    assert.deepStrictEqual(entries, []);
  });

  test("rethrows an adjacent unexpected readdir error", async (t) => {
    // arrange
    const readdirError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    t.mock.method(fs, "readdir", (): Promise<never> => Promise.reject(readdirError));

    // act & assert
    await assert.rejects(
      () => readDirEntriesTolerant("/blocked"),
      (error) => error === readdirError,
    );
  });
});

describe("isPlainMarkdownFile", () => {
  for (const { title, entryName, materialize, expectedPlain } of [
    {
      title: "accepts a regular markdown file",
      entryName: "entry.md",
      materialize: (entryPath: string) => fs.writeFile(entryPath, "content"),
      expectedPlain: true,
    },
    {
      title: "rejects a hidden markdown file",
      entryName: ".entry.md",
      materialize: (entryPath: string) => fs.writeFile(entryPath, "content"),
      expectedPlain: false,
    },
    {
      title: "rejects a markdown directory",
      entryName: "entry.md",
      materialize: (entryPath: string) => fs.mkdir(entryPath),
      expectedPlain: false,
    },
    {
      title: "rejects a regular non-markdown file",
      entryName: "entry.txt",
      materialize: (entryPath: string) => fs.writeFile(entryPath, "content"),
      expectedPlain: false,
    },
  ] as const) {
    test(title, async (t) => {
      // arrange
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-markdown-"));
      t.after(() => fs.rm(directory, { recursive: true, force: true }));
      const entryPath = path.join(directory, entryName);
      await materialize(entryPath);

      const entries = await fs.readdir(directory, { withFileTypes: true });
      const entry = entries[0];
      assert.ok(entry !== undefined);

      // act
      const isPlain = await isPlainMarkdownFile(directory, entry);

      // assert
      assert.strictEqual(isPlain, expectedPlain);
    });
  }

  test("rejects a markdown entry whose path is a symbolic link", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-markdown-link-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const sourceDirectory = path.join(directory, "source");
    const linkedDirectory = path.join(directory, "linked");
    await fs.mkdir(sourceDirectory);
    await fs.mkdir(linkedDirectory);
    const sourcePath = path.join(sourceDirectory, "entry.md");
    await fs.writeFile(sourcePath, "content");
    await fs.symlink(sourcePath, path.join(linkedDirectory, "entry.md"));
    const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
    const entry = entries[0];
    assert.ok(entry !== undefined);

    // act
    const isPlain = await isPlainMarkdownFile(linkedDirectory, entry);

    // assert
    assert.strictEqual(isPlain, false);
  });

  test("rethrows an unexpected markdown lstat error", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-markdown-error-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    await fs.writeFile(path.join(directory, "entry.md"), "content");
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const entry = entries[0];
    assert.ok(entry !== undefined);
    const lstatError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    t.mock.method(fs, "lstat", (): Promise<never> => Promise.reject(lstatError));

    // act & assert
    await assert.rejects(
      () => isPlainMarkdownFile(directory, entry),
      (error) => error === lstatError,
    );
  });
});
