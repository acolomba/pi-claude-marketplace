import assert from "node:assert/strict";
import test from "node:test";

import { GITHUB_PROVIDER } from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";
import {
  NO_PROVIDER_CAUSE,
  buildAuthForHost,
  hostFromCloneUrl,
} from "../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts";

import type { AuthAttemptResult } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (msg: string, sev?: string): void => {
        notifications.push(sev === undefined ? { message: msg } : { message: msg, severity: sev });
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

test("buildAuthForHost('github.com') returns a bundle whose onAuthRequired drives the GitHub provider's Device Flow", async () => {
  const { ctx } = makeCtx();
  const { credOps: credentialOps } = makeMockCredentialOps();
  const { http: deviceFlowHttp, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_test", tokenType: "bearer", scope: "repo" }],
  });

  const bundle = buildAuthForHost({ host: "github.com", credentialOps, ctx, deviceFlowHttp });
  assert.ok(bundle !== undefined, "github.com must resolve to a bundle");
  assert.equal(bundle.host, "github.com");
  assert.equal(bundle.credentialOps, credentialOps, "credentialOps must be reference-equal");
  assert.equal(typeof bundle.onAuthRequired, "function");

  // Invoking onAuthRequired runs initiateDeviceFlow bound to GITHUB_PROVIDER --
  // the mock http records the provider's client_id.
  const result: AuthAttemptResult = await bundle.onAuthRequired();
  assert.equal(result.ok, true);
  assert.equal(httpState.requestCodeCalls.length, 1);
  assert.equal(
    httpState.requestCodeCalls[0]?.clientId,
    GITHUB_PROVIDER.clientId,
    "the flow must run against the GitHub provider's client_id",
  );
});

test("buildAuthForHost('example.com') returns undefined -- no registered provider (PROV-04)", () => {
  const { ctx } = makeCtx();
  const { credOps: credentialOps } = makeMockCredentialOps();

  const bundle = buildAuthForHost({ host: "example.com", credentialOps, ctx });
  assert.equal(bundle, undefined, "an unregistered host must never yield an auth bundle");
});

test("hostFromCloneUrl extracts the bare host (URL.host, port-inclusive) per source kind (Q2)", () => {
  assert.equal(hostFromCloneUrl("https://github.com/o/r.git", "github"), "github.com");
  assert.equal(hostFromCloneUrl("https://example.com/o/r.git", "url"), "example.com");
  assert.equal(
    hostFromCloneUrl("https://gitlab.example.com:8443/o/r", "git-subdir"),
    "gitlab.example.com:8443",
  );
});

test("buildAuthForHost consults an authMemo so a provider host runs the flow AT MOST ONCE per host (D-79-02)", async () => {
  const { ctx } = makeCtx();
  const { credOps: credentialOps } = makeMockCredentialOps();

  const { http: deviceFlowHttp, state: httpState } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK",
      user_code: "WXYZ-9999",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "success", accessToken: "gho_memo", tokenType: "bearer", scope: "repo" }],
  });

  const authMemo = new Map<string, AuthAttemptResult>();
  const bundle = buildAuthForHost({
    host: "github.com",
    credentialOps,
    ctx,
    deviceFlowHttp,
    authMemo,
  });
  assert.ok(bundle !== undefined, "github.com must yield a bundle");

  const first = await bundle.onAuthRequired();
  const second = await bundle.onAuthRequired();

  assert.equal(first.ok, true);
  assert.deepEqual(second, first, "the second call must return the memoized result");
  assert.equal(
    httpState.requestCodeCalls.length,
    1,
    "the Device Flow must run exactly once for the memoized host",
  );
});

test("NO_PROVIDER_CAUSE renders the single no-provider cause line (D-79-03)", () => {
  assert.equal(
    NO_PROVIDER_CAUSE("gitlab.example.com"),
    "no auth provider is registered for gitlab.example.com",
  );
});
