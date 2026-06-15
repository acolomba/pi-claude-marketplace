// bridges/hooks/payloads/pre-compact.ts
//
// PreCompact payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionBeforeCompactEvent` and emits the Claude
// `PreCompact` stdin envelope. Claude's contract names the
// event-specific field `trigger` (`"manual" | "auto"` per
// claude-hook-config-syntax.md § 3); Pi's `SessionBeforeCompactEvent`
// does not expose a trigger source, so the translator emits `"auto"` --
// the documented Claude default for context-pressure-driven compaction,
// which matches every Pi-initiated compaction path the bridge currently
// observes (a manual `/compact` shell-out is not yet wired through this
// seam; if it lands as a v1.14+ extension the value flips to `"manual"`
// at a future amendment, requirements-tracked).

import type { SessionBeforeCompactEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PreCompactStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreCompact";
  readonly trigger: "auto" | "manual";
}

export function translate(
  _event: SessionBeforeCompactEvent,
  ctx: TranslationContext,
): PreCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreCompact",
    trigger: "auto",
  };
}
