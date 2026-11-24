/**
 * AUTH-06 / AUTH-08 / AUTH-09. The CredentialOps surface speaks the
 * `git credential fill/approve/reject` protocol over an injected credential
 * runner, which runs git through platform/git-process.ts in production. This
 * module spawns nothing: the git process module is the extension's sanctioned
 * git spawn site (D-SG-01).
 *
 * REJECTED: `pi.exec` from @earendil-works/pi-coding-agent -- verified at
 * node_modules/@earendil-works/pi-coding-agent/dist/core/exec.js:15 to use
 * `stdio: ["ignore", ...]`. git credential REQUIRES stdin.
 *
 * D-SG-01 / D-SG-05: the git process module runs the user's system git with
 * its hardened environment. `GIT_ASKPASS` is empty, `credential.interactive`
 * is false, and git has no controlling terminal, so neither git's own prompt
 * nor the user's askpass programs (`GIT_ASKPASS`, `core.askPass`,
 * `SSH_ASKPASS`) run. `GCM_INTERACTIVE=never` makes Git Credential Manager
 * return null on a cache miss instead of opening a browser OAuth flow. Pi
 * shows the Device Flow URL + code in its own UI via `initiateDeviceFlow`.
 *
 * The command runs in the neutral directory with the ceiling at its parent,
 * so a credential helper configured by the repository Pi runs in is never
 * consulted. The one interactive surface left is a configured
 * `credential.helper` that prompts on its own (`pass` via gpg-agent
 * pinentry, 1Password's `op`, a GUI keychain dialog). Such a prompt meets the
 * timeout, which stops the whole process tree, and `fill` answers null.
 *
 * Failure-mode contract: every failed run, a missing git included, rejects
 * with a `GitCommandError`. `credentialFill` catches it and returns null;
 * `credentialApprove` / `credentialReject` debug-log its message and no-op
 * (best-effort persistence). The current operation still succeeds via Device
 * Flow -- only keychain reuse is lost.
 *
 * Error-message discipline (AUTH-09): no Error constructor in this file
 * interpolates a credential field. A `GitCommandError` names the subcommand
 * and the action only, and its stderr is redacted.
 *
 * stdin EOF guarantee: the git process writes the attribute block to stdin
 * and then closes it; the trailing blank line satisfies the wire format, so
 * the helper never waits for more input.
 */

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import { NODE_GIT_PROCESS } from "./git-process.ts";

import type { GitCredentials } from "./git.ts";

/**
 * D-31: Credential helper surface. Mirrors the GitOps pattern in
 * orchestrators/marketplace/shared.ts. Three primitives:
 *   - fill: read a stored credential for a host; null on miss
 *   - approve: persist a credential to the OS keychain
 *   - reject: evict a credential from the OS keychain
 *
 * `createCredentialOps` takes its credential runner and its timeout as
 * explicit collaborators. `NODE_CREDENTIAL_GIT` is the runner that starts the
 * real `git credential fill/approve/reject`; the composition owner
 * (`orchestrators/auth-host.ts`) supplies it, and an alternate adapter
 * supplies its own.
 *
 * A `GitAuthBundle` carries this seam, and the Device Flow sign-in stores its
 * token through `approve`.
 *
 * Caller note for keychain hygiene: on macOS, repeated approve
 * without a prior reject can accumulate duplicate keychain entries. A caller
 * that rotates a token is responsible for sequencing
 * `reject(host, old) → approve(host, new)`. The
 * approve impl here does NOT do this internally; it is a single-shot
 * primitive.
 */
export interface CredentialOps {
  /** AUTH-08: Return the stored credential for the host, or null on miss. */
  fill(host: string): Promise<GitCredentials | null>;
  /** AUTH-06: Persist a credential to the OS keychain via the configured helper. */
  approve(host: string, cred: GitCredentials): Promise<void>;
  /** AUTH-07: Evict a credential from the OS keychain. */
  reject(host: string, cred: GitCredentials): Promise<void>;
}

