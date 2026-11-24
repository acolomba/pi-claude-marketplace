import { cp, mkdir } from "node:fs/promises";

import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  GitAuthBundle,
  GitOps,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ListRemotesResult } from "../../extensions/pi-claude-marketplace/platform/git.ts";

export interface GitOpsFakeOptions {
  readonly boundary: "memory";
  readonly allowedRemoteUrls?: readonly string[];
  readonly initialOid?: string;
  readonly updatedOid?: string;
  readonly remoteHead?: string;
  readonly remoteRefs?: Readonly<Record<string, string>>;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly worktreeDir?: string;
  readonly cloneFixture?: {
    readonly boundary: "local";
    readonly sourceDir: string;
  };
  readonly cloneError?: Error;
  readonly checkoutError?: Error;
  readonly resolveRemoteRefError?: Error;
  readonly listRemotesResult?: ListRemotesResult;
  /**
   * Commit ids the fake's clones do not hold. A checkout of one fails as
   * `commit-missing`; a checkout of any other 40-hex SHA succeeds.
   */
  readonly absentCommits?: readonly string[];
}

export interface GitOpsFakeCalls {
  readonly clone: Array<{
    readonly dir: string;
    readonly url: string;
    readonly ref?: string;
    readonly singleBranch?: boolean;
    readonly noCheckout?: boolean;
    readonly auth?: GitAuthBundle;
  }>;
  readonly fetchCommit: Array<{
    readonly dir: string;
    readonly sha: string;
    readonly ref?: string;
    readonly auth?: GitAuthBundle;
  }>;
  readonly checkout: Array<{
    readonly dir: string;
    readonly ref: string;
    readonly fromCopiedGitDir?: boolean;
  }>;
  readonly resolveRef: Array<{ readonly dir: string; readonly ref: string }>;
  readonly resolveRemoteRef: Array<{
    readonly url: string;
    readonly ref?: string;
    readonly auth?: GitAuthBundle;
  }>;
}

export interface GitOpsFakeState {
  readonly calls: GitOpsFakeCalls;
  readonly localRefs: Record<string, string>;
  readonly remoteRefs: Record<string, string>;
  head: string;
  branch: string | undefined;
}

export interface GitOpsFake {
  readonly gitOps: GitOps;
  readonly state: GitOpsFakeState;
  readFile(dir: string, filepath: string): Promise<string | null>;
}

const FULL_SHA = /^[a-f0-9]{40}$/i;

/**
 * The rejection of a system-git checkout that cannot check `ref` out: a 40-hex
 * SHA the clone does not hold is `commit-missing`, and any other name it does
 * not hold is `local-ref-missing` (SG-PRC-05). git prints `fatal: reference is
 * not a tree:` for the first and `fatal: invalid reference:` for the second.
 */
export function checkoutFailure(ref: string): GitCommandError {
  return new GitCommandError(
    { kind: FULL_SHA.test(ref) ? "commit-missing" : "local-ref-missing" },
    { operation: "checkout -f", exitCode: 128 },
  );
}

/**
 * SG-TRN-01: the members of `calls` with at least one recorded call, each
 * with its own record. A case compares this with the members its command
 * uses, so it names no member the command never calls, and an extra call of
 * any member still fails the comparison.
 */
export function recordedCalls(calls: GitOpsFakeCalls): Partial<GitOpsFakeCalls> {
  const members = Object.keys(calls) as Array<keyof GitOpsFakeCalls>;
  return Object.fromEntries(
    members.filter((member) => calls[member].length > 0).map((member) => [member, calls[member]]),
  );
}

function snapshotCloneCall(
  options: Parameters<GitOps["clone"]>[0],
): GitOpsFakeCalls["clone"][number] {
  const { auth, ...dataOptions } = options;
  const snapshot = structuredClone(dataOptions);
  return auth === undefined ? snapshot : { ...snapshot, auth };
}

function snapshotFetchCommitCall(
  options: Parameters<GitOps["fetchCommit"]>[0],
): GitOpsFakeCalls["fetchCommit"][number] {
  const { auth, ...dataOptions } = options;
  const snapshot = structuredClone(dataOptions);
  return auth === undefined ? snapshot : { ...snapshot, auth };
}

function snapshotRemoteRefCall(
  options: Parameters<GitOps["resolveRemoteRef"]>[0],
): GitOpsFakeCalls["resolveRemoteRef"][number] {
  const { auth, ...dataOptions } = options;
  const snapshot = structuredClone(dataOptions);
  return auth === undefined ? snapshot : { ...snapshot, auth };
}

