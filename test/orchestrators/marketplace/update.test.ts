import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  githubSource,
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { computeHashVersion } from "../../../extensions/pi-claude-marketplace/domain/version.ts";
import { getMarketplaceInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts";
import {
  updateAllMarketplaces,
  updateMarketplace,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { createPluginUpdateOperations } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { buildAuthCallbacks } from "../../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  CrossOriginChallengeError,
  FetchedUrlCause,
  InvalidGitHubBaseUrlError,
  StoredCredentialRejectedError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { type Severity } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  PluginUpdateFn,
  PluginUpdateOutcome,
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
  ScopeDependencyInstallRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { GitCredentials } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  ExtensionContext,
  NotificationContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

const VALID_MANIFEST_JSON = JSON.stringify({
  name: "valid-marketplace",
  owner: { name: "Phase 4 Tests" },
  plugins: [
    {
      name: "hello",
      source: "./plugins/hello",
      description: "Hello plugin (test fixture)",
      version: "1.0.0",
    },
  ],
});

function createUpdateSinglePlugin(): PluginUpdateFn {
  return createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  ).beginPluginUpdateRun();
}

interface MarketplaceGitOpsSeed {
  readonly checkoutThrows?: Error;
  readonly currentBranchOverride?: string | null;
  readonly fetchThrows?: Error;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteRefs?: Readonly<Record<string, string>>;
}

function fixtureMarketplaceDir(
  name: "valid-marketplace" | "invalid-manifest" | "empty-marketplace",
): string {
  return path.join(path.dirname(new URL(import.meta.url).pathname), "_fixtures", name);
}

function createGitOps(options: MarketplaceGitOpsSeed = {}) {
  const remoteRefs = Object.fromEntries(
    Object.entries(options.remoteRefs ?? {}).map(([ref, oid]) => [
      ref.replace(/^refs\/remotes\/origin\//, ""),
      oid,
    ]),
  );
  const git = createGitOpsFake({
    boundary: "memory",
    remoteRefs,
    localRefs: { ...(options.remoteRefs ?? {}), ...(options.localRefs ?? {}) },
    ...(options.localRefs?.["refs/heads/main"] === undefined
      ? {}
      : { initialOid: options.localRefs["refs/heads/main"] }),
    ...(options.fetchThrows === undefined ? {} : { fetchError: options.fetchThrows }),
    ...(options.checkoutThrows === undefined ? {} : { checkoutError: options.checkoutThrows }),
  });

  if (options.currentBranchOverride !== undefined) {
    git.state.branch = options.currentBranchOverride ?? undefined;
  }

  const gitOps: typeof git.gitOps = {
    ...git.gitOps,
    async fetch(fetchOptions): Promise<void> {
      await git.gitOps.fetch(fetchOptions);
      if (
        fetchOptions.ref !== undefined &&
        /^[a-f0-9]{40}$/i.test(fetchOptions.ref) &&
        options.remoteRefs?.[`refs/remotes/origin/${fetchOptions.ref}`] === undefined
      ) {
        Reflect.deleteProperty(git.state.localRefs, `refs/remotes/origin/${fetchOptions.ref}`);
      }
    },
  };

  return {
    ...git,
    gitOps,
    state: Object.assign(git.state, {
      cloneCalls: git.state.calls.clone,
      fetchCalls: git.state.calls.fetch,
      forceUpdateRefCalls: git.state.calls.forceUpdateRef,
      checkoutCalls: git.state.calls.checkout,
      resolveRefCalls: git.state.calls.resolveRef,
      currentBranchCalls: git.state.calls.currentBranch,
      resolveRemoteRefCalls: git.state.calls.resolveRemoteRef,
    }),
  };
}

function createCredentialOps(
  options: { readonly store?: ReadonlyMap<string, GitCredentials> } = {},
) {
  const credentials = createCredentialOpsFake({
    boundary: "memory",
    credentials: [...(options.store ?? new Map()).entries()],
  });
  return {
    credOps: credentials.credentialOps,
    state: {
      fillCalls: credentials.calls.fill,
      approveCalls: credentials.calls.approve,
      rejectCalls: credentials.calls.reject,
    },
  };
}

function makeForbiddenGitOps(): { readonly calls: Array<keyof GitOps>; readonly gitOps: GitOps } {
  const calls: Array<keyof GitOps> = [];
  const reject = (operation: keyof GitOps): Promise<never> => {
    calls.push(operation);
    return Promise.reject(new Error(`Unexpected Git operation: ${operation}`));
  };

  return {
    calls,
    gitOps: {
      checkout: () => reject("checkout"),
      clone: () => reject("clone"),
      currentBranch: () => reject("currentBranch"),
      fetch: () => reject("fetch"),
      forceUpdateRef: () => reject("forceUpdateRef"),
      resolveRef: () => reject("resolveRef"),
      resolveRemoteRef: () => reject("resolveRemoteRef"),
      listRemotes: () => reject("listRemotes"),
    },
  };
}

function createDeviceFlowHttp() {
  return createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: {
      device_code: "device-code",
      user_code: "user-code",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
  });
}

interface NotifyRecord {
  message: string;
  severity?: Severity;
}

/**
 * A recording context and the command's run. D-05: every emission renders
 * from the run's snapshot, which reports no companion loaded.
 */
function makeCtx(): {
  ctx: NotificationContext;
  run: NotificationRun;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx: NotificationContext = {
    mode: "tui",
    ui: {
      notify(message: string, severity?: Severity): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  return { ctx, run: runWithNothingLoaded(), notifications };
}

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  return withHermeticEnvironment("mp-update-", ({ cwd, home }) => fn({ cwd, home }));
}

/**
 * Construct a github ParsedSource via the public funnel. The factory
 * accepts a single `https://github.com/<owner>/<repo>[#<ref>]` URL;
 * tests synthesize a stable owner/repo and append the optional fragment.
 */
function makeGithubSource(ref?: string): ReturnType<typeof githubSource> {
  const url = `https://github.com/anthropics/claude-plugins-official${ref === undefined ? "" : `#${ref}`}`;
  return githubSource(url);
}

async function seedGithubMarketplace(opts: {
  cwd: string;
  name: string;
  ref?: string;
  autoupdate?: boolean;
  plugins?: Record<string, ExtensionState["marketplaces"][string]["plugins"][string]>;
  fixture?: "valid-marketplace" | "invalid-manifest";
  legacy?: boolean;
  lastSuccessfulManifest?: string;
}): Promise<{ cloneDir: string }> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  // Pre-populate cloneDir with the fixture so the post-refresh manifest
  // read+validate can be exercised.
  await cp(fixtureMarketplaceDir(opts.fixture ?? "valid-marketplace"), cloneDir, {
    recursive: true,
  });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: makeGithubSource(opts.ref),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: opts.plugins ?? {},
        ...(opts.legacy === true
          ? {}
          : { lastSuccessfulManifest: opts.lastSuccessfulManifest ?? VALID_MANIFEST_JSON }),
        ...(opts.autoupdate !== undefined && { autoupdate: opts.autoupdate }),
      },
    },
  });
  // SPLIT-01: autoupdate lives in claude-plugins.json.
  // The state-side autoupdate above is harmless legacy seeding (D-13 scrubs
  // on next loadState once the config exists); seed the config too so the
  // SPLIT-01-rewired orchestrators (update.ts reads via loadMergedScopeConfig)
  // observe the autoupdate truth.
  if (opts.autoupdate !== undefined) {
    await saveConfig(
      locations.baseConfigJsonPath,
      {
        schemaVersion: 1,
        marketplaces: {
          [opts.name]: {
            source: "anthropics/claude-plugins-official",
            autoupdate: opts.autoupdate,
          },
        },
      },
      locations.scopeRoot,
    );
  }

  return { cloneDir };
}

async function seedUrlMarketplace(opts: {
  cwd: string;
  name: string;
  ref?: string;
  host?: string;
  lastSuccessfulManifest?: string;
}): Promise<{ cloneDir: string }> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
  const rawUrl = `https://${opts.host ?? "gitlab.example.com"}/team/${opts.name}${
    opts.ref === undefined ? "" : `#${opts.ref}`
  }`;
  const urlSrc = parsePluginSource(rawUrl);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: urlSrc,
        addedFromCwd: opts.cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: {},
        ...(opts.lastSuccessfulManifest !== undefined && {
          lastSuccessfulManifest: opts.lastSuccessfulManifest,
        }),
      },
    },
  });
  return { cloneDir };
}

function makePluginRecord(): ExtensionState["marketplaces"][string]["plugins"][string] {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

for (const mode of ["json", "rpc"]) {
  test(`joins cascade children under the marketplace invocation in ${mode}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedGithubMarketplace({
        cwd,
        name: "auto-mp",
        ref: "main",
        autoupdate: true,
        plugins: { hello: makePluginRecord(), second: makePluginRecord() },
      });
      const capture = createJsonCapture();
      const events: unknown[] = [];
      const origin = {
        kind: "command",
        commandId: "marketplace update",
        invocationId: "cascade-run",
      } as const;
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };
      const run = openNotificationRun(
        {
          getAllTools: () => [],
          getCommands: () => [],
          appendEntry(customType, payload) {
            capture.entrySink.appendEntry(customType, payload);
            events.push({ customType, payload });
          },
        },
        origin,
      );
      let started!: () => void;
      const childStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000004" },
      });
      const pluginUpdate: PluginUpdateFn = async (plugin, marketplace, scope) => {
        events.push({ plugin, marketplace, scope });
        started();
        await pending;
        return {
          partition: "updated",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.2",
          stagedAgentNames: [],
          stagedMcpServerNames: [],
          declaresAgents: false,
          declaresMcp: false,
          declaresWorkflows: false,
          constraint: undefined,
        };
      };

      const entry = {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin,
          kind: "cascade",
          severity: "info",
          needsReload: true,
          marketplaces: [
            {
              name: "auto-mp",
              scope: "project",
              status: "updated",
              plugins: ["hello", "second"].map((name) => ({
                name,
                id: `${name}@auto-mp`,
                scope: "project",
                status: "updated",
                from: "0.0.1",
                to: "0.0.2",
                reasons: [],
              })),
            },
          ],
        },
      };

      // act
      const update = updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "auto-mp",
        scope: "project",
        cwd,
        gitOps,
        pluginUpdate,
      }).then(() => {
        events.push("settled");
      });
      await childStarted;
      const beforeRelease = [...events];
      release();
      await update;

      // assert
      assert.deepStrictEqual(beforeRelease, [
        { plugin: "hello", marketplace: "auto-mp", scope: "project" },
      ]);
      assert.deepStrictEqual(events, [
        { plugin: "hello", marketplace: "auto-mp", scope: "project" },
        { plugin: "second", marketplace: "auto-mp", scope: "project" },
        entry,
        "settled",
      ]);
      assert.deepStrictEqual(capture.entries, [entry]);
      capture.assertValid();
    });
  });
}

/**
 * Read one installed plugin record straight off disk. Used to compare a record
 * before and after an operation that must not write to it.
 */
async function readPluginRecord(
  extensionRoot: string,
  marketplace: string,
  plugin: string,
): Promise<ExtensionState["marketplaces"][string]["plugins"][string] | undefined> {
  const state = await loadState(extensionRoot);
  return state.marketplaces[marketplace]?.plugins[plugin];
}

test("marketplace update transport: classifies a providerless HTTP 403 as authentication required", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedUrlMarketplace({ cwd, name: "urlmp-403", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const transportError = Object.assign(new Error("HTTP 403 from fetch"), {
      code: "HttpError",
      data: { statusCode: 403 },
    });
    const { gitOps, state } = createGitOps({ fetchThrows: transportError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-403",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ urlmp-403 [project] (failed)\n  ⊘ urlmp-403 (failed) {authentication required}\n    cause: Failed to update marketplace \"urlmp-403\". -> HTTP 403 from fetch -> no credential was obtained for gitlab.example.com; store one with: printf 'protocol=https\\nhost=gitlab.example.com\\nusername=<user>\\npassword=<token>\\n\\n' | git credential approve",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(state.fetchCalls, [
      {
        dir: cloneDir,
        remote: "origin",
        ref: "main",
        auth: {
          credentialOps,
          host: "gitlab.example.com",
          kind: "stored-credential",
        },
      },
    ]);
  });
});

test("marketplace update transport: names the status and URL of a providerless HTTP 500 as a network error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedUrlMarketplace({ cwd, name: "urlmp-500", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const transportError = Object.assign(new Error("HTTP 500 from fetch"), {
      code: "HttpError",
      data: { statusCode: 500 },
    });
    const { gitOps, state } = createGitOps({ fetchThrows: transportError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-500",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ urlmp-500 [project] (failed)\n  ⊘ urlmp-500 (failed) {network error}\n    cause: 500 on https://gitlab.example.com/team/urlmp-500 -> HTTP 500 from fetch",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(state.fetchCalls, [
      {
        dir: cloneDir,
        remote: "origin",
        ref: "main",
        auth: {
          credentialOps,
          host: "gitlab.example.com",
          kind: "stored-credential",
        },
      },
    ]);
  });
});

test("marketplace update transport: names a 404 answer as a network error with its URL credentials redacted", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({
      cwd,
      name: "urlmp-404",
      ref: "main",
      host: "user:secret@gitlab.example.com",
    });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const transportError = Object.assign(new Error("HTTP 404 from fetch"), {
      code: "HttpError",
      data: { statusCode: 404 },
    });
    const { gitOps } = createGitOps({ fetchThrows: transportError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-404",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ urlmp-404 [project] (failed)\n  ⊘ urlmp-404 (failed) {network error}\n    cause: 404 on https://***@gitlab.example.com/team/urlmp-404 -> HTTP 404 from fetch",
        severity: "error",
      },
    ]);
  });
});

test("marketplace update transport: renders a non-Error rejection with no reason", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedUrlMarketplace({ cwd, name: "urlmp-string", ref: "main" });
    const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    const manifestBytes = await readFile(manifestPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const git = createGitOps();
    const gitOps: GitOps = {
      ...git.gitOps,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the primitive rejection is the contract under test.
      fetch: () => Promise.reject("transport exploded (string reject)"),
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-string",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urlmp-string [project] (failed)\n  ⊘ urlmp-string (failed)\n    cause: Failed to update marketplace "urlmp-string". -> transport exploded (string reject)',
        severity: "error",
      },
    ]);
    assert.strictEqual(await readFile(manifestPath, "utf8"), manifestBytes);
  });
});

test("marketplace update transport: leaves Device Flow idle for a public URL refresh", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedUrlMarketplace({ cwd, name: "urlmp-device", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const remoteOid = "abcdef0000000000000000000000000000000011";
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": remoteOid },
    });
    const { credOps: credentialOps, state: credentialState } = createCredentialOps();
    const deviceFlow = createDeviceFlowHttp();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-device",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
      deviceFlowHttp: deviceFlow.http,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● urlmp-device [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(state.fetchCalls, [
      {
        dir: cloneDir,
        remote: "origin",
        ref: "main",
        auth: {
          credentialOps,
          host: "gitlab.example.com",
          kind: "stored-credential",
        },
      },
    ]);
    assert.deepStrictEqual(credentialState, {
      fillCalls: [],
      approveCalls: [],
      rejectCalls: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
  });
});

test("marketplace update transport: carries the GitHub auth bundle without invoking Device Flow", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedGithubMarketplace({
      cwd,
      name: "official-device",
      ref: "main",
    });
    const { ctx, run, notifications } = makeCtx();
    const remoteOid = "abcdef0000000000000000000000000000000012";
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": remoteOid },
    });
    const { credOps: credentialOps, state: credentialState } = createCredentialOps();
    const deviceFlow = createDeviceFlowHttp();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official-device",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
      deviceFlowHttp: deviceFlow.http,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● official-device [project] (skipped) {up-to-date}" },
    ]);
    assert.strictEqual(state.fetchCalls.length, 1);
    assert.deepStrictEqual(
      {
        dir: state.fetchCalls[0]?.dir,
        host: state.fetchCalls[0]?.auth?.host,
        credentialOps: state.fetchCalls[0]?.auth?.credentialOps,
        ref: state.fetchCalls[0]?.ref,
        remote: state.fetchCalls[0]?.remote,
      },
      { dir: cloneDir, host: "github.com", credentialOps, ref: "main", remote: "origin" },
    );
    assert.strictEqual(state.fetchCalls[0]?.auth?.kind, "device-flow");
    assert.deepStrictEqual(credentialState, {
      fillCalls: [],
      approveCalls: [],
      rejectCalls: [],
    });
    assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
  });
});

test("CMC-10 + MU-1: bare form against empty scope succeeds with `(no marketplaces)` EmptyToken and NO reload hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      scope: "project",
      cwd,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "(no marketplaces)" }]);
  });
});

test("MU-4 + D-14: github source refreshes via fetch+forceUpdateRef+checkout in that order", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    // D-14 sequence: fetch first, then forceUpdateRef, then checkout.
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 1);
    assert.equal(state.checkoutCalls.length, 1);
    // forceUpdateRef sets local branch to the remote SHA.
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, "abcdef0000000000000000000000000000000001");
    // UXG-05: this github-source refresh re-validates the SAME fixture manifest
    // (the mock git ops advance the clone ref but do NOT change file content),
    // so the validated marketplace.json content is byte-identical pre/post and
    // the autoupdate-OFF path renders the no-op `(skipped) {up-to-date}` (NOT
    // `(updated)`). Source-kind-uniform: the github no-op is detected the same
    // way as the path-source no-op. Catalog UAT state `update-no-op-skipped`.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // mp.status === "skipped" with the benign reason `up-to-date` (in
    // BENIGN_REASONS) routes to info via computeSeverity (UXG-02 / D-28-06/07).
    assert.equal(first.severity, undefined);
    // SNM-33 / D-22-01 (G-MIL-06): no plugin children -> no Pi-visible resource
    // change -> NO `/reload` trailer (UXG-05 is orthogonal to the reload-hint).
    assert.equal(first.message, "● official [project] (skipped) {up-to-date}");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("MURL-03 + D-14: url source refreshes via fetch+forceUpdateRef+checkout carrying its host-keyed auth bundle", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp", ref: "main" });
    const { ctx, run } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert

    // Same atomic-swap path as github: fetch -> forceUpdateRef -> checkout.
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 1);
    assert.equal(state.checkoutCalls.length, 1);
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, "abcdef0000000000000000000000000000000009");

    // GAUTH-03: the url refresh passes a bundle bound to the source's host, so
    // the credential helper is consulted when the server challenges.
    const fetchedAuth = state.fetchCalls[0]?.auth;
    assert.deepStrictEqual(fetchedAuth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
  });
});

