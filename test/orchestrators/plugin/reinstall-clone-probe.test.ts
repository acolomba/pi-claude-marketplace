import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  probeReinstallClone,
  type ReinstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const SHA = "1111111111111111111111111111111111111111";
const MIRROR_SHA = "2222222222222222222222222222222222222222";

async function freshLocations(testContext: TestContext): Promise<{
  readonly locations: ScopedLocations;
  readonly root: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "reinstall-clone-probe-"));
  testContext.after(() => rm(root, { recursive: true, force: true }));
  return { locations: locationsFor("project", root), root };
}

function auth(): Parameters<typeof probeReinstallClone>[0]["auth"] {
  const ctx: NotificationContext = { mode: "tui", ui: { notify: () => undefined } };
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

test("GIT-01: restores an unpinned source's copy at the recorded sha, not the moved mirror", async (testContext) => {
  // arrange
  const { locations } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/mirror-plugin";
  const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
  await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${MIRROR_SHA}\n`);
  const copyRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA));
  await mkdir(copyRoot, { recursive: true });
  const source: GitBackedSource = { kind: "url", raw: cloneUrl, url: cloneUrl };

  // act
  const outcome = await probeReinstallClone({
    source,
    locations,
    recordedSha: SHA,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "materialized", pluginRoot: copyRoot, resolvedSha: SHA });
});

test("NFR-5: a pinned GitHub source the seam finds warm never reads an invalid base", async (testContext) => {
  // arrange
  await createHermeticEnvironment(testContext, "reinstall-clone-probe-warm-home-");
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
  const seam: ReinstallCloneCacheSeam = {
    materializePluginCommitCopy() {
      return Promise.resolve(cloneRoot);
    },
  };

  // act
  const outcome = await probeReinstallClone({
    source,
    locations,
    recordedSha: SHA,
    seam,
    auth: auth(),
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "materialized",
    pluginRoot: cloneRoot,
    resolvedSha: SHA,
  });
});

test("asks for the copy at the recorded sha with the identity and wire urls", async (testContext) => {
  // arrange
  const { locations, root } = await freshLocations(testContext);
  const cloneUrl = "https://example.com/plugin";
  const rawUrl = "https://example.com/plugin.git";
  const source: GitBackedSource = { kind: "url", raw: rawUrl, url: cloneUrl };
  const pluginAuth = auth();
  const calls: unknown[] = [];
  const seam: ReinstallCloneCacheSeam = {
    materializePluginCommitCopy({ resolveAuth, ...copyOptions }) {
      const bundle = resolveAuth();
      calls.push({ ...copyOptions, credentialOps: bundle.credentialOps, host: bundle.host });
      return Promise.resolve(root);
    },
  };

  // act
  await probeReinstallClone({ source, seam, locations, recordedSha: SHA, auth: pluginAuth });

  // assert
  assert.deepStrictEqual(calls, [
    {
      locations,
      cloneUrl,
      networkUrl: rawUrl,
      sha: SHA,
      credentialOps: pluginAuth.credentialOps,
      host: "example.com",
    },
  ]);
});

test("threads provider auth while resolving a pinned git-subdir", async (testContext) => {
  // arrange
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
    materializePluginCommitCopy(options) {
      calls.push({ auth: options.resolveAuth() });
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
    materializePluginCommitCopy() {
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
  const { locations } = await freshLocations(testContext);
  const cloneFailure = new Error("clone failed after cleanup");
  const source: GitBackedSource = {
    kind: "url",
    raw: "https://example.com/plugin",
    url: "https://example.com/plugin",
    sha: SHA,
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginCommitCopy() {
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
