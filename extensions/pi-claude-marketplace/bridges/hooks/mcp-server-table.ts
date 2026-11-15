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
import type { ScopedLocations } from "../../persistence/locations.ts";

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
 * MREC-01 / MREC-02: the names of the MCP servers of the plugin that
 * `marketplace` lists under `plugin`, read with `locations`, the locations of
 * the scope whose state holds `marketplace`. The composition root passes the
 * one reader of a record's servers, so a record written before
 * `mcpServerConfigs` existed is re-resolved. A record whose servers cannot be
 * read names none. It never throws.
 */
export type McpServerNamesReader = (
  locations: ScopedLocations,
  marketplace: ExtensionState["marketplaces"][string],
  plugin: string,
) => Promise<readonly string[]>;

/** The servers of every enabled record of `locations`' scope in `state`, as `readNames` names them. */
export async function mcpServerEntries(
  state: ExtensionState,
  locations: ScopedLocations,
  readNames: McpServerNamesReader,
): Promise<McpServerEntry[]> {
  const records = Object.values(state.marketplaces)
    .filter((marketplace) => marketplace.scope === locations.scope)
    .flatMap((marketplace) =>
      Object.entries(marketplace.plugins)
        .filter(([, record]) => !isRecordedButDisabled(record))
        .map(([plugin]) => ({ marketplace, plugin })),
    );
  const entries = await Promise.all(
    records.map(async ({ marketplace, plugin }) =>
      (await readNames(locations, marketplace, plugin)).flatMap(
        (name) => serverEntry(plugin, name) ?? [],
      ),
    ),
  );
  return entries.flat();
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