test("GHB-04: updating a url marketplace ignores an invalid override", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    await seedUrlMarketplace({ cwd, name: "urlmp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● urlmp [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(
      state.forceUpdateRefCalls.map(({ ref, value }) => ({ ref, value })),
      [{ ref: "refs/heads/main", value: "abcdef0000000000000000000000000000000009" }],
    );
    assert.deepStrictEqual(
      state.fetchCalls.map(({ auth }) => auth),
      [{ credentialOps, host: "gitlab.example.com", kind: "stored-credential" }],
    );
  });
});

test("MURL-03: unpinned url refresh follows the default-branch head-advance path (same as unpinned github)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-default" });
    const { ctx, run } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const remoteSha = "abcdef0000000000000000000000000000000010";
    const { gitOps, state } = createGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      localRefs: { "refs/heads/main": "0000000000000000000000000000000000000001" },
      currentBranchOverride: "main",
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-default",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert

    // Default-branch head-advance path (same as unpinned github): resolveRef
    // refs/remotes/origin/HEAD -> currentBranch -> forceUpdateRef -> checkout.
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 1);
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, remoteSha);
    const fetchedAuth = state.fetchCalls[0]?.auth;
    assert.deepStrictEqual(fetchedAuth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
  });
});

test("GAUTH-04: a cancelled credential lookup on a host with no Device Flow renders {authentication required} plus the stored-credential cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-private", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    // An empty credential helper makes onAuth return `{ cancel: true }`, which
    // isomorphic-git throws as UserCanceledError -- NOT an HttpError 401/403.
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps, state } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-private",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    const fetchedAuth = state.fetchCalls[0]?.auth;
    assert.deepStrictEqual(fetchedAuth, {
      credentialOps,
      host: "gitlab.example.com",
      kind: "stored-credential",
    });
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ urlmp-private [project] (failed)\n  ⊘ urlmp-private (failed) {authentication required}\n    cause: Failed to update marketplace \"urlmp-private\". -> cancelled -> no credential was obtained for gitlab.example.com; store one with: printf 'protocol=https\\nhost=gitlab.example.com\\nusername=<user>\\npassword=<token>\\n\\n' | git credential approve",
        severity: "error",
      },
    ]);
  });
});

test("GAUTH-04: a 401 challenge on a host with no Device Flow carries the same stored-credential cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-401", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    // Duck-typed isomorphic-git HttpError: code === "HttpError",
    // data.statusCode carries the HTTP status (mirrors D-76-08). A 403 never
    // invokes onAuth at all, so both identities must reach the cause line.
    const httpErr = Object.assign(new Error("HTTP 401 from fetch"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = createGitOps({ fetchThrows: httpErr });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-401",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ urlmp-401 [project] (failed)\n  ⊘ urlmp-401 (failed) {authentication required}\n    cause: Failed to update marketplace \"urlmp-401\". -> HTTP 401 from fetch -> no credential was obtained for gitlab.example.com; store one with: printf 'protocol=https\\nhost=gitlab.example.com\\nusername=<user>\\npassword=<token>\\n\\n' | git credential approve",
        severity: "error",
      },
    ]);
  });
});

test("GAUTH-04: a transport error that already carries a cause keeps its own chain", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-chained", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const authError = Object.assign(new Error("cancelled"), {
      code: "UserCanceledError",
      cause: new Error("helper exited 128"),
    });
    const { gitOps } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-chained",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urlmp-chained [project] (failed)\n  ⊘ urlmp-chained (failed) {authentication required}\n    cause: Failed to update marketplace "urlmp-chained". -> cancelled -> helper exited 128',
        severity: "error",
      },
    ]);
  });
});

test("Q-02: a challenge after a cross-origin redirect keeps its own cause without the stored-credential line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-redirect", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps } = createGitOps({
      fetchThrows: new CrossOriginChallengeError("https://sso.example.com"),
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-redirect",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urlmp-redirect [project] (failed)\n  ⊘ urlmp-redirect (failed) {authentication required}\n    cause: Failed to update marketplace "urlmp-redirect". -> redirected request to https://sso.example.com asked for credentials; a credential is not sent after a redirect to another origin',
        severity: "error",
      },
    ]);
  });
});

test("GAUTH-04: a stored credential that a host with no Device Flow rejects renders {authentication required} without the stored-credential cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urlmp-rejected", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps } = createGitOps({
      fetchThrows: new StoredCredentialRejectedError("gitlab.example.com"),
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-rejected",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urlmp-rejected [project] (failed)\n  ⊘ urlmp-rejected (failed) {authentication required}\n    cause: Failed to update marketplace "urlmp-rejected". -> gitlab.example.com rejected the stored credential',
        severity: "error",
      },
    ]);
  });
});

test("GAUTH-05: a cancelled Device Flow on a github.com url refresh renders {authentication required} with NO stored-credential cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // The case-sensitive github.com prefix check leaves this a `url` source,
    // but URL host parsing lowercases it to the provider-registered host.
    await seedUrlMarketplace({ cwd, name: "urlmp-github", ref: "main", host: "GitHub.com" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps, state } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlmp-github",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    const fetchedAuth = state.fetchCalls[0]?.auth;
    assert.ok(fetchedAuth?.kind === "device-flow");
    assert.deepStrictEqual(fetchedAuth, {
      credentialOps,
      host: "github.com",
      kind: "device-flow",
      onAuthRequired: fetchedAuth.onAuthRequired,
    });
    // On a registry host the story is a declined or expired Device Flow, not a
    // missing stored credential, so no cause line is attached.
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urlmp-github [project] (failed)\n  ⊘ urlmp-github (failed) {authentication required}\n    cause: Failed to update marketplace "urlmp-github". -> cancelled',
        severity: "error",
      },
    ]);
  });
});

test("GAUTH-02: a declined/failed Device Flow (UserCanceledError) on refresh renders {authentication required}, not the lying {network unreachable}", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "declined", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    // A denied/expired Device Flow (or a poll network error) makes
    // platform/git.ts's onAuth return `{ cancel: true }`, which
    // isomorphic-git throws as `UserCanceledError` -- NOT an HttpError
    // 401/403 and NOT a network errno.
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "declined",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /\(failed\) \{authentication required\}/);
    assert.doesNotMatch(first.message, /\{network unreachable\}/);
  });
});

test("UXG-05: github-source refresh whose manifest content CHANGES renders `(updated)` (change detected, source-kind-uniform)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "official", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000003" },
    });

    // Wrap the mock so that AFTER checkout (the point a real fetch+checkout
    // would have advanced the working tree) the clone dir's marketplace.json
    // carries DIFFERENT validated content than the pre-refresh persisted
    // manifest. The change detector compares parsed/validated content pre vs
    // post, so a genuine content change must render `(updated)`.
    const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    const changedGitOps: typeof gitOps = {
      ...gitOps,
      async checkout(opts): Promise<void> {
        await gitOps.checkout(opts);
        // Overwrite with a schema-valid manifest that differs in content
        // (an added plugin entry) so the post-refresh content key differs.
        await writeFile(
          manifestPath,
          JSON.stringify({
            name: "official",
            plugins: [{ name: "newly-added", source: "./newly-added" }],
          }),
          "utf8",
        );
      },
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps: changedGitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    // Content changed -> `(updated)`, severity success (undefined), no reload
    // trailer (no plugin children). Catalog UAT state `manifest-refresh-changed`.
    assert.equal(first.severity, undefined);
    assert.equal(first.message, "● official [project] (updated)");
    assert.equal(first.message.includes("/reload to pick up changes"), false);
  });
});

test("UXG-05: path-source refresh whose local manifest is UNCHANGED renders the no-op `(skipped) {up-to-date}` (info per UXG-02 / D-28-06/07, no trailer)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Seed a path-source marketplace pointing at a real on-disk fixture. A
    // path source never advances a git SHA, so it is ALWAYS a no-op unless the
    // local marketplace.json file itself changed -- exactly the case UXG-05's
    // content-compare detects (path sources are the common no-op).
    const localMpDir = fixtureMarketplaceDir("valid-marketplace");
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "local-mp": {
          name: "local-mp",
          scope: "project",
          source: pathSource(localMpDir),
          addedFromCwd: cwd,
          manifestPath: path.join(localMpDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: localMpDir,
          plugins: {},
          lastSuccessfulManifest: VALID_MANIFEST_JSON,
        },
      },
    });
    const { ctx, run, notifications } = makeCtx();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "local-mp",
      scope: "project",
      cwd,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● local-mp [project] (skipped) {up-to-date}" },
    ]);
  });
});

test("CR-01 / D-14 default-branch: forceUpdateRef target is refs/heads/<branch>, NOT the HEAD SHA", async () => {
  // Default-branch tracking (storedRef === undefined): the seeded
  // marketplace has no `ref` fragment. The refresh path must read the
  // symbolic branch name via gitOps.currentBranch(), then
  // forceUpdateRef("refs/heads/<branch>", remoteSha) -- NOT
  // resolveRef("HEAD") (which returns a SHA) as the ref argument, which
  // would produce a meaningless `refs/<40-hex>` write.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "defaultbranch" });
    const { ctx, run } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000a";
    const { gitOps, state } = createGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      localRefs: { "refs/heads/main": "0000000000000000000000000000000000000001" },
      currentBranchOverride: "main",
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "defaultbranch",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    // currentBranch was consulted (CR-01 contract).
    assert.equal(state.currentBranchCalls.length, 1);
    // forceUpdateRef received the symbolic-name form, NOT a 40-hex SHA.
    assert.equal(state.forceUpdateRefCalls.length, 1);
    const fur = state.forceUpdateRefCalls[0];
    assert.ok(fur !== undefined);
    assert.equal(fur.ref, "refs/heads/main");
    assert.equal(fur.value, remoteSha);
    assert.equal(/^[a-f0-9]{40}$/i.test(fur.ref), false, "ref must NOT be a raw SHA");
    // Checkout is by branch name, not SHA.
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, "main");
  });
});

test("CR-01 / D-14 default-branch: detached HEAD -> checkout SHA directly, no forceUpdateRef", async () => {
  // When currentBranch() returns undefined (detached HEAD), the refresh
  // path must NOT write any local ref -- there is no symbolic branch
  // to advance. It checks out the remote SHA directly.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "detached" });
    const { ctx, run } = makeCtx();
    const remoteSha = "abcdef000000000000000000000000000000000b";
    const { gitOps, state } = createGitOps({
      remoteRefs: {
        "refs/remotes/origin/HEAD": remoteSha,
        "refs/remotes/origin/main": remoteSha,
      },
      currentBranchOverride: null, // null = detached HEAD
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "detached",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(state.currentBranchCalls.length, 1);
    assert.equal(state.forceUpdateRefCalls.length, 0, "detached HEAD must NOT write local ref");
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, remoteSha);
  });
});

test("D-14: detached-HEAD path checks out SHA directly without forceUpdateRef", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const sha = "abcdef0000000000000000000000000000000002";
    await seedGithubMarketplace({ cwd, name: "pinned", ref: sha });
    const { ctx, run } = makeCtx();
    // Mock has the SHA available as a 40-char hex; resolveRef of
    // refs/remotes/origin/<sha> will throw (no such branch), forcing
    // the detached path.
    const { gitOps, state } = createGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "pinned",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    // forceUpdateRef should NOT have been called for detached-HEAD.
    assert.equal(state.forceUpdateRefCalls.length, 0);
    // checkout WAS called with the SHA.
    assert.equal(state.checkoutCalls.length, 1);
    const co = state.checkoutCalls[0];
    assert.ok(co !== undefined);
    assert.equal(co.ref, sha);
  });
});

test("D-14: SHA-no-longer-exists (checkout throws) surfaces as notifyError with chained cause", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "rewritten", ref: "deadbeef" });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      checkoutThrows: new Error("mock: ref deadbeef no longer exists on remote"),
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "rewritten",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    // The marketplace header carries no cause (SNM-10), so the underlying
    // MarketplaceUpdateError is surfaced through a synthetic failed-plugin
    // child whose cause drives the depth-5 cause-chain trailer. The chain
    // carries the checkout-throw text the user needs to diagnose the
    // failure (MU-5); `err.retryHint` remains on MarketplaceUpdateError for
    // programmatic inspection.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ rewritten \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*ref deadbeef no longer exists on remote/);
  });
});

test("CR-05 / MU-5: pre-fetch failure (gitOps.fetch throws) does NOT append 'Retry the command.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "offline", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    // Simulate DNS / network-unreachable on fetch -- cloneAdvanced must
    // stay false, so the retry hint is suppressed.
    const { gitOps } = createGitOps({
      fetchThrows: new Error("mock: ENETUNREACH https://github.com"),
    });
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "offline",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    // The fetch-throw cause is surfaced through the synthetic failed-plugin
    // child's cause-chain trailer so the user sees the network failure. The
    // retry-hint suppression (cloneAdvanced=false on a pre-fetch throw) is a
    // property of MarketplaceUpdateError.retryHint, not the notify bytes; the
    // surfaced cause does not include the "Retry the command." anchor.
    assert.match(first.message, /^⊘ offline \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*ENETUNREACH/);
    assert.doesNotMatch(first.message, /Retry the command\./);
  });
});

/** Every file under `dir` with its bytes, keyed by its path relative to `dir`. */
async function directoryBytes(dir: string): Promise<Map<string, Buffer>> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
  return new Map(
    await Promise.all(
      files.map(async (file) => [path.relative(dir, file), await readFile(file)] as const),
    ),
  );
}

test("D-PL8-24: a refresh whose fetch is aborted leaves state.json, the clone, and the state lock as they were", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "offline", ref: "main" });
    const locations = locationsFor("project", cwd);
    const stateBefore = await readFile(locations.stateJsonPath);
    const cloneBefore = await directoryBytes(cloneDir);
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      fetchThrows: new DOMException("This operation was aborted", "AbortError"),
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "offline",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    assert.deepStrictEqual(await directoryBytes(cloneDir), cloneBefore);
    assert.strictEqual(await pathExists(locations.stateLockFile), false);
  });
});

test("MU-5: clone advances + manifest re-validation fails -- 'Retry the command.' retry hint", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Seed with a VALID manifest and its saved baseline. The clone-advanced + POST-revalidation-fails path under test is reached
    // by overwriting the manifest with INVALID content in the checkout override
    // (mirrors the UXG-05 "changed" test's checkout-rewrite pattern).
    const { cloneDir } = await seedGithubMarketplace({ cwd, name: "broken" });

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/HEAD": "abcdef0000000000000000000000000000000003" },
      localRefs: { HEAD: "abcdef0000000000000000000000000000000003" },
    });
    const brokenGitOps: typeof gitOps = {
      ...gitOps,
      async checkout(opts): Promise<void> {
        await gitOps.checkout(opts);
        // After the clone advances (fetch + checkout), the working-tree
        // manifest is INVALID, so the read of the recorded manifest throws ->
        // MarketplaceUpdateError with the "clone advanced but manifest could
        // not be persisted" diagnostic.
        await cp(fixtureMarketplaceDir("invalid-manifest"), cloneDir, { recursive: true });
      },
    };
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "broken",
      scope: "project",
      cwd,
      gitOps: brokenGitOps,
    });

    // assert

    // Clone advanced + manifest re-read failed: the synthetic failed-plugin
    // child surfaces the underlying MarketplaceUpdateError cause-chain so the
    // user sees what failed (the "clone advanced but manifest could not be
    // persisted" diagnostic, MU-5). The literal "Retry the command." anchor
    // stays on MarketplaceUpdateError.retryHint (a separate field) for
    // programmatic inspection; the cause chain renders the error message only.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ broken \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*clone advanced but manifest could not be persisted/);
  });
});

test("CR-05 / MU-5: url-source pre-fetch failure (gitOps.fetch throws) does NOT append 'Retry the command.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedUrlMarketplace({ cwd, name: "urloffline" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    // cloneAdvanced stays false because onFetchSucceeded never fires.
    const { gitOps } = createGitOps({
      fetchThrows: Object.assign(new Error("mock: ENETUNREACH https://gitlab.example.com"), {
        code: "ENETUNREACH",
      }),
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urloffline",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ urloffline [project] (failed)\n  ⊘ urloffline (failed) {network unreachable}\n    cause: Failed to update marketplace "urloffline". -> mock: ENETUNREACH https://gitlab.example.com',
        severity: "error",
      },
    ]);
  });
});

test("MU-5: url-source clone advances + manifest re-validation fails -- 'clone advanced' diagnostic", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedUrlMarketplace({ cwd, name: "urlbroken" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/HEAD": "abcdef0000000000000000000000000000000003" },
      localRefs: { HEAD: "abcdef0000000000000000000000000000000003" },
    });
    const brokenGitOps: typeof gitOps = {
      ...gitOps,
      async checkout(opts): Promise<void> {
        await gitOps.checkout(opts);
        // The fetch succeeded (cloneAdvanced via onFetchSucceeded), then the
        // working-tree manifest turns INVALID so the POST re-validation throws.
        await cp(fixtureMarketplaceDir("invalid-manifest"), cloneDir, { recursive: true });
      },
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "urlbroken",
      scope: "project",
      cwd,
      gitOps: brokenGitOps,
      credentialOps,
    });

    // assert
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ urlbroken \[project\] \(failed\)$/m);
    assert.match(first.message, /cause:.*clone advanced but manifest could not be persisted/);
  });
});

test("WR-02: corrupt pre-existing manifest routes to (failed), never a silent no-op (UAT Test-3 robustness fold-in)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Seed a valid clone, then overwrite the manifest with malformed JSON that
    // the fetch does not repair. The corrupt pre-fetch manifest gives no
    // comparison, and the fetched manifest still fails validation, so the
    // refresh routes to (failed) -- never a silent (updated) or up-to-date.
    const { cloneDir } = await seedGithubMarketplace({
      cwd,
      name: "corrupt",
      ref: "main",
      legacy: true,
    });
    await writeFile(
      path.join(cloneDir, ".claude-plugin", "marketplace.json"),
      "{ not valid json",
      "utf8",
    );

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000123" },
    });
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "corrupt",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /^⊘ corrupt \[project\] \(failed\)/m);
    assert.doesNotMatch(first.message, /\(updated\)/);
    assert.doesNotMatch(first.message, /\(skipped\) \{up-to-date\}/);
  });
});

