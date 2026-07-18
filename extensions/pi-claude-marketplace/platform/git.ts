import * as fs from "node:fs";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import type { CredentialOps } from "./git-credential.ts";

/**
 * platform/git.ts -- isomorphic-git wrapper (D-18, D-19, D-20).
 *
 * Uses pure-JS `isomorphic-git`, so there is no `git not found on PATH`
 * failure mode (D-21, MA-7).
 *
 * Pins `fs` (Node's built-in) and `http` (`isomorphic-git/http/node`) so
 * the marketplace orchestrators don't thread them through every call.
 *
 * The `listRemotes` wrapper (W-4) is exposed here even though the
 * marketplace orchestrators are the consumers -- keeping the import-x
 * boundary verification surface complete.
 *
 * NOT exposed:
 *   - sparse checkout (PRD §11 deferred; isomorphic-git also doesn't support it)
 *   - shallow clones / depth (deferred until needed; full history is kept)
 *   - submodules (git submodules are not followed)
 *   - custom auth surface beyond the optional `opts.auth` bundle
 *     (the `buildAuthCallbacks` factory + `CloneOptions.auth?` /
 *     `FetchOptions.auth?` ledge; the GitHub Device Flow orchestrator
 *     wires it at the call sites). When `opts.auth` is omitted, clone
 *     and fetch behave as the public-only path.
 *
 * The wrapper is the canonical platform-git surface; the optional-auth
 * callbacks are consumed by isomorphic-git's onAuth / onAuthFailure hooks.
 */

export interface CloneOptions {
  /**
   * Working-tree directory. Must be on the same filesystem as its destination
   * parent if the caller plans to atomic-rename a clone into place.
   */
  dir: string;
  /**
   * Remote URL. Any `https://` git URL is accepted: github sources reconstruct
   * their canonical `https://github.com/<owner>/<repo>.git` form, while url
   * sources (MURL-01 / D-76-06) pass `source.url` verbatim. Auth is omitted
   * for public url clones (D-76-07); see `opts.auth` below.
   */
  url: string;
  /** Optional ref (branch/tag/SHA) to check out. If omitted, the default branch. */
  ref?: string;
  /** If a specific ref is given, fetch only that branch -- saves bandwidth. */
  singleBranch?: boolean;
  /**
   * Optional auth bundle. When provided, clone() builds
   * isomorphic-git `onAuth` / `onAuthFailure` callbacks via
   * `buildAuthCallbacks` and threads them into the underlying `git.clone`
   * call. When omitted, clone() behaves identically to the
   * public-only path (no network policy change for public clones; NFR-5
   * surfaces untouched).
   */
  auth?: { credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn };
}

export interface FetchOptions {
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`;
   * fetch() builds the callbacks when present and behaves as the
   * public-only path when omitted.
   */
  auth?: { credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn };
  dir: string;
  /** Default "origin". */
  remote?: string;
  /** Optional ref to fetch. */
  ref?: string;
}

export interface CheckoutOptions {
  dir: string;
  /** Branch, tag, or SHA. */
  ref: string;
  /** Default false. Set true to keep working-tree files at HEAD. */
  noCheckout?: boolean;
}

export interface ResolveRefOptions {
  dir: string;
  ref: string;
}

export interface ResolveRemoteRefOptions {
  /** Remote URL. */
  url: string;
  /**
   * Optional ref (branch or tag) to resolve. When omitted, the remote HEAD
   * (default branch) is resolved. Matches `refs/heads/<ref>`, `refs/tags/<ref>`,
   * a peeled annotated-tag target, or a bare `<ref>` name.
   */
  ref?: string;
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`; when present,
   * resolveRemoteRef builds isomorphic-git `onAuth`/`onAuthFailure` callbacks
   * via `buildAuthCallbacks` and threads them into `listServerRefs` so an
   * unpinned private-repo HEAD resolution can authenticate (PROV-03). When
   * omitted, the resolution behaves identically to the public-only path.
   */
  auth?: { credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn };
}

export interface ForceUpdateRefOptions {
  dir: string;
  ref: string;
  value: string;
}

export interface CurrentBranchOptions {
  dir: string;
}

export interface ListBranchesOptions {
  dir: string;
  /** Default undefined = local branches; pass "origin" for remote branches. */
  remote?: string;
}

