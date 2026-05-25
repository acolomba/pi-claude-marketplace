/**
 * tests/helpers/git-mock.ts -- in-memory GitOps stub for Phase 4 tests.
 *
 * The returned mock implements the same 5-method GitOps interface
 * defined in `orchestrators/marketplace/shared.ts` (clone / fetch /
 * forceUpdateRef / checkout / resolveRef). The mock maintains a small
 * in-memory bookkeeping record (HEAD SHA, remote/local refs maps,
 * call logs) that test bodies mutate between calls to simulate
 * force-push and ref-deletion. The mock optionally copies a real
 * fixture directory into the requested staging dir when `clone()`
 * fires -- that is how add.test.ts and update.test.ts exercise the
 * "clone advanced; manifest read" path without touching the network.
 *
 * Strategy: each mock method records its call args in a call log so
 * tests can assert the D-14 sequence (fetch -> forceUpdateRef ->
 * checkout) is called in the exact prescribed order with the correct
 * ref names. Tests that exercise NFR-5 (path-source `add` MUST NOT
 * touch network) assert call logs are empty.
 */

import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

export interface MockGitState {
  /** Map: 'refs/remotes/origin/<branch>' -> SHA. Mutate to simulate force-push. */
  remoteRefs: Record<string, string>;
  /** Map: 'refs/heads/<branch>' -> SHA. forceUpdateRef writes here. */
  localRefs: Record<string, string>;
  /** Current HEAD SHA. checkout updates this. */
  head: string;
  /**
   * Optional fixture root. When set, clone() copies the contents of
   * this directory into opts.dir (so the orchestrator can read the
   * fixture's marketplace.json after the clone returns).
   */
  fixtureSourceDir?: string;
  /** Call logs for D-14 sequence assertions. */
  /**
   * CR-01: optional override for `gitOps.currentBranch`. When set, the
   * mock returns this value instead of inferring from localRefs. Use
   * `null` to simulate a detached HEAD (the mock translates null to
   * undefined when calling). When unset, the mock derives "main" from
   * the default localRefs (or undefined if none).
   */
  currentBranchOverride?: string | null;
  cloneCalls: { dir: string; url: string; ref?: string; singleBranch?: boolean }[];
  fetchCalls: { dir: string; remote?: string; ref?: string }[];
  forceUpdateRefCalls: { dir: string; ref: string; value: string }[];
  checkoutCalls: { dir: string; ref: string }[];
  resolveRefCalls: { dir: string; ref: string }[];
  currentBranchCalls: { dir: string }[];
  /**
   * Optional override hooks: tests can install behavior overrides
   * for individual methods (e.g., make checkout throw to simulate
   * the SHA-no-longer-exists case under D-14).
   */
  cloneThrows?: Error;
  fetchThrows?: Error;
  checkoutThrows?: Error;
}

export interface MockGitOpsHandle {
  readonly gitOps: GitOps;
  readonly state: MockGitState;
}

/**
 * Build a fresh mock GitOps + bookkeeping state. Tests pass `state`
 * to assertions and mutate it between orchestrator calls.
 */
