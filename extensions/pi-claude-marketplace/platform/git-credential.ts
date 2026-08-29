/**
 * AUTH-06 / AUTH-08 / AUTH-09. The CredentialOps surface wraps
 * `git credential fill/approve/reject` via node:child_process.spawn.
 *
 * REJECTED: `pi.exec` from @earendil-works/pi-coding-agent -- verified at
 * node_modules/@earendil-works/pi-coding-agent/dist/core/exec.js:12 to use
 * `stdio: ["ignore", ...]`. git credential REQUIRES stdin.
 *
 * D-21: this is the ONLY file in
 * extensions/pi-claude-marketplace/ permitted to import node:child_process
 * (whitelist asserted in tests/architecture/no-shell-out.test.ts).
 *
 * Failure-mode contract: when git is absent from PATH, the
 * subprocess spawn emits ENOENT. `credentialFill` catches and returns null;
 * `credentialApprove` / `credentialReject` swallow and silently no-op
 * (best-effort persistence). The current operation still
 * succeeds via Device Flow -- only keychain reuse is lost.
 *
 * Error-message discipline (AUTH-09): no Error constructor in
 * this file interpolates a credential field. The only thrown errors from
 * gitCredentialIO reference the subcommand name + timeout-ms or exit code.
 * approve/reject swallow all subprocess errors so they never escape.
 *
 * Non-interactive guarantee: env carries `GIT_TERMINAL_PROMPT=0`
 * so a credential-helper miss never falls through to a TTY prompt, and
 * `GCM_INTERACTIVE=never` so Git Credential Manager returns null on a
 * cache miss rather than opening a browser OAuth flow. Pi shows the
 * Device Flow URL + code in its own UI via `initiateDeviceFlow` instead.
 *
 * stdin EOF guarantee: both `child.stdin.write(input)` AND
 * `child.stdin.end()` are called -- the trailing blank line in the input
 * satisfies the wire format; .end() flushes EOF on the pipe so the helper
 * never waits for more input.
 */

import { spawn } from "node:child_process";

import type { GitCredentials } from "./git.ts";

/**
 * D-31: Credential helper surface. Mirrors the GitOps pattern in
 * orchestrators/marketplace/shared.ts. Three primitives:
 *   - fill: read a stored credential for a host; null on miss
 *   - approve: persist a credential to the OS keychain
 *   - reject: evict a credential from the OS keychain
 *
 * The default implementation spawns `git credential fill/approve/reject`.
 * `createCredentialOps` accepts a process launcher for alternate adapters.
 *
 * buildAuthCallbacks consumes this seam.
 *
 * Caller note for keychain hygiene: on macOS, repeated approve
 * without a prior reject can accumulate duplicate keychain entries. The
 * buildAuthCallbacks consumer is responsible for sequencing
 * `reject(host, old) → approve(host, new)` when rotating a token. The
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

export interface CredentialProcess {
  readonly stdin: {
    on(event: "error", listener: (error: Error) => void): void;
    write(input: string): void;
    end(): void;
  };
  readonly stdout: {
    on(event: "data", listener: (chunk: Buffer) => void): void;
  };
  kill(signal: "SIGTERM"): boolean;
  on(
    event: "error" | "close",
    listener: ((error: Error) => void) | ((code: number | null) => void),
  ): void;
}

export interface CredentialSpawnOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly stdio: readonly ["pipe", "pipe", "pipe"];
}

export type CredentialSpawn = (
  command: string,
  args: readonly string[],
  options: CredentialSpawnOptions,
) => CredentialProcess;

export interface CreateCredentialOpsOptions {
  readonly spawn?: CredentialSpawn;
  readonly timeoutMs?: number;
}

/**
 * Spawn `git credential <subcommand>` and feed `input` over stdin. Returns
 * { stdout, code } on close. Rejects on subprocess "error" (ENOENT
 * et al.) or on timeout (default 5_000ms).
 *
 * Timeout discipline (CP-4): the setTimeout handle calls .unref() so a
 * pending timer cannot keep the host Pi process alive past success.
 */
function gitCredentialIO(
  subcommand: "fill" | "approve" | "reject",
  input: string,
  spawnProcess: CredentialSpawn,
  timeoutMs: number,
): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawnProcess("git", ["credential", subcommand], {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`git credential ${subcommand} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ stdout, code: code ?? -1 });
    });

    // Swallow EPIPE: the credential helper may exit before reading all
    // input (e.g. non-zero exit on approve/reject with no helper). Without
    // this listener the 'error' event on child.stdin becomes an unhandled
    // exception.
    child.stdin.on("error", () => {});
    child.stdin.write(input);
    child.stdin.end();
  });
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
 *   - ENOENT (git absent from PATH)         -> try/catch swallow -> null
 *   - subprocess timeout                    -> try/catch swallow -> null
 *   - non-zero exit (no helper, miss)       -> null
 *   - exit 0 but no username= or password=  -> null
 *
 * The `null` return is the affirmative no-result; callers
 * (buildAuthCallbacks) fall through to Device Flow on null.
 */
type RunGitCredential = (
  subcommand: "fill" | "approve" | "reject",
  input: string,
) => Promise<{ stdout: string; code: number }>;

async function credentialFill(
  host: string,
  runGitCredential: RunGitCredential,
): Promise<GitCredentials | null> {
  const input = buildAttributeBlock(host);
  let result;
  try {
    result = await runGitCredential("fill", input);
  } catch {
    return null;
  }

  if (result.code !== 0) {
    return null;
  }

  const parsed = parseCredentialOutput(result.stdout);
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
 * Best-effort: failures (ENOENT, non-zero exit, timeout) silently no-op.
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
  } catch {
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
  } catch {
    return;
  }
}

export function createCredentialOps(options: CreateCredentialOpsOptions = {}): CredentialOps {
  const spawnProcess = options.spawn ?? (spawn as CredentialSpawn);
  const timeoutMs = options.timeoutMs ?? 5_000;
  const runGitCredential: RunGitCredential = (subcommand, input) =>
    gitCredentialIO(subcommand, input, spawnProcess, timeoutMs);

  return {
    fill: (host) => credentialFill(host, runGitCredential),
    approve: (host, cred) => credentialApprove(host, cred, runGitCredential),
    reject: (host, cred) => credentialReject(host, cred, runGitCredential),
  };
}

export const DEFAULT_CREDENTIAL_OPS: CredentialOps = createCredentialOps();
