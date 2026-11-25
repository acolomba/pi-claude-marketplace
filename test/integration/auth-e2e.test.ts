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
//
// The add clones through system git against the https git host stand-in:
// with no GitHub base override, git asks for github.com through a CONNECT
// proxy that tunnels only `github.com:443` to the stand-in, and trusts only
// the stand-in's certificate, which names github.com. The case checks the
// proxy's log, so a request to any other host would show (SG-TRN-07).

import assert from "node:assert/strict";
import fs, { readFile, readdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { DeviceFlowUnavailableError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
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

import type { AddMarketplaceOptions } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import type { GitProcess } from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { RedirectLogLine } from "../../features/lib/github-device-flow/extension.ts";

const TOKEN = "gho_test_token_e2e";

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
