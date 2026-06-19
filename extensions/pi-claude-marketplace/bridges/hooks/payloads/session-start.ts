// bridges/hooks/payloads/session-start.ts
//
// SessionStart payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionStartEvent` and emits the Claude `SessionStart`
// stdin envelope. Pi's `reason` field (`"startup" | "reload" | "new" |
// "resume" | "fork"`) is propagated verbatim into Claude's `source`
// field -- the upstream contract names this field `source`
// (`startup|resume|clear|compact` per claude-hook-config-syntax.md
// § 3); the Pi `reload`/`new`/`fork` arms have no direct Claude
// equivalent and pass through as-is rather than synthesizing a fake
// `clear`/`compact` value (D-60-04 hand-authored expressivity).

import type { SessionStartEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface SessionStartStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionStart";
  readonly source: string;
}

export function translate(event: SessionStartEvent, ctx: TranslationContext): SessionStartStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionStart",
    source: event.reason,
  };
}
