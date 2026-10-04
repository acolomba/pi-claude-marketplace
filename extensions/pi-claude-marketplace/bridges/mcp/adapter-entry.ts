// bridges/mcp/adapter-entry.ts
//
// Builds the entry this extension writes for each plugin MCP server. The
// plugin's entry is substituted and gains the injected env (MENV-01/02), the
// user's own fields carry over from the entry it replaces (AFILE-06), and the
// MC-5 marker goes last. The marker may keep the user override the entry
// replaced, verbatim and inert (AFILE-06). Every change to entry content
// belongs in this module.

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

const CARRIED_FIELD_SET: ReadonlySet<string> = new Set(CARRIED_FIELDS);

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
  /** For each server name, the user override the new entry keeps in its marker. */
  readonly keptOverrides: Readonly<Record<string, unknown>>;
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
 * AFILE-06: the fields of a kept override that do not apply while the
 * plugin's entry holds the server name, in the override's key order. These are
 * its own fields outside the carried set. `directTools` and `toolPrefix` are
 * among them, because the plugin's entry owns both.
 */
export function inactiveOverrideFields(
  override: Readonly<Record<string, unknown>>,
): readonly string[] {
  return Object.freeze(Object.keys(override).filter((field) => !CARRIED_FIELD_SET.has(field)));
}

/**
 * AFILE-06: the override written back in place of the plugin's live entry.
 * Each field outside the carried set comes back as kept, in the kept key order.
 * Each carried field takes the live entry's value instead, so a `/mcp-adapter
 * enable` or `disable` run while the plugin held the name wins over the kept
 * value. A carried field the live entry lacks is left out, as a restage leaves
 * it out, because pi-mcp-adapter's enable writer removes `disabled` from the
 * entry. Only carried fields change, so the result is still an override and
 * never a full definition (AFILE-05).
 */
export function restoredOverride(
  kept: Readonly<Record<string, unknown>>,
  live: unknown,
): Record<string, unknown> {
  const liveCarried = carriedFields(live);
  const restored: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(kept)) {
    if (!CARRIED_FIELD_SET.has(field)) {
      safeSet(restored, field, value);
    } else if (Object.hasOwn(liveCarried, field)) {
      restored[field] = liveCarried[field];
    }
  }

  return { ...restored, ...liveCarried };
}

/**
 * The override a server's new entry keeps. `Object.hasOwn` keeps a server
 * named `__proto__` from picking up `Object.prototype` (WR-01).
 */
function keptOverrideFor(
  keptOverrides: Readonly<Record<string, unknown>>,
  name: string,
): Readonly<Record<string, unknown>> | undefined {
  const override = Object.hasOwn(keptOverrides, name) ? keptOverrides[name] : undefined;
  return isPlainObject(override) ? override : undefined;
}

/**
 * Builds the entry for each plugin server: the translated plugin entry, then
 * the fields carried from the entry it replaces, then the MC-5 marker, which
 * keeps the server's user override when there is one. A carried value
 * overrides the plugin's value; a carried field the plugin also sets keeps the
 * plugin's key position. Carried fields come from `previous` alone, so a
 * credential-bearing field of an override stays inside the marker (AFILE-06).
 */
export function stampServers(input: StampServersInput): {
  readonly stamped: Record<string, unknown>;
  readonly warnings: string[];
} {
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
      [CLAUDE_MARKETPLACE_MARKER_KEY]: buildMarker(
        input.pluginName,
        input.marketplaceName,
        keptOverrideFor(input.keptOverrides, name),
      ),
    });
  }

  return { stamped, warnings };
}
