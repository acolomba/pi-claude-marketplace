// bridges/mcp/builtin-registration.ts
//
// Brings Pi's session MCP registry in line with the servers this extension
// wants registered (BLT-01, BLT-06, MSEL-02). Pi's built-in MCP drops and
// reconnects a server only when `JSON.stringify(config)` changed, so a server
// whose listed config already matches is not registered again. A `plugin_`
// registration the desired set lacks is removed; Pi ignores the removal of a
// name another extension owns. Registrations die with Pi's runtime, so the
// sync writes nothing and keeps nothing between loads.

import { errorMessage } from "../../shared/errors.ts";

import type { McpServerConfig, PiMcpRegistry } from "../../platform/pi-api.ts";

// D-MB-13: every server name this extension registers starts with it.
const PLUGIN_SERVER_PREFIX = "plugin_";

/**
 * Unregisters each listed `plugin_` server that `desired` lacks, then
 * registers each desired server whose config differs from the one Pi lists,
 * in `desired` order. Each change Pi accepts goes to `notes`: `replaced` for
 * a registration in place of a listed config of another shape, `fresh` for
 * any other registration or a removal (P2-DC-10). A
 * `registerMcpServer` throw (another extension's name, a `-`/`_` clash, a
 * config Pi refuses) goes to `log` with the server name and Pi's message,
 * never a config value, and the other servers still register.
 */
export function syncBuiltinRegistrations(
  registry: PiMcpRegistry,
  desired: ReadonlyMap<string, McpServerConfig>,
  log: (detail: string) => void,
  notes: {
    readonly replaced: (serverName: string) => void;
    readonly fresh: (serverName: string) => void;
  },
): void {
  const listed = new Map<string, string>();
  for (const server of registry.getMcpServers()) {
    listed.set(server.name, JSON.stringify(server.config));
    if (server.name.startsWith(PLUGIN_SERVER_PREFIX) && !desired.has(server.name)) {
      registry.unregisterMcpServer(server.name);
      notes.fresh(server.name);
    }
  }

  for (const [name, config] of desired) {
    const previous = listed.get(name);
    if (previous === JSON.stringify(config)) {
      continue;
    }

    try {
      registry.registerMcpServer(name, config);
      if (previous === undefined) {
        notes.fresh(name);
      } else {
        notes.replaced(name);
      }
    } catch (error: unknown) {
      log(`MCP server ${name} not registered: ${errorMessage(error)}`);
    }
  }
}
