// bridges/hooks/payloads/tool-event-facts.ts
//
// The facts the dispatcher measures about a tool call and adds to the event
// the hooks read, and their stdin members (D-PG6-06, D-PG6-07).

/**
 * The MCP server of a tool, as Claude Code names it: its config key and where
 * it came from. The bridge names only a plugin's server (D-PG6-07).
 */
export interface HookMcpServer {
  readonly name: string;
  readonly source: "plugin";
}

/** The facts of one tool call that Pi's event does not carry. */
export interface HookToolFacts {
  /** The whole milliseconds the call ran, without its PreToolUse hooks (D-PG6-06). */
  readonly hookDurationMs?: number;
  /** The plugin MCP server of the call's tool (D-PG6-07). */
  readonly hookMcpServer?: HookMcpServer;
}

/**
 * Returns `event` itself when `facts` sets nothing, and otherwise a shallow
 * copy with the facts that shares the event's input and content.
 */
export function withToolFacts<T extends object>(event: T, facts: HookToolFacts): T {
  return Object.keys(facts).length === 0 ? event : { ...event, ...facts };
}

/** The stdin members of the facts `event` carries; a fact it lacks adds no member. */
export function toolFactFields(event: HookToolFacts): {
  readonly duration_ms?: number;
  readonly mcp_server?: HookMcpServer;
} {
  return {
    ...(event.hookDurationMs === undefined ? {} : { duration_ms: event.hookDurationMs }),
    ...(event.hookMcpServer === undefined ? {} : { mcp_server: event.hookMcpServer }),
  };
}
