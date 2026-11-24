/**
 * test/integration/auth-e2e.test.ts -- auth integration gate.
 *
 * Exercises a real system-git clone against the https git host stand-in,
 * marketplace-add refusal cleanup, and the Device Flow composition a clone
 * runs when no credential helper answers (D-SG-14):
 *
 *   clone (platform/git.ts) -> runRemote -> git's own credential helpers
 *     -> on `no-credential` under a `device-flow` bundle: onAuthRequired
 *       -> initiateDeviceFlow (domain/github-auth.ts)
 *         -> CredentialOps (test/platform/credential-ops-fake.ts)
 *         -> onDeviceCode
 *           -> notifyDeviceFlowPrompt (shared/notification-dispatch.ts)
 *     -> one retry through a one-shot credential helper
 *
 * Tests:
 *   AUTH-01 -- a missing credential runs Device Flow once; the token is stored
 *              via approve and the clone succeeds on its single retry
 *   AUTH-02 / AUTH-08 -- a credential git's helper answers clones with no
 *              Device Flow
 *   AUTH-07 -- a refused credential fails as `authentication required` with no
 *              second sign-in (D-SG-14: git's own helpers own the eviction)
 *
 * Every request goes to the loopback stand-in, as in the cucumber Device Flow
 * profile: with no GitHub base override, git asks for github.com through a
 * CONNECT proxy that tunnels only `github.com:443` to the stand-in, and trusts
 * only the stand-in's certificate, which names github.com. Each case checks
 * the proxy's log, so a request to any other host would show (SG-TRN-07).
 *
 * AUTH-09: each test compares the whole notify log, so token material would
 * show up as a difference.
 */

import assert from "node:assert/strict";
import fs, { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { clone, resolveRef } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  DeviceFlowUnavailableError,
  GitCommandError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { classifyGitFailure } from "../../extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts";
import { notifyDeviceFlowPrompt } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { startGitHubConnectProxy } from "../../features/lib/github-device-flow/connect-proxy.ts";
import {
  GITHUB_REDIRECT_LOG,
  readRedirectLog,
} from "../../features/lib/github-device-flow/extension.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { createDeviceFlowFake } from "../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
} from "../platform/git-test-repository.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { hermeticGitProcess, systemGitOps } from "../platform/system-git-ops.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type {
  DeviceCodeResponse,
  InitiateDeviceFlowOpts,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import type { AddMarketplaceOptions } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import type { GitProcess } from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { RedirectLogLine } from "../../features/lib/github-device-flow/extension.ts";
import type { CredentialOpsFake } from "../platform/credential-ops-fake.ts";

const TOKEN = "gho_test_token_e2e";
const STORED_TOKEN = "stored_token_e2e";

/** The request git sends first to clone the stand-in's `owner/private` repository. */
const PRIVATE_INFO_REFS = {
  method: "GET",
  path: "/owner/private.git/info/refs?service=git-upload-pack",
  status: 401,
} as const;

/** The proxy's log line for one tunnel a git process opened to github.com. */
const GITHUB_TUNNEL = {
  decision: "routed",
  method: "CONNECT",
  url: "github.com:443",
  target: "git host",
} as const;

/**
 * The https git host serving `owner/private`, armed to answer 401 to every
 * request without the user `x-access-token` and `password`, the CONNECT proxy
 * in front of it, and a git process that reaches github.com through the proxy
 * and trusts only the host's certificate, with `variables` over its
 * environment. The GitHub base override is cleared for the case.
 */
async function privateStandIn(
  t: TestContext,
  password: string,
  variables: NodeJS.ProcessEnv = {},
): Promise<{
  readonly host: HttpsGitHost;
  readonly oid: string;
  readonly gitProcess: GitProcess;
  readonly tunnels: () => Promise<RedirectLogLine[]>;
}> {
  const root = await realpath(await createGitTestDirectory(t, { boundary: "local" }));
  const host = await HttpsGitHost.start(join(root, "host"));
  t.after(() => host.close());
  const served = await createGitTestRepository(t, { boundary: "local" });
  await served.cloneBare(host.repositoryPath("private", "owner"));
  await host.arm("private", { kind: "credential", user: "x-access-token", password }, "owner");
  const harness = join(root, "harness");
  const proxy = await startGitHubConnectProxy({
    gitHost: host.address,
    logPath: join(harness, GITHUB_REDIRECT_LOG),
  });
  t.after(() => proxy.close());
  setGitHubBaseUrl(t, undefined);
  return {
    host,
    oid: served.initialOid,
    gitProcess: await hermeticGitProcess(t, {
      GIT_SSL_CAINFO: host.certificatePath,
      https_proxy: `http://${proxy.address}`,
      ...variables,
    }),
    tunnels: () => readRedirectLog(harness),
  };
}

/** A user credential helper that answers every `get` with `password`. */
function helperAnswering(password: string): NodeJS.ProcessEnv {
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: `!f() { echo username=x-access-token; echo password=${password}; }; f`,
  };
}

