// tests/orchestrators/plugin/mirror-head-read-errors.test.ts
//
// MIRR-05 error arms of the fs-only mirror HEAD-sha reader, complementing
// mirror-head-read.test.ts (which covers the three healthy layouts):
//   - a NON-ENOENT loose-ref read failure must rethrow (only a missing loose
//     ref may fall back to packed-refs);
//   - a packed-refs file that lacks the HEAD ref must throw the descriptive
//     no-sha error after skipping comment and peeled lines.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { readMirrorHeadSha } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";

async function makeLocalRepo(): Promise<{ dir: string; destroy: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "mirror-head-read-err-"));
  await git.init({ fs, dir, defaultBranch: "main" });
  await writeFile(path.join(dir, "README.md"), "# mirror\n");
  await git.add({ fs, dir, filepath: "README.md" });
  await git.commit({
    fs,
    dir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
  return { dir, destroy: () => rm(dir, { recursive: true, force: true }) };
}

void test("readMirrorHeadSha rethrows a non-ENOENT loose-ref read failure instead of falling through to packed-refs", async () => {
  const repo = await makeLocalRepo();
  try {
    // Replace the loose ref FILE with a DIRECTORY of the same name: readFile
    // then fails with EISDIR (not ENOENT), which must rethrow -- only a
    // missing loose ref may fall back to the packed-refs read.
    const looseRef = path.join(repo.dir, ".git", "refs", "heads", "main");
    await unlink(looseRef);
    await mkdir(looseRef);

    await assert.rejects(
      () => readMirrorHeadSha(repo.dir),
      (err: NodeJS.ErrnoException) => err.code === "EISDIR",
    );
  } finally {
    await repo.destroy();
  }
});

void test("readMirrorHeadSha throws the no-sha error when packed-refs lacks the HEAD ref (comment and peeled lines skipped)", async () => {
  const repo = await makeLocalRepo();
  try {
    const looseRef = path.join(repo.dir, ".git", "refs", "heads", "main");
    const sha = (await readFile(looseRef, "utf8")).trim();
    // packed-refs carries a comment line, an unrelated ref, and a `^` peeled
    // line -- but NOT refs/heads/main, so the reader must exhaust the file
    // and throw its descriptive error rather than return a wrong sha.
    await writeFile(
      path.join(repo.dir, ".git", "packed-refs"),
      [
        "# pack-refs with: peeled fully-peeled sorted",
        `${sha} refs/tags/v9.9.9`,
        `^${sha}`,
        "",
      ].join("\n"),
    );
    await unlink(looseRef);
    await rmdir(path.join(repo.dir, ".git", "refs", "heads")).catch(() => undefined);

    await assert.rejects(
      () => readMirrorHeadSha(repo.dir),
      /mirror HEAD ref "refs\/heads\/main" resolved to no sha/,
    );
  } finally {
    await repo.destroy();
  }
});
