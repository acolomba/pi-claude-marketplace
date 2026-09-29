import * as fs from "node:fs";
import * as path from "node:path";

import * as git from "isomorphic-git";
import nodeHttpClient from "isomorphic-git/http/node";

import { buildAuthCallbacks } from "./git-auth-callbacks.ts";

import type { BuildAuthCallbacksOpts } from "./git-auth-callbacks.ts";
import type { GitHttpRequest, GitHttpResponse, HttpClient } from "isomorphic-git/http/node";

/**
 * platform/git.ts -- isomorphic-git wrapper (D-18, D-19, D-20).
 *
 * Uses pure-JS `isomorphic-git`, so there is no `git not found on PATH`
 * failure mode (D-21, MA-7).
 *
 * Pins `fs` (Node's built-in) and `http` so the marketplace orchestrators
 * don't thread them through every call. `http` is the module-private client
 * below: it sends each hop through `isomorphic-git/http/node` and follows
 * redirects itself, so a credential never reaches another origin (GAUTH-06).
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
 */

export interface CloneOptions {
  /**
   * Working-tree directory. Must be on the same filesystem as its destination
   * parent if the caller plans to atomic-rename a clone into place.
   */
  dir: string;
  /**
   * Remote URL. Any `https://` git URL is accepted, already derived by
   * `domain/clone-key.ts::networkCloneUrl`: github sources reconstruct their
   * suffixed canonical `https://github.com/<owner>/<repo>.git` form, while
   * url and git-subdir sources supply the verbatim form the user typed. The
   * stored identity form is `.git`-stripped; the wire form is not. Callers
   * pass a host-keyed `opts.auth` bundle (GAUTH-03); a public clone never
   * challenges, so the bundle is not consulted.
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
  auth?: BuildAuthCallbacksOpts;
}

export interface FetchOptions {
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`;
   * fetch() builds the callbacks when present and behaves as the
   * public-only path when omitted.
   */
  auth?: BuildAuthCallbacksOpts;
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
  auth?: BuildAuthCallbacksOpts;
}

export interface ForceUpdateRefOptions {
  dir: string;
  ref: string;
  value: string;
}

export interface CurrentBranchOptions {
  dir: string;
}

export interface ListRemotesOptions {
  dir: string;
}

/**
 * D-3-03 / MA-12 / MA-13: whether `dir` holds a readable git clone and, if so,
 * what its `origin` remote names. Four arms:
 *   - `origin`: a readable repo whose `origin` remote records exactly one
 *     url; `url` is that value, verbatim.
 *   - `no-origin`: a readable repo whose `origin` remote records no url or
 *     more than one.
 *   - `not-a-repo`: `dir` has no `.git/config` (ENOENT/ENOTDIR).
 *   - `unreadable`: `dir/.git/config` exists but could not be read.
 */
export type ListRemotesResult =
  | { readonly kind: "origin"; readonly url: string }
  | { readonly kind: "no-origin" }
  | { readonly kind: "not-a-repo" }
  | { readonly kind: "unreadable" };

/** The redirect cap of `simple-get`, which `http` keeps. */
const MAX_REDIRECTS = 10;

/** Headers a hop loses when it leaves the origin of the original request. */
const CROSS_ORIGIN_HEADERS: ReadonlySet<string> = new Set(["authorization", "cookie"]);

/** Headers that describe a request body; they go with the body. */
const BODY_HEADERS: ReadonlySet<string> = new Set(["content-length", "content-type"]);

/** Redirect statuses on which a POST is re-sent as a GET. */
const POST_TO_GET_STATUSES: ReadonlySet<number> = new Set([301, 302]);

function withoutHeaders(
  headers: Record<string, string>,
  names: ReadonlySet<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !names.has(name.toLowerCase())),
  );
}

/** The `Location` of a redirect, or undefined when `response` is final. */
function redirectLocation(response: GitHttpResponse): string | undefined {
  const { statusCode, headers = {} } = response;
  return statusCode >= 300 && statusCode < 400 ? headers.location : undefined;
}

/** Builds the request for the hop that `statusCode` redirected to `target`. */
function nextHop(
  hop: GitHttpRequest,
  statusCode: number,
  target: URL,
  origin: string,
): GitHttpRequest {
  const { headers = {}, body, ...rest } = hop;
  const kept = target.origin === origin ? headers : withoutHeaders(headers, CROSS_ORIGIN_HEADERS);
  if (hop.method === "POST" && POST_TO_GET_STATUSES.has(statusCode)) {
    return {
      ...rest,
      url: target.href,
      method: "GET",
      headers: withoutHeaders(kept, BODY_HEADERS),
    };
  }

  return { ...rest, url: target.href, headers: kept, ...(body !== undefined && { body }) };
}

