import { readFile } from "node:fs/promises";
import path from "node:path";

import { errorMessage } from "../errors.ts";
import { assertSafeName } from "../validation.ts";

export interface ResolvePluginMcpServersInput {
  entry: { mcpServers?: unknown };
  manifest: { mcpServers?: unknown };
  pluginRoot: string;
}
export type McpServersSource = "marketplace-entry" | "plugin-manifest" | "standalone" | "none";
export interface ResolvedMcpServers {
  source: McpServersSource;
  servers: Record<string, unknown>;
}

/** Per-entry shape: object only. Values are opaque (pi-mcp-adapter does no
 *  per-field validation either, so further checks would diverge). */
export function parseMcpServers(value: unknown, label: string): Record<string, unknown> {
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

/** Precedence: entry > manifest > .mcp.json. First match wins; malformed at
 *  the matched source throws (no fallthrough). */
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