/**
 * The result of a Device Flow sign-in: the new credential, or the reason the
 * sign-in failed. The reason holds fixed text and the provider's pre-token
 * error fields only, never a token (AUTH-09).
 *
 * Structurally identical to `domain/github-auth.ts::DeviceFlowResult`. It is
 * declared in the platform tier because the `platform` boundary zone in
 * `.fallowrc.json` may import from `shared` only; `orchestrators/auth-host.ts`
 * returns the domain's result here with no adapter.
 */
export type AuthAttemptResult = { ok: true; cred: GitCredentials } | { ok: false; reason: string };

/**
 * The sign-in of a `device-flow` bundle. `platform/git.ts` calls it after a git
 * run failed because no credential helper answered, then runs the request once
 * more with the new credential (D-SG-14). It takes no parameters:
 * `orchestrators/auth-host.ts` binds the host, the credential surface, and the
 * prompt, and its command-scope memo runs the sign-in at most once per host
 * (D-79-02).
 */
export type OnAuthRequiredFn = () => Promise<AuthAttemptResult>;

/**
 * The auth bundle a git network operation carries, bound to one host. git asks
 * the user's credential helpers itself, so the bundle decides only what an
 * authentication failure of the run leads to (D-SG-14):
 *   - `device-flow`: a run that no helper answered signs in once through
 *     `onAuthRequired` and runs once more. A host the provider registry claims
 *     gets this kind (PROV-03).
 *   - `stored-credential`: the user's helper is the host's only credential
 *     source. A helper miss fails as git failed, and a credential the host
 *     refused throws `StoredCredentialRejectedError` and stays stored
 *     (GAUTH-04, D-1-01).
 *
 * `credentialOps` is the helper surface the sign-in stores its token through.
 * The orchestrator picks the kind; this module holds no provider knowledge.
 */
export type GitAuthBundle =
  | {
      readonly kind: "device-flow";
      readonly credentialOps: CredentialOps;
      readonly host: string;
      readonly onAuthRequired: OnAuthRequiredFn;
    }
  | {
      readonly kind: "stored-credential";
      readonly credentialOps: CredentialOps;
      readonly host: string;
    };

/**
 * WR-05, D-SG-01: runs `git credential <action>` with `input` on stdin, and
 * nothing else. Resolves with stdout; rejects with a `GitCommandError` when
 * the run failed, a non-zero exit included. The port takes no git request,
 * so a module that may import this one cannot reach a clone, a fetch, or any
 * other git command through it, and the GIT_PROCESS_IMPORTERS zone of
 * eslint.config.js keeps its meaning.
 */
export type CredentialGit = (
  action: "fill" | "approve" | "reject",
  input: string,
  timeoutMs: number,
) => Promise<string>;

type CredentialAction = Parameters<CredentialGit>[0];

/**
 * The production credential runner: `git credential` on the network lane of
 * the process's one git process, in the neutral directory, so a credential
 * lookup shares its git lookup with every other git command (D-SG-04).
 */
export const NODE_CREDENTIAL_GIT: CredentialGit = async (action, input, timeoutMs) => {
  const run = await NODE_GIT_PROCESS.run({
    subcommand: "credential",
    options: [action],
    lane: "network",
    input,
    timeoutMs,
  });
  return run.stdout;
};

export interface CreateCredentialOpsOptions {
  /** The credential runner. `NODE_CREDENTIAL_GIT` in production. */
  readonly git: CredentialGit;
  /** Milliseconds before a pending `git credential` and its process tree are stopped. */
  readonly timeoutMs: number;
}

/**
 * WR-01: Reject values containing control characters that would corrupt the
 * git-credential wire format (newline-injected extra attribute lines).
 */
function sanitizeAttrValue(value: string, field: string): string {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`git-credential attribute '${field}' contains a control character`);
  }

  return value;
}

/**
 * Build the git-credential wire-format attribute block.
 *
 * Wire format: `key=value` lines separated by `\n`, terminated by a blank
 * line (so the full string ends with `\n\n`).
 *
 * NEVER emit a `path=` line. fill/approve/reject must use the
 * SAME attribute set (protocol + host only), else approve stores under a
 * different keychain key than fill reads from.
 */
