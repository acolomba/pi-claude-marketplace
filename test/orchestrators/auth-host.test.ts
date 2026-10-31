import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  DEFAULT_CREDENTIAL_OPS,
  NO_STORED_CREDENTIAL_CAUSE,
  buildAuthForHost,
  buildCloneAuth,
  buildGitHubAuth,
  buildStoredCredentialAuth,
  hostFromCloneUrl,
} from "../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import { buildAuthCallbacks } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import { createCredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import {
  DeviceFlowUnavailableError,
  InvalidGitHubBaseUrlError,
  StoredCredentialRejectedError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { createDeviceFlowFake } from "../domain/device-flow-fake.ts";
import { createJsonCapture } from "../edge/json-capture.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type {
  DeviceCodeResponse,
  DeviceFlowHttp,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type { GitAuthBundle } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { AuthAttemptResult } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import type { CredentialSpawn } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type {
  ExtensionContext,
  NotificationContext,
  PiInventory,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/** Narrows a bundle the case expects to run a Device Flow, and fails the case otherwise. */
function expectDeviceFlow(auth: GitAuthBundle): Extract<GitAuthBundle, { kind: "device-flow" }> {
  assert.ok(auth.kind === "device-flow", `expected a device-flow bundle for ${auth.host}`);
  return auth;
}

describe("DEFAULT_CREDENTIAL_OPS", () => {
  test("composes the platform credential protocol without launching a process", () => {
    // arrange
    const launches: Array<readonly [string, readonly string[]]> = [];
    const recordingLauncher: CredentialSpawn = (command, args) => {
      launches.push([command, args]);
      throw new Error("composing the default credential ops must not launch a process");
    };

    const composed = createCredentialOps({ spawn: recordingLauncher, timeoutMs: 5_000 });

    // act
    const productionOps = DEFAULT_CREDENTIAL_OPS;

    // assert
    assert.deepStrictEqual(Object.keys(productionOps), Object.keys(composed));
    assert.deepStrictEqual(Object.keys(productionOps), ["fill", "approve", "reject"]);
    assert.deepStrictEqual(launches, []);
  });
});

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

  test("GHB-02: binds a GitHub source to the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");

    // act
    const host = hostFromCloneUrl("https://github.com/acme/tools.git", "github");

    // assert
    assert.strictEqual(host, "mirror.example:8443");
  });

  test("D-09: binds a github.com git-subdir url to the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");

    // act
    const host = hostFromCloneUrl("https://github.com/acme/tools.git#plugin", "git-subdir");

    // assert
    assert.strictEqual(host, "mirror.example:8443");
  });

  test("a url source host ignores an invalid override", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    const host = hostFromCloneUrl("https://gitlab.example.com/acme/tools", "url");

    // assert
    assert.strictEqual(host, "gitlab.example.com");
  });
});

describe("NO_STORED_CREDENTIAL_CAUSE", () => {
  test("names the host and the command that stores a credential for it", () => {
    // arrange
    const host = "git.example:8443";

    // act
    const cause = NO_STORED_CREDENTIAL_CAUSE(host);

    // assert
    assert.strictEqual(
      cause,
      "no credential was obtained for git.example:8443; store one with: printf " +
        "'protocol=https\\nhost=git.example:8443\\nusername=<user>\\npassword=<token>\\n\\n' " +
        "| git credential approve",
    );
  });
});

