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
// input is translated into `tool_input`, and the tool's result
// MCP content and structured content flow into Claude's `tool_response` field
// (claude-hook-config-syntax.md § 3).
// `tool_use_id` is Pi's `toolCallId`, the id the call's PreToolUse hook
// read (D-PG6-04, D-PG6-05). `duration_ms` is the time the tool ran, which
// the dispatcher measured, and is left out when it has none (D-PG6-06).
// `mcp_server` names the plugin MCP server of the tool, and is left out for
// any other tool (D-PG6-07).

import { homedir } from "node:os";

import { mapPiToClaudeToolName } from "../../../domain/components/hook-tool-names.ts";
import { toHookToolInput } from "../tool-input.ts";
import { fileToolResponse } from "../tool-result-files.ts";
import { searchShellToolResponse } from "../tool-result-search-shell.ts";

import { toolFactFields } from "./tool-event-facts.ts";

import type { ToolResultEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";
import type { HookMcpServer, HookToolFacts } from "./tool-event-facts.ts";

export interface PostToolUseStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostToolUse";
  readonly tool_name: string;
  readonly tool_input: unknown;
  readonly tool_use_id: string;
  readonly tool_response: unknown;
  readonly duration_ms?: number;
  readonly mcp_server?: HookMcpServer;
  readonly agent_type?: string;
  readonly agent_id?: string;
}

function nativeToolResponse(event: ToolResultEvent): unknown {
  if (typeof event.toolName === "string" && event.toolName.startsWith("mcp__")) {
    return {
      content: event.content,
      ...(event.structuredContent === undefined
        ? {}
        : { structuredContent: event.structuredContent }),
    };
  }

  return event.structuredContent === undefined ? event.content : event.structuredContent;
}

export function translatePostToolUse(
  event: ToolResultEvent & HookToolFacts,
  ctx: TranslationContext,
): PostToolUseStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostToolUse",
    tool_name: mapPiToClaudeToolName(event.toolName),
    tool_input: toHookToolInput(event.toolName, event.input, ctx.cwd, homedir()),
    tool_use_id: event.toolCallId,
    tool_response:
      fileToolResponse(event, ctx.cwd) ??
      searchShellToolResponse(event, ctx.cwd) ??
      nativeToolResponse(event),
    ...toolFactFields(event),
    ...(ctx.childIdentity?.sessionId === ctx.sessionId
      ? { agent_type: ctx.childIdentity.agentType, agent_id: ctx.childIdentity.sessionId }
      : {}),
  };
}
