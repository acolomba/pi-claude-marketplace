// bridges/hooks/payloads/stop.ts
//
// Stop payload translator (STOP-02).
//
// Consumes the synthetic Stop event the `agent_before_settle` boundary
// handler builds (the boundary event names no stop reason or reply text, so
// the handler supplies `last_assistant_message` from the cached `agent_end`
// message and `stop_hook_active` from the loop-protection state, D-PG5-01)
// and emits the Claude `Stop` stdin envelope. `background_tasks` / `session_crons` are omitted --
// Pi has no task registry, and the upstream contract admits their absence.

import type { TranslationContext } from "../translation-context.ts";

export interface StopStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "Stop";
  readonly last_assistant_message: string;
  readonly stop_hook_active: boolean;
}

/**
 * Synthetic Stop event the boundary handler passes into the translator slot.
 * Not a Pi event type -- the fields are assembled at the boundary from the
 * cached last-assistant message and the loop-protection state.
 */
export interface StopEvent {
  readonly last_assistant_message: string;
  readonly stop_hook_active: boolean;
}

export function translateStop(event: StopEvent, ctx: TranslationContext): StopStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "Stop",
    last_assistant_message: event.last_assistant_message,
    stop_hook_active: event.stop_hook_active,
  };
}
