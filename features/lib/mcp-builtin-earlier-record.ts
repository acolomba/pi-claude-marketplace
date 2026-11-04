/**
 * @fileoverview Rewrites one plugin's installation record into the shape an
 * earlier release wrote, before records held the plugin's MCP servers
 * (MREC-02).
 *
 * The record keeps every member but `mcpServerConfigs` and `mcpBundle`, so
 * the extension re-reads the plugin's declared servers the way it reads any
 * record that predates them. The write goes to the scope's `state.json`
 * under the scope root the caller names, which lies in the scenario's sandbox.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPlainObject } from "./field-rows.ts";

// The members an earlier release never wrote into a plugin's record.
const RECORDED_MCP_MEMBERS: ReadonlySet<string> = new Set(["mcpServerConfigs", "mcpBundle"]);

// Where one plugin's record sits in a scope's `state.json`: the file, each
// object on the path from the file's root to the record, and the record.
interface LocatedRecord {
  readonly plugin: string;
  readonly marketplace: string;
  readonly stateFile: string;
  readonly state: Readonly<Record<string, unknown>>;
  readonly marketplaces: Readonly<Record<string, unknown>>;
  readonly marketplaceRecord: Readonly<Record<string, unknown>>;
  readonly plugins: Readonly<Record<string, unknown>>;
  readonly record: Readonly<Record<string, unknown>>;
}

// The JSON object `holder[member]`, throwing with `what` when it is absent or
// anything but an object.
function objectMember(
  holder: Readonly<Record<string, unknown>>,
  member: string,
  what: string,
): Record<string, unknown> {
  const value = holder[member];
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value));
  }

  throw new Error(`${what} is not a JSON object`);
}

// The plugin and marketplace names of `pluginId`, split at its last `@`.
function splitPluginId(pluginId: string): { plugin: string; marketplace: string } {
  const at = pluginId.lastIndexOf("@");
  if (at <= 0 || at === pluginId.length - 1) {
    throw new Error(`${pluginId} is not a <plugin>@<marketplace> id`);
  }

  return { plugin: pluginId.slice(0, at), marketplace: pluginId.slice(at + 1) };
}

// The record of `pluginId` in the `state.json` of the scope at `scopeRoot`,
// with the objects that hold it. Throws with the file path when the scope
// records no such plugin.
async function locateRecord(scopeRoot: string, pluginId: string): Promise<LocatedRecord> {
  const { plugin, marketplace } = splitPluginId(pluginId);
  const stateFile = path.join(scopeRoot, "pi-claude-marketplace", "state.json");
  const parsed: unknown = JSON.parse(await readFile(stateFile, "utf8"));
  // The file's root is the one member of a holder, so one reader checks every level.
  const state = objectMember({ root: parsed }, "root", stateFile);
  const marketplaces = objectMember(state, "marketplaces", `the marketplaces of ${stateFile}`);
  const marketplaceRecord = objectMember(
    marketplaces,
    marketplace,
    `the record of the marketplace ${marketplace} in ${stateFile}`,
  );
  const plugins = objectMember(marketplaceRecord, "plugins", `the plugins of ${marketplace}`);
  const record = objectMember(plugins, plugin, `the record of ${pluginId} in ${stateFile}`);
  return {
    plugin,
    marketplace,
    stateFile,
    state,
    marketplaces,
    marketplaceRecord,
    plugins,
    record,
  };
}

/**
 * Removes the recorded MCP servers and the bundle flag from the record of
 * `pluginId` (`<plugin>@<marketplace>`) in the `state.json` of the scope at
 * `scopeRoot`, keeping every other member of the file. Throws with the file
 * path when the scope records no such plugin.
 */
export async function dropRecordedMcpServers(scopeRoot: string, pluginId: string): Promise<void> {
  const located = await locateRecord(scopeRoot, pluginId);
  const { plugin, marketplace, plugins, record } = located;
  const earlier = Object.fromEntries(
    Object.entries(record).filter(([member]) => !RECORDED_MCP_MEMBERS.has(member)),
  );
  const marketplaceRecord = {
    ...located.marketplaceRecord,
    plugins: { ...plugins, [plugin]: earlier },
  };
  const state = {
    ...located.state,
    marketplaces: { ...located.marketplaces, [marketplace]: marketplaceRecord },
  };
  await writeFile(located.stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * The record of `pluginId` in the `state.json` of the scope at `scopeRoot`.
 * Throws when the scope records no such plugin.
 */
export async function recordedPlugin(
  scopeRoot: string,
  pluginId: string,
): Promise<Readonly<Record<string, unknown>>> {
  return (await locateRecord(scopeRoot, pluginId)).record;
}
