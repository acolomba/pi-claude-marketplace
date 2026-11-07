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
// Pure: it does no I/O. It must never import `mcp-verdict-read.ts` or
// `recorded-servers.ts`, which reach `install-outcome.ts`, so any module
// may import it without closing a cycle.

import { profileFor } from "../../domain/mcp-implementation.ts";

import type {
  ActiveMcpImplementation,
  McpImplementationId,
  RecordedMcpServers,
} from "../../domain/mcp-implementation.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { McpDependency, RunEvery } from "../../shared/concerns/soft-dep.ts";

// The order in which the implementation profiles are asked about a server.
const IMPLEMENTATIONS: readonly McpImplementationId[] = ["adapter", "builtin"];

function implementationsRunning(config: unknown): readonly McpImplementationId[] {
  return IMPLEMENTATIONS.filter((id) => profileFor(id).classify(config).kind === "supported");
}

/**
 * D-P3-10 / D-MB-07: the `runEvery` state of R, from the implementations that
 * run each server in R.
 */
function runEveryOf(runs: readonly (readonly McpImplementationId[])[]): RunEvery {
  const adapterRunsAll = runs.every((ids) => ids.includes("adapter"));
  const builtinRunsAll = runs.every((ids) => ids.includes("builtin"));
  if (adapterRunsAll && builtinRunsAll) {
    return "both";
  }

  if (adapterRunsAll) {
    return "adapter";
  }

  return builtinRunsAll ? "builtin" : "split";
}

/**
 * D-P3-06: the MCP dependency of a plugin's server configs. A server both
 * implementations block, or a malformed one, is left out of R; `false` when R
 * is empty.
 */
export function mcpDependencyOf(configs: readonly unknown[]): McpDependency | false {
  const runs = configs.map(implementationsRunning).filter((ids) => ids.length > 0);
  return runs.length === 0 ? false : { kind: "mcp", runEvery: runEveryOf(runs) };
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
    return record.resources.mcpServers.length === 0 ? false : { kind: "mcp", runEvery: "adapter" };
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

/**
 * D-P3-13: reads the degrade baseline of `plugin`'s record in `marketplace`
 * under one implementation, offline. The update preflight takes it as a port,
 * because it cannot import the record read without closing an import cycle.
 */
export type RecordDegradeBaselineReader = (
  record: PluginInstallRecord,
  marketplace: ExtensionState["marketplaces"][string],
  plugin: string,
) => Promise<RecordDegradeBaseline>;

/**
 * The baseline of a record's effective verdict, read under `active` from the
 * servers `recorded` holds. An unreadable record's stored verdict counts as
 * read when it is the active implementation's own verdict: a record without a
 * basis holds pi-mcp-adapter's verdict (P1-DC-02), which is exact under the
 * adapter, so no switch can explain a drop it does not make (D-MB-06).
 */
export function degradeBaselineOf(
  effective: { readonly unsupported: readonly string[] },
  recorded: Pick<RecordedMcpServers, "kind">,
  record: Pick<PluginInstallRecord, "compatibilityBasis">,
  active: ActiveMcpImplementation,
): RecordDegradeBaseline {
  const storedIsActive = record.compatibilityBasis === undefined && active === "adapter";
  return {
    unsupported: effective.unsupported,
    readable: recorded.kind !== "unreadable" || storedIsActive,
  };
}

/**
 * D-P3-12 / D-P3-13 / D-MB-06: the kinds a candidate drops that the installed
 * record does not, both read under the active implementation. `view` is the
 * candidate's view under that implementation and `neutral` its neutral
 * resolution. A record whose servers cannot be read keeps its stored verdict
 * (MREC-02). Unless that verdict is the active implementation's own, it does
 * not say which servers the active implementation drops, so an `mcpServers`
 * drop the neutral resolution does not make is not counted: a switch of
 * implementation alone never makes a new degrade.
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
