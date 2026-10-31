/**
 * @fileoverview A marketplace published in a git repository.
 *
 * A git marketplace holds the same files as the dir fixture, committed in a
 * work tree and published into a bare repository that the git host serves.
 * A later change to the work tree reaches the host as a new pushed commit.
 * The url and github kinds both publish this way. Every published repository
 * also carries a `stable` branch at the commit of `main`, so a scenario can add
 * a git marketplace at a ref that is not its default branch (HOST-01).
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { runGit } from "./hermetic-git.ts";

/**
 * Commits every file of `workTree` and publishes the commit as the bare
 * repository `bareRepository`, the work tree's `origin`, on the branches
 * `main` and `stable`. Every git runs with the HOME `home`.
 */
export async function publishGitRepository(
  workTree: string,
  bareRepository: string,
  home: string,
): Promise<void> {
  await runGit(workTree, home, "init", "-q");
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  const parent = path.dirname(bareRepository);
  await mkdir(parent, { recursive: true });
  await runGit(parent, home, "clone", "-q", "--bare", workTree, bareRepository);
  await runGit(workTree, home, "remote", "add", "origin", bareRepository);
  await runGit(workTree, home, "push", "-q", "origin", "main:stable");
}

/**
 * Commits every change in the published work tree `workTree` and pushes the
 * commit to its bare repository as both `main` and `stable`. The commit is new
 * even when no file changed, so every republish reaches the git host. The push
 * is a fast-forward, so a `stable` branch that moved away from `main` makes it
 * fail. It is atomic, so a failed push leaves both branches as they were. Every
 * git runs with the HOME `home`.
 */
export async function pushGitRepository(workTree: string, home: string): Promise<void> {
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  await runGit(workTree, home, "push", "-q", "--atomic", "origin", "main", "main:stable");
}

/**
 * Commits the change `write` makes to the published work tree `workTree` on
 * the branch `branch`, started from the commit of `main`, pushes that branch
 * alone, and returns the work tree to `main`. The push is a fast-forward, so it
 * fails when `branch` holds a commit that `main` lacks. Every git runs with the
 * HOME `home`.
 */
export async function pushGitBranch(
  workTree: string,
  home: string,
  branch: string,
  write: () => Promise<void>,
): Promise<void> {
  await runGit(workTree, home, "checkout", "-q", "-B", branch, "main");
  await write();
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  await runGit(workTree, home, "push", "-q", "origin", branch);
  await runGit(workTree, home, "checkout", "-q", "main");
}
