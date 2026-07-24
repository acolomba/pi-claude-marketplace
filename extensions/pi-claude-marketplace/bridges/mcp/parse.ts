// bridges/mcp/parse.ts
//
// MC-1 precedence chain (entry > manifest > standalone .mcp.json) and
// MC-2 wrapped/unwrapped shape detection. First-match-wins; malformed
// at the matched source THROWS -- no fallthrough.
//
// MC-3 shape validation: top-level value must be an object; each entry
// must be an object; each name must pass assertSafeName. Per
// pi-mcp-adapter's contract the bridge does NOT validate per-field
// semantics (command/args/env shape) -- the adapter owns that.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { ResolvedMcpServers, ResolvePluginMcpServersInput } from "./types.ts";

/**
 * MC-3 shape validation for an `mcpServers` object. Caller passes a
 * descriptive `label` (e.g. "marketplace-entry mcpServers" or
 * "standalone .mcp.json mcpServers at /path") that gets prefixed onto
 * any thrown error so the user can locate the source.
 *
 * Returns the validated map untouched (each entry is left opaque past
 * the "is an object" check).
 */
export function parseMcpServers(value: unknown, label: string): Record<string, unknown> {
  // MCPR-01: a string `mcpServers` is a reference to a wrapped .mcp.json,
  // resolved upstream by domain/resolver.ts::applyStrictMcp. The mcp bridge only
  // ever receives an already-resolved map; a string here means the raw field was
  // wired past the resolver -- fail clearly instead of mislabeling it as a
  // malformed shape ("must be an object").
  if (typeof value === "string") {
    throw new TypeError(
      `${label} is a string reference ("${value}"); string mcpServers references are resolved by the domain resolver before reaching the mcp bridge.`,
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object mapping server names to entries.`);
  }

  const obj = value as Record<string, unknown>;

  for (const [name, entry] of Object.entries(obj)) {
    assertSafeName(name, `${label} server name "${name}"`);

    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`${label}: server "${name}" must be an object.`);
    }
  }

  return obj;
}

/**
 * MC-1 precedence chain: marketplace-entry > plugin-manifest > standalone
 * `<pluginRoot>/.mcp.json`. First match wins. Malformed at the matched
 * source THROWS -- does not fall through.
 *
 * Standalone read tolerates ENOENT/ENOTDIR (returns source:"none"); any
 * other I/O error propagates. JSON parse errors at the standalone path
 * become a descriptive Error with `cause`.
 *
 * MC-2 standalone parse: accepts both wrapped (`{mcpServers:{...}}`) and
 * unwrapped (`{server-name:{...}}`) shapes. Wrapped detection uses
 * `obj.mcpServers` typeof object (non-null, non-array); anything else
 * is treated as unwrapped. An empty wrapped doc is treated as "none".
 */
export async function resolvePluginMcpServers(
  input: ResolvePluginMcpServersInput,
): Promise<ResolvedMcpServers> {
  const { entry, manifest, pluginRoot } = input;

  if (entry.mcpServers !== undefined) {
    return {
      source: "marketplace-entry",
      servers: parseMcpServers(entry.mcpServers, "marketplace-entry mcpServers"),
    };
  }

  if (manifest.mcpServers !== undefined) {
    return {
      source: "plugin-manifest",
      servers: parseMcpServers(manifest.mcpServers, "plugin-manifest mcpServers"),
    };
  }

  const standalonePath = path.join(pluginRoot, ".mcp.json");
  let raw: string;

  try {
    raw = await readFile(standalonePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return { source: "none", servers: {} };
    }

    throw err;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`malformed JSON at ${standalonePath}: ${errorMessage(err)}`, { cause: err });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${standalonePath} must be a JSON object.`);
  }

  const obj = parsed as Record<string, unknown>;

  // MC-2: wrapped vs unwrapped detection.
  const wrapper = obj.mcpServers;
  const serversValue =
    typeof wrapper === "object" && wrapper !== null && !Array.isArray(wrapper) ? wrapper : obj;

  if (Object.keys(serversValue).length === 0) {
    return { source: "none", servers: {} };
  }

  return {
    source: "standalone",
    servers: parseMcpServers(serversValue, `standalone .mcp.json mcpServers at ${standalonePath}`),
  };
}