export function createGitOpsFake(options: GitOpsFakeOptions): GitOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createGitOpsFake requires the explicit memory boundary");
  }

  if (options.cloneFixture !== undefined && options.cloneFixture.boundary !== "local") {
    throw new Error("createGitOpsFake clone fixtures require the explicit local boundary");
  }

  const initialOid = options.initialOid ?? "0000000000000000000000000000000000000001";
  const updatedOid = options.updatedOid ?? "0000000000000000000000000000000000000002";
  const remoteHead = options.remoteHead ?? updatedOid;
  const allowedRemoteUrls = new Set(options.allowedRemoteUrls ?? []);
  const files = new Map<string, string>();
  const worktreeDir = options.worktreeDir ?? "/memory/worktree";
  files.set(`${worktreeDir}/README.md`, "# local\n");
  const calls: GitOpsFakeCalls = {
    clone: [],
    fetchCommit: [],
    checkout: [],
    resolveRef: [],
    resolveRemoteRef: [],
  };
  const state: GitOpsFakeState = {
    calls,
    localRefs: {
      "refs/heads/main": initialOid,
      "refs/heads/feature": updatedOid,
      ...(options.localRefs ?? {}),
    },
    remoteRefs: {
      main: remoteHead,
      "v1.0.0": remoteHead,
      ...(options.remoteRefs ?? {}),
    },
    head: initialOid,
    branch: "main",
  };

  function requireRemote(url: string): void {
    if (!allowedRemoteUrls.has(url)) {
      throw new Error(`createGitOpsFake blocked unplanned remote ${url}`);
    }
  }

  const absentCommits = new Set(options.absentCommits ?? []);
  // SG-TRN-02: a `noCheckout` clone writes no work tree; its fixture files
  // arrive with the first checkout of that directory.
  const unchecked = new Map<string, string>();

  function updateWorktree(dir: string, oid: string): void {
    files.set(`${dir}/README.md`, oid === updatedOid ? "# updated\n" : "# local\n");
  }

  const gitOps: GitOps = {
    async clone(cloneOptions) {
      calls.clone.push(snapshotCloneCall(cloneOptions));
      requireRemote(cloneOptions.url);
      if (options.cloneError !== undefined) {
        throw options.cloneError;
      }

      if (options.cloneFixture !== undefined) {
        await mkdir(cloneOptions.dir, { recursive: true });
        if (cloneOptions.noCheckout === true) {
          unchecked.set(cloneOptions.dir, options.cloneFixture.sourceDir);
        } else {
          await cp(options.cloneFixture.sourceDir, cloneOptions.dir, { recursive: true });
        }
      }

      state.localRefs["refs/heads/main"] = remoteHead;
      state.head = remoteHead;
      state.branch = "main";
      if (cloneOptions.noCheckout !== true) {
        updateWorktree(cloneOptions.dir, remoteHead);
      }
    },
    // SG-TRN-02: a commit the fake remote holds becomes a local ref of the
    // clone; any other commit fails the fetch as `commit-missing`.
    async fetchCommit(fetchOptions) {
      calls.fetchCommit.push(snapshotFetchCommitCall(fetchOptions));
      await Promise.resolve();
      const remoteCommits = new Set([remoteHead, ...Object.values(state.remoteRefs)]);
      if (!remoteCommits.has(fetchOptions.sha)) {
        throw new GitCommandError(
          { kind: "commit-missing" },
          { operation: "fetch --depth", exitCode: 128 },
        );
      }

      state.localRefs[fetchOptions.sha] = fetchOptions.sha;
    },
    async checkout(checkoutOptions) {
      calls.checkout.push(structuredClone(checkoutOptions));
      if (options.checkoutError !== undefined) {
        throw options.checkoutError;
      }

      await Promise.resolve();
      const branchOid =
        state.localRefs[checkoutOptions.ref] ??
        state.localRefs[`refs/heads/${checkoutOptions.ref}`];
      const oid =
        branchOid ??
        (FULL_SHA.test(checkoutOptions.ref) && !absentCommits.has(checkoutOptions.ref)
          ? checkoutOptions.ref
          : undefined);
      if (oid === undefined) {
        throw checkoutFailure(checkoutOptions.ref);
      }

      const fixture = unchecked.get(checkoutOptions.dir);
      if (fixture !== undefined) {
        unchecked.delete(checkoutOptions.dir);
        await cp(fixture, checkoutOptions.dir, { recursive: true });
      }

      state.head = oid;
      state.branch =
        branchOid === undefined ? undefined : checkoutOptions.ref.replace("refs/heads/", "");
      updateWorktree(checkoutOptions.dir, oid);
    },
    async resolveRef(resolveOptions) {
      calls.resolveRef.push(structuredClone(resolveOptions));
      await Promise.resolve();
      if (resolveOptions.ref === "HEAD") {
        return state.head;
      }

      return state.localRefs[resolveOptions.ref];
    },
    async resolveRemoteRef(resolveOptions) {
      calls.resolveRemoteRef.push(snapshotRemoteRefCall(resolveOptions));
      requireRemote(resolveOptions.url);
      if (options.resolveRemoteRefError !== undefined) {
        throw options.resolveRemoteRefError;
      }

      await Promise.resolve();
      return resolveOptions.ref === undefined ? remoteHead : state.remoteRefs[resolveOptions.ref];
    },
    // D-3-03: no call ledger. `git-ops-fake.test.ts` deep-equals the whole
    // `state.calls` object, and the guard calls this member at most once per
    // add -- a single canned result is sufficient. `opts.dir` is read (and
    // discarded) rather than dropped from the signature, so GATE-01 sees a
    // runtime read of the interface member's parameter.
    async listRemotes(listRemotesOptions) {
      void listRemotesOptions.dir;
      await Promise.resolve();
      return options.listRemotesResult ?? { kind: "not-a-repo" };
    },
  };

  return {
    gitOps,
    state,
    readFile: async (dir, filepath) => {
      await Promise.resolve();
      return files.get(`${dir}/${filepath}`) ?? null;
    },
  };
}
