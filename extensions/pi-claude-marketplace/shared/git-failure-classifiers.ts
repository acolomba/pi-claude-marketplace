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

  if (
    code === "ENETUNREACH" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN"
  ) {
    return "network unreachable";
  }

  return undefined;
}
