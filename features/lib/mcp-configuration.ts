/**
 * @fileoverview MCP servers that published plugins declare, the commented
 * `mcp-adapter.json` a user keeps in a scope, and the user-global
 * `mcp-adapter.json` that allows project MCP servers.
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

/**
 * The user-global pi-mcp-adapter config that allows project MCP servers
 * without asking (D-CF1-07): `settings.projectServers` of `allow` and an
 * empty server map. pi-mcp-adapter honors the setting only from a user-global
 * file, and ignores it in a project file.
 */
export const PROJECT_SERVERS_ALLOWED_CONFIG = `${JSON.stringify(
  { settings: { projectServers: "allow" }, mcpServers: {} },
  null,
  2,
)}\n`;

/** Writes the commented MCP config to `file`, which must not exist yet. */
export async function writeCommentedMcpConfig(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, COMMENTED_MCP_CONFIG, { flag: "wx" });
}

/**
 * Writes the config that allows project MCP servers to `file`, the
 * `mcp-adapter.json` of the user scope, which must not exist yet.
 */
export async function writeProjectServersAllowedConfig(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PROJECT_SERVERS_ALLOWED_CONFIG, { flag: "wx" });
}
