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

import type { StopReason } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface StopFailureStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "StopFailure";
  readonly error: string;
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
  readonly error: string;
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
 * Classify a StopFailure ending into the closed 10-value error-type vocabulary
 * (SFAIL-03, D-88-02). Two inputs only -- Pi's rendered `errorMessage` and the
 * run's `stopReason` -- with no `after_provider_response` subscription and no
 * HTTP-status cell (the firming variant was declined). `stopReason "length"`
 * maps deterministically to `max_output_tokens` without consulting
 * `errorMessage`; otherwise a small ordered case-insensitive substring table
 * over `errorMessage` maps into the vocab, falling back to the in-vocabulary
 * `unknown`. The substring table lands in a follow-up step.
 */
export function classifyStopFailure(_errorMessage: string, stopReason: StopReason): string {
  if (stopReason === "length") {
    return "max_output_tokens";
  }

  return "unknown";
}
