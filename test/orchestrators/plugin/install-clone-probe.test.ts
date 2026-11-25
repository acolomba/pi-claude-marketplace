import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { createPluginTransportContext } from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import {
  probeInstallClone,
  type InstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  CloneTransport,
  PluginTransportContext,
} from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const SHA = "1111111111111111111111111111111111111111";

for (const mode of ["json", "rpc"]) {
  for (const pin of [undefined, SHA]) {
    test(`delivers clone authentication through the parent run in ${mode} with pin ${String(pin)}`, async (t) => {
      // arrange
      const { locations, root } = await freshLocations(t);
      const capture = createJsonCapture();
      const ctx = {
        mode,
        hasUI: mode === "tui" || mode === "rpc",
        get ui() {
          return capture.ui;
        },
      };
      const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: {
          device_code: "clone-secret",
          user_code: "CLONE-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 0,
        },
        pollResponses: [
          { kind: "success", accessToken: "token-secret", tokenType: "bearer", scope: "repo" },
        ],
      });
      const seam: InstallCloneCacheSeam = {
        resolvePluginPin: () =>
          Promise.resolve({ cloneUrl: "https://github.com/owner/repo", pin: SHA }),
        async materializePluginClone(options) {
          const auth = options.resolveAuth();
          assert.strictEqual(auth.kind, "device-flow");
          assert.ok(auth.kind === "device-flow");
          await auth.onAuthRequired();
          return root;
        },
        async materializeOrRefreshPluginMirror(options) {
          assert.ok(options.auth?.kind === "device-flow");
          await options.auth.onAuthRequired();
          return { pluginRoot: root, resolvedSha: SHA };
        },
        materializePluginCommitCopy: () => Promise.resolve(root),
      };

      // act
      const outcome = await probeInstallClone({
        subject: "plugin@market",
        source: {
          kind: "github",
          raw: "owner/repo",
          owner: "owner",
          repo: "repo",
          ...(pin !== undefined && { sha: pin }),
        },
        locations,
        seam,
        auth: { ...auth(), ctx, run, deviceFlowHttp: deviceFlow.http },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        result: { kind: "materialized", pluginRoot: root, resolvedSha: SHA },
        resolvedSha: SHA,
      });
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
            userCode: "CLONE-1234",
          },
        },
      ]);
      capture.assertValid();
    });
  }
}

async function freshLocations(
  testContext: TestContext,
): Promise<{ readonly locations: ScopedLocations; readonly root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "install-clone-probe-"));
  testContext.after(() => rm(root, { recursive: true, force: true }));
  return { locations: locationsFor("project", root), root };
}

/** D-SG-18: the subject and the first attempt and note of a clone transport's plan. */
async function plannedTransport(transport: CloneTransport | undefined): Promise<unknown> {
  if (transport === undefined) {
    return undefined;
  }

  const plan = await transport.plan();
  return { subject: transport.subject, first: plan.first, note: plan.note };
}

function auth(): Parameters<typeof probeInstallClone>[0]["auth"] {
  const ctx: NotificationContext = { mode: "tui", hasUI: true, ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, run: runWithNothingLoaded(), credentialOps };
}

test("uses the production seam for a warm pinned clone", async (testContext) => {
  // arrange
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/warm-plugin";
  const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA));
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "url",
    raw: cloneUrl,
    url: cloneUrl,
    sha: SHA,
  };

  // act
  const outcome = await probeInstallClone({
    source,
    locations,
    auth: auth(),
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
});

test("returns a materialized pinned cache result and its resolved sha", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const cloneRoot = path.join(root, "pinned-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "github",
    raw: "owner/repo",
    owner: "owner",
    repo: "repo",
    sha: SHA,
  };
  const calls: string[] = [];
  const cloneCandidates = new Set<string>();
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      calls.push("resolve");
      return Promise.resolve({ cloneUrl: "https://github.com/owner/repo", pin: SHA });
    },
    materializePluginClone(options) {
      calls.push("materialize");
      assert.ok(options.resolveAuth() !== undefined);
      options.onCloneCreated?.("created-clone");
      return Promise.resolve(cloneRoot);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
    materializePluginCommitCopy() {
      return Promise.reject(new Error("unexpected commit copy"));
    },
  };

  // act
  const outcome = await probeInstallClone({
    subject: "plugin@market",
    source,
    seam,
    locations,
    auth: auth(),
    cloneCandidates,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
  assert.deepStrictEqual(calls, ["resolve", "materialize"]);
  assert.deepStrictEqual(cloneCandidates, new Set(["created-clone"]));
});

