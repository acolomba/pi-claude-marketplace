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
// A dispatch has two session sides. `sessionId` and `transcriptPath` are the
// hook-facing session: in a pi-subagents child whose identity is known and
// whose launching session was resolved, they name that launching session, as
// Claude Code's base input does for a subagent, and the child goes in
// `agent_id` (D-PG6-01). `ownSessionId` is always Pi's own session id, and it
// keys every internal state: the `CLAUDE_ENV_FILE` name (D-60-06), a child's
// journal owner (D-PG3-05), and the identity guard here, so two children of
// one parent keep separate state while their hooks read one `session_id`
// (D-PG6-03). A translator takes `TranslationContext`, which has no
// `ownSessionId`.
//
// The context carries the common envelope fields, the child identity, and
// three session facts a translator may send: the active model's id and the
// session's name (D-PG6-09), and the effort level of Pi's thinking level
// (D-PG6-10). A new common field is read here once per
// dispatch, and each translator that sends it still spreads it in, so the
// translators stay pure functions of their event and this context.
//
// The module is bridge-internal and intentionally NOT re-exported
// through `bridges/hooks/index.ts` (D-01 opaque-handle discipline -- the
// dispatch contract stays internal to the hooks bridge).

import { hookEffortLevel } from "../../domain/argument-substitution.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { ChildRootSession } from "./child-root-session.ts";
import type { ChildIdentity } from "./runtime.ts";
import type { ClaudeEffort } from "../../domain/argument-substitution.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";

/** Child identity captured for one Pi session before hook translation. */
export interface ChildHookIdentity {
  readonly agentType: string;
  readonly sessionId: string;
  /** D-PG6-02: the session that launched the child, when one was resolved. */
  readonly root?: ChildRootSession;
}

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
  readonly childIdentity?: Omit<ChildHookIdentity, "root">;
  /** The bare id of Pi's active model, absent when Pi has none (D-PG6-09). */
  readonly model?: string;
  /** Pi's name of the session, absent when the session has none (D-PG6-09). */
  readonly sessionTitle?: string;
  /** The effort level of Pi's thinking level, absent outside Claude's levels (D-PG6-10). */
  readonly effort?: { readonly level: ClaudeEffort };
}

/** The translation context plus the own session id that keys internal state. */
export interface HookDispatchContext extends TranslationContext {
  /** Pi's own session id, never the launching session's (D-PG6-03). */
  readonly ownSessionId: string;
}

/**
 * The identity the factory takes from the runtime's identity of the current
 * session: a known child's agent, own session, and root, and none otherwise.
 * Both dispatch lanes call it, so they cannot differ.
 */
export function childHookIdentityOf(identity: ChildIdentity): ChildHookIdentity | undefined {
  if (identity.kind !== "known") {
    return undefined;
  }

  return {
    agentType: identity.agentType,
    sessionId: identity.childId,
    ...(identity.root === undefined ? {} : { root: identity.root }),
  };
}

// Pi's context reads the thinking level through a getter on the session
// runtime, so a read that throws gives no `effort` and the hook still runs.
function dispatchEffort(ctx: ExtensionContext): TranslationContext["effort"] {
  let thinkingLevel: string | undefined;
  try {
    thinkingLevel = ctx.thinkingLevel;
  } catch (error) {
    hookDebugLog(`translation-context: reading Pi's thinking level failed: ${errorMessage(error)}`);
    return undefined;
  }

  const level = hookEffortLevel(thinkingLevel);
  return level === undefined ? undefined : { level };
}

/**
 * Factory that snapshots the dispatch-time fields a translator needs
 * from a Pi `ExtensionContext`. Called once per `dispatchHookExec`
 * invocation before the per-event `translate(event, ctx)` call.
 *
 * D-CF5-07: a saved Pi session has a session file path from its first
 * turn, `SessionStart` included, because Pi names the file when it
 * creates the session, before the file exists on disk; Claude Code also
 * sends a path before the file exists. An in-memory session
 * (`--no-session`) has no transcript location, so
 * `ctx.sessionManager.getSessionFile()` returns `undefined` and
 * `transcriptPath` is the empty string (a Pi gap). An empty string is
 * preferred over a synthesized fake path -- a hook reading
 * `transcript_path` can check for empty and skip the file open, whereas a
 * synthesized path would invite an `ENOENT`. An empty path seen on a first
 * turn in the test harness comes from its `--no-session` launch, not from
 * the turn. `docs/hooks-compatibility.md` states this for plugin authors.
 *
 * The identity is kept only when it was captured for the own session. Only a
 * kept identity's root replaces the session fields, so a payload that names
 * the launching session always carries `agent_id`; a root with no file gives
 * an empty `transcriptPath` (D-PG6-01, D-PG6-02).
 */
export function buildTranslationContext(
  ctx: ExtensionContext,
  childIdentity?: ChildHookIdentity,
): HookDispatchContext {
  const ownSessionId = ctx.sessionManager.getSessionId();
  const kept = childIdentity?.sessionId === ownSessionId ? childIdentity : undefined;
  const model = ctx.model?.id;
  const sessionTitle = ctx.sessionManager.getSessionName();
  const effort = dispatchEffort(ctx);
  return {
    sessionId: kept?.root?.sessionId ?? ownSessionId,
    transcriptPath: kept?.root?.transcriptPath ?? ctx.sessionManager.getSessionFile() ?? "",
    cwd: ctx.cwd,
    ownSessionId,
    ...(kept === undefined
      ? {}
      : { childIdentity: { agentType: kept.agentType, sessionId: ownSessionId } }),
    ...(model ? { model } : {}),
    ...(sessionTitle ? { sessionTitle } : {}),
    ...(effort === undefined ? {} : { effort }),
  };
}
