// bridges/hooks/payloads/session-end.ts
//
// SessionEnd payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionShutdownEvent` and emits the Claude `SessionEnd`
// stdin envelope. Pi's `reason` (`"quit" | "reload" | "new" | "resume"
// | "fork"`) is propagated verbatim into Claude's `reason` field; the
// upstream contract documents the field as
// `clear|resume|logout|prompt_input_exit|bypass_permissions_disabled|other`
// but is open-string in practice (claude-hook-config-syntax.md § 3),
// so the Pi-form value is passed through unchanged.

import type { SessionShutdownEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface SessionEndStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionEnd";
  readonly reason: string;
}

export function translate(event: SessionShutdownEvent, ctx: TranslationContext): SessionEndStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionEnd",
    reason: event.reason,
  };
}
