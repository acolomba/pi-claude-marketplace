// shared/git-failure-classifiers.ts
//
// Closed-set classifier for git transport failures. The clone/mirror
// orchestrator surfaces (`install`, `update`, `fetch`, `info --fetch`) all
// catch materialize/probe throws from the git seam and must map the SAME
// underlying failure onto the SAME closed-set REASON, so the ladder lives
// here once (sibling of `probe-classifiers.ts`, the sanctioned
// cross-orchestrator import surface) instead of drifting per verb.
//
// Duck-typed on the isomorphic-git error shapes (D-13: no isomorphic-git
// import outside the platform tier); the project's own
// `CrossOriginChallengeError` and `StoredCredentialRejectedError` are narrowed
// by `instanceof`. Per-verb fallbacks (fetch's `source missing` fold) stay
// thin wrappers at their call sites.

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
 * UPD-11 / ADD-10: the first cause frame of a fetch the git host answered with an HTTP
 * status, `{status} on {url}`, because a reason token cannot carry either.
 * `remoteUrl` is rebuilt to the URL the fetch sent: the fetch already went
 * out, so the GitHub base override is valid here. Undefined when `error` has no
 * such status.
 */
export function hostHttpFailureFrame(error: unknown, remoteUrl: string): string | undefined {
  const status = hostHttpStatus(error);
  return status === undefined ? undefined : `${status} on ${gitHubWireUrl(remoteUrl)}`;
}

/**
 * isomorphic-git's `NotFoundError`, which a clone throws when the remote does
 * not have the ref or object it asked for.
 */
function isRemoteNotFound(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "NotFoundError";
}

/**
 * Extend the shared transport ladder with the git host's own HTTP answer. A
 * 404 or 410 is `source missing` (ADD-09, INS-06). Any other status outside
 * the 401/403 auth challenge is `network error`, because the host was reached
 * and refused; `network unreachable` stays for the connection errno codes.
 * `install` uses this layer: a local read that finds no ref or object on a
 * clone already on disk stays unclassified there, so it is never reported as
 * a repository the host lacks. A pin that a fresh clone does not hold is
 * `source missing` too (INR-03). The error behind a cleanup leak is the one
 * classified (INR-02).
 */
export function classifyGitHostFailure(
  error: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
  | undefined {
  if (withoutCleanupLeaks(error) instanceof PinnedCommitMissingError) {
    return "source missing";
  }

  const transportReason = classifyGitTransportFailure(error);
  if (transportReason !== undefined) {
    return transportReason;
  }

  const status = hostHttpStatus(error);
  if (status === undefined) {
    return undefined;
  }

  return SOURCE_MISSING_HTTP_STATUSES.has(status) ? "source missing" : "network error";
}

/**
 * Extend the host ladder for a source-access operation such as `marketplace
 * add`, which always clones fresh: a ref or object the remote does not have,
 * like a repository the host does not have, is `source missing` too. The
 * opt-in layer keeps other callers' fallthroughs unchanged: the transport
 * and host ladders that update and the plugin verbs use leave a missing ref
 * unclassified.
 */
export function classifyGitSourceAccessFailure(
  error: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
  | undefined {
  return isRemoteNotFound(withoutCleanupLeaks(error))
    ? "source missing"
    : classifyGitHostFailure(error);
}
