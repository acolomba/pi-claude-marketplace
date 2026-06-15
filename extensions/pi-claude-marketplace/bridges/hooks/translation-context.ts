// bridges/hooks/translation-context.ts
//
// Bridge-internal translation context: the subset of dispatch-time
// runtime state every per-event payload translator needs to populate
// the common Claude-stdin envelope (`session_id`, `transcript_path`,
// `cwd`). Each translator at `bridges/hooks/payloads/<event>.ts`
// accepts a `(event, ctx: TranslationContext)` pair and reads these
// three fields verbatim; the remaining per-event fields come from the
// Pi event payload itself.
//
// D-60-06: the per-session `CLAUDE_ENV_FILE` path (set in the env-var
// preparation step downstream) is keyed by the same `sessionId` exposed
// here, so the env-var layer and the translator layer agree on a single
// source of truth (`ctx.sessionManager.getSessionId()`).
//
// PAYL-01: the field surface is deliberately minimal -- adding more
// runtime context (e.g. `permission_mode`, `effort`) is a v1.14+ scope
// expansion and would require extending every translator's envelope in
// lockstep.
//
// The module is bridge-internal and intentionally NOT re-exported
// through `bridges/hooks/index.ts` (D-01 opaque-handle discipline -- the
// dispatch contract stays internal to the hooks bridge).

import type { ExtensionContext } from "../../platform/pi-api.ts";

/**
 * Dispatch-time context every payload translator reads to populate the
 * common Claude-stdin envelope. Fields are readonly because the
 * translator chain must not mutate the source of truth -- mutations to
 * the Pi event payload happen on `event.input` / `event.output`, never
 * here.
 */
export interface TranslationContext {
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly cwd: string;
}

/**
 * Factory that snapshots the dispatch-time fields a translator needs
 * from a Pi `ExtensionContext`. Called once per `dispatchHookExec`
 * invocation before the per-event `translate(event, ctx)` call.
 *
 * `transcriptPath` falls back to the empty string when
 * `ctx.sessionManager.getSessionFile()` returns `undefined` (Pi creates
 * the session file lazily; the first `SessionStart` with `reason:
 * "startup"` may fire before any session file exists). An empty string
 * is preferred over a synthesized fake path -- a hook reading
 * `transcript_path` can defensively check for empty and skip the file
 * open, whereas a synthesized path would invite an `ENOENT`. The
 * trade-off is documented for plugin authors in the SURF-06 docs.
 */
export function buildTranslationContext(ctx: ExtensionContext): TranslationContext {
  return {
    sessionId: ctx.sessionManager.getSessionId(),
    transcriptPath: ctx.sessionManager.getSessionFile() ?? "",
    cwd: ctx.cwd,
  };
}
