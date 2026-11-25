// orchestrators/github-transport.ts
//
// SG-SSH-02: runs a GitHub clone over the transports its plan
// (`domain/github-transport.ts`) orders, and keeps the D-SG-22 note of each
// clone for the row that reports it. D-SG-18: it also holds one command's
// transport context for its plugin clones, whose checks answer once per
// command. The module names no git surface: the caller passes the attempt and
// the port, so it stays outside NETWORK_SEAMS (NFR-5).

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage, GitHubTransportsFailedError } from "../shared/errors.ts";
import { gitHubOverrideHost } from "../shared/github-base-url.ts";
import { redactAbsolutePaths } from "../shared/redact-absolute-paths.ts";
import { redactCredentials } from "../shared/redact-credentials.ts";
import { preferHttps } from "../shared/upstream-flag.ts";

import type { PluginSshChecks } from "../domain/github-plugin-transport.ts";
import type {
  TransportAttempt,
  TransportForce,
  TransportPlan,
} from "../domain/github-transport.ts";
import type { GitHubTransportAttemptFailure } from "../shared/errors.ts";
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
  /** Clears what a failed attempt left, before the next attempt runs. */
  readonly beforeRetry?: (() => Promise<void>) | undefined;
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

const TRANSPORT_LABELS = { ssh: "SSH", https: "HTTPS" } as const;

// Keeps the plan's note for the run's subject, with the URLs of the retries
// that ran after its first attempt.
function recordNote(run: GitHubCloneRun<unknown>, retries: readonly string[]): void {
  const { plan } = run;
  if (plan.note !== undefined) {
    run.notes.record(run.subject, {
      note: plan.note,
      url: plan.first.url,
      ...(retries.length > 0 && { retries }),
    });
  }
}

// A failure's message for a debug line, with no credential and no absolute path.
function debugMessage(error: unknown): string {
  return redactCredentials(redactAbsolutePaths(errorMessage(error)));
}

// A rejection as the Error an attempt failure holds.
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}

/**
 * D-SG-22 / OQ-8, upstream `wqo`: the error of a clone whose two attempts
 * both failed. On the marketplace surface, two failures with the same
 * message give the second error unchanged; any other pair gives one error
 * that names both attempts.
 */
function bothFailedError(
  surface: GitHubCloneRun<unknown>["surface"],
  attempts: readonly [GitHubTransportAttemptFailure, GitHubTransportAttemptFailure],
): Error {
  const [first, last] = attempts;
  return surface === "marketplace" && first.error.message === last.error.message
    ? last.error
    : new GitHubTransportsFailedError(surface, attempts);
}

// Runs the plan's other attempt after the first failed with `firstError`.
async function runRetry<T>(
  run: GitHubCloneRun<T>,
  firstError: unknown,
  next: TransportAttempt,
): Promise<T> {
  const { first } = run.plan;
  try {
    return await run.attempt(next);
  } catch (lastError: unknown) {
    hookDebugLog(
      `${TRANSPORT_LABELS[next.transport]} clone fallback also failed for ${run.surface} ${run.subject}: ${debugMessage(lastError)}`,
      "git",
    );
    throw bothFailedError(run.surface, [
      { ...first, error: asError(firstError) },
      { ...next, error: asError(lastError) },
    ]);
  }
}

/**
 * SG-SSH-02: records the plan's note for `run.subject`, then runs the plan's
 * first attempt. When it fails and the plan gives another attempt, as Claude
 * Code's marketplace clone does after any error, the run logs the fallback,
 * runs `beforeRetry`, adds the retry's URL to the note, and runs that attempt.
 * A failure the plan gives no attempt after reaches the caller unchanged.
 * When the other attempt fails too, the run throws `bothFailedError`'s error.
 */
