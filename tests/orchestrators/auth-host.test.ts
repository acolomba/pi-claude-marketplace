import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  NO_PROVIDER_CAUSE,
  buildAuthForHost,
  buildCloneAuth,
  hostFromCloneUrl,
} from "../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { createDeviceFlowFake } from "../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";

import type { AuthAttemptResult } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("hostFromCloneUrl", () => {
  test("canonicalizes a GitHub source without parsing its clone URL", () => {
    // arrange
    const cloneUrl = "not a valid URL";

    // act
    const host = hostFromCloneUrl(cloneUrl, "github");

    // assert
    assert.strictEqual(host, "github.com");
  });

  test("extracts the host from a URL source", () => {
    // arrange
    const cloneUrl = "https://gitlab.com/team/plugin.git";

    // act
    const host = hostFromCloneUrl(cloneUrl, "url");

    // assert
    assert.strictEqual(host, "gitlab.com");
  });

  test("preserves the port in a git-subdir source host", () => {
    // arrange
    const cloneUrl = "https://git.example:8443/team/repository.git#plugin";

    // act
    const host = hostFromCloneUrl(cloneUrl, "git-subdir");

    // assert
    assert.strictEqual(host, "git.example:8443");
  });

  test("rejects an invalid URL source", () => {
    // arrange
    const cloneUrl = "not a valid URL";

    // act & assert
    assert.throws(() => hostFromCloneUrl(cloneUrl, "url"), TypeError);
  });
});

describe("NO_PROVIDER_CAUSE", () => {
  test("renders the exact unsupported-provider cause", () => {
    // arrange
    const host = "git.example:8443";

    // act
    const cause = NO_PROVIDER_CAUSE(host);

    // assert
    assert.strictEqual(cause, "no auth provider is registered for git.example:8443");
  });
});