test("a legacy git record whose manifest cannot be read fails the update instead of recovering", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedGithubMarketplace({
      cwd,
      name: "unreadable",
      ref: "main",
      legacy: true,
    });
    const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    await rm(manifestPath);
    await mkdir(manifestPath);
    const { ctx, run, notifications } = makeCtx();
    const git = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000123" },
    });
    let fetchCalls = 0;
    const gitOps: GitOps = {
      ...git.gitOps,
      async fetch(fetchOptions): Promise<void> {
        fetchCalls += 1;
        await git.gitOps.fetch(fetchOptions);
        await rm(manifestPath, { recursive: true });
        await writeFile(manifestPath, VALID_MANIFEST_JSON, "utf8");
      },
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "unreadable",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert
    assert.strictEqual(fetchCalls, 0);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /^⊘ unreadable \[project\] \(failed\)/m);
  });
});

test("a legacy git record with a corrupt on-disk manifest recovers once the fetch repairs it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { cloneDir } = await seedGithubMarketplace({
      cwd,
      name: "corrupt",
      ref: "main",
      legacy: true,
    });
    const manifestPath = path.join(cloneDir, ".claude-plugin", "marketplace.json");
    await writeFile(manifestPath, "{ not valid json", "utf8");
    const git = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000123" },
    });
    const gitOps: GitOps = {
      ...git.gitOps,
      async fetch(fetchOptions): Promise<void> {
        await git.gitOps.fetch(fetchOptions);
        await writeFile(manifestPath, VALID_MANIFEST_JSON, "utf8");
      },
    };
    const { ctx, run, notifications } = makeCtx();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "corrupt",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● corrupt [project] (updated)" }]);
    assert.strictEqual(
      (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.corrupt
        ?.lastSuccessfulManifest,
      VALID_MANIFEST_JSON,
    );
  });
});

for (const { kind, seed } of [
  {
    kind: "path",
    seed: async (cwd: string): Promise<void> => {
      const marketplaceRoot = path.join(cwd, "tools-source");
      await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
      await seedPathMarketplace({
        cwd,
        name: "tools",
        marketplaceRoot,
        lastSuccessfulManifest: "",
      });
    },
  },
  {
    kind: "github",
    seed: async (cwd: string): Promise<void> => {
      await seedGithubMarketplace({ cwd, name: "tools", ref: "main", lastSuccessfulManifest: "" });
    },
  },
  {
    kind: "url",
    seed: async (cwd: string): Promise<void> => {
      await seedUrlMarketplace({ cwd, name: "tools", ref: "main", lastSuccessfulManifest: "" });
    },
  },
]) {
  test(`a ${kind} marketplace with an unparseable saved manifest fails as unreadable before any fetch`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seed(cwd);
      const extensionRoot = locationsFor("project", cwd).extensionRoot;
      const recordBefore = (await loadState(extensionRoot)).marketplaces.tools;
      const { ctx, run, notifications } = makeCtx();
      const { calls, gitOps } = makeForbiddenGitOps();
      const { credOps: credentialOps } = createCredentialOps();
      let parseMessage = "";
      try {
        JSON.parse("");
      } catch (err) {
        parseMessage = (err as Error).message;
      }

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "tools",
        scope: "project",
        cwd,
        gitOps,
        credentialOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `Some operations have failed.\n\n⊘ tools [project] (failed)\n  ⊘ tools (failed) {unreadable}\n    cause: Failed to update marketplace "tools". -> The saved manifest of marketplace "tools" in state.json is unreadable. -> ${parseMessage}`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(calls, []);
      assert.deepStrictEqual((await loadState(extensionRoot)).marketplaces.tools, recordBefore);
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// ATTR-10 / D-48-B: a path-source marketplace.json that is malformed or
// schema-invalid during `marketplace update` renders `(failed) {unparseable}`
// or `(failed) {invalid manifest}` (MPA-02) on the synthetic-child failed row. The refresh
// classifier recognizes the typed InvalidMarketplaceManifestError, which
// refreshRecord wraps in a MarketplaceUpdateError. A path-source refresh
// touches no network (NFR-5), and a refresh failure that no rule classifies
// renders the failed row with no reason.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Seed a path-source marketplace pointing at an on-disk dir under the cwd.
 *
 * `scope`, `autoupdate`, and `plugins` are optional and each default to the
 * original behavior (project scope, no autoupdate entry, no installed plugins),
 * so every caller that omits them seeds exactly what it seeded before.
 */
async function seedPathMarketplace(opts: {
  cwd: string;
  name: string;
  marketplaceRoot: string;
  scope?: Scope;
  autoupdate?: boolean;
  plugins?: Record<string, ExtensionState["marketplaces"][string]["plugins"][string]>;
  legacy?: boolean;
  lastSuccessfulManifest?: string;
}): Promise<void> {
  const scope = opts.scope ?? "project";
  const locations = locationsFor(scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope,
        source: pathSource(opts.marketplaceRoot),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: opts.marketplaceRoot,
        plugins: opts.plugins ?? {},
        ...(opts.legacy === true
          ? {}
          : { lastSuccessfulManifest: opts.lastSuccessfulManifest ?? VALID_MANIFEST_JSON }),
        ...(opts.autoupdate !== undefined && { autoupdate: opts.autoupdate }),
      },
    },
  });

  // SPLIT-01: autoupdate lives in claude-plugins.json, so the state-side flag
  // above is not enough -- the orchestrators read it through
  // loadMergedScopeConfig. Mirror the github helper's paired config write.
  if (opts.autoupdate !== undefined) {
    await saveConfig(
      locations.baseConfigJsonPath,
      {
        schemaVersion: 1,
        marketplaces: {
          [opts.name]: { source: opts.marketplaceRoot, autoupdate: opts.autoupdate },
        },
      },
      locations.scopeRoot,
    );
  }
}

test("ATTR-10 / MPA-02: path-source MALFORMED-JSON manifest renders `(failed) {unparseable}`, never `{network unreachable}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // A real on-disk marketplace whose marketplace.json is malformed JSON. The
    // PRE manifestContentKey read throws InvalidMarketplaceManifestError (cause:
    // SyntaxError) -> refreshRecord wraps it as MarketplaceUpdateError -> the
    // refreshOneMarketplace catch unwraps one cause level and classifies
    // `unparseable`, as `list` and `info` do (MPA-02). Zero network/gitOps on
    // the path branch (NFR-5).
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-bad-json-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        "{ not valid json",
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "bad-json", marketplaceRoot: localMpDir });

      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps();
      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "bad-json",
        scope: "project",
        cwd,
        gitOps,
      });

      // assert

      assert.equal(notifications.length, 1);
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(first.severity, "error");
      assert.match(first.message, /\(failed\) \{unparseable\}/);
      assert.doesNotMatch(first.message, /\{network unreachable\}/);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("ATTR-10: path-source SCHEMA-INVALID manifest renders `(failed) {invalid manifest}`, never `{network unreachable}`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Valid JSON, but fails MARKETPLACE_VALIDATOR (missing required `plugins`
    // array / wrong shape) -> loadMarketplaceManifest throws
    // InvalidMarketplaceManifestError("marketplace.json schema invalid: ...").
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-bad-schema-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: 42, plugins: "not-an-array" }),
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "bad-schema", marketplaceRoot: localMpDir });

      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps();
      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "bad-schema",
        scope: "project",
        cwd,
        gitOps,
      });

      // assert

      assert.equal(notifications.length, 1);
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(first.severity, "error");
      assert.match(first.message, /\(failed\) \{invalid manifest\}/);
      assert.doesNotMatch(first.message, /\{network unreachable\}/);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("a pre-persistence manifest failure leaves cache rows intact and calls zero git operations", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // The failure path must not reach for the network either: for a path source,
    // refreshRecord only reads the recorded manifest (a readFile + parse), which
    // throws, and calls NO gitOps. Sibling of the success-path NFR-5 test.
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-path-fail-nfr5-"));
    try {
      await mkdir(path.join(localMpDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(localMpDir, ".claude-plugin", "marketplace.json"),
        "{ not valid json",
        "utf8",
      );
      await seedPathMarketplace({ cwd, name: "local-bad", marketplaceRoot: localMpDir });

      const { ctx, run, notifications } = makeCtx();
      const { gitOps, state } = createGitOps();
      const completionCache = createCompletionCache();
      const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
      // act
      await updateMarketplace({
        completionCache,
        ctx,
        run,
        name: "local-bad",
        scope: "project",
        cwd,
        gitOps,
      });

      // assert

      // The failed row classified `unparseable` (not a network reason).
      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.match(first.message, /\(failed\) \{unparseable\}/);

      // Zero gitOps -- the failure path is network-free.
      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
      assert.strictEqual(drop.mock.callCount(), 0);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

for (const { invalidBody, problem, failure } of [
  {
    problem: "malformed JSON",
    invalidBody: '{"name":"valid-marketplace","plugins":[',
    failure:
      'Some operations have failed.\n\n⊘ malformed-JSON [project] (failed)\n  ⊘ malformed-JSON (failed) {unparseable}\n    cause: Failed to update marketplace "malformed-JSON". -> marketplace.json is not valid JSON: SyntaxError: Unexpected end of JSON input -> Unexpected end of JSON input',
  },
  {
    problem: "an invalid schema",
    invalidBody: '{"name":"valid-marketplace","plugins":"not-an-array"}',
    failure:
      'Some operations have failed.\n\n⊘ an-invalid-schema [project] (failed)\n  ⊘ an-invalid-schema (failed) {invalid manifest}\n    cause: Failed to update marketplace "an-invalid-schema". -> marketplace.json schema invalid: /plugins: must be array',
  },
]) {
  test(`${problem} keeps durable update state until a repaired retry succeeds`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const name = problem.replaceAll(" ", "-");
      const marketplaceRoot = path.join(cwd, name);
      await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
      const installed = makePluginRecord();
      await seedPathMarketplace({
        cwd,
        name,
        marketplaceRoot,
        autoupdate: true,
        plugins: { hello: installed },
      });
      const locations = locationsFor("project", cwd);
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(manifestPath, invalidBody, "utf8");
      const beforeState = await loadState(locations.extensionRoot);
      const beforeConfig = await readFile(locations.baseConfigJsonPath, "utf8");
      const cascadeCalls: string[] = [];
      const pluginUpdate: PluginUpdateFn = (plugin) => {
        cascadeCalls.push(plugin);
        return Promise.resolve({
          partition: "unchanged",
          name: plugin,
          fromVersion: installed.version,
          toVersion: installed.version,
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      };

      const failed = makeCtx();
      const failedGit = makeForbiddenGitOps();

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx: failed.ctx,
        run: failed.run,
        name,
        scope: "project",
        cwd,
        gitOps: failedGit.gitOps,
        pluginUpdate,
      });
      const stateAfterFailure = await loadState(locations.extensionRoot);
      const callsAfterFailure = [...cascadeCalls];
      const repairedManifest = JSON.stringify({
        ...(JSON.parse(VALID_MANIFEST_JSON) as Record<string, unknown>),
        description: "Valid after a failed update",
      });
      assert.notStrictEqual(Buffer.byteLength(repairedManifest), Buffer.byteLength(invalidBody));
      await writeFile(manifestPath, repairedManifest, "utf8");
      const retried = makeCtx();
      const retryGit = makeForbiddenGitOps();
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx: retried.ctx,
        run: retried.run,
        name,
        scope: "project",
        cwd,
        gitOps: retryGit.gitOps,
        pluginUpdate,
      });
      const stateAfterRepair = await loadState(locations.extensionRoot);

      // assert
      assert.deepStrictEqual(failed.notifications, [{ message: failure, severity: "error" }]);
      assert.deepStrictEqual(callsAfterFailure, []);
      assert.deepStrictEqual(stateAfterFailure, beforeState);
      assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), beforeConfig);
      assert.deepStrictEqual(cascadeCalls, ["hello"]);
      assert.deepStrictEqual(retried.notifications, [
        { message: `● ${name} [project] (updated)\n  ⊘ hello (skipped) {up-to-date}` },
      ]);
      assert.strictEqual(
        stateAfterRepair.marketplaces[name]?.lastSuccessfulManifest,
        repairedManifest,
      );
      assert.deepStrictEqual(stateAfterRepair.marketplaces[name]?.plugins, { hello: installed });
      assert.deepStrictEqual(failedGit.calls, []);
      assert.deepStrictEqual(retryGit.calls, []);
    });
  });
}

