import { cp, mkdir } from "node:fs/promises";

import type {
  GitAuthBundle,
  GitOps,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

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
  readonly fetchError?: Error;
  readonly checkoutError?: Error;
  readonly resolveRemoteRefError?: Error;
}

export interface GitOpsFakeCalls {
  readonly clone: Array<{
    readonly dir: string;
    readonly url: string;
    readonly ref?: string;
    readonly singleBranch?: boolean;
    readonly auth?: GitAuthBundle;
  }>;
  readonly fetch: Array<{
    readonly dir: string;
    readonly remote?: string;
    readonly ref?: string;
    readonly auth?: GitAuthBundle;
  }>;
  readonly forceUpdateRef: Array<{
    readonly dir: string;
    readonly ref: string;
    readonly value: string;
  }>;
  readonly checkout: Array<{ readonly dir: string; readonly ref: string }>;
  readonly resolveRef: Array<{ readonly dir: string; readonly ref: string }>;
  readonly currentBranch: Array<{ readonly dir: string }>;
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

function notFound(ref: string): Error & { code: string } {
  const error = new Error(`Could not find ${ref}.`);
  error.name = "NotFoundError";
  return Object.assign(error, { code: "NotFoundError" });
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
    fetch: [],
    forceUpdateRef: [],
    checkout: [],
    resolveRef: [],
    currentBranch: [],
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

  function updateWorktree(dir: string, oid: string): void {
    files.set(`${dir}/README.md`, oid === updatedOid ? "# updated\n" : "# local\n");
  }

  const gitOps: GitOps = {
    async clone(cloneOptions) {
      calls.clone.push(structuredClone(cloneOptions));
      requireRemote(cloneOptions.url);
      if (options.cloneError !== undefined) {
        throw options.cloneError;
      }

      if (options.cloneFixture !== undefined) {
        await mkdir(cloneOptions.dir, { recursive: true });
        await cp(options.cloneFixture.sourceDir, cloneOptions.dir, { recursive: true });
      }

      state.localRefs["refs/heads/main"] = remoteHead;
      state.head = remoteHead;
      state.branch = "main";
      updateWorktree(cloneOptions.dir, remoteHead);
    },
    async fetch(fetchOptions) {
      calls.fetch.push(structuredClone(fetchOptions));
      if (options.fetchError !== undefined) {
        throw options.fetchError;
      }

      await Promise.resolve();
      const remote = fetchOptions.remote ?? "origin";
      const ref = fetchOptions.ref ?? "main";
      state.localRefs[`refs/remotes/${remote}/${ref}`] = state.remoteRefs[ref] ?? remoteHead;
    },
    async forceUpdateRef(updateOptions) {
      calls.forceUpdateRef.push(structuredClone(updateOptions));
      await Promise.resolve();
      state.localRefs[updateOptions.ref] = updateOptions.value;
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
        (/^[a-f0-9]{40}$/i.test(checkoutOptions.ref) ? checkoutOptions.ref : undefined);
      if (oid === undefined) {
        throw notFound(checkoutOptions.ref);
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

      const oid = state.localRefs[resolveOptions.ref];
      if (oid === undefined) {
        throw notFound(resolveOptions.ref);
      }

      return oid;
    },
    async currentBranch(branchOptions) {
      calls.currentBranch.push(structuredClone(branchOptions));
      await Promise.resolve();
      return state.branch;
    },
    async resolveRemoteRef(resolveOptions) {
      calls.resolveRemoteRef.push(structuredClone(resolveOptions));
      requireRemote(resolveOptions.url);
      if (options.resolveRemoteRefError !== undefined) {
        throw options.resolveRemoteRefError;
      }

      await Promise.resolve();
      if (resolveOptions.ref === undefined) {
        return remoteHead;
      }

      const oid = state.remoteRefs[resolveOptions.ref];
      if (oid === undefined) {
        throw new Error(`remote ${resolveOptions.url} has no ref "${resolveOptions.ref}"`);
      }

      return oid;
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
