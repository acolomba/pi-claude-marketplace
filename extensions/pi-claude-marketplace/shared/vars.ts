// shared/vars.ts
//
// Pure substitution helper for ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA}.
// Consumed by skills, commands, and agents bridges (PI-10 + V1 behavior).
// D-08 locks the helper to shared/ so the three bridges share one
// implementation.
//
// PI-10 vs D-08 resolution: D-08's "agents do NOT need substitution" wording
// reflects the absence of a per-AG-* requirement, but PI-10 mandates body-
// level substitution across all three component types (skills, commands,
// agents). This module exposes a single pure function; whether agents call
// it is the agents-bridge plan's concern, but the primitive is uniform.
//
// Phase 3 emits substituted strings only; the <dataRoot>/<mp>/<plugin>/
// directory creation is Phase 5's install orchestrator concern.

/**
 * Substitution context. `pluginRoot` is the absolute path the plugin was
 * installed from (i.e. `<sourcesDir>/<mp>/plugins/<plugin>/`); `pluginData`
 * is the per-plugin data directory (`<dataRoot>/<mp>/<plugin>/`). Both are
 * resolved by the install orchestrator.
 */
export interface ClaudePluginVars {
  readonly pluginRoot: string;
  readonly pluginData: string;
}

/**
 * Replace every literal occurrence of `${CLAUDE_PLUGIN_ROOT}` and
 * `${CLAUDE_PLUGIN_DATA}` in `content` with the corresponding value from
 * `vars`. Pure string operation -- no recursion, no eval, no template
 * engine. T-03-01 mitigation: a value containing one of the placeholder
 * literals is NOT re-expanded, because both `replaceAll` calls run once
 * and never operate on the partial result of the other.
 */
export function substituteClaudeVars(content: string, vars: ClaudePluginVars): string {
  return content
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", vars.pluginRoot)
    .replaceAll("${CLAUDE_PLUGIN_DATA}", vars.pluginData);
}
