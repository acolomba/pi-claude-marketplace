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
// import outside the platform tier); per-verb fallbacks (fetch's
// `source missing` fold, install's auth-only narrowing) stay thin wrappers at
// their call sites.

type GitTransportReason = "network unreachable" | "authentication required";
type GitSourceAccessReason = GitTransportReason | "source missing";

const SOURCE_ACCESS_HTTP_STATUS_REASONS = new Map<number, GitSourceAccessReason>([
  [404, "source missing"],
  [408, "network unreachable"],
  [410, "source missing"],
  [429, "network unreachable"],
]);

const NETWORK_ERRNO_CODES = new Set([
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

function classifySourceAccessHttpStatus(
  statusCode: number | undefined,
): GitSourceAccessReason | undefined {
  if (statusCode === undefined) {
    return undefined;
  }

  return SOURCE_ACCESS_HTTP_STATUS_REASONS.get(statusCode) ?? classifyServerHttpStatus(statusCode);
}

function classifyServerHttpStatus(statusCode: number): GitSourceAccessReason | undefined {
  return statusCode >= 500 && statusCode < 600 ? "network unreachable" : undefined;
}

function classifyNetworkErrno(code: string | undefined): GitTransportReason | undefined {
  return code !== undefined && NETWORK_ERRNO_CODES.has(code) ? "network unreachable" : undefined;
}

/**
 * Classify a git clone/fetch/materialize throw into the EXISTING closed-set
 * `network unreachable` / `authentication required` REASONS -- no new token.
 *
 *   - isomorphic-git `HttpError` (`.code === "HttpError"`) with a 401/403
 *     status -> `authentication required` (a private clone challenge, or a
 *     still-401 after a fresh credential).
 *   - `UserCanceledError` (both `code` and `name` carry the string) ->
 *     `authentication required`. A device flow that terminates unsuccessfully
 *     (denied / expired / poll network error) makes platform/git.ts's onAuth
 *     return `{ cancel: true }`, which isomorphic-git throws as
 *     `UserCanceledError` -- a real auth failure, NOT an HttpError 401/403.
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
 * Extend the shared transport ladder for a source-access operation. This
 * opt-in layer keeps caller-specific fallthroughs unchanged while classifying
 * repository absence and transient HTTP failures for commands such as
 * `marketplace add`.
 */
export function classifyGitSourceAccessFailure(
  err: unknown,
): "network unreachable" | "authentication required" | "source missing" | undefined {
  const transportReason = classifyGitTransportFailure(err);
  if (transportReason !== undefined) {
    return transportReason;
  }

  if (!(err instanceof Error)) {
    return undefined;
  }

  const code = (err as NodeJS.ErrnoException).code;
  if (code === "HttpError") {
    const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
    return classifySourceAccessHttpStatus(statusCode);
  }

  return undefined;
}
