// bridges/mcp/unstage.ts
//
// MC-7 unstage for the MCP bridge. Reads the scope's `mcp-adapter.json`
// with pi-mcp-adapter's grammar, drops every entry whose
// `_piClaudeMarketplace` marker matches the supplied `(plugin, marketplace)`
// tuple under either server key, atomic-writes the reduced doc, and returns
// the names that were removed (AFILE-01). A marker-less entry under one of
// the plugin's names stays: it is user-authored.
//
// The scope's legacy `mcp.json` holds entries written before the bridge moved
// to `mcp-adapter.json`. Unstage removes the plugin's entries there too, by
// marker and under `mcpServers` only, the key Pi's `mcp.json` holds. Both
// files are read before either is written, so a refusal on either file
// leaves both unchanged. The adapter file is written first. A crash between
// the two writes leaves the legacy entries for the next unstage to remove
// (NFR-3). The writer drops JSONC comments, so each rewritten file whose
// bytes held comments yields a `comments-dropped` notice (AFILE-04).
//
// MC-7 tolerances, per file (no write):
//   - Missing file (ENOENT/ENOTDIR). Must NOT materialize the file just to
//     write an empty one back.
//   - No server key on an otherwise-valid doc.
//   - Nothing to remove (no entries match the tuple). We do NOT re-write
//     the file in that case (PRD §5.7 quiet-on-noop).
//   - A non-object top level: no server in it can be ours, and the user's
//     structure is none of the unstage path's business.
//
// Refusals (typed `McpConfigFileError`, no write to either file): invalid
// JSONC, and a present server key whose value is not an object. When the
// user-visible file is broken, unstage surfaces the breakage rather than mask
// it (AFILE-02).

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  ADAPTER_SERVER_KEYS,
  PI_MCP_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
  type McpServerKey,
} from "./adapter-doc.ts";

import type { UnstageMcpInput, UnstageMcpResult } from "./types.ts";
import type { McpConfigNotice } from "../../shared/notification-dispatch.ts";

/** One config file and the plugin's entries in it. */
interface UnstageTarget {
  readonly file: McpConfigNotice["file"];
  readonly filePath: string;
  readonly config: McpConfigDoc;
  readonly ownedNames: readonly string[];
}

async function readUnstageTarget(
  file: McpConfigNotice["file"],
  filePath: string,
  serverKeys: readonly [McpServerKey, ...McpServerKey[]],
  pluginName: string,
  marketplaceName: string,
): Promise<UnstageTarget | undefined> {
  let config: McpConfigDoc;
  try {
    config = await readMcpConfigDoc(filePath, serverKeys);
  } catch (err) {
    if (err instanceof McpConfigFileError && err.defect === "top-level-not-object") {
      return undefined;
    }

    throw err;
  }

  // `ours` lists the selected key's entries first, each map in file order.
  const ownedNames = Object.keys(partitionServers(config, pluginName, marketplaceName).ours);
  return ownedNames.length === 0 ? undefined : { file, filePath, config, ownedNames };
}

export async function unstageMcpServers(input: UnstageMcpInput): Promise<UnstageMcpResult> {
  const { locations, marketplaceName, pluginName } = input;

  const adapterTarget = await readUnstageTarget(
    "mcp-adapter.json",
    locations.mcpAdapterJsonPath,
    ADAPTER_SERVER_KEYS,
    pluginName,
    marketplaceName,
  );
  const legacyTarget = await readUnstageTarget(
    "mcp.json",
    locations.mcpJsonPath,
    PI_MCP_SERVER_KEYS,
    pluginName,
    marketplaceName,
  );

  // PRD §5.7 / D-04: a file with nothing to remove is not rewritten. The
  // mtime-stable invariant is what tests rely on.
  const targets = [adapterTarget, legacyTarget].filter((target) => target !== undefined);
  for (const { filePath, config } of targets) {
    await atomicWriteJson(filePath, withPluginServers(config, pluginName, marketplaceName, {}));
  }

  const removed = [...new Set(targets.flatMap((target) => target.ownedNames))];
  const notices = targets
    .filter((target) => target.config.hadComments)
    .map((target): McpConfigNotice => ({
      kind: "comments-dropped",
      scope: locations.scope,
      file: target.file,
    }));
  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
    notices: Object.freeze(notices),
  };
}
