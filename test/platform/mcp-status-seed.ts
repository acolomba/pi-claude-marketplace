/**
 * MCP status tracker seeds for the suites that drive info (ASTAT-01). Each
 * call returns a fresh real tracker.
 */
import { createMcpStatusTracker } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";

import type { McpStatusReader } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type { PiEventSource } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/** A tracker whose event source never publishes. */
export function noStatusSnapshot(): McpStatusReader {
  const events = { on: () => () => undefined } satisfies PiEventSource;
  return createMcpStatusTracker(events);
}

/** A tracker that has received one version 1 snapshot listing `servers`. */
export function statusSnapshot(
  servers: readonly { readonly name: string; readonly status: string }[],
): McpStatusReader {
  const handlers: ((data: unknown) => void)[] = [];
  const events = {
    on: (_channel: string, handler: (data: unknown) => void) => {
      handlers.push(handler);
      return () => undefined;
    },
  } satisfies PiEventSource;
  const tracker = createMcpStatusTracker(events);
  for (const handler of handlers) {
    handler({ version: 1, servers });
  }

  return tracker;
}
