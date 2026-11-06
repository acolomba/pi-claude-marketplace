/**
 * @fileoverview Acceptance adapter for the plugin command's registered completion provider.
 *
 * Registration delegates its callback to `getArgumentCompletions` with a
 * cwd-bound resolver for the active MCP implementation and lifecycle
 * completion cache. The adapter constructs those same dependencies and returns
 * the complete public suggestion set.
 */

import { getArgumentCompletions } from "../../extensions/pi-claude-marketplace/edge/completions/provider.ts";
import { makeLocationsResolver } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { ActiveMcpImplementation } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

/** One suggestion the registered command provider offers. */
export interface PluginCompletion {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

/**
 * Returns every completion the registered command provider offers for
 * `prefix`, classified for `mcpImplementation`, the implementation the
 * scenario's profile runs (D-P6-22).
 */
export async function pluginCompletions(
  prefix: string,
  cwd: string,
  mcpImplementation: ActiveMcpImplementation,
): Promise<readonly PluginCompletion[]> {
  return (
    (await getArgumentCompletions(
      prefix,
      makeLocationsResolver(cwd, mcpImplementation),
      createCompletionCache(),
    )) ?? []
  );
}