test("a missing local source keeps its registration, baseline, config, and plugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "missing-source");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    const installed = makePluginRecord();
    await seedPathMarketplace({
      cwd,
      name: "missing-source",
      marketplaceRoot,
      autoupdate: true,
      plugins: { hello: installed },
    });
    const locations = locationsFor("project", cwd);
    const beforeState = await loadState(locations.extensionRoot);
    const beforeConfig = await readFile(locations.baseConfigJsonPath, "utf8");
    await rm(marketplaceRoot, { recursive: true });
    const cascadeCalls: string[] = [];
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "missing-source",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
      pluginUpdate: (plugin) => {
        cascadeCalls.push(plugin);
        return Promise.reject(new Error("the missing source must prevent this call"));
      },
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ missing-source [project] (failed)\n  ⊘ missing-source (failed) {source missing}\n    cause: Failed to update marketplace "missing-source". -> ENOENT: no such file or directory, open '${path.join(marketplaceRoot, ".claude-plugin", "marketplace.json")}'`,
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), beforeState);
    assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), beforeConfig);
    assert.deepStrictEqual(cascadeCalls, []);
    assert.deepStrictEqual(git.calls, []);
  });
});

test("an unclassified github fetch failure renders a failed row with no reason", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "ghnet", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      // A plain Error carries no errno code and no HTTP status, so no rule
      // names its cause and the row shows only the cause line.
      fetchThrows: new Error("mock: connection failed reaching github.com"),
    });
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "ghnet",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ ghnet [project] (failed)\n  ⊘ ghnet (failed)\n    cause: Failed to update marketplace "ghnet". -> mock: connection failed reaching github.com',
        severity: "error",
      },
    ]);
  });
});

for (const code of ["EACCES", "EPERM"] as const) {
  test(`a github fetch failing with ${code} renders the failed row as permission denied`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedGithubMarketplace({ cwd, name: "denied", ref: "main" });
      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps({
        fetchThrows: Object.assign(new Error(`${code}: clone write refused`), { code }),
      });

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "denied",
        scope: "project",
        cwd,
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `Some operations have failed.\n\n⊘ denied [project] (failed)\n  ⊘ denied (failed) {permission denied}\n    cause: Failed to update marketplace "denied". -> ${code}: clone write refused`,
          severity: "error",
        },
      ]);
    });
  });
}

test("autoupdate calls each installed plugin in record order", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // State order is the installation order. The refreshed manifest is not the
    // source of cascade targets.
    await seedGithubMarketplace({
      cwd,
      name: "auto-mp",
      ref: "main",
      autoupdate: true,
      plugins: { zeta: makePluginRecord(), alpha: makePluginRecord() },
    });
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000004" },
    });
    const calls: { plugin: string; marketplace: string }[] = [];
    const pluginUpdate: PluginUpdateFn = async (plugin, marketplace) => {
      calls.push({ plugin, marketplace });
      return Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "auto-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    assert.deepStrictEqual(calls, [
      { plugin: "zeta", marketplace: "auto-mp" },
      { plugin: "alpha", marketplace: "auto-mp" },
    ]);
  });
});

test("autoupdate ignores a newly declared plugin that has no installed record", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "mp-new-offer-"));
    try {
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      const baseline = JSON.stringify({
        name: "offers",
        plugins: [{ name: "existing", source: "./existing", version: "1.0.0" }],
      });
      const refreshed = JSON.stringify({
        name: "offers",
        plugins: [
          { name: "existing", source: "./existing", version: "1.0.0" },
          { name: "new", source: "./new", version: "1.0.0" },
        ],
      });
      await mkdir(path.dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, refreshed, "utf8");
      const installed = makePluginRecord();
      await seedPathMarketplace({
        cwd,
        name: "offers",
        marketplaceRoot,
        autoupdate: true,
        plugins: { existing: installed },
        lastSuccessfulManifest: baseline,
      });
      const calls: string[] = [];
      const { ctx, run, notifications } = makeCtx();

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "offers",
        scope: "project",
        cwd,
        pluginUpdate: (plugin) => {
          calls.push(plugin);
          return Promise.resolve({
            partition: "unchanged",
            name: plugin,
            fromVersion: installed.version,
            toVersion: installed.version,
            declaresAgents: false,
            declaresMcp: false,
            constraint: undefined,
            declaresWorkflows: false,
          });
        },
      });

      // assert
      assert.deepStrictEqual(calls, ["existing"]);
      assert.deepStrictEqual(
        (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.offers?.plugins,
        { existing: installed },
      );
      assert.deepStrictEqual(notifications, [
        { message: "● offers [project] (updated)\n  ⊘ existing (skipped) {up-to-date}" },
      ]);
    } finally {
      await rm(marketplaceRoot, { recursive: true, force: true });
    }
  });
});

test("autoupdate off never invokes a plugin update", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "manual-mp",
      ref: "main",
      autoupdate: false,
      plugins: { hello: makePluginRecord() },
    });
    const { ctx, run } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000005" },
    });
    let pluginUpdateCalled = false;
    const pluginUpdate: PluginUpdateFn = async () => {
      pluginUpdateCalled = true;
      return Promise.resolve({
        partition: "updated",
        name: "x",
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "manual-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    assert.equal(pluginUpdateCalled, false);
  });
});

for (const { name, expectedCalls } of [
  { name: "claude-plugins-official", expectedCalls: ["hello"] },
  { name: "knowledge-work-plugins", expectedCalls: [] },
  { name: "tools", expectedCalls: [] },
]) {
  test(`D-PL8-07: a marketplace named ${name} without a config value cascades to ${JSON.stringify(expectedCalls)}`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedGithubMarketplace({
        cwd,
        name,
        ref: "main",
        plugins: { hello: makePluginRecord() },
      });
      const { ctx, run } = makeCtx();
      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000005" },
      });
      const calls: string[] = [];
      const pluginUpdate: PluginUpdateFn = async (plugin) => {
        calls.push(plugin);
        return Promise.resolve({
          partition: "unchanged",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.1",
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      };

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name,
        scope: "project",
        cwd,
        gitOps,
        pluginUpdate,
      });

      // assert
      assert.deepStrictEqual(calls, expectedCalls);
    });
  });
}

test("autoupdate continues in installed order after an ordinary plugin failure", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const zeta = makePluginRecord();
    const alpha = { ...makePluginRecord(), version: "1.0.0" };
    await seedGithubMarketplace({
      cwd,
      name: "ordered",
      ref: "main",
      autoupdate: true,
      plugins: { zeta, alpha },
    });
    const locations = locationsFor("project", cwd);
    const before = await loadState(locations.extensionRoot);
    const calls: string[] = [];
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000010" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "ordered",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate: (plugin) => {
        calls.push(plugin);
        if (plugin === "zeta") {
          return Promise.reject(new Error("zeta update failed"));
        }

        return Promise.resolve({
          partition: "updated",
          name: plugin,
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
          stagedAgentNames: [],
          stagedMcpServerNames: [],
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      },
    });

    // assert
    assert.deepStrictEqual(calls, ["zeta", "alpha"]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● ordered [project] (updated)\n" +
          "  ⊘ zeta (failed) {unreadable manifest}\n" +
          "    cause: zeta update failed\n" +
          "  ● alpha v1.0.0 → v1.1.0 (updated)\n\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      (await loadState(locations.extensionRoot)).marketplaces.ordered?.plugins,
      before.marketplaces.ordered?.plugins,
    );
  });
});

// ─── LIFE-06 / D-98-13: the manifest-absent skip on the autoupdate cascade ────
//
// The skip has ONE origin -- the shared update preflight, which stamps
// `partition: "skipped"` with `reasons: ["not in manifest"]` for an installed
// record whose entry the refreshed manifest no longer lists. The cascade adds a
// second half: `cascadeAutoupdates` passes the outcome through untouched (only a
// THROW is caught and converted), and `outcomeToCascadePluginMessage` re-narrows
// it via `narrowSkipReason`. That narrower would also reach `not in manifest`
// from its permissive notes-substring fallback, so the case below pins the
// carry-through explicitly: the reason must survive because the preflight set
// it, not because the fallback guessed it.
//
// The cascade skip row carries NO version token -- the mapper's `skipped` arm
// forwards name, scope, and reasons only.

test("LIFE-06: cascade mapper carries a preflight `not in manifest` skip through, leaving the record untouched", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedGithubMarketplace({
      cwd,
      name: "auto-skip",
      ref: "main",
      autoupdate: true,
      plugins: { hello: makePluginRecord() },
    });

    const before = await readPluginRecord(locations.extensionRoot, "auto-skip", "hello");
    assert.ok(before !== undefined);

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });
    // The exact outcome shape the shared preflight produces for a record whose
    // manifest entry is gone: the recorded version as `fromVersion`, and the
    // reason ALREADY narrowed.
    const pluginUpdate: PluginUpdateFn = (plugin) =>
      Promise.resolve<PluginUpdateOutcome>({
        partition: "skipped",
        name: plugin,
        fromVersion: "0.0.1",
        notes: ["not in manifest"],
        reasons: ["not in manifest"],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "auto-skip",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.strictEqual(first.severity, "warning");
    assert.match(first.message, /^ {2}⊘ hello \(skipped\) \{not in manifest\}$/m);

    // A skipped plugin is a fixed point for the cascade: nothing is written, so
    // a repeated `marketplace update` finds the same record.
    assert.deepStrictEqual(
      await readPluginRecord(locations.extensionRoot, "auto-skip", "hello"),
      before,
    );
  });
});

test("LIFE-06: autoupdate cascade through the REAL single-plugin update renders `(skipped) {not in manifest}`", async () => {
  // Deliberately USER scope. `updateSinglePlugin` takes no cwd -- it reads
  // `process.cwd()` itself -- and `locationsFor("project", cwd)` composes
  // `<cwd>/.pi`, so a project-scope fixture under a temporary directory would
  // never be found by the real function. User-scope locations ignore the working
  // directory entirely and derive from the agent dir, which the hermetic home
  // controls. Do NOT "simplify" this back to project scope by changing the
  // process working directory: that setting is process-global and corrupts
  // sibling cases when a file's tests run concurrently.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "mp-e2e-skip-"));
    try {
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "0.0.1" }),
      );
      // The manifest DECLARES the entry at install time...
      await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "e2e-mp",
          plugins: [{ name: "hello", source: "./plugins/hello", version: "0.0.1" }],
        }),
      );

      await seedPathMarketplace({
        cwd,
        name: "e2e-mp",
        marketplaceRoot,
        scope: "user",
        autoupdate: true,
        plugins: { hello: makePluginRecord() },
      });

      // ...and the marketplace drops it afterwards.
      await writeFile(manifestPath, JSON.stringify({ name: "e2e-mp", plugins: [] }));

      const before = await readPluginRecord(locations.extensionRoot, "e2e-mp", "hello");
      assert.ok(before !== undefined);

      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps();
      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "e2e-mp",
        scope: "user",
        cwd,
        gitOps,
        // The REAL implementation, so the skip travels its whole route: the
        // shared preflight originates it and the cascade mapper re-narrows it.
        pluginUpdate: createUpdateSinglePlugin(),
      });

      // assert

      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.match(first.message, /^ {2}⊘ hello \(skipped\) \{not in manifest\}$/m);

      assert.deepStrictEqual(
        await readPluginRecord(locations.extensionRoot, "e2e-mp", "hello"),
        before,
      );
    } finally {
      await rm(marketplaceRoot, { recursive: true, force: true });
    }
  });
});

// ─── WR-10: a disabled-record re-pin leaves the autoupdate no-op gate ─────────
//
// The gate collapses an autoupdate-ON cascade to the bare
// `(skipped) {up-to-date}` marketplace row when BOTH the validated
// marketplace.json content is unchanged AND every cascaded plugin outcome is
// `unchanged`. `unchanged` means the resolved version matched the record
// exactly and NOTHING was written.
//
// A disabled record whose pin moved is not that: the update rewrites the
// record's version, source, sha and compatibility block and then declines to
// re-materialize artifacts, reporting `skipped` + `already disabled` (WR-02).
// So the cascade is not a no-op, the gate does not fire, and the marketplace
// renders `(updated)` with the per-plugin row underneath -- which is the fact.
// Collapsing this to `{up-to-date}` would restate at the marketplace level the
// exact falsehood WR-02 removed from the plugin row.
//
// The scenario is reachable only because the hash-version ladder is
// CONTENT-derived: the plugin's files move while marketplace.json stays
// byte-identical, so `snapshot.changed` is false and the plugin pin still moves.
//
// Deliberately USER scope, for the reason the sibling case above states at
// length: `updateSinglePlugin` reads the process working directory itself.
test("WR-10: an autoupdate cascade over a disabled record whose pin moved renders rows, not the no-op collapse", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "mp-disabled-repin-"));
    try {
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      // NEITHER plugin.json NOR the manifest entry declares a version, so the
      // PI-7 content hash is the resolved version (tier 3) and editing a file
      // under the plugin root moves the pin.
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello" }),
      );
      await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: tool\ndescription: A tool.\n---\n\n# Tool\n\nBefore.\n",
      );
      await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "disabled-mp",
          plugins: [{ name: "hello", source: "./plugins/hello" }],
        }),
      );

      // The record is pinned at the plugin's CURRENT content hash and disabled.
      const pinnedVersion = await computeHashVersion(pluginRoot);
      await seedPathMarketplace({
        cwd,
        name: "disabled-mp",
        marketplaceRoot,
        scope: "user",
        autoupdate: true,
        plugins: {
          hello: { ...makePluginRecord(), version: pinnedVersion, enabled: false },
        },
      });

      // Move the plugin CONTENT. marketplace.json is not touched, so the
      // marketplace-level change detector reports no change.
      await writeFile(
        path.join(pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: tool\ndescription: A tool.\n---\n\n# Tool\n\nAfter.\n",
      );

      const { ctx, run, notifications } = makeCtx();
      const { gitOps } = createGitOps();
      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "disabled-mp",
        scope: "user",
        cwd,
        gitOps,
        pluginUpdate: createUpdateSinglePlugin(),
      });

      // assert

      const first = notifications[0];
      assert.ok(first !== undefined);
      // The byte form, pinned whole: the no-op collapse would have rendered one
      // line (`● disabled-mp [user] (skipped) {up-to-date}`) and no rows.
      assert.equal(
        first.message,
        ["● disabled-mp [user] (updated)", "  ⊘ hello (skipped) {already disabled}"].join("\n"),
      );
      // Benign idempotent skip -> info, so no severity arg and no summary line.
      assert.equal(first.severity, undefined);

      // And the re-pin the row declines to call `up-to-date` really happened.
      const after = await readPluginRecord(locations.extensionRoot, "disabled-mp", "hello");
      assert.ok(after !== undefined);
      assert.notEqual(after.version, pinnedVersion);
      assert.equal(after.enabled, false);
    } finally {
      await rm(marketplaceRoot, { recursive: true, force: true });
    }
  });
});

test("CMC-26 / MSG-GR-3: cascade body emits per-plugin rows sorted alphabetically (regardless of status)", async () => {
  // The MU-7 partition headers (`Updated:` / `Unchanged:` / `Skipped:` /
  // `Failed:`) are not emitted; cascade rows interleave alphabetically by
  // name per MSG-GR-3 (`compareByNameThenScope`). The status / icon /
  // reason on each row carries the partition signal -- the partition labels
  // are not emitted as section headers.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "mixed",
      ref: "main",
      autoupdate: true,
      plugins: {
        a: makePluginRecord(),
        b: makePluginRecord(),
        c: makePluginRecord(),
        d: makePluginRecord(),
      },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000006" },
    });
    // PluginUpdateOutcome is a discriminated union; each partition variant
    // has different required fields. Construct a fixture per branch.
    const pluginUpdate: PluginUpdateFn = (plugin) => {
      if (plugin === "a") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "updated",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.2",
          stagedAgentNames: [],
          stagedMcpServerNames: [],
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      }

      if (plugin === "b") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "unchanged",
          name: plugin,
          fromVersion: "0.0.1",
          toVersion: "0.0.1",
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      }

      if (plugin === "c") {
        return Promise.resolve<PluginUpdateOutcome>({
          partition: "skipped",
          name: plugin,
          notes: [],
          reasons: [],
          declaresAgents: false,
          declaresMcp: false,
          declaresWorkflows: false,
        });
      }

      return Promise.resolve<PluginUpdateOutcome>({
        partition: "failed",
        name: plugin,
        notes: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mixed",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    const first = notifications[0];
    assert.ok(first !== undefined);
    const body = first.message;
    // D-18-03: Rows interleave in caller order (D-16-06):
    // a (updated), b (unchanged), c (skipped fallback), d (failed). Catalog
    // `mixed-outcomes` shape.
    // Glyph map per D-16-11 severity ladder:
    //   updated -> ● (info)
    //   skipped -> ⊘ (warning)
    //   failed  -> ⊘ (error)
    // The `[project]` scope bracket is suppressed by the orphan-fold
    // (plugin.scope === mp.scope -> renderScopeBracket returns ""). Both
    // narrowSkipReason (WR-06) and narrowFailReason fallbacks now map an
    // empty-notes/no-substring-match outcome to `unreadable manifest`;
    // mapping to `up-to-date` would have falsely claimed SUCCESS on a
    // producer-contract violation.
    const idxA = body.indexOf("  ● a v0.0.1 → v0.0.2 (updated)");
    const idxB = body.indexOf("  ⊘ b (skipped) {up-to-date}");
    const idxC = body.indexOf("  ⊘ c (skipped) {unreadable manifest}");
    const idxD = body.indexOf("  ⊘ d (failed) {unreadable manifest}");
    assert.ok(
      idxA >= 0 && idxB > idxA && idxC > idxB && idxD > idxC,
      `row order broken in body:\n${body}`,
    );
    // Partition headers MUST NOT appear.
    assert.equal(body.includes("Updated:"), false);
    assert.equal(body.includes("Unchanged:"), false);
    assert.equal(body.includes("Skipped:"), false);
    assert.equal(body.includes("Failed:"), false);
  });
});

test("MU-9 + MSG-RH-1: success emits canonical reload hint trailer for updated plugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "rh",
      ref: "main",
      autoupdate: true,
      plugins: { x: makePluginRecord(), a: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000007" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "rh",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    // MSG-RH-1 canonical reload-hint trailer (no names in the message).
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.match(first.message, /\/reload to pick up changes$/);
  });
});

test("UXG-05 (UAT Test-3 gap) + RH-1 + SNM-33 / D-22-01: autoupdate-ON cascade all-unchanged no-op renders `(skipped) {up-to-date}` (info per UXG-02 / D-28-06/07) and emits NO reload-hint (G-MIL-06)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "noupd",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const locations = locationsFor("project", cwd);
    const before = await readPluginRecord(locations.extensionRoot, "noupd", "p");
    assert.ok(before !== undefined);
    // The mock git ops advance the ref but do NOT rewrite the seeded
    // `valid-marketplace` fixture, so the refresh re-validates byte-identical
    // manifest content -> snapshot.changed === false.
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000008" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "unchanged",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.1",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "noupd",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert
    // UXG-05: when snapshot.changed === false AND every cascade outcome is
    // `unchanged`, the marketplace converges to the SAME no-op byte form as
    // the autoupdate-OFF no-op: `(skipped) {up-to-date}`, all-`unchanged`
    // cascade rows dropped (plugins:[]). The benign `up-to-date` reason routes
    // severity to info per UXG-02 / D-28-06/07.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "● noupd [project] (skipped) {up-to-date}");
    assert.equal(first.severity, undefined);
    assert.deepStrictEqual(await readPluginRecord(locations.extensionRoot, "noupd", "p"), before);
    // SNM-33 / D-22-01 (G-MIL-06): no plugin row carries a state-change token
    // (plugins:[]), and a marketplace record is not a Pi-visible resource, so
    // the trailer is suppressed -- shouldEmitReloadHint is plugin-row-driven.
    assert.doesNotMatch(first.message, /\/reload to pick up changes/);
  });
});

test("UXG-05 (UAT Test-3 gap) regression guard: autoupdate-ON cascade where a plugin UPDATES renders `(updated)` with the per-plugin row + reload-hint (NOT a no-op even when snapshot.changed === false)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    // Same setup as the no-op test: the mock git ops advance the ref but do
    // NOT rewrite the seeded fixture, so snapshot.changed === false. The ONLY
    // difference is the cascade outcome -- a plugin actually updated, so
    // outcomes.every(unchanged) is false and the no-op gate does NOT fire.
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert
    // Condition B (outcomes.every(... "unchanged")) is false because a plugin
    // updated, so the no-op gate is skipped even though snapshot.changed is
    // false. The marketplace header stays `(updated)` and the per-plugin
    // updated row + reload-hint trailer are emitted.
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.ok(
      first.message.startsWith("● official [project] (updated)"),
      `expected (updated) header, got: ${first.message}`,
    );
    assert.match(first.message, /\/reload to pick up changes/);
  });
});

test("a repeated autoupdate collapses after the first run changes a plugin", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "repeat",
      ref: "main",
      autoupdate: true,
      plugins: { demo: makePluginRecord() },
    });
    const calls: string[] = [];
    const pluginUpdate: PluginUpdateFn = (plugin) => {
      calls.push(plugin);
      const firstRun = calls.length === 1;
      return Promise.resolve(
        firstRun
          ? {
              partition: "updated",
              name: plugin,
              fromVersion: "0.0.1",
              toVersion: "0.0.2",
              stagedAgentNames: [],
              stagedMcpServerNames: [],
              declaresAgents: false,
              declaresMcp: false,
              constraint: undefined,
              declaresWorkflows: false,
            }
          : {
              partition: "unchanged",
              name: plugin,
              fromVersion: "0.0.2",
              toVersion: "0.0.2",
              declaresAgents: false,
              declaresMcp: false,
              constraint: undefined,
              declaresWorkflows: false,
            },
      );
    };

    const git = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000009" },
    });
    const first = makeCtx();
    const second = makeCtx();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: first.ctx,
      run: first.run,
      name: "repeat",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
      pluginUpdate,
    });
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: second.ctx,
      run: second.run,
      name: "repeat",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(calls, ["demo", "demo"]);
    assert.match(first.notifications[0]?.message ?? "", /^● repeat \[project\] \(updated\)/);
    assert.deepStrictEqual(second.notifications, [
      { message: "● repeat [project] (skipped) {up-to-date}" },
    ]);
  });
});

test("AFILE-04: a marketplace update whose autoupdate cascade rewrites a commented mcp-adapter.json shows the notice after its cascade", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange -- the updated plugin and the failed one each report a rewrite of
    // the same adapter file, and the failed one also of mcp.json.
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord(), beta: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000010" },
    });
    const adapterNotice = {
      kind: "comments-dropped",
      scope: "project",
      file: "mcp-adapter.json",
    } as const;
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve(
        plugin === "alpha"
          ? {
              partition: "updated",
              name: plugin,
              fromVersion: "0.0.1",
              toVersion: "0.0.2",
              stagedAgentNames: [],
              stagedMcpServerNames: [],
              declaresAgents: false,
              declaresMcp: false,
              constraint: undefined,
              declaresWorkflows: false,
              mcpConfigNotices: [adapterNotice],
            }
          : {
              partition: "failed",
              name: plugin,
              notes: ["plugin update phase 3 failed"],
              reasons: ["permission denied"],
              declaresAgents: false,
              declaresMcp: false,
              declaresWorkflows: false,
              mcpConfigNotices: [
                adapterNotice,
                { kind: "comments-dropped", scope: "project", file: "mcp.json" },
              ],
            },
      );

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● official [project] (updated)\n" +
          "  ● alpha v0.0.1 → v0.0.2 (updated)\n" +
          "  ⊘ beta (failed) {permission denied}\n\n" +
          "/reload to pick up changes",
        severity: "error",
      },
      {
        message:
          "MCP config comments removed.\n\n" +
          "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.\n" +
          "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        severity: "warning",
      },
    ]);
  });
});

function updatedOutcome(
  plugin: string,
  extra: Partial<Extract<PluginUpdateOutcome, { partition: "updated" }>>,
): PluginUpdateOutcome {
  return {
    partition: "updated",
    name: plugin,
    fromVersion: "0.0.1",
    toVersion: "0.0.2",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
    ...extra,
  };
}

test("D-PL9-21: a marketplace update shows an autoupdated plugin's package note between its cascade and the MCP notices", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // alpha's notes also hold an unrelated note, which stays out.
    await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord(), beta: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000010" },
    });
    const packageNote = "Plugin dependency install failed (npm): no output";
    const outcomes: Record<string, PluginUpdateOutcome> = {
      alpha: updatedOutcome("alpha", {
        notes: ["a skill was renamed", packageNote],
        packageNote,
        mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
      }),
      beta: updatedOutcome("beta", {}),
    };
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve(outcomes[plugin] ?? unchangedOutcome(plugin));

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● official [project] (updated)\n" +
          "  ● alpha v0.0.1 → v0.0.2 (updated)\n" +
          "  ● beta v0.0.1 → v0.0.2 (updated)\n\n" +
          "/reload to pick up changes",
      },
      {
        message: `Plugin "alpha" updated; 1 declared component has a note.\n\n${packageNote}`,
        severity: "warning",
      },
      {
        message:
          "MCP config comments removed.\n\n" +
          "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        severity: "warning",
      },
    ]);
  });
});

test("AFILE-04: a no-op marketplace update over a commented mcp-adapter.json sends no notice", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "noupd",
      ref: "main",
      autoupdate: true,
      plugins: { p: makePluginRecord() },
    });
    const adapter = '// user note\n{"mcpServers":{}}\n';
    const adapterPath = locationsFor("project", cwd).mcpAdapterJsonPath;
    await writeFile(adapterPath, adapter);
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000011" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "unchanged",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.1",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "noupd",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● noupd [project] (skipped) {up-to-date}" },
    ]);
    assert.equal(await readFile(adapterPath, "utf8"), adapter);
  });
});

const BARE_ORIGIN = {
  kind: "command",
  commandId: "marketplace update",
  invocationId: "bare-run",
} as const;

const STALE_BASELINE = '{"name":"valid-marketplace","plugins":[]}';

/** A JSON-mode context and run that capture every payload in emission order. */
function bareUpdateRun(): {
  capture: ReturnType<typeof createJsonCapture>;
  ctx: NotificationContext;
  run: NotificationRun;
} {
  const capture = createJsonCapture();
  const ctx: NotificationContext = {
    mode: "json",
    get ui() {
      return capture.ui;
    },
  };
  const run = openNotificationRun(
    { getAllTools: () => [], getCommands: () => [], appendEntry: capture.entrySink.appendEntry },
    BARE_ORIGIN,
  );
  return { capture, ctx, run };
}

/** A path-source record whose source is `marketplaceRoot`, last refreshed as `baseline`. */
function bareRecord(
  cwd: string,
  name: string,
  scope: Scope,
  baseline: string,
  plugins: ExtensionState["marketplaces"][string]["plugins"] = {},
  marketplaceRoot = fixtureMarketplaceDir("valid-marketplace"),
): ExtensionState["marketplaces"][string] {
  return {
    name,
    scope,
    source: pathSource(marketplaceRoot),
    addedFromCwd: cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins,
    lastSuccessfulManifest: baseline,
  };
}

/** Saves `marketplaces`, in insertion order, as the state of each scope. */
async function seedScopes(
  cwd: string,
  marketplaces: Readonly<Record<Scope, ExtensionState["marketplaces"]>>,
): Promise<void> {
  for (const scope of ["project", "user"] as const) {
    const { extensionRoot } = locationsFor(scope, cwd);
    await mkdir(extensionRoot, { recursive: true });
    await saveState(extensionRoot, { schemaVersion: 1, marketplaces: marketplaces[scope] });
  }
}

/** Turns autoupdate on for the marketplace `name` of `scope`. */
async function enableAutoupdate(cwd: string, scope: Scope, name: string): Promise<void> {
  const locations = locationsFor(scope, cwd);
  await saveConfig(
    locations.baseConfigJsonPath,
    {
      schemaVersion: 1,
      marketplaces: {
        [name]: { source: fixtureMarketplaceDir("valid-marketplace"), autoupdate: true },
      },
    },
    locations.scopeRoot,
  );
}

/** One captured bare-update payload. */
function bareEntry(payload: Readonly<Record<string, unknown>>): {
  customType: string;
  payload: Readonly<Record<string, unknown>>;
} {
  return {
    customType: "claude-plugin",
    payload: { schemaVersion: 1, origin: BARE_ORIGIN, ...payload },
  };
}

/** The captured `(skipped) {up-to-date}` result of the marketplace `name`. */
function upToDateEntry(name: string, scope: Scope): ReturnType<typeof bareEntry> {
  return bareEntry({
    kind: "cascade",
    severity: "info",
    needsReload: false,
    tally: { label: "Marketplace update", failures: 0, warnings: 0, success: { count: 1 } },
    marketplaces: [{ name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] }],
  });
}

function unchangedOutcome(plugin: string): PluginUpdateOutcome {
  return {
    partition: "unchanged",
    name: plugin,
    fromVersion: "0.0.1",
    toVersion: "0.0.1",
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  };
}

test("a bare update emits each cascade's MCP notices before the next marketplace, project scope first", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange -- reverse-lexical insertion in both scopes, so a sort would
    // reorder them; zeta and theta change and cascade, alpha and beta do not.
    const now = new Date("2026-10-19T09:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    await seedScopes(cwd, {
      project: {
        zeta: bareRecord(cwd, "zeta", "project", STALE_BASELINE, {
          notes: makePluginRecord(),
          broken: makePluginRecord(),
        }),
        alpha: bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON),
      },
      user: {
        theta: bareRecord(cwd, "theta", "user", STALE_BASELINE, { tasks: makePluginRecord() }),
        beta: bareRecord(cwd, "beta", "user", VALID_MANIFEST_JSON),
      },
    });
    await enableAutoupdate(cwd, "project", "zeta");
    await enableAutoupdate(cwd, "user", "theta");
    const { capture, ctx, run } = bareUpdateRun();
    const git = makeForbiddenGitOps();
    const calls: string[] = [];
    const notice = (scope: Scope, file: "mcp-adapter.json" | "mcp.json") =>
      ({ kind: "comments-dropped", scope, file }) as const;
    const pluginUpdate: PluginUpdateFn = (plugin, marketplace, scope) => {
      calls.push(`${plugin}@${marketplace} [${scope}]`);
      if (plugin === "broken") {
        return Promise.resolve({
          partition: "failed",
          name: plugin,
          notes: ["plugin update failed after its MCP commit"],
          reasons: ["permission denied"],
          declaresAgents: false,
          declaresMcp: false,
          declaresWorkflows: false,
          mcpConfigNotices: [notice(scope, "mcp.json")],
        });
      }

      return Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
        mcpConfigNotices: [notice(scope, "mcp-adapter.json")],
      });
    };

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      gitOps: git.gitOps,
      pluginUpdate,
    });

    // assert
    const updatedRow = (name: string, marketplace: string, scope: Scope) => ({
      name,
      id: `${name}@${marketplace}`,
      scope,
      status: "updated",
      from: "0.0.1",
      to: "0.0.2",
      reasons: [],
    });
    const notices = (...items: Array<ReturnType<typeof notice>>) =>
      bareEntry({
        kind: "mcp-config-notices",
        severity: "warning",
        needsReload: false,
        notices: items,
      });
    assert.deepStrictEqual(capture.entries, [
      bareEntry({
        kind: "cascade",
        severity: "error",
        needsReload: true,
        summary: "A plugin operation has failed.",
        tally: { label: "Marketplace update", failures: 1, warnings: 0, success: { count: 2 } },
        marketplaces: [
          {
            name: "zeta",
            scope: "project",
            status: "updated",
            plugins: [
              updatedRow("notes", "zeta", "project"),
              {
                name: "broken",
                id: "broken@zeta",
                scope: "project",
                status: "failed",
                reasons: ["permission denied"],
                leaks: [],
                rollbackPartial: [],
              },
            ],
          },
        ],
      }),
      notices(notice("project", "mcp-adapter.json"), notice("project", "mcp.json")),
      upToDateEntry("alpha", "project"),
      bareEntry({
        kind: "cascade",
        severity: "info",
        needsReload: true,
        tally: { label: "Marketplace update", failures: 0, warnings: 0, success: { count: 2 } },
        marketplaces: [
          {
            name: "theta",
            scope: "user",
            status: "updated",
            plugins: [updatedRow("tasks", "theta", "user")],
          },
        ],
      }),
      notices(notice("user", "mcp-adapter.json")),
      upToDateEntry("beta", "user"),
    ]);
    capture.assertValid();
    assert.deepStrictEqual(git.calls, []);
    assert.deepStrictEqual(calls, [
      "notes@zeta [project]",
      "broken@zeta [project]",
      "tasks@theta [user]",
    ]);
    const refreshed = (record: ExtensionState["marketplaces"][string]) => ({
      ...record,
      lastSuccessfulManifest: VALID_MANIFEST_JSON,
      lastUpdatedAt: now.toISOString(),
    });
    assert.deepStrictEqual(await loadState(locationsFor("project", cwd).extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        zeta: refreshed(
          bareRecord(cwd, "zeta", "project", STALE_BASELINE, {
            notes: makePluginRecord(),
            broken: makePluginRecord(),
          }),
        ),
        alpha: refreshed(bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON)),
      },
    });
    assert.deepStrictEqual(await loadState(locationsFor("user", cwd).extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        theta: refreshed(
          bareRecord(cwd, "theta", "user", STALE_BASELINE, { tasks: makePluginRecord() }),
        ),
        beta: refreshed(bareRecord(cwd, "beta", "user", VALID_MANIFEST_JSON)),
      },
    });
  });
});

test("a bare update keeps a failed marketplace registered and refreshes every later target", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange -- the first project marketplace has a schema-invalid manifest.
    const now = new Date("2026-10-19T09:30:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    const brokenRoot = path.join(cwd, "zeta-marketplace");
    await mkdir(path.join(brokenRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(brokenRoot, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ name: "zeta", owner: { name: "tests" }, plugins: "nope" }),
    );
    const zeta = bareRecord(cwd, "zeta", "project", VALID_MANIFEST_JSON, {}, brokenRoot);
    await seedScopes(cwd, {
      project: { zeta, alpha: bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON) },
      user: { beta: bareRecord(cwd, "beta", "user", VALID_MANIFEST_JSON) },
    });
    const { capture, ctx, run } = bareUpdateRun();
    const git = makeForbiddenGitOps();

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      gitOps: git.gitOps,
    });

    // assert
    assert.deepStrictEqual(capture.entries, [
      bareEntry({
        kind: "cascade",
        severity: "error",
        needsReload: false,
        summary: "Some operations have failed.",
        tally: { label: "Marketplace update", failures: 2, warnings: 0 },
        marketplaces: [
          {
            name: "zeta",
            scope: "project",
            status: "failed",
            plugins: [
              {
                name: "zeta",
                id: "zeta@zeta",
                scope: "project",
                status: "failed",
                reasons: ["invalid manifest"],
                cause: {
                  causeChain: [
                    'Failed to update marketplace "zeta".',
                    "marketplace.json schema invalid: /plugins: must be array",
                  ],
                  truncated: false,
                },
                leaks: [],
                rollbackPartial: [],
              },
            ],
          },
        ],
      }),
      upToDateEntry("alpha", "project"),
      upToDateEntry("beta", "user"),
    ]);
    capture.assertValid();
    assert.deepStrictEqual(git.calls, []);
    assert.deepStrictEqual(await loadState(locationsFor("project", cwd).extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        zeta,
        alpha: {
          ...bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON),
          lastUpdatedAt: now.toISOString(),
        },
      },
    });
    assert.deepStrictEqual(await loadState(locationsFor("user", cwd).extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        beta: {
          ...bareRecord(cwd, "beta", "user", VALID_MANIFEST_JSON),
          lastUpdatedAt: now.toISOString(),
        },
      },
    });
  });
});

test("repeated bare updates with no marketplaces emit the same empty result and record nothing", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const first = bareUpdateRun();
    const second = bareUpdateRun();
    const git = makeForbiddenGitOps();

    // act
    for (const { ctx, run } of [first, second]) {
      await updateAllMarketplaces({
        completionCache: createCompletionCache(),
        ctx,
        run,
        cwd,
        gitOps: git.gitOps,
      });
    }

    // assert
    const empty = [
      bareEntry({ kind: "cascade", severity: "info", needsReload: false, marketplaces: [] }),
    ];
    assert.deepStrictEqual(first.capture.entries, empty);
    assert.deepStrictEqual(second.capture.entries, empty);
    first.capture.assertValid();
    second.capture.assertValid();
    assert.deepStrictEqual(git.calls, []);
    assert.deepStrictEqual(
      await Promise.all(
        (["project", "user"] as const).map(async (scope) =>
          pathExists(locationsFor(scope, cwd).extensionRoot),
        ),
      ),
      [false, false],
    );
  });
});

test("a bare update skips a marketplace removed after target selection and refreshes the rest", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange -- zeta's cascade removes alpha after both were selected, as a
    // concurrent `marketplace remove` would.
    await seedScopes(cwd, {
      project: {
        zeta: bareRecord(cwd, "zeta", "project", VALID_MANIFEST_JSON, {
          notes: makePluginRecord(),
        }),
        alpha: bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON),
      },
      user: { beta: bareRecord(cwd, "beta", "user", VALID_MANIFEST_JSON) },
    });
    await enableAutoupdate(cwd, "project", "zeta");
    const projectRoot = locationsFor("project", cwd).extensionRoot;
    const { capture, ctx, run } = bareUpdateRun();
    const git = makeForbiddenGitOps();
    const pluginUpdate: PluginUpdateFn = async (plugin) => {
      const state = await loadState(projectRoot);
      Reflect.deleteProperty(state.marketplaces, "alpha");
      await saveState(projectRoot, state);
      return unchangedOutcome(plugin);
    };

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      gitOps: git.gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(capture.entries, [
      upToDateEntry("zeta", "project"),
      upToDateEntry("beta", "user"),
    ]);
    capture.assertValid();
    assert.deepStrictEqual(git.calls, []);
    assert.deepStrictEqual(Object.keys((await loadState(projectRoot)).marketplaces), ["zeta"]);
  });
});

test("a marketplace added after target selection waits for the next bare update", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange -- zeta's cascade adds late after the targets were selected, as
    // a concurrent `marketplace add` would.
    const now = new Date("2026-10-19T10:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    await seedScopes(cwd, {
      project: {
        zeta: bareRecord(cwd, "zeta", "project", VALID_MANIFEST_JSON, {
          notes: makePluginRecord(),
        }),
        alpha: bareRecord(cwd, "alpha", "project", VALID_MANIFEST_JSON),
      },
      user: {},
    });
    await enableAutoupdate(cwd, "project", "zeta");
    const projectRoot = locationsFor("project", cwd).extensionRoot;
    const late = bareRecord(cwd, "late", "project", VALID_MANIFEST_JSON);
    let added = false;
    const pluginUpdate: PluginUpdateFn = async (plugin) => {
      if (!added) {
        added = true;
        const state = await loadState(projectRoot);
        state.marketplaces.late = late;
        await saveState(projectRoot, state);
      }

      return unchangedOutcome(plugin);
    };

    const first = bareUpdateRun();
    const second = bareUpdateRun();

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx: first.ctx,
      run: first.run,
      cwd,
      gitOps: makeForbiddenGitOps().gitOps,
      pluginUpdate,
    });
    const afterFirst = await loadState(projectRoot);
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx: second.ctx,
      run: second.run,
      cwd,
      gitOps: makeForbiddenGitOps().gitOps,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(first.capture.entries, [
      upToDateEntry("zeta", "project"),
      upToDateEntry("alpha", "project"),
    ]);
    assert.deepStrictEqual(afterFirst.marketplaces.late, late);
    assert.deepStrictEqual(second.capture.entries, [
      upToDateEntry("zeta", "project"),
      upToDateEntry("alpha", "project"),
      upToDateEntry("late", "project"),
    ]);
    first.capture.assertValid();
    second.capture.assertValid();
  });
});

test("NFR-5: path-source update calls zero gitOps methods", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Place a real on-disk marketplace at a tmp path (NOT under sources/).
    const localMpDir = await mkdtemp(path.join(tmpdir(), "mp-local-update-"));
    try {
      await cp(fixtureMarketplaceDir("valid-marketplace"), localMpDir, { recursive: true });
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          local: {
            name: "local",
            scope: "project",
            source: pathSource(localMpDir),
            addedFromCwd: cwd,
            manifestPath: path.join(localMpDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: localMpDir,
            plugins: {},
          },
        },
      });
      const { ctx, run } = makeCtx();
      const { gitOps, state } = createGitOps();
      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "local",
        scope: "project",
        cwd,
        gitOps,
      });

      // assert

      assert.equal(state.cloneCalls.length, 0);
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
    } finally {
      await rm(localMpDir, { recursive: true, force: true });
    }
  });
});

test("semantic comparison ignores object key order", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "key-order-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "key-order", marketplaceRoot });
    const parsed = JSON.parse(VALID_MANIFEST_JSON) as {
      name: string;
      owner: { name: string };
      plugins: readonly Record<string, unknown>[];
    };
    const [plugin] = parsed.plugins;
    assert.ok(plugin !== undefined);
    const reorderedPlugin = {
      version: plugin.version,
      description: plugin.description,
      source: plugin.source,
      name: plugin.name,
    };
    const reordered = JSON.stringify({
      plugins: [reorderedPlugin],
      owner: parsed.owner,
      name: parsed.name,
    });
    assert.notStrictEqual(reordered, VALID_MANIFEST_JSON);
    await writeFile(
      path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
      `${reordered}\n`,
      "utf8",
    );
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "key-order",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● key-order [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(git.calls, []);
  });
});

test("semantic comparison uses the saved baseline before reading changed source content", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "changed-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "changed", marketplaceRoot });
    const changedManifest = JSON.stringify({
      ...(JSON.parse(VALID_MANIFEST_JSON) as Record<string, unknown>),
      description: "A changed marketplace",
    });
    await writeFile(
      path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
      changedManifest,
      "utf8",
    );
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "changed",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [{ message: "● changed [project] (updated)" }]);
    assert.strictEqual(
      (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.changed
        ?.lastSuccessfulManifest,
      changedManifest,
    );
    assert.deepStrictEqual(git.calls, []);
  });
});

for (const { baseline, refreshed, title } of [
  {
    title: "a changed nested unknown field",
    baseline: '{"name":"marketplace","plugins":[],"vendor":{"settings":{"revision":1}}}',
    refreshed: '{ "name":"marketplace", "plugins":[], "vendor":{"settings":{"revision":2}} }\n',
  },
  {
    title: "reordered plugins",
    baseline:
      '{"name":"marketplace","plugins":[{"name":"zebra","source":"./zebra"},{"name":"alpha","source":"./alpha"}]}',
    refreshed:
      '{ "name":"marketplace", "plugins":[{"name":"alpha","source":"./alpha"},{"name":"zebra","source":"./zebra"}] }\n',
  },
  {
    title: "a reordered unknown array",
    baseline: '{"name":"marketplace","plugins":[],"vendor":{"sequence":["zebra","alpha"]}}',
    refreshed: '{ "name":"marketplace", "plugins":[], "vendor":{"sequence":["alpha", "zebra"]} }\n',
  },
]) {
  test(`semantic comparison reports ${title} as updated`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const marketplaceRoot = path.join(cwd, "tools");
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await mkdir(path.dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, refreshed, "utf8");
      await seedPathMarketplace({
        cwd,
        name: "tools",
        marketplaceRoot,
        lastSuccessfulManifest: baseline,
      });
      const { ctx, run, notifications } = makeCtx();
      const git = makeForbiddenGitOps();

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "tools",
        scope: "project",
        cwd,
        gitOps: git.gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [{ message: "● tools [project] (updated)" }]);
      assert.strictEqual(await readFile(manifestPath, "utf8"), refreshed);
      assert.deepStrictEqual(git.calls, []);
    });
  });
}

test("a legacy local baseline is established once and survives a fresh state load", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "legacy-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    const installed = makePluginRecord();
    await seedPathMarketplace({
      cwd,
      name: "legacy-local",
      marketplaceRoot,
      plugins: { hello: installed },
      legacy: true,
    });
    const locations = locationsFor("project", cwd);
    const beforeInfo = await loadState(locations.extensionRoot);
    const info = makeCtx();

    // act
    await getMarketplaceInfo({
      ctx: info.ctx as ExtensionContext,
      run: info.run,
      name: "legacy-local",
      scope: "project",
      cwd,
    });
    const afterInfo = await loadState(locations.extensionRoot);
    const first = makeCtx();
    const firstGit = makeForbiddenGitOps();
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: first.ctx,
      run: first.run,
      name: "legacy-local",
      scope: "project",
      cwd,
      gitOps: firstGit.gitOps,
    });
    const afterFirst = await loadState(locations.extensionRoot);
    const second = makeCtx();
    const secondGit = makeForbiddenGitOps();
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: second.ctx,
      run: second.run,
      name: "legacy-local",
      scope: "project",
      cwd,
      gitOps: secondGit.gitOps,
    });
    const afterSecond = await loadState(locations.extensionRoot);

    // assert
    assert.deepStrictEqual(afterInfo, beforeInfo);
    assert.deepStrictEqual(info.notifications, [
      { message: `● legacy-local [project] <no autoupdate>\npath: ${marketplaceRoot}` },
    ]);
    assert.deepStrictEqual(first.notifications, [
      { message: "● legacy-local [project] (updated)" },
    ]);
    assert.deepStrictEqual(second.notifications, [
      { message: "● legacy-local [project] (skipped) {up-to-date}" },
    ]);
    assert.strictEqual(
      afterFirst.marketplaces["legacy-local"]?.lastSuccessfulManifest,
      VALID_MANIFEST_JSON,
    );
    assert.strictEqual(
      afterSecond.marketplaces["legacy-local"]?.lastSuccessfulManifest,
      VALID_MANIFEST_JSON,
    );
    assert.deepStrictEqual(afterSecond.marketplaces["legacy-local"]?.plugins, {
      hello: installed,
    });
    assert.deepStrictEqual(firstGit.calls, []);
    assert.deepStrictEqual(secondGit.calls, []);
  });
});

test("a failed state save retains the baseline and retries without cascading early", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "save-retry-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    const installed = makePluginRecord();
    await seedPathMarketplace({
      cwd,
      name: "save-retry",
      marketplaceRoot,
      autoupdate: true,
      plugins: { hello: installed },
    });
    const locations = locationsFor("project", cwd);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    const changedManifest = JSON.stringify({
      ...(JSON.parse(VALID_MANIFEST_JSON) as Record<string, unknown>),
      description: "Changed before the failed save",
    });
    await writeFile(manifestPath, changedManifest, "utf8");
    const beforeState = await loadState(locations.extensionRoot);
    const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
    const cascadeCalls: Array<{ marketplace: string; plugin: string; scope: Scope }> = [];
    const pluginUpdate: PluginUpdateFn = (plugin, marketplace, scope) => {
      cascadeCalls.push({ marketplace, plugin, scope });
      return Promise.resolve({
        partition: "unchanged",
        name: plugin,
        fromVersion: installed.version,
        toVersion: installed.version,
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    };

    const failed = makeCtx();
    const failedGit = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: failed.ctx,
      run: failed.run,
      name: "save-retry",
      scope: "project",
      cwd,
      gitOps: failedGit.gitOps,
      pluginUpdate,
      stateTransaction: {
        saveState: (): Promise<never> => Promise.reject(new Error("state save failed")),
      },
    });
    const stateAfterFailure = await loadState(locations.extensionRoot);
    const callsAfterFailure = [...cascadeCalls];
    const retried = makeCtx();
    const retryGit = makeForbiddenGitOps();
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: retried.ctx,
      run: retried.run,
      name: "save-retry",
      scope: "project",
      cwd,
      gitOps: retryGit.gitOps,
      pluginUpdate,
    });
    const stateAfterRetry = await loadState(locations.extensionRoot);

    // assert
    assert.deepStrictEqual(stateAfterFailure, beforeState);
    assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), configBytes);
    assert.deepStrictEqual(cascadeCalls, [
      { marketplace: "save-retry", plugin: "hello", scope: "project" },
    ]);
    assert.deepStrictEqual(callsAfterFailure, []);
    assert.deepStrictEqual(failed.notifications, [
      {
        message:
          "Some operations have failed.\n\n⊘ save-retry [project] (failed)\n  ⊘ save-retry (failed)\n    cause: state save failed",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(retried.notifications, [
      { message: "● save-retry [project] (updated)\n  ⊘ hello (skipped) {up-to-date}" },
    ]);
    assert.strictEqual(
      stateAfterRetry.marketplaces["save-retry"]?.lastSuccessfulManifest,
      changedManifest,
    );
    assert.deepStrictEqual(stateAfterRetry.marketplaces["save-retry"]?.plugins, {
      hello: installed,
    });
    assert.deepStrictEqual(failedGit.calls, []);
    assert.deepStrictEqual(retryGit.calls, []);
  });
});

for (const { code, name } of [
  { code: "EACCES", name: "save-eacces" },
  { code: "EPERM", name: "save-eperm" },
  { code: "ENOENT", name: "save-enoent" },
  { code: "ENOTDIR", name: "save-enotdir" },
] as const) {
  test(`a state save failing with ${code} renders a failed row with no reason`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const marketplaceRoot = path.join(cwd, `${name}-marketplace`);
      await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
      await seedPathMarketplace({ cwd, name, marketplaceRoot });
      const locations = locationsFor("project", cwd);
      const beforeState = await loadState(locations.extensionRoot);
      const { ctx, run, notifications } = makeCtx();
      const git = makeForbiddenGitOps();
      const saveError = Object.assign(new Error(`${code}: state save failed`), { code });

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name,
        scope: "project",
        cwd,
        gitOps: git.gitOps,
        stateTransaction: {
          saveState: (): Promise<never> => Promise.reject(saveError),
        },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `Some operations have failed.\n\n⊘ ${name} [project] (failed)\n  ⊘ ${name} (failed)\n    cause: ${code}: state save failed`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(await loadState(locations.extensionRoot), beforeState);
      assert.deepStrictEqual(git.calls, []);
    });
  });
}

test("a held scope lock fails the update as lock held and a retry after release succeeds", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "locked-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "locked", marketplaceRoot });
    const locations = locationsFor("project", cwd);
    const beforeState = await loadState(locations.extensionRoot);
    const blocked = makeCtx();
    const blockedGit = makeForbiddenGitOps();
    const retried = makeCtx();
    const retryGit = makeForbiddenGitOps();
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: blocked.ctx,
      run: blocked.run,
      name: "locked",
      scope: "project",
      cwd,
      gitOps: blockedGit.gitOps,
    });
    const stateWhileLocked = await loadState(locations.extensionRoot);
    await release();
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx: retried.ctx,
      run: retried.run,
      name: "locked",
      scope: "project",
      cwd,
      gitOps: retryGit.gitOps,
    });

    // assert
    assert.deepStrictEqual(blocked.notifications, [
      {
        message: [
          "Some operations have failed.",
          "",
          "⊘ locked [project] (failed)",
          "  ⊘ locked (failed) {lock held}",
          `    cause: Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
        ].join("\n"),
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(stateWhileLocked, beforeState);
    assert.deepStrictEqual(retried.notifications, [
      { message: "● locked [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(blockedGit.calls, []);
    assert.deepStrictEqual(retryGit.calls, []);
  });
});

