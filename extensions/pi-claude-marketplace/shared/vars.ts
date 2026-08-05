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

const CLAUDE_VAR_PATTERN = new RegExp(
  String.raw`\$\{(${Object.keys(TOKEN_TO_FIELD)
    .map((key) => key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
    .join("|")})\}`,
  "g",
);

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
  return content.replaceAll(CLAUDE_VAR_PATTERN, (matched, name: keyof typeof TOKEN_TO_FIELD) => {
    const value = vars[TOKEN_TO_FIELD[name]];
    return value ?? matched;
  });
}