async function createPrintAdd(t: TestContext) {
  const environment = await createHermeticEnvironment(t, "print-add-");
  const standIn = await privateStandIn(t, TOKEN);
  const window = standIn.host.mark();
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
  const stagingRoot = join(locations.extensionRoot, "sources-staging");
  const stagingDirs: string[] = [];
  const gitOps = systemGitOps(standIn.gitProcess);
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
    gitOps: {
      ...gitOps,
      clone: (cloneOptions) => {
        stagingDirs.push(cloneOptions.dir);
        return gitOps.clone(cloneOptions);
      },
    },
  };
  return {
    options,
    locations,
    priorState,
    priorBytes,
    credentials,
    deviceFlow,
    notifications,
    requests: () => standIn.host.requestsSince(window).requests,
    tunnels: standIn.tunnels,
    stagingRoot,
    stagingDirs,
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
  assert.deepStrictEqual(fixture.requests(), [PRIVATE_INFO_REFS]);
  assert.deepStrictEqual(await fixture.tunnels(), [GITHUB_TUNNEL]);
  assert.strictEqual(fixture.stagingDirs.length, 1);
  assert.deepStrictEqual(fixture.credentials.calls, { fill: [], approve: [], reject: [] });
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
  // D-PL5-16: an unclassified refusal reads `unreadable`, not `unparseable`.
  assert.deepStrictEqual(outcome, {
    status: "failed",
    reason: "unreadable",
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
    if (String(args[0]) === fixture.stagingDirs[0]) {
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
    `Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi. (additionally: failed to clean up marketplace clone staging at ${fixture.stagingDirs[0]}: cleanup denied)`,
  );
  await assertUncommittedPrintAdd(fixture);
});

/** A path inside a fresh directory, where git makes the clone's own directory. */
async function cloneTarget(t: TestContext): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "auth-clone-"));
  t.after(async () => rm(parent, { recursive: true, force: true }));
  return join(parent, "clone");
}

