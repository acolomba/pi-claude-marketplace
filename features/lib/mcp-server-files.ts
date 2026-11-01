/**
 * @fileoverview Writes the MCP servers of a published plugin: one `.mcp.json`
 * at the plugin root whose stdio server runs the MCP stub with Node
 * (HAR-04, HAR-07).
 *
 * The server runs this process's Node on the stub's absolute path, with the
 * plugin and server names as its arguments, so the stub logs which server it
 * is. Unlike the declared servers of `mcp-configuration.ts`, this one starts
 * when pi-mcp-adapter connects to it.
 */

import { MCP_STUB_SERVER } from "./mcp-stub-server.ts";
import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

/**
 * The `env` of a stub server whose `STUB_TAG` comes from `PI_CM_STUB_TAG`,
 * with a default for when that variable is unset (D-CF1-13). Claude Code
 * expands the reference when it starts the server, not at install.
 */
export const LATE_TAG_ENVIRONMENT: Readonly<Record<string, string>> = {
  STUB_TAG: "${PI_CM_STUB_TAG:-install-default}",
};

/**
 * A stub server of a plugin: its name in the plugin's `.mcp.json`, and the
 * `env` it declares, if any.
 */
export interface StubMcpServer {
  readonly plugin: string;
  readonly server: string;
  readonly env?: Readonly<Record<string, string>>;
}

/** Returns the text of the `.mcp.json` that declares `stub` and nothing else. */
export function stubMcpFileText(stub: StubMcpServer): string {
  const entry = {
    command: process.execPath,
    args: [MCP_STUB_SERVER, stub.plugin, stub.server],
    ...(stub.env === undefined ? {} : { env: stub.env }),
  };
  return `${JSON.stringify({ mcpServers: { [stub.server]: entry } }, null, 2)}\n`;
}

/**
 * Writes the `.mcp.json` that declares `stub` into its published plugin,
 * which must not hold one yet, and returns the path of the file.
 */
export async function publishStubMcpServer(
  published: PublishedMarketplace,
  stub: StubMcpServer,
): Promise<string> {
  return writePublishedPluginFile(published, stub.plugin, ".mcp.json", stubMcpFileText(stub));
}
