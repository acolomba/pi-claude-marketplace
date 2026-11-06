// bridges/agents/mcp-async-warning.ts
//
// D-CF6-10: the warning of an agent that runs plugin MCP tools, which
// launches in the background where Claude Code runs it in the foreground.
// Both MCP implementations have the same foreground gap, so the sentence is
// the same up to its last clause, which names the implementation that must
// have listed the server's tools before a launch can reach them (MGRT-01).

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";

const MCP_ASYNC_WARNING_LEAD =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; ";

const MCP_ASYNC_WARNINGS: Readonly<Record<McpImplementationId, string>> = Object.freeze({
  // Stored rows carry this exact text, and `grant-rewrite.ts` and
  // `legacy-grant-form.ts` recognize them by it, so its bytes stay fixed.
  adapter: `${MCP_ASYNC_WARNING_LEAD}a launch before pi-mcp-adapter has cached the server's tools still fails`,
  // pi-subagents resolves a built-in selector against the parent's tools at
  // launch, so a launch before Pi's built-in MCP lists them finds none.
  builtin: `${MCP_ASYNC_WARNING_LEAD}a launch before Pi's built-in MCP has listed the server's tools still fails`,
});

/** D-CF6-10: the async warning of an agent rendered for one MCP implementation. */
export function mcpAsyncWarning(id: McpImplementationId): string {
  return MCP_ASYNC_WARNINGS[id];
}
