import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  probeInstallClone,
  type InstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const SHA = "1111111111111111111111111111111111111111";

async function freshLocations(
  testContext: TestContext,
): Promise<{ readonly locations: ScopedLocations; readonly root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "install-clone-probe-"));
  testContext.after(() => rm(root, { recursive: true, force: true }));
  return { locations: locationsFor("project", root), root };
}

function auth(): Parameters<typeof probeInstallClone>[0]["auth"] {
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, credentialOps };
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
  const outcome = await probeInstallClone({ source, locations, auth: auth() });

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
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      calls.push("resolve");
      return Promise.resolve({ cloneUrl: "https://github.com/owner/repo", pin: SHA });
    },
    materializePluginClone(options) {
      calls.push("materialize");
      assert.ok(options.auth !== undefined);
      return Promise.resolve(cloneRoot);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
  };

  // act
  const outcome = await probeInstallClone({ source, seam, locations, auth: auth() });

  // assert
  assert.deepStrictEqual(outcome, {
    result: { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: SHA },
    resolvedSha: SHA,
  });
  assert.deepStrictEqual(calls, ["resolve", "materialize"]);
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
  };

  // act
  const outcome = await probeInstallClone({
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
  const seam: InstallCloneCacheSeam = {
    resolvePluginPin() {
      return Promise.resolve({ cloneUrl: "https://example.com/mono", pin: SHA, ref: "main" });
    },
    materializePluginClone(options) {
      assert.strictEqual(options.ref, "main");
      assert.strictEqual(options.auth, undefined);
      return Promise.resolve(cloneRoot);
    },
    materializeOrRefreshPluginMirror() {
      return Promise.reject(new Error("unexpected mirror materialization"));
    },
  };

  // act
  const outcome = await probeInstallClone({ source, seam, locations, auth: auth() });

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
  };

  // act
  const outcome = await probeInstallClone({ source, seam, locations, auth: auth() });

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
  };

  // act & assert
  await assert.rejects(
    probeInstallClone({ source, seam, locations, auth: auth() }),
    (error: unknown) => error === cloneFailure,
  );
});