test("real Git clone preserves a device-flow refusal from its sign-in", async (t) => {
  // arrange
  const standIn = await privateStandIn(t, TOKEN);
  const window = standIn.host.mark();
  const dir = await cloneTarget(t);
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const refusal = new DeviceFlowUnavailableError();

  // act & assert
  await assert.rejects(
    clone(
      {
        dir,
        url: "https://github.com/owner/private.git",
        auth: {
          kind: "device-flow",
          host: "github.com",
          credentialOps: credentials.credentialOps,
          onAuthRequired: () => Promise.reject(refusal),
        },
      },
      standIn.gitProcess,
    ),
    (error: unknown) => {
      assert.strictEqual(error, refusal);
      assert.strictEqual(
        refusal.message,
        "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi.",
      );
      return true;
    },
  );
  assert.deepStrictEqual(standIn.host.requestsSince(window).requests, [PRIVATE_INFO_REFS]);
  assert.deepStrictEqual(await standIn.tunnels(), [GITHUB_TUNNEL]);
  assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
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

/** A Device Flow bundle for github.com whose sign-in runs `initiateDeviceFlow` on the fakes. */
function deviceFlowAuth(
  credentials: CredentialOpsFake,
  deviceFlow: ReturnType<typeof createDeviceFlowFake>,
  onDeviceCode: InitiateDeviceFlowOpts["onDeviceCode"],
) {
  return {
    kind: "device-flow",
    host: "github.com",
    credentialOps: credentials.credentialOps,
    onAuthRequired: () =>
      initiateDeviceFlow({
        host: "github.com",
        credentialOps: credentials.credentialOps,
        onDeviceCode,
        http: deviceFlow.http,
      }),
  } as const;
}

test("AUTH-01 clone E2E: a missing credential runs Device Flow once, the token is approved, and the retry clones", async (t) => {
  // arrange
  const standIn = await privateStandIn(t, TOKEN);
  const window = standIn.host.mark();
  const dir = await cloneTarget(t);
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("ABCD-1234"),
    pollResponses: [successfulPoll(TOKEN)],
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  // act
  await clone(
    {
      dir,
      url: "https://github.com/owner/private.git",
      auth: deviceFlowAuth(credentials, deviceFlow, onDeviceCode),
    },
    standIn.gitProcess,
  );

  // assert
  assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }, standIn.gitProcess), standIn.oid);
  assert.deepStrictEqual(notifyCalls, [
    { message: "Open https://github.com/login/device and enter: ABCD-1234", severity: "info" },
  ]);
  assert.deepStrictEqual(credentials.calls, {
    fill: [],
    approve: [{ host: "github.com", credential: { username: "x-access-token", password: TOKEN } }],
    reject: [],
  });
  assert.strictEqual(deviceFlow.calls.pollToken.length, 1);
  assert.deepStrictEqual(
    standIn.host.requestsSince(window).requests.map(({ method, status }) => [method, status]),
    [
      ["GET", 401],
      ["GET", 401],
      ["GET", 200],
      ["POST", 200],
      ["POST", 200],
    ],
  );
  assert.deepStrictEqual(await standIn.tunnels(), [GITHUB_TUNNEL, GITHUB_TUNNEL]);
});

test("AUTH-02 / AUTH-08 silent reuse: a credential git's helper answers clones with no Device Flow", async (t) => {
  // arrange
  const standIn = await privateStandIn(t, STORED_TOKEN, helperAnswering(STORED_TOKEN));
  const dir = await cloneTarget(t);
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("ABCD-1234"),
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  // act
  await clone(
    {
      dir,
      url: "https://github.com/owner/private.git",
      auth: deviceFlowAuth(credentials, deviceFlow, onDeviceCode),
    },
    standIn.gitProcess,
  );

  // assert
  assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }, standIn.gitProcess), standIn.oid);
  assert.deepStrictEqual(notifyCalls, []);
  assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
  assert.deepStrictEqual(await standIn.tunnels(), [GITHUB_TUNNEL]);
});

test("AUTH-07 refused credential: the clone fails as authentication required with no second sign-in", async (t) => {
  // arrange
  const standIn = await privateStandIn(t, TOKEN, helperAnswering("stale_token"));
  const dir = await cloneTarget(t);
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const deviceFlow = createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: deviceCodeResponse("WXYZ-5678"),
    pollResponses: [successfulPoll("gho_fresh_token_e2e")],
  });
  const { notifyCalls, onDeviceCode } = makeNotifyCapture();

  // act
  const cloning = clone(
    {
      dir,
      url: "https://github.com/owner/private.git",
      auth: deviceFlowAuth(credentials, deviceFlow, onDeviceCode),
    },
    standIn.gitProcess,
  );

  // assert
  await assert.rejects(cloning, (error: unknown) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual(
      {
        failure: error.failure,
        classified: classifyGitFailure(error, { notFound: "source missing" }),
      },
      {
        failure: { kind: "https-auth", detail: "rejected" },
        classified: { reason: "authentication required" },
      },
    );
    return true;
  });
  assert.deepStrictEqual(notifyCalls, []);
  assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
  assert.deepStrictEqual(await standIn.tunnels(), [GITHUB_TUNNEL]);
});
