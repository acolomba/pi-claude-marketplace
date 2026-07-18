// tests/orchestrators/plugin/mirror-head-read.test.ts
//
// MIRR-05 / A1: the fs-only mirror HEAD-sha reader is verified against a REAL
// isomorphic-git clone. isomorphic-git writes the HEAD/ref layout that the
// unpinned mirror presence-probe reads back fs-only, so the read MUST match
// what git.resolveRef returns across the loose-ref, packed-refs, and
// detached-HEAD layouts isomorphic-git can produce (T-79.1-06).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdtemp, readFile, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { readMirrorHeadSha } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";

async function makeLocalRepo(): Promise<{ dir: string; destroy: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "mirror-head-read-"));
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

void test("readMirrorHeadSha returns the same sha git.resolveRef returns (loose-ref layout)", async () => {
  const repo = await makeLocalRepo();
  try {
    const expected = await git.resolveRef({ fs, dir: repo.dir, ref: "HEAD" });
    const actual = await readMirrorHeadSha(repo.dir);
    assert.equal(actual, expected);
    assert.match(actual, /^[0-9a-f]{40}$/);
  } finally {
    await repo.destroy();
  }
});

void test("readMirrorHeadSha resolves the sha from packed-refs when the loose ref file is absent", async () => {
  const repo = await makeLocalRepo();
  try {
    const expected = await git.resolveRef({ fs, dir: repo.dir, ref: "HEAD" });

    // Simulate the packed-refs layout isomorphic-git produces after a pack:
    // move the loose ref content into .git/packed-refs, delete the loose file.
    const looseRef = path.join(repo.dir, ".git", "refs", "heads", "main");
    const sha = (await readFile(looseRef, "utf8")).trim();
    await writeFile(
      path.join(repo.dir, ".git", "packed-refs"),
      `# pack-refs with: peeled fully-peeled sorted\n${sha} refs/heads/main\n`,
    );
    await unlink(looseRef);
    // Drop the now-empty refs/heads dir so no loose ref remains.
    await rmdir(path.join(repo.dir, ".git", "refs", "heads")).catch(() => undefined);

    const actual = await readMirrorHeadSha(repo.dir);
    assert.equal(actual, expected);
  } finally {
    await repo.destroy();
  }
});

void test("readMirrorHeadSha returns a detached-HEAD sha directly when .git/HEAD holds a bare sha", async () => {
  const repo = await makeLocalRepo();
  try {
    const sha = await git.resolveRef({ fs, dir: repo.dir, ref: "HEAD" });
    await writeFile(path.join(repo.dir, ".git", "HEAD"), `${sha}\n`);

    const actual = await readMirrorHeadSha(repo.dir);
    assert.equal(actual, sha);
  } finally {
    await repo.destroy();
  }
});
