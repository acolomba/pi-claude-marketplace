// shared/git-failure-classifiers.ts
//
// Closed-set classifier for git host failures (D-PL7-01). Every clone,
// mirror, and marketplace surface catches materialize/probe throws from the
// git seam and must map the SAME underlying failure onto the SAME closed-set
// REASON, so the ladder lives here once in `classifyGitFailure`, the
// module's one entry point. Each operation passes its own not-found rule
// (D-PL7-02). Three fixed-rule wrappers bind a rule for their callers:
// `classifyGitHostFailure` (the plugin-clone rule: install, import, apply),
// and `classifyGitSourceAccessFailure` and `hostHttpFailureFrame` (the
// `marketplace add` rule) (D-PL7-11).
//
// Every rung narrows a project error by `instanceof`, one rung per producer
// that can still reach the ladder: a `GitCommandError` from the system git
// process by its closed `kind` (SG-PRC-05, D-SG-01), `PinnedCommitMissingError`
// from the pinned fetch, `StoredCredentialRejectedError` from the GAUTH-04
// refusal in `platform/git.ts`, and `HostedManifestHttpError` from the hosted
// catalog download (D-PL5-07). Any other error reaches only the `rule.unknown`
// fallback.

import {
  GitCommandError,
  HostedManifestHttpError,
  PinnedCommitMissingError,
  StoredCredentialRejectedError,
  withoutCleanupLeaks,
  type GitFailure,
  type HostedManifestFetchError,
} from "./errors.ts";
import { gitHubWireUrl } from "./github-base-url.ts";

/**
 * D-PL5-10: the reason of a hosted download that got no usable answer. A
 * `switch` over the closed `failure` set makes a new member a compile error.
 */
export function hostedFetchFailureReason(
  failure: HostedManifestFetchError["failure"],
): "network unreachable" | "unreadable" {
  switch (failure) {
    case "network":
      return "network unreachable";
    case "unreadable":
      return "unreadable";
  }
}

const SOURCE_MISSING_HTTP_STATUSES = new Set([404, 410]);

/**
 * D-PL7-01: classify a git clone, fetch, or materialize throw into the closed
 * reason set. The ladder:
 *
 *   - a `GitCommandError` from the system git process -> the reason of its
 *     kind (`classifyGitCommandFailure`, SG-PRC-05);
 *   - a `PinnedCommitMissingError`, a pin that the fresh clone does not hold
 *     -> `source missing` (INR-03);
 *   - a `StoredCredentialRejectedError`, the host refusing the stored
 *     credential a helper gave -> `authentication required` (GAUTH-04);
 *   - a `HostedManifestHttpError`, the hosted catalog download's non-2xx
 *     answer -> `classifyHostedStatus` (D-PL5-10);
 *   - any other error without an errno code -> `network error` when
 *     `rule.unknown` requests that git-operation fallback. An error with a
 *     filesystem code stays available to the caller's local filesystem
 *     ladder.
 *
 * `frame` is `{status} on {url}` for a classified non-auth HTTP status, set
 * only when `remoteUrl` is passed, because a reason token cannot carry either
 * (UPD-11, ADD-10). `remoteUrl` is rebuilt to the URL the fetch sent: the
 * fetch already went out, so the GitHub base override is valid here. Returns
 * undefined for non-Errors and errors with an unrecognized code, so
 * each caller keeps its own filesystem fallthrough. The error behind a
 * cleanup leak is the one classified (INR-02).
 */
export function classifyGitFailure(
  thrown: unknown,
  rule: {
    readonly notFound: "source missing" | "network error";
    readonly missingRef?: "source missing";
    readonly unknown?: "network error";
  },
  remoteUrl?: string,
):
  | {
      readonly reason:
        | "network unreachable"
        | "authentication required"
        | "source missing"
        | "network error"
        | "git missing";
      readonly frame?: string;
    }
  | undefined {
  const error = withoutCleanupLeaks(thrown);
  if (!(error instanceof Error)) {
    return undefined;
  }

  if (error instanceof GitCommandError) {
    return classifyGitCommandFailure(error.failure, rule, remoteUrl);
  }

  if (error instanceof PinnedCommitMissingError) {
    return { reason: "source missing" };
  }

  if (error instanceof StoredCredentialRejectedError) {
    return { reason: "authentication required" };
  }

  if (error instanceof HostedManifestHttpError) {
    return classifyHostedStatus(error.data.statusCode, rule, remoteUrl);
  }

  const code = (error as NodeJS.ErrnoException).code;
  const filesystemErrno = code !== undefined && /^E[A-Z0-9_]+$/u.test(code);
  return !filesystemErrno && rule.unknown !== undefined ? { reason: rule.unknown } : undefined;
}

type GitFailureRule = Parameters<typeof classifyGitFailure>[1];

type GitFailureClassification = ReturnType<typeof classifyGitFailure>;

/**
 * SG-PRC-05 / D-SG-07: how each `GitCommandError` kind without an HTTP status
 * is classified, either a fixed reason or the answer the operation's rule
 * gives. The `satisfies Record` makes a new kind a compile error, so git
 * missing is never shown as an auth or network failure.
 *
 *   - `git-missing` -> `git missing` (D-SG-07);
 *   - the HTTPS and SSH auth kinds and both host-key kinds ->
 *     `authentication required`; the answer reads the kind, so both
 *     `https-auth` details (D-SG-14, GAUTH-04) and both `ssh-auth` details
 *     give the same reason;
 *   - `timeout` -> `network unreachable`;
 *   - `remote-error` -> `network error`: the host answered and refused;
 *   - `commit-missing` and `pin-mismatch` -> `source missing` (INR-03);
 *   - `remote-ref-missing` -> `rule.missingRef`, and `local-ref-missing` stays
 *     unclassified, so a local read that finds no ref on a clone already on
 *     disk is never reported as a repository the host lacks;
 *   - every other kind -> `rule.unknown`, as for an unclassified error without
 *     an errno code.
 */
