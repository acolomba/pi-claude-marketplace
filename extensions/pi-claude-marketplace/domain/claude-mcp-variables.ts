// domain/claude-mcp-variables.ts
//
// Claude Code 2.1.291's variable rule for one plugin MCP field value
// (AVAR-01, AVAR-02, AVAR-05). Claude first replaces the builtins
// `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_PLUGIN_DATA}`,
// in that order, each pass reading the previous pass's output. It then expands
// every `${NAME}` and `${NAME:-default}` in the result in one scan. This module
// returns that scan as segments: literal text, and references kept for
// pi-mcp-adapter to expand when it connects. A reference carries only a
// variable's name and, for `${NAME:-default}`, the plugin's default text, so no
// environment value leaves this module. The caller supplies the environment.
//
// D-CF1-13: pi-mcp-adapter 7.x expands `${NAME:-default}` as Claude does for
// an unset, empty, or set variable, so a reference with a default stays a
// reference with its default, and a variable set after install takes effect at
// the next connect. Three cases keep the install-time decision. The adapter
// runs its `$env:` and `{env:` passes over the default it inserted, which
// Claude never does, so a default that holds `$env:` or `{env:` text is
// resolved here. A deny-listed name is decided here too (AVAR-05), and so is a
// base-URL name in a remote field, whose deny decision reads its value.
//
// AVAR-05: Claude withholds deny-listed variables
// (`domain/claude-credential-denylist.ts`). The decision is made here, at
// install, and never left for the adapter, so a variable set later cannot
// reach the server. A remote field (`url`, `headers`) writes `""` for a
// remote-sink name whether or not it is set. A plain field (`command`, `args`,
// `env`) writes `""` for a plain name that is set; when it is unset, the field
// gets the `:-` default, or the literal `${NAME}` text and a missing report.

import path from "node:path";

import {
  CREDENTIAL_BASE_URL_NAMES,
  matchesPlainNamePattern,
  matchesRemoteSinkNamePattern,
  PLAIN_DENIED_NAMES,
  REMOTE_SINK_DENIED_NAMES,
  valueCarriesCredential,
} from "./claude-credential-denylist.ts";
import { replaceUserConfigReferences } from "./user-config.ts";

import type { ResolvedOptions } from "./user-config.ts";

/** The environment Claude's rule reads at install time. */
export type ClaudeEnv = Readonly<Record<string, string | undefined>>;

/**
 * One piece of an expanded value: literal text, or a `${NAME}` reference kept
 * for the adapter's runtime expansion. A reference with a `fallback` is
 * `${NAME:-fallback}`, whose default the adapter uses when `NAME` is unset at
 * connect time (D-CF1-13).
 */
export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ref"; readonly name: string; readonly fallback?: string };

/**
 * The builtin paths. `projectDir` is the project root at project scope and
 * `undefined` at user scope, where Pi's process supplies `CLAUDE_PROJECT_DIR`
 * at runtime (MENV-03).
 */
export interface ClaudeBuiltins {
  readonly pluginRoot: string;
  readonly pluginData: string;
  readonly projectDir: string | undefined;
}

/**
 * Which deny-list a field uses (AVAR-05): `remote` for `url` and `headers`,
 * `plain` for `command`, `args` and `env`.
 */
export type FieldClass = "plain" | "remote";

/** A deny-listed reference written as the empty string, and whether it was set. */
export interface WithheldReference {
  readonly name: string;
  readonly set: boolean;
}

/**
 * The segments of one value, the unset variables it references with no
 * default, and the deny-listed references it withholds, each in first-seen
 * order. A name used twice appears twice.
 */
export interface ExpandedValue {
  readonly segments: readonly Segment[];
  readonly missing: readonly string[];
  readonly withheld: readonly WithheldReference[];
}

// Claude Code 2.1.291's grammar, verbatim, so it can be compared with the
// binary's text.
// eslint-disable-next-line sonarjs/concise-regex -- kept verbatim from Claude Code
const CLAUDE_VARIABLE = /\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g;

const DEFAULT_SEPARATOR = ":-";

function replaceBuiltins(raw: string, builtins: ClaudeBuiltins): string {
  // Function replacers insert each path literally, so `$&` in a path stays text.
  const withRoot = raw.replaceAll("${CLAUDE_PLUGIN_ROOT}", () => builtins.pluginRoot);
  const { projectDir } = builtins;
  const withProject =
    projectDir === undefined
      ? withRoot
      : withRoot.replaceAll("${CLAUDE_PROJECT_DIR}", () => projectDir);
  return withProject.replaceAll("${CLAUDE_PLUGIN_DATA}", () => builtins.pluginData);
}

interface ScanState {
  readonly fieldClass: FieldClass;
  readonly env: ClaudeEnv;
  readonly builtins: ClaudeBuiltins;
  readonly missing: string[];
  readonly withheld: WithheldReference[];
}