test("drops a changed target after persistence and before its plugin cascade", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const now = new Date("2026-09-08T07:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    const completionCache = createCompletionCache();
    const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
    const { cloneDir } = await seedGithubMarketplace({
      cwd,
      name: "official",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
    });
    const locations = locationsFor("project", cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces.official;
    if (record === undefined) {
      throw new Error("the cache invalidation fixture has no target marketplace");
    }

    record.lastSuccessfulManifest = '{"name":"valid-marketplace","plugins":[]}';
    await saveState(locations.extensionRoot, state);
    const pluginCachePath = await locations.pluginCacheFile("official");
    let rebuildCount = 0;
    await completionCache.getPluginIndex(pluginCachePath, "project", "official", () => {
      rebuildCount += 1;
      return Promise.resolve([{ name: "stale-plugin", status: "available" }]);
    });
    await rm(pluginCachePath, { force: true });
    let cascadeObservation:
      { readonly dropCount: number; readonly state: ExtensionState } | undefined;
    const pluginUpdate: PluginUpdateFn = async (plugin) => {
      cascadeObservation = {
        dropCount: drop.mock.callCount(),
        state: await loadState(locations.extensionRoot),
      };
      return {
        partition: "unchanged",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.1",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      };
    };

    // act
    await updateMarketplace({
      completionCache,
      ctx,
      run,
      name: "official",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });
    const rows = await completionCache.getPluginIndex(
      pluginCachePath,
      "project",
      "official",
      () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "fresh-plugin", status: "available" }]);
      },
    );

    // assert
    const expectedState: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        official: {
          name: "official",
          scope: "project",
          source: makeGithubSource("main"),
          addedFromCwd: cwd,
          manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cloneDir,
          plugins: { alpha: makePluginRecord() },
          lastUpdatedAt: now.toISOString(),
          lastSuccessfulManifest: VALID_MANIFEST_JSON,
        },
      },
    };
    assert.deepStrictEqual(notifications, [
      { message: "● official [project] (updated)\n  ⊘ alpha (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), expectedState);
    assert.deepStrictEqual(rows, [{ name: "fresh-plugin", status: "available" }]);
    assert.deepStrictEqual(cascadeObservation, { dropCount: 1, state: expectedState });
    assert.strictEqual(rebuildCount, 2);
    assert.strictEqual(drop.mock.callCount(), 1);
    assert.deepStrictEqual(drop.mock.calls[0]?.arguments, [pluginCachePath, "project", "official"]);
  });
});

