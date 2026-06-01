/**
 * tests/domain/github-auth.test.ts -- 13 unit tests for Phase 32's
 * initiateDeviceFlow state machine covering AUTH-01/03/04/05/07/09.
 *
 * Each test is self-contained: fresh makeMockDeviceFlowHttp +
 * makeMockCredentialOps + notifyFn recorder per test. No shared `let`
 * state; no beforeEach. Tests use `interval: 0` on the mock deviceCode so
 * the poll loop spins synchronously through pre-loaded pollQueue
 * sequences -- no real timers, no real network.
 *
 * Test-title strings include the 32-VALIDATION.md grep-able phrases so the
 * `-t <pattern>` filter from the per-task validation map works.
 *
 * Source map:
 *   - AUTH-01: Test 1 (happy path), Test 2 (approve on success)
 *   - AUTH-03: Test 3 (notify content)
 *   - AUTH-04: Test 4 (slow_down cumulative), Test 5 (pending no-change)
 *   - AUTH-05: Test 6 (access_denied), Test 7 (expired_token), Test 8
 *              (timeout), Test 9 (init failure)
 *   - AUTH-07: Test 10 (authAttempted on success), Test 11 (authAttempted
 *              on failure)
 *   - AUTH-09: Test 12 (notify content negative scan)
 *   - Design contract (A9): Test 13 (approveThrows propagates)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  initiateDeviceFlow,
  type PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts";

interface NotifyCall {
  message: string;
  severity?: "info" | "warning" | "error";
}

function makeNotifyRecorder(): {
  notifyFn: (message: string, severity?: "info" | "warning" | "error") => void;
  calls: NotifyCall[];
} {
  const calls: NotifyCall[] = [];
  const notifyFn = (message: string, severity?: "info" | "warning" | "error"): void => {
    calls.push(severity !== undefined ? { message, severity } : { message });
  };

  return { notifyFn, calls };
}

test("Phase 32 initiateDeviceFlow: AUTH-01 happy path returns ok+cred+authAttempted", async () => {
  const { http, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_test", tokenType: "bearer", scope: "repo" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.cred, { username: "x-access-token", password: "gho_test" });
    assert.equal(result.authAttempted, true);
  }

  assert.equal(httpState.requestCodeCalls.length, 1);
  assert.equal(httpState.pollTokenCalls.length, 1);
});

test("Phase 32 initiateDeviceFlow: AUTH-01 approve on success persists via credentialOps", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_test", tokenType: "bearer", scope: "repo" }],
  });
  const { credOps, state: credState } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(credState.approveCalls.length, 1);
  assert.equal(credState.approveCalls[0]!.host, "github.com");
  assert.equal(credState.approveCalls[0]!.cred.password, "gho_test");
  assert.equal(credState.approveCalls[0]!.cred.username, "x-access-token");
});

test("Phase 32 initiateDeviceFlow: AUTH-03 notify content includes user_code AND verification_uri", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_test", tokenType: "bearer", scope: "repo" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn, calls } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.message.includes("ABCD-1234"), "notify must include user_code");
  assert.ok(
    calls[0]!.message.includes("https://github.com/login/device"),
    "notify must include verification_uri",
  );
});

test("Phase 32 initiateDeviceFlow: AUTH-04 cumulative slow_down increments intervalSec by 5 each occurrence", async () => {
  const { http, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [
      { kind: "slow_down" },
      { kind: "slow_down" },
      { kind: "success", accessToken: "gho_x", tokenType: "bearer", scope: "repo" },
    ],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(httpState.pollTokenCalls.length, 3);
  assert.equal(httpState.pollTokenCalls[0]!.intervalSec, 0);
  assert.equal(httpState.pollTokenCalls[1]!.intervalSec, 5);
  assert.equal(httpState.pollTokenCalls[2]!.intervalSec, 10);
});

test("Phase 32 initiateDeviceFlow: AUTH-04 pending no-change keeps intervalSec stable across iterations", async () => {
  const { http, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [
      { kind: "pending" },
      { kind: "pending" },
      { kind: "pending" },
      { kind: "success", accessToken: "gho_y", tokenType: "bearer", scope: "repo" },
    ],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(httpState.pollTokenCalls.length, 4);
  for (const call of httpState.pollTokenCalls) {
    assert.equal(call.intervalSec, 0);
  }
});

test("Phase 32 initiateDeviceFlow: AUTH-05 access_denied produces human reason and authAttempted", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "access_denied" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.authAttempted, true);
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 10);
    const lower = result.reason.toLowerCase();
    assert.ok(
      lower.includes("cancel") || lower.includes("run the command again"),
      `reason should mention cancel/retry: got "${result.reason}"`,
    );
  }
});

test("Phase 32 initiateDeviceFlow: AUTH-05 expired_token produces human reason mentioning expiration", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "expired_token" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.authAttempted, true);
    assert.equal(typeof result.reason, "string");
    const lower = result.reason.toLowerCase();
    assert.ok(
      lower.includes("expire") || lower.includes("restart"),
      `reason should mention expiration/restart: got "${result.reason}"`,
    );
  }
});

test("Phase 32 initiateDeviceFlow: AUTH-05 timeout terminates loop without polling when expires_in is 0", async () => {
  const { http, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 0,
      interval: 0,
    },
    pollQueue: [],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, false);
  assert.equal(httpState.pollTokenCalls.length, 0);
  if (!result.ok) {
    assert.equal(result.authAttempted, true);
    assert.ok(
      result.reason.toLowerCase().includes("time"),
      `reason should mention time/timeout: got "${result.reason}"`,
    );
  }
});

test("Phase 32 initiateDeviceFlow: AUTH-05 init failure returns ok:false when requestCode throws", async () => {
  const { http } = makeMockDeviceFlowHttp({
    requestCodeThrows: new Error("network down"),
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.authAttempted, true);
    assert.equal(typeof result.reason, "string");
    assert.ok(
      result.reason.includes("Device Flow initialization failed"),
      `reason should mention init failure: got "${result.reason}"`,
    );
  }
});

test("Phase 32 initiateDeviceFlow: AUTH-07 authAttempted true on success", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_ok", tokenType: "bearer", scope: "repo" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, true);
  assert.equal(result.authAttempted, true);
});

test("Phase 32 initiateDeviceFlow: AUTH-07 authAttempted on failure stays true for access_denied", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "access_denied" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  assert.equal(result.ok, false);
  assert.equal(result.authAttempted, true);
});

test("Phase 32 initiateDeviceFlow: AUTH-09 notify content negative scan -- no token or device_code leaked", async () => {
  const successPoll: PollResult = {
    kind: "success",
    accessToken: "gho_test",
    tokenType: "bearer",
    scope: "repo",
  };
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [successPoll],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn, calls } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(calls.length, 1, "exactly one notify call (the user-code prompt)");
  for (const call of calls) {
    assert.equal(
      call.message.includes("gho_test"),
      false,
      "notify message must not include access_token",
    );
    assert.equal(
      call.message.includes("MOCK_DEVICE_CODE"),
      false,
      "notify message must not include device_code",
    );
    assert.equal(
      call.message.includes("access_token"),
      false,
      "notify message must not include 'access_token' literal",
    );
  }
});

test("Phase 32 initiateDeviceFlow: unexpected poll error returns ok:false with error description (WR-03)", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [
      { kind: "unexpected", error: "unsupported_grant_type", description: "grant not supported" },
    ],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });
  assert.equal(result.ok, false);
  assert.equal(result.authAttempted, true);
  if (!result.ok) {
    assert.match(result.reason, /unsupported_grant_type/);
    assert.match(result.reason, /grant not supported/);
  }
});

test("Phase 32 initiateDeviceFlow: pollToken throw returns ok:false authAttempted:true (WR-01)", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [],
    pollTokenThrows: new Error("network error in poll"),
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });
  assert.equal(result.ok, false);
  assert.equal(result.authAttempted, true);
  if (!result.ok) {
    assert.match(result.reason, /poll failed/);
    assert.match(result.reason, /network error in poll/);
  }
});

test("Phase 32 initiateDeviceFlow: approveThrows propagates -- Phase 32 does not wrap CredentialOps.approve (A9)", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_z", tokenType: "bearer", scope: "repo" }],
  });
  const { credOps } = makeMockCredentialOps({ approveThrows: new Error("keychain locked") });
  const { notifyFn } = makeNotifyRecorder();

  await assert.rejects(
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http }),
    /keychain locked/,
  );
});
