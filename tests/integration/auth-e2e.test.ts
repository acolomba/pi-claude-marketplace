/**
 * tests/integration/auth-e2e.test.ts -- Phase 36 integration gate.
 *
 * Wires the full v1.6 auth stack end-to-end without going through the
 * full add/update orchestrators:
 *
 *   buildAuthCallbacks (platform/git.ts)
 *     -> onAuth / onAuthFailure closures
 *       -> initiateDeviceFlow (domain/github-auth.ts)
 *         -> CredentialOps (tests/helpers/credential-mock.ts)
 *         -> notifyFn (shared/notify.ts makeRawNotifyFn)
 *
 * Tests:
 *   AUTH-01 -- fill-miss triggers Device Flow; token stored via approve
 *   AUTH-02 / AUTH-08 -- fill-hit returns stored cred; no Device Flow fires
 *   AUTH-07 -- onAuthFailure evicts cred; subsequent onAuth re-triggers Device Flow
 *
 * AUTH-09 inline guard: each test asserts no notifyCalls entry contains
 * "access_token" or "gho_" in the message field.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import {
  buildAuthCallbacks,
  type OnAuthRequiredFn,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { makeRawNotifyFn } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts";

// ---------------------------------------------------------------------------
// Shared notify infrastructure
// ---------------------------------------------------------------------------

function makeNotifyCapture(): {
  notifyCalls: Array<{ message: string; severity?: string }>;
  notifyFn: ReturnType<typeof makeRawNotifyFn>;
} {
  const notifyCalls: Array<{ message: string; severity?: string }> = [];
  const mockCtx = {
    ui: {
      notify: (msg: string, sev?: string) => {
        notifyCalls.push({
          message: msg,
          ...(sev !== undefined && { severity: sev }),
        });
      },
    },
  } as unknown as Parameters<typeof makeRawNotifyFn>[0];
  const notifyFn = makeRawNotifyFn(mockCtx);
  return { notifyCalls, notifyFn };
}

// ---------------------------------------------------------------------------
// Test 1: AUTH-01 add path E2E -- fill-miss triggers Device Flow, token stored
// ---------------------------------------------------------------------------

test("AUTH-01 add path E2E: fill-miss triggers Device Flow, token stored via approve", async () => {
  // Empty store: fill returns null (MISS).
  const { credOps, state: credState } = makeMockCredentialOps();

  // Device Flow: immediate success, no sleep (interval: 0).
  const { http } = makeMockDeviceFlowHttp({
    pollQueue: [
      {
        kind: "success",
        accessToken: "gho_test_token_e2e",
        tokenType: "bearer",
        scope: "repo",
      },
    ],
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
  });

  const { notifyCalls, notifyFn } = makeNotifyCapture();

  const onAuthRequired: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  const { onAuth } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    onAuthRequired,
  });

  const result = await onAuth("https://github.com/some-repo.git");

  // Token returned correctly.
  assert.equal(result.username, "x-access-token");
  assert.equal(result.password, "gho_test_token_e2e");

  // Device Flow prompt emitted exactly once with the exact catalog byte-form
  // (AUTH-03).
  assert.equal(notifyCalls.length, 1, "exactly one notify call expected");
  assert.equal(
    notifyCalls[0]!.message,
    "Open https://github.com/login/device and enter: ABCD-1234",
  );
  assert.equal(notifyCalls[0]!.severity, "info");

  // approve called once with the new token (AUTH-06).
  assert.equal(credState.approveCalls.length, 1, "credOps.approve must fire once");
  assert.equal(credState.approveCalls[0]!.host, "github.com");
  assert.equal(credState.approveCalls[0]!.cred.password, "gho_test_token_e2e");

  // fill called exactly once (the initial miss).
  assert.equal(credState.fillCalls.length, 1, "fill called once on the initial miss");

  // AUTH-09 inline guard: no notifyCalls entry exposes token material.
  for (const call of notifyCalls) {
    assert.ok(
      !call.message.includes("access_token"),
      `notify must not contain "access_token": ${call.message}`,
    );
    assert.ok(!call.message.includes("gho_"), `notify must not contain "gho_": ${call.message}`);
  }
});

// ---------------------------------------------------------------------------
// Test 2: AUTH-02 / AUTH-08 silent reuse -- fill-hit returns stored cred
// ---------------------------------------------------------------------------

test("AUTH-02 / AUTH-08 silent reuse: fill-hit returns stored cred, no Device Flow", async () => {
  // Pre-seeded store: fill returns stored_token_e2e (HIT).
  const { credOps, state: credState } = makeMockCredentialOps({
    store: new Map([["github.com", { username: "x-access-token", password: "stored_token_e2e" }]]),
  });

  // Device Flow mock present but should NEVER be invoked in this test.
  const { http } = makeMockDeviceFlowHttp();

  const { notifyCalls, notifyFn } = makeNotifyCapture();

  const onAuthRequired: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  const { onAuth } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    onAuthRequired,
  });

  const result = await onAuth("https://github.com/other-repo.git");

  // Stored token returned unchanged.
  assert.equal(result.password, "stored_token_e2e");

  // No Device Flow prompt emitted (AUTH-02 / AUTH-08).
  assert.equal(notifyCalls.length, 0, "no notify call must fire on a fill HIT");

  // No approve call: stored token was reused without a new Device Flow.
  assert.equal(credState.approveCalls.length, 0, "approve must not fire on a fill HIT");

  // fill consulted exactly once.
  assert.equal(credState.fillCalls.length, 1, "fill called once for the HIT lookup");
  assert.equal(credState.fillCalls[0]!.host, "github.com");

  // AUTH-09 inline guard.
  for (const call of notifyCalls) {
    assert.ok(
      !call.message.includes("access_token"),
      `notify must not contain "access_token": ${call.message}`,
    );
    assert.ok(!call.message.includes("gho_"), `notify must not contain "gho_": ${call.message}`);
  }
});

// ---------------------------------------------------------------------------
// Test 3: AUTH-07 reject-evict-reflow -- onAuthFailure evicts, re-triggers
// ---------------------------------------------------------------------------

test("AUTH-07 reject-evict-reflow: onAuthFailure evicts cred, next fill-miss re-triggers Device Flow", async () => {
  // Pre-seeded store: a stale token.
  const { credOps, state: credState } = makeMockCredentialOps({
    store: new Map([["github.com", { username: "x-access-token", password: "stale_token" }]]),
  });

  // First-round Device Flow mock: succeeds with a fresh token after eviction.
  const { http: dfHttp1 } = makeMockDeviceFlowHttp({
    pollQueue: [
      {
        kind: "success",
        accessToken: "gho_fresh_token_e2e",
        tokenType: "bearer",
        scope: "repo",
      },
    ],
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
  });

  const { notifyCalls, notifyFn } = makeNotifyCapture();

  // First-round onAuthRequired + callbacks.
  const onAuthRequired1: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http: dfHttp1 });

  const { onAuthFailure: onAuthFailure1 } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    onAuthRequired: onAuthRequired1,
  });

  // onAuthFailure evicts the stale token and returns { cancel: true } (CP-9).
  const failureResult = await onAuthFailure1("https://github.com/repo.git", {
    username: "x-access-token",
    password: "stale_token",
  });
  assert.equal(failureResult.cancel, true, "onAuthFailure must return cancel: true (CP-9)");

  // reject called once (AUTH-07 eviction).
  assert.equal(credState.rejectCalls.length, 1, "reject must fire once on eviction");
  assert.equal(credState.rejectCalls[0]!.host, "github.com");

  // Credential evicted from in-memory store (mirrors OS keychain eviction).
  assert.equal(
    credState.store.has("github.com"),
    false,
    "store must not contain the evicted credential",
  );

  // onAuthFailure does NOT emit a Device Flow prompt.
  assert.equal(notifyCalls.length, 0, "onAuthFailure must not emit a Device Flow prompt");

  // Second round: dfHttp1 was never called (onAuthFailure does not go through
  // Device Flow; it only evicts and cancels). Create a fresh mock with a
  // distinct user_code so the round-2 notify assertion is unambiguous.
  const { http: dfHttp2, state: dfState2 } = makeMockDeviceFlowHttp({
    pollQueue: [
      {
        kind: "success",
        accessToken: "gho_fresh_token_e2e",
        tokenType: "bearer",
        scope: "repo",
      },
    ],
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE_2",
      user_code: "WXYZ-5678",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
  });

  const onAuthRequired2: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http: dfHttp2 });

  const { onAuth: onAuth2 } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    onAuthRequired: onAuthRequired2,
  });

  // Second onAuth: store is empty (evicted), so fill MISS -> Device Flow re-triggered.
  const result2 = await onAuth2("https://github.com/repo.git");

  // Fresh credential returned with correct username and token.
  assert.equal(result2.username, "x-access-token");
  assert.equal(result2.password, "gho_fresh_token_e2e");

  // dfHttp2 was actually used (pollQueue drained).
  assert.equal(dfState2.pollTokenCalls.length, 1, "dfHttp2 must have been polled once");

  // Device Flow prompt fired once during the second round, with dfHttp2's user_code.
  assert.equal(notifyCalls.length, 1, "exactly one Device Flow prompt after re-flow");
  assert.equal(
    notifyCalls[0]!.message,
    "Open https://github.com/login/device and enter: WXYZ-5678",
  );
  assert.equal(notifyCalls[0]!.severity, "info");

  // approve called once for the fresh token.
  assert.equal(credState.approveCalls.length, 1, "approve must fire once for the fresh token");
  assert.equal(credState.approveCalls[0]!.cred.password, "gho_fresh_token_e2e");

  // AUTH-09 inline guard.
  for (const call of notifyCalls) {
    assert.ok(
      !call.message.includes("access_token"),
      `notify must not contain "access_token": ${call.message}`,
    );
    assert.ok(!call.message.includes("gho_"), `notify must not contain "gho_": ${call.message}`);
  }
});
