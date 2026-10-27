// shared/git-failure-classifiers.ts
//
// Closed-set classifier for git host failures (D-PL7-01). Every clone,
// mirror, and marketplace surface catches materialize/probe throws from the
// git seam and must map the SAME underlying failure onto the SAME closed-set
// REASON, so the ladder lives here once in `classifyGitFailure`. Each
// operation passes its own not-found rule (D-PL7-02). The named fixed-rule
// wrappers serve callers whose modules other work owns (D-PL7-11).
//
// Duck-typed on the isomorphic-git error shapes (D-13: no isomorphic-git
// import outside the platform tier); the project's own
// `CrossOriginChallengeError` and `StoredCredentialRejectedError` are narrowed
// by `instanceof`.

import {
  CrossOriginChallengeError,
  PinnedCommitMissingError,
  StoredCredentialRejectedError,
  withoutCleanupLeaks,
} from "./errors.ts";
import { gitHubWireUrl } from "./github-base-url.ts";

type GitTransportReason = "network unreachable" | "authentication required";

const SOURCE_MISSING_HTTP_STATUSES = new Set([404, 410]);

const NETWORK_ERRNO_CODES = new Set([
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

function classifyNetworkErrno(code: string | undefined): GitTransportReason | undefined {
  return code !== undefined && NETWORK_ERRNO_CODES.has(code) ? "network unreachable" : undefined;
}

/**
 * Classify a git clone/fetch/materialize throw into the EXISTING closed-set
 * `network unreachable` / `authentication required` REASONS -- no new token.
 *
 *   - `CrossOriginChallengeError` -> `authentication required`: a hop reached
 *     after a redirect to another origin asked for credentials (Q-02).
 *   - `StoredCredentialRejectedError` -> `authentication required`: the host
 *     refused the stored credential it was sent (GAUTH-04).
 *   - isomorphic-git `HttpError` (`.code === "HttpError"`) with a 401/403
 *     status -> `authentication required`: a 401/403 that no auth callback
 *     answered, such as a 403, or a 401 with no bundle.
 *   - `UserCanceledError` (both `code` and `name` carry the string) ->
 *     `authentication required`. A stored-credential helper miss, a device
 *     flow that terminates unsuccessfully (denied / expired / poll network
 *     error), or a device-flow credential the host refuses makes
 *     `platform/git-auth-callbacks.ts` return `{ cancel: true }`, which
 *     isomorphic-git throws as `UserCanceledError` -- a real auth failure, NOT
 *     an HttpError 401/403.
 *   - network errno ladder -> `network unreachable`.
 *
 * Returns undefined for any other throw so each caller keeps its own
 * fallthrough (e.g. info's `narrowProbeError` ladder). The error behind a
 * cleanup leak is the one classified (INR-02).
 */
export function classifyGitTransportFailure(
  thrown: unknown,
): "network unreachable" | "authentication required" | undefined {
  const error = withoutCleanupLeaks(thrown);
  if (!(error instanceof Error)) {
    return undefined;
  }

  if (
    error instanceof CrossOriginChallengeError ||
    error instanceof StoredCredentialRejectedError
  ) {
    return "authentication required";
  }

  const code = (error as NodeJS.ErrnoException).code;
  const statusCode = (error as { data?: { statusCode?: number } }).data?.statusCode;
  if (code === "HttpError" && (statusCode === 401 || statusCode === 403)) {
    return "authentication required";
  }

  if (code === "UserCanceledError" || error.name === "UserCanceledError") {
    return "authentication required";
  }

  return classifyNetworkErrno(code);
}

/**
 * UPD-11 / ADD-10: the HTTP status of an isomorphic-git `HttpError` that the transport
 * ladder leaves unclassified, so the 401/403 auth challenge stays
 * `authentication required`. Returns undefined for any other error.
 */
export function hostHttpStatus(thrown: unknown): number | undefined {
  const error = withoutCleanupLeaks(thrown);
  if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "HttpError") {
    return undefined;
  }

  const statusCode = (error as { data?: { statusCode?: unknown } }).data?.statusCode;
  if (typeof statusCode !== "number" || classifyGitTransportFailure(error) !== undefined) {
    return undefined;
  }

  return statusCode;
}

/**
 * isomorphic-git's `NotFoundError`, which a clone throws when the remote does
 * not have the ref or object it asked for.
 */
function isRemoteNotFound(error: Error): boolean {
  return (error as NodeJS.ErrnoException).code === "NotFoundError";
}

/**
 * D-PL7-01: classify a git clone, fetch, or materialize throw into the closed
 * reason set. The ladder:
 *
 *   - a pin that the fresh clone does not hold -> `source missing` (INR-03);
 *   - the transport ladder (`classifyGitTransportFailure`) ->
 *     `authentication required` or `network unreachable`;
 *   - an HTTP 404 or 410 from the git host -> `rule.notFound`, because what a
 *     missing repository means depends on the operation (D-PL7-02): a fresh
 *     clone reports `source missing` (ADD-09, INS-06), and a marketplace
 *     refresh reports `network error` (UPD-11);
 *   - any other HTTP status -> `network error`: the host was reached and
 *     refused;
 *   - a remote `NotFoundError` (a ref or object the remote does not have) ->
 *     `rule.missingRef`. With no `missingRef`, it stays unclassified, so a
 *     local read that finds no ref on a clone already on disk is never
 *     reported as a repository the host lacks.
 *
 * `frame` is `{status} on {url}` for a classified non-auth HTTP status, set
 * only when `remoteUrl` is passed, because a reason token cannot carry either
 * (UPD-11, ADD-10). `remoteUrl` is rebuilt to the URL the fetch sent: the
 * fetch already went out, so the GitHub base override is valid here. Returns
 * undefined for any other throw, so each caller keeps its own fallthrough.
 * The error behind a cleanup leak is the one classified (INR-02).
 */
export function classifyGitFailure(
  thrown: unknown,
  rule: {
    readonly notFound: "source missing" | "network error";
    readonly missingRef?: "source missing";
  },
  remoteUrl?: string,
):
  | {
      readonly reason:
        "network unreachable" | "authentication required" | "source missing" | "network error";
      readonly frame?: string;
    }
  | undefined {
  const error = withoutCleanupLeaks(thrown);
  if (!(error instanceof Error)) {
    return undefined;
  }

  if (error instanceof PinnedCommitMissingError) {
    return { reason: "source missing" };
  }

  const transportReason = classifyGitTransportFailure(error);
  if (transportReason !== undefined) {
    return { reason: transportReason };
  }

  const status = hostHttpStatus(error);
  if (status !== undefined) {
    return {
      reason: SOURCE_MISSING_HTTP_STATUSES.has(status) ? rule.notFound : "network error",
      ...(remoteUrl === undefined ? {} : { frame: `${status} on ${gitHubWireUrl(remoteUrl)}` }),
    };
  }

  return isRemoteNotFound(error) && rule.missingRef !== undefined
    ? { reason: rule.missingRef }
    : undefined;
}

/**
 * D-PL7-11: `classifyGitFailure` with the plugin-clone rule, where a 404 or
 * 410 is `source missing` and a remote `NotFoundError` stays unclassified.
 * Kept as a named wrapper for the install, import, and apply callers.
 */
export function classifyGitHostFailure(
  error: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
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