export interface ListRemotesOptions {
  dir: string;
  /** Optional gitdir (defaults to `<dir>/.git`); typically omitted. */
  gitdir?: string;
}

export async function clone(opts: CloneOptions): Promise<void> {
  // When opts.auth is provided, build the isomorphic-git callbacks
  // up-front and conditionally spread them. When omitted, the public-only
  // path stays byte-identical.
  //
  // The `onAuthFailure as git.AuthFailureCallback` cast bridges to
  // isomorphic-git's AuthFailureCallback, whose `auth: GitAuth` parameter
  // declares optional fields as `string | undefined` (explicit-undefined)
  // while our `GitCredentials` uses `string?` (optional, no `| undefined`).
  // Under `exactOptionalPropertyTypes: true` the function-parameter
  // contravariance makes the assignment fail without a structural cast;
  // runtime shapes are identical. `onAuth` does not need the cast because
  // it only takes the `url: string` parameter -- no contravariant
  // GitAuth-typed slot.
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
    // No depth (full history is kept). No corsProxy (Node only).
  });
}

export async function fetch(opts: FetchOptions): Promise<void> {
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  await git.fetch({
    fs,
    http,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
  });
}

export async function checkout(opts: CheckoutOptions): Promise<void> {
  await git.checkout({
    fs,
    dir: opts.dir,
    ref: opts.ref,
    ...(opts.noCheckout !== undefined && { noCheckout: opts.noCheckout }),
  });
}

export async function resolveRef(opts: ResolveRefOptions): Promise<string> {
  return git.resolveRef({
    fs,
    dir: opts.dir,
    ref: opts.ref,
  });
}

/**
 * D-77-05 / PURL-09: resolve a remote ref (or the default-branch HEAD) to its
 * full commit SHA WITHOUT a full clone. Wraps isomorphic-git's
 * `listServerRefs` (protocol version 2 ref advertisement) so the install
 * clone-cache seam can pin an unpinned source at install time.
 *
 * `symrefs: true` makes the remote HEAD entry carry its `target` symref so an
 * unpinned resolution follows HEAD to the default branch; `peelTags: true`
 * peels annotated tags so a tag `ref` resolves to the underlying commit oid
 * (via the `refs/tags/<ref>^{}` peeled entry) rather than the tag object.
 *
 * Ref selection (opts.ref):
 *   - undefined: return the HEAD entry's oid (default-branch commit).
 *   - given: match `refs/heads/<ref>` / `refs/tags/<ref>` / a bare `<ref>`;
 *     for an annotated tag, prefer the `peeled` commit oid so the returned
 *     value is a commit, not the tag object.
 *
 * Auth is threaded through the optional `opts.auth` bundle so an unpinned
 * private-repo HEAD resolution can authenticate (PROV-03); omitted = the
 * public-only path. No sparse/partial fetch is exposed (documented
 * divergence; see the NOT-exposed list above).
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- listServerRefs({ http,
 * url, onAuth, onAuthFailure, protocolVersion, symrefs, peelTags }) =>
 * Promise<ServerRef[]>, where each ServerRef is { ref, oid, target?, peeled? }.
 */
export async function resolveRemoteRef(opts: ResolveRemoteRefOptions): Promise<string> {
  // Same conditional-spread + AuthFailureCallback cast idiom as clone() at the
  // top of this file: build the callbacks only when opts.auth is defined so the
  // public-only resolution stays byte-identical.
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const refs = await git.listServerRefs({
    http,
    url: opts.url,
    protocolVersion: 2,
    symrefs: true,
    peelTags: true,
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
  });

  if (opts.ref === undefined) {
    const head = refs.find((r) => r.ref === "HEAD");
    if (head === undefined) {
      throw new Error(`remote ${opts.url} advertised no HEAD ref`);
    }

    return head.oid;
  }

  const match = refs.find(
    (r) =>
      r.ref === `refs/heads/${opts.ref}` || r.ref === `refs/tags/${opts.ref}` || r.ref === opts.ref,
  );
  if (match === undefined) {
    throw new Error(`remote ${opts.url} has no ref "${opts.ref}"`);
  }

  // For an annotated tag the `peeled` field carries the commit the tag points
  // at; prefer it so a tag resolves to a commit, not the tag object.
  return match.peeled ?? match.oid;
}

