import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { preparePluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type {
  AuthAttemptResult,
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { UpdateCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function pluginRecord(version: string, enabled = true): PluginRecord {
  return {
    version,
    resolvedSource: "/previous/plugin",
    compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
    resources: {
      skills: ["hello:tool"],
      prompts: ["hello:deploy"],
      agents: ["hello:bot"],
      mcpServers: ["hello:server"],
      hooks: ["hello"],
    },
    enabled,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface SeedOptions {
  readonly installed?: PluginRecord;
  readonly declared?: boolean;
  readonly version?: string;
  readonly source?: unknown;
}

async function seedUpdate(options: SeedOptions = {}): Promise<{
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly pluginRoot: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "update-preflight-"));
  const marketplaceRoot = path.join(cwd, "marketplace");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: options.version ?? "2.0.0" }),
  );
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins:
        options.declared === false
          ? []
          : [
              {
                name: "hello",
                source: options.source ?? "./plugins/hello",
                version: options.version ?? "2.0.0",
              },
            ],
    }),
  );
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./marketplace"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: options.installed === undefined ? {} : { hello: options.installed },
      },
    },
  });
  return { cwd, locations, pluginRoot };
}

async function prepare(
  seed: Awaited<ReturnType<typeof seedUpdate>>,
  options: {
    readonly partial?: boolean;
    readonly cloneCacheSeam?: UpdateCloneCacheSeam;
    readonly cleanupClones?: () => Promise<void>;
    readonly ctx?: NotificationContext;
    readonly credentialOps?: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  } = {},
) {
  return preparePluginUpdate({
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    locations: seed.locations,
    cleanupClones: options.cleanupClones ?? (async () => {}),
    ...(options.partial === true && { partial: true }),
    ...(options.cloneCacheSeam !== undefined && { cloneCacheSeam: options.cloneCacheSeam }),
    ...(options.ctx !== undefined && { ctx: options.ctx }),
    ...(options.credentialOps !== undefined && { credentialOps: options.credentialOps }),
    ...(options.deviceFlowHttp !== undefined && { deviceFlowHttp: options.deviceFlowHttp }),
    ...(options.authMemo !== undefined && { authMemo: options.authMemo }),
  });
}

