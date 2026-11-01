// bridges/hooks/on-failure.ts
//
// D-CF5-18 (FG-22): the `onFailure` field of a command hook. Claude Code
// 2.1.316 (probed, E6) treats four outcomes of a command hook as a failure: it
// cannot start, it exits with a code other than 0 and 2, its timeout kills
// it, or it prints stdout that starts a JSON object and does not parse. With
// `onFailure: "block"` a failure does what exit code 2 does on the event, and
// the reason is
//
//   [<command>]: failed; blocking because onFailure is "block"
//   <stderr>
//
// with `timed out` in place of `failed` after a timeout. The default,
// `"continue"`, lets the failure pass, which the wire protocol already does.
// Upstream ignores the field on Stop hooks, because a Stop block sends the
// model back to work and the model cannot repair a hook that will not run,
// and on background hooks (`async`, `asyncRewake`), whose outcome arrives
// after the event. Schema validation of JSON that does parse stays
// permissive: that failure kind is a recorded divergence (D-CF5-18).

import { hookDebugLog } from "../../shared/debug-log.ts";

import type { HookExecResult } from "./exec-result.ts";
import type { RoutingEntry } from "./routing-state.ts";

/** How a hook process ended, as the dispatch lane observed it. */
export interface HookExitFacts {
  /** The process never started (a spawn `error`). */
  readonly startFailed: boolean;
  /** The timeout ladder signalled the process at its deadline. */
  readonly timedOut: boolean;
  /** The exit code, or `null` when a signal ended the process or it never started. */
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

// Stdout that starts a JSON object and does not parse. Plain text is not a
// failure, so only a leading `{` makes the hook's stdout a JSON answer.
function isBrokenJson(stdout: string): boolean {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return false;
  } catch {
    return true;
  }
}

function isFailure(facts: HookExitFacts): boolean {
  if (facts.startFailed || facts.timedOut) {
    return true;
  }

  if (facts.exitCode !== 0) {
    return facts.exitCode !== 2;
  }

  return isBrokenJson(facts.stdout);
}

// Why upstream ignores `onFailure` on this entry, or `undefined` when it applies.
function ignoredLane(entry: RoutingEntry): string | undefined {
  if (entry.claudeEvent === "Stop") {
    return "Stop";
  }

  const { async: background, asyncRewake } = entry.handlerDecl;
  return background === true || asyncRewake === true ? "an async hook" : undefined;
}

/**
 * The block a failed hook with `onFailure: "block"` turns into (D-CF5-18), or
 * `undefined` when the hook did not fail, sets no such `onFailure`, or runs
 * where upstream ignores the field. The command in the reason is the declared
 * `command` text, placeholders included, and the reason ends with the trimmed
 * stderr when the hook printed any.
 */
export function onFailureBlock(
  entry: RoutingEntry,
  facts: HookExitFacts,
): HookExecResult | undefined {
  if (entry.handlerDecl.onFailure !== "block") {
    return undefined;
  }

  const ignored = ignoredLane(entry);
  if (ignored !== undefined) {
    hookDebugLog(
      `on-failure: onFailure "block" ignored on ${ignored} (${entry.pluginId}/${entry.claudeEvent})`,
    );
    return undefined;
  }

  if (!isFailure(facts)) {
    return undefined;
  }

  const outcome = facts.timedOut ? "timed out" : "failed";
  const head = `[${entry.handlerDecl.command ?? ""}]: ${outcome}; blocking because onFailure is "block"`;
  const stderr = facts.stderr.trim();
  return { kind: "block", reason: stderr === "" ? head : `${head}\n${stderr}` };
}
