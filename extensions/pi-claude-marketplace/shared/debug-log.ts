/**
 * shared/debug-log.ts -- the sole runtime debug-output seam for extension
 * debug diagnostics (OBS-01 / D-59-05; originally the hooks dispatch path).
 *
 * `hookDebugLog(detail, tag?)` forwards `[${tag}] ${detail}` (tag defaults to
 * `hooks`), with `detail` through the one redaction pass, to `console.error`
 * ONLY when
 * `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"` (exact-equal, not
 * fuzzy-truthy). Any other value -- `"0"`, `"true"`, `undefined`, an
 * empty string, whitespace-padded `" 1 "` -- is silent. Non-hook consumers
 * (the session-env / plugin-PATH seams) pass their own tag (`"env"`) so a
 * user grepping debug output finds the failure filed under the right
 * subsystem. The console.error call is the SOLE sanctioned IL-2 / IL-3
 * deviation at this seam. The fallow rule pack (rule-packs/architecture.json)
 * authorizes it: `architecture/no-console` leaves this file out, and
 * `architecture/debug-log-console-error-only` bans every other console method
 * here. No inline suppression lives in this file, so a drift in either rule
 * fails `npm run fallow`.
 *
 * D-SG-35: every line goes through `redactShownText`, so no debug line from
 * any call site shows a credential or an absolute path. The pass runs only
 * while the gate is open, so a closed gate costs nothing. It runs on each line
 * of `detail` alone, as it does for a shown stderr.
 *
 * The module imports only that pass and holds no module-level state. No cycle
 * forms: shared/redact-absolute-paths.ts and the modules it imports
 * (shared/errors.ts, shared/redact-credentials.ts) never import this module.
 * Consumers import the named export by relative path; no re-export surface.
 */
import { redactShownText } from "./redact-absolute-paths.ts";

export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${redactShownText(detail)}`);
  }
}
