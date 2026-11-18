// bridges/mcp/option-withhold.ts
//
// D-PG10-25: holds back the pi-mcp-adapter entries of a plugin whose install
// record's stored `userConfig` does not parse. Such a record sets no option
// variable, and pi-mcp-adapter 7.0.1 expands an unset `${NAME}` to the empty
// string in a stdio server's `command`, `args`, and `env`, so the server would
// start with blank option values. The load disables each of the plugin's
// entries that names an option variable, with pi-mcp-adapter's own
// `disabled: true`, and its marker keeps the entry's own `disabled` field from
// before (`withheld`). A later load that reads the record's options again puts
// that field back and drops the marker member. A restage writes a fresh entry
// and reads the user's `disabled` from the marker, so update and reinstall
// repair it too (`adapter-entry.ts`), and an unstage removes the entry as any
// other.
//
// An entry that names no option, or that its owner already disables itself,
// is left as it is. An entry whose owner has no record in this scope keeps
// what it holds: with no record no variable is set, so a withheld entry stays
// withheld. A file that cannot be read or does not parse, and an entry whose
// marker holds a member of another shape than this extension writes, are left
// unchanged, as the commands refuse them (AFILE-02). Nothing is written when no entry
// changes, so the step is idempotent (NFR-3).

import { OWNED_VARIABLE_PREFIX } from "../../domain/user-config.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";

import { ADAPTER_SERVER_KEYS, readMcpConfigDoc, type McpConfigDoc } from "./adapter-doc.ts";
import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  isPlainObject,
  malformedMarkerMember,
  markerObjectOf,
  withheldOf,
  type MarkerObject,
  type McpMarkerOwner,
} from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";

/** How the record of an entry's owner reads its options in the entry's scope. */
export type RecordedOptionsReading = "readable" | "unreadable" | "absent";

/** One scope's `mcp-adapter.json` and how its owners' records read their options. */
export interface OptionWithholdInput {
  readonly scope: Scope;
  readonly filePath: string;
  readonly optionsOf: (owner: McpMarkerOwner) => RecordedOptionsReading;
  /**
   * Leaves a file that holds comments as it is, for a caller that has no
   * notice to report the dropped comments with (AFILE-04).
   */
  readonly keepCommentedFile?: boolean;
}

const OPTION_REFERENCE = `\${${OWNED_VARIABLE_PREFIX}`;

// An option reference is always written as `${PI_CLAUDE_MARKETPLACE_OPTION_<hex>}`
// or with a `:-` default, and literal text never holds `${` unbroken
// (`adapter-escape.ts`), so the text test finds exactly the option references.
function namesOption(entry: Readonly<Record<string, unknown>>): boolean {
  const fields = Object.entries(entry).filter(([field]) => field !== CLAUDE_MARKETPLACE_MARKER_KEY);
  return JSON.stringify(Object.fromEntries(fields)).includes(OPTION_REFERENCE);
}

/**
 * `entry` with its `disabled` field set to `disabled.value`, or removed when
 * `disabled` is undefined, before its marker, which becomes `marker`.
 */
function rebuilt(
  entry: Readonly<Record<string, unknown>>,
  disabled: { readonly value: unknown } | undefined,
  marker: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(entry)) {
    if (field !== "disabled" && field !== CLAUDE_MARKETPLACE_MARKER_KEY) {
      safeSet(next, field, value);
    }
  }

  if (disabled !== undefined) {
    next.disabled = disabled.value;
  }

  next[CLAUDE_MARKETPLACE_MARKER_KEY] = marker;
  return next;
}

function withheldEntry(
  entry: Readonly<Record<string, unknown>>,
  marker: MarkerObject,
): Record<string, unknown> {
  const own = Object.hasOwn(entry, "disabled") ? { disabled: entry.disabled } : {};
  const withheld = withheldOf(entry) ?? own;
  return rebuilt(entry, { value: true }, { ...marker, withheld });
}

function restoredEntry(
  entry: Readonly<Record<string, unknown>>,
  marker: MarkerObject,
  withheld: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const kept = Object.fromEntries(
    Object.entries(marker).filter(([member]) => member !== "withheld"),
  );
  const disabled = Object.hasOwn(withheld, "disabled") ? { value: withheld.disabled } : undefined;
  return rebuilt(entry, disabled, kept);
}

/** The entry the load leaves in place of `entry`; `entry` itself when nothing changes. */
function nextEntry(entry: unknown, input: OptionWithholdInput): unknown {
  const marker = markerObjectOf(entry);
  if (!isPlainObject(entry) || marker === undefined || malformedMarkerMember(entry) !== undefined) {
    return entry;
  }

  const reading = input.optionsOf({ plugin: marker.plugin, marketplace: marker.marketplace });
  const withheld = withheldOf(entry);
  if (reading === "unreadable" && namesOption(entry)) {
    return withheld === undefined && entry.disabled === true ? entry : withheldEntry(entry, marker);
  }

  return reading === "readable" && withheld !== undefined
    ? restoredEntry(entry, marker, withheld)
    : entry;
}

function nextServers(
  servers: Readonly<Record<string, unknown>>,
  input: OptionWithholdInput,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    safeSet(next, name, nextEntry(entry, input));
  }

  return next;
}

/**
 * D-PG10-25: withholds and restores the entries of `input.filePath` as the
 * module header describes, and writes the file only when an entry changed.
 * Returns a `comments-dropped` notice when the rewritten bytes held comments
 * (AFILE-04), or leaves a commented file unwritten under `keepCommentedFile`.
 * A missing file, or one that cannot be read or does not parse, gives none.
 */
export async function syncWithheldOptionServers(
  input: OptionWithholdInput,
): Promise<readonly McpConfigNotice[]> {
  let config: McpConfigDoc;
  try {
    config = await readMcpConfigDoc(input.filePath, ADAPTER_SERVER_KEYS);
  } catch {
    // pi-mcp-adapter cannot read such a file either, so no entry of it runs,
    // and the commands that write the file report it.
    return [];
  }

  if (config.hadComments && input.keepCommentedFile === true) {
    return [];
  }

  const doc: Record<string, unknown> = { ...config.doc };
  for (const [key, servers] of config.serverMaps) {
    doc[key] = nextServers(servers, input);
  }

  if (JSON.stringify(doc) === JSON.stringify(config.doc)) {
    return [];
  }

  await atomicWriteJson(input.filePath, doc);
  return config.hadComments
    ? [{ kind: "comments-dropped", scope: input.scope, file: "mcp-adapter.json" }]
    : [];
}
