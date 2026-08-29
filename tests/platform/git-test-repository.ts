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

  return { dir, gitdir, initialOid, commit };
}
