// bridges/hooks/late-session-start.ts
//
// The SessionStart that Claude Code runs for a plugin that loads after the
// session started (HOOKLATESS-D1). Claude Code 2.1.330 runs it in its
// headless runner once, at its first command, for each plugin with a
// SessionStart hook that no earlier SessionStart of the session matched, with
// the session's start source.
//
// The ledger keeps what the session's own dispatch saw: its source, when that
// is `startup`, `resume`, or `fork`, and the plugins that held a SessionStart
// route then. A load takes it once. A `clear` dispatch records nothing,
// because Claude Code keeps the start source of its launch across `/clear`
// and runs the late hooks once.

import type { SessionStartSource } from "../../domain/components/hook-events.ts";
import type { ClaudeSessionStartEvent } from "./payloads/session-start.ts";
import type { RoutingEntry } from "./routing-state.ts";

// A plugin as Claude Code names it, the same in either scope.
function sessionStartPlugin(entry: Pick<RoutingEntry, "pluginId" | "marketplace">): string {
  return `${entry.pluginId}@${entry.marketplace}`;
}

function pluginsOf(bucket: readonly Pick<RoutingEntry, "pluginId" | "marketplace">[]): Set<string> {
  return new Set(bucket.map(sessionStartPlugin));
}

const START_SOURCES: ReadonlySet<SessionStartSource> = new Set(["startup", "resume", "fork"]);

/** The late SessionStart a load owes. */
export interface LateSessionStart {
  readonly source: SessionStartSource;
  readonly plugins: ReadonlySet<string>;
}

/** What the session's SessionStart dispatch saw, for the load after it. */
export interface LateSessionStartLedger {
  /** Records the source and the SessionStart routes of the session's own dispatch. */
  readonly recordDispatch: (
    source: SessionStartSource,
    bucket: readonly Pick<RoutingEntry, "pluginId" | "marketplace">[],
  ) => void;
  /** Takes the record once and returns the late run it owes for `bucket`, if any. */
  readonly takeLateRun: (
    bucket: readonly Pick<RoutingEntry, "pluginId" | "marketplace">[],
  ) => LateSessionStart | undefined;
}

export function createLateSessionStartLedger(): LateSessionStartLedger {
  let recorded:
    { readonly source: SessionStartSource; readonly seen: ReadonlySet<string> } | undefined =
    undefined;
  return {
    recordDispatch: (source, bucket) => {
      if (START_SOURCES.has(source)) {
        recorded = { source, seen: pluginsOf(bucket) };
      }
    },
    takeLateRun: (bucket) => {
      const taken = recorded;
      recorded = undefined;
      if (taken === undefined) {
        return undefined;
      }

      const plugins = new Set([...pluginsOf(bucket)].filter((plugin) => !taken.seen.has(plugin)));
      return plugins.size === 0 ? undefined : { source: taken.source, plugins };
    },
  };
}

/**
 * Whether a SessionStart dispatch runs the hooks of `entry`: every plugin's,
 * or only those of the plugins that a late run names (HOOKLATESS-D1).
 */
export function sessionStartRunsPlugin(
  event: ClaudeSessionStartEvent,
  entry: Pick<RoutingEntry, "pluginId" | "marketplace">,
): boolean {
  const plugins = event.newPluginsOnly;
  return plugins === undefined || plugins.has(sessionStartPlugin(entry));
}
