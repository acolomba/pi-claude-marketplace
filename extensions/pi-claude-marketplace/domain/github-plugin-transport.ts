// domain/github-plugin-transport.ts
//
// D-SG-18, SG-SSH-04: the transport plan of a plugin clone, as Claude Code's
// shell `claude plugin install` orders it (upstream `zHi` and `Qmt`). A GitHub
// source spelled `owner/repo` clones over SSH only, unless every check that
// would keep it there passes: then it clones over HTTPS first and retries
// over SSH once. A forced transport clones once over HTTPS and runs no check
// (D-SG-24, D-SG-21). A git-subdir `owner/repo` shorthand clones once over
// SSH, or over HTTPS when forced, with no check and no retry (D-SG-20,
// upstream `KHi`). Every other source clones once, as written (OQ-1).
//
// SG-SSH-05: on Windows an `owner/repo` source clones over SSH first and runs
// no probe, as upstream's Windows pass of `Qmt` does. Only an SSH failure that
// names the key or the host key, with the Windows checks passing, gives HTTPS,
// and an HTTPS failure then gives SSH once more.
//
// The module is pure: each check is a function the caller passes, called at
// most once per plan, and only when the plan needs its answer. The marketplace
// plan, whose probe reads its answer the other way (Pitfall 8), stays in
// `github-transport.ts`.

import { GitCommandError } from "../shared/errors.ts";

import { networkCloneUrl } from "./clone-key.ts";
import {
  addressTransport,
  gitHubSshCloneUrl,
  isOwnerRepoSpelling,
  noRetry,
  shorthandSource,
  stopsTheClone,
  writtenAddressNote,
} from "./github-transport.ts";
import { isGitHubOwnerRepo } from "./source.ts";

import type { TransportAttempt, TransportForce, TransportPlan } from "./github-transport.ts";
import type { GitBackedSource, GitHubSource } from "./source.ts";

/**
 * D-SG-18: the checks, in Claude Code's order, that decide whether a GitHub
 * plugin clone may try HTTPS first. Each one reads the user's own settings,
 * never Pi's (D-SG-05, D-SG-16).
 */
export interface PluginSshChecks {
  /** `GIT_SSH_COMMAND` or `GIT_SSH` in the user's environment, or `core.sshCommand`. */
  readonly userOverride: () => Promise<boolean>;
  /** Whether the user's git config rewrites the SSH clone URL, or git could not say. */
  readonly urlRewritten: (sshUrl: string) => Promise<boolean>;
  /** Claude Code's ssh probe of GitHub. */
  readonly probe: () => Promise<"configured" | "not-configured" | "unknown">;
  /** Whether an ssh can be found at all. */
  readonly sshPresent: () => Promise<boolean>;
  /** Whether `ssh -G git@github.com` shows a direct hop to github.com, with no proxy. */
  readonly showsDirectGitHub: () => Promise<boolean>;
  /**
   * SG-SSH-05, Windows: whether the ssh git starts for `sshUrl`, run with
   * `-G`, shows a direct hop to github.com, with no proxy.
   */
  readonly showsDirectGitHubThroughGit: (sshUrl: string) => Promise<boolean>;
}

/** The inputs of `planPluginClone`. */
export interface PluginClonePlanInput {
  readonly source: GitBackedSource;
  readonly force?: TransportForce | undefined;
  /**
   * The checks of the command's transport context. Every plan takes them,
   * and only a plan that needs an answer calls one.
   */
  readonly checks: PluginSshChecks;
  /**
   * SG-SSH-05: the platform the clone runs on. `win32` takes the Windows
   * plan; omitted, the plan is the one off Windows.
   */
  readonly platform?: NodeJS.Platform | undefined;
}

// One attempt as written, with no retry, and the note the marketplace plan
// gives the same address (`writtenAddressNote`).
function asWritten(url: string): TransportPlan {
  const transport = addressTransport(url);
  const note = writtenAddressNote(url, transport);
  return {
    first: { transport, url },
    ...(note !== undefined && { note }),
    after: noRetry,
  };
}

// One attempt over `attempt`'s transport, with its note and no retry.
function only(attempt: TransportAttempt): TransportPlan {
  return {
    first: attempt,
    note: attempt.transport === "ssh" ? "via-ssh" : "via-https",
    after: noRetry,
  };
}

// The SSH and HTTPS attempts of a GitHub source.
function gitHubAttempts(source: GitHubSource): {
  readonly ssh: TransportAttempt;
  readonly https: TransportAttempt;
} {
  return {
    ssh: { transport: "ssh", url: gitHubSshCloneUrl(source) },
    https: { transport: "https", url: networkCloneUrl(source) },
  };
}

// Upstream `Qmt`'s first two checks, on every platform: the user chose the
// ssh command, or the user's git config rewrites the ssh URL. The first that
// answers yes stops the walk.
async function userKeepsSsh(checks: PluginSshChecks, sshUrl: string): Promise<boolean> {
  return (await checks.userOverride()) || checks.urlRewritten(sshUrl);
}

