import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { installPlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  reinstallPlugin,
  reinstallPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { updatePlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../../helpers/device-flow-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitAuthBundle } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { InstallCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import type { ReinstallCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import type { UpdateCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SHA_OLD = "1111111111111111111111111111111111111111";
const SHA_NEW = "2222222222222222222222222222222222222222";
const RECORDED_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI } {
  const ctx = {
    ui: { notify: (): void => {} },
  } as unknown as ExtensionContext;
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  return { ctx, pi };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "ur-auth-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

/** UpdateCloneCacheSeam over a mock gitOps that records the auth args it receives. */
function capturingUpdateSeam(gitOps: GitOps): {
  seam: UpdateCloneCacheSeam;
  captured: { pinAuth: GitAuthBundle | undefined; cloneAuth: GitAuthBundle | undefined };
} {
  const captured: { pinAuth: GitAuthBundle | undefined; cloneAuth: GitAuthBundle | undefined } = {
    pinAuth: undefined,
    cloneAuth: undefined,
  };
  const seam: UpdateCloneCacheSeam = {
    resolvePluginPin: (args) => {
      captured.pinAuth = args.auth;
      return resolvePluginPin({ ...args, gitOps });
    },
    materializePluginClone: (args) => {
      captured.cloneAuth = args.auth;
      return materializePluginClone({ ...args, gitOps });
    },
    materializeOrRefreshPluginMirror: (args) => {
      captured.cloneAuth = args.auth;
      return materializeOrRefreshPluginMirror({ ...args, gitOps });
    },
  };
  return { seam, captured };
}

function installSeamWith(gitOps: GitOps): InstallCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/** ReinstallCloneCacheSeam (materialize only) capturing the auth arg. */
function capturingReinstallSeam(gitOps: GitOps): {
  seam: ReinstallCloneCacheSeam;
  captured: { auth: GitAuthBundle | undefined; count: number };
} {
  const captured: { auth: GitAuthBundle | undefined; count: number } = {
    auth: undefined,
    count: 0,
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone: (args) => {
      captured.auth = args.auth;
      captured.count += 1;
      return materializePluginClone({ ...args, gitOps });
    },
  };
  return { seam, captured };
}

async function seedGitUpdateMarketplace(opts: {
  cwd: string;
  cloneUrl: string;
  entrySource: unknown;
  recordedSha: string;
  versionTag: string;
}): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const fixtureRepoDir = path.join(opts.cwd, "repo-fixture");
  await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "gp", version: opts.versionTag }),
  );
  const skillDir = path.join(fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: greet\n---\n\nHi ${opts.versionTag}.\n`,
  );

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "gp", source: opts.entrySource }] }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Warm-clone the recorded sha so the update's re-clone of a DIFFERENT sha is
  // the only clone that fires.
  const key = pluginCloneKey(opts.cloneUrl, opts.recordedSha);
  const oldCloneRoot = await locations.pluginCloneDir(key);
  await mkdir(path.dirname(oldCloneRoot), { recursive: true });
  await cp(fixtureRepoDir, oldCloneRoot, { recursive: true });

  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          gp: {
            version: `sha-${opts.recordedSha.slice(0, 12)}`,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            enabled: true,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: ["seeded-skill"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            resolvedSource: oldCloneRoot,
            resolvedSha: opts.recordedSha,
          },
        },
      },
    },
  });
}

void test("PROV-03 update: a git-source update on a provider host threads the auth bundle to materializePluginClone", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-auth-prov03-"));
    try {
      // github source -> host github.com has a registered provider. A pinned
      // sha change (recorded SHA_OLD, manifest SHA_NEW) forces a re-clone.
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo", sha: SHA_NEW },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();
      const { ctx, pi } = makeCtx();

      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
      });

      assert.ok(captured.cloneAuth !== undefined, "the re-clone threaded a provider auth bundle");
      assert.equal(captured.cloneAuth.host, "github.com");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("PROV-03 update (Q1): an unpinned git-source update threads auth into the mirror seam", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-auth-q1-"));
    try {
      // Unpinned github source -> routes to the mirror seam, which threads the
      // provider auth bundle into its clone/refresh (MIRR-01 / Q1).
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo" },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });

      const { gitOps } = makeMockGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture"),
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();
      const { ctx, pi } = makeCtx();

      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
      });

      assert.ok(
        captured.cloneAuth !== undefined,
        "the unpinned mirror materialize threaded a provider auth bundle (Q1)",
      );
      assert.equal(captured.cloneAuth.host, "github.com");
      // The mirror route reads HEAD; it never resolves a remote ref, so the pin
      // resolution path is not taken.
      assert.equal(captured.pinAuth, undefined, "no resolvePluginPin auth on the mirror route");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

async function seedInstalledGitSourcePlugin(opts: { cwd: string; source: unknown }): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const fixtureRepoDir = path.join(opts.cwd, "repo-fixture");
  await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "gp", version: "9.9.9" }),
  );
  const skillDir = path.join(fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "gp", source: opts.source }] }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });

  const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
  const { ctx, pi } = makeCtx();
  await installPlugin({
    ctx,
    pi,
    scope: "project",
    cwd: opts.cwd,
    marketplace: "mp",
    plugin: "gp",
    cloneCacheSeam: installSeamWith(gitOps),
  });
}

void test("PROV-03 reinstall (Q3 cold cache): a git-source reinstall re-clones and threads the auth bundle on a provider host", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-cold-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        source: { source: "github", repo: "org/repo", sha: RECORDED_SHA },
      });

      // Delete the warm clone so the reinstall must RE-CLONE (cold cache).
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(
        pluginCloneKey("https://github.com/org/repo", RECORDED_SHA),
      );
      await rm(cloneRoot, { recursive: true, force: true });

      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture"),
      });
      const { seam, captured } = capturingReinstallSeam(gitOps);
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp } = makeMockDeviceFlowHttp();
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        deviceFlowHttp,
        __deps: { cloneCacheSeam: seam },
      });

      assert.equal(outcome.partition, "reinstalled", "cold-cache reinstall re-materializes");
      assert.equal(gitState.cloneCalls.length, 1, "the cold cache triggered a re-clone");
      assert.ok(captured.auth !== undefined, "the re-clone threaded a provider auth bundle (Q3)");
      assert.equal(captured.auth.host, "github.com");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("PROV-02 reinstall: a git-source reinstall on a no-provider host threads no auth bundle", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-noprov-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        source: { source: "url", url: "https://gitlab.example.com/o/r", sha: RECORDED_SHA },
      });

      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(
        pluginCloneKey("https://gitlab.example.com/o/r", RECORDED_SHA),
      );
      await rm(cloneRoot, { recursive: true, force: true });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingReinstallSeam(gitOps);
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        __deps: { cloneCacheSeam: seam },
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(captured.count, 1, "the cold cache re-cloned");
      assert.equal(captured.auth, undefined, "no provider -> no auth bundle (PROV-02)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

void test("D-79-02 bulk reinstall: two cold-cache private plugins share ONE authMemo -- the device flow runs at most once per host", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-memo-"));
    try {
      const SHA_ONE = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
      const SHA_TWO = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "unused", version: "9.9.9" }),
      );
      const skillDir = path.join(fixtureRepoDir, "skills", "greet");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHi.\n`);

      const marketplaceRoot = path.join(cwd, "mp-src");
      await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "gh1", source: { source: "github", repo: "org/one", sha: SHA_ONE } },
            { name: "gh2", source: { source: "github", repo: "org/two", sha: SHA_TWO } },
          ],
        }),
      );

      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const makeRecord = async (repo: string, sha: string) => ({
        version: `sha-${sha.slice(0, 12)}`,
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        enabled: true,
        compatibility: {
          installable: true,
          notes: [] as string[],
          supported: [] as string[],
          unsupported: [] as string[],
        },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
        // COLD cache: the recorded clone dir is never created on disk.
        resolvedSource: await locations.pluginCloneDir(
          pluginCloneKey(`https://github.com/${repo}`, sha),
        ),
        resolvedSha: sha,
      });
      await saveState(locations.extensionRoot, {
        schemaVersion: 2,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: {
              gh1: await makeRecord("org/one", SHA_ONE),
              gh2: await makeRecord("org/two", SHA_TWO),
            },
          },
        },
      });

      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const bundles: (GitAuthBundle | undefined)[] = [];
      const seam: ReinstallCloneCacheSeam = {
        materializePluginClone: (args) => {
          bundles.push(args.auth);
          return materializePluginClone({ ...args, gitOps });
        },
      };
      const { credOps: credentialOps } = makeMockCredentialOps();
      const { http: deviceFlowHttp, state: dfState } = makeMockDeviceFlowHttp({
        pollQueue: [
          { kind: "success", accessToken: "tok-abc", tokenType: "bearer", scope: "repo" },
        ],
      });
      const { ctx, pi } = makeCtx();

      await reinstallPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        credentialOps,
        deviceFlowHttp,
        __deps: { cloneCacheSeam: seam },
      });

      assert.equal(bundles.length, 2, "both cold-cache reinstalls re-cloned");
      const [first, second] = bundles;
      assert.ok(first !== undefined && second !== undefined, "both re-clones threaded bundles");
      // The mock gitOps never invokes onAuthRequired, so drive the shared memo
      // directly: simulate one 401 challenge per bulk item.
      await first.onAuthRequired();
      await second.onAuthRequired();

      assert.equal(
        dfState.requestCodeCalls.length,
        1,
        "the device flow ran AT MOST ONCE across the bulk sweep (D-79-02 shared memo)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
