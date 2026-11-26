// orchestrators/github-transport.ts
//
// SG-SSH-02: runs a GitHub clone over the transports its plan
// (`domain/github-transport.ts`) orders, and keeps the D-SG-22 note of each
// clone for the row that reports it. D-SG-18: it also holds one command's
// transport context for its plugin clones, whose checks answer once per
// command. The module names no git surface: the caller passes the attempt and
// the port, so it stays outside NETWORK_SEAMS (NFR-5).

import { planPluginClone } from "../domain/github-plugin-transport.ts";
import { stopsTheClone } from "../domain/github-transport.ts";
import { isGitSubdirShorthand } from "../domain/source.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import {
  appendLeakToError,
  errorMessage,
  GITHUB_TRANSPORT_LABELS,
  GitHubTransportsFailedError,
} from "../shared/errors.ts";
import { GITHUB_HOST, gitHubOverrideHost } from "../shared/github-base-url.ts";
import { redactAbsolutePaths } from "../shared/redact-absolute-paths.ts";
import { redactCredentials } from "../shared/redact-credentials.ts";
import { preferHttps } from "../shared/upstream-flag.ts";

import type { PluginSshChecks } from "../domain/github-plugin-transport.ts";
import type {
  TransportAttempt,
  TransportForce,
  TransportPlan,
} from "../domain/github-transport.ts";
import type { GitBackedSource } from "../domain/source.ts";
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
 * D-SG-22: the transport note of the GitHub clone the operation behind a row
 * ran, which the row shows under it. Set only when the operation cloned from
 * GitHub (NREG-01).
 */
export interface CloneNoted {
  readonly clone?: CloneTransportNote;
}

/**
 * D-SG-22: lift an orchestrated outcome's clone note onto the outcome or row
 * built from it. An absent note stays absent (NREG-01).
 */
export function carriedClone(carrier: CloneNoted): CloneNoted {
  return carrier.clone === undefined ? {} : { clone: carrier.clone };
}

/**
 * D-SG-22: the note `notes` keeps for `subject`, the `<plugin>@<marketplace>`
 * of the row that reports the clone, as a member to spread onto its outcome.
 * A subject that cloned nothing from GitHub gives no member (NREG-01).
 */
