/**
 * MCP status reader seeds for the suites that drive info (ASTAT-01, MSEL-01).
 * Each call returns fresh readers.
 */
import { createMcpStatusTracker } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";

import type {
  McpStatusReader,
  McpStatusReaders,
} from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
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

/**
 * A reader pair whose two readers have no snapshot, so every stamped server
 * reads `status unknown` under every implementation.
 */
export function noStatusReaders(): McpStatusReaders {
  return statusReaders({});
}

/** A reader pair with the given readers; a reader left out has no snapshot. */
export function statusReaders(readers: {
  readonly adapter?: McpStatusReader;
  readonly builtin?: McpStatusReader;
}): McpStatusReaders {
  return {
    adapter: readers.adapter ?? noStatusSnapshot(),
    builtin: readers.builtin ?? noStatusSnapshot(),
  };
}
