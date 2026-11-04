// orchestrators/plugin/mcp-verdict.ts
//
// D-P3-06 / D-P3-10: a plugin's MCP dependency, computed from its declared or
// recorded server configs. R is the servers at least one MCP implementation
// runs; I is the implementations that run every server in R. No dependency
// exists when R is empty.
//
// P3-DC-24: a record whose servers cannot be read keeps the stored adapter
// reading: its staged servers, which only the adapter was asked to run.
//
// Pure: it does no I/O. It must never import `mcp-verdict-read.ts` or the
// frozen `recorded-servers.ts`, which reach `install-outcome.ts`, so any module
// may import it without closing a cycle.

import { profileFor } from "../../domain/mcp-implementation.ts";

import type { McpImplementationId, RecordedMcpServers } from "../../domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type { McpDependency } from "../../shared/concerns/soft-dep.ts";

// The order of `runEvery`: adapter, then builtin.
const IMPLEMENTATIONS: readonly McpImplementationId[] = ["adapter", "builtin"];

function implementationsRunning(config: unknown): readonly McpImplementationId[] {
  return IMPLEMENTATIONS.filter((id) => profileFor(id).classify(config).kind === "supported");
}

/**
 * D-P3-06: the MCP dependency of a plugin's server configs. A server both
 * implementations block, or a malformed one, is left out of R; `false` when R
 * is empty.
 */
export function mcpDependencyOf(configs: readonly unknown[]): McpDependency | false {
  const runs = configs.map(implementationsRunning).filter((ids) => ids.length > 0);
  return runs.length === 0
    ? false
    : {
        kind: "mcp",
        runEvery: IMPLEMENTATIONS.filter((id) => runs.every((ids) => ids.includes(id))),
      };
}

/**
 * D-P3-10 / P3-DC-24: the MCP dependency of a record from its recorded
 * servers. An unreadable read falls back to the stored adapter reading: the
 * adapter alone when the record staged a server, else no dependency.
 */
export function recordMcpDependency(
  recorded: RecordedMcpServers,
  record: Pick<PluginInstallRecord, "resources">,
): McpDependency | false {
  if (recorded.kind === "unreadable") {
    return record.resources.mcpServers.length === 0
      ? false
      : { kind: "mcp", runEvery: ["adapter"] };
  }

  return mcpDependencyOf(recorded.servers.map((server) => server.config));
}
