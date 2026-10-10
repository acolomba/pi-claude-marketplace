// bridges/mcp/adapter-entry.ts
//
// Builds the entry this extension writes for each plugin MCP server. The
// closed table in `domain/mcp-server-features.ts` builds the entry from the
// fields Claude Code reads (ANAME-07). Then `substitute.ts` injects the stdio
// env (MENV-01/02) and expands Claude's variables in the fields Claude
// expands, written in pi-mcp-adapter's encoding (AVAR-01..03). The table also
// writes the owned fields: the plugin's description (ANAME-06), `directTools`
// (ANAME-04) and `toolPrefix: "mcp"`, which keeps the tool names Claude Code's
// `mcp__plugin_<plugin>_<server>__<tool>` whatever the user's global
// `settings.toolPrefix` says (ANAME-01). The user's own fields carry over from
// the entry it replaces (AFILE-06), except a carried field the plugin's entry
// sets, which belongs to the plugin (ANAME-07). The MC-5 marker goes last. It
// names the carried fields the plugin set and may keep the user override the
// entry replaced, verbatim and inert (AFILE-06). Every change to entry content
// belongs in this module or the table.

import { translateMcpServer } from "../../domain/mcp-server-features.ts";

import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  buildMarker,
  keptOverrideOf,
  pluginSetFieldsOf,
} from "./marker.ts";
import { safeSet } from "./safe-set.ts";
import {
  substituteAndInject,
  type McpSubstitutionContext,
  type SubstitutedEntry,
  type VariableReport,
} from "./substitute.ts";

// AFILE-06: the user's choices in pi-mcp-adapter's `ServerEntry` that survive
// a re-stage. `directTools`, `toolPrefix` and `description` are owned by this
// extension, and every other field comes from the plugin's translated entry.
// The closed table can set `requestTimeoutMs` from the plugin's `timeout`
// (ANAME-07); a carried field the plugin sets is the plugin's. No
// credential-bearing field is in the set, so a previous entry or a user stub
// never leaks one into the new entry.
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
  "openUi",
  "trace",
] as const;

const CARRIED_FIELD_SET: ReadonlySet<string> = new Set(CARRIED_FIELDS);

