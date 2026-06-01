// tests/orchestrators/marketplace/shared.test.ts
//
// Focused unit tests for `refreshGitHubClone`'s typed catch around
// `gitOps.resolveRef('refs/remotes/origin/<storedRef>')`. The catch only
// swallows isomorphic-git's `NotFoundError` (which has
// `err.name === "NotFoundError"`) into the detached-HEAD fallback path;
// any other failure (EACCES, corrupted git dir, programming bug in a
// `GitOps` stub) must propagate so the caller surfaces the real cause
// instead of silently falling back to stale local state.
//
// Phase 34 (v1.6): three additional tests lock the auth-threading
// contract on refreshGitHubClone (AUTH-01, AUTH-02).

import assert from "node:assert/strict";
import test from "node:test";

import { refreshGitHubClone } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";

import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/platform/git.ts";

interface CallLog {
  fetch: { dir: string; remote?: string; ref?: string; auth?: GitAuthBundle }[];
  resolveRef: { dir: string; ref: string }[];
  forceUpdateRef: { dir: string; ref: string; value: string }[];
  checkout: { dir: string; ref: string }[];
  currentBranch: number;
  clone: number;
}

function makeStubGitOps(opts: { resolveRefThrows?: Error; resolveRefReturns?: string }): {
  gitOps: GitOps;
  log: CallLog;
} {
  const log: CallLog = {
    fetch: [],
    resolveRef: [],
    forceUpdateRef: [],
    checkout: [],
    currentBranch: 0,
    clone: 0,
  };

  const gitOps: GitOps = {
    async clone(): Promise<void> {
      log.clone++;
      await Promise.resolve();
    },
    async fetch(args): Promise<void> {
      log.fetch.push({ ...args });
      await Promise.resolve();
    },
    async forceUpdateRef(args): Promise<void> {
      log.forceUpdateRef.push({ ...args });
      await Promise.resolve();
    },
    async checkout(args): Promise<void> {
      log.checkout.push({ ...args });
      await Promise.resolve();
    },
    async resolveRef(args): Promise<string> {
      log.resolveRef.push({ ...args });
      await Promise.resolve();
      if (opts.resolveRefThrows !== undefined) {
        throw opts.resolveRefThrows;
      }

      return opts.resolveRefReturns ?? "0000000000000000000000000000000000000001";
    },
    async currentBranch(): Promise<string | undefined> {
      log.currentBranch++;
      await Promise.resolve();
      return undefined;
    },
  };

  return { gitOps, log };
}

test("refreshGitHubClone: NotFoundError on resolveRef falls back to detached checkout", async () => {
  // isomorphic-git's NotFoundError has both `name` and `code` set to the
  // string "NotFoundError" (see node_modules/isomorphic-git/index.cjs).
  const nfe = new Error("Could not find ref refs/remotes/origin/v1.0.0.");
  nfe.name = "NotFoundError";

  const { gitOps, log } = makeStubGitOps({ resolveRefThrows: nfe });

  await refreshGitHubClone("/tmp/clone-dir", "v1.0.0", gitOps);

  // resolveRef threw NotFoundError -> remoteSha undefined -> detached-HEAD
  // checkout against the storedRef directly. forceUpdateRef must NOT be
  // called in this path.
  assert.equal(log.fetch.length, 1);
  assert.equal(log.resolveRef.length, 1);
  assert.equal(log.resolveRef[0]?.ref, "refs/remotes/origin/v1.0.0");
  assert.equal(log.forceUpdateRef.length, 0);
  assert.equal(log.checkout.length, 1);
  assert.equal(log.checkout[0]?.ref, "v1.0.0");
});

test("refreshGitHubClone: non-NotFoundError on resolveRef propagates", async () => {
  // Any other error (EACCES on .git, corrupted pack, programming bug)
  // must NOT be swallowed: the caller needs the real cause, not a
  // misleading silent fallback to stale local state.
  const eaccess = new Error("EACCES: permission denied, open '/path/.git/refs/.../HEAD'");

  const { gitOps, log } = makeStubGitOps({ resolveRefThrows: eaccess });

  await assert.rejects(refreshGitHubClone("/tmp/clone-dir", "v1.0.0", gitOps), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal(err.message, eaccess.message);
    return true;
  });

  assert.equal(log.fetch.length, 1);
  assert.equal(log.resolveRef.length, 1);
  // The fallback paths (checkout / forceUpdateRef) must NOT have run.
  assert.equal(log.forceUpdateRef.length, 0);
  assert.equal(log.checkout.length, 0);
});