// An own string property only, so `${constructor}` reads as unset.
function valueOf(env: ClaudeEnv, name: string): string | undefined {
  const value = Object.hasOwn(env, name) ? env[name] : undefined;
  return typeof value === "string" ? value : undefined;
}

// AVAR-05: Claude's `oq` deny test. Membership reads the uppercase name.
function isDenied(fieldClass: FieldClass, upper: string, value: string | undefined): boolean {
  if (fieldClass === "plain") {
    return PLAIN_DENIED_NAMES.has(upper) || matchesPlainNamePattern(upper);
  }

  return (
    REMOTE_SINK_DENIED_NAMES.has(upper) ||
    matchesRemoteSinkNamePattern(upper) ||
    (value !== undefined && CREDENTIAL_BASE_URL_NAMES.has(upper) && valueCarriesCredential(value))
  );
}

// AVAR-05: a remote field always writes `""`, ignoring a default. A plain
// field writes `""` when the variable is set; when it is unset the default or
// the literal `${NAME}` text is written, never a reference.
function deniedSegment(
  name: string,
  defaultText: string | undefined,
  value: string | undefined,
  state: ScanState,
): Segment {
  const set = value !== undefined;
  if (state.fieldClass === "remote" || set) {
    state.withheld.push({ name, set });
    return { kind: "text", text: "" };
  }

  if (defaultText !== undefined) {
    return { kind: "text", text: defaultText };
  }

  state.missing.push(name);
  return { kind: "text", text: `\${${name}}` };
}

// D-CF1-13: pi-mcp-adapter expands `$env:` and `{env:` again in the default
// its first pass inserted, so such a default is never left to the adapter.
function holdsAdapterMarker(defaultText: string): boolean {
  return defaultText.includes("$env:") || defaultText.includes("{env:");
}

// D-CF1-13, AVAR-05: a remote base-URL name is withheld only when its value
// carries a credential, so the value it holds at connect time must not reach
// the adapter unchecked. Its default keeps the install-time rule.
function leavesDefaultToAdapter(
  fieldClass: FieldClass,
  upper: string,
  defaultText: string,
): boolean {
  return (
    !holdsAdapterMarker(defaultText) &&
    !(fieldClass === "remote" && CREDENTIAL_BASE_URL_NAMES.has(upper))
  );
}

function segmentFor(inner: string, state: ScanState): Segment {
  const separator = inner.indexOf(DEFAULT_SEPARATOR);
  const name = separator === -1 ? inner : inner.slice(0, separator);
  const defaultText =
    separator === -1 ? undefined : inner.slice(separator + DEFAULT_SEPARATOR.length);
  const ref: Segment = { kind: "ref", name };
  if (
    defaultText === undefined &&
    name === "CLAUDE_PROJECT_DIR" &&
    state.builtins.projectDir === undefined
  ) {
    return ref;
  }

  const value = valueOf(state.env, name);
  const upper = name.toUpperCase();
  if (isDenied(state.fieldClass, upper, value)) {
    return deniedSegment(name, defaultText, value, state);
  }

  if (defaultText !== undefined && leavesDefaultToAdapter(state.fieldClass, upper, defaultText)) {
    return { kind: "ref", name, fallback: defaultText };
  }

  if (value !== undefined) {
    return ref;
  }

  if (defaultText !== undefined) {
    return { kind: "text", text: defaultText };
  }

  state.missing.push(name);
  return ref;
}

/**
 * D-PG10-11: the option pass of one field. `reference` writes each option as
 * a reference to the process variable `names` gives for its key, for
 * pi-mcp-adapter to expand when it connects. `text` writes each option's MCP
 * value. A key the form lacks keeps its `${user_config.KEY}` text.
 */
export type McpOptionPass =
  | { readonly form: "reference"; readonly names: ReadonlyMap<string, string> }
  | { readonly form: "text"; readonly mcpValues: ReadonlyMap<string, string> };

function optionSegment(key: string, pass: McpOptionPass): Segment | undefined {
  if (pass.form === "reference") {
    const name = pass.names.get(key);
    return name === undefined ? undefined : { kind: "ref", name };
  }

  const text = pass.mcpValues.get(key);
  return text === undefined ? undefined : { kind: "text", text };
}

// D-PG10-11: Claude Code 2.1.323 fills options after the path variables and
// before its environment scan, and that scan reads the filled value. Here the
// option becomes its own segment and only the text around it is scanned: under
// pi-mcp-adapter the value is not in the entry, so it cannot be scanned, and
// the text form follows so that both implementations behave alike. A segment
// never goes through `segmentFor`, so an option is never reported missing or
// tested against the deny-list.
function optionPieces(text: string, pass: McpOptionPass | undefined): Array<string | Segment> {
  if (pass === undefined) {
    return [text];
  }

  const pieces: Array<string | Segment> = [];
  let start = 0;
  replaceUserConfigReferences(text, (key, matched) => {
    const segment = optionSegment(key, pass);
    if (segment !== undefined) {
      const at = text.indexOf(matched, start);
      pieces.push(text.slice(start, at), segment);
      start = at + matched.length;
    }

    return matched;
  });
  pieces.push(text.slice(start));
  return pieces;
}