export function cloneNoteOf(notes: GitHubCloneNotes, subject: string): CloneNoted {
  const clone = notes.noteFor(subject);
  return clone === undefined ? {} : { clone };
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

// Keeps the plan's note for the run's subject, with the URLs of the retries
// that ran after its first attempt. T-04-06: a url source can carry a
// credential in its userinfo, so each URL is kept redacted and every renderer
// and the wire read the safe form.
function recordNote(run: GitHubCloneRun<unknown>, retries: readonly string[]): void {
  const { plan } = run;
  if (plan.note !== undefined) {
    run.notes.record(run.subject, {
      note: plan.note,
      url: redactCredentials(plan.first.url),
      ...(retries.length > 0 && { retries: retries.map((url) => redactCredentials(url)) }),
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

// Claude Code's longest chain: SSH, then HTTPS, then SSH again (upstream
// `zHi` on Windows). A plan that gives more attempts stops there.
const MAX_ATTEMPTS = 3;

/** One failed attempt of a run, with what it failed with. */
interface FailedAttempt {
  readonly attempt: TransportAttempt;
  readonly error: unknown;
}

// The failure of `failed` as the Error an attempt failure holds.
function attemptFailure(failed: FailedAttempt): GitHubTransportAttemptFailure {
  return { ...failed.attempt, error: asError(failed.error) };
}

/**
 * Runs `run.beforeRetry` before `next`. When clearing fails, the failure of
 * `failed` is thrown with the clearing failure added to it, so the clone's
 * own failure stays the one the user reads, as Claude Code reports a
 * directory it could not clear for the retry.
 */
async function clearBeforeRetry(
  run: GitHubCloneRun<unknown>,
  failed: FailedAttempt,
  next: TransportAttempt,
): Promise<void> {
  try {
    await run.beforeRetry?.();
  } catch (error: unknown) {
    const from = GITHUB_TRANSPORT_LABELS[failed.attempt.transport];
    const to = GITHUB_TRANSPORT_LABELS[next.transport];
    throw appendLeakToError(
      failed.error,
      `could not clear the failed ${from} clone for the ${to} retry: ${errorMessage(error)}`,
    );
  }
}

/**
 * Runs the attempt the plan gives after `failed`, once each attempt before it
 * failed. `earlier` is the failure before `failed`, when there was one, and
 * `retries` the URLs of the retries that ran. With no attempt to give, a
 * first failure reaches the caller unchanged and a retry's failure throws
 * `bothFailedError`'s error over the last two attempts. A retry's failure
 * that stops the clone (`stopsTheClone`: an abort, no git, or print mode's
 * refused sign-in) reaches the caller unchanged too, so its remedy shows as
 * it does after a first attempt.
 */
async function runAfter<T>(
  run: GitHubCloneRun<T>,
  failed: FailedAttempt,
  earlier: FailedAttempt | undefined,
  retries: readonly string[],
): Promise<T> {
  const next =
    retries.length + 1 < MAX_ATTEMPTS
      ? await run.plan.after(failed.error, failed.attempt)
      : undefined;
  const label = GITHUB_TRANSPORT_LABELS[failed.attempt.transport];
  if (next === undefined) {
    if (earlier === undefined || stopsTheClone(failed.error)) {
      throw failed.error;
    }

    hookDebugLog(
      `${label} clone fallback also failed for ${run.surface} ${run.subject}: ${debugMessage(failed.error)}`,
      "git",
    );
    throw bothFailedError(run.surface, [attemptFailure(earlier), attemptFailure(failed)]);
  }

  hookDebugLog(
    `${label} clone failed for ${run.surface} ${run.subject} (${debugMessage(failed.error)}), falling back to ${GITHUB_TRANSPORT_LABELS[next.transport]}`,
    "git",
  );
  await clearBeforeRetry(run, failed, next);
  const ran = [...retries, next.url];
  recordNote(run, ran);
  try {
    return await run.attempt(next);
  } catch (error: unknown) {
    return runAfter(run, { attempt: next, error }, failed, ran);
  }
}

/**
 * SG-SSH-02: records the plan's note for `run.subject`, then runs the plan's
 * first attempt. When it fails and the plan gives another attempt, as Claude
 * Code's marketplace clone does after any error, the run logs the fallback,
 * runs `beforeRetry`, adds the retry's URL to the note, and runs that attempt;
 * a retry that fails asks the plan again, up to three attempts in all
 * (SG-SSH-05). A first failure the plan gives no attempt after reaches the
 * caller unchanged. When a retry fails and the plan gives nothing more, the
 * run throws `bothFailedError`'s error over the last two attempts, unless the
 * retry's failure stops the clone, which reaches the caller unchanged.
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
    return runAfter(run, { attempt: plan.first, error }, undefined, []);
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
  /**
   * `ssh -G git@github.com`: `missing` when no ssh was found, else whether
   * it shows a direct hop to github.com, with its exit code.
   */
  readonly showsDirectGitHub: () => Promise<
    | { readonly kind: "missing" }
    | { readonly kind: "ran"; readonly direct: boolean; readonly exitCode: number | null }
  >;
  /**
   * SG-SSH-05, Windows: whether the ssh git starts for `sshUrl`, run with
   * `-G`, shows a direct hop to github.com.
   */
  readonly showsDirectGitHubThroughGit: (sshUrl: string) => Promise<boolean>;
}

/**
 * D-SG-18: one command's GitHub transport choice for its plugin clones. Each
 * check answers once per command, the probe included, so an install and its
 * dependencies probe once. The notes keep each clone's D-SG-22 note for the
 * row that reports it.
 */
export interface PluginTransportContext {
  readonly force: TransportForce | undefined;
  /** SG-SSH-05: the platform the command's clones run on; Windows has its own plan. */
  readonly platform: NodeJS.Platform;
  readonly checks: PluginSshChecks;
  readonly notes: GitHubCloneNotes;
}

/**
 * D-SG-22: `context` with a collector of its own, which also hands each note
 * to `context`'s collector. A command that clones one `<plugin>@<marketplace>`
 * in both scopes gives each scope its own view, so each scope's row reads the
 * note of its own clone only. The view shares the context's checks and reads
 * its force only when a clone asks for it, as the context does (NFR-5).
 */
export function withOwnCloneNotes(context: PluginTransportContext): PluginTransportContext {
  const own = createGitHubCloneNotes();
  return {
    get force() {
      return context.force;
    },
    platform: context.platform,
    checks: context.checks,
    notes: {
      record: (subject, note) => {
        own.record(subject, note);
        context.notes.record(subject, note);
      },
      noteFor: own.noteFor,
    },
  };
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

/**
 * GHB-04: whether a plugin clone of `source` can be a GitHub clone whose
 * transport a force decides: a GitHub source, or a git-subdir `owner/repo`
 * shorthand. Any other source clones as written and never reads the GitHub
 * base, so an invalid base cannot fail it.
 */
function forceApplies(source: GitBackedSource): boolean {
  return (
    source.kind === "github" || (source.kind === "git-subdir" && isGitSubdirShorthand(source.url))
  );
}

/**
 * D-SG-18, D-SG-19: the clone transport of one plugin `source` under a
 * command's `context`. The plan reads the context's force, checks, and
 * platform only when a clone step asks for it, and the clone's note goes to
 * the context's notes under `subject`, `<plugin>@<marketplace>`. The force is
 * read only for a source it applies to (GHB-04).
 */
export function pluginCloneTransport(
  context: PluginTransportContext,
  source: GitBackedSource,
  subject: string,
): CloneTransport {
  return {
    plan: () =>
      planPluginClone({
        source,
        force: forceApplies(source) ? context.force : undefined,
        checks: context.checks,
        platform: context.platform,
      }),
    notes: context.notes,
    subject,
  };
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

// A function that runs `answer` the first time it is called for a URL and
// gives that first answer to every call for the same URL.
function oncePerUrl<T>(answer: (url: string) => Promise<T>): (url: string) => Promise<T> {
  const answers = new Map<string, Promise<T>>();
  return (url) => {
    let answered = answers.get(url);
    if (answered === undefined) {
      answered = answer(url);
      answers.set(url, answered);
    }

    return answered;
  };
}

// The rewrite check of the user's git config, one read per URL. A rewritten
// URL, or a read git could not answer, writes Claude Code's debug line.
function urlRewrittenOnce(ssh: PluginSshOps): PluginSshChecks["urlRewritten"] {
  return oncePerUrl((sshUrl) =>
    ssh.urlRewritten(sshUrl).then(({ rewritten, exitCode }) => {
      if (rewritten) {
        hookDebugLog(
          `GitHub SSH URL is rewritten by git config, or git could not say (code=${exitCode}): staying on SSH`,
          "git",
        );
      }

      return rewritten;
    }),
  );
}

// The two checks that `ssh -G` answers, from one launch: whether an ssh was
// found, and whether it shows a direct hop. A hop that is not direct writes
// Claude Code's debug line.
function sshHopChecks(
  ssh: PluginSshOps,
): Pick<PluginSshChecks, "sshPresent" | "showsDirectGitHub"> {
  const hop = once(() => ssh.showsDirectGitHub());
  return {
    sshPresent: async () => (await hop()).kind !== "missing",
    showsDirectGitHub: once(async () => {
      const answer = await hop();
      const direct = answer.kind === "ran" && answer.direct;
      if (!direct) {
        const code = answer.kind === "ran" ? answer.exitCode : null;
        hookDebugLog(
          `ssh -G does not show git@${GITHUB_HOST} going straight to ${GITHUB_HOST} (code=${code}): staying on SSH`,
          "git",
        );
      }

      return direct;
    }),
  };
}

/**
 * D-SG-18: the transport context of one command. `force` is read from `env`
 * (`transportForce`) the first time a clone asks for it, so a command whose
 * clones are all warm never reads the GitHub base (NFR-5). Each check runs on
 * the port at most once for the context, the URL checks once per URL, and the
 * notes start empty. SG-SSH-05: `platform` defaults to this process's.
 */
export function createPluginTransportContext(args: {
  readonly env: NodeJS.ProcessEnv;
  readonly ssh: PluginSshOps;
  readonly platform?: NodeJS.Platform;
}): PluginTransportContext {
  const { ssh } = args;
  let force: { readonly value: TransportForce | undefined } | undefined;
  return {
    get force() {
      force ??= { value: transportForce(args.env) };
      return force.value;
    },
    platform: args.platform ?? process.platform,
    checks: {
      userOverride: once(() => ssh.userOverride()),
      urlRewritten: urlRewrittenOnce(ssh),
      probe: once(() => ssh.probe()),
      ...sshHopChecks(ssh),
      showsDirectGitHubThroughGit: oncePerUrl((sshUrl) => ssh.showsDirectGitHubThroughGit(sshUrl)),
    },
    notes: createGitHubCloneNotes(),
  };
}
