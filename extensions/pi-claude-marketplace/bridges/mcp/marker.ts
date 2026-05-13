// bridges/mcp/marker.ts
//
// `_piClaudeMarketplace` marker shape and ownership predicate. Per MC-5
// the marker is per-server (not per-doc) -- every `mcp.json` entry the
// bridge writes carries a `_piClaudeMarketplace: { plugin, marketplace }`
// subobject. `unstage` and the `prepare` partition step read the marker
// to identify which entries belong to a given (marketplace, plugin) tuple.
//
// Carried verbatim from V1 `mcp/marker.ts` (41 lines). The marker key
// string is USER CONTRACT -- byte-for-byte identical with V1 so existing
// `mcp.json` documents from a V1-installed plugin remain readable.

/** Per MC-5 user contract -- DO NOT EDIT key. */
export const CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace";

/** The marker subobject's shape. */
export interface ClaudeMarketplaceMarker {
  readonly plugin: string;
  readonly marketplace: string;
}

/**
 * Returns the parsed marker subobject if `value` is an object with a
 * well-formed `_piClaudeMarketplace: { plugin: string; marketplace: string }`
 * entry; otherwise null. Robust against arrays, primitives, and partial
 * shapes -- never throws.
 */
export function readMarker(value: unknown): ClaudeMarketplaceMarker | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const marker = (value as Record<string, unknown>)[CLAUDE_MARKETPLACE_MARKER_KEY];
  if (typeof marker !== "object" || marker === null || Array.isArray(marker)) {
    return null;
  }

  const obj = marker as Record<string, unknown>;
  if (typeof obj.plugin !== "string" || typeof obj.marketplace !== "string") {
    return null;
  }

  return { plugin: obj.plugin, marketplace: obj.marketplace };
}

/**
 * Build a marker subobject. The plan-side discipline of MC-5 is uniform
 * with state-record discipline -- callers are expected to have already
 * validated `plugin` and `marketplace` via `assertSafeName` upstream
 * (Phase 2 discipline). This helper does NOT re-validate; the bridge
 * stage path enters this function with names that have already passed
 * the resolver's name checks.
 */
export function buildMarker(plugin: string, marketplace: string): ClaudeMarketplaceMarker {
  return { plugin, marketplace };
}

/** Convenience: `readMarker(value)` followed by tuple equality. */
export function isOwnedBy(value: unknown, plugin: string, marketplace: string): boolean {
  const m = readMarker(value);
  return m !== null && m.plugin === plugin && m.marketplace === marketplace;
}
