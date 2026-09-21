/**
 * platform/git-auth-callbacks.ts -- the complete git authentication-callback
 * protocol consumed by isomorphic-git's `onAuth` / `onAuthFailure` hooks.
 *
 * This module owns the whole concern: the caller-supplied seam types
 * (`AuthAttemptResult`, `OnAuthRequiredFn`), the input bundle
 * (`BuildAuthCallbacksOpts`), and the fill / Device Flow / reject / cancel
 * state machine itself (`buildAuthCallbacks`). `platform/git.ts` imports the
 * factory and threads the resulting pair into `clone`, `fetch`, and
 * `resolveRemoteRef`; the orchestrators supply the bundle.
 *
 * It imports the credential seam (`CredentialOps`) and the credential shape
 * (`GitCredentials`) rather than declaring either, so the keychain protocol
 * stays in `platform/git-credential.ts` and the isomorphic-git-facing
 * credential shape stays on the canonical platform-git surface (D-13).
 */

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import type { CredentialOps } from "./git-credential.ts";
import type { GitCredentials } from "./git.ts";

/**
 * Discriminated result returned by an `onAuthRequired`
 * closure. Both arms carry `authAttempted: true` as a reference-only /
 * future-proofing marker (CP-9): `onAuthFailure(url, cred)` never receives
 * this value -- it is called with only the credential -- and the current
 * implementation does not branch on the flag; onAuthFailure always returns
 * `{ cancel: true }` regardless.
 *
 * Structurally identical to `domain/github-auth.ts::DeviceFlowResult`.
 * Declared LOCALLY in the platform tier so this module honors the
 * platform → domain import prohibition (`platform/README.md`: platform/
 * may import from shared/ only). `orchestrators/auth-host.ts` wraps
 * `initiateDeviceFlow` in a memoizing closure and passes that closure as
 * `onAuthRequired`; TypeScript's structural typing accepts the assignment
 * with no adapter -- no shared type declaration is needed across tiers.
 */
export type AuthAttemptResult =
  | { ok: true; cred: GitCredentials; authAttempted: true }
  | { ok: false; reason: string; authAttempted: true };

/**
 * Caller-supplied closure invoked by `buildAuthCallbacks` when
 * `credentialOps.fill` returns null (no stored credential). The
 * orchestrator binds `host`, `credentialOps`, and `notifyFn` at the call
 * site so this seam takes no parameters.
 */
export type OnAuthRequiredFn = () => Promise<AuthAttemptResult>;

/**
 * Input bundle for `buildAuthCallbacks`. The same shape is reused by
 * `CloneOptions.auth?` and `FetchOptions.auth?`, so a single
 * `{ credentialOps, host, onAuthRequired }` literal threads through from
 * the orchestrator into clone/fetch without re-bundling.
 */
export interface BuildAuthCallbacksOpts {
  credentialOps: CredentialOps;
  host: string;
  onAuthRequired: OnAuthRequiredFn;
}

/**
 * Build the `{ onAuth, onAuthFailure }` pair consumed by isomorphic-git's
 * `clone` and `fetch`. The factory owns a closure-scoped
 * `deviceFlowAttempted` flag (set when `onAuthRequired` returns
 * `{ ok: true }`) that documents whether interactive auth has run; the
 * flag is reference-only for clarity / future-proofing -- onAuthFailure
 * always returns `{ cancel: true }` regardless (CP-9 below).
 *
 * Behavior:
 *
 * - `onAuth(url)`: consult `credentialOps.fill(opts.host)` first; on hit,
 *   return the stored credential (AUTH-02 silent reuse). On miss, invoke
 *   `opts.onAuthRequired()`; success returns the new credential, failure
 *   returns `{ cancel: true }`.
 * - `onAuthFailure(url, cred)`: call `credentialOps.reject(opts.host, cred)`
 *   to evict the stale credential, then return `{ cancel: true }`.
 *
 * Discipline:
 *
 * - CP-9 (no infinite retry): onAuthFailure ALWAYS returns
 *   `{ cancel: true }`. Inline Device Flow retries from this seam would
 *   re-enter the same code path and loop forever; instead, isomorphic-git's
 *   next invocation re-enters via onAuth, which falls through to
 *   `onAuthRequired` on the (now-empty) fill miss.
 * - CP-10 (no raw exception escape): both callbacks wrap their bodies in
 *   try/catch and convert any thrown error into `{ cancel: true }` -- the
 *   value isomorphic-git receives is unchanged. Error messages from
 *   CredentialOps and onAuthRequired are intentionally NOT interpolated into
 *   RETURN VALUES or notify calls -- a credential could be interpolated into
 *   an upstream Error, so surfacing it to the user or to isomorphic-git
 *   would violate AUTH-09. The failure reason IS routed through
 *   `hookDebugLog` before the `{ cancel: true }` fallback -- in onAuth (both
 *   the Device Flow failure path and the catch-all) and in onAuthFailure (a
 *   caught reject() throw) -- so the specific cause (which OAuth provider
 *   error, which host) is diagnosable rather than discarded outright:
 *   `onAuthRequired`'s `result.reason` (from
 *   `domain/github-auth.ts::DeviceFlowResult`) is built only from fixed
 *   strings, `err.message` on a network/fetch failure, or the OAuth
 *   provider's own `error`/`error_description` fields on a PRE-TOKEN
 *   response -- never from `access_token`/`accessToken`/`cred.*`. A caught
 *   exception's message is covered by `platform/git-credential.ts`'s own
 *   docstring discipline (CredentialOps Error messages reference only the
 *   subcommand name + timeout-ms/exit code). `hookDebugLog` itself writes to
 *   `console.error` only when `PI_CLAUDE_MARKETPLACE_DEBUG=1`, never to the
 *   return value or a user-visible notify. AUTH-09 therefore forbids naming
 *   any credential field in a `hookDebugLog` argument from this module.
 *
 * @see REQUIREMENTS.md::AUTH-01 (private repo auth via Device Flow)
 * @see REQUIREMENTS.md::AUTH-02 (silent keychain reuse on subsequent ops)
 */
