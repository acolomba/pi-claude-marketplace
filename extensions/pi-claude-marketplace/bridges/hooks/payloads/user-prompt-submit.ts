// bridges/hooks/payloads/user-prompt-submit.ts
//
// UserPromptSubmit payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `InputEvent` and emits the Claude `UserPromptSubmit`
// stdin envelope. Pi's `event.text` (the raw input text from the user)
// is propagated verbatim into Claude's `prompt` field per
// claude-hook-config-syntax.md § 3.

import type { InputEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface UserPromptSubmitStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "UserPromptSubmit";
  readonly prompt: string;
}

export function translate(event: InputEvent, ctx: TranslationContext): UserPromptSubmitStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "UserPromptSubmit",
    prompt: event.text,
  };
}