export function makeMockGitOps(initial?: Partial<MockGitState>): MockGitOpsHandle {
  const state: MockGitState = {
    remoteRefs: { ...(initial?.remoteRefs ?? {}) },
    localRefs: { ...(initial?.localRefs ?? {}) },
    head: initial?.head ?? "",
    cloneCalls: [],
    fetchCalls: [],
    forceUpdateRefCalls: [],
    checkoutCalls: [],
    resolveRefCalls: [],
    currentBranchCalls: [],
    ...(initial?.fixtureSourceDir !== undefined && { fixtureSourceDir: initial.fixtureSourceDir }),
    ...(initial?.cloneThrows !== undefined && { cloneThrows: initial.cloneThrows }),
    ...(initial?.fetchThrows !== undefined && { fetchThrows: initial.fetchThrows }),
    ...(initial?.checkoutThrows !== undefined && { checkoutThrows: initial.checkoutThrows }),
    ...(initial?.currentBranchOverride !== undefined && {
      currentBranchOverride: initial.currentBranchOverride,
    }),
  };

  const gitOps: GitOps = {
    async clone(opts): Promise<void> {
      state.cloneCalls.push({ ...opts });
      if (state.cloneThrows !== undefined) {
        throw state.cloneThrows;
      }

      await mkdir(opts.dir, { recursive: true });
      if (state.fixtureSourceDir !== undefined) {
        // Copy fixture contents into the requested clone dir. The
        // orchestrator then reads `<dir>/.claude-plugin/marketplace.json`
        // exactly as it would after a real clone.
        await cp(state.fixtureSourceDir, opts.dir, { recursive: true });
      }

      // Initialize a default branch ref so subsequent resolveRef
      // queries return a deterministic SHA (tests can override
      // before clone if they want a specific value).
      if (Object.keys(state.localRefs).length === 0) {
        state.localRefs["refs/heads/main"] =
          state.head || "0000000000000000000000000000000000000001";
        state.head = state.localRefs["refs/heads/main"]!;
      }
    },

    async fetch(opts): Promise<void> {
      state.fetchCalls.push({ ...opts });
      if (state.fetchThrows !== undefined) {
        throw state.fetchThrows;
      }

      // No-op: real fetch refreshes remote refs; tests mutate
      // state.remoteRefs directly between fetch and forceUpdateRef
      // to simulate the upstream change.
      await Promise.resolve();
    },

    async forceUpdateRef(opts): Promise<void> {
      state.forceUpdateRefCalls.push({ ...opts });
      state.localRefs[opts.ref] = opts.value;
      return Promise.resolve();
    },

    async checkout(opts): Promise<void> {
      state.checkoutCalls.push({ ...opts });
      if (state.checkoutThrows !== undefined) {
        throw state.checkoutThrows;
      }

      await Promise.resolve();
      // Resolve the ref against local then remote. If neither has it,
      // throw -- this mirrors isomorphic-git's behavior for a
      // SHA-no-longer-exists case (D-14 detached-HEAD failure path).
      const fromLocal = state.localRefs[opts.ref] ?? state.localRefs[`refs/heads/${opts.ref}`];
      const fromRemote =
        state.remoteRefs[opts.ref] ?? state.remoteRefs[`refs/remotes/origin/${opts.ref}`];
      const resolved = fromLocal ?? fromRemote;
      if (resolved === undefined) {
        // Treat 40-char hex strings as direct SHAs; otherwise fail.
        if (/^[a-f0-9]{40}$/i.test(opts.ref)) {
          state.head = opts.ref;
          return;
        }

        throw new Error(`mock checkout: unknown ref "${opts.ref}"`);
      }

      state.head = resolved;
    },

    async resolveRef(opts): Promise<string> {
      state.resolveRefCalls.push({ ...opts });
      await Promise.resolve();
      const fromLocal = state.localRefs[opts.ref];
      if (fromLocal !== undefined) {
        return fromLocal;
      }

      const fromRemote = state.remoteRefs[opts.ref];
      if (fromRemote !== undefined) {
        return fromRemote;
      }

      // HEAD: return current head SHA.
      if (opts.ref === "HEAD") {
        return state.head;
      }

      if (opts.ref === "refs/remotes/origin/HEAD") {
        const fallback = state.remoteRefs["refs/remotes/origin/main"];
        if (fallback !== undefined) {
          return fallback;
        }
      }

      // Mirror isomorphic-git's actual behavior: a missing ref throws
      // `NotFoundError` (with both `name` and `code` set to that
      // string). Orchestrator code at `refreshGitHubClone` distinguishes
      // this from real failures (EACCES, corrupted git dir) via the
      // `name` check, so the mock MUST tag this error correctly --
      // otherwise the detached-HEAD fallback path stops working in
      // tests that rely on resolveRef-throws-to-fall-back-to-checkout.
      const nfe = new Error(`mock resolveRef: unknown ref "${opts.ref}"`);
      nfe.name = "NotFoundError";
      throw nfe;
    },

    async currentBranch(opts): Promise<string | undefined> {
      state.currentBranchCalls.push({ ...opts });
      await Promise.resolve();
      // CR-01: explicit override wins (null = detached HEAD).
      if (state.currentBranchOverride !== undefined) {
        return state.currentBranchOverride ?? undefined;
      }

      // Default: derive from localRefs. If "refs/heads/main" is the only
      // local branch, that's the current one. Otherwise undefined
      // (detached HEAD).
      const headKeys = Object.keys(state.localRefs).filter((k) => k.startsWith("refs/heads/"));
      if (headKeys.length === 1) {
        return headKeys[0]!.slice("refs/heads/".length);
      }

      return undefined;
    },
  };

  return { gitOps, state };
}

/**
 * Convenience: return an absolute path to the fixture root used by
 * Phase 4 orchestrator tests. Centralized so test files don't
 * recompute the path.
 */
export function fixtureMarketplaceDir(
  name: "valid-marketplace" | "invalid-manifest" | "empty-marketplace",
): string {
  // tests/helpers/git-mock.ts -> ../orchestrators/marketplace/_fixtures/<name>
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "orchestrators",
    "marketplace",
    "_fixtures",
    name,
  );
}
