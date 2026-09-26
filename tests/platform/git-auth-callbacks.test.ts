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

  test("rejects an interactive credential and cancels the operation", async () => {
    // arrange
    const credential = { username: "x-access-token", password: "token" };
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
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
