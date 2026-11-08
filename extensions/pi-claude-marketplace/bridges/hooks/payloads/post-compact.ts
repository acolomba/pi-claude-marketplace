// bridges/hooks/payloads/post-compact.ts
//
// PostCompact payload translator (PAYL-01 / D-60-04).
//
// Consumes Pi's `SessionCompactEvent` and emits the Claude `PostCompact`
// stdin envelope. Like PreCompact, Claude's `trigger` field is
// `"manual" | "auto"` (claude-hook-config-syntax.md § 3). Pi reports
// `manual`, `threshold`, or `overflow`; the latter two are Claude automatic
// compaction triggers. `compact_summary` is the summary Pi wrote into the
// compaction entry, as upstream gives it (D-CF5-04).
//
// It also works out how a PostCompact hook ended, as Claude Code 2.1.319
// reads a command hook, for the notice that lists every hook's end after
// `/compact` (D-BG-501, D-BG-503).

import { compactTrigger } from "./compact-trigger.ts";

import type { SessionCompactEvent } from "../../../platform/pi-api.ts";
import type { HookExecResult, PostCompactRun } from "../exec-result.ts";
import type { HookExitFacts } from "../on-failure.ts";
import type { TranslationContext } from "../translation-context.ts";

export interface PostCompactStdin {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostCompact";
  readonly trigger: "auto" | "manual";
  readonly compact_summary: string;
}

export function translatePostCompact(
  event: SessionCompactEvent,
  ctx: TranslationContext,
): PostCompactStdin {
  return {
    session_id: ctx.sessionId,
    transcript_path: ctx.transcriptPath,
    cwd: ctx.cwd,
    hook_event_name: "PostCompact",
    trigger: compactTrigger(event.reason),
    compact_summary: event.compactionEntry.summary,
  };
}

// Claude Code's output for a hook that its timeout stopped.
const TIMED_OUT_OUTPUT = "Hook cancelled";

// The run before an onFailure rewrite: stdout on exit 0, stderr otherwise, and
// a JSON block's reason first, as Claude Code's command-hook branch reads it.
function plainRun(facts: HookExitFacts, answer: HookExecResult): PostCompactRun {
  if (facts.timedOut) {
    return { succeeded: false, output: TIMED_OUT_OUTPUT };
  }

  if (facts.startFailed) {
    return { succeeded: false, output: facts.stderr };
  }

  const succeeded = facts.exitCode === 0;
  if (answer.kind === "block" && answer.fromStderr !== true) {
    return { succeeded, output: answer.reason ?? facts.stderr };
  }

  return { succeeded, output: succeeded ? facts.stdout : facts.stderr };
}

/**
 * D-BG-501 / D-BG-503: how a PostCompact hook ended, from the facts of its
 * process and what the wire protocol read from it. `blockedOnFailure` says
 * that the hook failed under `onFailure: "block"`: then, as Claude Code
 * 2.1.319 rewrites such a run, it failed with `failed; blocking because
 * onFailure is "block"` (`timed out; ...` after a timeout), followed by its
 * own trimmed output on the next line unless it timed out.
 */
export function postCompactRunOf(
  facts: HookExitFacts,
  answer: HookExecResult,
  blockedOnFailure: boolean,
): PostCompactRun {
  const run = plainRun(facts, answer);
  if (!blockedOnFailure) {
    return run;
  }

  const outcome = facts.timedOut ? "timed out" : "failed";
  const head = `${outcome}; blocking because onFailure is "block"`;
  const detail = facts.timedOut ? "" : run.output.trim();
  return { succeeded: false, output: detail === "" ? head : `${head}\n${detail}` };
}
