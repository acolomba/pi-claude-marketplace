import assert from "node:assert/strict";
import test from "node:test";

import {
  GITHUB_PROVIDER,
  findProviderForHost,
} from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";
import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts";

import type { GitAuthProvider } from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";

function noopNotify(): void {
  // no-op notify sink for engine-parameterization tests
}

test("PROV-01 findProviderForHost('github.com') returns the GitHub descriptor", () => {
  const provider = findProviderForHost("github.com");
  assert.ok(provider, "expected a provider for github.com");
  assert.equal(provider.id, "github");
});

test("PROV-01 findProviderForHost('example.com') returns undefined", () => {
  assert.equal(findProviderForHost("example.com"), undefined);
});

test("PROV-01 findProviderForHost('gitlab.com') returns undefined (no GitLab descriptor in v1)", () => {
  assert.equal(findProviderForHost("gitlab.com"), undefined);
});

test("GITHUB_PROVIDER.credentialFrom maps the token to x-access-token basic auth", () => {
  assert.deepEqual(GITHUB_PROVIDER.credentialFrom("tok123"), {
    username: "x-access-token",
    password: "tok123",
  });
});

test("GITHUB_PROVIDER carries today's exact github.com endpoints, client_id, and scope", () => {
  assert.equal(GITHUB_PROVIDER.deviceCodeUrl, "https://github.com/login/device/code");
  assert.equal(GITHUB_PROVIDER.tokenUrl, "https://github.com/login/oauth/access_token");
  assert.equal(GITHUB_PROVIDER.clientId, "Ov23liNcyK08uGdU0mMl");
  assert.equal(GITHUB_PROVIDER.scope, "repo");
});

test("initiateDeviceFlow drives the engine identically with and without an explicit GITHUB_PROVIDER", async () => {
  const success = {
    kind: "success" as const,
    accessToken: "gho_x",
    tokenType: "bearer",
    scope: "repo",
  };
  const deviceCode = {
    device_code: "MOCK_DEVICE_CODE",
    user_code: "ABCD-1234",
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 0,
  };

  const withoutProvider = makeMockDeviceFlowHttp({ deviceCode, pollQueue: [success] });
  await initiateDeviceFlow({
    host: "github.com",
    credentialOps: makeMockCredentialOps().credOps,
    notifyFn: noopNotify,
    http: withoutProvider.http,
  });

  const withProvider = makeMockDeviceFlowHttp({ deviceCode, pollQueue: [success] });
  await initiateDeviceFlow({
    host: "github.com",
    credentialOps: makeMockCredentialOps().credOps,
    notifyFn: noopNotify,
    http: withProvider.http,
    provider: GITHUB_PROVIDER,
  });

  assert.equal(withoutProvider.state.requestCodeCalls[0]?.clientId, "Ov23liNcyK08uGdU0mMl");
  assert.equal(withoutProvider.state.requestCodeCalls[0]?.scope, "repo");
  assert.deepEqual(
    withProvider.state.requestCodeCalls[0],
    withoutProvider.state.requestCodeCalls[0],
  );
});

test("initiateDeviceFlow drives clientId/scope and credentialFrom from a synthetic provider", async () => {
  const mockProvider: GitAuthProvider = {
    id: "mock",
    hostMatch: (host) => host === "mock.example",
    deviceCodeUrl: "https://mock.example/device/code",
    tokenUrl: "https://mock.example/token",
    clientId: "mock-id",
    scope: "read",
    credentialFrom: (accessToken) => ({ username: "oauth2", password: accessToken }),
  };

  const { http, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://mock.example/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "tok-mock", tokenType: "bearer", scope: "read" }],
  });
  const { credOps, state: credState } = makeMockCredentialOps();

  const result = await initiateDeviceFlow({
    host: "mock.example",
    credentialOps: credOps,
    notifyFn: noopNotify,
    http,
    provider: mockProvider,
  });

  assert.equal(httpState.requestCodeCalls[0]?.clientId, "mock-id");
  assert.equal(httpState.requestCodeCalls[0]?.scope, "read");
  assert.equal(httpState.pollTokenCalls[0]?.clientId, "mock-id");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.cred.username, "oauth2");
  }

  assert.equal(credState.approveCalls[0]?.cred.username, "oauth2");
});
