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
//
// With no base override the add also runs the ssh probe of github.com
// (SG-SSH-02). The git process and the probe find the ssh stand-in first on
// PATH, which denies github.com as a user with no GitHub key is denied, and
// the case checks the stand-in's launch log, so no ssh launch reaches a real
// host (T-04-52). The probe says ssh is not configured, so https goes first,
// and the print refusal stops the clone with no ssh attempt (MODE-04).

import assert from "node:assert/strict";
import fs, { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { probeGitHubSsh } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { DeviceFlowUnavailableError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { startGitHubConnectProxy } from "../../features/lib/github-device-flow/connect-proxy.ts";
import {
  GITHUB_REDIRECT_LOG,
  readRedirectLog,
} from "../../features/lib/github-device-flow/extension.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";
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
import type { SystemGitProcess } from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
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

/** The launch of Claude Code's ssh probe of github.com. */
const GITHUB_PROBE_ARGV = [
  "-T",
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=2",
  "-o",
  "StrictHostKeyChecking=yes",
  "git@github.com",
];

/**
 * The https git host serving `owner/private`, armed to answer 401 to every
 * request without the user `x-access-token` and `password`, the CONNECT proxy
 * in front of it, the ssh stand-in that denies github.com, and a git process
 * that finds the stand-in first on PATH, reaches github.com through the proxy,
 * and trusts only the host's certificate, with `variables` over its
 * environment. The GitHub base override is cleared for the case.
 */
async function privateStandIn(
  t: TestContext,
  password: string,
  variables: NodeJS.ProcessEnv = {},
): Promise<{
  readonly host: HttpsGitHost;
  readonly sshHost: SshGitHost;
  readonly oid: string;
  readonly gitProcess: SystemGitProcess;
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
  const sshRoot = await mkdtemp(join(tmpdir(), "auth-e2e-ssh-"));
  const sshHost = await SshGitHost.start(join(sshRoot, "ssh-host"), {
    repositoriesRoot: join(sshRoot, "repositories"),
  });
  // close() reads the launch log under the root, so one hook closes, then removes.
  t.after(async () => {
    try {
      await sshHost.close();
    } finally {
      await rm(sshRoot, { recursive: true, force: true });
    }
  });
  await sshHost.register("github.com", { probe: { kind: "denied" } });
  setGitHubBaseUrl(t, undefined);
  return {
    host,
    sshHost,
    oid: served.initialOid,
    gitProcess: await hermeticGitProcess(t, {
      PATH: sshHost.searchPath(),
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
  const sshWindow = await standIn.sshHost.mark();
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
    gitHubSsh: { probe: () => probeGitHubSsh(standIn.gitProcess) },
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
    sshLaunches: async () =>
      (await standIn.sshHost.launchesSince(sshWindow)).map((launch) => launch.argv),
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
  // T-04-52: the add's one probe reached the stand-in, and the print refusal
  // stopped the clone with no ssh attempt (MODE-04).
  assert.deepStrictEqual(await fixture.sshLaunches(), [GITHUB_PROBE_ARGV]);
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
