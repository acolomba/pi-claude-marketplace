/**
 * platform/git-auth-callbacks.ts -- the complete git authentication-callback
 * protocol consumed by isomorphic-git's `onAuth` / `onAuthFailure` hooks.
 *
 * This module owns the fill / Device Flow / reject / cancel state machine
 * (`buildAuthCallbacks`). `platform/git.ts` imports the factory and threads
 * the resulting pair into its isomorphic-git `fetch`; the orchestrators supply
 * the bundle.
 *
 * It imports the bundle (`GitAuthBundle`) from `platform/git-credential.ts`
 * and the credential shape (`GitCredentials`) rather than declaring either, so
 * the keychain protocol and the bundle stay in the credential module and the
 * credential shape stays on the canonical platform-git surface (D-13).
 */

import { hookDebugLog } from "../shared/debug-log.ts";
import {
  DeviceFlowUnavailableError,
  errorMessage,
  StoredCredentialRejectedError,
} from "../shared/errors.ts";

import type { GitAuthBundle } from "./git-credential.ts";
import type { GitCredentials } from "./git.ts";

/**
 * The bundle type under the name `platform/git.ts` still reads. The bundle and
 * its sign-in types belong to `platform/git-credential.ts`.
 */
export type BuildAuthCallbacksOpts = GitAuthBundle;

/**
 * Build the `{ onAuth, onAuthFailure }` pair consumed by isomorphic-git's
 * `fetch`.
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
 *   (AUTH-02 silent reuse). On miss, a `stored-credential` bundle returns
 *   `{ cancel: true }`; a `device-flow` bundle invokes
 *   `opts.onAuthRequired()`, and success returns the new credential while
 *   failure returns `{ cancel: true }`.
 * - `onAuthFailure(url, cred)`: for a `device-flow` bundle, call
 *   `credentialOps.reject(opts.host, cred)` to evict the credential the server
 *   rejected (AUTH-07), then return `{ cancel: true }`. For a
 *   `stored-credential` bundle, skip the eviction -- routing the skip through
 *   `hookDebugLog` -- and throw `StoredCredentialRejectedError`, so a caller
 *   can tell a refused credential from a helper miss, which cancels
 *   (GAUTH-04).
 *
 * Discipline:
 *
 * - The host compare closes a CALLER-side host/URL mismatch: an orchestrator
 *   that builds a bundle for one host and then clones a URL on another. It is
 *   not the redirect guard. isomorphic-git invokes `onAuth` only from
 *   `discover`, on status 401 or 203, and always with the caller's own URL.
 *   A 401 or 203 that arrives after a redirect left the original origin fails
 *   in `platform/git.ts` before isomorphic-git's auth loop, so neither
 *   `onAuth` nor `onAuthFailure` runs for it (Q-02). The redirect path keeps
 *   only protocol headers on a hop whose origin differs from the request's.
 *   `platform/git-credential.ts::credentialFill` emits `protocol` and `host`
 *   with no `path` line, so the helper lookup is strictly host-keyed. This
 *   compare is what bounds the disclosure surface, because `buildAuthForHost`
 *   returns a bundle for every host and the bound host is therefore the only
 *   thing that decides which URL a credential may answer (GAUTH-06 / T-79-04).
 * - `onAuthFailure` deliberately keeps an unused `_url`. It receives the
 *   credential in order to evict it, which means the credential has already
 *   been sent; a compare there would change nothing about what was disclosed.
 *   What the seam does decide is what the eviction destroys, and that is
 *   `opts.kind`: isomorphic-git routes the SECOND 401 of one
 *   operation to `onAuthFailure` rather than `onAuth`
 *   (`node_modules/isomorphic-git/index.cjs`: `providedAuthBefore ?
 *   onAuthFailure : onAuth`), so a stored credential the server declines
 *   reaches this seam on every host that carries a bundle. Where a minting
 *   path exists the eviction clears a stale value the next `onAuth` replaces;
 *   where none exists it deletes the user's only copy of a secret their host
 *   displayed once.
 * - CP-9 (no infinite retry): onAuthFailure never returns a credential. It
 *   returns `{ cancel: true }`, or throws for a `stored-credential` bundle,
 *   and either one ends the operation. Inline Device Flow retries from this
 *   seam would re-enter the same code path and loop forever; instead, isomorphic-git's
 *   next invocation re-enters via onAuth, which falls through to
 *   `onAuthRequired` on the (now-empty) fill miss.
 * - CP-10 (no raw exception escape): both callbacks wrap their bodies in
 *   try/catch and convert unrelated errors into `{ cancel: true }`, except
 *   the typed StoredCredentialRejectedError, which is rethrown (AUTH-09).
 *   DeviceFlowUnavailableError preserves the fixed print-mode remedy, and
 *   StoredCredentialRejectedError names only the host (AUTH-09).
 *   Error messages from
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

      if (opts.kind === "stored-credential") {
        // GAUTH-04 / D-1-01: the helper is this host's only credential source.
        hookDebugLog(`onAuth: no stored credential for ${opts.host}`, "auth");
        return { cancel: true };
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
      if (err instanceof DeviceFlowUnavailableError) {
        throw err;
      }

      // CP-10: catch other errors from the URL parse / fill /
      // onAuthRequired and turn it into a cancel; isomorphic-git never sees
      // the raw error. The caught message is still routed through
      // hookDebugLog rather than dropped -- platform/git-credential.ts's own
      // docstring pins that CredentialOps Error messages reference only the
      // subcommand name + timeout-ms/exit code, never a credential field, so
      // this stays AUTH-09-safe.
      hookDebugLog(`onAuth threw for ${opts.host}: ${errorMessage(err)}`, "auth");
      return { cancel: true };
    }
  }

  async function onAuthFailure(_url: string, cred: GitCredentials): Promise<GitCredentials> {
    if (opts.kind === "stored-credential") {
      // AUTH-07 / GAUTH-04: eviction is for a credential something can
      // re-mint. Here nothing can, so the stored value stays and the user
      // keeps a recoverable failure. The typed throw tells this refusal apart
      // from a helper miss, which cancels in `onAuth`. AUTH-09: name the host
      // only.
      hookDebugLog(
        `onAuthFailure: keeping the stored credential for ${opts.host}, nothing can re-mint it`,
        "auth",
      );
      throw new StoredCredentialRejectedError(opts.host);
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
