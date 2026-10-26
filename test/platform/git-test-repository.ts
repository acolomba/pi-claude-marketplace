import * as fs from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import * as git from "isomorphic-git";

import type { TestContext } from "node:test";

const author = {
  name: "Git contract",
  email: "git-contract@example.invalid",
} as const;

export interface GitTestRepositoryOptions {
  readonly boundary: "local";
}

export interface GitTestCommitFile {
  readonly filepath: string;
  readonly contents: string;
}

export interface GitTestRepository {
  readonly dir: string;
  readonly gitdir: string;
  readonly initialOid: string;
  commit(files: readonly GitTestCommitFile[], message: string): Promise<string>;
  pack(ref?: string): Promise<{ readonly oid: string; readonly packfile: Buffer }>;
}

export async function createGitTestDirectory(
  t: TestContext,
  options: GitTestRepositoryOptions,
): Promise<string> {
  if (options.boundary !== "local") {
    throw new Error("createGitTestDirectory requires the explicit local boundary");
  }

  const dir = await mkdtemp(join(tmpdir(), "pi-cm-git-contract-empty-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

export async function createGitTestRepository(
  t: TestContext,
  options: GitTestRepositoryOptions,
): Promise<GitTestRepository> {
  if (options.boundary !== "local") {
    throw new Error("createGitTestRepository requires the explicit local boundary");
  }

  const dir = await mkdtemp(join(tmpdir(), "pi-cm-git-contract-"));
  const gitdir = join(dir, ".git");
  let commitIndex = 0;
  t.after(() => rm(dir, { recursive: true, force: true }));

  await git.init({ fs, dir, defaultBranch: "main" });

  async function commit(files: readonly GitTestCommitFile[], message: string): Promise<string> {
    for (const file of files) {
      const absolutePath = join(dir, file.filepath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.contents);
      await git.add({ fs, dir, filepath: file.filepath });
    }

    commitIndex += 1;
    return git.commit({
      fs,
      dir,
      message,
      author: {
        ...author,
        timestamp: 1_700_000_000 + commitIndex,
        timezoneOffset: 0,
      },
    });
  }

  const initialOid = await commit([{ filepath: "README.md", contents: "# local\n" }], "initial");

  async function pack(ref = "HEAD"): Promise<{ readonly oid: string; readonly packfile: Buffer }> {
    const oids = new Set<string>();

    async function collectTree(oid: string): Promise<void> {
      if (oids.has(oid)) {
        return;
      }

      oids.add(oid);
      const { tree } = await git.readTree({ fs, dir, oid });
      for (const entry of tree) {
        if (entry.type === "tree") {
          await collectTree(entry.oid);
        } else {
          oids.add(entry.oid);
        }
      }
    }

    async function collectCommit(oid: string): Promise<void> {
      if (oids.has(oid)) {
        return;
      }

      oids.add(oid);
      const { commit: gitCommit } = await git.readCommit({ fs, dir, oid });
      await collectTree(gitCommit.tree);
      for (const parent of gitCommit.parent) {
        await collectCommit(parent);
      }
    }

    const oid = await git.resolveRef({ fs, dir, ref });
    await collectCommit(oid);
    const { packfile } = await git.packObjects({ fs, dir, oids: [...oids] });
    if (packfile === undefined) {
      throw new Error("isomorphic-git returned no in-memory packfile");
    }

    return { oid, packfile: Buffer.from(packfile) };
  }

  return { dir, gitdir, initialOid, commit, pack };
}
