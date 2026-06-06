// bridges/mcp/unstage.ts
//
// MC-7 unstage for the MCP bridge. Reads the scope's `mcp.json`, drops
// every entry whose `_piClaudeMarketplace` marker matches the supplied
// `(plugin, marketplace)` tuple, atomic-writes the reduced doc, and
// returns the names that were removed.
//
// MC-7 tolerances:
//   - Missing `mcp.json` (ENOENT/ENOTDIR) -> noop. Must NOT materialize
//     the file just to write an empty one back.
//   - Missing `mcpServers` field on an otherwise-valid scoped doc ->
//     noop. The doc keeps its other top-level fields.
//   - Nothing to remove (no entries match the tuple) -> noop. We do NOT
//     re-write the file in that case (PRD §5.7 quiet-on-noop).
//
// Malformed scoped JSON propagates as a parse error rather than being
// silently overwritten, mirroring the conservative behavior we want for
// destructive-shaped operations: when the user-visible file is broken,
// surface the breakage rather than mask it.

import { readFile } from "node:fs/promises";

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { errorMessage } from "../../shared/errors.ts";

import { isOwnedBy } from "./marker.ts";

import type { RawMcpDoc, UnstageMcpInput, UnstageMcpResult } from "./types.ts";

const EMPTY_RESULT: UnstageMcpResult = {
  removedNames: Object.freeze<string[]>([]),
  warnings: Object.freeze<string[]>([]),
};

export async function unstageMcpServers(input: UnstageMcpInput): Promise<UnstageMcpResult> {
  const { locations, marketplaceName, pluginName } = input;

  let text: string;
  try {
    text = await readFile(locations.mcpJsonPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      // MC-7: missing file is a clean noop -- nothing to remove, nothing
      // to materialize.
      return EMPTY_RESULT;
    }

    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`malformed JSON at ${locations.mcpJsonPath}: ${errorMessage(err)}`, {
      cause: err,
    });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    // Top-level non-object: treat as having no servers to unstage. We do
    // NOT rewrite the file here because the user's existing structure --
    // even if non-conforming -- is none of the unstage path's business.
    return EMPTY_RESULT;
  }

  const doc = parsed as RawMcpDoc;

  const existingValue = doc.mcpServers;
  // MC-7 tolerance: missing or non-object `mcpServers` -> nothing owned
  // by us, so the unstage is a clean noop.
  if (existingValue === undefined || Array.isArray(existingValue)) {
    return EMPTY_RESULT;
  }

  const existing = existingValue;

  const removed: string[] = [];
  const kept: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(existing)) {
    if (isOwnedBy(value, pluginName, marketplaceName)) {
      removed.push(name);
    } else {
      kept[name] = value;
    }
  }

  if (removed.length === 0) {
    // PRD §5.7 / D-04: don't rewrite the file when there's nothing to
    // remove. The mtime-stable invariant is what tests rely on.
    return EMPTY_RESULT;
  }

  await atomicWriteJson(locations.mcpJsonPath, { ...doc, mcpServers: kept });

  return {
    removedNames: Object.freeze([...removed]),
    warnings: Object.freeze<string[]>([]),
  };
}
