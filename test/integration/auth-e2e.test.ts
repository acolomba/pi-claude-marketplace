/**
 * test/integration/auth-e2e.test.ts -- auth integration gate.
 *
 * Exercises real Git clone and marketplace-add refusal cleanup, plus
 * credential reuse and Device Flow callback composition:
 *
 *   buildAuthCallbacks (platform/git-auth-callbacks.ts)
 *     -> onAuth / onAuthFailure closures
 *       -> initiateDeviceFlow (domain/github-auth.ts)
 *         -> CredentialOps (test/platform/credential-ops-fake.ts)
 *         -> onDeviceCode
 *           -> notifyDeviceFlowPrompt (shared/notification-dispatch.ts)
 *
 * Tests:
 *   AUTH-01 -- fill-miss triggers Device Flow; token stored via approve
 *   AUTH-02 / AUTH-08 -- fill-hit returns stored cred; no Device Flow fires
 *   AUTH-07 -- onAuthFailure evicts cred; subsequent onAuth re-triggers Device Flow
 *
 * AUTH-09: each test compares the whole notify log, so token material would
 * show up as a difference.
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
import { buildAuthCallbacks } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
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

interface NotifyCall {
  readonly message: string;
  readonly severity?: string;
}

function makeNotifyCapture(): {
  notifyCalls: NotifyCall[];
  onDeviceCode: InitiateDeviceFlowOpts["onDeviceCode"];
} {
  const notifyCalls: NotifyCall[] = [];
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

function deviceCodeResponse(userCode: string): DeviceCodeResponse {
  return {
    device_code: "MOCK_DEVICE_CODE",
    user_code: userCode,
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 0,
  };
}

function successfulPoll(accessToken: string): PollResult {
  return { kind: "success", accessToken, tokenType: "bearer", scope: "repo" };
}

test("AUTH-01 add path E2E: fill-miss triggers Device Flow, token stored via approve", async () => {
  // arrange
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("ABCD-1234"),
    pollResponses: [successfulPoll("gho_test_token_e2e")],
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();
  const { onAuth } = buildAuthCallbacks({
    credentialOps: credentials.credentialOps,
    host: "github.com",
    kind: "device-flow",
    onAuthRequired: () =>
      initiateDeviceFlow({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        onDeviceCode,
        http: deviceFlow.http,
      }),
  });

  // act
  const credential = await onAuth("https://github.com/some-repo.git");

  // assert
  assert.deepStrictEqual(credential, {
    username: "x-access-token",
    password: "gho_test_token_e2e",
  });
  assert.deepStrictEqual(notifyCalls, [
    { message: "Open https://github.com/login/device and enter: ABCD-1234", severity: "info" },
  ]);
  assert.deepStrictEqual(credentials.calls, {
    fill: [{ host: "github.com" }],
    approve: [{ host: "github.com", credential }],
    reject: [],
  });
});

test("AUTH-02 / AUTH-08 silent reuse: fill-hit returns stored cred, no Device Flow", async () => {
  // arrange
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [["github.com", { username: "x-access-token", password: "stored_token_e2e" }]],
  });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("ABCD-1234"),
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();
  const { onAuth } = buildAuthCallbacks({
    credentialOps: credentials.credentialOps,
    host: "github.com",
    kind: "device-flow",
    onAuthRequired: () =>
      initiateDeviceFlow({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        onDeviceCode,
        http: deviceFlow.http,
      }),
  });

  // act
  const credential = await onAuth("https://github.com/other-repo.git");

  // assert
  assert.deepStrictEqual(credential, { username: "x-access-token", password: "stored_token_e2e" });
  assert.deepStrictEqual(notifyCalls, []);
  assert.deepStrictEqual(credentials.calls, {
    fill: [{ host: "github.com" }],
    approve: [],
    reject: [],
  });
  assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
});

test("AUTH-07 reject-evict-reflow: onAuthFailure evicts cred, next fill-miss re-triggers Device Flow", async () => {
  // arrange
  const staleCredential = { username: "x-access-token", password: "stale_token" };
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [["github.com", staleCredential]],
  });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("WXYZ-5678"),
    pollResponses: [successfulPoll("gho_fresh_token_e2e")],
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();
  const { onAuth, onAuthFailure } = buildAuthCallbacks({
    credentialOps: credentials.credentialOps,
    host: "github.com",
    kind: "device-flow",
    onAuthRequired: () =>
      initiateDeviceFlow({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        onDeviceCode,
        http: deviceFlow.http,
      }),
  });

  // act
  const failureResult = await onAuthFailure("https://github.com/repo.git", staleCredential);
  const evictedStore = credentials.storedCredential("github.com");
  const notifiedByFailure = [...notifyCalls];
  const credential = await onAuth("https://github.com/repo.git");

  // assert
  assert.deepStrictEqual(failureResult, { cancel: true });
  assert.strictEqual(evictedStore, null);
  assert.deepStrictEqual(notifiedByFailure, []);
  assert.deepStrictEqual(credential, {
    username: "x-access-token",
    password: "gho_fresh_token_e2e",
  });
  assert.strictEqual(deviceFlow.calls.pollToken.length, 1);
  assert.deepStrictEqual(notifyCalls, [
    { message: "Open https://github.com/login/device and enter: WXYZ-5678", severity: "info" },
  ]);
  assert.deepStrictEqual(credentials.calls, {
    fill: [{ host: "github.com" }],
    approve: [{ host: "github.com", credential }],
    reject: [{ host: "github.com", credential: staleCredential }],
  });
});
