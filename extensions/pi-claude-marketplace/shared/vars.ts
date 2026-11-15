// shared/vars.ts
//
// Pure substitution helper for the ${CLAUDE_*} path variables. Consumed by
// skills, commands, and agents bridges (PI-10). D-08 locks the helper to
// shared/ so the three bridges share one implementation.
//
// PI-10 vs D-08 resolution: D-08's "agents do NOT need substitution" wording
// reflects the absence of a per-AG-* requirement, but PI-10 mandates body-
// level substitution across all three component types (skills, commands,
// agents). This module exposes a single pure function; whether agents call
// it is the agents-bridge concern, but the primitive is uniform.

/**
 * Substitution context. `pluginRoot` is the absolute path the plugin was
 * installed from (i.e. `<sourcesDir>/<mp>/plugins/<plugin>/`); `pluginData`
 * is the per-plugin data directory (`<dataRoot>/<mp>/<plugin>/`). Both are
 * resolved by the install orchestrator and are always present.
 *
 * `skillDir` (SUB-01) is the skill's installed directory; it is skill-scoped,
 * so only the skills bridge supplies it and only for skill content. `projectDir`
 * (SUB-02) is the install cwd (the project root); it is supplied only for
 * project-scope installs. Both are optional: an absent value leaves its token
 * literal in the output, never an empty string (SUB-01/SUB-02 pass-through
 * contract).
 */
export interface ClaudePluginVars {
  readonly pluginRoot: string;
  readonly pluginData: string;
  readonly skillDir?: string | undefined;
  readonly projectDir?: string | undefined;
}

// Maps each substitutable token name to the field on `ClaudePluginVars` that
// supplies its value. The alternation below is built from these keys (each
// regex-escaped), so a token added here is substitutable without touching the
// pattern -- even one that carried a regex metacharacter.
const TOKEN_TO_FIELD = {
  CLAUDE_PLUGIN_ROOT: "pluginRoot",
  CLAUDE_PLUGIN_DATA: "pluginData",
  CLAUDE_SKILL_DIR: "skillDir",
  CLAUDE_PROJECT_DIR: "projectDir",
} as const satisfies Record<string, keyof ClaudePluginVars>;

type PathToken = keyof typeof TOKEN_TO_FIELD;

const PATH_TOKEN_ALTERNATION = Object.keys(TOKEN_TO_FIELD)
  .map((key) => key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
  .join("|");

const CLAUDE_VAR_PATTERN = new RegExp(String.raw`\$\{(${PATH_TOKEN_ALTERNATION})\}`, "g");

// The option reference `user_config\.([^}]+)` is Claude Code 2.1.323's pattern.
const CLAUDE_CONTENT_PATTERN = new RegExp(
  String.raw`\$\{(?:(${PATH_TOKEN_ALTERNATION})|user_config\.([^}]+))\}`,
  "g",
);

/**
 * The option data a content pass reads (D-PG10-13). `ResolvedOptions` of
 * `domain/user-config.ts` has this shape; `shared/` cannot import `domain/`.
 */
export interface ClaudeContentOptions {
  readonly values: ReadonlyMap<string, string>;
  readonly sensitive: ReadonlySet<string>;
}

/**
 * Replace every literal `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`,
 * `${CLAUDE_SKILL_DIR}` (SUB-01) and `${CLAUDE_PROJECT_DIR}` (SUB-02) in
 * `content` with its value from `vars`. Pure string operation -- no eval, no
 * template engine.
 *
 * Single-pass alternation replace. The scanner walks `content` left-to-right
 * exactly once; a value spliced in by the replacer is never re-scanned. This
 * structurally guarantees three properties in one construct:
 *   - T-03-01 (no re-expansion): a value that itself embeds a `${CLAUDE_*}`
 *     literal survives verbatim -- the single pass cannot fold it again.
 *   - absent field -> literal pass-through: when the mapped value is
 *     `undefined` the replacer returns the matched literal unchanged, so an
 *     omitted `skillDir`/`projectDir` never collapses to an empty string.
 *   - unknown `${...}` -> untouched: tokens outside the alternation never
 *     match, so they are left exactly as authored.
 */
export function substituteClaudeVars(content: string, vars: ClaudePluginVars): string {
  return content.replaceAll(CLAUDE_VAR_PATTERN, (matched, name: PathToken) =>
    pathValue(vars, name, matched),
  );
}

function pathValue(vars: ClaudePluginVars, name: PathToken, matched: string): string {
  return vars[TOKEN_TO_FIELD[name]] ?? matched;
}

// Claude Code 2.1.323 checks the sensitive set before it looks up a value
// (D-PG10-09) and keeps a reference with no value as written (D-PG10-08).
function optionText(options: ClaudeContentOptions, key: string, matched: string): string {
  if (options.sensitive.has(key)) {
    return `[sensitive option '${key}' not available in skill content]`;
  }

  return options.values.get(key) ?? matched;
}

/**
 * `substituteClaudeVars` for skill, command, and agent content, which also
 * fills each `${user_config.KEY}` when the content is staged (D-PG10-13). The
 * option reference joins the same alternation, so the three properties of
 * `substituteClaudeVars` hold for both kinds of reference: a spliced value is never
 * scanned again. `options` is `undefined` for a plugin that declares no
 * `userConfig`, and then every option reference stays as written (D-PG10-21).
 */
export function substituteClaudeContent(
  content: string,
  vars: ClaudePluginVars,
  options: ClaudeContentOptions | undefined,
): string {
  if (options === undefined) {
    return substituteClaudeVars(content, vars);
  }

  return content.replaceAll(
    CLAUDE_CONTENT_PATTERN,
    (matched, name: PathToken | undefined, key: string) =>
      name === undefined ? optionText(options, key, matched) : pathValue(vars, name, matched),
  );
}
