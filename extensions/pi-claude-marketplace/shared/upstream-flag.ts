// shared/upstream-flag.ts
//
// D-SG-15, D-SG-24: Claude Code reads its boolean environment variables one
// way: `1`, `true`, `yes`, or `on`, trimmed, in any case, is true, and every
// other value or an unset variable is false. This module holds that reader,
// so every such variable the extension shares with Claude Code reads the same.

/** The values Claude Code reads as true, after trimming and lower-casing. */
const TRUE_VALUES: ReadonlySet<string> = new Set(["1", "true", "yes", "on"]);

/** Whether the variable `name` in `env` is true, as Claude Code reads it. */
export function upstreamFlagIsTrue(name: string, env: NodeJS.ProcessEnv): boolean {
  return TRUE_VALUES.has((env[name] ?? "").trim().toLowerCase());
}

/**
 * D-SG-24, SG-SSH-03: the variable that makes every GitHub address use HTTPS,
 * with no ssh probe, by its name in Claude Code.
 */
const PREFER_HTTPS_VARIABLE = "CLAUDE_CODE_PLUGIN_PREFER_HTTPS";

/** D-SG-24: whether `PREFER_HTTPS_VARIABLE` is true in `env`. */
export function preferHttps(env: NodeJS.ProcessEnv): boolean {
  return upstreamFlagIsTrue(PREFER_HTTPS_VARIABLE, env);
}
