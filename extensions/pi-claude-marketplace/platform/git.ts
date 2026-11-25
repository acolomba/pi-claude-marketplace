import { AsyncLocalStorage } from "node:async_hooks";
import * as fs from "node:fs";
import * as path from "node:path";

import { hookDebugLog } from "../shared/debug-log.ts";
import {
  errorMessage,
  FetchedUrlCause,
  GitCommandError,
  StoredCredentialRejectedError,
} from "../shared/errors.ts";
import { gitHubInsteadOfPairs, gitHubWireUrl } from "../shared/github-base-url.ts";
import { redactAbsolutePaths } from "../shared/redact-absolute-paths.ts";

import { withOneShotCredential } from "./git-one-shot-credential.ts";
import { NODE_GIT_PROCESS } from "./git-process.ts";
import { gitTimeoutMs } from "./git-timeout.ts";

import type { GitAuthBundle } from "./git-credential.ts";
import type { GitProcess, GitRequest, GitResult, SshRun, SystemGitProcess } from "./git-process.ts";

/**
 * platform/git.ts -- the git surface of the extension (D-18, D-19, D-20).
 *
 * SG-TRN-01, D-SG-01 (reverses D-21): every operation runs system git
 * through `platform/git-process.ts`, the one git transport. The network
 * verbs `clone`, `fetchCommit`, `resolveRemoteRef`, and `listRemoteTags`
 * send their requests through `runRemote`, the one network request path of
 * this module: the network lane, the D-SG-13 limit, the D-PL8-24 abort
 * signal, the D-SG-16 `insteadOf` pair, and the D-SG-14 retry. With no
 * usable git on PATH they reject with the git process module's `git-missing`
 * GitCommandError before a request goes out (SG-PRC-06). `checkout`,
 * `resolveRef`, `listLocalTags`, and `listRemotes` run on the local lane,
 * which reaches no transport. `resolveRef` answers undefined for a ref that
 * names no commit, and `resolveRemoteRef` for a ref the remote does not
 * advertise. Each function takes the git process as a defaulted last
 * parameter, and every request it sends takes its limit from
 * `gitTimeoutMs()` (D-SG-13). SG-SSH-02: `probeGitHubSsh` runs Claude Code's
 * ssh probe of GitHub through the same git process, with its own fixed limit.
 *
 * NOT exposed:
 *   - sparse checkout (PRD §11 deferred)
 *   - submodules (a clone passes `--no-recurse-submodules`, C5)
 *   - an auth surface beyond the optional `opts.auth` bundle
 *     (`platform/git-credential.ts::GitAuthBundle`). git asks the user's
 *     credential helpers itself; the bundle decides what an auth failure
 *     leads to, and an omitted bundle is the public-only path.
 *
 * D-PL8-24: `runWithGitAbortSignal` runs a call inside an abort scope. Each
 * network request the call sends carries the scope's signal, so an abort
 * stops the git command in flight.
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
   * Under the GitHub base override git fetches from the base through the
   * D-SG-16 `insteadOf` pair; the clone's recorded origin stays this value.
   */
  url: string;
  /**
   * Optional branch or tag to clone (`--branch=<ref>`). If omitted, the
   * default branch. A commit id is no branch name: a pinned clone passes no
   * ref and fetches its commit afterwards (C5).
   */
  ref?: string;
  /** Pass `--single-branch`; a depth-1 clone fetches one branch either way. */
  singleBranch?: boolean;
  /**
   * SG-TRN-02: pass `--no-checkout`, so the clone writes no work tree file and
   * the pin ladder checks its commit out afterwards.
   */
  noCheckout?: boolean;
  /**
   * Optional auth bundle. git asks the user's credential helpers itself; the
   * bundle decides what an auth failure of the clone leads to (D-SG-14,
   * GAUTH-04). A public clone never fails on auth, so the bundle is not
   * consulted.
   */
  auth?: GitAuthBundle;
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
   * D-SG-09: false skips the `--unshallow` rung, so the fetch asks the remote
   * for the one commit only and the first rung's failure is the one thrown.
   * Omitted, a shallow clone falls back to it, as Claude Code's pin ladder
   * does.
   */
  unshallow?: boolean;
  /**
   * Optional auth bundle. git asks the user's credential helpers itself; the
   * bundle decides what an auth failure of a rung leads to (D-SG-14, GAUTH-04).
   */
  auth?: GitAuthBundle;
}

