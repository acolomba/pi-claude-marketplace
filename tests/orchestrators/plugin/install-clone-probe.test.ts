import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import type { GitPluginRootResult } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";

interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

interface InstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly seam: InstallCloneCacheSeam;
  readonly locations: ScopedLocations;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

type ProbeInstallClone = (
  options: InstallCloneProbeOptions,
) => Promise<{
  readonly result: GitPluginRootResult;
  readonly resolvedSha: string | undefined;
}>;

const SHA = "1111111111111111111111111111111111111111";

async function loadProbeInstallClone(): Promise<ProbeInstallClone> {
  let probeInstallClone: ProbeInstallClone | undefined;
  await assert.doesNotReject(async () => {
    const owner = await import(
      "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts"
    );
    probeInstallClone = owner.probeInstallClone;
  }, "install-clone-probe.ts must own install clone classification");
  assert.ok(probeInstallClone !== undefined);
  return probeInstallClone;
}

async function freshLocations(
  testContext: TestContext,
): Promise<{ readonly locations: ScopedLocations; readonly root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "install-clone-probe-"));
  testContext.after(() => rm(root, { recursive: true, force: true }));
  const { locationsFor } = await import(
    "../../../extensions/pi-claude-marketplace/persistence/locations.ts"
  );
  return { locations: locationsFor("project", root), root };
}

function auth(): InstallCloneProbeOptions["auth"] {
  const ctx: NotificationContext = { ui: { notify() {} } };
  const credentialOps: CredentialOps = {
    async approve() {},
    async fill() {
      return null;
    },
    async reject() {},
  };
  return { ctx, credentialOps };
}

test("returns a materialized pinned cache result and its resolved sha", async (testContext) => {
  // arrange
  const probeInstallClone = await loadProbeInstallClone();
  const { locations, root } = await freshLocations(testContext);
  const cloneRoot = path.join(root, "pinned-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "url",
    raw: "https://example.com/plugin",
    url: "https://example.com/plugin",
    sha: SHA,
  };
  const calls: string[] = [];
  const seam: InstallCloneCacheSeam = {
    async resolvePluginPin() {
      calls.push("resolve");
      return { cloneUrl: "https://example.com/plugin", pin: SHA };
    },
    async materializePluginClone() {
      calls.push("materialize");
      return cloneRoot;
    },
    async materializeOrRefreshPluginMirror() {
      throw new Error("unexpected mirror materialization");
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
  const probeInstallClone = await loadProbeInstallClone();
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
    async requestCode() {
      throw new Error("device flow must stay lazy");
    },
    async pollToken() {
      throw new Error("device flow must stay lazy");
    },
  };
  const seam: InstallCloneCacheSeam = {
    async resolvePluginPin() {
      throw new Error("unexpected pin resolution");
    },
    async materializePluginClone() {
      throw new Error("unexpected pinned materialization");
    },
    async materializeOrRefreshPluginMirror(options) {
      assert.strictEqual(options.cloneUrl, "https://github.com/owner/repo");
      assert.strictEqual(options.ref, "main");
      assert.ok(options.auth !== undefined);
      return { pluginRoot: mirrorRoot, resolvedSha: SHA };
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
  const probeInstallClone = await loadProbeInstallClone();
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
    async resolvePluginPin() {
      return { cloneUrl: "https://example.com/mono", pin: SHA, ref: "main" };
    },
    async materializePluginClone(options) {
      assert.strictEqual(options.ref, "main");
      assert.strictEqual(options.auth, undefined);
      return cloneRoot;
    },
    async materializeOrRefreshPluginMirror() {
      throw new Error("unexpected mirror materialization");
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
  const probeInstallClone = await loadProbeInstallClone();
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
    async resolvePluginPin() {
      throw new Error("unexpected pin resolution");
    },
    async materializePluginClone() {
      throw new Error("unexpected pinned materialization");
    },
    async materializeOrRefreshPluginMirror() {
      return { pluginRoot: mirrorRoot, resolvedSha: SHA };
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
  const probeInstallClone = await loadProbeInstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneFailure = new Error("clone failed after cleanup");
  const source: GitBackedSource = {
    kind: "url",
    raw: "https://example.com/plugin",
    url: "https://example.com/plugin",
    sha: SHA,
  };
  const seam: InstallCloneCacheSeam = {
    async resolvePluginPin() {
      return { cloneUrl: "https://example.com/plugin", pin: SHA };
    },
    async materializePluginClone() {
      throw cloneFailure;
    },
    async materializeOrRefreshPluginMirror() {
      throw new Error("unexpected mirror materialization");
    },
  };

  // act & assert
  await assert.rejects(
    probeInstallClone({ source, seam, locations, auth: auth() }),
    (error: unknown) => error === cloneFailure,
  );
});