export function buildAuthCallbacks(opts: BuildAuthCallbacksOpts): {
  onAuth: (url: string) => Promise<GitCredentials>;
  onAuthFailure: (url: string, cred: GitCredentials) => Promise<GitCredentials>;
} {
  // CP-9 future-proofing note: `deviceFlowAttempted` is set to true after a
  // successful onAuthRequired call so a later refinement could differentiate
  // a stale-keychain rejection (no Device Flow yet) from a post-DF
  // rejection. The current implementation does NOT branch on the flag --
  // onAuthFailure unconditionally returns { cancel: true } because retrying
  // Device Flow inline from this seam would re-enter the same code path
  // (isomorphic-git's next call invokes onAuth, which falls through to
  // Device Flow naturally on a fill miss).
  async function onAuth(_url: string): Promise<GitCredentials> {
    try {
      const filled = await opts.credentialOps.fill(opts.host);
      if (filled !== null) {
        return filled;
      }

      const result = await opts.onAuthRequired();
      if (result.ok) {
        return result.cred;
      }

      // Capture the specific failure reason for diagnosis (AUTH-09-safe per
      // the no-credential-leak gate on DeviceFlowResult.reason) before
      // falling back to the generic { cancel: true } isomorphic-git sees.
      hookDebugLog(`onAuth: Device Flow failed for ${opts.host}: ${result.reason}`, "auth");
      return { cancel: true };
    } catch (err) {
      // CP-10: catch ANY thrown error from fill / onAuthRequired and turn
      // it into a cancel; isomorphic-git never sees the raw error. The
      // caught message is still routed through hookDebugLog rather than
      // dropped -- platform/git-credential.ts's own docstring pins that
      // CredentialOps Error messages reference only the subcommand name +
      // timeout-ms/exit code, never a credential field, so this stays
      // AUTH-09-safe.
      hookDebugLog(`onAuth threw for ${opts.host}: ${errorMessage(err)}`, "auth");
      return { cancel: true };
    }
  }

  async function onAuthFailure(_url: string, cred: GitCredentials): Promise<GitCredentials> {
    try {
      await opts.credentialOps.reject(opts.host, cred);
    } catch (err) {
      // CP-10: swallow any reject() throw and still return cancel below.
      // The credential has not been evicted from the keychain, but the
      // current operation will not retry against this seam regardless. The
      // caught message is still routed through hookDebugLog (AUTH-09-safe
      // per platform/git-credential.ts's own docstring discipline, same as
      // onAuth's catch-all above) so the failure is diagnosable rather than
      // discarded outright.
      hookDebugLog(`onAuthFailure: reject() threw for ${opts.host}: ${errorMessage(err)}`, "auth");
    }

    // CP-9: ALWAYS cancel. Returning a fresh credential here would
    // re-enter isomorphic-git's auth loop; the next operation invokes
    // onAuth which performs the right thing (fill miss -> Device Flow).
    return { cancel: true };
  }

  return { onAuth, onAuthFailure };
}