test("refreshGitHubClone: resolveRef returns SHA -> forceUpdateRef + checkout", async () => {
  // Sanity check the happy path so the test file proves coverage on
  // both arms of the typed catch.
  const sha = "abcdef0000000000000000000000000000000000";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  await refreshGitHubClone("/tmp/clone-dir", "main", gitOps);

  assert.equal(log.fetch.length, 1);
  assert.equal(log.resolveRef.length, 1);
  assert.equal(log.forceUpdateRef.length, 1);
  assert.equal(log.forceUpdateRef[0]?.ref, "refs/heads/main");
  assert.equal(log.forceUpdateRef[0]?.value, sha);
  assert.equal(log.checkout.length, 1);
  assert.equal(log.checkout[0]?.ref, "main");
});

// Phase 34 (v1.6) auth-threading tests (AUTH-01, AUTH-02).

test("refreshGitHubClone: without auth omits the auth field on gitOps.fetch", async () => {
  // Proves the pre-v1.6 4-arg calling convention is preserved:
  // the new optional auth parameter does NOT inject a field when omitted.
  const sha = "1111111111111111111111111111111111111111";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  await refreshGitHubClone("/tmp/clone-dir", "main", gitOps);

  assert.equal(log.fetch.length, 1);
  // The spread `...(auth !== undefined && { auth })` must NOT add the
  // field when auth is undefined.
  assert.equal(log.fetch[0]?.auth, undefined);
});

test("refreshGitHubClone: with auth bundle forwards the same bundle into gitOps.fetch", async () => {
  // Proves the bundle is threaded BY REFERENCE (strictEqual) without
  // re-bundling. AUTH-09: no real credential material in the test.
  const sha = "2222222222222222222222222222222222222222";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  const { credOps: credentialOps } = makeMockCredentialOps();
  let onAuthRequiredCalls = 0;
  const onAuthRequired = async (): Promise<AuthAttemptResult> => {
    onAuthRequiredCalls++;
    return Promise.resolve({ ok: false, reason: "not invoked", authAttempted: true });
  };

  const auth: GitAuthBundle = { credentialOps, host: "github.com", onAuthRequired };

  await refreshGitHubClone("/tmp/clone-dir", "main", gitOps, undefined, auth);

  assert.equal(log.fetch.length, 1);
  // Reference equality: the exact same bundle object was forwarded.
  assert.strictEqual(log.fetch[0]?.auth, auth);
  // Lock each component.
  assert.equal(log.fetch[0]?.auth?.host, "github.com");
  assert.strictEqual(log.fetch[0]?.auth?.credentialOps, credentialOps);
  assert.strictEqual(log.fetch[0]?.auth?.onAuthRequired, onAuthRequired);
  // The stub fetch does not consult the bundle; onAuthRequired must NOT fire.
  assert.equal(onAuthRequiredCalls, 0);
});

test("refreshGitHubClone: with auth bundle invokes onFetchSucceeded after gitOps.fetch", async () => {
  // Proves that passing both the 4th and 5th optional args together works.
  const sha = "3333333333333333333333333333333333333333";
  const { gitOps, log } = makeStubGitOps({ resolveRefReturns: sha });

  const { credOps: credentialOps } = makeMockCredentialOps();
  const onAuthRequired = async (): Promise<AuthAttemptResult> =>
    Promise.resolve({ ok: false, reason: "not invoked", authAttempted: true });
  const auth: GitAuthBundle = { credentialOps, host: "github.com", onAuthRequired };

  let fetchSucceededCount = 0;
  const onFetchSucceeded = () => {
    fetchSucceededCount++;
  };

  await refreshGitHubClone("/tmp/clone-dir", "main", gitOps, onFetchSucceeded, auth);

  // onFetchSucceeded fires after gitOps.fetch returns.
  assert.equal(fetchSucceededCount, 1);
  assert.equal(log.fetch.length, 1);
  // Auth bundle forwarded by reference.
  assert.strictEqual(log.fetch[0]?.auth, auth);
});
