// bridges/hooks/timeout.ts
//
// The hook-handler `timeout` field, in SECONDS.
//
// Claude Code's hooks reference declares `timeout` in seconds, and documents
// the per-event defaults below (https://code.claude.com/docs/en/hooks, Common
// fields). EXEC-02 owns the ladder semantics this feeds -- SIGTERM, 5 s grace,
// SIGKILL -- but predates the per-event table and describes a single
// bridge-wide default, so the unit and the table are cited to upstream rather
// than to it.
//
// The bridge speaks seconds everywhere above `./exec-timer.ts`, which owns the
// single conversion to the milliseconds `setTimeout` demands. Reading the field
// as milliseconds is what made a handler's `timeout: 2` fire SIGTERM at 2 ms;
// every declared timeout was 1000x shorter than written.
//
// HOOK_HANDLER_SCHEMA admits `timeout` at any type, the same lenient stance it
// takes with the asyncRewake family, so this module is the sole narrowing
// point. One exported function resolves the field, its lane, and its per-event
// default together: both exec lanes call it, so neither can pair a value with
// the wrong default.
//
// Lives beside its two consumers rather than in `shared/` because the default
// table keys on `BucketAEvent`, and `.fallowrc.json` allows the `shared` zone
// to import `platform` only.

import { hookDebugLog } from "../../shared/debug-log.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";

/**
 * Claude Code's default for a `command` handler. It documents the same 600 s
 * for `http` and `mcp_tool` handlers, and 30 s / 60 s for `prompt` / `agent`;
 * the bridge supports none of those handler types -- `partitionGroupHandlers`
 * drops every non-`command` handler at parse time -- so no other default has
 * anything to attach to.
 */
const COMMAND_DEFAULT_SECONDS = 600;

/**
 * Claude Code's SessionEnd budget, in seconds. A plugin hook's own `timeout`
 * does not raise it (D-BG-604).
 */
const SESSION_END_BUDGET_SECONDS = 1.5;

/**
 * The per-event defaults Claude Code applies to a TURN-BLOCKING handler.
 *
 * Total rather than `Partial` on purpose: a new `BucketAEvent` is a compile
 * error at this literal, which forces a decision about its budget instead of
 * silently inheriting 600 s. `undefined` reads as "upstream does not lower this
 * one". The same argument is made for `NON_TOOL_EVENT_FIELDS` in
 * `domain/components/hook-events.ts`.
 *
 * `UserPromptSubmit` is an exact match for upstream's 30 s. `SessionEnd` takes
 * upstream's 1.5 s budget, and a declared turn-blocking value above it is
 * capped at it, because a plugin hook's `timeout` does not raise Claude Code's
 * budget (D-BG-604). The matching hooks of one event start together
 * (D-CF5-09), so they share the 1.5 s. Two upstream mechanisms are not built
 * (D-BG-605): the user's override variable is not read, and no bounded wait
 * ends the session early, so a hook that ignores SIGTERM still holds it for
 * the ladder's 5 s kill grace.
 *
 * Upstream additionally lowers `MessageDisplay` to 10 s; Pi exposes no
 * render-time hook on assistant messages, so that event is not bridged and has
 * no entry here.
 */
const BLOCKING_EVENT_DEFAULT_SECONDS: Record<BucketAEvent, number | undefined> = {
  SessionStart: undefined,
  UserPromptSubmit: 30,
  PreToolUse: undefined,
  PostToolUse: undefined,
  PostToolUseFailure: undefined,
  PreCompact: undefined,
  PostCompact: undefined,
  SessionEnd: SESSION_END_BUDGET_SECONDS,
  Stop: undefined,
  StopFailure: undefined,
};

/**
 * A declared turn-blocking SessionEnd value above the budget, capped at it
 * with a debug line (D-BG-604); any other value as declared.
 */
function capSessionEndTimeout(
  seconds: number,
  event: BucketAEvent,
  pluginId: string,
  lane: "blocking" | "background",
): number {
  if (lane !== "blocking" || event !== "SessionEnd" || seconds <= SESSION_END_BUDGET_SECONDS) {
    return seconds;
  }

  hookDebugLog(
    `resolveTimeoutSeconds: timeout ${seconds} on ${pluginId}/${event} (${lane}) ` +
      `exceeds the ${SESSION_END_BUDGET_SECONDS}s SessionEnd budget; using the budget`,
  );
  return SESSION_END_BUDGET_SECONDS;
}

/**
 * Resolve a hook handler's timeout, in SECONDS.
 *
 * A positive, finite `raw` is the handler's own declared value. Anything else
 * -- absent, non-number, zero, negative, non-finite -- yields the default for
 * the lane and event, so malformed config degrades rather than breaking
 * dispatch.
 *
 * `lane` decides which default applies, and it matters. Upstream lowers the
 * budget on `UserPromptSubmit` and `SessionEnd` because the handler holds up
 * the turn; a `background` handler (an `async` or `asyncRewake` hook, which
 * Claude Code 2.1.319 also runs in the background) is registered and left to
 * run while dispatch returns immediately, so those budgets have no rationale
 * there and would silently truncate long-running background work, and
 * `background` keeps the 600 s `command` default on every event.
 *
 * A value that was DECLARED but cannot be used emits a `hookDebugLog` line
 * naming it. Absence is not a degrade and stays quiet -- most handlers declare
 * no timeout at all. Note this fires per dispatch, not per config load, so a
 * handler with a bad value repeats the line on every dispatch it survives;
 * that is the site holding the plugin, event, and lane needed to attribute it.
 *
 * The general upper bound lives with the timer, not here:
 * `installTimerLadder` clamps to what `setTimeout` can represent, which is a
 * property of the timer API rather than of the config field. The SessionEnd
 * ceiling is different: it is upstream's budget, so it is applied here.
 */
export function resolveTimeoutSeconds(opts: {
  readonly raw: unknown;
  readonly event: BucketAEvent;
  readonly pluginId: string;
  readonly lane: "blocking" | "background";
}): number {
  const { raw, event, pluginId, lane } = opts;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return capSessionEndTimeout(raw, event, pluginId, lane);
  }

  const fallback =
    lane === "blocking"
      ? (BLOCKING_EVENT_DEFAULT_SECONDS[event] ?? COMMAND_DEFAULT_SECONDS)
      : COMMAND_DEFAULT_SECONDS;

  if (raw !== undefined) {
    hookDebugLog(
      `resolveTimeoutSeconds: unusable timeout ${JSON.stringify(raw)} on ` +
        `${pluginId}/${event} (${lane}); using the ${fallback}s default`,
    );
  }

  return fallback;
}
