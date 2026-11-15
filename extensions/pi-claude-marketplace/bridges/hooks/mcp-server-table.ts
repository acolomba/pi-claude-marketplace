// bridges/hooks/mcp-server-table.ts
//
// The plugin MCP servers of a scope's installation state, and the server of a tool (D-PG6-07).

import {
  MCP_TOOL_PREFIX,
  serverPrefixNames,
  type McpToolIdentity,
} from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import {
  builtinMcpServerName,
  generatedMcpServerKey,
  mcpServerDisplayName,
} from "../../domain/name.ts";
import { isRecordedButDisabled, type ExtensionState } from "../../persistence/state-io.ts";

import type { HookMcpServer } from "./payloads/tool-event-facts.ts";
import type { Scope } from "../../shared/types.ts";

/** One server of an enabled plugin record, under the key of each MCP implementation. */
export interface McpServerEntry {
  /** The name the server registers under in Pi's built-in MCP. */
  readonly builtinServer: string;
  /** The server's key in pi-mcp-adapter's config. */
  readonly adapterKey: string;
  readonly server: HookMcpServer;
}

function serverEntry(plugin: string, server: string): McpServerEntry | undefined {
  try {
    return {
      builtinServer: builtinMcpServerName(plugin, server),
      adapterKey: generatedMcpServerKey(plugin, server),
      server: { name: mcpServerDisplayName(plugin, server), source: "plugin" },
    };
  } catch {
    // A plugin name the key builders refuse names no registered server.
    return undefined;
  }
}

/**
 * The servers of every enabled record of `scope` in `state`. A record written
 * before `mcpServerConfigs` existed gives none.
 */
export function mcpServerEntries(state: ExtensionState, scope: Scope): McpServerEntry[] {
  return Object.values(state.marketplaces)
    .filter((marketplace) => marketplace.scope === scope)
    .flatMap((marketplace) => Object.entries(marketplace.plugins))
    .filter(([, record]) => !isRecordedButDisabled(record))
    .flatMap(([plugin, record]) =>
      (record.mcpServerConfigs ?? []).flatMap(({ name }) => serverEntry(plugin, name) ?? []),
    );
}

// pi-mcp-adapter names a tool `mcp__<key>_<tool>`. A recovered full name is
// compared in place of a cut one, and a cut inside the prefix names no server.
function adapterServes(entry: McpServerEntry, tool: McpToolIdentity): boolean {
  return serverPrefixNames(`${MCP_TOOL_PREFIX}${entry.adapterKey}_`, tool);
}

/**
 * The server of `tool`: by its registered name under Pi's built-in MCP, else
 * by pi-mcp-adapter's key prefix. Nothing when no entry names it, or when two
 * entries that name it are different servers.
 */
export function findMcpServer(
  entries: readonly McpServerEntry[],
  tool: McpToolIdentity,
): HookMcpServer | undefined {
  const found = entries.filter((entry) =>
    tool.builtinServer === undefined
      ? adapterServes(entry, tool)
      : entry.builtinServer === tool.builtinServer,
  );
  const [first, ...others] = found;
  if (first === undefined || others.some(({ server }) => server.name !== first.server.name)) {
    return undefined;
  }

  return first.server;
}
