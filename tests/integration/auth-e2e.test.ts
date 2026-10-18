/**
 * tests/integration/auth-e2e.test.ts -- auth integration gate.
 *
 * Exercises real Git clone and marketplace-add refusal cleanup, plus
 * credential reuse and Device Flow callback composition:
 *
 *   buildAuthCallbacks (platform/git-auth-callbacks.ts)
 *     -> onAuth / onAuthFailure closures
 *       -> initiateDeviceFlow (domain/github-auth.ts)
 *         -> CredentialOps (tests/platform/credential-ops-fake.ts)
 *         -> onDeviceCode
 *           -> notifyDeviceFlowPrompt (shared/notification-dispatch.ts)
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
import fs, { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import http from "isomorphic-git/http/node";

import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  buildAuthCallbacks,
  type OnAuthRequiredFn,
} from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import { clone } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { DeviceFlowUnavailableError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { notifyDeviceFlowPrompt } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { createDeviceFlowFake } from "../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type {
  DeviceCodeResponse,
  InitiateDeviceFlowOpts,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type { AddMarketplaceOptions } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { GitHttpRequest, GitHttpResponse } from "isomorphic-git/http/node";

async function createPrintAdd(t: TestContext) {
  const environment = await createHermeticEnvironment(t, "print-add-");
  const locations = locationsFor("project", environment.cwd);
  const priorState = {
    schemaVersion: 3,
    marketplaces: {},
    lastReconciledExtensionVersion: "prior",
  } as const;
  await saveState(locations.extensionRoot, priorState);
  const priorBytes = await readFile(locations.stateJsonPath, "utf8");
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [["other.example", { username: "foreign", password: "foreign-secret" }]],
  });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: {
      device_code: "device-secret",
      user_code: "CODE",
      verification_uri: "https://github.com/login/device",
      expires_in: 1,
      interval: 0,
    },
    requestCodeError: new Error("device HTTP must not run"),
  });
  const notifications: string[] = [];
  const requests: string[] = [];
  const stagingRoot = join(locations.extensionRoot, "sources-staging");
  let stagingDir = "";
  async function* responseBody(): AsyncIterableIterator<Uint8Array> {
    await Promise.resolve();
    yield new Uint8Array();
  }

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    requests.push(request.url);
    assert.deepStrictEqual(requests, [
      "https://github.com/owner/private.git/info/refs?service=git-upload-pack",
    ]);
    assert.strictEqual(request.headers?.Authorization, undefined);
    const staged = await readdir(stagingRoot);
    assert.strictEqual(staged.length, 1);
    stagingDir = join(stagingRoot, staged[0]!);
    assert.ok((await readdir(stagingDir)).includes(".git"));
    return {
      url: request.url,
      statusCode: 401,
      statusMessage: "Unauthorized",
      headers: {},
      body: responseBody(),
    };
  });
  const options: AddMarketplaceOptions = {
    ctx: {
      mode: "print",
      ui: {
        notify: (message) => {
          notifications.push(message);
        },
      },
    },
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: environment.cwd,
    rawSource: "owner/private",
    completionCache: createCompletionCache(),
    credentialOps: credentials.credentialOps,
    deviceFlowHttp: deviceFlow.http,
  };
  return {
    options,
    locations,
    priorState,
    priorBytes,
    credentials,
    deviceFlow,
    notifications,
    requests,
    stagingRoot,
    get stagingDir() {
      return stagingDir;
    },
  };
}

function assertPrintRefusal(error: unknown): error is DeviceFlowUnavailableError {
  assert.ok(error instanceof DeviceFlowUnavailableError, String(error));
  assert.strictEqual(
    error.message,
    "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.",
  );
  return true;
}

async function assertUncommittedPrintAdd(fixture: Awaited<ReturnType<typeof createPrintAdd>>) {
  assert.deepStrictEqual(await loadState(fixture.locations.extensionRoot), fixture.priorState);
  assert.strictEqual(await readFile(fixture.locations.stateJsonPath, "utf8"), fixture.priorBytes);
  await assert.rejects(readFile(fixture.locations.baseConfigJsonPath), { code: "ENOENT" });
  await assert.rejects(readdir(fixture.locations.sourcesDir), { code: "ENOENT" });
  assert.deepStrictEqual(fixture.notifications, []);
  assert.deepStrictEqual(fixture.requests, [
    "https://github.com/owner/private.git/info/refs?service=git-upload-pack",
  ]);
  assert.deepStrictEqual(fixture.credentials.calls, {
    fill: [{ host: "github.com" }],
    approve: [],
    reject: [],
  });
  assert.deepStrictEqual(fixture.deviceFlow.calls, { requestCode: [], pollToken: [] });
}

test("print marketplace add rejects with its remedy after removing the real staged clone", async (t) => {
  // arrange
  const fixture = await createPrintAdd(t);

  // act & assert
  await assert.rejects(addMarketplace(fixture.options), assertPrintRefusal);
  assert.deepStrictEqual(await readdir(fixture.stagingRoot), []);
  await assertUncommittedPrintAdd(fixture);
});

test("orchestrated print marketplace add retains the typed refusal and cleans staging", async (t) => {
  // arrange
  const fixture = await createPrintAdd(t);

  // act
  const outcome = await addMarketplace({
    ...fixture.options,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.ok(outcome.status === "failed");
  assertPrintRefusal(outcome.error);
  assert.deepStrictEqual(outcome, {
    status: "failed",
    reason: "unparseable",
    error: outcome.error,
    cause:
      "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.",
  });
  assert.deepStrictEqual(await readdir(fixture.stagingRoot), []);
  await assertUncommittedPrintAdd(fixture);
});

test("a staging cleanup failure retains the print refusal as the primary cause", async (t) => {
  // arrange
  const fixture = await createPrintAdd(t);
  const remove = fs.rm;
  t.mock.method(fs, "rm", async (...args: Parameters<typeof fs.rm>) => {
    if (String(args[0]) === fixture.stagingDir) {
      throw new Error("cleanup denied");
    }

    await remove(...args);
  });

  // act
  const outcome = await addMarketplace({
    ...fixture.options,
    notifications: { mode: "orchestrated" },
  });

  // assert
  assert.ok(outcome.status === "failed");
  assertPrintRefusal(outcome.error.cause);
  assert.strictEqual(
    outcome.cause,
    `Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi. (additionally: failed to clean up marketplace clone staging at ${fixture.stagingDir}: cleanup denied)`,
  );
  await assertUncommittedPrintAdd(fixture);
});

test("real Git clone preserves a device-flow refusal from its auth callback", async (t) => {
  // arrange
  const dir = await mkdtemp(join(tmpdir(), "auth-clone-"));
  t.after(async () => rm(dir, { recursive: true, force: true }));
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const refusal = new DeviceFlowUnavailableError();
  const requests: string[] = [];
  async function* responseBody(): AsyncIterableIterator<Uint8Array> {
    await Promise.resolve();
    yield new Uint8Array();
  }

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    requests.push(request.url);
    assert.deepStrictEqual(requests, [
      "https://github.com/owner/repo/info/refs?service=git-upload-pack",
    ]);
    await Promise.resolve();
    return {
      url: request.url,
      statusCode: 401,
      statusMessage: "Unauthorized",
      headers: {},
      body: responseBody(),
    };
  });

  // act & assert
  await assert.rejects(
    clone({
      dir,
      url: "https://github.com/owner/repo",
      auth: {
        kind: "device-flow",
        host: "github.com",
        credentialOps: credentials.credentialOps,
        onAuthRequired: () => Promise.reject(refusal),
      },
    }),
    (error: unknown) => {
      assert.strictEqual(error, refusal);
      assert.strictEqual(
        refusal.message,
        "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.",
      );
      return true;
    },
  );
  assert.deepStrictEqual(requests, [
    "https://github.com/owner/repo/info/refs?service=git-upload-pack",
  ]);
  assert.deepStrictEqual(credentials.calls, {
    fill: [{ host: "github.com" }],
    approve: [],
    reject: [],
  });
});

interface CredentialAdapterOptions {
  readonly store?: ReadonlyMap<string, GitCredentials>;
  readonly fillThrows?: Error;
  readonly approveThrows?: Error;
  readonly rejectThrows?: Error;
}

function createCredentialOps(initial: CredentialAdapterOptions = {}) {
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [...(initial.store ?? new Map<string, GitCredentials>()).entries()],
    ...(initial.fillThrows === undefined ? {} : { fillError: initial.fillThrows }),
    ...(initial.approveThrows === undefined ? {} : { approveError: initial.approveThrows }),
    ...(initial.rejectThrows === undefined ? {} : { rejectError: initial.rejectThrows }),
  });

  return {
    credOps: credentials.credentialOps,
    state: {
      store: { has: (host: string) => credentials.storedCredential(host) !== null },
      get fillCalls() {
        return credentials.calls.fill;
      },
      get approveCalls() {
        return credentials.calls.approve.map(({ host, credential: cred }) => ({ host, cred }));
      },
      get rejectCalls() {
        return credentials.calls.reject.map(({ host, credential: cred }) => ({ host, cred }));
      },
    },
  };
}

interface DeviceFlowAdapterOptions {
  readonly deviceCode?: DeviceCodeResponse;
  readonly pollQueue?: readonly PollResult[];
  readonly defaultPoll?: PollResult;
  readonly requestCodeThrows?: Error;
  readonly pollTokenThrows?: Error;
}

function createDeviceFlowHttp(initial: DeviceFlowAdapterOptions = {}) {
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: initial.deviceCode ?? {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    ...(initial.pollQueue === undefined ? {} : { pollResponses: initial.pollQueue }),
    ...(initial.defaultPoll === undefined ? {} : { defaultPoll: initial.defaultPoll }),
    ...(initial.requestCodeThrows === undefined
      ? {}
      : { requestCodeError: initial.requestCodeThrows }),
    ...(initial.pollTokenThrows === undefined ? {} : { pollTokenError: initial.pollTokenThrows }),
  });

  return {
    http: deviceFlow.http,
    state: {
      get requestCodeCalls() {
        return deviceFlow.calls.requestCode;
      },
      get pollTokenCalls() {
        return deviceFlow.calls.pollToken;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Shared notify infrastructure
// ---------------------------------------------------------------------------

function makeNotifyCapture(): {
  notifyCalls: Array<{ message: string; severity?: string }>;
  onDeviceCode: InitiateDeviceFlowOpts["onDeviceCode"];
} {
  const notifyCalls: Array<{ message: string; severity?: string }> = [];
  const context: NotificationContext = {
    mode: "tui",
    ui: {
      notify: (message, severity) => {
        notifyCalls.push({
          message,
          ...(severity !== undefined && { severity }),
        });
      },
    },
  };
  const onDeviceCode: InitiateDeviceFlowOpts["onDeviceCode"] = (prompt) => {
    notifyDeviceFlowPrompt(context, runWithNothingLoaded(), prompt);
  };

  return { notifyCalls, onDeviceCode };
}

// ---------------------------------------------------------------------------
// Test 1: AUTH-01 add path E2E -- fill-miss triggers Device Flow, token stored
// ---------------------------------------------------------------------------

test("AUTH-01 add path E2E: fill-miss triggers Device Flow, token stored via approve", async () => {
  // Empty store: fill returns null (MISS).
  const { credOps, state: credState } = createCredentialOps();

  // Device Flow: immediate success, no sleep (interval: 0).
  const { http } = createDeviceFlowHttp({
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

  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  const onAuthRequired: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, onDeviceCode, http });

  const { onAuth } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    kind: "device-flow",
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
  const { credOps, state: credState } = createCredentialOps({
    store: new Map([["github.com", { username: "x-access-token", password: "stored_token_e2e" }]]),
  });

  // Device Flow mock present but should NEVER be invoked in this test.
  const { http } = createDeviceFlowHttp();

  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  const onAuthRequired: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, onDeviceCode, http });

  const { onAuth } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    kind: "device-flow",
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
  const { credOps, state: credState } = createCredentialOps({
    store: new Map([["github.com", { username: "x-access-token", password: "stale_token" }]]),
  });

  // First-round Device Flow mock: succeeds with a fresh token after eviction.
  const { http: dfHttp1 } = createDeviceFlowHttp({
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

  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  // First-round onAuthRequired + callbacks.
  const onAuthRequired1: OnAuthRequiredFn = () =>
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, onDeviceCode, http: dfHttp1 });

  const { onAuthFailure: onAuthFailure1 } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    kind: "device-flow",
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
  const { http: dfHttp2, state: dfState2 } = createDeviceFlowHttp({
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
    initiateDeviceFlow({ host: "github.com", credentialOps: credOps, onDeviceCode, http: dfHttp2 });

  const { onAuth: onAuth2 } = buildAuthCallbacks({
    credentialOps: credOps,
    host: "github.com",
    kind: "device-flow",
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
