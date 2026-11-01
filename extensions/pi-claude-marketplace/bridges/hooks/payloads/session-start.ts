// bridges/hooks/payloads/session-start.ts
//
// SessionStart payload translator (PAYL-01) and the bridge's one SessionStart
// mapping site (D-CF5-01, D-CF1-10..12).
//
// The router maps Pi's `SessionStartEvent.reason` to Claude Code's `source`
// once, with `claudeSessionStartSource`, and dispatches the Claude-side event
// it builds. Dispatch compares each matcher with that `source` and this
// translator writes it to stdin, so a hook receives the value its matcher
// was compared with. Pi `new` is `clear`, as upstream `/clear`; `startup`,
// `resume`, and `fork` keep their name. Pi `reload` runs no SessionStart
// (D-CF5-03), so it is not an input here. The compaction handler sends
// `compact` itself (D-CF5-04).

import type { SessionStartSource } from "../../../domain/components/hook-events.ts";
import type { SessionStartEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

/** The SessionStart event in Claude Code's terms, which dispatch filters on. */
export interface ClaudeSessionStartEvent {
  readonly source: SessionStartSource;
}

export interface SessionStartStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionStart";
  readonly source: SessionStartSource;
}

/** Maps a Pi session start reason other than `reload` to Claude's `source` (D-CF5-01). */
export function claudeSessionStartSource(
  reason: Exclude<SessionStartEvent["reason"], "reload">,
): SessionStartSource {
  switch (reason) {
    case "startup":
      return "startup";
    case "new":
      return "clear";
    case "resume":
      return "resume";
    case "fork":
      return "fork";
  }
}

export function translateSessionStart(
  event: ClaudeSessionStartEvent,
  ctx: TranslationContext,
): SessionStartStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionStart",
    source: event.source,
  };
}
