// bridges/mcp/marker.ts
//
// `_piClaudeMarketplace` marker shape and ownership predicate. Per MC-5
// the marker is per-server (not per-doc) -- every `mcp.json` entry the
// bridge writes carries a `_piClaudeMarketplace: { plugin, marketplace }`
// subobject. `unstage` and the `prepare` partition step read the marker
// to identify which entries belong to a given (marketplace, plugin) tuple.
// The marker may also carry `pluginSetFields`, the names of the carried fields
// the plugin's entry sets (ANAME-07), `defaultFields`: the default values this
// extension wrote (D-PG1-13), each a number, a string, or a boolean, while a
// numbers-only record an earlier release wrote still reads (D-PG9-03), and
// `keptOverride`: the user override the entry replaced, which an unstage
// writes back (AFILE-06, AFILE-01).
// The load-time move reads only the owner a legacy `mcp.json` entry's marker
// names (AMIG-01).
//
// The marker key string is USER CONTRACT -- it must stay byte-stable so
// existing `mcp.json` documents remain readable.

/** Per MC-5 user contract -- DO NOT EDIT key. */
export const CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace";

/** A default value the marker records: a JSON scalar (D-PG9-03). */
export type MarkerDefaultValue = number | string | boolean;

/** The marker subobject's shape. */
export interface ClaudeMarketplaceMarker {
  readonly plugin: string;
  readonly marketplace: string;
  /**
   * The names of the carried fields the plugin's entry sets, never their
   * values (ANAME-07). Carry-forward skips them, and write-back restores the
   * kept override's own value for each of them (AFILE-06).
   */
  readonly pluginSetFields?: readonly string[];
  /**
   * D-PG1-13: default values this extension wrote, so a restage can recompute
   * them. D-PG9-03 widens them from numbers to JSON scalars.
   */
  readonly defaultFields?: Readonly<Record<string, MarkerDefaultValue>>;
  /**
   * The marker-less override this entry replaced under the same server name,
   * kept verbatim (AFILE-06). pi-mcp-adapter never reads inside the marker, so
   * the kept fields are inert. An unstage writes it back marker-less, each of
   * its carried fields outside `pluginSetFields` taking the entry's current
   * value (AFILE-01, AFILE-06).
   */
  readonly keptOverride?: Readonly<Record<string, unknown>>;
}

/** A plain object, not null and not an array: the shape every MCP config member must have. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((element: unknown) => typeof element === "string");
}

function isDefaultValue(value: unknown): value is MarkerDefaultValue {
  return typeof value === "number" || typeof value === "string" || typeof value === "boolean";
}

function isDefaultRecord(value: unknown): value is Readonly<Record<string, MarkerDefaultValue>> {
  return isPlainObject(value) && Object.values(value).every(isDefaultValue);
}

/**
 * Returns the parsed marker subobject if `value` is an object with a
 * well-formed `_piClaudeMarketplace: { plugin: string; marketplace: string }`
 * entry; otherwise null. Arrays, primitives, and partial shapes yield null; it
 * never throws. `pluginSetFields` is returned only when it is an
 * own array of strings, `defaultFields` only when it is an own plain object
 * whose every value is a number, a string, or a boolean (D-PG9-03), and `keptOverride` only when it is an own plain-object member;
 * any other value parses as a marker without that member.
 */
function readMarker(value: unknown): ClaudeMarketplaceMarker | null {
  if (!isPlainObject(value) || !Object.hasOwn(value, CLAUDE_MARKETPLACE_MARKER_KEY)) {
    return null;
  }

  const obj = value[CLAUDE_MARKETPLACE_MARKER_KEY];
  if (!isPlainObject(obj)) {
    return null;
  }

  if (
    !Object.hasOwn(obj, "plugin") ||
    !Object.hasOwn(obj, "marketplace") ||
    typeof obj.plugin !== "string" ||
    typeof obj.marketplace !== "string"
  ) {
    return null;
  }

  const pluginSetFields = Object.hasOwn(obj, "pluginSetFields") ? obj.pluginSetFields : undefined;
  const defaultFields = Object.hasOwn(obj, "defaultFields") ? obj.defaultFields : undefined;
  const keptOverride = Object.hasOwn(obj, "keptOverride") ? obj.keptOverride : undefined;
  return {
    plugin: obj.plugin,
    marketplace: obj.marketplace,
    ...(isStringArray(pluginSetFields) ? { pluginSetFields } : {}),
    ...(isDefaultRecord(defaultFields) ? { defaultFields } : {}),
    ...(isPlainObject(keptOverride) ? { keptOverride } : {}),
  };
}

/**
 * Builds a marker subobject. The plan-side discipline of MC-5 is uniform
 * with state-record discipline -- callers are expected to have already
 * validated `plugin` and `marketplace` via `assertSafeName` upstream.
 * This helper does NOT re-validate; the bridge
 * stage path enters this function with names that have already passed
 * the resolver's name checks. `pluginSetFields` follows the identity only
 * when non-empty (ANAME-07). `defaultFields` follows it when non-empty
 * (D-PG1-13), and `keptOverride` goes last, only when given (AFILE-06), so a
 * restage of the same entry writes the same bytes.
 */
export function buildMarker(
  plugin: string,
  marketplace: string,
  parts: {
    readonly pluginSetFields?: readonly string[];
    readonly defaultFields?: Readonly<Record<string, MarkerDefaultValue>>;
    readonly keptOverride?: Readonly<Record<string, unknown>> | undefined;
  } = {},
): ClaudeMarketplaceMarker {
  const { pluginSetFields = [], defaultFields = {}, keptOverride } = parts;
  return {
    plugin,
    marketplace,
    ...(pluginSetFields.length > 0 ? { pluginSetFields } : {}),
    ...(Object.keys(defaultFields).length > 0 ? { defaultFields } : {}),
    ...(keptOverride === undefined ? {} : { keptOverride }),
  };
}

/** The plugin and marketplace a marker names (AMIG-01). */
export interface McpMarkerOwner {
  readonly plugin: string;
  readonly marketplace: string;
}

/** The owner a well-formed marker names, or none (AMIG-01). */
export function markerOwnerOf(value: unknown): McpMarkerOwner | undefined {
  const marker = readMarker(value);
  return marker === null ? undefined : { plugin: marker.plugin, marketplace: marker.marketplace };
}

/** Whether `value`'s marker names exactly this plugin and marketplace. */
export function isOwnedBy(value: unknown, plugin: string, marketplace: string): boolean {
  const m = readMarker(value);
  return m !== null && m.plugin === plugin && m.marketplace === marketplace;
}

/** The user override an entry's marker keeps, if the marker is well formed (AFILE-06). */
export function keptOverrideOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return readMarker(value)?.keptOverride;
}

/** The carried fields an entry's marker lists as plugin-set, or none (ANAME-07). */
export function pluginSetFieldsOf(value: unknown): readonly string[] {
  return readMarker(value)?.pluginSetFields ?? [];
}

/** The default values an entry's marker records, or none (D-PG1-13). */
export function defaultFieldsOf(value: unknown): Readonly<Record<string, MarkerDefaultValue>> {
  return readMarker(value)?.defaultFields ?? {};
}
