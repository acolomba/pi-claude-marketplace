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
 * The per-event defaults Claude Code applies to a TURN-BLOCKING handler.
 *
 * Total rather than `Partial` on purpose: a new `BucketAEvent` is a compile
 * error at this literal, which forces a decision about its budget instead of
 * silently inheriting 600 s. `undefined` reads as "upstream does not lower this
 * one". The same argument is made for `NON_TOOL_EVENT_FIELDS` in
 * `domain/components/hook-events.ts`.
 *
 * `UserPromptSubmit` is an exact match for upstream's 30 s. `SessionEnd` takes
 * upstream's 1.5 s figure, and approximates it twice over -- upstream shares
 * that budget across every SessionEnd hook, and caps a longer declared
 * `timeout` at 60 s, while the bridge applies it per hook and applies no
 * upstream-style ceiling of its own (`installTimerLadder` still clamps to what
 * a timer can represent). Exact when a session declares one such hook; far closer than
 * 600 s when it declares several. Both deviations are recorded as HKTO-01.
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
  SessionEnd: 1.5,
  Stop: undefined,
  StopFailure: undefined,
};

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
 * the turn; a `background` handler (`asyncRewake`) is registered and left to
 * run while dispatch returns immediately, so those budgets have no rationale
 * there and would silently truncate long-running background work. `asyncRewake`
 * is a bridge-local extension with no upstream analog, so `background` keeps
 * the 600 s `command` default on every event.
 *
 * A value that was DECLARED but cannot be used emits a `hookDebugLog` line
 * naming it. Absence is not a degrade and stays quiet -- most handlers declare
 * no timeout at all. Note this fires per dispatch, not per config load, so a
 * handler with a bad value repeats the line on every dispatch it survives;
 * that is the site holding the plugin, event, and lane needed to attribute it.
 *
 * The upper bound deliberately lives with the timer, not here:
 * `installTimerLadder` clamps to what `setTimeout` can represent, which is a
 * property of the timer API rather than of the config field.
 */
export function resolveTimeoutSeconds(opts: {
  readonly raw: unknown;
  readonly event: BucketAEvent;
  readonly pluginId: string;
  readonly lane: "blocking" | "background";
}): number {
  const { raw, event, pluginId, lane } = opts;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
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
