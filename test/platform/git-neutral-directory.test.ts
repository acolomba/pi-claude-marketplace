import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { createNeutralDirectory } from "../../extensions/pi-claude-marketplace/platform/git-neutral-directory.ts";

import type { TestContext } from "node:test";

type NeutralDirectoryHost = Parameters<typeof createNeutralDirectory>[0];

// The case's own directory, removed after the case.
async function caseDirectory(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-neutral-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// The current user's id on POSIX; the cases that compare owners skip Windows.
function currentUid(): number {
  const { getuid } = process;
  if (getuid === undefined) {
    throw new Error("this case needs POSIX user ids");
  }

  return getuid();
}

const POSIX = {
  skip: process.platform === "win32" && "Windows has no POSIX user ids or permission bits",
};

function hostAt(parent: string, uid: NeutralDirectoryHost["uid"]): NeutralDirectoryHost {
  return { parent: () => parent, uid };
}

function refusal(directory: string): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof Error);
    assert.strictEqual(error.message, `${directory} is not a private, empty directory`);
    return true;
  };
}

describe("createNeutralDirectory", () => {
  test(
    "SG-PRC-03: makes a private, empty directory and its parent on first use",
    POSIX,
    async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const parent = path.join(root, "agent", "pi-claude-marketplace");
      const neutralDirectory = createNeutralDirectory(hostAt(parent, currentUid));

      // act
      const neutral = await neutralDirectory();

      // assert
      const stats = await lstat(neutral);
      assert.deepStrictEqual(
        [neutral, stats.isDirectory(), stats.mode & 0o777, await readdir(neutral)],
        [path.join(parent, "git-neutral"), true, 0o700, []],
      );
    },
  );

  test("SG-PRC-03: reuses the private, empty directory an earlier use made", POSIX, async (t) => {
    // arrange
    const root = await caseDirectory(t);
    const neutralDirectory = createNeutralDirectory(hostAt(root, currentUid));
    const first = await neutralDirectory();

    // act
    const second = await neutralDirectory();

    // assert
    assert.deepStrictEqual(
      [first, second],
      [path.join(root, "git-neutral"), path.join(root, "git-neutral")],
    );
  });

  test("resolves with the real path when the parent is a symbolic link", POSIX, async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "real"));
    await symlink(path.join(root, "real"), path.join(root, "link"));
    const neutralDirectory = createNeutralDirectory(hostAt(path.join(root, "link"), currentUid));

    // act
    const neutral = await neutralDirectory();

    // assert
    assert.strictEqual(neutral, path.join(root, "real", "git-neutral"));
  });

  test("SG-PRC-03: refuses a symbolic link in the directory's place", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    const target = path.join(root, "target");
    await mkdir(target, { mode: 0o700 });
    await symlink(target, path.join(root, "git-neutral"));
    const neutralDirectory = createNeutralDirectory(hostAt(root, undefined));

    // act & assert
    await assert.rejects(neutralDirectory(), refusal(path.join(root, "git-neutral")));
  });

  test("SG-PRC-03: rejects with the filesystem error of a file in the directory's place", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await writeFile(path.join(root, "git-neutral"), "");
    const neutralDirectory = createNeutralDirectory(hostAt(root, undefined));

    // act & assert
    await assert.rejects(neutralDirectory(), { code: "EEXIST" });
  });

  test("SG-PRC-03: refuses a directory that holds an entry, such as a planted .git", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "git-neutral", ".git"), { recursive: true, mode: 0o700 });
    await chmod(path.join(root, "git-neutral"), 0o700);
    const neutralDirectory = createNeutralDirectory(hostAt(root, undefined));

    // act & assert
    await assert.rejects(neutralDirectory(), refusal(path.join(root, "git-neutral")));
  });

  for (const { mode } of [{ mode: 0o750 }, { mode: 0o705 }, { mode: 0o755 }]) {
    test(`SG-PRC-03: refuses a directory with mode 0${mode.toString(8)}`, POSIX, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      await mkdir(path.join(root, "git-neutral"));
      await chmod(path.join(root, "git-neutral"), mode);
      const neutralDirectory = createNeutralDirectory(hostAt(root, currentUid));

      // act & assert
      await assert.rejects(neutralDirectory(), refusal(path.join(root, "git-neutral")));
    });
  }

  test("SG-PRC-03: refuses a directory another user owns", POSIX, async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "git-neutral"), { mode: 0o700 });
    const otherUser = currentUid() + 1;
    const neutralDirectory = createNeutralDirectory(hostAt(root, () => otherUser));

    // act & assert
    await assert.rejects(neutralDirectory(), refusal(path.join(root, "git-neutral")));
  });

  test("skips the owner and mode checks where the platform has no user ids", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "git-neutral"));
    await chmod(path.join(root, "git-neutral"), 0o755);
    const neutralDirectory = createNeutralDirectory(hostAt(root, undefined));

    // act
    const neutral = await neutralDirectory();

    // assert
    assert.strictEqual(neutral, path.join(root, "git-neutral"));
  });

  test("rejects with the filesystem error when the parent cannot be made", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await writeFile(path.join(root, "file"), "");
    const neutralDirectory = createNeutralDirectory(
      hostAt(path.join(root, "file", "inner"), undefined),
    );

    // act & assert
    await assert.rejects(neutralDirectory(), { code: "ENOTDIR" });
  });
});
