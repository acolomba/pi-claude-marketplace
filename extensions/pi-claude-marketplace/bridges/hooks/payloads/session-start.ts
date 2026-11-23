// bridges/hooks/payloads/session-start.ts
//
// SessionStart payload translator (PAYL-01) and the bridge's one SessionStart
// mapping site (D-CF5-01, D-CF1-10..12).
//
// The router maps Pi's `SessionStartEvent.reason` to Claude Code's `source`
// once, with `claudeSessionStartSource`, and dispatches the Claude-side event
// it builds. Dispatch compares each matcher with that `source` and this
// translator writes it to stdin, so a hook receives the value its matcher
// was compared with. Pi `new` is `clear`, as upstream `/clear`; the
// in-session `resume` and `fork` keep their name. Pi reports `startup` for
// every launch, so the launch facts of the session Pi opened decide it: a
// fork made by this launch is `fork`, a session that holds messages is
// `resume`, and any other is `startup` (D-PG6-14, D-PG6-15). Pi `reload` runs
// no SessionStart (D-CF5-03), so it is not an input here. The compaction
// handler sends `compact` itself (D-CF5-04), with the hint
// `nextCallReadsSteer` that says, when the hooks finish, whether the running
// agent's next model call reads a steer (HKRL-03).
// The active model's id and the session's name follow `source`, each left
// out when Pi has none, as Claude Code marks both optional (D-PG6-09).

import type { SessionStartSource } from "../../../domain/components/hook-events.ts";
import type { SessionStartEvent } from "../../../platform/pi-api.ts";
import type { TranslationContext } from "../translation-context.ts";

/** The SessionStart event in Claude Code's terms, which dispatch filters on. */
export interface ClaudeSessionStartEvent {
  readonly source: SessionStartSource;
  /**
   * HKRL-03: set by the compaction leg. Called when the hooks finish, it says
   * whether the running agent's next model call reads a steer sent then, so
   * the context is steered into that call. Dispatch never matches on it, and
   * `translateSessionStart` never writes it to stdin.
   */
  readonly nextCallReadsSteer?: () => boolean;
  /**
   * HOOKLATESS-D1: set by the late run of a load. The plugins, as
   * `<plugin>@<marketplace>`, whose hooks the dispatch runs, as Claude Code's
   * `newPluginsOnly`. Dispatch selects on it, and `translateSessionStart`
   * never writes it to stdin.
   */
  readonly newPluginsOnly?: ReadonlySet<string>;
  /**
   * HOOKLATESS-D1: set by the late run of a load. Called when the hooks end,
   * it says whether Pi already went on to the first prompt after the
   * 10-second wait, so the context waits for the next prompt, as Claude Code
   * holds a late hook's rows until the next turn's input. Dispatch never
   * matches on it, and `translateSessionStart` never writes it to stdin.
   */
  readonly heldForNextPrompt?: () => boolean;
}

/** The JSON a SessionStart hook reads on stdin. */
export interface SessionStartStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionStart";
  readonly source: SessionStartSource;
  readonly model?: string;
  readonly session_title?: string;
}

/** What the session that Pi opened at `startup` shows about its launch (D-PG6-14, D-PG6-15). */
export interface SessionLaunchFacts {
  /** The session holds a `message` entry, so the launch continued a saved session. */
  readonly holdsMessages: boolean;
  /** The header names a parent session and is not older than this Pi process. */
  readonly forkedByThisLaunch: boolean;
}

// A fork holds the messages it copied, so the fork test comes first.
function launchSource(launch: SessionLaunchFacts): SessionStartSource {
  if (launch.forkedByThisLaunch) {
    return "fork";
  }

  return launch.holdsMessages ? "resume" : "startup";
}

/**
 * Maps a Pi session start reason other than `reload` to Claude's `source`
 * (D-CF5-01). Only `startup` reads `launch` (D-PG6-14, D-PG6-15).
 */
export function claudeSessionStartSource(
  reason: Exclude<SessionStartEvent["reason"], "reload">,
  launch: SessionLaunchFacts,
): SessionStartSource {
  switch (reason) {
    case "startup":
      return launchSource(launch);
    case "new":
      return "clear";
    case "resume":
      return "resume";
    case "fork":
      return "fork";
  }
}

/** Builds the SessionStart stdin payload from the Claude-side event. */
export function translateSessionStart(
  event: ClaudeSessionStartEvent,
  ctx: TranslationContext,
): SessionStartStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "SessionStart",
    source: event.source,
    ...(ctx.model === undefined ? {} : { model: ctx.model }),
    ...(ctx.sessionTitle === undefined ? {} : { session_title: ctx.sessionTitle }),
  };
}
