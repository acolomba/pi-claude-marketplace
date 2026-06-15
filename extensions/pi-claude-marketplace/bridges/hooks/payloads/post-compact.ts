// bridges/hooks/payloads/post-compact.ts
//
// PostCompact payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionCompactEvent` and emits the Claude `PostCompact`
// stdin envelope. Like PreCompact, Claude's `trigger` field is
// `"manual" | "auto"` (claude-hook-config-syntax.md § 3); Pi does not
// expose a trigger source on the post-compaction event, so the
// translator emits `"auto"` for symmetry with PreCompact and to match
// every Pi-initiated compaction path observed today.

import type { SessionCompactEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PostCompactStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostCompact";
  readonly trigger: "auto" | "manual";
}

export function translate(_event: SessionCompactEvent, ctx: TranslationContext): PostCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostCompact",
    trigger: "auto",
  };
}