/**
 * D-14 step 2 (symbolic HEAD): force-set a local ref to a given SHA.
 * Wraps isomorphic-git's `writeRef({ force: true })`. The
 * orchestrators call this via the GitOps interface; exposing it here
 * keeps orchestrator-tier code from importing isomorphic-git directly
 * (D-13).
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- writeRef({ fs, dir,
 * ref, value, force, symbolic? }).
 */
export async function forceUpdateRef(opts: ForceUpdateRefOptions): Promise<void> {
  await git.writeRef({
    fs,
    dir: opts.dir,
    ref: opts.ref,
    value: opts.value,
    force: true,
  });
}

/**
 * Return the symbolic name of the currently checked-out branch (e.g.
 * "main"), or undefined when HEAD is detached. Wraps isomorphic-git's
 * `currentBranch({ fs, dir })`.
 *
 * CR-01: required by the D-14 default-branch path so the orchestrator
 * can `forceUpdateRef("refs/heads/<branch>", remoteSha)` instead of
 * mistakenly using the HEAD SHA as a ref name (which produced a
 * meaningless `refs/<40-hex>` write).
 *
 * Source: node_modules/isomorphic-git/index.d.ts:1266 currentBranch
 * returns Promise<string | void>; we normalize void -> undefined.
 */
export async function currentBranch(opts: CurrentBranchOptions): Promise<string | undefined> {
  // isomorphic-git's currentBranch returns Promise<string | void>; the
  // void variant carries no string, so the ?? funnel normalizes to
  // undefined.
  const branch = await git.currentBranch({ fs, dir: opts.dir });
  return branch ?? undefined;
}

export async function listBranches(opts: ListBranchesOptions): Promise<string[]> {
  return git.listBranches({
    fs,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
  });
}

export async function listRemotes(
  opts: ListRemotesOptions,
): Promise<{ remote: string; url: string }[]> {
  return git.listRemotes({
    fs,
    dir: opts.dir,
    ...(opts.gitdir !== undefined && { gitdir: opts.gitdir }),
  });
}

/**
 * Credential shape consumed by isomorphic-git's onAuth / onAuthFailure callbacks.
 * Matches isomorphic-git's GitAuth; re-exported here so consumers
 * import from platform/git.ts (D-13 boundary) rather than
 * directly from isomorphic-git.
 */
export interface GitCredentials {
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  /** Set true to throw UserCanceledError instead of HttpError. */
  cancel?: boolean;
}

/**
 * Discriminated result returned by an `onAuthRequired`
 * closure. Both arms carry `authAttempted: true` so downstream onAuthFailure
 * logic can detect that an interactive auth attempt has already happened
 * (CP-9 retry-loop guard).
 *
 * Structurally identical to `domain/github-auth.ts::DeviceFlowResult`.
 * Declared LOCALLY in platform/git.ts so this module honors the
 * platform → domain import prohibition (`platform/README.md`: platform/
 * may import from shared/ and sibling platform/ files only). The
 * orchestrators pass `initiateDeviceFlow` directly as `onAuthRequired` and
 * TypeScript's structural typing accepts the assignment with no adapter --
 * no shared type declaration is needed across tiers.
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
 *   try/catch and convert any thrown error into `{ cancel: true }`. Error
 *   messages from CredentialOps and onAuthRequired are intentionally NOT
 *   interpolated into return values, log lines, or notify calls -- a
 *   credential could be interpolated into an upstream Error, so dropping
 *   the message on the floor is the AUTH-09 default.
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

      return { cancel: true };
    } catch {
      // CP-10: catch ANY thrown error from fill / onAuthRequired and turn
      // it into a cancel. The Error message is dropped on the floor --
      // a credential could legitimately appear inside an upstream Error
      // (subprocess output, Device Flow HTTP error), so interpolating it
      // into a log line or rethrown error would violate AUTH-09.
      return { cancel: true };
    }
  }

  async function onAuthFailure(_url: string, cred: GitCredentials): Promise<GitCredentials> {
    try {
      await opts.credentialOps.reject(opts.host, cred);
    } catch {
      // CP-10: swallow any reject() throw and still return cancel below.
      // The credential has not been evicted from the keychain, but the
      // current operation will not retry against this seam regardless.
    }

    // CP-9: ALWAYS cancel. Returning a fresh credential here would
    // re-enter isomorphic-git's auth loop; the next operation invokes
    // onAuth which performs the right thing (fill miss -> Device Flow).
    return { cancel: true };
  }

  return { onAuth, onAuthFailure };
}