/**
 * Upstream `Qmt`, off Windows: whether every check that keeps a GitHub clone
 * on SSH passes, in Claude Code's order: no ssh choice of the user, no
 * rewrite of the ssh URL, a probe that found no configured ssh (Pitfall 8:
 * an unknown answer keeps SSH), and then no ssh at all or an `ssh -G` that
 * shows a direct hop. The first check that decides stops the walk, so no
 * later check runs.
 */
async function httpsMayGoFirst(checks: PluginSshChecks, sshUrl: string): Promise<boolean> {
  if (await userKeepsSsh(checks, sshUrl)) {
    return false;
  }

  if ((await checks.probe()) !== "not-configured") {
    return false;
  }

  return !(await checks.sshPresent()) || checks.showsDirectGitHub();
}

/**
 * Upstream `Qmt`'s Windows pass: whether every check that keeps a GitHub
 * clone on SSH passes, in Claude Code's order: no ssh choice of the user, no
 * rewrite of the ssh URL, and then `-G` through git showing a direct hop. No
 * probe runs on Windows.
 */
async function httpsMayFollowOnWindows(checks: PluginSshChecks, sshUrl: string): Promise<boolean> {
  return !(await userKeepsSsh(checks, sshUrl)) && checks.showsDirectGitHubThroughGit(sshUrl);
}

/**
 * SG-SSH-05, upstream `Jmt`: whether an SSH clone failed because GitHub
 * refused every key or the host key was not the known one. The typed kind
 * and detail decide, never stderr text (SG-PRC-05, T-04-35); a changed host
 * key counts, as upstream's text test counts it.
 */
function isKeyFailure(failure: unknown): boolean {
  if (!(failure instanceof GitCommandError)) {
    return false;
  }

  const { failure: reason } = failure;
  return (
    (reason.kind === "ssh-auth" && reason.detail === "publickey") ||
    reason.kind === "ssh-host-key-unknown" ||
    reason.kind === "ssh-host-key-changed"
  );
}

/**
 * SG-SSH-05, upstream `zHi` on Windows: SSH first. After a key failure, and
 * only when the Windows checks pass, HTTPS once; after that HTTPS attempt
 * fails, SSH once more. Any other failure ends the clone. The checks run
 * only after a key failure.
 */
function windowsPlan(
  attempts: ReturnType<typeof gitHubAttempts>,
  checks: PluginSshChecks,
): TransportPlan {
  const { ssh, https } = attempts;
  let httpsTried = false;
  return {
    first: ssh,
    note: "via-ssh",
    after: async (failure, failed) => {
      if (failed.transport === "https") {
        return stopsTheClone(failure) ? undefined : ssh;
      }

      if (httpsTried || !isKeyFailure(failure)) {
        return undefined;
      }

      if (!(await httpsMayFollowOnWindows(checks, ssh.url))) {
        return undefined;
      }

      httpsTried = true;
      return https;
    },
  };
}

// The plan of a GitHub source spelled `owner/repo`.
async function ownerRepoPlan(
  source: GitHubSource,
  checks: PluginSshChecks,
  platform: NodeJS.Platform | undefined,
): Promise<TransportPlan> {
  const attempts = gitHubAttempts(source);
  const { ssh, https } = attempts;
  if (platform === "win32") {
    return windowsPlan(attempts, checks);
  }

  if (!(await httpsMayGoFirst(checks, ssh.url))) {
    return only(ssh);
  }

  return {
    first: https,
    note: "ssh-not-configured",
    after: (failure, failed) =>
      Promise.resolve(failed.transport === "https" && !stopsTheClone(failure) ? ssh : undefined),
  };
}

/**
 * D-SG-18, D-SG-20, OQ-1: the plan of a plugin clone of `source`.
 *
 * - A url source gives one attempt as written. When the address folds to
 *   GitHub, its note names its scheme: `via-ssh` over ssh, `via-https` for
 *   `https:`, and `via-http` for `http:` (IN-A-02). Any other address has
 *   none.
 * - A git-subdir shorthand gives one SSH attempt of
 *   `git@github.com:<owner>/<repo>.git`, or one HTTPS attempt when forced.
 *   Any other git-subdir url gives one attempt as written.
 * - A GitHub source gives one HTTPS attempt when forced, or when it was
 *   written as a URL. An `owner/repo` source walks the checks: when each one
 *   lets HTTPS go first, the plan clones over HTTPS first with the
 *   `ssh-not-configured` note and retries over SSH once after an HTTPS
 *   failure; otherwise it clones over SSH only. On Windows it clones over SSH
 *   first and gives HTTPS, then SSH, only after a key failure with the
 *   Windows checks passing (SG-SSH-05).
 */
export async function planPluginClone(input: PluginClonePlanInput): Promise<TransportPlan> {
  const { source, force } = input;
  if (source.kind === "url") {
    return asWritten(networkCloneUrl(source));
  }

  if (source.kind === "git-subdir") {
    if (!isGitHubOwnerRepo(source.url)) {
      return asWritten(networkCloneUrl(source));
    }

    const { ssh, https } = gitHubAttempts(shorthandSource(source.url));
    return only(force === undefined ? ssh : https);
  }

  if (force !== undefined || !isOwnerRepoSpelling(source)) {
    return only({ transport: "https", url: networkCloneUrl(source) });
  }

  return ownerRepoPlan(source, input.checks, input.platform);
}
