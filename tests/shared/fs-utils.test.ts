import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  cleanupStaging,
  isPlainMarkdownFile,
  pathExists,
  readDirEntriesTolerant,
  removeOrphanIfPresent,
  resolveGitSubdirRoot,
  rollbackReplacementCommon,
} from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type {
  RollbackReplacementInput,
  RollbackReplacementLabels,
} from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import type { PathLike, RmOptions } from "node:fs";

const LABELS = {
  replacement: "replacement test entry",
  previous: "previous test entry",
  stagingDir: "test staging directory",
  backupDir: "test backup directory",
} satisfies RollbackReplacementLabels;

describe("cleanupStaging", () => {
  test("removes an existing directory tree", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-cleanup-tree-"));
    const remove = fs.rm.bind(fs);
    t.after(() => remove(directory, { recursive: true, force: true }));
    await fs.mkdir(path.join(directory, "nested"));
    await fs.writeFile(path.join(directory, "nested", "content.txt"), "content");

    // act
    const leak = await cleanupStaging(directory, "test staging directory");

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
    const leak = await cleanupStaging(missingDirectory, "test staging directory");

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(await pathExists(missingDirectory), false);
  });

  test("accepts an ENOENT removal failure", async (t) => {
    // arrange
    const removalError = Object.assign(new Error("missing"), { code: "ENOENT" });
    t.mock.method(fs, "rm", (): Promise<never> => Promise.reject(removalError));

    // act
    const leak = await cleanupStaging("/staging/missing", "test staging directory");

    // assert
    assert.strictEqual(leak, undefined);
  });

  test("returns a complete leak for an adjacent unexpected removal error", async (t) => {
    // arrange
    const removalError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    t.mock.method(fs, "rm", (): Promise<never> => Promise.reject(removalError));
    const expectedLeak =
      "failed to clean up test staging directory at /staging/blocked: permission denied";

    // act
    const leak = await cleanupStaging("/staging/blocked", "test staging directory");

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

describe("removeOrphanIfPresent", () => {
  test("removes a directory in tree mode", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-orphan-tree-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const orphanPath = path.join(directory, "orphan");
    await fs.mkdir(orphanPath);
    await fs.writeFile(path.join(orphanPath, "content.txt"), "content");

    // act
    await removeOrphanIfPresent(orphanPath, "tree");

    // assert
    assert.strictEqual(await pathExists(orphanPath), false);
  });

  test("removes a regular file in file mode", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-orphan-file-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const orphanPath = path.join(directory, "orphan.md");
    await fs.writeFile(orphanPath, "content");

    // act
    await removeOrphanIfPresent(orphanPath, "file");

    // assert
    assert.strictEqual(await pathExists(orphanPath), false);
  });

  test("keeps a regular file in tree mode", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-orphan-tree-mismatch-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const orphanPath = path.join(directory, "orphan.txt");
    await fs.writeFile(orphanPath, "preserved");

    // act
    await removeOrphanIfPresent(orphanPath, "tree");

    // assert
    assert.strictEqual(await fs.readFile(orphanPath, "utf8"), "preserved");
  });

  test("keeps a directory in file mode", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-orphan-file-mismatch-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const orphanPath = path.join(directory, "orphan");
    await fs.mkdir(orphanPath);

    // act
    await removeOrphanIfPresent(orphanPath, "file");

    // assert
    assert.deepStrictEqual(await fs.readdir(orphanPath), []);
  });

  for (const mode of ["file", "tree"] as const) {
    test(`accepts a missing target in ${mode} mode`, async (t) => {
      // arrange
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-orphan-missing-"));
      t.after(() => fs.rm(directory, { recursive: true, force: true }));
      const orphanPath = path.join(directory, "missing");

      // act
      await removeOrphanIfPresent(orphanPath, mode);

      // assert
      assert.strictEqual(await pathExists(orphanPath), false);
    });
  }

  test("rethrows an adjacent unexpected stat error", async (t) => {
    // arrange
    const statError = Object.assign(new Error("permission denied"), { code: "EACCES" });
    t.mock.method(fs, "stat", (): Promise<never> => Promise.reject(statError));

    // act & assert
    await assert.rejects(
      () => removeOrphanIfPresent("/blocked", "file"),
      (error) => error === statError,
    );
  });
});

