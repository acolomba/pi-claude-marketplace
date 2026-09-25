import * as fs from "node:fs";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { buildAuthCallbacks } from "./git-auth-callbacks.ts";

import type { OnAuthRequiredFn } from "./git-auth-callbacks.ts";
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
 * NOT exposed:
 *   - sparse checkout (PRD §11 deferred; isomorphic-git also doesn't support it)
 *   - shallow clones / depth (deferred until needed; full history is kept)
 *   - submodules (git submodules are not followed)
 *   - custom auth surface beyond the optional `opts.auth` bundle
 *     (`platform/git-auth-callbacks.ts::buildAuthCallbacks` + the
 *     `CloneOptions.auth?` / `FetchOptions.auth?` ledge; the GitHub Device
 *     Flow orchestrator wires it at the call sites). When `opts.auth` is
 *     omitted, clone and fetch behave as the public-only path.
 *
 * The wrapper is the canonical platform-git surface; the optional-auth
 * callbacks are consumed by isomorphic-git's onAuth / onAuthFailure hooks.
 * `OnAuthRequiredFn` is re-exported because the three option bundles below
 * name it, so a consumer of those options reads the seam from the same
 * module (D-13 boundary) rather than reaching past it.
 */

export type { OnAuthRequiredFn };

export interface CloneOptions {
  /**
   * Working-tree directory. Must be on the same filesystem as its destination
   * parent if the caller plans to atomic-rename a clone into place.
   */
  dir: string;
  /**
   * Remote URL. Any `https://` git URL is accepted: github sources reconstruct
   * their canonical `https://github.com/<owner>/<repo>.git` form, while url
   * sources (MURL-01 / D-76-06) supply their canonical `source.url` passed
   * through `domain/source.ts::ensureGitSuffix` -- the stored identity form is
   * `.git`-stripped, the wire form is not. Auth is omitted for public url
   * clones (D-76-07); see `opts.auth` below.
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

/**
 * Some smart-HTTP git servers (e.g. Bifrost's /skills/serve/* endpoints) only
 * answer at the verbatim URL and 404 the conventional `.git` suffix. Callers
 * pass the conventional suffixed form; try the suffix-less form first and
 * fall back to the URL as given.
 */
function desuffixGitUrl(url: string): string {
  return url.endsWith(".git") ? url.slice(0, -".git".length) : url;
}

function isSuffixHttpError(err: unknown): boolean {
  if (err instanceof git.Errors.HttpError) {
    return err.data.statusCode === 404 || err.data.statusCode === 400;
  }

  const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
  return statusCode === 404 || statusCode === 400;
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
  const doClone = (url: string) =>
    git.clone({
      fs,
      http,
      dir: opts.dir,
      url,
      ...(opts.ref !== undefined && { ref: opts.ref }),
      ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
      ...(authCbs !== undefined && {
        onAuth: authCbs.onAuth,
        onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
      }),
      // No depth (full history is kept). No corsProxy (Node only).
    });

  try {
    await doClone(opts.url);
  } catch (err) {
    const bare = desuffixGitUrl(opts.url);

    if (bare !== opts.url && isSuffixHttpError(err)) {
      await fs.promises.rm(opts.dir, { recursive: true, force: true }).catch(() => {});
      await doClone(bare);
    } else {
      throw err;
    }
  }
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
  const listRefs = (url: string) =>
    git.listServerRefs({
      http,
      url,
      protocolVersion: 2,
      symrefs: true,
      peelTags: true,
      ...(authCbs !== undefined && {
        onAuth: authCbs.onAuth,
        onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
      }),
    });

  let refs: Awaited<ReturnType<typeof listRefs>> | undefined;

  try {
    refs = await listRefs(opts.url);
  } catch (err) {
    const bare = desuffixGitUrl(opts.url);

    if (bare !== opts.url && isSuffixHttpError(err)) {
      refs = await listRefs(bare);
    } else {
      throw err;
    }
  }

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
 * Source: node_modules/isomorphic-git/index.d.ts:1283-1289 currentBranch
 * returns Promise<string | void>; we normalize void -> undefined.
 */
export async function currentBranch(opts: CurrentBranchOptions): Promise<string | undefined> {
  // isomorphic-git's currentBranch returns Promise<string | void>; the
  // void variant carries no string, so the ?? funnel normalizes to
  // undefined.
  const branch = await git.currentBranch({ fs, dir: opts.dir });
  return branch ?? undefined;
}

export interface ListRemotesOptions {
  dir: string;
  /** Optional gitdir (defaults to `<dir>/.git`); typically omitted. */
  gitdir?: string;
}

/**
 * NFR-3: list the `git remote` entries of an existing working tree. The
 * marketplace orchestrator's MA-6 adopt check consumes it to recognize a
 * leftover clone of the same source; non-git trees reject (isomorphic-git
 * NotFoundError) and the caller treats them as foreign.
 *
 * Source: node_modules/isomorphic-git/index.d.ts listRemotes.
 */
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