/** The servers one plugin stages, and the entries they replace. */
export interface StampServersInput {
  /** The plugin's server map, keyed by the generated server key (ANAME-01). */
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
  /** The plugin's description, written on every entry when present (ANAME-06). */
  readonly description?: string | undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Translates the plugin's entry through the closed table (ANAME-07), then
 * injects env and expands Claude's fields (MENV-01/02, AVAR-01..03), all
 * BEFORE the marker is spread on, so the marker never enters the walk. A
 * non-object entry keeps the `{}` tolerance with no expansion, so it gets the
 * owned fields only and an empty report, and each normalization is reported
 * as a warning instead of reporting a dead entry as staged.
 */
function translatedEntry(
  name: string,
  entry: unknown,
  substitution: McpSubstitutionContext,
  description: string | undefined,
  warnings: string[],
): SubstitutedEntry {
  if (!isPlainObject(entry)) {
    warnings.push(`mcp server "${name}": entry is not an object; staged as an empty entry`);
    return { entry: translateMcpServer({}, description), report: { missing: [], blanked: [] } };
  }

  // The injection step discards a malformed declared env on a stdio entry
  // (injected defaults only); say so instead of leaving the plugin author to
  // diff mcp-adapter.json against their source.
  if (typeof entry.command === "string" && entry.env !== undefined && !isPlainObject(entry.env)) {
    warnings.push(
      `mcp server "${name}": declared env is not an object; it was ignored (injected defaults only)`,
    );
  }

  return substituteAndInject(translateMcpServer(entry, description), substitution);
}

/** ANAME-07: the carried fields the translated entry sets, in carried-set order. */
function pluginSetFieldsIn(translated: Readonly<Record<string, unknown>>): readonly string[] {
  return CARRIED_FIELDS.filter((field) => Object.hasOwn(translated, field));
}

/**
 * AFILE-06: copies each carried field the previous entry holds as an own
 * property, whatever its value, so an explicit `disabled: false` survives
 * like `true`. A field in `pluginSet` belongs to the plugin and is skipped
 * (ANAME-07). A field the previous entry's marker lists as plugin-set holds
 * the plugin's old value, so it comes from the override that marker keeps,
 * if any, and a timeout a later version drops leaves no stale value behind.
 */
function carriedFields(previous: unknown, pluginSet: readonly string[]): Record<string, unknown> {
  const carried: Record<string, unknown> = {};
  if (!isPlainObject(previous)) {
    return carried;
  }

  const previousPluginSet = pluginSetFieldsOf(previous);
  const kept = keptOverrideOf(previous) ?? {};
  for (const field of CARRIED_FIELDS) {
    const source = previousPluginSet.includes(field) ? kept : previous;
    if (!pluginSet.includes(field) && Object.hasOwn(source, field)) {
      carried[field] = source[field];
    }
  }

  return carried;
}

/**
 * D-08-02 / AFILE-06: the user's carried fields on an entry, in carried-set
 * order: each carried field it holds as an own property, minus the fields its
 * marker lists as plugin-set, whose values are the plugin's (ANAME-07).
 */
export function userCarriedFields(entry: unknown): Record<string, unknown> {
  return carriedFields(entry, pluginSetFieldsOf(entry));
}

/**
 * AFILE-06: the fields of a kept override that do not apply while the
 * plugin's entry holds the server name, in the override's key order. These are
 * its own fields outside the carried set, and its carried fields in
 * `pluginSetFields`, which take the plugin's value (ANAME-07). `directTools`
 * and `toolPrefix` are among them, because the plugin's entry owns both.
 */
export function inactiveOverrideFields(
  override: Readonly<Record<string, unknown>>,
  pluginSetFields: readonly string[],
): readonly string[] {
  return Object.freeze(
    Object.keys(override).filter(
      (field) => !CARRIED_FIELD_SET.has(field) || pluginSetFields.includes(field),
    ),
  );
}

/**
 * AFILE-06: the override written back in place of the plugin's live entry.
 * Each field outside the carried set comes back as kept, in the kept key order,
 * and so does each carried field the live entry's marker lists as plugin-set,
 * because the live value there is the plugin's (ANAME-07). Every other carried
 * field the kept override holds takes the live entry's value instead, so a
 * `/mcp-adapter enable` or `disable` run while the plugin held the name wins
 * over the kept value. Such a field is left out when the live entry lacks it,
 * as a restage leaves it out, because pi-mcp-adapter's enable writer removes
 * `disabled` from the entry. A carried field the kept override lacks is never
 * added, so a value the plugin's entry declares (such as `requestTimeoutMs`)
 * stays out of the user's override. Only the kept override's own fields come
 * back, so the result is still an override and never a full definition
 * (AFILE-05).
 */
export function restoredOverride(
  kept: Readonly<Record<string, unknown>>,
  live: unknown,
): Record<string, unknown> {
  const livePluginSet = pluginSetFieldsOf(live);
  const liveCarried = carriedFields(live, livePluginSet);
  const restored: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(kept)) {
    if (!CARRIED_FIELD_SET.has(field) || livePluginSet.includes(field)) {
      safeSet(restored, field, value);
    } else if (Object.hasOwn(liveCarried, field)) {
      restored[field] = liveCarried[field];
    }
  }

  return restored;
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
 * Builds the entry for each plugin server: the translated and expanded plugin
 * entry with its owned fields (ANAME-04, ANAME-06, ANAME-07), then the fields
 * carried from the entry it replaces in carried-set order, then the MC-5
 * marker. The marker names the carried fields the plugin's entry sets and
 * keeps the server's user override when there is one. A carried field the
 * plugin sets takes the plugin's value, so a timeout change in a later version
 * applies (ANAME-07). Carried fields come from `previous` and the override its
 * marker keeps, so a credential-bearing field of an override stays inside the
 * marker (AFILE-06). `variableReports` holds each server's variable report,
 * keyed by server key in declared order (AVAR-02).
 */
export function stampServers(input: StampServersInput): {
  readonly stamped: Record<string, unknown>;
  readonly warnings: string[];
  readonly variableReports: ReadonlyMap<string, VariableReport>;
} {
  const stamped: Record<string, unknown> = {};
  const warnings: string[] = [];
  const variableReports = new Map<string, VariableReport>();
  for (const [name, entry] of Object.entries(input.servers)) {
    const { entry: translated, report } = translatedEntry(
      name,
      entry,
      input.substitution,
      input.description,
      warnings,
    );
    variableReports.set(name, report);
    const pluginSetFields = pluginSetFieldsIn(translated);
    // safeSet copies a server literally named `__proto__` as an own key, so
    // it is stamped and written rather than dropped through the inherited
    // setter (WR-01).
    safeSet(stamped, name, {
      ...translated,
      ...carriedFields(input.previous[name], pluginSetFields),
      [CLAUDE_MARKETPLACE_MARKER_KEY]: buildMarker(input.pluginName, input.marketplaceName, {
        pluginSetFields,
        keptOverride: keptOverrideFor(input.keptOverrides, name),
      }),
    });
  }

  return { stamped, warnings, variableReports };
}
