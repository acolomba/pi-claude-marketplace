// bridges/mcp/substitute.ts
//
// Pure deep-substitution + env-injection engine for MCP staging (MENV-01..03,
// D-92-01 / D-92-02). Bridge-local by design: shared/vars.ts owns the
// content-substitution signature (a different variable set) and stays untouched.
//
// Substitution (D-92-01) is whole-entry and deep: every string VALUE at any
// nesting depth is walked and the three-var set is resolved in a single pass.
// Object KEYS and non-string leaves are never touched. Injection (D-92-02)
// targets stdio-shaped entries (those with a string `command`) only.

import { safeSet } from "./safe-set.ts";

/**
 * Resolution context for one staged entry. `pluginRoot` / `pluginData` are the
 * real install paths substituted for `${CLAUDE_PLUGIN_ROOT}` /
 * `${CLAUDE_PLUGIN_DATA}`. `projectDir` carries the `CLAUDE_PROJECT_DIR` arm
 * (MENV-03): the construction site computes it ONCE as "project scope -> cwd,
 * user scope -> undefined", so a user-scope context structurally cannot carry
 * a usable project dir and the substitution and injection arms cannot drift.
 * The field is required (not optional) so every construction site states the
 * decision explicitly.
 */
export interface McpSubstitutionContext {
  readonly pluginRoot: string;
  readonly pluginData: string;
  readonly projectDir: string | undefined;
}

// Single-pass alternation over the three MCP staging vars. The function replacer
// below resolves each site exactly once against the map, so a substituted value
// that itself contains another var's token is never re-expanded (T-03-01
// cross-variable safety) and any `$`-sequence in a value is inserted literally
// (no `$n` replacement-pattern expansion). This is a genuine dynamic alternation
// with a function replacement -- not a literal-pattern `replaceAll` smell.
const VAR_RE = /\$\{(CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|CLAUDE_PROJECT_DIR)\}/g;

function substituteLeaf(value: string, map: ReadonlyMap<string, string>): string {
  return value.replace(VAR_RE, (whole, name: string) => {
    // Unknown / omitted var (e.g. user-scope ${CLAUDE_PROJECT_DIR}) passes
    // through untouched.
    return map.get(name) ?? whole;
  });
}

/**
 * Recursively substitute string leaves in `node`. Arrays and plain objects are
 * rebuilt fresh with keys copied verbatim (keys are never substituted); numbers,
 * booleans, null, and any other non-plain value pass through untouched. Returns
 * fresh nodes -- the input is never mutated.
 */
export function deepSubstitute(node: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof node === "string") {
    return substituteLeaf(node, map);
  }

  if (Array.isArray(node)) {
    return node.map((element) => deepSubstitute(element, map));
  }

  if (typeof node === "object" && node !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(node)) {
      // safeSet copies a literal `__proto__` key as an own data property so it
      // is not routed through the inherited setter and dropped, preserving the
      // keys-copied-verbatim invariant (WR-01).
      safeSet(out, key, deepSubstitute(childValue, map));
    }

    return out;
  }

  return node;
}

function buildVarMap(ctx: McpSubstitutionContext): ReadonlyMap<string, string> {
  const map = new Map<string, string>([
    ["CLAUDE_PLUGIN_ROOT", ctx.pluginRoot],
    ["CLAUDE_PLUGIN_DATA", ctx.pluginData],
  ]);
  // MENV-03: project-scope installs resolve ${CLAUDE_PROJECT_DIR} to the
  // project root (`projectDir` = cwd). User scope constructs the context with
  // `projectDir: undefined`, so the key is omitted and ${CLAUDE_PROJECT_DIR}
  // falls through the undefined branch untouched (documented absence).
  if (ctx.projectDir !== undefined) {
    map.set("CLAUDE_PROJECT_DIR", ctx.projectDir);
  }

  return map;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-substitute one entry, then inject env for stdio-shaped entries (D-92-02 --
 * entries with a string `command`). Injected defaults come first and the
 * already-substituted declared env spreads over them, so plugin-declared keys
 * win (MENV-02, Claude Code spread order). Non-stdio (url-type) entries keep
 * their declared env untouched and never gain one.
 */
export function substituteAndInject(
  entry: Record<string, unknown>,
  ctx: McpSubstitutionContext,
): Record<string, unknown> {
  const map = buildVarMap(ctx);
  const substituted = deepSubstitute(entry, map) as Record<string, unknown>;

  if (typeof substituted.command !== "string") {
    return substituted;
  }

  const injected: Record<string, string> = {
    CLAUDE_PLUGIN_ROOT: ctx.pluginRoot,
    CLAUDE_PLUGIN_DATA: ctx.pluginData,
    ...(ctx.projectDir !== undefined ? { CLAUDE_PROJECT_DIR: ctx.projectDir } : {}),
  };
  const declared = isPlainObject(substituted.env) ? substituted.env : {};

  return { ...substituted, env: { ...injected, ...declared } };
}
