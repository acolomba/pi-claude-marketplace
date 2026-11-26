// domain/github-transport.ts
//
// SG-SSH-02, SG-SSH-03: the transport plan of a marketplace clone, as Claude
// Code orders it. Only a GitHub source spelled `owner/repo` asks the ssh
// probe, and only a probe that found the user's ssh authenticated puts SSH
// first; any other answer clones over HTTPS first (OQ-1). A forced transport
// clones once over HTTPS and asks nothing (D-SG-24, D-SG-21). Every other
// source clones once, as written. A url source whose address names a GitHub
// repository notes the transport of its scheme (D-SG-22, OQ-3): `via-ssh`
// over ssh, `via-https` for `https:`, and `via-http` for `http:` (IN-A-02).
// Claude Code notes no url clone, so this is the recorded decision that every
// GitHub clone names its transport.
//
// The module is pure: the probe is a function the caller passes, called at
// most once, and only when the plan needs its answer.
//
// D-SG-20: a release-tag listing runs no probe. It reads a GitHub
// `owner/repo` source over SSH unless a transport is forced (`tagReadUrl`).
//
// A plan with two attempts gives the other one once after the first fails,
// as Claude Code's marketplace clone retries on any error. Pi gives none
// after git is missing or the command was aborted: no transport can clone
// without git, and an abort stops the command. Nor after print mode refused
// the Device Flow sign-in (MODE-04): that refusal is about the mode, not the
// transport, and print mode shows no failed row, so a retry that failed too
// would hide the refusal's remedy.

import { DeviceFlowUnavailableError, GitCommandError } from "../shared/errors.ts";
import { GITHUB_HOST, gitHubAddressOf } from "../shared/github-base-url.ts";

import { networkCloneUrl } from "./clone-key.ts";
import { isScpGitAddress } from "./git-url.ts";
import { ensureGitSuffix, isGitSubdirShorthand } from "./source.ts";

import type { CloneNoteKind } from "../shared/notification-types.ts";
import type { GitBackedSource, GitHubSource, UrlSource } from "./source.ts";

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
 * A clone's plan: the first attempt, the D-SG-22 note that names how it chose
 * that transport, and the attempt to run after one fails. A clone that made
 * no choice has no note.
 */
