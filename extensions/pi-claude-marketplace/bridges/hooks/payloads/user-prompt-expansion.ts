// bridges/hooks/payloads/user-prompt-expansion.ts
//
// UserPromptExpansion payload translator (PG-HOOK-06, D-PG6-19, D-PG6-22).

import type { InputEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

/**
 * Synthetic event the expansion handler builds for one typed command. Not a Pi
 * event type: the command's Claude-form name, its arguments, and its source
 * come from the resolver, and `input` is Pi's input event, which the
 * translator does not read.
 */
export interface UserPromptExpansionEvent {
  readonly command_name: string;
  readonly command_args: string;
  readonly command_source?: string;
  readonly input: InputEvent;
}

export interface UserPromptExpansionStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "UserPromptExpansion";
  readonly expansion_type: "slash_command";
  readonly command_name: string;
  readonly command_args: string;
  readonly command_source?: string;
  readonly prompt: string;
}

/**
 * Pi has no slash surface for MCP prompts, so `expansion_type` is always
 * `slash_command` (D-PG6-22). `prompt` is built as Claude Code 2.1.323 builds
 * it: `/<name>`, then one space and the arguments when there are any.
 */
export function translateUserPromptExpansion(
  event: UserPromptExpansionEvent,
  ctx: TranslationContext,
): UserPromptExpansionStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: event.command_name,
    command_args: event.command_args,
    ...(event.command_source === undefined ? {} : { command_source: event.command_source }),
    prompt:
      event.command_args === ""
        ? `/${event.command_name}`
        : `/${event.command_name} ${event.command_args}`,
  };
}
