import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { materializePluginClone } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { GitPluginRootResult } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const SHA = "1111111111111111111111111111111111111111";
const MIRROR_SHA = "2222222222222222222222222222222222222222";

interface ReinstallCloneCacheSeam {
  readonly materializePluginClone: typeof materializePluginClone;
}

type ProbeReinstallClone = (options: {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly recordedSha: string;
  readonly seam?: ReinstallCloneCacheSeam;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
  };
}) => Promise<GitPluginRootResult>;

async function loadProbeReinstallClone(): Promise<ProbeReinstallClone> {
  let probeReinstallClone: ProbeReinstallClone | undefined;
  await assert.doesNotReject(async () => {
    const owner =
      await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts");
    probeReinstallClone = owner.probeReinstallClone;
  }, "reinstall-clone-probe.ts must own reinstall clone probing");
  assert.ok(probeReinstallClone !== undefined);
  return probeReinstallClone;
}

async function freshLocations(testContext: TestContext): Promise<{
  readonly locations: ScopedLocations;
  readonly root: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "reinstall-clone-probe-"));
  testContext.after(() => rm(root, { recursive: true, force: true }));
  return { locations: locationsFor("project", root), root };
}

function auth(): Parameters<ProbeReinstallClone>[0]["auth"] {
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, credentialOps };
}

async function writeMirrorHead(mirrorRoot: string, sha: string): Promise<void> {
  await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
  await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${sha}\n`);
}

test("uses the production seam for a warm pinned clone", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/warm-plugin";
  const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA));
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = { kind: "url", raw: cloneUrl, url: cloneUrl, sha: SHA };

  // act
  const outcome = await probeReinstallClone({
    source,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot: cloneRoot,
    resolvedSha: SHA,
  });
});

test("repairs an unpinned url source from the warm mirror", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/warm-mirror";
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await writeMirrorHead(mirrorRoot, MIRROR_SHA);
  const source: GitBackedSource = { kind: "url", raw: cloneUrl, url: cloneUrl };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone() {
      return Promise.reject(new Error("unexpected clone"));
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot: mirrorRoot,
    resolvedSha: MIRROR_SHA,
  });
});

test("resolves an unpinned git-subdir inside the warm mirror", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/mono";
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  const pluginRoot = path.join(mirrorRoot, "plugins", "one");
  await Promise.all([
    writeMirrorHead(mirrorRoot, MIRROR_SHA),
    mkdir(pluginRoot, { recursive: true }),
  ]);
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: `${cloneUrl}:plugins/one`,
    url: cloneUrl,
    path: "plugins/one",
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone() {
      return Promise.reject(new Error("unexpected clone"));
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot,
    resolvedSha: MIRROR_SHA,
  });
});

test("classifies a missing unpinned mirror subdirectory without cloning", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/mono";
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await writeMirrorHead(mirrorRoot, MIRROR_SHA);
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: `${cloneUrl}:plugins/missing`,
    url: cloneUrl,
    path: "plugins/missing",
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone() {
      return Promise.reject(new Error("unexpected clone"));
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "missing-subdir",
    detail: 'git-subdir path "plugins/missing" does not exist in the plugin clone',
  });
});

test("falls back from an absent unpinned mirror to the recorded sha", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations, root } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/cold-mirror";
  const cloneRoot = path.join(root, "recorded-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = { kind: "url", raw: cloneUrl, url: cloneUrl };
  const calls: unknown[] = [];
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone(options) {
      calls.push(options);
      return Promise.resolve(cloneRoot);
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot: cloneRoot,
    resolvedSha: SHA,
  });
  assert.deepStrictEqual(calls, [{ locations, cloneUrl, pin: SHA }]);
});

test("threads provider auth while resolving a pinned git-subdir", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations, root } = await freshLocations(testContext);
  const cloneRoot = path.join(root, "github-clone");
  const pluginRoot = path.join(cloneRoot, "plugins", "one");
  await mkdir(pluginRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://github.com/owner/repo:plugins/one",
    url: "https://github.com/owner/repo",
    path: "plugins/one",
    sha: SHA,
  };
  const calls: unknown[] = [];
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone(options) {
      calls.push(options);
      return Promise.resolve(cloneRoot);
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot,
    resolvedSha: SHA,
  });
  assert.strictEqual(calls.length, 1);
  assert.ok((calls[0] as { readonly auth?: unknown }).auth !== undefined);
});

test("classifies a missing pinned git-subdir", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations, root } = await freshLocations(testContext);
  const cloneRoot = path.join(root, "pinned-clone");
  await mkdir(cloneRoot, { recursive: true });
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://example.com/mono:plugins/missing",
    url: "https://example.com/mono",
    path: "plugins/missing",
    sha: SHA,
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone() {
      return Promise.resolve(cloneRoot);
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    seam,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "missing-subdir",
    detail: 'git-subdir path "plugins/missing" does not exist in the plugin clone',
  });
});

test("preserves clone failure attribution", async (testContext) => {
  // arrange
  const probeReinstallClone = await loadProbeReinstallClone();
  const { locations } = await freshLocations(testContext);
  const cloneFailure = new Error("clone failed after cleanup");
  const source: GitBackedSource = {
    kind: "url",
    raw: "https://example.com/plugin",
    url: "https://example.com/plugin",
    sha: SHA,
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone() {
      return Promise.reject(cloneFailure);
    },
  };

  // act & assert
  await assert.rejects(
    probeReinstallClone({
      source,
      seam,
      locations,
      recordedSha: SHA,
      auth: auth(),
    }),
    (error: unknown) => error === cloneFailure,
  );
});
