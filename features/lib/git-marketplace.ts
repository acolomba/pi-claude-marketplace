/**
 * @fileoverview A marketplace published in a git repository.
 *
 * A git marketplace holds the same files as the dir fixture, committed in a
 * work tree and published into a bare repository that the git host serves.
 * A later change to the work tree reaches the host as a new pushed commit.
 * The url and github kinds both publish this way.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { runGit } from "./hermetic-git.ts";

/**
 * Commits every file of `workTree` and publishes the commit as the bare
 * repository `bareRepository`, the work tree's `origin`. Every git runs with
 * the HOME `home`.
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
}

/**
 * Commits every change in the published work tree `workTree` and pushes the
 * commit to its bare repository. The commit is new even when no file changed,
 * so every republish reaches the git host. Every git runs with the HOME `home`.
 */
export async function pushGitRepository(workTree: string, home: string): Promise<void> {
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  await runGit(workTree, home, "push", "-q", "origin", "main");
}