function scannedSegments(text: string, state: ScanState): Segment[] {
  const segments: Segment[] = [];
  let textStart = 0;
  for (const match of text.matchAll(CLAUDE_VARIABLE)) {
    if (match.index > textStart) {
      segments.push({ kind: "text", text: text.slice(textStart, match.index) });
    }

    segments.push(segmentFor(match[0].slice(2, -1), state));
    textStart = match.index + match[0].length;
  }

  if (textStart < text.length) {
    segments.push({ kind: "text", text: text.slice(textStart) });
  }

  return segments;
}

/**
 * Expands one field value by Claude's rule. A set variable, the empty string
 * included, stays a reference. A `:-` default stays with its reference, set or
 * not, for the adapter to use when the variable is unset at connect time
 * (D-CF1-13). A default holding `$env:` or `{env:` text, and a base-URL name
 * in a remote field, keep the install-time rule instead: an unset variable
 * becomes the default text, which is never scanned again. An unset variable
 * with no default stays a reference and is reported missing. At user scope
 * `${CLAUDE_PROJECT_DIR}` stays a reference and is never reported missing. A
 * deny-listed reference follows Claude's deny arm for `fieldClass` (AVAR-05)
 * and is listed in `withheld` whenever it is written as `""`. `options` is the
 * option pass that runs between the path variables and the scan, or
 * `undefined` for none, so `${user_config.KEY}` stays text (D-PG10-11,
 * D-PG10-21).
 */
export function expandClaudeValue(
  raw: string,
  fieldClass: FieldClass,
  env: ClaudeEnv,
  builtins: ClaudeBuiltins,
  options: McpOptionPass | undefined,
): ExpandedValue {
  const state: ScanState = { fieldClass, env, builtins, missing: [], withheld: [] };
  const segments = optionPieces(replaceBuiltins(raw, builtins), options).flatMap((piece) =>
    typeof piece === "string" ? scannedSegments(piece, state) : [piece],
  );
  return { segments, missing: state.missing, withheld: state.withheld };
}

/**
 * The variable names one plugin MCP server references, each deduplicated in
 * first-seen field order (AVAR-04, AVAR-05). `unset` holds the names Claude
 * reports missing. `withheld` holds the deny-listed names written as the
 * empty string. Names only, never values.
 */
export interface ServerVariableScan {
  readonly unset: readonly string[];
  readonly withheld: readonly string[];
}

/**
 * The string values of one server's expanded fields and their deny-list, and
 * the values pi-mcp-adapter expands a leading `~` in.
 */
interface ScannedFields {
  readonly fieldClass: FieldClass;
  readonly values: readonly string[];
  readonly homeExpanded: readonly string[];
}

// A builtin never names a variable, so the scan gives each one the path `/`,
// which can neither form nor complete a `${...}` reference with the text
// beside it. At user scope Pi's process supplies `CLAUDE_PROJECT_DIR`.
const SCAN_BUILTINS: ClaudeBuiltins = { pluginRoot: "/", pluginData: "/", projectDir: "/" };

// Claude Code maps `streamable-http` to `http` before it expands variables, so
// the scan treats it as remote.
const REMOTE_TYPES: ReadonlySet<string> = new Set(["sse", "http", "streamable-http"]);

// AVAR-01: Claude writes the values under these env keys without expansion.
const LITERAL_ENV_KEYS: ReadonlySet<string> = new Set(["CLAUDE_PLUGIN_ROOT", "CLAUDE_PLUGIN_DATA"]);

const NO_KEYS: ReadonlySet<string> = new Set();

const EMPTY_SCAN: ServerVariableScan = { unset: [], withheld: [] };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringsOf(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string");
}

function recordStrings(value: unknown, omittedKeys: ReadonlySet<string>): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return stringsOf(
    Object.entries(value)
      .filter(([key]) => !omittedKeys.has(key))
      .map(([, entry]) => entry),
  );
}

// Claude's five fields by server type: stdio `command`, `args` and `env`, and
// remote `url` and `headers`. Any other type is expanded by no field.
function scannedFields(server: unknown): ScannedFields | undefined {
  if (!isRecord(server)) {
    return undefined;
  }

  const { type } = server;
  if (type === undefined || type === "stdio") {
    const command = stringsOf([server.command]);
    const args = Array.isArray(server.args) ? stringsOf(server.args) : [];
    return {
      fieldClass: "plain",
      values: [...command, ...args, ...recordStrings(server.env, LITERAL_ENV_KEYS)],
      homeExpanded: [...command, ...args],
    };
  }

  if (typeof type === "string" && REMOTE_TYPES.has(type)) {
    return {
      fieldClass: "remote",
      values: [...stringsOf([server.url]), ...recordStrings(server.headers, NO_KEYS)],
      homeExpanded: [],
    };
  }

  return undefined;
}

