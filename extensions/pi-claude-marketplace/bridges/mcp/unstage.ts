// bridges/mcp/unstage.ts
//
// MC-7 unstage for the MCP bridge. Reads the scope's `mcp-adapter.json`
// with pi-mcp-adapter's grammar, drops every entry whose
// `_piClaudeMarketplace` marker matches the supplied `(plugin, marketplace)`
// tuple under either server key, atomic-writes the reduced doc, and returns
// the names that were removed (AFILE-01). A marker-less entry under one of
// the plugin's names stays: it is user-authored. An owned entry whose marker
// keeps a user override is replaced by that override, marker-less, in place.
// Each carried field the override holds takes the entry's value, so a later
// `/mcp-adapter enable` or `disable` wins. A carried field the override lacks
// is not added, so a value the plugin's entry declares stays out of it
// (AFILE-01, AFILE-06).
//
// The scope's legacy `mcp.json` holds entries written before the bridge moved
// to `mcp-adapter.json`. Unstage removes the plugin's entries there too, by
// marker and under `mcpServers` only, the key Pi's `mcp.json` holds. Both
// files are read before either is written, so a refusal on either file
// leaves both unchanged. The adapter file is written first. A crash between
// the two writes leaves the legacy entries for the next unstage to remove
// (NFR-3). The writer drops JSONC comments, so each rewritten file whose
// bytes held comments yields a `comments-dropped` notice (AFILE-04), followed
// by one `override-restored` notice per kept override the file gets back
// (AFILE-06). Each rewritten file is returned with the exact bytes written to
// it, so a prune rollback can tell its own rewrite from a later edit (NFR-3).
// When the legacy write fails after the adapter file was rewritten, a typed
// `McpUnstagePartialError` carries the adapter file's notices and written
// bytes, so the caller can still report and recognize them. Its removed names
// leave out any name the legacy file still holds (TR-03).
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
import {
  McpConfigFileError,
  McpUnstagePartialError,
  type McpWrittenFile,
} from "../../shared/errors-bridges.ts";

import {
  ADAPTER_SERVER_KEYS,
  PI_MCP_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  restoredOverrideNames,
  withPluginServers,
  type McpConfigDoc,
  type McpServerKey,
} from "./adapter-doc.ts";

import type { UnstageMcpInput, UnstageMcpResult } from "./types.ts";
import type {
  McpConfigFileNotice,
  McpConfigNotice,
  McpOverrideRestoredNotice,
} from "../../shared/notification-dispatch.ts";
import type { Scope } from "../../shared/types.ts";

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

function removedNamesOf(targets: readonly UnstageTarget[]): readonly string[] {
  return Object.freeze([...new Set(targets.flatMap((target) => target.ownedNames))]);
}

/** The owner of the entries an unstage removes, and the scope it writes. */
interface UnstageOwner {
  readonly pluginName: string;
  readonly marketplaceName: string;
  readonly scope: Scope;
}

/**
 * The notices for one rewritten file: its `comments-dropped` notice when the
 * read bytes held comments (AFILE-04), then one `override-restored` notice per
 * kept override it gets back (AFILE-06).
 */
function targetNotices(target: UnstageTarget, owner: UnstageOwner): McpConfigNotice[] {
  const { scope } = owner;
  const commentsDropped: McpConfigFileNotice[] = target.config.hadComments
    ? [{ kind: "comments-dropped", scope, file: target.file }]
    : [];
  const restored = restoredOverrideNames(
    target.config,
    owner.pluginName,
    owner.marketplaceName,
  ).map((server): McpOverrideRestoredNotice => ({
    kind: "override-restored",
    scope,
    file: target.file,
    server,
  }));
  return [...commentsDropped, ...restored];
}

function noticesOf(
  targets: readonly UnstageTarget[],
  owner: UnstageOwner,
): readonly McpConfigNotice[] {
  return Object.freeze(targets.flatMap((target) => targetNotices(target, owner)));
}

/**
 * Writes each target in order and returns the bytes written to each file. A
 * failure after an earlier write succeeded throws `McpUnstagePartialError`
 * describing the rewritten files (AFILE-04, NFR-3).
 */
async function writeUnstageTargets(
  targets: readonly UnstageTarget[],
  owner: UnstageOwner,
): Promise<readonly McpWrittenFile[]> {
  const writtenTargets: UnstageTarget[] = [];
  const writtenFiles: McpWrittenFile[] = [];
  for (const target of targets) {
    let bytes: Buffer;
    try {
      bytes = await atomicWriteJson(
        target.filePath,
        withPluginServers(target.config, owner.pluginName, owner.marketplaceName, {}),
      );
    } catch (err) {
      if (writtenTargets.length === 0) {
        throw err;
      }

      // TR-03: a name the plugin also owns in a file not rewritten is still
      // live there, so it is not reported as removed.
      const stillOwned = new Set(
        targets.slice(writtenTargets.length).flatMap((unwritten) => unwritten.ownedNames),
      );
      throw new McpUnstagePartialError(
        removedNamesOf(writtenTargets).filter((name) => !stillOwned.has(name)),
        noticesOf(writtenTargets, owner),
        writtenFiles,
        { cause: err },
      );
    }

    writtenTargets.push(target);
    writtenFiles.push({ path: target.filePath, bytes });
  }

  return Object.freeze(writtenFiles);
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
  const owner: UnstageOwner = { pluginName, marketplaceName, scope: locations.scope };
  const written = await writeUnstageTargets(targets, owner);

  return {
    removedNames: removedNamesOf(targets),
    warnings: Object.freeze<string[]>([]),
    notices: noticesOf(targets, owner),
    written,
  };
}
