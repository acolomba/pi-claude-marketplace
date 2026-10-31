/**
 * @fileoverview MCP servers that published plugins declare, and the
 * commented `mcp-adapter.json` a user keeps in a scope.
 *
 * A declared server runs a command that does not exist, so nothing ever
 * starts it: a scenario observes only how Pi stages the server in the scope's
 * MCP configuration. Each function writes one file it creates and refuses to
 * replace a file it did not create.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { writePublishedPluginFile } from "./published-marketplace.ts";

import type { PublishedMarketplace } from "./published-marketplace.ts";

// A command no sandbox provides, so the declared server can never start.
const ABSENT_COMMAND = "pi-features-absent-mcp-server";

/**
 * The commented `mcp-adapter.json` a user keeps: a comment, an empty server
 * map, and a setting of the user's own that a rewrite keeps.
 */
const COMMENTED_MCP_CONFIG =
  '// Kept by the user.\n{\n  "settings": { "toolPrefix": "server" },\n  "mcpServers": {}\n}\n';

/**
 * Declares the MCP server `server` in the `.mcp.json` of the published plugin
 * `plugin`, which must not declare one yet.
 */
export async function declarePublishedMcpServer(
  published: PublishedMarketplace,
  plugin: string,
  server: string,
): Promise<void> {
  await writePublishedPluginFile(
    published,
    plugin,
    ".mcp.json",
    JSON.stringify({ mcpServers: { [server]: { command: ABSENT_COMMAND, args: [] } } }),
  );
}

/** Writes the commented MCP config to `file`, which must not exist yet. */
export async function writeCommentedMcpConfig(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, COMMENTED_MCP_CONFIG, { flag: "wx" });
}