test("NFR-5: a pinned GitHub source the seam finds warm never reads an invalid base", async (testContext) => {
  // arrange
  await createHermeticEnvironment(testContext, "install-clone-probe-warm-home-");
  const { locations, root } = await freshLocations(testContext);
  setGitHubBaseUrl(testContext, "http://mirror.example");
  const cloneRoot = path.join(root, "warm-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "github",
    raw: "owner/repo",
    owner: "owner",
    repo: "repo",
    sha: SHA,
  };
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.resolve({ cloneUrl: "https://github.com/owner/repo", pin: SHA });
    },
    materializePluginClone() {
      return Promise.resolve(cloneRoot);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
    materializePluginCommitCopy() {
      return Promise.reject(new Error("unexpected commit copy"));
    },
  };

  // act
  const outcome = await probeInstallClone({
    source,
    seam,
    locations,
    auth: auth(),
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
});

// D-2-01 / D-2-03: both seam calls take the identity `cloneUrl` AND the wire
// `networkUrl`. These two cases are the only ones here whose fixture makes the
// pair differ, so they are what holds the `networkCloneUrl(source)` argument in
// place at each call.
test("sends the pinned clone the identity url and the typed wire url", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/pinned-plugin";
  const rawUrl = "https://example.com/pinned-plugin.git";
  const cloneRoot = path.join(root, "pinned-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = { kind: "url", raw: rawUrl, url: cloneUrl, sha: SHA };
  const calls: unknown[] = [];
  const pluginAuth = auth();
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.resolve({ cloneUrl, pin: SHA });
    },
    // The bundle carries closures, so the recorded call keeps only the two
    // comparable fields: the bound host and the injected credential ops.
    async materializePluginClone({
      resolveAuth,
      onCloneCreated: _onCloneCreated,
      transport,
      ...cloneOptions
    }) {
      const bundle = resolveAuth();
      calls.push({
        ...cloneOptions,
        auth: { credentialOps: bundle.credentialOps, host: bundle.host },
        transport: await plannedTransport(transport),
      });
      return cloneRoot;
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
    materializePluginCommitCopy() {
      return Promise.reject(new Error("unexpected commit copy"));
    },
  };

  // act
  const outcome = await probeInstallClone({
    source,
    seam,
    locations,
    auth: pluginAuth,
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
  assert.deepStrictEqual(calls, [
    {
      auth: { credentialOps: pluginAuth.credentialOps, host: "example.com" },
      cloneUrl,
      networkUrl: rawUrl,
      locations,
      pin: SHA,
      transport: {
        subject: "plugin@market",
        first: { transport: "https", url: rawUrl },
        note: undefined,
      },
    },
  ]);
});

test("sends the unpinned mirror the identity url and the typed wire url", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/mirror-plugin";
  const rawUrl = "https://example.com/mirror-plugin.git";
  const mirrorRoot = path.join(root, "mirror-clone");
  const copyRoot = path.join(root, "commit-copy");
  await mkdir(copyRoot, { recursive: true });
  const source: GitBackedSource = { kind: "url", raw: rawUrl, url: cloneUrl, ref: "main" };
  const calls: unknown[] = [];
  const pluginAuth = auth();
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.reject(new Error("unexpected pin resolution"));
    },
    materializePluginClone() {
      return Promise.reject(new Error("unexpected pinned materialization"));
    },
    async materializeOrRefreshPluginMirror({
      auth: bundle,
      onCloneCreated: _onCloneCreated,
      transport,
      ...mirrorOptions
    }) {
      calls.push({
        ...mirrorOptions,
        auth: { credentialOps: bundle?.credentialOps, host: bundle?.host },
        transport: await plannedTransport(transport),
      });
      return { pluginRoot: mirrorRoot, resolvedSha: SHA };
    },
    async materializePluginCommitCopy({
      resolveAuth,
      onCloneCreated: _onCloneCreated,
      transport,
      ...copyOptions
    }) {
      const bundle = resolveAuth();
      calls.push({
        ...copyOptions,
        auth: { credentialOps: bundle.credentialOps, host: bundle.host },
        transport: await plannedTransport(transport),
      });
      return copyRoot;
    },
  };
  const planned = { subject: "plugin@market", first: { transport: "https", url: rawUrl } };

  // act
  const outcome = await probeInstallClone({
    source,
    seam,
    locations,
    auth: pluginAuth,
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: copyRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
  assert.deepStrictEqual(calls, [
    {
      auth: { credentialOps: pluginAuth.credentialOps, host: "example.com" },
      cloneUrl,
      networkUrl: rawUrl,
      locations,
      ref: "main",
      transport: { ...planned, note: undefined },
    },
    {
      auth: { credentialOps: pluginAuth.credentialOps, host: "example.com" },
      cloneUrl,
      networkUrl: rawUrl,
      locations,
      sha: SHA,
      transport: { ...planned, note: undefined },
    },
  ]);
});

test("returns a refreshed unpinned mirror result with ref and auth", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const mirrorRoot = path.join(root, "mirror-clone");
  await mkdir(mirrorRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "github",
    raw: "owner/repo#main",
    owner: "owner",
    repo: "repo",
    ref: "main",
  };
  const authMemo = new Map<string, AuthAttemptResult>();
  const deviceFlowHttp: DeviceFlowHttp = {
    requestCode() {
      return Promise.reject(new Error("device flow must stay lazy"));
    },
    pollToken() {
      return Promise.reject(new Error("device flow must stay lazy"));
    },
  };
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.reject(new Error("unexpected pin resolution"));
    },
    materializePluginClone() {
      return Promise.reject(new Error("unexpected pinned materialization"));
    },
    materializeOrRefreshPluginMirror(options) {
      assert.strictEqual(options.cloneUrl, "https://github.com/owner/repo");
      assert.strictEqual(options.ref, "main");
      assert.ok(options.auth !== undefined);
      return Promise.resolve({ pluginRoot: mirrorRoot, resolvedSha: SHA });
    },
    materializePluginCommitCopy: () => Promise.resolve(mirrorRoot),
  };

  // act
  const outcome = await probeInstallClone({
    subject: "plugin@market",
    source,
    seam,
    locations,
    auth: { ...auth(), deviceFlowHttp, authMemo },
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: mirrorRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
});

