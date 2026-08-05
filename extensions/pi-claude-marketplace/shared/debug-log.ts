/**
 * shared/debug-log.ts -- the sole runtime debug-output seam for extension
 * debug diagnostics (OBS-01 / D-59-05; originally the hooks dispatch path).
 *
 * `hookDebugLog(detail, tag?)` forwards `[${tag}] ${detail}` (tag defaults to
 * `hooks`) to `console.error` ONLY when
 * `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"` (exact-equal, not
 * fuzzy-truthy). Any other value -- `"0"`, `"true"`, `undefined`, an
 * empty string, whitespace-padded `" 1 "` -- is silent. Non-hook consumers
 * (the session-env / plugin-PATH seams) pass their own tag (`"env"`) so a
 * user grepping debug output finds the failure filed under the right
 * subsystem. The console.error call is the SOLE sanctioned IL-2 / IL-3
 * deviation at this seam, authorized by the per-file ESLint override block in
 * eslint.config.js that mirrors BLOCK B's authorization for shared/notify.ts.
 * No inline `eslint-disable-next-line` directives live in this file: any
 * drift of the per-file override block surfaces as a red lint at this call
 * site rather than a silently-absorbed inline disable.
 *
 * Pure leaf module: no imports, no module-level state. Consumers import the
 * named export by relative path; no re-export surface.
 */
export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${detail}`);
  }
}
