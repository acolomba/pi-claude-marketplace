/**
 * @fileoverview MCP servers that published plugins declare, the commented
 * `mcp-adapter.json` a user keeps in a scope, the user-global
 * `mcp-adapter.json` that allows project MCP servers, and the legacy
 * `mcp.json` an earlier release wrote a plugin's servers into.
 *
 * A declared server runs a command that does not exist, so nothing ever
 * starts it: a scenario observes only how Pi stages the server in the scope's
 * MCP configuration. Each function but the legacy writer writes one file it
 * creates and refuses to replace a file it did not create. The legacy writer
 * rewrites a scope's two MCP configuration files, under the scope root its
 * caller names, which lies in the scenario's sandbox (D-BG-13).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { jsonObject, readObject } from "./earlier-version-state.ts";
import { isPlainObject } from "./field-rows.ts";
import { readPluginRecord } from "./installation-record.ts";
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

// The marker member release 0.19.2 put on each server entry it wrote (MC-5).
const LEGACY_MARKER_KEY = "_piClaudeMarketplace";

// The `mcpServers` member of `doc`, or an empty object when it is absent.
function serversOf(doc: Record<string, unknown>, what: string): Record<string, unknown> {
  return doc.mcpServers === undefined ? {} : jsonObject(doc.mcpServers, `the servers of ${what}`);
}

async function writeJsonFile(file: string, doc: Record<string, unknown>): Promise<void> {
  await writeFile(file, `${JSON.stringify(doc, null, 2)}\n`);
}

// Whether the server entry `entry` carries the marker of `plugin`@`marketplace`.
function isMarkedFor(entry: unknown, plugin: string, marketplace: string): boolean {
  if (!isPlainObject(entry) || !Object.hasOwn(entry, LEGACY_MARKER_KEY)) {
    return false;
  }

  const marker: unknown = Reflect.get(entry, LEGACY_MARKER_KEY);
  return (
    isPlainObject(marker) &&
    Reflect.get(marker, "plugin") === plugin &&
    Reflect.get(marker, "marketplace") === marketplace
  );
}

// The entry release 0.19.2 wrote for the declared server `entry`: the declared
// members, the injected env of a stdio server, and the marker.
function legacyEntry(
  name: string,
  entry: unknown,
  env: Readonly<Record<string, string>>,
  marker: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const declared = jsonObject(entry, `the declared server ${name}`);
  if (JSON.stringify(declared).includes("${")) {
    throw new Error(`the declared server ${name} names a variable, which is not substituted`);
  }

  const declaredEnv = isPlainObject(declared.env) ? declared.env : {};
  const stdio = typeof declared.command === "string";
  return {
    ...declared,
    ...(stdio ? { env: { ...env, ...declaredEnv } } : {}),
    [LEGACY_MARKER_KEY]: marker,
  };
}

/**
 * Makes the MCP configuration files of the scope at `scopeRoot` look as
 * release 0.19.2 left them for the installed plugin `pluginId`
 * (`<plugin>@<marketplace>`), beside the user's own server `userServer`, and
 * returns the `mcp.json` it wrote. Commit `94160614` (#250), first released
 * in 0.20.0, moved plugin servers to `mcp-adapter.json`.
 *
 * Each server the plugin's `.mcp.json` declares goes into `<scopeRoot>/mcp.json`
 * under its declared name, as 0.19.2's stage wrote it: the declared members, a
 * stdio server's env with `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`
 * injected, and the marker `_piClaudeMarketplace: { plugin, marketplace }`.
 * The user's server, which carries no marker, comes first. The entries
 * today's install wrote into `<scopeRoot>/mcp-adapter.json` under their
 * generated keys are removed. Every other member of both files stays. A
 * declared server that names a variable fails the write, because 0.19.2's
 * substitution is not reproduced.
 *
 * The installation record keeps today's shape unless the scenario also
 * rewrites it.
 */
export async function writeLegacyMcpConfig(args: {
  readonly scopeRoot: string;
  readonly pluginId: string;
  readonly userServer: { readonly name: string; readonly command: string };
}): Promise<Record<string, unknown>> {
  const { scopeRoot, pluginId, userServer } = args;
  const at = pluginId.lastIndexOf("@");
  const plugin = pluginId.slice(0, at);
  const marketplace = pluginId.slice(at + 1);
  const { resolvedSource } = await readPluginRecord(scopeRoot, pluginId);
  if (typeof resolvedSource !== "string") {
    throw new Error(`the record of ${pluginId} names no plugin root`);
  }

  const declaredFile = path.join(resolvedSource, ".mcp.json");
  const declared = serversOf(
    jsonObject(JSON.parse(await readFile(declaredFile, "utf8")), declaredFile),
    declaredFile,
  );
  const env = {
    CLAUDE_PLUGIN_ROOT: resolvedSource,
    CLAUDE_PLUGIN_DATA: path.join(scopeRoot, "pi-claude-marketplace", "data", marketplace, plugin),
  };
  const legacy = Object.entries(declared).map(([name, entry]): [string, unknown] => [
    name,
    legacyEntry(name, entry, env, { plugin, marketplace }),
  ]);

  const adapterFile = path.join(scopeRoot, "mcp-adapter.json");
  const adapter = await readObject(adapterFile);
  const kept = Object.entries(serversOf(adapter, adapterFile)).filter(
    ([, entry]) => !isMarkedFor(entry, plugin, marketplace),
  );
  await writeJsonFile(adapterFile, { ...adapter, mcpServers: Object.fromEntries(kept) });

  const mcpFile = path.join(scopeRoot, "mcp.json");
  const mcp = await readObject(mcpFile);
  const written = {
    ...mcp,
    mcpServers: {
      ...serversOf(mcp, mcpFile),
      [userServer.name]: { command: userServer.command },
      ...Object.fromEntries(legacy),
    },
  };
  await writeJsonFile(mcpFile, written);
  return written;
}
