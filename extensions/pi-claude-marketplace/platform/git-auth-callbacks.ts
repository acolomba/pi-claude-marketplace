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
 * `credentialOps.fill` returns null (no stored credential). The orchestrator
 * binds whatever the host's arm needs at the call site, so this seam takes no
 * parameters: `orchestrators/auth-host.ts`'s registry arm binds `host`,
 * `credentialOps`, and `notifyFn` for the Device Flow, and its no-provider arm
 * binds `host` alone to name the host in `NO_STORED_CREDENTIAL_CAUSE`.
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
  /**
   * Whether evicting a server-rejected credential for `host` is recoverable:
   * true when `onAuthRequired` can mint a replacement, false when the only
   * source for this host is the credential already in the user's helper.
   * `onAuthFailure` evicts only when it is true (AUTH-07, GAUTH-04) -- on a
   * host with no minting path the eviction is terminal and the value is
   * generally unrecoverable, while a stale credential left in place costs the
   * user one manual re-store. The orchestrator computes it; this module holds
   * no provider knowledge (`platform/README.md`: platform/ may import from
   * shared/ only).
   */
  evictOnFailure: boolean;
}

/**
 * Build the `{ onAuth, onAuthFailure }` pair consumed by isomorphic-git's
 * `clone` and `fetch`.
 *
 * Behavior:
 *
 * - `onAuth(url)`: require `https:` and compare `new URL(url).host` against
 *   `opts.host` first, returning `{ cancel: true }` on either mismatch, so a
 *   credential resolved for one host is never offered to another and never
 *   travels in cleartext (GAUTH-06, D-1-03). The scheme is part of the compare
 *   because `platform/git-credential.ts::buildAttributeBlock` queries the
 *   helper with `protocol=https`, so everything `fill` returns is an https
 *   credential, while `domain/source.ts` validates the scheme only in the
 *   string-form parser -- an object-form source out of a third-party
 *   `marketplace.json` can carry `http://`. Both sides of the host compare read
 *   `URL.host`, so the port participates and the default https port normalizes
 *   away symmetrically -- `orchestrators/auth-host.ts::hostFromCloneUrl`
 *   produces `opts.host` the same way. On a match, consult
 *   `credentialOps.fill(opts.host)`; on hit, return the stored credential
 *   (AUTH-02 silent reuse). On miss, invoke `opts.onAuthRequired()`; success
 *   returns the new credential, failure returns `{ cancel: true }`.
 * - `onAuthFailure(url, cred)`: when `opts.evictOnFailure` is true, call
 *   `credentialOps.reject(opts.host, cred)` to evict the credential the server
 *   rejected (AUTH-07), then return `{ cancel: true }`. When it is false, skip
 *   the eviction -- routing the skip through `hookDebugLog` -- and return
 *   `{ cancel: true }`.
 *
 * Discipline:
 *
 * - The host compare closes a CALLER-side host/URL mismatch: an orchestrator
 *   that builds a bundle for one host and then clones a URL on another. It is
 *   not the redirect guard. isomorphic-git invokes `onAuth` only from
 *   `discover`, on status 401 or 203, and always with the caller's own URL,
 *   so a redirect target never reaches this seam. The redirect path has its
 *   own guard: `platform/git.ts` follows redirects itself and drops the
 *   credential headers on every hop whose origin differs from the request's.
 *   `platform/git-credential.ts::credentialFill` emits `protocol` and `host`
 *   with no `path` line, so the helper lookup is strictly host-keyed. This
 *   compare is what bounds the disclosure surface, because `buildAuthForHost`
 *   returns a bundle for every host and the bound host is therefore the only
 *   thing that decides which URL a credential may answer (GAUTH-06 / T-79-04).
 * - `onAuthFailure` deliberately keeps an unused `_url`. It receives the
 *   credential in order to evict it, which means the credential has already
 *   been sent; a compare there would change nothing about what was disclosed.
 *   What the seam does decide is what the eviction destroys, and that is
 *   `opts.evictOnFailure`: isomorphic-git routes the SECOND 401 of one
 *   operation to `onAuthFailure` rather than `onAuth`
 *   (`node_modules/isomorphic-git/index.cjs`: `providedAuthBefore ?
 *   onAuthFailure : onAuth`), so a stored credential the server declines
 *   reaches this seam on every host that carries a bundle. Where a minting
 *   path exists the eviction clears a stale value the next `onAuth` replaces;
 *   where none exists it deletes the user's only copy of a secret their host
 *   displayed once.
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
 * @see REQUIREMENTS.md::GAUTH-06 (a credential is offered only to its bound host)
 */
export function buildAuthCallbacks(opts: BuildAuthCallbacksOpts): {
  onAuth: (url: string) => Promise<GitCredentials>;
  onAuthFailure: (url: string, cred: GitCredentials) => Promise<GitCredentials>;
} {
  async function onAuth(url: string): Promise<GitCredentials> {
    try {
      // GAUTH-06 / D-1-03: refuse before the lookup, so a foreign URL does not
      // even cause a helper query for the bound host. `new URL` throws on an
      // unparseable value; the CP-10 catch below turns that into the same
      // cancel, which is why the compare sits inside the existing try.
      const requested = new URL(url);
      if (requested.protocol !== "https:" || requested.host !== opts.host) {
        // AUTH-09: name the parsed scheme and host only. The raw URL can carry
        // userinfo, so interpolating it here could put a credential in a log
        // line.
        hookDebugLog(
          `onAuth: url ${requested.protocol}//${requested.host} does not match the bound https host ${opts.host}`,
          "auth",
        );
        return { cancel: true };
      }

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
      // CP-10: catch ANY thrown error from the URL parse / fill /
      // onAuthRequired and turn
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
    if (!opts.evictOnFailure) {
      // AUTH-07 / GAUTH-04: eviction is for a credential something can
      // re-mint. Here nothing can, so the stored value stays and the user
      // keeps a recoverable failure. AUTH-09: name the host only.
      hookDebugLog(
        `onAuthFailure: keeping the stored credential for ${opts.host}, nothing can re-mint it`,
        "auth",
      );
      return { cancel: true };
    }

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
