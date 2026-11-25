import { realpath } from "node:fs/promises";

import {
  createGitProcess,
  NODE_GIT_HOST,
  NODE_GIT_SPAWN,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import {
  checkout,
  clone,
  fetchCommit,
  listRemotes,
  resolveRef,
  resolveRemoteRef,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";

import { createGitTestDirectory } from "./git-test-repository.ts";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  GitProcess,
  GitRequest,
  SystemGitProcess,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { TestContext } from "node:test";

/**
 * A git process over real system git with a scratch HOME, no system or global
 * config, and the case's own neutral directory, so no git variable or config
 * of the shell that runs the suite reaches it (SG-HRN-01). `variables` go over
 * its environment, so a `PATH` there decides which `ssh` its ssh launches and
 * its git's ssh transport find.
 */
export async function hermeticGitProcess(
  t: TestContext,
  variables: NodeJS.ProcessEnv = {},
): Promise<SystemGitProcess> {
  const root = await realpath(await createGitTestDirectory(t, { boundary: "local" }));
  return createGitProcess({
    spawn: NODE_GIT_SPAWN,
    host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(root) },
    env: { ...hermeticGitEnvironment(root), ...variables },
    killGraceMs: 1_000,
  });
}

/** A git process that runs `systemGit` and records each request, and each as one line. */
export function recordingGitProcess(systemGit: GitProcess): {
  readonly gitProcess: GitProcess;
  readonly commands: string[];
  readonly requests: GitRequest[];
} {
  const commands: string[] = [];
  const requests: GitRequest[] = [];
  return {
    commands,
    requests,
    gitProcess: {
      locate: systemGit.locate,
      run: (request) => {
        requests.push(request);
        commands.push(
          [request.subcommand, ...(request.options ?? []), ...(request.operands ?? [])].join(" "),
        );
        return systemGit.run(request);
      },
    },
  };
}

/** The production GitOps, each of its system-git verbs bound to `systemGit`. */
export function systemGitOps(systemGit: GitProcess): GitOps {
  return {
    clone: (options) => clone(options, systemGit),
    fetchCommit: (options) => fetchCommit(options, systemGit),
    checkout: (options) => checkout(options, systemGit),
    resolveRef: (options) => resolveRef(options, systemGit),
    resolveRemoteRef: (options) => resolveRemoteRef(options, systemGit),
    listRemotes: (options) => listRemotes(options, systemGit),
  };
}