/**
 * Lists the unset and withheld variables of one raw plugin MCP server config
 * by Claude's rule, read against `env` (AVAR-04, AVAR-05). A builtin token is
 * never listed. A config that is not an object, or whose type Claude expands
 * in no field, gives two empty lists.
 */
export function scanClaudeServerVariables(server: unknown, env: ClaudeEnv): ServerVariableScan {
  const fields = scannedFields(server);
  if (fields === undefined) {
    return EMPTY_SCAN;
  }

  const unset = new Set<string>();
  const withheld = new Set<string>();
  for (const raw of fields.values) {
    const expanded = expandClaudeValue(raw, fields.fieldClass, env, SCAN_BUILTINS, undefined);
    for (const name of expanded.missing) {
      unset.add(name);
    }

    for (const { name } of expanded.withheld) {
      withheld.add(name);
    }
  }

  return { unset: [...unset], withheld: [...withheld] };
}

/**
 * D-PG10-21: why a plugin MCP server is left out. `unset`: a field names an
 * option that has no value. `home-path` (D-PG10-11): `command` or an `args`
 * element starts with an option whose value pi-mcp-adapter expands to a path
 * under the user's home.
 */
export type McpOptionBlockReason = "unset" | "home-path";

/** D-PG10-21: why a server is left out, and the option keys that cause it. */
export interface McpOptionBlock {
  readonly reason: McpOptionBlockReason;
  readonly keys: readonly string[];
}

/**
 * D-PG10-08 / D-PG10-21: whether a raw plugin MCP server config is left out
 * for the options its fields name, and why. Claude Code 2.1.323 fills
 * `${user_config.KEY}` in the five fields from its MCP value map, which holds
 * each declared default and the empty string for an option that is not
 * required, and throws for a key the map lacks: a required option with no
 * default, or a key the manifest does not declare. It catches the throw per
 * server, so that one server does not load. The keys come once each, in
 * first-seen field order. `undefined` options, for a plugin that declares no
 * `userConfig`, block nothing: Claude runs no option pass for it. A server
 * with no unset option is left out as `home-path` when `command` or an `args`
 * element starts with an option whose value pi-mcp-adapter expands to a home
 * path (D-PG10-11), its keys in the same order.
 */
export function mcpOptionBlock(
  server: unknown,
  options: Pick<ResolvedOptions, "mcpValues"> | undefined,
): McpOptionBlock | undefined {
  const fields = scannedFields(server);
  if (options === undefined || fields === undefined) {
    return undefined;
  }

  const unset = unsetOptionKeys(fields.values, options.mcpValues);
  if (unset.length > 0) {
    return { reason: "unset", keys: unset };
  }

  const home = homePathOptionKeys(fields.homeExpanded, options.mcpValues);
  return home.length === 0 ? undefined : { reason: "home-path", keys: home };
}

function unsetOptionKeys(
  values: readonly string[],
  mcpValues: ReadonlyMap<string, string>,
): string[] {
  const unset = new Set<string>();
  for (const raw of values) {
    replaceUserConfigReferences(raw, (key, matched) => {
      if (!mcpValues.has(key)) {
        unset.add(key);
      }

      return matched;
    });
  }

  return [...unset];
}

const LEADING_OPTION_REFERENCE = /^\$\{user_config\.([^}]+)\}/;

// D-PG10-11: pi-mcp-adapter 7.0.1 fills variables in `command` and in each
// `args` element and then expands a leading `~` (`resolveConfigPath`,
// `expandHomePath` in its `utils.ts`). Claude Code 2.1.323 passes an option's
// value as written, so an option at the start of such a field whose value the
// adapter would expand would run a program under the user's home that the
// plugin does not name. The value alone is read, so `~` followed by any text
// counts.
function adapterExpandsHome(value: string): boolean {
  return value === "~" || value.startsWith("~/") || value.startsWith(`~${path.sep}`);
}

function homePathOptionKeys(
  values: readonly string[],
  mcpValues: ReadonlyMap<string, string>,
): string[] {
  const homeKeys = new Set(
    [...mcpValues].filter(([, value]) => adapterExpandsHome(value)).map(([key]) => key),
  );
  const keys = new Set<string>();
  for (const raw of values) {
    const key = LEADING_OPTION_REFERENCE.exec(raw)?.[1];
    if (key !== undefined && homeKeys.has(key)) {
      keys.add(key);
    }
  }

  return [...keys];
}
