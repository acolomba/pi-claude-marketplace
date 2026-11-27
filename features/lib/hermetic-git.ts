/**
 * @fileoverview The environment of every git the suites run besides Pi's.
 *
 * The git host's CGI, the cucumber fixture commands, and the unit and
 * integration fixture code all run git with a scratch HOME, no system config,
 * and an empty global config, and inherit nothing else. So the credential
 * files a scenario writes for Pi never change how the server or a fixture
 * behaves, and a git variable of the shell that runs the suites never points a
 * fixture at this repository (DRV-03, SG-HRN-01).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * The only variables a suite git gets beyond the base keys. A call names each
 * one it needs, so the key set of every suite git stays visible here (DRV-03,
 * SG-HRN-01).
 */
export interface HermeticGitVariables {
  readonly GIT_AUTHOR_DATE?: string;
  readonly GIT_COMMITTER_DATE?: string;
  readonly GIT_SSL_CAINFO?: string;
  readonly GIT_PROTOCOL?: string;
  readonly PATH?: string;
  /** The harness CONNECT proxy a git reaches `github.com` through, never the shell's (D-BG-01). */
  readonly https_proxy?: string;
}

/**
 * Returns the environment of a suite git whose HOME is `home`, with the named
 * `variables` added. A named `PATH` replaces the base one.
 */
export function hermeticGitEnvironment(
  home: string,
  variables: HermeticGitVariables = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
    ...variables,
  };
}

/**
 * Runs git with `args` in `cwd` and the environment of `home`, and returns its
 * trimmed standard output. It never blocks, because the worker that runs it
 * may also serve the git host.
 */
export async function runGit(cwd: string, home: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd, env: hermeticGitEnvironment(home) },
  );
  return stdout.trim();
}