function buildAttributeBlock(host: string, cred?: GitCredentials): string {
  const lines = [`protocol=https`, `host=${sanitizeAttrValue(host, "host")}`];
  if (cred?.username !== undefined) {
    lines.push(`username=${sanitizeAttrValue(cred.username, "username")}`);
  }

  if (cred?.password !== undefined) {
    lines.push(`password=${sanitizeAttrValue(cred.password, "password")}`);
  }

  return lines.join("\n") + "\n\n";
}

/**
 * Parse the stdout of `git credential fill` into a key/value record.
 *
 * Wire format: one `key=value` per line; lines without `=` or with `=`
 * at position 0 are skipped. The trailing blank line (and any blank
 * stdout from approve/reject) is dropped naturally.
 */
function parseCredentialOutput(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq);
    const value = line.slice(eq + 1).replace(/\r$/, "");
    out[key] = value;
  }

  return out;
}

/**
 * AUTH-08: fill semantics.
 *
 * Returns the stored credential on success, null on any miss path:
 *   - a failed run (git missing, timeout,
 *     non-zero exit for no helper or a miss) -> try/catch swallow -> null
 *   - exit 0 but no username= or password=  -> null
 *
 * The `null` return is the affirmative no-result; callers
 * (buildAuthCallbacks) fall through to Device Flow on null.
 */
type RunGitCredential = (action: CredentialAction, input: string) => Promise<string>;

async function credentialFill(
  host: string,
  runGitCredential: RunGitCredential,
): Promise<GitCredentials | null> {
  const input = buildAttributeBlock(host);
  let stdout;
  try {
    stdout = await runGitCredential("fill", input);
  } catch {
    return null;
  }

  const parsed = parseCredentialOutput(stdout);
  const { username, password } = parsed;
  if (username === undefined || password === undefined) {
    return null;
  }

  return { username, password };
}

/**
 * AUTH-06: approve semantics. Persists the credential via the configured
 * git credential helper (osxkeychain / manager-core / libsecret).
 *
 * Best-effort: a failed run (git missing, non-zero exit, timeout) is
 * debug-logged and no-ops.
 * The in-memory token still works for the current
 * operation; the user simply does not get keychain reuse on subsequent
 * runs (they will re-run Device Flow next time).
 */
async function credentialApprove(
  host: string,
  cred: GitCredentials,
  runGitCredential: RunGitCredential,
): Promise<void> {
  const input = buildAttributeBlock(host, cred);
  try {
    await runGitCredential("approve", input);
  } catch (err) {
    hookDebugLog(
      `credentialApprove: git credential approve threw for ${host}: ${errorMessage(err)}`,
      "auth",
    );
    return;
  }
}

/**
 * AUTH-07: reject semantics. Evicts a credential from
 * the OS keychain. Same best-effort silent-return shape as approve.
 *
 * The cred argument is the credential to evict; the underlying git
 * credential helper matches on the full attribute set to identify the
 * entry to remove.
 */
async function credentialReject(
  host: string,
  cred: GitCredentials,
  runGitCredential: RunGitCredential,
): Promise<void> {
  const input = buildAttributeBlock(host, cred);
  try {
    await runGitCredential("reject", input);
  } catch (err) {
    hookDebugLog(
      `credentialReject: git credential reject threw for ${host}: ${errorMessage(err)}`,
      "auth",
    );
    return;
  }
}

/**
 * Bind a `CredentialOps` triple to one credential runner and one timeout.
 *
 * Construction performs no I/O: the three returned primitives close over the
 * credential runner and only run it when they are called.
 */
export function createCredentialOps(options: CreateCredentialOpsOptions): CredentialOps {
  const runGitCredential: RunGitCredential = (action, input) =>
    options.git(action, input, options.timeoutMs);

  return {
    fill: (host) => credentialFill(host, runGitCredential),
    approve: (host, cred) => credentialApprove(host, cred, runGitCredential),
    reject: (host, cred) => credentialReject(host, cred, runGitCredential),
  };
}