export interface TransportPlan {
  readonly first: TransportAttempt;
  readonly note?: CloneNoteKind;
  /**
   * The attempt to run after `failed` threw `failure`, or undefined when the
   * clone stops there. A two-attempt plan gives its other attempt once, and
   * nothing after a `GitCommandError` whose kind is `git-missing` or
   * `aborted`, or after a `DeviceFlowUnavailableError`. A one-attempt plan
   * gives nothing.
   */
  readonly after: (
    failure: unknown,
    failed: TransportAttempt,
  ) => Promise<TransportAttempt | undefined>;
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

// An `https:` URL.
const HTTPS_URL = /^https:/i;

// An `http:` URL.
const HTTP_URL = /^http:/i;

/**
 * OQ-1: whether a GitHub source was written as `owner/repo` (with a ref or
 * not), the one spelling Claude Code probes for. A GitHub URL clones as
 * written. The marketplace and plugin plans share it, so they cannot
 * disagree on which spelling probes.
 */
export function isOwnerRepoSpelling(source: GitHubSource): boolean {
  return !source.raw.includes("://");
}

/** D-SG-20, upstream `KHi`: the GitHub source a git-subdir `owner/repo` shorthand names. */
export function shorthandSource(shorthand: string): GitHubSource {
  const [owner = "", repo = ""] = shorthand.split("/");
  return { kind: "github", raw: shorthand, owner, repo };
}

/** Claude Code's SSH clone URL of a GitHub source: `git@github.com:<owner>/<repo>.git`. */
export function gitHubSshCloneUrl(source: GitHubSource): string {
  return ensureGitSuffix(`git@${GITHUB_HOST}:${source.owner}/${source.repo}`);
}

/**
 * D-SG-20, upstream `zmt`: the address a release-tag listing of `source`
 * reads, with no probe. A GitHub source spelled `owner/repo` lists over SSH
 * (`gitHubSshCloneUrl`), or at its HTTPS wire form when a transport is forced
 * (D-SG-21, D-SG-24). A git-subdir `owner/repo` shorthand lists as the GitHub
 * source it names (upstream `KHi`). A GitHub URL, a url source, and any other
 * git-subdir url list at the wire form `networkCloneUrl` gives.
 */
export function tagReadUrl(source: GitBackedSource, force: TransportForce | undefined): string {
  if (source.kind === "git-subdir" && isGitSubdirShorthand(source.url)) {
    return tagReadUrl(shorthandSource(source.url), force);
  }

  return source.kind === "github" && force === undefined && isOwnerRepoSpelling(source)
    ? gitHubSshCloneUrl(source)
    : networkCloneUrl(source);
}

/** The `after` of a plan with one attempt: no attempt follows a failure. */
export function noRetry(): Promise<undefined> {
  return Promise.resolve(undefined);
}

// Whether `failure` stops the clone with no other attempt: git is missing,
// the command was aborted, or print mode refused the sign-in.
export function stopsTheClone(failure: unknown): boolean {
  if (failure instanceof DeviceFlowUnavailableError) {
    return true;
  }

  return (
    failure instanceof GitCommandError &&
    (failure.kind === "git-missing" || failure.kind === "aborted")
  );
}

// The `after` of a plan whose `first` attempt has `other` behind it.
function retryWith(first: TransportAttempt, other: TransportAttempt): TransportPlan["after"] {
  return (failure, failed) =>
    Promise.resolve(
      failed.transport === first.transport && !stopsTheClone(failure) ? other : undefined,
    );
}

// The transport git uses for an address it is given as written.
export function addressTransport(url: string): GitHubTransport {
  return isScpGitAddress(url) || SSH_URL.test(url) ? "ssh" : "https";
}

/**
 * D-SG-22, OQ-3: the note of a clone of `url`, an address cloned as written,
 * over `transport`. An address that folds to a GitHub repository
 * (`gitHubAddressOf`) is noted by its scheme: `via-ssh` for an scp address or
 * an ssh scheme, `via-https` for `https:`, and `via-http` for `http:`
 * (IN-A-02). Any other scheme, and any other host, has none.
 */
function writtenAddressNote(url: string, transport: GitHubTransport): CloneNoteKind | undefined {
  if (gitHubAddressOf(url) === undefined) {
    return undefined;
  }

  if (transport === "ssh") {
    return "via-ssh";
  }

  if (HTTPS_URL.test(url)) {
    return "via-https";
  }

  return HTTP_URL.test(url) ? "via-http" : undefined;
}

/**
 * SG-SSH-02, SG-SSH-03: the plan of a marketplace clone of `source`. A forced
 * transport gives one HTTPS attempt with the `via-https` note. A GitHub URL
 * gives one attempt as written, with the same note. An `owner/repo` source
 * asks the probe: `configured` puts SSH first with the `via-ssh` note, and any
 * other answer puts HTTPS first with the `ssh-not-configured` note. Either
 * order has the other transport behind its first attempt. A url source gives
 * one attempt as written, with the note `writtenAddressNote` gives it, even
 * while a transport is forced: the address clones as written (D-SG-21).
 */
export async function planMarketplaceClone(
  input: MarketplaceClonePlanInput,
): Promise<TransportPlan> {
  const { source } = input;
  const written = networkCloneUrl(source);
  if (source.kind === "url") {
    const transport = addressTransport(written);
    const note = writtenAddressNote(written, transport);
    return {
      first: { transport, url: written },
      ...(note !== undefined && { note }),
      after: noRetry,
    };
  }

  const https: TransportAttempt = { transport: "https", url: written };
  if (input.force !== undefined || !isOwnerRepoSpelling(source)) {
    return { first: https, note: "via-https", after: noRetry };
  }

  const ssh: TransportAttempt = { transport: "ssh", url: gitHubSshCloneUrl(source) };
  return (await input.probe()) === "configured"
    ? { first: ssh, note: "via-ssh", after: retryWith(ssh, https) }
    : { first: https, note: "ssh-not-configured", after: retryWith(https, ssh) };
}
