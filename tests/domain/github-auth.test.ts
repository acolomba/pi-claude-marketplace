import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  initiateDeviceFlow,
  type DeviceCodeResponse,
  type DeviceFlowHttp,
  type DeviceFlowResult,
  type InitiateDeviceFlowOpts,
  type NotifyFn,
  type PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";

import {
  createDeviceFlowContractParticipant,
  registerDeviceFlowContract,
  type DeviceFlowContractParticipant,
  type DeviceFlowContractScenario,
} from "./device-flow-contract.ts";

import type { GitAuthProvider } from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";
import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";

function deviceCode(overrides: Partial<DeviceCodeResponse> = {}): DeviceCodeResponse {
  return {
    device_code: "device-1",
    user_code: "CODE-1",
    verification_uri: "https://verify.example/device",
    expires_in: 900,
    interval: 0,
    ...overrides,
  };
}

function authProvider(): GitAuthProvider {
  return {
    id: "example",
    hostMatch: (host) => host === "auth.example",
    deviceCodeUrl: "https://auth.example/device",
    tokenUrl: "https://auth.example/token",
    clientId: "client-1",
    scope: "read_repository",
    credentialFrom: (accessToken) => ({ username: "oauth2", password: accessToken }),
  };
}

function rejectNonError(reason: unknown): Promise<never> {
  // A non-Error rejection exercises defensive handling of external ports.
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  return Promise.reject(reason);
}

function fetchResponse(body: string, status = 200): Promise<Response> {
  return Promise.resolve(new Response(body, { status }));
}

function unexpectedFetch(): Promise<Response> {
  return Promise.reject(new Error("Unexpected fetch"));
}

function expectedPollingWait(
  ...milliseconds: readonly number[]
): NonNullable<InitiateDeviceFlowOpts["waitForPoll"]> {
  const pollingWait = mock<NonNullable<InitiateDeviceFlowOpts["waitForPoll"]>>({
    exactParams: true,
    name: "polling wait",
  });
  for (const duration of milliseconds) {
    when(() => pollingWait(duration, undefined)).thenResolve(undefined);
  }

  return pollingWait;
}

function pollResponseBody(pollResponse: PollResult): Record<string, unknown> {
  switch (pollResponse.kind) {
    case "success":
      return {
        access_token: pollResponse.accessToken,
        token_type: pollResponse.tokenType,
        scope: pollResponse.scope,
      };
    case "pending":
      return { error: "authorization_pending" };
    case "slow_down":
      return { error: "slow_down" };
    case "access_denied":
      return { error: "access_denied" };
    case "expired_token":
      return { error: "expired_token" };
    case "unexpected":
      return {
        error: pollResponse.error,
        ...(pollResponse.description === undefined
          ? {}
          : { error_description: pollResponse.description }),
      };
  }
}