async function sendHop(
  hop: GitHttpRequest,
  origin: string,
  redirects: number,
): Promise<GitHttpResponse> {
  const response = await nodeHttpClient.request({
    ...hop,
    fetchOptions: { followRedirects: false },
  });
  const location = redirectLocation(response);
  if (location === undefined) {
    return response;
  }

  await response.body?.return?.();
  if (redirects === MAX_REDIRECTS) {
    throw new Error("too many redirects");
  }

  const target = new URL(location, hop.url);
  return sendHop(nextHop(hop, response.statusCode, target, origin), origin, redirects + 1);
}

async function requestWithinOrigin(original: GitHttpRequest): Promise<GitHttpResponse> {
  return sendHop(original, new URL(original.url).origin, 0);
}

/**
 * The HTTP client every isomorphic-git call in this file uses (GAUTH-06).
 *
 * `simple-get@4.0.1`, under `isomorphic-git/http/node`, follows redirects on
 * its own. It drops `authorization` and `cookie` only when the hostname
 * changes (node_modules/simple-get/index.js:55-60). So on its own it forwards
 * the credential to another port, or to `http:`, on the same hostname. This
 * client therefore sends each hop with `followRedirects: false`, gets every
 * 3xx back unchanged, and follows the redirect itself.
 *
 * The rule is the origin, compared with the original request: scheme, host and
 * port as `URL.origin` normalizes them, with the default port removed. A hop
 * on another origin loses `authorization` and `cookie`. `onAuth` applies the
 * same normalization to the bound host. Each hop starts from the previous one,
 * so a header dropped once stays dropped.
 *
 * A cross-origin redirect is still followed, as git does over libcurl: libcurl
 * 7.83 and later sends credentials only to the scheme, host and port of the
 * original URL (CVE-2022-27776). If the target asks for credentials,
 * isomorphic-git's auth loop ends in the cancel from `onAuthFailure`.
 *
 * Every other redirect rule is the one `simple-get` applies. After 10
 * redirects the next one throws `too many redirects`. A 3xx without a
 * `Location` is returned unchanged. The body of a redirect is discarded. A POST
 * answered with 301 or 302 becomes a GET without its body, `content-type` and
 * `content-length`. A 307 or 308 keeps the method and the body, where
 * `simple-get` re-sends an empty one. isomorphic-git's request bodies are
 * arrays, so the same reference sends the same bytes again.
 */
const http: HttpClient = { request: requestWithinOrigin };

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

/**
 * D-3-03 / MA-12 / MA-13: report whether `dir` is a readable git clone and,
 * if so, what its `origin` remote names -- WITHOUT throwing. This is the only
 * function in this file that reports failure as a return value instead of a
 * throw: every sibling above throws on absence, ambiguity, or a read error,
 * but a caller here (`marketplace add`'s leftover-clone recognition) must
 * tell "this is definitely a foreign or unreadable tree" apart from "I could
 * not look at all", and a catch block collapses that distinction.
 *
 * The function reads `<dir>/.git/config` itself, BEFORE calling
 * `git.getConfigAll`, and uses that read alone to choose between the
 * `not-a-repo` and `unreadable` arms. This ordering is required, not
 * stylistic: isomorphic-git's internal filesystem wrapper
 * (node_modules/isomorphic-git/index.js, the `read` helper backing
 * `GitConfigManager.get`) catches every filesystem error and resolves `null`,
 * so `git.getConfigAll({ fs, dir, path })` returns `[]` identically for a
 * missing `.git`, an unreadable `.git/config`, and a real repo with no origin
 * url -- wrapping the library call in a `try`/`catch` would be unreachable
 * code, and the 100%-branch gate would have no way to cover it. The probe
 * read doubles as the existence check, so no separate `stat` is needed.
 *
 * git fetches from the FIRST `url` under `origin`, and the library's
 * single-value config read returns the LAST. The function therefore reads
 * every `remote.origin.url` value, in file order, across every
 * `[remote "origin"]` section, and reports `origin` only for exactly one
 * value. No value and two or more values report `no-origin`, which the caller
 * refuses (D-3-03, MA-13). The check is on the value's type
 * because the library declares the values `any`, so any string, including an
 * empty one, reaches the caller verbatim. The read folds the section name's
 * case as git does, so a capitalized `Remote` section names the origin remote.
 *
 * The returned `url`, when present, is the wire form stored on disk,
 * verbatim. This tier may not import `domain/` (the `platform` zone's
 * `.fallowrc.json` boundary allows only `shared`), so the identity
 * comparison against `canonicalCloneUrl` belongs to the caller.
 */
export async function listRemotes(opts: ListRemotesOptions): Promise<ListRemotesResult> {
  try {
    await fs.promises.readFile(path.join(opts.dir, ".git", "config"));
  } catch (err) {
    // `readFile` rejects only with a `NodeJS.ErrnoException`.
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "not-a-repo" };
    }

    return { kind: "unreadable" };
  }

  const urls: readonly unknown[] = await git.getConfigAll({
    fs,
    dir: opts.dir,
    path: "remote.origin.url",
  });
  const url = urls[0];
  return urls.length === 1 && typeof url === "string"
    ? { kind: "origin", url }
    : { kind: "no-origin" };
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
