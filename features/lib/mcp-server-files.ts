/**
 * @fileoverview Writes the MCP servers of a published plugin: a `.mcp.json`
 * at the plugin root whose stdio server runs the MCP stub with Node, and any
 * JSON file whose stub markers become stub servers (HAR-04, HAR-07,
 * D-CF6-06).
 *
 * The server runs this process's Node on the stub's absolute path, with the
 * plugin and server names as its arguments, so the stub logs which server it
 * is. Unlike the declared servers of `mcp-configuration.ts`, this one starts
 * when pi-mcp-adapter connects to it.
 *
 * Each MCP server feature has its own step module, and every such module
 * writes its fixtures through this file. An export tagged `@public` is one of
 * those writers, kept for the step modules that call it even while none
 * imports it, because fallow would otherwise report it as unused.
 */

import { MCP_STUB_SERVER } from "./mcp-stub-server.ts";
import { writePublishedPluginFile, writePublishedPluginFiles } from "./published-marketplace.ts";

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

/**
 * What a stub server entry may change (D-CF6-06): the plugin argument the
 * stub logs, which defaults to the plugin's name, and the `env` it declares.
 *
 * @public
 */
export interface StubServerOptions {
  readonly plugin?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * The stdio server entry of a stub server, as a plugin's MCP file holds it.
 *
 * @public
 */
export interface StubServerEntry {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Returns the stdio entry that runs the stub as the server `server` of the
 * plugin `plugin` (D-CF6-06). The stub logs `options.plugin` in place of the
 * plugin's name when it is given, such as `${CLAUDE_PLUGIN_ROOT}`, which the
 * server is started with expanded. The entry holds `env` only when given.
 *
 * @public
 */
export function stubServerEntry(
  plugin: string,
  server: string,
  options: StubServerOptions = {},
): StubServerEntry {
  return {
    command: process.execPath,
    args: [MCP_STUB_SERVER, options.plugin ?? plugin, server],
    ...(options.env === undefined ? {} : { env: options.env }),
  };
}

/** Returns the text of the `.mcp.json` that declares `stub` and nothing else. */
export function stubMcpFileText(stub: StubMcpServer): string {
  const entry = stubServerEntry(stub.plugin, stub.server, stub);
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isStubOptions(value: unknown): value is StubServerOptions {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => key === "plugin" || key === "env") &&
    (value.plugin === undefined || typeof value.plugin === "string") &&
    (value.env === undefined || isStringRecord(value.env))
  );
}

// The options of `value` when it is a stub marker, an object whose one own
// member is `stub`, and undefined for any other value. A marker whose `stub`
// is not a plain object of the optional `plugin` and `env` fails, naming
// `member`, so a typo in a scenario never writes a server as it is.
function stubMarkerOptions(member: string, value: unknown): StubServerOptions | undefined {
  if (!isRecord(value) || Object.keys(value).join() !== "stub") {
    return undefined;
  }

  const options = value.stub;
  if (!isStubOptions(options)) {
    throw new Error(
      `the stub marker of "${member}" takes only "plugin" (a string) and "env" (strings): ${JSON.stringify(options)}`,
    );
  }

  return {
    ...(options.plugin === undefined ? {} : { plugin: options.plugin }),
    ...(options.env === undefined ? {} : { env: Object.fromEntries(Object.entries(options.env)) }),
  };
}

/**
 * Returns a deep copy of the parsed JSON `document` in which every object
 * member whose value is a stub marker, `{"stub": {...}}`, becomes the stub
 * server entry of `plugin` named after that member (D-CF6-06). Every other
 * value is copied as written, so a document may also hold a malformed
 * server, a file reference, or an array. Objects are built with
 * `Object.fromEntries`, so a member named `__proto__` stays an own member.
 *
 * @public
 */
export function withStubServers(plugin: string, document: unknown): unknown {
  if (Array.isArray(document)) {
    return document.map((item: unknown) => withStubServers(plugin, item));
  }

  if (!isRecord(document)) {
    return document;
  }

  return Object.fromEntries(
    Object.entries(document).map(([member, value]) => {
      const options = stubMarkerOptions(member, value);
      return [
        member,
        options === undefined
          ? withStubServers(plugin, value)
          : stubServerEntry(plugin, member, options),
      ];
    }),
  );
}

/**
 * Writes the JSON `documentText`, with its stub markers expanded by
 * `withStubServers`, to `file` inside the published plugin `plugin`, and
 * returns the text written (D-CF6-06). It replaces a file that exists, such
 * as `.claude-plugin/plugin.json`. Run tokens are not expanded, so a
 * reference such as `${CLAUDE_PLUGIN_ROOT}` stays as written.
 */
export async function publishStubServersFile(
  published: PublishedMarketplace,
  plugin: string,
  file: string,
  documentText: string,
): Promise<string> {
  const document: unknown = JSON.parse(documentText);
  const text = `${JSON.stringify(withStubServers(plugin, document), null, 2)}\n`;
  await writePublishedPluginFiles(published, plugin, { [file]: text });
  return text;
}
