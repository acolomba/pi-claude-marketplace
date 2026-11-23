/**
 * @fileoverview The system-git runner of the unit and integration suites and
 * the fixture repositories they build with it.
 *
 * Every git here runs through `hermeticGitEnvironment` with a scratch HOME
 * made for that one call, so no fixture git reads the runner's git variables,
 * the developer's git configuration, or a credential store (DRV-03, SG-HRN-01).
 *
 * A fixture commit takes its date from the history: the first commit of a
 * branch is dated 1_700_000_001 and each later one a second after its parent's
 * author date. So two repositories built from the same files and messages get
 * the same commit ids, and no two commits of one history share a timestamp.
 */

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";

import type { HermeticGitVariables } from "../../features/lib/hermetic-git.ts";
import type { TestContext } from "node:test";

const FIRST_COMMIT_SECONDS = 1_700_000_001;

/** One system git: where it runs, its HOME, its named variables, and its stdin. */
export interface SystemGitCall {
  readonly cwd: string;
  readonly home: string;
  readonly variables?: HermeticGitVariables;
  readonly input?: string | Buffer;
}

/** The rejection of a system git that did not exit with code 0. */
export class SystemGitError extends Error {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;

  constructor(
    args: readonly string[],
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    stderr: string,
  ) {
    const outcome = signal === null ? `exit code ${String(exitCode)}` : `signal ${signal}`;
    super(`git ${args.join(" ")} failed with ${outcome}: ${stderr.trim()}`);
    this.name = "SystemGitError";
    this.exitCode = exitCode;
    this.signal = signal;
    this.stderr = stderr;
  }
}

function spawnSystemGit(call: SystemGitCall, args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      ["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
      { cwd: call.cwd, env: hermeticGitEnvironment(call.home, call.variables) },
    );
    const stdout: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    // A git that exits before it reads its input breaks the pipe; its exit
    // status reports that failure, so the pipe error itself is dropped.
    child.stdin.on("error", () => undefined);
    child.on("error", reject);
    child.on("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (exitCode === 0) {
        resolve(Buffer.concat(stdout));
      } else {
        reject(new SystemGitError(args, exitCode, signal, stderr));
      }
    });
    child.stdin.end(call.input);
  });
}

/** Runs system git with `args` for `call` and returns its trimmed standard output. */
export async function runSystemGit(call: SystemGitCall, ...args: string[]): Promise<string> {
  const stdout = await spawnSystemGit(call, args);
  return stdout.toString("utf8").trim();
}

/** Runs system git with `args` for `call` and returns its standard output bytes. */
export function systemGitBytes(call: SystemGitCall, ...args: string[]): Promise<Buffer> {
  return spawnSystemGit(call, args);
}

async function withScratchHome<T>(work: (home: string) => Promise<T>): Promise<T> {
  const home = await mkdtemp(join(tmpdir(), "pi-cm-git-home-"));
  try {
    return await work(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

function fixedDates(seconds: number): HermeticGitVariables {
  const date = `${seconds} +0000`;
  return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
}

async function scratchGit(
  dir: string,
  variables: HermeticGitVariables,
  ...args: string[]
): Promise<string> {
  return withScratchHome((home) => runSystemGit({ cwd: dir, home, variables }, ...args));
}

async function hasHead(dir: string): Promise<boolean> {
  try {
    await scratchGit(dir, {}, "rev-parse", "-q", "--verify", "HEAD");
    return true;
  } catch (error: unknown) {
    // `rev-parse -q --verify` exits 1 with no output when the branch is unborn.
    if (error instanceof SystemGitError && error.exitCode === 1) {
      return false;
    }

    throw error;
  }
}

async function nextCommitSeconds(dir: string): Promise<number> {
  if (!(await hasHead(dir))) {
    return FIRST_COMMIT_SECONDS;
  }

  const parentSeconds = Number(await scratchGit(dir, {}, "log", "-1", "--format=%at"));
  return parentSeconds + 1;
}

async function commitStaged(dir: string, message: string): Promise<string> {
  const variables = fixedDates(await nextCommitSeconds(dir));
  await scratchGit(dir, variables, "commit", "-q", "--allow-empty", "-m", message);
  return scratchGit(dir, {}, "rev-parse", "HEAD");
}

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
  t.after(() => rm(dir, { recursive: true, force: true }));

  await scratchGit(dir, {}, "init", "-q");

  async function commit(files: readonly GitTestCommitFile[], message: string): Promise<string> {
    for (const file of files) {
      const absolutePath = join(dir, file.filepath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.contents);
    }

    if (files.length > 0) {
      await scratchGit(dir, {}, "add", "--", ...files.map((file) => file.filepath));
    }

    return commitStaged(dir, message);
  }

  const initialOid = await commit([{ filepath: "README.md", contents: "# local\n" }], "initial");

  async function pack(ref = "HEAD"): Promise<{ readonly oid: string; readonly packfile: Buffer }> {
    const oid = await scratchGit(dir, {}, "rev-parse", `${ref}^{commit}`);
    const packfile = await withScratchHome((home) =>
      systemGitBytes({ cwd: dir, home, input: `${oid}\n` }, "pack-objects", "--stdout", "--revs"),
    );
    return { oid, packfile };
  }

  return { dir, gitdir, initialOid, commit, pack };
}
