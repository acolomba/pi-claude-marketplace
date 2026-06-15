// bridges/hooks/payloads/pre-tool-use.ts
//
// PreToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).
//
// Consumes Pi's `ToolCallEvent` and emits the Claude `PreToolUse` stdin
// envelope. Pi's lowercase `event.toolName` (`bash`, `read`, ...) is
// capitalized to Claude's `tool_name` form (`Bash`, `Read`, ...) via
// the shared `mapPiToClaudeToolName` helper -- the `CustomToolCallEvent`
// arm (`mcp__server__tool` and other plugin-defined names) flows through
// the helper's passthrough fallback unchanged. The Pi tool argument
// payload `event.input` is propagated verbatim into Claude's
// `tool_input` field (claude-hook-config-syntax.md § 3).

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";

import type { ToolCallEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PreToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
}

export function translate(event: ToolCallEvent, ctx: TranslationContext): PreToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreToolUse",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: event.input,
  };
}