test("leaves completion rows intact when a marketplace refresh has no effect", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "no-effect", marketplaceRoot });
    const completionCache = createCompletionCache();
    const locations = locationsFor("project", cwd);
    const pluginCachePath = await locations.pluginCacheFile("no-effect");
    let rebuildCount = 0;
    const expectedRows = [{ name: "still-current", status: "available" }] as const;
    await completionCache.getPluginIndex(pluginCachePath, "project", "no-effect", () => {
      rebuildCount += 1;
      return Promise.resolve(expectedRows);
    });
    await rm(pluginCachePath, { force: true });
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache,
      ctx,
      run,
      name: "no-effect",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
    });
    const rows = await completionCache.getPluginIndex(
      pluginCachePath,
      "project",
      "no-effect",
      () => {
        rebuildCount += 1;
        return Promise.resolve([]);
      },
    );

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● no-effect [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(rows, expectedRows);
    assert.strictEqual(rebuildCount, 1);
    assert.deepStrictEqual(git.calls, []);
  });
});

test("a newly degraded autoupdate cascade emits its partial row and warning envelope", async () => {
  // This genuine lifecycle case drives target refresh, the injected plugin
  // collaborator, cascade grouping, and the final notify envelope together.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "auto-mp",
      ref: "main",
      autoupdate: true,
      plugins: { hello: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000042" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve<PluginUpdateOutcome>({
        partition: "updated",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.2",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
        constraint: undefined,
      });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "auto-mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    const first = notifications[0];
    assert.ok(first !== undefined);
    const body = first.message;
    // Byte-exact partially-installed child row under the marketplace header. The
    // ◉ glyph, the version arrow (UPR-03), `(partially-installed)` token, and
    // `{lsp}` dropped-component brace mirror the plugin-surface byte lock
    // (`narrowUnsupportedKinds(["lspServers"]) -> "lsp"`). The `[project]` scope
    // bracket is orphan-folded (plugin.scope === mp.scope).
    const headerIdx = body.indexOf("● auto-mp [project]");
    const rowIdx = body.indexOf("  ◉ hello v0.0.1 → v0.0.2 (partially-installed) {lsp}");
    assert.ok(headerIdx >= 0, `marketplace header missing:\n${body}`);
    assert.ok(rowIdx > headerIdx, `partially-installed child row missing/misplaced:\n${body}`);
    // newlyDegraded -> warning envelope -> the degraded summary variant.
    assert.equal(first.severity, "warning");
    assert.match(body, /needs attention/);
  });
});

// ── updateAllMarketplaces: scope enumeration, port forwarding, refresh edge cases ────

test("SC-6 / MU-1: updateAllMarketplaces (no scope) processes user-scope marketplace", async () => {
  // targets.push() for a marketplace discovered in the
  // user scope during the no-scope-filter iteration path.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Seed a marketplace in user scope.  getAgentDir() uses
    // homedir()/.pi/agent on Linux when PI_CODING_AGENT_DIR is not set.
    // withHermeticHome sets HOME so homedir() resolves to `home`.
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const cloneDir = await userLocations.sourceCloneDir("user-mp");
    await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "user-mp": {
          name: "user-mp",
          scope: "user",
          source: makeGithubSource("main"),
          addedFromCwd: cwd,
          manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cloneDir,
          plugins: {},
        },
      },
    });

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000010" },
    });

    // Call without scope filter -- enumerates both scopes (SC-6).
    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      gitOps,
    });

    // assert

    // At least one notification, and it should mention user-mp.
    assert.ok(notifications.length >= 1);
    const combined = notifications.map((n) => n.message).join("\n");
    assert.ok(combined.includes("user-mp"), `expected "user-mp" in notifications: ${combined}`);
    // No error severity.
    const errNotif = notifications.find((n) => n.severity === "error");
    assert.equal(errNotif, undefined, `unexpected error notification: ${errNotif?.message}`);
  });
});

test("SC-6 / MU-1: updateAllMarketplaces (no scope) with both scopes empty notifies once", async () => {
  // The empty-targets guard fires when BOTH scopes are
  // enumerated and both contain zero marketplaces. The existing MU-1 test
  // uses scope:'project' (single scope); this test exercises the no-filter
  // path that checks both scopes.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      gitOps,
    }); // no scope filter

    // assert
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.message, "(no marketplaces)");
    assert.equal(first.message.includes("Run /reload to "), false);
  });
});

test("updateAllMarketplaces forwards optional Device Flow and plugin cascade ports", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const now = new Date("2026-09-01T12:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    const marketplaceRoot = path.join(cwd, "batch-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({
      cwd,
      name: "batch-mp",
      marketplaceRoot,
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const locations = locationsFor("project", cwd);
    const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const deviceFlow = createDeviceFlowHttp();
    const cascadeCalls: Array<{ marketplace: string; plugin: string; scope: Scope }> = [];
    const pluginUpdate: PluginUpdateFn = (plugin, marketplace, scope) => {
      cascadeCalls.push({ marketplace, plugin, scope });
      return Promise.resolve({
        partition: "unchanged",
        name: plugin,
        fromVersion: "0.0.1",
        toVersion: "0.0.1",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
    };

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      scope: "project",
      cwd,
      deviceFlowHttp: deviceFlow.http,
      pluginUpdate,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● batch-mp [project] (skipped) {up-to-date}\n\nMarketplace update: 1 success",
      },
    ]);
    assert.deepStrictEqual(cascadeCalls, [
      { marketplace: "batch-mp", plugin: "alpha", scope: "project" },
    ]);
    assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        "batch-mp": {
          name: "batch-mp",
          scope: "project",
          source: pathSource(marketplaceRoot),
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: { alpha: makePluginRecord() },
          lastUpdatedAt: now.toISOString(),
          lastSuccessfulManifest: VALID_MANIFEST_JSON,
        },
      },
    });
    assert.strictEqual(await readFile(locations.baseConfigJsonPath, "utf8"), configBytes);
  });
});

