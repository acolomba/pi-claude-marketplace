// bridges/mcp/marker.ts
//
// `_piClaudeMarketplace` marker shape and ownership predicate. Per MC-5
// the marker is per-server (not per-doc) -- every `mcp.json` entry the
// bridge writes carries a `_piClaudeMarketplace: { plugin, marketplace }`
// subobject. `unstage` and the `prepare` partition step read the marker
// to identify which entries belong to a given (marketplace, plugin) tuple.
// The marker may also carry `keptOverride`: the user override the entry
// replaced, which an unstage writes back (AFILE-06, AFILE-01).
//
// The marker key string is USER CONTRACT -- it must stay byte-stable so
// existing `mcp.json` documents remain readable.

/** Per MC-5 user contract -- DO NOT EDIT key. */
export const CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace";

/** The marker subobject's shape. */
export interface ClaudeMarketplaceMarker {
  readonly plugin: string;
  readonly marketplace: string;
  /**
   * The marker-less override this entry replaced under the same server name,
   * kept verbatim (AFILE-06). pi-mcp-adapter never reads inside the marker, so
   * the kept fields are inert. An unstage writes it back marker-less, with the
   * entry's current carried fields (AFILE-01, AFILE-06).
   */
  readonly keptOverride?: Readonly<Record<string, unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the parsed marker subobject if `value` is an object with a
 * well-formed `_piClaudeMarketplace: { plugin: string; marketplace: string }`
 * entry; otherwise null. Robust against arrays, primitives, and partial
 * shapes -- never throws. `keptOverride` is returned only when it is an own
 * plain-object member; any other value parses as a marker without it.
 */
function readMarker(value: unknown): ClaudeMarketplaceMarker | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  if (!Object.hasOwn(value, CLAUDE_MARKETPLACE_MARKER_KEY)) {
    return null;
  }

  const marker = (value as Record<string, unknown>)[CLAUDE_MARKETPLACE_MARKER_KEY];
  if (typeof marker !== "object" || marker === null || Array.isArray(marker)) {
    return null;
  }

  const obj = marker as Record<string, unknown>;
  if (
    !Object.hasOwn(obj, "plugin") ||
    !Object.hasOwn(obj, "marketplace") ||
    typeof obj.plugin !== "string" ||
    typeof obj.marketplace !== "string"
  ) {
    return null;
  }

  const keptOverride = Object.hasOwn(obj, "keptOverride") ? obj.keptOverride : undefined;
  return isPlainObject(keptOverride)
    ? { plugin: obj.plugin, marketplace: obj.marketplace, keptOverride }
    : { plugin: obj.plugin, marketplace: obj.marketplace };
}

/**
 * Build a marker subobject. The plan-side discipline of MC-5 is uniform
 * with state-record discipline -- callers are expected to have already
 * validated `plugin` and `marketplace` via `assertSafeName` upstream.
 * This helper does NOT re-validate; the bridge
 * stage path enters this function with names that have already passed
 * the resolver's name checks. `keptOverride` goes last, and only when given
 * (AFILE-06).
 */
export function buildMarker(
  plugin: string,
  marketplace: string,
  keptOverride?: Readonly<Record<string, unknown>>,
): ClaudeMarketplaceMarker {
  return keptOverride === undefined
    ? { plugin, marketplace }
    : { plugin, marketplace, keptOverride };
}

/** Convenience: `readMarker(value)` followed by tuple equality. */
export function isOwnedBy(value: unknown, plugin: string, marketplace: string): boolean {
  const m = readMarker(value);
  return m !== null && m.plugin === plugin && m.marketplace === marketplace;
}

/** The user override an entry's marker keeps, if the marker is well formed (AFILE-06). */
export function keptOverrideOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return readMarker(value)?.keptOverride;
}
