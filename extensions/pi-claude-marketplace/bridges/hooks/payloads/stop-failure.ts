// bridges/hooks/payloads/stop-failure.ts
//
// StopFailure payload translator (SFAIL-02).
//
// Consumes the synthetic StopFailure event the settle handler builds and
// emits the Claude `StopFailure` stdin envelope. Thin here: the `error` field
// is populated verbatim from the synthetic event; the errorMessage classifier
// that maps Pi's rendered error text into the closed 10-value vocabulary
// (SFAIL-03) lands in a later plan.

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