describe("buildAuthForHost", () => {
  test("returns exact absence for an unsupported provider without touching collaborators", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildAuthForHost({
      host: "git.example",
      credentialOps: credentials.credentialOps,
      ctx,
    });

    // assert
    assert.strictEqual(auth, undefined);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("forwards a credential hit through the complete GitHub bundle", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["github.com", { username: "x-access-token", password: "stored-credential" }]],
    });
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
    });
    assert.ok(auth !== undefined);

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(credential, {
      username: "x-access-token",
      password: "stored-credential",
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "github.com" }],
      approve: [],
      reject: [],
    });
    verify(ctx);
  });

  test("forwards a credential miss through the complete GitLab bundle", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const auth = buildAuthForHost({
      host: "gitlab.com",
      credentialOps: credentials.credentialOps,
      ctx,
    });
    assert.ok(auth !== undefined);

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "gitlab.com" }],
      approve: [],
      reject: [],
    });
    verify(ctx);
  });

  test("reruns an injected GitHub Device Flow when the memo is omitted", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .twice();
    when(() => {
      ui.notify("Open https://github.com/login/device and enter: GH-1234", "info");
    })
      .thenReturn(undefined)
      .twice();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "github-device-code",
        user_code: "GH-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollResponses: [
        {
          kind: "success",
          accessToken: "github-secret-1",
          tokenType: "bearer",
          scope: "repo",
        },
        {
          kind: "success",
          accessToken: "github-secret-2",
          tokenType: "bearer",
          scope: "repo",
        },
      ],
    });
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      deviceFlowHttp: deviceFlow.http,
    });
    assert.ok(auth !== undefined);

    // act
    const firstAuthentication = await auth.onAuthRequired();
    const secondAuthentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(firstAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret-1" },
      authAttempted: true,
    });
    assert.deepStrictEqual(secondAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret-2" },
      authAttempted: true,
    });
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "github-secret-2",
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [
        { clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" },
        { clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" },
      ],
      pollToken: [
        {
          clientId: "Ov23liNcyK08uGdU0mMl",
          deviceCode: "github-device-code",
          intervalSec: 0,
        },
        {
          clientId: "Ov23liNcyK08uGdU0mMl",
          deviceCode: "github-device-code",
          intervalSec: 0,
        },
      ],
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "github-secret-1" },
        },
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "github-secret-2" },
        },
      ],
      reject: [],
    });
    verify(ctx);
    verify(ui);
  });

  test("returns an exact Device Flow initialization failure without notifying or persisting", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "unused-device-code",
        user_code: "UNUSED",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      requestCodeError: new Error("provider unavailable"),
    });
    const authMemo = new Map<string, AuthAttemptResult>();
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      deviceFlowHttp: deviceFlow.http,
      authMemo,
    });
    assert.ok(auth !== undefined);

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: false,
      reason: "Device Flow initialization failed: provider unavailable",
      authAttempted: true,
    });
    assert.deepStrictEqual(authMemo, new Map([["github.com", authentication]]));
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
      pollToken: [],
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("returns the same-host memo entry without repeating authentication", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify("Open https://github.com/login/device and enter: GH-5678", "info");
    })
      .thenReturn(undefined)
      .once();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "memo-device-code",
        user_code: "GH-5678",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollResponses: [
        {
          kind: "success",
          accessToken: "memo-secret",
          tokenType: "bearer",
          scope: "repo",
        },
      ],
    });
    const authMemo = new Map<string, AuthAttemptResult>();
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      deviceFlowHttp: deviceFlow.http,
      authMemo,
    });
    assert.ok(auth !== undefined);

    // act
    const firstAuthentication = await auth.onAuthRequired();
    const secondAuthentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(firstAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "memo-secret" },
      authAttempted: true,
    });
    assert.strictEqual(secondAuthentication, firstAuthentication);
    assert.deepStrictEqual(authMemo, new Map([["github.com", firstAuthentication]]));
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "memo-secret",
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
      pollToken: [
        {
          clientId: "Ov23liNcyK08uGdU0mMl",
          deviceCode: "memo-device-code",
          intervalSec: 0,
        },
      ],
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "memo-secret" },
        },
      ],
      reject: [],
    });
    verify(ctx);
    verify(ui);
  });

  test("isolates memo entries and provider arguments across different hosts", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .twice();
    when(() => {
      ui.notify("Open https://auth.example/device and enter: HOST-1234", "info");
    })
      .thenReturn(undefined)
      .twice();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "shared-device-code",
        user_code: "HOST-1234",
        verification_uri: "https://auth.example/device",
        expires_in: 900,
        interval: 0,
      },
      pollResponses: [
        { kind: "success", accessToken: "github-secret", tokenType: "bearer", scope: "repo" },
        {
          kind: "success",
          accessToken: "gitlab-secret",
          tokenType: "bearer",
          scope: "read_repository",
        },
      ],
    });
    const authMemo = new Map<string, AuthAttemptResult>();
    const githubAuth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      deviceFlowHttp: deviceFlow.http,
      authMemo,
    });
    const gitlabAuth = buildAuthForHost({
      host: "gitlab.com",
      credentialOps: credentials.credentialOps,
      ctx,
      deviceFlowHttp: deviceFlow.http,
      authMemo,
    });
    assert.ok(githubAuth !== undefined);
    assert.ok(gitlabAuth !== undefined);

    // act
    const githubAuthentication = await githubAuth.onAuthRequired();
    const gitlabAuthentication = await gitlabAuth.onAuthRequired();
    const repeatedGithubAuthentication = await githubAuth.onAuthRequired();
    const repeatedGitlabAuthentication = await gitlabAuth.onAuthRequired();

    // assert
    assert.deepStrictEqual(githubAuth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: githubAuth.onAuthRequired,
    });
    assert.deepStrictEqual(gitlabAuth, {
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
      onAuthRequired: gitlabAuth.onAuthRequired,
    });
    assert.deepStrictEqual(githubAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret" },
      authAttempted: true,
    });
    assert.deepStrictEqual(gitlabAuthentication, {
      ok: true,
      cred: { username: "oauth2", password: "gitlab-secret" },
      authAttempted: true,
    });
    assert.strictEqual(repeatedGithubAuthentication, githubAuthentication);
    assert.strictEqual(repeatedGitlabAuthentication, gitlabAuthentication);
    assert.deepStrictEqual(
      authMemo,
      new Map([
        ["github.com", githubAuthentication],
        ["gitlab.com", gitlabAuthentication],
      ]),
    );
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "github-secret",
    });
    assert.deepStrictEqual(credentials.storedCredential("gitlab.com"), {
      username: "oauth2",
      password: "gitlab-secret",
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [
        { clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" },
        {
          clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
          scope: "read_repository",
        },
      ],
      pollToken: [
        {
          clientId: "Ov23liNcyK08uGdU0mMl",
          deviceCode: "shared-device-code",
          intervalSec: 0,
        },
        {
          clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
          deviceCode: "shared-device-code",
          intervalSec: 0,
        },
      ],
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "github-secret" },
        },
        {
          host: "gitlab.com",
          credential: { username: "oauth2", password: "gitlab-secret" },
        },
      ],
      reject: [],
    });
    verify(ctx);
    verify(ui);
  });

  test("uses the offline default HTTP adapter when the optional collaborator is omitted", async (t) => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify("Open https://github.com/login/device and enter: DEFAULT-1", "info");
    })
      .thenReturn(undefined)
      .once();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const fetchSpy = t.mock.method(
      globalThis,
      "fetch",
      (input: string | URL | Request): Promise<Response> => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url === "https://github.com/login/device/code") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                device_code: "default-device-code",
                user_code: "DEFAULT-1",
                verification_uri: "https://github.com/login/device",
                expires_in: 900,
                interval: 0,
              }),
              { status: 200 },
            ),
          );
        }

        if (url === "https://github.com/login/oauth/access_token") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "default-secret",
                token_type: "bearer",
                scope: "repo",
              }),
              { status: 200 },
            ),
          );
        }

        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      },
    );
    const authMemo = new Map<string, AuthAttemptResult>();
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      authMemo,
    });
    assert.ok(auth !== undefined);

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: true,
      cred: { username: "x-access-token", password: "default-secret" },
      authAttempted: true,
    });
    assert.deepStrictEqual(authMemo, new Map([["github.com", authentication]]));
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "default-secret",
    });
    assert.strictEqual(fetchSpy.mock.callCount(), 2);
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "default-secret" },
        },
      ],
      reject: [],
    });
    verify(ctx);
    verify(ui);
  });
});

