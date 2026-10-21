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
// by `instanceof`. Per-verb fallbacks (fetch's `source missing` fold,
// install's auth-only narrowing) stay thin wrappers at their call sites.

import { CrossOriginChallengeError, StoredCredentialRejectedError } from "./errors.ts";
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
 * fallthrough (e.g. update's `no longer installable`, info's
 * `narrowProbeError` ladder).
 */
export function classifyGitTransportFailure(
  err: unknown,
): "network unreachable" | "authentication required" | undefined {
  if (!(err instanceof Error)) {
    return undefined;
  }

  if (err instanceof CrossOriginChallengeError || err instanceof StoredCredentialRejectedError) {
    return "authentication required";
  }

  const code = (err as NodeJS.ErrnoException).code;
  const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
  if (code === "HttpError" && (statusCode === 401 || statusCode === 403)) {
    return "authentication required";
  }

  if (code === "UserCanceledError" || err.name === "UserCanceledError") {
    return "authentication required";
  }

  return classifyNetworkErrno(code);
}

/**
 * UPD-11 / ADD-10: the HTTP status of an isomorphic-git `HttpError` that the transport
 * ladder leaves unclassified, so the 401/403 auth challenge stays
 * `authentication required`. Returns undefined for any other error.
 */
export function hostHttpStatus(err: unknown): number | undefined {
  if (!(err instanceof Error) || (err as NodeJS.ErrnoException).code !== "HttpError") {
    return undefined;
  }

  const statusCode = (err as { data?: { statusCode?: unknown } }).data?.statusCode;
  if (typeof statusCode !== "number" || classifyGitTransportFailure(err) !== undefined) {
    return undefined;
  }

  return statusCode;
}

/**
 * UPD-11 / ADD-10: the first cause frame of a fetch the git host answered with an HTTP
 * status, `{status} on {url}`, because a reason token cannot carry either.
 * `remoteUrl` is rebuilt to the URL the fetch sent: the fetch already went
 * out, so the GitHub base override is valid here. Undefined when `err` has no
 * such status.
 */
export function hostHttpFailureFrame(err: unknown, remoteUrl: string): string | undefined {
  const status = hostHttpStatus(err);
  return status === undefined ? undefined : `${status} on ${gitHubWireUrl(remoteUrl)}`;
}

/**
 * isomorphic-git's `NotFoundError`, which a clone throws when the remote does
 * not have the ref or object it asked for.
 */
function isRemoteNotFound(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "NotFoundError";
}

/**
 * Extend the shared transport ladder for a source-access operation such as
 * `marketplace add`. A 404 or 410 is `source missing` (ADD-09), and so is a
 * ref or object the remote does not have, like a repository the host does not
 * have. Any other status outside the 401/403 auth challenge is
 * `network error`, because the host was reached and refused;
 * `network unreachable` stays for the connection errno codes. The opt-in
 * layer keeps other callers' fallthroughs unchanged: the transport ladder
 * that update and the plugin verbs use leaves a missing ref unclassified.
 */
export function classifyGitSourceAccessFailure(
  err: unknown,
):
  | "network unreachable"
  | "authentication required"
  | "source missing"
  | "network error"
  | undefined {
  const transportReason = classifyGitTransportFailure(err);
  if (transportReason !== undefined) {
    return transportReason;
  }

  if (isRemoteNotFound(err)) {
    return "source missing";
  }

  const status = hostHttpStatus(err);
  if (status === undefined) {
    return undefined;
  }

  return SOURCE_MISSING_HTTP_STATUSES.has(status) ? "source missing" : "network error";
}
