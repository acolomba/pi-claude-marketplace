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

/**
 * D-P3-12 / D-P3-13: what a candidate's drops are weighed against: the
 * installed record's effective unsupported kinds under the active
 * implementation, and whether its MCP servers could be read.
 */
export interface RecordDegradeBaseline {
  readonly unsupported: readonly string[];
  readonly readable: boolean;
}

/** The baseline of a record's effective verdict and the servers it was read from. */
export function degradeBaselineOf(
  effective: { readonly unsupported: readonly string[] },
  recorded: Pick<RecordedMcpServers, "kind">,
): RecordDegradeBaseline {
  return { unsupported: effective.unsupported, readable: recorded.kind !== "unreadable" };
}

/**
 * D-P3-12 / D-P3-13 / D-MB-06: the kinds a candidate drops that the installed
 * record does not, both read under the active implementation. `view` is the
 * candidate's view under that implementation and `neutral` its neutral
 * resolution. A record whose servers cannot be read keeps its stored verdict
 * (MREC-02), which does not say which servers the active implementation
 * drops, so an `mcpServers` drop the neutral resolution does not make is not
 * counted: a switch of implementation alone never makes a new degrade.
 */
export function newlyDroppedKinds(
  view: { readonly unsupported: readonly string[] },
  neutral: { readonly unsupported: readonly string[] },
  baseline: RecordDegradeBaseline,
): readonly string[] {
  return view.unsupported.filter(
    (kind) =>
      !baseline.unsupported.includes(kind) &&
      (baseline.readable || kind !== "mcpServers" || neutral.unsupported.includes(kind)),
  );
}