export interface CheckoutOptions {
  dir: string;
  /** Branch, tag, or SHA. */
  ref: string;
  /**
   * D-SG-11, SG-MIG-01: set true when `dir/.git` is a copy of another clone's
   * git directory. The checkout then first unsets `core.symlinks`,
   * `core.ignorecase`, and `core.filemode` in the copy's config, the keys a
   * clone made by an earlier version of this extension carries, so git decides
   * them for this machine as it does for a fresh clone. No key is written
   * (D-SG-12).
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
  auth?: GitAuthBundle;
}

export interface ListRemoteTagsOptions {
  /** Remote URL. */
  url: string;
  /**
   * Optional auth bundle. Same shape as `CloneOptions.auth`; it maps an auth
   * failure of the listing as it does for `resolveRemoteRef` (RESV-03).
   */
  auth?: GitAuthBundle;
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

export interface ListLocalTagsOptions {
  /** Working-tree directory of a local repository. */
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

/** D-PL8-24: the abort signal of the call that runs in the current async context. */
const gitAbortScope = new AsyncLocalStorage<AbortSignal>();

/**
 * D-PL8-24: runs `run` in an abort scope. Each network request that `run`
 * sends through this module carries `signal`, so once it aborts the git
 * command in flight stops and the request fails as aborted.
 */
export function runWithGitAbortSignal<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  return gitAbortScope.run(signal, run);
}

/**
 * GHB-01: runs one network call. When the call sends `wireUrl` in place of the
 * caller's `url` and fails with an error that has no cause, the error gains a
 * `FetchedUrlCause` naming `wireUrl`, so a wrong base shows in the failure
 * output. The code-bearing error stays at depth 0 for the failure classifiers.
 * An unrewritten call runs with no `try` and its failure is unchanged (GHB-04).
 * A `git-missing` failure fetched nothing, so it gains no cause (SG-PRC-06).
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
    if (
      error instanceof Error &&
      error.cause === undefined &&
      Object.isExtensible(error) &&
      !isGitMissing(error)
    ) {
      error.cause = new FetchedUrlCause(wireUrl);
    }

    throw error;
  }
}

/** Whether `error` is the git process module's report that it found no git. */
function isGitMissing(error: Error): boolean {
  return error instanceof GitCommandError && error.kind === "git-missing";
}

/** A remote request as `runRemote` built it: its config pairs are always present. */
type RemoteGitRequest = GitRequest & { readonly config: readonly string[] };

/** One remote request that `runRemote` sends with system git. */
interface RemoteRequest {
  readonly subcommand: "clone" | "fetch" | "ls-remote";
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
  readonly auth?: GitAuthBundle | undefined;
}

/**
 * SG-TRN-01: the one network request path. It runs `remote` once on the
 * network lane, and that run finds git itself: a missing git fails it as
 * `git-missing` with no cause (SG-PRC-06), and no separate lookup runs first
 * (IN-01). The run has the limit of
 * `gitTimeoutMs()` read for this command (D-SG-13), the signal of the abort
 * scope it runs in (D-PL8-24), and the D-SG-16 pair of
 * `gitHubInsteadOfPairs(remote.url)`, which throws `InvalidGitHubBaseUrlError`
 * before anything starts. An auth failure goes to `runWithAuthBundle`. A
 * failure of a request the base rewrote gains the `FetchedUrlCause` of the URL
 * git fetched (GHB-01).
 */
async function runRemote(remote: RemoteRequest, gitProcess: GitProcess): Promise<GitResult> {
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
  const wireUrl = gitHubWireUrl(remote.url);
  return withFetchedUrlCause(wireUrl, remote.url, () =>
    runWithAuthBundle(request, wireUrl, remote.auth, gitProcess),
  );
}

/**
 * D-1-03, T-79-04: the origin git contacts for `wireUrl`, when that is an
 * https URL of `host`, else undefined. A bundle is bound to one host, so it
 * maps only the failure of a request to that host, and a sign-in's token goes
 * to that origin only.
 */
function bundleOrigin(wireUrl: string, host: string): string | undefined {
  if (!URL.canParse(wireUrl)) {
    return undefined;
  }

  const url = new URL(wireUrl);
  return url.protocol === "https:" && url.host === host ? url.origin : undefined;
}

/**
 * Runs `request` once and maps an `https-auth` failure by the bundle, reading
 * only the failure's kind and detail (SG-PRC-05). git asked the user's
 * credential helpers itself, so the bundle never answers a challenge here.
 * The bundle maps only a failure of a request to its own host, `wireUrl`
 * after the D-SG-16 rewrite (D-1-03, T-79-04):
 *   - `no-credential` under a `device-flow` bundle: no helper answered, so the
 *     sign-in runs once and the request runs once more (D-SG-14).
 *   - `rejected` under a `stored-credential` bundle: the host refused the
 *     credential a helper gave, the GAUTH-04 `StoredCredentialRejectedError`
 *     with the git failure as its cause.
 *   - anything else, a missing bundle and a request to another host
 *     included, is thrown as it failed. A
 *     refused Device Flow token signs in no second time, and the extension
 *     erases no stored credential (git's own helpers may, as under Claude Code).
 */
async function runWithAuthBundle(
  request: RemoteGitRequest,
  wireUrl: string,
  auth: GitAuthBundle | undefined,
  gitProcess: GitProcess,
): Promise<GitResult> {
  try {
    return await gitProcess.run(request);
  } catch (error: unknown) {
    const origin = auth === undefined ? undefined : bundleOrigin(wireUrl, auth.host);
    if (
      auth === undefined ||
      origin === undefined ||
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

    return retryAfterSignIn(request, { auth, origin }, error, gitProcess);
  }
}

/**
 * D-SG-14: runs the Device Flow sign-in of `auth`, which stores the token with
 * `git credential approve` (D-BG-1102), then `request` once more with the
 * token in a one-shot helper only, keyed to `origin`, the bundle host's
 * origin (D-1-03). The command's auth memo keeps the sign-in
 * to once per host. A failed sign-in throws `failure`, the first run's error,
 * with the sign-in's reason as its cause; the retry's own failure is thrown
 * as it failed. `DeviceFlowUnavailableError` propagates unchanged.
 */
async function retryAfterSignIn(
  request: RemoteGitRequest,
  bound: {
    readonly auth: Extract<GitAuthBundle, { kind: "device-flow" }>;
    readonly origin: string;
  },
  failure: GitCommandError,
  gitProcess: GitProcess,
): Promise<GitResult> {
  const { auth, origin } = bound;
  const signedIn = await auth.onAuthRequired();
  if (!signedIn.ok) {
    // An https-auth failure carries no cause of its own.
    failure.cause = new Error(signedIn.reason);
    throw failure;
  }

  // AUTH-09: the line names the host and the operation, never the credential.
  hookDebugLog(
    `git ${failure.operation}: has a sign-in for ${auth.host}, running it once more`,
    "auth",
  );
  return withOneShotCredential(signedIn.cred, origin, (pairs) =>
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

/**
 * SG-TRN-01, SG-TRN-02, C5: clones `opts.url` into `opts.dir` with system git
 * in Claude Code's shape, `clone --depth 1 --no-recurse-submodules
 * [--no-checkout] [--branch=<ref>] [--single-branch] --end-of-options <url>
 * <dir>`, through `runRemote`, so the clone has the D-SG-13 limit, the
 * scope's abort signal, the D-SG-16 `insteadOf` pair, and the D-SG-14 retry.
 * `--depth` comes first, so a failure names the operation `clone --depth`.
 * `--branch=<ref>` is one argv word, so git never reads the ref as an option
 * of its own (SG-PRC-01).
 *
 * D-SG-16: git records the URL it was given as the clone's origin, so a
 * github.com clone keeps its canonical identity under the base override and
 * needs no second config write. A clone that fails removes the directory git
 * made, or empties one that already existed, so the D-SG-14 retry starts
 * from an empty target (03-RESEARCH A10, measured on git 2.43.0).
 */
export async function clone(
  opts: CloneOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<void> {
  await runRemote(
    {
      subcommand: "clone",
      options: [
        "--depth",
        "1",
        "--no-recurse-submodules",
        ...(opts.noCheckout === true ? ["--no-checkout"] : []),
        ...(opts.ref === undefined ? [] : [`--branch=${opts.ref}`]),
        ...(opts.singleBranch === true ? ["--single-branch"] : []),
      ],
      operands: [opts.url, opts.dir],
      url: opts.url,
      auth: opts.auth,
    },
    gitProcess,
  );
}

/** `git config --get` and `--get-all` exit 1 when the key has no value. */
const CONFIG_VALUE_ABSENT = 1;

/** The config key of the url the `origin` remote records. */
const ORIGIN_URL_KEY = "remote.origin.url";

/**
 * SG-TRN-02, C5: fetches the commit `opts.sha` into the clone `opts.dir`, as
 * Claude Code's pin ladder does. The first rung is `fetch --depth 1 origin
 * <sha>`. When it fails for a reason other than an abort, and only when
 * `rev-parse --is-shallow-repository` prints `true`, the second rung is
 * `fetch --unshallow origin [<ref>]`, and its failure is the one thrown. A
 * complete clone skips that rung, because git refuses `--unshallow` on one,
 * and the first rung's error is thrown. So does a request with `unshallow:
 * false` (D-SG-09). Each rung runs through `runRemote`,
 * so it reads its own limit and carries the scope's abort signal.
 *
 * D-SG-16: the clone records its canonical origin, so a `fetch origin` with no
 * pair would go to the real github.com. The recorded origin is read first,
 * with `config --local --get` of `ORIGIN_URL_KEY` on the local lane, and decides
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
    if (aborted || opts.unshallow === false || !(await isShallowClone(opts.dir, gitProcess))) {
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
    operands: [ORIGIN_URL_KEY],
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
 * D-SG-11, SG-MIG-01: the keys a clone made by an earlier version of this
 * extension wrote into `.git/config`. A copy that keeps `core.symlinks=false`
 * would check a symlink out as a text file.
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
 * The `for-each-ref` format of one local tag: its name, the type and id of
 * the object the ref names, and the type and id that object peels to one
 * level down. A ref name holds no space (`git check-ref-format`), so the
 * fields split on a space. A lightweight tag leaves the peeled fields empty.
 */
const LOCAL_TAG_FORMAT =
  "--format=%(refname:strip=2) %(objecttype) %(objectname) %(*objecttype) %(*objectname)";

/**
 * D-SG-09, D-07-05: the tags a local repository holds, each with the commit
 * it names, in one `for-each-ref refs/tags` on the local lane, so a directory
 * marketplace's release tags are read with no network call. The local
 * counterpart of `listRemoteTags`, and it answers the same shape.
 *
 * A lightweight tag of a commit names it directly, and an annotated tag of a
 * commit names it in the peeled fields. `%(*objectname)` peels one level
 * only, so a tag of a tag is read again with `resolveRef`, whose `^{commit}`
 * peels it all the way. A tag whose object is no commit, such as a tree or a
 * blob, is dropped: it is no candidate a checkout can use (WR-06). Tags come
 * in `for-each-ref`'s refname order.
 */
export async function listLocalTags(
  opts: ListLocalTagsOptions,
  gitProcess: GitProcess = NODE_GIT_PROCESS,
): Promise<RemoteTag[]> {
  const listed = await gitProcess.run({
    subcommand: "for-each-ref",
    lane: "local",
    cwd: opts.dir,
    options: [LOCAL_TAG_FORMAT],
    operands: ["refs/tags"],
    timeoutMs: gitTimeoutMs(),
  });

  const lines = listed.stdout.split("\n").filter((line) => line !== "");
  const peeled = await Promise.all(
    lines.map(async (line) => {
      const [name = "", type, oid = "", peeledType, peeledOid = ""] = line.split(" ");
      const commit = await localTagCommit(opts.dir, gitProcess, {
        name,
        type,
        oid,
        peeledType,
        peeledOid,
      });
      return commit === undefined ? [] : [{ name, oid: commit }];
    }),
  );
  return peeled.flat();
}

/** One `for-each-ref` line of `LOCAL_TAG_FORMAT`, split into its fields. */
interface LocalTagLine {
  readonly name: string;
  readonly type: string | undefined;
  readonly oid: string;
  readonly peeledType: string | undefined;
  readonly peeledOid: string;
}

/** The commit one listed tag names, or undefined when it names none. */
async function localTagCommit(
  dir: string,
  gitProcess: GitProcess,
  line: LocalTagLine,
): Promise<string | undefined> {
  if (line.type === "commit") {
    return line.oid;
  }

  if (line.type !== "tag") {
    return undefined;
  }

  if (line.peeledType === "commit") {
    return line.peeledOid;
  }

  return line.peeledType === "tag"
    ? resolveRef({ dir, ref: `${TAG_REF_PREFIX}${line.name}` }, gitProcess)
    : undefined;
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
 * SG-TRN-01: system git then reads every origin url value, in file
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
      operands: [ORIGIN_URL_KEY],
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
 * SG-SSH-02: what Claude Code's ssh probe of GitHub found. `configured`: the
 * user's ssh authenticated. `not-configured`: GitHub refused every key, the
 * host key is not known, or there is no ssh. `unknown`: anything else, such as
 * a probe that did not answer in time.
 */
export type SshProbeResult = "configured" | "not-configured" | "unknown";

// Claude Code's words in ssh's answers, read in stdout and stderr together.
const SSH_AUTHENTICATED = "successfully authenticated";
const SSH_REFUSALS = ["Permission denied (publickey", "Host key verification failed"] as const;

// The exit codes of ssh: 1 is GitHub's own after it authenticated, because
// it gives no shell; 255 is ssh's own failure.
const GITHUB_SHELL_REFUSED = 1;
const SSH_FAILED = 255;

function probeVerdict(run: SshRun): SshProbeResult {
  if (run.kind === "missing") {
    return "not-configured";
  }

  if (run.exitCode === GITHUB_SHELL_REFUSED && run.output.includes(SSH_AUTHENTICATED)) {
    return "configured";
  }

  if (run.timedOut) {
    return "unknown";
  }

  return run.exitCode === SSH_FAILED && SSH_REFUSALS.some((text) => run.output.includes(text))
    ? "not-configured"
    : "unknown";
}

/**
 * SG-SSH-02: Claude Code's probe of whether the user's ssh authenticates to
 * GitHub, `ssh -T` in batch mode with strict host keys, a 2-second connect
 * limit, and a 3-second run limit. Each run writes its exit code and whether
 * ssh authenticated to the debug log. A launch that throws is `unknown`, and
 * the debug log gets its message with absolute paths removed. Nothing is
 * kept between calls.
 */
export async function probeGitHubSsh(
  gitProcess: SystemGitProcess = NODE_GIT_PROCESS,
): Promise<SshProbeResult> {
  let run: SshRun;
  try {
    run = await gitProcess.ssh("github-probe");
  } catch (error: unknown) {
    hookDebugLog(
      `SSH configuration check failed: ${redactAbsolutePaths(errorMessage(error))}`,
      "git",
    );
    return "unknown";
  }

  const verdict = probeVerdict(run);
  if (run.kind === "ran") {
    hookDebugLog(
      `SSH config check: code=${run.exitCode} configured=${verdict === "configured"}`,
      "git",
    );
  }

  return verdict;
}

/**
 * A credential as git's credential helpers store it: the `username` and
 * `password` attributes of `git credential` (D-31). The keychain protocol of
 * `platform/git-credential.ts` and the one-shot helper of a D-SG-14 retry
 * read and write this shape.
 */
export interface GitCredentials {
  username?: string;
  password?: string;
}
