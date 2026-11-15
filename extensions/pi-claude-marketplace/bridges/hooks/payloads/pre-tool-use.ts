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
// payload `event.input` is translated into Claude's `tool_input` field;
// a malformed runtime input passes through for required-field diagnostics.
// `tool_use_id` is Pi's `toolCallId` as Pi gives it, the same id the
// result hook of the call reads (D-PG6-04, D-PG6-05). `mcp_server` names the
// plugin MCP server of the tool, and is left out for any other tool (D-PG6-07).

import { homedir } from "node:os";

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";
import { toHookToolInput } from "../tool-input.ts";

import { toolFactFields } from "./tool-event-facts.ts";

import type { ToolCallEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";
import type { HookMcpServer, HookToolFacts } from "./tool-event-facts.ts";

export interface PreToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly tool_use_id: string;
  readonly mcp_server?: HookMcpServer;
  readonly agent_type?: string;
  readonly agent_id?: string;
}

export function translatePreToolUse(
  event: ToolCallEvent & HookToolFacts,
  ctx: TranslationContext,
): PreToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PreToolUse",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: toHookToolInput(event.toolName, event.input, ctx.cwd, homedir()),
    tool_use_id: event.toolCallId,
    ...toolFactFields(event),
    ...(ctx.childIdentity === undefined
      ? {}
      : { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }),
  };
}