function createProductionDeviceFlowParticipant(
  scenario: DeviceFlowContractScenario,
  context: TestContext,
): DeviceFlowContractParticipant {
  const storedDeviceCode = structuredClone(scenario.deviceCode);
  const pollResponses = [...structuredClone(scenario.pollResponses)];
  const requestCodeError = scenario.requestCodeError;
  context.mock.method(globalThis, "fetch", (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://auth.example/device") {
      if (requestCodeError !== undefined) {
        return Promise.reject(requestCodeError);
      }

      return fetchResponse(JSON.stringify(storedDeviceCode));
    }

    if (url === "https://auth.example/token") {
      const pollResponse = pollResponses.shift() ?? ({ kind: "pending" } as const);
      return fetchResponse(JSON.stringify(pollResponseBody(pollResponse)));
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  return createDeviceFlowContractParticipant({ contractScenario: scenario });
}

void ({ kind: "pending" } satisfies PollResult);
void ({
  ok: false,
  reason: "Device Flow failed.",
  authAttempted: true,
} satisfies DeviceFlowResult);

describe("initiateDeviceFlow", () => {
  registerDeviceFlowContract(createProductionDeviceFlowParticipant);

  test("uses the GitHub provider, notifies the user, and persists the credential", async () => {
    // arrange
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    when(() => deviceFlowHttp.requestCode("Ov23liNcyK08uGdU0mMl", "repo")).thenResolve(
      deviceCode(),
    );
    when(() => deviceFlowHttp.pollToken("Ov23liNcyK08uGdU0mMl", "device-1", 0)).thenResolve({
      kind: "success",
      accessToken: "token-1",
      tokenType: "bearer",
      scope: "repo",
    });
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("github.com", {
        username: "x-access-token",
        password: "token-1",
      }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "github.com",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: true,
      cred: { username: "x-access-token", password: "token-1" },
      authAttempted: true,
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("uses a supplied provider for requests and credential conversion", async () => {
    // arrange
    const provider = authProvider();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(deviceCode());
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve({
      kind: "success",
      accessToken: "token-1",
      tokenType: "bearer",
      scope: "read_repository",
    });
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: true,
      cred: { username: "oauth2", password: "token-1" },
      authAttempted: true,
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("keeps the polling interval after an authorization-pending response", async () => {
    // arrange
    const provider = authProvider();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0, 0);
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(deviceCode());
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve({
      kind: "pending",
    });
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve({
      kind: "success",
      accessToken: "token-1",
      tokenType: "bearer",
      scope: "read_repository",
    });
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.strictEqual(deviceFlow.ok, true);
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("adds five seconds cumulatively after each slow-down response", async () => {
    // arrange
    const provider = authProvider();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = mock<NonNullable<InitiateDeviceFlowOpts["waitForPoll"]>>({
      exactParams: true,
      name: "polling wait",
    });
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(deviceCode());
    when(() => pollingWait(0, undefined)).thenResolve(undefined);
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve({
      kind: "slow_down",
    });
    when(() => pollingWait(5_000, undefined)).thenResolve(undefined);
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 5)).thenResolve({
      kind: "slow_down",
    });
    when(() => pollingWait(10_000, undefined)).thenResolve(undefined);
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 10)).thenResolve({
      kind: "success",
      accessToken: "token-1",
      tokenType: "bearer",
      scope: "read_repository",
    });
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.strictEqual(deviceFlow.ok, true);
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  for (const { pollResponse, expectedDeviceFlow, behavior } of [
    {
      behavior: "reports denied authorization",
      pollResponse: { kind: "access_denied" } as const,
      expectedDeviceFlow: {
        ok: false,
        reason: "User cancelled authorization. Run the command again to retry.",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "reports an expired device code",
      pollResponse: { kind: "expired_token" } as const,
      expectedDeviceFlow: {
        ok: false,
        reason: "Device code expired before authorization. Run the command again to restart.",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "includes an unexpected poll description",
      pollResponse: {
        kind: "unexpected",
        error: "unsupported_grant_type",
        description: "grant not supported",
      } as const,
      expectedDeviceFlow: {
        ok: false,
        reason: "Device Flow failed: unsupported_grant_type -- grant not supported",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "reports an unexpected poll without a description",
      pollResponse: { kind: "unexpected", error: "unsupported_grant_type" } as const,
      expectedDeviceFlow: {
        ok: false,
        reason: "Device Flow failed: unsupported_grant_type",
        authAttempted: true,
      } as const,
    },
  ]) {
    test(behavior, async () => {
      // arrange
      const provider = authProvider();
      const deviceFlowHttp = mock<DeviceFlowHttp>({
        exactParams: true,
        name: "device flow HTTP",
      });
      const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
      const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
      const pollingWait = expectedPollingWait(0);
      when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(
        deviceCode(),
      );
      when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve(pollResponse);
      when(() => {
        notification("Open https://verify.example/device and enter: CODE-1", "info");
      }).thenReturn(undefined);

      // act
      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: notification,
        http: deviceFlowHttp,
        provider,
        waitForPoll: pollingWait,
      });

      // assert
      assert.deepStrictEqual(deviceFlow, expectedDeviceFlow);
      verify(deviceFlowHttp);
      verify(credentialOps);
      verify(notification);
      verify(pollingWait);
    });
  }

  test("reports a polling error", async () => {
    // arrange
    const provider = authProvider();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(deviceCode());
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenReject(
      new Error("poll offline"),
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason: "Device Flow poll failed: poll offline",
      authAttempted: true,
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("uses a safe reason for a non-error polling failure", async (t) => {
    // arrange
    const provider = authProvider();
    const requestCode = t.mock.fn<DeviceFlowHttp["requestCode"]>(() =>
      Promise.resolve(deviceCode()),
    );
    const pollToken = t.mock.fn<DeviceFlowHttp["pollToken"]>(() => rejectNonError("poll offline"));
    const deviceFlowHttp = { requestCode, pollToken } satisfies DeviceFlowHttp;
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason: "Device Flow poll failed: unknown error",
      authAttempted: true,
    });
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("times out without polling after the device code expires", async () => {
    // arrange
    const provider = authProvider();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(
      deviceCode({ expires_in: 0 }),
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason:
        "Device Flow timed out before authorization completed. Run the command again to restart.",
      authAttempted: true,
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
  });

  test("cancels before polling when the abort signal is already aborted", async () => {
    // arrange
    const provider = authProvider();
    const controller = new AbortController();
    controller.abort();
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = mock<NonNullable<InitiateDeviceFlowOpts["waitForPoll"]>>({
      exactParams: true,
      name: "polling wait",
    });
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(
      deviceCode({ interval: 60 }),
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() => pollingWait(60_000, controller.signal)).thenReject(new Error("aborted"));

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      signal: controller.signal,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason: "Device Flow cancelled.",
      authAttempted: true,
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  for (const { requestFailure, expectedReason, behavior } of [
    {
      behavior: "reports an initialization error",
      requestFailure: new Error("request offline"),
      expectedReason: "Device Flow initialization failed: request offline",
    },
    {
      behavior: "uses a safe reason for a non-error initialization failure",
      requestFailure: "request offline",
      expectedReason: "Device Flow initialization failed: unknown error",
    },
  ]) {
    test(behavior, async () => {
      // arrange
      const provider = authProvider();
      const deviceFlowHttp = mock<DeviceFlowHttp>({
        exactParams: true,
        name: "device flow HTTP",
      });
      const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
      const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
      when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenReturn(
        requestFailure instanceof Error
          ? Promise.reject(requestFailure)
          : rejectNonError(requestFailure),
      );

      // act
      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: notification,
        http: deviceFlowHttp,
        provider,
      });

      // assert
      assert.deepStrictEqual(deviceFlow, {
        ok: false,
        reason: expectedReason,
        authAttempted: true,
      });
      verify(deviceFlowHttp);
      verify(credentialOps);
      verify(notification);
    });
  }

  test("propagates credential persistence errors", async () => {
    // arrange
    const provider = authProvider();
    const persistenceFailure = new Error("keychain locked");
    const deviceFlowHttp = mock<DeviceFlowHttp>({
      exactParams: true,
      name: "device flow HTTP",
    });
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    when(() => deviceFlowHttp.requestCode("client-1", "read_repository")).thenResolve(deviceCode());
    when(() => deviceFlowHttp.pollToken("client-1", "device-1", 0)).thenResolve({
      kind: "success",
      accessToken: "token-1",
      tokenType: "bearer",
      scope: "read_repository",
    });
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenReject(persistenceFailure);

    // act
    const deviceFlow = initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      http: deviceFlowHttp,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    await assert.rejects(deviceFlow, (error: unknown) => {
      assert.strictEqual(error, persistenceFailure);
      return true;
    });
    verify(deviceFlowHttp);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("sends the provider's device and token requests through fetch", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    const fetchSpy = t.mock.method(
      globalThis,
      "fetch",
      (input: string | URL | Request): Promise<Response> => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url === "https://auth.example/device") {
          return Promise.resolve(new Response(JSON.stringify(deviceCode()), { status: 200 }));
        }

        if (url === "https://auth.example/token") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "token-1",
                token_type: "bearer",
                scope: "read_repository",
              }),
              { status: 200 },
            ),
          );
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      },
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: true,
      cred: { username: "oauth2", password: "token-1" },
      authAttempted: true,
    });
    const fetchRequests = await Promise.all(
      fetchSpy.mock.calls.map(async ({ arguments: [input, init] }) => {
        const request = new Request(input, init);
        return {
          url: request.url,
          method: request.method,
          accept: request.headers.get("accept"),
          contentType: request.headers.get("content-type"),
          body: await request.text(),
        };
      }),
    );
    assert.deepStrictEqual(fetchRequests, [
      {
        url: "https://auth.example/device",
        method: "POST",
        accept: "application/json",
        contentType: "application/x-www-form-urlencoded",
        body: "client_id=client-1&scope=read_repository",
      },
      {
        url: "https://auth.example/token",
        method: "POST",
        accept: "application/json",
        contentType: "application/x-www-form-urlencoded",
        body: "client_id=client-1&device_code=device-1&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
      },
    ]);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  for (const { responseBody, expectedReason, behavior } of [
    {
      behavior: "reports a device-code error and its description",
      responseBody: JSON.stringify({
        error: "invalid_client",
        error_description: "bad client",
      }),
      expectedReason:
        "Device Flow initialization failed: Device code request failed: HTTP 400 (invalid_client -- bad client)",
    },
    {
      behavior: "reports a device-code error without a description",
      responseBody: JSON.stringify({ error: "invalid_client" }),
      expectedReason:
        "Device Flow initialization failed: Device code request failed: HTTP 400 (invalid_client)",
    },
    {
      behavior: "uses the HTTP status when a device-code response has no error field",
      responseBody: JSON.stringify({ message: "bad request" }),
      expectedReason: "Device Flow initialization failed: Device code request failed: HTTP 400",
    },
    {
      behavior: "uses the HTTP status when a device-code error is not JSON",
      responseBody: "not JSON",
      expectedReason: "Device Flow initialization failed: Device code request failed: HTTP 400",
    },
  ]) {
    test(behavior, async (t) => {
      // arrange
      const provider = authProvider();
      const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
      const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
      t.mock.method(globalThis, "fetch", (): Promise<Response> =>
        Promise.resolve(new Response(responseBody, { status: 400 })),
      );

      // act
      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: notification,
        provider,
      });

      // assert
      assert.deepStrictEqual(deviceFlow, {
        ok: false,
        reason: expectedReason,
        authAttempted: true,
      });
      verify(credentialOps);
      verify(notification);
    });
  }

  for (const { fieldName, responseBody } of [
    { fieldName: "device_code", responseBody: { ...deviceCode(), device_code: 1 } },
    { fieldName: "user_code", responseBody: { ...deviceCode(), user_code: 1 } },
    {
      fieldName: "verification_uri",
      responseBody: { ...deviceCode(), verification_uri: 1 },
    },
    { fieldName: "expires_in", responseBody: { ...deviceCode(), expires_in: "900" } },
    { fieldName: "interval", responseBody: { ...deviceCode(), interval: "5" } },
  ]) {
    test(`rejects a device-code response with an invalid ${fieldName}`, async (t) => {
      // arrange
      const provider = authProvider();
      const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
      const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
      t.mock.method(globalThis, "fetch", (): Promise<Response> =>
        Promise.resolve(new Response(JSON.stringify(responseBody), { status: 200 })),
      );

      // act
      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: notification,
        provider,
      });

      // assert
      assert.deepStrictEqual(deviceFlow, {
        ok: false,
        reason: "Device Flow initialization failed: Device code response missing required fields",
        authAttempted: true,
      });
      verify(credentialOps);
      verify(notification);
    });
  }

  test("accepts a token response without optional token metadata", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    const fetchSpy = t.mock.method(globalThis, "fetch", unexpectedFetch);
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
    fetchSpy.mock.mockImplementationOnce(
      () => fetchResponse(JSON.stringify({ access_token: "token-1" })),
      1,
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: true,
      cred: { username: "oauth2", password: "token-1" },
      authAttempted: true,
    });
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  for (const { responseBody, expectedDeviceFlow, behavior } of [
    {
      behavior: "maps access_denied from the token endpoint",
      responseBody: { error: "access_denied" },
      expectedDeviceFlow: {
        ok: false,
        reason: "User cancelled authorization. Run the command again to retry.",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "maps expired_token from the token endpoint",
      responseBody: { error: "expired_token" },
      expectedDeviceFlow: {
        ok: false,
        reason: "Device code expired before authorization. Run the command again to restart.",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "preserves an unknown token error description",
      responseBody: { error: "unknown_grant", error_description: "not supported" },
      expectedDeviceFlow: {
        ok: false,
        reason: "Device Flow failed: unknown_grant -- not supported",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "reports an unknown token error without a description",
      responseBody: { error: "unknown_grant" },
      expectedDeviceFlow: {
        ok: false,
        reason: "Device Flow failed: unknown_grant",
        authAttempted: true,
      } as const,
    },
    {
      behavior: "maps a non-string token error to unexpected",
      responseBody: { error: 1 },
      expectedDeviceFlow: {
        ok: false,
        reason: "Device Flow failed: unexpected",
        authAttempted: true,
      } as const,
    },
  ]) {
    test(behavior, async (t) => {
      // arrange
      const provider = authProvider();
      const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
      const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
      const pollingWait = expectedPollingWait(0);
      const fetchSpy = t.mock.method(globalThis, "fetch", unexpectedFetch);
      fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
      fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(responseBody)), 1);
      when(() => {
        notification("Open https://verify.example/device and enter: CODE-1", "info");
      }).thenReturn(undefined);

      // act
      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: notification,
        provider,
        waitForPoll: pollingWait,
      });

      // assert
      assert.deepStrictEqual(deviceFlow, expectedDeviceFlow);
      verify(credentialOps);
      verify(notification);
      verify(pollingWait);
    });
  }

  test("continues polling after authorization_pending from the token endpoint", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0, 0);
    const fetchSpy = t.mock.method(globalThis, "fetch", unexpectedFetch);
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
    fetchSpy.mock.mockImplementationOnce(
      () => fetchResponse(JSON.stringify({ error: "authorization_pending" })),
      1,
    );
    fetchSpy.mock.mockImplementationOnce(
      () => fetchResponse(JSON.stringify({ access_token: "token-1" })),
      2,
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.strictEqual(deviceFlow.ok, true);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("continues polling after slow_down from the token endpoint", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0, 5_000);
    const fetchSpy = t.mock.method(globalThis, "fetch", unexpectedFetch);
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
    fetchSpy.mock.mockImplementationOnce(
      () => fetchResponse(JSON.stringify({ error: "slow_down" })),
      1,
    );
    fetchSpy.mock.mockImplementationOnce(
      () => fetchResponse(JSON.stringify({ access_token: "token-1" })),
      2,
    );
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);
    when(() =>
      credentialOps.approve("auth.example", { username: "oauth2", password: "token-1" }),
    ).thenResolve(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.strictEqual(deviceFlow.ok, true);
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("reports a token-endpoint network failure", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    const fetchSpy = t.mock.method(globalThis, "fetch", (): Promise<Response> =>
      Promise.reject(new TypeError("offline")),
    );
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason: "Device Flow failed: network_error -- TypeError: offline",
      authAttempted: true,
    });
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });

  test("reports malformed JSON from the token endpoint", async (t) => {
    // arrange
    const provider = authProvider();
    const credentialOps = mock<CredentialOps>({ exactParams: true, name: "credentials" });
    const notification = mock<NotifyFn>({ exactParams: true, name: "notification" });
    const pollingWait = expectedPollingWait(0);
    const fetchSpy = t.mock.method(globalThis, "fetch", unexpectedFetch);
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse(JSON.stringify(deviceCode())), 0);
    fetchSpy.mock.mockImplementationOnce(() => fetchResponse("not JSON", 502), 1);
    when(() => {
      notification("Open https://verify.example/device and enter: CODE-1", "info");
    }).thenReturn(undefined);

    // act
    const deviceFlow = await initiateDeviceFlow({
      host: "auth.example",
      credentialOps,
      notifyFn: notification,
      provider,
      waitForPoll: pollingWait,
    });

    // assert
    assert.deepStrictEqual(deviceFlow, {
      ok: false,
      reason: "Device Flow failed: invalid_json -- HTTP 502",
      authAttempted: true,
    });
    verify(credentialOps);
    verify(notification);
    verify(pollingWait);
  });
});
