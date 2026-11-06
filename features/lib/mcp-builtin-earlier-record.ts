/**
 * @fileoverview Rewrites one plugin's installation record into the shape an
 * earlier release wrote, before records held the plugin's MCP servers
 * (MREC-02).
 *
 * The record keeps every member but `mcpServerConfigs` and `mcpBundle`, so
 * the extension re-reads the plugin's declared servers the way it reads any
 * record that predates them. The record is read and written through
 * `installation-record.ts`, under the scope root the caller names, which lies
 * in the scenario's sandbox.
 */

import { rewritePluginRecord } from "./installation-record.ts";

// The members an earlier release never wrote into a plugin's record.
const RECORDED_MCP_MEMBERS: ReadonlySet<string> = new Set(["mcpServerConfigs", "mcpBundle"]);

/**
 * Removes the recorded MCP servers and the bundle flag from the record of
 * `pluginId` (`<plugin>@<marketplace>`) in the `state.json` of the scope at
 * `scopeRoot`, keeping every other member of the file. Throws with the file
 * path when the scope records no such plugin.
 */
export async function dropRecordedMcpServers(scopeRoot: string, pluginId: string): Promise<void> {
  await rewritePluginRecord(scopeRoot, pluginId, (record) =>
    Object.fromEntries(
      Object.entries(record).filter(([member]) => !RECORDED_MCP_MEMBERS.has(member)),
    ),
  );
}
