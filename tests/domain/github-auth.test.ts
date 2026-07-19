/**
 * Unit tests for the initiateDeviceFlow state machine covering
 * AUTH-01/03/04/05/07/09.
 *
 * Each test is self-contained: fresh makeMockDeviceFlowHttp +
 * makeMockCredentialOps + notifyFn recorder per test. No shared `let`
 * state; no beforeEach. Tests use `interval: 0` on the mock deviceCode so
 * the poll loop spins synchronously through pre-loaded pollQueue
 * sequences -- no real timers, no real network.
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
  DEFAULT_DEVICE_FLOW_HTTP,
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

test("initiateDeviceFlow: AUTH-01 happy path returns ok+cred+authAttempted", async () => {
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

test("initiateDeviceFlow: AUTH-01 approve on success persists via credentialOps", async () => {
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

test("initiateDeviceFlow: AUTH-03 notify content includes user_code AND verification_uri", async () => {
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

test("initiateDeviceFlow: AUTH-04 cumulative slow_down increments intervalSec by 5 each occurrence", async () => {
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

test("initiateDeviceFlow: AUTH-04 pending no-change keeps intervalSec stable across iterations", async () => {
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

test("initiateDeviceFlow: AUTH-05 access_denied produces human reason and authAttempted", async () => {
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

test("initiateDeviceFlow: AUTH-05 expired_token produces human reason mentioning expiration", async () => {
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

test("initiateDeviceFlow: AUTH-05 timeout terminates loop without polling when expires_in is 0", async () => {
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

test("initiateDeviceFlow: AUTH-05 init failure returns ok:false when requestCode throws", async () => {
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

test("initiateDeviceFlow: AUTH-07 authAttempted true on success", async () => {
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

test("initiateDeviceFlow: AUTH-07 authAttempted on failure stays true for access_denied", async () => {
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

test("initiateDeviceFlow: AUTH-09 notify content negative scan -- no token or device_code leaked", async () => {
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

test("initiateDeviceFlow: unexpected poll error returns ok:false with error description (WR-03)", async () => {
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

test("initiateDeviceFlow: pollToken throw returns ok:false authAttempted:true (WR-01)", async () => {
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

test("initiateDeviceFlow: AbortSignal cancels poll loop mid-sleep (opts.signal path)", async () => {
  // opts.signal abort path: runPollLoop wraps sleepMs with the signal. When the
  // signal fires while the loop is sleeping, the sleepMs rejects with an
  // AbortError which the catch block converts to { ok: false, reason: "Device
  // Flow cancelled." }.
  //
  // The controller is aborted immediately after initiateDeviceFlow() starts;
  // with interval: 5 the loop is sleeping when the abort fires.
  const controller = new AbortController();

  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      // Non-zero interval: the loop actually sleeps, giving the abort time to fire.
      interval: 60,
    },
    pollQueue: [],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  // Abort immediately after submitting -- the notify call fires synchronously
  // before the first sleep, so we abort after a tick.
  const flowPromise = initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
    signal: controller.signal,
  });

  // Allow the synchronous notify to fire, then abort.
  await Promise.resolve();
  controller.abort();

  const result = await flowPromise;

  assert.equal(result.ok, false);
  assert.equal(result.authAttempted, true);
  if (!result.ok) {
    assert.ok(
      result.reason.toLowerCase().includes("cancel"),
      `abort reason should mention cancel: got "${result.reason}"`,
    );
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.requestCode: throws on HTTP error status (lines 162-167)", async () => {
  // requestCodeImpl is the real implementation behind DEFAULT_DEVICE_FLOW_HTTP.
  // Covering it requires intercepting globalThis.fetch. We temporarily replace
  // fetch with a stub that returns a non-ok response, then restore it.
  //
  // AUTH-09: the throw message includes only the status code, never the body.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    return Promise.resolve(new Response(JSON.stringify({ error: "ignored" }), { status: 401 }));
  };

  try {
    await assert.rejects(
      () => DEFAULT_DEVICE_FLOW_HTTP.requestCode("test-client-id", "repo"),
      /Device code request failed: HTTP 401/,
      "requestCodeImpl must throw with HTTP status on non-ok response",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.requestCode: throws TypeError on missing required fields (lines 170-180)", async () => {
  // requestCodeImpl validates the response shape; a response missing required
  // fields (e.g. no device_code) must throw TypeError.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(JSON.stringify({ user_code: "ABCD" /* missing fields */ }), { status: 200 }),
    );
  };

  try {
    await assert.rejects(
      () => DEFAULT_DEVICE_FLOW_HTTP.requestCode("test-client-id", "repo"),
      TypeError,
      "requestCodeImpl must throw TypeError when required fields are absent",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.requestCode: returns DeviceCodeResponse on success (lines 152-181)", async () => {
  // Happy path: fetch returns 200 with a valid device code response.
  const originalFetch = globalThis.fetch;
  const fakeDeviceCode = {
    device_code: "MOCK_DC",
    user_code: "ABCD-1234",
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 5,
  };
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(new Response(JSON.stringify(fakeDeviceCode), { status: 200 }));
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.requestCode("test-client-id", "repo");
    assert.equal(result.device_code, "MOCK_DC");
    assert.equal(result.user_code, "ABCD-1234");
    assert.equal(result.expires_in, 900);
    assert.equal(result.interval, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns success PollResult when access_token present (lines 229-237)", async () => {
  // pollTokenImpl parses the response body for access_token; when present,
  // returns { kind: 'success', accessToken, tokenType, scope }.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          access_token: "gho_fake",
          token_type: "bearer",
          scope: "repo",
        }),
        { status: 200 },
      ),
    );
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "success");
    if (result.kind === "success") {
      assert.equal(result.accessToken, "gho_fake");
      assert.equal(result.tokenType, "bearer");
      assert.equal(result.scope, "repo");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns pending on authorization_pending error (lines 241-242)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "authorization_pending" }), { status: 200 }),
    );
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns slow_down on slow_down error (lines 243-244)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(new Response(JSON.stringify({ error: "slow_down" }), { status: 200 }));
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "slow_down");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns access_denied on access_denied error (lines 245-246)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "access_denied" }), { status: 200 }),
    );
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "access_denied");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns expired_token on expired_token error (lines 247-248)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "expired_token" }), { status: 200 }),
    );
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "expired_token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns unexpected on unknown error code (lines 249-256)", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "unknown_grant", error_description: "not supported" }), {
        status: 200,
      }),
    );
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "unexpected");
    if (result.kind === "unexpected") {
      assert.equal(result.error, "unknown_grant");
      assert.equal(result.description, "not supported");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns network_error unexpected on fetch throw (lines 204-209)", async () => {
  // When fetch itself throws (network error), pollTokenImpl catches and
  // returns { kind: 'unexpected', error: 'network_error', description: String(err) }.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.reject(new TypeError("Failed to fetch"));
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "unexpected");
    if (result.kind === "unexpected") {
      assert.equal(result.error, "network_error");
      assert.ok(result.description?.includes("Failed to fetch"));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DEFAULT_DEVICE_FLOW_HTTP.pollToken: returns invalid_json unexpected on malformed body (lines 214-218)", async () => {
  // When res.json() throws (malformed JSON body), pollTokenImpl catches and
  // returns { kind: 'unexpected', error: 'invalid_json', description: 'HTTP <status>' }.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> => {
    return Promise.resolve(new Response("not json at all", { status: 200 }));
  };

  try {
    const result = await DEFAULT_DEVICE_FLOW_HTTP.pollToken("test-client-id", "DC", 0);
    assert.equal(result.kind, "unexpected");
    if (result.kind === "unexpected") {
      assert.equal(result.error, "invalid_json");
      assert.ok(result.description?.startsWith("HTTP"));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("initiateDeviceFlow: approveThrows propagates -- initiateDeviceFlow does not wrap CredentialOps.approve (A9)", async () => {
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

test("initiateDeviceFlow: omitting `http` builds the default fetch-backed seam from the provider endpoints (init failure folds to ok:false)", async () => {
  const { credOps } = makeMockCredentialOps();
  const { notifyFn, calls } = makeNotifyRecorder();

  // D-32-02: no injected http -- the engine constructs the default seam from
  // the provider's endpoints. The provider points at a closed loopback port,
  // so the requestCode fetch fails fast and deterministically OFFLINE; the
  // engine must fold that into the init-failure result, never throw.
  const result = await initiateDeviceFlow({
    host: "auth.invalid",
    credentialOps: credOps,
    notifyFn,
    provider: {
      id: "loopback-test",
      hostMatch: (host: string): boolean => host === "auth.invalid",
      deviceCodeUrl: "http://127.0.0.1:1/device/code",
      tokenUrl: "http://127.0.0.1:1/oauth/access_token",
      clientId: "test-client-id",
      scope: "repo",
      credentialFrom: (accessToken: string) => ({
        username: "x-access-token",
        password: accessToken,
      }),
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /^Device Flow initialization failed: /);
    assert.equal(result.authAttempted, true);
  }

  // AUTH-03 gate never fired: no device code was obtained, so nothing to show.
  assert.equal(calls.length, 0);
});