describe("buildCloneAuth", () => {
  test("forwards the canonical GitHub host and both optional collaborators", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify("Open https://github.com/login/device and enter: CLONE-1", "info");
    })
      .thenReturn(undefined)
      .once();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "clone-device-code",
        user_code: "CLONE-1",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 0,
      },
      pollResponses: [
        {
          kind: "success",
          accessToken: "clone-secret",
          tokenType: "bearer",
          scope: "repo",
        },
      ],
    });
    const authMemo = new Map<string, AuthAttemptResult>();
    const auth = buildCloneAuth("not a valid URL", "github", {
      ctx,
      credentialOps: credentials.credentialOps,
      deviceFlowHttp: deviceFlow.http,
      authMemo,
    });
    assert.ok(auth !== undefined);

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: true,
      cred: { username: "x-access-token", password: "clone-secret" },
      authAttempted: true,
    });
    assert.deepStrictEqual(authMemo, new Map([["github.com", authentication]]));
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "clone-secret",
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
      pollToken: [
        {
          clientId: "Ov23liNcyK08uGdU0mMl",
          deviceCode: "clone-device-code",
          intervalSec: 0,
        },
      ],
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [
        {
          host: "github.com",
          credential: { username: "x-access-token", password: "clone-secret" },
        },
      ],
      reject: [],
    });
    verify(ctx);
    verify(ui);
  });

  test("forwards a URL host while truly omitting optional collaborators", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const authOptions = { credentialOps: credentials.credentialOps, ctx };

    // act
    const auth = buildCloneAuth("https://gitlab.com/team/plugin.git", "url", authOptions);

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
      onAuthRequired: auth?.onAuthRequired,
    });
    assert.deepStrictEqual(Object.keys(authOptions), ["credentialOps", "ctx"]);
    verify(ctx);
  });

  test("returns exact absence for an unsupported port-bearing git-subdir host", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildCloneAuth(
      "https://gitlab.com:8443/team/repository.git#plugin",
      "git-subdir",
      { ctx, credentialOps: credentials.credentialOps },
    );

    // assert
    assert.strictEqual(auth, undefined);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });
});