test("classifies a missing marketplace without reading a manifest", async (t) => {
  // arrange
  const cwd = await mkdtemp(path.join(tmpdir(), "update-preflight-missing-marketplace-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  const locations = locationsFor("project", cwd);

  // act
  const outcome = await preparePluginUpdate({
    plugin: "hello",
    marketplace: "missing",
    scope: "project",
    locations,
    cleanupClones: async () => {},
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    notes: ['marketplace "missing" not found in project scope'],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("distinguishes an undeclared target from a declared uninstalled target", async (t) => {
  // arrange
  const undeclared = await seedUpdate({ declared: false });
  const uninstalled = await seedUpdate();
  t.after(() =>
    Promise.all(
      [undeclared.cwd, uninstalled.cwd].map((cwd) => rm(cwd, { force: true, recursive: true })),
    ),
  );

  // act
  const undeclaredOutcome = await prepare(undeclared);
  const uninstalledOutcome = await prepare(uninstalled);

  // assert
  assert.deepStrictEqual(undeclaredOutcome, {
    partition: "failed",
    name: "hello",
    notes: ["not in manifest"],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
  assert.deepStrictEqual(uninstalledOutcome, {
    partition: "skipped",
    name: "hello",
    notes: ["not installed"],
    reasons: ["not installed"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("retains the recorded version when the refreshed manifest drops the plugin", async (t) => {
  // arrange
  const seed = await seedUpdate({ declared: false, installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "1.0.0",
    notes: ["not in manifest"],
    reasons: ["not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("returns an exact unchanged outcome for an enabled current plugin", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const before = await readFile(seed.locations.stateJsonPath, "utf8");

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "2.0.0",
    toVersion: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
  });
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), before);
});

test("returns the complete prepared candidate for a version transition", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const prepared = await prepare(seed);

  // assert
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.record.version, "1.0.0");
  assert.strictEqual(prepared.installable.pluginRoot, seed.pluginRoot);
  assert.strictEqual(prepared.fromVersion, "1.0.0");
  assert.strictEqual(prepared.toVersion, "2.0.0");
  assert.strictEqual(prepared.resolvedSha, undefined);
});

test("keeps an unsupported candidate skipped with and without partial permission", async (t) => {
  // arrange
  const source = { source: "npm", package: "example" };
  const strictSeed = await seedUpdate({ installed: pluginRecord("1.0.0"), source });
  const partialSeed = await seedUpdate({ installed: pluginRecord("1.0.0"), source });
  t.after(() =>
    Promise.all(
      [strictSeed.cwd, partialSeed.cwd].map((cwd) =>
        rm(cwd, {
          force: true,
          recursive: true,
        }),
      ),
    ),
  );

  // act
  const strictOutcome = await prepare(strictSeed);
  const partialOutcome = await prepare(partialSeed, { partial: true });

  // assert
  for (const outcome of [strictOutcome, partialOutcome]) {
    assert.ok("partition" in outcome);
    assert.strictEqual(outcome.partition, "skipped");
    assert.deepStrictEqual(outcome.reasons, ["no longer installable"]);
  }
});

test("refreshes a disabled pin without materializing its recorded resources", async (t) => {
  // arrange
  const record = pluginRecord("1.0.0", false);
  const seed = await seedUpdate({ installed: record });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
  });
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(refreshed?.version, "2.0.0");
  assert.strictEqual(refreshed?.resolvedSource, seed.pluginRoot);
  assert.deepStrictEqual(refreshed?.resources, record.resources);
  assert.strictEqual(refreshed?.enabled, false);
});

test("does not rewrite an unchanged disabled pin", async (t) => {
  // arrange
  const seed = await seedUpdate({ installed: pluginRecord("2.0.0", false) });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const state = await loadState(seed.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  record.resolvedSource = seed.pluginRoot;
  await saveState(seed.locations.extensionRoot, state);
  const before = await readFile(seed.locations.stateJsonPath, "utf8");

  // act
  const outcome = await prepare(seed);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "2.0.0",
    toVersion: "2.0.0",
    declaresAgents: false,
    declaresMcp: false,
  });
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), before);
});

test("admits a partial candidate only with explicit partial permission", async (t) => {
  // arrange
  const strictSeed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  const partialSeed = await seedUpdate({ installed: pluginRecord("1.0.0") });
  t.after(() =>
    Promise.all(
      [strictSeed.cwd, partialSeed.cwd].map((cwd) => rm(cwd, { force: true, recursive: true })),
    ),
  );
  for (const seed of [strictSeed, partialSeed]) {
    await writeFile(
      path.join(seed.pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "hello",
        version: "2.0.0",
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      }),
    );
  }

  // act
  const strictOutcome = await prepare(strictSeed);
  const partialOutcome = await prepare(partialSeed, { partial: true });

  // assert
  assert.ok("partition" in strictOutcome);
  assert.strictEqual(strictOutcome.partition, "skipped");
  assert.deepStrictEqual(strictOutcome.reasons, ["unsupported component"]);
  assert.strictEqual(strictOutcome.partialUpgradable, true);
  assert.ok(!("partition" in partialOutcome));
  assert.strictEqual(partialOutcome.installable.state, "partially-available");
});

test("prepares pinned and unpinned URL clones with their exact resolved sha", async (t) => {
  // arrange
  const pinnedSha = "1111111111111111111111111111111111111111";
  const unpinnedSha = "2222222222222222222222222222222222222222";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/pinned", sha: pinnedSha },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/unpinned" },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({
        cloneUrl: "https://example.com/pinned",
        pin: pinnedSha,
      }),
    materializePluginClone: () => Promise.resolve(pinned.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinned.pluginRoot,
        resolvedSha: unpinnedSha,
      }),
  };

  // act
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(pinnedPrepared.resolvedSha, pinnedSha);
  assert.strictEqual(pinnedPrepared.toVersion, "sha-111111111111");
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(unpinnedPrepared.resolvedSha, unpinnedSha);
  assert.strictEqual(unpinnedPrepared.toVersion, "sha-222222222222");
});

test("classifies a clone transport failure without exposing a raw throw", async (t) => {
  // arrange
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "url", url: "https://example.com/private" },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const transportError = new Error("offline") as NodeJS.ErrnoException;
  transportError.code = "ENETUNREACH";
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () => Promise.reject(transportError),
  };

  // act
  const outcome = await prepare(seed, { cloneCacheSeam });

  // assert
  assert.ok("partition" in outcome);
  assert.deepStrictEqual(outcome, {
    partition: "skipped",
    name: "hello",
    fromVersion: "sha-000000000000",
    notes: ["offline"],
    reasons: ["network unreachable"],
    declaresAgents: false,
    declaresMcp: false,
  });
});

