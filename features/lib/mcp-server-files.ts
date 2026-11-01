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

/** A stub server of a plugin: its name in the plugin's `.mcp.json`. */
export interface StubMcpServer {
  readonly plugin: string;
  readonly server: string;
}

/** Returns the text of the `.mcp.json` that declares `stub` and nothing else. */
export function stubMcpFileText(stub: StubMcpServer): string {
  const entry = { command: process.execPath, args: [MCP_STUB_SERVER, stub.plugin, stub.server] };
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
