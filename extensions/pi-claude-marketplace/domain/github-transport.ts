// domain/github-transport.ts
//
// SG-SSH-02, SG-SSH-03: the transport plan of a marketplace clone, as Claude
// Code orders it. Only a GitHub source spelled `owner/repo` asks the ssh
// probe, and only a probe that found the user's ssh authenticated puts SSH
// first; any other answer clones over HTTPS first (OQ-1). A forced transport
// clones once over HTTPS and asks nothing (D-SG-24, D-SG-21). Every other
// source clones once, as written.
//
// The module is pure: the probe is a function the caller passes, called at
// most once, and only when the plan needs its answer.

import { GITHUB_HOST } from "../shared/github-base-url.ts";

import { networkCloneUrl } from "./clone-key.ts";
import { isScpGitAddress } from "./git-url.ts";
import { ensureGitSuffix } from "./source.ts";

import type { CloneNoteKind } from "../shared/notification-types.ts";
import type { GitHubSource, UrlSource } from "./source.ts";

/** The two transports a GitHub clone can use. */
export type GitHubTransport = "ssh" | "https";

/** One clone attempt: the transport and the URL git is given. */
export interface TransportAttempt {
  readonly transport: GitHubTransport;
  readonly url: string;
}

/**
 * What makes every GitHub clone use HTTPS with no probe:
 * `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` (D-SG-24), or the GitHub base override
 * (D-SG-21, OQ-2).
 */
export type TransportForce = "prefer-https" | "base-override";

/**
 * A clone's plan: the first attempt, and the D-SG-22 note that names how it
 * chose that transport. A clone that made no choice has no note.
 */
export interface TransportPlan {
  readonly first: TransportAttempt;
  readonly note?: CloneNoteKind;
}

/** The inputs of `planMarketplaceClone`. */
export interface MarketplaceClonePlanInput {
  readonly source: GitHubSource | UrlSource;
  readonly force?: TransportForce | undefined;
  /** Claude Code's ssh probe of GitHub. Called only for an `owner/repo` source. */
  readonly probe: () => Promise<"configured" | "not-configured" | "unknown">;
}

// An `ssh:`, `git+ssh:`, or `ssh+git:` URL, which git reaches over ssh.
const SSH_URL = /^(?:ssh|git\+ssh|ssh\+git):/i;

/**
 * OQ-1: whether a GitHub source was written as `owner/repo` (with a ref or
 * not), the one spelling Claude Code probes for. A GitHub URL clones as
 * written.
 */
function isOwnerRepoSpelling(source: GitHubSource): boolean {
  return !source.raw.includes("://");
}

/** Claude Code's SSH clone URL of a GitHub source: `git@github.com:<owner>/<repo>.git`. */
function gitHubSshCloneUrl(source: GitHubSource): string {
  return ensureGitSuffix(`git@${GITHUB_HOST}:${source.owner}/${source.repo}`);
}

// The transport git uses for an address it is given as written.
function addressTransport(url: string): GitHubTransport {
  return isScpGitAddress(url) || SSH_URL.test(url) ? "ssh" : "https";
}

/**
 * SG-SSH-02, SG-SSH-03: the plan of a marketplace clone of `source`. A forced
 * transport gives one HTTPS attempt with the `via-https` note. A GitHub URL
 * gives one attempt as written, with the same note. An `owner/repo` source
 * asks the probe: `configured` puts SSH first with the `via-ssh` note, and any
 * other answer puts HTTPS first with the `ssh-not-configured` note. A url
 * source gives one attempt as written and no note.
 */
export async function planMarketplaceClone(
  input: MarketplaceClonePlanInput,
): Promise<TransportPlan> {
  const { source } = input;
  const written = networkCloneUrl(source);
  if (source.kind === "url") {
    return { first: { transport: addressTransport(written), url: written } };
  }

  const https: TransportAttempt = { transport: "https", url: written };
  if (input.force !== undefined || !isOwnerRepoSpelling(source)) {
    return { first: https, note: "via-https" };
  }

  return (await input.probe()) === "configured"
    ? { first: { transport: "ssh", url: gitHubSshCloneUrl(source) }, note: "via-ssh" }
    : { first: https, note: "ssh-not-configured" };
}
