// bridges/mcp/collision-slots.ts
//
// Enumerate the four pi-mcp-adapter file slots (RN-5/MC-4 user contract)
// and return Map<serverName, owningPath> with first-declarer-wins
// precedence. The slot constant is hoisted to a named export so snapshot
// tests can lock the user-contract order.
//
// The bridge's job is collision DETECTION across slots. Slot validation
// (per-field semantics, schema correctness) is owned by pi-mcp-adapter --
// malformed JSON in a slot is silently skipped here. EACCES propagates.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { getAgentDir } from "../../platform/pi-api.ts";

/**
 * MC-4 / RN-5 user-contract slot list. The four pi-mcp-adapter
 * configuration paths checked for cross-slot collisions during stage.
 * Order is FIRST-DECLARER-WINS:
 *
 *   [0] shared-global  -- ~/.config/mcp/mcp.json
 *   [1] pi-user-scope  -- <Pi agent dir>/mcp.json (defaults to ~/.pi/agent/mcp.json)
 *   [2] shared-project -- <cwd>/.mcp.json
 *   [3] pi-project-scope -- <cwd>/.pi/mcp.json
 *
 * Returned array is frozen so test snapshots and runtime code cannot
 * accidentally mutate the contract.
 */
export function MCP_COLLISION_SLOTS(cwd: string): readonly string[] {
  return Object.freeze([
    path.join(homedir(), ".config", "mcp", "mcp.json"),
    path.join(getAgentDir(), "mcp.json"),
    path.join(cwd, ".mcp.json"),
    path.join(cwd, ".pi", "mcp.json"),
  ]);
}

/**
 * Walk all four pi-mcp-adapter slots and return Map<serverName, owningPath>.
 * First-declarer wins (slot 0 beats slot 2 if both declare "foo"). Missing
 * files (ENOENT/ENOTDIR) and malformed JSON contribute nothing -- silently
 * skipped, since pi-mcp-adapter is what enforces those slots' validity.
 * EACCES (and any other unexpected error) propagates.
 *
 * Each slot may be wrapped or unwrapped; both forms are tolerated.
 */
export async function loadEffectiveServerNames(cwd: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const slotPath of MCP_COLLISION_SLOTS(cwd)) {
    let text: string;

    try {
      text = await readFile(slotPath, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;

      if (code === "ENOENT" || code === "ENOTDIR") {
        continue;
      }

      throw err;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      continue; // malformed -- skip silently
    }

    const servers = extractServers(parsed);
    for (const name of Object.keys(servers)) {
      if (!map.has(name)) {
        map.set(name, slotPath); // first-declarer wins
      }
    }
  }

  return map;
}

/**
 * Slot-shape normalizer: accepts both wrapped (`{mcpServers:{...}}`) and
 * unwrapped (`{server-name:{...}}`) forms. Returns `{}` for any non-object,
 * arrays, or null.
 */
function extractServers(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  // Wrapped form: {mcpServers: {...}}
  if ("mcpServers" in parsed) {
    const inner: unknown = parsed.mcpServers;
    if (typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }

    return {};
  }

  // Unwrapped form: {server-name: {...}}
  return parsed as Record<string, unknown>;
}
