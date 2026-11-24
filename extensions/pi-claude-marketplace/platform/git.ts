import { AsyncLocalStorage } from "node:async_hooks";
import * as fs from "node:fs";
import * as path from "node:path";

import * as git from "isomorphic-git";
import nodeHttpClient from "isomorphic-git/http/node";

import { hookDebugLog } from "../shared/debug-log.ts";
import {
  CrossOriginChallengeError,
  FetchedUrlCause,
  GitCommandError,
  StoredCredentialRejectedError,
  TooManyRedirectsError,
} from "../shared/errors.ts";
import { gitHubInsteadOfPairs, gitHubWireUrl } from "../shared/github-base-url.ts";

import { buildAuthCallbacks } from "./git-auth-callbacks.ts";
import { withOneShotCredential } from "./git-one-shot-credential.ts";
import { NODE_GIT_PROCESS } from "./git-process.ts";
import { gitTimeoutMs } from "./git-timeout.ts";

import type { BuildAuthCallbacksOpts } from "./git-auth-callbacks.ts";
import type { GitProcess, GitRequest, GitResult } from "./git-process.ts";
import type { GitHttpRequest, GitHttpResponse, HttpClient } from "isomorphic-git/http/node";

/**
 * platform/git.ts -- isomorphic-git wrapper (D-18, D-19, D-20).
 *
 * D-SG-01 (reverses D-21): the network verbs `clone`, `fetch`,
 * `fetchCommit`, `resolveRemoteRef`, and `listRemoteTags` need system git.
 * Each first asks `platform/git-process.ts` for it, so with no usable git on
 * PATH they reject with that module's `git-missing` GitCommandError before
 * isomorphic-git runs or a request goes out (SG-PRC-06).
 *
 * SG-TRN-01: `fetchCommit`, `resolveRemoteRef`, and `listRemoteTags` send
 * their requests with system git through `runRemote`, the one network request path of this
 * module: the network lane, the D-SG-13 limit, the D-PL8-24 abort signal, and
 * the D-SG-16 `insteadOf` pair. `checkout`, `resolveRef`, and `listRemotes`
 * run system git through `NODE_GIT_PROCESS` on the local lane, which reaches
 * no transport. `resolveRef` answers undefined for a ref that names no commit, and
 * `resolveRemoteRef` for a ref the remote does not advertise. The other local
 * verbs still run in-process with pure-JS `isomorphic-git` and need no git, so
 * a path-source marketplace still reads its own release tags without one
 * (TAGS-01). Each
 * system-git function takes the git process as a defaulted last parameter,
 * and every request it sends takes its limit from `gitTimeoutMs()` (D-SG-13).
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
 *
 * D-PL8-24: `runWithGitAbortSignal` runs a call inside an abort scope. When
 * its signal aborts, `http` stops the hop in flight and the response body
 * being read, so the network call fails like a network drop mid-request.
 * Local operations do not read the scope.
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
   *
   * The URL actually sent is `shared/github-base-url.ts::gitHubWireUrl` of
   * this value; the clone's recorded origin stays this value.
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
  /** INR-06: also fetch tags (isomorphic-git fetches only branches by default). */
  tags?: boolean;
}

export interface FetchCommitOptions {
  /** The clone to fetch into. */
  dir: string;
  /** The full id of the commit to fetch. */
  sha: string;
  /**
   * The ref the source names. The `--unshallow` rung fetches it as well,
   * because a depth-1 clone's fetch refspec names only the branch it cloned.
   */
  ref?: string;
  /**
   * Optional auth bundle. git asks the user's credential helpers itself; the
   * bundle decides what an auth failure of a rung leads to (D-SG-14, GAUTH-04).
   */
  auth?: BuildAuthCallbacksOpts;
}