test("returns a missing-subdir result without exposing the resolved sha", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const cloneRoot = path.join(root, "missing-subdir-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono#main:plugins/missing",
    url: "https://example.com/mono",
    path: "plugins/missing",
    sha: SHA,
  };
  const pluginAuth = auth();
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.resolve({ cloneUrl: "https://example.com/mono", pin: SHA, ref: "main" });
    },
    materializePluginClone(options) {
      assert.strictEqual(options.ref, "main");
      assert.deepStrictEqual(
        { credentialOps: options.resolveAuth().credentialOps, host: options.resolveAuth().host },
        { credentialOps: pluginAuth.credentialOps, host: "example.com" },
      );
      return Promise.resolve(cloneRoot);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
    materializePluginCommitCopy() {
      return Promise.reject(new Error("unexpected commit copy"));
    },
  };

  // act
  const outcome = await probeInstallClone({
    source,
    seam,
    locations,
    auth: pluginAuth,
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: {
      kind: "missing-subdir",
      detail: 'git-subdir path "plugins/missing" does not exist in the plugin clone',
    },
    resolvedSha: undefined,
  });
});

test("returns an escaping-subdir result without exposing the mirror sha", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const mirrorRoot = path.join(root, "escaping-subdir-clone");
  await mkdir(mirrorRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono#main:../escape",
    url: "https://example.com/mono",
    path: "../escape",
  };
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.reject(new Error("unexpected pin resolution"));
    },
    materializePluginClone() {
      return Promise.reject(new Error("unexpected pinned materialization"));
    },
    materializeOrRefreshPluginMirror() {
      return Promise.resolve({ pluginRoot: mirrorRoot, resolvedSha: SHA });
    },
    materializePluginCommitCopy: () => Promise.resolve(mirrorRoot),
  };

  // act
  const outcome = await probeInstallClone({
    source,
    seam,
    locations,
    auth: auth(),
    subject: "plugin@market",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    result: {
      kind: "escapes",
      detail: `git-subdir path "../escape" escapes ${mirrorRoot} (resolved: ${path.resolve(mirrorRoot, "../escape")}).`,
    },
    resolvedSha: undefined,
  });
});