test("all-target update drops changed rows in project-before-user order and isolates no-effect and peer rows", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const now = new Date("2026-09-08T08:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const marketplaceRoot = fixtureMarketplaceDir("valid-marketplace");
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const marketplaceRecord = (
      name: string,
      scope: Scope,
      baseline: string,
    ): ExtensionState["marketplaces"][string] => ({
      name,
      scope,
      source: pathSource(marketplaceRoot),
      addedFromCwd: cwd,
      manifestPath,
      marketplaceRoot,
      plugins: {},
      lastSuccessfulManifest: baseline,
    });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        alpha: marketplaceRecord("alpha", "project", '{"name":"valid-marketplace","plugins":[]}'),
        beta: marketplaceRecord("beta", "project", VALID_MANIFEST_JSON),
      },
    });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        alpha: marketplaceRecord("alpha", "user", '{"name":"valid-marketplace","plugins":[]}'),
      },
    });
    const { ctx, run, notifications } = makeCtx();
    const completionCache = createCompletionCache();
    const peerCache = createCompletionCache();
    const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
    const targetPaths = {
      projectAlpha: await projectLocations.pluginCacheFile("alpha"),
      projectBeta: await projectLocations.pluginCacheFile("beta"),
      userAlpha: await userLocations.pluginCacheFile("alpha"),
    };
    for (const [key, pluginCachePath] of Object.entries(targetPaths)) {
      await completionCache.getPluginIndex(
        pluginCachePath,
        key.startsWith("project") ? "project" : "user",
        key.endsWith("Alpha") ? "alpha" : "beta",
        () => Promise.resolve([{ name: `owner-${key}`, status: "available" }]),
      );
      await rm(pluginCachePath, { force: true });
      await peerCache.getPluginIndex(
        pluginCachePath,
        key.startsWith("project") ? "project" : "user",
        key.endsWith("Alpha") ? "alpha" : "beta",
        () => Promise.resolve([{ name: `peer-${key}`, status: "available" }]),
      );
      await rm(pluginCachePath, { force: true });
    }

    // act
    await updateAllMarketplaces({
      completionCache,
      ctx,
      run,
      cwd,
    });
    const ownerRows = {
      projectAlpha: await completionCache.getPluginIndex(
        targetPaths.projectAlpha,
        "project",
        "alpha",
        () => Promise.resolve([{ name: "fresh-projectAlpha", status: "available" }]),
      ),
      projectBeta: await completionCache.getPluginIndex(
        targetPaths.projectBeta,
        "project",
        "beta",
        () => Promise.resolve([{ name: "fresh-projectBeta", status: "available" }]),
      ),
      userAlpha: await completionCache.getPluginIndex(targetPaths.userAlpha, "user", "alpha", () =>
        Promise.resolve([{ name: "fresh-userAlpha", status: "available" }]),
      ),
    };
    const peerRows = {
      projectAlpha: await peerCache.getPluginIndex(
        targetPaths.projectAlpha,
        "project",
        "alpha",
        () => Promise.resolve([{ name: "fresh-peer-projectAlpha", status: "available" }]),
      ),
      projectBeta: await peerCache.getPluginIndex(targetPaths.projectBeta, "project", "beta", () =>
        Promise.resolve([{ name: "fresh-peer-projectBeta", status: "available" }]),
      ),
      userAlpha: await peerCache.getPluginIndex(targetPaths.userAlpha, "user", "alpha", () =>
        Promise.resolve([{ name: "fresh-peer-userAlpha", status: "available" }]),
      ),
    };

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● alpha [project] (updated)\n\nMarketplace update: 1 success",
      },
      {
        message: "● beta [project] (skipped) {up-to-date}\n\nMarketplace update: 1 success",
      },
      {
        message: "● alpha [user] (updated)\n\nMarketplace update: 1 success",
      },
    ]);
    assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        alpha: {
          ...marketplaceRecord("alpha", "project", VALID_MANIFEST_JSON),
          lastUpdatedAt: now.toISOString(),
        },
        beta: {
          ...marketplaceRecord("beta", "project", VALID_MANIFEST_JSON),
          lastUpdatedAt: now.toISOString(),
        },
      },
    });
    assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        alpha: {
          ...marketplaceRecord("alpha", "user", VALID_MANIFEST_JSON),
          lastUpdatedAt: now.toISOString(),
        },
      },
    });
    assert.deepStrictEqual(ownerRows, {
      projectAlpha: [{ name: "fresh-projectAlpha", status: "available" }],
      projectBeta: [{ name: "owner-projectBeta", status: "available" }],
      userAlpha: [{ name: "fresh-userAlpha", status: "available" }],
    });
    assert.deepStrictEqual(peerRows, {
      projectAlpha: [{ name: "peer-projectAlpha", status: "available" }],
      projectBeta: [{ name: "peer-projectBeta", status: "available" }],
      userAlpha: [{ name: "peer-userAlpha", status: "available" }],
    });
    assert.deepStrictEqual(
      drop.mock.calls.map((call) => call.arguments),
      [
        [targetPaths.projectAlpha, "project", "alpha"],
        [targetPaths.userAlpha, "user", "alpha"],
      ],
    );
  });
});

test("refreshRecord: unsupported source kind surfaces as notifyError (lines 219-222)", async () => {
  // The else branch in refreshRecord throws
  // `Cannot update marketplace "..." unsupported source kind "..."`.
  // An `unknown`-kind source stored in state reaches this branch because
  // normalizeStoredSource passes kind==="unknown" through verbatim, but
  // refreshRecord only handles "github" and "path".
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "unsupported-mp": {
          name: "unsupported-mp",
          scope: "project",
          // kind:"unknown" passes STATE_VALIDATOR (source:Type.Unknown())
          // and passes normalizeStoredSource (kind==="unknown" branch).
          source: {
            kind: "unknown",
            raw: "ftp://example.com",
            reason: "unsupported scheme",
          },
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "unsupported-mp",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.ok(
      first.message.includes("unsupported source kind"),
      `expected "unsupported source kind" in: ${first.message}`,
    );
  });
});

test("updateMarketplace: explicit-scope missing marketplace -> standalone {marketplace not added} (SC#1)", async () => {
  // SC#1 cross-op convergence: an explicit-scope miss is blocked by the
  // pre-guard loadState existence read BEFORE it reaches snapshotAfterRefresh's
  // withStateGuard (which would otherwise throw MarketplaceNotFoundError raw).
  // It renders the canonical standalone `(failed) {marketplace not added}` variant -- no
  // longer a synthetic `(failed)` cascade row or a raw escape. Byte-locked to
  // the exact canonical row (mirrors remove.ts / autoupdate.ts convergence).
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Leave state empty -- no marketplace named "ghost".
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "ghost",
      scope: "project",
      cwd,
      gitOps,
    });

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(
      first.message,
      "A marketplace operation has failed.\n\n⊘ ghost [project] (failed) {marketplace not added}",
    );
    assert.equal(first.severity, "error");
  });
});

// CMP-4 / SCOPE-01: the qualified sibling of the test above. When the named
// marketplace IS added, just in the other scope, the row says so -- `{marketplace
// not added to user scope}` REPLACES the plain token rather than joining it,
// because "the container does not exist" and "it exists, but not where you
// asked" are competing claims about one subject. This is the user-target
// direction: the container sits in project, the operator named user.
test("CMP-4 / SCOPE-01: explicit --scope user against a project-only marketplace renders the user-direction qualified row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // seedGithubMarketplace seeds the PROJECT scope; ask for USER explicitly.
    await seedGithubMarketplace({ cwd, name: "mp" });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mp",
      scope: "user",
      cwd,
      gitOps,
    });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]?.message,
      "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {marketplace not added to user scope}",
    );
    assert.equal(notifications[0]?.severity, "error");
    // The scope that DOES hold the record is untouched -- the miss is blocked
    // by the pre-guard read, so no guard is ever entered.
    const projectAfter = await loadState(locationsFor("project", cwd).extensionRoot);
    assert.ok(projectAfter.marketplaces["mp"] !== undefined, "project record retained");
  });
});

test("CR-01 TOCTOU: refreshOneMarketplace silently no-ops on a removed marketplace -- no `{network unreachable}`, no second notification", async () => {
  // End-to-end companion to the seam test: drive updateMarketplace with state
  // whose marketplace exists at the pre-guard read but whose guard-time fresh
  // load sees it gone. We simulate the concurrent removal by deleting the record
  // through a gitOps lifecycle hook... but the guard load precedes any gitOps
  // call, so instead we assert the BEHAVIORAL contract via the seam end-state:
  // when snapshotAfterRefresh yields undefined, refreshOneMarketplace must emit
  // NOTHING (the pre-guard already notified `{marketplace not added}`) and MUST NOT render
  // the lying `{network unreachable}` row. We prove the negative directly: an
  // explicit-scope miss (record absent at BOTH reads) emits exactly the
  // `{marketplace not added}` convergence row and NEVER `{network unreachable}`.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const { ctx, run, notifications } = makeCtx();
    const { gitOps, state: gitState } = createGitOps();

    // act
    await assert.doesNotReject(async () =>
      updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "vanished",
        scope: "project",
        cwd,
        gitOps,
      }),
    );

    // assert

    // NFR-5: the record-absent arm never reaches refreshRecord, so the
    // concurrent-removal no-op touches no network.
    assert.equal(gitState.cloneCalls.length, 0);
    assert.equal(gitState.fetchCalls.length, 0);
    assert.equal(gitState.checkoutCalls.length, 0);

    const composed = notifications.map((n) => n.message).join("\n");
    assert.doesNotMatch(
      composed,
      /\{network unreachable\}/,
      `a missing/removed marketplace must NEVER render the lying {network unreachable} reason:\n${composed}`,
    );
    // Exactly the convergence `{marketplace not added}` row, one emission.
    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(
      first.message,
      "A marketplace operation has failed.\n\n⊘ vanished [project] (failed) {marketplace not added}",
    );
  });
});

test("updateMarketplace: bare-form missing marketplace -> bracketless {marketplace not added} (SC#1)", async () => {
  // SC#1 cross-op convergence, bare form (no --scope): resolveScopeFromState
  // throws MarketplaceNotFoundError when absent from BOTH scopes; the pre-guard
  // catches it and routes to the bracketless standalone `(failed) {marketplace not added}`
  // variant. The call resolves WITHOUT rejection, proving the raw
  // MarketplaceNotFoundError does not escape the orchestrator boundary.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    // Leave state empty -- no marketplace named "ghost" in either scope.
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps();

    // act
    await assert.doesNotReject(async () =>
      updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name: "ghost",
        cwd,
        gitOps,
      }),
    );

    // assert

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(
      first.message,
      "A marketplace operation has failed.\n\n⊘ ghost (failed) {marketplace not added}",
    );
    assert.equal(first.severity, "error");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AUTH-02: silent-reuse contract + auth bundle forwarding
//
// These tests lock the two halves of the AUTH-02 contract for marketplace
// update:
//   (a) When credentialOps.fill hits the keychain (post-add scenario),
//       Device Flow does NOT trigger and no "Open ..." notification is
//       emitted.
//   (b) The GitAuthBundle is forwarded by reference into refreshGitHubClone
//       (recorded on gitOps.fetch.auth), proving no re-bundling occurs.
// ───────────────────────────────────────────────────────────────────────────

test("AUTH-02 update: credentialOps.fill HIT yields silent reuse -- NO Device Flow notification emitted", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "private-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();

    // Pre-seed the credential store for github.com so fill() returns the
    // stored token without triggering Device Flow.
    const { credOps: credentialOps, state: credState } = createCredentialOps({
      store: new Map([["github.com", { username: "x-access-token", password: "stored-token" }]]),
    });

    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000020" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "private-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert

    // AUTH-02: Device Flow must NOT fire when credentialOps.fill hits the
    // keychain. The "Open ..." notification is the Device Flow prompt; its
    // absence confirms the silent-reuse path.
    assert.equal(
      notifications.filter((n) => n.message.startsWith("Open ")).length,
      0,
      "AUTH-02: Device Flow notify must NOT fire when credentialOps.fill hits the keychain",
    );

    // The fetch was called exactly once and the auth bundle was forwarded.
    assert.equal(state.fetchCalls.length, 1);
    assert.ok(state.fetchCalls[0]?.auth !== undefined);
    assert.equal(state.fetchCalls[0]?.auth?.host, "github.com");
    assert.strictEqual(state.fetchCalls[0]?.auth?.credentialOps, credentialOps);

    // Exercise the closure end-to-end: buildAuthCallbacks reads the stored
    // credential via credentialOps.fill and returns it as the onAuth result.
    const fetchAuth = state.fetchCalls[0]?.auth;
    assert.ok(fetchAuth !== undefined);
    const cbs = buildAuthCallbacks(fetchAuth);
    const credentials = await cbs.onAuth("https://github.com/owner/repo.git");
    assert.deepStrictEqual(credentials, { username: "x-access-token", password: "stored-token" });
    // fill was called once (from the closure exercised above).
    assert.equal(credState.fillCalls.length, 1);
  });
});

test("AUTH-02 update: the GitAuthBundle is forwarded by reference into refreshGitHubClone (recorded on gitOps.fetch)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "ref-mp", ref: "main" });
    const { ctx, run } = makeCtx();

    // Empty store: fill() returns null. Device Flow would normally trigger
    // when onAuth is invoked, but gitOps.fetch is a pure stub so the
    // callbacks are never called -- only the bundle reference is checked.
    const { credOps: credentialOps } = createCredentialOps();

    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000021" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "ref-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert

    // The auth bundle must be present on the recorded fetch call.
    assert.equal(state.fetchCalls.length, 1);
    assert.ok(state.fetchCalls[0]?.auth !== undefined);
    assert.equal(state.fetchCalls[0]?.auth?.host, "github.com");
    // Reference equality: the same credentialOps instance passed to
    // updateMarketplace must appear on the recorded fetch auth bundle --
    // proves no re-bundling occurred.
    assert.strictEqual(state.fetchCalls[0]?.auth?.credentialOps, credentialOps);
    assert.equal(state.fetchCalls[0]?.auth?.kind, "device-flow");
  });
});

test("GHB-02: updating a GitHub marketplace under the override fetches with the override-host bundle", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "ref-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000021" },
    });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "ref-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● ref-mp [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(
      state.fetchCalls.map(({ auth }) => auth),
      [{ credentialOps, host: "mirror.example:8443", kind: "stored-credential" }],
    );
  });
});

const OVERRIDE_WIRE_URL = "https://mirror.example:8443/git/anthropics/claude-plugins-official.git";

test("UPD-12 / GHB-01: a cancelled credential lookup on a GitHub update under the override names git credential approve before the fetched URL", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "mirror-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const authError = Object.assign(new Error("cancelled"), {
      code: "UserCanceledError",
      cause: new FetchedUrlCause(OVERRIDE_WIRE_URL),
    });
    const { gitOps } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mirror-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ mirror-mp [project] (failed)\n  ⊘ mirror-mp (failed) {authentication required}\n    cause: Failed to update marketplace "mirror-mp". -> cancelled -> no credential was obtained for mirror.example:8443; store one with: printf 'protocol=https\\nhost=mirror.example:8443\\nusername=<user>\\npassword=<token>\\n\\n' | git credential approve -> fetched ${OVERRIDE_WIRE_URL}`,
        severity: "error",
      },
    ]);
  });
});

test("UPD-12 / GHB-01: a GitHub update under the override that the host answers with 500 keeps its chain without the stored-credential line", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "mirror-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const httpErr = Object.assign(new Error("HTTP Error: 500 Internal Server Error"), {
      code: "HttpError",
      data: { statusCode: 500 },
      cause: new FetchedUrlCause(OVERRIDE_WIRE_URL),
    });
    const { gitOps } = createGitOps({ fetchThrows: httpErr });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mirror-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ mirror-mp [project] (failed)\n  ⊘ mirror-mp (failed) {network error}\n    cause: 500 on ${OVERRIDE_WIRE_URL} -> HTTP Error: 500 Internal Server Error -> fetched ${OVERRIDE_WIRE_URL}`,
        severity: "error",
      },
    ]);
  });
});

test("UPD-12 / GHB-01: a challenge after a cross-origin redirect on a GitHub update under the override keeps its chain without the stored-credential line", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "mirror-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const challenge = new CrossOriginChallengeError("https://sso.example.com");
    challenge.cause = new FetchedUrlCause(OVERRIDE_WIRE_URL);
    const { gitOps } = createGitOps({ fetchThrows: challenge });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mirror-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ mirror-mp [project] (failed)\n  ⊘ mirror-mp (failed) {authentication required}\n    cause: Failed to update marketplace "mirror-mp". -> redirected request to https://sso.example.com asked for credentials; a credential is not sent after a redirect to another origin -> fetched ${OVERRIDE_WIRE_URL}`,
        severity: "error",
      },
    ]);
  });
});

