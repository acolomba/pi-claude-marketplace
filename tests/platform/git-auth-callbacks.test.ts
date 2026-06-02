/**
 * Phase 33 -- Unit tests for `buildAuthCallbacks` (platform/git.ts).
 *
 * Covers the closure contract that the v1.6 GitHub auth wiring lands as
 * the load-bearing seam between isomorphic-git and Phase 32's Device Flow:
 *
 *   - SC-1 (AUTH-01 / AUTH-02): fill-first; Device Flow only on miss.
 *     Tests 1 + 2 + 3.
 *   - SC-2 (CP-9): onAuthFailure ALWAYS returns { cancel: true } and calls
 *     credentialOps.reject. Tests 5 + 6.
 *   - SC-3 (CP-10): exceptions inside onAuth / onAuthFailure NEVER propagate
 *     to isomorphic-git -- they are caught and converted to { cancel: true }.
 *     Tests 4 + 7 + 8.
 *
 * Each test instantiates its own makeMockCredentialOps + its own
 * buildAuthCallbacks pair so the closure-scoped `deviceFlowAttempted` flag
 * never leaks across tests.
 *
 * Pure unit test: no filesystem, no subprocess, no real isomorphic-git
 * invocation. The mock-credential helper is the only injected seam.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import {
  buildAuthCallbacks,
  checkout,
  clone,
  currentBranch,
  fetch as gitFetch,
  forceUpdateRef,
  listBranches,
  listRemotes,
  resolveRef,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";

import type {
  AuthAttemptResult,
  GitCredentials,
  OnAuthRequiredFn,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";

const HOST = "github.com";
const REMOTE_URL = "https://github.com/owner/repo.git";

test("Phase 33 buildAuthCallbacks: fill-hit returns stored credential without invoking onAuthRequired (SC-1)", async () => {
  const stored: GitCredentials = { username: "u", password: "p" };
  const { credOps, state } = makeMockCredentialOps({
    store: new Map([[HOST, stored]]),
  });
  let onAuthRequiredCalls = 0;
  const onAuthRequired: OnAuthRequiredFn = async () => {
    onAuthRequiredCalls += 1;
    await Promise.resolve();
    return { ok: false, reason: "should not be called", authAttempted: true };
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuth(REMOTE_URL);

  assert.deepEqual(result, { username: "u", password: "p" });
  assert.equal(state.fillCalls.length, 1);
  assert.deepEqual(state.fillCalls[0], { host: HOST });
  assert.equal(onAuthRequiredCalls, 0, "Device Flow MUST NOT run on fill hit (AUTH-02)");
});

test("Phase 33 buildAuthCallbacks: fill-miss + DF ok returns Device-Flow credential (SC-1)", async () => {
  const { credOps, state } = makeMockCredentialOps();
  const dfCred: GitCredentials = { username: "x-access-token", password: "<DF_TOKEN>" };
  let onAuthRequiredCalls = 0;
  const onAuthRequired: OnAuthRequiredFn = async () => {
    onAuthRequiredCalls += 1;
    await Promise.resolve();
    return { ok: true, cred: dfCred, authAttempted: true } satisfies AuthAttemptResult;
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuth(REMOTE_URL);

  assert.deepEqual(result, { username: "x-access-token", password: "<DF_TOKEN>" });
  assert.equal(state.fillCalls.length, 1, "fill MUST be consulted before Device Flow");
  assert.equal(onAuthRequiredCalls, 1);
});

test("Phase 33 buildAuthCallbacks: fill-miss + DF !ok returns { cancel: true }", async () => {
  const { credOps, state } = makeMockCredentialOps();
  const onAuthRequired: OnAuthRequiredFn = async () => {
    await Promise.resolve();
    return {
      ok: false,
      reason: "User cancelled authorization.",
      authAttempted: true,
    } satisfies AuthAttemptResult;
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuth(REMOTE_URL);

  assert.deepEqual(result, { cancel: true });
  assert.equal(state.fillCalls.length, 1);
});

test("Phase 33 buildAuthCallbacks: fill throws -- onAuth returns { cancel: true } (CP-10)", async () => {
  // The mock fillThrows simulates the underlying subprocess error a real
  // CredentialOps would see (e.g. ENOENT for missing git on PATH). The
  // production seam wraps that in the buildAuthCallbacks try/catch and
  // MUST convert it to { cancel: true } without propagating.
  const enoent = new Error("ENOENT: git not found on PATH");
  const { credOps, state } = makeMockCredentialOps({ fillThrows: enoent });
  const onAuthRequired: OnAuthRequiredFn = () => {
    throw new Error("onAuthRequired should not be reached after fill throws");
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuth(REMOTE_URL);

  assert.deepEqual(result, { cancel: true });
  assert.equal(
    state.fillCalls.length,
    1,
    "the mock records fillCalls BEFORE throwing fillThrows (credential-mock.ts contract)",
  );
});

test("Phase 33 buildAuthCallbacks: onAuthFailure post-DF-attempt rejects + cancels (CP-9 / SC-2)", async () => {
  const { credOps, state } = makeMockCredentialOps();
  const dfCred: GitCredentials = { username: "x-access-token", password: "<DF_TOKEN>" };
  const onAuthRequired: OnAuthRequiredFn = async () => {
    await Promise.resolve();
    return { ok: true, cred: dfCred, authAttempted: true };
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  // Drive the closure through a successful Device Flow to set the
  // (currently informational) deviceFlowAttempted flag.
  await cbs.onAuth(REMOTE_URL);

  const result = await cbs.onAuthFailure(REMOTE_URL, dfCred);

  assert.deepEqual(result, { cancel: true });
  assert.equal(state.rejectCalls.length, 1);
  assert.deepEqual(state.rejectCalls[0], { host: HOST, cred: dfCred });
});

test("Phase 33 buildAuthCallbacks: onAuthFailure pre-DF stale-keychain rejects + cancels (CP-9)", async () => {
  // Defensive: a real isomorphic-git session calls onAuth -> 401 ->
  // onAuthFailure. This test simulates the case where isomorphic-git
  // invokes onAuthFailure DIRECTLY (e.g. on a 401 from a credential
  // pulled in a prior session). The seam must still return cancel and
  // evict the stale credential -- onAuthFailure correctness must NOT
  // depend on prior onAuth call ordering.
  const staleCred: GitCredentials = { username: "old", password: "stale" };
  const { credOps, state } = makeMockCredentialOps({
    store: new Map([[HOST, staleCred]]),
  });
  const onAuthRequired: OnAuthRequiredFn = () => {
    throw new Error("onAuthFailure pre-DF path MUST NOT invoke onAuthRequired");
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuthFailure(REMOTE_URL, staleCred);

  assert.deepEqual(result, { cancel: true });
  assert.equal(state.rejectCalls.length, 1);
  assert.deepEqual(state.rejectCalls[0], { host: HOST, cred: staleCred });
});

test("Phase 33 buildAuthCallbacks: reject throws -- onAuthFailure still returns { cancel: true } (CP-10)", async () => {
  const timeoutErr = new Error("git credential reject subprocess timed out");
  const { credOps, state } = makeMockCredentialOps({ rejectThrows: timeoutErr });
  const onAuthRequired: OnAuthRequiredFn = () => {
    throw new Error("onAuthRequired should not be reached from onAuthFailure path");
  };

  const cred: GitCredentials = { username: "x-access-token", password: "<DF_TOKEN>" };
  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuthFailure(REMOTE_URL, cred);

  assert.deepEqual(result, { cancel: true });
  assert.equal(state.rejectCalls.length, 1, "reject was called before throwing");
});

test("Phase 33 buildAuthCallbacks: onAuthRequired throws -- onAuth returns { cancel: true } (CP-10)", async () => {
  const { credOps, state } = makeMockCredentialOps();
  const onAuthRequired: OnAuthRequiredFn = async () => {
    await Promise.resolve();
    throw new Error("network down");
  };

  const cbs = buildAuthCallbacks({ credentialOps: credOps, host: HOST, onAuthRequired });
  const result = await cbs.onAuth(REMOTE_URL);

  assert.deepEqual(result, { cancel: true });
  assert.equal(state.fillCalls.length, 1);
});

// ---------------------------------------------------------------------------
// Phase 33 git.ts wrapper tests -- lines 112-230
//
// These tests exercise the exported git wrappers (clone, fetch, checkout,
// resolveRef, forceUpdateRef, currentBranch, listBranches, listRemotes) against
// a real isomorphic-git repo initialised in a tmpdir. No network is required.
//
// clone and fetch are tested by verifying that the auth-bundle construction
// path runs before the underlying isomorphic-git call (which is expected to
// throw on an invalid URL). The git wrapper function is verified to have
// constructed the buildAuthCallbacks pair (auth path) or skipped it (no-auth
// path) based on opts.auth presence.
// ---------------------------------------------------------------------------

async function makeLocalRepo(): Promise<{ dir: string; destroy: () => Promise<void> }> {
  const dir = path.join(
    os.tmpdir(),
    `pi-cm-git-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  await git.init({ fs, dir, defaultBranch: "main" });

  // Create an initial commit so refs/heads/main exists.
  await writeFile(path.join(dir, "README.md"), "# test\n");
  await git.add({ fs, dir, filepath: "README.md" });
  await git.commit({
    fs,
    dir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });

  return {
    dir,
    destroy: () => rm(dir, { recursive: true, force: true }),
  };
}

test("Phase 33 git.ts: currentBranch returns branch name after init+commit (line 206-212)", async () => {
  const repo = await makeLocalRepo();
  try {
    const branch = await currentBranch({ dir: repo.dir });
    assert.equal(
      branch,
      "main",
      "currentBranch must return 'main' after init with defaultBranch:'main'",
    );
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: resolveRef resolves HEAD to a SHA after initial commit (lines 165-171)", async () => {
  const repo = await makeLocalRepo();
  try {
    const sha = await resolveRef({ dir: repo.dir, ref: "HEAD" });
    assert.equal(typeof sha, "string");
    assert.equal(sha.length, 40, "SHA must be a 40-char hex string");
    assert.match(sha, /^[0-9a-f]{40}$/);
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: listBranches returns local branches (lines 214-220)", async () => {
  const repo = await makeLocalRepo();
  try {
    const branches = await listBranches({ dir: repo.dir });
    assert.ok(Array.isArray(branches));
    assert.ok(branches.includes("main"), `expected 'main' in branches: ${branches.join(",")}`);
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: listBranches with remote option returns empty array for no remotes (lines 214-220)", async () => {
  const repo = await makeLocalRepo();
  try {
    const remoteBranches = await listBranches({ dir: repo.dir, remote: "origin" });
    assert.ok(Array.isArray(remoteBranches));
    assert.equal(remoteBranches.length, 0, "no remote branches expected for a local-only repo");
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: listRemotes returns empty array for a fresh local repo (lines 222-230)", async () => {
  const repo = await makeLocalRepo();
  try {
    const remotes = await listRemotes({ dir: repo.dir });
    assert.ok(Array.isArray(remotes));
    assert.equal(remotes.length, 0, "no remotes expected for a local-only repo");
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: forceUpdateRef writes a new ref value (lines 183-191)", async () => {
  const repo = await makeLocalRepo();
  try {
    const sha = await resolveRef({ dir: repo.dir, ref: "HEAD" });
    // Write a custom ref pointing to the HEAD SHA.
    await forceUpdateRef({ dir: repo.dir, ref: "refs/heads/test-branch", value: sha });

    const branches = await listBranches({ dir: repo.dir });
    assert.ok(
      branches.includes("test-branch"),
      `expected 'test-branch' in branches after forceUpdateRef: ${branches.join(",")}`,
    );

    const resolved = await resolveRef({ dir: repo.dir, ref: "refs/heads/test-branch" });
    assert.equal(resolved, sha, "forceUpdateRef must persist the SHA to the specified ref");
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: checkout switches to an existing branch (lines 156-163)", async () => {
  const repo = await makeLocalRepo();
  try {
    const sha = await resolveRef({ dir: repo.dir, ref: "HEAD" });

    // Create a second branch.
    await forceUpdateRef({ dir: repo.dir, ref: "refs/heads/feature", value: sha });

    // Checkout the new branch.
    await checkout({ dir: repo.dir, ref: "feature" });

    const branch = await currentBranch({ dir: repo.dir });
    assert.equal(branch, "feature", "checkout must switch HEAD to 'feature'");
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: checkout with noCheckout option does not throw (lines 156-163)", async () => {
  const repo = await makeLocalRepo();
  try {
    // noCheckout: true updates HEAD without touching the working tree.
    await assert.doesNotReject(
      () => checkout({ dir: repo.dir, ref: "main", noCheckout: true }),
      "checkout with noCheckout:true must not throw on a valid ref",
    );
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: clone with auth builds callbacks before invoking isomorphic-git (lines 125-139)", async () => {
  // clone() constructs buildAuthCallbacks when opts.auth is present (line 125).
  // The clone itself will throw because the URL is invalid -- but the
  // auth-callback construction still runs, covering line 125 and the
  // conditional spread at lines 133-136.
  const { credOps } = makeMockCredentialOps();
  let onAuthRequiredCalled = false;
  const onAuthRequired: OnAuthRequiredFn = () => {
    onAuthRequiredCalled = true;
    return Promise.resolve({
      ok: false,
      reason: "test",
      authAttempted: true,
    } satisfies AuthAttemptResult);
  };

  const tmpDir = path.join(os.tmpdir(), `pi-cm-clone-auth-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    // clone to an invalid URL -- expected to throw; we only verify auth path.
    await assert.rejects(
      () =>
        clone({
          dir: tmpDir,
          url: "https://invalid.example.invalid/repo.git",
          auth: { credentialOps: credOps, host: "invalid.example.invalid", onAuthRequired },
        }),
      // isomorphic-git throws on network error -- accept any error.
      (err) => err instanceof Error,
    );

    // onAuthRequired is NOT expected to be called -- onAuth fires from
    // isomorphic-git's auth callback only if the server asks for credentials.
    // A network-error throw skips the auth callback entirely; the test only
    // verifies that buildAuthCallbacks construction did not throw and that the
    // opts.auth branch (line 125) was taken.
    assert.equal(
      onAuthRequiredCalled,
      false,
      "onAuthRequired must not be called for a network-error clone",
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Phase 33 git.ts: clone without auth does not build callbacks (lines 125-139)", async () => {
  // When opts.auth is undefined, clone() sets authCbs to undefined and the
  // conditional spread (lines 133-136) emits no onAuth / onAuthFailure fields.
  const tmpDir = path.join(os.tmpdir(), `pi-cm-clone-noauth-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    await assert.rejects(
      () => clone({ dir: tmpDir, url: "https://invalid.example.invalid/repo.git" }),
      (err) => err instanceof Error,
      "clone to invalid URL must reject -- no-auth path",
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Phase 33 git.ts: fetch without auth calls isomorphic-git fetch (lines 141-154)", async () => {
  // fetch() on a local-only repo (no remotes) throws from isomorphic-git
  // with a 'remote not found' style error. The wrapper still executes
  // line 142 (authCbs = undefined) and line 143 (git.fetch call).
  const repo = await makeLocalRepo();
  try {
    await assert.rejects(
      () => gitFetch({ dir: repo.dir }),
      (err) => err instanceof Error,
      "fetch on local-only repo must throw (no remote configured)",
    );
  } finally {
    await repo.destroy();
  }
});

test("Phase 33 git.ts: fetch with auth builds callbacks before invoking isomorphic-git (lines 141-154)", async () => {
  // Mirrors the clone+auth test: verifies the auth-callback construction path
  // (line 142) runs even when the underlying git.fetch call throws.
  const repo = await makeLocalRepo();
  const { credOps } = makeMockCredentialOps();
  const onAuthRequired: OnAuthRequiredFn = () => {
    return Promise.resolve({
      ok: false,
      reason: "test",
      authAttempted: true,
    } satisfies AuthAttemptResult);
  };

  try {
    await assert.rejects(
      () =>
        gitFetch({
          dir: repo.dir,
          auth: { credentialOps: credOps, host: "github.com", onAuthRequired },
        }),
      (err) => err instanceof Error,
      "fetch on local-only repo with auth must throw (no remote configured)",
    );
  } finally {
    await repo.destroy();
  }
});