test("propagates a pinned clone failure unchanged", async (testContext) => {
  // arrange
  const { locations } = await freshLocations(testContext);
  const cloneFailure = new Error("clone failed after cleanup");
  const source: GitBackedSource = {
    kind: "url",
    raw: "https://example.com/plugin",
    url: "https://example.com/plugin",
    sha: SHA,
  };
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.resolve({ cloneUrl: "https://example.com/plugin", pin: SHA });
    },
    materializePluginClone() {
      return Promise.reject(cloneFailure);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
    materializePluginCommitCopy() {
      return Promise.reject(new Error("unexpected commit copy"));
    },
  };

  // act & assert
  await assert.rejects(
    probeInstallClone({ source, seam, locations, auth: auth(), subject: "plugin@market" }),
    (error: unknown) => error === cloneFailure,
  );
});

const OWNER_REPO_SOURCE = {
  kind: "github",
  raw: "acme/ghp",
  owner: "acme",
  repo: "ghp",
} satisfies GitBackedSource;

/** A seam whose unpinned mirror step keeps the transport it is given. */
function transportKeepingSeam(root: string): {
  readonly seam: InstallCloneCacheSeam;
  readonly transports: (CloneTransport | undefined)[];
} {
  const transports: (CloneTransport | undefined)[] = [];
  return {
    transports,
    seam: {
      resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
      materializePluginClone: () => Promise.reject(new Error("unexpected pinned clone")),
      materializeOrRefreshPluginMirror({ transport }) {
        transports.push(transport);
        return Promise.resolve({ pluginRoot: root, resolvedSha: SHA });
      },
      materializePluginCommitCopy: () => Promise.resolve(root),
    },
  };
}

/** A transport context whose user override answers `override`, with no other check. */
function contextWithOverride(override: boolean): PluginTransportContext {
  return createPluginTransportContext({
    env: {},
    ssh: {
      probe: () => Promise.reject(new Error("the override keeps the probe from running")),
      userOverride: () => Promise.resolve(override),
      urlRewritten: () => Promise.reject(new Error("the override keeps the url check")),
    },
  });
}

test("D-SG-18: a clone under a transport context plans with its checks and notes under the subject", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  setGitHubBaseUrl(testContext, undefined);
  const { seam, transports } = transportKeepingSeam(root);
  const context = contextWithOverride(true);

  // act
  await probeInstallClone({
    source: OWNER_REPO_SOURCE,
    seam,
    locations,
    auth: auth(),
    transportContext: context,
    subject: "ghp@gits",
  });

  // assert
  const [transport] = transports;
  assert.strictEqual(transport?.notes, context.notes);
  assert.deepStrictEqual(await plannedTransport(transport), {
    subject: "ghp@gits",
    first: { transport: "ssh", url: "git@github.com:acme/ghp.git" },
    note: "via-ssh",
  });
});

test("D-SG-18: a clone with no transport context stays on ssh when nothing forces https", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  setGitHubBaseUrl(testContext, undefined);
  const { seam, transports } = transportKeepingSeam(root);

  // act
  await probeInstallClone({
    source: OWNER_REPO_SOURCE,
    seam,
    locations,
    auth: auth(),
    subject: "ghp@gits",
  });

  // assert
  assert.deepStrictEqual(await plannedTransport(transports[0]), {
    subject: "ghp@gits",
    first: { transport: "ssh", url: "git@github.com:acme/ghp.git" },
    note: "via-ssh",
  });
});

test("D-SG-21: a clone with no transport context clones once over https under the base override", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  setGitHubBaseUrl(testContext, "https://mirror.example/base");
  const { seam, transports } = transportKeepingSeam(root);

  // act
  await probeInstallClone({
    source: OWNER_REPO_SOURCE,
    seam,
    locations,
    auth: auth(),
    subject: "ghp@gits",
  });

  // assert
  assert.deepStrictEqual(await plannedTransport(transports[0]), {
    subject: "ghp@gits",
    first: { transport: "https", url: "https://github.com/acme/ghp.git" },
    note: "via-https",
  });
});
