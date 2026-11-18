// bridges/agents/mcp-async-warning.ts
//
// D-CF6-10: the warning of an agent that runs plugin MCP tools, which always
// launches in the background (D-PG3-02). The sentence is the same for both MCP
// implementations up to its last clause, which names the implementation that
// must have listed the server's tools before a launch can reach them
// (MGRT-01). The first generation wrongly said Claude Code runs the agent in
// the foreground; it stays recognized because stored rows carry it (D-PG3-03).

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";

const MCP_ASYNC_WARNING_LEAD =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; ";
const CORRECTED_WARNING_LEAD =
  "tools include MCP tools, which require a pi-subagents background child -- " +
  "the agent runs in the background (`async: true`); ";
const ADAPTER_SUFFIX = "a launch before pi-mcp-adapter has cached the server's tools still fails";
const BUILTIN_SUFFIX =
  "a launch before Pi's built-in MCP has listed the server's tools still fails";

const MCP_ASYNC_WARNINGS: Readonly<Record<McpImplementationId, string>> = Object.freeze({
  // Stored rows carry this exact text, and `grant-rewrite.ts` and
  // `legacy-grant-form.ts` recognize them by it, or a file's list item by its
  // double-quoted form, so its bytes stay fixed.
  adapter: `${MCP_ASYNC_WARNING_LEAD}${ADAPTER_SUFFIX}`,
  // pi-subagents resolves a built-in selector against the parent's tools at
  // launch, so a launch before Pi's built-in MCP lists them finds none.
  builtin: `${MCP_ASYNC_WARNING_LEAD}${BUILTIN_SUFFIX}`,
});
const CORRECTED_WARNINGS: Readonly<Record<McpImplementationId, string>> = Object.freeze({
  adapter: `${CORRECTED_WARNING_LEAD}${ADAPTER_SUFFIX}`,
  builtin: `${CORRECTED_WARNING_LEAD}${BUILTIN_SUFFIX}`,
});
const WARNING_GENERATIONS = [MCP_ASYNC_WARNINGS, CORRECTED_WARNINGS];

/** D-CF6-10: the async warning of an agent rendered for one MCP implementation. */
export function mcpAsyncWarning(id: McpImplementationId): string {
  return CORRECTED_WARNINGS[id];
}

/** Whether a stored warning exactly names one known generation for `id`. */
export function isMcpAsyncWarning(warning: string, id: McpImplementationId): boolean {
  return WARNING_GENERATIONS.some((forms) => warning === forms[id]);
}

/** Rewrites a stored MCP warning for the selected implementation. */
export function rewriteMcpAsyncWarning(warning: string, id: McpImplementationId): string {
  for (const forms of WARNING_GENERATIONS) {
    if (warning === forms.adapter || warning === forms.builtin) {
      return forms[id];
    }
  }

  return warning;
}