test("swallows disabled clone cleanup failure after persisting the new pin", async (t) => {
  // arrange
  const sha = "3333333333333333333333333333333333333333";
  const record = { ...pluginRecord("sha-000000000000", false), resolvedSha: "0".repeat(40) };
  const seed = await seedUpdate({
    installed: record,
    source: { source: "url", url: "https://example.com/disabled", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.resolve({ cloneUrl: "https://example.com/disabled", pin: sha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const outcome = await prepare(seed, {
    cloneCacheSeam,
    cleanupClones: () => Promise.reject(new Error("cleanup failed")),
  });

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  const refreshed = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(refreshed?.resolvedSha, sha);
  assert.strictEqual(refreshed?.version, "sha-333333333333");
});

test("cleans obsolete clones after persisting a disabled git pin", async (t) => {
  // arrange
  const sha = "3434343434343434343434343434343434343434";
  const record = { ...pluginRecord("sha-000000000000", false), resolvedSha: "0".repeat(40) };
  const seed = await seedUpdate({
    installed: record,
    source: { source: "url", url: "https://example.com/disabled-cleanup", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/disabled-cleanup", pin: sha }),
    materializePluginClone: () => Promise.resolve(seed.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  let cleanupCalls = 0;

  // act
  await prepare(seed, {
    cloneCacheSeam,
    cleanupClones: () => {
      cleanupCalls += 1;
      return Promise.resolve();
    },
  });

  // assert
  assert.strictEqual(cleanupCalls, 1);
});

test("passes authenticated clone context and refs through both clone arms", async (t) => {
  // arrange
  const sha = "4444444444444444444444444444444444444444";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "github", repo: "org/repo", ref: "stable", sha },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: { source: "github", repo: "org/repo", ref: "next" },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const deviceFlowHttp: DeviceFlowHttp = {
    requestCode: () => Promise.reject(new Error("unexpected device flow")),
    pollToken: () => Promise.reject(new Error("unexpected device flow")),
  };
  const authMemo = new Map<string, AuthAttemptResult>();
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      return Promise.resolve({ cloneUrl: "https://github.com/org/repo", pin: sha, ref: "stable" });
    },
    materializePluginClone: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      assert.strictEqual(options.ref, "stable");
      return Promise.resolve(pinned.pluginRoot);
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: (options) => {
      assert.strictEqual(options.auth?.host, "github.com");
      assert.strictEqual(options.ref, "next");
      return Promise.resolve({ pluginRoot: unpinned.pluginRoot, resolvedSha: sha });
    },
  };

  // act
  const auth = { ctx, credentialOps, deviceFlowHttp, authMemo };
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam, ...auth });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam, ...auth });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(pinnedPrepared.resolvedSha, sha);
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(unpinnedPrepared.resolvedSha, sha);
});

test("resolves pinned and unpinned git-subdir roots", async (t) => {
  // arrange
  const pinnedSha = "5555555555555555555555555555555555555555";
  const unpinnedSha = "6666666666666666666666666666666666666666";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/pinned-subdir",
      path: "plugins/hello",
      sha: pinnedSha,
    },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/unpinned-subdir",
      path: "plugins/hello",
    },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedRoot = path.join(pinned.cwd, "pinned-clone");
  const unpinnedRoot = path.join(unpinned.cwd, "unpinned-clone");
  await cp(pinned.pluginRoot, path.join(pinnedRoot, "plugins", "hello"), { recursive: true });
  await cp(unpinned.pluginRoot, path.join(unpinnedRoot, "plugins", "hello"), { recursive: true });
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({
        cloneUrl: "https://example.com/pinned-subdir",
        pin: pinnedSha,
      }),
    materializePluginClone: () => Promise.resolve(pinnedRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinnedRoot,
        resolvedSha: unpinnedSha,
      }),
  };

  // act
  const pinnedPrepared = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedPrepared = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  assert.ok(!("partition" in pinnedPrepared));
  assert.strictEqual(
    pinnedPrepared.installable.pluginRoot,
    path.join(pinnedRoot, "plugins", "hello"),
  );
  assert.strictEqual(pinnedPrepared.resolvedSha, pinnedSha);
  assert.ok(!("partition" in unpinnedPrepared));
  assert.strictEqual(
    unpinnedPrepared.installable.pluginRoot,
    path.join(unpinnedRoot, "plugins", "hello"),
  );
  assert.strictEqual(unpinnedPrepared.resolvedSha, unpinnedSha);
});

