import { readFile } from "node:fs/promises";

import { atomicWriteJson } from "../fs-utils.ts";

import { loadEffectiveServerNames } from "./effective-config.ts";
import { buildMarker, CLAUDE_MARKETPLACE_MARKER_KEY, isOwnedBy } from "./marker.ts";

import type { ScopedLocations } from "../location/index.ts";

interface RawMcpDoc {
  mcpServers?: unknown;
  [k: string]: unknown;
}

/** Read scoped mcp.json. ENOENT/ENOTDIR -> {}. Malformed JSON throws. */
async function readScopedDoc(filePath: string): Promise<RawMcpDoc> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return {};
    }

    throw err;
  }

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath}: top-level value must be a JSON object.`);
  }

  return parsed as RawMcpDoc;
}

function getMcpServers(doc: RawMcpDoc): Record<string, unknown> {
  const v = doc.mcpServers;
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    return {};
  }

  return v as Record<string, unknown>;
}

export interface StageMcpInput {
  locations: ScopedLocations;
  marketplaceName: string;
  pluginName: string;
  servers: Record<string, unknown>;
}

export interface StageMcpResult {
  stagedNames: string[];
}

/**
 * Discriminated union for the result of `prepareStageMcpServers`.
 *
 * - "noop": the plugin has no servers AND no previous entries; no I/O happened
 *   and commit/abort are no-ops.
 * - "staged": the merged doc is computed in memory and ready for a single
 *   `atomicWriteJson` call in `commitPreparedMcp`.
 */
export type PreparedMcpStaging =
  | { kind: "noop" }
  | {
      kind: "staged";
      locations: ScopedLocations;
      stagedNames: string[];
      _nextDoc: RawMcpDoc;
    };

/**
 * Phase 1: read the scoped mcp.json, partition ours-vs-theirs, run the
 * cross-slot collision check, build the merged doc -- all in memory. No disk
 * writes. Safe to "abort" (which is a no-op).
 *
 * Throws on any precondition failure (collision, bad entry shape).
 */
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const { locations, marketplaceName, pluginName, servers } = input;
  const doc = await readScopedDoc(locations.mcpConfigPath);
  const existing = getMcpServers(doc);

  // Partition existing into ours-vs-theirs by marker.
  const ours = new Set<string>();
  const theirs: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(existing)) {
    if (isOwnedBy(value, pluginName, marketplaceName)) {
      ours.add(name);
    } else {
      theirs[name] = value;
    }
  }

  // Collision check across all four pi-mcp-adapter slots. Self-replace is OK.
  const newNames = Object.keys(servers);
  if (newNames.length > 0) {
    const effective = await loadEffectiveServerNames(locations.cwd);
    for (const name of newNames) {
      if (ours.has(name)) {
        continue;
      }

      const owningPath = effective.get(name);
      if (owningPath !== undefined && owningPath !== locations.mcpConfigPath) {
        throw new Error(
          `Refusing to stage MCP servers for ${marketplaceName}/${pluginName}: ` +
            `name "${name}" already exists in ${owningPath}.`,
        );
      }

      if (Object.prototype.hasOwnProperty.call(theirs, name)) {
        throw new Error(
          `Refusing to stage MCP servers for ${marketplaceName}/${pluginName}: ` +
            `name "${name}" already exists in ${locations.mcpConfigPath}.`,
        );
      }
    }
  }

  // Nothing new + nothing previously ours -> don't materialize the file.
  if (newNames.length === 0 && ours.size === 0) {
    return { kind: "noop" };
  }

  const marker = buildMarker(pluginName, marketplaceName);
  const stamped: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`server "${name}" entry must be an object.`);
    }

    stamped[name] = {
      ...(entry as Record<string, unknown>),
      [CLAUDE_MARKETPLACE_MARKER_KEY]: marker,
    };
  }

  const next: RawMcpDoc = { ...doc, mcpServers: { ...theirs, ...stamped } };
  return { kind: "staged", locations, stagedNames: newNames, _nextDoc: next };
}

/**
 * Phase 2: write the prepared doc to disk. If prepared is "noop", returns
 * immediately without any I/O.
 */
export async function commitPreparedMcp(prepared: PreparedMcpStaging): Promise<void> {
  if (prepared.kind === "noop") {
    return;
  }

  await atomicWriteJson(prepared.locations.mcpConfigPath, prepared._nextDoc);
}

/**
 * Abort path. MCP prepare writes nothing outside memory, so this is a
 * synchronous no-op. Exists for symmetry with the agent pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function abortPreparedMcp(_prepared: PreparedMcpStaging): void {
  // No-op: nothing was written outside memory pre-commit.
}

/**
 * Convenience one-shot: prepare + commit. Install's call site is unchanged.
 */
export async function stageMcpServers(input: StageMcpInput): Promise<StageMcpResult> {
  const prepared = await prepareStageMcpServers(input);
  await commitPreparedMcp(prepared);
  return { stagedNames: prepared.kind === "staged" ? prepared.stagedNames : [] };
}

export interface UnstageMcpInput {
  locations: ScopedLocations;
  marketplaceName: string;
  pluginName: string;
}

export interface UnstageMcpResult {
  removedNames: string[];
}

export async function unstageMcpServers(input: UnstageMcpInput): Promise<UnstageMcpResult> {
  const { locations, marketplaceName, pluginName } = input;
  const doc = await readScopedDoc(locations.mcpConfigPath);
  const existing = getMcpServers(doc);

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
    return { removedNames: [] };
  }

  await atomicWriteJson(locations.mcpConfigPath, { ...doc, mcpServers: kept });
  return { removedNames: removed };
}