const GIT_FAILURE_ANSWERS = {
  "git-missing": "git missing",
  timeout: "network unreachable",
  "git-too-old": "unknown rule",
  aborted: "unknown rule",
  "https-auth": "authentication required",
  "ssh-auth": "authentication required",
  "ssh-host-key-unknown": "authentication required",
  "ssh-host-key-changed": "authentication required",
  "proxy-refused": "unknown rule",
  "remote-ref-missing": "missing-ref rule",
  "local-ref-missing": "unclassified",
  "commit-missing": "source missing",
  "pin-mismatch": "source missing",
  "refused-input": "unknown rule",
  "protocol-refused": "unknown rule",
  "dubious-ownership": "unknown rule",
  "not-a-repository": "unknown rule",
  "remote-error": "network error",
  "no-stderr": "unknown rule",
  failed: "unknown rule",
} as const satisfies Record<
  Exclude<GitFailure["kind"], "network" | "repository-not-found">,
  | NonNullable<GitFailureClassification>["reason"]
  | "missing-ref rule"
  | "unknown rule"
  | "unclassified"
>;

/**
 * SG-PRC-05: the `classifyGitFailure` rung of a `GitCommandError`. A
 * `network` failure takes `rule.notFound` for HTTP 404 or 410, `network
 * error` for another status, and `network unreachable` with no status; a
 * `repository-not-found` failure takes `rule.notFound` (D-PL7-02). Every other
 * kind takes its `GIT_FAILURE_ANSWERS` answer through a `switch` with no
 * default.
 */
function classifyGitCommandFailure(
  failure: GitFailure,
  rule: GitFailureRule,
  remoteUrl: string | undefined,
): GitFailureClassification {
  if (failure.kind === "network") {
    return failure.httpStatus === undefined
      ? { reason: "network unreachable" }
      : statusClassification(
          httpStatusReason(failure.httpStatus, rule),
          failure.httpStatus,
          remoteUrl,
        );
  }

  if (failure.kind === "repository-not-found") {
    return statusClassification(rule.notFound, failure.httpStatus, remoteUrl);
  }

  const answer = GIT_FAILURE_ANSWERS[failure.kind];
  switch (answer) {
    case "missing-ref rule":
      return rule.missingRef === undefined ? undefined : { reason: rule.missingRef };
    case "unknown rule":
      return rule.unknown === undefined ? undefined : { reason: rule.unknown };
    case "unclassified":
      return undefined;
    case "git missing":
    case "authentication required":
    case "network unreachable":
    case "network error":
    case "source missing":
      return { reason: answer };
  }
}

/**
 * D-PL5-10: the classification of a hosted catalog download's HTTP status. A
 * 401 or 403 is `authentication required` with no frame; every other status
 * takes the reason and the frame a git host's status takes.
 */
function classifyHostedStatus(
  status: number,
  rule: GitFailureRule,
  remoteUrl: string | undefined,
): NonNullable<GitFailureClassification> {
  return status === 401 || status === 403
    ? { reason: "authentication required" }
    : statusClassification(httpStatusReason(status, rule), status, remoteUrl);
}

/**
 * UPD-11 / D-PL7-02: an HTTP 404 or 410 takes the rule's answer; any other
 * status is `network error`: the host was reached and refused. What a missing
 * repository means depends on the operation: a fresh clone reports `source
 * missing` (ADD-09, INS-06), and a marketplace refresh reports `network error`
 * (UPD-11).
 */
function httpStatusReason(
  status: number,
  rule: GitFailureRule,
): "source missing" | "network error" {
  return SOURCE_MISSING_HTTP_STATUSES.has(status) ? rule.notFound : "network error";
}

/**
 * UPD-11 / ADD-10: a non-auth reason with the `{status} on {url}` frame, set
 * when the failure carries an HTTP status and the caller passed the remote
 * URL.
 */
function statusClassification(
  reason: "source missing" | "network error",
  status: number | undefined,
  remoteUrl: string | undefined,
): NonNullable<GitFailureClassification> {
  return status === undefined || remoteUrl === undefined
    ? { reason }
    : { reason, frame: `${status} on ${gitHubWireUrl(remoteUrl)}` };
}

/**
 * D-PL7-11: `classifyGitFailure` with the plugin-clone rule, where a 404 or
 * 410 is `source missing` and a remote ref the host lacks stays unclassified.
 * Kept as a named wrapper for the install, import, and apply callers.
 */
export function classifyGitHostFailure(
  error: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
  | "git missing"
  | undefined {
  return classifyGitFailure(error, { notFound: "source missing" })?.reason;
}

/**
 * D-PL7-11: `classifyGitFailure` with the `marketplace add` rule (ADD-09).
 * The add always clones fresh, so a ref or object the remote does not have is
 * `source missing`, like a repository the host does not have.
 */
export function classifyGitSourceAccessFailure(
  error: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
  | "git missing"
  | undefined {
  return classifyGitFailure(error, { notFound: "source missing", missingRef: "source missing" })
    ?.reason;
}

/**
 * D-PL7-11: the `{status} on {url}` frame of `classifyGitFailure`, kept as a
 * named wrapper for `marketplace add`. The rule does not change whether a
 * frame is set. Undefined when `error` has no classified HTTP status.
 */
export function hostHttpFailureFrame(error: unknown, remoteUrl: string): string | undefined {
  return classifyGitFailure(error, { notFound: "source missing" }, remoteUrl)?.frame;
}
