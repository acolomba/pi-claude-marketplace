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
});

describe("isPlainMarkdownFile", () => {
  for (const { title, entryName, kind, expectedPlain } of [
    {
      title: "accepts a regular markdown file",
      entryName: "entry.md",
      kind: "file",
      expectedPlain: true,
    },
    {
      title: "rejects a hidden markdown file",
      entryName: ".entry.md",
      kind: "file",
      expectedPlain: false,
    },
    {
      title: "rejects a markdown directory",
      entryName: "entry.md",
      kind: "directory",
      expectedPlain: false,
    },
    {
      title: "rejects a regular non-markdown file",
      entryName: "entry.txt",
      kind: "file",
      expectedPlain: false,
    },
  ] as const) {
    test(title, async (t) => {
      // arrange
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fs-markdown-"));
      t.after(() => fs.rm(directory, { recursive: true, force: true }));
      const entryPath = path.join(directory, entryName);
      if (kind === "directory") {
        await fs.mkdir(entryPath);
      } else {
        await fs.writeFile(entryPath, "content");
      }

      const entries = await fs.readdir(directory, { withFileTypes: true });
      const entry = entries[0];
      assert.ok(entry !== undefined);

      // act
      const isPlain = await isPlainMarkdownFile(directory, entry);

      // assert
      assert.strictEqual(isPlain, expectedPlain);
    });
  }
});
