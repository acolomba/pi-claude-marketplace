// domain/claude-mcp-variables.ts
//
// Claude Code 2.1.291's variable rule for one plugin MCP field value
// (AVAR-01, AVAR-02, AVAR-05). Claude first replaces the builtins
// `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_PLUGIN_DATA}`,
// in that order, each pass reading the previous pass's output. It then expands
// every `${NAME}` and `${NAME:-default}` in the result in one scan. This module
// returns that scan as segments: literal text, and references kept for
// pi-mcp-adapter to expand when it connects. A reference carries only a
// variable's name, so no environment value leaves this module. The caller
// supplies the environment.
//
// AVAR-05: Claude withholds deny-listed variables
// (`domain/claude-credential-denylist.ts`). The decision is made here, at
// install, and never left for the adapter, so a variable set later cannot
// reach the server. A remote field (`url`, `headers`) writes `""` for a
// remote-sink name whether or not it is set. A plain field (`command`, `args`,
// `env`) writes `""` for a plain name that is set; when it is unset, the field
// gets the `:-` default, or the literal `${NAME}` text and a missing report.

import {
  CREDENTIAL_BASE_URL_NAMES,
  matchesPlainNamePattern,
  matchesRemoteSinkNamePattern,
  PLAIN_DENIED_NAMES,
  REMOTE_SINK_DENIED_NAMES,
  valueCarriesCredential,
} from "./claude-credential-denylist.ts";

/** The environment Claude's rule reads at install time. */
export type ClaudeEnv = Readonly<Record<string, string | undefined>>;

/**
 * One piece of an expanded value: literal text, or a `${NAME}` reference kept
 * for the adapter's runtime expansion.
 */
export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "ref"; readonly name: string };

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
  if (isDenied(state.fieldClass, name.toUpperCase(), value)) {
    return deniedSegment(name, defaultText, value, state);
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
 * Expands one field value by Claude's rule. A set variable, the empty string
 * included, stays a reference. An unset variable with a `:-` default becomes
 * the default text, which is never scanned again. An unset variable with no
 * default stays a reference and is reported missing. At user scope
 * `${CLAUDE_PROJECT_DIR}` stays a reference and is never reported missing. A
 * deny-listed reference follows Claude's deny arm for `fieldClass` (AVAR-05)
 * and is listed in `withheld` whenever it is written as `""`.
 */
export function expandClaudeValue(
  raw: string,
  fieldClass: FieldClass,
  env: ClaudeEnv,
  builtins: ClaudeBuiltins,
): ExpandedValue {
  const expanded = replaceBuiltins(raw, builtins);
  const segments: Segment[] = [];
  const state: ScanState = { fieldClass, env, builtins, missing: [], withheld: [] };
  let textStart = 0;
  for (const match of expanded.matchAll(CLAUDE_VARIABLE)) {
    if (match.index > textStart) {
      segments.push({ kind: "text", text: expanded.slice(textStart, match.index) });
    }

    segments.push(segmentFor(match[0].slice(2, -1), state));
    textStart = match.index + match[0].length;
  }

  if (textStart < expanded.length) {
    segments.push({ kind: "text", text: expanded.slice(textStart) });
  }

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

/** The string values of one server's expanded fields and their deny-list. */
interface ScannedFields {
  readonly fieldClass: FieldClass;
  readonly values: readonly string[];
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
    const args = Array.isArray(server.args) ? stringsOf(server.args) : [];
    return {
      fieldClass: "plain",
      values: [
        ...stringsOf([server.command]),
        ...args,
        ...recordStrings(server.env, LITERAL_ENV_KEYS),
      ],
    };
  }

  if (typeof type === "string" && REMOTE_TYPES.has(type)) {
    return {
      fieldClass: "remote",
      values: [...stringsOf([server.url]), ...recordStrings(server.headers, NO_KEYS)],
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
    const expanded = expandClaudeValue(raw, fields.fieldClass, env, SCAN_BUILTINS);
    for (const name of expanded.missing) {
      unset.add(name);
    }

    for (const { name } of expanded.withheld) {
      withheld.add(name);
    }
  }

  return { unset: [...unset], withheld: [...withheld] };
}
