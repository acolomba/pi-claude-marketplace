import * as fs from "node:fs";
import * as path from "node:path";

import * as git from "isomorphic-git";
import nodeHttpClient from "isomorphic-git/http/node";

import { CrossOriginChallengeError, TooManyRedirectsError } from "../shared/errors.ts";

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
  /**
   * Default false. isomorphic-git's checkout skips writing a file whose
   * index entry already matches the target commit, even when the file is
   * absent from the actual working tree (it diffs index vs. commit, not
   * disk vs. commit). Set true when `dir`'s work tree may be empty or
   * incomplete relative to its own index -- for example a `.git`-only copy
   * checked out into a fresh, empty directory -- so every file the target
   * tree names gets written regardless of what the index already claims.
   */
  force?: boolean;
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

export interface ListRemoteTagsOptions {
  /** Remote URL. */
  url: string;
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`; when present,
   * listRemoteTags builds isomorphic-git `onAuth`/`onAuthFailure` callbacks via
   * `buildAuthCallbacks` and threads them into `listServerRefs`, so a private
   * source repository's tags are readable through the one credential path the
   * remote-ref resolution above already uses (RESV-03). When omitted, the
   * listing behaves identically to the public-only path.
   */
  auth?: BuildAuthCallbacksOpts;
}

/** One advertised tag, resolved to the object the tag names. */
export interface RemoteTag {
  /** The advertised ref with its `refs/tags/` prefix removed. */
  name: string;
  /**
   * The object id the tag resolves to. For an annotated tag this is the commit
   * the tag points at, not the tag object.
   */
  oid: string;
}

export interface ListTagsOptions {
  /** Working-tree directory of a local repository. */
  dir: string;
}

export interface ResolveTagOidOptions {
  /** Working-tree directory of a local repository. */
  dir: string;
  /** Tag name, with no `refs/tags/` prefix. */
  name: string;
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
 * what its `origin` remote names. Five arms:
 *   - `origin`: a readable repo whose `origin` remote records exactly one
 *     url; `url` is that value, verbatim.
 *   - `no-origin`: a readable repo whose `origin` remote records no url or
 *     more than one.
 *   - `not-a-repo`: `dir` has no `.git/config` (ENOENT/ENOTDIR).
 *   - `permission-denied`: the process may not read `dir/.git/config`
 *     (EACCES/EPERM).
 *   - `unreadable`: reading `dir/.git/config` failed with any other error.
 */
export type ListRemotesResult =
  | { readonly kind: "origin"; readonly url: string }
  | { readonly kind: "no-origin" }
  | { readonly kind: "not-a-repo" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "unreadable" };

/** The redirect cap of `simple-get`, which `http` keeps. */
const MAX_REDIRECTS = 10;

/**
 * WR-03: the only headers a hop keeps when its origin differs from the
 * original request's. isomorphic-git sets `accept`, `content-type` and
 * `git-protocol`; `simple-get` sets `accept-encoding` and `content-length`.
 */
const CROSS_ORIGIN_HEADERS: ReadonlySet<string> = new Set([
  "accept",
  "accept-encoding",
  "content-length",
  "content-type",
  "git-protocol",
  "user-agent",
]);

/** Headers that describe a request body; they go with the body. */
const BODY_HEADERS: ReadonlySet<string> = new Set(["content-length", "content-type"]);

/** Redirect statuses on which a POST is re-sent as a GET. */
const POST_TO_GET_STATUSES: ReadonlySet<number> = new Set([301, 302]);

/** Q-02: the statuses on which isomorphic-git's `discover` calls `onAuth`. */
const CHALLENGE_STATUSES: ReadonlySet<number> = new Set([401, 203]);

/** What one hop of a redirect chain passes to the next. */
interface RedirectChain {
  /** `URL.origin` of the original request. */
  readonly origin: string;
  /** Redirects followed so far. */
  readonly redirects: number;
  /** Whether any hop so far was on another origin than the original request's. */
  readonly leftOrigin: boolean;
}

function headersWhere(
  headers: Record<string, string>,
  keep: (lowerCaseName: string) => boolean,
): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => keep(name.toLowerCase())));
}

/**
 * The target of a redirect, or undefined when `response` goes back to
 * isomorphic-git: a status outside 3xx, or a `Location` that is absent, empty
 * or not a URL (WR-04, IN-02).
 */
function redirectTarget(response: GitHttpResponse, base: string): URL | undefined {
  const { statusCode, headers = {} } = response;
  const location = headers.location;
  if (statusCode < 300 || statusCode >= 400 || location === undefined || location.trim() === "") {
    return undefined;
  }

  return URL.canParse(location, base) ? new URL(location, base) : undefined;
}

/** Builds the request for the hop that `statusCode` redirected to `target`. */
function nextHop(
  hop: GitHttpRequest,
  statusCode: number,
  target: URL,
  origin: string,
): GitHttpRequest {
  const { headers = {}, body, ...rest } = hop;
  const kept =
    target.origin === origin
      ? headers
      : headersWhere(headers, (name) => CROSS_ORIGIN_HEADERS.has(name));
  if (hop.method === "POST" && POST_TO_GET_STATUSES.has(statusCode)) {
    return {
      ...rest,
      url: target.href,
      method: "GET",
      headers: headersWhere(kept, (name) => !BODY_HEADERS.has(name)),
    };
  }

  return { ...rest, url: target.href, headers: kept, ...(body !== undefined && { body }) };
}

async function sendHop(hop: GitHttpRequest, chain: RedirectChain): Promise<GitHttpResponse> {
  const response = await nodeHttpClient.request({
    ...hop,
    fetchOptions: { followRedirects: false },
  });
  const target = redirectTarget(response, hop.url);
  if (target === undefined) {
    if (chain.leftOrigin && CHALLENGE_STATUSES.has(response.statusCode)) {
      await response.body?.return?.();
      throw new CrossOriginChallengeError(new URL(hop.url).origin);
    }

    return response;
  }

  await response.body?.return?.();
  if (chain.redirects === MAX_REDIRECTS) {
    throw new TooManyRedirectsError();
  }

  return sendHop(nextHop(hop, response.statusCode, target, chain.origin), {
    origin: chain.origin,
    redirects: chain.redirects + 1,
    leftOrigin: chain.leftOrigin || target.origin !== chain.origin,
  });
}

async function requestWithinOrigin(original: GitHttpRequest): Promise<GitHttpResponse> {
  return sendHop(original, {
    origin: new URL(original.url).origin,
    redirects: 0,
    leftOrigin: false,
  });
}

/**
 * The HTTP client every isomorphic-git call in this file uses (GAUTH-06).
 *
 * `simple-get@4.0.1`, under `isomorphic-git/http/node`, follows redirects on
 * its own and drops `authorization` and `cookie` only when the hostname
 * changes (node_modules/simple-get/index.js:55-60). This client sends each hop
 * with `followRedirects: false`, gets every 3xx back unchanged, and follows
 * the redirect itself.
 *
 * Origin rule (WR-03). The origin is the scheme, host and port as `URL.origin`
 * normalizes them, compared with the original request's. A hop on another
 * origin keeps only `accept`, `accept-encoding`, `content-length`,
 * `content-type`, `git-protocol` and `user-agent`. The credential, a cookie
 * and any header the credential brings stay behind. `onAuth` applies the same
 * normalization to the bound host. Each hop starts from the previous one, so a
 * header dropped once stays dropped, also after the chain returns to the
 * original origin.
 *
 * Challenges (Q-02). When a hop answers 401 or 203 after any hop of the chain
 * left the original origin, the client throws `CrossOriginChallengeError`
 * before isomorphic-git's auth loop sees the response. No credential is looked
 * up, evicted or minted for that server. git would ask its credential helper
 * for the target's own credential, but isomorphic-git calls `onAuth` only with
 * the original URL, so this stays the recorded DD-3 capability gap.
 *
 * Parity scope (IN-01). git follows a redirect only on its initial `info/refs`
 * request (`http.followRedirects=initial`) and sends later requests to the
 * redirected base URL. This client follows redirects on every request,
 * including the `git-upload-pack` POST, and isomorphic-git sends every request
 * to the original URL.
 *
 * The other redirect rules come from `simple-get`. After 10 redirects the next
 * one throws `TooManyRedirectsError` (IN-03). A 3xx whose `Location` is absent,
 * empty or not a URL is returned unchanged, and isomorphic-git raises
 * `HttpError` with the server's status (WR-04, IN-02). The body of a redirect
 * is discarded. A POST answered with 301 or 302 becomes a GET without its
 * body, `content-type` and `content-length`. A POST answered with 303, 307 or
 * 308 keeps its method, as `simple-get` does, although RFC 9110 section 15.4.4
 * makes a 303 a GET. It also keeps its body, where `simple-get` re-sends an
 * empty one. isomorphic-git's request bodies are arrays, so the same reference
 * sends the same bytes again.
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
    ...(opts.force !== undefined && { force: opts.force }),
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

/** Ref namespace a tag advertisement is filtered to -- the `--tags` equivalent. */
const TAG_REF_PREFIX = "refs/tags/";

/**
 * Suffix an advertisement uses when it names the peel of an annotated tag as a
 * ref of its own. That peel already rides on the tag's own entry, so an entry
 * spelled this way duplicates one the listing has already returned.
 */
const PEELED_REF_SUFFIX = "^{}";

/**
 * RESV-03 / D-03-02.2: read a remote's tag list WITHOUT a clone, so a
 * dependency carrying a version constraint can be pinned to whichever release
 * tag satisfies it. Wraps isomorphic-git's `listServerRefs` (protocol version 2
 * ref advertisement), the same call `resolveRemoteRef` above makes, with the
 * ref-prefix option supplied and no head-ref branch.
 *
 * D-03-03 amends NFR-5 for exactly this read: resolving a constrained
 * dependency may query its source repository's tags even when a cached or
 * otherwise resolvable copy of that dependency already exists, because the
 * constraint can demand a different tag than the cached one.
 *
 * `prefix: "refs/tags/"` filters the advertisement server-side and is the
 * `git ls-remote --tags` equivalent; `peelTags: true` makes an annotated tag's
 * entry carry the commit it points at in `peeled`. Each entry prefers `peeled`
 * over its own `oid`, the same preference `resolveRemoteRef` states, so an
 * annotated tag resolves to a commit rather than to the tag object. An entry
 * naming a peel as a ref of its own is dropped as a duplicate, and an entry
 * outside the tag namespace is dropped because this function returns tags only.
 *
 * A remote advertising no matching refs yields an empty array rather than
 * throwing. A transport failure propagates as isomorphic-git threw it:
 * classifying what a failed listing means belongs to the caller that knows
 * which operation it was serving.
 *
 * Auth is threaded through the optional `opts.auth` bundle -- the same bundle
 * `resolveRemoteRef` takes, so a private source repository needs no second
 * credential path; omitted = the public-only path.
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- listServerRefs({ http,
 * url, onAuth, onAuthFailure, protocolVersion, prefix, peelTags }) =>
 * Promise<ServerRef[]>, where each ServerRef is { ref, oid, target?, peeled? }.
 */
export async function listRemoteTags(opts: ListRemoteTagsOptions): Promise<RemoteTag[]> {
  // Same conditional-spread + AuthFailureCallback cast idiom as clone() at the
  // top of this file: build the callbacks only when opts.auth is defined so the
  // public-only listing stays byte-identical.
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const refs = await git.listServerRefs({
    http,
    url: opts.url,
    protocolVersion: 2,
    prefix: TAG_REF_PREFIX,
    peelTags: true,
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
  });

  const tags: RemoteTag[] = [];
  for (const advertised of refs) {
    if (!advertised.ref.startsWith(TAG_REF_PREFIX)) {
      continue;
    }

    const name = advertised.ref.slice(TAG_REF_PREFIX.length);
    if (name.endsWith(PEELED_REF_SUFFIX)) {
      continue;
    }

    tags.push({ name, oid: advertised.peeled ?? advertised.oid });
  }

  return tags;
}

/**
 * D-07-05: local, network-free counterpart of `listRemoteTags` -- the tag
 * names a local checkout already carries on disk. Wraps isomorphic-git's
 * `listTags({ fs, dir })`, which returns bare tag names with no oid; a name
 * alone is not the object a caller reads back through `resolveTagOid`.
 *
 * A `path`-source dependency has no remote repository of its own to query;
 * its release tags live on the marketplace clone that already sits on disk,
 * so this reads THAT clone's own `refs/tags/` namespace with no network call
 * (TAGS-01).
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- listTags({ fs, dir,
 * gitdir }) => Promise<Array<string>>.
 */
export async function listTags(opts: ListTagsOptions): Promise<string[]> {
  return git.listTags({ fs, dir: opts.dir });
}

/**
 * Bounds a tag-of-tag peel chain in `resolveTagOid` so a cyclic or
 * pathological annotated-tag graph cannot loop forever. No real release
 * tooling produces a chain this long; the bound exists only to make a
 * corrupt history fail fast rather than hang.
 */
const MAX_TAG_PEEL_HOPS = 10;

/**
 * D-07-05: resolve a LOCAL tag name to the commit it names, peeling an
 * annotated tag to the commit it points at. The local counterpart of
 * `listRemoteTags`' `peeled ?? oid` preference (D-03-02.2 pins the remote
 * path) -- for an annotated tag the tag OBJECT's own oid is never what a
 * caller wants, only the commit it tags.
 *
 * Resolves `refs/tags/<name>` via `resolveRef`, then attempts `readTag` on the
 * result:
 *   - a throw means the oid already names a non-tag object (a LIGHTWEIGHT tag
 *     resolves directly to its target); the target's own type decides the
 *     result -- a commit is returned as-is, anything else (blob / tree) is
 *     not checkout-able and yields `undefined`;
 *   - `tag.type === "commit"` returns `tag.object`, the commit the tag names;
 *   - `tag.type === "tag"` is a tag pointing at another tag; the peel repeats
 *     on that tag's own object, bounded by `MAX_TAG_PEEL_HOPS` so a
 *     tag-of-tag chain cannot loop;
 *   - any other tagged type (`blob` / `tree`) is not a commit at all and
 *     cannot be checked out as one; `undefined` is returned, and the caller
 *     is responsible for dropping a candidate that does not resolve to a
 *     commit.
 *   - exhausting `MAX_TAG_PEEL_HOPS` without reaching a commit means the
 *     chain never terminated within the bound; `undefined` is returned for
 *     the same reason -- there is no commit oid to hand back.
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- resolveRef({ fs, dir, ref
 * }) => Promise<string>; readTag({ fs, dir, gitdir, oid }) => Promise<{ oid,
 * tag: TagObject, payload }>, where TagObject.type is "blob" | "tree" |
 * "commit" | "tag" and TagObject.object is the oid of the tagged object.
 */
export async function resolveTagOid(opts: ResolveTagOidOptions): Promise<string | undefined> {
  let oid = await git.resolveRef({ fs, dir: opts.dir, ref: `refs/tags/${opts.name}` });

  for (let hop = 0; hop < MAX_TAG_PEEL_HOPS; hop++) {
    let read: Awaited<ReturnType<typeof git.readTag>>;
    try {
      read = await git.readTag({ fs, dir: opts.dir, oid });
    } catch {
      // Not a tag object: a LIGHTWEIGHT tag names its target directly. Only a
      // commit is checkout-able, so anything else -- a blob, a tree, or an
      // unreadable object -- is dropped like an annotated blob/tree tag is.
      try {
        await git.readCommit({ fs, dir: opts.dir, oid });
        return oid;
      } catch {
        return undefined;
      }
    }

    if (read.tag.type === "commit") {
      return read.tag.object;
    }

    if (read.tag.type !== "tag") {
      return undefined;
    }

    oid = read.tag.object;
  }

  return undefined;
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
 * `git.getConfigAll`, and uses that read alone to choose among the
 * `not-a-repo`, `permission-denied` and `unreadable` arms. This ordering is required, not
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

    if (code === "EACCES" || code === "EPERM") {
      return { kind: "permission-denied" };
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
