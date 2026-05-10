import * as fs from "node:fs";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

/**
 * platform/git.ts -- isomorphic-git wrapper (D-18, D-19, D-20).
 *
 * Drops V1's `execFile("git", [...])` shell-out and replaces with pure-JS
 * `isomorphic-git`. Removes the `git not found on PATH` failure mode
 * entirely (which is why D-21 supersedes MA-7 in REQUIREMENTS.md).
 *
 * Pins `fs` (Node's built-in) and `http` (`isomorphic-git/http/node`) so
 * Phase 4's marketplace orchestrators don't thread them through every call.
 *
 * The `listRemotes` wrapper (W-4) is exposed here in Phase 1 even though
 * Phase 4 is the consumer -- shipping it now keeps the import-x boundary
 * verification surface complete and avoids a Phase 4 plan needing to
 * touch this file.
 *
 * NOT exposed:
 *   - sparse checkout (PRD §11 deferred; isomorphic-git also doesn't support it)
 *   - shallow clones / depth (deferred until needed; V1 keeps full history)
 *   - submodules (V1 doesn't follow git submodules)
 *   - custom auth (public GitHub only in V1)
 *
 * Phase 1 ships the wrapper as the canonical platform-git surface;
 * Phase 4 will be its first caller.
 */

export interface CloneOptions {
  /**
   * Working-tree directory. Must be on the same filesystem as its destination
   * parent if the caller plans to atomic-rename a clone into place.
   */
  dir: string;
  /** Remote URL -- V1 accepts only https://github.com/<owner>/<repo>[.git] (SP-3). */
  url: string;
  /** Optional ref (branch/tag/SHA) to check out. If omitted, the default branch. */
  ref?: string;
  /** If a specific ref is given, fetch only that branch -- saves bandwidth. */
  singleBranch?: boolean;
}

export interface FetchOptions {
  dir: string;
  /** Default "origin". */
  remote?: string;
  /** Optional ref to fetch. */
  ref?: string;
}

export interface PullOptions {
  dir: string;
  /** Default "origin". */
  remote?: string;
  /** Author for any merge commit (isomorphic-git requires it on pull). */
  author: { name: string; email: string };
  /** Optional ref. */
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

export interface ForceUpdateRefOptions {
  dir: string;
  ref: string;
  value: string;
}

export interface ListBranchesOptions {
  dir: string;
  /** Default undefined = local branches; pass "origin" for remote branches. */
  remote?: string;
}

export interface ListRemotesOptions {
  dir: string;
  /** Optional gitdir (defaults to `<dir>/.git`). Phase 4 typically omits. */
  gitdir?: string;
}

export async function clone(opts: CloneOptions): Promise<void> {
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
    // No depth (V1 keeps full history). No corsProxy (Node only). No onAuth (public).
  });
}

export async function fetch(opts: FetchOptions): Promise<git.FetchResult> {
  return git.fetch({
    fs,
    http,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(opts.ref !== undefined && { ref: opts.ref }),
  });
}

export async function pull(opts: PullOptions): Promise<void> {
  await git.pull({
    fs,
    http,
    dir: opts.dir,
    author: opts.author,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(opts.ref !== undefined && { ref: opts.ref }),
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
 * D-14 step 2 (symbolic HEAD): force-set a local ref to a given SHA.
 * Wraps isomorphic-git's `writeRef({ force: true })`. Phase 4
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
