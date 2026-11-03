// bridges/hooks/payloads/post-tool-use-failure.ts
//
// PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).
//
// Consumes Pi's `ToolResultEvent` filtered to `event.isError === true`
// (the router's bucket-A split between PostToolUse and
// PostToolUseFailure happens upstream of this translator). Pi's
// lowercase `event.toolName` is capitalized via `mapPiToClaudeToolName`
// (TOOL-01 reuse); `event.input` flows into `tool_input`. Claude Code
// sends a failed tool's error as the string `error` and sends no
// `tool_response`, so the text parts of the errored tool's
// `event.content`, joined with newlines, become `error`; an image part
// has no text and is left out. `tool_use_id`, `is_interrupt`, and
// `duration_ms` are not sent (D-CF5-28).

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
  readonly error: string;
}

// The text parts of a failed tool's content, one per line.
function errorText(content: ToolResultEvent["content"]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }

  return parts.join("\n");
}

export function translatePostToolUseFailure(
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
    error: errorText(event.content),
  };
}
