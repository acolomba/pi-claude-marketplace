// bridges/hooks/payloads/post-tool-use-failure.ts
//
// PostToolUseFailure payload translator (PAYL-01 + TOOL-01 / D-60-04).
//
// Consumes Pi's `ToolResultEvent` filtered to `event.isError === true`
// (the router's bucket-A split between PostToolUse and
// PostToolUseFailure happens upstream of this translator). Pi's
// lowercase `event.toolName` is capitalized via `mapPiToClaudeToolName`
// (TOOL-01 reuse); the shared input codec builds `tool_input`. Claude Code
// sends a failed tool's error as the string `error` and sends no
// `tool_response`, so the text parts of the errored tool's
// `event.content`, joined with newlines, become `error`; an image part
// has no text and is left out. `is_interrupt` is always `false`: the
// bridge runs no PostToolUseFailure hook on a call the user cancels, so
// every run is a failure the tool reported (D-BG-401, D-BG-402).
// `tool_use_id` is the call's own id, as on PreToolUse and PostToolUse.
// `duration_ms` is the time the failed tool ran, which the dispatcher
// measured, and is left out when it has none (D-PG6-04, D-PG6-06).
// `mcp_server` names the plugin MCP server of the tool, and is left out for
// any other tool (D-PG6-07).

import { homedir } from "node:os";

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";
import { toHookToolInput } from "../tool-input.ts";

import { toolFactFields } from "./tool-event-facts.ts";

import type { ClaudeEffort } from "../../../domain/argument-substitution.ts";
import type { ToolResultEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";
import type { HookMcpServer, HookToolFacts } from "./tool-event-facts.ts";

export interface PostToolUseFailureStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostToolUseFailure";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly tool_use_id: string;
  readonly error: string;
  readonly is_interrupt: false;
  readonly duration_ms?: number;
  readonly mcp_server?: HookMcpServer;
  readonly agent_type?: string;
  readonly agent_id?: string;
  readonly effort?: { readonly level: ClaudeEffort };
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
  event: ToolResultEvent & HookToolFacts,
  ctx: TranslationContext,
): PostToolUseFailureStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostToolUseFailure",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: toHookToolInput(event.toolName, event.input, ctx.cwd, homedir()),
    tool_use_id: event.toolCallId,
    error: errorText(event.content),
    is_interrupt: false,
    ...toolFactFields(event),
    ...(ctx.childIdentity === undefined
      ? {}
      : { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }),
    ...(ctx.effort === undefined ? {} : { effort: ctx.effort }),
  };
}
