// bridges/hooks/payloads/post-tool-use-failure.ts
//
// PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).
//
// Consumes Pi's `ToolResultEvent` filtered to `event.isError === true`
// (the router's bucket-A split between PostToolUse and
// PostToolUseFailure happens upstream of this translator). Pi's
// lowercase `event.toolName` is capitalized via `mapPiToClaudeToolName`
// (TOOL-01 reuse); `event.input` flows into `tool_input` and the
// errored tool's `event.content` flows into Claude's `tool_response`
// field carrying the error payload (claude-hook-config-syntax.md § 3).

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";

import type { ToolResultEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PostToolUseFailureStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostToolUseFailure";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly tool_response: unknown;
}

export function translate(
  event: ToolResultEvent,
  ctx: TranslationContext,
): PostToolUseFailureStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostToolUseFailure",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: event.input,
    tool_response: event.content,
  };
}
