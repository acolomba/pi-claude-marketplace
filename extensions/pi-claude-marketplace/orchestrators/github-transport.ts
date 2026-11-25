// orchestrators/github-transport.ts
//
// SG-SSH-02: runs a GitHub clone over the transports its plan
// (`domain/github-transport.ts`) orders, and keeps the D-SG-22 note of each
// clone for the row that reports it. The module names no git surface: the
// caller passes the attempt, so it stays outside NETWORK_SEAMS (NFR-5).

import { hookDebugLog } from "../shared/debug-log.ts";
import { gitHubOverrideHost } from "../shared/github-base-url.ts";
import { preferHttps } from "../shared/upstream-flag.ts";

import type {
  TransportAttempt,
  TransportForce,
  TransportPlan,
} from "../domain/github-transport.ts";
import type { GitHubTransportsFailedError } from "../shared/errors.ts";
import type { CloneNoteKind, CloneTransportNote } from "../shared/notification-types.ts";

/**
 * D-SG-22: the clone notes of one command, keyed by the subject of the row
 * that reports each clone, such as the source a marketplace add was given.
 */
export interface GitHubCloneNotes {
  /** Keeps `note` for `subject`, in place of any note it had. */
  readonly record: (subject: string, note: CloneTransportNote) => void;
  /** The note kept for `subject`, or undefined when its clone made no choice. */
  readonly noteFor: (subject: string) => CloneTransportNote | undefined;
}

/** A new, empty collector of clone notes. */
export function createGitHubCloneNotes(): GitHubCloneNotes {
  const notes = new Map<string, CloneTransportNote>();
  return {
    record: (subject, note) => {
      notes.set(subject, note);
    },
    noteFor: (subject) => notes.get(subject),
  };
}

/**
 * D-SG-24, D-SG-21, OQ-2: what forces every GitHub clone of this command onto
 * one HTTPS attempt, or undefined when nothing does. Claude Code's
 * `PREFER_HTTPS_VARIABLE` in `env` forces it first. The GitHub base override
 * forces it next, because every GitHub address reaches the base anyway and the
 * probe would contact the real github.com; the override is read from this
 * process's environment, as every request that it rewrites reads it.
 *
 * D-SG-24: Claude Code's remote-session variable is not read. It tells Claude
 * Code that a git proxy of its remote sessions carries the session's git, and
 * Pi has no such proxy, so the variable describes the session around Pi, not
 * a transport Pi can use (a capability gap).
 */
export function transportForce(env: NodeJS.ProcessEnv): TransportForce | undefined {
  if (preferHttps(env)) {
    return "prefer-https";
  }

  return gitHubOverrideHost() === undefined ? undefined : "base-override";
}

/** One GitHub clone to run over its plan. */
export interface GitHubCloneRun<T> {
  readonly plan: TransportPlan;
  /** Runs one clone attempt. */
  readonly attempt: (attempt: TransportAttempt) => Promise<T>;
  readonly notes: GitHubCloneNotes;
  /** The subject of the row that reports the clone. */
  readonly subject: string;
  /** The surface whose words a failure of both transports uses. */
  readonly surface: GitHubTransportsFailedError["surface"];
}

// Claude Code's debug lines for the probe's two outcomes.
const CHOICE_LINES: Readonly<Partial<Record<CloneNoteKind, string>>> = {
  "via-ssh": "SSH configured for GitHub, using SSH for",
  "ssh-not-configured": "SSH not configured for GitHub, using HTTPS for",
};

/**
 * SG-SSH-02: records the plan's note for `run.subject`, then runs the plan's
 * first attempt. A failure of that attempt reaches the caller unchanged.
 */
export async function cloneOverGitHubTransports<T>(run: GitHubCloneRun<T>): Promise<T> {
  const { plan, subject } = run;
  if (plan.note !== undefined) {
    run.notes.record(subject, { note: plan.note, url: plan.first.url });
    const line = CHOICE_LINES[plan.note];
    if (line !== undefined) {
      hookDebugLog(`${line} ${subject}`, "git");
    }
  }

  return run.attempt(plan.first);
}