describe("rollbackReplacementCommon", () => {
  test("returns a frozen empty leak list for empty inputs", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-rollback-empty-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const stagingRoot = path.join(directory, "staging");
    const backupRoot = path.join(directory, "backup");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(backupRoot);
    const input = {
      renamed: [],
      backups: [],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    } satisfies RollbackReplacementInput;

    // act
    const leaks = await rollbackReplacementCommon(input);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
    assert.strictEqual(await pathExists(stagingRoot), false);
    assert.strictEqual(await pathExists(backupRoot), false);
  });

  test("removes replacements and restores backups", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-rollback-values-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const stagingRoot = path.join(directory, "staging");
    const backupRoot = path.join(directory, "backup");
    const firstReplacement = path.join(directory, "live-a.txt");
    const secondReplacement = path.join(directory, "live-b.txt");
    const firstRestored = path.join(directory, "restored", "a.txt");
    const secondRestored = path.join(directory, "restored", "b.txt");
    const firstBackup = path.join(backupRoot, "a.txt");
    const secondBackup = path.join(backupRoot, "b.txt");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(backupRoot);
    await fs.writeFile(firstReplacement, "new-a");
    await fs.writeFile(secondReplacement, "new-b");
    await fs.writeFile(firstBackup, "old-a");
    await fs.writeFile(secondBackup, "old-b");
    const input = {
      renamed: [
        { from: path.join(stagingRoot, "a.txt"), to: firstReplacement },
        { from: path.join(stagingRoot, "b.txt"), to: secondReplacement },
      ],
      backups: [
        { name: "same", from: firstRestored, to: firstBackup },
        { name: "same", from: secondRestored, to: secondBackup },
      ],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    } satisfies RollbackReplacementInput;

    // act
    const leaks = await rollbackReplacementCommon(input);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(await pathExists(firstReplacement), false);
    assert.strictEqual(await pathExists(secondReplacement), false);
    assert.strictEqual(await fs.readFile(firstRestored, "utf8"), "old-a");
    assert.strictEqual(await fs.readFile(secondRestored, "utf8"), "old-b");
    assert.strictEqual(await pathExists(stagingRoot), false);
    assert.strictEqual(await pathExists(backupRoot), false);
  });

  test("uses stable reverse input order for equal-name items", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-rollback-order-"));
    const remove = fs.rm.bind(fs);
    const rename = fs.rename.bind(fs);
    t.after(() => remove(directory, { recursive: true, force: true }));
    const stagingRoot = path.join(directory, "staging");
    const backupRoot = path.join(directory, "backup");
    const firstReplacement = path.join(directory, "live-a.txt");
    const secondReplacement = path.join(directory, "live-b.txt");
    const firstRestored = path.join(directory, "restored", "a.txt");
    const secondRestored = path.join(directory, "restored", "b.txt");
    const firstBackup = path.join(backupRoot, "a.txt");
    const secondBackup = path.join(backupRoot, "b.txt");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(backupRoot);
    await fs.writeFile(firstReplacement, "new-a");
    await fs.writeFile(secondReplacement, "new-b");
    await fs.writeFile(firstBackup, "old-a");
    await fs.writeFile(secondBackup, "old-b");
    const operations: string[] = [];
    t.mock.method(fs, "rm", async (target: PathLike, options?: RmOptions) => {
      operations.push(`rm ${String(target)} ${JSON.stringify(options)}`);
      await remove(target, options);
    });
    t.mock.method(fs, "rename", async (from: PathLike, to: PathLike) => {
      operations.push(`rename ${String(from)} -> ${String(to)}`);
      await rename(from, to);
    });
    const expectedOperations = [
      `rm ${secondReplacement} {"force":true}`,
      `rm ${firstReplacement} {"force":true}`,
      `rename ${secondBackup} -> ${secondRestored}`,
      `rename ${firstBackup} -> ${firstRestored}`,
      `rm ${stagingRoot} {"recursive":true,"force":true}`,
      `rm ${backupRoot} {"recursive":true,"force":true}`,
    ];
    const input = {
      renamed: [
        { from: path.join(stagingRoot, "a.txt"), to: firstReplacement },
        { from: path.join(stagingRoot, "b.txt"), to: secondReplacement },
      ],
      backups: [
        { name: "same", from: firstRestored, to: firstBackup },
        { name: "same", from: secondRestored, to: secondBackup },
      ],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
    } satisfies RollbackReplacementInput;

    // act
    const leaks = await rollbackReplacementCommon(input);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.deepStrictEqual(operations, expectedOperations);
    assert.strictEqual(await fs.readFile(firstRestored, "utf8"), "old-a");
    assert.strictEqual(await fs.readFile(secondRestored, "utf8"), "old-b");
  });

  test("removes a replacement tree and appends before-cleanup leaks", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-rollback-tree-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const stagingRoot = path.join(directory, "staging");
    const backupRoot = path.join(directory, "backup");
    const replacement = path.join(directory, "replacement");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(backupRoot);
    await fs.mkdir(replacement);
    await fs.writeFile(path.join(replacement, "content.txt"), "content");
    const input = {
      renamed: [{ from: path.join(stagingRoot, "replacement"), to: replacement }],
      backups: [],
      stagingRoot,
      backupRoot,
      removeMode: "tree",
      labels: LABELS,
      beforeCleanup: () => Promise.resolve(["bridge cleanup leak"]),
    } satisfies RollbackReplacementInput;

    // act
    const leaks = await rollbackReplacementCommon(input);

    // assert
    assert.deepStrictEqual(leaks, ["bridge cleanup leak"]);
    assert.strictEqual(Object.isFrozen(leaks), true);
    assert.strictEqual(await pathExists(replacement), false);
  });

  test("returns every failure leak in execution order", async (t) => {
    // arrange
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-rollback-leaks-"));
    const remove = fs.rm.bind(fs);
    t.after(() => remove(directory, { recursive: true, force: true }));
    const replacement = path.join(directory, "replacement.txt");
    const restored = path.join(directory, "restored.txt");
    const stagingRoot = path.join(directory, "staging");
    const backupRoot = path.join(directory, "backup");
    const backup = path.join(backupRoot, "restored.txt");
    await fs.mkdir(stagingRoot);
    await fs.mkdir(backupRoot);
    await fs.writeFile(replacement, "new");
    await fs.writeFile(backup, "old");
    const replacementError = Object.assign(new Error("replacement denied"), { code: "EACCES" });
    const restoreError = Object.assign(new Error("restore denied"), { code: "EACCES" });
    const stagingError = Object.assign(new Error("staging denied"), { code: "EACCES" });
    const backupError = Object.assign(new Error("backup denied"), { code: "EACCES" });
    t.mock.method(fs, "rm", (target: PathLike): Promise<never> => {
      if (String(target) === replacement) {
        return Promise.reject(replacementError);
      }

      if (String(target) === stagingRoot) {
        return Promise.reject(stagingError);
      }

      if (String(target) === backupRoot) {
        return Promise.reject(backupError);
      }

      return Promise.reject(new Error(`unexpected rm target: ${String(target)}`));
    });
    t.mock.method(fs, "rename", (): Promise<never> => Promise.reject(restoreError));
    const expectedLeaks = [
      `failed to remove replacement test entry at ${replacement}: replacement denied`,
      `failed to restore previous test entry same from ${backup} to ${restored}: restore denied`,
      "bridge cleanup leak",
      `failed to clean up test staging directory at ${stagingRoot}: staging denied`,
      `failed to clean up test backup directory at ${backupRoot}: backup denied`,
    ];
    const input = {
      renamed: [{ from: path.join(stagingRoot, "replacement.txt"), to: replacement }],
      backups: [{ name: "same", from: restored, to: backup }],
      stagingRoot,
      backupRoot,
      removeMode: "file",
      labels: LABELS,
      beforeCleanup: () => Promise.resolve(["bridge cleanup leak"]),
    } satisfies RollbackReplacementInput;

    // act
    const leaks = await rollbackReplacementCommon(input);

    // assert
    assert.deepStrictEqual(leaks, expectedLeaks);
    assert.strictEqual(Object.isFrozen(leaks), true);
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
    const remove = fs.rm.bind(fs);
    t.after(() => remove(directory, { recursive: true, force: true }));
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
