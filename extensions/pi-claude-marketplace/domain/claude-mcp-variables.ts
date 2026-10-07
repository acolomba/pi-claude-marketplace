// domain/claude-mcp-variables.ts
//
// Claude Code 2.1.291's variable rule for one plugin MCP field value
// (AVAR-01, AVAR-02). Claude first replaces the builtins `${CLAUDE_PLUGIN_ROOT}`,
// `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_PLUGIN_DATA}`, in that order, each pass
// reading the previous pass's output. It then expands every `${NAME}` and
// `${NAME:-default}` in the result in one scan. This module returns that scan
// as segments: literal text, and references kept for pi-mcp-adapter to expand
// when it connects. A reference carries only a variable's name, so no
// environment value leaves this module. The caller supplies the environment.

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
 * The segments of one value and the unset variables it references with no
 * default, in first-seen order. A name used twice appears twice.
 */
export interface ExpandedValue {
  readonly segments: readonly Segment[];
  readonly missing: readonly string[];
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

// An own string property only, so `${constructor}` reads as unset.
function isSet(env: ClaudeEnv, name: string): boolean {
  return Object.hasOwn(env, name) && typeof env[name] === "string";
}

function segmentFor(
  inner: string,
  env: ClaudeEnv,
  builtins: ClaudeBuiltins,
  missing: string[],
): Segment {
  const separator = inner.indexOf(DEFAULT_SEPARATOR);
  const name = separator === -1 ? inner : inner.slice(0, separator);
  const ref: Segment = { kind: "ref", name };
  if (separator === -1 && name === "CLAUDE_PROJECT_DIR" && builtins.projectDir === undefined) {
    return ref;
  }

  if (isSet(env, name)) {
    return ref;
  }

  if (separator !== -1) {
    return { kind: "text", text: inner.slice(separator + DEFAULT_SEPARATOR.length) };
  }

  missing.push(name);
  return ref;
}

/**
 * Expands one field value by Claude's rule. A set variable, the empty string
 * included, stays a reference. An unset variable with a `:-` default becomes
 * the default text, which is never scanned again. An unset variable with no
 * default stays a reference and is reported missing. At user scope
 * `${CLAUDE_PROJECT_DIR}` stays a reference and is never reported missing.
 */
export function expandClaudeValue(
  raw: string,
  env: ClaudeEnv,
  builtins: ClaudeBuiltins,
): ExpandedValue {
  const expanded = replaceBuiltins(raw, builtins);
  const segments: Segment[] = [];
  const missing: string[] = [];
  let textStart = 0;
  for (const match of expanded.matchAll(CLAUDE_VARIABLE)) {
    if (match.index > textStart) {
      segments.push({ kind: "text", text: expanded.slice(textStart, match.index) });
    }

    segments.push(segmentFor(match[0].slice(2, -1), env, builtins, missing));
    textStart = match.index + match[0].length;
  }

  if (textStart < expanded.length) {
    segments.push({ kind: "text", text: expanded.slice(textStart) });
  }

  return { segments, missing };
}