export async function cloneOverGitHubTransports<T>(run: GitHubCloneRun<T>): Promise<T> {
  const { plan, subject } = run;
  recordNote(run, []);
  const line = plan.note === undefined ? undefined : CHOICE_LINES[plan.note];
  if (line !== undefined) {
    hookDebugLog(`${line} ${subject}`, "git");
  }

  try {
    return await run.attempt(plan.first);
  } catch (error: unknown) {
    const next = await plan.after(error, plan.first);
    if (next === undefined) {
      throw error;
    }

    hookDebugLog(
      `${TRANSPORT_LABELS[plan.first.transport]} clone failed for ${run.surface} ${subject} (${debugMessage(error)}), falling back to ${TRANSPORT_LABELS[next.transport]}`,
      "git",
    );
    await run.beforeRetry?.();
    recordNote(run, [next.url]);
    return runRetry(run, error, next);
  }
}

/**
 * D-SG-18: the user's ssh as a plugin clone's checks read it. The port of
 * `orchestrators/marketplace/shared.ts` implements it.
 */
export interface PluginSshOps {
  /** Claude Code's probe of whether the user's ssh authenticates to GitHub. */
  readonly probe: () => Promise<"configured" | "not-configured" | "unknown">;
  /** `GIT_SSH_COMMAND` or `GIT_SSH` in the user's environment, or `core.sshCommand`. */
  readonly userOverride: () => Promise<boolean>;
  /** Whether the user's git config rewrites `sshUrl`, with the read's exit code. */
  readonly urlRewritten: (
    sshUrl: string,
  ) => Promise<{ readonly rewritten: boolean; readonly exitCode: number | null }>;
}

/**
 * D-SG-18: one command's GitHub transport choice for its plugin clones. Each
 * check answers once per command, the probe included, so an install and its
 * dependencies probe once. The notes keep each clone's D-SG-22 note for the
 * row that reports it.
 */
export interface PluginTransportContext {
  readonly force: TransportForce | undefined;
  readonly checks: PluginSshChecks;
  readonly notes: GitHubCloneNotes;
}

/**
 * D-SG-18: one plugin clone's plan, with the notes and the subject it reports
 * under. The plan is made only when a clone step runs, so a warm cache asks
 * no check and runs no probe (NFR-5).
 */
export interface CloneTransport {
  readonly plan: () => Promise<TransportPlan>;
  readonly notes: GitHubCloneNotes;
  /** The subject of the row that reports the clone, such as `<plugin>@<marketplace>`. */
  readonly subject: string;
}

// A function that runs `answer` the first time it is called and gives that
// first answer to every call.
function once<T>(answer: () => Promise<T>): () => Promise<T> {
  let answered: Promise<T> | undefined;
  return () => {
    answered ??= answer();
    return answered;
  };
}

// The rewrite check of the user's git config, one read per URL. A rewritten
// URL, or a read git could not answer, writes Claude Code's debug line.
function urlRewrittenOnce(ssh: PluginSshOps): PluginSshChecks["urlRewritten"] {
  const answers = new Map<string, Promise<boolean>>();
  return (sshUrl) => {
    let answer = answers.get(sshUrl);
    if (answer === undefined) {
      answer = ssh.urlRewritten(sshUrl).then(({ rewritten, exitCode }) => {
        if (rewritten) {
          hookDebugLog(
            `GitHub SSH URL is rewritten by git config, or git could not say (code=${exitCode}): staying on SSH`,
            "git",
          );
        }

        return rewritten;
      });
      answers.set(sshUrl, answer);
    }

    return answer;
  };
}

/**
 * D-SG-18: the transport context of one command. `force` is read from `env`
 * (`transportForce`) the first time a clone asks for it, so a command whose
 * clones are all warm never reads the GitHub base (NFR-5). Each check runs on
 * the port at most once for the context, the URL check once per URL, and the
 * notes start empty.
 */
export function createPluginTransportContext(args: {
  readonly env: NodeJS.ProcessEnv;
  readonly ssh: PluginSshOps;
}): PluginTransportContext {
  const { ssh } = args;
  let force: { readonly value: TransportForce | undefined } | undefined;
  return {
    get force() {
      force ??= { value: transportForce(args.env) };
      return force.value;
    },
    checks: {
      userOverride: once(() => ssh.userOverride()),
      urlRewritten: urlRewrittenOnce(ssh),
      probe: once(() => ssh.probe()),
    },
    notes: createGitHubCloneNotes(),
  };
}
