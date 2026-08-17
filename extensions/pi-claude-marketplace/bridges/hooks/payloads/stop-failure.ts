// bridges/hooks/payloads/stop-failure.ts
//
// StopFailure payload translator + error-type classifier (SFAIL-02, SFAIL-03).
//
// `translate` consumes the synthetic StopFailure event the settle handler
// builds and emits the Claude `StopFailure` stdin envelope.
// `classifyStopFailure` maps Pi's rendered `errorMessage` into the closed
// 10-value error-type vocabulary (D-88-02: errorMessage-only), with `unknown`
// as the in-vocabulary fallback and a deterministic `length ->
// max_output_tokens` map.

import type { StopFailureErrorType } from "../../../domain/components/hook-events.ts";
import type { StopReason } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface StopFailureStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "StopFailure";
  readonly error: StopFailureErrorType;
  readonly error_details?: string;
  readonly last_assistant_message: string;
}

/**
 * Synthetic StopFailure event the settle handler passes into the translator
 * slot. Not a Pi event type -- assembled at settle time from the classified
 * error type, optional detail text, and the cached last-assistant message
 * (which for a failure ending is Pi's rendered error text).
 */
export interface StopFailureEvent {
  readonly error: StopFailureErrorType;
  readonly error_details?: string;
  readonly last_assistant_message: string;
}

export function translate(event: StopFailureEvent, ctx: TranslationContext): StopFailureStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "StopFailure",
    error: event.error,
    ...(event.error_details !== undefined ? { error_details: event.error_details } : {}),
    last_assistant_message: event.last_assistant_message,
  };
}

/**
 * Ordered, case-insensitive substring table over Pi's rendered `errorMessage`
 * (SFAIL-03, D-88-02). Substrings are grounded in Pi's own retry/limit
 * classifier patterns (pi-ai's `NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN` /
 * `RETRYABLE_PROVIDER_ERROR_PATTERN`, consumed via `isRetryableAssistantError`)
 * and its auth-failure error strings; the target token is
 * always a member of the closed StopFailure vocabulary. Order matters: the
 * first entry whose any-substring matches wins, so the more specific
 * limit/billing forms precede the broad HTTP-status forms. `oauth_org_not_allowed`
 * is intentionally absent -- org-policy errors have no observed Pi substring and
 * fall through to `unknown`.
 */
// A matcher is either a case-insensitive substring (named error forms) or a
// RegExp for HTTP-status codes. Status codes are bounded with `\b` so a bare
// 3-digit run inside a longer number does not alias -- e.g. "retry after 5000ms"
// must NOT match `500`, and "request 4290" must NOT match `429`.
type ClassifierMatcher = string | RegExp;

const CLASSIFIER_TABLE: ReadonlyArray<
  readonly [StopFailureErrorType, readonly ClassifierMatcher[]]
> = [
  [
    "billing_error",
    [
      "billing",
      "quota exceeded",
      "insufficient_quota",
      "usage limit",
      "available balance",
      "out of budget",
    ],
  ],
  ["rate_limit", ["rate limit", /\b429\b/, "too many requests"]],
  ["overloaded", ["overloaded", /\b529\b/]],
  ["authentication_failed", ["authentication failed", /\b401\b/, /\b403\b/]],
  [
    "server_error",
    [
      /\b500\b/,
      /\b502\b/,
      /\b503\b/,
      /\b504\b/,
      "server error",
      "internal error",
      "service unavailable",
    ],
  ],
  ["model_not_found", ["model not found", "model_not_found"]],
  ["invalid_request", ["invalid request", /\b400\b/]],
];

/**
 * The failure endings the classifier accepts: the settle handler routes only
 * `error` / `length` here, and the narrowed parameter makes a non-failure
 * `stopReason` a compile error rather than a spurious failure classification.
 */
export type FailureStopReason = Extract<StopReason, "error" | "length">;

/**
 * Classify a StopFailure ending into the closed 10-value error-type vocabulary
 * (SFAIL-03, D-88-02). Two inputs only -- Pi's rendered `errorMessage` and the
 * run's `stopReason` -- with no `after_provider_response` subscription and no
 * HTTP-status cell (the firming variant was declined). `stopReason "length"`
 * maps deterministically to `max_output_tokens` without consulting
 * `errorMessage`; otherwise the ordered case-insensitive `CLASSIFIER_TABLE`
 * over `errorMessage` maps into the vocab, falling back to the in-vocabulary
 * `unknown`.
 */
export function classifyStopFailure(
  errorMessage: string,
  stopReason: FailureStopReason,
): StopFailureErrorType {
  if (stopReason === "length") {
    return "max_output_tokens";
  }

  const haystack = errorMessage.toLowerCase();
  for (const [type, matchers] of CLASSIFIER_TABLE) {
    if (matchers.some((m) => (typeof m === "string" ? haystack.includes(m) : m.test(haystack)))) {
      return type;
    }
  }

  return "unknown";
}
