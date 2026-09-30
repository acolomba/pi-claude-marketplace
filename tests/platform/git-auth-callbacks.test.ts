import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildAuthCallbacks } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";

import { createCredentialOpsFake } from "./credential-ops-fake.ts";
import { captureDebugLog } from "./debug-log-capture.ts";

import type {
  AuthAttemptResult,
  OnAuthRequiredFn,
} from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";

const HOST = "git.example.invalid";
const REMOTE_URL = `https://${HOST}/owner/repo.git`;
const OTHER_HOST = "other.example.invalid";
const OTHER_REMOTE_URL = `https://${OTHER_HOST}/owner/repo.git`;

describe("buildAuthCallbacks", () => {
  test("returns a stored credential without requesting interactive auth", async () => {
    // arrange
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a credential hit");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  test("returns the interactive credential after a credential miss", async () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = async () => {
      await Promise.resolve();
      return {
        ok: true,
        cred: { username: "x-access-token", password: "token" },
        authAttempted: true,
      } satisfies AuthAttemptResult;
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { username: "x-access-token", password: "token" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  test("returns a stored credential for a stored-credential bundle", async () => {
    // arrange
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });
    const callbacks = buildAuthCallbacks({
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: HOST,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  test("cancels and logs a credential miss for a stored-credential bundle", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const callbacks = buildAuthCallbacks({
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: HOST,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, [`[auth] onAuth: no stored credential for ${HOST}`]);
  });

  for (const reason of [
    "User cancelled authorization. Run the command again to retry.",
    "Device code expired before authorization. Run the command again to restart.",
    "Device Flow failed: invalid_client -- The client_id is invalid.",
  ]) {
    test(`cancels and logs the interactive-auth failure '${reason}'`, async (t) => {
      // arrange
      const logged = captureDebugLog(t);
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const onAuthRequired: OnAuthRequiredFn = async () => {
        await Promise.resolve();
        return { ok: false, reason, authAttempted: true } satisfies AuthAttemptResult;
      };

      const callbacks = buildAuthCallbacks({
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      });

      // act
      const credential = await callbacks.onAuth(REMOTE_URL);

      // assert
      assert.deepStrictEqual(credential, { cancel: true });
      assert.deepStrictEqual(credentials.calls, {
        fill: [{ host: HOST }],
        approve: [],
        reject: [],
      });
      assert.deepStrictEqual(logged, [`[auth] onAuth: Device Flow failed for ${HOST}: ${reason}`]);
    });
  }

  test("cancels when credential lookup throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      fillError: new Error("credential lookup failed"),
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden after a credential error");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, [`[auth] onAuth threw for ${HOST}: credential lookup failed`]);
  });

  test("cancels and logs when interactive auth throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = async () => {
      await Promise.resolve();
      throw new Error("network down");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, [`[auth] onAuth threw for ${HOST}: network down`]);
  });

  test("cancels for a url on another host without querying the helper", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a host mismatch");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(OTHER_REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(logged, [
      `[auth] onAuth: url https://${OTHER_HOST} does not match the bound https host ${HOST}`,
    ]);
  });

  test("WR-01: cancels an http url on the bound host without querying the helper", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a cleartext url");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(`http://${HOST}/owner/repo.git`);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(logged, [
      `[auth] onAuth: url http://${HOST} does not match the bound https host ${HOST}`,
    ]);
  });

  test("cancels a host mismatch before any interactive auth can start", async () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a host mismatch");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(OTHER_REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("treats a port-bearing bound host as different from the portless url host", async () => {
    // arrange
    const boundHost = `${HOST}:8443`;
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[boundHost, { username: "stored", password: "secret" }]],
    });

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: boundHost,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden on a host mismatch");
      },
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("treats a port-bearing url host as different from the portless bound host", async () => {
    // arrange
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden on a host mismatch");
      },
    });

    // act
    const credential = await callbacks.onAuth(`https://${HOST}:8443/owner/repo.git`);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("matches a url carrying the default https port against a portless bound host", async () => {
    // arrange
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden on a credential hit");
      },
    });

    // act
    const credential = await callbacks.onAuth(`https://${HOST}:443/owner/repo.git`);

    // assert
    assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  test("cancels and logs when the url cannot be parsed", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden on an unparseable url");
      },
    });

    // act
    const credential = await callbacks.onAuth("not a url");

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(logged, [`[auth] onAuth threw for ${HOST}: Invalid URL`]);
  });

  test("rejects an interactive credential and cancels the operation", async () => {
    // arrange
    const credential = { username: "x-access-token", password: "token" };
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: async () => {
        await Promise.resolve();
        return { ok: true, cred: credential, authAttempted: true };
      },
    });
    await callbacks.onAuth(REMOTE_URL);

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
  });

  test("rejects a stale credential and cancels without prior auth", async () => {
    // arrange
    const credential = { username: "stale", password: "expired" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, credential]],
    });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden from onAuthFailure");
      },
    });

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
    assert.strictEqual(credentials.storedCredential(HOST), null);
  });

  test("keeps a rejected credential and cancels for a stored-credential bundle", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credential = { username: "user", password: "irreplaceable" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, credential]],
    });
    const callbacks = buildAuthCallbacks({
      kind: "stored-credential",
      credentialOps: credentials.credentialOps,
      host: HOST,
    });

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(credentials.storedCredential(HOST), credential);
    assert.deepStrictEqual(logged, [
      `[auth] onAuthFailure: keeping the stored credential for ${HOST}, nothing can re-mint it`,
    ]);
  });

  test("cancels and logs when stale-credential rejection throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credential = { username: "stale", password: "expired" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      rejectError: new Error("credential rejection failed"),
    });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      kind: "device-flow",
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden from onAuthFailure");
      },
    });

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
    assert.deepStrictEqual(logged, [
      `[auth] onAuthFailure: reject() threw for ${HOST}: credential rejection failed`,
    ]);
  });
});
