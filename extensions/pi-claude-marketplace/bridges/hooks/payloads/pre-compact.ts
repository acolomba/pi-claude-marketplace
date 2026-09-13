// bridges/hooks/payloads/pre-compact.ts
//
// PreCompact payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionBeforeCompactEvent` and emits the Claude
// `PreCompact` stdin envelope. Claude's contract names the
// event-specific field `trigger` (`"manual" | "auto"` per
// claude-hook-config-syntax.md § 3). Pi reports `manual`, `threshold`, or
// `overflow`; the latter two are Claude automatic compaction triggers.

import type { SessionBeforeCompactEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PreCompactStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreCompact";
  readonly trigger: "auto" | "manual";
}

function compactTrigger(reason: SessionBeforeCompactEvent["reason"]): PreCompactStdin["trigger"] {
  return reason === "manual" ? "manual" : "auto";
}

export function translate(
  event: SessionBeforeCompactEvent,
  ctx: TranslationContext,
): PreCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreCompact",
    trigger: compactTrigger(event.reason),
  };
}
