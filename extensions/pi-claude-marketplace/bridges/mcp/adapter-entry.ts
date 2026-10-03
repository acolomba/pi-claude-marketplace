// bridges/mcp/adapter-entry.ts
//
// Builds the entry this extension writes for each plugin MCP server. The
// plugin's entry is substituted and gains the injected env (MENV-01/02), the
// user's own fields carry over from the entry it replaces (AFILE-06), and the
// MC-5 marker goes last. Every change to entry content belongs in this module.

import { CLAUDE_MARKETPLACE_MARKER_KEY, buildMarker } from "./marker.ts";
import { safeSet } from "./safe-set.ts";
import { substituteAndInject, type McpSubstitutionContext } from "./substitute.ts";

// AFILE-06: the user's choices in pi-mcp-adapter's `ServerEntry` that survive
// a re-stage. `directTools` and `toolPrefix` are owned by this extension, and
// every other field comes from the plugin. No credential-bearing field is in
// the set, so a previous entry or a user stub never leaks one into the new
// entry.
const CARRIED_FIELDS = [
  "disabled",
  "approveTools",
  "includeTools",
  "excludeTools",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "debug",
  "searchKeywords",
] as const;

/** The servers one plugin stages, and the entries they replace. */
export interface StampServersInput {
  /** The plugin's server map, keyed by server name. */
  readonly servers: Readonly<Record<string, unknown>>;
  readonly pluginName: string;
  readonly marketplaceName: string;
  readonly substitution: McpSubstitutionContext;
  /**
   * The entry each server name replaces in the target file: a user override
   * stub or the plugin's previous marked entry. A name without one is absent.
   */
  readonly previous: Readonly<Record<string, unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-substitutes and injects env BEFORE the marker is spread on, so the
 * marker never enters the walk (MENV-01/02). A non-object entry keeps the `{}`
 * tolerance with no substitution, and each normalization is reported as a
 * warning instead of reporting a dead entry as staged.
 */
function translatedEntry(
  name: string,
  entry: unknown,
  substitution: McpSubstitutionContext,
  warnings: string[],
): Record<string, unknown> {
  if (!isPlainObject(entry)) {
    warnings.push(`mcp server "${name}": entry is not an object; staged as an empty entry`);
    return {};
  }

  // The injection step discards a malformed declared env on a stdio entry
  // (injected defaults only); say so instead of leaving the plugin author to
  // diff mcp-adapter.json against their source.
  if (typeof entry.command === "string" && entry.env !== undefined && !isPlainObject(entry.env)) {
    warnings.push(
      `mcp server "${name}": declared env is not an object; it was ignored (injected defaults only)`,
    );
  }

  return substituteAndInject(entry, substitution);
}

/**
 * AFILE-06: copies each carried field the previous entry holds as an own
 * property, whatever its value, so an explicit `disabled: false` survives
 * like `true`.
 */
function carriedFields(previous: unknown): Record<string, unknown> {
  const carried: Record<string, unknown> = {};
  if (!isPlainObject(previous)) {
    return carried;
  }

  for (const field of CARRIED_FIELDS) {
    if (Object.hasOwn(previous, field)) {
      carried[field] = previous[field];
    }
  }

  return carried;
}

/**
 * Builds the entry for each plugin server: the translated plugin entry, then
 * the fields carried from the entry it replaces, then the MC-5 marker. A
 * carried value overrides the plugin's value; a carried field the plugin also
 * sets keeps the plugin's key position.
 */
export function stampServers(input: StampServersInput): {
  readonly stamped: Record<string, unknown>;
  readonly warnings: string[];
} {
  const marker = buildMarker(input.pluginName, input.marketplaceName);
  const stamped: Record<string, unknown> = {};
  const warnings: string[] = [];
  for (const [name, entry] of Object.entries(input.servers)) {
    const translated = translatedEntry(name, entry, input.substitution, warnings);
    // safeSet copies a server literally named `__proto__` as an own key, so
    // it is stamped and written rather than dropped through the inherited
    // setter (WR-01).
    safeSet(stamped, name, {
      ...translated,
      ...carriedFields(input.previous[name]),
      [CLAUDE_MARKETPLACE_MARKER_KEY]: marker,
    });
  }

  return { stamped, warnings };
}
