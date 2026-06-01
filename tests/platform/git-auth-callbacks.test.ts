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
import test from "node:test";

import { buildAuthCallbacks } from "../../extensions/pi-claude-marketplace/platform/git.ts";
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
