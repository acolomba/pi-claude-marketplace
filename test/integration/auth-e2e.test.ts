// test/integration/auth-e2e.test.ts
//
// One case of a print-mode `marketplace add` of a private GitHub source, kept
// as fault injection (ITSCOPE-01): the add refuses before Device Flow starts
// (MODE-04), and when `fs.rm` cannot remove its staged clone, the refusal
// stays the primary cause and the cleanup failure joins its text. A scenario
// cannot make that removal fail. The case compares the whole notify log, so
// token material would show up as a difference (AUTH-09). The scenarios of
// the sign-in are in `features/marketplace/device-flow.feature`: the print
// refusal and the scope it leaves (MODE-04), AUTH-01, AUTH-02 and AUTH-08,
// and AUTH-07. They compare the result fields that their tables state, and
// the AUTH-01 and AUTH-07 scenarios also check that no field of any result
// holds the stored or the signed-in token (AUTH-09).

import assert from "node:assert/strict";
import fs, { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import http from "isomorphic-git/http/node";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { DeviceFlowUnavailableError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createDeviceFlowFake } from "../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { AddMarketplaceOptions } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
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
      hasUI: false,
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
