// bridges/hooks/payloads/post-tool-use.ts
//
// PostToolUse payload translator (PAYL-01 + TOOL-01 / D-60-04).
//
// Consumes Pi's `ToolResultEvent` and emits the Claude `PostToolUse`
// stdin envelope. The bucket-A split between PostToolUse and
// PostToolUseFailure happens at the dispatch-router level on
// `event.isError` (false here, true at post-tool-use-failure.ts) -- the
// router selects the correct translator before this function runs, so
// the translator itself is shape-only. Pi's lowercase `event.toolName`
// is capitalized to Claude's `tool_name` form via the shared
// `mapPiToClaudeToolName` helper (TOOL-01 reuse); the Pi tool argument
// payload `event.input` flows into `tool_input`, and the tool's result
// content `event.content` flows into Claude's `tool_response` field
// (claude-hook-config-syntax.md § 3).

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";

import type { ToolResultEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PostToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly tool_response: unknown;
}

export function translate(event: ToolResultEvent, ctx: TranslationContext): PostToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostToolUse",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: event.input,
    tool_response: event.content,
  };
}