test("UPD-12 / GHB-01: a stored credential that the override host rejects keeps its chain without the stored-credential line", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "mirror-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const rejection = new StoredCredentialRejectedError("mirror.example:8443");
    rejection.cause = new FetchedUrlCause(OVERRIDE_WIRE_URL);
    const { gitOps } = createGitOps({ fetchThrows: rejection });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mirror-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Some operations have failed.\n\n⊘ mirror-mp [project] (failed)\n  ⊘ mirror-mp (failed) {authentication required}\n    cause: Failed to update marketplace "mirror-mp". -> mirror.example:8443 rejected the stored credential -> fetched ${OVERRIDE_WIRE_URL}`,
        severity: "error",
      },
    ]);
  });
});

test("UPD-12: a non-Error fetch rejection on a GitHub update under the override reaches the failure row unchanged", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "mirror-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const gitOps: GitOps = {
      ...createGitOps().gitOps,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case is a non-Error rejection
      fetch: () => Promise.reject("socket closed"),
    };

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mirror-mp",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ mirror-mp [project] (failed)\n  ⊘ mirror-mp (failed)\n    cause: Failed to update marketplace "mirror-mp". -> socket closed',
        severity: "error",
      },
    ]);
  });
});

test("GHB-04: a declined Device Flow on a GitHub update without the override keeps its chain without the stored-credential line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({ cwd, name: "declined", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
    const { gitOps } = createGitOps({ fetchThrows: authError });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "declined",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'Some operations have failed.\n\n⊘ declined [project] (failed)\n  ⊘ declined (failed) {authentication required}\n    cause: Failed to update marketplace "declined". -> cancelled',
        severity: "error",
      },
    ]);
  });
});

test("GHB-03: updating a GitHub marketplace on an invalid base fails the command instead of rendering a row", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    await seedGithubMarketplace({ cwd, name: "ref-mp", ref: "main" });
    const stateJsonPath = locationsFor("project", cwd).stateJsonPath;
    const stateBefore = await readFile(stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000021" },
    });

    // act & assert
    await assert.rejects(
      () =>
        updateMarketplace({
          completionCache: createCompletionCache(),
          ctx,
          run,
          name: "ref-mp",
          scope: "project",
          cwd,
          gitOps,
          credentialOps,
        }),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(state.fetchCalls, []);
    assert.strictEqual(await readFile(stateJsonPath, "utf8"), stateBefore);
  });
});

test("GHB-03: an autoupdate cascade plugin failing on an invalid base fails the command", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "auto-mp",
      ref: "main",
      autoupdate: true,
      plugins: { alpha: makePluginRecord(), beta: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000004" },
    });
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const calls: string[] = [];
    const pluginUpdate: PluginUpdateFn = async (plugin) => {
      calls.push(plugin);
      return Promise.reject(invalid);
    };

    // act & assert
    await assert.rejects(
      () =>
        updateMarketplace({
          completionCache: createCompletionCache(),
          ctx,
          run,
          name: "auto-mp",
          scope: "project",
          cwd,
          gitOps,
          pluginUpdate,
        }),
      (error: unknown) => {
        assert.strictEqual(error, invalid);
        return true;
      },
    );
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(calls, ["alpha"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WARN-01 / WR-12 / D-99-03: the autoupdate cascade's `(updated)` row
// ──────────────────────────────────────────────────────────────────────────

test("WR-12: the autoupdate cascade row is byte-identical to the standalone update row for the same degraded outcome", async () => {
  // The update verb has TWO surfaces that render an `(updated)` row -- this
  // autoupdate cascade and the manual update cascade -- and they read the same
  // outcome. One naming the degrade while the other renders a bare success row
  // is exactly the drift the single composer exists to prevent, so the surfaces
  // are pinned against each other rather than each against its own literal.
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedGithubMarketplace({
      cwd,
      name: "mp",
      ref: "main",
      autoupdate: true,
      plugins: { hello: makePluginRecord() },
    });
    const { ctx, run, notifications } = makeCtx();
    const { gitOps } = createGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000031" },
    });
    const pluginUpdate: PluginUpdateFn = async (plugin) =>
      Promise.resolve({
        partition: "updated",
        name: plugin,
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        degradedKinds: ["skill"],
        constraint: undefined,
      });

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "mp",
      scope: "project",
      cwd,
      gitOps,
      pluginUpdate,
    });

    // assert

    const first = notifications[0];
    assert.ok(first !== undefined);
    // Byte-identical to the row `test/orchestrators/plugin/update-flow.test.ts`
    // pins for the standalone verb, down to the two-space cascade indent.
    assert.ok(
      first.message.includes("  ● hello v1.0.0 → v1.0.1 (updated) {malformed skill}"),
      `expected the standalone row bytes, got: ${first.message}`,
    );
    // WARN-01: the malformed raise is a SEPARATE axis from the WR-01
    // companion-absence suppression this surface applies, so it fires here even
    // though an absent companion deliberately does not.
    assert.equal(first.severity, "warning");
  });
});

test("silently retains a failed changed-target cache cleanup and preserves later no-effect rows", async (testContext) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const now = new Date("2026-09-01T12:00:00.000Z");
    testContext.mock.timers.enable({ apis: ["Date"], now });
    const marketplaceRoot = path.join(cwd, "marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "cache-mp", marketplaceRoot });
    const locations = locationsFor("project", cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces["cache-mp"];
    if (record === undefined) {
      throw new Error("the cache failure fixture has no target marketplace");
    }

    record.lastSuccessfulManifest = '{"name":"valid-marketplace","plugins":[]}';
    await saveState(locations.extensionRoot, state);
    const configBytes = await readFile(locations.baseConfigJsonPath, "utf8").catch(() => undefined);
    const pluginCachePath = await locations.pluginCacheFile("cache-mp");
    await mkdir(pluginCachePath, { recursive: true });
    const residuePath = path.join(pluginCachePath, "residue");
    await writeFile(residuePath, "cache residue");
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();
    const completionCache = createCompletionCache();
    const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");

    // act
    await updateMarketplace({
      completionCache,
      ctx,
      run,
      name: "cache-mp",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
    });
    const stateAfterFailure = await loadState(locations.extensionRoot);
    const residueAfterFailure = await readFile(residuePath, "utf8");
    await rm(pluginCachePath, { recursive: true, force: true });
    await updateMarketplace({
      completionCache,
      ctx,
      run,
      name: "cache-mp",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
    });

    // assert
    const expectedState = {
      schemaVersion: 3,
      marketplaces: {
        "cache-mp": {
          name: "cache-mp",
          scope: "project",
          source: pathSource(marketplaceRoot),
          addedFromCwd: cwd,
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          plugins: {},
          lastUpdatedAt: now.toISOString(),
          lastSuccessfulManifest: VALID_MANIFEST_JSON,
        },
      },
    };
    assert.deepStrictEqual(notifications, [
      { message: "● cache-mp [project] (updated)" },
      { message: "● cache-mp [project] (skipped) {up-to-date}" },
    ]);
    assert.deepStrictEqual(stateAfterFailure, expectedState);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), expectedState);
    assert.strictEqual(residueAfterFailure, "cache residue");
    assert.strictEqual(await pathExists(pluginCachePath), false);
    assert.strictEqual(
      await readFile(locations.baseConfigJsonPath, "utf8").catch(() => undefined),
      configBytes,
    );
    assert.deepStrictEqual(git.calls, []);
    assert.strictEqual(drop.mock.callCount(), 1);
    assert.deepStrictEqual(drop.mock.calls[0]?.arguments, [pluginCachePath, "project", "cache-mp"]);
  });
});

test("silently stops when the marketplace vanishes after preflight", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
    await seedPathMarketplace({ cwd, name: "vanishing-mp", marketplaceRoot });
    const locations = locationsFor("project", cwd);
    // The pre-guard probe reads the real state file and finds the record; the
    // injected in-lock load does not. That asymmetry IS the concurrent
    // removal, expressed without racing a real writer.
    let inLockLoads = 0;
    const stateTransaction = {
      loadState: async (): Promise<ExtensionState> => {
        inLockLoads += 1;
        return await Promise.resolve({ schemaVersion: 2 as const, marketplaces: {} });
      },
    };
    const { ctx, run, notifications } = makeCtx();
    const git = makeForbiddenGitOps();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "vanishing-mp",
      scope: "project",
      cwd,
      gitOps: git.gitOps,
      stateTransaction,
    });

    // assert
    assert.strictEqual(inLockLoads, 1);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.deepStrictEqual(git.calls, []);
  });
});

// ---------------------------------------------------------------------------
// D-PL2-10: after the autoupdate cascade's plugin updates, the
// missing-dependency step runs in the marketplace's scope for missing
// dependencies that a plugin of the refreshed marketplace declares.
// ---------------------------------------------------------------------------

const AUTOUPDATE_DEPENDENCY_ROW = {
  status: "installed",
  name: "lib@deps-mp",
  version: "1.0.0",
  dependencies: [],
  reasons: ["dependency installed"],
  severity: "info",
  needsReload: true,
} as const satisfies ScopeDependencyInstallRow;

/** A recorded call of the step, with what its `select` answers for four entries. */
interface AutoupdateStepCall {
  readonly scope: Scope;
  readonly cwd: string;
  readonly selects: readonly boolean[];
}

/**
 * A recording missing-dependency step that pushes `"step"` onto `events`, so
 * a case can order it against the plugin updates. `select` is asked about a
 * declarer of the refreshed marketplace, one of another marketplace, a mixed
 * list, and a marketplace whose name only ends with the refreshed one's.
 */
function recordingAutoupdateStep(
  result: ScopeDependencyInstallResult,
  events: string[],
): {
  readonly installMissingDependencies: ScopeDependencyInstallFn;
  readonly calls: AutoupdateStepCall[];
} {
  const calls: AutoupdateStepCall[] = [];
  const installMissingDependencies: ScopeDependencyInstallFn = (request) => {
    events.push("step");
    calls.push({
      scope: request.scope,
      cwd: request.cwd,
      selects: [
        request.select({ plugin: "lib", marketplace: "other", declarers: ["app@deps-mp"] }),
        request.select({ plugin: "lib", marketplace: "deps-mp", declarers: ["app@other"] }),
        request.select({
          plugin: "lib",
          marketplace: "other",
          declarers: ["tool@other", "app@deps-mp"],
        }),
        request.select({ plugin: "lib", marketplace: "other", declarers: ["app@my-deps-mp"] }),
      ],
    });
    return Promise.resolve(result);
  };

  return { installMissingDependencies, calls };
}

/** A missing-dependency step a case promises is never reached. */
function unreachedAutoupdateStep(): ScopeDependencyInstallFn {
  return () => Promise.reject(new Error("the missing-dependency step must not run"));
}

/** A plugin update that records `update:<plugin>` and answers `partition`. */
function recordingPluginUpdate(
  partition: "unchanged" | "updated",
  events: string[],
): PluginUpdateFn {
  return (plugin) => {
    events.push(`update:${plugin}`);
    return Promise.resolve(
      partition === "unchanged"
        ? {
            partition,
            name: plugin,
            fromVersion: "0.0.1",
            toVersion: "0.0.1",
            declaresAgents: false,
            declaresMcp: false,
            constraint: undefined,
            declaresWorkflows: false,
          }
        : {
            partition,
            name: plugin,
            fromVersion: "0.0.1",
            toVersion: "0.0.2",
            stagedAgentNames: [],
            stagedMcpServerNames: [],
            declaresAgents: false,
            declaresMcp: false,
            constraint: undefined,
            declaresWorkflows: false,
            mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
          },
    );
  };
}

/** Seeds `deps-mp`, a path marketplace whose manifest the refresh finds unchanged. */
async function seedDependencyStepMarketplace(cwd: string, autoupdate: boolean): Promise<void> {
  const marketplaceRoot = path.join(cwd, "deps-marketplace");
  await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
  await seedPathMarketplace({
    cwd,
    name: "deps-mp",
    marketplaceRoot,
    autoupdate,
    plugins: { alpha: makePluginRecord(), beta: makePluginRecord() },
  });
}

test("D-PL2-10: the autoupdate cascade runs the missing-dependency step once, after every plugin update, and lists its rows and notices after the updates'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];
    const step = recordingAutoupdateStep(
      {
        rows: [AUTOUPDATE_DEPENDENCY_ROW],
        mcpConfigNotices: [
          { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
        ],
      },
      events,
    );

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      pluginUpdate: recordingPluginUpdate("updated", events),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(events, ["update:alpha", "update:beta", "step"]);
    assert.deepStrictEqual(step.calls, [
      { scope: "project", cwd, selects: [true, false, true, false] },
    ]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● deps-mp [project] (updated)\n" +
          "  ● alpha v0.0.1 → v0.0.2 (updated)\n" +
          "  ● beta v0.0.1 → v0.0.2 (updated)\n" +
          "  ● lib@deps-mp v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "MCP config comments removed.\n\n" +
          "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.\n" +
          "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        severity: "warning",
      },
    ]);
  });
});

test("D-PL2-21: a missing-dependency step that throws after the plugin updates reports their rows and notices before the error reaches the caller", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const installMissingDependencies: ScopeDependencyInstallFn = () => {
      events.push("step");
      return Promise.reject(invalid);
    };

    // act & assert
    await assert.rejects(
      () =>
        updateMarketplace({
          completionCache: createCompletionCache(),
          ctx,
          run,
          name: "deps-mp",
          scope: "project",
          cwd,
          pluginUpdate: recordingPluginUpdate("updated", events),
          installMissingDependencies,
        }),
      (error: unknown) => {
        assert.strictEqual(error, invalid);
        return true;
      },
    );
    assert.deepStrictEqual(events, ["update:alpha", "update:beta", "step"]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● deps-mp [project] (updated)\n" +
          "  ● alpha v0.0.1 → v0.0.2 (updated)\n" +
          "  ● beta v0.0.1 → v0.0.2 (updated)\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "MCP config comments removed.\n\n" +
          "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        severity: "warning",
      },
    ]);
  });
});

test("D-PL2-10: the step does not try again a dependency an update of the cascade already reported", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run } = makeCtx();
    const pluginUpdate: PluginUpdateFn = (plugin) =>
      Promise.resolve({
        partition: "failed",
        name: plugin,
        notes: ["dependency failed"],
        reasons: ["dependency failed"],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        dependencyRows:
          plugin === "alpha"
            ? [
                {
                  status: "failed",
                  name: "lib@deps-mp",
                  reasons: [],
                  severity: "error",
                  needsReload: false,
                },
              ]
            : [],
      });
    const selects: boolean[] = [];

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      pluginUpdate,
      installMissingDependencies: (request) => {
        selects.push(
          request.select({ plugin: "lib", marketplace: "deps-mp", declarers: ["alpha@deps-mp"] }),
          request.select({ plugin: "core", marketplace: "deps-mp", declarers: ["alpha@deps-mp"] }),
        );
        return Promise.resolve({ rows: [], mcpConfigNotices: [] });
      },
    });

    // assert
    assert.deepStrictEqual(selects, [false, true]);
  });
});

test("D-PL2-10: an unchanged autoupdate whose step installs nothing still reports up to date", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];
    const step = recordingAutoupdateStep({ rows: [], mcpConfigNotices: [] }, events);

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      pluginUpdate: recordingPluginUpdate("unchanged", events),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(events, ["update:alpha", "update:beta", "step"]);
    assert.deepStrictEqual(notifications, [
      { message: "● deps-mp [project] (skipped) {up-to-date}" },
    ]);
  });
});

test("D-PL2-10: an unchanged autoupdate whose step installs a dependency reports the marketplace updated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];
    const step = recordingAutoupdateStep(
      { rows: [AUTOUPDATE_DEPENDENCY_ROW], mcpConfigNotices: [] },
      events,
    );

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      pluginUpdate: recordingPluginUpdate("unchanged", events),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● deps-mp [project] (updated)\n" +
          "  ⊘ alpha (skipped) {up-to-date}\n" +
          "  ⊘ beta (skipped) {up-to-date}\n" +
          "  ● lib@deps-mp v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
  });
});

test("D-PL2-10: a marketplace with autoupdate off runs no missing-dependency step", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, false);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      pluginUpdate: recordingPluginUpdate("updated", events),
      installMissingDependencies: unreachedAutoupdateStep(),
    });

    // assert
    assert.deepStrictEqual(events, []);
    assert.deepStrictEqual(notifications, [
      { message: "● deps-mp [project] (skipped) {up-to-date}" },
    ]);
  });
});

test("D-PL2-10: an update with no plugin-update seam runs no missing-dependency step", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();

    // act
    await updateMarketplace({
      completionCache: createCompletionCache(),
      ctx,
      run,
      name: "deps-mp",
      scope: "project",
      cwd,
      installMissingDependencies: unreachedAutoupdateStep(),
    });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● deps-mp [project] (skipped) {up-to-date}" },
    ]);
  });
});

test("D-PL2-01 / WR-04: a bare update tries a dependency two autoupdated marketplaces of one scope declare once, and again in the other scope", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const moreRoot = path.join(cwd, "more-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), moreRoot, { recursive: true });
    const project = locationsFor("project", cwd);
    const state = await loadState(project.extensionRoot);
    const depsRecord = state.marketplaces["deps-mp"];
    assert.ok(depsRecord !== undefined);
    state.marketplaces["more-mp"] = {
      ...depsRecord,
      name: "more-mp",
      source: pathSource(moreRoot),
      manifestPath: path.join(moreRoot, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: moreRoot,
    };
    await saveState(project.extensionRoot, state);
    await saveConfig(
      project.baseConfigJsonPath,
      {
        schemaVersion: 1,
        marketplaces: {
          "deps-mp": { source: path.join(cwd, "deps-marketplace"), autoupdate: true },
          "more-mp": { source: moreRoot, autoupdate: true },
        },
      },
      project.scopeRoot,
    );
    const userRoot = path.join(cwd, "user-marketplace");
    await cp(fixtureMarketplaceDir("valid-marketplace"), userRoot, { recursive: true });
    await seedPathMarketplace({
      cwd,
      name: "deps-mp",
      marketplaceRoot: userRoot,
      scope: "user",
      autoupdate: true,
      plugins: { alpha: makePluginRecord() },
    });
    const { ctx, run } = makeCtx();
    const selected: { readonly scope: Scope; readonly selected: boolean }[] = [];
    const installMissingDependencies: ScopeDependencyInstallFn = (request) => {
      const lib = request.select({
        plugin: "lib",
        marketplace: "shared",
        declarers: ["alpha@deps-mp", "alpha@more-mp"],
      });
      selected.push({ scope: request.scope, selected: lib });
      return Promise.resolve({
        rows: lib
          ? [
              {
                status: "failed",
                name: "lib@shared",
                reasons: [],
                severity: "error",
                needsReload: false,
              },
            ]
          : [],
        mcpConfigNotices: [],
      });
    };

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      cwd,
      pluginUpdate: recordingPluginUpdate("unchanged", []),
      installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(selected, [
      { scope: "project", selected: true },
      { scope: "project", selected: false },
      { scope: "user", selected: true },
    ]);
  });
});

test("D-PL2-10: updateAllMarketplaces forwards the missing-dependency step to each autoupdate cascade", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    await seedDependencyStepMarketplace(cwd, true);
    const { ctx, run, notifications } = makeCtx();
    const events: string[] = [];
    const step = recordingAutoupdateStep(
      { rows: [AUTOUPDATE_DEPENDENCY_ROW], mcpConfigNotices: [] },
      events,
    );

    // act
    await updateAllMarketplaces({
      completionCache: createCompletionCache(),
      ctx,
      run,
      scope: "project",
      cwd,
      pluginUpdate: recordingPluginUpdate("unchanged", events),
      installMissingDependencies: step.installMissingDependencies,
    });

    // assert
    assert.deepStrictEqual(events, ["update:alpha", "update:beta", "step"]);
    assert.deepStrictEqual(step.calls, [
      { scope: "project", cwd, selects: [true, false, true, false] },
    ]);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● deps-mp [project] (updated)\n" +
          "  ⊘ alpha (skipped) {up-to-date}\n" +
          "  ⊘ beta (skipped) {up-to-date}\n" +
          "  ● lib@deps-mp v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Marketplace update: 4 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
  });
});

for (const { layer, runsCascade } of [
  { layer: undefined, runsCascade: true },
  { layer: "localConfigJsonPath", runsCascade: false },
  { layer: "baseConfigJsonPath", runsCascade: false },
] as const) {
  test(`D-PL8-07: an official marketplace with ${layer ?? "no invalid config layer"} ${runsCascade ? "runs" : "does not run"} the plugin cascade`, async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const name = "claude-plugins-official";
      const marketplaceRoot = path.join(cwd, name);
      await cp(fixtureMarketplaceDir("valid-marketplace"), marketplaceRoot, { recursive: true });
      const installed = makePluginRecord();
      await seedPathMarketplace({ cwd, name, marketplaceRoot, plugins: { hello: installed } });
      const locations = locationsFor("project", cwd);
      await mkdir(locations.scopeRoot, { recursive: true });
      if (layer !== undefined) {
        await writeFile(locations[layer], "{ invalid", "utf8");
      }

      await writeFile(
        path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          ...(JSON.parse(VALID_MANIFEST_JSON) as Record<string, unknown>),
          description: "Changed since the baseline",
        }),
        "utf8",
      );
      const cascadeCalls: string[] = [];
      const pluginUpdate: PluginUpdateFn = (plugin) => {
        cascadeCalls.push(plugin);
        return Promise.resolve({
          partition: "unchanged",
          name: plugin,
          fromVersion: installed.version,
          toVersion: installed.version,
          declaresAgents: false,
          declaresMcp: false,
          constraint: undefined,
          declaresWorkflows: false,
        });
      };

      const { ctx, run } = makeCtx();

      // act
      await updateMarketplace({
        completionCache: createCompletionCache(),
        ctx,
        run,
        name,
        scope: "project",
        cwd,
        gitOps: makeForbiddenGitOps().gitOps,
        pluginUpdate,
      });

      // assert
      assert.deepStrictEqual(cascadeCalls, runsCascade ? ["hello"] : []);
    });
  });
}