export interface CheckoutOptions {
  dir: string;
  /** Branch, tag, or SHA. */
  ref: string;
  /**
   * D-SG-11, SG-MIG-01: set true when `dir/.git` is a copy of another clone's
   * git directory. The checkout then first unsets `core.symlinks`,
   * `core.ignorecase`, and `core.filemode` in the copy's config, the keys an
   * `isomorphic-git` clone carries, so git decides them for this machine as
   * it does for a fresh clone. No key is written (D-SG-12).
   */
  fromCopiedGitDir?: boolean;
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
   * Optional auth bundle. Same shape as `CloneOptions.auth`. git asks the
   * user's credential helpers itself; the bundle decides what an auth failure
   * of the request leads to (PROV-03).
   */
  auth?: BuildAuthCallbacksOpts;
}

export interface ListRemoteTagsOptions {
  /** Remote URL. */
  url: string;
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`; it maps an auth
   * failure of the listing as it does for `resolveRemoteRef` (RESV-03).
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
  /**
   * isomorphic-git object cache. Peels that share one cache load each packfile
   * into memory once instead of once per peel.
   */
  cache: object;
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

/** Sends one hop; the abort scope may wrap it. */
type HopSender = (hop: GitHttpRequest) => Promise<GitHttpResponse>;

/** D-PL8-24: the abort signal of the call that runs in the current async context. */
const gitAbortScope = new AsyncLocalStorage<AbortSignal>();

/** D-PL8-24: signals whose abort cut off a request or a body read that had not settled. */
const interruptedSignals = new WeakSet<AbortSignal>();

/**
 * D-PL8-24: runs `run` in an abort scope. Each HTTP request that `run` makes
 * through this module rejects with `signal.reason` once `signal` aborts.
 */
export function runWithGitAbortSignal<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  return gitAbortScope.run(signal, run);
}

function sendPlainHop(hop: GitHttpRequest): Promise<GitHttpResponse> {
  return nodeHttpClient.request({ ...hop, fetchOptions: { followRedirects: false } });
}

/**
 * Settles as `pending` does, or rejects with the abort reason when `signal`
 * aborts first, after `onAbort` has released what `pending` holds. The abort
 * listener is removed once `pending` settles. An abort that lands after
 * `pending` settled interrupts nothing and is ignored.
 */
function raceAbort<T>(signal: AbortSignal, pending: Promise<T>, onAbort: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      interruptedSignals.add(signal);
      onAbort();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the scope rejects with the reason its owner passed to abort(), as fetch does.
      reject(signal.reason);
    };

    const removeAbortListener = (): void => {
      signal.removeEventListener("abort", abort);
    };

    pending.then(removeAbortListener, removeAbortListener);
    pending.then(resolve, reject);
    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Ends a body that nobody reads any more; a failure to end it is of no use to anyone. */
function endBody(body: AsyncIterableIterator<Uint8Array> | undefined): void {
  Promise.resolve(body?.return?.()).catch(() => undefined);
}

/** A hop that the abort beat; a response that still arrives has its body ended. */
function releaseLateHop(pending: Promise<GitHttpResponse>): void {
  pending.then(
    (late) => {
      endBody(late.body);
    },
    () => undefined,
  );
}

function abortableHopSender(signal: AbortSignal): HopSender {
  return (hop) => {
    signal.throwIfAborted();
    const pending = sendPlainHop(hop);
    return raceAbort(signal, pending, () => {
      releaseLateHop(pending);
    });
  };
}

/** Reads `body` until `signal` aborts; the abort ends the body and rejects the read. */
function abortableBody(
  body: AsyncIterableIterator<Uint8Array>,
  signal: AbortSignal,
): AsyncIterableIterator<Uint8Array> {
  const iterator: AsyncIterableIterator<Uint8Array> = {
    next: () =>
      raceAbort(signal, body.next(), () => {
        endBody(body);
      }),
    [Symbol.asyncIterator]: () => iterator,
  };
  return iterator;
}

async function sendHop(
  hop: GitHttpRequest,
  chain: RedirectChain,
  send: HopSender,
): Promise<GitHttpResponse> {
  const response = await send(hop);
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

  return sendHop(
    nextHop(hop, response.statusCode, target, chain.origin),
    {
      origin: chain.origin,
      redirects: chain.redirects + 1,
      leftOrigin: chain.leftOrigin || target.origin !== chain.origin,
    },
    send,
  );
}

async function requestWithinOrigin(original: GitHttpRequest): Promise<GitHttpResponse> {
  const chain: RedirectChain = {
    origin: new URL(original.url).origin,
    redirects: 0,
    leftOrigin: false,
  };
  const signal = gitAbortScope.getStore();
  if (signal === undefined) {
    return sendHop(original, chain, sendPlainHop);
  }

  const response = await sendHop(original, chain, abortableHopSender(signal));
  const { body } = response;
  return body === undefined ? response : { ...response, body: abortableBody(body, signal) };
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
 *
 * Abort scope (D-PL8-24). Inside `runWithGitAbortSignal`, a hop does not start
 * once the signal has aborted, a hop in flight rejects with the abort reason,
 * and a response that arrives after that has its body ended. Each read of the
 * final response body also races the signal; the abort ends the body, which
 * destroys its stream. A hop aborted before its response arrives keeps its
 * socket until the host answers or closes it.
 */
const http: HttpClient = { request: requestWithinOrigin };

/**
 * GHB-01: runs one network call. When the call sends `wireUrl` in place of the
 * caller's `url` and fails with an error that has no cause, the error gains a
 * `FetchedUrlCause` naming `wireUrl`, so a wrong base shows in the failure
 * output. The code-bearing error stays at depth 0 for the failure classifiers.
 * An unrewritten call runs with no `try` and its failure is unchanged (GHB-04).
 */
async function withFetchedUrlCause<T>(
  wireUrl: string,
  url: string,
  call: () => Promise<T>,
): Promise<T> {
  if (wireUrl === url) {
    return call();
  }

  try {
    return await call();
  } catch (error: unknown) {
    // A rejection that is not a writable Error passes through unchanged.
    if (error instanceof Error && error.cause === undefined && Object.isExtensible(error)) {
      error.cause = new FetchedUrlCause(wireUrl);
    }

    throw error;
  }
}

/**
 * D-PL8-24: runs one network call and fails it with the abort reason when the
 * scope's signal cut the call off. isomorphic-git reads a failed
 * ref-advertisement body as the end of the list, so without this check an
 * interrupted listing could return a cut-short ref list as a success. A call
 * that settled before the abort reached it is returned or thrown as it settled.
 */
async function networkCall<T>(wireUrl: string, url: string, call: () => Promise<T>): Promise<T> {
  const signal = gitAbortScope.getStore();
  let result: T;
  try {
    result = await withFetchedUrlCause(wireUrl, url, call);
  } catch (error: unknown) {
    if (signal !== undefined && interruptedSignals.has(signal)) {
      signal.throwIfAborted();
    }

    throw error;
  }

  if (signal !== undefined && interruptedSignals.has(signal)) {
    signal.throwIfAborted();
  }

  return result;
}

/** A remote request as `runRemote` built it: its config pairs are always present. */
type RemoteGitRequest = GitRequest & { readonly config: readonly string[] };

/** One remote request that `runRemote` sends with system git. */
interface RemoteRequest {
  readonly subcommand: "fetch" | "ls-remote";
  /** Pi-owned flags; the first one names the operation in a failure (`operationOf`). */
  readonly options: readonly string[];
  readonly operands: readonly string[];
  /** The clone the command runs in; omitted, git runs in the neutral directory. */
  readonly cwd?: string;
  /**
   * The canonical URL the request reaches: the URL operand, or the clone's
   * recorded origin. It alone decides the D-SG-16 pair and the GHB-01 cause.
   */
  readonly url: string;
  /** The caller's auth bundle, which decides what an auth failure leads to. */
  readonly auth?: BuildAuthCallbacksOpts | undefined;
}

/**
 * SG-TRN-01: the one network request path. It asks for git first, so a
 * missing git rejects with the lookup's own error and no cause (SG-PRC-06).
 * Then it runs `remote` on the network lane with the limit of
 * `gitTimeoutMs()` read for this command (D-SG-13), the signal of the abort
 * scope it runs in (D-PL8-24), and the D-SG-16 pair of
 * `gitHubInsteadOfPairs(remote.url)`, which throws `InvalidGitHubBaseUrlError`
 * before anything starts. An auth failure goes to `runWithAuthBundle`. A
 * failure of a request the base rewrote gains the `FetchedUrlCause` of the URL
 * git fetched (GHB-01).
 */
async function runRemote(remote: RemoteRequest, gitProcess: GitProcess): Promise<GitResult> {
  await gitProcess.locate();
  const config = gitHubInsteadOfPairs(remote.url);
  const signal = gitAbortScope.getStore();
  const request: RemoteGitRequest = {
    subcommand: remote.subcommand,
    lane: "network",
    options: remote.options,
    operands: remote.operands,
    config,
    ...(remote.cwd !== undefined && { cwd: remote.cwd }),
    timeoutMs: gitTimeoutMs(),
    ...(signal !== undefined && { signal }),
  };
  return withFetchedUrlCause(gitHubWireUrl(remote.url), remote.url, () =>
    runWithAuthBundle(request, remote.auth, gitProcess),
  );
}

/**
 * Runs `request` once and maps an `https-auth` failure by the bundle, reading
 * only the failure's kind and detail (SG-PRC-05). git asked the user's
 * credential helpers itself, so the bundle never answers a challenge here:
 *   - `no-credential` under a `device-flow` bundle: no helper answered, so the
 *     sign-in runs once and the request runs once more (D-SG-14).
 *   - `rejected` under a `stored-credential` bundle: the host refused the
 *     credential a helper gave, the GAUTH-04 `StoredCredentialRejectedError`
 *     with the git failure as its cause.
 *   - anything else, a missing bundle included, is thrown as it failed. A
 *     refused Device Flow token signs in no second time, and the extension
 *     erases no stored credential (git's own helpers may, as under Claude Code).
 */
async function runWithAuthBundle(
  request: RemoteGitRequest,
  auth: BuildAuthCallbacksOpts | undefined,
  gitProcess: GitProcess,
): Promise<GitResult> {
  try {
    return await gitProcess.run(request);
  } catch (error: unknown) {
    if (
      auth === undefined ||
      !(error instanceof GitCommandError) ||
      error.failure.kind !== "https-auth"
    ) {
      throw error;
    }

    const { detail } = error.failure;
    if (detail === "rejected" && auth.kind === "stored-credential") {
      throw new StoredCredentialRejectedError(auth.host, { cause: error });
    }

    if (detail === "rejected" || auth.kind === "stored-credential") {
      throw error;
    }

    return retryAfterSignIn(request, auth, error, gitProcess);
  }
}

/**
 * D-SG-14: runs the Device Flow sign-in of `auth`, which stores the token with
 * `git credential approve` (D-BG-1102), then `request` once more with the
 * token in a one-shot helper only. The command's auth memo keeps the sign-in
 * to once per host. A failed sign-in throws `failure`, the first run's error,
 * with the sign-in's reason as its cause; the retry's own failure is thrown
 * as it failed. `DeviceFlowUnavailableError` propagates unchanged.
 */
async function retryAfterSignIn(
  request: RemoteGitRequest,
  auth: Extract<BuildAuthCallbacksOpts, { kind: "device-flow" }>,
  failure: GitCommandError,
  gitProcess: GitProcess,
): Promise<GitResult> {
  const signedIn = await auth.onAuthRequired();
  if (!signedIn.ok) {
    // An https-auth failure carries no cause of its own.
    failure.cause = new Error(signedIn.reason);
    throw failure;
  }

  // AUTH-09: the line names the host and the operation, never the credential.
  hookDebugLog(`git ${failure.operation}: signed in to ${auth.host}, running it once more`, "auth");
  return withOneShotCredential(signedIn.cred, (pairs) =>
    gitProcess.run({ ...request, config: [...request.config, ...pairs] }),
  );
}

/**
 * The refs an `ls-remote` printed, each name mapped to its object id. git
 * prints one `<oid> TAB <name>` line per ref, and `<name>^{}` for the commit
 * an annotated tag peels to.
 */
function advertisedRefs(stdout: string): Map<string, string> {
  const refs = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab !== -1) {
      refs.set(line.slice(tab + 1), line.slice(0, tab));
    }
  }

  return refs;
}

export async function clone(opts: CloneOptions): Promise<void> {
  await NODE_GIT_PROCESS.locate();
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
  const wireUrl = gitHubWireUrl(opts.url);
  await networkCall(wireUrl, opts.url, () =>
    git.clone({
      fs,
      http,
      dir: opts.dir,
      url: wireUrl,
      ...(opts.ref !== undefined && { ref: opts.ref }),
      ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
      ...(authCbs !== undefined && {
        onAuth: authCbs.onAuth,
        onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
      }),
      // No depth (full history is kept). No corsProxy (Node only).
    }),
  );
  if (wireUrl !== opts.url) {
    // GHB-01: isomorphic-git records the URL it fetched as origin. The clone
    // keeps its canonical identity; only the bytes came from the base.
    await git.setConfig({ fs, dir: opts.dir, path: "remote.origin.url", value: opts.url });
  }
}

/**
 * Fetches `opts.remote` (default "origin") into its remote-tracking refs.
 *
 * GHB-01: the remote's recorded url is read and sent as
 * `shared/github-base-url.ts::gitHubWireUrl` of it, never as recorded. A
 * rewritten url goes to isomorphic-git as an explicit `url` beside the remote
 * name, so the tracking refs update and `.git/config` keeps the canonical url.
 */
export async function fetch(opts: FetchOptions): Promise<void> {
  await NODE_GIT_PROCESS.locate();
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const remote = opts.remote ?? "origin";
  const recordedUrl: unknown = await git.getConfig({
    fs,
    dir: opts.dir,
    path: `remote.${remote}.url`,
  });
  // A remote with no recorded url sends nothing new, so isomorphic-git raises
  // its own MissingParameterError.
  const url = typeof recordedUrl === "string" ? recordedUrl : "";
  const wireUrl = gitHubWireUrl(url);
  await networkCall(wireUrl, url, () =>
    git.fetch({
      fs,
      http,
      dir: opts.dir,
      ...(opts.remote !== undefined && { remote: opts.remote }),
      ...(wireUrl !== url && { remote, url: wireUrl }),
      ...(opts.ref !== undefined && { ref: opts.ref }),
      ...(opts.tags !== undefined && { tags: opts.tags }),
      ...(authCbs !== undefined && {
        onAuth: authCbs.onAuth,
        onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
      }),
    }),
  );
}

/** `git config --get` and `--get-all` exit 1 when the key has no value. */
const CONFIG_VALUE_ABSENT = 1;

/**
 * SG-TRN-02, C5: fetches the commit `opts.sha` into the clone `opts.dir`, as
 * Claude Code's pin ladder does. The first rung is `fetch --depth 1 origin
 * <sha>`. When it fails for a reason other than an abort, and only when
 * `rev-parse --is-shallow-repository` prints `true`, the second rung is
 * `fetch --unshallow origin [<ref>]`, and its failure is the one thrown. A
 * complete clone skips that rung, because git refuses `--unshallow` on one,
 * and the first rung's error is thrown. Each rung runs through `runRemote`,
 * so it reads its own limit and carries the scope's abort signal.
 *
 * D-SG-16: the clone records its canonical origin, so a `fetch origin` with no
 * pair would go to the real github.com. The recorded origin is read first,
 * with `config --local --get remote.origin.url` on the local lane, and decides
 * the pair of both rungs. A clone with no origin url sends no pair, and git
 * then refuses the fetch itself.
 */
export async function fetchCommit(
  opts: FetchCommitOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<void> {
  const url = await recordedOriginUrl(opts.dir, gitProcess);
  const fetchRung = (options: readonly string[], operands: readonly string[]): RemoteRequest => ({
    subcommand: "fetch",
    cwd: opts.dir,
    options,
    operands,
    url,
    auth: opts.auth,
  });
  try {
    await runRemote(fetchRung(["--depth", "1"], ["origin", opts.sha]), gitProcess);
    return;
  } catch (error: unknown) {
    const aborted = error instanceof GitCommandError && error.kind === "aborted";
    if (aborted || !(await isShallowClone(opts.dir, gitProcess))) {
      throw error;
    }
  }

  await runRemote(
    fetchRung(["--unshallow"], opts.ref === undefined ? ["origin"] : ["origin", opts.ref]),
    gitProcess,
  );
}

/** The url `origin` records in the clone `dir`, or the empty string when it records none. */
async function recordedOriginUrl(dir: string, gitProcess: GitProcess): Promise<string> {
  const read = await gitProcess.run({
    subcommand: "config",
    lane: "local",
    cwd: dir,
    options: ["--local", "--get"],
    operands: ["remote.origin.url"],
    allowExit: [CONFIG_VALUE_ABSENT],
    timeoutMs: gitTimeoutMs(),
  });
  return read.stdout.trim();
}

/**
 * Whether the clone in `dir` is shallow. A read that fails counts as a
 * complete clone, so the caller throws the error it already holds.
 */
async function isShallowClone(dir: string, gitProcess: GitProcess): Promise<boolean> {
  const read = await gitProcess
    .run({
      subcommand: "rev-parse",
      lane: "local",
      cwd: dir,
      options: ["--is-shallow-repository"],
      timeoutMs: gitTimeoutMs(),
    })
    .catch(() => undefined);
  return read?.stdout.trim() === "true";
}

/**
 * D-SG-11: the keys an `isomorphic-git` clone writes into `.git/config`
 * (03-EVIDENCE Q5). A copy that keeps `core.symlinks=false` would check a
 * symlink out as a text file.
 */
const COPIED_CLONE_KEYS = ["core.symlinks", "core.ignorecase", "core.filemode"] as const;

/** `git config --unset-all` exits 5 when the key is not set. */
const CONFIG_KEY_ABSENT = 5;

/**
 * SG-TRN-01: checks `opts.ref` out in `opts.dir` with `checkout -f`, so the
 * work tree gets the target commit's files even when the current branch's ref
 * moved under it. A SHA or a tag leaves HEAD detached. The operand rule puts
 * the ref before `--` and refuses one that starts with `-`.
 *
 * With `fromCopiedGitDir`, the D-SG-11 keys are unset first, one command per
 * key, because each `git config` write takes the config file's lock. A key
 * that is not set is no failure, so a second run of the same copy succeeds.
 */
export async function checkout(
  opts: CheckoutOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<void> {
  if (opts.fromCopiedGitDir === true) {
    for (const key of COPIED_CLONE_KEYS) {
      // eslint-disable-next-line no-await-in-loop -- each git config write takes the config file's lock
      await gitProcess.run({
        subcommand: "config",
        lane: "local",
        cwd: opts.dir,
        options: ["--local", "--unset-all"],
        operands: [key],
        allowExit: [CONFIG_KEY_ABSENT],
        timeoutMs: gitTimeoutMs(),
      });
    }
  }

  await gitProcess.run({
    subcommand: "checkout",
    lane: "local",
    cwd: opts.dir,
    options: ["-f", "--quiet"],
    operands: [opts.ref],
    timeoutMs: gitTimeoutMs(),
  });
}

/** `rev-parse --verify --quiet` exits 1, printing nothing, for a name that names no object. */
const REF_ABSENT = 1;

/**
 * SG-TRN-01: the commit `opts.ref` names in `opts.dir`, or undefined when it
 * names none: no such ref, or a ref or tag that names a tree or a blob.
 * `^{commit}` peels an annotated tag, a tag of a tag included, to its commit.
 * The ref follows `--end-of-options`, so git never reads it as an option.
 */
export async function resolveRef(
  opts: ResolveRefOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<string | undefined> {
  const read = await gitProcess.run({
    subcommand: "rev-parse",
    lane: "local",
    cwd: opts.dir,
    options: ["--verify", "--quiet"],
    operands: [`${opts.ref}^{commit}`],
    allowExit: [REF_ABSENT],
    timeoutMs: gitTimeoutMs(),
  });
  return read.exitCode === REF_ABSENT ? undefined : read.stdout.trim();
}

/**
 * D-77-05 / PURL-09, SG-TRN-01: resolves a remote ref, or the remote HEAD, to
 * the commit it names WITHOUT a clone, so the install clone-cache seam can pin
 * an unpinned source at install time. It runs `ls-remote <url> <names...>`
 * through `runRemote`, which sends the same `GET info/refs` and one
 * `POST git-upload-pack` as a protocol version 2 ref listing.
 *
 * Ref selection, by exact name, whatever order git prints the lines in:
 *   - `opts.ref` undefined: the `HEAD` line (the default branch's commit), or
 *     undefined when the remote advertises no HEAD.
 *   - `opts.ref` given: `refs/heads/<ref>`, then the commit an annotated
 *     `refs/tags/<ref>` peels to (`refs/tags/<ref>^{}`), then
 *     `refs/tags/<ref>` itself (a lightweight tag), then a ref named exactly
 *     `<ref>`, such as `HEAD`. A branch therefore wins over a tag of the same
 *     name. Undefined when the remote advertises none of them.
 *
 * The names are also the `ls-remote` patterns. git matches a pattern against
 * the end of each ref name and prints a peeled line only for a pattern that
 * names it, so the `^{}` name must be one of them. The extra lines a tail
 * match brings, such as `refs/heads/x/<ref>`, never match a name.
 *
 * The optional `opts.auth` bundle maps an auth failure (PROV-03, D-SG-14,
 * GAUTH-04). GHB-01: under the base override, a failure names the URL fetched.
 */
export async function resolveRemoteRef(
  opts: ResolveRemoteRefOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<string | undefined> {
  const names =
    opts.ref === undefined
      ? ["HEAD"]
      : [`refs/heads/${opts.ref}`, `refs/tags/${opts.ref}^{}`, `refs/tags/${opts.ref}`, opts.ref];
  const listed = await runRemote(
    {
      subcommand: "ls-remote",
      options: [],
      operands: [opts.url, ...names],
      url: opts.url,
      auth: opts.auth,
    },
    gitProcess,
  );
  const refs = advertisedRefs(listed.stdout);
  return names.map((name) => refs.get(name)).find((oid) => oid !== undefined);
}

/** The ref namespace of a tag. */
const TAG_REF_PREFIX = "refs/tags/";

/** The suffix of the line that names the commit an annotated tag peels to. */
const PEELED_REF_SUFFIX = "^{}";

/**
 * RESV-03 / D-03-02.2, SG-TRN-01: reads a remote's tag list WITHOUT a clone,
 * so a dependency carrying a version constraint can be pinned to whichever
 * release tag satisfies it. It runs `ls-remote --tags <url>` through
 * `runRemote`, which sends the same `GET info/refs` and one
 * `POST git-upload-pack` as a protocol version 2 listing with a
 * `refs/tags/` prefix.
 *
 * D-03-03 amends NFR-5 for exactly this read: resolving a constrained
 * dependency may query its source repository's tags even when a cached or
 * otherwise resolvable copy of that dependency already exists, because the
 * constraint can demand a different tag than the cached one.
 *
 * git prints a lightweight tag as one `refs/tags/<name>` line, and an
 * annotated tag as that line, naming the tag object, plus a
 * `refs/tags/<name>^{}` line naming the commit it peels to, a tag of a tag
 * peeled all the way. Each tag is one entry, in the order git first prints
 * it, and the peeled line wins, so an annotated tag resolves to a commit
 * rather than to the tag object.
 *
 * A remote that advertises no tags yields an empty array rather than
 * throwing. A failed listing propagates as the git process threw it:
 * classifying what it means belongs to the caller that knows which operation
 * it was serving.
 *
 * The optional `opts.auth` bundle maps an auth failure as `resolveRemoteRef`'s
 * does, so a private source repository needs no second credential path.
 * GHB-01: under the base override, a failure names the URL fetched.
 */
export async function listRemoteTags(
  opts: ListRemoteTagsOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<RemoteTag[]> {
  const listed = await runRemote(
    {
      subcommand: "ls-remote",
      options: ["--tags"],
      operands: [opts.url],
      url: opts.url,
      auth: opts.auth,
    },
    gitProcess,
  );

  const tags = new Map<string, string>();
  for (const [ref, oid] of advertisedRefs(listed.stdout)) {
    const peeled = ref.endsWith(PEELED_REF_SUFFIX);
    const tagRef = peeled ? ref.slice(0, -PEELED_REF_SUFFIX.length) : ref;
    const name = tagRef.slice(TAG_REF_PREFIX.length);
    if (peeled || !tags.has(name)) {
      tags.set(name, oid);
    }
  }

  return [...tags].map(([name, oid]) => ({ name, oid }));
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
 * }) => Promise<string>; readTag({ fs, dir, gitdir, oid, cache }) => Promise<{ oid,
 * tag: TagObject, payload }>, where TagObject.type is "blob" | "tree" |
 * "commit" | "tag" and TagObject.object is the oid of the tagged object.
 */
export async function resolveTagOid(opts: ResolveTagOidOptions): Promise<string | undefined> {
  let oid = await git.resolveRef({ fs, dir: opts.dir, ref: `refs/tags/${opts.name}` });

  for (let hop = 0; hop < MAX_TAG_PEEL_HOPS; hop++) {
    let read: Awaited<ReturnType<typeof git.readTag>>;
    try {
      // eslint-disable-next-line no-await-in-loop -- each hop reads the oid the previous tag names
      read = await git.readTag({ fs, dir: opts.dir, oid, cache: opts.cache });
    } catch {
      // Not a tag object: a LIGHTWEIGHT tag names its target directly. Only a
      // commit is checkout-able, so anything else -- a blob, a tree, or an
      // unreadable object -- is dropped like an annotated blob/tree tag is.
      try {
        // eslint-disable-next-line no-await-in-loop -- runs once: the lightweight-tag path returns after it
        await git.readCommit({ fs, dir: opts.dir, oid, cache: opts.cache });
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
 * if so, what its `origin` remote names -- WITHOUT throwing. A caller here
 * (`marketplace add`'s leftover-clone recognition) must tell "this is
 * definitely a foreign or unreadable tree" apart from "I could not look at
 * all", and a catch block collapses that distinction.
 *
 * The function reads `<dir>/.git/config` itself first, and that read alone
 * chooses among the `not-a-repo` and `permission-denied` arms and the
 * `unreadable` arm of a filesystem error. The probe read doubles as the
 * existence check, so no separate `stat` is needed.
 *
 * SG-TRN-01: system git then reads every `remote.origin.url` value, in file
 * order, across every `[remote "origin"]` section, with `config --local
 * --null --get-all` on the local lane. git folds the section name's case, so
 * a capitalized `Remote` section names the origin remote. git fetches from
 * the FIRST `url` under `origin`, so the function reports `origin` only for
 * exactly one value, an empty one included. No value (exit 1) and two or more
 * values report `no-origin`, which the caller refuses (D-3-03, MA-13). Any
 * other failure of that read, such as a config git cannot parse, is
 * `unreadable`.
 *
 * The returned `url`, when present, is the wire form stored on disk,
 * verbatim. This tier may not import `domain/` (the `platform` zone's
 * `.fallowrc.json` boundary allows only `shared`), so the identity
 * comparison against `canonicalCloneUrl` belongs to the caller.
 */
export async function listRemotes(
  opts: ListRemotesOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<ListRemotesResult> {
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

  let read: GitResult;
  try {
    read = await gitProcess.run({
      subcommand: "config",
      lane: "local",
      cwd: opts.dir,
      options: ["--local", "--null", "--get-all"],
      operands: ["remote.origin.url"],
      allowExit: [CONFIG_VALUE_ABSENT],
      timeoutMs: gitTimeoutMs(),
    });
  } catch {
    // The git process rejects only with a GitCommandError: a config git
    // cannot parse, for example.
    return { kind: "unreadable" };
  }

  // `--null` ends every value with NUL, so a value that holds a newline stays
  // one value.
  const urls = read.stdout.split("\0").slice(0, -1);
  const [url] = urls;
  return urls.length === 1 && url !== undefined ? { kind: "origin", url } : { kind: "no-origin" };
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
