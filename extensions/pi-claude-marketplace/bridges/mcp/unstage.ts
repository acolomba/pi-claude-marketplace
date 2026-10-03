// bridges/mcp/unstage.ts
//
// MC-7 unstage for the MCP bridge. Reads the scope's `mcp-adapter.json`
// with pi-mcp-adapter's grammar, drops every entry whose
// `_piClaudeMarketplace` marker matches the supplied `(plugin, marketplace)`
// tuple under either server key, atomic-writes the reduced doc, and returns
// the names that were removed (AFILE-01). A marker-less entry under one of
// the plugin's names stays: it is user-authored.
//
// MC-7 tolerances (no write):
//   - Missing `mcp-adapter.json` (ENOENT/ENOTDIR). Must NOT materialize
//     the file just to write an empty one back.
//   - No server key on an otherwise-valid doc.
//   - Nothing to remove (no entries match the tuple). We do NOT re-write
//     the file in that case (PRD §5.7 quiet-on-noop).
//   - A non-object top level: no server in it can be ours, and the user's
//     structure is none of the unstage path's business.
//
// Refusals (typed `McpConfigFileError`, no write): invalid JSONC, and a
// present server key whose value is not an object. When the user-visible
// file is broken, unstage surfaces the breakage rather than mask it
// (AFILE-02).

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  ADAPTER_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
} from "./adapter-doc.ts";

import type { UnstageMcpInput, UnstageMcpResult } from "./types.ts";

const EMPTY_RESULT: UnstageMcpResult = {
  removedNames: Object.freeze<string[]>([]),
  warnings: Object.freeze<string[]>([]),
};

async function readUnstageConfig(filePath: string): Promise<McpConfigDoc | undefined> {
  try {
    return await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);
  } catch (err) {
    if (err instanceof McpConfigFileError && err.defect === "top-level-not-object") {
      return undefined;
    }

    throw err;
  }
}

export async function unstageMcpServers(input: UnstageMcpInput): Promise<UnstageMcpResult> {
  const { locations, marketplaceName, pluginName } = input;

  const config = await readUnstageConfig(locations.mcpAdapterJsonPath);
  if (config === undefined) {
    return EMPTY_RESULT;
  }

  // `ours` lists the selected key's entries first, each map in file order.
  const removed = Object.keys(partitionServers(config, pluginName, marketplaceName).ours);
  if (removed.length === 0) {
    // PRD §5.7 / D-04: don't rewrite the file when there's nothing to
    // remove. The mtime-stable invariant is what tests rely on.
    return EMPTY_RESULT;
  }

  await atomicWriteJson(
    locations.mcpAdapterJsonPath,
    withPluginServers(config, pluginName, marketplaceName, {}),
  );

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
  };
}