test("classifies missing pinned and unpinned git-subdir roots", async (t) => {
  // arrange
  const sha = "7777777777777777777777777777777777777777";
  const pinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/pinned-missing",
      path: "plugins/missing",
      sha,
    },
  });
  const unpinned = await seedUpdate({
    installed: pluginRecord("sha-000000000000"),
    source: {
      source: "git-subdir",
      url: "https://example.com/unpinned-missing",
      path: "plugins/missing",
    },
  });
  t.after(() =>
    Promise.all([pinned.cwd, unpinned.cwd].map((cwd) => rm(cwd, { force: true, recursive: true }))),
  );
  const pinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/pinned-missing", pin: sha }),
    materializePluginClone: () => Promise.resolve(pinned.pluginRoot),
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };
  const unpinnedSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.reject(new Error("unexpected pin resolution")),
    materializePluginClone: () => Promise.reject(new Error("unexpected immutable clone")),
    materializeOrRefreshPluginMirror: () =>
      Promise.resolve({
        pluginRoot: unpinned.pluginRoot,
        resolvedSha: sha,
      }),
  };

  // act
  const pinnedOutcome = await prepare(pinned, { cloneCacheSeam: pinnedSeam });
  const unpinnedOutcome = await prepare(unpinned, { cloneCacheSeam: unpinnedSeam });

  // assert
  for (const outcome of [pinnedOutcome, unpinnedOutcome]) {
    assert.ok("partition" in outcome);
    assert.strictEqual(outcome.partition, "skipped");
    assert.deepStrictEqual(outcome.reasons, ["no longer installable"]);
  }
});

test("keeps a concurrent disabled-plugin removal absent", async (t) => {
  // arrange
  const sha = "8888888888888888888888888888888888888888";
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000", false),
    source: { source: "url", url: "https://example.com/removed", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  let releaseClone: (() => void) | undefined;
  const cloneBlocked = new Promise<void>((resolve) => {
    releaseClone = resolve;
  });
  let reportCloneStarted: (() => void) | undefined;
  const cloneStarted = new Promise<void>((resolve) => {
    reportCloneStarted = resolve;
  });
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () => Promise.resolve({ cloneUrl: "https://example.com/removed", pin: sha }),
    materializePluginClone: async () => {
      reportCloneStarted?.();
      await cloneBlocked;
      return seed.pluginRoot;
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const preparation = prepare(seed, { cloneCacheSeam });
  await cloneStarted;
  const state = await loadState(seed.locations.extensionRoot);
  delete state.marketplaces.mp?.plugins.hello;
  await saveState(seed.locations.extensionRoot, state);
  releaseClone?.();
  const outcome = await preparation;

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  const current = (await loadState(seed.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(current, undefined);
});

test("does not rewrite a concurrently converged disabled pin", async (t) => {
  // arrange
  const sha = "9999999999999999999999999999999999999999";
  const seed = await seedUpdate({
    installed: pluginRecord("sha-000000000000", false),
    source: { source: "url", url: "https://example.com/converged", sha },
  });
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  let releaseClone: (() => void) | undefined;
  const cloneBlocked = new Promise<void>((resolve) => {
    releaseClone = resolve;
  });
  let reportCloneStarted: (() => void) | undefined;
  const cloneStarted = new Promise<void>((resolve) => {
    reportCloneStarted = resolve;
  });
  const cloneCacheSeam: UpdateCloneCacheSeam = {
    resolvePluginPin: () =>
      Promise.resolve({ cloneUrl: "https://example.com/converged", pin: sha }),
    materializePluginClone: async () => {
      reportCloneStarted?.();
      await cloneBlocked;
      return seed.pluginRoot;
    },
    materializeOrRefreshPluginMirror: () => Promise.reject(new Error("unexpected mirror refresh")),
  };

  // act
  const preparation = prepare(seed, { cloneCacheSeam });
  await cloneStarted;
  const state = await loadState(seed.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  record.version = "sha-999999999999";
  record.resolvedSource = seed.pluginRoot;
  record.resolvedSha = sha;
  record.compatibility = { installable: true, notes: [], supported: ["skills"], unsupported: [] };
  record.updatedAt = "concurrent-writer";
  await saveState(seed.locations.extensionRoot, state);
  const converged = await readFile(seed.locations.stateJsonPath, "utf8");
  releaseClone?.();
  const outcome = await preparation;

  // assert
  assert.ok("partition" in outcome);
  assert.strictEqual(outcome.partition, "skipped");
  assert.strictEqual(await readFile(seed.locations.stateJsonPath, "utf8"), converged);
});
