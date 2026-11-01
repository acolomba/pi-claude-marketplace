// bridges/hooks/payloads/session-end.ts
//
// SessionEnd payload translator (PAYL-01) and the bridge's one SessionEnd
// mapping site (D-CF5-02, D-CF1-10).
//
// The router maps Pi's `SessionShutdownEvent.reason` to Claude Code's
// `reason` once, with `claudeSessionEndReason`, and dispatches the
// Claude-side event it builds; dispatch filters on it and this translator
// writes it to stdin. Pi `new` is `clear`; `resume` is `resume`; `fork` is
// `resume`, as upstream `/branch`; `quit` is `prompt_input_exit` in the
// terminal and `other` in print, json, and rpc mode. Pi `reload` runs no
// SessionEnd (D-CF5-03), so it is not an input here.
//
// Pi gap: Pi's `quit` does not say whether a signal caused it, so a terminal
// quit by signal also sends `prompt_input_exit`, where upstream sends
// `other`.

import type { SessionEndReason } from "../../../domain/components/hook-events.ts";
import type { ExtensionMode, SessionShutdownEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

/** The SessionEnd event in Claude Code's terms, which dispatch filters on. */
export interface ClaudeSessionEndEvent {
  readonly reason: SessionEndReason;
}

export interface SessionEndStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionEnd";
  readonly reason: SessionEndReason;
}

// A quit ends the session at the user's prompt only in the terminal.
function quitReason(mode: ExtensionMode): SessionEndReason {
  switch (mode) {
    case "tui":
      return "prompt_input_exit";
    case "print":
    case "json":
    case "rpc":
      return "other";
  }
}

/** Maps a Pi session shutdown reason other than `reload` to Claude's `reason` (D-CF5-02). */
export function claudeSessionEndReason(
  reason: Exclude<SessionShutdownEvent["reason"], "reload">,
  mode: ExtensionMode,
): SessionEndReason {
  switch (reason) {
    case "new":
      return "clear";
    case "resume":
    case "fork":
      return "resume";
    case "quit":
      return quitReason(mode);
  }
}

export function translateSessionEnd(
  event: ClaudeSessionEndEvent,
  ctx: TranslationContext,
): SessionEndStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionEnd",
    reason: event.reason,
  };
}
