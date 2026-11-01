/**
 * @fileoverview Writes the MCP servers of a published plugin: a `.mcp.json`
 * at the plugin root whose stdio server runs the MCP stub with Node, and any
 * JSON file whose stub markers become stub servers (HAR-04, HAR-07,
 * D-CF6-06). It also writes the other fixtures of the MCP server features:
 * the servers of a marketplace entry, a plugin without its manifest, an
 * agent granted plugin MCP tools, and a user's own pi-mcp-adapter override.
 *
 * The server runs this process's Node on the stub's absolute path, with the
 * plugin and server names as its arguments, so the stub logs which server it
 * is. Unlike the declared servers of `mcp-configuration.ts`, this one starts
 * when pi-mcp-adapter connects to it.
 *
 * Each MCP server feature has its own step module, and every such module
 * writes its fixtures through this file.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { MCP_STUB_SERVER } from "./mcp-stub-server.ts";
import {
  rewritePublishedManifest,
  writePublishedPluginFile,
  writePublishedPluginFiles,
} from "./published-marketplace.ts";

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
 */
interface StubServerOptions {
  readonly plugin?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * The stdio server entry of a stub server, as a plugin's MCP file holds it.
 */
interface StubServerEntry {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Returns the stdio entry that runs the stub as the server `server` of the
 * plugin `plugin` (D-CF6-06). The stub logs `options.plugin` in place of the
 * plugin's name when it is given, such as `${CLAUDE_PLUGIN_ROOT}`, which the
 * server is started with expanded. The entry holds `env` only when given.
 */
function stubServerEntry(
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
 * A marker is read wherever it sits, so a document cannot hold a wrapped map
 * whose only server is named `stub`: in `{"mcpServers": {"stub": {...}}}`,
 * the value of `mcpServers` is itself a marker, and it becomes a stub server
 * named `mcpServers`.
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

/**
 * Sets the `mcpServers` of the marketplace entry of `plugin` to
 * `mcpServers`, as written, and rewrites the published manifest (D-CF6-01).
 * The caller expands any stub markers first. Fails when the manifest offers
 * no plugin of that name.
 */
export async function setPublishedEntryMcpServers(
  published: PublishedMarketplace,
  plugin: string,
  mcpServers: unknown,
): Promise<void> {
  const manifest: unknown = JSON.parse(await readFile(published.manifestPath, "utf8"));
  const entries: unknown = isRecord(manifest) ? manifest.plugins : undefined;
  if (!isRecord(manifest) || !Array.isArray(entries)) {
    throw new Error(`the manifest ${published.manifestPath} has no plugins array`);
  }

  const offered: readonly unknown[] = entries;
  if (!offered.some((entry) => isRecord(entry) && entry.name === plugin)) {
    throw new Error(`the manifest ${published.manifestPath} offers no plugin "${plugin}"`);
  }

  const plugins = offered.map((entry) =>
    isRecord(entry) && entry.name === plugin ? { ...entry, mcpServers } : entry,
  );
  await rewritePublishedManifest(
    published,
    `${JSON.stringify({ ...manifest, plugins }, null, 2)}\n`,
  );
}

/**
 * Deletes the `.claude-plugin/plugin.json` of the published plugin `plugin`,
 * which must exist, and returns its path (D-CF6-01). The marketplace entry
 * then acts as the plugin's manifest. Only a `dir` or `file` publication can
 * lose the file, because a git or hosted one would need a new revision.
 */
export async function removePublishedPluginManifest(
  published: PublishedMarketplace,
  plugin: string,
): Promise<string> {
  if (published.kind !== "dir" && published.kind !== "file") {
    throw new Error(`a ${published.kind} publication cannot lose a plugin manifest`);
  }

  const root = path.resolve(published.root);
  const file = path.resolve(root, "plugins", plugin, ".claude-plugin", "plugin.json");
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`refusing to remove ${file} outside the published root ${root}`);
  }

  await rm(file);
  return file;
}

/**
 * Gives the published plugin `plugin` the agent `agent`, whose `tools:`
 * line holds `tools` when given and is absent otherwise, and returns the
 * path of its file (D-CF6-07). A `tools:` entry can name a plugin MCP tool
 * by its Claude Code name, such as `mcp__plugin_demo_stub__echo`.
 */
export async function publishMcpServerAgent(
  published: PublishedMarketplace,
  plugin: string,
  agent: string,
  tools: string | undefined,
): Promise<string> {
  const frontmatter = [
    `name: ${agent}`,
    "description: Calls the tools the task names.",
    ...(tools === undefined ? [] : [`tools: ${tools}`]),
  ];
  return writePublishedPluginFile(
    published,
    plugin,
    path.join("agents", `${agent}.md`),
    ["---", ...frontmatter, "---", "", "Call the tools the task names.", ""].join("\n"),
  );
}

/**
 * Makes the user's own edit of the entry `serverKey` in the
 * `mcp-adapter.json` at `file`, and returns the text written (D-08-01,
 * D-08-02, D-CF6-09). The entry keeps what it holds and takes `fields` over
 * it. With no entry, it holds only `fields`, which is the override a user
 * writes before an install, with no `command` and no `url`. The file and its
 * directory are created when missing.
 */
export async function writeMcpAdapterOverride(
  file: string,
  serverKey: string,
  fields: Readonly<Record<string, unknown>>,
): Promise<string> {
  const document = await readAdapterConfig(file);
  const servers: unknown = document.mcpServers ?? {};
  if (!isRecord(servers)) {
    throw new Error(`the mcpServers of ${file} is not an object`);
  }

  const existing: unknown = servers[serverKey] ?? {};
  if (!isRecord(existing)) {
    throw new Error(`the entry "${serverKey}" of ${file} is not an object`);
  }

  const mcpServers = { ...servers, [serverKey]: { ...existing, ...fields } };
  const text = `${JSON.stringify({ ...document, mcpServers }, null, 2)}\n`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return text;
}

// The parsed `mcp-adapter.json` at `file`, or an empty one when it is missing.
async function readAdapterConfig(file: string): Promise<Readonly<Record<string, unknown>>> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }

  const document: unknown = JSON.parse(text);
  if (!isRecord(document)) {
    throw new Error(`${file} does not hold a JSON object`);
  }

  return document;
}