describe("buildAuthForHost", () => {
  for (const initialMode of ["print", "json", "rpc", "tui"]) {
    test(`refuses new device flow in live print mode after construction in ${initialMode}`, async () => {
      // arrange
      const ui = mock<NotificationContext["ui"]>({ exactParams: true, name: "UI" });
      const deviceFlowHttp = mock<DeviceFlowHttp>({ exactParams: true, name: "device HTTP" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const ctx = { mode: initialMode, ui };
      const authMemo = new Map<string, AuthAttemptResult>();
      const auth = expectDeviceFlow(
        buildAuthForHost({
          host: "github.com",
          ctx,
          run: runWithNothingLoaded(),
          credentialOps: credentials.credentialOps,
          deviceFlowHttp,
          authMemo,
        }),
      );
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      ctx.mode = "print";

      // act & assert
      await assert.rejects(auth.onAuthRequired(), (error: unknown) => {
        assert.ok(error instanceof DeviceFlowUnavailableError);
        assert.strictEqual(
          error.message,
          "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.",
        );
        return true;
      });
      assert.deepStrictEqual(authMemo, new Map());
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      verify(deviceFlowHttp);
      verify(ui);
    });
  }

  for (const host of ["github.com", "gitlab.com", "git.example.invalid"]) {
    test(`reuses a stored credential in print for ${host}`, async () => {
      // arrange
      const ui = mock<NotificationContext["ui"]>({ exactParams: true, name: "UI" });
      const deviceFlowHttp = mock<DeviceFlowHttp>({ exactParams: true, name: "device HTTP" });
      const credentials = createCredentialOpsFake({
        boundary: "memory",
        credentials: [[host, { username: "stored", password: "secret" }]],
      });
      const auth = buildAuthForHost({
        host,
        ctx: { mode: "print", ui },
        run: runWithNothingLoaded(),
        credentialOps: credentials.credentialOps,
        deviceFlowHttp,
      });

      // act
      const credential = await buildAuthCallbacks(auth).onAuth(`https://${host}/owner/repo`);

      // assert
      assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
      assert.deepStrictEqual(credentials.calls, { fill: [{ host }], approve: [], reject: [] });
      verify(deviceFlowHttp);
      verify(ui);
    });
  }

  for (const authentication of [
    { ok: true, cred: { username: "memo", password: "secret" } },
    { ok: false, reason: "User cancelled authorization." },
  ] satisfies AuthAttemptResult[]) {
    test(`reuses a memoized ${authentication.ok ? "success" : "failure"} in print`, async () => {
      // arrange
      const ui = mock<NotificationContext["ui"]>({ exactParams: true, name: "UI" });
      const deviceFlowHttp = mock<DeviceFlowHttp>({ exactParams: true, name: "device HTTP" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const authMemo = new Map<string, AuthAttemptResult>([["github.com", authentication]]);
      const auth = expectDeviceFlow(
        buildAuthForHost({
          host: "github.com",
          ctx: { mode: "print", ui },
          run: runWithNothingLoaded(),
          credentialOps: credentials.credentialOps,
          deviceFlowHttp,
          authMemo,
        }),
      );

      // act
      const reused = await auth.onAuthRequired();

      // assert
      assert.strictEqual(reused, authentication);
      assert.deepStrictEqual(authMemo, new Map([["github.com", authentication]]));
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      verify(deviceFlowHttp);
      verify(ui);
    });
  }

  for (const mode of ["json", "rpc"]) {
    test(`joins the delayed prompt and token poll before auth settlement in ${mode}`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const capture = createJsonCapture();
      const events: unknown[] = [];
      let liveMode = "invalid-mode";
      const reads: string[] = [];
      const ctx = {
        get mode() {
          reads.push(liveMode);
          return liveMode;
        },
        get ui() {
          return capture.ui;
        },
      };
      let releaseCode!: (code: DeviceCodeResponse) => void;
      const code = new Promise<DeviceCodeResponse>((resolve) => {
        releaseCode = resolve;
      });
      let releaseToken!: (token: PollResult) => void;
      const token = new Promise<PollResult>((resolve) => {
        releaseToken = resolve;
      });
      let prompted!: () => void;
      const promptReady = new Promise<void>((resolve) => {
        prompted = resolve;
      });
      let polling!: () => void;
      const pollReady = new Promise<void>((resolve) => {
        polling = resolve;
      });
      const origin = {
        kind: "command",
        commandId: "marketplace add",
        invocationId: "auth-run",
      } as const;
      const run = openNotificationRun(
        {
          getAllTools: () => [],
          getCommands: () => [],
          appendEntry(customType, payload) {
            capture.entrySink.appendEntry(customType, payload);
            events.push({ customType, payload });
            prompted();
          },
        },
        origin,
      );
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const authMemo = new Map<string, AuthAttemptResult>();
      const auth = expectDeviceFlow(
        buildAuthForHost({
          host: "github.com",
          ctx,
          run,
          authMemo,
          credentialOps: credentials.credentialOps,
          deviceFlowHttp: {
            requestCode: () => code,
            pollToken: () => {
              polling();
              return token;
            },
          },
        }),
      );
      const prompt = {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin,
          kind: "device-flow-prompt",
          severity: "info",
          needsReload: false,
          verificationUri: "https://github.com/login/device",
          userCode: "WAIT-1234",
        },
      };

      // act
      const authentication = auth.onAuthRequired().then((authenticated) => {
        events.push("settled");
        return authenticated;
      });
      const beforeCode = [...events];
      liveMode = mode;
      releaseCode({
        device_code: "device-secret",
        user_code: "WAIT-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 1,
      });
      await promptReady;
      t.mock.timers.tick(1000);
      await pollReady;
      const beforeToken = [...events];
      const memoBeforeToken = new Map(authMemo);
      releaseToken({
        kind: "success",
        accessToken: "auth-secret",
        tokenType: "bearer",
        scope: "repo",
      });
      const authenticated = await authentication;
      const repeated = await auth.onAuthRequired();

      // assert
      assert.deepStrictEqual(beforeCode, []);
      assert.deepStrictEqual(beforeToken, [prompt]);
      assert.deepStrictEqual(memoBeforeToken, new Map());
      assert.deepStrictEqual(events, [prompt, "settled"]);
      assert.deepStrictEqual(capture.entries, [prompt]);
      assert.deepStrictEqual(authenticated, {
        ok: true,
        cred: { username: "x-access-token", password: "auth-secret" },
      });
      assert.strictEqual(repeated, authenticated);
      assert.deepStrictEqual(authMemo, new Map([["github.com", authenticated]]));
      assert.deepStrictEqual(reads, ["invalid-mode", mode]);
      assert.deepStrictEqual(credentials.storedCredential("github.com"), {
        username: "x-access-token",
        password: "auth-secret",
      });
      capture.assertValid();
    });
  }

  test("selects the live mode for a delayed prompt and memoizes only the authentication", async () => {
    // arrange
    const capture = createJsonCapture();
    let mode = "json";
    const reads: string[] = [];
    const ctx = {
      get mode() {
        reads.push(mode);
        return mode;
      },
      get ui() {
        return capture.ui;
      },
    };
    const inventory = mock<PiInventory>({ exactParams: true, name: "inventory" });
    when(() => inventory.getAllTools())
      .thenReturn([])
      .times(3);
    when(() => inventory.getCommands())
      .thenReturn([])
      .once();
    const pi = {
      getAllTools: () => inventory.getAllTools(),
      getCommands: () => inventory.getCommands(),
      appendEntry: capture.entrySink.appendEntry,
    };
    const run = openNotificationRun(pi, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });
    const snapshot = run.softDeps;
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceCode = {
      device_code: "delayed-device-secret",
      user_code: "LATE-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
      access_token: "unexpected-provider-secret",
      password: "unexpected-password",
    };
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode,
      pollResponses: [
        { kind: "success", accessToken: "delayed-token", tokenType: "bearer", scope: "repo" },
      ],
    });
    const authMemo = new Map<string, AuthAttemptResult>();
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run,
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );
    const readsBeforePrompt = [...reads];

    // act
    mode = "rpc";
    const authentication = await auth.onAuthRequired();
    const repeatedAuthentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "device-flow-prompt",
          severity: "info",
          needsReload: false,
          verificationUri: "https://github.com/login/device",
          userCode: "LATE-1234",
        },
      },
    ]);
    assert.deepStrictEqual(authentication, {
      ok: true,
      cred: { username: "x-access-token", password: "delayed-token" },
    });
    assert.strictEqual(repeatedAuthentication, authentication);
    assert.deepStrictEqual(authMemo, new Map([["github.com", authentication]]));
    assert.deepStrictEqual(readsBeforePrompt, []);
    assert.deepStrictEqual(reads, ["rpc", "rpc"]);
    assert.strictEqual(run.entrySink, pi);
    assert.strictEqual(run.softDeps, snapshot);
    assert.deepStrictEqual(snapshot, {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
      workflowEngineLoaded: false,
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [{ clientId: "Ov23liNcyK08uGdU0mMl", scope: "repo" }],
      pollToken: [
        { clientId: "Ov23liNcyK08uGdU0mMl", deviceCode: "delayed-device-secret", intervalSec: 0 },
      ],
    });
    assert.deepStrictEqual(credentials.storedCredential("github.com"), {
      username: "x-access-token",
      password: "delayed-token",
    });
    capture.assertValid();
    verify(inventory);
  });

  for (const mode of ["json", "rpc"]) {
    test(`appends the host-bound device prompt in ${mode}`, async () => {
      // arrange
      const capture = createJsonCapture();
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };
      const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: {
          device_code: "device-secret",
          user_code: "HOST-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 0,
        },
        pollResponses: [
          { kind: "success", accessToken: "auth-secret", tokenType: "bearer", scope: "repo" },
        ],
      });
      const auth = expectDeviceFlow(
        buildAuthForHost({
          host: "github.com",
          credentialOps: credentials.credentialOps,
          ctx,
          run,
          deviceFlowHttp: deviceFlow.http,
        }),
      );

      // act
      const authentication = await auth.onAuthRequired();

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "device-flow-prompt",
            severity: "info",
            needsReload: false,
            verificationUri: "https://github.com/login/device",
            userCode: "HOST-1234",
          },
        },
      ]);
      assert.deepStrictEqual(authentication, {
        ok: true,
        cred: { username: "x-access-token", password: "auth-secret" },
      });
      capture.assertValid();
    });
  }

  test("forwards an unregistered host's stored credential through the real auth callbacks", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["git.example.invalid", { username: "user", password: "stored-credential" }]],
    });
    const auth = buildAuthForHost({
      host: "git.example.invalid",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });
    const callbacks = buildAuthCallbacks(auth);

    // act
    const credential = await callbacks.onAuth("https://git.example.invalid/owner/repo.git");

    // assert
    assert.deepStrictEqual(credential, { username: "user", password: "stored-credential" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "git.example.invalid" }],
      approve: [],
      reject: [],
    });
    verify(ctx);
  });

  test("cancels on an unregistered host whose helper is empty", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const auth = buildAuthForHost({
      host: "git.example.invalid",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });
    const callbacks = buildAuthCallbacks(auth);

    // act
    const credential = await callbacks.onAuth("https://git.example.invalid/owner/repo.git");

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "git.example.invalid" }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, ["[auth] onAuth: no stored credential for git.example.invalid"]);
    verify(ctx);
  });

  test("CR-01: keeps an unregistered host's rejected credential in the keychain", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const irreplaceable = { username: "user", password: "self-hosted-token" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["git.example.invalid", irreplaceable]],
    });
    const auth = buildAuthForHost({
      host: "git.example.invalid",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });
    const callbacks = buildAuthCallbacks(auth);

    // act
    await assert.rejects(
      callbacks.onAuthFailure("https://git.example.invalid/owner/repo.git", irreplaceable),
      (error: unknown) => {
        assert.ok(error instanceof StoredCredentialRejectedError);
        assert.strictEqual(error.host, "git.example.invalid");
        return true;
      },
    );

    // assert
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(credentials.storedCredential("git.example.invalid"), irreplaceable);
    assert.deepStrictEqual(logged, [
      "[auth] onAuthFailure: keeping the stored credential for git.example.invalid, nothing can re-mint it",
    ]);
    verify(ctx);
  });

  test("CR-01 / AUTH-07: evicts a GitHub credential the server rejected", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const rejected = { username: "x-access-token", password: "expired-token" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["github.com", rejected]],
    });
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });
    const callbacks = buildAuthCallbacks(auth);

    // act
    const cancellation = await callbacks.onAuthFailure(
      "https://github.com/owner/repo.git",
      rejected,
    );

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [],
      reject: [{ host: "github.com", credential: rejected }],
    });
    assert.strictEqual(credentials.storedCredential("github.com"), null);
    verify(ctx);
  });

  test("returns a stored-credential bundle for an unregistered host without notifying", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildAuthForHost({
      host: "git.example.invalid",
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "git.example.invalid",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("AAP-02 / D-13: returns a stored-credential bundle for a registry host to a load run without notifying", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const { commandState: _commandState, ...snapshot } = runWithNothingLoaded();

    // act
    const auth = buildAuthForHost({
      host: "github.com",
      credentialOps: credentials.credentialOps,
      ctx,
      run: { ...snapshot, origin: { kind: "load" } },
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      }),
    );

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "gitlab.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      }),
    );

    // act
    const credential = await auth.credentialOps.fill(auth.host);

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
      kind: "device-flow",
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
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(4);
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        deviceFlowHttp: deviceFlow.http,
      }),
    );

    // act
    const firstAuthentication = await auth.onAuthRequired();
    const secondAuthentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(firstAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret-1" },
    });
    assert.deepStrictEqual(secondAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret-2" },
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
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: false,
      reason: "Device Flow initialization failed: provider unavailable",
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
    when(() => ctx.mode)
      .thenReturn("tui")
      .twice();
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );

    // act
    const firstAuthentication = await auth.onAuthRequired();
    const secondAuthentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(firstAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "memo-secret" },
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
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(4);
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
    const githubAuth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );
    const gitlabAuth = expectDeviceFlow(
      buildAuthForHost({
        host: "gitlab.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );
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
      kind: "device-flow",
      onAuthRequired: githubAuth.onAuthRequired,
    });
    assert.deepStrictEqual(gitlabAuth, {
      credentialOps: credentials.credentialOps,
      host: "gitlab.com",
      kind: "device-flow",
      onAuthRequired: gitlabAuth.onAuthRequired,
    });
    assert.deepStrictEqual(githubAuthentication, {
      ok: true,
      cred: { username: "x-access-token", password: "github-secret" },
    });
    assert.deepStrictEqual(gitlabAuthentication, {
      ok: true,
      cred: { username: "oauth2", password: "gitlab-secret" },
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
    when(() => ctx.mode)
      .thenReturn("tui")
      .twice();
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
    const auth = expectDeviceFlow(
      buildAuthForHost({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
        authMemo,
      }),
    );

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: true,
      cred: { username: "x-access-token", password: "default-secret" },
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

describe("buildStoredCredentialAuth", () => {
  test("binds a stored-credential bundle to the host without any credential I/O", () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildStoredCredentialAuth("git.example.invalid", credentials.credentialOps);

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "git.example.invalid",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("D-3-04: cancels a github.com helper miss without starting a Device Flow", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const auth = buildStoredCredentialAuth("github.com", credentials.credentialOps);
    const callbacks = buildAuthCallbacks(auth);

    // act
    const credential = await callbacks.onAuth("https://github.com/owner/repo.git");

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "github.com",
    });
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "github.com" }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, ["[auth] onAuth: no stored credential for github.com"]);
  });
});

describe("buildGitHubAuth", () => {
  test("GHB-02: returns a stored-credential bundle for the override host", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const deviceFlowHttp = mock<DeviceFlowHttp>({ exactParams: true, name: "device HTTP" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const authMemo = new Map<string, AuthAttemptResult>();

    // act
    const auth = buildGitHubAuth({
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
      deviceFlowHttp,
      authMemo,
    });

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "mirror.example:8443",
    });
    assert.deepStrictEqual(authMemo, new Map());
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(deviceFlowHttp);
    verify(ctx);
  });

  for (const { base, host } of [
    { base: "https://github.com/mirror", host: "github.com" },
    { base: "https://gitlab.com/mirror", host: "gitlab.com" },
  ]) {
    test(`D-04: starts no Device Flow for a ${base} base`, (t) => {
      // arrange
      setGitHubBaseUrl(t, base);
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });

      // act
      const auth = buildGitHubAuth({
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      });

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host,
      });
      verify(ctx);
    });
  }

  test("returns the github.com device-flow bundle when unset", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = expectDeviceFlow(
      buildGitHubAuth({
        credentialOps: credentials.credentialOps,
        ctx,
        run: runWithNothingLoaded(),
      }),
    );

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  test("GHB-03: throws the typed error for an invalid override", (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act & assert
    assert.throws(
      () =>
        buildGitHubAuth({
          credentialOps: credentials.credentialOps,
          ctx,
          run: runWithNothingLoaded(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidGitHubBaseUrlError);
        assert.deepStrictEqual(
          { variable: error.variable, problem: error.problem },
          { variable: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", problem: "scheme" },
        );
        return true;
      },
    );
    verify(ctx);
  });
});

describe("buildCloneAuth", () => {
  test("forwards the canonical GitHub host and both optional collaborators", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .twice();
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
    const auth = expectDeviceFlow(
      buildCloneAuth("not a valid URL", "github", {
        ctx,
        run: runWithNothingLoaded(),
        credentialOps: credentials.credentialOps,
        deviceFlowHttp: deviceFlow.http,
        authMemo,
      }),
    );

    // act
    const authentication = await auth.onAuthRequired();

    // assert
    assert.deepStrictEqual(auth, {
      credentialOps: credentials.credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: auth.onAuthRequired,
    });
    assert.deepStrictEqual(authentication, {
      ok: true,
      cred: { username: "x-access-token", password: "clone-secret" },
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

  test("uses a stored credential while truly omitting optional collaborators", async () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [["gitlab.com", { username: "oauth2", password: "stored-secret" }]],
    });
    const authOptions = {
      credentialOps: credentials.credentialOps,
      ctx,
      run: runWithNothingLoaded(),
    };
    const auth = buildCloneAuth("https://gitlab.com/team/plugin.git", "url", authOptions);
    const callbacks = buildAuthCallbacks(auth);

    // act
    const credential = await callbacks.onAuth("https://gitlab.com/team/plugin.git");

    // assert
    assert.deepStrictEqual(credential, {
      username: "oauth2",
      password: "stored-secret",
    });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: "gitlab.com" }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(Object.keys(authOptions), ["credentialOps", "ctx", "run"]);
    verify(ctx);
  });

  test("preserves a Device Flow failure through the shared Git call ledger", async () => {
    // arrange
    const cloneUrl = "https://gitlab.com/team/plugin.git";
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const initializationError = new Error("provider unavailable");
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "unused-device-code",
        user_code: "UNUSED",
        verification_uri: "https://gitlab.com/-/profile/personal_access_tokens",
        expires_in: 900,
        interval: 0,
      },
      requestCodeError: initializationError,
    });
    const auth = expectDeviceFlow(
      buildCloneAuth(cloneUrl, "url", {
        ctx,
        run: runWithNothingLoaded(),
        credentialOps: credentials.credentialOps,
        deviceFlowHttp: deviceFlow.http,
      }),
    );
    const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [cloneUrl] });
    await git.gitOps.clone({ dir: "/memory/plugin", url: cloneUrl, auth });
    const recordedAuth = git.state.calls.clone[0]?.auth;
    assert.ok(recordedAuth?.kind === "device-flow");

    // act
    const authentication = await recordedAuth.onAuthRequired();

    // assert
    assert.strictEqual(recordedAuth, auth);
    assert.strictEqual(recordedAuth.onAuthRequired, auth.onAuthRequired);
    assert.deepStrictEqual(authentication, {
      ok: false,
      reason: "Device Flow initialization failed: provider unavailable",
    });
    assert.deepStrictEqual(deviceFlow.calls, {
      requestCode: [
        {
          clientId: "bb5b5605c21f02f3b41991e3d5f713488b4f0c5cf969de8f7d82f2811f99192d",
          scope: "read_repository",
        },
      ],
      pollToken: [],
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });

  for (const { clone, kind, cloneUrl } of [
    { clone: "GHB-02: a GitHub", kind: "github", cloneUrl: "https://github.com/acme/tools.git" },
    {
      clone: "D-09: a github.com git-subdir",
      kind: "git-subdir",
      cloneUrl: "https://github.com/acme/tools.git#plugin",
    },
  ] as const) {
    test(`${clone} clone under the override gets the override-host stored credential`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example:8443/git");
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const deviceFlowHttp = mock<DeviceFlowHttp>({ exactParams: true, name: "device HTTP" });
      const credentials = createCredentialOpsFake({ boundary: "memory" });

      // act
      const auth = buildCloneAuth(cloneUrl, kind, {
        ctx,
        run: runWithNothingLoaded(),
        credentialOps: credentials.credentialOps,
        deviceFlowHttp,
        authMemo: new Map(),
      });

      // assert
      assert.deepStrictEqual(auth, {
        kind: "stored-credential",
        credentialOps: credentials.credentialOps,
        host: "mirror.example:8443",
      });
      verify(deviceFlowHttp);
      verify(ctx);
    });
  }

  test("binds an unregistered port-bearing git-subdir host to its own bundle", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const auth = buildCloneAuth(
      "https://gitlab.com:8443/team/repository.git#plugin",
      "git-subdir",
      { ctx, run: runWithNothingLoaded(), credentialOps: credentials.credentialOps },
    );

    // assert
    assert.deepStrictEqual(auth, {
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: "gitlab.com:8443",
    });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(ctx);
  });
});
